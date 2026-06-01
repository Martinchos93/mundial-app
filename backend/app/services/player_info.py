"""Enrich players with a photo and a short bio from Wikipedia.

Uses the MediaWiki API (free, no key/quota) in batches: for a list of player
names it returns the article thumbnail, intro extract and canonical URL.
Server-side httpx — no WebFetch / API-Football involved.
"""
from __future__ import annotations

import logging
import time
from datetime import date, datetime

import httpx
from sqlalchemy.orm import Session

from app.models import Player

logger = logging.getLogger(__name__)

WIKI_API = "https://en.wikipedia.org/w/api.php"
_BATCH = 20  # extracts API caps multi-title requests at 20
# Wikipedia requires a descriptive User-Agent identifying the app + contact.
_UA = "Mundial2026App/1.0 (https://github.com/mundial-app; contact: mundial2026@example.com)"


def _wiki_get(client: httpx.Client, titles: str, retries: int = 4) -> dict:
    params = {
        "action": "query",
        "format": "json",
        "prop": "pageimages|extracts|info",
        "piprop": "thumbnail",
        "pithumbsize": "240",
        "exintro": "1",
        "explaintext": "1",
        "exsentences": "3",
        "inprop": "url",
        "redirects": "1",
        "titles": titles,
    }
    delay = 2.0
    for attempt in range(retries):
        resp = client.get(WIKI_API, params=params)
        if resp.status_code == 429:
            wait = float(resp.headers.get("Retry-After", delay))
            time.sleep(wait)
            delay *= 2
            continue
        resp.raise_for_status()
        return resp.json().get("query", {})
    return {}


def enrich_players(db: Session, only_missing: bool = True, limit: int | None = None) -> dict:
    q = db.query(Player)
    if only_missing:
        q = q.filter(Player.photo_url.is_(None))
    players = q.order_by(Player.team_name, Player.id).all()
    if limit:
        players = players[:limit]

    updated = 0
    with httpx.Client(timeout=20.0, headers={"User-Agent": _UA}) as client:
        for i in range(0, len(players), _BATCH):
            batch = players[i : i + _BATCH]
            titles = "|".join(p.name for p in batch)
            try:
                query = _wiki_get(client, titles)
            except Exception:  # noqa: BLE001
                logger.exception("Wikipedia enrich batch failed")
                continue
            if not query:
                continue

            # Resolve each requested name to its final article title.
            norm = {n["from"]: n["to"] for n in query.get("normalized", [])}
            redir = {r["from"]: r["to"] for r in query.get("redirects", [])}

            def resolve(name: str) -> str:
                t = norm.get(name, name)
                return redir.get(t, t)

            pages_by_title = {
                (pg.get("title") or "").lower(): pg for pg in query.get("pages", {}).values()
            }

            for p in batch:
                pg = pages_by_title.get(resolve(p.name).lower())
                if not pg:
                    continue
                thumb = (pg.get("thumbnail") or {}).get("source")
                extract = pg.get("extract")
                changed = False
                if thumb:
                    p.photo_url = thumb
                    changed = True
                if extract:
                    p.bio = extract[:600]
                    changed = True
                if pg.get("fullurl"):
                    p.wiki_url = pg["fullurl"]
                if changed:
                    updated += 1
            db.commit()
            time.sleep(1.0)

    return {"players_checked": len(players), "updated": updated}


WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"


def _age_from(dob: str | None) -> int | None:
    if not dob or len(dob) < 10:
        return None
    try:
        b = datetime.strptime(dob[:10], "%Y-%m-%d").date()
    except ValueError:
        return None
    t = date.today()
    return t.year - b.year - ((t.month, t.day) < (b.month, b.day))


def enrich_details(db: Session, only_missing: bool = True, limit: int | None = None) -> dict:
    """Add current club + birth date (+ age) from Wikidata (free, batched)."""
    q = db.query(Player)
    if only_missing:
        q = q.filter(Player.club.is_(None))
    players = q.order_by(Player.team_name, Player.id).all()
    if limit:
        players = players[:limit]

    updated = 0
    with httpx.Client(timeout=30.0, headers={"User-Agent": _UA}) as client:
        # 1) name -> Wikidata QID via Wikipedia pageprops
        qid_of: dict[int, str] = {}
        for i in range(0, len(players), 50):
            batch = players[i : i + 50]
            try:
                resp = client.get(
                    WIKI_API,
                    params={
                        "action": "query", "format": "json", "prop": "pageprops",
                        "ppprop": "wikibase_item", "redirects": "1",
                        "titles": "|".join(p.name for p in batch),
                    },
                )
                resp.raise_for_status()
                query = resp.json().get("query", {})
            except Exception:  # noqa: BLE001
                continue
            norm = {n["from"]: n["to"] for n in query.get("normalized", [])}
            redir = {r["from"]: r["to"] for r in query.get("redirects", [])}
            pages = {(pg.get("title") or "").lower(): pg for pg in query.get("pages", {}).values()}
            for p in batch:
                t = norm.get(p.name, p.name)
                t = redir.get(t, t)
                pg = pages.get(t.lower())
                qid = (pg or {}).get("pageprops", {}).get("wikibase_item") if pg else None
                if qid:
                    qid_of[p.id] = qid
            time.sleep(0.4)

        # 2) Wikidata SPARQL: DOB + current (preferred) club label, chunked
        by_qid = {qid: pid for pid, qid in qid_of.items()}
        qids = list(by_qid.keys())
        for i in range(0, len(qids), 120):
            chunk = qids[i : i + 120]
            values = " ".join(f"wd:{q}" for q in chunk)
            sparql = (
                "SELECT ?player ?dob ?clubLabel WHERE { VALUES ?player { %s } "
                "OPTIONAL { ?player wdt:P569 ?dob. } "
                "OPTIONAL { ?player p:P54 ?s. ?s ps:P54 ?club. FILTER NOT EXISTS { ?s pq:P582 ?end. } } "
                'SERVICE wikibase:label { bd:serviceParam wikibase:language "en,es". } }' % values
            )
            try:
                resp = client.get(
                    WIKIDATA_SPARQL, params={"query": sparql, "format": "json"},
                    headers={"User-Agent": _UA, "Accept": "application/sparql-results+json"},
                )
                resp.raise_for_status()
                rows = resp.json()["results"]["bindings"]
            except Exception:  # noqa: BLE001
                logger.exception("Wikidata SPARQL chunk failed")
                time.sleep(2)
                continue
            for row in rows:
                qid = row["player"]["value"].rsplit("/", 1)[-1]
                pid = by_qid.get(qid)
                if pid is None:
                    continue
                player = db.get(Player, pid)
                if player is None:
                    continue
                dob = row.get("dob", {}).get("value")
                club = row.get("clubLabel", {}).get("value")
                if dob:
                    player.birth_date = dob[:10]
                    player.age = _age_from(dob)
                # Skip national teams and unlabeled QIDs; a real club wins.
                if club and not club.startswith("Q") and "national" not in club.lower():
                    player.club = club[:120]
                updated += 1
            db.commit()
            time.sleep(1.0)

    return {"qids": len(qid_of), "updated": updated}
