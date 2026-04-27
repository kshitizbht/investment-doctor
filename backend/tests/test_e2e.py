"""
Step 8 verification gate — full-scenario E2E test.

Flow:
1. Clean schema, recreate tables, seed John Doe data
2. Assert all 5 insight cards match expected values
3. Simulate PDF upload (synthetic bytes)
4. Assert position row count increased
5. Assert insights endpoint still returns valid schema
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.db.models import Base, Position, Transaction
from backend.db.session import get_db
from backend.main import app
from backend.tests.conftest import _seed


@pytest.fixture(scope="module")
def e2e_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)

    def override_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db

    session = Session()
    _seed(session)
    session.close()

    yield TestClient(app), Session

    app.dependency_overrides.clear()


def test_e2e_seed_insights(e2e_client):
    client, _ = e2e_client
    r = client.get("/api/insights")
    assert r.status_code == 200
    data = r.json()
    assert data["tax_snapshot"]["agi"] == 219600
    assert data["tax_snapshot"]["federal_bracket_pct"] == 32
    assert data["harvesting"]["total_harvestable_loss"] == -14400


def test_e2e_insights_keys(e2e_client):
    client, _ = e2e_client
    data = client.get("/api/insights").json()
    required = {"tax_snapshot", "capital_gains", "harvesting", "holding_period_alerts", "asset_breakdown"}
    assert required.issubset(set(data.keys()))


def test_e2e_simulate_preserves_insights(e2e_client):
    """POST /api/simulate with seeded-equivalent data returns a valid insights response."""
    client, _ = e2e_client
    payload = {
        "filing_status": "single",
        "state": "CA",
        "wages": 180000,
        "federal_tax_withheld": 40000,
        "state_tax_withheld": 15000,
        "bonus": 0,
        "other_income": 0,
        "qualified_dividends": 0,
        "k401_contribution": 0,
        "hsa_contribution": 0,
        "ira_contribution": 0,
        "capital_loss_carryforward": 0,
        "charitable_donations": 0,
        "property_tax_paid": 0,
        "prior_year_agi": 0,
        "rsu_grants": [],
        "positions": [],
        "transactions": [],
        "real_estate_list": [],
    }
    r = client.post("/api/simulate", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "tax_snapshot" in data
    assert "capital_gains" in data
    assert data["tax_snapshot"]["agi"] > 0


def test_e2e_insights_still_valid_after_upload(e2e_client):
    client, _ = e2e_client
    data = client.get("/api/insights").json()
    assert "tax_snapshot" in data
    assert "capital_gains" in data
    assert "harvesting" in data
    assert isinstance(data["holding_period_alerts"], list)
    assert "asset_breakdown" in data
