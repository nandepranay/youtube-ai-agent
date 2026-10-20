import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Plus,
  X,
  Sparkles,
  Loader2
} from 'lucide-react';
import { YouTubeIcon } from '../components/YouTubeIcon';
import { VideoMetadata, CommentCardData, ChatMessage, HealthData, AccountData } from '../types';
import { api } from '../services/api';
import { CommentCard } from '../components/CommentCard';
import { PublishModal } from '../components/PublishModal';
import { StatusBanner } from '../components/StatusBanner';


interface ChatPageProps {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  refreshSessions: () => void;
  health: HealthData | null;
  accounts: AccountData[];
  selectedSlot: number;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({
  activeSessionId,
  setActiveSessionId,
  refreshSessions,
  health,
  accounts,
  selectedSlot,
  showToast
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [attachedVideos, setAttachedVideos] = useState<VideoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValidatingVideo, setIsValidatingVideo] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('English');
  const [selectedTone, setSelectedTone] = useState<string>('natural');
  const [maxWords, setMaxWords] = useState<number>(40);
  const [activeModalComment, setActiveModalComment] = useState<CommentCardData | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    { label: 'Art Appreciation (< 30 words)', text: 'Analyze this video and generate a thoughtful comment appreciating the artistic detail. Keep it under 30 words.' },
    { label: 'Hindi Translation', text: 'Translate the generated comments into natural, respectful Hindi.' },
    { label: 'Modern Hinglish', text: 'Generate an engaging, natural Hinglish comment appreciating the video style and pacing.' },
    { label: 'Spiritual & Calm Tone', text: 'Rewrite this comment in a grounding, peaceful spiritual tone with a respectful namaste emoji.' },
    { label: 'Make Shorter', text: 'Make this comment more concise and impactful in under 15 words.' },
    { label: '3 Alternatives', text: 'Generate 3 alternative creative comment angles for this video.' }
  ];

