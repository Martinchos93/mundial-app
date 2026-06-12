"""Live World Cup match updates scraped from promiedos.com.ar.

OFF by default; toggled via the `live_scraping_enabled` app setting from the
admin dashboard. Only touches group matches still in {scheduled, live}, so it
never overwrites a result an admin finalized (or edited) manually.

Source: the FIFA World Cup league page (id `fjda`), whose server-rendered HTML
embeds every game as JSON: teams (by stable English `url_name`), status, score,
minute and red cards.
"""
from __future__ import annotations

import json
import logging
import re
import urllib.request

from sqlalchemy.orm import Session

from app.models import Match, Setting
from app.services.sync import recalculate_match_scores

logger = logging.getLogger(__name__)

LEAGUE_URL = "https://www.promiedos.com.ar/league/fifa-world-cup/fjda"
_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
_DECODER = json.JSONDecoder()
_GAME_RE = re.compile(r'\{"id":"[a-z0-9]{4,10}","stage_round_name"')

# promiedos url_name -> our (English) team name. url_names are stable slugs.
URL_NAME_MAP: dict[str, str] = {
    "germany": "Germany", "saudi-arabia": "Saudi Arabia", "algeria": "Algeria",
    "argentina": "Argentina", "australia": "Australia", "austria": "Austria",
    "bosnia-&-herzegovina": "Bosnia and Herzegovina", "brazil": "Brazil",
    "belgium": "Belgium", "cape-verde": "Cape Verde", "canada": "Canada",
    "colombia": "Colombia", "south-korea": "Korea Republic",
    "ivory-coast": "Cote D'Ivoire", "croatia": "Croatia", "curacao": "Curacao",
    "ecuador": "Ecuador", "egypt": "Egypt", "scotland": "Scotland",
    "spain": "Spain", "usa": "USA", "france": "France", "ghana": "Ghana",
    "haiti": "Haiti", "england": "England", "iraq": "Iraq", "iran": "IR Iran",
    "japan": "Japan", "jordan": "Jordan", "morocco": "Morocco", "mexico": "Mexico",
    "norway": "Norway", "new-zealand": "New Zealand", "panama": "Panama",
    "paraguay": "Paraguay", "netherlands": "Netherlands", "portugal": "Portugal",
    "qatar": "Qatar", "dr-congo": "DR Congo", "czech-republic": "Czech Republic",
    "senegal": "Senegal", "south-africa": "South Africa", "sweden": "Sweden",
    "switzerland": "Switzerland", "turkiye": "Turkey", "tunisia": "Tunisia",
    "uruguay": "Uruguay", "uzbekistan": "Uzbekistan",
}


def is_enabled(db: Session) -> bool:
    s = db.get(Setting, "live_scraping_enabled")
    return bool((s.value or {}).get("v")) if s else False


def _http_get(url: str) -> str:
    req = urllib.request.Request(
        url, headers={"User-Agent": _UA, "Referer": "https://www.promiedos.com.ar/"}
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "ignore")


def _games_from_page(html: str) -> list[dict]:
    games: list[dict] = []
    for m in _GAME_RE.finditer(html):
        try:
            obj, _ = _DECODER.raw_decode(html, m.start())
            games.append(obj)
        except Exception:  # noqa: BLE001
            continue
    return games


def _status_of(game: dict) -> str:
    st = game.get("status") or {}
    name = (st.get("name") or "").lower()
    enum = st.get("enum")
    if "final" in name or name.startswith("fin") or enum == 3:
        return "finished"
    if enum == 1 or name.startswith("prog") or name in ("", "v"):
        return "scheduled"
    return "live"  # 1T / 2T / ENT / minute / "En Vivo" ...


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _score_of(game: dict) -> tuple[int | None, int | None]:
    """Best-effort home/away score, trying the shapes promiedos may use."""
    for key in ("scores", "score"):
        v = game.get(key)
        if isinstance(v, (list, tuple)) and len(v) == 2:
            return _int(v[0]), _int(v[1])
    teams = game.get("teams") or []
    if len(teams) == 2:
        for key in ("score", "goals", "result"):
            a, b = teams[0].get(key), teams[1].get(key)
            if a is not None and b is not None:
                return _int(a), _int(b)
    return None, None


GAME_DETAIL_URL = "https://www.promiedos.com.ar/game/{slug}/{gid}"
# promiedos timeline event types
_EV_YELLOW = 4
_EV_RED = 5


