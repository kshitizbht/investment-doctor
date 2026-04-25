# Investment Doctor — POC Plan

## Overview
A local web app that ingests financial data (W2 + brokerage PDFs) for a default user "John Doe" and surfaces tax intelligence as dashboard cards.

---

## Phase 1: Local E2E Scenario with Mock Customer

### Goals
- Working end-to-end flow with a hardcoded user (John Doe)
- PDF upload + parsing for brokerage statements
- Tax calculation engine covering equities, options, crypto, real estate
- Dashboard cards with actionable tax insights
- Seed data for John Doe so the app is immediately explorable without uploading anything

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 14 + Tailwind + shadcn/ui | Fast to build, good component library |
| Backend | FastAPI (Python 3.11) | Better for PDF parsing + financial math |
| Database | MySQL (local) | Simple, familiar, relational |
| PDF Parsing | pdfplumber | Best for table extraction from brokerage PDFs |
| ORM | SQLAlchemy | Works well with FastAPI + MySQL |
| Tax Logic | Pure Python | Deterministic, testable |

---

## Local Environment

| Setting | Value |
|---|---|
| Python | 3.11 |
| MySQL host | 127.0.0.1 · port 3306 |
| MySQL database | `investment_doctor` |
| MySQL user | `root` · password: *(none)* |
| FastAPI | http://localhost:8000 |
| Next.js | http://localhost:3000 |

```bash
# One-time DB creation
mysql -u root -e "CREATE DATABASE IF NOT EXISTS investment_doctor;"

# Backend
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# Frontend
npm install --prefix frontend
npm run dev --prefix frontend
```

### `backend/requirements.txt` (canonical list)
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
pymysql==1.1.1
pdfplumber==0.11.0
python-multipart==0.0.9
pytest==8.2.0
httpx==0.27.0        # for pytest FastAPI test client
```

---

## Project Structure

```
project_investment_doctor/
├── frontend/                  # Next.js app
│   ├── app/
│   │   ├── page.tsx           # Dashboard (main view)
│   │   ├── upload/page.tsx    # PDF upload page
│   │   └── layout.tsx
│   ├── components/
│   │   ├── cards/             # All dashboard card components
│   │   │   ├── TaxSummaryCard.tsx
│   │   │   ├── CapitalGainsCard.tsx
│   │   │   ├── HarvestingCard.tsx
│   │   │   ├── HoldingPeriodCard.tsx
│   │   │   └── AssetBreakdownCard.tsx
│   │   └── UploadDropzone.tsx
│   └── lib/api.ts             # API client
│
├── backend/                   # FastAPI app
│   ├── main.py
│   ├── db/
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── session.py         # DB connection
│   │   └── seed.py            # John Doe mock data
│   ├── routers/
│   │   ├── upload.py          # PDF upload & parse
│   │   ├── positions.py       # Portfolio positions
│   │   └── insights.py        # Tax calculations & card data
│   ├── services/
│   │   ├── anonymize.py       # round_up_to_100() — income anonymization
│   │   ├── pdf_parser.py      # pdfplumber extraction logic
│   │   └── tax_engine.py      # Core tax logic
│   └── requirements.txt
│
├── mock_data/                 # Sample PDFs + seed SQL
│   ├── john_doe_w2.pdf        # Fake W2
│   ├── john_doe_brokerage.pdf # Fake brokerage statement
│   └── seed_data.sql
│
└── PLAN.md
```

---

## Privacy & Data Handling

This app ingests documents that may contain sensitive personal data (SSN, full legal name, date of birth, home address). The following rules apply at every layer:

### What is never stored or logged
| Data type | Examples | Rule |
|---|---|---|
| Social Security Number | SSN on W2, 1099 | Never extracted, never stored, never logged |
| Full legal name | Name field on W2 | Not stored in DB; mock name ("John Doe") is only used as a display label in seed data |
| Date of birth | Any DOB field | Never extracted or stored |
| Home / mailing address | Taxpayer address on W2 | Discarded during parsing |
| Employer address / EIN | W2 box fields | Discarded during parsing |
| Raw document text | Full extracted text from pdfplumber | Never written to DB; parse → extract structured fields → discard |

### Income anonymization rule (`pdf_parser.py`, `tax_engine.py`, `seed.py`)
All income and AGI-derived values are **rounded up to the nearest $100** before being stored or used in any calculation. The goal is to understand income sources and tax brackets without retaining exact compensation figures.

- Applies to: W2 wages, federal/state tax withheld, AGI (W2 wages + realized gains), rental income, and any other income-type field extracted from a document.
- Does **not** apply to: per-share prices, cost basis per unit, quantities, or transaction-level amounts (rounding those would distort gain/loss math).
- Implementation: a single helper `round_up_to_100(value: float) -> int` lives in `services/anonymize.py` and is called by the parser and seed loader — nowhere else manages this rounding.

```python
import math
def round_up_to_100(value: float) -> int:
    return math.ceil(value / 100) * 100
