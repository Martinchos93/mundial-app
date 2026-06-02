from sqlalchemy import Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Score(Base):
    __tablename__ = "scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    prediction_id: Mapped[int] = mapped_column(
        ForeignKey("predictions.id", ondelete="CASCADE"), unique=True, index=True
    )

    pts_result: Mapped[int] = mapped_column(Integer, default=0)
    pts_exact: Mapped[int] = mapped_column(Integer, default=0)
    pts_yellows: Mapped[int] = mapped_column(Integer, default=0)
    pts_reds: Mapped[int] = mapped_column(Integer, default=0)
    pts_bonus: Mapped[int] = mapped_column(Integer, default=0)
    pts_scorers: Mapped[int] = mapped_column(Integer, default=0)
    pts_cards: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0, index=True)

    prediction: Mapped["Prediction"] = relationship(back_populates="score")  # noqa: F821
