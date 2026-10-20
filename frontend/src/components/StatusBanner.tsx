import React from 'react';
import { Link } from 'react-router-dom';
import { Info, Sparkles, Key, CheckCircle2 } from 'lucide-react';
import { HealthData } from '../types';

interface StatusBannerProps {
  health: HealthData | null;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ health }) => {
  if (!health) return null;

  if (health.demo_mode) {
    return (
      <div className="mb-4 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/50 p-3.5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-amber-900">Development / Demo Mode Active: </span>
              TubePilot AI is running in standalone local mode. Video metadata, multi-language Hinglish/Hindi AI generation, and account slots are active with simulated responses. Real comments will not be published to live YouTube without credentials.
            </div>
          </div>
          <Link
            to="/settings"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-xs hover:bg-amber-50"
          >
            <Key className="h-3.5 w-3.5 text-amber-600" />
            <span>Configure API Keys</span>
          </Link>
        </div>
      </div>
    );
  }

  return null;
};
