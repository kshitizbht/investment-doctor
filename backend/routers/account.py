from datetime import date
from typing import Any, Dict, List, Optional

import pdfplumber
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.models import (
    AuthUser, Position, RSUGrant, RealEstate, Transaction, User, UserDeductions, W2Income,
)
from backend.db.session import get_db
from backend.services.auth_service import get_current_user

router = APIRouter(prefix="/api/account", tags=["account"])


# ─── Helper ───────────────────────────────────────────────────────────────────

def _get_or_create_user(auth_user: AuthUser, db: Session) -> User:
    user = db.query(User).filter(User.auth_user_id == auth_user.id).first()
    if user is None:
        user = User(auth_user_id=auth_user.id, filing_status="single", state="CA", onboarding_complete=False)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


# ─── Schemas ──────────────────────────────────────────────────────────────────

class TaxDataIn(BaseModel):
    wages: int = 0
    bonus: int = 0
    other_income: int = 0
    qualified_dividends: int = 0
    filing_status: str = "single"
    state: str = "CA"
    federal_tax_withheld: int = 0
    state_tax_withheld: int = 0
    tax_year: int = 2024
    source_label: str = "employer_1"


class TaxDataOut(TaxDataIn):
    pass


class RetirementDataIn(BaseModel):
    k401_contribution: int = 0
    hsa_contribution: int = 0
    ira_contribution: int = 0
    charitable_donations: int = 0
    property_tax_paid: int = 0
    capital_loss_carryforward: int = 0
    prior_year_agi: int = 0
    tax_year: int = 2024


class RetirementDataOut(RetirementDataIn):
    pass


class PositionIn(BaseModel):
    asset_type: str
    ticker_or_name: str
    quantity: float
    cost_basis_per_unit: float
    current_price: float
    purchase_date: str
    expiry_date: Optional[str] = None
    is_short: Optional[bool] = None
    strike_price: Optional[float] = None


class PositionOut(PositionIn):
    id: int


class TransactionIn(BaseModel):
    asset_type: str
    ticker_or_name: str
    action: str
    quantity: float
    price_per_unit: float
    total_proceeds: float
    total_cost_basis: float
    transaction_date: str
    is_wash_sale: bool = False


class TransactionOut(TransactionIn):
    id: int


class RSUGrantIn(BaseModel):
    ticker: str
    grant_type: str = "RSU"
    shares_vested_ytd: int = 0
    fmv_at_vest: float = 0.0
    current_price: float = 0.0
    shares_sold_at_vest: int = 0
    next_vest_shares: int = 0
    next_vest_date: Optional[str] = None


class RSUGrantOut(RSUGrantIn):
    id: int


class RealEstateIn(BaseModel):
    label: str = "Rental Property"
    purchase_price: int = 0
    purchase_date: str = "2020-01-01"
    current_estimated_value: int = 0
    annual_rental_income: int = 0
    depreciation_taken: int = 0
    mortgage_interest_paid: int = 0


class RealEstateOut(RealEstateIn):
    id: int


class AccountStatus(BaseModel):
    onboarding_complete: bool
    steps_complete: Dict[str, bool]


# ─── Status ───────────────────────────────────────────────────────────────────

