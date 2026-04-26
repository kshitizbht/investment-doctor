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
    compute_agi_extended,
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
    realized_gains,
    standard_deduction,
    state_bracket_pct,
    state_std_deduction,
    _ltcg_rate_fs,
)

router = APIRouter()


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


class RSUGrantInput(BaseModel):
    ticker: str = "RSU"
    grant_type: str = "RSU"
    shares_vested_ytd: int = 0
    fmv_at_vest: float = 0.0
    shares_sold_at_vest: int = 0
    current_price: float = 0.0
    next_vest_date: Optional[str] = None
    next_vest_shares: int = 0


class SimulateRequest(BaseModel):
    filing_status: str = "single"
    state: str = "CA"
    wages: int
    federal_tax_withheld: int = 0
    state_tax_withheld: int = 0
    # Additional income
    bonus: int = 0
    other_income: int = 0
    qualified_dividends: int = 0
    # Pre-tax deductions
    k401_contribution: int = 0
    hsa_contribution: int = 0
    ira_contribution: int = 0
    # Deductions
    capital_loss_carryforward: int = 0
    charitable_donations: int = 0
    property_tax_paid: int = 0
    # Prior year (for safe harbor)
    prior_year_agi: int = 0
    # Equity & positions
    rsu_grants: List[RSUGrantInput] = []
    positions: List[PositionInput] = []
    transactions: List[TransactionInput] = []
    real_estate_list: List[RealEstateInput] = []


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

        for re in req.real_estate_list:
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

        # ── Base data from DB ────────────────────────────────────────────────
        gains = realized_gains(uid, db)
        harvest = harvesting_opportunities(uid, db)
        alerts = holding_period_alerts(uid, db)
        breakdown = asset_breakdown(uid, db)
        nw = compute_net_worth(uid, db)

        re_rows = db.query(RealEstate).filter_by(user_id=uid).all()
        total_rental = sum(int(re.annual_rental_income) for re in re_rows)
        total_mortgage_interest = sum(int(re.mortgage_interest_paid) for re in re_rows)

        # ── Extended AGI ─────────────────────────────────────────────────────
        agi = compute_agi_extended(
            wages=round_up_to_100(req.wages),
            net_gains=gains["net_realized"],
            rental=total_rental,
            bonus=req.bonus,
            other_income=req.other_income,
            k401=req.k401_contribution,
            hsa=req.hsa_contribution,
            ira=req.ira_contribution,
            capital_loss_carryforward=req.capital_loss_carryforward,
        )

        # ── Standard vs itemized deduction ───────────────────────────────────
        deduction_info = compute_deduction_optimizer(
            filing_status=req.filing_status,
            mortgage_interest=total_mortgage_interest,
            property_tax=req.property_tax_paid,
            charitable=req.charitable_donations,
        )
        deduction_amount = deduction_info["deduction_amount"]

        # ── Federal tax (bracket accumulation + LTCG stacking) ───────────────
        taxable_income = max(0, agi - deduction_amount)
        ltcg_eligible = gains["long_term_realized"] + req.qualified_dividends
        federal_tax = federal_tax_with_ltcg(taxable_income, ltcg_eligible, req.filing_status)

        # ── State tax ────────────────────────────────────────────────────────
        s_bracket = state_bracket_pct(req.state)
        state_taxable = max(0, agi - state_std_deduction(req.state))
        state_tax = int(state_taxable * (s_bracket / 100.0))

        # ── NIIT & Medicare surtax ───────────────────────────────────────────
        net_investment_income = gains["short_term_realized"] + gains["long_term_realized"] + total_rental + req.qualified_dividends
        niit = compute_niit(net_investment_income, agi, req.filing_status)
        total_wages = round_up_to_100(req.wages) + req.bonus
        medicare_surtax = compute_medicare_surtax(total_wages, req.filing_status)

        # ── Marginal rate stack ───────────────────────────────────────────────
        rate_stack = marginal_rate_stack(agi, total_wages, net_investment_income, req.filing_status, req.state)

        # ── RSU analysis ─────────────────────────────────────────────────────
        rsu_grants_list = [g.model_dump() for g in req.rsu_grants]
        equity = compute_rsu_analysis(rsu_grants_list, rate_stack["federal_pct"] / 100.0)

        # ── Retirement optimizer ─────────────────────────────────────────────
        combined_rate = (rate_stack["federal_pct"] + rate_stack["state_pct"]) / 100.0
        retirement = compute_retirement_optimizer(
            req.k401_contribution, req.hsa_contribution, req.ira_contribution, combined_rate
        )

        # ── Income character ─────────────────────────────────────────────────
        ltcg_rate_val = _ltcg_rate_fs(agi, req.filing_status)
        income_char = compute_income_character(
            wages=round_up_to_100(req.wages),
            bonus=req.bonus,
            rsu_income=equity["total_vested_income"],
            stcg=gains["short_term_realized"],
            ltcg=gains["long_term_realized"],
            qualified_dividends=req.qualified_dividends,
            rental=total_rental,
            ordinary_rate=rate_stack["total_ordinary_pct"] / 100.0,
            ltcg_rate_val=ltcg_rate_val,
        )

        # ── Tax balance ───────────────────────────────────────────────────────
        tax_balance = compute_tax_balance(
            federal_tax, state_tax, niit, medicare_surtax,
            req.federal_tax_withheld, req.state_tax_withheld,
        )

        # Keep legacy bracket field for existing cards
        bracket = federal_bracket(agi, req.filing_status)

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
            "net_worth_history": [],
            # ── New sections ──────────────────────────────────────────────
            "marginal_rate_stack": rate_stack,
            "tax_balance": tax_balance,
            "deduction_optimizer": deduction_info,
            "equity": equity,
            "retirement": retirement,
            "income_character": income_char,
        }
    finally:
        db.close()
