"""Image upload + serving. Blobs live in Postgres (durable on Railway).

Upload (admin) returns a relative path /media/{id}; the frontend composes the
absolute URL. Serving sets long-lived immutable cache headers since the bytes
for a given id never change.
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Media

MAX_BYTES = 8 * 1024 * 1024  # 8 MB
ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"}

router = APIRouter(tags=["media"])
admin_router = APIRouter(prefix="/admin", tags=["media"], dependencies=[Depends(get_current_admin)])


@admin_router.post("/media", status_code=201)
async def upload_media(file: UploadFile = File(...), db: Session = Depends(get_db)):
    ct = (file.content_type or "").lower()
    if ct not in ALLOWED:
        raise HTTPException(status_code=400, detail="Formato no permitido (usá JPG, PNG, WEBP o GIF)")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="La imagen supera los 8 MB")

    item = Media(content_type=ct, filename=file.filename, size=len(data), data=data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "path": f"/media/{item.id}", "content_type": ct, "size": len(data)}


@router.get("/media/{media_id}")
def get_media(media_id: int, db: Session = Depends(get_db)):
    item = db.get(Media, media_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Media not found")
    return Response(
        content=item.data,
        media_type=item.content_type or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
