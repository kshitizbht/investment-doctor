# Investment Doctor — 3-Tab UI Redesign

## Context

The app currently has a single-page dashboard showing 5 cards with tax intelligence for mock user "John Doe". The goal is to add tab navigation (Demo, Calculator, My Account), redesign the UI with a premium "Terminal Intelligence" dark aesthetic, and build a live calculator that lets users tweak any input and see results update in real-time via a new `/api/simulate` backend endpoint.

---

## Aesthetic Direction: Terminal Intelligence

| Token | Value |
|---|---|
| Background | `#070B12` (deep slate-black) |
| Card surface | `rgba(255,255,255,0.03)` |
| Card border | `rgba(255,255,255,0.08)` |
| Accent (amber) | `#F5A623` — active tab, key metrics |
| Positive | `#00C87C` — gains |
| Negative | `#FF4455` — losses |
| Warning | `#F59E0B` — wash sale |
| Display font | **Syne** (headings, labels) |
| Data font | **Space Mono** (ALL numbers) |
| Body font | **DM Sans** (regular text) |
| Backdrop | CSS `body::before` dot grid (`radial-gradient`, 1px dots, 24px spacing) |
| Cards | Staggered `card-in` CSS animation (fade + translateY), amber glow on hover |

---

## Files to Create / Modify

### Backend (new)
- `backend/routers/simulate.py` — POST `/api/simulate` (SQLite in-memory)
- `backend/main.py` — register simulate router (+2 lines)

### Frontend (modify)
- `frontend/app/globals.css` — full Terminal Intelligence theme
- `frontend/app/layout.tsx` — swap Geist → next/font/google (Syne, Space Mono, DM Sans)
- `frontend/tailwind.config.ts` — extend colors + fontFamily tokens
- `frontend/app/page.tsx` — tab controller (replaces current dashboard)
- `frontend/lib/api.ts` — add `SimulateRequest` types + `simulateInsights()`
- `frontend/components/cards/*.tsx` — all 5 cards: dark theme classes, Space Mono for numbers, Syne headings, stagger delays

### Frontend (new)
- `frontend/components/TabNav.tsx` — fixed header, 3 tabs, amber underline
- `frontend/components/Calculator.tsx` — sidebar form + live cards
- `frontend/components/DashboardCards.tsx` — shared grid wrapper (Demo + Calculator reuse)
- `frontend/components/AccountPlaceholder.tsx` — coming soon

### Docs (new, save at end)
- `docs/plan-three-tabs.md` — copy of this plan

---

## Implementation Order

### Step 1 — Backend: `/api/simulate`

Create `backend/routers/simulate.py`:

1. **Pydantic models** mirroring DB fields:
   ```python
   class PositionInput(BaseModel): asset_type, ticker_or_name, quantity, cost_basis_per_unit, current_price, purchase_date: str, expiry_date?, is_short?, strike_price?
   class TransactionInput(BaseModel): asset_type, ticker_or_name, action, quantity, price_per_unit, total_proceeds, total_cost_basis, transaction_date: str
   class RealEstateInput(BaseModel): label, purchase_price, purchase_date: str, current_estimated_value, annual_rental_income, depreciation_taken=0, mortgage_interest_paid=0
   class SimulateRequest(BaseModel): filing_status, state, wages, federal_tax_withheld=0, state_tax_withheld=0, positions[], transactions[], real_estate?
   ```

2. **SQLite in-memory strategy** (same pattern as `backend/tests/conftest.py`):
   ```python
   engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
   Base.metadata.create_all(bind=engine)
   Session = sessionmaker(bind=engine)
   db = Session()
   ```
   Seed db from request body → run exact same `tax_engine.*` functions → `db.close()` → return same shape as `/api/insights`.

3. **Date conversion**: Parse `purchase_date: str` → `date.fromisoformat(...)` before constructing ORM objects.

4. **`round_up_to_100`**: Apply to `wages` only (matches real endpoint behavior). NOT to positions/prices.

5. **Transactions**: Must include BOTH buy and sell records (buy establishes holding period for `realized_gains()`). The `DEMO_DEFAULTS` constant in Calculator.tsx includes all 6 transaction rows.

6. Register in `backend/main.py`:
   ```python
   from backend.routers import simulate
   app.include_router(simulate.router)
   ```

---

