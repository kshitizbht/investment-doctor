"""
Tax computation engine for Investment Doctor.

2024 federal income tax brackets, NIIT, Medicare surtax, bracket-accurate
tax calculation, marginal rate stack, RSU analysis, retirement optimizer.
"""
from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from backend.db.models import Position, Transaction, W2Income, RealEstate, NetWorthSnapshot
from backend.services.anonymize import round_up_to_100

# ── 2024 Federal income tax brackets ─────────────────────────────────────────

_FEDERAL_BRACKETS_2024_SINGLE = [
    (11600, 0.10),
    (47150, 0.12),
    (100525, 0.22),
    (191950, 0.24),
    (243725, 0.32),
    (609350, 0.35),
    (float("inf"), 0.37),
]

_FEDERAL_BRACKETS_2024: dict[str, list] = {
    "single": _FEDERAL_BRACKETS_2024_SINGLE,
    "married_filing_jointly": [
        (23200, 0.10), (94300, 0.12), (201050, 0.22), (383900, 0.24),
        (487450, 0.32), (731200, 0.35), (float("inf"), 0.37),
    ],
    "married_filing_separately": [
        (11600, 0.10), (47150, 0.12), (100525, 0.22), (191950, 0.24),
        (243725, 0.32), (365600, 0.35), (float("inf"), 0.37),
    ],
    "head_of_household": [
        (16550, 0.10), (63100, 0.12), (100500, 0.22), (191950, 0.24),
        (243700, 0.32), (609350, 0.35), (float("inf"), 0.37),
    ],
}

# ── 2024 Long-term capital gains brackets ────────────────────────────────────

_LTCG_BRACKETS_2024_SINGLE = [
    (47025, 0.0),
    (518900, 0.15),
    (float("inf"), 0.20),
]

_LTCG_BRACKETS_2024: dict[str, list] = {
    "single": _LTCG_BRACKETS_2024_SINGLE,
    "married_filing_jointly": [(94050, 0.0), (583750, 0.15), (float("inf"), 0.20)],
    "married_filing_separately": [(47025, 0.0), (291850, 0.15), (float("inf"), 0.20)],
    "head_of_household": [(63000, 0.0), (551350, 0.15), (float("inf"), 0.20)],
}

# ── 2024 Standard deductions ──────────────────────────────────────────────────

_STANDARD_DEDUCTION_2024: dict[str, int] = {
    "single": 14600,
    "married_filing_jointly": 29200,
    "married_filing_separately": 14600,
    "head_of_household": 21900,
}

# ── NIIT & Medicare surtax thresholds ────────────────────────────────────────

_NIIT_THRESHOLD: dict[str, int] = {
    "single": 200000,
    "married_filing_jointly": 250000,
    "married_filing_separately": 125000,
    "head_of_household": 200000,
}

_MEDICARE_SURTAX_THRESHOLD: dict[str, int] = {
    "single": 200000,
    "married_filing_jointly": 250000,
    "married_filing_separately": 125000,
    "head_of_household": 200000,
}

# ── State rates and standard deductions ──────────────────────────────────────

_STATE_BRACKET_PCT: dict[str, float] = {
    "CA": 9.3,
    "NY": 6.85,
    "TX": 0.0,
    "FL": 0.0,
    "WA": 0.0,
}

_STATE_STD_DEDUCTION: dict[str, int] = {
    "CA": 5202,
    "NY": 8000,
    "TX": 0,
    "FL": 0,
    "WA": 0,
}

# ── 2024 Retirement limits ────────────────────────────────────────────────────

K401_LIMIT_2024 = 23000
HSA_LIMIT_2024_SINGLE = 4150
IRA_LIMIT_2024 = 7000

# ── Asset key mapping ─────────────────────────────────────────────────────────

_ASSET_KEY = {
    "stock": "stocks",
    "option": "options",
    "crypto": "crypto",
    "real_estate": "real_estate",
}


def _asset_key(asset_type: str) -> str:
    return _ASSET_KEY.get(asset_type, "stocks")


