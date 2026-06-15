from datetime import datetime

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FutgolfTable(Base):
    """A FutGolf elimination match ('mesa') played by members of a prode."""
    __tablename__ = "futgolf_tables"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(16), default="lobby", index=True)  # lobby|playing|finished
    course_seed: Mapped[int] = mapped_column(Integer, default=1)  # same terrain for everyone
    round_no: Mapped[int] = mapped_column(Integer, default=0)
    shots_allowed: Mapped[int] = mapped_column(Integer, default=3)  # 3 normal, 1 desempate
    winner_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FutgolfParticipant(Base):
    __tablename__ = "futgolf_participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("futgolf_tables.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active|eliminated|winner


class FutgolfAttempt(Base):
    """One participant's result for one round (did they sink within the allotted shots)."""
    __tablename__ = "futgolf_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("futgolf_tables.id", ondelete="CASCADE"), index=True)
    round_no: Mapped[int] = mapped_column(Integer, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    sunk: Mapped[bool] = mapped_column(Boolean, default=False)
    shots: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FutgolfView(Base):
    """One row per user that ever opened the FutGolf section — adoption metric."""
    __tablename__ = "futgolf_views"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    opens: Mapped[int] = mapped_column(Integer, default=1)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
