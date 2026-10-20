import os
import secrets
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    AI_PROVIDER: str = "ollama"  # ollama | openai | demo
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"

    OPENAI_API_KEY: Optional[str] = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    YOUTUBE_API_KEY: Optional[str] = ""
    GOOGLE_CLIENT_ID: Optional[str] = ""
    GOOGLE_CLIENT_SECRET: Optional[str] = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    APP_SECRET_KEY: str = "tubepilot_secure_encryption_key_32bytes_sample!"
    DATABASE_URL: str = "sqlite:///./tubepilot.db"
    FRONTEND_URL: str = "http://localhost:5173"
    DEMO_MODE: bool = False

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def has_ollama(self) -> bool:
        return bool(self.OLLAMA_BASE_URL and len(self.OLLAMA_BASE_URL.strip()) > 5)

    @property
    def has_openai(self) -> bool:
        return bool(self.OPENAI_API_KEY and len(self.OPENAI_API_KEY.strip()) > 10)

    @property
    def has_youtube(self) -> bool:
        return bool(self.YOUTUBE_API_KEY and len(self.YOUTUBE_API_KEY.strip()) > 10)

    @property
    def has_google_oauth(self) -> bool:
        return bool(
            self.GOOGLE_CLIENT_ID and len(self.GOOGLE_CLIENT_ID.strip()) > 5 and
            self.GOOGLE_CLIENT_SECRET and len(self.GOOGLE_CLIENT_SECRET.strip()) > 5
        )

    @property
    def is_demo_mode(self) -> bool:
        # If AI_PROVIDER is explicitly demo
        if self.AI_PROVIDER.lower() == "demo":
            return True
        # If AI_PROVIDER is ollama, it is NOT demo mode when ollama is configured
        if self.AI_PROVIDER.lower() == "ollama":
            return False
        # If OpenAI is selected but no key is present, fallback to demo mode
        if self.AI_PROVIDER.lower() == "openai" and not self.has_openai:
            return True
        return self.DEMO_MODE

settings = Settings()

