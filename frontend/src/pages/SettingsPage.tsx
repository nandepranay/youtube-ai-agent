import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Server,
  Cpu,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Zap
} from 'lucide-react';
import { HealthData, AISettings, AITestResult } from '../types';
import { api } from '../services/api';

interface SettingsPageProps {
  health: HealthData | null;
  refreshHealth?: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ health, refreshHealth, showToast }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // AI Provider State
  const [provider, setProvider] = useState<'ollama' | 'openai' | 'demo'>(
    (health?.ai_provider as 'ollama' | 'openai' | 'demo') || 'ollama'
  );
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>(
    health?.ollama_base_url || 'http://localhost:11434'
  );
  const [ollamaModel, setOllamaModel] = useState<string>(
    health?.ollama_model || 'qwen2.5:7b'
  );

  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<AITestResult | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sync state if health updates
  useEffect(() => {
    if (health) {
      if (health.ai_provider) {
        setProvider(health.ai_provider as 'ollama' | 'openai' | 'demo');
      }
      if (health.ollama_base_url) {
        setOllamaBaseUrl(health.ollama_base_url);
      }
      if (health.ollama_model) {
        setOllamaModel(health.ollama_model);
      }
    }
  }, [health]);

  // Load current AI settings from backend
  useEffect(() => {
    api.getAISettings()
      .then((settings) => {
        setProvider(settings.provider);
        setOllamaBaseUrl(settings.ollama_base_url);
        setOllamaModel(settings.ollama_model);
      })
      .catch((err) => {
        console.warn('Failed to load initial AI settings:', err);
      });
  }, []);

  const copyToClipboard = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    showToast(`Copied ${sectionName} to clipboard!`, 'success');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await api.testAIConnection({
        provider,
        base_url: provider === 'ollama' ? ollamaBaseUrl : undefined,
        model: provider === 'ollama' ? ollamaModel : undefined
      });
      setTestResult(result);
      if (result.success) {
        showToast(result.message, 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Connection test failed';
      setTestResult({
        success: false,
        provider,
        model: provider === 'ollama' ? ollamaModel : 'default',
        message: errorMsg
      });
      showToast(errorMsg, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await api.updateAISettings({
        provider,
        ollama_base_url: ollamaBaseUrl,
        ollama_model: ollamaModel
      });
      showToast(res.message || 'AI settings saved!', 'success');
      if (refreshHealth) {
        refreshHealth();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save AI settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const sampleEnv = `# TubePilot AI - Environment Configuration
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b

# Optional: Cloud OpenAI fallback
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# YouTube Data API & Google OAuth credentials
YOUTUBE_API_KEY=your_youtube_data_api_v3_key
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# Security & Application Settings
APP_SECRET_KEY=tubepilot_super_secret_dev_key_32chars_min!!
DATABASE_URL=sqlite:///./tubepilot.db
FRONTEND_URL=http://localhost:5173
DEMO_MODE=false`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Application Settings & AI Engine</h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure local Ollama AI or cloud providers, test live connections, and monitor credential status.
        </p>
      </div>

      {/* Integration Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Active AI Provider Status */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">AI Engine</span>
            {health?.ai_provider === 'ollama' && health?.ollama_configured ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : health?.openai_configured ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <p className="text-xs font-medium text-slate-900">
            {health?.ai_provider === 'ollama'
              ? `Ollama (${health.ollama_model || 'qwen2.5:7b'})`
              : health?.openai_configured
              ? 'OpenAI (Cloud)'
              : 'Demo Generator'}
          </p>
          <p className="text-[11px] text-slate-400">
            {health?.ai_provider === 'ollama'
              ? 'Local LLM on Windows'
              : health?.openai_configured
              ? 'gpt-4o-mini connected'
              : 'Simulated responses'}
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
            {health?.youtube_configured ? 'Active (Data API Key)' : 'oEmbed + Captions'}
          </p>
          <p className="text-[11px] text-slate-400">
            {health?.youtube_configured
              ? 'Official quota metadata active'
              : 'Direct transcript extraction active'}
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

        {/* Operating Mode Status */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Publishing Mode</span>
            <span
              className={`h-2 w-2 rounded-full ${
                health?.demo_mode ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </div>
          <p className="text-xs font-medium text-slate-900">
            {health?.demo_mode ? 'Protected / Safe Mode' : 'Live YouTube'}
          </p>
          <p className="text-[11px] text-slate-400">
            {health?.demo_mode ? 'Approvals required before posting' : 'Direct API publishing'}
          </p>
        </div>
      </div>

      {/* AI Provider Configuration Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-2xs">
              <Cpu className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">AI Provider & Model Settings</h3>
              <p className="text-xs text-slate-500">
                Connect TubePilot AI to your local Ollama server or cloud models.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition shadow-2xs"
            >
              {isTesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
              ) : (
                <Zap className="h-3.5 w-3.5 text-indigo-600" />
              )}
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-xs"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>

        {/* Provider Selector Radio Tabs */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">Choose AI Provider</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Ollama Option */}
            <div
              onClick={() => setProvider('ollama')}
              className={`cursor-pointer rounded-xl border p-3.5 transition ${
                provider === 'ollama'
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-900">Ollama (Local AI)</span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Runs 100% offline and locally on your machine at <code className="font-mono text-slate-700">http://localhost:11434</code>. Free and private.
              </p>
            </div>

            {/* OpenAI Option */}
            <div
              onClick={() => setProvider('openai')}
              className={`cursor-pointer rounded-xl border p-3.5 transition ${
                provider === 'openai'
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-900">OpenAI API (Cloud)</span>
                </div>
                <span className="text-[10px] text-slate-400">Cloud API</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Connects to OpenAI's <code className="font-mono text-slate-700">gpt-4o-mini</code> or <code className="font-mono text-slate-700">gpt-4o</code> using your API key.
              </p>
            </div>

            {/* Demo Mode Option */}
            <div
              onClick={() => setProvider('demo')}
              className={`cursor-pointer rounded-xl border p-3.5 transition ${
                provider === 'demo'
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-semibold text-slate-900">Demo Generator</span>
                </div>
                <span className="text-[10px] text-amber-600 font-medium">Offline Preview</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Generates multilingual template responses for testing without requiring a live model or API key.
              </p>
            </div>
          </div>
        </div>

        {/* Ollama-specific Configuration Form */}
        {provider === 'ollama' && (
          <div className="rounded-xl border border-indigo-100 bg-slate-50/80 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-indigo-600" />
                <span>Ollama Server Parameters</span>
              </h4>
              <span className="text-[11px] text-slate-400">Endpoint: POST /api/chat</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ollama Base URL
                </label>
                <input
                  type="text"
                  value={ollamaBaseUrl}
                  onChange={(e) => setOllamaBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Default: http://localhost:11434
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Model Tag
                </label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="qwen2.5:7b"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden font-mono font-medium"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Configured model: qwen2.5:7b
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Test Result Display Box */}
        {testResult && (
          <div
            className={`rounded-xl border p-4 text-xs transition ${
              testResult.success
                ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                : 'border-rose-200 bg-rose-50/60 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <div className="font-semibold flex items-center gap-2">
                  <span>{testResult.success ? 'Connection Successful' : 'Connection Failed'}</span>
                  {testResult.latency_ms && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-emerald-800">
                      {testResult.latency_ms} ms
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed">{testResult.message}</p>
                {testResult.models_available && testResult.models_available.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-emerald-200/60">
                    <span className="text-[10px] font-semibold text-emerald-800 block mb-1">
                      Detected Local Ollama Models:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {testResult.models_available.map((m) => (
                        <span
                          key={m}
                          onClick={() => setOllamaModel(m)}
                          className={`cursor-pointer rounded-md border px-2 py-0.5 text-[10px] font-mono transition ${
                            ollamaModel === m
                              ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                              : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          }`}
                          title="Click to select this model"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
          The backend reads configuration directly from <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">backend/.env</code>. Ollama model <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">qwen2.5:7b</code> is configured as the active primary AI engine.
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
