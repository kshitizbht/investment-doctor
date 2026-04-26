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

      {/* Short-Term and Long-Term side by side */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Stat label="Short-Term" value={fmt(data.short_term_realized)} n={data.short_term_realized} />
        <Stat label="Long-Term" value={fmt(data.long_term_realized)} n={data.long_term_realized} />
      </div>

      {/* Net Realized full-width with prominent styling */}
      <div
        className="mb-5 flex items-center justify-between rounded-lg px-3 py-2.5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Net Realized
        </span>
        <span className="text-xl font-bold font-mono" style={{ color: color(data.net_realized) }}>
          {fmt(data.net_realized)}
        </span>
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
              <div className="text-right">
                <span className="font-mono font-bold text-xs block" style={{ color: color(total) }}>
                  {fmt(total)}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                  ST {fmt(gains.short_term)} / LT {fmt(gains.long_term)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, n }: { label: string; value: string; n: number }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-lg font-bold font-mono" style={{ color: color(n) }}>{value}</p>
    </div>
  );
}
