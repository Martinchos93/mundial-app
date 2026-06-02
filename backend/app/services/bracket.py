"""Knockout bracket resolution.

Fills the knockout matches' team slots from results as they come in:
group winners/runners-up, the 8 best third-placed teams (assigned to the
official eligible slots via a perfect matching), and knockout winners/losers
propagated up the tree. Idempotent — safe to run after every sync.
"""
from __future__ import annotations

import random

from collections import Counter

from sqlalchemy.orm import Session

from app.models import Match, Player
from app.seed_2026 import label_for_source

GROUP_LETTERS = list("ABCDEFGHIJKL")


def _group_letter(phase: str | None) -> str | None:
    if phase and phase.startswith("Grupo "):
        return phase.split()[-1]
    return None


def _standings(db: Session):
    """Return {letter: ranked list of {team, pts, gd, gf}} and completion flags."""
    table: dict[str, dict[str, dict]] = {ltr: {} for ltr in GROUP_LETTERS}
    counts: dict[str, int] = {ltr: 0 for ltr in GROUP_LETTERS}
    finished: dict[str, int] = {ltr: 0 for ltr in GROUP_LETTERS}

    for m in db.query(Match).filter(Match.phase.ilike("Grupo %")).all():
        ltr = _group_letter(m.phase)
        if ltr is None:
            continue
        counts[ltr] += 1
        g = table[ltr]
        for team in (m.home_team, m.away_team):
            g.setdefault(team, {"team": team, "pts": 0, "gd": 0, "gf": 0, "fp": 0})
        if m.status != "finished" or m.home_score is None or m.away_score is None:
            continue
        finished[ltr] += 1
        hs, as_ = m.home_score, m.away_score
        h, a = g[m.home_team], g[m.away_team]
        h["gf"] += hs; h["gd"] += hs - as_
        a["gf"] += as_; a["gd"] += as_ - hs
        # FIFA fair-play (approx: yellow -1, red -4); higher = fewer cards
        h["fp"] -= (m.home_yellows or 0) + 4 * (m.home_reds or 0)
        a["fp"] -= (m.away_yellows or 0) + 4 * (m.away_reds or 0)
        if hs > as_:
            h["pts"] += 3
        elif hs < as_:
            a["pts"] += 3
        else:
            h["pts"] += 1; a["pts"] += 1

    ranked: dict[str, list[dict]] = {}
    complete: dict[str, bool] = {}
    for ltr in GROUP_LETTERS:
        rows = sorted(
            table[ltr].values(), key=lambda r: (r["pts"], r["gd"], r["gf"], r["fp"]), reverse=True
        )
        ranked[ltr] = rows
        complete[ltr] = counts[ltr] > 0 and finished[ltr] == counts[ltr]
    return ranked, complete


def _assign_thirds(slots: list[tuple[int, set[str]]], qualifying: list[str]) -> dict[int, str]:
    """Perfect matching: each slot (match_no, eligible groups) gets a distinct
    qualifying third-placed group it is eligible for. MRV ordering + backtrack."""
    order = sorted(range(len(slots)), key=lambda i: len(slots[i][1] & set(qualifying)))
    assignment: dict[int, str] = {}
    used: set[str] = set()

    def bt(idx: int) -> bool:
        if idx == len(order):
            return True
        match_no, eligible = slots[order[idx]]
        for g in qualifying:
            if g in eligible and g not in used:
                used.add(g); assignment[match_no] = g
                if bt(idx + 1):
                    return True
                used.discard(g); assignment.pop(match_no, None)
        return False

    return assignment if bt(0) else {}


def _winner_loser(m: Match) -> tuple[str | None, str | None]:
    if m.status != "finished" or m.home_score is None or m.away_score is None:
        return None, None
    if m.home_score > m.away_score:
        return m.home_team, m.away_team
    if m.away_score > m.home_score:
        return m.away_team, m.home_team
    return None, None  # tie without shootout info → unresolved


