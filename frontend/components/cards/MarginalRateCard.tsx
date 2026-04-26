import type { MarginalRateStack } from "@/lib/api";

export default function MarginalRateCard({ data }: { data: MarginalRateStack }) {
  const ordinaryRows = [
    { label: "Federal marginal", pct: data.federal_pct, color: "#F5A623" },
    ...(data.medicare_surtax_pct > 0 ? [{ label: "Medicare surtax (0.9%)", pct: data.medicare_surtax_pct, color: "#FF4455" }] : []),
    { label: "State", pct: data.state_pct, color: "#5B8DEF" },
  ];

  const ltcgRows = [
    { label: "Federal LTCG", pct: data.total_ltcg_pct - data.niit_pct - data.state_pct, color: "#00C87C" },
    ...(data.niit_pct > 0 ? [{ label: "NIIT (3.8%)", pct: data.niit_pct, color: "#FF4455" }] : []),
    { label: "State", pct: data.state_pct, color: "#5B8DEF" },
  ];

  return (
    <div
      className="card-animate card-glow rounded-xl border p-6"
      style={{ background: "var(--surface)", borderColor: "var(--border)", "--card-delay": "0ms" } as React.CSSProperties}
    >
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
        Marginal Rate Stack
      </h2>

      {/* Ordinary income */}
      <RateSection
        title="Ordinary Income"
        totalPct={data.total_ordinary_pct}
        keepPer1000={data.keep_per_1000_ordinary}
        rows={ordinaryRows}
      />

      <div className="my-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }} />

      {/* Investment income (LTCG) */}
      <RateSection
        title="Long-Term Capital Gains"
        totalPct={data.total_ltcg_pct}
        keepPer1000={data.keep_per_1000_ltcg}
        rows={ltcgRows}
      />
    </div>
  );
}

function RateSection({
  title,
  totalPct,
  keepPer1000,
  rows,
}: {
  title: string;
  totalPct: number;
  keepPer1000: number;
  rows: { label: string; pct: number; color: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold mb-2 uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>

      {/* Stacked bar */}
      <div className="flex rounded overflow-hidden h-3 mb-3" style={{ background: "rgba(255,255,255,0.04)" }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{ width: `${r.pct}%`, background: r.color, opacity: 0.8 }}
            title={`${r.label}: ${r.pct}%`}
          />
        ))}
        {/* "Keep" portion */}
        <div
          style={{ width: `${100 - totalPct}%`, background: "rgba(0,200,124,0.25)" }}
          title={`Keep: ${(100 - totalPct).toFixed(1)}%`}
        />
      </div>

      {/* Row breakdown */}
      <div className="space-y-1 mb-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: r.color }} />
              <span className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>{r.label}</span>
            </div>
            <span className="text-xs font-mono" style={{ color: "var(--text-primary)" }}>{r.pct}%</span>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: "var(--positive)", opacity: 0.6 }} />
            <span className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>You keep</span>
          </div>
          <span className="text-xs font-mono" style={{ color: "var(--positive)" }}>{(100 - totalPct).toFixed(1)}%</span>
        </div>
      </div>

      {/* Total + keep callout */}
      <div className="flex justify-between items-center rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
          Total rate
        </span>
        <div className="text-right">
          <span className="text-lg font-bold font-mono" style={{ color: "var(--text-primary)" }}>{totalPct}%</span>
          <span className="text-xs font-body ml-2" style={{ color: "var(--text-muted)" }}>
            keep ${keepPer1000} / $1,000
          </span>
        </div>
      </div>
    </div>
  );
}
