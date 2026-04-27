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

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-1">
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
      <span
        className="font-display font-semibold uppercase"
        style={{ fontSize: "10px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.22)" }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

export default function DashboardCards({ data }: { data: InsightsResponse }) {
  return (
    <div className="space-y-2">
      {/* Net Worth — full width hero */}
      <NetWorthCard current={data.net_worth} history={data.net_worth_history ?? []} />

      {/* ─── Tax Health ─── */}
      {(data.tax_balance || data.marginal_rate_stack) && (
        <>
          <SectionLabel label="Tax Health" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.tax_balance && <TaxBalanceCard data={data.tax_balance} />}
            {data.marginal_rate_stack && <MarginalRateCard data={data.marginal_rate_stack} />}
          </div>
        </>
      )}

      {/* ─── Returns & Positions ─── */}
      <SectionLabel label="Returns & Positions" />
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

      {/* ─── Compensation & Benefits ─── */}
      {(data.equity || data.retirement || data.income_character) && (
        <>
          <SectionLabel label="Compensation & Benefits" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.equity && <EquityCard data={data.equity} />}
            {data.retirement && <RetirementCard data={data.retirement} />}
            {data.income_character && (
              <div className="md:col-span-2 xl:col-span-1">
                <IncomeCharacterCard data={data.income_character} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
