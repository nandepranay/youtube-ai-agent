from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl

# --- Video Schemas ---
class VideoValidateRequest(BaseModel):
    url: str

class VideoValidateResponse(BaseModel):
    is_valid: bool
    video_id: Optional[str] = None
    normalized_url: Optional[str] = None
    error: Optional[str] = None

class VideoAnalyzeRequest(BaseModel):
    url: str
    fetch_transcript: bool = True

class VideoMetadataResponse(BaseModel):
    video_id: str
    video_url: str
    title: str
    channel_title: str
    description: Optional[str] = ""
    thumbnail_url: Optional[str] = None
    published_at: Optional[str] = None
    duration: Optional[str] = None
    has_transcript: bool = False
    transcript_snippet: Optional[str] = None
    analysis_source: str = "metadata_only"  # metadata_only | transcript_and_metadata
    error: Optional[str] = None

# --- Comment Schemas ---
class CommentCardDto(BaseModel):
    id: Optional[int] = None
    video_id: str
    video_url: str
    video_title: str
    channel_title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    comment_text: str
    user_prompt: str
    analysis_sources: str = "metadata_only"
    language: Optional[str] = "en"  # en | hi | hinglish
    created_at: Optional[str] = None
    publication_status: str = "Draft"

class GenerateCommentsRequest(BaseModel):
    video_urls: List[str]
    prompt: str
    tone: Optional[str] = "natural"
    max_words: Optional[int] = 50
    language: Optional[str] = "English"  # English | Hindi | Hinglish
    alternatives_count: Optional[int] = 1

class GenerateCommentsResponse(BaseModel):
    success: bool
    comments: List[CommentCardDto]
    analysis_summary: str
    mode: str = "live"  # live | demo

class PublishCommentRequest(BaseModel):
    comment_id: Optional[int] = None
    video_id: str
    video_url: Optional[str] = None
    video_title: Optional[str] = None
    comment_text: str
    account_slot: int = Field(..., ge=1, le=4)
    explicit_approval: bool = Field(..., description="User must explicitly approve each publication")

class PublishCommentResponse(BaseModel):
    success: bool
    youtube_comment_id: Optional[str] = None
    publication_status: str
    message: str
    error: Optional[str] = None
    account_slot: int

class CommentHistoryFilter(BaseModel):
    account_slot: Optional[int] = None
    publication_status: Optional[str] = None
    search: Optional[str] = None
    limit: int = 50
    offset: int = 0

class CommentHistoryItemDto(BaseModel):
    id: int
    video_id: str
    video_url: str
    video_title: str
    channel_title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    comment_text: str
    user_prompt: str
    analysis_sources: str
    account_slot: Optional[int] = None
    account_email: Optional[str] = None
    account_channel_title: Optional[str] = None
    publication_status: str
    youtube_comment_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str
    published_at: Optional[str] = None

# --- Chat Schemas ---
class ChatMessageDto(BaseModel):
    id: Optional[int] = None
    role: str  # user | assistant
    content: str
    attached_videos: Optional[List[VideoMetadataResponse]] = None
    generated_comments: Optional[List[CommentCardDto]] = None
    created_at: Optional[str] = None

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    video_urls: Optional[List[str]] = None
    language_preference: Optional[str] = "English"

class ChatResponse(BaseModel):
    session_id: str
    reply: str
    attached_videos: List[VideoMetadataResponse]
    generated_comments: List[CommentCardDto]
    is_demo: bool = False

# --- Account Schemas ---
class AccountDto(BaseModel):
    slot: int
    email: Optional[str] = None
    display_name: Optional[str] = None
    picture_url: Optional[str] = None
    channel_id: Optional[str] = None
    channel_title: Optional[str] = None
    is_connected: bool
    is_demo: bool = False
    connected_at: Optional[str] = None
    last_used_at: Optional[str] = None

class AccountDisconnectRequest(BaseModel):
    slot: int = Field(..., ge=1, le=4)

class AccountDemoConnectRequest(BaseModel):
    slot: int = Field(..., ge=1, le=4)
    display_name: Optional[str] = None
    channel_title: Optional[str] = None

# --- Video Queue Schemas ---
class QueueItemCreate(BaseModel):
    video_url: str
    selected_account_slot: Optional[int] = None

class QueueItemResponse(BaseModel):
    id: int
    video_id: str
    video_url: str
    title: str
    channel_title: str
    thumbnail_url: Optional[str] = None
    duration: Optional[str] = None
    published_at: Optional[str] = None
    description: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    selected_account_slot: Optional[int] = None
    analysis_sources: Optional[str] = None
    created_at: str
    updated_at: str

# --- Health & Status Schemas ---
class HealthResponse(BaseModel):
    status: str
    demo_mode: bool
    openai_configured: bool
    youtube_configured: bool
    google_oauth_configured: bool
    connected_accounts_count: int
    app_name: str = "TubePilot AI"
    version: str = "1.0.0"
