import type { Harvesting } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function HarvestingCard({ data }: { data: Harvesting }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-neutral-800">Tax Loss Harvesting</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Potential savings:{" "}
        <span className="font-semibold text-emerald-600">{fmt(data.estimated_tax_savings)}</span>
        {" "}| Harvestable losses:{" "}
        <span className="font-semibold text-red-600">{fmt(data.total_harvestable_loss)}</span>
      </p>

      <div className="space-y-2">
        {data.opportunities.map((opp) => (
          <div
            key={`${opp.ticker_or_name}-${opp.asset_type}`}
            className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2"
          >
            <div>
              <span className="font-medium text-neutral-800">{opp.ticker_or_name}</span>
              <span className="ml-2 text-xs text-neutral-400">{opp.asset_type}</span>
              {opp.wash_sale_risk && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  Wash sale risk
                </span>
              )}
            </div>
            <span className="font-semibold text-red-600">{fmt(opp.unrealized_loss)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
