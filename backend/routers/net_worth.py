from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.db.models import User
from backend.db.session import get_db
from backend.services.tax_engine import compute_net_worth, net_worth_history

router = APIRouter()


@router.get("/api/net-worth")
def get_net_worth(db: Session = Depends(get_db)):
    user = db.query(User).first()
    if user is None:
        return {"error": "no user data found"}

    uid = user.id
    current = compute_net_worth(uid, db)
    history = net_worth_history(uid, db)

    return {"current": current, "history": history}
