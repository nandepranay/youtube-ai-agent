from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database.connection import get_db
from app.models.models import VideoQueueItem
from app.schemas.schemas import QueueItemCreate, QueueItemResponse
from app.services.youtube_service import youtube_service

router = APIRouter(prefix="/api/queue", tags=["Queue"])

@router.get("", response_model=List[QueueItemResponse])
def get_queue(db: Session = Depends(get_db)):
    """Retrieves all videos currently in queue."""
    items = db.query(VideoQueueItem).order_by(desc(VideoQueueItem.created_at)).all()
    return [
        QueueItemResponse(
            id=i.id,
            video_id=i.video_id,
            video_url=i.video_url,
            title=i.title,
            channel_title=i.channel_title,
            thumbnail_url=i.thumbnail_url,
            duration=i.duration,
            published_at=i.published_at,
            description=i.description,
            status=i.status,
            error_message=i.error_message,
            selected_account_slot=i.selected_account_slot,
            analysis_sources=i.analysis_sources,
            created_at=i.created_at.isoformat() if i.created_at else "",
            updated_at=i.updated_at.isoformat() if i.updated_at else ""
        )
        for i in items
    ]

@router.post("", response_model=QueueItemResponse)
async def add_to_queue(item: QueueItemCreate, db: Session = Depends(get_db)):
    """Validates YouTube URL, fetches metadata, and inserts into queue."""
    is_valid, vid, norm_url = youtube_service.validate_url(item.video_url)
    if not is_valid or not vid:
        raise HTTPException(status_code=400, detail="Invalid YouTube video URL.")

    # Check if video already exists in queue
    existing = db.query(VideoQueueItem).filter(VideoQueueItem.video_id == vid).first()
    if existing:
        return QueueItemResponse(
            id=existing.id,
            video_id=existing.video_id,
            video_url=existing.video_url,
            title=existing.title,
            channel_title=existing.channel_title,
            thumbnail_url=existing.thumbnail_url,
            duration=existing.duration,
            published_at=existing.published_at,
            description=existing.description,
            status=existing.status,
            error_message=existing.error_message,
            selected_account_slot=existing.selected_account_slot,
            analysis_sources=existing.analysis_sources,
            created_at=existing.created_at.isoformat() if existing.created_at else "",
            updated_at=existing.updated_at.isoformat() if existing.updated_at else ""
        )

    # Fetch initial metadata
    meta = await youtube_service.get_video_metadata(vid, fetch_transcript=True)

    status = "Added"
    if meta.get("error"):
        status = "Failed"
    elif meta.get("title") != "YouTube Video":
        status = "Analysis Complete"

    queue_rec = VideoQueueItem(
        video_id=vid,
        video_url=norm_url or item.video_url,
        title=meta.get("title", "YouTube Video"),
        channel_title=meta.get("channel_title", "Unknown Channel"),
        thumbnail_url=meta.get("thumbnail_url"),
        duration=meta.get("duration"),
        published_at=meta.get("published_at"),
        description=meta.get("description"),
        transcript_snippet=meta.get("transcript_snippet"),
        status=status,
        error_message=meta.get("error"),
        selected_account_slot=item.selected_account_slot,
        analysis_sources=meta.get("analysis_source", "metadata_only")
    )
    db.add(queue_rec)
    db.commit()
    db.refresh(queue_rec)

    return QueueItemResponse(
        id=queue_rec.id,
        video_id=queue_rec.video_id,
        video_url=queue_rec.video_url,
        title=queue_rec.title,
        channel_title=queue_rec.channel_title,
        thumbnail_url=queue_rec.thumbnail_url,
        duration=queue_rec.duration,
        published_at=queue_rec.published_at,
        description=queue_rec.description,
        status=queue_rec.status,
        error_message=queue_rec.error_message,
        selected_account_slot=queue_rec.selected_account_slot,
        analysis_sources=queue_rec.analysis_sources,
        created_at=queue_rec.created_at.isoformat() if queue_rec.created_at else "",
        updated_at=queue_rec.updated_at.isoformat() if queue_rec.updated_at else ""
    )

@router.delete("/{item_id}")
def remove_from_queue(item_id: int, db: Session = Depends(get_db)):
    """Removes a video from the queue."""
    item = db.query(VideoQueueItem).filter(VideoQueueItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found.")
    db.delete(item)
    db.commit()
    return {"success": True, "message": "Video removed from queue."}
