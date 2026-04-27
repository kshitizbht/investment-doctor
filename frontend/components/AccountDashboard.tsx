"use client";

import { useEffect, useState } from "react";
import type {
  AccountPosition, AccountRSUGrant, AccountRealEstate, AccountTransaction,
  AuthUser, InsightsResponse, RetirementData, SimulateRequest, TaxData,
} from "@/lib/api";
import {
  getPositions, getRSUGrants, getRealEstate, getRetirementData, getTaxData,
  getTransactions, simulateInsights,
} from "@/lib/api";
import DashboardCards from "@/components/DashboardCards";
import AskClaude from "@/components/AskClaude";
import SummaryStrip from "@/components/SummaryStrip";

// ─── Build SimulateRequest from account data ──────────────────────────────────

function buildRequest(
  tax: TaxData,
  retirement: RetirementData | null,
  positions: AccountPosition[],
  transactions: AccountTransaction[],
  rsuGrants: AccountRSUGrant[],
  realEstate: AccountRealEstate[],
): SimulateRequest {
  return {
    filing_status: tax.filing_status,
    state: tax.state,
    wages: tax.wages,
    federal_tax_withheld: tax.federal_tax_withheld,
    state_tax_withheld: tax.state_tax_withheld,
    bonus: tax.bonus,
    other_income: tax.other_income,
    qualified_dividends: tax.qualified_dividends,
    k401_contribution: retirement?.k401_contribution ?? 0,
    hsa_contribution: retirement?.hsa_contribution ?? 0,
    ira_contribution: retirement?.ira_contribution ?? 0,
    capital_loss_carryforward: retirement?.capital_loss_carryforward ?? 0,
    charitable_donations: retirement?.charitable_donations ?? 0,
    property_tax_paid: retirement?.property_tax_paid ?? 0,
    prior_year_agi: retirement?.prior_year_agi ?? 0,
    rsu_grants: rsuGrants.map((g) => ({
      ticker: g.ticker,
      grant_type: g.grant_type,
      shares_vested_ytd: g.shares_vested_ytd,
      fmv_at_vest: g.fmv_at_vest,
      shares_sold_at_vest: g.shares_sold_at_vest,
      current_price: g.current_price,
      next_vest_date: g.next_vest_date,
      next_vest_shares: g.next_vest_shares,
    })),
    positions: positions.map((p) => ({
      asset_type: p.asset_type,
      ticker_or_name: p.ticker_or_name,
      quantity: p.quantity,
      cost_basis_per_unit: p.cost_basis_per_unit,
      current_price: p.current_price,
      purchase_date: p.purchase_date,
    })),
    transactions: transactions.map((t) => ({
      asset_type: t.asset_type,
      ticker_or_name: t.ticker_or_name,
      action: t.action,
      quantity: t.quantity,
      price_per_unit: t.price_per_unit,
      total_proceeds: t.total_proceeds,
      total_cost_basis: t.total_cost_basis,
      transaction_date: t.transaction_date,
    })),
    real_estate_list: realEstate.map((re) => ({
      label: re.label,
      purchase_price: re.purchase_price,
      purchase_date: re.purchase_date,
      current_estimated_value: re.current_estimated_value,
      annual_rental_income: re.annual_rental_income,
      depreciation_taken: re.depreciation_taken,
      mortgage_interest_paid: re.mortgage_interest_paid,
    })),
  };
}

// ─── Edit section labels ──────────────────────────────────────────────────────

const EDIT_LABELS: Record<string, string> = {
  tax: "Tax & Income",
  retirement: "Retirement",
  brokerage: "Brokerage",
  equity: "Equity",
  real_estate: "Real Estate",
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  user: AuthUser | null;
  onEdit: (section: "tax" | "retirement" | "brokerage" | "equity" | "real_estate") => void;
  onSignOut: () => void;
}

export default function AccountDashboard({ user, onEdit, onSignOut }: Props) {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getTaxData(), getRetirementData(), getPositions(),
      getTransactions(), getRSUGrants(), getRealEstate(),
    ])
      .then(([tax, retirement, positions, transactions, rsuGrants, realEstate]) => {
        if (!tax) return null;
        return simulateInsights(buildRequest(tax, retirement, positions, transactions, rsuGrants, realEstate));
      })
      .then((ins) => { if (ins) setInsights(ins); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const initials = user
    ? user.display_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const memberSince = user
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="flex items-center gap-3" style={{ color: "var(--text-muted)" }}>
          <div className="spinner h-5 w-5 rounded-full border-2" style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "var(--accent)" }} />
          <span className="text-sm font-body">Computing your insights…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-xl px-8 py-8">
      {/* User header */}
      <div
        className="mb-6 flex items-center justify-between rounded-xl px-6 py-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold font-display"
            style={{ background: "linear-gradient(135deg, #F5A623 0%, #E8890A 100%)", color: "#070B12" }}
          >
            {initials}
          </div>
          <div>
            <p className="font-semibold font-display" style={{ color: "var(--text-primary)" }}>
              {user?.display_name ?? "Your Account"}
            </p>
            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
              {user?.email} · Member since {memberSince}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(Object.keys(EDIT_LABELS) as Array<"tax" | "retirement" | "brokerage" | "equity" | "real_estate">).map((s) => (
            <button
              key={s}
              onClick={() => onEdit(s)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold font-display uppercase tracking-wider transition-colors duration-150"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,166,35,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              {EDIT_LABELS[s]}
            </button>
          ))}
          <button
            onClick={onSignOut}
            className="ml-2 rounded-lg px-4 py-2 text-xs font-semibold font-display uppercase tracking-wider transition-colors duration-150"
            style={{ background: "rgba(255,68,85,0.06)", border: "1px solid rgba(255,68,85,0.2)", color: "var(--negative)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,68,85,0.12)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,68,85,0.06)")}
          >
            Sign Out
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl px-4 py-3 text-sm font-body" style={{ background: "rgba(255,68,85,0.08)", border: "1px solid rgba(255,68,85,0.2)", color: "var(--negative)" }}>
          Failed to compute insights: {error}
        </div>
      )}

      {insights ? (
        <>
          <div className="mb-5">
            <h1 className="text-2xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
              Your AI Insights Dashboard
            </h1>
            <p className="mt-1 text-sm font-body" style={{ color: "var(--text-muted)" }}>
              2024 tax year · {user?.display_name} · Personalized
            </p>
          </div>
          <SummaryStrip data={insights} />
          <DashboardCards data={insights} />
          <AskClaude snapshot={insights} />
        </>
      ) : (
        <div
          className="rounded-xl px-8 py-12 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-lg font-semibold font-display mb-2" style={{ color: "var(--text-secondary)" }}>
            No financial data found
          </p>
          <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>
            Complete the onboarding wizard to see your personalized insights.
          </p>
        </div>
      )}
    </div>
  );
}
