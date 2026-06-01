from datetime import datetime

from pydantic import BaseModel, Field


class JoinRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    avatar_emoji: str = Field(default="⚽", max_length=8)
    invite_code: str = Field(..., min_length=6, max_length=6)


class CreateGroupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    avatar_emoji: str = Field(default="⚽", max_length=8)
    group_name: str = Field(..., min_length=1, max_length=120)


class UserOut(BaseModel):
    id: int
    name: str
    avatar_emoji: str
    group_id: int | None
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str
    user: UserOut
    invite_code: str | None = None
