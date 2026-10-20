from fastapi import APIRouter, HTTPException
from app.config import settings
from app.schemas.schemas import (
    AITestConnectionRequest,
    AITestConnectionResponse,
    AIProviderSettingsUpdate
)
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/ai", tags=["AI Provider"])

@router.get("/settings")
def get_ai_settings():
    """Returns current AI provider settings."""
    return {
        "provider": settings.AI_PROVIDER,
        "ai_provider": settings.AI_PROVIDER,
        "ollama_base_url": settings.OLLAMA_BASE_URL,
        "ollama_model": settings.OLLAMA_MODEL,
        "openai_model": settings.OPENAI_MODEL,
        "has_openai": settings.has_openai,
        "has_ollama": settings.has_ollama,
        "is_demo_mode": settings.is_demo_mode
    }

@router.post("/settings")
def update_ai_settings(req: AIProviderSettingsUpdate):
    """Updates AI provider configuration in runtime."""
    valid_providers = ["ollama", "openai", "demo"]
    if req.provider.lower() not in valid_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid AI provider '{req.provider}'. Must be one of: {', '.join(valid_providers)}"
        )
    settings.AI_PROVIDER = req.provider.lower()
    if req.ollama_base_url:
        settings.OLLAMA_BASE_URL = req.ollama_base_url.strip()
    if req.ollama_model:
        settings.OLLAMA_MODEL = req.ollama_model.strip()
    if req.openai_model:
        settings.OPENAI_MODEL = req.openai_model.strip()

    return {
        "success": True,
        "message": f"AI Provider set to '{settings.AI_PROVIDER}' (Model: {settings.OLLAMA_MODEL if settings.AI_PROVIDER == 'ollama' else settings.OPENAI_MODEL}).",
        "provider": settings.AI_PROVIDER,
        "ai_provider": settings.AI_PROVIDER,
        "ollama_base_url": settings.OLLAMA_BASE_URL,
        "ollama_model": settings.OLLAMA_MODEL,
        "is_demo_mode": settings.is_demo_mode
    }

@router.post("/test-connection", response_model=AITestConnectionResponse)
async def test_ai_connection(req: AITestConnectionRequest = None):
    """
    Tests connection to the configured AI provider (specifically Ollama or OpenAI).
    """
    provider = (req.provider if req and req.provider else settings.AI_PROVIDER).lower()
    target_url = (req.base_url if req and req.base_url else settings.OLLAMA_BASE_URL)
    target_model = (req.model if req and req.model else settings.OLLAMA_MODEL)

    if provider == "ollama":
        res = await ai_service.test_ollama_connection(base_url=target_url, model=target_model)
        msg = res.get("message") or res.get("error", "Ollama connection failed")
        return AITestConnectionResponse(
            success=res.get("success", False),
            provider="ollama",
            model=target_model,
            base_url=target_url,
            message=msg,
            error=res.get("error"),
            latency_ms=res.get("latency_ms"),
            available_models=res.get("available_models"),
            models_available=res.get("available_models")
        )
    elif provider == "openai":
        if not settings.has_openai:
            return AITestConnectionResponse(
                success=False,
                provider="openai",
                model=settings.OPENAI_MODEL,
                error="OpenAI API Key is not set in backend/.env."
            )
        try:
            client = ai_service._get_openai_client()
            client.models.list()
            return AITestConnectionResponse(
                success=True,
                provider="openai",
                model=settings.OPENAI_MODEL,
                message=f"Connected to OpenAI API successfully with model '{settings.OPENAI_MODEL}'."
            )
        except Exception as e:
            return AITestConnectionResponse(
                success=False,
                provider="openai",
                model=settings.OPENAI_MODEL,
                error=f"OpenAI connection error: {str(e)}"
            )
    else:
        return AITestConnectionResponse(
            success=True,
            provider="demo",
            model="demo-generator",
            message="Demo Mode is ready for simulated comment generation."
        )
