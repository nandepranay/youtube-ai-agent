import base64
import hashlib
import hmac
import time
from typing import Optional
from cryptography.fernet import Fernet
from app.config import settings

def _derive_fernet_key(secret: str) -> bytes:
    """Derive a valid 32-byte base64-encoded URL-safe key from secret."""
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)

_fernet = Fernet(_derive_fernet_key(settings.APP_SECRET_KEY))

def encrypt_token(plain_token: Optional[str]) -> Optional[str]:
    """Encrypt sensitive OAuth tokens before storing at rest."""
    if not plain_token:
        return None
    return _fernet.encrypt(plain_token.encode("utf-8")).decode("utf-8")

def decrypt_token(cipher_token: Optional[str]) -> Optional[str]:
    """Decrypt sensitive OAuth tokens when authorizing backend API calls."""
    if not cipher_token:
        return None
    try:
        return _fernet.decrypt(cipher_token.encode("utf-8")).decode("utf-8")
    except Exception:
        return None

def generate_oauth_state(account_slot: int) -> str:
    """Generate a signed, timestamped state parameter for Google OAuth 2.0."""
    timestamp = str(int(time.time()))
    payload = f"{account_slot}:{timestamp}"
    signature = hmac.new(
        settings.APP_SECRET_KEY.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return f"{payload}:{signature}"

def verify_oauth_state(state: str, max_age_seconds: int = 600) -> Optional[int]:
    """Verify and parse OAuth state token. Returns slot number if valid, None if invalid or expired."""
    try:
        parts = state.split(":")
        if len(parts) != 3:
            return None
        slot_str, ts_str, signature = parts
        payload = f"{slot_str}:{ts_str}"
        expected_sig = hmac.new(
            settings.APP_SECRET_KEY.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        ts = int(ts_str)
        if time.time() - ts > max_age_seconds:
            return None  # Expired
        slot = int(slot_str)
        if 1 <= slot <= 4:
            return slot
        return None
    except Exception:
        return None

# Duplicate submission lock tracking in-memory
_recent_submissions = {}

def check_and_record_duplicate_attempt(video_id: str, comment_text: str, cooldown_seconds: int = 30) -> bool:
    """
    Checks if identical comment was submitted for the same video recently.
    Returns True if it IS a duplicate submission (i.e. blocked),
    Returns False and records the attempt if clean.
    """
    key = f"{video_id}:{hashlib.sha256(comment_text.strip().encode('utf-8')).hexdigest()}"
    now = time.time()
    last_time = _recent_submissions.get(key)
    if last_time and (now - last_time < cooldown_seconds):
        return True
    _recent_submissions[key] = now
    # Clean up old keys
    if len(_recent_submissions) > 500:
        for k in list(_recent_submissions.keys()):
            if now - _recent_submissions[k] > 300:
                del _recent_submissions[k]
    return False
