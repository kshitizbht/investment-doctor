"use client";

import { useState } from "react";
import type { NetWorthCurrent, NetWorthPoint } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fmtK = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
};

// ─── SVG line chart ───────────────────────────────────────────────────────────

function NetWorthChart({ history }: { history: NetWorthPoint[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: NetWorthPoint } | null>(null);

  if (!history.length) return null;

  const W = 800;
  const H = 160;
  const PAD = { top: 10, right: 20, bottom: 28, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const totals = history.map((d) => d.total);
  const minY = Math.min(...totals) * 0.97;
  const maxY = Math.max(...totals) * 1.01;

  const xAt = (i: number) => PAD.left + (i / (history.length - 1)) * chartW;
  const yAt = (v: number) => PAD.top + (1 - (v - minY) / (maxY - minY)) * chartH;

  const linePts = history.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.total).toFixed(1)}`).join(" L ");
  const linePath = `M ${linePts}`;
  const areaPath = `${linePath} L${xAt(history.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${xAt(0).toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;

  // Year label positions
  const yearLabels: { label: string; x: number }[] = [];
  history.forEach((d, i) => {
    const dt = new Date(d.date + "T00:00:00");
    if (dt.getMonth() === 0) yearLabels.push({ label: String(dt.getFullYear()), x: xAt(i) });
  });

  // Y-axis ticks
  const yTicks = [minY, (minY + maxY) / 2, maxY];

  return (
    <div className="relative w-full" style={{ paddingTop: "22%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const svgX = ((e.clientX - rect.left) / rect.width) * W;
          const idx = Math.round(((svgX - PAD.left) / chartW) * (history.length - 1));
          if (idx >= 0 && idx < history.length) {
            setTooltip({ x: xAt(idx), y: yAt(history[idx].total), point: history[idx] });
          }
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A623" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#F5A623" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal grid */}
        {yTicks.map((tick, i) => (
          <line key={i} x1={PAD.left} y1={yAt(tick)} x2={W - PAD.right} y2={yAt(tick)}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#nwGrad)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="#F5A623" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text key={i} x={PAD.left - 6} y={yAt(tick) + 4}
            textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.28)" fontFamily="monospace">
            {fmtK(tick)}
          </text>
        ))}

        {/* X-axis year labels */}
        {yearLabels.map((lbl, i) => (
          <text key={i} x={lbl.x} y={H - 4}
            textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.28)" fontFamily="sans-serif">
            {lbl.label}
          </text>
        ))}

        {/* Tooltip crosshair */}
        {tooltip && (
          <>
            <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + chartH}
              stroke="rgba(245,166,35,0.3)" strokeWidth="1" strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />
            <circle cx={tooltip.x} cy={tooltip.y} r="4" fill="#F5A623" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>

      {/* Tooltip box */}
      {tooltip && (
        <div
          className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 rounded-lg px-3 py-2 text-xs font-mono z-10"
          style={{
            background: "rgba(14,22,32,0.95)",
            border: "1px solid rgba(245,166,35,0.3)",
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "var(--accent)" }}>{fmt(tooltip.point.total)}</span>
          <span className="ml-2" style={{ color: "var(--text-muted)" }}>
            {new Date(tooltip.point.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

interface Props {
  current: NetWorthCurrent;
  history?: NetWorthPoint[];
}

const SEGMENT_COLORS = {
  stocks: "#F5A623",
  real_estate: "#00C87C",
  income: "#5B8DEF",
};

export default function NetWorthCard({ current, history = [] }: Props) {
  const pct = (v: number) => current.total > 0 ? ((v / current.total) * 100).toFixed(1) : "0.0";

  return (
    <div
      className="card-animate card-glow rounded-xl border p-6"
      style={
        {
          background: "var(--surface)",
          borderColor: "var(--border)",
          "--card-delay": "240ms",
        } as React.CSSProperties
      }
    >
      <div className="flex items-start justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
          Net Worth
        </h2>
        {history.length > 0 && (
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            {history.length}mo history
          </span>
        )}
      </div>

      {/* Total */}
      <p className="text-3xl font-bold font-mono mb-4" style={{ color: "var(--text-primary)" }}>
        {fmt(current.total)}
      </p>

      {/* Breakdown bar */}
      <div className="flex rounded-full overflow-hidden mb-3" style={{ height: "4px" }}>
        <div style={{ width: `${pct(current.stocks_value)}%`, background: SEGMENT_COLORS.stocks }} />
        <div style={{ width: `${pct(current.real_estate_value)}%`, background: SEGMENT_COLORS.real_estate }} />
        <div style={{ width: `${pct(current.income_value)}%`, background: SEGMENT_COLORS.income }} />
      </div>

      {/* Breakdown stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <SegmentStat label="Stocks" value={current.stocks_value} pct={pct(current.stocks_value)} color={SEGMENT_COLORS.stocks} />
        <SegmentStat label="Real Estate" value={current.real_estate_value} pct={pct(current.real_estate_value)} color={SEGMENT_COLORS.real_estate} />
        <SegmentStat label="Income" value={current.income_value} pct={pct(current.income_value)} color={SEGMENT_COLORS.income} />
      </div>

      {/* Chart */}
      {history.length > 0 && <NetWorthChart history={history} />}
    </div>
  );
}

function SegmentStat({ label, value, pct, color }: { label: string; value: number; pct: string; color: string }) {
  return (
    <div className="rounded-lg px-2 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-1 mb-1">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-xs truncate" style={{ color: "var(--text-muted)", fontSize: "10px" }}>{label}</span>
      </div>
      <p className="text-sm font-bold font-mono" style={{ color: "var(--text-primary)" }}>{fmtK(value)}</p>
      <p className="text-xs font-mono" style={{ color: "var(--text-muted)", fontSize: "10px" }}>{pct}%</p>
    </div>
  );
}
