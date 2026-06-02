from datetime import datetime

from sqlalchemy import Integer, String, DateTime, LargeBinary, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Media(Base):
    """Binary blob (image) stored in Postgres and served by /media/{id}."""

    __tablename__ = "media"

    id: Mapped[int] = mapped_column(primary_key=True)
    content_type: Mapped[str] = mapped_column(String(100), default="image/jpeg")
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size: Mapped[int] = mapped_column(Integer, default=0)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