# ── Legacy functions preserved for test compatibility ─────────────────────────

def state_bracket_pct(state: str) -> float:
    return _STATE_BRACKET_PCT.get(state.upper(), 0.0)


def federal_bracket(agi: int, filing_status: str = "single") -> dict:
    """Return the marginal federal bracket for the given AGI (single filer table).
    Signature preserved for backward compat — tests depend on this."""
    prev = 0
    for ceiling, rate in _FEDERAL_BRACKETS_2024_SINGLE:
        if agi <= ceiling:
            return {"rate": int(rate * 100), "min": prev, "max": int(ceiling) if ceiling != float("inf") else None}
        prev = ceiling + 1
    return {"rate": 37, "min": 609351, "max": None}


def _ltcg_rate(agi: int) -> float:
    for ceiling, rate in _LTCG_BRACKETS_2024_SINGLE:
        if agi <= ceiling:
            return rate
    return 0.20


def _net_realized_gains(user_id: int, db: Session) -> int:
    sells = db.query(Transaction).filter_by(user_id=user_id, action="sell").all()
    total = sum(float(t.total_proceeds) - float(t.total_cost_basis) for t in sells)
    return int(total)


def compute_agi(user_id: int, db: Session) -> int:
    """AGI = W2 wages + net realized gains + annual rental income.
    Preserved unchanged — tests assert compute_agi(uid, db) == 219600."""
    w2 = db.query(W2Income).filter_by(user_id=user_id).first()
    wages = int(w2.wages) if w2 else 0
    net_gains = _net_realized_gains(user_id, db)
    re = db.query(RealEstate).filter_by(user_id=user_id).first()
    rental = int(re.annual_rental_income) if re else 0
    return round_up_to_100(wages + net_gains + rental)


def realized_gains(user_id: int, db: Session) -> dict:
    """Compute short-term and long-term realized gains/losses by asset type."""
    sells = db.query(Transaction).filter_by(user_id=user_id, action="sell").all()
    buys = db.query(Transaction).filter_by(user_id=user_id, action="buy").all()

    buy_map: dict[str, list] = {}
    for b in buys:
        buy_map.setdefault(b.ticker_or_name, []).append(b)

    by_type: dict[str, dict] = {
        "stocks": {"short_term": 0, "long_term": 0},
        "options": {"short_term": 0, "long_term": 0},
        "crypto": {"short_term": 0, "long_term": 0},
        "real_estate": {"short_term": 0, "long_term": 0},
    }

    for sell in sells:
        gain = float(sell.total_proceeds) - float(sell.total_cost_basis)
        is_long = False

        matching_buys = buy_map.get(sell.ticker_or_name, [])
        if matching_buys:
            buy_date = min(b.transaction_date for b in matching_buys)
            is_long = (sell.transaction_date - buy_date).days > 365

        term = "long_term" if is_long else "short_term"
        by_type[_asset_key(sell.asset_type)][term] += int(gain)

    stcg = sum(v["short_term"] for v in by_type.values())
    ltcg = sum(v["long_term"] for v in by_type.values())

    return {
        "short_term_realized": stcg,
        "long_term_realized": ltcg,
        "net_realized": stcg + ltcg,
        "by_asset_type": by_type,
    }


def harvesting_opportunities(user_id: int, db: Session) -> dict:
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)

    recent_sells = {
        t.ticker_or_name
        for t in db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.action == "sell",
            Transaction.transaction_date >= thirty_days_ago,
        )
        .all()
    }

    positions = db.query(Position).filter_by(user_id=user_id).all()
    opportunities = []

    for pos in positions:
        unrealized = float(pos.quantity) * (float(pos.current_price) - float(pos.cost_basis_per_unit))
        if unrealized < 0:
            opportunities.append({
                "ticker_or_name": pos.ticker_or_name,
                "asset_type": pos.asset_type,
                "unrealized_loss": int(unrealized),
                "wash_sale_risk": pos.ticker_or_name in recent_sells,
            })

    total_loss = sum(o["unrealized_loss"] for o in opportunities)

    agi = compute_agi(user_id, db)
    bracket = federal_bracket(agi)
    marginal_rate = bracket["rate"] / 100.0
    estimated_savings = int(abs(total_loss) * marginal_rate)

    return {
        "opportunities": opportunities,
        "total_harvestable_loss": total_loss,
        "estimated_tax_savings": estimated_savings,
    }


