"""
John Doe mock data loader.

Data choices that achieve the Step 3 expected outputs:
- NVDA current_price=$929 → unrealized gain $10,580 → tax saving ~$1,800 at 17% rate diff
- SOL realized (sold) → adds $12,500 STCG to AGI → AGI = $180k + $15,600 + $24k = $219,600
- SPY put cost=$5,583, price=$2,233 → unrealized loss -$3,350
- Total harvestable: TSLA(-2550) + ETH(-8000) + AMZN(-500) + SPY(-3350) = -$14,400
"""
import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.db.session import SessionLocal
from backend.db.models import User, W2Income, Position, Transaction, RealEstate
from backend.services.anonymize import round_up_to_100


def seed():
    db = SessionLocal()
    try:
        db.query(RealEstate).delete()
        db.query(Transaction).delete()
        db.query(Position).delete()
        db.query(W2Income).delete()
        db.query(User).delete()
        db.commit()

        user = User(filing_status="single", state="CA")
        db.add(user)
        db.flush()
        uid = user.id

        db.add(W2Income(
            user_id=uid, tax_year=2024,
            wages=round_up_to_100(180000),
            federal_tax_withheld=round_up_to_100(32000),
            state_tax_withheld=round_up_to_100(14000),
            source_label="employer_1",
        ))

        positions = [
            # Stocks — open positions
            Position(user_id=uid, asset_type="stock", ticker_or_name="AAPL",
                     quantity=50, cost_basis_per_unit=150.0, current_price=220.0,
                     purchase_date=date(2024, 1, 15)),                          # >1yr → LTCG eligible
            Position(user_id=uid, asset_type="stock", ticker_or_name="TSLA",
                     quantity=30, cost_basis_per_unit=280.0, current_price=195.0,
                     purchase_date=date(2024, 1, 20)),                          # >1yr, unrealized loss
            Position(user_id=uid, asset_type="stock", ticker_or_name="NVDA",
                     quantity=20, cost_basis_per_unit=400.0, current_price=929.0,
                     purchase_date=date(2025, 8, 25)),                          # 8mo ago → ~122 days to LTCG
            Position(user_id=uid, asset_type="stock", ticker_or_name="AMZN",
                     quantity=100, cost_basis_per_unit=190.0, current_price=185.0,
                     purchase_date=date(2024, 2, 1)),                           # >1yr, unrealized loss -$500
            # Options
            Position(user_id=uid, asset_type="option", ticker_or_name="AAPL",
                     quantity=2, cost_basis_per_unit=1200.0, current_price=1680.0,
                     purchase_date=date(2025, 10, 1),
                     expiry_date=date(2026, 7, 18), is_short=0, strike_price=200.0),  # call, up 40%
            Position(user_id=uid, asset_type="option", ticker_or_name="SPY",
                     quantity=1, cost_basis_per_unit=5583.0, current_price=2233.0,
                     purchase_date=date(2025, 10, 1),
                     expiry_date=date(2026, 6, 6), is_short=1, strike_price=450.0),   # put, down 60%
            # Crypto — open positions
            Position(user_id=uid, asset_type="crypto", ticker_or_name="BTC",
                     quantity=1.5, cost_basis_per_unit=30000.0, current_price=65000.0,
                     purchase_date=date(2024, 1, 10)),                          # >1yr → LTCG eligible
            Position(user_id=uid, asset_type="crypto", ticker_or_name="ETH",
                     quantity=10, cost_basis_per_unit=3200.0, current_price=2400.0,
                     purchase_date=date(2025, 1, 1)),                           # unrealized loss
        ]
        for p in positions:
            db.add(p)

        # Realized transactions (this tax year)
        # Buy records establish holding-period start dates for LTCG determination.
        transactions = [
            # MSFT: bought Jan 2022, sold Mar 2024 → >1yr → LTCG, gain = $5,200
            Transaction(user_id=uid, asset_type="stock", ticker_or_name="MSFT",
                        action="buy", quantity=10, price_per_unit=300.0,
                        total_proceeds=0.0, total_cost_basis=3000.0,
                        transaction_date=date(2022, 1, 1), is_wash_sale=0),
            Transaction(user_id=uid, asset_type="stock", ticker_or_name="MSFT",
                        action="sell", quantity=10, price_per_unit=820.0,
                        total_proceeds=8200.0, total_cost_basis=3000.0,
                        transaction_date=date(2024, 3, 15), is_wash_sale=0),
            # COIN: bought Jun 2024, sold Aug 2024 → <1yr → STCG, loss = -$2,100
            Transaction(user_id=uid, asset_type="stock", ticker_or_name="COIN",
                        action="buy", quantity=20, price_per_unit=250.0,
                        total_proceeds=0.0, total_cost_basis=5000.0,
                        transaction_date=date(2024, 6, 1), is_wash_sale=0),
            Transaction(user_id=uid, asset_type="stock", ticker_or_name="COIN",
                        action="sell", quantity=20, price_per_unit=145.0,
                        total_proceeds=2900.0, total_cost_basis=5000.0,
                        transaction_date=date(2024, 8, 10), is_wash_sale=0),
            # SOL: bought Jul 2024, sold Nov 2024 → <1yr → STCG, gain = $12,500
            # (SOL realized to bring AGI to $219,600)
            Transaction(user_id=uid, asset_type="crypto", ticker_or_name="SOL",
                        action="buy", quantity=500, price_per_unit=120.0,
                        total_proceeds=0.0, total_cost_basis=60000.0,
                        transaction_date=date(2024, 7, 1), is_wash_sale=0),
            Transaction(user_id=uid, asset_type="crypto", ticker_or_name="SOL",
                        action="sell", quantity=500, price_per_unit=145.0,
                        total_proceeds=72500.0, total_cost_basis=60000.0,
                        transaction_date=date(2024, 11, 20), is_wash_sale=0),
        ]
        for t in transactions:
            db.add(t)

        db.add(RealEstate(
            user_id=uid,
            label="Rental - SF Condo",
            purchase_price=450000,
            purchase_date=date(2018, 1, 1),
            current_estimated_value=510000,
            annual_rental_income=round_up_to_100(24000),
            depreciation_taken=0,
            mortgage_interest_paid=0,
        ))

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Seed complete.")
