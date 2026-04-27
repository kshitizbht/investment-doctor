-- Reference DDL (SQLite syntax). Schema is managed in practice by SQLAlchemy ORM
-- via Base.metadata.create_all() in backend/db/session.py.
-- To migrate to MySQL/Postgres: change INTEGER PRIMARY KEY AUTOINCREMENT → INT AUTO_INCREMENT PRIMARY KEY.

-- No PII columns (no name, SSN, DOB, address, EIN)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filing_status VARCHAR(20) NOT NULL,
    state VARCHAR(2) NOT NULL
);

-- source_label is a non-identifying tag (e.g. "employer_1"), never the employer name or EIN
CREATE TABLE IF NOT EXISTS w2_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tax_year INTEGER NOT NULL,
    wages INTEGER NOT NULL,
    federal_tax_withheld INTEGER NOT NULL,
    state_tax_withheld INTEGER NOT NULL,
    source_label VARCHAR(50) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    asset_type VARCHAR(20) NOT NULL,
    ticker_or_name VARCHAR(50) NOT NULL,
    quantity DECIMAL(18,8) NOT NULL,
    cost_basis_per_unit DECIMAL(18,4) NOT NULL,
    current_price DECIMAL(18,4) NOT NULL,
    purchase_date DATE NOT NULL,
    expiry_date DATE NULL,
    is_short INTEGER NULL,
    strike_price DECIMAL(18,4) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    asset_type VARCHAR(20) NOT NULL,
    ticker_or_name VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    quantity DECIMAL(18,8) NOT NULL,
    price_per_unit DECIMAL(18,4) NOT NULL,
    total_proceeds DECIMAL(18,4) NOT NULL,
    total_cost_basis DECIMAL(18,4) NOT NULL,
    transaction_date DATE NOT NULL,
    is_wash_sale INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- label is a user-assigned non-identifying string; street address is never stored
CREATE TABLE IF NOT EXISTS real_estate (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label VARCHAR(100) NOT NULL,
    purchase_price INTEGER NOT NULL,
    purchase_date DATE NOT NULL,
    current_estimated_value INTEGER NOT NULL,
    annual_rental_income INTEGER NOT NULL,
    depreciation_taken INTEGER NOT NULL DEFAULT 0,
    mortgage_interest_paid INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    snapshot_date DATE NOT NULL,
    stocks_value INTEGER NOT NULL DEFAULT 0,
    real_estate_value INTEGER NOT NULL DEFAULT 0,
    income_value INTEGER NOT NULL DEFAULT 0,
    total_net_worth INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Only parse metadata stored; raw_text intentionally omitted
CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    upload_date DATETIME NOT NULL,
    parsed_status VARCHAR(20) NOT NULL,
    extracted_field_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
