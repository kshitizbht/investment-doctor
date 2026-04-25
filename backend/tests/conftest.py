"""
Shared pytest fixtures.
Uses an in-memory SQLite database so tests run without a MySQL connection.
"""
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.models import Base, Position, RealEstate, Transaction, Upload, User, W2Income
from backend.services.anonymize import round_up_to_100


@pytest.fixture(scope="session")
def engine():
    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def db(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    # Seed John Doe data
    _seed(session)
    yield session
    session.close()


def _seed(db):
    for model in [RealEstate, Transaction, Position, W2Income, User, Upload]:
        db.query(model).delete()
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
        Position(user_id=uid, asset_type="stock", ticker_or_name="AAPL",
                 quantity=50, cost_basis_per_unit=150.0, current_price=220.0,
                 purchase_date=date(2024, 1, 15)),
        Position(user_id=uid, asset_type="stock", ticker_or_name="TSLA",
                 quantity=30, cost_basis_per_unit=280.0, current_price=195.0,
                 purchase_date=date(2024, 1, 20)),
        Position(user_id=uid, asset_type="stock", ticker_or_name="NVDA",
                 quantity=20, cost_basis_per_unit=400.0, current_price=929.0,
                 purchase_date=date(2025, 8, 25)),
        Position(user_id=uid, asset_type="stock", ticker_or_name="AMZN",
                 quantity=100, cost_basis_per_unit=190.0, current_price=185.0,
                 purchase_date=date(2024, 2, 1)),
        Position(user_id=uid, asset_type="option", ticker_or_name="AAPL",
                 quantity=2, cost_basis_per_unit=1200.0, current_price=1680.0,
                 purchase_date=date(2025, 10, 1),
                 expiry_date=date(2026, 7, 18), is_short=False, strike_price=200.0),
        Position(user_id=uid, asset_type="option", ticker_or_name="SPY",
                 quantity=1, cost_basis_per_unit=5583.0, current_price=2233.0,
                 purchase_date=date(2025, 10, 1),
                 expiry_date=date(2026, 6, 6), is_short=True, strike_price=450.0),
        Position(user_id=uid, asset_type="crypto", ticker_or_name="BTC",
                 quantity=1.5, cost_basis_per_unit=30000.0, current_price=65000.0,
                 purchase_date=date(2024, 1, 10)),
        Position(user_id=uid, asset_type="crypto", ticker_or_name="ETH",
                 quantity=10, cost_basis_per_unit=3200.0, current_price=2400.0,
                 purchase_date=date(2025, 1, 1)),
    ]
    for p in positions:
        db.add(p)

    transactions = [
        Transaction(user_id=uid, asset_type="stock", ticker_or_name="MSFT",
                    action="buy", quantity=10, price_per_unit=300.0,
                    total_proceeds=0.0, total_cost_basis=3000.0,
                    transaction_date=date(2022, 1, 1), is_wash_sale=False),
        Transaction(user_id=uid, asset_type="stock", ticker_or_name="MSFT",
                    action="sell", quantity=10, price_per_unit=820.0,
                    total_proceeds=8200.0, total_cost_basis=3000.0,
                    transaction_date=date(2024, 3, 15), is_wash_sale=False),
        Transaction(user_id=uid, asset_type="stock", ticker_or_name="COIN",
                    action="buy", quantity=20, price_per_unit=250.0,
                    total_proceeds=0.0, total_cost_basis=5000.0,
                    transaction_date=date(2024, 6, 1), is_wash_sale=False),
        Transaction(user_id=uid, asset_type="stock", ticker_or_name="COIN",
                    action="sell", quantity=20, price_per_unit=145.0,
                    total_proceeds=2900.0, total_cost_basis=5000.0,
                    transaction_date=date(2024, 8, 10), is_wash_sale=False),
        Transaction(user_id=uid, asset_type="crypto", ticker_or_name="SOL",
                    action="buy", quantity=500, price_per_unit=120.0,
                    total_proceeds=0.0, total_cost_basis=60000.0,
                    transaction_date=date(2024, 7, 1), is_wash_sale=False),
        Transaction(user_id=uid, asset_type="crypto", ticker_or_name="SOL",
                    action="sell", quantity=500, price_per_unit=145.0,
                    total_proceeds=72500.0, total_cost_basis=60000.0,
                    transaction_date=date(2024, 11, 20), is_wash_sale=False),
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
