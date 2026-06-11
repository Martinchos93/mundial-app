from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class PlayerEvent(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    team: str | None = None
    g: int = Field(default=0, ge=0, le=9)  # goals
    y: int = Field(default=0, ge=0, le=1)  # yellow card
    r: int = Field(default=0, ge=0, le=1)  # red card


class PredictionCreate(BaseModel):
    match_id: int
    column_id: int
    pred_home_score: int = Field(..., ge=0, le=30)
    pred_away_score: int = Field(..., ge=0, le=30)
    pred_yellows: int = Field(default=0, ge=0, le=50)
    pred_reds: int = Field(default=0, ge=0, le=20)
    # Per-player picks with counts (goals / yellow / red). Capped server-side.
    pred_players: list[PlayerEvent] = Field(default_factory=list, max_length=40)
    # Copy this prediction to all the user's active prodes (default: only this one).
    apply_to_all: bool = False


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
    pred_players: list[PlayerEvent] = Field(default_factory=list)
    submitted_at: datetime
    locked: bool
    score: ScoreOut | None = None

    model_config = {"from_attributes": True}

    @field_validator("pred_scorers", "pred_cards", "pred_players", mode="before")
    @classmethod
    def _none_to_list(cls, v):
        return v or []


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
    apply_to_all: bool = False


class TopScorerOut(BaseModel):
    column_id: int
    pick: str | None = None  # the current user's pick
    team_name: str | None = None
    leader: dict | None = None  # {name, goals} current tournament leader
    locked: bool = False  # matchday 1 played → can't change the pick anymore
    finished: bool = False  # whether the tournament is over (points awarded)
    points_value: int = 10


class ChampionCreate(BaseModel):
    column_id: int
    team_name: str = Field(..., min_length=1, max_length=120)
    apply_to_all: bool = False


class ChampionOut(BaseModel):
    column_id: int
    pick: str | None = None  # the current user's pick
    champion: str | None = None  # actual champion (when the final is played)
    started: bool = False  # tournament kicked off → pick is locked
    finished: bool = False
    points_value: int = 15
