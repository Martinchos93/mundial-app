"""Tournament-wide statistics: top scorers + per-team stats.

Aggregated from every finished match (group stage + knockout) using the
player-level events (scorers / booked / red_players) and team-level counts.
"""
from collections import Counter, defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Match, Player

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/tournament")
def tournament_stats(db: Session = Depends(get_db)):
    finished = db.query(Match).filter(Match.status == "finished").all()

    goals: Counter[str] = Counter()
    yellows_p: Counter[str] = Counter()
    reds_p: Counter[str] = Counter()
    teams: dict[str, dict] = defaultdict(
        lambda: {
            "team": "", "played": 0, "won": 0, "drawn": 0, "lost": 0,
            "gf": 0, "ga": 0, "gd": 0, "yellows": 0, "reds": 0, "points": 0,
        }
    )

    total_goals = total_yellows = total_reds = 0

    for m in finished:
        for n in m.scorers or []:
            goals[n] += 1
        red_set = set(m.red_players or [])
        for n in m.booked or []:
            (reds_p if n in red_set else yellows_p)[n] += 1

        hs, as_ = m.home_score or 0, m.away_score or 0
        total_goals += hs + as_
        total_yellows += (m.home_yellows or 0) + (m.away_yellows or 0)
        total_reds += (m.home_reds or 0) + (m.away_reds or 0)

        rows = [
            (m.home_team, hs, as_, m.home_yellows or 0, m.home_reds or 0),
            (m.away_team, as_, hs, m.away_yellows or 0, m.away_reds or 0),
        ]
        for name, gf, ga, yc, rc in rows:
            if not name or any(t in name for t in ("°", "Ganador", "Perdedor", "(")):
                continue  # unresolved bracket slot
            d = teams[name]
            d["team"] = name
            d["played"] += 1
            d["gf"] += gf
            d["ga"] += ga
            d["gd"] = d["gf"] - d["ga"]
            d["yellows"] += yc
            d["reds"] += rc
            if gf > ga:
                d["won"] += 1
                d["points"] += 3
            elif gf < ga:
                d["lost"] += 1
            else:
                d["drawn"] += 1
                d["points"] += 1

    # Attach player metadata (team + photo) to scorers / disciplinary leaders.
    names = set(goals) | set(yellows_p) | set(reds_p)
    meta = {
        p.name: p
        for p in (db.query(Player).filter(Player.name.in_(names)).all() if names else [])
    }

    def player_row(name: str) -> dict:
        p = meta.get(name)
        return {
            "name": name,
            "team": p.team_name if p else None,
            "photo_url": p.photo_url if p else None,
            "goals": goals.get(name, 0),
            "yellows": yellows_p.get(name, 0),
            "reds": reds_p.get(name, 0),
        }

    scorers = [player_row(n) for n, _ in goals.most_common(30)]

    team_rows = sorted(
        teams.values(),
        key=lambda d: (d["gf"], d["gd"], d["points"]),
        reverse=True,
    )

    return {
        "totals": {
            "goals": total_goals,
            "matches": len(finished),
            "yellows": total_yellows,
            "reds": total_reds,
            "avg_goals": round(total_goals / len(finished), 2) if finished else 0,
        },
        "scorers": scorers,
        "teams": team_rows,
    }
