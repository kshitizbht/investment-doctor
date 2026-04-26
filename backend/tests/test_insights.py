"""
Step 4 verification gate — integration test for GET /api/insights.
Uses an in-memory SQLite database seeded with John Doe data.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.db.models import Base
from backend.db.session import get_db
from backend.main import app
from backend.tests.conftest import _seed


@pytest.fixture(scope="module")
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
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

    yield TestClient(app)

    app.dependency_overrides.clear()


def test_insights_status(client):
    r = client.get("/api/insights")
    assert r.status_code == 200


def test_insights_keys(client):
    data = client.get("/api/insights").json()
    required = {"tax_snapshot", "capital_gains", "harvesting", "holding_period_alerts", "asset_breakdown"}
    assert required.issubset(set(data.keys()))


def test_tax_snapshot(client):
    snap = client.get("/api/insights").json()["tax_snapshot"]
    assert snap["agi"] == 219600
    assert snap["federal_bracket_pct"] == 32
    assert snap["estimated_federal_tax"] > 0
    assert snap["estimated_state_tax"] > 0


def test_capital_gains_shape(client):
    cg = client.get("/api/insights").json()["capital_gains"]
    assert cg["net_realized"] == cg["short_term_realized"] + cg["long_term_realized"]
    assert set(cg["by_asset_type"].keys()) == {"stocks", "options", "crypto", "real_estate"}


def test_harvesting_shape(client):
    h = client.get("/api/insights").json()["harvesting"]
    assert h["total_harvestable_loss"] == -14400
    assert h["estimated_tax_savings"] > 0
    tickers = [o["ticker_or_name"] for o in h["opportunities"]]
    assert "TSLA" in tickers
    assert "ETH" in tickers


def test_asset_breakdown_pct_sum(client):
    ab = client.get("/api/insights").json()["asset_breakdown"]["by_type"]
    pct_sum = sum(v["pct_of_portfolio"] for v in ab.values())
    assert pct_sum == 100