```

### PDF parsing rules (`pdf_parser.py`)
- Use an explicit **allowlist** of fields to extract: wages, tax-withheld amounts, tickers, quantities, prices, dates, asset types.
- Everything outside the allowlist is discarded immediately after extraction.
- Income fields (wages, withheld amounts) are passed through `round_up_to_100()` before any further use.
- No raw text is written to disk or to the DB (see `uploads` schema below).
- No PII field is ever passed to `logging.*` or `print()`.

### Database rules
- `users` table holds only non-identifying attributes (`filing_status`, `state`). No name, DOB, SSN, or address.
- `real_estate` table uses a user-assigned **label** (e.g., "Rental – SF Condo") instead of a street address.
- `uploads` table stores only parse metadata (field counts, status), not raw text.

### File handling rules
- Uploaded PDFs are processed **in memory only** (via `UploadFile.read()`). They are not written to a temp path on disk.
- The `UploadFile` object is closed and garbage-collected immediately after parsing completes.

### Cloud boundary rule
- Phase 1 is fully local; no data leaves the machine.
- If/when an AI layer (e.g., Claude API) is added, only **numerical and categorical fields** (gains, losses, brackets, asset types) are sent. Names, SSNs, addresses, and raw document text are never included in any API request payload.

---

## Database Schema

```sql
-- Single default user for POC
-- NOTE: no name, DOB, SSN, or address — only attributes needed for tax math
users (id, filing_status, state)

-- W2 / income
-- NOTE: source is a non-identifying label (e.g. "employer_1"), not the employer name/EIN
w2_income (id, user_id, tax_year, wages, federal_tax_withheld, state_tax_withheld, source_label)

-- All holdings (equities, options, crypto, real estate)
positions (
  id, user_id, asset_type [stock|option|crypto|real_estate],
  ticker_or_name, quantity, cost_basis_per_unit, current_price,
  purchase_date, expiry_date [options],
  is_short [options], strike_price [options]
)

-- Realized transactions (from PDF or manual)
transactions (
  id, user_id, asset_type, ticker_or_name,
  action [buy|sell|exercise|expire],
  quantity, price_per_unit, total_proceeds, total_cost_basis,
  transaction_date, is_wash_sale
)

-- Real estate separately (more complex)
-- NOTE: label is a user-assigned non-identifying string (e.g. "Rental – SF Condo")
--       street address is never stored
real_estate (
  id, user_id, label, purchase_price, purchase_date,
  current_estimated_value, annual_rental_income,
  depreciation_taken, mortgage_interest_paid
)

