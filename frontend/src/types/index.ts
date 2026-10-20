export interface VideoMetadata {
  video_id: string;
  video_url: string;
  title: string;
  channel_title: string;
  description?: string;
  thumbnail_url?: string;
  published_at?: string;
  duration?: string;
  has_transcript: boolean;
  transcript_snippet?: string;
  analysis_source: 'metadata_only' | 'transcript_and_metadata';
  error?: string;
}

export interface CommentCardData {
  id?: number;
  video_id: string;
  video_url: string;
  video_title: string;
  channel_title?: string;
  thumbnail_url?: string;
  comment_text: string;
  user_prompt: string;
  analysis_sources: string;
  language?: string;
  created_at?: string;
  publication_status: 'Draft' | 'Awaiting Approval' | 'Published' | 'Failed';
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  attached_videos?: VideoMetadata[];
  generated_comments?: CommentCardData[];
  created_at?: string;
}

export interface ChatSessionItem {
  id: string;
  title: string;
  created_at: string;
}

export interface AccountData {
  slot: number;
  email?: string;
  display_name?: string;
  picture_url?: string;
  channel_id?: string;
  channel_title?: string;
  is_connected: boolean;
  is_demo: boolean;
  connected_at?: string;
  last_used_at?: string;
}

export interface QueueItem {
  id: number;
  video_id: string;
  video_url: string;
  title: string;
  channel_title: string;
  thumbnail_url?: string;
  duration?: string;
  published_at?: string;
  description?: string;
  status: 'Added' | 'Analyzing' | 'Analysis Complete' | 'Comment Generated' | 'Awaiting Approval' | 'Published' | 'Failed';
  error_message?: string;
  selected_account_slot?: number;
  analysis_sources?: string;
  created_at: string;
  updated_at: string;
}

export interface CommentHistoryItem {
  id: number;
  video_id: string;
  video_url: string;
  video_title: string;
  channel_title?: string;
  thumbnail_url?: string;
  comment_text: string;
  user_prompt: string;
  analysis_sources: string;
  account_slot?: number;
  account_email?: string;
  account_channel_title?: string;
  publication_status: string;
  youtube_comment_id?: string;
  error_message?: string;
  created_at: string;
  published_at?: string;
}

export interface HealthData {
  status: string;
  demo_mode: boolean;
  openai_configured: boolean;
  youtube_configured: boolean;
  google_oauth_configured: boolean;
  connected_accounts_count: number;
  app_name: string;
  version: string;
}
