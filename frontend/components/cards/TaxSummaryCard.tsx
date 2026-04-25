import type { TaxSnapshot } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function TaxSummaryCard({ data }: { data: TaxSnapshot }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-neutral-800">Tax Snapshot</h2>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Estimated AGI" value={fmt(data.agi)} />
        <Stat label="Federal Bracket" value={`${data.federal_bracket_pct}%`} />
        <Stat label="Est. Federal Tax" value={fmt(data.estimated_federal_tax)} />
        <Stat label="Est. State Tax (CA)" value={fmt(data.estimated_state_tax)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}
