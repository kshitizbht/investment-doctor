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

// ── New types ─────────────────────────────────────────────────────────────────

export interface MarginalRateStack {
  federal_pct: number;
  niit_pct: number;
  medicare_surtax_pct: number;
  state_pct: number;
  total_ordinary_pct: number;
  total_ltcg_pct: number;
  keep_per_1000_ordinary: number;
  keep_per_1000_ltcg: number;
}

export interface TaxBalance {
  estimated_federal_tax: number;
  estimated_state_tax: number;
  niit: number;
  medicare_surtax: number;
  estimated_total_tax: number;
  total_withheld: number;
  balance: number;
  refund_or_owe: "refund" | "owe";
  underpayment_risk: boolean;
}

export interface DeductionOptimizer {
  standard_deduction: number;
  itemized_total: number;
  mortgage_interest: number;
  salt_deductible: number;
  salt_cap: number;
  charitable: number;
  use_itemized: boolean;
  deduction_used: "standard" | "itemized";
  deduction_amount: number;
  additional_savings: number;
}

export interface RSUGrant {
  ticker: string;
  grant_type: string;
  shares_vested_ytd: number;
  fmv_at_vest: number;
  vested_income: number;
  supplemental_withheld: number;
  actual_tax_owed: number;
  withholding_gap: number;
  retained_shares: number;
  retained_value: number;
  next_vest_date: string | null;
  next_vest_shares: number;
}

export interface EquityAnalysis {
  grants: RSUGrant[];
  total_vested_income: number;
  supplemental_withheld: number;
  actual_tax_owed: number;
  withholding_gap: number;
  total_retained_value: number;
}

export interface RetirementOptimizer {
  k401_contributed: number;
  k401_limit: number;
  k401_room: number;
  k401_pct_used: number;
  k401_tax_saving_if_maxed: number;
  hsa_contributed: number;
  hsa_limit: number;
  hsa_room: number;
  hsa_tax_saving_if_maxed: number;
  ira_contributed: number;
  ira_limit: number;
  ira_room: number;
}

export interface IncomeCharacter {
  w2_wages: number;
  bonus: number;
  rsu_vests: number;
  short_term_gains: number;
  long_term_gains: number;
  qualified_dividends: number;
  rental_income: number;
  rate_ordinary_pct: number;
  rate_ltcg_pct: number;
}

export interface InsightsResponse {
  tax_snapshot: TaxSnapshot;
  capital_gains: CapitalGains;
  harvesting: Harvesting;
  holding_period_alerts: HoldingPeriodAlert[];
  asset_breakdown: AssetBreakdown;
  net_worth: NetWorthCurrent;
  net_worth_history: NetWorthPoint[];
  // New sections (optional for backward compat)
  marginal_rate_stack?: MarginalRateStack;
  tax_balance?: TaxBalance;
  deduction_optimizer?: DeductionOptimizer;
  equity?: EquityAnalysis;
  retirement?: RetirementOptimizer;
  income_character?: IncomeCharacter;
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

export interface RSUGrantInput {
  ticker: string;
  grant_type: string;
  shares_vested_ytd: number;
  fmv_at_vest: number;
  shares_sold_at_vest: number;
  current_price: number;
  next_vest_date?: string;
  next_vest_shares: number;
}

export interface SimulateRequest {
  filing_status: string;
  state: string;
  wages: number;
  federal_tax_withheld: number;
  state_tax_withheld: number;
  // Additional income
  bonus: number;
  other_income: number;
  qualified_dividends: number;
  // Pre-tax deductions
  k401_contribution: number;
  hsa_contribution: number;
  ira_contribution: number;
  // Deductions
  capital_loss_carryforward: number;
  charitable_donations: number;
  property_tax_paid: number;
  // Prior year
  prior_year_agi: number;
  // Equity
  rsu_grants: RSUGrantInput[];
  // Positions & transactions
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