def resolve(db: Session) -> int:
    """Resolve every knockout slot that can be determined. Returns # updated."""
    ranked, complete = _standings(db)
    winner = {ltr: ranked[ltr][0]["team"] for ltr in GROUP_LETTERS if complete[ltr] and ranked[ltr]}
    runner = {ltr: ranked[ltr][1]["team"] for ltr in GROUP_LETTERS if complete[ltr] and len(ranked[ltr]) > 1}

    knockout = (
        db.query(Match)
        .filter(Match.match_no.isnot(None), Match.match_no >= 73)
        .order_by(Match.match_no.asc())
        .all()
    )

    # Best-8 thirds (only once every group is complete).
    third_team: dict[int, str] = {}  # match_no -> resolved third team
    if all(complete.values()):
        thirds = []  # (letter, row)
        for ltr in GROUP_LETTERS:
            if len(ranked[ltr]) > 2:
                thirds.append((ltr, ranked[ltr][2]))
        thirds.sort(key=lambda t: (t[1]["pts"], t[1]["gd"], t[1]["gf"], t[1]["fp"]), reverse=True)
        qualifying = [ltr for ltr, _ in thirds[:8]]
        slots = []
        for m in knockout:
            t_src = (
                m.home_source
                if (m.home_source or "").startswith("T:")
                else m.away_source if (m.away_source or "").startswith("T:") else None
            )
            if t_src:
                slots.append((m.match_no, set(t_src.split(":")[1])))
        assign = _assign_thirds(slots, qualifying)
        third_of = {ltr: ranked[ltr][2]["team"] for ltr in GROUP_LETTERS if len(ranked[ltr]) > 2}
        third_team = {mn: third_of[g] for mn, g in assign.items()}

    by_no = {m.match_no: m for m in knockout}

    def resolve_src(code: str | None, match_no: int) -> str | None:
        if not code:
            return None
        kind, _, arg = code.partition(":")
        if kind == "W":
            return winner.get(arg)
        if kind == "R":
            return runner.get(arg)
        if kind == "T":
            return third_team.get(match_no)
        if kind == "MW":
            ref = by_no.get(int(arg))
            return _winner_loser(ref)[0] if ref else None
        if kind == "ML":
            ref = by_no.get(int(arg))
            return _winner_loser(ref)[1] if ref else None
        return None

    updated = 0
    # Ascending match_no so a round's winners are set before the next references them.
    for m in knockout:
        h = resolve_src(m.home_source, m.match_no) or label_for_source(m.home_source or "")
        a = resolve_src(m.away_source, m.match_no) or label_for_source(m.away_source or "")
        if m.home_team != h or m.away_team != a:
            m.home_team, m.away_team = h, a
            updated += 1
    db.commit()
    return updated


# ---- Demo simulation -----------------------------------------------------

# Rough strength tiers used only to produce a plausible simulated tournament.
_STRENGTH = {
    "Argentina": 95, "France": 94, "Spain": 93, "Brazil": 92, "England": 91,
    "Portugal": 89, "Netherlands": 88, "Germany": 87, "Belgium": 85, "Croatia": 83,
    "Uruguay": 82, "Morocco": 81, "Colombia": 80, "Japan": 78, "USA": 77,
    "Mexico": 76, "Switzerland": 76, "Senegal": 75, "Korea Republic": 72, "Ecuador": 71,
    "Australia": 68, "Sweden": 70, "Austria": 70, "Norway": 73, "Egypt": 69,
    "Morocco ": 81, "Panama": 58, "Scotland": 66, "Tunisia": 62, "Nigeria": 70,
    "Saudi Arabia": 60, "Qatar": 58, "Canada": 67, "Turkey": 71, "Algeria": 68,
    "Cote D'Ivoire": 69, "South Africa": 60, "Czech Republic": 67, "Paraguay": 63,
    "IR Iran": 66, "New Zealand": 52, "Jordan": 55, "Cape Verde": 54, "Curacao": 50,
    "Haiti": 52, "Uzbekistan": 60, "DR Congo": 62, "Iraq": 57, "Ghana": 66,
    "Bosnia and Herzegovina": 64,
}


_SIGMA = 9.0  # randomness: bigger = more upsets


def _base(name: str) -> int:
    return _STRENGTH.get(name, 60)


def _score_pair() -> tuple[int, int]:
    """A decisive scoreline (winner, loser)."""
    w = random.choices([1, 2, 2, 3, 3, 4], weights=[3, 5, 5, 3, 2, 1])[0]
    return w, random.randint(0, w - 1)


def _play(home: str, away: str, allow_draw: bool) -> tuple[int, int]:
    """Probabilistic result, biased by strength but with upsets."""
    rh = _base(home) + random.gauss(0, _SIGMA)
    ra = _base(away) + random.gauss(0, _SIGMA)
    if allow_draw and abs(rh - ra) < 4:
        g = random.choices([0, 1, 1, 2], weights=[2, 4, 3, 1])[0]
        return g, g
    w, l = _score_pair()
    return (w, l) if rh >= ra else (l, w)


def _cards() -> tuple[int, int]:
    """(yellows, reds) for one team in a match."""
    yellows = random.choices([0, 1, 2, 3, 4, 5], weights=[1, 3, 4, 3, 2, 1])[0]
    reds = 0
    if random.random() < 0.08:
        reds = 2 if random.random() < 0.15 else 1
    return yellows, reds


