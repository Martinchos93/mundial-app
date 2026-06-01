from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Float, ForeignKey, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(
        ForeignKey("matches.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # home | draw | away
    result: Mapped[str] = mapped_column(String(10), nullable=False)
    score_home: Mapped[int] = mapped_column(Integer, default=0)
    score_away: Mapped[int] = mapped_column(Integer, default=0)

    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    prob_home: Mapped[float] = mapped_column(Float, default=0.0)
    prob_draw: Mapped[float] = mapped_column(Float, default=0.0)
    prob_away: Mapped[float] = mapped_column(Float, default=0.0)

    xg_home: Mapped[float] = mapped_column(Float, default=0.0)
    xg_away: Mapped[float] = mapped_column(Float, default=0.0)

    key_players: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    factors: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    summary_text: Mapped[str | None] = mapped_column(String(400), nullable=True)

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
