import json
import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.config import settings
from app.database.connection import get_db
from app.models.models import ChatSession, ChatMessage, CommentRecord
from app.schemas.schemas import ChatRequest, ChatResponse, VideoMetadataResponse, CommentCardDto
from app.services.ai_service import ai_service
from app.services.youtube_service import youtube_service
from app.services.comment_service import comment_service
from app.utils.url_helpers import extract_all_youtube_urls_from_text, validate_youtube_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["AI Chat"])

@router.post("", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest, db: Session = Depends(get_db)):
    """
    Primary AI chat endpoint:
    - Parses user instruction and extracts video links
    - Analyzes metadata and transcripts
    - Generates or updates comment cards
    - Preserves session history for iterative conversational follow-ups
    """
    # 1. Manage Session
    session_id = req.session_id
    if not session_id:
        session_id = str(uuid.uuid4())
        session = ChatSession(id=session_id, title=req.message[:35] + ("..." if len(req.message) > 35 else ""))
        db.add(session)
        db.commit()
    else:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            session = ChatSession(id=session_id, title=req.message[:35])
            db.add(session)
            db.commit()

    # 2. Extract YouTube URLs from text and explicit parameter
    urls = list(req.video_urls or [])
    found_in_text = extract_all_youtube_urls_from_text(req.message)
    for u in found_in_text:
        if u not in urls:
            urls.append(u)

    # 3. Analyze videos
    attached_videos_data = []
    for u in urls:
        is_valid, vid, norm_url = validate_youtube_url(u)
        if is_valid and vid:
            try:
                meta = await youtube_service.get_video_metadata(vid, fetch_transcript=True)
                attached_videos_data.append(meta)
            except Exception as e:
                logger.warning(f"Error fetching metadata for {vid}: {e}")

    # If no videos attached in this turn, check if previous turns in this session had attached videos
    if not attached_videos_data:
        past_msgs = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(desc(ChatMessage.created_at)).all()
        for pm in past_msgs:
            if pm.attached_videos_json:
                try:
                    cached_vids = json.loads(pm.attached_videos_json)
                    if cached_vids:
                        attached_videos_data = cached_vids
                        break
                except Exception:
                    pass

    # 4. Load recent conversation history for context
    history_records = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    history = [{"role": h.role, "content": h.content} for h in history_records[-6:]]

    # 5. Call AI Service
    ai_res = await ai_service.chat_conversation(
        messages_history=history,
        new_prompt=req.message,
        videos_info=attached_videos_data,
        language_preference=req.language_preference or "English"
    )

    reply_text = ai_res.get("reply", "Here are your generated comments based on the analyzed video content.")
    generated_comments = ai_res.get("comments", [])
    is_demo = ai_res.get("is_demo", False)

    # Persist draft comment records
    formatted_cards = []
    for gc in generated_comments:
        rec = comment_service.create_draft_record(
            db=db,
            video_id=gc["video_id"],
            video_url=gc["video_url"],
            video_title=gc["video_title"],
            comment_text=gc["comment_text"],
            user_prompt=req.message,
            analysis_sources=gc.get("analysis_sources", "metadata_only"),
            channel_title=gc.get("channel_title"),
            thumbnail_url=gc.get("thumbnail_url")
        )
        gc["id"] = rec.id
        gc["created_at"] = rec.created_at.isoformat() if rec.created_at else None
        formatted_cards.append(CommentCardDto(**gc))

    # 6. Save User & Assistant Chat Messages to DB
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=req.message,
        attached_videos_json=json.dumps(attached_videos_data) if attached_videos_data else None
    )
    db.add(user_msg)

    asst_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=reply_text,
        attached_videos_json=json.dumps(attached_videos_data) if attached_videos_data else None,
        generated_comments_json=json.dumps([c.model_dump() for c in formatted_cards]) if formatted_cards else None
    )
    db.add(asst_msg)
    db.commit()

    return ChatResponse(
        session_id=session_id,
        reply=reply_text,
        attached_videos=[VideoMetadataResponse(**v) for v in attached_videos_data],
        generated_comments=formatted_cards,
        is_demo=is_demo,
        provider=ai_res.get("provider", settings.AI_PROVIDER),
        model=ai_res.get("model", settings.OLLAMA_MODEL if settings.AI_PROVIDER == "ollama" else settings.OPENAI_MODEL)
    )


@router.get("/sessions")
def list_chat_sessions(db: Session = Depends(get_db)):
    """Lists saved chat sessions for sidebar history."""
    sessions = db.query(ChatSession).order_by(desc(ChatSession.updated_at)).limit(20).all()
    return [{"id": s.id, "title": s.title, "created_at": s.created_at.isoformat() if s.created_at else ""} for s in sessions]

@router.get("/session/{session_id}/messages")
def get_session_messages(session_id: str, db: Session = Depends(get_db)):
    """Retrieves full message trajectory for a session."""
    msgs = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    result = []
    for m in msgs:
        attached = json.loads(m.attached_videos_json) if m.attached_videos_json else []
        comments = json.loads(m.generated_comments_json) if m.generated_comments_json else []
        result.append({
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "attached_videos": attached,
            "generated_comments": comments,
            "created_at": m.created_at.isoformat() if m.created_at else ""
        })
    return result

@router.delete("/session/{session_id}")
def delete_chat_session(session_id: str, db: Session = Depends(get_db)):
    """Deletes a chat session."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if session:
        db.delete(session)
        db.commit()
    return {"success": True}
