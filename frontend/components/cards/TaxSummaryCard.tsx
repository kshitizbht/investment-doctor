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
      <div className="grid grid-cols-2 gap-5">
        <Stat label="Estimated AGI" value={fmt(data.agi)} highlight />
        <Stat label="Federal Bracket" value={`${data.federal_bracket_pct}%`} />
        <Stat label="Est. Federal Tax" value={fmt(data.estimated_federal_tax)} />
        <Stat label="Est. State Tax (CA)" value={fmt(data.estimated_state_tax)} />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
        {label}
      </p>
      <p
        className="text-xl font-bold font-mono"
        style={{ color: highlight ? "var(--accent)" : "var(--text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}