def holding_period_alerts(user_id: int, db: Session) -> list:
    today = date.today()
    cutoff = today + timedelta(days=180)

    agi = compute_agi(user_id, db)
    bracket = federal_bracket(agi)
    stcg_rate = bracket["rate"] / 100.0
    ltcg_rate_val = _ltcg_rate(agi)
    rate_diff = stcg_rate - ltcg_rate_val

    alerts = []
    positions = db.query(Position).filter_by(user_id=user_id).all()

    for pos in positions:
        ltcg_date = pos.purchase_date + timedelta(days=366)
        if today <= ltcg_date <= cutoff:
            days_left = (ltcg_date - today).days
            unrealized_gain = float(pos.quantity) * (float(pos.current_price) - float(pos.cost_basis_per_unit))
            if unrealized_gain > 0:
                tax_saving = int(unrealized_gain * rate_diff)
                alerts.append({
                    "ticker_or_name": pos.ticker_or_name,
                    "asset_type": pos.asset_type,
                    "days_until_ltcg": days_left,
                    "estimated_tax_saving": tax_saving,
                })

    return sorted(alerts, key=lambda a: a["days_until_ltcg"])


def asset_breakdown(user_id: int, db: Session) -> dict:
    positions = db.query(Position).filter_by(user_id=user_id).all()

    totals: dict[str, dict] = {
        "stocks": {"unrealized_gain_loss": 0, "market_value": 0.0},
        "options": {"unrealized_gain_loss": 0, "market_value": 0.0},
        "crypto": {"unrealized_gain_loss": 0, "market_value": 0.0},
        "real_estate": {"unrealized_gain_loss": 0, "market_value": 0.0},
    }

    for pos in positions:
        qty = float(pos.quantity)
        price = float(pos.current_price)
        cost = float(pos.cost_basis_per_unit)
        mval = qty * price
        ugl = qty * (price - cost)

        key = _asset_key(pos.asset_type)
        totals[key]["unrealized_gain_loss"] += int(ugl)
        totals[key]["market_value"] += mval

    re_rows = db.query(RealEstate).filter_by(user_id=user_id).all()
    for re in re_rows:
        re_gain = int(re.current_estimated_value) - int(re.purchase_price)
        re_mval = float(re.current_estimated_value)
        totals["real_estate"]["unrealized_gain_loss"] += re_gain
        totals["real_estate"]["market_value"] += re_mval

    total_portfolio = sum(v["market_value"] for v in totals.values())

    result: dict[str, Any] = {}
    remaining_pct = 100
    type_keys = list(totals.keys())

    for i, key in enumerate(type_keys):
        if i == len(type_keys) - 1:
            pct = remaining_pct
        else:
            pct = round(totals[key]["market_value"] / total_portfolio * 100) if total_portfolio > 0 else 0
            remaining_pct -= pct
        result[key] = {
            "unrealized_gain_loss": totals[key]["unrealized_gain_loss"],
            "pct_of_portfolio": pct,
        }

    return {"by_type": result}


def compute_net_worth(user_id: int, db: Session) -> dict:
    positions = db.query(Position).filter_by(user_id=user_id).all()
    stocks_value = int(sum(float(p.quantity) * float(p.current_price) for p in positions))

    re_rows = db.query(RealEstate).filter_by(user_id=user_id).all()
    real_estate_value = sum(int(re.current_estimated_value) for re in re_rows)

    w2 = db.query(W2Income).filter_by(user_id=user_id).first()
    income_value = int(w2.wages) if w2 else 0

    return {
        "stocks_value": stocks_value,
        "real_estate_value": real_estate_value,
        "income_value": income_value,
        "total": stocks_value + real_estate_value + income_value,
    }


