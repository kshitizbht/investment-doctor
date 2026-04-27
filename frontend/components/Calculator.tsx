"use client";

import { useEffect, useState, useCallback } from "react";
import type { InsightsResponse, PositionInput, RealEstateInput, RSUGrantInput, SimulateRequest } from "@/lib/api";
import { simulateInsights } from "@/lib/api";
import DashboardCards from "@/components/DashboardCards";
import AskClaude from "@/components/AskClaude";

// ─── Demo defaults — mirrors backend/db/seed.py + new fields ──────────────────
const DEMO_DEFAULTS: SimulateRequest = {
  filing_status: "single",
  state: "CA",
  wages: 180000,
  federal_tax_withheld: 32000,
  state_tax_withheld: 14000,
  // Additional income
  bonus: 20000,
  other_income: 0,
  qualified_dividends: 0,
  // Pre-tax deductions
  k401_contribution: 11500,
  hsa_contribution: 0,
  ira_contribution: 0,
  // Itemized deduction inputs
  capital_loss_carryforward: 0,
  charitable_donations: 2000,
  property_tax_paid: 7000,
  prior_year_agi: 195000,
  // Equity
  rsu_grants: [
    {
      ticker: "META",
      grant_type: "RSU",
      shares_vested_ytd: 100,
      fmv_at_vest: 400,
      shares_sold_at_vest: 22,
      current_price: 480,
      next_vest_date: "2026-09-01",
      next_vest_shares: 50,
    },
  ],
  positions: [
    { asset_type: "stock",  ticker_or_name: "AAPL", quantity: 50,  cost_basis_per_unit: 150,   current_price: 220,  purchase_date: "2024-01-15" },
    { asset_type: "stock",  ticker_or_name: "TSLA", quantity: 30,  cost_basis_per_unit: 280,   current_price: 195,  purchase_date: "2024-01-20" },
    { asset_type: "stock",  ticker_or_name: "NVDA", quantity: 20,  cost_basis_per_unit: 400,   current_price: 929,  purchase_date: "2025-08-25" },
    { asset_type: "stock",  ticker_or_name: "AMZN", quantity: 100, cost_basis_per_unit: 190,   current_price: 185,  purchase_date: "2024-02-01" },
    { asset_type: "option", ticker_or_name: "AAPL", quantity: 2,   cost_basis_per_unit: 1200,  current_price: 1680, purchase_date: "2025-10-01", expiry_date: "2026-07-18", is_short: 0, strike_price: 200 },
    { asset_type: "option", ticker_or_name: "SPY",  quantity: 1,   cost_basis_per_unit: 5583,  current_price: 2233, purchase_date: "2025-10-01", expiry_date: "2026-06-06", is_short: 1, strike_price: 450 },
    { asset_type: "crypto", ticker_or_name: "BTC",  quantity: 1.5, cost_basis_per_unit: 30000, current_price: 65000, purchase_date: "2024-01-10" },
    { asset_type: "crypto", ticker_or_name: "ETH",  quantity: 10,  cost_basis_per_unit: 3200,  current_price: 2400, purchase_date: "2025-01-01" },
  ],
  transactions: [
    { asset_type: "stock",  ticker_or_name: "MSFT", action: "buy",  quantity: 10,  price_per_unit: 300, total_proceeds: 0,     total_cost_basis: 3000,  transaction_date: "2022-01-01" },
    { asset_type: "stock",  ticker_or_name: "MSFT", action: "sell", quantity: 10,  price_per_unit: 820, total_proceeds: 8200,  total_cost_basis: 3000,  transaction_date: "2024-03-15" },
    { asset_type: "stock",  ticker_or_name: "COIN", action: "buy",  quantity: 20,  price_per_unit: 250, total_proceeds: 0,     total_cost_basis: 5000,  transaction_date: "2024-06-01" },
    { asset_type: "stock",  ticker_or_name: "COIN", action: "sell", quantity: 20,  price_per_unit: 145, total_proceeds: 2900,  total_cost_basis: 5000,  transaction_date: "2024-08-10" },
    { asset_type: "crypto", ticker_or_name: "SOL",  action: "buy",  quantity: 500, price_per_unit: 120, total_proceeds: 0,     total_cost_basis: 60000, transaction_date: "2024-07-01" },
    { asset_type: "crypto", ticker_or_name: "SOL",  action: "sell", quantity: 500, price_per_unit: 145, total_proceeds: 72500, total_cost_basis: 60000, transaction_date: "2024-11-20" },
  ],
  real_estate_list: [
    {
      label: "Rental - SF Condo",
      purchase_price: 450000,
      purchase_date: "2018-01-01",
      current_estimated_value: 510000,
      annual_rental_income: 24000,
      depreciation_taken: 0,
      mortgage_interest_paid: 0,
    },
  ],
};

