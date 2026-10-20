import React, { useState } from 'react';
import {
  X,
  Send,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  User,
  Loader2
} from 'lucide-react';
import { CommentCardData, AccountData } from '../types';
import { api } from '../services/api';

interface PublishModalProps {
  comment: CommentCardData;
  accounts: AccountData[];
  selectedSlot: number;
  onClose: () => void;
  onPublishedSuccess: (commentId: number | undefined, youtubeCommentId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  comment,
  accounts,
  selectedSlot,
  onClose,
  onPublishedSuccess,
  showToast
}) => {
  const [slot, setSlot] = useState<number>(selectedSlot || 1);
  const [isExplicitlyApproved, setIsExplicitlyApproved] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishedSuccess, setPublishedSuccess] = useState<boolean>(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.slot === slot);

  const handlePublish = async () => {
    if (!isExplicitlyApproved) {
      setErrorMessage('You must explicitly check the approval box before publishing.');
      return;
    }

    if (!selectedAccount || !selectedAccount.is_connected) {
      setErrorMessage(`Account slot ${slot} is not connected. Please choose a connected account.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.publishComment({
        commentId: comment.id,
        videoId: comment.video_id,
        videoUrl: comment.video_url,
        videoTitle: comment.video_title,
        commentText: comment.comment_text,
        accountSlot: slot,
        explicitApproval: true
      });

      if (res.success) {
        setPublishedSuccess(true);
        setPublishedId(res.youtube_comment_id || null);
        showToast('Comment successfully published to YouTube!', 'success');
        onPublishedSuccess(comment.id, res.youtube_comment_id || '');
      } else {
        setErrorMessage(res.error || res.message || 'Publication failed.');
        showToast(res.error || 'Publication failed. Draft preserved.', 'error');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected network error occurred.');
      showToast(err.message || 'Failed to publish comment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Approve & Publish to YouTube</h3>
              <p className="text-[11px] text-slate-500">Explicit human approval required prior to publishing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {publishedSuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 mb-2" />
              <h4 className="text-sm font-semibold text-emerald-950">Comment Published Successfully!</h4>
              <p className="text-xs text-emerald-800 mt-1">
                Your comment is now live on YouTube.
              </p>
              {publishedId && (
                <p className="mt-2 text-[11px] font-mono text-emerald-700 bg-emerald-100/60 py-1 px-2 rounded inline-block">
                  Comment ID: {publishedId}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Video Info Card */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 flex gap-3.5">
                {comment.thumbnail_url && (
                  <img
                    src={comment.thumbnail_url}
                    alt={comment.video_title}
                    className="h-16 w-28 rounded-lg object-cover shrink-0 border border-slate-200"
                  />
                )}
                <div className="overflow-hidden flex-1">
                  <h4 className="text-xs font-semibold text-slate-900 line-clamp-2">
                    {comment.video_title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Channel: {comment.channel_title || 'Unknown'}
                  </p>
                  <a
                    href={comment.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline"
                  >
                    <span>View Video on YouTube</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Comment Content Preview */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Complete Comment Text to Publish:
                </label>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-800 leading-relaxed shadow-inner">
                  "{comment.comment_text}"
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                  <span>Words: {comment.comment_text.split(/\s+/).filter(Boolean).length}</span>
                  <span>Source: {comment.analysis_sources.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Account Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Select Publishing YouTube Account:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {accounts.map((acc) => (
                    <button
                      key={acc.slot}
                      type="button"
                      onClick={() => setSlot(acc.slot)}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                        slot === acc.slot
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {acc.picture_url ? (
                        <img
                          src={acc.picture_url}
                          alt={acc.display_name || ''}
                          className="h-7 w-7 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            slot === acc.slot ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          <User className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <div className="text-xs font-semibold truncate leading-tight">
                          Slot {acc.slot}: {acc.display_name || (acc.is_connected ? 'Connected' : 'Empty')}
                        </div>
                        <div
                          className={`text-[10px] truncate ${
                            slot === acc.slot ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {acc.is_connected ? acc.email : 'Disconnected'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Message if any */}
              {errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Publication Notice: </span>
                    {errorMessage}
                  </div>
                </div>
              )}

              {/* Explicit Approval Checkbox */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isExplicitlyApproved}
                    onChange={(e) => setIsExplicitlyApproved(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div className="text-xs text-slate-700 leading-normal select-none">
                    <span className="font-semibold text-slate-900">
                      I have reviewed and approve publishing this comment.
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      This will use the authorized YouTube account to submit this comment directly to the video.
                    </p>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5">
          {publishedSuccess ? (
            <button
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isExplicitlyApproved || isSubmitting}
                onClick={handlePublish}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Publish to YouTube</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
