import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database.connection import init_db, get_db
from app.models.models import Account
from app.schemas.schemas import HealthResponse
from app.api import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("tubepilot")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database schema
    logger.info("Initializing TubePilot AI database...")
    init_db()
    
    # Log configuration status
    logger.info("==========================================")
    logger.info("        TubePilot AI Server Starting      ")
    logger.info("==========================================")
    logger.info(f"OpenAI API Key: {'Configured' if settings.has_openai else 'Not Set (Demo/Smart Fallback Active)'}")
    logger.info(f"OpenAI Model: {settings.OPENAI_MODEL}")
    logger.info(f"YouTube Data API: {'Configured' if settings.has_youtube else 'Not Set (oEmbed Fallback Active)'}")
    logger.info(f"Google OAuth: {'Configured' if settings.has_google_oauth else 'Not Set (Demo Accounts Active)'}")
    logger.info(f"Demo Mode: {'ENABLED' if settings.is_demo_mode else 'DISABLED'}")
    logger.info("==========================================")
    yield
    logger.info("TubePilot AI Server shutting down.")

app = FastAPI(
    title="TubePilot AI Backend",
    description="Personal AI Assistant for YouTube Comments with Multi-Account Management",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    settings.FRONTEND_URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router)

@app.get("/", tags=["General"])
def root():
    return {
        "app": "TubePilot AI",
        "tagline": "Your AI Assistant for YouTube Comments",
        "status": "online",
        "docs_url": "/docs",
        "health_url": "/health",
        "demo_mode": settings.is_demo_mode
    }

@app.get("/health", response_model=HealthResponse, tags=["General"])
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint providing status of service dependencies."""
    connected_count = db.query(Account).filter(Account.is_connected == True).count()
    return HealthResponse(
        status="healthy",
        demo_mode=settings.is_demo_mode,
        ai_provider=settings.AI_PROVIDER,
        ollama_configured=settings.has_ollama,
        ollama_model=settings.OLLAMA_MODEL,
        ollama_base_url=settings.OLLAMA_BASE_URL,
        openai_configured=settings.has_openai,
        youtube_configured=settings.has_youtube,
        google_oauth_configured=settings.has_google_oauth,
        connected_accounts_count=connected_count,
        app_name="TubePilot AI",
        version="1.0.0"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