const ZERO_STATE: SimulateRequest = {
  filing_status: "single",
  state: "CA",
  wages: 0,
  federal_tax_withheld: 0,
  state_tax_withheld: 0,
  bonus: 0,
  other_income: 0,
  qualified_dividends: 0,
  k401_contribution: 0,
  hsa_contribution: 0,
  ira_contribution: 0,
  capital_loss_carryforward: 0,
  charitable_donations: 0,
  property_tax_paid: 0,
  prior_year_agi: 0,
  rsu_grants: [],
  positions: [],
  transactions: [],
  real_estate_list: [],
};

// ─── Input styles ──────────────────────────────────────────────────────────────
const inputCls =
  "w-full bg-transparent text-sm font-mono rounded px-2 py-1 outline-none transition-colors duration-150 border";
const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  borderColor: "rgba(255,255,255,0.1)",
  color: "var(--text-primary)",
};
const inputFocusStyle = {
  borderColor: "rgba(245,166,35,0.5)",
  background: "rgba(245,166,35,0.04)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={inputCls}
      style={focused ? { ...inputStyle, ...inputFocusStyle } : inputStyle}
    />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
      style={{ ...inputStyle, cursor: "pointer" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: "#0E1620", color: "var(--text-primary)" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <summary
      className="flex cursor-pointer select-none items-center justify-between py-2 text-xs font-semibold uppercase tracking-widest font-display list-none"
      style={{ color: "var(--accent)" }}
    >
      {title}
      <span className="text-base leading-none" style={{ color: "rgba(245,166,35,0.5)" }}>⌃</span>
    </summary>
  );
}

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "10px",
  fontFamily: "var(--font-body)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 600,
};

