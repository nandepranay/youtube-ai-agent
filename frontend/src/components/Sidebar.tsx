import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  ListVideo,
  Users,
  History,
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Radio
} from 'lucide-react';
import { ChatSessionItem, HealthData, AccountData } from '../types';

interface SidebarProps {
  sessions: ChatSessionItem[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  health: HealthData | null;
  accounts: AccountData[];
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  health,
  accounts,
  isOpen,
  onCloseMobile
}) => {
  const navigate = useNavigate();
  const connectedAccountsCount = accounts.filter((a) => a.is_connected).length;

  const navItems = [
    { name: 'AI Chat', path: '/', icon: MessageSquare },
    { name: 'Video Queue', path: '/queue', icon: ListVideo },
    { name: 'Connected Accounts', path: '/accounts', icon: Users, badge: `${connectedAccountsCount}/4` },
    { name: 'Comment History', path: '/history', icon: History },
    { name: 'Settings', path: '/settings', icon: SettingsIcon }
  ];

  const handleNewChatClick = () => {
    onNewChat();
    navigate('/');
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200/90 bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <div
            onClick={() => {
              navigate('/');
              onCloseMobile();
            }}
            className="flex cursor-pointer items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-900 text-sm tracking-tight">TubePilot AI</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">YouTube Comment Assistant</p>
            </div>
          </div>
        </div>

        {/* Action Button: New Chat */}
        <div className="p-3.5 pb-2">
          <button
            onClick={handleNewChatClick}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Primary Navigation */}
        <div className="px-3 py-1">
          <nav className="space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="h-4 w-4 text-slate-500" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Chat History Section */}
        <div className="mt-3 flex flex-1 flex-col overflow-hidden px-3">
          <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Recent Chats</span>
            <span className="text-[10px] lowercase text-slate-400">({sessions.length})</span>
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No saved chats yet. Start a conversation to generate comments.
              </div>
            ) : (
              sessions.map((sess) => (
                <div
                  key={sess.id}
                  onClick={() => {
                    onSelectSession(sess.id);
                    navigate('/');
                    onCloseMobile();
                  }}
                  className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs transition ${
                    activeSessionId === sess.id
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" />
                    <span className="truncate">{sess.title}</span>
                  </div>
                  <button
                    onClick={(e) => onDeleteSession(sess.id, e)}
                    title="Delete session"
                    className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-600 p-0.5"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-rose-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Connection Status Footer */}
        <div className="border-t border-slate-100 p-3">
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                      health?.demo_mode ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      health?.demo_mode ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  {health?.demo_mode ? 'Demo / Dev Mode' : 'Live Mode'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">
                {connectedAccountsCount} / 4 Accts
              </span>
            </div>

            <p className="mt-1.5 text-[11px] text-slate-500 leading-tight">
              {health?.demo_mode
                ? 'Runs without API keys. Realistic mock generation & demo accounts active.'
                : 'Connected with YouTube Data API & Google OAuth.'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
