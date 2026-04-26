"""
Tax computation engine for Investment Doctor.

2024 federal income tax brackets (single filer):
  10%:  $0 – $11,600
  12%:  $11,601 – $47,150
  22%:  $47,151 – $100,525
  24%:  $100,526 – $191,950
  32%:  $191,951 – $243,725
  35%:  $243,726 – $609,350
  37%:  $609,351+

2024 long-term capital gains rates (single filer):
  0%:   $0 – $47,025
  15%:  $47,026 – $518,900
  20%:  $518,901+

California taxes LTCG as ordinary income (same rate as STCG).
"""
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from backend.db.models import Position, Transaction, W2Income, RealEstate, NetWorthSnapshot
from backend.services.anonymize import round_up_to_100

_FEDERAL_BRACKETS_2024_SINGLE = [
    (11600, 0.10),
    (47150, 0.12),
    (100525, 0.22),
    (191950, 0.24),
    (243725, 0.32),
    (609350, 0.35),
    (float("inf"), 0.37),
]

_LTCG_BRACKETS_2024_SINGLE = [
    (47025, 0.0),
    (518900, 0.15),
    (float("inf"), 0.20),
]

# Map DB asset_type (singular) → API key (plural where applicable)
_STATE_BRACKET_PCT: dict[str, float] = {
    "CA": 9.3,
    "NY": 6.85,
    "TX": 0.0,
    "FL": 0.0,
    "WA": 0.0,
}


def state_bracket_pct(state: str) -> float:
    return _STATE_BRACKET_PCT.get(state.upper(), 0.0)


_ASSET_KEY = {
    "stock": "stocks",
    "option": "options",
    "crypto": "crypto",
    "real_estate": "real_estate",
}


def _asset_key(asset_type: str) -> str:
    return _ASSET_KEY.get(asset_type, "stocks")


def federal_bracket(agi: int, filing_status: str = "single") -> dict:
    """Return the marginal federal bracket dict for the given AGI."""
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
    """Sum of (total_proceeds - total_cost_basis) for all sell transactions."""
    sells = db.query(Transaction).filter_by(user_id=user_id, action="sell").all()
    total = sum(float(t.total_proceeds) - float(t.total_cost_basis) for t in sells)
    return int(total)


def compute_agi(user_id: int, db: Session) -> int:
    """AGI = W2 wages + net realized gains + annual rental income, rounded up to 100."""
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
    """
    Identify positions with unrealized losses.
    Flags wash-sale risk if the same ticker appears in transactions
    within the last 30 days.
    """
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
    """
    Return positions that will flip from short-term to long-term
    within 90 days. Calculates the tax saving from waiting.
    """
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
    """Compute unrealized gain/loss and portfolio allocation by asset type."""
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
    """Current net worth = open positions market value + real estate + wages."""
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
    """Return historical net worth snapshots ordered by date."""
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