@router.get("/status", response_model=AccountStatus)
def get_status(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    has_tax = db.query(W2Income).filter(W2Income.user_id == user.id).first() is not None
    has_retirement = db.query(UserDeductions).filter(UserDeductions.user_id == user.id).first() is not None
    has_brokerage = db.query(Position).filter(Position.user_id == user.id).first() is not None
    has_equity = db.query(RSUGrant).filter(RSUGrant.user_id == user.id).first() is not None
    has_re = db.query(RealEstate).filter(RealEstate.user_id == user.id).first() is not None
    return AccountStatus(
        onboarding_complete=bool(user.onboarding_complete),
        steps_complete={
            "tax": has_tax,
            "retirement": has_retirement,
            "brokerage": has_brokerage,
            "equity": has_equity,
            "real_estate": has_re,
        },
    )


# ─── Tax & Income ─────────────────────────────────────────────────────────────

@router.get("/data/tax", response_model=Optional[TaxDataOut])
def get_tax(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    row = db.query(W2Income).filter(W2Income.user_id == user.id).order_by(W2Income.tax_year.desc()).first()
    if row is None:
        return None
    return TaxDataOut(
        wages=row.wages,
        bonus=row.bonus,
        other_income=row.other_income,
        qualified_dividends=row.qualified_dividends,
        filing_status=user.filing_status,
        state=user.state,
        federal_tax_withheld=row.federal_tax_withheld,
        state_tax_withheld=row.state_tax_withheld,
        tax_year=row.tax_year,
        source_label=row.source_label,
    )


@router.post("/data/tax", response_model=TaxDataOut)
def save_tax(
    body: TaxDataIn,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    user.filing_status = body.filing_status
    user.state = body.state
    existing = db.query(W2Income).filter(
        W2Income.user_id == user.id, W2Income.tax_year == body.tax_year
    ).first()
    if existing:
        existing.wages = body.wages
        existing.bonus = body.bonus
        existing.other_income = body.other_income
        existing.qualified_dividends = body.qualified_dividends
        existing.federal_tax_withheld = body.federal_tax_withheld
        existing.state_tax_withheld = body.state_tax_withheld
        existing.source_label = body.source_label
    else:
        db.add(W2Income(
            user_id=user.id, tax_year=body.tax_year, wages=body.wages,
            bonus=body.bonus, other_income=body.other_income,
            qualified_dividends=body.qualified_dividends,
            federal_tax_withheld=body.federal_tax_withheld,
            state_tax_withheld=body.state_tax_withheld,
            source_label=body.source_label,
        ))
    db.commit()
    return TaxDataOut(**body.model_dump())


# ─── Retirement & Deductions ──────────────────────────────────────────────────

@router.get("/data/retirement", response_model=Optional[RetirementDataOut])
def get_retirement(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    row = db.query(UserDeductions).filter(UserDeductions.user_id == user.id).order_by(UserDeductions.tax_year.desc()).first()
    if row is None:
        return None
    return RetirementDataOut(
        k401_contribution=row.k401_contribution,
        hsa_contribution=row.hsa_contribution,
        ira_contribution=row.ira_contribution,
        charitable_donations=row.charitable_donations,
        property_tax_paid=row.property_tax_paid,
        capital_loss_carryforward=row.capital_loss_carryforward,
        prior_year_agi=row.prior_year_agi,
        tax_year=row.tax_year,
    )


@router.post("/data/retirement", response_model=RetirementDataOut)
def save_retirement(
    body: RetirementDataIn,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    existing = db.query(UserDeductions).filter(
        UserDeductions.user_id == user.id, UserDeductions.tax_year == body.tax_year
    ).first()
    if existing:
        for k, v in body.model_dump().items():
            setattr(existing, k, v)
    else:
        db.add(UserDeductions(user_id=user.id, **body.model_dump()))
    db.commit()
    return RetirementDataOut(**body.model_dump())


# ─── Positions ────────────────────────────────────────────────────────────────

@router.get("/data/positions", response_model=List[PositionOut])
def get_positions(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    rows = db.query(Position).filter(Position.user_id == user.id).all()
    return [_pos_out(r) for r in rows]


@router.post("/data/positions", response_model=List[PositionOut])
def save_positions(
    body: List[PositionIn],
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    db.query(Position).filter(Position.user_id == user.id).delete()
    results = []
    for p in body:
        row = Position(
            user_id=user.id, asset_type=p.asset_type, ticker_or_name=p.ticker_or_name,
            quantity=p.quantity, cost_basis_per_unit=p.cost_basis_per_unit,
            current_price=p.current_price,
            purchase_date=date.fromisoformat(p.purchase_date),
            expiry_date=date.fromisoformat(p.expiry_date) if p.expiry_date else None,
            is_short=p.is_short, strike_price=p.strike_price,
        )
        db.add(row)
        db.flush()
        results.append(row)
    db.commit()
    return [_pos_out(r) for r in results]


@router.put("/data/positions/{pos_id}", response_model=PositionOut)
def update_position(
    pos_id: int, body: PositionIn,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    row = db.query(Position).filter(Position.id == pos_id, Position.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Position not found")
    row.asset_type = body.asset_type
    row.ticker_or_name = body.ticker_or_name
    row.quantity = body.quantity
    row.cost_basis_per_unit = body.cost_basis_per_unit
    row.current_price = body.current_price
    row.purchase_date = date.fromisoformat(body.purchase_date)
    row.expiry_date = date.fromisoformat(body.expiry_date) if body.expiry_date else None
    row.is_short = body.is_short
    row.strike_price = body.strike_price
    db.commit()
    return _pos_out(row)


@router.delete("/data/positions/{pos_id}")
def delete_position(
    pos_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    row = db.query(Position).filter(Position.id == pos_id, Position.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Position not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


def _pos_out(r: Position) -> PositionOut:
    return PositionOut(
        id=r.id, asset_type=r.asset_type, ticker_or_name=r.ticker_or_name,
        quantity=float(r.quantity), cost_basis_per_unit=float(r.cost_basis_per_unit),
        current_price=float(r.current_price),
        purchase_date=r.purchase_date.isoformat(),
        expiry_date=r.expiry_date.isoformat() if r.expiry_date else None,
        is_short=r.is_short, strike_price=float(r.strike_price) if r.strike_price else None,
    )


# ─── Transactions ─────────────────────────────────────────────────────────────

@router.get("/data/transactions", response_model=List[TransactionOut])
def get_transactions(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    rows = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    return [_txn_out(r) for r in rows]


@router.post("/data/transactions", response_model=List[TransactionOut])
def save_transactions(
    body: List[TransactionIn],
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    db.query(Transaction).filter(Transaction.user_id == user.id).delete()
    results = []
    for t in body:
        row = Transaction(
            user_id=user.id, asset_type=t.asset_type, ticker_or_name=t.ticker_or_name,
            action=t.action, quantity=t.quantity, price_per_unit=t.price_per_unit,
            total_proceeds=t.total_proceeds, total_cost_basis=t.total_cost_basis,
            transaction_date=date.fromisoformat(t.transaction_date), is_wash_sale=t.is_wash_sale,
        )
        db.add(row)
        db.flush()
        results.append(row)
    db.commit()
    return [_txn_out(r) for r in results]


def _txn_out(r: Transaction) -> TransactionOut:
    return TransactionOut(
        id=r.id, asset_type=r.asset_type, ticker_or_name=r.ticker_or_name,
        action=r.action, quantity=float(r.quantity), price_per_unit=float(r.price_per_unit),
        total_proceeds=float(r.total_proceeds), total_cost_basis=float(r.total_cost_basis),
        transaction_date=r.transaction_date.isoformat(), is_wash_sale=bool(r.is_wash_sale),
    )


# ─── RSU Grants ───────────────────────────────────────────────────────────────

@router.get("/data/rsu", response_model=List[RSUGrantOut])
def get_rsu(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    rows = db.query(RSUGrant).filter(RSUGrant.user_id == user.id).all()
    return [_rsu_out(r) for r in rows]


@router.post("/data/rsu", response_model=List[RSUGrantOut])
def save_rsu(
    body: List[RSUGrantIn],
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    db.query(RSUGrant).filter(RSUGrant.user_id == user.id).delete()
    results = []
    for g in body:
        row = RSUGrant(
            user_id=user.id, ticker=g.ticker, grant_type=g.grant_type,
            shares_vested_ytd=g.shares_vested_ytd, fmv_at_vest=g.fmv_at_vest,
            current_price=g.current_price, shares_sold_at_vest=g.shares_sold_at_vest,
            next_vest_shares=g.next_vest_shares,
            next_vest_date=date.fromisoformat(g.next_vest_date) if g.next_vest_date else None,
        )
        db.add(row)
        db.flush()
        results.append(row)
    db.commit()
    return [_rsu_out(r) for r in results]


@router.put("/data/rsu/{rsu_id}", response_model=RSUGrantOut)
def update_rsu(
    rsu_id: int, body: RSUGrantIn,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    row = db.query(RSUGrant).filter(RSUGrant.id == rsu_id, RSUGrant.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="RSU grant not found")
    row.ticker = body.ticker
    row.grant_type = body.grant_type
    row.shares_vested_ytd = body.shares_vested_ytd
    row.fmv_at_vest = body.fmv_at_vest
    row.current_price = body.current_price
    row.shares_sold_at_vest = body.shares_sold_at_vest
    row.next_vest_shares = body.next_vest_shares
    row.next_vest_date = date.fromisoformat(body.next_vest_date) if body.next_vest_date else None
    db.commit()
    return _rsu_out(row)


@router.delete("/data/rsu/{rsu_id}")
def delete_rsu(
    rsu_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    row = db.query(RSUGrant).filter(RSUGrant.id == rsu_id, RSUGrant.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="RSU grant not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


def _rsu_out(r: RSUGrant) -> RSUGrantOut:
    return RSUGrantOut(
        id=r.id, ticker=r.ticker, grant_type=r.grant_type,
        shares_vested_ytd=r.shares_vested_ytd, fmv_at_vest=float(r.fmv_at_vest),
        current_price=float(r.current_price), shares_sold_at_vest=r.shares_sold_at_vest,
        next_vest_shares=r.next_vest_shares,
        next_vest_date=r.next_vest_date.isoformat() if r.next_vest_date else None,
    )


# ─── Real Estate ──────────────────────────────────────────────────────────────

@router.get("/data/real_estate", response_model=List[RealEstateOut])
def get_real_estate(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    rows = db.query(RealEstate).filter(RealEstate.user_id == user.id).all()
    return [_re_out(r) for r in rows]


@router.post("/data/real_estate", response_model=List[RealEstateOut])
def save_real_estate(
    body: List[RealEstateIn],
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    db.query(RealEstate).filter(RealEstate.user_id == user.id).delete()
    results = []
    for re in body:
        row = RealEstate(
            user_id=user.id, label=re.label, purchase_price=re.purchase_price,
            purchase_date=date.fromisoformat(re.purchase_date),
            current_estimated_value=re.current_estimated_value,
            annual_rental_income=re.annual_rental_income,
            depreciation_taken=re.depreciation_taken,
            mortgage_interest_paid=re.mortgage_interest_paid,
        )
        db.add(row)
        db.flush()
        results.append(row)
    db.commit()
    return [_re_out(r) for r in results]


@router.put("/data/real_estate/{re_id}", response_model=RealEstateOut)
def update_real_estate(
    re_id: int, body: RealEstateIn,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    row = db.query(RealEstate).filter(RealEstate.id == re_id, RealEstate.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Property not found")
    row.label = body.label
    row.purchase_price = body.purchase_price
    row.purchase_date = date.fromisoformat(body.purchase_date)
    row.current_estimated_value = body.current_estimated_value
    row.annual_rental_income = body.annual_rental_income
    row.depreciation_taken = body.depreciation_taken
    row.mortgage_interest_paid = body.mortgage_interest_paid
    db.commit()
    return _re_out(row)


@router.delete("/data/real_estate/{re_id}")
def delete_real_estate(
    re_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    row = db.query(RealEstate).filter(RealEstate.id == re_id, RealEstate.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Property not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


def _re_out(r: RealEstate) -> RealEstateOut:
    return RealEstateOut(
        id=r.id, label=r.label, purchase_price=r.purchase_price,
        purchase_date=r.purchase_date.isoformat(),
        current_estimated_value=r.current_estimated_value,
        annual_rental_income=r.annual_rental_income,
        depreciation_taken=r.depreciation_taken,
        mortgage_interest_paid=r.mortgage_interest_paid,
    )


# ─── Complete Onboarding ──────────────────────────────────────────────────────

@router.post("/complete-onboarding")
def complete_onboarding(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_or_create_user(current_user, db)
    user.onboarding_complete = True
    db.commit()
    return {"onboarding_complete": True}


# ─── PDF Parsing ──────────────────────────────────────────────────────────────

@router.post("/parse-pdf/tax")
async def parse_tax_pdf(
    file: UploadFile = File(...),
    current_user: AuthUser = Depends(get_current_user),
):
    pdf_bytes = await file.read()
    result: Dict[str, Any] = {
        "tax": {
            "wages": 0, "federal_tax_withheld": 0, "state_tax_withheld": 0,
            "bonus": 0, "other_income": 0, "qualified_dividends": 0,
            "filing_status": "single", "state": "CA",
        },
        "retirement": {"k401_contribution": 0, "hsa_contribution": 0, "ira_contribution": 0},
        "deductions": {
            "charitable_donations": 0, "property_tax_paid": 0,
            "capital_loss_carryforward": 0, "prior_year_agi": 0,
        },
        "inferred_fields": [],
    }
    try:
        import io, re as _re
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        inferred: list = []

        def _find_dollar(pattern: str) -> int:
            m = _re.search(pattern, text, _re.IGNORECASE)
            if m:
                try:
                    return int(float(m.group(1).replace(",", "")))
                except ValueError:
                    return 0
            return 0

        wages = _find_dollar(r"box\s*1[^\d]*?([\d,]+\.\d{2})")
        if not wages:
            wages = _find_dollar(r"wages.*?([\d,]+\.\d{2})")
        if wages:
            result["tax"]["wages"] = wages
            inferred.append("wages")

        fed_wh = _find_dollar(r"box\s*2[^\d]*?([\d,]+\.\d{2})")
        if not fed_wh:
            fed_wh = _find_dollar(r"federal.*?withheld.*?([\d,]+\.\d{2})")
        if fed_wh:
            result["tax"]["federal_tax_withheld"] = fed_wh
            inferred.append("federal_tax_withheld")

        state_wh = _find_dollar(r"box\s*17[^\d]*?([\d,]+\.\d{2})")
        if not state_wh:
            state_wh = _find_dollar(r"state.*?withheld.*?([\d,]+\.\d{2})")
        if state_wh:
            result["tax"]["state_tax_withheld"] = state_wh
            inferred.append("state_tax_withheld")

        k401 = _find_dollar(r"box\s*12[^\d]*?d[^\d]*?([\d,]+\.\d{2})")
        if k401:
            result["retirement"]["k401_contribution"] = k401
            inferred.append("k401_contribution")

        charitable = _find_dollar(r"charitable.*?([\d,]+\.\d{2})")
        if charitable:
            result["deductions"]["charitable_donations"] = charitable
            inferred.append("charitable_donations")

        prop_tax = _find_dollar(r"real estate.*?tax.*?([\d,]+\.\d{2})")
        if prop_tax:
            result["deductions"]["property_tax_paid"] = prop_tax
            inferred.append("property_tax_paid")

        if "married filing jointly" in text.lower() or "jointly" in text.lower():
            result["tax"]["filing_status"] = "married_filing_jointly"
            inferred.append("filing_status")
        elif "head of household" in text.lower():
            result["tax"]["filing_status"] = "head_of_household"
            inferred.append("filing_status")

        result["inferred_fields"] = inferred
    except Exception:
        pass
    finally:
        del pdf_bytes
    return result


@router.post("/parse-pdf/brokerage")
async def parse_brokerage_pdf(
    file: UploadFile = File(...),
    current_user: AuthUser = Depends(get_current_user),
):
    from backend.services.pdf_parser import parse_brokerage_pdf as _parse
    pdf_bytes = await file.read()
    try:
        parsed = _parse(pdf_bytes)
        positions = []
        for p in parsed.positions:
            positions.append({
                "asset_type": p.asset_type,
                "ticker_or_name": p.ticker,
                "quantity": float(p.quantity),
                "cost_basis_per_unit": float(p.cost_basis_per_unit),
                "current_price": float(p.current_price),
                "purchase_date": p.purchase_date.isoformat() if hasattr(p.purchase_date, "isoformat") else str(p.purchase_date),
            })
        transactions = []
        for t in parsed.transactions:
            transactions.append({
                "asset_type": t.asset_type,
                "ticker_or_name": t.ticker_or_name,
                "action": t.action,
                "quantity": float(t.quantity),
                "price_per_unit": float(t.price_per_unit),
                "total_proceeds": float(t.total_proceeds),
                "total_cost_basis": float(t.total_cost_basis),
                "transaction_date": t.transaction_date.isoformat() if hasattr(t.transaction_date, "isoformat") else str(t.transaction_date),
                "is_wash_sale": bool(t.is_wash_sale),
            })
    except Exception:
        positions, transactions = [], []
    finally:
        del pdf_bytes
    return {"positions": positions, "transactions": transactions}
