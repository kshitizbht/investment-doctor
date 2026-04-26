import type { TaxSnapshot, DeductionOptimizer } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function TaxSummaryCard({
  data,
  deductions,
}: {
  data: TaxSnapshot;
  deductions?: DeductionOptimizer;
}) {
  return (
    <div
      className="card-animate card-glow rounded-xl border p-6"
      style={
        {
          background: "var(--surface)",
          borderColor: "var(--border)",
          "--card-delay": "0ms",
        } as React.CSSProperties
      }
    >
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
        Tax Snapshot
      </h2>

      {/* AGI — full width, prominent */}
      <div className="mb-4 rounded-lg px-3 py-2.5" style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.15)" }}>
        <p className="text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
          Estimated AGI
        </p>
        <p className="text-2xl font-bold font-mono" style={{ color: "var(--accent)" }}>
          {fmt(data.agi)}
        </p>
      </div>

      {/* Brackets row */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Stat label="Federal Bracket" value={`${data.federal_bracket_pct}%`} />
        <Stat label="State Bracket" value={`${data.state_bracket_pct}%`} />
      </div>

      {/* Tax estimates row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat label="Est. Federal Tax" value={fmt(data.estimated_federal_tax)} />
        <Stat label="Est. State Tax" value={fmt(data.estimated_state_tax)} />
      </div>

      {/* Deduction optimizer */}
      {deductions && (
        <>
          <div className="border-t mb-3" style={{ borderColor: "rgba(255,255,255,0.06)" }} />
          <p className="text-xs font-semibold uppercase tracking-wider font-display mb-2" style={{ color: "var(--text-muted)" }}>
            Deduction
          </p>
          <div
            className="rounded-lg px-3 py-2.5 mb-2"
            style={{
              background: deductions.use_itemized ? "rgba(0,200,124,0.06)" : "rgba(255,255,255,0.03)",
              border: deductions.use_itemized ? "1px solid rgba(0,200,124,0.18)" : "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
                {deductions.use_itemized ? "Itemized (better)" : "Standard (better)"}
              </span>
              <span className="text-sm font-bold font-mono" style={{ color: deductions.use_itemized ? "var(--positive)" : "var(--text-primary)" }}>
                {fmt(deductions.deduction_amount)}
              </span>
            </div>
            <div className="space-y-0.5">
              <DeductionRow label={`Standard: ${fmt(deductions.standard_deduction)}`} active={!deductions.use_itemized} />
              <DeductionRow
                label={`Itemized: ${fmt(deductions.itemized_total)} (MI ${fmt(deductions.mortgage_interest)} + SALT ${fmt(deductions.salt_deductible)} + Char ${fmt(deductions.charitable)})`}
                active={deductions.use_itemized}
              />
            </div>
            {deductions.use_itemized && deductions.additional_savings > 0 && (
              <p className="mt-1 text-xs font-body" style={{ color: "var(--positive)" }}>
                Saves {fmt(deductions.additional_savings)} vs. standard deduction
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
        {label}
      </p>
      <p className="text-lg font-bold font-mono" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function DeductionRow({ label, active }: { label: string; active: boolean }) {
  return (
    <p className="text-[10px] font-body" style={{ color: active ? "var(--text-secondary)" : "var(--text-muted)", opacity: active ? 1 : 0.6 }}>
      {active ? "✓ " : "  "}{label}
    </p>
  );
}
