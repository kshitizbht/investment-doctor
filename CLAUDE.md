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
**Phase 1 complete + 3-Tab UI + Dashboard Enhancements + Ask Claude + High-Income W2 Advisor**

All backend code, 33/33 tests pass against MySQL, and frontend builds clean.
MySQL manually installed at /usr/local/mysql-9.7.0-macos15-arm64/ with root/P455w0rd (stored in .env).
Schema applied, seed loaded, all verification gates (Steps 1–9) pass cleanly.

### Feature batch: High-Income W2 Advisor (latest)

**Accuracy fixes in `tax_engine.py`:**
- Bracket accumulation tax (`federal_tax_exact()`) — replaces wrong `AGI × marginal_rate`
- Standard deduction subtracted before brackets (filing-status-aware, all 4 statuses)
- NIIT 3.8% on net investment income when AGI > $200k/$250k (MFJ)
- Medicare surtax 0.9% on wages above $200k/$250k
- CA LTCG treated as ordinary income (no federal LTCG rates for CA)
- Full filing-status bracket tables: single, MFJ, MFS, HOH

**New tax engine functions (all additive — existing functions unchanged):**
- `federal_tax_exact()`, `_ltcg_tax_stacked()`, `federal_tax_with_ltcg()`
- `compute_niit()`, `compute_medicare_surtax()`, `compute_agi_extended()`
- `marginal_rate_stack()`, `compute_rsu_analysis()`, `compute_retirement_optimizer()`
- `compute_income_character()`, `compute_deduction_optimizer()`, `compute_tax_balance()`

**New dashboard cards:**
- `TaxBalanceCard` — owe/refund callout, full tax breakdown rows, underpayment warning
- `MarginalRateCard` — stacked bar: federal + NIIT + Medicare surtax + state, for ordinary vs LTCG; "keep per $1000" callout
- `EquityCard` — RSU vested income, supplemental withholding gap (amber/red), per-grant rows with next vest date
- `RetirementCard` — progress bars for 401k/HSA/IRA, room remaining, tax savings if maxed
- `IncomeCharacterCard` — horizontal bars per income stream, color-coded ordinary (amber) vs LTCG (green)
- `TaxSummaryCard` updated — deduction optimizer inline (standard vs. itemized comparison)

**Calculator new sidebar sections:**
- **Equity Comp (RSU/ESPP)** — add/remove grants; ticker, shares vested, FMV at vest, shares sold at vest, current price, next vest
- **Retirement** — 401k, HSA, IRA YTD contributions
- **Deductions** — charitable donations, property tax paid (SALT)
- **Income section expanded** — bonus, other income, qualified dividends, fed/state withheld (2-col)
- **Real estate** — mortgage interest field added per property

**Ask Claude upgrades:**
- Multi-turn conversation with full history passed on each turn
- Snapshot in system prompt (not repeated per message)
- Inline markdown renderer (bold, code, headers, bullets, numbered lists, dividers)
- Chat bubble UI, "new chat" button, reply count badge, quick-follow chips

### Feature batch: Dashboard enhancements + Calculator improvements

**New cards:**
- `NetWorthCard` — full-width, above the card grid. Shows total net worth, a color-coded breakdown bar (stocks/RE/income), and a pure-SVG line chart with hover tooltip. Historical data comes from `net_worth_snapshots` table (40 monthly rows seeded Jan 2023–Apr 2026).
- `UnrealizedGainsCard` — inserted between Capital Gains and Harvesting cards. Per-type rows + gains-vs-losses summary bar.

**Redesigned cards:**
- `CapitalGainsCard` — ST/LT in 2-col grid with background boxes; Net Realized as full-width highlighted row; per-type breakdown rows.
- `TaxSummaryCard` — AGI as full-width amber box; Federal Bracket | State Bracket in 2-col grid; Est. Federal Tax | Est. State Tax in 2-col grid.

**Calculator improvements:**
- Add/remove individual open positions (click colored dot to cycle type: stock→crypto→option)
- Add/remove multiple real estate properties
- "Clear All" button (zeroes everything) + "Reset Demo" button
- Column order: `Qty | Mkt$ | Basis` (Mkt$ before Basis to eliminate confusion)
- AbortController cancels stale in-flight simulate requests on re-type

