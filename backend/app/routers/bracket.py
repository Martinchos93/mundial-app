from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Match
from app.services.bracket import resolve, simulate

router = APIRouter(tags=["bracket"])

_COMPACT = {"W": "1", "R": "2", "T": "3", "MW": "W", "ML": "L"}


def _compact(src: str | None) -> str:
    if not src:
        return "?"
    kind, _, arg = src.partition(":")
    return _COMPACT.get(kind, "") + arg


def _resolved(name: str) -> str | None:
    """Real team name, or None if it's still a slot placeholder."""
    if not name or any(t in name for t in ("°", "(", "Ganador", "Perdedor")):
        return None
    return name


@router.get("/bracket")
def bracket(db: Session = Depends(get_db)):
    matches = (
        db.query(Match)
        .filter(Match.match_no.isnot(None), Match.match_no >= 73)
        .order_by(Match.match_no.asc())
        .all()
    )
    out: dict[int, dict] = {}
    for m in matches:
        out[m.match_no] = {
            "match_no": m.match_no,
            "round": m.phase,
            "home_label": _compact(m.home_source),
            "away_label": _compact(m.away_source),
            "home_team": _resolved(m.home_team),
            "away_team": _resolved(m.away_team),
            "home_score": m.home_score,
            "away_score": m.away_score,
            "status": m.status,
            "venue": m.venue,
        }
    return {"matches": out}


@router.post("/admin/bracket/recompute", dependencies=[Depends(get_current_admin)])
def recompute(db: Session = Depends(get_db)):
    """Re-run bracket resolution on demand (it also runs automatically on sync)."""
    updated = resolve(db)
    return {"updated_slots": updated}


@router.post("/admin/bracket/simulate", dependencies=[Depends(get_current_admin)])
def simulate_tournament(db: Session = Depends(get_db)):
    """Demo: fill plausible results for every match and resolve the full bracket."""
    return simulate(db)


@router.post("/admin/bracket/reset", dependencies=[Depends(get_current_admin)])
def reset_tournament():
    """DISABLED: reseeding wipes every result and prediction. Kept blocked so
    nobody accidentally destroys the tournament data."""
    from fastapi import HTTPException

    raise HTTPException(
        status_code=403,
        detail="Reiniciar está deshabilitado: borraría todos los resultados y pronósticos.",
    )
