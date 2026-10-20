import os
import secrets
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    OPENAI_API_KEY: Optional[str] = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    YOUTUBE_API_KEY: Optional[str] = ""
    GOOGLE_CLIENT_ID: Optional[str] = ""
    GOOGLE_CLIENT_SECRET: Optional[str] = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    APP_SECRET_KEY: str = "tubepilot_secure_encryption_key_32bytes_sample!"
    DATABASE_URL: str = "sqlite:///./tubepilot.db"
    FRONTEND_URL: str = "http://localhost:5173"
    DEMO_MODE: bool = True

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

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
        # If API keys are not provided, gracefully fall back to Demo Mode
        if not self.has_openai or not self.has_youtube or not self.has_google_oauth:
            return True
        return self.DEMO_MODE

settings = Settings()
