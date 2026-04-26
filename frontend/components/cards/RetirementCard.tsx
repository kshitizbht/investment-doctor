import type { RetirementOptimizer } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function RetirementCard({ data }: { data: RetirementOptimizer }) {
  return (
    <div
      className="card-animate card-glow rounded-xl border p-6"
      style={{ background: "var(--surface)", borderColor: "var(--border)", "--card-delay": "0ms" } as React.CSSProperties}
    >
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
        Retirement Optimizer
      </h2>

      <div className="space-y-4">
        {/* 401k */}
        <ContributionRow
          label="401(k) / 403(b)"
          contributed={data.k401_contributed}
          limit={data.k401_limit}
          pctUsed={data.k401_pct_used}
          room={data.k401_room}
          taxSaving={data.k401_tax_saving_if_maxed}
          color="#F5A623"
        />

        <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }} />

        {/* HSA */}
        <ContributionRow
          label="HSA"
          contributed={data.hsa_contributed}
          limit={data.hsa_limit}
          pctUsed={data.hsa_contributed > 0 ? Math.round(data.hsa_contributed / data.hsa_limit * 100) : 0}
          room={data.hsa_room}
          taxSaving={data.hsa_tax_saving_if_maxed}
          color="#00C87C"
        />

        <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }} />

        {/* IRA */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold font-display" style={{ color: "var(--text-secondary)" }}>IRA</span>
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              {fmt(data.ira_contributed)} / {fmt(data.ira_limit)}
            </span>
          </div>
          <ProgressBar pct={data.ira_contributed > 0 ? Math.round(data.ira_contributed / data.ira_limit * 100) : 0} color="#8B5CF6" />
          {data.ira_room > 0 && (
            <p className="mt-1 text-xs font-body" style={{ color: "var(--text-muted)" }}>
              {fmt(data.ira_room)} room remaining
            </p>
          )}
        </div>
      </div>

      {/* Total potential savings callout */}
      {(data.k401_tax_saving_if_maxed + data.hsa_tax_saving_if_maxed) > 0 && (
        <div className="mt-4 rounded-lg px-3 py-2.5" style={{ background: "rgba(0,200,124,0.06)", border: "1px solid rgba(0,200,124,0.15)" }}>
          <p className="text-xs font-body mb-0.5" style={{ color: "var(--text-muted)" }}>
            Max out remaining contributions → save
          </p>
          <p className="text-xl font-bold font-mono" style={{ color: "var(--positive)" }}>
            {fmt(data.k401_tax_saving_if_maxed + data.hsa_tax_saving_if_maxed)} in taxes
          </p>
        </div>
      )}
    </div>
  );
}

function ContributionRow({
  label, contributed, limit, pctUsed, room, taxSaving, color,
}: {
  label: string; contributed: number; limit: number; pctUsed: number;
  room: number; taxSaving: number; color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold font-display" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {fmt(contributed)} / {fmt(limit)}
        </span>
      </div>
      <ProgressBar pct={pctUsed} color={color} />
      <div className="flex justify-between mt-1">
        <span className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
          {room > 0 ? `${fmt(room)} room left` : "Maxed out ✓"}
        </span>
        {taxSaving > 0 && (
          <span className="text-xs font-body" style={{ color: "var(--positive)" }}>
            saves {fmt(taxSaving)} if maxed
          </span>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, pct)}%`, background: color, opacity: 0.75 }}
      />
    </div>
  );
}
