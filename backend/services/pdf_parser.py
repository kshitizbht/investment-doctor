"""
PDF parser for brokerage statements.

Allowlist extraction only — every field not on the allowlist is discarded
immediately. No raw text reaches the database or logs.

Handles two document types:
  - cost_basis  : realized gain/loss tables (ticker, qty, buy date, cost, sale date, proceeds)
  - statement   : holdings/positions tables (ticker, qty, price, market value)
"""
import io
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

import pdfplumber


@dataclass
class ParsedPosition:
    ticker: str
    quantity: float
    cost_basis_per_unit: float
    current_price: float
    asset_type: str = "stock"
    purchase_date: Optional[date] = None


@dataclass
class ParsedTransaction:
    ticker: str
    action: str
    quantity: float
    price_per_unit: float
    total_proceeds: float
    total_cost_basis: float
    transaction_date: date
    asset_type: str = "stock"
    is_wash_sale: bool = False


@dataclass
class ParseResult:
    positions: list[ParsedPosition] = field(default_factory=list)
    transactions: list[ParsedTransaction] = field(default_factory=list)
    extracted_field_count: int = 0


# Allowed column header patterns (lowercase, stripped)
_TICKER_HEADERS = {"symbol", "ticker", "security", "cusip"}
_QTY_HEADERS = {"quantity", "qty", "shares", "units"}
_PRICE_HEADERS = {"price", "market price", "close price", "unit price", "sale price"}
_COST_HEADERS = {"cost basis", "cost/share", "avg cost", "purchase price", "cost per share"}
_DATE_HEADERS = {"date", "trade date", "settlement date", "purchase date", "acquisition date",
                 "sale date", "transaction date"}
_PROCEEDS_HEADERS = {"proceeds", "sale proceeds", "gross proceeds", "total proceeds"}
_ACTION_HEADERS = {"action", "type", "transaction type", "transaction"}

# SSN-like patterns to detect and discard rows with PII
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")


def _clean_float(val: str) -> Optional[float]:
    if not val:
        return None
    val = val.strip().replace(",", "").replace("$", "").replace("(", "-").replace(")", "")
    try:
        return float(val)
    except ValueError:
        return None


def _clean_date(val: str) -> Optional[date]:
    if not val:
        return None
    val = val.strip()
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            from datetime import datetime
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return None


def _col_index(header_row: list, targets: set) -> Optional[int]:
    for i, cell in enumerate(header_row):
        if cell and cell.strip().lower() in targets:
            return i
    return None


def _parse_table(table: list[list]) -> tuple[list[ParsedPosition], list[ParsedTransaction]]:
    if not table or len(table) < 2:
        return [], []

    # Find the header row (first row with recognizable column names)
    header = [str(c).strip().lower() if c else "" for c in table[0]]

    ticker_col = _col_index(header, _TICKER_HEADERS)
    qty_col = _col_index(header, _QTY_HEADERS)
    price_col = _col_index(header, _PRICE_HEADERS)
    cost_col = _col_index(header, _COST_HEADERS)
    date_col = _col_index(header, _DATE_HEADERS)
    proceeds_col = _col_index(header, _PROCEEDS_HEADERS)

    if ticker_col is None or qty_col is None:
        return [], []

    positions: list[ParsedPosition] = []
    transactions: list[ParsedTransaction] = []

    for row in table[1:]:
        if not row:
            continue

        # Discard any row that looks like it contains a SSN
        row_text = " ".join(str(c) for c in row if c)
        if _SSN_RE.search(row_text):
            continue

        ticker = str(row[ticker_col]).strip().upper() if row[ticker_col] else None
        if not ticker or len(ticker) > 10 or not ticker.isalpha():
            continue

        qty = _clean_float(str(row[qty_col])) if row[qty_col] else None
        if qty is None:
            continue

        price = _clean_float(str(row[price_col])) if price_col is not None and row[price_col] else None
        cost = _clean_float(str(row[cost_col])) if cost_col is not None and row[cost_col] else None
        proceeds = _clean_float(str(row[proceeds_col])) if proceeds_col is not None and row[proceeds_col] else None
        txn_date = _clean_date(str(row[date_col])) if date_col is not None and row[date_col] else None

        if proceeds is not None and cost is not None and txn_date is not None:
            # This looks like a realized transaction row
            transactions.append(ParsedTransaction(
                ticker=ticker,
                action="sell",
                quantity=qty,
                price_per_unit=price or (proceeds / qty if qty else 0),
                total_proceeds=proceeds,
                total_cost_basis=cost * qty if cost else 0,
                transaction_date=txn_date,
            ))
        elif price is not None:
            # Open position row
            cost_per_unit = cost if cost is not None else price
            positions.append(ParsedPosition(
                ticker=ticker,
                quantity=qty,
                cost_basis_per_unit=cost_per_unit,
                current_price=price,
                purchase_date=txn_date,
            ))

    return positions, transactions


def parse_brokerage_pdf(pdf_bytes: bytes) -> ParseResult:
    """
    Parse a brokerage PDF from raw bytes (never written to disk).
    Returns only allowlisted structured fields — no raw text is retained.
    """
    result = ParseResult()

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue
                positions, transactions = _parse_table(table)
                result.positions.extend(positions)
                result.transactions.extend(transactions)

    result.extracted_field_count = len(result.positions) + len(result.transactions)
    return result
