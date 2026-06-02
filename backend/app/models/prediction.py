from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Boolean, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        UniqueConstraint("user_id", "match_id", "column_id", name="uq_prediction_user_match_column"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), index=True)
    column_id: Mapped[int] = mapped_column(ForeignKey("columns.id", ondelete="CASCADE"), index=True)

    pred_home_score: Mapped[int] = mapped_column(Integer, nullable=False)
    pred_away_score: Mapped[int] = mapped_column(Integer, nullable=False)
    pred_yellows: Mapped[int] = mapped_column(Integer, default=0)
    pred_reds: Mapped[int] = mapped_column(Integer, default=0)

    # Optional player-level predictions (names). Empty/None = no pick, no points.
    # pred_scorers/pred_cards are kept (derived) for display/back-compat; the
    # source of truth is pred_players: [{name, team, g, y, r}] with counts.
    pred_scorers: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    pred_cards: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    pred_players: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    locked: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="predictions")  # noqa: F821
    score: Mapped["Score | None"] = relationship(  # noqa: F821
        back_populates="prediction", uselist=False, cascade="all, delete-orphan"
    )