-- Parsed PDF uploads (audit trail)
-- NOTE: raw_text is intentionally omitted — only parse metadata is stored
uploads (id, user_id, filename, upload_date, parsed_status, extracted_field_count)
```

---

## Dashboard Cards (Phase 1)

### Card 1 — Tax Snapshot
- Estimated AGI (W2 wages + realized gains)
- Federal tax bracket you're in
- Estimated year-end tax bill
- Delta vs last year (if data available)

### Card 2 — Capital Gains Summary
- Short-term realized gains/losses (taxed as ordinary income)
- Long-term realized gains/losses (preferential rate)
- Net capital gain/loss
- Breakdown by asset type (stocks, options, crypto, real estate)

### Card 3 — Tax Loss Harvesting Opportunities
- Positions currently at an unrealized loss
- Potential tax savings if harvested
- Wash sale warning (if similar position bought in last 30 days)
- Flag positions close to 1-year holding (hold vs sell decision)

### Card 4 — Holding Period Alerts
- Positions that flip from short-term to long-term within 90 days
- Estimated tax saving by waiting
- Options near expiry that trigger taxable events

### Card 5 — Asset Breakdown
- Portfolio composition by asset type
- Unrealized gain/loss per category
- Crypto: highlight positions with highest gain (HIFO vs FIFO note)

---

## John Doe Mock Scenario

John Doe is a 35-year-old software engineer, single filer, California resident.

All income values below are **already rounded up to the nearest $100** per the anonymization rule.

| Source | Detail |
|---|---|
| W2 Income | $180,000 (rounded up from exact figure) |
| Federal Withheld | $32,000 (rounded up) |
| State Withheld | $14,000 (rounded up) |
| **Stocks** | AAPL 50 shares @ $150 cost (now $220) — LTCG |
| | TSLA 30 shares @ $280 cost (now $195) — unrealized loss, harvesting candidate |
| | NVDA 20 shares @ $400 cost (now $480) — short-term (bought 8 months ago) |
| | AMZN 10 shares @ $190 cost (now $185) — small unrealized loss |
| **Realized (this year)** | Sold MSFT: $5,200 gain (long-term) |
| | Sold COIN: $2,100 loss (short-term) |
| **Options** | 2x AAPL $200 call (exp 3 months out, up 40%) |
| | 1x SPY $450 put (exp 6 weeks out, down 60%) — potential loss harvest |
| **Crypto** | 1.5 BTC @ $30,000 cost (now $65,000) — LTCG |
| | 10 ETH @ $3,200 cost (now $2,400) — unrealized loss |
| | 500 SOL @ $120 cost (now $145) — short-term gain |
| **Real Estate** | Rental condo, bought $450k, now ~$510k, $24k rental income/yr |

### Key insights this scenario should surface:
1. TSLA + ETH + AMZN + SPY put = ~$14,400 harvestable losses to offset MSFT gain + SOL gains
2. NVDA: hold 4 more months to qualify for LTCG rate (saves ~$1,800 at 22% bracket)
3. Rental income pushes AGI up — depreciation deduction reminder
4. Net capital position: roughly +$8k after harvesting, taxed at LTCG rate (15%)
5. Without harvesting: ~$4,200 more in taxes

---

## Build Order (Phase 1 Sprint)

Each step lists its prerequisite state, what to build, and a pointer to its verification gate.

---

### Step 1 · DB Setup
**Prerequisite:** MySQL is running on 127.0.0.1:3306; database `investment_doctor` exists (`CREATE DATABASE IF NOT EXISTS investment_doctor;`)

**Build:**
- Write `backend/db/schema.sql` with all CREATE TABLE statements from the schema above (no PII columns)
- Apply: `mysql -u root investment_doctor < backend/db/schema.sql`

**Verify:** § Verification Plan → Step 1

---

### Step 2 · FastAPI Backend + Anonymize
**Prerequisite:** Step 1 gate passes (tables exist, seed loaded, income values divisible by 100)

**Build:**
- `backend/main.py` — FastAPI app with `/health` route
- `backend/db/models.py` — SQLAlchemy models mirroring schema.sql
- `backend/db/session.py` — engine + `get_db` dependency
- `backend/db/seed.py` — inserts John Doe rows; calls `round_up_to_100()` on all income fields
- `backend/services/anonymize.py` — **create this first**:
  ```python
  import math
  def round_up_to_100(value: float) -> int:
      return math.ceil(value / 100) * 100
  ```
- `backend/tests/test_anonymize.py` — unit tests (see verification gate)

**Verify:** § Verification Plan → Step 2

---

### Step 3 · Tax Engine
**Prerequisite:** Step 2 gate passes (`/health` returns 200, `test_anonymize.py` passes)

**Build:**
- `backend/services/tax_engine.py`:
  - `compute_agi(user_id, db) -> int` — wages + net realized gains + rental income, then `round_up_to_100()`
  - `federal_bracket(agi, filing_status) -> dict` — returns `{rate, min, max}`; use 2024 brackets
  - `realized_gains(user_id, db) -> dict` — short-term and long-term totals by asset type
  - `harvesting_opportunities(user_id, db) -> list` — positions with unrealized loss; flag wash-sale risk
  - `holding_period_alerts(user_id, db) -> list` — positions within 90 days of LTCG flip
- `backend/tests/test_tax_engine.py` — assert John Doe expected values (see table in verification gate)

**Verify:** § Verification Plan → Step 3

---

### Step 4 · Insights API
**Prerequisite:** Step 3 gate passes (all tax engine assertions green)

**Build:**
- `backend/routers/insights.py` — `GET /api/insights` returns the response shape defined in § API Response Schema below
- Register router in `main.py`
- `backend/tests/test_insights.py` — integration test against seeded test DB

**Verify:** § Verification Plan → Step 4

---

### Step 5 · Next.js Frontend
**Prerequisite:** Step 4 gate passes (`/api/insights` returns valid JSON matching schema)

**Build:**
- `frontend/` — scaffold with `npx create-next-app@14 frontend --typescript --tailwind --app`
- Install shadcn/ui: `npx shadcn-ui@latest init` inside `frontend/`
- `frontend/lib/api.ts` — typed fetch wrapper for `/api/insights` using the schema in § API Response Schema
- One card component per card (see Project Structure); each receives its slice of the insights response as props

**Verify:** § Verification Plan → Step 5

---

### Step 6 · PDF Upload
**Prerequisite:** Step 5 gate passes (frontend builds, all 5 cards render)

**Build:**
- `backend/services/pdf_parser.py` — pdfplumber; allowlist extraction only; refer to `archive/parse_pdf.py` for table parsing patterns
- `backend/routers/upload.py` — `POST /api/upload`; read bytes in memory, parse, insert positions/transactions, discard bytes
- `frontend/components/UploadDropzone.tsx` — drag-and-drop; POST to `/api/upload`
- `frontend/app/upload/page.tsx`
- `backend/tests/test_pdf_parser.py`

**Verify:** § Verification Plan → Step 6

---

### Step 7 · Wire It Together
**Prerequisite:** Step 6 gate passes (upload parses real PDFs without error)

**Build:**
- After upload completes, frontend re-fetches `/api/insights` and re-renders all cards
- Confirm cards reflect uploaded positions beyond the seed data

**Verify:** § Verification Plan → Step 7

---

### Step 8 · E2E Test
**Prerequisite:** Step 7 gate passes (diff shows cards change after upload)

**Build:**
- `backend/tests/test_e2e.py` — full scenario: drop schema → recreate → seed → assert insights → upload PDF → assert row counts increase → assert insights still valid schema

**Verify:** § Verification Plan → Step 8

---

### Step 9 · PII Audit
**Prerequisite:** Step 8 gate passes (E2E green)

**Build:** no new code — run the grep commands in the verification gate and fix any hits

**Verify:** § Verification Plan → Step 9

---

## API Response Schema

`GET /api/insights` returns a single JSON object. Both the backend router and the frontend
`lib/api.ts` types must match this shape exactly.

```jsonc
{
  "tax_snapshot": {
    "agi": 219600,                     // int, rounded up to nearest 100
    "federal_bracket_pct": 32,         // int (marginal rate %)
    "estimated_federal_tax": 47200,    // int
    "estimated_state_tax": 19800       // int (CA rate applied to AGI)
  },

  "capital_gains": {
    "short_term_realized": -2100,      // int (negative = net loss)
    "long_term_realized": 5200,        // int
    "net_realized": 3100,              // int = short + long
    "by_asset_type": {
      "stocks":      { "short_term": -2100, "long_term": 5200 },
      "options":     { "short_term": 0,     "long_term": 0    },
      "crypto":      { "short_term": 0,     "long_term": 0    },
      "real_estate": { "short_term": 0,     "long_term": 0    }
    }
  },

  "harvesting": {
    "opportunities": [
      {
        "ticker_or_name": "TSLA",
        "asset_type": "stock",          // "stock"|"option"|"crypto"|"real_estate"
        "unrealized_loss": -2550,       // int, always negative here
        "wash_sale_risk": false         // bool: similar position bought in last 30 days
      }
      // ... one entry per harvestable position
    ],
    "total_harvestable_loss": -14400,   // int, sum of unrealized_loss above
    "estimated_tax_savings": 4200       // int, |total_harvestable_loss| * marginal_rate
  },

  "holding_period_alerts": [
    {
      "ticker_or_name": "NVDA",
      "asset_type": "stock",
      "days_until_ltcg": 120,           // int
      "estimated_tax_saving": 1800      // int: tax saved by waiting
    }
    // ... one entry per position within 90 days of LTCG flip
  ],

  "asset_breakdown": {
    "by_type": {
      "stocks":      { "unrealized_gain_loss": 950,   "pct_of_portfolio": 45 },
      "options":     { "unrealized_gain_loss": -200,  "pct_of_portfolio": 5  },
      "crypto":      { "unrealized_gain_loss": 55300, "pct_of_portfolio": 35 },
      "real_estate": { "unrealized_gain_loss": 60000, "pct_of_portfolio": 15 }
    }
  }
}
```

### Notes
- All dollar amounts are integers (no decimals) to avoid floating-point display bugs.
- `agi` and all income-derived fields have already been through `round_up_to_100()` before this response is built.
- `pct_of_portfolio` values are whole-number percentages; they must sum to 100.
- The frontend TypeScript types in `lib/api.ts` must mirror this structure exactly.

---

## Phase 1 — Verification Plan

Each build step has a defined "done" gate. A step is not complete until its gate passes cleanly.

---

### Step 1 · DB Setup

**Gate: schema loads and seed data is correct**

```bash
# Apply schema
mysql -u root investment_doctor < backend/db/schema.sql

