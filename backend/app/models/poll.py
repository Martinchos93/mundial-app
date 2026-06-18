from datetime import datetime

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Poll(Base):
    """An admin-created poll. kind='options' (multiple choice) or 'text' (free,
    up to 500 chars). One poll is shown active at a time."""
    __tablename__ = "polls"

    id: Mapped[int] = mapped_column(primary_key=True)
    question: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), default="options")  # options | text
    options: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # list[str] for kind=options
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PollResponse(Base):
    __tablename__ = "poll_responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    poll_id: Mapped[int] = mapped_column(ForeignKey("polls.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    option_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
