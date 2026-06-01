from datetime import datetime

from pydantic import BaseModel, Field


class ColumnBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    phase: str | None = None
    group_ids: list[int] = []
    match_ids: list[int] = []
    scoring_config: dict | None = None
    starts_at: datetime | None = None
    closes_at: datetime | None = None


class ColumnCreate(ColumnBase):
    pass


class ColumnUpdate(BaseModel):
    name: str | None = None
    phase: str | None = None
    group_ids: list[int] | None = None
    match_ids: list[int] | None = None
    scoring_config: dict | None = None
    starts_at: datetime | None = None
    closes_at: datetime | None = None


class ColumnOut(ColumnBase):
    id: int
    status: str
    scoring_config: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class ColumnStats(ColumnOut):
    total_predictions: int = 0
    total_matches: int = 0
    total_groups: int = 0
