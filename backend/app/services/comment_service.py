import datetime
import logging
from typing import Dict, Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models.models import Account, CommentRecord, VideoQueueItem
from app.services.youtube_service import youtube_service
from app.utils.security import decrypt_token, check_and_record_duplicate_attempt

logger = logging.getLogger(__name__)

class CommentService:
    def create_draft_record(
        self,
        db: Session,
        video_id: str,
        video_url: str,
        video_title: str,
        comment_text: str,
        user_prompt: str,
        analysis_sources: str = "metadata_only",
        channel_title: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        account_slot: Optional[int] = None
    ) -> CommentRecord:
        """Saves a generated comment draft into database history."""
        rec = CommentRecord(
            video_id=video_id,
            video_url=video_url,
            video_title=video_title,
            channel_title=channel_title,
            thumbnail_url=thumbnail_url,
            comment_text=comment_text,
            user_prompt=user_prompt,
            analysis_sources=analysis_sources,
            account_slot=account_slot,
            publication_status="Draft",
            created_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        return rec

    async def publish_approved_comment(
        self,
        db: Session,
        comment_id: Optional[int],
        video_id: str,
        comment_text: str,
        account_slot: int,
        explicit_approval: bool,
        video_url: Optional[str] = None,
        video_title: Optional[str] = None
    ) -> Dict:
        """
        Executes publication workflow:
        1. Checks explicit approval requirement.
        2. Checks for accidental duplicate submission.
        3. Retrieves and validates target Google account.
        4. Calls YouTube Data API or reports Demo Mode status.
        5. Preserves draft and logs outcome.
        """
        # 1. Explicit Approval Check
        if not explicit_approval:
            return {
                "success": False,
                "publication_status": "Failed",
                "error": "Explicit user approval is strictly required before publishing comments to YouTube.",
                "message": "Approval check failed.",
                "account_slot": account_slot
            }

        # 2. Duplicate submission prevention
        is_dup = check_and_record_duplicate_attempt(video_id, comment_text, cooldown_seconds=30)
        if is_dup:
            return {
                "success": False,
                "publication_status": "Failed",
                "error": "Duplicate submission prevented: An identical comment was submitted for this video in the last 30 seconds.",
                "message": "Duplicate submission rejected.",
                "account_slot": account_slot
            }

        # 3. Retrieve target account
        account = db.query(Account).filter(Account.slot == account_slot).first()
        if not account or not account.is_connected:
            return {
                "success": False,
                "publication_status": "Failed",
                "error": f"Account slot {account_slot} is not connected. Please authorize this account first.",
                "message": "Account not connected.",
                "account_slot": account_slot
            }

        # Locate or initialize database record
        comment_rec = None
        if comment_id:
            comment_rec = db.query(CommentRecord).filter(CommentRecord.id == comment_id).first()
        
        if not comment_rec:
            comment_rec = CommentRecord(
                video_id=video_id,
                video_url=video_url or f"https://www.youtube.com/watch?v={video_id}",
                video_title=video_title or f"YouTube Video ({video_id})",
                comment_text=comment_text,
                user_prompt="Approved manual publication",
                analysis_sources="metadata_only",
                account_slot=account_slot,
                account_email=account.email,
                account_channel_title=account.channel_title,
                publication_status="Awaiting Approval",
                created_at=datetime.datetime.now(datetime.timezone.utc)
            )
            db.add(comment_rec)
            db.commit()
            db.refresh(comment_rec)

        # 4. Check Demo Mode vs Live Account
        if account.is_demo or settings.is_demo_mode or not settings.has_google_oauth:
            # Demo Mode: Clearly explain demo status without claiming real publication!
            comment_rec.publication_status = "Failed"
            comment_rec.error_message = (
                "Demo Mode Notice: Real YouTube publication requires genuine Google OAuth 2.0 "
                "credentials configured in .env. To prevent unauthorized actions, real publication "
                "is disabled in Demo Mode."
            )
            comment_rec.account_slot = account_slot
            comment_rec.account_email = account.email
            comment_rec.account_channel_title = account.channel_title
            db.commit()

            return {
                "success": False,
                "publication_status": "Failed",
                "error": comment_rec.error_message,
                "message": "Demo mode simulated validation (live publication disabled without real OAuth credentials).",
                "account_slot": account_slot
            }

        # 5. Live YouTube Publication via Official API
        access_token = decrypt_token(account.encrypted_access_token)
        refresh_token = decrypt_token(account.encrypted_refresh_token)

        if not access_token and not refresh_token:
            comment_rec.publication_status = "Failed"
            comment_rec.error_message = "No valid OAuth tokens found for this account. Please reconnect."
            db.commit()
            return {
                "success": False,
                "publication_status": "Failed",
                "error": comment_rec.error_message,
                "message": "Missing credentials.",
                "account_slot": account_slot
            }

        api_result = await youtube_service.publish_comment(
            video_id=video_id,
            comment_text=comment_text,
            access_token=access_token or "",
            refresh_token=refresh_token
        )

        if api_result["success"]:
            comment_rec.publication_status = "Published"
            comment_rec.youtube_comment_id = api_result.get("youtube_comment_id")
            comment_rec.published_at = datetime.datetime.now(datetime.timezone.utc)
            comment_rec.account_slot = account_slot
            comment_rec.account_email = account.email
            comment_rec.account_channel_title = account.channel_title
            comment_rec.error_message = None
            account.last_used_at = datetime.datetime.now(datetime.timezone.utc)
            
            # Also update queue item status if one exists for this video
            queue_item = db.query(VideoQueueItem).filter(VideoQueueItem.video_id == video_id).first()
            if queue_item:
                queue_item.status = "Published"
            
            db.commit()

            return {
                "success": True,
                "youtube_comment_id": api_result.get("youtube_comment_id"),
                "publication_status": "Published",
                "message": f"Comment successfully published to YouTube using {account.email}!",
                "account_slot": account_slot
            }
        else:
            comment_rec.publication_status = "Failed"
            comment_rec.error_message = api_result.get("error", "Unknown YouTube API error")
            db.commit()

            return {
                "success": False,
                "publication_status": "Failed",
                "error": comment_rec.error_message,
                "message": "Publication to YouTube failed.",
                "account_slot": account_slot
            }

comment_service = CommentService()
