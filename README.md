# TubePilot AI 🚀
> **Your AI Assistant for YouTube Comments**

TubePilot AI is a modern, full-stack AI-powered personal assistant designed to analyze YouTube video content, extract transcripts and metadata, and generate natural, contextual comments in **English, Hindi, and Hinglish** with multi-account Google/YouTube publishing management.

---

## 🌟 Key Features

- **Conversational AI Interface**: Enter custom instructions in English, Hindi, or Hinglish (e.g. *"Appreciate the artwork in under 30 words"*, *"Translate into Hindi"*, *"Make it shorter with a respectful emoji"*).
- **Truthful Content Analysis**: Accurately reports whether comments were generated using **Transcript & Metadata** or **Metadata Only**. Never fabricates visual scenes.
- **Multi-Account Google OAuth 2.0**: Connect and manage up to **4 independent Google/YouTube accounts** with secure token encryption at rest (Fernet AES-256).
- **Explicit Approval Workflow**: Human-in-the-loop approval modal before any publication to YouTube. Never publishes merely from an AI prompt.
- **Deduplication & Safety Safeguards**: Automatically prevents accidental duplicate submissions and rate spikes.
- **Video Queue**: Organize batches of YouTube videos, monitor analysis status, and generate comments individually.
- **Comment History**: Searchable audit log with status filtering (Published, Draft, Awaiting Approval, Failed) and direct video links.
- **Offline / Development Demo Mode**: Fully functional out-of-the-box even before API credentials are configured, with simulated generation and demo account slots.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS, Lucide React, React Router |
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy, Uvicorn |
| **AI** | OpenAI API (`gpt-4o-mini` / configurable) + Smart Local Fallback |
| **YouTube** | YouTube Data API v3, Google OAuth 2.0, YouTube Transcript API |
| **Security** | Fernet AES-256 Encryption at rest, HMAC State Validation, CORS |
| **Database** | SQLite for local development (modular for PostgreSQL) |
| **Testing** | Pytest, FastAPI TestClient |

---

## 📋 System Requirements

- **Operating System**: Windows 10 or Windows 11 (PowerShell)
- **Python**: 3.11, 3.12, or 3.13 (`python --version`)
- **Node.js**: v18+ or v20+ (`node --version`)
- **npm**: v9+ (`npm --version`)

---

## ⚡ Quick Start (Windows PowerShell)

Open PowerShell in the project directory (`c:\Users\prana\Desktop\youtube-ai-agent`):

### 1. Backend Setup

```powershell
# Navigate to the backend folder
cd backend

# Create a Python virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r requirements.txt

# Start the FastAPI backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend will start at:
- **API Server**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

### 2. Frontend Setup

Open a **second PowerShell terminal**:

```powershell
# Navigate to the frontend folder
cd frontend

# Install npm dependencies
npm install

# Start the Vite development server
npm run dev
```

The frontend will start at:
- **Web App**: [http://127.0.0.1:5174](http://127.0.0.1:5174) (or [http://127.0.0.1:5173](http://127.0.0.1:5173))

---

## ⚙️ Environment Variables (.env)

The application starts in **Demo / Dev Mode** automatically when API keys are not supplied.

To enable live OpenAI generation and real YouTube Data API publishing, create `backend/.env`:

```ini
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# YouTube Data API Key
YOUTUBE_API_KEY=your_youtube_data_api_v3_key

# Google OAuth 2.0 Credentials (for up to 4 accounts)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# Security & App Secrets
APP_SECRET_KEY=tubepilot_super_secret_dev_key_32chars_min!!
DATABASE_URL=sqlite:///./tubepilot.db
FRONTEND_URL=http://localhost:5173
DEMO_MODE=false
```

---

## 🔑 Google Cloud & YouTube OAuth 2.0 Setup

Follow these steps to connect real Google / YouTube accounts:

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/).
   - Click **Select a project** &gt; **New Project** &gt; Name it `TubePilot AI`.

2. **Enable YouTube Data API v3**:
   - Go to **APIs & Services** &gt; **Library**.
   - Search for **YouTube Data API v3** and click **Enable**.

3. **Create API Key** *(Optional for metadata quota)*:
   - Go to **APIs & Services** &gt; **Credentials** &gt; **Create Credentials** &gt; **API Key**.
   - Copy key to `YOUTUBE_API_KEY` in `backend/.env`.

4. **Configure OAuth Consent Screen**:
   - Go to **APIs & Services** &gt; **OAuth consent screen**.
   - Select **External**, fill in App Name (`TubePilot AI`) and your email.
   - Add the scope: `https://www.googleapis.com/auth/youtube.force-ssl`.
   - Add your Google account email under **Test users**.

5. **Create OAuth Client ID**:
   - Go to **Credentials** &gt; **Create Credentials** &gt; **OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized redirect URIs**, add:
     ```
     http://localhost:8000/api/auth/google/callback
     ```
   - Copy **Client ID** and **Client Secret** into `backend/.env`.

6. **Authorize Accounts**:
   - In TubePilot AI, navigate to **Connected Accounts**.
   - Click **Connect Google** on any of Slots 1 to 4.
   - You can connect up to 4 different accounts.

---

## 🧪 Running Automated Tests

Run the backend Pytest test suite:

```powershell
cd backend
.\venv\Scripts\pytest -v tests/test_all_requirements.py
```

All 12 requirements are validated in automated tests:
1. `test_youtube_url_validation_and_id_extraction`
2. `test_extract_all_urls_from_text`
3. `test_token_encryption_and_decryption`
4. `test_oauth_state_generation_and_validation`
5. `test_health_endpoint_and_missing_credentials`
6. `test_ai_comment_generation`
7. `test_publishing_requires_explicit_approval`
8. `test_duplicate_submission_protection`
9. `test_publishing_with_unconnected_account`
10. `test_video_queue_lifecycle`
11. `test_comment_history_and_filtering`
12. `test_youtube_api_failure_handling`

---

## 🔧 Troubleshooting Common Errors

### 1. PowerShell Script Execution Policy
If PowerShell errors with `Execution_Policies`:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. Port In Use (8000 or 5173)
To find and terminate a process locking a port:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
```

### 3. YouTube Comments Disabled
If publishing fails with `Comments are disabled on this YouTube video`, the video creator has turned off comments on YouTube. TubePilot AI safely preserves your drafted comment.

### 4. Token Revocation or Expiry
If you encounter `invalid_grant` or revoked authorization, click **Reconnect** next to the affected account slot in the **Connected Accounts** dashboard.

---

## 🛡️ Security & Privacy Notice

- **No Passwords Stored**: Authentication strictly uses OAuth 2.0 access & refresh tokens.
- **Encryption at Rest**: OAuth tokens are encrypted using AES-256 Fernet keys before database storage.
- **Frontend Isolation**: Raw OAuth tokens are never exposed to the browser.
- **Human In The Loop**: No mass commenting, automated spam loops, or bot posting. Every comment requires an explicit user approval click.
