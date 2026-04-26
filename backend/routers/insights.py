from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.db.models import User, W2Income, RealEstate
from backend.db.session import get_db
from backend.services.tax_engine import (
    asset_breakdown,
    compute_agi,
    compute_deduction_optimizer,
    compute_income_character,
    compute_medicare_surtax,
    compute_net_worth,
    compute_niit,
    compute_retirement_optimizer,
    compute_rsu_analysis,
    compute_tax_balance,
    federal_bracket,
    federal_tax_with_ltcg,
    harvesting_opportunities,
    holding_period_alerts,
    marginal_rate_stack,
    net_worth_history,
    realized_gains,
    standard_deduction,
    state_bracket_pct,
    state_std_deduction,
    _ltcg_rate_fs,
)

router = APIRouter()

# Demo defaults for fields not yet stored in the seed DB
_DEMO_RSU_GRANTS = [
    {
        "ticker": "META",
        "grant_type": "RSU",
        "shares_vested_ytd": 100,
        "fmv_at_vest": 400.0,
        "shares_sold_at_vest": 22,
        "current_price": 480.0,
        "next_vest_date": "2026-09-01",
        "next_vest_shares": 50,
    }
]
_DEMO_BONUS = 0
_DEMO_K401 = 11500
_DEMO_HSA = 0
_DEMO_IRA = 0
_DEMO_CHARITABLE = 2000
_DEMO_PROPERTY_TAX = 7000


@router.get("/api/insights")
def get_insights(db: Session = Depends(get_db)):
    user = db.query(User).first()
    if user is None:
        return {"error": "no user data found"}

    uid = user.id
    w2 = db.query(W2Income).filter_by(user_id=uid).first()
    wages = int(w2.wages) if w2 else 0
    federal_withheld = int(w2.federal_tax_withheld) if w2 else 0
    state_withheld = int(w2.state_tax_withheld) if w2 else 0

    re_rows = db.query(RealEstate).filter_by(user_id=uid).all()
    total_rental = sum(int(re.annual_rental_income) for re in re_rows)
    total_mortgage = sum(int(re.mortgage_interest_paid) for re in re_rows)

    # Base AGI (unchanged — test checks compute_agi(uid, db) == 219600)
    agi = compute_agi(uid, db)
    filing_status = user.filing_status
    state = user.state

    # ── Accurate tax computation ──────────────────────────────────────────────
    deduction_info = compute_deduction_optimizer(
        filing_status=filing_status,
        mortgage_interest=total_mortgage,
        property_tax=_DEMO_PROPERTY_TAX,
        charitable=_DEMO_CHARITABLE,
    )
    deduction_amount = deduction_info["deduction_amount"]

    gains = realized_gains(uid, db)
    ltcg_eligible = gains["long_term_realized"]

    taxable_income = max(0, agi - deduction_amount)
    federal_tax = federal_tax_with_ltcg(taxable_income, ltcg_eligible, filing_status)

    s_bracket = state_bracket_pct(state)
    state_taxable = max(0, agi - state_std_deduction(state))
    state_tax = int(state_taxable * (s_bracket / 100.0))

    net_investment_income = gains["short_term_realized"] + gains["long_term_realized"] + total_rental
    niit = compute_niit(net_investment_income, agi, filing_status)
    medicare_surtax = compute_medicare_surtax(wages + _DEMO_BONUS, filing_status)

    # ── Additional computations ───────────────────────────────────────────────
    rate_stack = marginal_rate_stack(agi, wages, net_investment_income, filing_status, state)

    equity = compute_rsu_analysis(_DEMO_RSU_GRANTS, rate_stack["federal_pct"] / 100.0)

    combined_rate = (rate_stack["federal_pct"] + rate_stack["state_pct"]) / 100.0
    retirement = compute_retirement_optimizer(_DEMO_K401, _DEMO_HSA, _DEMO_IRA, combined_rate)

    ltcg_rate_val = _ltcg_rate_fs(agi, filing_status)
    income_char = compute_income_character(
        wages=wages,
        bonus=_DEMO_BONUS,
        rsu_income=equity["total_vested_income"],
        stcg=gains["short_term_realized"],
        ltcg=gains["long_term_realized"],
        qualified_dividends=0,
        rental=total_rental,
        ordinary_rate=rate_stack["total_ordinary_pct"] / 100.0,
        ltcg_rate_val=ltcg_rate_val,
    )

    tax_balance = compute_tax_balance(
        federal_tax, state_tax, niit, medicare_surtax,
        federal_withheld, state_withheld,
    )

    # Legacy bracket for existing cards
    bracket = federal_bracket(agi, filing_status)

    harvest = harvesting_opportunities(uid, db)
    alerts = holding_period_alerts(uid, db)
    breakdown = asset_breakdown(uid, db)
    nw = compute_net_worth(uid, db)
    history = net_worth_history(uid, db)

    return {
        "tax_snapshot": {
            "agi": agi,
            "federal_bracket_pct": bracket["rate"],
            "state_bracket_pct": s_bracket,
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
        "net_worth": nw,
        "net_worth_history": history,
        # ── New sections ──────────────────────────────────────────────────────
        "marginal_rate_stack": rate_stack,
        "tax_balance": tax_balance,
        "deduction_optimizer": deduction_info,
        "equity": equity,
        "retirement": retirement,
        "income_character": income_char,
    }
