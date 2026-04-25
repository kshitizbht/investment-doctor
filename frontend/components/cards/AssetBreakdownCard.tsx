import type { AssetBreakdown } from "@/lib/api";

const fmt = (n: number) =>
  (n >= 0 ? "+" : "") +
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const LABELS: Record<string, string> = {
  stocks: "Stocks",
  options: "Options",
  crypto: "Crypto",
  real_estate: "Real Estate",
};

const COLORS: Record<string, string> = {
  stocks: "bg-blue-500",
  options: "bg-purple-500",
  crypto: "bg-orange-500",
  real_estate: "bg-green-500",
};

export default function AssetBreakdownCard({ data }: { data: AssetBreakdown }) {
  const entries = Object.entries(data.by_type);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-neutral-800">Asset Breakdown</h2>

      <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full">
        {entries.map(([type, val]) => (
          <div
            key={type}
            className={`${COLORS[type] ?? "bg-gray-400"}`}
            style={{ width: `${val.pct_of_portfolio}%` }}
            title={`${LABELS[type] ?? type}: ${val.pct_of_portfolio}%`}
          />
        ))}
      </div>

      <div className="space-y-2">
        {entries.map(([type, val]) => (
          <div key={type} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${COLORS[type] ?? "bg-gray-400"}`} />
              <span className="text-neutral-700">{LABELS[type] ?? type}</span>
              <span className="text-neutral-400">{val.pct_of_portfolio}%</span>
            </div>
            <span className={val.unrealized_gain_loss >= 0 ? "text-emerald-600" : "text-red-600"}>
              {fmt(val.unrealized_gain_loss)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
