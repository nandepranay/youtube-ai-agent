import datetime
import logging
from typing import Optional
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.database.connection import get_db
from app.models.models import Account
from app.schemas.schemas import AccountDto, AccountDisconnectRequest, AccountDemoConnectRequest
from app.utils.security import encrypt_token, generate_oauth_state, verify_oauth_state

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/youtube.force-ssl"
]

@router.get("/status")
def get_auth_status(db: Session = Depends(get_db)):
    """Returns status of Google OAuth configuration and active connected accounts."""
    accounts = db.query(Account).order_by(Account.slot.asc()).all()
    accounts_by_slot = {a.slot: a for a in accounts}
    
    slots_data = []
    for s in range(1, 5):
        acc = accounts_by_slot.get(s)
        if acc and acc.is_connected:
            slots_data.append(AccountDto(
                slot=s,
                email=acc.email,
                display_name=acc.display_name,
                picture_url=acc.picture_url,
                channel_id=acc.channel_id,
                channel_title=acc.channel_title,
                is_connected=True,
                is_demo=acc.is_demo,
                connected_at=acc.connected_at.isoformat() if acc.connected_at else None,
                last_used_at=acc.last_used_at.isoformat() if acc.last_used_at else None
            ))
        else:
            slots_data.append(AccountDto(
                slot=s,
                is_connected=False,
                is_demo=False
            ))

    return {
        "google_oauth_configured": settings.has_google_oauth,
        "demo_mode": settings.is_demo_mode,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "accounts": slots_data
    }

@router.post("/google/start")
def start_google_auth(slot: int = Query(..., ge=1, le=4)):
    """
    Initiates Google OAuth 2.0 authorization for a specific account slot (1 to 4).
    Validates slot and generates signed CSRF state.
    """
    if not settings.has_google_oauth:
        raise HTTPException(
            status_code=400,
            detail=(
                "Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) "
                "are not configured in .env. You can connect a Demo Account to test the interface, "
                "or configure real Google Cloud OAuth credentials following the instructions."
            )
        )

    state = generate_oauth_state(account_slot=slot)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",  # Ensures refresh token is provided
        "state": state
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return {
        "authorization_url": auth_url,
        "slot": slot,
        "state": state
    }

@router.get("/google/callback")
async def google_auth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Google OAuth 2.0 Callback handler:
    1. Validates secure state token.
    2. Exchanges authorization code for tokens.
    3. Retrieves user profile and YouTube channel details.
    4. Encrypts tokens and persists account record for the specified slot.
    """
    frontend_redirect_base = f"{settings.FRONTEND_URL}/accounts"

    if error:
        logger.warning(f"Google OAuth returned error: {error}")
        return RedirectResponse(url=f"{frontend_redirect_base}?error={error}")

    if not state or not code:
        return RedirectResponse(url=f"{frontend_redirect_base}?error=missing_code_or_state")

    slot = verify_oauth_state(state)
    if not slot:
        logger.warning(f"Invalid or expired OAuth state received: {state}")
        return RedirectResponse(url=f"{frontend_redirect_base}?error=invalid_or_expired_state")

    # Exchange code for tokens
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code"
                }
            )
            if token_resp.status_code != 200:
                logger.error(f"Failed to exchange token: {token_resp.text}")
                return RedirectResponse(url=f"{frontend_redirect_base}?error=token_exchange_failed")

            tokens = token_resp.json()
            access_token = tokens.get("access_token")
            refresh_token = tokens.get("refresh_token")
            expires_in = tokens.get("expires_in", 3600)
            token_expiry = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=expires_in)

            # Fetch userinfo
            userinfo_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            profile = userinfo_resp.json() if userinfo_resp.status_code == 200 else {}
            email = profile.get("email", f"user{slot}@example.com")
            display_name = profile.get("name", f"Account {slot}")
            picture = profile.get("picture")
            google_id = profile.get("sub")

            # Fetch YouTube Channel Info
            channel_id = None
            channel_title = None
            try:
                yt_resp = await client.get(
                    YOUTUBE_CHANNELS_URL,
                    params={"part": "snippet", "mine": "true"},
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if yt_resp.status_code == 200:
                    yt_data = yt_resp.json()
                    items = yt_data.get("items", [])
                    if items:
                        channel_id = items[0].get("id")
                        channel_title = items[0].get("snippet", {}).get("title")
            except Exception as e:
                logger.info(f"Could not retrieve channel title: {e}")

            # Store in database
            account = db.query(Account).filter(Account.slot == slot).first()
            if not account:
                account = Account(slot=slot)
                db.add(account)

            account.email = email
            account.display_name = display_name
            account.picture_url = picture
            account.google_id = google_id
            account.channel_id = channel_id
            account.channel_title = channel_title or display_name
            account.encrypted_access_token = encrypt_token(access_token)
            if refresh_token:
                account.encrypted_refresh_token = encrypt_token(refresh_token)
            account.token_expiry = token_expiry
            account.is_connected = True
            account.is_demo = False
            account.connected_at = datetime.datetime.now(datetime.timezone.utc)
            db.commit()

            return RedirectResponse(url=f"{frontend_redirect_base}?connected={slot}")

    except Exception as e:
        logger.error(f"OAuth Callback exception: {e}")
        return RedirectResponse(url=f"{frontend_redirect_base}?error=oauth_internal_error")

@router.post("/google/disconnect")
def disconnect_account(req: AccountDisconnectRequest, db: Session = Depends(get_db)):
    """Disconnects and revokes authorization record for a specific account slot."""
    account = db.query(Account).filter(Account.slot == req.slot).first()
    if not account:
        raise HTTPException(status_code=404, detail=f"No account found in slot {req.slot}")

    account.is_connected = False
    account.encrypted_access_token = None
    account.encrypted_refresh_token = None
    account.token_expiry = None
    db.commit()

    return {"success": True, "message": f"Account in slot {req.slot} disconnected successfully."}

@router.post("/google/demo-connect")
def connect_demo_account(req: AccountDemoConnectRequest, db: Session = Depends(get_db)):
    """
    Connects a simulated Demo Account for local testing when real Google credentials
    are not yet configured. Accurately tagged with is_demo=True.
    """
    slot = req.slot
    account = db.query(Account).filter(Account.slot == slot).first()
    if not account:
        account = Account(slot=slot)
        db.add(account)

    demo_names = {
        1: ("Demo Creator Tech", "Tech Reviews & Insights", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop"),
        2: ("Demo Art Studio", "Creative Studio Hub", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"),
        3: ("Demo Hindi Vlogger", "Desi Explorer Vlogs", "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop"),
        4: ("Demo Gaming Central", "Pro Gameplay Highlights", "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop"),
    }

    def_name, def_channel, def_pic = demo_names.get(slot, (f"Demo Account {slot}", f"Demo Channel {slot}", None))

    account.email = f"demo.slot{slot}@tubepilot.local"
    account.display_name = req.display_name or def_name
    account.channel_title = req.channel_title or def_channel
    account.channel_id = f"UC_DEMO_CHANNEL_SLOT_{slot}"
    account.picture_url = def_pic
    account.encrypted_access_token = encrypt_token(f"demo_access_token_slot_{slot}")
    account.encrypted_refresh_token = encrypt_token(f"demo_refresh_token_slot_{slot}")
    account.token_expiry = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)
    account.is_connected = True
    account.is_demo = True
    account.connected_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()

    return {
        "success": True,
        "message": f"Connected Demo Account in slot {slot} (Demo Mode).",
        "slot": slot
    }
