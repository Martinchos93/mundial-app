from datetime import datetime

from pydantic import BaseModel, Field, EmailStr


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=40)
    password: str = Field(..., min_length=6, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    age: int | None = Field(default=None, ge=0, le=120)
    email: EmailStr
    avatar_emoji: str = Field(default="⚽", max_length=8)


class LoginRequest(BaseModel):
    username: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10)
    password: str = Field(..., min_length=6, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    age: int | None = None
    avatar_emoji: str
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class MembershipOut(BaseModel):
    group_id: int
    group_name: str
    invite_code: str
    status: str
    role: str
    is_creator: bool = False


class MeResponse(BaseModel):
    user: UserOut
    memberships: list[MembershipOut]