### Step 2 — Theme Infrastructure

**`frontend/app/globals.css`** — full replacement:
- `:root` CSS vars (bg-base, surface, border, accent, positive, negative, warning, text-primary/secondary/muted)
- `body::before` dot-grid pseudo-element (z-index: 0, fixed, full-screen)
- All content wrappers need `position: relative; z-index: 1`
- `@keyframes card-in` — `from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) }`
- `.card-animate { animation: card-in 0.4s ease-out both; animation-delay: var(--card-delay, 0ms); }`
- `.card-glow:hover { box-shadow: 0 0 20px rgba(245,166,35,0.1); }`

**`frontend/app/layout.tsx`** — replace `localFont` with `next/font/google`:
```typescript
import { Syne, Space_Mono, DM_Sans } from 'next/font/google'
const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['400','600','700','800'] })
const spaceMono = Space_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400','700'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-body' })
// Apply all 3 variables to <body>
```

**`frontend/tailwind.config.ts`** — extend:
```typescript
colors: { accent:'#F5A623', positive:'#00C87C', negative:'#FF4455', warning:'#F59E0B', base:'#070B12' }
fontFamily: { display:['var(--font-syne)','sans-serif'], mono:['var(--font-mono)','monospace'], body:['var(--font-body)','sans-serif'] }
```

---

### Step 3 — Restyle All 5 Cards

**Universal changes across all card files:**

| Old | New |
|---|---|
| `bg-white border-neutral-200` | `style={{ background:'var(--surface)', borderColor:'var(--border)' }}` |
| `text-neutral-900/800` | `text-white/90` |
| `text-neutral-500/400` | `text-white/50` |
| `text-emerald-600` | `text-[#00C87C]` |
| `text-red-600` | `text-[#FF4455]` |
| `bg-neutral-50` | `bg-white/5` |
| `bg-amber-100 text-amber-700` | `bg-[#F59E0B]/20 text-[#F59E0B]` |
| `text-blue-700` | `text-[#F5A623]` |
| Numeric `font-bold text-xl` | add `font-mono` (Space Mono) |
| Card `<h2>` headings | add `font-display` (Syne) |

**Stagger delays** (via `style={{ '--card-delay':'Nms' } as React.CSSProperties}`):
- TaxSummaryCard: 0ms, CapitalGainsCard: 80ms, HarvestingCard: 160ms, HoldingPeriodCard: 240ms, AssetBreakdownCard: 320ms

**AssetBreakdown color bars**: stocks→`#F5A623`, options→`#00C87C`, crypto→`#FF4455`, real_estate→`#8B5CF6`

---

### Step 4 — TabNav Component

`frontend/components/TabNav.tsx` — fixed top header (h-14, z-50):
- Logo: "Investment" in `text-white/70` + "Doctor" in `text-[#F5A623]` — Syne font
- 3 tab buttons: inactive `text-white/50 hover:text-white/80`, active `text-[#F5A623]`
- Active indicator: `<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F5A623]" />` inside active button
- Page content needs `pt-14` to clear the fixed header

---

### Step 5 — Page.tsx Restructure

Replace `frontend/app/page.tsx` — tab controller:
```tsx
type Tab = 'demo' | 'calculator' | 'account'
const [activeTab, setActiveTab] = useState<Tab>('demo')

return (
  <>
    <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
    <main className="pt-14 min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {activeTab === 'demo' && <DemoTab />}
      {activeTab === 'calculator' && <CalculatorTab />}
      {activeTab === 'account' && <AccountPlaceholder />}
    </main>
  </>
)
```

**DemoTab** (inline or small component): existing fetch-from-`/api/insights` logic + `<DashboardCards data={insights} />`

---

### Step 6 — DashboardCards Shared Component

`frontend/components/DashboardCards.tsx` — accepts `InsightsResponse`, renders the 5-card grid:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
  <TaxSummaryCard ... />
  <CapitalGainsCard ... />
  <HarvestingCard ... />
  <HoldingPeriodCard ... />
  <AssetBreakdownCard ... />