# Likelihood a player scores / gets booked, by position. Forwards score most;
# defenders/keepers get booked relatively more.
_SCORE_W = {"FW": 6, "Attacker": 6, "MF": 3, "Midfielder": 3, "DF": 1, "Defender": 1, "GK": 0, "Goalkeeper": 0}
_CARD_W = {"DF": 4, "Defender": 4, "MF": 3, "Midfielder": 3, "FW": 2, "Attacker": 2, "GK": 1, "Goalkeeper": 1}


def _squad(db: Session, team: str) -> list[Player]:
    return db.query(Player).filter(Player.team_name == team).all()


def _weighted_names(players: list[Player], weights: dict[str, int], n: int, distinct: bool) -> list[str]:
    """Pick n player names weighted by position. distinct=True avoids repeats."""
    pool = [(p.name, max(0, weights.get(p.position or "", 1))) for p in players if p.name]
    pool = [(name, w) for name, w in pool if w > 0]
    if not pool or n <= 0:
        return []
    picks: list[str] = []
    used: set[str] = set()
    for _ in range(n):
        choices = [(nm, w) for nm, w in pool if not (distinct and nm in used)]
        if not choices:
            break
        names, ws = zip(*choices)
        nm = random.choices(names, weights=ws)[0]
        picks.append(nm)
        used.add(nm)
    return picks


def _book(db: Session, m: Match) -> None:
    """Assign team-level card counts AND the specific players booked + scorers."""
    m.home_yellows, m.home_reds = _cards()
    m.away_yellows, m.away_reds = _cards()

    home_sq, away_sq = _squad(db, m.home_team), _squad(db, m.away_team)

    # Goalscorers: one name per goal, weighted toward forwards (repeats = braces).
    scorers = _weighted_names(home_sq, _SCORE_W, m.home_score or 0, distinct=False)
    scorers += _weighted_names(away_sq, _SCORE_W, m.away_score or 0, distinct=False)
    m.scorers = scorers

    # Booked: distinct players, one per card (yellow or red).
    booked = _weighted_names(home_sq, _CARD_W, (m.home_yellows or 0) + (m.home_reds or 0), distinct=True)
    booked += _weighted_names(away_sq, _CARD_W, (m.away_yellows or 0) + (m.away_reds or 0), distinct=True)
    m.booked = booked


def tournament_top_scorer(db: Session) -> dict | None:
    """Most-scoring player across all finished matches: {name, goals} or None."""
    tally: Counter[str] = Counter()
    for m in db.query(Match).filter(Match.status == "finished").all():
        for name in (m.scorers or []):
            tally[name] += 1
    if not tally:
        return None
    name, goals = tally.most_common(1)[0]
    return {"name": name, "goals": goals}


def is_tournament_finished(db: Session) -> bool:
    final = db.query(Match).filter(Match.match_no == 104).one_or_none()
    return bool(final and final.status == "finished")


def simulate(db: Session) -> dict:
    """Fill plausible results (probabilistic, biased by strength) + cards, and
    resolve the whole bracket. Knockout matches never tie. Re-run for a new
    random outcome. Also scores predictions so the leaderboard moves.
    """
    from app.services.sync import recalculate_match_scores

    # 1) Group stage
    for m in db.query(Match).filter(Match.phase.ilike("Grupo %")).all():
        m.home_score, m.away_score = _play(m.home_team, m.away_team, allow_draw=True)
        _book(db, m)
        m.status = "finished"
    db.commit()
    resolve(db)

    # 2) Knockout, round by round (ascending match number)
    for no in range(73, 105):
        resolve(db)
        m = db.query(Match).filter(Match.match_no == no).one_or_none()
        if m is None or "°" in m.home_team or "Ganador" in m.home_team or "Perdedor" in m.home_team:
            continue
        if "°" in m.away_team or "Ganador" in m.away_team or "Perdedor" in m.away_team:
            continue
        m.home_score, m.away_score = _play(m.home_team, m.away_team, allow_draw=False)
        _book(db, m)
        m.status = "finished"
        db.commit()
    resolve(db)

    # 3) Score predictions on every finished match
    for m in db.query(Match).filter(Match.status == "finished").all():
        recalculate_match_scores(db, m)

    champion = db.query(Match).filter(Match.match_no == 104).one_or_none()
    winner = None
    if champion and champion.status == "finished":
        winner = champion.home_team if (champion.home_score or 0) > (champion.away_score or 0) else champion.away_team
    return {"champion": winner}
