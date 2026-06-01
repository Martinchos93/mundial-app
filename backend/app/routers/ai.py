from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Match, AIPrediction
from app.ratelimit import limiter
from app.schemas.ai import AIPredictionOut
from app.services.anthropic_ai import generate_match_prediction

router = APIRouter(prefix="/ai", tags=["ai"])


def _latest(db: Session, match_id: int) -> AIPrediction | None:
    return (
        db.query(AIPrediction)
        .filter(AIPrediction.match_id == match_id)
        .order_by(AIPrediction.generated_at.desc())
        .first()
    )


@router.get("/match/{match_id}", response_model=AIPredictionOut)
@limiter.limit("10/minute")
async def ai_match_prediction(
    request: Request, match_id: int, force: bool = False, db: Session = Depends(get_db)
):
    if db.get(Match, match_id) is None:
        raise HTTPException(status_code=404, detail="Match not found")

    # Without ?force=true we only return a stored prediction; we never spend
    # Anthropic/API-Football requests implicitly. Generation is explicit.
    if not force:
        existing = _latest(db, match_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="No prediction generated yet")
        return AIPredictionOut.model_validate(existing)

    ai = await generate_match_prediction(db, match_id, force=True)
    if ai is None:
        raise HTTPException(status_code=503, detail="AI prediction unavailable")
    return AIPredictionOut.model_validate(ai)
