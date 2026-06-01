from datetime import datetime

from pydantic import BaseModel


class GroupOut(BaseModel):
    id: int
    name: str
    invite_code: str
    creator_id: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    user_id: int
    name: str
    avatar_emoji: str
    status: str
    is_creator: bool = False


class LeaderboardEntry(BaseModel):
    user_id: int
    name: str
    avatar_emoji: str
    points: int
    delta_today: int = 0
    streak: int = 0
    rank: int = 0


class Leaderboard(BaseModel):
    group_id: int
    entries: list[LeaderboardEntry]