</div>
```
Used by both Demo tab and Calculator right panel.

---

### Step 7 — lib/api.ts Extension

Add types + function:
```typescript
export interface PositionInput { asset_type, ticker_or_name, quantity, cost_basis_per_unit, current_price, purchase_date: string, expiry_date?, is_short?, strike_price? }
export interface TransactionInput { asset_type, ticker_or_name, action, quantity, price_per_unit, total_proceeds, total_cost_basis, transaction_date: string }
export interface RealEstateInput { label, purchase_price, purchase_date, current_estimated_value, annual_rental_income, depreciation_taken, mortgage_interest_paid }
export interface SimulateRequest { filing_status, state, wages, federal_tax_withheld, state_tax_withheld, positions: PositionInput[], transactions: TransactionInput[], real_estate? }

export async function simulateInsights(req: SimulateRequest): Promise<InsightsResponse> {
  const res = await fetch(`${API_BASE}/api/simulate`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(req) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
```

---

### Step 8 — Calculator Component

`frontend/components/Calculator.tsx` — largest component:

**DEMO_DEFAULTS constant** (hardcoded mirror of `backend/db/seed.py`, includes all positions + all 6 buy/sell transactions):
```typescript
const DEMO_DEFAULTS: SimulateRequest = {
  filing_status: "single", state: "CA", wages: 180000,
  federal_tax_withheld: 32000, state_tax_withheld: 14000,
  positions: [ /* AAPL×50, TSLA×30, NVDA×20, AMZN×100, AAPL-option×2, SPY-option×1, BTC×1.5, ETH×10 */ ],
  transactions: [ /* MSFT buy+sell, COIN buy+sell, SOL buy+sell */ ],
  real_estate: { label:"Rental - SF Condo", purchase_price:450000, purchase_date:"2018-01-01", current_estimated_value:510000, annual_rental_income:24000, depreciation_taken:0, mortgage_interest_paid:0 }
}
```

**State**: `formState: SimulateRequest`, `results: InsightsResponse | null`, `loading: boolean`

**Debounced effect**:
```typescript
useEffect(() => {
  const t = setTimeout(() => {
    simulateInsights(formState).then(setResults).catch(...).finally(() => setLoading(false))
    setLoading(true)
  }, 350)
  return () => clearTimeout(t)
}, [formState])
```

**Layout**: `flex h-[calc(100vh-56px)]` — sidebar (w-80, scrollable) + main panel (flex-1)

**Sidebar sections** (collapsible with `<details><summary>` — zero JS accordion):
1. **Income** — wages (number input), filing status (select), state (select)
2. **Positions** — compact editable table (ticker, type, qty, cost, price, date per row); show buy transactions as read-only note
3. **Real Estate** — purchase price, current value, annual rent
4. **Reset** button at bottom

**Right panel**: loading overlay (absolute positioned, semi-transparent) + `<DashboardCards data={results} />`

**Key UX note**: Buy transactions (MSFT, COIN, SOL buy legs) are in `formState.transactions` but not shown as editable rows — they ensure correct holding-period classification. Only positions (open holdings) are editable in the UI.

---

### Step 9 — Account Placeholder

`frontend/components/AccountPlaceholder.tsx`:
- Center-aligned, max-w-md
- Avatar: circular div, amber gradient, "JD" in Syne bold
- Name: "John Doe", sub: "2024 Tax Year · Single Filer · California"
- Badge: "My Account — Coming Soon" (amber pill)
- 3 blurred amber glow orbs in background via `box-shadow`/`filter:blur()` CSS
- Tagline: "Connect your accounts to unlock personalized tax intelligence."

---

## Verification

### Backend
```bash
# New endpoint works
curl -X POST http://localhost:8000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"wages":180000,"filing_status":"single","state":"CA","positions":[],"transactions":[]}' | python3 -m json.tool

# Existing tests still pass
pytest backend/tests/ -v   # must be 33/33

# Wage change flows through to AGI
# wages:200000 → expect AGI ~239600 (vs demo 219600)
```

### Frontend
```bash
npm run build --prefix frontend   # zero TypeScript errors
```

### Manual browser checks
1. Demo tab: dark cards, Space Mono numbers, Syne headings, stagger animation on first load, amber glow on hover
2. Calculator: typing wages=200000 → spinner → AGI card updates; Reset restores defaults
3. Calculator: changing NVDA current_price → holding period card and harvesting card update
4. Account tab: coming soon placeholder renders, no errors
5. Tab switching: no layout shift, amber underline transitions to active tab
6. Dot grid visible on dark background
