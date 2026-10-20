import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.connection import Base

def now_utc():
    return datetime.datetime.now(datetime.timezone.utc)

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    slot = Column(Integer, unique=True, index=True, nullable=False)  # 1, 2, 3, or 4
    google_id = Column(String(128), nullable=True)
    email = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False, default="YouTube User")
    picture_url = Column(String(512), nullable=True)
    channel_id = Column(String(128), nullable=True)
    channel_title = Column(String(255), nullable=True)
    encrypted_access_token = Column(Text, nullable=True)
    encrypted_refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    is_connected = Column(Boolean, default=True)
    is_demo = Column(Boolean, default=False)
    connected_at = Column(DateTime, default=now_utc)
    last_used_at = Column(DateTime, nullable=True)

class VideoQueueItem(Base):
    __tablename__ = "video_queue"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(String(32), index=True, nullable=False)
    video_url = Column(String(512), nullable=False)
    title = Column(String(512), default="YouTube Video")
    channel_title = Column(String(255), default="Unknown Channel")
    thumbnail_url = Column(String(512), nullable=True)
    duration = Column(String(64), nullable=True)
    published_at = Column(String(64), nullable=True)
    description = Column(Text, nullable=True)
    transcript_snippet = Column(Text, nullable=True)
    status = Column(String(64), default="Added")
    # Added | Analyzing | Analysis Complete | Comment Generated | Awaiting Approval | Published | Failed
    error_message = Column(Text, nullable=True)
    selected_account_slot = Column(Integer, nullable=True)
    analysis_sources = Column(String(128), default="metadata_only")
    created_at = Column(DateTime, default=now_utc)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)


class CommentRecord(Base):
    __tablename__ = "comment_records"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(String(32), index=True, nullable=False)
    video_url = Column(String(512), nullable=False)
    video_title = Column(String(512), default="YouTube Video")
    channel_title = Column(String(255), nullable=True)
    thumbnail_url = Column(String(512), nullable=True)
    comment_text = Column(Text, nullable=False)
    user_prompt = Column(Text, nullable=False)
    analysis_sources = Column(String(128), default="metadata_only")
    account_slot = Column(Integer, nullable=True)
    account_email = Column(String(255), nullable=True)
    account_channel_title = Column(String(255), nullable=True)
    publication_status = Column(String(64), default="Draft")
    # Draft | Awaiting Approval | Published | Failed
    youtube_comment_id = Column(String(128), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now_utc)
    published_at = Column(DateTime, nullable=True)

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(64), primary_key=True, index=True)
    title = Column(String(255), default="New Chat")
    created_at = Column(DateTime, default=now_utc)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role = Column(String(32), nullable=False)  # user | assistant | system
    content = Column(Text, nullable=False)
    attached_videos_json = Column(Text, nullable=True)  # JSON serialized metadata
    generated_comments_json = Column(Text, nullable=True)  # JSON serialized comment cards
    created_at = Column(DateTime, default=now_utc)

    session = relationship("ChatSession", back_populates="messages")
