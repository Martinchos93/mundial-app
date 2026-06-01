from datetime import datetime

from pydantic import BaseModel


class AIPredictionOut(BaseModel):
    id: int
    match_id: int
    result: str
    score_home: int
    score_away: int
    confidence: float
    prob_home: float
    prob_draw: float
    prob_away: float
    xg_home: float
    xg_away: float
    key_players: list[str]
    factors: list[str]
    summary_text: str | None = None
    generated_at: datetime

    model_config = {"from_attributes": True}
