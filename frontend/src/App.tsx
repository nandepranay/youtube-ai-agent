import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { ChatPage } from './pages/ChatPage';
import { QueuePage } from './pages/QueuePage';
import { AccountsPage } from './pages/AccountsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { api } from './services/api';
import { HealthData, AccountData, ChatSessionItem } from './types';

function AppLayout() {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number>(1);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const location = useLocation();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [hData, accData, sessData] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getAccounts().catch(() => []),
        api.getChatSessions().catch(() => [])
      ]);

      if (hData) setHealth(hData);
      if (accData) {
        setAccounts(accData);
        // Default selected slot to first connected account or 1
        const firstConnected = accData.find((a: AccountData) => a.is_connected);
        if (firstConnected) {
          setSelectedSlot(firstConnected.slot);
        }
      }
      if (sessData) setSessions(sessData);
    } catch (e) {
      console.error('Initial data fetch error:', e);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  const refreshHealth = async () => {
    try {
      const hData = await api.getHealth();
      setHealth(hData);
    } catch (e) {
      console.error('Failed to refresh health:', e);
    }
  };

  const refreshAccounts = async () => {
    try {
      const accData = await api.getAccounts();
      setAccounts(accData);
      const hData = await api.getHealth();
      setHealth(hData);
    } catch (e) {
      console.error('Failed to refresh accounts:', e);
    }
  };

  const refreshSessions = async () => {
    try {
      const sessData = await api.getChatSessions();
      setSessions(sessData);
    } catch (e) {
      console.error('Failed to refresh sessions:', e);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteChatSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
      showToast('Chat deleted', 'info');
    } catch (err: any) {
      showToast('Could not delete session', 'error');
    }
  };

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/queue':
        return 'Video Queue';
      case '/accounts':
        return 'Connected Accounts';
      case '/history':
        return 'Comment History';
      case '/settings':
        return 'Settings & API Keys';
      default:
        return 'AI Comment Assistant';
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => setActiveSessionId(id)}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        health={health}
        accounts={accounts}
        isOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          health={health}
          accounts={accounts}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
          title={getPageTitle(location.pathname)}
        />

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route
              path="/"
              element={
                <ChatPage
                  activeSessionId={activeSessionId}
                  setActiveSessionId={setActiveSessionId}
                  refreshSessions={refreshSessions}
                  health={health}
                  accounts={accounts}
                  selectedSlot={selectedSlot}
                  showToast={showToast}
                />
              }
            />
            <Route
              path="/queue"
              element={
                <QueuePage
                  accounts={accounts}
                  selectedSlot={selectedSlot}
                  showToast={showToast}
                  onStartChatWithVideo={(url) => {
                    setActiveSessionId(null);
                  }}
                />
              }
            />
            <Route
              path="/accounts"
              element={
                <AccountsPage
                  accounts={accounts}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                  refreshAccounts={refreshAccounts}
                  health={health}
                  showToast={showToast}
                />
              }
            />
            <Route
              path="/history"
              element={<HistoryPage accounts={accounts} showToast={showToast} />}
            />
            <Route
              path="/settings"
              element={<SettingsPage health={health} refreshHealth={refreshHealth} showToast={showToast} />}
            />
          </Routes>
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