# Load seed
python -m backend.db.seed

# Verify tables exist
mysql -u root investment_doctor -e "SHOW TABLES;"
# Expected: uploads, users, w2_income, positions, transactions, real_estate

# Verify John Doe income is rounded to nearest 100
mysql -u root investment_doctor -e "SELECT wages, federal_tax_withheld, state_tax_withheld FROM w2_income;"
# Expected: all values divisible by 100 (e.g. 180000, 32000, 14000)

# Verify no PII columns exist
mysql -u root investment_doctor -e "DESCRIBE users;"
# Expected: only id, filing_status, state — no name/ssn/dob/address columns
```

---

### Step 2 · FastAPI Backend + Anonymize

**Gate: server starts, health check passes, `round_up_to_100` unit tests pass**

```bash
# Unit tests for anonymize helper
pytest backend/tests/test_anonymize.py -v
# Must cover: already-rounded value, fractional cents, zero, large number
# e.g. round_up_to_100(179_423) == 179_500
#      round_up_to_100(32_000)  == 32_000
#      round_up_to_100(0)       == 0

# Start server
uvicorn backend.main:app --reload

# Health check
curl http://localhost:8000/health
# Expected: {"status": "ok"}
```

---

### Step 3 · Tax Engine

**Gate: pytest passes for all John Doe expected values**

```bash
pytest backend/tests/test_tax_engine.py -v
```

Tests must assert the following John Doe outputs (hardcoded expected values):

| Calculation | Expected |
|---|---|
| AGI (wages + net gains + rental, rounded up) | $219,600 |
| Federal bracket (single filer) | 32% |
| AAPL LTCG | +$3,500 |
| BTC LTCG | +$52,500 |
| TSLA unrealized loss | -$2,550 |
| ETH unrealized loss | -$8,000 |
| AMZN unrealized loss | -$500 |
| Net realized gain (MSFT - COIN) | +$3,100 |
| Total harvestable losses (TSLA+ETH+AMZN+SPY put) | ~$14,400 |
| NVDA days until LTCG flip | ~120 days |
| Tax saving by waiting on NVDA | ~$1,800 |

---

### Step 4 · Insights API

**Gate: endpoint returns valid JSON matching John Doe numbers**

```bash
# Integration test against seeded test DB
pytest backend/tests/test_insights.py -v

