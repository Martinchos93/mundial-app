"""Knockout bracket resolution.

Fills the knockout matches' team slots from results as they come in:
group winners/runners-up, the 8 best third-placed teams (assigned to the
official eligible slots via a perfect matching), and knockout winners/losers
propagated up the tree. Idempotent — safe to run after every sync.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Match
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
            g.setdefault(team, {"team": team, "pts": 0, "gd": 0, "gf": 0})
        if m.status != "finished" or m.home_score is None or m.away_score is None:
            continue
        finished[ltr] += 1
        hs, as_ = m.home_score, m.away_score
        h, a = g[m.home_team], g[m.away_team]
        h["gf"] += hs; h["gd"] += hs - as_
        a["gf"] += as_; a["gd"] += as_ - hs
        if hs > as_:
            h["pts"] += 3
        elif hs < as_:
            a["pts"] += 3
        else:
            h["pts"] += 1; a["pts"] += 1

    ranked: dict[str, list[dict]] = {}
    complete: dict[str, bool] = {}
    for ltr in GROUP_LETTERS:
        rows = sorted(table[ltr].values(), key=lambda r: (r["pts"], r["gd"], r["gf"]), reverse=True)
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
        thirds.sort(key=lambda t: (t[1]["pts"], t[1]["gd"], t[1]["gf"]), reverse=True)
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


def _strength(name: str) -> int:
    base = _STRENGTH.get(name, 60)
    return base * 100 + sum(ord(c) for c in name) % 60  # stable jitter, avoids ties


def simulate(db: Session) -> dict:
    """Fill plausible results for every match and resolve the whole bracket.

    Deterministic (strength-based) so the bracket fills end-to-end. Knockout
    matches never tie. Also scores predictions so the leaderboard moves.
    """
    from app.services.sync import recalculate_match_scores

    # 1) Group stage
    for m in db.query(Match).filter(Match.phase.ilike("Grupo %")).all():
        sh, sa = _strength(m.home_team), _strength(m.away_team)
        if abs(sh - sa) < 30:
            hs, as_ = 1, 1
        elif sh > sa:
            hs, as_ = 2, 0
        else:
            hs, as_ = 0, 2
        m.status, m.home_score, m.away_score = "finished", hs, as_
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
        sh, sa = _strength(m.home_team), _strength(m.away_team)
        m.status = "finished"
        m.home_score, m.away_score = (2, 1) if sh >= sa else (1, 2)
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
