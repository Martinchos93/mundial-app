from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScoreHistory(Base):
    """Audit trail of score changes. One row per prediction whose total changed
    during a recalc / sync / manual edit — so we can review before vs after if a
    scoring event ever looks wrong again."""

    __tablename__ = "score_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    prediction_id: Mapped[int] = mapped_column(
        ForeignKey("predictions.id", ondelete="CASCADE"), index=True
    )
    # What triggered the change: recalc_all | recalc_match | recalc_column | sync | manual_result
    source: Mapped[str] = mapped_column(String(40), index=True)
    old_total: Mapped[int] = mapped_column(Integer, default=0)
    new_total: Mapped[int] = mapped_column(Integer, default=0)
    old_breakdown: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    new_breakdown: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
