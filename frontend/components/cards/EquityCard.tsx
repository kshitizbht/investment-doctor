"use client";

import type { EquityAnalysis } from "@/lib/api";
import ClickableTicker from "@/components/ClickableTicker";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function EquityCard({ data }: { data: EquityAnalysis }) {
  if (!data.grants.length && data.total_vested_income === 0) {
    return (
      <div
        className="card-animate card-glow rounded-xl border p-6"
        style={{ background: "var(--surface)", borderColor: "var(--border)", "--card-delay": "0ms" } as React.CSSProperties}
      >
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
          Equity Compensation
        </h2>
        <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>
          No RSU/ESPP grants entered. Add equity grants in the calculator sidebar.
        </p>
      </div>
    );
  }

  const gapColor = data.withholding_gap >= 0 ? "var(--positive)" : "var(--negative)";
  const gapBg = data.withholding_gap >= 0 ? "rgba(0,200,124,0.06)" : "rgba(255,68,85,0.06)";
  const gapBorder = data.withholding_gap >= 0 ? "rgba(0,200,124,0.18)" : "rgba(255,68,85,0.2)";
  const gapLabel = data.withholding_gap >= 0 ? "Withholding surplus" : "Withholding gap";

  return (
    <div
      className="card-animate card-glow rounded-xl border p-6"
      style={{ background: "var(--surface)", borderColor: "var(--border)", "--card-delay": "0ms" } as React.CSSProperties}
    >
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
        Equity Compensation
      </h2>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg px-3 py-2" style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.15)" }}>
          <p className="text-xs mb-0.5 font-body" style={{ color: "var(--text-muted)" }}>Vested YTD (W2 income)</p>
          <p className="text-lg font-bold font-mono" style={{ color: "var(--accent)" }}>{fmt(data.total_vested_income)}</p>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-xs mb-0.5 font-body" style={{ color: "var(--text-muted)" }}>Retained value</p>
          <p className="text-lg font-bold font-mono" style={{ color: "var(--text-primary)" }}>{fmt(data.total_retained_value)}</p>
        </div>
      </div>

      {/* Withholding analysis */}
      <div className="rounded-lg px-4 py-3 mb-4" style={{ background: gapBg, border: `1px solid ${gapBorder}` }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold font-display uppercase tracking-wider" style={{ color: gapColor }}>{gapLabel}</p>
          <p className="text-lg font-bold font-mono" style={{ color: gapColor }}>
            {data.withholding_gap >= 0 ? "+" : ""}{fmt(data.withholding_gap)}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-body">
            <span style={{ color: "var(--text-muted)" }}>Withheld at 22% (supplemental)</span>
            <span style={{ color: "var(--text-secondary)" }}>{fmt(data.supplemental_withheld)}</span>
          </div>
          <div className="flex justify-between text-xs font-body">
            <span style={{ color: "var(--text-muted)" }}>Owed at marginal rate</span>
            <span style={{ color: "var(--text-secondary)" }}>{fmt(data.actual_tax_owed)}</span>
          </div>
        </div>
      </div>

      {/* Per-grant rows */}
      {data.grants.map((g, i) => (
        <div
          key={i}
          className="rounded-lg px-3 py-2.5 mb-2"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <ClickableTicker
                ticker={g.ticker}
                assetType="stock"
                style={{ color: "#F5A623", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.75rem" }}
              />
              <span className="text-[10px] rounded-full px-1.5 py-0.5 font-mono" style={{ background: "rgba(245,166,35,0.1)", color: "rgba(245,166,35,0.7)" }}>{g.grant_type}</span>
            </div>
            <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{g.shares_vested_ytd} shares @ ${g.fmv_at_vest.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs font-body">
            <span style={{ color: "var(--text-muted)" }}>{g.retained_shares} shares retained · {fmt(g.retained_value)}</span>
            {g.next_vest_date && (
              <span style={{ color: "var(--accent)", opacity: 0.7 }}>
                Next vest {g.next_vest_date.slice(0, 10)} · {g.next_vest_shares} shares
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
