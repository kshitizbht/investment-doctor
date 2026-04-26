import type { IncomeCharacter } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function IncomeCharacterCard({ data }: { data: IncomeCharacter }) {
  const streams = [
    { label: "W2 Wages", amount: data.w2_wages, isOrdinary: true },
    { label: "Bonus", amount: data.bonus, isOrdinary: true },
    { label: "RSU Vests", amount: data.rsu_vests, isOrdinary: true },
    { label: "Short-term Gains", amount: data.short_term_gains, isOrdinary: true },
    { label: "Long-term Gains", amount: data.long_term_gains, isOrdinary: false },
    { label: "Qualified Dividends", amount: data.qualified_dividends, isOrdinary: false },
    { label: "Rental Income", amount: data.rental_income, isOrdinary: true },
  ].filter((s) => s.amount !== 0);

  const total = streams.reduce((sum, s) => sum + Math.abs(s.amount), 0);

  return (
    <div
      className="card-animate card-glow rounded-xl border p-6"
      style={{ background: "var(--surface)", borderColor: "var(--border)", "--card-delay": "0ms" } as React.CSSProperties}
    >
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
        Income Character
      </h2>

      {/* Rate legend */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#F5A623" }} />
          <span className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
            Ordinary ({data.rate_ordinary_pct}%)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#00C87C" }} />
          <span className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
            LTCG / QD ({data.rate_ltcg_pct}%)
          </span>
        </div>
      </div>

      {/* Income bars */}
      <div className="space-y-2">
        {streams.map((s, i) => {
          const pct = total > 0 ? (Math.abs(s.amount) / total) * 100 : 0;
          const color = s.isOrdinary ? "#F5A623" : "#00C87C";
          const isNegative = s.amount < 0;
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                <span className="text-xs font-mono" style={{ color: isNegative ? "var(--negative)" : "var(--text-primary)" }}>
                  {isNegative ? "" : ""}{fmt(s.amount)}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: isNegative ? "var(--negative)" : color, opacity: 0.7 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-4 flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-xs font-body" style={{ color: "var(--text-muted)" }}>Total income</span>
        <span className="text-lg font-bold font-mono" style={{ color: "var(--text-primary)" }}>
          {fmt(streams.reduce((sum, s) => sum + s.amount, 0))}
        </span>
      </div>
    </div>
  );
}
