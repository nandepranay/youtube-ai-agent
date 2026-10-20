import React, { useState, useEffect } from 'react';
import {
  ListVideo,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  Loader2
} from 'lucide-react';
import { YouTubeIcon } from '../components/YouTubeIcon';

import { QueueItem, AccountData } from '../types';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface QueuePageProps {
  accounts: AccountData[];
  selectedSlot: number;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onStartChatWithVideo: (videoUrl: string) => void;
}

export const QueuePage: React.FC<QueuePageProps> = ({
  accounts,
  selectedSlot,
  showToast,
  onStartChatWithVideo
}) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [accountSlot, setAccountSlot] = useState<number>(selectedSlot || 1);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDetailsItem, setSelectedDetailsItem] = useState<QueueItem | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const items = await api.getQueue();
      setQueue(items);
    } catch (e: any) {
      showToast(e.message || 'Failed to load video queue', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToQueue = async () => {
    if (!videoUrlInput.trim()) return;
    setIsAdding(true);
    try {
      const newItem = await api.addToQueue(videoUrlInput.trim(), accountSlot);
      setQueue((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id)]);
      setVideoUrlInput('');
      showToast('Video added to queue.', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to add video to queue.', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await api.removeFromQueue(id);
      setQueue((prev) => prev.filter((i) => i.id !== id));
      showToast('Removed from queue.', 'success');
      if (selectedDetailsItem?.id === id) {
        setSelectedDetailsItem(null);
      }
    } catch (e: any) {
      showToast(e.message || 'Could not remove video from queue.', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':
        return <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold">Published</span>;
      case 'Analysis Complete':
        return <span className="rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-[10px] font-semibold">Analysis Complete</span>;
      case 'Comment Generated':
        return <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[10px] font-semibold">Comment Generated</span>;
      case 'Awaiting Approval':
        return <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">Awaiting Approval</span>;
      case 'Failed':
        return <span className="rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-semibold">Failed</span>;
      case 'Analyzing':
        return <span className="rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-[10px] font-semibold">Analyzing...</span>;
      default:
        return <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-semibold">{status}</span>;
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
      {/* Title & Description */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Video Queue</h2>
        <p className="text-xs text-slate-500 mt-1">
          Organize YouTube videos to analyze and generate comments. Each queued video can be processed and approved individually.
        </p>
      </div>

      {/* Add Video to Queue Form */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <h3 className="text-xs font-semibold text-slate-800 mb-2">Add YouTube Video to Queue</h3>
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddToQueue();
                }
              }}
              placeholder="Paste YouTube link (https://www.youtube.com/watch?v=... or shorts)..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 pl-9 text-xs text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-hidden"
            />
            <YouTubeIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={accountSlot}
              onChange={(e) => setAccountSlot(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:outline-hidden shrink-0"
            >
              {accounts.map((a) => (
                <option key={a.slot} value={a.slot}>
                  Slot {a.slot}: {a.is_connected ? a.display_name || a.email : 'Disconnected'}
                </option>
              ))}
            </select>

            <button
              onClick={handleAddToQueue}
              disabled={!videoUrlInput.trim() || isAdding}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 shrink-0 transition"
            >
              {isAdding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>Add to Queue</span>
            </button>
          </div>
        </div>
      </div>

      {/* Queue List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
          <span>Queued Videos ({queue.length})</span>
          <button onClick={loadQueue} className="text-indigo-600 hover:underline">
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-500 mb-2" />
            Loading video queue...
          </div>
        ) : queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center">
            <ListVideo className="mx-auto h-10 w-10 text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-700">No videos in your queue yet.</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Add video URLs above to queue them for batch analysis or individual comment generation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-slate-300"
              >
                {/* Left: Thumbnail & Details */}
                <div className="flex items-start gap-3.5 overflow-hidden w-full sm:w-auto flex-1">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      className="h-16 w-28 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="flex h-16 w-28 items-center justify-center rounded-xl bg-slate-100 text-slate-400 shrink-0">
                      <YouTubeIcon className="h-6 w-6" />
                    </div>
                  )}

                  <div className="overflow-hidden flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {getStatusBadge(item.status)}
                      <span className="text-[10px] text-slate-400">
                        Target: Slot {item.selected_account_slot || 1}
                      </span>
                      {item.analysis_sources && (
                        <span className="text-[10px] text-slate-400">
                          • {item.analysis_sources.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-semibold text-slate-900 truncate" title={item.title}>
                      {item.title}
                    </h4>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>{item.channel_title}</span>
                      <span>•</span>
                      <a
                        href={item.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-indigo-600 hover:underline"
                      >
                        <span>Open Video</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>

                    {item.error_message && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">
                        Error: {item.error_message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <button
                    onClick={() => setSelectedDetailsItem(item)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    View Details
                  </button>

                  <button
                    onClick={() => {
                      onStartChatWithVideo(item.video_url);
                      navigate('/');
                    }}
                    className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
                  >
                    <Sparkles className="h-3 w-3 text-emerald-400" />
                    <span>Generate Comment</span>
                  </button>

                  <button
                    onClick={() => handleRemove(item.id)}
                    title="Remove from queue"
                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Video Details Modal */}
      {selectedDetailsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Video Analysis Details</h3>
              <button
                onClick={() => setSelectedDetailsItem(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Title:</span> {selectedDetailsItem.title}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Channel:</span> {selectedDetailsItem.channel_title}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Video ID:</span> {selectedDetailsItem.video_id}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Status:</span> {selectedDetailsItem.status}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Analysis Source:</span>{' '}
                {selectedDetailsItem.analysis_sources?.replace('_', ' ') || 'Metadata only'}
              </p>
              {selectedDetailsItem.description && (
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">Description Snippet:</span>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 max-h-32 overflow-y-auto text-[11px] text-slate-600">
                    {selectedDetailsItem.description}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  onStartChatWithVideo(selectedDetailsItem.video_url);
                  setSelectedDetailsItem(null);
                  navigate('/');
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
              >
                Generate Comment in Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