// ─── Main Calculator component ─────────────────────────────────────────────────
export default function Calculator() {
  const [form, setForm] = useState<SimulateRequest>(DEMO_DEFAULTS);
  const [results, setResults] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      simulateInsights(form, controller.signal)
        .then(setResults)
        .catch((e) => { if (e.name !== "AbortError") setError(e.message); })
        .finally(() => setLoading(false));
    }, 350);
    return () => { clearTimeout(t); controller.abort(); };
  }, [form]);

  // ── Position handlers ──────────────────────────────────────────────────────
  const updatePos = useCallback((i: number, patch: Partial<PositionInput>) => {
    setForm((f) => ({ ...f, positions: f.positions.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }));
  }, []);
  const removePos = useCallback((i: number) => {
    setForm((f) => ({ ...f, positions: f.positions.filter((_, idx) => idx !== i) }));
  }, []);
  const addPos = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    setForm((f) => ({ ...f, positions: [...f.positions, { asset_type: "stock", ticker_or_name: "", quantity: 1, cost_basis_per_unit: 0, current_price: 0, purchase_date: today }] }));
  }, []);
  const cycleType = useCallback((i: number, current: string) => {
    const types = ["stock", "crypto", "option"];
    updatePos(i, { asset_type: types[(types.indexOf(current) + 1) % types.length] });
  }, [updatePos]);

  // ── Real estate handlers ───────────────────────────────────────────────────
  const updateRE = useCallback((i: number, patch: Partial<RealEstateInput>) => {
    setForm((f) => ({ ...f, real_estate_list: f.real_estate_list.map((re, idx) => (idx === i ? { ...re, ...patch } : re)) }));
  }, []);
  const removeRE = useCallback((i: number) => {
    setForm((f) => ({ ...f, real_estate_list: f.real_estate_list.filter((_, idx) => idx !== i) }));
  }, []);
  const addRE = useCallback(() => {
    setForm((f) => ({ ...f, real_estate_list: [...f.real_estate_list, { label: "", purchase_price: 0, purchase_date: "2020-01-01", current_estimated_value: 0, annual_rental_income: 0, depreciation_taken: 0, mortgage_interest_paid: 0 }] }));
  }, []);

  // ── RSU handlers ───────────────────────────────────────────────────────────
  const updateRSU = useCallback((i: number, patch: Partial<RSUGrantInput>) => {
    setForm((f) => ({ ...f, rsu_grants: f.rsu_grants.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) }));
  }, []);
  const removeRSU = useCallback((i: number) => {
    setForm((f) => ({ ...f, rsu_grants: f.rsu_grants.filter((_, idx) => idx !== i) }));
  }, []);
  const addRSU = useCallback(() => {
    setForm((f) => ({ ...f, rsu_grants: [...f.rsu_grants, { ticker: "", grant_type: "RSU", shares_vested_ytd: 0, fmv_at_vest: 0, shares_sold_at_vest: 0, current_price: 0, next_vest_shares: 0 }] }));
  }, []);

  return (
    <div className="flex h-[calc(100vh-56px)] gap-5">
      {/* ── Sidebar ── */}
      <aside
        className="w-80 flex-shrink-0 overflow-y-auto scrollbar-thin py-4 pr-1"
        style={{ borderRight: "1px solid var(--border)" }}
      >
        <div className="space-y-1 px-1">

          {/* Income */}
          <details open className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <SectionHeader title="Income" />
            <div className="px-3 pb-3 pt-1 space-y-3">
              <Field label="W2 Wages ($)">
                <NumInput value={form.wages} onChange={(v) => setForm((f) => ({ ...f, wages: v }))} step={1000} />
              </Field>
              <Field label="Bonus ($)">
                <NumInput value={form.bonus} onChange={(v) => setForm((f) => ({ ...f, bonus: v }))} step={1000} />
              </Field>
              <Field label="Other Income ($)">
                <NumInput value={form.other_income} onChange={(v) => setForm((f) => ({ ...f, other_income: v }))} step={500} />
              </Field>
              <Field label="Qualified Dividends ($)">
                <NumInput value={form.qualified_dividends} onChange={(v) => setForm((f) => ({ ...f, qualified_dividends: v }))} step={100} />
              </Field>
              <Field label="Filing Status">
                <SelectInput
                  value={form.filing_status}
                  onChange={(v) => setForm((f) => ({ ...f, filing_status: v }))}
                  options={[
                    { value: "single", label: "Single" },
                    { value: "married_filing_jointly", label: "Married (joint)" },
                    { value: "married_filing_separately", label: "Married (sep.)" },
                    { value: "head_of_household", label: "Head of Household" },
                  ]}
                />
              </Field>
              <Field label="State">
                <SelectInput
                  value={form.state}
                  onChange={(v) => setForm((f) => ({ ...f, state: v }))}
                  options={[
                    { value: "CA", label: "California (CA)" },
                    { value: "NY", label: "New York (NY)" },
                    { value: "TX", label: "Texas (TX)" },
                    { value: "FL", label: "Florida (FL)" },
                    { value: "WA", label: "Washington (WA)" },
                  ]}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Fed Withheld ($)">
                  <NumInput value={form.federal_tax_withheld} onChange={(v) => setForm((f) => ({ ...f, federal_tax_withheld: v }))} step={500} />
                </Field>
                <Field label="State Withheld ($)">
                  <NumInput value={form.state_tax_withheld} onChange={(v) => setForm((f) => ({ ...f, state_tax_withheld: v }))} step={500} />
                </Field>
              </div>
            </div>
          </details>

          {/* Equity Compensation */}
          <details className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <SectionHeader title="Equity Comp (RSU/ESPP)" />
            <div className="px-2 pb-3 pt-1">
              {form.rsu_grants.length > 0 && (
                <div className="grid gap-1 mb-1 px-1" style={{ gridTemplateColumns: "48px 44px 44px 52px" }}>
                  {["Ticker", "Vested", "Sold", "FMV@Vest"].map((h) => (
                    <span key={h} style={labelStyle}>{h}</span>
                  ))}
                </div>
              )}
              {form.rsu_grants.map((g, i) => (
                <div
                  key={i}
                  className="group relative rounded px-1 py-1.5 mb-1.5 space-y-1.5"
                  style={{ background: "rgba(245,166,35,0.03)", border: "1px solid rgba(245,166,35,0.1)" }}
                >
                  <div className="grid gap-1" style={{ gridTemplateColumns: "48px 44px 44px 52px" }}>
                    <input
                      type="text"
                      value={g.ticker}
                      onChange={(e) => updateRSU(i, { ticker: e.target.value.toUpperCase() })}
                      placeholder="TICK"
                      className="rounded px-1 py-1 outline-none border text-xs font-mono font-bold uppercase"
                      style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(245,166,35,0.2)", color: "#F5A623" }}
                    />
                    <MiniNumInput value={g.shares_vested_ytd} onChange={(v) => updateRSU(i, { shares_vested_ytd: v })} step={1} />
                    <MiniNumInput value={g.shares_sold_at_vest} onChange={(v) => updateRSU(i, { shares_sold_at_vest: v })} step={1} />
                    <MiniNumInput value={g.fmv_at_vest} onChange={(v) => updateRSU(i, { fmv_at_vest: v })} step={1} />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <Field label="Current Price ($)">
                      <MiniNumInput value={g.current_price} onChange={(v) => updateRSU(i, { current_price: v })} step={1} />
                    </Field>
                    <Field label="Next Vest Shares">
                      <MiniNumInput value={g.next_vest_shares} onChange={(v) => updateRSU(i, { next_vest_shares: v })} step={1} />
                    </Field>
                  </div>
                  <button
                    onClick={() => removeRSU(i)}
                    className="absolute -right-1 -top-1 flex items-center justify-center w-4 h-4 rounded-full text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "rgba(255,68,85,0.85)", color: "#fff", fontSize: "10px" }}
                  >×</button>
                </div>
              ))}
              <AddBtn onClick={addRSU} accentColor="rgba(245,166,35,0.4)" label="+ Add Grant" />
            </div>
          </details>

          {/* Retirement */}
          <details className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <SectionHeader title="Retirement" />
            <div className="px-3 pb-3 pt-1 space-y-3">
              <Field label="401(k) / 403(b) YTD ($)">
                <NumInput value={form.k401_contribution} onChange={(v) => setForm((f) => ({ ...f, k401_contribution: v }))} step={500} />
              </Field>
              <Field label="HSA Contribution ($)">
                <NumInput value={form.hsa_contribution} onChange={(v) => setForm((f) => ({ ...f, hsa_contribution: v }))} step={100} />
              </Field>
              <Field label="Traditional IRA ($)">
                <NumInput value={form.ira_contribution} onChange={(v) => setForm((f) => ({ ...f, ira_contribution: v }))} step={500} />
              </Field>
            </div>
          </details>

          {/* Deductions */}
          <details className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <SectionHeader title="Deductions" />
            <div className="px-3 pb-3 pt-1 space-y-3">
              <Field label="Charitable Donations ($)">
                <NumInput value={form.charitable_donations} onChange={(v) => setForm((f) => ({ ...f, charitable_donations: v }))} step={500} />
              </Field>
              <Field label="Property Tax Paid ($)">
                <NumInput value={form.property_tax_paid} onChange={(v) => setForm((f) => ({ ...f, property_tax_paid: v }))} step={500} />
              </Field>
              <Field label="Capital Loss Carryforward ($)">
                <NumInput value={form.capital_loss_carryforward} onChange={(v) => setForm((f) => ({ ...f, capital_loss_carryforward: v }))} step={500} />
              </Field>
              <Field label="Prior Year AGI ($)">
                <NumInput value={form.prior_year_agi} onChange={(v) => setForm((f) => ({ ...f, prior_year_agi: v }))} step={1000} />
              </Field>
            </div>
          </details>

          {/* Open Positions */}
          <details className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <SectionHeader title="Open Positions" />
            <div className="px-2 pb-3 pt-1">
              <div className="grid gap-1 mb-1 px-1" style={{ gridTemplateColumns: "14px 48px 1fr 52px 58px 58px" }}>
                {["", "Ticker", "Qty", "Mkt$", "Basis", "Date"].map((h) => (
                  <span key={h} style={labelStyle}>{h}</span>
                ))}
              </div>

              {form.positions.map((pos, i) => {
                const typeColor = pos.asset_type === "stock" ? "#F5A623" : pos.asset_type === "crypto" ? "#FF4455" : "#00C87C";
                return (
                  <div
                    key={i}
                    className="group grid gap-1 mb-1.5 px-1 py-1.5 rounded relative"
                    style={{ gridTemplateColumns: "14px 48px 1fr 52px 58px 58px", background: "rgba(255,255,255,0.02)" }}
                  >
                    <button onClick={() => cycleType(i, pos.asset_type)} title={`Type: ${pos.asset_type}`} className="flex items-center justify-center self-center">
                      <div className="w-2 h-2 rounded-full" style={{ background: typeColor }} />
                    </button>
                    <input
                      type="text"
                      value={pos.ticker_or_name}
                      onChange={(e) => updatePos(i, { ticker_or_name: e.target.value.toUpperCase() })}
                      placeholder="TICK"
                      className="w-full rounded px-1 py-1 outline-none border text-xs font-mono font-bold uppercase"
                      style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: typeColor }}
                    />
                    <MiniNumInput value={pos.quantity} onChange={(v) => updatePos(i, { quantity: v })} step={1} />
                    <MiniNumInput value={pos.current_price} onChange={(v) => updatePos(i, { current_price: v })} step={1} />
                    <MiniNumInput value={pos.cost_basis_per_unit} onChange={(v) => updatePos(i, { cost_basis_per_unit: v })} step={1} />
                    <input
                      type="date"
                      value={pos.purchase_date}
                      onChange={(e) => updatePos(i, { purchase_date: e.target.value })}
                      className="w-full text-xs font-mono rounded px-1 py-1 outline-none border"
                      style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text-secondary)", fontSize: "10px" }}
                    />
                    <button
                      onClick={() => removePos(i)}
                      className="absolute -right-1 -top-1 flex items-center justify-center w-4 h-4 rounded-full text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(255,68,85,0.85)", color: "#fff", fontSize: "10px" }}
                    >×</button>
                  </div>
                );
              })}

              <AddBtn onClick={addPos} label="+ Add Position" />
              <p className="mt-2 px-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Click the color dot to cycle type (stock/crypto/option).
              </p>
            </div>
          </details>

          {/* Real Estate */}
          <details className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <SectionHeader title="Real Estate" />
            <div className="px-2 pb-3 pt-1 space-y-2">
              {form.real_estate_list.length === 0 && (
                <p className="px-1 text-xs" style={{ color: "var(--text-muted)" }}>No properties added.</p>
              )}
              {form.real_estate_list.map((re, i) => (
                <div
                  key={i}
                  className="group relative rounded-lg px-3 py-2.5 space-y-2"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <input
                    type="text"
                    value={re.label}
                    onChange={(e) => updateRE(i, { label: e.target.value })}
                    placeholder="Property label"
                    className="w-full text-xs font-mono rounded px-2 py-1 outline-none border"
                    style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text-primary)" }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Purchase ($)">
                      <MiniNumInput value={re.purchase_price} onChange={(v) => updateRE(i, { purchase_price: v })} step={5000} />
                    </Field>
                    <Field label="Value ($)">
                      <MiniNumInput value={re.current_estimated_value} onChange={(v) => updateRE(i, { current_estimated_value: v })} step={5000} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Annual Rental ($)">
                      <MiniNumInput value={re.annual_rental_income} onChange={(v) => updateRE(i, { annual_rental_income: v })} step={500} />
                    </Field>
                    <Field label="Mortgage Int. ($)">
                      <MiniNumInput value={re.mortgage_interest_paid} onChange={(v) => updateRE(i, { mortgage_interest_paid: v })} step={500} />
                    </Field>
                  </div>
                  <button
                    onClick={() => removeRE(i)}
                    className="absolute -right-1 -top-1 flex items-center justify-center w-4 h-4 rounded-full text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "rgba(255,68,85,0.85)", color: "#fff", fontSize: "10px" }}
                  >×</button>
                </div>
              ))}
              <AddBtn onClick={addRE} accentColor="rgba(0,200,124,0.4)" accentText="#00C87C" label="+ Add Property" />
            </div>
          </details>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <ActionBtn
              onClick={() => setForm((f) => ({ ...ZERO_STATE, filing_status: f.filing_status, state: f.state }))}
              variant="danger"
            >
              ✕ Clear All
            </ActionBtn>
            <ActionBtn onClick={() => setForm(DEMO_DEFAULTS)} variant="accent">
              ↺ Reset Demo
            </ActionBtn>
          </div>
        </div>
      </aside>

      {/* ── Right panel ── */}
      <main className="flex-1 min-w-0 overflow-y-auto py-4 pr-1 relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-start justify-end p-3 pointer-events-none">
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-body"
              style={{ background: "rgba(7,11,18,0.85)", border: "1px solid rgba(245,166,35,0.2)", color: "var(--accent)", backdropFilter: "blur(8px)" }}
            >
              <div className="spinner h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: "rgba(245,166,35,0.3)", borderTopColor: "var(--accent)" }} />
              Recalculating…
            </div>
          </div>
        )}

        {error && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm font-body"
            style={{ background: "rgba(255,68,85,0.08)", border: "1px solid rgba(255,68,85,0.2)", color: "var(--negative)" }}
          >
            {error} — make sure the backend is running on :8000
          </div>
        )}

        {results ? (
          <div className="space-y-4">
            <AskClaude snapshot={results} />
            <DashboardCards data={results} />
          </div>
        ) : !error ? (
          <div className="flex h-40 items-center justify-center">
            <div className="spinner h-6 w-6 rounded-full border-2" style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : null}
      </main>
    </div>
  );
}

