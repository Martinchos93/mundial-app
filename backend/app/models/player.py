from sqlalchemy import String, Integer, Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Linked to a national team by NAME (our 2026 fixture is name-based).
    team_name: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    api_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    position: Mapped[str | None] = mapped_column(String(40), nullable=True)
    number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    wiki_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    club: Mapped[str | None] = mapped_column(String(120), nullable=True)
    birth_date: Mapped[str | None] = mapped_column(String(20), nullable=True)  # YYYY-MM-DD
    season_apps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    season_goals: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (Index("ix_players_team_name_name", "team_name", "name"),)
