import React from 'react';
import { Link } from 'react-router-dom';
import { Info, Sparkles, Key, Server } from 'lucide-react';
import { HealthData } from '../types';

interface StatusBannerProps {
  health: HealthData | null;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ health }) => {
  if (!health) return null;

  if (health.ai_provider === 'ollama') {
    return (
      <div className="mb-4 rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 via-white to-indigo-50/40 p-3 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Server className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-indigo-950">Local Ollama AI Connected: </span>
              Active model <span className="font-mono font-medium text-indigo-900 bg-indigo-100/70 px-1 rounded">{health.ollama_model || 'qwen2.5:7b'}</span> on <span className="font-mono text-slate-600">{health.ollama_base_url || 'http://localhost:11434'}</span>. Private local execution.
            </div>
          </div>
          <Link
            to="/settings"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-800 shadow-2xs hover:bg-indigo-50"
          >
            <Sparkles className="h-3 w-3 text-indigo-600" />
            <span>AI Settings</span>
          </Link>
        </div>
      </div>
    );
  }

  if (health.demo_mode) {
    return (
      <div className="mb-4 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/50 p-3.5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-amber-900">Demo Generator Active: </span>
              TubePilot AI is running in offline demo mode with simulated responses. Connect to your local Ollama server in Settings for real AI generation.
            </div>
          </div>
          <Link
            to="/settings"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-xs hover:bg-amber-50"
          >
            <Key className="h-3.5 w-3.5 text-amber-600" />
            <span>Configure AI Provider</span>
          </Link>
        </div>
      </div>
    );
  }

  return null;
};
