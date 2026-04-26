import type { AssetBreakdown } from "@/lib/api";

const fmt = (n: number) =>
  (n >= 0 ? "+" : "") +
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const color = (n: number) => (n >= 0 ? "var(--positive)" : "var(--negative)");

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

export default function UnrealizedGainsCard({ data }: { data: AssetBreakdown }) {
  const entries = Object.entries(data.by_type) as [string, { unrealized_gain_loss: number; pct_of_portfolio: number }][];
  const total = entries.reduce((sum, [, v]) => sum + v.unrealized_gain_loss, 0);

  return (
    <div
      className="card-animate card-glow rounded-xl border p-6"
      style={
        {
          background: "var(--surface)",
          borderColor: "var(--border)",
          "--card-delay": "160ms",
        } as React.CSSProperties
      }
    >
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
        Unrealized Gains / Losses
      </h2>

      {/* Total */}
      <div
        className="mb-4 flex items-center justify-between rounded-lg px-3 py-2.5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Total Unrealized
        </span>
        <span className="text-xl font-bold font-mono" style={{ color: color(total) }}>
          {fmt(total)}
        </span>
      </div>

      {/* Per-type rows */}
      <div className="space-y-2">
        {entries.map(([type, val]) => {
          const gl = val.unrealized_gain_loss;
          return (
            <div key={type} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: COLORS[type] ?? "#6B7280" }} />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {LABELS[type] ?? type}
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-sm" style={{ color: color(gl) }}>
                  {fmt(gl)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual bar showing gain vs loss split */}
      {total !== 0 && (
        <div className="mt-4">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            {entries.filter(([, v]) => v.unrealized_gain_loss > 0).map(([type, val]) => {
              const gainTotal = entries.reduce((s, [, v]) => s + Math.max(0, v.unrealized_gain_loss), 0);
              const w = gainTotal > 0 ? (val.unrealized_gain_loss / gainTotal) * (total > 0 ? 100 : 50) : 0;
              return <div key={type} style={{ width: `${w}%`, background: COLORS[type] ?? "var(--positive)", opacity: 0.85 }} />;
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--positive)" }}>
              Gains: {fmt(entries.reduce((s, [, v]) => s + Math.max(0, v.unrealized_gain_loss), 0))}
            </span>
            <span style={{ color: "var(--negative)" }}>
              Losses: {fmt(entries.reduce((s, [, v]) => s + Math.min(0, v.unrealized_gain_loss), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
