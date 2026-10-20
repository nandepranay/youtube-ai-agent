import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  Lock,
  User
} from 'lucide-react';
import { YouTubeIcon } from '../components/YouTubeIcon';

import { AccountData, HealthData } from '../types';
import { api } from '../services/api';

interface AccountsPageProps {
  accounts: AccountData[];
  selectedSlot: number;
  onSelectSlot: (slot: number) => void;
  refreshAccounts: () => void;
  health: HealthData | null;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({
  accounts,
  selectedSlot,
  onSelectSlot,
  refreshAccounts,
  health,
  showToast
}) => {
  const [connectingSlot, setConnectingSlot] = useState<number | null>(null);

  const handleConnectGoogle = async (slot: number) => {
    try {
      setConnectingSlot(slot);
      const res = await api.startGoogleAuth(slot);
      if (res.authorization_url) {
        window.location.href = res.authorization_url;
      }
    } catch (err: any) {
      showToast(err.message || 'Google OAuth is not configured in .env', 'error');
    } finally {
      setConnectingSlot(null);
    }
  };

  const handleConnectDemo = async (slot: number) => {
    try {
      setConnectingSlot(slot);
      await api.connectDemoAccount(slot);
      showToast(`Connected Demo Account in Slot ${slot}`, 'success');
      refreshAccounts();
    } catch (err: any) {
      showToast(err.message || 'Failed to connect demo account', 'error');
    } finally {
      setConnectingSlot(null);
    }
  };

  const handleDisconnect = async (slot: number) => {
    if (!confirm(`Are you sure you want to disconnect Account Slot ${slot}?`)) return;
    try {
      await api.disconnectAccount(slot);
      showToast(`Account Slot ${slot} disconnected.`, 'success');
      refreshAccounts();
    } catch (err: any) {
      showToast(err.message || 'Failed to disconnect account', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
      {/* Title & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Connected Accounts</h2>
          <p className="text-xs text-slate-500 mt-1">
            Authorize up to four independent Google & YouTube accounts. Tokens are encrypted at rest with Fernet.
          </p>
        </div>

        <button
          onClick={refreshAccounts}
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Accounts</span>
        </button>
      </div>

      {/* Security Note Banner */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
          <Lock className="h-4 w-4" />
        </div>
        <div className="text-xs text-slate-600">
          <span className="font-semibold text-slate-900">Zero Password Storage & Strict Account Isolation: </span>
          TubePilot AI uses standard Google OAuth 2.0 with the official YouTube Data API scope. Each slot maintains an isolated token profile encrypted using AES-256 Fernet. Passwords are never requested or stored.
        </div>
      </div>

      {/* 4 Account Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((slotNum) => {
          const acc = accounts.find((a) => a.slot === slotNum);
          const isConnected = !!(acc && acc.is_connected);
          const isActiveSlot = selectedSlot === slotNum;

          return (
            <div
              key={slotNum}
              className={`rounded-2xl border p-5 shadow-xs transition ${
                isActiveSlot
                  ? 'border-slate-900 bg-white ring-1 ring-slate-900'
                  : 'border-slate-200/90 bg-white hover:border-slate-300'
              }`}
            >
              {/* Header: Slot Badge & Active Indicator */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">
                    {slotNum}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">Account Slot {slotNum}</span>
                </div>

                <div className="flex items-center gap-2">
                  {isConnected && (
                    <button
                      onClick={() => onSelectSlot(slotNum)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                        isActiveSlot
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {isActiveSlot ? 'Default for Publishing' : 'Set Default'}
                    </button>
                  )}
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isConnected
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isConnected ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Connected</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        <span>Not Connected</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Account Body */}
              <div className="py-4">
                {isConnected ? (
                  <div className="flex items-start gap-3.5">
                    {acc?.picture_url ? (
                      <img
                        src={acc.picture_url}
                        alt={acc.display_name || ''}
                        className="h-12 w-12 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 shrink-0 border border-slate-200">
                        <User className="h-6 w-6" />
                      </div>
                    )}

                    <div className="overflow-hidden flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-semibold text-slate-900 truncate">
                          {acc?.display_name || 'YouTube User'}
                        </h4>
                        {acc?.is_demo && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-semibold text-amber-800">
                            Demo Acct
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{acc?.email}</p>

                      <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 border border-slate-100">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <YouTubeIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          <span className="truncate">{acc?.channel_title || 'Channel Connected'}</span>
                        </div>
                        {acc?.channel_id && (
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                            ID: {acc.channel_id}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                    <User className="mx-auto h-8 w-8 text-slate-300 mb-1" />
                    <p className="text-xs font-medium text-slate-600">No account linked</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Connect your Google/YouTube account to publish comments.
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {isConnected ? (
                  <>
                    <button
                      onClick={() => handleConnectGoogle(slotNum)}
                      disabled={connectingSlot === slotNum}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      Reconnect
                    </button>
                    <button
                      onClick={() => handleDisconnect(slotNum)}
                      className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"
                    >
                      <LogOut className="h-3 w-3" />
                      <span>Disconnect</span>
                    </button>
                  </>
                ) : (
                  <div className="flex w-full items-center justify-end gap-2">
                    <button
                      onClick={() => handleConnectDemo(slotNum)}
                      disabled={connectingSlot === slotNum}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                      title="Connect a simulated account for offline development & demo mode"
                    >
                      Demo Account
                    </button>
                    <button
                      onClick={() => handleConnectGoogle(slotNum)}
                      disabled={connectingSlot === slotNum}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
                    >
                      <YouTubeIcon className="h-3 w-3 text-red-400" />
                      <span>Connect Google</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
