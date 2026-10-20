import React from 'react';
import { Menu } from 'lucide-react';
import { HealthData, AccountData } from '../types';


interface HeaderProps {
  onToggleMobileSidebar: () => void;
  health: HealthData | null;
  accounts: AccountData[];
  selectedSlot: number;
  onSelectSlot: (slot: number) => void;
  title: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileSidebar,
  health,
  accounts,
  selectedSlot,
  onSelectSlot,
  title
}) => {
  const connectedAccounts = accounts.filter((a) => a.is_connected);
  const activeAccount = accounts.find((a) => a.slot === selectedSlot);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 md:px-6 backdrop-blur-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-slate-900 leading-tight">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Mode Pill */}
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
            health?.demo_mode
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
          title={
            health?.demo_mode
              ? 'Demo Mode: API keys optional. Simulated preview comments.'
              : 'Live Mode: Connected with real OpenAI & YouTube credentials.'
          }
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              health?.demo_mode ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <span className="hidden sm:inline">
            {health?.demo_mode ? 'Demo Mode' : 'Live Mode'}
          </span>
        </div>

        {/* Selected Publishing Account */}
        <div className="flex items-center gap-2">
          <label className="hidden text-xs text-slate-500 lg:inline">Active Account:</label>
          <select
            value={selectedSlot}
            onChange={(e) => onSelectSlot(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-slate-400 focus:outline-hidden"
          >
            {accounts.map((acc) => (
              <option key={acc.slot} value={acc.slot}>
                Slot {acc.slot}: {acc.is_connected ? `${acc.channel_title || acc.email} ${acc.is_demo ? '(Demo)' : ''}` : '(Disconnected)'}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};
