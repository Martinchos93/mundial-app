from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import News
from app.schemas.news import NewsCreate, NewsUpdate, NewsOut

# Public read endpoints
router = APIRouter(prefix="/news", tags=["news"])

# Admin write endpoints (X-Admin-Token)
admin_router = APIRouter(
    prefix="/admin/news", tags=["news"], dependencies=[Depends(get_current_admin)]
)


@router.get("")
def list_news(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    base = db.query(News).filter(News.published == True)  # noqa: E712
    total = base.with_entities(func.count(News.id)).scalar() or 0
    items = (
        base.order_by(News.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [NewsOut.model_validate(n).model_dump(mode="json") for n in items],
        "total": int(total),
        "page": page,
        "page_size": page_size,
    }


@router.get("/{news_id}", response_model=NewsOut)
def get_news(news_id: int, db: Session = Depends(get_db)):
    item = db.get(News, news_id)
    if item is None:
        raise HTTPException(status_code=404, detail="News not found")
    return NewsOut.model_validate(item)


@admin_router.get("", response_model=list[NewsOut])
def admin_list_news(db: Session = Depends(get_db)):
    items = db.query(News).order_by(News.created_at.desc()).all()
    return [NewsOut.model_validate(n) for n in items]


@admin_router.post("", response_model=NewsOut, status_code=201)
def create_news(payload: NewsCreate, db: Session = Depends(get_db)):
    item = News(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return NewsOut.model_validate(item)


@admin_router.put("/{news_id}", response_model=NewsOut)
def update_news(news_id: int, payload: NewsUpdate, db: Session = Depends(get_db)):
    item = db.get(News, news_id)
    if item is None:
        raise HTTPException(status_code=404, detail="News not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return NewsOut.model_validate(item)


@admin_router.delete("/{news_id}", status_code=204)
def delete_news(news_id: int, db: Session = Depends(get_db)):
    item = db.get(News, news_id)
    if item is None:
        raise HTTPException(status_code=404, detail="News not found")
    db.delete(item)
    db.commit()
