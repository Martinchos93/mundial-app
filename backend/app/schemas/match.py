from datetime import datetime

from pydantic import BaseModel


class MatchBase(BaseModel):
    id: int
    api_id: int | None = None
    home_team: str
    away_team: str
    home_team_id: int | None = None
    away_team_id: int | None = None
    kickoff_utc: datetime
    phase: str | None = None
    venue: str | None = None
    status: str
    home_score: int | None = None
    away_score: int | None = None
    minute: int | None = None

    model_config = {"from_attributes": True}


class MatchOut(MatchBase):
    home_yellows: int = 0
    away_yellows: int = 0
    home_reds: int = 0
    away_reds: int = 0
    home_xg: float | None = None
    away_xg: float | None = None
    home_possession: float | None = None
    away_possession: float | None = None
    home_shots: int | None = None
    away_shots: int | None = None
    scorers: list[str] | None = None
    booked: list[str] | None = None
    red_players: list[str] | None = None
    lineups: dict | None = None


class MatchLive(BaseModel):
    id: int
    status: str
    minute: int | None = None
    home_score: int | None = None
    away_score: int | None = None
    home_possession: float | None = None
    away_possession: float | None = None
    home_xg: float | None = None
    away_xg: float | None = None
    home_shots: int | None = None
    away_shots: int | None = None
    home_yellows: int = 0
    away_yellows: int = 0
    home_reds: int = 0
    away_reds: int = 0

    model_config = {"from_attributes": True}


class MatchList(BaseModel):
    items: list[MatchOut]
    total: int
    page: int
    page_size: int


class MatchEvent(BaseModel):
    minute: int | None = None
    type: str | None = None  # Goal | Card | subst | Var
    detail: str | None = None
    team: str | None = None
    player: str | None = None
    assist: str | None = None


class LineupPlayer(BaseModel):
    name: str | None = None
    number: int | None = None
    pos: str | None = None
    grid: str | None = None


class TeamLineup(BaseModel):
    team: str | None = None
    formation: str | None = None
    coach: str | None = None
    startXI: list[LineupPlayer] = []
    substitutes: list[LineupPlayer] = []