# Manual smoke test
curl http://localhost:8000/api/insights | python -m json.tool
# Expected: JSON object with keys: tax_snapshot, capital_gains, harvesting,
#           holding_period_alerts, asset_breakdown
# Values must match tax engine assertions above
```

---

### Step 5 · Next.js Frontend

**Gate: build succeeds, all 5 cards render with data**

```bash
cd frontend

# Type-check and build
npm run build
# Expected: zero TypeScript errors, zero build errors

# Dev server
npm run dev
# Expected: starts on http://localhost:3000
```

Manual checks (open browser to `localhost:3000`):
- [ ] TaxSummaryCard shows AGI, bracket, estimated bill
- [ ] CapitalGainsCard shows LTCG vs STCG breakdown
- [ ] HarvestingCard lists TSLA, ETH, AMZN, SPY put with loss amounts
- [ ] HoldingPeriodCard shows NVDA "hold ~120 days" alert
- [ ] AssetBreakdownCard shows stocks / crypto / real estate allocation
- [ ] No browser console errors

---

### Step 6 · PDF Upload

**Gate: real Wells Fargo PDFs parse without PII leaking into DB**

```bash
# Unit test parser with sample bytes
pytest backend/tests/test_pdf_parser.py -v
# Must assert: SSN field absent from returned dict,
#              only allowlisted fields present (tickers, quantities, prices, dates)