function AddBtn({ onClick, label, accentColor = "rgba(255,255,255,0.15)", accentText = "var(--text-muted)" }: {
  onClick: () => void; label: string; accentColor?: string; accentText?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold font-display uppercase tracking-wider transition-colors duration-150 flex items-center justify-center gap-1"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)", color: "var(--text-muted)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = accentColor;
        (e.currentTarget as HTMLButtonElement).style.color = accentText;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
      }}
    >
      {label}
    </button>
  );
}

function ActionBtn({ onClick, variant, children }: { onClick: () => void; variant: "accent" | "danger"; children: React.ReactNode }) {
  const base = variant === "accent"
    ? { bg: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.2)", color: "var(--accent)", hoverBg: "rgba(245,166,35,0.14)" }
    : { bg: "rgba(255,68,85,0.06)", border: "1px solid rgba(255,68,85,0.2)", color: "var(--negative)", hoverBg: "rgba(255,68,85,0.12)" };
  return (
    <button
      onClick={onClick}
      className="rounded-lg py-2 text-xs font-semibold font-display uppercase tracking-wider transition-colors duration-200"
      style={{ background: base.bg, border: base.border, color: base.color }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = base.hoverBg; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = base.bg; }}
    >
      {children}
    </button>
  );
}

function MiniNumInput({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="w-full rounded px-1 py-1 outline-none border text-xs font-mono"
      style={focused
        ? { background: "rgba(245,166,35,0.06)", borderColor: "rgba(245,166,35,0.4)", color: "var(--text-primary)" }
        : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }
      }
    />
  );
}
