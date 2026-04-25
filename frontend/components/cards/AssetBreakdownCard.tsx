import type { AssetBreakdown } from "@/lib/api";

const fmt = (n: number) =>
  (n >= 0 ? "+" : "") +
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const LABELS: Record<string, string> = {
  stocks: "Stocks",
  options: "Options",
  crypto: "Crypto",
  real_estate: "Real Estate",
};

const COLORS: Record<string, string> = {
  stocks:      "#F5A623",
  options:     "#00C87C",
  crypto:      "#FF4455",
  real_estate: "#8B5CF6",
};

export default function AssetBreakdownCard({ data }: { data: AssetBreakdown }) {
  const entries = Object.entries(data.by_type);

  return (
    <div
      className="card-animate card-glow rounded-xl border p-6"
      style={
        {
          background: "var(--surface)",
          borderColor: "var(--border)",
          "--card-delay": "320ms",
        } as React.CSSProperties
      }
    >
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
        Asset Breakdown
      </h2>

      {/* Segmented bar */}
      <div className="mb-4 flex h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        {entries.map(([type, val]) => (
          <div
            key={type}
            style={{
              width: `${val.pct_of_portfolio}%`,
              background: COLORS[type] ?? "#6B7280",
            }}
            title={`${LABELS[type] ?? type}: ${val.pct_of_portfolio}%`}
          />
        ))}
      </div>

      <div className="space-y-2">
        {entries.map(([type, val]) => (
          <div key={type} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ background: COLORS[type] ?? "#6B7280" }}
              />
              <span style={{ color: "var(--text-secondary)" }}>{LABELS[type] ?? type}</span>
              <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                {val.pct_of_portfolio}%
              </span>
            </div>
            <span
              className="font-mono font-bold text-xs"
              style={{ color: val.unrealized_gain_loss >= 0 ? "var(--positive)" : "var(--negative)" }}
            >
              {fmt(val.unrealized_gain_loss)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
