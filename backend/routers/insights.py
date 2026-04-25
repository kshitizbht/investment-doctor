from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.db.models import User, W2Income
from backend.db.session import get_db
from backend.services.tax_engine import (
    asset_breakdown,
    compute_agi,
    federal_bracket,
    harvesting_opportunities,
    holding_period_alerts,
    realized_gains,
)

router = APIRouter()

_CA_INCOME_TAX_RATE = 0.093  # simplified CA marginal rate at ~$200k income


@router.get("/api/insights")
def get_insights(db: Session = Depends(get_db)):
    user = db.query(User).first()
    if user is None:
        return {"error": "no user data found"}

    uid = user.id
    w2 = db.query(W2Income).filter_by(user_id=uid).first()

    agi = compute_agi(uid, db)
    bracket = federal_bracket(agi, user.filing_status)
    marginal_rate = bracket["rate"] / 100.0

    federal_tax = int(agi * marginal_rate)
    state_tax = int(agi * _CA_INCOME_TAX_RATE)

    gains = realized_gains(uid, db)
    harvest = harvesting_opportunities(uid, db)
    alerts = holding_period_alerts(uid, db)
    breakdown = asset_breakdown(uid, db)

    return {
        "tax_snapshot": {
            "agi": agi,
            "federal_bracket_pct": bracket["rate"],
            "estimated_federal_tax": federal_tax,
            "estimated_state_tax": state_tax,
        },
        "capital_gains": {
            "short_term_realized": gains["short_term_realized"],
            "long_term_realized": gains["long_term_realized"],
            "net_realized": gains["net_realized"],
            "by_asset_type": gains["by_asset_type"],
        },
        "harvesting": harvest,
        "holding_period_alerts": alerts,
        "asset_breakdown": breakdown,
    }
