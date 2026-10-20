import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  Info,
  Sparkles
} from 'lucide-react';
import { HealthData } from '../types';

interface SettingsPageProps {
  health: HealthData | null;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ health, showToast }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    showToast(`Copied ${sectionName} to clipboard!`, 'success');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const sampleEnv = `OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
YOUTUBE_API_KEY=your_youtube_data_api_v3_key
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
APP_SECRET_KEY=tubepilot_super_secret_dev_key_32chars_min!!
DATABASE_URL=sqlite:///./tubepilot.db
FRONTEND_URL=http://localhost:5173
DEMO_MODE=false`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Application Settings & Credentials</h2>
        <p className="text-xs text-slate-500 mt-1">
          Monitor your API integrations, security configuration, and Google OAuth setup status.
        </p>
      </div>

      {/* Integration Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* OpenAI Status */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">OpenAI API</span>
            {health?.openai_configured ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <p className="text-xs font-medium text-slate-900">
            {health?.openai_configured ? 'Active (Live OpenAI)' : 'Demo Generator'}
          </p>
          <p className="text-[11px] text-slate-400">
            {health?.openai_configured
              ? 'gpt-4o-mini model connected'
              : 'Smart multi-language fallback active'}
          </p>
        </div>

        {/* YouTube API Status */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">YouTube API v3</span>
            {health?.youtube_configured ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <p className="text-xs font-medium text-slate-900">
            {health?.youtube_configured ? 'Active (Data API Key)' : 'oEmbed Fallback'}
          </p>
          <p className="text-[11px] text-slate-400">
            {health?.youtube_configured
              ? 'Official quota metadata active'
              : 'oEmbed + Transcript extraction active'}
          </p>
        </div>

        {/* Google OAuth Status */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Google OAuth 2.0</span>
            {health?.google_oauth_configured ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <p className="text-xs font-medium text-slate-900">
            {health?.google_oauth_configured ? 'Configured' : 'Demo Accounts'}
          </p>
          <p className="text-[11px] text-slate-400">
            {health?.google_oauth_configured
              ? 'Client ID & Secret ready'
              : 'Local simulated accounts enabled'}
          </p>
        </div>

        {/* Demo Mode Status */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Operating Mode</span>
            <span
              className={`h-2 w-2 rounded-full ${
                health?.demo_mode ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </div>
          <p className="text-xs font-medium text-slate-900">
            {health?.demo_mode ? 'Development / Demo' : 'Live Production'}
          </p>
          <p className="text-[11px] text-slate-400">
            {health?.demo_mode ? 'Safe offline preview mode' : 'Real YouTube publishing'}
          </p>
        </div>
      </div>

      {/* Environment File Helper */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-slate-700" />
            <h3 className="text-xs font-semibold text-slate-900">Backend Environment Configuration (.env)</h3>
          </div>
          <button
            onClick={() => copyToClipboard(sampleEnv, 'Sample .env')}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition"
          >
            {copiedSection === 'Sample .env' ? (
              <Check className="h-3 w-3 text-emerald-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span>Copy Template</span>
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          To transition from Demo Mode to live OpenAI and YouTube publication, copy this configuration into your <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">backend/.env</code> file.
        </p>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200 overflow-x-auto select-all">
          <pre>{sampleEnv}</pre>
        </div>
      </div>

      {/* Google Cloud OAuth Setup Guide */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-700" />
          <h3 className="text-xs font-semibold text-slate-900">Google Cloud & YouTube API Setup Guide</h3>
        </div>

        <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 leading-relaxed pl-1">
          <li>
            Go to the{' '}
            <a
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline font-medium inline-flex items-center gap-0.5"
            >
              <span>Google Cloud Console</span>
              <ExternalLink className="h-3 w-3" />
            </a>{' '}
            and create or select a project.
          </li>
          <li>
            Navigate to <strong>APIs & Services &gt; Library</strong> and enable <strong>YouTube Data API v3</strong>.
          </li>
          <li>
            Go to <strong>APIs & Services &gt; Credentials</strong> and create an <strong>API Key</strong> (for YOUTUBE_API_KEY).
          </li>
          <li>
            Configure your <strong>OAuth Consent Screen</strong> (set User Type to External, add test users).
          </li>
          <li>
            Create an <strong>OAuth 2.0 Client ID</strong> (Application type: <em>Web application</em>).
          </li>
          <li>
            Under <strong>Authorized redirect URIs</strong>, add:
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 text-slate-800 font-mono text-xs select-all">
                http://localhost:8000/api/auth/google/callback
              </code>
              <button
                onClick={() =>
                  copyToClipboard(
                    'http://localhost:8000/api/auth/google/callback',
                    'Redirect URI'
                  )
                }
                className="rounded border border-slate-200 p-1 hover:bg-slate-50"
                title="Copy URI"
              >
                <Copy className="h-3 w-3 text-slate-500" />
              </button>
            </div>
          </li>
          <li>
            Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> into <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">backend/.env</code>.
          </li>
        </ol>
      </div>
    </div>
  );
};
