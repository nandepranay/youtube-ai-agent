import datetime
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.config import settings
from app.database.connection import get_db
from app.models.models import CommentRecord, VideoQueueItem

from app.schemas.schemas import (
    GenerateCommentsRequest,
    GenerateCommentsResponse,
    PublishCommentRequest,
    PublishCommentResponse,
    CommentHistoryItemDto,
    CommentCardDto
)
from app.services.ai_service import ai_service
from app.services.youtube_service import youtube_service
from app.services.comment_service import comment_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/comments", tags=["Comments"])

@router.post("/generate", response_model=GenerateCommentsResponse)
async def generate_comments_endpoint(req: GenerateCommentsRequest, db: Session = Depends(get_db)):
    """
    Validates provided video links, fetches available metadata and captions,
    analyzes content, and generates comment drafts.
    """
    if not req.video_urls:
        raise HTTPException(status_code=400, detail="At least one YouTube video URL is required.")

    videos_info = []
    for raw_url in req.video_urls:
        is_valid, vid, norm_url = youtube_service.validate_url(raw_url)
        if not is_valid or not vid:
            continue
        try:
            meta = await youtube_service.get_video_metadata(vid, fetch_transcript=True)
            videos_info.append(meta)
        except Exception as e:
            logger.warning(f"Metadata fetch failed for {raw_url}: {e}")

    if not videos_info:
        raise HTTPException(
            status_code=400,
            detail="None of the provided URLs were valid YouTube links or accessible."
        )

    ai_result = await ai_service.generate_comments(
        videos_info=videos_info,
        prompt=req.prompt,
        language=req.language or "English",
        tone=req.tone or "natural",
        max_words=req.max_words or 50,
        alternatives_count=req.alternatives_count or 1
    )

    # Persist drafts into database
    persisted_comments = []
    for c in ai_result["comments"]:
        rec = comment_service.create_draft_record(
            db=db,
            video_id=c["video_id"],
            video_url=c["video_url"],
            video_title=c["video_title"],
            comment_text=c["comment_text"],
            user_prompt=req.prompt,
            analysis_sources=c.get("analysis_sources", "metadata_only"),
            channel_title=c.get("channel_title"),
            thumbnail_url=c.get("thumbnail_url")
        )
        c["id"] = rec.id
        c["created_at"] = rec.created_at.isoformat() if rec.created_at else None
        persisted_comments.append(CommentCardDto(**c))

    return GenerateCommentsResponse(
        success=True,
        comments=persisted_comments,
        analysis_summary=ai_result["analysis_summary"],
        mode=ai_result.get("mode", "live"),
        provider=ai_result.get("mode", settings.AI_PROVIDER),
        model=ai_result.get("model", settings.OLLAMA_MODEL if settings.AI_PROVIDER == "ollama" else settings.OPENAI_MODEL)
    )


@router.post("/publish", response_model=PublishCommentResponse)
async def publish_comment_endpoint(req: PublishCommentRequest, db: Session = Depends(get_db)):
    """
    Publishes an approved comment to YouTube through the authorized account.
    Enforces explicit user approval, deduplication, and account isolation.
    """
    if not req.explicit_approval:
        raise HTTPException(
            status_code=400,
            detail="Explicit approval is required before publishing a comment."
        )

    if not req.comment_text or not req.comment_text.strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty.")

    is_valid, vid, norm_url = youtube_service.validate_url(req.video_id)
    target_vid = vid if is_valid else req.video_id

    result = await comment_service.publish_approved_comment(
        db=db,
        comment_id=req.comment_id,
        video_id=target_vid,
        comment_text=req.comment_text.strip(),
        account_slot=req.account_slot,
        explicit_approval=req.explicit_approval,
        video_url=req.video_url,
        video_title=req.video_title
    )

    return PublishCommentResponse(
        success=result["success"],
        youtube_comment_id=result.get("youtube_comment_id"),
        publication_status=result.get("publication_status", "Failed"),
        message=result.get("message", ""),
        error=result.get("error"),
        account_slot=result.get("account_slot", req.account_slot)
    )

@router.get("/history", response_model=List[CommentHistoryItemDto])
def get_comment_history(
    account_slot: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Retrieves comment history with filtering by account slot, status, and search query.
    """
    query = db.query(CommentRecord)

    if account_slot is not None:
        query = query.filter(CommentRecord.account_slot == account_slot)

    if status:
        query = query.filter(CommentRecord.publication_status == status)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (CommentRecord.video_title.ilike(term)) |
            (CommentRecord.comment_text.ilike(term)) |
            (CommentRecord.channel_title.ilike(term))
        )

    records = query.order_by(desc(CommentRecord.created_at)).offset(offset).limit(limit).all()

    items = []
    for r in records:
        items.append(CommentHistoryItemDto(
            id=r.id,
            video_id=r.video_id,
            video_url=r.video_url,
            video_title=r.video_title,
            channel_title=r.channel_title,
            thumbnail_url=r.thumbnail_url,
            comment_text=r.comment_text,
            user_prompt=r.user_prompt,
            analysis_sources=r.analysis_sources,
            account_slot=r.account_slot,
            account_email=r.account_email,
            account_channel_title=r.account_channel_title,
            publication_status=r.publication_status,
            youtube_comment_id=r.youtube_comment_id,
            error_message=r.error_message,
            created_at=r.created_at.isoformat() if r.created_at else "",
            published_at=r.published_at.isoformat() if r.published_at else None
        ))
    return items
