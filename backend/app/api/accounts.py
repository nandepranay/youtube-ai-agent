from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.models import Account
from app.schemas.schemas import AccountDto

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])

@router.get("", response_model=List[AccountDto])
def list_accounts(db: Session = Depends(get_db)):
    """Lists status of all 4 account slots."""
    accounts = db.query(Account).order_by(Account.slot.asc()).all()
    accounts_by_slot = {a.slot: a for a in accounts}

    result = []
    for s in range(1, 5):
        acc = accounts_by_slot.get(s)
        if acc and acc.is_connected:
            result.append(AccountDto(
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
            result.append(AccountDto(
                slot=s,
                is_connected=False,
                is_demo=False
            ))
    return result
