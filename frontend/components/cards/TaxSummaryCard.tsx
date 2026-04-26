import type { TaxSnapshot } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function TaxSummaryCard({ data }: { data: TaxSnapshot }) {
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
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Est. Federal Tax" value={fmt(data.estimated_federal_tax)} />
        <Stat label="Est. State Tax" value={fmt(data.estimated_state_tax)} />
      </div>
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