def _fetch_game_detail(slug: str, gid: str) -> dict | None:
    """Yellow cards (and booked/sent-off player names) live ONLY on the per-game
    detail page, not the league feed. Returns counts oriented to promiedos team
    order (index 0 = teams[0], 1 = teams[1]) plus combined name lists, or None.
    """
    try:
        html = _http_get(GAME_DETAIL_URL.format(slug=slug, gid=gid))
        i = html.find('{"id":"%s"' % gid)
        if i < 0:
            return None
        obj, _ = _DECODER.raw_decode(html, i)
    except Exception:  # noqa: BLE001
        logger.exception("promiedos detail fetch failed for %s/%s", slug, gid)
        return None

    yellows: list[int | None] = [None, None]
    for s in obj.get("statistics") or []:
        if (s.get("name") or "").strip().lower() == "tarjetas amarillas":
            vals = s.get("values") or []
            if len(vals) == 2:
                yellows = [_int(vals[0]), _int(vals[1])]

    booked: list[str] = []
    sent_off: list[str] = []
    for stage in obj.get("events") or []:
        for row in stage.get("rows") or []:
            for e in row.get("events") or []:
                name = (e.get("texts") or [""])[0].strip()
                if not name:
                    continue
                if e.get("type") == _EV_YELLOW:
                    booked.append(name)
                elif e.get("type") == _EV_RED:
                    sent_off.append(name)
    return {"yellows": yellows, "booked": booked, "sent_off": sent_off}


def fetch_and_apply(db: Session) -> dict:
    """Pull current WC games from promiedos and update our group matches.
    Returns a small summary. No-op (and no network) when the toggle is off."""
    if not is_enabled(db):
        return {"enabled": False, "updated": 0}

    try:
        games = _games_from_page(_http_get(LEAGUE_URL))
    except Exception:  # noqa: BLE001
        logger.exception("promiedos fetch failed")
        return {"enabled": True, "error": True, "updated": 0}

    updated = 0
    for g in games:
        teams = g.get("teams") or []
        if len(teams) != 2:
            continue
        n0 = URL_NAME_MAP.get(teams[0].get("url_name"))
        n1 = URL_NAME_MAP.get(teams[1].get("url_name"))
        if not n0 or not n1:
            continue

        m = (
            db.query(Match)
            .filter(
                Match.phase.ilike("Grupo %"),
                Match.home_team.in_([n0, n1]),
                Match.away_team.in_([n0, n1]),
            )
            .first()
        )
        if m is None:
            continue

        new_status = _status_of(g)

        # Orient scores/cards/scorers to our home/away. promiedos team.goals is
        # a list of goal events with player_name.
        s0, s1 = _score_of(g)
        r0, r1 = _int(teams[0].get("red_cards")), _int(teams[1].get("red_cards"))
        g0 = [str(x.get("player_name") or "").strip() for x in (teams[0].get("goals") or [])]
        g1 = [str(x.get("player_name") or "").strip() for x in (teams[1].get("goals") or [])]
        g0 = [x for x in g0 if x]
        g1 = [x for x in g1 if x]
        if m.home_team == n0:
            hs, as_, hr, ar, hg, ag = s0, s1, r0, r1, g0, g1
        else:
            hs, as_, hr, ar, hg, ag = s1, s0, r1, r0, g1, g0

        # Already finalized: only fill MISSING goalscorers (never overwrite a
        # manual result), then re-score so the goleadores points land.
        if m.status == "finished":
            if not m.scorers and (hg or ag) and m.home_score == hs and m.away_score == as_:
                m.scorers = (hg + ag) or None
                db.flush()
                recalculate_match_scores(db, m)
                updated += 1
            continue

        if new_status == "scheduled":
            continue  # nothing to apply yet

        changed = m.status != new_status
        m.status = new_status
        if hs is not None and as_ is not None:
            if m.home_score != hs or m.away_score != as_:
                m.home_score, m.away_score = hs, as_
                changed = True
        if hr is not None:
            m.home_reds = hr
        if ar is not None:
            m.away_reds = ar
        m.scorers = (hg + ag) or None  # goalscorer names (for Stats + scoring)
        gt = _int(g.get("game_time"))
        m.minute = gt if (gt is not None and gt >= 0) else None

        # Yellows + booked/sent-off names are NOT in the league feed — pull them
        # from the game detail page so the yellow/card scoring can land.
        slug, gid = g.get("url_name"), g.get("id")
        if slug and gid:
            detail = _fetch_game_detail(str(slug), str(gid))
            if detail:
                y0, y1 = detail["yellows"]
                hy, ay = (y0, y1) if m.home_team == n0 else (y1, y0)
                if hy is not None:
                    m.home_yellows = hy
                if ay is not None:
                    m.away_yellows = ay
                m.booked = detail["booked"] or None  # combined names; scoring matches by name
                if detail["sent_off"]:
                    m.red_players = detail["sent_off"]

        # One-time visibility into the live structure (helps verify score field).
        if (g.get("status") or {}).get("enum") not in (1, None):
            logger.info("promiedos live game sample: %s", json.dumps(g)[:400])

        if changed:
            updated += 1
        if new_status == "finished":
            db.flush()
            recalculate_match_scores(db, m)

    db.commit()
    return {"enabled": True, "updated": updated, "games": len(games)}
