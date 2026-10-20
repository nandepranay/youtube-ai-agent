from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.schemas import VideoValidateRequest, VideoValidateResponse, VideoAnalyzeRequest, VideoMetadataResponse
from app.services.youtube_service import youtube_service

router = APIRouter(prefix="/api/video", tags=["Video"])

@router.post("/validate", response_model=VideoValidateResponse)
async def validate_video(req: VideoValidateRequest):
    """Validates YouTube URL and extracts 11-char video ID."""
    is_valid, video_id, norm_url = youtube_service.validate_url(req.url)
    if is_valid:
        return VideoValidateResponse(
            is_valid=True,
            video_id=video_id,
            normalized_url=norm_url
        )
    return VideoValidateResponse(
        is_valid=False,
        error="Invalid YouTube URL. Please provide a standard YouTube video link, shorts, or youtu.be link."
    )

@router.post("/analyze", response_model=VideoMetadataResponse)
async def analyze_video(req: VideoAnalyzeRequest):
    """Retrieves metadata and transcript (when available) for video analysis."""
    is_valid, video_id, norm_url = youtube_service.validate_url(req.url)
    if not is_valid or not video_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube video URL."
        )

    meta = await youtube_service.get_video_metadata(video_id, fetch_transcript=req.fetch_transcript)
    if meta.get("error") and meta.get("title") == "YouTube Video":
        raise HTTPException(
            status_code=404,
            detail=meta["error"]
        )

    return VideoMetadataResponse(
        video_id=meta["video_id"],
        video_url=meta["video_url"],
        title=meta["title"],
        channel_title=meta["channel_title"],
        description=meta.get("description", ""),
        thumbnail_url=meta.get("thumbnail_url"),
        published_at=meta.get("published_at"),
        duration=meta.get("duration"),
        has_transcript=meta.get("has_transcript", False),
        transcript_snippet=meta.get("transcript_snippet"),
        transcript_status=meta.get("transcript_status", "Unavailable"),
        analysis_source=meta.get("analysis_source", "metadata_only"),
        error=meta.get("error")
    )
