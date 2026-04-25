from datetime import date
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.models import Base, Position, RealEstate, Transaction, User, W2Income
from backend.services.anonymize import round_up_to_100
from backend.services.tax_engine import (
    asset_breakdown,
    compute_agi,
    federal_bracket,
    harvesting_opportunities,
    holding_period_alerts,
    realized_gains,
)

router = APIRouter()

_CA_INCOME_TAX_RATE = 0.093


class PositionInput(BaseModel):
    asset_type: str
    ticker_or_name: str
    quantity: float
    cost_basis_per_unit: float
    current_price: float
    purchase_date: str
    expiry_date: Optional[str] = None
    is_short: Optional[int] = None
    strike_price: Optional[float] = None


class TransactionInput(BaseModel):
    asset_type: str
    ticker_or_name: str
    action: str
    quantity: float
    price_per_unit: float
    total_proceeds: float
    total_cost_basis: float
    transaction_date: str


class RealEstateInput(BaseModel):
    label: str = "Rental Property"
    purchase_price: int
    purchase_date: str
    current_estimated_value: int
    annual_rental_income: int
    depreciation_taken: int = 0
    mortgage_interest_paid: int = 0


class SimulateRequest(BaseModel):
    filing_status: str = "single"
    state: str = "CA"
    wages: int
    federal_tax_withheld: int = 0
    state_tax_withheld: int = 0
    positions: List[PositionInput] = []
    transactions: List[TransactionInput] = []
    real_estate: Optional[RealEstateInput] = None


@router.post("/api/simulate")
def simulate_insights(req: SimulateRequest):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        user = User(filing_status=req.filing_status, state=req.state)
        db.add(user)
        db.flush()
        uid = user.id

        db.add(W2Income(
            user_id=uid,
            tax_year=2024,
            wages=round_up_to_100(req.wages),
            federal_tax_withheld=req.federal_tax_withheld,
            state_tax_withheld=req.state_tax_withheld,
            source_label="employer_1",
        ))

        for pos in req.positions:
            db.add(Position(
                user_id=uid,
                asset_type=pos.asset_type,
                ticker_or_name=pos.ticker_or_name,
                quantity=pos.quantity,
                cost_basis_per_unit=pos.cost_basis_per_unit,
                current_price=pos.current_price,
                purchase_date=date.fromisoformat(pos.purchase_date),
                expiry_date=date.fromisoformat(pos.expiry_date) if pos.expiry_date else None,
                is_short=bool(pos.is_short) if pos.is_short is not None else None,
                strike_price=pos.strike_price,
            ))

        for txn in req.transactions:
            db.add(Transaction(
                user_id=uid,
                asset_type=txn.asset_type,
                ticker_or_name=txn.ticker_or_name,
                action=txn.action,
                quantity=txn.quantity,
                price_per_unit=txn.price_per_unit,
                total_proceeds=txn.total_proceeds,
                total_cost_basis=txn.total_cost_basis,
                transaction_date=date.fromisoformat(txn.transaction_date),
                is_wash_sale=False,
            ))

        if req.real_estate:
            re = req.real_estate
            db.add(RealEstate(
                user_id=uid,
                label=re.label,
                purchase_price=re.purchase_price,
                purchase_date=date.fromisoformat(re.purchase_date),
                current_estimated_value=re.current_estimated_value,
                annual_rental_income=re.annual_rental_income,
                depreciation_taken=re.depreciation_taken,
                mortgage_interest_paid=re.mortgage_interest_paid,
            ))

        db.commit()

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
    finally:
        db.close()
