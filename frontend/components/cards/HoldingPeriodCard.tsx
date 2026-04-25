import type { HoldingPeriodAlert } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function HoldingPeriodCard({ data }: { data: HoldingPeriodAlert[] }) {
  const cardStyle = {
    background: "var(--surface)",
    borderColor: "var(--border)",
    "--card-delay": "240ms",
  } as React.CSSProperties;

  if (data.length === 0) {
    return (
      <div className="card-animate card-glow rounded-xl border p-6" style={cardStyle}>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
          Holding Period Alerts
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No positions approaching long-term status.
        </p>
      </div>
    );
  }

  return (
    <div className="card-animate card-glow rounded-xl border p-6" style={cardStyle}>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
        Holding Period Alerts
      </h2>
      <div className="space-y-1.5">
        {data.map((alert) => (
          <div
            key={`${alert.ticker_or_name}-${alert.asset_type}`}
            className="flex items-center justify-between rounded-lg px-3 py-2.5"
            style={{ background: "rgba(245,166,35,0.05)", border: "1px solid rgba(245,166,35,0.1)" }}
          >
            <div>
              <span className="font-medium font-display text-sm" style={{ color: "var(--text-primary)" }}>
                {alert.ticker_or_name}
              </span>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Long-term in{" "}
                <span className="font-mono font-bold" style={{ color: "var(--accent)" }}>
                  {alert.days_until_ltcg}d
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>Save by waiting</p>
              <p className="font-mono font-bold text-sm" style={{ color: "var(--positive)" }}>
                {fmt(alert.estimated_tax_saving)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
