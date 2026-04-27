"use client";

import { useEffect, useState } from "react";
import type { AuthUser, InsightsResponse } from "@/lib/api";
import { fetchInsights, getAccountStatus, getToken, removeToken } from "@/lib/api";
import TabNav from "@/components/TabNav";
import DashboardCards from "@/components/DashboardCards";
import Calculator from "@/components/Calculator";
import AccountAuth from "@/components/AccountAuth";
import OnboardingWizard, {
  TaxEditor, RetirementEditor, BrokerageEditor, EquityEditor, RealEstateEditor,
} from "@/components/OnboardingWizard";
import AccountDashboard from "@/components/AccountDashboard";

const fmtShort = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs}`;
};

function SummaryStrip({ data }: { data: InsightsResponse }) {
  const balance = data.tax_balance?.balance;
  const isRefund = balance !== undefined && balance >= 0;
  const topRate = data.marginal_rate_stack?.total_ordinary_pct;
  const byType = data.asset_breakdown?.by_type;
  const unrealized = byType
    ? Object.values(byType).reduce((s, t) => s + (t?.unrealized_gain_loss ?? 0), 0)
    : null;

  const stats: { label: string; value: string; color?: string; sub?: string }[] = [
    {
      label: "Net Worth",
      value: fmtShort(data.net_worth.total),
      color: "var(--text-primary)",
    },
    ...(balance !== undefined
      ? [{
          label: isRefund ? "Est. Refund" : "Est. Owed",
          value: fmtShort(Math.abs(balance)),
          color: isRefund ? "var(--positive)" : "var(--negative)",
        }]
      : []),
    ...(topRate !== undefined
      ? [{
          label: "Top Marginal Rate",
          value: `${topRate}%`,
          color: "var(--text-primary)",
          sub: "ordinary income",
        }]
      : []),
    ...(unrealized !== null
      ? [{
          label: "Unrealized P&L",
          value: fmtShort(unrealized),
          color: unrealized >= 0 ? "var(--positive)" : "var(--negative)",
        }]
      : []),
  ];

  return (
    <div
      className="rounded-xl border mb-6 grid"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: "rgba(255,255,255,0.07)",
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
      }}
    >
      {stats.map((s, i) => (
        <div
          key={i}
          className="px-5 py-3.5"
          style={{
            borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.07)" : undefined,
          }}
        >
          <p
            className="font-display uppercase mb-1"
            style={{ fontSize: "9px", letterSpacing: "0.14em", color: "rgba(255,255,255,0.28)", fontWeight: 600 }}
          >
            {s.label}
          </p>
          <p className="text-xl font-bold font-mono leading-none" style={{ color: s.color ?? "var(--text-primary)" }}>
            {s.value}
          </p>
          {s.sub && (
            <p className="mt-0.5 font-body" style={{ fontSize: "10px", color: "rgba(255,255,255,0.22)" }}>
              {s.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

type Tab = "demo" | "calculator" | "account";
type AccountEditSection = "tax" | "retirement" | "brokerage" | "equity" | "real_estate";

function SectionEditor({ section, onBack }: { section: AccountEditSection; onBack: () => void }) {
  if (section === "tax") return <TaxEditor onBack={onBack} />;
  if (section === "retirement") return <RetirementEditor onBack={onBack} />;
  if (section === "brokerage") return <BrokerageEditor onBack={onBack} />;
  if (section === "equity") return <EquityEditor onBack={onBack} />;
  return <RealEstateEditor onBack={onBack} />;
}
type AccountView =
  | "auth"
  | "checking"
  | "onboarding"
  | "dashboard"
  | { edit: "tax" | "retirement" | "brokerage" | "equity" | "real_estate" };

// ─── Demo tab ─────────────────────────────────────────────────────────────
function DemoTab() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInsights()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
        <div
          className="rounded-xl px-8 py-6 text-center"
          style={{
            background: "rgba(255,68,85,0.06)",
            border: "1px solid rgba(255,68,85,0.2)",
          }}
        >
          <p className="text-sm font-body" style={{ color: "var(--negative)" }}>
            Failed to load insights: {error}
          </p>
          <p className="mt-1 text-xs font-body" style={{ color: "var(--text-muted)" }}>
            Make sure the backend is running on :8000
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
        <div className="flex items-center gap-3" style={{ color: "var(--text-muted)" }}>
          <div
            className="spinner h-5 w-5 rounded-full border-2"
            style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "var(--accent)" }}
          />
          <span className="text-sm font-body">Loading insights…</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Demo AI Insights Dashboard
        </h1>
        <p className="mt-1 text-sm font-body" style={{ color: "var(--text-muted)" }}>
          2024 tax year · John Doe · Single filer · California
        </p>
      </div>
      <SummaryStrip data={data} />
      <DashboardCards data={data} />
    </div>
  );
}

// ─── Root page ─────────────────────────────────────────────────────────────
export default function Page() {
  const [activeTab, setActiveTab] = useState<Tab>("demo");
  const [accountView, setAccountView] = useState<AccountView>("auth");
  const [accountUser, setAccountUser] = useState<AuthUser | null>(null);

  // When switching to account tab, check existing token and onboarding status
  useEffect(() => {
    if (activeTab !== "account") return;
    const token = getToken();
    if (!token) { setAccountView("auth"); return; }
    setAccountView("checking");
    getAccountStatus()
      .then((s) => setAccountView(s.onboarding_complete ? "dashboard" : "onboarding"))
      .catch(() => { removeToken(); setAccountView("auth"); });
  }, [activeTab]);

  const handleAuth = async (user: AuthUser) => {
    setAccountUser(user);
    setAccountView("checking");
    try {
      const s = await getAccountStatus();
      setAccountView(s.onboarding_complete ? "dashboard" : "onboarding");
    } catch {
      setAccountView("onboarding");
    }
  };

  const handleSignOut = () => {
    removeToken();
    setAccountUser(null);
    setAccountView("auth");
  };

  return (
    <>
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <main
        className="pt-14 min-h-screen"
        style={{ background: "var(--bg-base)" }}
      >
        {activeTab === "demo" && (
          <div className="mx-auto max-w-screen-xl px-8 py-8">
            <DemoTab />
          </div>
        )}

        {activeTab === "calculator" && (
          <div className="mx-auto max-w-screen-2xl px-8">
            <div className="py-4 mb-2">
              <h1 className="text-2xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
                Financial Calculator
              </h1>
              <p className="mt-1 text-sm font-body" style={{ color: "var(--text-muted)" }}>
                Adjust any field to see recommendations update in real-time
              </p>
            </div>
            <Calculator />
          </div>
        )}

        {activeTab === "account" && (
          <>
            {accountView === "auth" && (
              <AccountAuth onAuth={handleAuth} />
            )}
            {accountView === "checking" && (
              <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
                <div className="flex items-center gap-3" style={{ color: "var(--text-muted)" }}>
                  <div className="spinner h-5 w-5 rounded-full border-2" style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "var(--accent)" }} />
                  <span className="text-sm font-body">Loading your account…</span>
                </div>
              </div>
            )}
            {accountView === "onboarding" && (
              <OnboardingWizard
                user={accountUser}
                onComplete={() => setAccountView("dashboard")}
              />
            )}
            {accountView === "dashboard" && (
              <AccountDashboard
                user={accountUser}
                onEdit={(section) => setAccountView({ edit: section })}
                onSignOut={handleSignOut}
              />
            )}
            {typeof accountView === "object" && "edit" in accountView && (
              <div className="mx-auto max-w-3xl px-8 py-10">
                <button
                  onClick={() => setAccountView("dashboard")}
                  className="mb-6 flex items-center gap-2 text-sm font-body transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  ← Back to Dashboard
                </button>
                {/* Section editors rendered from OnboardingWizard exports */}
                <SectionEditor section={accountView.edit} onBack={() => setAccountView("dashboard")} />
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
