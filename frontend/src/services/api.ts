import {
  HealthData,
  VideoMetadata,
  CommentCardData,
  ChatMessage,
  ChatSessionItem,
  AccountData,
  QueueItem,
  CommentHistoryItem
} from '../types';

const BASE_URL = '';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errJson.error || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export const api = {
  // Health
  getHealth: () => fetchJson<HealthData>('/health'),

  // Video
  validateVideo: (url: string) =>
    fetchJson<{ is_valid: boolean; video_id?: string; normalized_url?: string; error?: string }>(
      '/api/video/validate',
      {
        method: 'POST',
        body: JSON.stringify({ url })
      }
    ),

  analyzeVideo: (url: string, fetchTranscript: boolean = true) =>
    fetchJson<VideoMetadata>('/api/video/analyze', {
      method: 'POST',
      body: JSON.stringify({ url, fetch_transcript: fetchTranscript })
    }),

  // AI Chat
  sendChatMessage: (
    sessionId: string | null,
    message: string,
    videoUrls?: string[],
    languagePreference: string = 'English'
  ) =>
    fetchJson<{
      session_id: string;
      reply: string;
      attached_videos: VideoMetadata[];
      generated_comments: CommentCardData[];
      is_demo: boolean;
    }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        message,
        video_urls: videoUrls,
        language_preference: languagePreference
      })
    }),

  getChatSessions: () => fetchJson<ChatSessionItem[]>('/api/chat/sessions'),

  getSessionMessages: (sessionId: string) =>
    fetchJson<ChatMessage[]>(`/api/chat/session/${sessionId}/messages`),

  deleteChatSession: (sessionId: string) =>
    fetchJson<{ success: boolean }>(`/api/chat/session/${sessionId}`, { method: 'DELETE' }),

  // Comments
  generateComments: (params: {
    videoUrls: string[];
    prompt: string;
    tone?: string;
    maxWords?: number;
    language?: string;
    alternativesCount?: number;
  }) =>
    fetchJson<{
      success: boolean;
      comments: CommentCardData[];
      analysis_summary: string;
      mode: string;
    }>('/api/comments/generate', {
      method: 'POST',
      body: JSON.stringify({
        video_urls: params.videoUrls,
        prompt: params.prompt,
        tone: params.tone || 'natural',
        max_words: params.maxWords || 50,
        language: params.language || 'English',
        alternatives_count: params.alternativesCount || 1
      })
    }),

  publishComment: (params: {
    commentId?: number;
    videoId: string;
    commentText: string;
    accountSlot: number;
    explicitApproval: boolean;
    videoUrl?: string;
    videoTitle?: string;
  }) =>
    fetchJson<{
      success: boolean;
      youtube_comment_id?: string;
      publication_status: string;
      message: string;
      error?: string;
      account_slot: number;
    }>('/api/comments/publish', {
      method: 'POST',
      body: JSON.stringify({
        comment_id: params.commentId,
        video_id: params.videoId,
        comment_text: params.commentText,
        account_slot: params.accountSlot,
        explicit_approval: params.explicitApproval,
        video_url: params.videoUrl,
        video_title: params.videoTitle
      })
    }),

  getCommentHistory: (params?: { accountSlot?: number; status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.accountSlot !== undefined) q.append('account_slot', String(params.accountSlot));
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    return fetchJson<CommentHistoryItem[]>(`/api/comments/history?${q.toString()}`);
  },

  // Accounts & OAuth
  getAccounts: () => fetchJson<AccountData[]>('/api/accounts'),

  getAuthStatus: () =>
    fetchJson<{
      google_oauth_configured: boolean;
      demo_mode: boolean;
      redirect_uri: string;
      accounts: AccountData[];
    }>('/api/auth/status'),

  startGoogleAuth: (slot: number) =>
    fetchJson<{ authorization_url: string; slot: number; state: string }>(
      `/api/auth/google/start?slot=${slot}`,
      { method: 'POST' }
    ),

  disconnectAccount: (slot: number) =>
    fetchJson<{ success: boolean; message: string }>('/api/auth/google/disconnect', {
      method: 'POST',
      body: JSON.stringify({ slot })
    }),

  connectDemoAccount: (slot: number, displayName?: string, channelTitle?: string) =>
    fetchJson<{ success: boolean; message: string; slot: number }>('/api/auth/google/demo-connect', {
      method: 'POST',
      body: JSON.stringify({ slot, display_name: displayName, channel_title: channelTitle })
    }),

  // Queue
  getQueue: () => fetchJson<QueueItem[]>('/api/queue'),

  addToQueue: (videoUrl: string, selectedAccountSlot?: number) =>
    fetchJson<QueueItem>('/api/queue', {
      method: 'POST',
      body: JSON.stringify({
        video_url: videoUrl,
        selected_account_slot: selectedAccountSlot
      })
    }),

  removeFromQueue: (itemId: number) =>
    fetchJson<{ success: boolean; message: string }>(`/api/queue/${itemId}`, {
      method: 'DELETE'
    })
};
