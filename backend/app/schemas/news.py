from datetime import datetime

from pydantic import BaseModel, Field


class NewsCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1)
    image_url: str | None = None
    author: str | None = None
    published: bool = True


class NewsUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    image_url: str | None = None
    author: str | None = None
    published: bool | None = None


class NewsOut(BaseModel):
    id: int
    title: str
    body: str
    image_url: str | None = None
    author: str | None = None
    published: bool
    created_at: datetime

    model_config = {"from_attributes": True}