def net_worth_history(user_id: int, db: Session) -> list:
    rows = (
        db.query(NetWorthSnapshot)
        .filter_by(user_id=user_id)
        .order_by(NetWorthSnapshot.snapshot_date)
        .all()
    )
    return [
        {
            "date": r.snapshot_date.isoformat(),
            "stocks": r.stocks_value,
            "real_estate": r.real_estate_value,
            "income": r.income_value,
            "total": r.total_net_worth,
        }
        for r in rows
    ]


# ── New: accurate tax computation ─────────────────────────────────────────────

def standard_deduction(filing_status: str) -> int:
    return _STANDARD_DEDUCTION_2024.get(filing_status, _STANDARD_DEDUCTION_2024["single"])


def state_std_deduction(state: str) -> int:
    return _STATE_STD_DEDUCTION.get(state.upper(), 0)


def federal_tax_exact(taxable_income: int, filing_status: str = "single") -> int:
    """Bracket-accumulation federal tax on taxable income (after standard deduction)."""
    brackets = _FEDERAL_BRACKETS_2024.get(filing_status, _FEDERAL_BRACKETS_2024["single"])
    tax = 0.0
    prev = 0
    for ceiling, rate in brackets:
        if taxable_income <= prev:
            break
        if ceiling == float("inf"):
            in_bracket = taxable_income - prev
        else:
            ceiling_int = int(ceiling)
            in_bracket = min(taxable_income, ceiling_int) - prev
            prev = ceiling_int
        tax += in_bracket * rate
        if ceiling == float("inf"):
            break
    return int(tax)


def _ltcg_rate_fs(agi: int, filing_status: str = "single") -> float:
    """LTCG rate at given AGI and filing status."""
    brackets = _LTCG_BRACKETS_2024.get(filing_status, _LTCG_BRACKETS_2024["single"])
    for ceiling, rate in brackets:
        if agi <= ceiling:
            return rate
    return 0.20


def _ltcg_tax_stacked(ordinary_taxable: int, ltcg: int, filing_status: str) -> int:
    """LTCG tax using stacking: LTCG is taxed at the LTCG rate applicable when
    stacked on top of ordinary taxable income."""
    if ltcg <= 0:
        return 0
    brackets = _LTCG_BRACKETS_2024.get(filing_status, _LTCG_BRACKETS_2024["single"])
    tax = 0.0
    remaining = ltcg
    base = ordinary_taxable

    for ceiling, rate in brackets:
        if ceiling == float("inf"):
            tax += remaining * rate
            break
        ceiling_int = int(ceiling)
        if base >= ceiling_int:
            continue
        room = ceiling_int - base
        chunk = min(remaining, room)
        tax += chunk * rate
        remaining -= chunk
        base = ceiling_int
        if remaining <= 0:
            break

    return int(tax)


def federal_tax_with_ltcg(taxable_income: int, ltcg_income: int, filing_status: str = "single") -> int:
    """Federal tax with LTCG preferential rates (stacking method)."""
    ltcg_clamped = max(0, min(ltcg_income, taxable_income))
    ordinary = max(0, taxable_income - ltcg_clamped)
    return federal_tax_exact(ordinary, filing_status) + _ltcg_tax_stacked(ordinary, ltcg_clamped, filing_status)


def compute_niit(net_investment_income: int, agi: int, filing_status: str = "single") -> int:
    """3.8% NIIT on lesser of NII or (AGI − threshold) when AGI > threshold."""
    threshold = _NIIT_THRESHOLD.get(filing_status, 200000)
    if agi <= threshold or net_investment_income <= 0:
        return 0
    excess = agi - threshold
    return int(min(net_investment_income, excess) * 0.038)


def compute_medicare_surtax(total_wages: int, filing_status: str = "single") -> int:
    """0.9% additional Medicare tax on wages above threshold."""
    threshold = _MEDICARE_SURTAX_THRESHOLD.get(filing_status, 200000)
    excess = max(0, total_wages - threshold)
    return int(excess * 0.009)


