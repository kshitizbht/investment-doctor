import type { InsightsResponse } from "@/lib/api";
import TaxSummaryCard from "@/components/cards/TaxSummaryCard";
import CapitalGainsCard from "@/components/cards/CapitalGainsCard";
import HarvestingCard from "@/components/cards/HarvestingCard";
import HoldingPeriodCard from "@/components/cards/HoldingPeriodCard";
import AssetBreakdownCard from "@/components/cards/AssetBreakdownCard";

export default function DashboardCards({ data }: { data: InsightsResponse }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <TaxSummaryCard data={data.tax_snapshot} />
      <CapitalGainsCard data={data.capital_gains} />
      <HarvestingCard data={data.harvesting} />
      <HoldingPeriodCard data={data.holding_period_alerts} />
      <div className="md:col-span-2 xl:col-span-1">
        <AssetBreakdownCard data={data.asset_breakdown} />
      </div>
    </div>
  );
}
