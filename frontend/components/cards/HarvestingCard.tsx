"use client";

import type { Harvesting } from "@/lib/api";
import ClickableTicker from "@/components/ClickableTicker";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function HarvestingCard({ data }: { data: Harvesting }) {
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
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
        Tax Loss Harvesting
      </h2>

      <div className="mb-4 flex items-center gap-4 text-sm">
        <div>
          <span style={{ color: "var(--text-muted)" }}>Potential savings </span>
          <span className="font-mono font-bold" style={{ color: "var(--positive)" }}>
            {fmt(data.estimated_tax_savings)}
          </span>
        </div>
        <div className="h-3 w-px" style={{ background: "var(--border)" }} />
        <div>
          <span style={{ color: "var(--text-muted)" }}>Losses </span>
          <span className="font-mono font-bold" style={{ color: "var(--negative)" }}>
            {fmt(data.total_harvestable_loss)}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.opportunities.map((opp) => (
          <div
            key={`${opp.ticker_or_name}-${opp.asset_type}`}
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <ClickableTicker
                ticker={opp.ticker_or_name}
                assetType={opp.asset_type}
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "0.875rem" }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{opp.asset_type}</span>
              {opp.wash_sale_risk && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: "rgba(245,158,11,0.15)", color: "var(--warning)" }}
                >
                  Wash sale risk
                </span>
              )}
            </div>
            <span className="font-mono font-bold text-sm" style={{ color: "var(--negative)" }}>
              {fmt(opp.unrealized_loss)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
