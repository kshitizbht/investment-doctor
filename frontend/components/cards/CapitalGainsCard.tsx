import type { CapitalGains } from "@/lib/api";

const fmt = (n: number) =>
  (n >= 0 ? "+" : "") +
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const color = (n: number) => (n >= 0 ? "text-emerald-600" : "text-red-600");

const ASSET_LABELS: Record<string, string> = {
  stocks: "Stocks",
  options: "Options",
  crypto: "Crypto",
  real_estate: "Real Estate",
};

export default function CapitalGainsCard({ data }: { data: CapitalGains }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-neutral-800">Capital Gains Summary</h2>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Short-Term" value={fmt(data.short_term_realized)} n={data.short_term_realized} />
        <Stat label="Long-Term" value={fmt(data.long_term_realized)} n={data.long_term_realized} />
        <Stat label="Net Realized" value={fmt(data.net_realized)} n={data.net_realized} />
      </div>

      <div className="space-y-2">
        {Object.entries(data.by_asset_type).map(([type, gains]) => (
          <div key={type} className="flex items-center justify-between text-sm">
            <span className="text-neutral-600">{ASSET_LABELS[type] ?? type}</span>
            <span className={color(gains.short_term + gains.long_term)}>
              {fmt(gains.short_term + gains.long_term)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, n }: { label: string; value: string; n: number }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${color(n)}`}>{value}</p>
    </div>
  );
}
