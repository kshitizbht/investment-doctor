"use client";

import { useEffect, useState, useCallback } from "react";
import type { InsightsResponse, PositionInput, SimulateRequest } from "@/lib/api";
import { simulateInsights } from "@/lib/api";
import DashboardCards from "@/components/DashboardCards";

// ─── Demo defaults — mirrors backend/db/seed.py ────────────────────────────
const DEMO_DEFAULTS: SimulateRequest = {
  filing_status: "single",
  state: "CA",
  wages: 180000,
  federal_tax_withheld: 32000,
  state_tax_withheld: 14000,
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
  real_estate: {
    label: "Rental - SF Condo",
    purchase_price: 450000,
    purchase_date: "2018-01-01",
    current_estimated_value: 510000,
    annual_rental_income: 24000,
    depreciation_taken: 0,
    mortgage_interest_paid: 0,
  },
};

// ─── Input styles ──────────────────────────────────────────────────────────
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
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

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
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

// ─── Main Calculator component ─────────────────────────────────────────────
export default function Calculator() {
  const [form, setForm] = useState<SimulateRequest>(DEMO_DEFAULTS);
  const [results, setResults] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced simulate
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      simulateInsights(form)
        .then(setResults)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [form]);

  const updatePos = useCallback((i: number, patch: Partial<PositionInput>) => {
    setForm((f) => ({
      ...f,
      positions: f.positions.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    }));
  }, []);

  const updateRE = useCallback((patch: Partial<NonNullable<SimulateRequest["real_estate"]>>) => {
    setForm((f) => ({ ...f, real_estate: { ...f.real_estate!, ...patch } }));
  }, []);

  const labelStyle: React.CSSProperties = {
    color: "var(--text-secondary)",
    fontSize: "10px",
    fontFamily: "var(--font-body)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 600,
  };

  return (
    <div className="flex h-[calc(100vh-56px)] gap-5">
      {/* ── Sidebar ── */}
      <aside
        className="w-72 flex-shrink-0 overflow-y-auto scrollbar-thin py-4 pr-1"
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
            </div>
          </details>

          {/* Positions */}
          <details open className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <SectionHeader title="Open Positions" />
            <div className="px-2 pb-3 pt-1">
              {/* Column headers */}
              <div
                className="grid gap-1 mb-1 px-1"
                style={{ gridTemplateColumns: "52px 1fr 56px 64px 64px" }}
              >
                {["Ticker", "Qty", "Cost", "Price", "Date"].map((h) => (
                  <span key={h} style={labelStyle}>{h}</span>
                ))}
              </div>

              {form.positions.map((pos, i) => (
                <div
                  key={i}
                  className="grid gap-1 mb-1.5 px-1 py-1.5 rounded"
                  style={{ gridTemplateColumns: "52px 1fr 56px 64px 64px", background: "rgba(255,255,255,0.02)" }}
                >
                  {/* Ticker (read-only label) */}
                  <div className="flex items-center">
                    <span
                      className="text-xs font-mono font-bold truncate"
                      style={{ color: pos.asset_type === "stock" ? "#F5A623" : pos.asset_type === "crypto" ? "#FF4455" : "#00C87C" }}
                    >
                      {pos.ticker_or_name}
                    </span>
                  </div>

                  {/* Qty */}
                  <MiniNumInput
                    value={pos.quantity}
                    onChange={(v) => updatePos(i, { quantity: v })}
                    step={1}
                  />

                  {/* Cost Basis */}
                  <MiniNumInput
                    value={pos.cost_basis_per_unit}
                    onChange={(v) => updatePos(i, { cost_basis_per_unit: v })}
                    step={1}
                  />

                  {/* Current Price */}
                  <MiniNumInput
                    value={pos.current_price}
                    onChange={(v) => updatePos(i, { current_price: v })}
                    step={1}
                  />

                  {/* Purchase Date */}
                  <input
                    type="date"
                    value={pos.purchase_date}
                    onChange={(e) => updatePos(i, { purchase_date: e.target.value })}
                    className="w-full text-xs font-mono rounded px-1 py-1 outline-none border"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderColor: "rgba(255,255,255,0.1)",
                      color: "var(--text-secondary)",
                      fontSize: "10px",
                    }}
                  />
                </div>
              ))}

              <p className="mt-2 px-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Realized transactions (MSFT, COIN, SOL) are included automatically.
              </p>
            </div>
          </details>

          {/* Real Estate */}
          {form.real_estate && (
            <details open className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <SectionHeader title="Real Estate" />
              <div className="px-3 pb-3 pt-1 space-y-3">
                <Field label="Purchase Price ($)">
                  <NumInput
                    value={form.real_estate.purchase_price}
                    onChange={(v) => updateRE({ purchase_price: v })}
                    step={5000}
                  />
                </Field>
                <Field label="Current Value ($)">
                  <NumInput
                    value={form.real_estate.current_estimated_value}
                    onChange={(v) => updateRE({ current_estimated_value: v })}
                    step={5000}
                  />
                </Field>
                <Field label="Annual Rental Income ($)">
                  <NumInput
                    value={form.real_estate.annual_rental_income}
                    onChange={(v) => updateRE({ annual_rental_income: v })}
                    step={500}
                  />
                </Field>
              </div>
            </details>
          )}

          {/* Reset */}
          <button
            onClick={() => setForm(DEMO_DEFAULTS)}
            className="w-full mt-2 rounded-lg py-2 text-xs font-semibold font-display uppercase tracking-wider transition-colors duration-200"
            style={{
              background: "rgba(245,166,35,0.07)",
              border: "1px solid rgba(245,166,35,0.2)",
              color: "var(--accent)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,166,35,0.14)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,166,35,0.07)";
            }}
          >
            ↺ Reset to Demo
          </button>
        </div>
      </aside>

      {/* ── Right panel ── */}
      <main className="flex-1 min-w-0 overflow-y-auto py-4 pr-1 relative">
        {/* Loading overlay */}
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-start justify-end p-3 pointer-events-none"
          >
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-body"
              style={{
                background: "rgba(7,11,18,0.85)",
                border: "1px solid rgba(245,166,35,0.2)",
                color: "var(--accent)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="spinner h-3.5 w-3.5 rounded-full border-2"
                style={{ borderColor: "rgba(245,166,35,0.3)", borderTopColor: "var(--accent)" }}
              />
              Recalculating…
            </div>
          </div>
        )}

        {error && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm font-body"
            style={{
              background: "rgba(255,68,85,0.08)",
              border: "1px solid rgba(255,68,85,0.2)",
              color: "var(--negative)",
            }}
          >
            {error} — make sure the backend is running on :8000
          </div>
        )}

        {results ? (
          <DashboardCards data={results} />
        ) : !error ? (
          <div className="flex h-40 items-center justify-center">
            <div
              className="spinner h-6 w-6 rounded-full border-2"
              style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "var(--accent)" }}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}

function MiniNumInput({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
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
      style={
        focused
          ? {
              background: "rgba(245,166,35,0.06)",
              borderColor: "rgba(245,166,35,0.4)",
              color: "var(--text-primary)",
            }
          : {
              background: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.08)",
              color: "var(--text-secondary)",
            }
      }
    />
  );
}
