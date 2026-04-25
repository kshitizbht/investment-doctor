const API_BASE = "http://localhost:8000";

export interface TaxSnapshot {
  agi: number;
  federal_bracket_pct: number;
  estimated_federal_tax: number;
  estimated_state_tax: number;
}

export interface AssetGains {
  short_term: number;
  long_term: number;
}

export interface CapitalGains {
  short_term_realized: number;
  long_term_realized: number;
  net_realized: number;
  by_asset_type: {
    stocks: AssetGains;
    options: AssetGains;
    crypto: AssetGains;
    real_estate: AssetGains;
  };
}

export interface HarvestingOpportunity {
  ticker_or_name: string;
  asset_type: "stock" | "option" | "crypto" | "real_estate";
  unrealized_loss: number;
  wash_sale_risk: boolean;
}

export interface Harvesting {
  opportunities: HarvestingOpportunity[];
  total_harvestable_loss: number;
  estimated_tax_savings: number;
}

export interface HoldingPeriodAlert {
  ticker_or_name: string;
  asset_type: string;
  days_until_ltcg: number;
  estimated_tax_saving: number;
}

export interface AssetTypeBreakdown {
  unrealized_gain_loss: number;
  pct_of_portfolio: number;
}

export interface AssetBreakdown {
  by_type: {
    stocks: AssetTypeBreakdown;
    options: AssetTypeBreakdown;
    crypto: AssetTypeBreakdown;
    real_estate: AssetTypeBreakdown;
  };
}

export interface InsightsResponse {
  tax_snapshot: TaxSnapshot;
  capital_gains: CapitalGains;
  harvesting: Harvesting;
  holding_period_alerts: HoldingPeriodAlert[];
  asset_breakdown: AssetBreakdown;
}

export async function fetchInsights(): Promise<InsightsResponse> {
  const res = await fetch(`${API_BASE}/api/insights`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
