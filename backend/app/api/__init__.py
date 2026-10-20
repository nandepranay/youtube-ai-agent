from fastapi import APIRouter
from app.api.chat import router as chat_router
from app.api.video import router as video_router
from app.api.comments import router as comments_router
from app.api.accounts import router as accounts_router
from app.api.auth import router as auth_router
from app.api.queue import router as queue_router

api_router = APIRouter()
api_router.include_router(chat_router)
api_router.include_router(video_router)
api_router.include_router(comments_router)
api_router.include_router(accounts_router)
api_router.include_router(auth_router)
api_router.include_router(queue_router)

__all__ = ["api_router"]
