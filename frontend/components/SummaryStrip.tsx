"use client";

import type { InsightsResponse } from "@/lib/api";
import { fmtShort } from "@/lib/format";

export default function SummaryStrip({ data }: { data: InsightsResponse }) {
  const balance = data.tax_balance?.balance;
  const isRefund = balance !== undefined && balance >= 0;
  const topRate = data.marginal_rate_stack?.total_ordinary_pct;
  const byType = data.asset_breakdown?.by_type;
  const unrealized = byType
    ? Object.values(byType).reduce((s, t) => s + (t?.unrealized_gain_loss ?? 0), 0)
    : null;

  const stats: { label: string; value: string; color?: string; sub?: string }[] = [
    { label: "Net Worth", value: fmtShort(data.net_worth.total), color: "var(--text-primary)" },
    ...(balance !== undefined
      ? [{ label: isRefund ? "Est. Refund" : "Est. Owed", value: fmtShort(Math.abs(balance)), color: isRefund ? "var(--positive)" : "var(--negative)" }]
      : []),
    ...(topRate !== undefined
      ? [{ label: "Top Marginal Rate", value: `${topRate}%`, color: "var(--text-primary)", sub: "ordinary income" }]
      : []),
    ...(unrealized !== null
      ? [{ label: "Unrealized P&L", value: fmtShort(unrealized), color: unrealized >= 0 ? "var(--positive)" : "var(--negative)" }]
      : []),
  ];

  return (
    <div
      className="rounded-xl border mb-6 grid"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: "rgba(255,255,255,0.07)",
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
      }}
    >
      {stats.map((s, i) => (
        <div
          key={i}
          className="px-5 py-3.5"
          style={{ borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.07)" : undefined }}
        >
          <p
            className="font-display uppercase mb-1"
            style={{ fontSize: "9px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.28)", fontWeight: 600 }}
          >
            {s.label}
          </p>
          <p className="text-xl font-bold font-mono leading-none" style={{ color: s.color ?? "var(--text-primary)" }}>
            {s.value}
          </p>
          {s.sub && (
            <p className="mt-0.5 font-body" style={{ fontSize: "10px", color: "rgba(255,255,255,0.22)" }}>{s.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
