"""
Step 3 verification gate — John Doe expected values from PLAN.md.

Today's date for all assertions: 2026-04-25 (per session context).
"""
import pytest
from backend.db.models import User
from backend.services.tax_engine import (
    asset_breakdown,
    compute_agi,
    federal_bracket,
    harvesting_opportunities,
    holding_period_alerts,
    realized_gains,
)


def _uid(db):
    return db.query(User).first().id


def test_agi(db):
    uid = _uid(db)
    # wages=180000 + net_gains(MSFT 5200 + COIN -2100 + SOL 12500)=15600 + rental=24000 = 219600
    assert compute_agi(uid, db) == 219600


def test_federal_bracket(db):
    uid = _uid(db)
    b = federal_bracket(compute_agi(uid, db))
    assert b["rate"] == 32


def test_aapl_unrealized_ltcg(db):
    # 50 shares * (220 - 150) = 3500
    gains = realized_gains(_uid(db), db)
    # AAPL is a position (unrealized), not in realized_gains.
    # We check it via asset_breakdown unrealized values instead.
    breakdown = asset_breakdown(_uid(db), db)
    # stocks: AAPL +3500 + TSLA -2550 + NVDA +10580 + AMZN -500 = 11030
    assert breakdown["by_type"]["stocks"]["unrealized_gain_loss"] == 11030


def test_btc_ltcg_unrealized(db):
    # 1.5 * (65000 - 30000) = 52500; ETH 10 * (2400-3200) = -8000; net crypto = 44500
    breakdown = asset_breakdown(_uid(db), db)
    assert breakdown["by_type"]["crypto"]["unrealized_gain_loss"] == 44500


def test_tsla_unrealized_loss(db):
    harvest = harvesting_opportunities(_uid(db), db)
    tsla = next(o for o in harvest["opportunities"] if o["ticker_or_name"] == "TSLA")
    assert tsla["unrealized_loss"] == -2550


def test_eth_unrealized_loss(db):
    harvest = harvesting_opportunities(_uid(db), db)
    eth = next(o for o in harvest["opportunities"] if o["ticker_or_name"] == "ETH")
    assert eth["unrealized_loss"] == -8000


def test_amzn_unrealized_loss(db):
    harvest = harvesting_opportunities(_uid(db), db)
    amzn = next(o for o in harvest["opportunities"] if o["ticker_or_name"] == "AMZN")
    assert amzn["unrealized_loss"] == -500


def test_msft_coin_realized(db):
    gains = realized_gains(_uid(db), db)
    # MSFT long-term: 8200 - 3000 = 5200
    # COIN short-term: 2900 - 5000 = -2100
    # SOL short-term: 72500 - 60000 = 12500 (crypto bucket)
    assert gains["by_asset_type"]["stocks"]["long_term"] == 5200
    assert gains["by_asset_type"]["stocks"]["short_term"] == -2100
    # Net MSFT + COIN (stocks only) = 5200 - 2100 = 3100
    assert gains["by_asset_type"]["stocks"]["long_term"] + gains["by_asset_type"]["stocks"]["short_term"] == 3100


def test_total_harvestable_loss(db):
    harvest = harvesting_opportunities(_uid(db), db)
    # TSLA -2550 + ETH -8000 + AMZN -500 + SPY put -3350 = -14400
    assert harvest["total_harvestable_loss"] == -14400


def test_nvda_days_until_ltcg(db):
    alerts = holding_period_alerts(_uid(db), db)
    nvda = next(a for a in alerts if a["ticker_or_name"] == "NVDA")
    # Purchase 2025-08-25, ltcg_date = +366 days = 2026-08-26, today 2026-04-25
    # days = 123 (~120)
    assert abs(nvda["days_until_ltcg"] - 120) <= 10


def test_nvda_tax_saving(db):
    alerts = holding_period_alerts(_uid(db), db)
    nvda = next(a for a in alerts if a["ticker_or_name"] == "NVDA")
    # gain = 20 * (929 - 400) = 10580; rate_diff = 0.32 - 0.15 = 0.17
    # saving = int(10580 * 0.17) = 1798 (~1800)
    assert abs(nvda["estimated_tax_saving"] - 1800) <= 50
