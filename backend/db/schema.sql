-- No PII columns (no name, SSN, DOB, address, EIN)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filing_status VARCHAR(20) NOT NULL,
    state VARCHAR(2) NOT NULL
);

-- source_label is a non-identifying tag (e.g. "employer_1"), never the employer name or EIN
CREATE TABLE IF NOT EXISTS w2_income (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tax_year INT NOT NULL,
    wages INT NOT NULL,
    federal_tax_withheld INT NOT NULL,
    state_tax_withheld INT NOT NULL,
    source_label VARCHAR(50) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    asset_type VARCHAR(20) NOT NULL,
    ticker_or_name VARCHAR(50) NOT NULL,
    quantity DECIMAL(18,8) NOT NULL,
    cost_basis_per_unit DECIMAL(18,4) NOT NULL,
    current_price DECIMAL(18,4) NOT NULL,
    purchase_date DATE NOT NULL,
    expiry_date DATE NULL,
    is_short TINYINT(1) NULL,
    strike_price DECIMAL(18,4) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    asset_type VARCHAR(20) NOT NULL,
    ticker_or_name VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    quantity DECIMAL(18,8) NOT NULL,
    price_per_unit DECIMAL(18,4) NOT NULL,
    total_proceeds DECIMAL(18,4) NOT NULL,
    total_cost_basis DECIMAL(18,4) NOT NULL,
    transaction_date DATE NOT NULL,
    is_wash_sale TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- label is a user-assigned non-identifying string; street address is never stored
CREATE TABLE IF NOT EXISTS real_estate (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    label VARCHAR(100) NOT NULL,
    purchase_price INT NOT NULL,
    purchase_date DATE NOT NULL,
    current_estimated_value INT NOT NULL,
    annual_rental_income INT NOT NULL,
    depreciation_taken INT NOT NULL DEFAULT 0,
    mortgage_interest_paid INT NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Only parse metadata stored; raw_text intentionally omitted
CREATE TABLE IF NOT EXISTS uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    upload_date DATETIME NOT NULL,
    parsed_status VARCHAR(20) NOT NULL,
    extracted_field_count INT NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
