import React, { useState } from 'react';
import {
  Copy,
  Edit3,
  RefreshCw,
  Send,
  ExternalLink,
  Check,
  Sparkles,
  Info
} from 'lucide-react';
import { CommentCardData } from '../types';

interface CommentCardProps {
  comment: CommentCardData;
  onUpdateText: (id: number | undefined, newText: string) => void;
  onRegenerate: (comment: CommentCardData) => void;
  onOpenPublishModal: (comment: CommentCardData) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  onUpdateText,
  onRegenerate,
  onOpenPublishModal,
  showToast
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>(comment.comment_text);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(editText);
    setCopied(true);
    showToast('Comment copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    onUpdateText(comment.id, editText);
    setIsEditing(false);
    showToast('Comment updated.', 'success');
  };

  const wordCount = editText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-slate-300">
      {/* Top Bar: Video Context & Status Badge */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3 overflow-hidden">
          {comment.thumbnail_url && (
            <img
              src={comment.thumbnail_url}
              alt={comment.video_title}
              className="h-10 w-16 rounded-lg object-cover border border-slate-200 shrink-0"
            />
          )}
          <div className="overflow-hidden">
            <h4 className="text-xs font-semibold text-slate-900 truncate">
              {comment.video_title}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
              <span>{comment.channel_title || 'YouTube Video'}</span>
              <span>•</span>
              <a
                href={comment.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-indigo-600 hover:underline"
              >
                <span>Watch</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end">
          {/* AI Provider Badge */}
          {comment.provider === 'ollama' && (
            <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              Ollama ({comment.model || 'qwen2.5:7b'})
            </span>
          )}
          {comment.provider === 'openai' && (
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              OpenAI ({comment.model || 'gpt-4o-mini'})
            </span>
          )}
          {comment.provider === 'demo' && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              Demo Generator
            </span>
          )}

          {/* Analysis Source Badge */}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              comment.analysis_sources.includes('transcript')
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
            title={
              comment.analysis_sources.includes('transcript')
                ? 'Analyzed video transcript and metadata'
                : 'Analyzed title and description metadata'
            }
          >
            {comment.analysis_sources.includes('transcript') ? 'Transcript & Meta' : 'Metadata Only'}
          </span>

          {/* Status Badge */}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              comment.publication_status === 'Published'
                ? 'bg-emerald-100 text-emerald-800'
                : comment.publication_status === 'Failed'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {comment.publication_status}
          </span>
        </div>
      </div>

      {/* Main Comment Text (View / Edit Mode) */}
      <div className="py-3">
        {isEditing ? (
          <div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 focus:border-slate-500 focus:outline-hidden"
              placeholder="Edit your comment here..."
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">{wordCount} words</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditText(comment.comment_text);
                    setIsEditing(false);
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50/80 p-3 text-xs text-slate-800 leading-relaxed font-normal select-text">
            "{editText}"
          </div>
        )}
      </div>

      {/* Bottom Bar: Word Count & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>{wordCount} words</span>
          {comment.language && (
            <>
              <span>•</span>
              <span className="capitalize">{comment.language}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onRegenerate(comment)}
            title="Generate alternative comment"
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <RefreshCw className="h-3 w-3" />
            <span className="hidden sm:inline">Regenerate</span>
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            title="Edit comment text"
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <Edit3 className="h-3 w-3" />
            <span className="hidden sm:inline">{isEditing ? 'Close Edit' : 'Edit'}</span>
          </button>

          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={() => onOpenPublishModal(comment)}
            disabled={comment.publication_status === 'Published'}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Send className="h-3 w-3" />
            <span>{comment.publication_status === 'Published' ? 'Published' : 'Approve & Publish'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
