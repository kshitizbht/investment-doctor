const API_BASE = "http://localhost:8000";

export interface TaxSnapshot {
  agi: number;
  federal_bracket_pct: number;
  state_bracket_pct: number;
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

export interface NetWorthCurrent {
  stocks_value: number;
  real_estate_value: number;
  income_value: number;
  total: number;
}

export interface NetWorthPoint {
  date: string;
  stocks: number;
  real_estate: number;
  income: number;
  total: number;
}

export interface InsightsResponse {
  tax_snapshot: TaxSnapshot;
  capital_gains: CapitalGains;
  harvesting: Harvesting;
  holding_period_alerts: HoldingPeriodAlert[];
  asset_breakdown: AssetBreakdown;
  net_worth: NetWorthCurrent;
  net_worth_history: NetWorthPoint[];
}

export async function fetchInsights(): Promise<InsightsResponse> {
  const res = await fetch(`${API_BASE}/api/insights`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Simulate types ───────────────────────────────────────────────────────────

export interface PositionInput {
  asset_type: string;
  ticker_or_name: string;
  quantity: number;
  cost_basis_per_unit: number;
  current_price: number;
  purchase_date: string;
  expiry_date?: string;
  is_short?: number;
  strike_price?: number;
}

export interface TransactionInput {
  asset_type: string;
  ticker_or_name: string;
  action: string;
  quantity: number;
  price_per_unit: number;
  total_proceeds: number;
  total_cost_basis: number;
  transaction_date: string;
}

export interface RealEstateInput {
  label: string;
  purchase_price: number;
  purchase_date: string;
  current_estimated_value: number;
  annual_rental_income: number;
  depreciation_taken: number;
  mortgage_interest_paid: number;
}

export interface SimulateRequest {
  filing_status: string;
  state: string;
  wages: number;
  federal_tax_withheld: number;
  state_tax_withheld: number;
  positions: PositionInput[];
  transactions: TransactionInput[];
  real_estate_list: RealEstateInput[];
}

export async function simulateInsights(req: SimulateRequest, signal?: AbortSignal): Promise<InsightsResponse> {
  const res = await fetch(`${API_BASE}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
