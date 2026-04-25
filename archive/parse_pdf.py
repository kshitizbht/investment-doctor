"""
PDF → parsed positions using pdfplumber.
Handles Finviz screener exports and brokerage statement tables.
"""

import pdfplumber
import json
import sys
from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class Position:
    ticker: str
    company: str
    sector: Optional[str]
    industry: Optional[str]
    country: Optional[str]
    market_cap: Optional[str]
    pe_ratio: Optional[str]
    price: Optional[float]
    change_pct: Optional[str]
    volume: Optional[int]


SCREENER_COLUMNS = [
    "no", "ticker", "company", "sector", "industry",
    "country", "market_cap", "pe", "price", "change", "volume",
]


def clean_number(val: str) -> Optional[float]:
    if not val or val in ("-", ""):
        return None
    try:
        return float(val.replace(",", "").replace("%", "").strip())
    except ValueError:
        return None


def clean_volume(val: str) -> Optional[int]:
    n = clean_number(val)
    return int(n) if n is not None else None


def parse_screener_table(rows: list[list]) -> list[Position]:
    positions = []
    for row in rows:
        if not row or not row[0]:
            continue
        # Skip header rows (first cell is not a number)
        try:
            int(row[0])
        except (ValueError, TypeError):
            continue

        if len(row) < 11:
            continue

        positions.append(Position(
            ticker=row[1] or "",
            company=row[2] or "",
            sector=row[3],
            industry=row[4],
            country=row[5],
            market_cap=row[6],
            pe_ratio=row[7],
            price=clean_number(row[8]),
            change_pct=row[9],
            volume=clean_volume(row[10]),
        ))
    return positions


def parse_pdf(path: str) -> list[Position]:
    positions = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue
                # Detect screener table by column count and first data row
                if len(table) > 1 and len(table[0]) >= 11:
                    parsed = parse_screener_table(table)
                    positions.extend(parsed)
    return positions


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "test.pdf"
    print(f"Parsing: {path}\n")

    positions = parse_pdf(path)

    print(f"Parsed {len(positions)} positions\n")
    print(f"{'#':<4} {'Ticker':<8} {'Company':<45} {'Price':>8} {'Change':>8} {'Volume':>12}")
    print("-" * 90)
    for i, p in enumerate(positions, 1):
        price = f"${p.price:.2f}" if p.price else "-"
        vol = f"{p.volume:,}" if p.volume else "-"
        print(f"{i:<4} {p.ticker:<8} {p.company:<45} {price:>8} {p.change_pct or '-':>8} {vol:>12}")

    out_path = path.replace(".pdf", "_positions.json")
    with open(out_path, "w") as f:
        json.dump([asdict(p) for p in positions], f, indent=2)
    print(f"\nSaved to {out_path}")


if __name__ == "__main__":
    main()
