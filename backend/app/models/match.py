from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Float, func
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    api_id: Mapped[int | None] = mapped_column(Integer, unique=True, index=True, nullable=True)

    # FIFA match number (1-104). Knockout matches reference earlier matches by
    # this number via home_source/away_source (e.g. "MW:73" = winner of M73).
    match_no: Mapped[int | None] = mapped_column(Integer, unique=True, index=True, nullable=True)
    home_source: Mapped[str | None] = mapped_column(String(40), nullable=True)
    away_source: Mapped[str | None] = mapped_column(String(40), nullable=True)

    home_team: Mapped[str] = mapped_column(String(120), nullable=False)
    away_team: Mapped[str] = mapped_column(String(120), nullable=False)
    home_team_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_team_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    kickoff_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    phase: Mapped[str | None] = mapped_column(String(60), nullable=True)
    venue: Mapped[str | None] = mapped_column(String(160), nullable=True)

    # scheduled | live | finished
    status: Mapped[str] = mapped_column(String(20), default="scheduled", index=True)

    home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    minute: Mapped[int | None] = mapped_column(Integer, nullable=True)

    home_yellows: Mapped[int] = mapped_column(Integer, default=0)
    away_yellows: Mapped[int] = mapped_column(Integer, default=0)
    home_reds: Mapped[int] = mapped_column(Integer, default=0)
    away_reds: Mapped[int] = mapped_column(Integer, default=0)

    # Player-level events (names). `scorers` may repeat for a brace; `booked`
    # is the distinct set of players who saw a yellow/red. Used to score
    # per-match goalscorer/card predictions and the tournament top scorer.
    scorers: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    booked: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    # Subset of `booked` who saw a red card (so yellow vs red can be scored).
    red_players: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    home_xg: Mapped[float | None] = mapped_column(Float, nullable=True)
    away_xg: Mapped[float | None] = mapped_column(Float, nullable=True)
    home_possession: Mapped[float | None] = mapped_column(Float, nullable=True)
    away_possession: Mapped[float | None] = mapped_column(Float, nullable=True)
    home_shots: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_shots: Mapped[int | None] = mapped_column(Integer, nullable=True)

    raw_stats: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # {"home": {formation, starting:[{name,num,pos,captain}], subs:[{in,out,minute}]}, "away": {...}}
    lineups: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Aggregated prediction stats (computed once the match is finished):
    # {"voters": N, "top_scores": [{"score":"2-1","count":N}, ...], "top_scorer": {"name","count"}}
    prediction_stats: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def is_live(self) -> bool:
        return self.status == "live"

    @property
    def is_finished(self) -> bool:
        return self.status == "finished"