def compute_agi_extended(
    wages: int,
    net_gains: int,
    rental: int,
    bonus: int = 0,
    other_income: int = 0,
    k401: int = 0,
    hsa: int = 0,
    ira: int = 0,
    capital_loss_carryforward: int = 0,
) -> int:
    """Extended AGI with pre-tax deductions and additional income sources."""
    adjusted_gains = max(net_gains - capital_loss_carryforward, -3000)
    gross = wages + bonus + other_income + adjusted_gains + rental
    pre_tax = k401 + hsa + ira
    return round_up_to_100(max(0, gross - pre_tax))


def marginal_rate_stack(
    agi: int,
    total_wages: int,
    net_investment_income: int,
    filing_status: str = "single",
    state: str = "CA",
) -> dict:
    """Full marginal rate stack for the next dollar of income."""
    std_ded = standard_deduction(filing_status)
    taxable = max(0, agi - std_ded)

    # Federal marginal bracket at taxable income
    brackets = _FEDERAL_BRACKETS_2024.get(filing_status, _FEDERAL_BRACKETS_2024["single"])
    federal_pct = 37.0
    for ceiling, rate in brackets:
        ceiling_int = int(ceiling) if ceiling != float("inf") else taxable + 1
        if taxable <= ceiling_int:
            federal_pct = rate * 100
            break

    niit_pct = 3.8 if agi > _NIIT_THRESHOLD.get(filing_status, 200000) and net_investment_income > 0 else 0.0
    medicare_pct = 0.9 if total_wages > _MEDICARE_SURTAX_THRESHOLD.get(filing_status, 200000) else 0.0
    state_pct = state_bracket_pct(state)
    ltcg_federal_pct = _ltcg_rate_fs(agi, filing_status) * 100

    total_ordinary = federal_pct + medicare_pct + state_pct
    total_ltcg = ltcg_federal_pct + niit_pct + state_pct

    return {
        "federal_pct": round(federal_pct, 1),
        "niit_pct": niit_pct,
        "medicare_surtax_pct": medicare_pct,
        "state_pct": state_pct,
        "total_ordinary_pct": round(total_ordinary, 1),
        "total_ltcg_pct": round(total_ltcg, 1),
        "keep_per_1000_ordinary": int(1000 * (1 - total_ordinary / 100)),
        "keep_per_1000_ltcg": int(1000 * (1 - total_ltcg / 100)),
    }


def compute_rsu_analysis(rsu_grants: list, marginal_rate: float) -> dict:
    """RSU withholding gap analysis."""
    SUPPLEMENTAL_RATE = 0.22

    total_vested_income = 0
    total_supplemental = 0
    total_actual_tax = 0
    total_retained_value = 0
    grants_out = []

    for g in rsu_grants:
        shares_vested = int(g.get("shares_vested_ytd", 0))
        fmv = float(g.get("fmv_at_vest", 0))
        shares_sold = int(g.get("shares_sold_at_vest", 0))
        current_price = float(g.get("current_price", fmv))

        vested_income = int(shares_vested * fmv)
        supplemental = int(vested_income * SUPPLEMENTAL_RATE)
        actual_tax = int(vested_income * marginal_rate)
        gap = supplemental - actual_tax
        retained = shares_vested - shares_sold
        retained_value = int(retained * current_price)

        total_vested_income += vested_income
        total_supplemental += supplemental
        total_actual_tax += actual_tax
        total_retained_value += retained_value

        grants_out.append({
            "ticker": g.get("ticker", "RSU"),
            "grant_type": g.get("grant_type", "RSU"),
            "shares_vested_ytd": shares_vested,
            "fmv_at_vest": fmv,
            "vested_income": vested_income,
            "supplemental_withheld": supplemental,
            "actual_tax_owed": actual_tax,
            "withholding_gap": gap,
            "retained_shares": retained,
            "retained_value": retained_value,
            "next_vest_date": g.get("next_vest_date"),
            "next_vest_shares": int(g.get("next_vest_shares", 0)),
        })

    return {
        "grants": grants_out,
        "total_vested_income": total_vested_income,
        "supplemental_withheld": total_supplemental,
        "actual_tax_owed": total_actual_tax,
        "withholding_gap": total_supplemental - total_actual_tax,
        "total_retained_value": total_retained_value,
    }


