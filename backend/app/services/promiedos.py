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
from datetime import datetime, timezone

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


LEAGUE_ID = "fjda"
GAMES_API = "https://api.promiedos.com.ar/league/games/{lid}/{key}"


def _round_keys(html: str) -> list[str]:
    """Round keys (e.g. '5930_25_1_2' = Fecha 2) from the league page filters."""
    try:
        m = re.search(r'__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
        data = json.loads(m.group(1))
        filters = data["props"]["pageProps"]["data"]["games"]["filters"]
        return [f["key"] for f in filters if f.get("key") and f["key"] != "latest"]
    except Exception:  # noqa: BLE001
        return []


def _all_games(html: str) -> list[dict]:
    """Games across EVERY matchday. The league page only server-renders 'Fecha 1',
    so we pull each round from the per-round API (that's how we discover later
    matchdays like Czech vs South Africa). Falls back to the Fecha-1 scrape."""
    games: list[dict] = []
    for key in _round_keys(html):
        try:
            raw = _http_get(GAMES_API.format(lid=LEAGUE_ID, key=key))
            games.extend(json.loads(raw).get("games") or [])
        except Exception:  # noqa: BLE001
            continue
    return games or _games_from_page(html)


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
MAX_DETAIL_PER_RUN = 8  # cap slow detail fetches per sync so we don't hold the DB conn
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

    # Lineups (formation + starting XI + subs), oriented by team_num (1 = teams[0]).
    lineups: list[dict | None] = [None, None]
    for t in ((obj.get("players") or {}).get("lineups") or {}).get("teams") or []:
        idx = 0 if t.get("team_num") == 1 else 1 if t.get("team_num") == 2 else None
        if idx is None:
            continue
        num_to_name = {
            p.get("jersey_num"): p.get("name")
            for p in (t.get("starting") or []) + (t.get("bench") or [])
        }
        starting = [
            {
                "name": p.get("name"),
                "num": p.get("jersey_num"),
                "pos": p.get("position"),
                "captain": bool(p.get("is_captain")),
            }
            for p in t.get("starting") or []
        ]
        subs = []
        for p in t.get("bench") or []:
            sub = p.get("substitution") or {}
            if sub.get("time") is not None and sub.get("player") is not None:
                subs.append(
                    {"in": p.get("name"), "out": num_to_name.get(sub.get("player")), "minute": _int(sub.get("time"))}
                )
        subs.sort(key=lambda s: s.get("minute") or 0)
        if starting:
            lineups[idx] = {"formation": t.get("formation"), "starting": starting, "subs": subs}

    return {"yellows": yellows, "booked": booked, "sent_off": sent_off, "lineups": lineups}


def _oriented_lineups(detail: dict, home_is_n0: bool) -> dict | None:
    """Map the promiedos-ordered [team0, team1] lineups to our home/away."""
    lu = detail.get("lineups") or [None, None]
    home, away = (lu[0], lu[1]) if home_is_n0 else (lu[1], lu[0])
    return {"home": home, "away": away} if (home or away) else None


def fetch_and_apply(db: Session) -> dict:
    """Pull current WC games from promiedos and update our group matches.
    Returns a small summary. No-op (and no network) when the toggle is off."""
    if not is_enabled(db):
        return {"enabled": False, "updated": 0}

    try:
        games = _all_games(_http_get(LEAGUE_URL))
    except Exception:  # noqa: BLE001
        logger.exception("promiedos fetch failed")
        return {"enabled": True, "error": True, "updated": 0}

    updated = 0
    # Cap detail-page fetches per run: each one is a slow HTTP request held while
    # the DB connection is open. Bounding it keeps each sync short (frees the
    # connection) and spreads the backfill over several runs.
    detail_left = [MAX_DETAIL_PER_RUN]

    def fetch_detail(slug, gid):
        if not (slug and gid) or detail_left[0] <= 0:
            return None
        detail_left[0] -= 1
        return _fetch_game_detail(str(slug), str(gid))

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

        # NOTE: we deliberately DON'T sync kickoff times from Promiedos. Its
        # `start_time` is localized to the requester's IP geo (Railway resolves to
        # US Pacific), with no UTC field and no timezone override — so parsing it
        # as Argentina shifts every match by the geo offset (~-4h in prod). The
        # seed (hand-entered AR times, reapplied by _sync_kickoffs on each deploy)
        # is the source of truth for kickoff_utc.

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

        # Already finalized: only FILL missing data (never overwrite a manual
        # result), then re-score so the late points land. Covers goalscorers and
        # yellows that arrived after kickoff status flipped to "finished" — e.g.
        # a 90'+ booking that Promiedos posted a beat after the final whistle.
        if m.status == "finished":
            changed_fin = False
            if not m.scorers and (hg or ag) and m.home_score == hs and m.away_score == as_:
                m.scorers = (hg + ag) or None
                changed_fin = True
            # Fetch the detail page if we're missing yellows (never captured) or
            # lineups — fills late bookings and backfills formations for old games.
            need_yellows = (m.home_yellows or 0) == 0 and (m.away_yellows or 0) == 0
            need_lineups = not m.lineups
            if need_yellows or need_lineups:
                slug, gid = g.get("url_name"), g.get("id")
                detail = fetch_detail(slug, gid)
                if detail:
                    if need_yellows:
                        y0, y1 = detail["yellows"]
                        hy, ay = (y0, y1) if m.home_team == n0 else (y1, y0)
                        if (hy or 0) > 0 or (ay or 0) > 0:
                            m.home_yellows, m.away_yellows = hy or 0, ay or 0
                            m.booked = detail["booked"] or None
                            if detail["sent_off"]:
                                m.red_players = detail["sent_off"]
                            changed_fin = True
                    if need_lineups:
                        ol = _oriented_lineups(detail, m.home_team == n0)
                        if ol:
                            m.lineups = ol  # committed by the final db.commit()
            if changed_fin:
                db.flush()
                recalculate_match_scores(db, m)
                updated += 1
            continue

        if new_status == "scheduled":
            # Pull the confirmed XI once Promiedos publishes it (~1h pre-kickoff)
            # so predictors can see where everyone plays before the match locks.
            if not m.lineups and m.kickoff_utc is not None:
                mins_to_kick = (m.kickoff_utc - datetime.now(timezone.utc)).total_seconds() / 60
                if 0 <= mins_to_kick <= 150:
                    slug, gid = g.get("url_name"), g.get("id")
                    detail = fetch_detail(slug, gid)
                    if detail:
                        ol = _oriented_lineups(detail, m.home_team == n0)
                        if ol:
                            m.lineups = ol
            continue  # nothing else to apply yet

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
        detail = fetch_detail(slug, gid)
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
            ol = _oriented_lineups(detail, m.home_team == n0)
            if ol:
                m.lineups = ol

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
