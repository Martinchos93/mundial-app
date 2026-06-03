from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ChampionPrediction(Base):
    """One pick per (user, prode column): who wins the tournament."""

    __tablename__ = "champion_predictions"
    __table_args__ = (
        UniqueConstraint("user_id", "column_id", name="uq_champion_user_column"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    column_id: Mapped[int] = mapped_column(ForeignKey("columns.id", ondelete="CASCADE"), index=True)

    team_name: Mapped[str] = mapped_column(String(120), nullable=False)

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
