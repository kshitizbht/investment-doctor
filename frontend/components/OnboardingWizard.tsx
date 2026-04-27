"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AccountPosition, AccountRSUGrant, AccountRealEstate, AccountTransaction,
  AuthUser, ParsedTaxResult, RetirementData, TaxData,
} from "@/lib/api";
import {
  completeOnboarding, parseBrokeragePDF, parseTaxPDF,
  getRSUGrants, getRealEstate, getPositions, getRetirementData, getTransactions, getTaxData,
  savePositions, saveRSUGrants, saveRealEstate, saveRetirementData, saveTaxData, saveTransactions,
} from "@/lib/api";

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  borderColor: "rgba(255,255,255,0.10)",
  color: "var(--text-primary)",
};
const inputFocus: React.CSSProperties = {
  background: "rgba(245,166,35,0.04)",
  borderColor: "rgba(245,166,35,0.45)",
  color: "var(--text-primary)",
};
const inputCls = "w-full rounded-lg px-3 py-2 text-sm font-mono outline-none border transition-colors duration-150";
const miniCls = "w-full rounded px-1.5 py-1 text-xs font-mono outline-none border transition-colors duration-150";

function NumField({
  label, value, onChange, step = 1, mini = false,
}: { label?: string; value: number; onChange: (v: number) => void; step?: number; mini?: boolean }) {
  const [focused, setFocused] = useState(false);
  const cls = mini ? miniCls : inputCls;
  const el = (
    <input
      type="number" step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      className={cls} style={focused ? { ...inputBase, ...inputFocus } : inputBase}
    />
  );
  if (!label) return el;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>{label}</label>
      {el}
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder, mini = false,
}: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; mini?: boolean }) {
  const [focused, setFocused] = useState(false);
  const cls = mini ? miniCls : inputCls;
  const el = (
    <input
      type="text" value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      className={cls} style={focused ? { ...inputBase, ...inputFocus } : inputBase}
    />
  );
  if (!label) return el;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>{label}</label>
      {el}
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: { label?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>{label}</label>}
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className={inputCls} style={{ ...inputBase, cursor: "pointer" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: "#0E1620", color: "var(--text-primary)" }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── PDF drop zone ────────────────────────────────────────────────────────────

function PdfDropZone({ onFile, loading, label, sublabel }: {
  onFile: (f: File) => void;
  loading?: boolean;
  label?: string;
  sublabel?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handle = (f: File | undefined) => {
    if (!f || f.type !== "application/pdf") return;
    onFile(f);
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
      onClick={() => inputRef.current?.click()}
      className="relative flex flex-col items-center justify-center gap-2 rounded-xl py-8 cursor-pointer transition-all duration-150"
      style={{
        border: `2px dashed ${dragging ? "var(--accent)" : "rgba(245,166,35,0.3)"}`,
        background: dragging ? "rgba(245,166,35,0.06)" : "rgba(255,255,255,0.02)",
      }}
    >
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      {loading ? (
        <div className="flex items-center gap-2" style={{ color: "var(--accent)" }}>
          <div className="spinner h-4 w-4 rounded-full border-2" style={{ borderColor: "rgba(245,166,35,0.3)", borderTopColor: "var(--accent)" }} />
          <span className="text-sm font-body">Parsing PDF…</span>
        </div>
      ) : (
        <>
          <span style={{ fontSize: 28 }}>📄</span>
          <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>{label ?? "Drop PDF here or click to browse"}</p>
          <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>{sublabel ?? "Supports W-2, 1040, and brokerage statements"}</p>
        </>
      )}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

const STEP_LABELS = ["Prior Year", "Current Year", "Brokerage", "Equity Comp", "Real Estate", "Cost Basis"];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="relative flex items-center justify-between mb-3">
        <div
          className="absolute top-3.5 left-0 right-0 h-px"
          style={{ background: "rgba(255,255,255,0.07)", zIndex: 0 }}
        />
        <div
          className="absolute top-3.5 left-0 h-px transition-all duration-500"
          style={{ width: `${((step - 1) / (STEP_LABELS.length - 1)) * 100}%`, background: "var(--accent)", zIndex: 1 }}
        />
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5 relative z-10">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold font-display transition-all duration-300"
                style={{
                  background: done ? "var(--accent)" : active ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.06)",
                  color: done ? "#070B12" : active ? "var(--accent)" : "var(--text-muted)",
                  border: active ? "2px solid var(--accent)" : done ? "2px solid var(--accent)" : "2px solid rgba(255,255,255,0.1)",
                }}
              >
                {done ? "✓" : n}
              </div>
              <span
                className="hidden sm:block text-center font-body"
                style={{
                  fontSize: "9px", letterSpacing: "0.08em",
                  color: active ? "var(--accent)" : done ? "rgba(245,166,35,0.5)" : "var(--text-muted)",
                  fontWeight: active ? 700 : 400,
                  width: 56,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Method cards ─────────────────────────────────────────────────────────────

type Method = "pdf" | "manual" | null;

function MethodCards({ selected, onSelect, pdfDesc }: { selected: Method; onSelect: (m: Method) => void; pdfDesc?: string }) {
  const cards = [
    { key: "pdf" as Method, icon: "📄", title: "Import PDF", desc: pdfDesc ?? "W-2, 1040, or brokerage statement" },
    { key: "manual" as Method, icon: "✏️", title: "Enter Manually", desc: "Type in your values directly" },
    { key: null as Method, icon: "🔗", title: "Connect Provider", desc: "Coming soon", disabled: true },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {cards.map((c) => (
        <button
          key={String(c.key)}
          disabled={c.disabled}
          onClick={() => !c.disabled && onSelect(selected === c.key ? null : c.key)}
          className="flex flex-col items-center gap-2 rounded-xl py-4 px-3 text-center transition-all duration-150 relative"
          style={{
            background: selected === c.key ? "rgba(245,166,35,0.08)" : "rgba(255,255,255,0.02)",
            border: selected === c.key ? "1.5px solid rgba(245,166,35,0.5)" : "1.5px solid rgba(255,255,255,0.07)",
            cursor: c.disabled ? "not-allowed" : "pointer",
            opacity: c.disabled ? 0.45 : 1,
          }}
        >
          {c.disabled && (
            <span
              className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-xs font-display font-semibold uppercase tracking-wider"
              style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-muted)", fontSize: "8px" }}
            >
              Soon
            </span>
          )}
          <span style={{ fontSize: 22 }}>{c.icon}</span>
          <div>
            <p className="text-xs font-semibold font-display" style={{ color: selected === c.key ? "var(--accent)" : "var(--text-secondary)" }}>
              {c.title}
            </p>
            <p className="mt-0.5 font-body" style={{ fontSize: "10px", color: "var(--text-muted)" }}>{c.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Step footer ──────────────────────────────────────────────────────────────

function StepFooter({
  onSave, onSkip, saving, disabled, isLast,
}: { onSave: () => void; onSkip: () => void; saving: boolean; disabled?: boolean; isLast?: boolean }) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <button
        onClick={onSkip}
        className="text-xs font-body transition-colors duration-150"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")}
      >
        {isLast ? "Skip verification" : "Skip for now →"}
      </button>
      <button
        onClick={onSave}
        disabled={disabled || saving}
        className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold font-display uppercase tracking-wider transition-colors duration-150"
        style={{
          background: (disabled || saving) ? "rgba(245,166,35,0.15)" : "var(--accent)",
          color: (disabled || saving) ? "rgba(245,166,35,0.5)" : "#070B12",
          cursor: (disabled || saving) ? "not-allowed" : "pointer",
        }}
      >
        {saving && (
          <div className="spinner h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: "rgba(7,11,18,0.3)", borderTopColor: "#070B12" }} />
        )}
        {isLast ? "Confirm & Complete" : "Save & Continue"}
      </button>
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="mt-4 rounded-lg px-4 py-3 text-sm font-body" style={{ background: "rgba(255,68,85,0.08)", border: "1px solid rgba(255,68,85,0.2)", color: "var(--negative)" }}>
      {msg}
    </div>
  );
}

// ─── Inferred badge ───────────────────────────────────────────────────────────

function InferredBadge() {
  return (
    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold font-display" style={{ background: "rgba(245,166,35,0.15)", color: "var(--accent)", fontSize: "9px" }}>
      inferred
    </span>
  );
}

// ─── Step 1: Prior Year Return ────────────────────────────────────────────────

function PriorYearForm({
  form, setForm,
}: { form: RetirementData; setForm: (f: RetirementData) => void }) {
  const set = (patch: Partial<RetirementData>) => setForm({ ...form, ...patch });
  return (
    <div className="space-y-4">
      <p className="text-xs font-body" style={{ color: "rgba(255,255,255,0.3)" }}>
        Used to calculate safe-harbor withholding thresholds and carry-forward loss deductions.
      </p>
      <NumField label="Prior Year AGI ($)" value={form.prior_year_agi} onChange={(v) => set({ prior_year_agi: v })} step={1000} />
      <NumField label="Capital Loss Carryforward ($)" value={form.capital_loss_carryforward} onChange={(v) => set({ capital_loss_carryforward: v })} step={500} />
    </div>
  );
}

// ─── Step 2: Current Year (income + paystub YTD + contributions) ──────────────

function CurrentYearForm({
  taxForm, setTaxForm,
  retirementForm, setRetirementForm,
  inferredFields,
}: {
  taxForm: TaxData;
  setTaxForm: (f: TaxData) => void;
  retirementForm: RetirementData;
  setRetirementForm: (f: RetirementData) => void;
  inferredFields?: string[];
}) {
  const inferred = (field: string) => (inferredFields ?? []).includes(field);
  const setTax = (patch: Partial<TaxData>) => setTaxForm({ ...taxForm, ...patch });
  const setRet = (patch: Partial<RetirementData>) => setRetirementForm({ ...retirementForm, ...patch });

  return (
    <div className="space-y-5">
      {/* Income */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider font-display mb-2.5" style={{ color: "var(--text-muted)" }}>Income</p>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="W-2 / YTD Gross Pay ($)" value={taxForm.wages} onChange={(v) => setTax({ wages: v })} step={1000} />
          <NumField label="Bonus ($)" value={taxForm.bonus} onChange={(v) => setTax({ bonus: v })} step={1000} />
          <NumField label="Other Income ($)" value={taxForm.other_income} onChange={(v) => setTax({ other_income: v })} step={500} />
          <NumField label="Qualified Dividends ($)" value={taxForm.qualified_dividends} onChange={(v) => setTax({ qualified_dividends: v })} step={100} />
        </div>
      </div>

      {/* Filing */}
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Filing Status" value={taxForm.filing_status} onChange={(v) => setTax({ filing_status: v })} options={FILING_OPTIONS} />
        <SelectField label="State" value={taxForm.state} onChange={(v) => setTax({ state: v })} options={STATE_OPTIONS} />
      </div>

      {/* Paystub YTD */}
      <div className="pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>Paystub YTD</p>
          <span className="rounded-full px-2 py-0.5 font-body" style={{ fontSize: "9px", background: "rgba(245,166,35,0.1)", color: "var(--accent)" }}>from latest paystub</span>
        </div>
        <p className="text-xs font-body mb-3" style={{ color: "rgba(255,255,255,0.22)" }}>
          Year-to-date totals from your most recent paystub — withheld taxes and pre-tax contributions.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
              YTD Federal Withheld ($){inferred("federal_tax_withheld") && <InferredBadge />}
            </label>
            <NumField value={taxForm.federal_tax_withheld} onChange={(v) => setTax({ federal_tax_withheld: v })} step={500} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
              YTD State Withheld ($){inferred("state_tax_withheld") && <InferredBadge />}
            </label>
            <NumField value={taxForm.state_tax_withheld} onChange={(v) => setTax({ state_tax_withheld: v })} step={500} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
              YTD 401k / 403b ($){inferred("k401_contribution") && <InferredBadge />}
            </label>
            <NumField value={retirementForm.k401_contribution} onChange={(v) => setRet({ k401_contribution: v })} step={500} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
              YTD HSA ($){inferred("hsa_contribution") && <InferredBadge />}
            </label>
            <NumField value={retirementForm.hsa_contribution} onChange={(v) => setRet({ hsa_contribution: v })} step={100} />
          </div>
        </div>
      </div>

      {/* Other contributions */}
      <div className="pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider font-display mb-2.5" style={{ color: "var(--text-muted)" }}>Other Contributions & Deductions</p>
        <div className="grid grid-cols-3 gap-3">
          <NumField label="IRA ($)" value={retirementForm.ira_contribution} onChange={(v) => setRet({ ira_contribution: v })} step={500} />
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
              Charitable ($){inferred("charitable_donations") && <InferredBadge />}
            </label>
            <NumField value={retirementForm.charitable_donations} onChange={(v) => setRet({ charitable_donations: v })} step={500} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
              Property Tax ($){inferred("property_tax_paid") && <InferredBadge />}
            </label>
            <NumField value={retirementForm.property_tax_paid} onChange={(v) => setRet({ property_tax_paid: v })} step={500} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Tax & Income (kept for TaxForm editor export) ───────────────────

const FILING_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "married_filing_jointly", label: "Married (Joint)" },
  { value: "married_filing_separately", label: "Married (Sep.)" },
  { value: "head_of_household", label: "Head of Household" },
];
const STATE_OPTIONS = [
  { value: "CA", label: "California (CA)" },
  { value: "NY", label: "New York (NY)" },
  { value: "TX", label: "Texas (TX)" },
  { value: "FL", label: "Florida (FL)" },
  { value: "WA", label: "Washington (WA)" },
];

const DEFAULT_TAX: TaxData = {
  wages: 0, bonus: 0, other_income: 0, qualified_dividends: 0,
  filing_status: "single", state: "CA",
  federal_tax_withheld: 0, state_tax_withheld: 0, tax_year: 2024, source_label: "employer_1",
};
const DEFAULT_RETIREMENT: RetirementData = {
  k401_contribution: 0, hsa_contribution: 0, ira_contribution: 0,
  charitable_donations: 0, property_tax_paid: 0, capital_loss_carryforward: 0, prior_year_agi: 0, tax_year: 2024,
};

// ─── TaxForm (shared by wizard + editor) ─────────────────────────────────────
export function TaxForm({
  form, setForm, inferredFields = [],
}: { form: TaxData; setForm: (f: TaxData) => void; inferredFields?: string[] }) {
  const inferred = (field: string) => inferredFields.includes(field);
  const set = (patch: Partial<TaxData>) => setForm({ ...form, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <NumField label="W2 Wages ($)" value={form.wages} onChange={(v) => set({ wages: v })} step={1000} />
        <NumField label="Bonus ($)" value={form.bonus} onChange={(v) => set({ bonus: v })} step={1000} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Other Income ($)" value={form.other_income} onChange={(v) => set({ other_income: v })} step={500} />
        <NumField label="Qualified Dividends ($)" value={form.qualified_dividends} onChange={(v) => set({ qualified_dividends: v })} step={100} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Filing Status" value={form.filing_status} onChange={(v) => set({ filing_status: v })} options={FILING_OPTIONS} />
        <SelectField label="State" value={form.state} onChange={(v) => set({ state: v })} options={STATE_OPTIONS} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="flex items-center text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
            Fed Withheld ($){inferred("federal_tax_withheld") && <InferredBadge />}
          </label>
          <NumField value={form.federal_tax_withheld} onChange={(v) => set({ federal_tax_withheld: v })} step={500} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="flex items-center text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
            State Withheld ($){inferred("state_tax_withheld") && <InferredBadge />}
          </label>
          <NumField value={form.state_tax_withheld} onChange={(v) => set({ state_tax_withheld: v })} step={500} />
        </div>
      </div>
    </div>
  );
}

// ─── RetirementForm (shared) ──────────────────────────────────────────────────
export function RetirementForm({
  form, setForm, inferredFields = [],
}: { form: RetirementData; setForm: (f: RetirementData) => void; inferredFields?: string[] }) {
  const inferred = (field: string) => inferredFields.includes(field);
  const set = (patch: Partial<RetirementData>) => setForm({ ...form, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="flex items-center text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
            401k / 403b ($){inferred("k401_contribution") && <InferredBadge />}
          </label>
          <NumField value={form.k401_contribution} onChange={(v) => set({ k401_contribution: v })} step={500} />
        </div>
        <NumField label="HSA ($)" value={form.hsa_contribution} onChange={(v) => set({ hsa_contribution: v })} step={100} />
        <NumField label="IRA ($)" value={form.ira_contribution} onChange={(v) => set({ ira_contribution: v })} step={500} />
      </div>
      <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>Deductions</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="flex items-center text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
              Charitable ($){inferred("charitable_donations") && <InferredBadge />}
            </label>
            <NumField value={form.charitable_donations} onChange={(v) => set({ charitable_donations: v })} step={500} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
              Property Tax ($){inferred("property_tax_paid") && <InferredBadge />}
            </label>
            <NumField value={form.property_tax_paid} onChange={(v) => set({ property_tax_paid: v })} step={500} />
          </div>
          <NumField label="Capital Loss Carryforward ($)" value={form.capital_loss_carryforward} onChange={(v) => set({ capital_loss_carryforward: v })} step={500} />
          <NumField label="Prior Year AGI ($)" value={form.prior_year_agi} onChange={(v) => set({ prior_year_agi: v })} step={1000} />
        </div>
      </div>
    </div>
  );
}

// ─── PositionsTable (shared) ──────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = { stock: "#F5A623", crypto: "#FF4455", option: "#00C87C" };
const TYPE_CYCLE = ["stock", "crypto", "option"];

export function PositionsTable({
  positions, setPositions,
}: { positions: AccountPosition[]; setPositions: (p: AccountPosition[]) => void }) {
  const update = (i: number, patch: Partial<AccountPosition>) =>
    setPositions(positions.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => setPositions(positions.filter((_, idx) => idx !== i));
  const add = () => {
    const today = new Date().toISOString().split("T")[0];
    setPositions([...positions, { asset_type: "stock", ticker_or_name: "", quantity: 1, cost_basis_per_unit: 0, current_price: 0, purchase_date: today }]);
  };
  const cycleType = (i: number, cur: string) =>
    update(i, { asset_type: TYPE_CYCLE[(TYPE_CYCLE.indexOf(cur) + 1) % TYPE_CYCLE.length] });

  return (
    <div>
      {positions.length > 0 && (
        <div className="grid gap-1 mb-1 px-1" style={{ gridTemplateColumns: "14px 52px 1fr 60px 60px 74px" }}>
          {["", "Ticker", "Qty", "Mkt $", "Basis", "Date"].map((h) => (
            <span key={h} className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>{h}</span>
          ))}
        </div>
      )}
      {positions.map((pos, i) => {
        const color = TYPE_COLORS[pos.asset_type] ?? "#fff";
        return (
          <div key={i} className="group grid gap-1 mb-1.5 px-1 py-1.5 rounded relative" style={{ gridTemplateColumns: "14px 52px 1fr 60px 60px 74px", background: "rgba(255,255,255,0.02)" }}>
            <button onClick={() => cycleType(i, pos.asset_type)} title={pos.asset_type} className="flex items-center justify-center self-center">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            </button>
            <input type="text" value={pos.ticker_or_name} onChange={(e) => update(i, { ticker_or_name: e.target.value.toUpperCase() })}
              placeholder="TICK" className={`${miniCls} uppercase font-bold`} style={{ ...inputBase, color }} />
            <input type="number" value={pos.quantity} onChange={(e) => update(i, { quantity: parseFloat(e.target.value) || 0 })}
              className={miniCls} style={inputBase} />
            <input type="number" value={pos.current_price} onChange={(e) => update(i, { current_price: parseFloat(e.target.value) || 0 })}
              className={miniCls} style={inputBase} />
            <input type="number" value={pos.cost_basis_per_unit}
              onChange={(e) => update(i, { cost_basis_per_unit: parseFloat(e.target.value) || 0 })}
              className={miniCls}
              style={pos.cost_basis_per_unit === 0 ? { ...inputBase, borderColor: "rgba(245,166,35,0.4)" } : inputBase} />
            <input type="date" value={pos.purchase_date} onChange={(e) => update(i, { purchase_date: e.target.value })}
              className={miniCls} style={{ ...inputBase, fontSize: "10px" }} />
            <button onClick={() => remove(i)}
              className="absolute -right-1 -top-1 flex items-center justify-center w-4 h-4 rounded-full text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(255,68,85,0.85)", color: "#fff", fontSize: "10px" }}>×</button>
          </div>
        );
      })}
      <button onClick={add}
        className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold font-display uppercase tracking-wider transition-colors duration-150"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)", color: "var(--text-muted)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,166,35,0.5)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
      >
        + Add Position
      </button>
    </div>
  );
}

// ─── TransactionsTable (shared) ───────────────────────────────────────────────

export function TransactionsTable({
  transactions, setTransactions,
}: { transactions: AccountTransaction[]; setTransactions: (t: AccountTransaction[]) => void }) {
  const [expanded, setExpanded] = useState(transactions.length > 0);
  const update = (i: number, patch: Partial<AccountTransaction>) =>
    setTransactions(transactions.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const remove = (i: number) => setTransactions(transactions.filter((_, idx) => idx !== i));
  const add = () => {
    const today = new Date().toISOString().split("T")[0];
    setTransactions([...transactions, { asset_type: "stock", ticker_or_name: "", action: "sell", quantity: 1, price_per_unit: 0, total_proceeds: 0, total_cost_basis: 0, transaction_date: today }]);
  };
  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between py-2 text-xs font-semibold uppercase tracking-widest font-display"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        Transactions ({transactions.length})
        <span style={{ fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="mt-2">
          {transactions.length > 0 && (
            <div className="grid gap-1 mb-1 px-1" style={{ gridTemplateColumns: "52px 52px 1fr 60px 64px 64px 74px" }}>
              {["Ticker", "B/S", "Qty", "Price", "Proceeds", "Basis", "Date"].map((h) => (
                <span key={h} className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>{h}</span>
              ))}
            </div>
          )}
          {transactions.map((t, i) => (
            <div key={i} className="group grid gap-1 mb-1.5 px-1 py-1.5 rounded relative" style={{ gridTemplateColumns: "52px 52px 1fr 60px 64px 64px 74px", background: "rgba(255,255,255,0.02)" }}>
              <input type="text" value={t.ticker_or_name} onChange={(e) => update(i, { ticker_or_name: e.target.value.toUpperCase() })}
                placeholder="TICK" className={`${miniCls} uppercase font-bold`} style={inputBase} />
              <select value={t.action} onChange={(e) => update(i, { action: e.target.value })}
                className={miniCls} style={{ ...inputBase, cursor: "pointer" }}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
              <input type="number" value={t.quantity} onChange={(e) => update(i, { quantity: parseFloat(e.target.value) || 0 })} className={miniCls} style={inputBase} />
              <input type="number" value={t.price_per_unit} onChange={(e) => update(i, { price_per_unit: parseFloat(e.target.value) || 0 })} className={miniCls} style={inputBase} />
              <input type="number" value={t.total_proceeds} onChange={(e) => update(i, { total_proceeds: parseFloat(e.target.value) || 0 })} className={miniCls} style={inputBase} />
              <input type="number" value={t.total_cost_basis} onChange={(e) => update(i, { total_cost_basis: parseFloat(e.target.value) || 0 })} className={miniCls} style={inputBase} />
              <input type="date" value={t.transaction_date} onChange={(e) => update(i, { transaction_date: e.target.value })}
                className={miniCls} style={{ ...inputBase, fontSize: "10px" }} />
              <button onClick={() => remove(i)}
                className="absolute -right-1 -top-1 flex items-center justify-center w-4 h-4 rounded-full text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(255,68,85,0.85)", color: "#fff", fontSize: "10px" }}>×</button>
            </div>
          ))}
          <button onClick={add}
            className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold font-display uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)", color: "var(--text-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,166,35,0.5)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
          >
            + Add Transaction
          </button>
        </div>
      )}
    </div>
  );
}

// ─── RSUTable (shared) ────────────────────────────────────────────────────────

export function RSUTable({
  grants, setGrants,
}: { grants: AccountRSUGrant[]; setGrants: (g: AccountRSUGrant[]) => void }) {
  const update = (i: number, patch: Partial<AccountRSUGrant>) =>
    setGrants(grants.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const remove = (i: number) => setGrants(grants.filter((_, idx) => idx !== i));
  const add = () => setGrants([...grants, { ticker: "", grant_type: "RSU", shares_vested_ytd: 0, fmv_at_vest: 0, shares_sold_at_vest: 0, current_price: 0, next_vest_shares: 0 }]);

  return (
    <div>
      {grants.map((g, i) => (
        <div key={i} className="group relative rounded-lg px-3 py-2.5 mb-2 space-y-2"
          style={{ background: "rgba(245,166,35,0.03)", border: "1px solid rgba(245,166,35,0.1)" }}>
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>Ticker</label>
              <input type="text" value={g.ticker} onChange={(e) => update(i, { ticker: e.target.value.toUpperCase() })}
                placeholder="TICK" className={`${miniCls} uppercase font-bold`} style={{ ...inputBase, color: "#F5A623" }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>Type</label>
              <select value={g.grant_type} onChange={(e) => update(i, { grant_type: e.target.value })} className={miniCls} style={{ ...inputBase, cursor: "pointer" }}>
                <option value="RSU">RSU</option>
                <option value="ESPP">ESPP</option>
                <option value="ISO">ISO</option>
                <option value="NSO">NSO</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>Vested YTD</label>
              <input type="number" value={g.shares_vested_ytd} onChange={(e) => update(i, { shares_vested_ytd: parseInt(e.target.value) || 0 })} className={miniCls} style={inputBase} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>FMV at Vest</label>
              <input type="number" value={g.fmv_at_vest} onChange={(e) => update(i, { fmv_at_vest: parseFloat(e.target.value) || 0 })} className={miniCls} style={inputBase} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>Sold at Vest</label>
              <input type="number" value={g.shares_sold_at_vest} onChange={(e) => update(i, { shares_sold_at_vest: parseInt(e.target.value) || 0 })} className={miniCls} style={inputBase} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>Current $</label>
              <input type="number" value={g.current_price} onChange={(e) => update(i, { current_price: parseFloat(e.target.value) || 0 })} className={miniCls} style={inputBase} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>Next Vest Shares</label>
              <input type="number" value={g.next_vest_shares} onChange={(e) => update(i, { next_vest_shares: parseInt(e.target.value) || 0 })} className={miniCls} style={inputBase} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>Next Vest Date</label>
              <input type="date" value={g.next_vest_date ?? ""} onChange={(e) => update(i, { next_vest_date: e.target.value || undefined })}
                className={miniCls} style={{ ...inputBase, fontSize: "10px" }} />
            </div>
          </div>
          <button onClick={() => remove(i)}
            className="absolute -right-1 -top-1 flex items-center justify-center w-4 h-4 rounded-full text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "rgba(255,68,85,0.85)", color: "#fff", fontSize: "10px" }}>×</button>
        </div>
      ))}
      <button onClick={add}
        className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold font-display uppercase tracking-wider"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(245,166,35,0.3)", color: "var(--text-muted)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,166,35,0.6)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,166,35,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
      >
        + Add Grant
      </button>
    </div>
  );
}

// ─── RealEstateTable (shared) ─────────────────────────────────────────────────

export function RealEstateTable({
  properties, setProperties,
}: { properties: AccountRealEstate[]; setProperties: (p: AccountRealEstate[]) => void }) {
  const update = (i: number, patch: Partial<AccountRealEstate>) =>
    setProperties(properties.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => setProperties(properties.filter((_, idx) => idx !== i));
  const add = () => setProperties([...properties, { label: "", purchase_price: 0, purchase_date: "2020-01-01", current_estimated_value: 0, annual_rental_income: 0, depreciation_taken: 0, mortgage_interest_paid: 0 }]);

  return (
    <div>
      {properties.map((re, i) => (
        <div key={i} className="group relative rounded-lg px-3 py-2.5 mb-2 space-y-2"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <input type="text" value={re.label} onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Property label (e.g. SF Condo)" className={inputCls} style={inputBase} />
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>Purchase Price ($)</label>
              <input type="number" value={re.purchase_price} onChange={(e) => update(i, { purchase_price: parseInt(e.target.value) || 0 })} className={miniCls} style={inputBase} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>Current Value ($)</label>
              <input type="number" value={re.current_estimated_value} onChange={(e) => update(i, { current_estimated_value: parseInt(e.target.value) || 0 })} className={miniCls} style={inputBase} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>Annual Rental ($)</label>
              <input type="number" value={re.annual_rental_income} onChange={(e) => update(i, { annual_rental_income: parseInt(e.target.value) || 0 })} className={miniCls} style={inputBase} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>Mortgage Interest ($)</label>
              <input type="number" value={re.mortgage_interest_paid} onChange={(e) => update(i, { mortgage_interest_paid: parseInt(e.target.value) || 0 })} className={miniCls} style={inputBase} />
            </div>
          </div>
          <button onClick={() => remove(i)}
            className="absolute -right-1 -top-1 flex items-center justify-center w-4 h-4 rounded-full text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "rgba(255,68,85,0.85)", color: "#fff", fontSize: "10px" }}>×</button>
        </div>
      ))}
      <button onClick={add}
        className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold font-display uppercase tracking-wider"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(0,200,124,0.3)", color: "var(--text-muted)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,200,124,0.6)"; (e.currentTarget as HTMLButtonElement).style.color = "#00C87C"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,200,124,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
      >
        + Add Property
      </button>
    </div>
  );
}

// ─── Section editors (exported for use in page.tsx) ───────────────────────────

function EditorShell({ title, children, onBack, onSave, saving, error }: {
  title: string; children: React.ReactNode; onBack: () => void;
  onSave: () => void; saving: boolean; error: string | null;
}) {
  return (
    <div>
      <h2 className="mb-5 text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {children}
      {error && <ErrorBanner msg={error} />}
      <div className="mt-6 flex items-center justify-end gap-3">
        <button onClick={onBack} className="text-sm font-body" style={{ color: "var(--text-muted)" }}>Cancel</button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold font-display uppercase tracking-wider"
          style={{ background: saving ? "rgba(245,166,35,0.15)" : "var(--accent)", color: saving ? "rgba(245,166,35,0.5)" : "#070B12" }}
        >
          {saving && <div className="spinner h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: "rgba(7,11,18,0.3)", borderTopColor: "#070B12" }} />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

export function TaxEditor({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState<TaxData>(DEFAULT_TAX);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getTaxData().then((d) => { if (d) setForm(d); }); }, []);
  const save = async () => {
    setSaving(true); setError(null);
    try { await saveTaxData(form); onBack(); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };
  return <EditorShell title="Edit Tax & Income" onBack={onBack} onSave={save} saving={saving} error={error}><TaxForm form={form} setForm={setForm} /></EditorShell>;
}

export function RetirementEditor({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState<RetirementData>(DEFAULT_RETIREMENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getRetirementData().then((d) => { if (d) setForm(d); }); }, []);
  const save = async () => {
    setSaving(true); setError(null);
    try { await saveRetirementData(form); onBack(); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };
  return <EditorShell title="Edit Retirement & Deductions" onBack={onBack} onSave={save} saving={saving} error={error}><RetirementForm form={form} setForm={setForm} /></EditorShell>;
}

export function BrokerageEditor({ onBack }: { onBack: () => void }) {
  const [positions, setPositions] = useState<AccountPosition[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([getPositions(), getTransactions()]).then(([p, t]) => { setPositions(p); setTransactions(t); });
  }, []);
  const save = async () => {
    setSaving(true); setError(null);
    try { await savePositions(positions); await saveTransactions(transactions); onBack(); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };
  return (
    <EditorShell title="Edit Brokerage" onBack={onBack} onSave={save} saving={saving} error={error}>
      <PositionsTable positions={positions} setPositions={setPositions} />
      <TransactionsTable transactions={transactions} setTransactions={setTransactions} />
    </EditorShell>
  );
}

export function EquityEditor({ onBack }: { onBack: () => void }) {
  const [grants, setGrants] = useState<AccountRSUGrant[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getRSUGrants().then(setGrants); }, []);
  const save = async () => {
    setSaving(true); setError(null);
    try { await saveRSUGrants(grants); onBack(); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };
  return <EditorShell title="Edit Equity Comp" onBack={onBack} onSave={save} saving={saving} error={error}><RSUTable grants={grants} setGrants={setGrants} /></EditorShell>;
}

export function RealEstateEditor({ onBack }: { onBack: () => void }) {
  const [properties, setProperties] = useState<AccountRealEstate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getRealEstate().then(setProperties); }, []);
  const save = async () => {
    setSaving(true); setError(null);
    try { await saveRealEstate(properties); onBack(); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };
  return <EditorShell title="Edit Real Estate" onBack={onBack} onSave={save} saving={saving} error={error}><RealEstateTable properties={properties} setProperties={setProperties} /></EditorShell>;
}

// ─── Main OnboardingWizard ─────────────────────────────────────────────────────

interface Props {
  user: AuthUser | null;
  onComplete: () => void;
}

export default function OnboardingWizard({ user, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<Method>(null);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step form state
  const [taxForm, setTaxForm] = useState<TaxData>(DEFAULT_TAX);
  const [retirementForm, setRetirementForm] = useState<RetirementData>(DEFAULT_RETIREMENT);
  const [positions, setPositions] = useState<AccountPosition[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [rsuGrants, setRsuGrants] = useState<AccountRSUGrant[]>([]);
  const [realEstateList, setRealEstateList] = useState<AccountRealEstate[]>([]);

  // Inferred fields from PDF (for badge display)
  const [parsedTax, setParsedTax] = useState<ParsedTaxResult | null>(null);

  const advanceTo = (n: number) => { setStep(n); setMethod(null); setError(null); };

  const handleSkip = async () => {
    if (step === 6) {
      setSaving(true);
      try { await completeOnboarding(); onComplete(); }
      catch (e) { setError(e instanceof Error ? e.message : "Failed"); setSaving(false); }
    } else {
      advanceTo(step + 1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (step === 1) {
        // Prior year — saves partial retirement data (prior_year_agi, capital_loss_carryforward)
        await saveRetirementData(retirementForm);
        advanceTo(2);
      } else if (step === 2) {
        // Current year — saves tax data + full retirement data (k401, HSA, IRA, deductions)
        await saveTaxData(taxForm);
        await saveRetirementData(retirementForm);
        advanceTo(3);
      } else if (step === 3) {
        await savePositions(positions);
        await saveTransactions(transactions);
        advanceTo(4);
      } else if (step === 4) {
        await saveRSUGrants(rsuGrants);
        advanceTo(5);
      } else if (step === 5) {
        await saveRealEstate(realEstateList);
        advanceTo(6);
      } else if (step === 6) {
        await savePositions(positions);
        await completeOnboarding();
        onComplete();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // Step 1 PDF: prior year W-2 or 1040 → extract prior AGI
  const handlePriorYearPdf = async (file: File) => {
    setPdfLoading(true);
    setError(null);
    try {
      const result = await parseTaxPDF(file);
      setParsedTax(result);
      setRetirementForm((prev) => ({
        ...prev,
        ...(result.tax.wages ? { prior_year_agi: result.tax.wages } : {}),
      }));
    } catch {
      setError("Could not parse PDF. Please enter values manually.");
    } finally {
      setPdfLoading(false);
    }
  };

  // Step 2 PDF: current W-2 or paystub → fill tax form + retirement contributions
  const handleCurrentYearPdf = async (file: File) => {
    setPdfLoading(true);
    setError(null);
    try {
      const result = await parseTaxPDF(file);
      setParsedTax(result);
      setTaxForm((prev) => ({
        ...prev,
        ...(result.tax.wages ? { wages: result.tax.wages } : {}),
        ...(result.tax.bonus ? { bonus: result.tax.bonus } : {}),
        ...(result.tax.federal_tax_withheld ? { federal_tax_withheld: result.tax.federal_tax_withheld } : {}),
        ...(result.tax.state_tax_withheld ? { state_tax_withheld: result.tax.state_tax_withheld } : {}),
        ...(result.tax.filing_status ? { filing_status: result.tax.filing_status } : {}),
        ...(result.tax.state ? { state: result.tax.state } : {}),
      }));
      // Also merge any inferred retirement/deduction fields
      setRetirementForm((prev) => ({
        ...prev,
        ...(result.retirement?.k401_contribution ? { k401_contribution: result.retirement.k401_contribution } : {}),
        ...(result.retirement?.hsa_contribution ? { hsa_contribution: result.retirement.hsa_contribution } : {}),
        ...(result.deductions?.charitable_donations ? { charitable_donations: result.deductions.charitable_donations } : {}),
        ...(result.deductions?.property_tax_paid ? { property_tax_paid: result.deductions.property_tax_paid } : {}),
      }));
    } catch {
      setError("Could not parse PDF. Please enter values manually.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleBrokeragePdf = async (file: File) => {
    setPdfLoading(true);
    setError(null);
    try {
      const result = await parseBrokeragePDF(file);
      setPositions(result.positions);
      setTransactions(result.transactions);
    } catch {
      setError("Could not parse brokerage PDF. Please enter values manually.");
    } finally {
      setPdfLoading(false);
    }
  };

  // Load existing step 6 positions from DB
  useEffect(() => {
    if (step === 6) {
      getPositions().then(setPositions);
    }
  }, [step]);

  const stepTitle = [
    "Prior Year Tax Return",
    "Current Year Income & Paystub",
    "Brokerage Positions & Transactions",
    "Equity Compensation",
    "Real Estate",
    "Verify Cost Basis",
  ][step - 1];

  const displayName = user?.display_name?.split(" ")[0] ?? "there";

  return (
    <div className="relative flex min-h-[calc(100vh-56px)] items-start justify-center px-6 py-10 overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute" style={{ width: 500, height: 500, top: "30%", left: "50%", transform: "translate(-50%, -50%)", background: "radial-gradient(circle, rgba(245,166,35,0.04) 0%, transparent 65%)" }} />

      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        {step === 1 && (
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
              Welcome, {displayName}!
            </h1>
            <p className="mt-1 text-sm font-body" style={{ color: "var(--text-muted)" }}>
              Let&apos;s set up your financial profile. Takes about 3 minutes.
            </p>
          </div>
        )}

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          }}
        >
          <ProgressBar step={step} />

          <h2 className="mb-1 text-lg font-bold font-display" style={{ color: "var(--text-primary)" }}>
            Step {step} of {STEP_LABELS.length}: {stepTitle}
          </h2>
          <p className="mb-5 text-xs font-body" style={{ color: "var(--text-muted)" }}>
            {step === 1 && "Your prior year adjusted gross income and any capital loss carryforward. Helps us compute safe-harbor withholding."}
            {step === 2 && "Current year wages, filing info, and year-to-date amounts from your latest paystub (withheld taxes, 401k, HSA)."}
            {step === 3 && "Open positions and realized buy/sell transactions."}
            {step === 4 && "RSU, ESPP, ISO, and other equity grants."}
            {step === 5 && "Rental properties and real estate holdings."}
            {step === 6 && "Confirm cost basis for all imported positions. Rows with missing basis are flagged."}
          </p>

          {/* Method cards — not shown on step 6 (verification only) */}
          {step < 6 && (
            <MethodCards
              selected={method}
              onSelect={setMethod}
              pdfDesc={
                step === 1 ? "Prior year W-2 or 1040" :
                step === 2 ? "Current W-2 or latest paystub" :
                "W-2, 1040, or brokerage statement"
              }
            />
          )}

          {/* Step content */}
          <>
            {/* Step 1: Prior Year */}
            {step === 1 && (
              <>
                {method === "pdf" && (
                  <div className="mb-4">
                    <PdfDropZone
                      onFile={handlePriorYearPdf}
                      loading={pdfLoading}
                      label="Drop prior year W-2 or 1040 here or click to browse"
                      sublabel="We'll extract your prior year AGI automatically"
                    />
                    {parsedTax && (
                      <p className="mt-2 text-xs font-body" style={{ color: "var(--positive)" }}>
                        ✓ Prior year AGI estimated from PDF. Review and confirm below.
                      </p>
                    )}
                  </div>
                )}
                {(method === "pdf" || method === "manual") && (
                  <PriorYearForm form={retirementForm} setForm={setRetirementForm} />
                )}
              </>
            )}

            {/* Step 2: Current Year */}
            {step === 2 && (
              <>
                {method === "pdf" && (
                  <div className="mb-4">
                    <PdfDropZone
                      onFile={handleCurrentYearPdf}
                      loading={pdfLoading}
                      label="Drop current W-2 or latest paystub here or click to browse"
                      sublabel="We'll pre-fill wages, withholding, and YTD contributions"
                    />
                    {parsedTax && parsedTax.inferred_fields.length > 0 && (
                      <p className="mt-2 text-xs font-body" style={{ color: "var(--positive)" }}>
                        ✓ Pre-filled {parsedTax.inferred_fields.length} fields from your PDF. Review and edit below.
                      </p>
                    )}
                  </div>
                )}
                {(method === "pdf" || method === "manual") && (
                  <CurrentYearForm
                    taxForm={taxForm} setTaxForm={setTaxForm}
                    retirementForm={retirementForm} setRetirementForm={setRetirementForm}
                    inferredFields={parsedTax?.inferred_fields ?? []}
                  />
                )}
              </>
            )}

            {/* Step 3: Brokerage */}
            {step === 3 && (
              <>
                {method === "pdf" && (
                  <div className="mb-4">
                    <PdfDropZone onFile={handleBrokeragePdf} loading={pdfLoading} />
                    {(positions.length > 0 || transactions.length > 0) && (
                      <p className="mt-2 text-xs font-body" style={{ color: "var(--positive)" }}>
                        ✓ Found {positions.length} position{positions.length !== 1 ? "s" : ""} and {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}. Review below.
                      </p>
                    )}
                  </div>
                )}
                {(method === "pdf" || method === "manual") && (
                  <>
                    <PositionsTable positions={positions} setPositions={setPositions} />
                    <TransactionsTable transactions={transactions} setTransactions={setTransactions} />
                  </>
                )}
              </>
            )}

            {/* Step 4: Equity Comp */}
            {step === 4 && (method === "pdf" || method === "manual") && (
              <>
                {method === "pdf" && (
                  <div className="mb-4">
                    <PdfDropZone onFile={handleBrokeragePdf} loading={pdfLoading} />
                    <p className="mt-2 text-xs font-body" style={{ color: "var(--text-muted)" }}>
                      Most brokerages include RSU activity in their annual statement.
                    </p>
                  </div>
                )}
                <RSUTable grants={rsuGrants} setGrants={setRsuGrants} />
              </>
            )}

            {/* Step 5: Real Estate */}
            {step === 5 && (method === "pdf" || method === "manual") && (
              <RealEstateTable properties={realEstateList} setProperties={setRealEstateList} />
            )}

            {/* Step 6 — cost basis verification */}
            {step === 6 && (
                <div>
                  {positions.length === 0 ? (
                    <p className="text-sm font-body py-4 text-center" style={{ color: "var(--text-muted)" }}>
                      No positions to verify. Click &ldquo;Confirm & Complete&rdquo; to finish setup.
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-1 mb-2 px-1" style={{ gridTemplateColumns: "14px 60px 70px 1fr 70px" }}>
                        {["", "Type", "Ticker", "Qty", "Cost Basis"].map((h) => (
                          <span key={h} className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)", fontSize: "9px" }}>{h}</span>
                        ))}
                      </div>
                      {positions.map((pos, i) => {
                        const color = TYPE_COLORS[pos.asset_type] ?? "#fff";
                        const missing = pos.cost_basis_per_unit === 0;
                        return (
                          <div key={i} className="grid gap-1 mb-1.5 px-1 py-1.5 rounded items-center" style={{ gridTemplateColumns: "14px 60px 70px 1fr 70px", background: missing ? "rgba(245,166,35,0.04)" : "rgba(255,255,255,0.02)", border: missing ? "1px solid rgba(245,166,35,0.2)" : "1px solid transparent" }}>
                            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                            <span className="text-xs font-body uppercase" style={{ color: "var(--text-muted)" }}>{pos.asset_type}</span>
                            <span className="text-xs font-mono font-bold" style={{ color }}>{pos.ticker_or_name}</span>
                            <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{pos.quantity}</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                value={pos.cost_basis_per_unit}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value) || 0;
                                  setPositions(positions.map((p, idx) => idx === i ? { ...p, cost_basis_per_unit: v } : p));
                                }}
                                className={miniCls}
                                style={missing ? { ...inputBase, borderColor: "rgba(245,166,35,0.5)" } : inputBase}
                              />
                              {missing && (
                                <span className="text-xs font-display font-semibold" style={{ color: "var(--accent)", fontSize: "9px", whiteSpace: "nowrap" }}>⚠ est.</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
          </>

          {error && <ErrorBanner msg={error} />}

          {/* Footer — show when method chosen (or step 6) */}
          {(method !== null || step === 6) && (
            <StepFooter
              onSave={handleSave}
              onSkip={handleSkip}
              saving={saving}
              isLast={step === 6}
              disabled={step < 6 && method === null}
            />
          )}
        </div>
      </div>
    </div>
  );
}
