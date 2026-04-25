import type { CapitalGains } from "@/lib/api";

const fmt = (n: number) =>
  (n >= 0 ? "+" : "") +
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const color = (n: number): string =>
  n >= 0 ? "var(--positive)" : "var(--negative)";

const ASSET_LABELS: Record<string, string> = {
  stocks: "Stocks",
  options: "Options",
  crypto: "Crypto",
  real_estate: "Real Estate",
};

export default function CapitalGainsCard({ data }: { data: CapitalGains }) {
  return (
    <div
      className="card-animate card-glow rounded-xl border p-6"
      style={
        {
          background: "var(--surface)",
          borderColor: "var(--border)",
          "--card-delay": "80ms",
        } as React.CSSProperties
      }
    >
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
        Capital Gains
      </h2>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Short-Term" value={fmt(data.short_term_realized)} n={data.short_term_realized} />
        <Stat label="Long-Term" value={fmt(data.long_term_realized)} n={data.long_term_realized} />
        <Stat label="Net Realized" value={fmt(data.net_realized)} n={data.net_realized} />
      </div>

      <div className="space-y-1.5">
        {Object.entries(data.by_asset_type).map(([type, gains]) => {
          const total = gains.short_term + gains.long_term;
          return (
            <div
              key={type}
              className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{ASSET_LABELS[type] ?? type}</span>
              <span className="font-mono font-bold text-xs" style={{ color: color(total) }}>
                {fmt(total)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, n }: { label: string; value: string; n: number }) {
  return (
    <div>
      <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-lg font-bold font-mono" style={{ color: color(n) }}>{value}</p>
    </div>
  );
}
