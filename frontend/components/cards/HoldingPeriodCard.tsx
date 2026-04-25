import type { HoldingPeriodAlert } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function HoldingPeriodCard({ data }: { data: HoldingPeriodAlert[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-neutral-800">Holding Period Alerts</h2>
        <p className="text-sm text-neutral-500">No positions approaching long-term status.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-neutral-800">Holding Period Alerts</h2>
      <div className="space-y-2">
        {data.map((alert) => (
          <div
            key={`${alert.ticker_or_name}-${alert.asset_type}`}
            className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2"
          >
            <div>
              <span className="font-medium text-neutral-800">{alert.ticker_or_name}</span>
              <p className="text-xs text-neutral-500">
                Long-term in{" "}
                <span className="font-semibold text-blue-700">{alert.days_until_ltcg} days</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500">Tax saving by waiting</p>
              <p className="font-semibold text-emerald-600">{fmt(alert.estimated_tax_saving)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
