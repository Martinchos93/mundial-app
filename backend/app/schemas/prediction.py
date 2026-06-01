from datetime import datetime

from pydantic import BaseModel, Field


class PredictionCreate(BaseModel):
    match_id: int
    column_id: int
    pred_home_score: int = Field(..., ge=0, le=30)
    pred_away_score: int = Field(..., ge=0, le=30)
    pred_yellows: int = Field(default=0, ge=0, le=50)
    pred_reds: int = Field(default=0, ge=0, le=20)


class ScoreOut(BaseModel):
    pts_result: int = 0
    pts_exact: int = 0
    pts_yellows: int = 0
    pts_reds: int = 0
    pts_bonus: int = 0
    total: int = 0

    model_config = {"from_attributes": True}


class PredictionOut(BaseModel):
    id: int
    user_id: int
    match_id: int
    column_id: int
    pred_home_score: int
    pred_away_score: int
    pred_yellows: int
    pred_reds: int
    submitted_at: datetime
    locked: bool
    score: ScoreOut | None = None

    model_config = {"from_attributes": True}


class GroupPredictionEntry(BaseModel):
    user_id: int
    name: str
    avatar_emoji: str
    pred_home_score: int
    pred_away_score: int
    pred_yellows: int
    pred_reds: int
    total: int = 0