# Integration test with real PDFs (already in repo)
curl -X POST http://localhost:8000/api/upload \
  -F "file=@brok_wells_fargo_costbasis.pdf"
# Expected: JSON of parsed positions — no name/SSN/address fields

curl -X POST http://localhost:8000/api/upload \
  -F "file=@brok_wells_fargo_march_statement.pdf"
# Expected: same

# Verify DB state after upload
mysql -u root investment_doctor -e \
  "SELECT COUNT(*) FROM positions; SELECT COUNT(*) FROM transactions;"
# Counts should increase — no errors
```

---

### Step 7 · Wire It Together

**Gate: upload refreshes card data beyond seed values**

```bash
# Baseline: record insights from seed only
curl http://localhost:8000/api/insights > before_upload.json

# Upload a PDF
curl -X POST http://localhost:8000/api/upload \
  -F "file=@brok_wells_fargo_costbasis.pdf"

# Check insights changed
curl http://localhost:8000/api/insights > after_upload.json
diff before_upload.json after_upload.json
# Expected: position counts or gain/loss totals differ
```

---

### Step 8 · E2E Test

**Gate: automated full-scenario script passes from scratch**

```bash
pytest backend/tests/test_e2e.py -v
```

Script flow:
1. Drop and recreate schema (clean slate)
2. Run seed loader
3. Assert all 5 insight cards match John Doe expected values (from Step 3 table)
4. Upload `brok_wells_fargo_costbasis.pdf`
5. Assert positions table row count increased
6. Assert insights endpoint still returns valid schema

---

### Step 9 · PII Audit

**Gate: zero PII in DB write paths or log calls**

```bash
# Check for PII field names in Python source (excluding test files and comments)
grep -rn "ssn\|social_security\|\.name\b\|\"name\"\|'name'\|\baddress\b\|\bdob\b\|date_of_birth" \
  backend/ --include="*.py" | grep -v "^.*#\|test_"
# Expected: zero matches in any DB write or model definition

# Check log calls don't carry income/identity values
grep -rn "logging\.\(info\|debug\|warning\|error\|exception\)\|print(" \
  backend/ --include="*.py"
# Review each result manually — none should reference wages, name, SSN, or address

# Confirm raw_text is never assigned or inserted
grep -rn "raw_text" backend/ --include="*.py"
# Expected: zero matches (column intentionally omitted from schema)
```

---

## Out of Scope for Phase 1
- Authentication / user accounts
- Plaid / live brokerage connections
- Email alerts
- AI/Claude recommendations
- Production deployment
- Multi-year comparison
