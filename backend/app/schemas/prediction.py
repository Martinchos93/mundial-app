from datetime import datetime

from pydantic import BaseModel, Field


class PredictionCreate(BaseModel):
    match_id: int
    column_id: int
    pred_home_score: int = Field(..., ge=0, le=30)
    pred_away_score: int = Field(..., ge=0, le=30)
    pred_yellows: int = Field(default=0, ge=0, le=50)
    pred_reds: int = Field(default=0, ge=0, le=20)
    # Optional player picks (names). Capped to keep the prode fair.
    pred_scorers: list[str] = Field(default_factory=list, max_length=5)
    pred_cards: list[str] = Field(default_factory=list, max_length=5)


class ScoreOut(BaseModel):
    pts_result: int = 0
    pts_exact: int = 0
    pts_yellows: int = 0
    pts_reds: int = 0
    pts_bonus: int = 0
    pts_scorers: int = 0
    pts_cards: int = 0
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
    pred_scorers: list[str] = Field(default_factory=list)
    pred_cards: list[str] = Field(default_factory=list)
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


class TopScorerCreate(BaseModel):
    column_id: int
    player_name: str = Field(..., min_length=1, max_length=120)
    team_name: str | None = None


class TopScorerOut(BaseModel):
    column_id: int
    pick: str | None = None  # the current user's pick
    team_name: str | None = None
    leader: dict | None = None  # {name, goals} current tournament leader
    finished: bool = False  # whether the tournament is over (points awarded)
    points_value: int = 10
