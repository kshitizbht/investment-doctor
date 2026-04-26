from sqlalchemy import Boolean, Column, Integer, String, Date, DateTime, Numeric
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    filing_status = Column(String(20), nullable=False)
    state = Column(String(2), nullable=False)


class W2Income(Base):
    __tablename__ = "w2_income"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    tax_year = Column(Integer, nullable=False)
    wages = Column(Integer, nullable=False)
    federal_tax_withheld = Column(Integer, nullable=False)
    state_tax_withheld = Column(Integer, nullable=False)
    source_label = Column(String(50), nullable=False)


class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    asset_type = Column(String(20), nullable=False)
    ticker_or_name = Column(String(50), nullable=False)
    quantity = Column(Numeric(18, 8), nullable=False)
    cost_basis_per_unit = Column(Numeric(18, 4), nullable=False)
    current_price = Column(Numeric(18, 4), nullable=False)
    purchase_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)
    is_short = Column(Boolean, nullable=True)
    strike_price = Column(Numeric(18, 4), nullable=True)


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    asset_type = Column(String(20), nullable=False)
    ticker_or_name = Column(String(50), nullable=False)
    action = Column(String(20), nullable=False)
    quantity = Column(Numeric(18, 8), nullable=False)
    price_per_unit = Column(Numeric(18, 4), nullable=False)
    total_proceeds = Column(Numeric(18, 4), nullable=False)
    total_cost_basis = Column(Numeric(18, 4), nullable=False)
    transaction_date = Column(Date, nullable=False)
    is_wash_sale = Column(Boolean, nullable=False, default=False)


class RealEstate(Base):
    __tablename__ = "real_estate"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    label = Column(String(100), nullable=False)
    purchase_price = Column(Integer, nullable=False)
    purchase_date = Column(Date, nullable=False)
    current_estimated_value = Column(Integer, nullable=False)
    annual_rental_income = Column(Integer, nullable=False)
    depreciation_taken = Column(Integer, nullable=False, default=0)
    mortgage_interest_paid = Column(Integer, nullable=False, default=0)


class NetWorthSnapshot(Base):
    __tablename__ = "net_worth_snapshots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    snapshot_date = Column(Date, nullable=False)
    stocks_value = Column(Integer, nullable=False, default=0)
    real_estate_value = Column(Integer, nullable=False, default=0)
    income_value = Column(Integer, nullable=False, default=0)
    total_net_worth = Column(Integer, nullable=False, default=0)


class Upload(Base):
    __tablename__ = "uploads"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    filename = Column(String(255), nullable=False)
    upload_date = Column(DateTime, nullable=False)
    parsed_status = Column(String(20), nullable=False)
    extracted_field_count = Column(Integer, nullable=False, default=0)
