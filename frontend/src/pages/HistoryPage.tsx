import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

import { CommentHistoryItem, AccountData } from '../types';
import { api } from '../services/api';

interface HistoryPageProps {
  accounts: AccountData[];
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ accounts, showToast }) => {
  const [history, setHistory] = useState<CommentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [accountFilter, setAccountFilter] = useState<string>('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    loadHistory();
  }, [statusFilter, accountFilter]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const items = await api.getCommentHistory({
        status: statusFilter || undefined,
        accountSlot: accountFilter ? Number(accountFilter) : undefined,
        search: searchQuery || undefined
      });
      setHistory(items);
    } catch (e: any) {
      showToast(e.message || 'Failed to load comment history', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadHistory();
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Comment text copied!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold">
            <CheckCircle2 className="h-3 w-3" />
            <span>Published</span>
          </span>
        );
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-semibold">
            <span>Draft</span>
          </span>
        );
      case 'Awaiting Approval':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">
            <Clock className="h-3 w-3" />
            <span>Awaiting Approval</span>
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-semibold">
            <AlertTriangle className="h-3 w-3" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Comment History</h2>
          <p className="text-xs text-slate-500 mt-1">
            Audit and review all generated drafts, approval decisions, and published YouTube comments.
          </p>
        </div>

        <button
          onClick={loadHistory}
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by video title, channel, or comment keywords..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 pl-9 text-xs text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-hidden"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:outline-hidden"
            >
              <option value="">All Statuses</option>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
              <option value="Awaiting Approval">Awaiting Approval</option>
              <option value="Failed">Failed</option>
            </select>

            {/* Account Filter */}
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:outline-hidden"
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.slot} value={a.slot}>
                  Slot {a.slot}: {a.display_name || `Account ${a.slot}`}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition shrink-0"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* History Items List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
            Loading comment history...
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center">
            <History className="mx-auto h-10 w-10 text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-700">No comment records found.</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Drafts and published comments will automatically be tracked here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-slate-300 space-y-3"
              >
                {/* Header: Title, Status, and Link */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {item.thumbnail_url && (
                      <img
                        src={item.thumbnail_url}
                        alt={item.video_title}
                        className="h-9 w-14 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    )}
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-semibold text-slate-900 truncate" title={item.video_title}>
                        {item.video_title}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span>{item.channel_title || 'Unknown Channel'}</span>
                        <span>•</span>
                        <a
                          href={item.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-indigo-600 hover:underline"
                        >
                          <span>Open YouTube</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    {getStatusBadge(item.publication_status)}
                    {item.account_slot && (
                      <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-medium">
                        Slot {item.account_slot}
                      </span>
                    )}
                  </div>
                </div>

                {/* Comment Text Content */}
                <div className="rounded-xl bg-slate-50/70 p-3 text-xs text-slate-800 leading-relaxed font-normal select-text">
                  "{item.comment_text}"
                </div>

                {/* Footer Metadata & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      Created: {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {item.published_at && (
                      <span>
                        • Published: {new Date(item.published_at).toLocaleDateString()} {new Date(item.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {item.account_email && (
                      <span>
                        • Acct: {item.account_email}
                      </span>
                    )}
                    {item.youtube_comment_id && (
                      <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                        ID: {item.youtube_comment_id}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleCopy(item.id, item.comment_text)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition"
                  >
                    {copiedId === item.id ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedId === item.id ? 'Copied' : 'Copy Text'}</span>
                  </button>
                </div>

                {/* Error Banner if publication failed */}
                {item.error_message && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-800 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Notice:</span> {item.error_message}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
