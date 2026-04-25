# Investment Doctor — Claude Session Context

## What This Is
A local-only web app that ingests W2 + brokerage PDFs for a mock user ("John Doe") and
surfaces tax intelligence as 5 dashboard cards. No auth, no cloud, no production deployment
in Phase 1. See `PLAN.md` for full build plan and verification gates.

The UI has 3 tabs (all at `http://localhost:3000`):
- **Demo** — reads from MySQL via `GET /api/insights`, shows live 5-card dashboard
- **Calculator** — editable sidebar (income, positions, real estate); calls `POST /api/simulate` with a fresh SQLite in-memory session per request; cards update in real-time (~350ms debounce)
- **My Account** — static "coming soon" placeholder (future phase)

---

## Current State
**Phase 1 complete + 3-Tab UI added (post-Step 9 feature)**

All backend code, 33/33 tests pass against MySQL, and frontend builds clean.
MySQL manually installed at /usr/local/mysql-9.7.0-macos15-arm64/ with root/P455w0rd (stored in .env).
Schema applied, seed loaded, all verification gates (Steps 1–9) pass cleanly.

### Recent feature: 3-Tab UI + `/api/simulate`
- Added `backend/routers/simulate.py` — `POST /api/simulate`, SQLite in-memory per request, same response shape as `/api/insights`
- Redesigned frontend with "Terminal Intelligence" dark theme: `#070B12` bg, amber `#F5A623` accent, Syne + Space Mono + DM Sans fonts, dot-grid CSS backdrop, staggered card animations
- Added `TabNav`, `DashboardCards`, `Calculator`, `AccountPlaceholder` components
- `Calculator.tsx` contains `DEMO_DEFAULTS` constant that mirrors `backend/db/seed.py` exactly — keep these in sync if seed data changes
- Plan saved at `docs/plan-three-tabs.md`

Note on seed data deviations from PLAN.md scenario:
- AMZN qty=100 (not 10) — 100×(-$5) = -$500 matches expected unrealized loss
- NVDA current_price=$929 (not $480) — 20×$529×17% = ~$1,800 matches expected tax saving
- SOL appears as realized transactions (bought Jul 2024 @ $120, sold Nov 2024 @ $145)
  to add $12,500 STCG and bring AGI to $219,600
- Holding-period alert window: 180 days (not 90) — NVDA is 123 days away from LTCG

> Before clearing context, update this section, then commit:
> `git add CLAUDE.md && git commit -m "handoff: <description>"`

---

## Local Environment

| Setting | Value |
|---|---|
| Python | 3.11 |
| MySQL host | 127.0.0.1 |
| MySQL port | 3306 |
| MySQL database | `investment_doctor` |
| MySQL user | `root` |
| MySQL password | `P455w0rd` (set via `.env` → `MYSQL_PASSWORD`) |
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
| `docs/plan-three-tabs.md` | Implementation plan for the 3-tab UI feature |
| `backend/db/schema.sql` | MySQL CREATE TABLE statements |
| `backend/db/seed.py` | John Doe mock data loader (uses `round_up_to_100`) |
| `backend/services/anonymize.py` | `round_up_to_100(value) -> int` |
| `backend/services/tax_engine.py` | Gain/loss calc, bracket lookup, harvesting scorer |
| `backend/services/pdf_parser.py` | pdfplumber extraction — allowlist only, no raw text |
| `backend/routers/insights.py` | `GET /api/insights` — reads from MySQL |
| `backend/routers/simulate.py` | `POST /api/simulate` — SQLite in-memory, same response shape |
| `frontend/app/page.tsx` | Tab controller (Demo / Calculator / My Account) |
| `frontend/components/TabNav.tsx` | Fixed header with 3 tabs, amber underline |
| `frontend/components/DashboardCards.tsx` | Shared 5-card grid; used by Demo tab and Calculator right panel |
| `frontend/components/Calculator.tsx` | Sidebar form + debounced simulate; `DEMO_DEFAULTS` mirrors seed.py |
| `frontend/components/AccountPlaceholder.tsx` | Coming soon placeholder |
| `frontend/components/cards/` | 5 card components (dark-themed) |
| `frontend/lib/api.ts` | API client — `fetchInsights()`, `simulateInsights()`, all TS types |
| `archive/parse_pdf.py` | Reference pdfplumber parser |

### Python environment note
Use `pytest` directly (on PATH at `/Library/Frameworks/Python.framework/Versions/3.12/bin/pytest`). Do NOT use `python` or `python3` — brew installed Python 3.14 which lacks the project's packages.

---

## Phase Handoff Checklist

Run this before every context clear:

1. Run the verification gate for the step you just finished (commands in `PLAN.md`)
2. Confirm gate passes cleanly — fix any failures before clearing
3. Update **Current State** above to the completed step number
4. `git add CLAUDE.md && git commit -m "handoff: completed step N"`
5. Clear context — the next session will read this file automatically