  // Load message history if switching session
  useEffect(() => {
    if (activeSessionId) {
      loadSessionMessages(activeSessionId);
    } else {
      setMessages([]);
      setAttachedVideos([]);
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadSessionMessages = async (sid: string) => {
    try {
      const msgs = await api.getSessionMessages(sid);
      setMessages(msgs);
      // Collect attached videos from past messages
      const pastVids: VideoMetadata[] = [];
      msgs.forEach((m) => {
        if (m.attached_videos) {
          m.attached_videos.forEach((v) => {
            if (!pastVids.some((pv) => pv.video_id === v.video_id)) {
              pastVids.push(v);
            }
          });
        }
      });
      if (pastVids.length > 0) {
        setAttachedVideos(pastVids);
      }
    } catch (e) {
      console.error('Failed to load session messages:', e);
    }
  };

  const handleAddVideo = async (urlToAdd?: string) => {
    const targetUrl = (urlToAdd || videoUrlInput).trim();
    if (!targetUrl) return;

    setIsValidatingVideo(true);
    try {
      const valRes = await api.validateVideo(targetUrl);
      if (!valRes.is_valid || !valRes.video_id) {
        showToast(valRes.error || 'Please enter a valid YouTube URL.', 'error');
        return;
      }

      if (attachedVideos.some((v) => v.video_id === valRes.video_id)) {
        showToast('This video is already attached.', 'error');
        setVideoUrlInput('');
        return;
      }

      const meta = await api.analyzeVideo(valRes.normalized_url || targetUrl, true);
      setAttachedVideos((prev) => [...prev, meta]);
      setVideoUrlInput('');
      showToast(`Added: ${meta.title.slice(0, 35)}...`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not fetch video information.', 'error');
    } finally {
      setIsValidatingVideo(false);
    }
  };

  const handleRemoveVideo = (vid: string) => {
    setAttachedVideos((prev) => prev.filter((v) => v.video_id !== vid));
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || prompt;
    if (!textToSend.trim() && attachedVideos.length === 0) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: textToSend,
      attached_videos: attachedVideos.length > 0 ? [...attachedVideos] : undefined
    };

    setMessages((prev) => [...prev, userMessage]);
    setPrompt('');
    setIsLoading(true);

    try {
      const videoUrls = attachedVideos.map((v) => v.video_url);
      const res = await api.sendChatMessage(
        activeSessionId,
        textToSend,
        videoUrls.length > 0 ? videoUrls : undefined,
        selectedLanguage
      );

      if (!activeSessionId) {
        setActiveSessionId(res.session_id);
        refreshSessions();
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: res.reply,
        attached_videos: res.attached_videos,
        generated_comments: res.generated_comments,
        provider: res.provider || (res.is_demo ? 'demo' : health?.ai_provider || 'ollama'),
        model: res.model || (health?.ai_provider === 'ollama' ? health?.ollama_model || 'qwen2.5:7b' : undefined)
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (res.attached_videos && res.attached_videos.length > 0) {
        setAttachedVideos(res.attached_videos);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to generate comments.', 'error');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to complete AI instruction. Please verify your connection.'}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCommentText = (id: number | undefined, newText: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (!msg.generated_comments) return msg;
        return {
          ...msg,
          generated_comments: msg.generated_comments.map((c) =>
            c.id === id ? { ...c, comment_text: newText } : c
          )
        };
      })
    );
  };

  const handleRegenerateComment = (c: CommentCardData) => {
    const regenPrompt = `Generate a fresh, alternative comment for '${c.video_title}' in ${selectedTone} tone (${selectedLanguage}). Under ${maxWords} words.`;
    handleSendMessage(regenPrompt);
  };

  const handlePublishSuccess = (commentId: number | undefined, youtubeCommentId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (!msg.generated_comments) return msg;
        return {
          ...msg,
          generated_comments: msg.generated_comments.map((c) =>
            c.id === commentId
              ? { ...c, publication_status: 'Published' as const }
              : c
          )
        };
      })
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Top Banner */}
      <StatusBanner health={health} />

      {/* Main Conversation Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 space-y-6">
        {messages.length === 0 ? (
          /* Welcome View */
          <div className="mx-auto max-w-2xl text-center py-12 md:py-16">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
              <Sparkles className="h-7 w-7 text-emerald-400" />
            </div>

            <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Let's create meaningful YouTube comments.
            </h2>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Share a video, tell me what to say, and let AI help you write a thoughtful, natural comment.
            </p>

            {/* Quick Sample Prompts */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
              {quickPrompts.slice(0, 4).map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(qp.text);
                  }}
                  className="rounded-xl border border-slate-200/90 bg-white p-3 text-xs shadow-2xs hover:border-slate-300 hover:bg-slate-50 transition text-slate-700"
                >
                  <div className="font-semibold text-slate-900 mb-0.5">{qp.label}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">{qp.text}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message Trajectory */
          <div className="mx-auto max-w-3xl space-y-6 pb-6">
            {messages.map((msg, index) => (
              <div key={index} className="space-y-3">
                {/* User Message */}
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-xl rounded-2xl bg-slate-900 px-4 py-3 text-xs text-white shadow-xs">
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      {msg.attached_videos && msg.attached_videos.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-slate-800">
                          {msg.attached_videos.map((v) => (
                            <span
                              key={v.video_id}
                              className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
                            >
                              <YouTubeIcon className="h-3 w-3 text-red-400" />
                              <span className="truncate max-w-[140px]">{v.title}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Assistant Message */
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-900 border border-slate-200">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs text-slate-800 shadow-xs leading-relaxed">
                        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                          <span className="font-semibold text-slate-900 text-[11px] flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-indigo-600" />
                            <span>AI Assistant</span>
                          </span>
                          {msg.provider === 'ollama' && (
                            <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                              Ollama ({msg.model || 'qwen2.5:7b'})
                            </span>
                          )}
                          {msg.provider === 'openai' && (
                            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              OpenAI ({msg.model || 'gpt-4o-mini'})
                            </span>
                          )}
                          {msg.provider === 'demo' && (
                            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                              Demo Mode
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      {/* Render Generated Comments */}
                      {msg.generated_comments && msg.generated_comments.length > 0 && (
                        <div className="space-y-3 pt-1">
                          {msg.generated_comments.map((card, cIdx) => (
                            <CommentCard
                              key={cIdx}
                              comment={card}
                              onUpdateText={handleUpdateCommentText}
                              onRegenerate={handleRegenerateComment}
                              onOpenPublishModal={(c) => setActiveModalComment(c)}
                              showToast={showToast}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-900 border border-slate-200">
                  <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-xs">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  <span>
                    {health?.ai_provider === 'ollama'
                      ? `Querying local Ollama (${health?.ollama_model || 'qwen2.5:7b'}) & analyzing content...`
                      : 'Analyzing video content and generating natural comments...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar Area */}
      <div className="border-t border-slate-200/90 bg-white/90 p-4 md:px-8 backdrop-blur-xs">
        <div className="mx-auto max-w-3xl space-y-3">
          {/* Attached Videos Bar */}
          {attachedVideos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 pl-1">Attached:</span>
              {attachedVideos.map((v) => (
                <div
                  key={v.video_id}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1 px-2 text-[11px] text-slate-800 shadow-2xs"
                >
                  <YouTubeIcon className="h-3 w-3 text-red-500" />
                  <span className="truncate max-w-[150px] font-medium">{v.title}</span>
                  {v.has_transcript ? (
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                      Captions Ready
                    </span>
                  ) : (
                    <span
                      className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-medium text-amber-700"
                      title={v.transcript_status || 'Captions unavailable - metadata only will be analyzed'}
                    >
                      Metadata Only
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveVideo(v.video_id)}
                    className="ml-0.5 rounded text-slate-400 hover:text-slate-700"
                    title="Remove video"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Video URL Add Form */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddVideo();
                  }
                }}
                placeholder="Paste YouTube video link (watch, shorts, or youtu.be)..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 pl-9 text-xs text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-hidden"
              />
              <YouTubeIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
            <button
              onClick={() => handleAddVideo()}
              disabled={!videoUrlInput.trim() || isValidatingVideo}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition"
            >
              {isValidatingVideo ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>Add Video</span>
            </button>
          </div>

          {/* Multiline Prompt Box */}
          <div className="rounded-2xl border border-slate-300 bg-white shadow-xs focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-500 transition">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={2}
              placeholder="Ask TubePilot AI: 'Generate 2 comments in natural Hinglish under 35 words appreciating the artwork'..."
              className="w-full resize-none border-0 bg-transparent p-3.5 text-xs text-slate-900 placeholder-slate-400 focus:ring-0 focus:outline-hidden"
            />

            {/* Bottom Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 bg-slate-50/50 rounded-b-2xl">
              <div className="flex items-center gap-2">
                {/* Language Select */}
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 focus:outline-hidden"
                  title="Target Language"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Hinglish">Hinglish</option>
                </select>

                {/* Tone Select */}
                <select
                  value={selectedTone}
                  onChange={(e) => setSelectedTone(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 focus:outline-hidden"
                  title="Comment Tone"
                >
                  <option value="natural">Natural & Conversational</option>
                  <option value="appreciative">Appreciative & Warm</option>
                  <option value="spiritual">Spiritual & Reflective</option>
                  <option value="professional">Professional & Insightful</option>
                  <option value="casual">Casual & Friendly</option>
                </select>

                {/* Word limit selector */}
                <select
                  value={maxWords}
                  onChange={(e) => setMaxWords(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 focus:outline-hidden"
                  title="Max Word Limit"
                >
                  <option value={20}>&lt; 20 words (Short)</option>
                  <option value={40}>&lt; 40 words (Standard)</option>
                  <option value={70}>&lt; 70 words (Detailed)</option>
                </select>
              </div>

              <button
                onClick={() => handleSendMessage()}
                disabled={(!prompt.trim() && attachedVideos.length === 0) || isLoading}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Publish Modal */}
      {activeModalComment && (
        <PublishModal
          comment={activeModalComment}
          accounts={accounts}
          selectedSlot={selectedSlot}
          onClose={() => setActiveModalComment(null)}
          onPublishedSuccess={handlePublishSuccess}
          showToast={showToast}
        />
      )}
    </div>
  );
};
