import type { TaxBalance } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function TaxBalanceCard({ data }: { data: TaxBalance }) {
  const isRefund = data.balance >= 0;
  const absBalance = Math.abs(data.balance);
  const balanceColor = isRefund ? "var(--positive)" : "var(--negative)";
  const balanceBg = isRefund ? "rgba(0,200,124,0.06)" : "rgba(255,68,85,0.06)";
  const balanceBorder = isRefund ? "rgba(0,200,124,0.18)" : "rgba(255,68,85,0.2)";

  return (
    <div
      className="card-animate card-glow rounded-xl border p-6"
      style={{ background: "rgba(255,255,255,0.055)", borderColor: "rgba(255,255,255,0.1)", boxShadow: "inset 3px 0 0 rgba(245,166,35,0.65)", "--card-delay": "0ms" } as React.CSSProperties}
    >
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
        Tax Balance
      </h2>

      {/* Balance callout */}
      <div className="mb-4 rounded-lg px-4 py-3 text-center" style={{ background: balanceBg, border: `1px solid ${balanceBorder}` }}>
        <p className="text-xs mb-1 font-body" style={{ color: "var(--text-muted)" }}>
          {isRefund ? "Estimated Refund" : "Estimated Amount Owed"}
        </p>
        <p className="text-3xl font-bold font-mono" style={{ color: balanceColor }}>
          {isRefund ? "+" : "-"}{fmt(absBalance)}
        </p>
        {data.underpayment_risk && !isRefund && (
          <p className="mt-1 text-xs font-body" style={{ color: "var(--negative)" }}>
            ⚠ &gt;$1,000 underpayment — estimated tax penalty may apply
          </p>
        )}
      </div>

      {/* Tax breakdown */}
      <div className="space-y-2 mb-3">
        <Row label="Federal Income Tax" value={fmt(data.estimated_federal_tax)} />
        <Row label="State Income Tax" value={fmt(data.estimated_state_tax)} />
        {data.niit > 0 && <Row label="NIIT (3.8%)" value={fmt(data.niit)} accent="var(--negative)" />}
        {data.medicare_surtax > 0 && <Row label="Medicare Surtax (0.9%)" value={fmt(data.medicare_surtax)} accent="var(--negative)" />}
      </div>

      {/* Divider */}
      <div className="my-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }} />

      {/* Total vs withheld */}
      <div className="space-y-2">
        <Row label="Est. Total Tax" value={fmt(data.estimated_total_tax)} bold />
        <Row label="Total Withheld" value={fmt(data.total_withheld)} accent="var(--positive)" />
      </div>
    </div>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-body" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        className={`text-sm font-mono ${bold ? "font-bold" : "font-medium"}`}
        style={{ color: accent ?? "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}
