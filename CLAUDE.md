# Investment Doctor — Claude Session Context

## What This Is
A local-only web app that ingests W2 + brokerage PDFs for a mock user ("John Doe") and
surfaces tax intelligence as 5 dashboard cards. No auth, no cloud, no production deployment
in Phase 1. See `PLAN.md` for full build plan and verification gates.

---

## Current State
**Phase 1 · Last completed step: 0 (git + plan only — ready to start Step 1)**

> Before clearing context, update this line to the step number just finished, then commit:
> `git add CLAUDE.md && git commit -m "handoff: completed step N"`

---

## Local Environment

| Setting | Value |
|---|---|
| Python | 3.11 |
| MySQL host | 127.0.0.1 |
| MySQL port | 3306 |
| MySQL database | `investment_doctor` |
| MySQL user | `root` |
| MySQL password | *(none — local dev only)* |
| FastAPI port | 8000 |
| Next.js port | 3000 |

### One-time setup
```bash
# Create the database (run once)
mysql -u root -e "CREATE DATABASE IF NOT EXISTS investment_doctor;"

# Install Python deps (from backend/)
pip install -r backend/requirements.txt

# Install Node deps (from frontend/)
npm install --prefix frontend
```

### Start services
```bash
# Backend (from project root)
uvicorn backend.main:app --reload --port 8000

# Frontend (from project root)
npm run dev --prefix frontend   # → http://localhost:3000
```

---

## Hard Rules — Never Break These

These apply to every file you write. No exceptions.

| # | Rule |
|---|---|
| 1 | **No PII in DB or logs** — no name, SSN, DOB, address, EIN, or employer name in any table, log call, or print statement |
| 2 | **Income always rounded up to nearest $100** — call `round_up_to_100()` from `backend/services/anonymize.py` on wages, withheld taxes, AGI, and rental income before storing or returning values |
| 3 | **PDFs never written to disk** — process via `UploadFile.read()` in memory; discard the bytes immediately after parsing |
| 4 | **Raw PDF text never stored** — only structured fields (tickers, quantities, prices, dates) reach the DB |
| 5 | **`raw_text` column must not exist** anywhere in the schema or models |

---

## Key Files

| Path | Purpose |
|---|---|
| `PLAN.md` | Full build order, verification gates, API schema — source of truth |
| `CLAUDE.md` | This file — session handoff context |
| `backend/db/schema.sql` | MySQL CREATE TABLE statements |
| `backend/db/seed.py` | John Doe mock data loader (uses `round_up_to_100`) |
| `backend/services/anonymize.py` | `round_up_to_100(value) -> int` — create this first in Step 2 |
| `backend/services/tax_engine.py` | Gain/loss calc, bracket lookup, harvesting scorer |
| `backend/services/pdf_parser.py` | pdfplumber extraction — allowlist only, no raw text |
| `backend/routers/insights.py` | GET `/api/insights` — see API schema in `PLAN.md` |
| `frontend/components/cards/` | One component per dashboard card |
| `archive/parse_pdf.py` | Reference pdfplumber parser (screener-style table extraction) |

---

## Phase Handoff Checklist

Run this before every context clear:

1. Run the verification gate for the step you just finished (commands in `PLAN.md`)
2. Confirm gate passes cleanly — fix any failures before clearing
3. Update **Current State** above to the completed step number
4. `git add CLAUDE.md && git commit -m "handoff: completed step N"`
5. Clear context — the next session will read this file automatically