**Backend additions:**
- `net_worth_snapshots` table + `NetWorthSnapshot` SQLAlchemy model
- 40-month historical net worth data seeded in `seed.py`
- `compute_net_worth()`, `net_worth_history()`, `state_bracket_pct()` in `tax_engine.py`
- `GET /api/net-worth` endpoint (`backend/routers/net_worth.py`)
- `real_estate_list: List[RealEstateInput]` (was single optional) in simulate + frontend
- State bracket lookup replaces hardcoded CA rate in both `insights.py` and `simulate.py`

### Feature: Ask Claude (`POST /api/ask-claude`)
- `backend/routers/ask_claude.py` — SSE streaming, `claude-opus-4-7`, tax-advisor system prompt
- `frontend/components/AskClaude.tsx` — collapsible panel, preset chips, amber cursor animation
- `anthropic>=0.30.0` added to `requirements.txt`
- **Required:** add `ANTHROPIC_API_KEY=sk-ant-...` to `.env`, then restart backend

### Seed data deviations from PLAN.md scenario
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
| Python | 3.12 (`/Library/Frameworks/Python.framework/Versions/3.12/bin/python3`) |
| Database | SQLite — `investment_doctor.db` at project root (git-ignored via `*.db`) |
| FastAPI port | 8000 |
| Next.js port | 3000 |

### One-time setup
```bash
# Install Python deps (from backend/)
pip install -r backend/requirements.txt

# Seed demo data (creates investment_doctor.db automatically)
python3 -m backend.db.seed

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
| `backend/db/schema.sql` | Reference DDL (SQLite syntax) — schema managed by SQLAlchemy ORM |
| `backend/db/seed.py` | John Doe mock data loader (uses `round_up_to_100`) |
| `backend/services/anonymize.py` | `round_up_to_100(value) -> int` |
| `backend/services/tax_engine.py` | Gain/loss calc, bracket lookup, harvesting scorer |
| `backend/services/pdf_parser.py` | pdfplumber extraction — allowlist only, no raw text |
| `backend/routers/insights.py` | `GET /api/insights` — reads from SQLite file DB |
| `backend/routers/simulate.py` | `POST /api/simulate` — SQLite in-memory, same response shape |
| `frontend/app/page.tsx` | Tab controller (Demo / Calculator / My Account) |
| `frontend/components/TabNav.tsx` | Fixed header with 3 tabs, amber underline |
| `frontend/components/DashboardCards.tsx` | Shared card grid (7 cards); used by Demo tab and Calculator right panel |
| `frontend/components/Calculator.tsx` | Sidebar form + debounced simulate; `DEMO_DEFAULTS` mirrors seed.py |
| `frontend/components/AskClaude.tsx` | Collapsible AI advisor panel — SSE streaming from `/api/ask-claude` |
| `frontend/components/AccountPlaceholder.tsx` | Coming soon placeholder |
| `frontend/components/cards/` | 7 card components: NetWorth, TaxSummary, CapitalGains, UnrealizedGains, Harvesting, HoldingPeriod, AssetBreakdown |
| `frontend/lib/api.ts` | API client — `fetchInsights()`, `simulateInsights()`, all TS types |
| `backend/routers/ask_claude.py` | `POST /api/ask-claude` — SSE streaming endpoint, Anthropic SDK, reads `ANTHROPIC_API_KEY` from `.env` |
| `backend/routers/net_worth.py` | `GET /api/net-worth` — current + historical net worth |
| `archive/parse_pdf.py` | Reference pdfplumber parser |

### Python environment note
Use `/Library/Frameworks/Python.framework/Versions/3.12/bin/pytest` directly. Do NOT use bare `python` or `python3` — brew installed Python 3.14 which lacks the project's packages. Use `/Library/Frameworks/Python.framework/Versions/3.12/bin/python3` when a Python invocation is needed.

### .env keys required
```
MYSQL_PASSWORD=P455w0rd
ANTHROPIC_API_KEY=sk-ant-...   # required for Ask Claude feature
```

---

## Phase Handoff Checklist

Run this before every context clear:

1. Run the verification gate for the step you just finished (commands in `PLAN.md`)
2. Confirm gate passes cleanly — fix any failures before clearing
3. Update **Current State** above to the completed step number
4. `git add CLAUDE.md && git commit -m "handoff: completed step N"`
5. Clear context — the next session will read this file automatically
