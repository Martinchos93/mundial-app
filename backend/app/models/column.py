from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Default scoring configuration. Mirrors services/scoring.py defaults.
DEFAULT_SCORING_CONFIG: dict = {
    "pts_result": 3,
    "pts_exact_goals": 2,
    "pts_yellows": 1,
    "pts_reds": 1,
    "pts_bonus": 3,  # awarded when result + exact total goals are both correct
    "pts_scorer": 3,  # per correctly predicted goalscorer in a match
    "pts_card": 2,  # per correctly predicted booked player in a match
    "pts_top_scorer": 10,  # correctly predicting the tournament top scorer
}


class Column(Base):
    __tablename__ = "columns"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    phase: Mapped[str | None] = mapped_column(String(60), nullable=True)

    # draft | active | closed
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)

    group_ids: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list)
    match_ids: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list)

    scoring_config: Mapped[dict] = mapped_column(JSONB, default=lambda: dict(DEFAULT_SCORING_CONFIG))

    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
