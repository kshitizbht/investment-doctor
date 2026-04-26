import type { InsightsResponse } from "@/lib/api";
import TaxSummaryCard from "@/components/cards/TaxSummaryCard";
import CapitalGainsCard from "@/components/cards/CapitalGainsCard";
import UnrealizedGainsCard from "@/components/cards/UnrealizedGainsCard";
import HarvestingCard from "@/components/cards/HarvestingCard";
import HoldingPeriodCard from "@/components/cards/HoldingPeriodCard";
import AssetBreakdownCard from "@/components/cards/AssetBreakdownCard";
import NetWorthCard from "@/components/cards/NetWorthCard";
import TaxBalanceCard from "@/components/cards/TaxBalanceCard";
import MarginalRateCard from "@/components/cards/MarginalRateCard";
import EquityCard from "@/components/cards/EquityCard";
import RetirementCard from "@/components/cards/RetirementCard";
import IncomeCharacterCard from "@/components/cards/IncomeCharacterCard";

export default function DashboardCards({ data }: { data: InsightsResponse }) {
  return (
    <div className="space-y-4">
      {/* Net Worth — full width */}
      <NetWorthCard current={data.net_worth} history={data.net_worth_history ?? []} />

      {/* Tax balance + marginal rate — high-priority row */}
      {(data.tax_balance || data.marginal_rate_stack) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.tax_balance && <TaxBalanceCard data={data.tax_balance} />}
          {data.marginal_rate_stack && <MarginalRateCard data={data.marginal_rate_stack} />}
        </div>
      )}

      {/* Core tax + gains — 3-column grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TaxSummaryCard data={data.tax_snapshot} deductions={data.deduction_optimizer} />
        <CapitalGainsCard data={data.capital_gains} />
        <UnrealizedGainsCard data={data.asset_breakdown} />
        <HarvestingCard data={data.harvesting} />
        <HoldingPeriodCard data={data.holding_period_alerts} />
        <div className="md:col-span-2 xl:col-span-1">
          <AssetBreakdownCard data={data.asset_breakdown} />
        </div>
      </div>

      {/* Equity + retirement + income character */}
      {(data.equity || data.retirement || data.income_character) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.equity && <EquityCard data={data.equity} />}
          {data.retirement && <RetirementCard data={data.retirement} />}
          {data.income_character && (
            <div className="md:col-span-2 xl:col-span-1">
              <IncomeCharacterCard data={data.income_character} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