def compute_retirement_optimizer(
    k401: int,
    hsa: int,
    ira: int,
    combined_marginal_rate: float,
) -> dict:
    """Retirement contribution room and tax savings."""
    k401_room = max(0, K401_LIMIT_2024 - k401)
    hsa_room = max(0, HSA_LIMIT_2024_SINGLE - hsa)
    ira_room = max(0, IRA_LIMIT_2024 - ira)

    return {
        "k401_contributed": k401,
        "k401_limit": K401_LIMIT_2024,
        "k401_room": k401_room,
        "k401_pct_used": round(k401 / K401_LIMIT_2024 * 100) if K401_LIMIT_2024 > 0 else 0,
        "k401_tax_saving_if_maxed": int(k401_room * combined_marginal_rate),
        "hsa_contributed": hsa,
        "hsa_limit": HSA_LIMIT_2024_SINGLE,
        "hsa_room": hsa_room,
        "hsa_tax_saving_if_maxed": int(hsa_room * combined_marginal_rate),
        "ira_contributed": ira,
        "ira_limit": IRA_LIMIT_2024,
        "ira_room": ira_room,
    }


def compute_income_character(
    wages: int,
    bonus: int,
    rsu_income: int,
    stcg: int,
    ltcg: int,
    qualified_dividends: int,
    rental: int,
    ordinary_rate: float,
    ltcg_rate_val: float,
) -> dict:
    """Income breakdown by tax treatment."""
    return {
        "w2_wages": wages,
        "bonus": bonus,
        "rsu_vests": rsu_income,
        "short_term_gains": stcg,
        "long_term_gains": ltcg,
        "qualified_dividends": qualified_dividends,
        "rental_income": rental,
        "rate_ordinary_pct": round(ordinary_rate * 100, 1),
        "rate_ltcg_pct": round(ltcg_rate_val * 100, 1),
    }


def compute_deduction_optimizer(
    filing_status: str,
    mortgage_interest: int = 0,
    property_tax: int = 0,
    charitable: int = 0,
    other_itemized: int = 0,
) -> dict:
    """Standard vs. itemized deduction comparison."""
    std = standard_deduction(filing_status)
    salt_cap = 10000
    salt_deductible = min(property_tax, salt_cap)
    itemized = mortgage_interest + salt_deductible + charitable + other_itemized
    use_itemized = itemized > std

    return {
        "standard_deduction": std,
        "itemized_total": itemized,
        "mortgage_interest": mortgage_interest,
        "salt_deductible": salt_deductible,
        "salt_cap": salt_cap,
        "charitable": charitable,
        "use_itemized": use_itemized,
        "deduction_used": "itemized" if use_itemized else "standard",
        "deduction_amount": itemized if use_itemized else std,
        "additional_savings": max(0, itemized - std),
    }


def compute_tax_balance(
    federal_tax: int,
    state_tax: int,
    niit: int,
    medicare_surtax: int,
    federal_withheld: int,
    state_withheld: int,
) -> dict:
    """Owe / refund balance."""
    total_tax = federal_tax + state_tax + niit + medicare_surtax
    total_withheld = federal_withheld + state_withheld
    balance = total_withheld - total_tax  # positive = refund, negative = owe

    return {
        "estimated_federal_tax": federal_tax,
        "estimated_state_tax": state_tax,
        "niit": niit,
        "medicare_surtax": medicare_surtax,
        "estimated_total_tax": total_tax,
        "total_withheld": total_withheld,
        "balance": balance,
        "refund_or_owe": "refund" if balance >= 0 else "owe",
        "underpayment_risk": balance < -1000,
    }
