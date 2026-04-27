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

// ─── Method picker → section editor ───────────────────────────────────────────

type EditMethod = "pdf" | "manual";

const SECTION_LABELS: Record<AccountEditSection, string> = {
  tax: "Tax & Income",
  retirement: "Retirement & Deductions",
  brokerage: "Brokerage",
  equity: "Equity Compensation",
  real_estate: "Real Estate",
};

const SECTION_PDF_DESC: Record<AccountEditSection, string> = {
  tax: "W-2 or 1040",
  retirement: "1040 or paystub",
  brokerage: "Brokerage statement",
  equity: "Equity comp statement",
  real_estate: "Property documents",
};

function SectionEditWithMethod({ section, onBack }: { section: AccountEditSection; onBack: () => void }) {
  const [method, setMethod] = useState<EditMethod | null>(null);

  if (method === null) {
    const cards = [
      { key: "pdf" as EditMethod, icon: "📄", title: "Import PDF", desc: SECTION_PDF_DESC[section] },
      { key: "manual" as EditMethod, icon: "✏️", title: "Enter Manually", desc: "Type in your values directly" },
      { key: null, icon: "🔗", title: "Connect Provider", desc: "Coming soon", disabled: true },
    ];
    return (
      <div className="relative flex min-h-[calc(100vh-56px)] items-start justify-center px-6 py-10 overflow-hidden">
        <div
          className="pointer-events-none absolute"
          style={{ width: 500, height: 500, top: "30%", left: "50%", transform: "translate(-50%,-50%)", background: "radial-gradient(circle, rgba(245,166,35,0.04) 0%, transparent 65%)" }}
        />
        <div className="relative z-10 w-full max-w-xl">
          <button
            onClick={onBack}
            className="mb-6 flex items-center gap-2 text-sm font-body transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            ← Back to Dashboard
          </button>
          <div
            className="rounded-2xl p-8"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}
          >
            <h2 className="mb-1 text-lg font-bold font-display" style={{ color: "var(--text-primary)" }}>
              Edit {SECTION_LABELS[section]}
            </h2>
            <p className="mb-6 text-xs font-body" style={{ color: "var(--text-muted)" }}>
              How would you like to update your data?
            </p>
            <div className="grid grid-cols-3 gap-3">
              {cards.map((c) => (
                <button
                  key={String(c.key)}
                  disabled={c.disabled}
                  onClick={() => { if (!c.disabled && c.key !== null) setMethod(c.key); }}
                  className="flex flex-col items-center gap-2 rounded-xl py-5 px-3 text-center transition-all duration-150 relative"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1.5px solid rgba(255,255,255,0.07)",
                    cursor: c.disabled ? "not-allowed" : "pointer",
                    opacity: c.disabled ? 0.45 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!c.disabled) {
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,166,35,0.08)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,166,35,0.5)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)";
                  }}
                >
                  {c.disabled && (
                    <span
                      className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 font-display font-semibold uppercase tracking-wider"
                      style={{ fontSize: "8px", background: "rgba(255,255,255,0.08)", color: "var(--text-muted)" }}
                    >
                      Soon
                    </span>
                  )}
                  <span style={{ fontSize: 22 }}>{c.icon}</span>
                  <div>
                    <p className="text-xs font-semibold font-display" style={{ color: "var(--text-secondary)" }}>{c.title}</p>
                    <p className="mt-0.5 font-body" style={{ fontSize: "10px", color: "var(--text-muted)" }}>{c.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <button
        onClick={() => setMethod(null)}
        className="mb-6 flex items-center gap-2 text-sm font-body transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        ← Choose method
      </button>
      <SectionEditor section={section} onBack={onBack} />
    </div>
  );
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
              <SectionEditWithMethod
                section={accountView.edit}
                onBack={() => setAccountView("dashboard")}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
