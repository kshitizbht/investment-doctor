"use client";

import { useEffect, useState } from "react";
import type { InsightsResponse } from "@/lib/api";
import { fetchInsights } from "@/lib/api";
import TabNav from "@/components/TabNav";
import DashboardCards from "@/components/DashboardCards";
import Calculator from "@/components/Calculator";
import AccountPlaceholder from "@/components/AccountPlaceholder";

type Tab = "demo" | "calculator" | "account";

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Tax Intelligence Dashboard
        </h1>
        <p className="mt-1 text-sm font-body" style={{ color: "var(--text-muted)" }}>
          2024 tax year · John Doe · Single filer · California
        </p>
      </div>
      <DashboardCards data={data} />
    </div>
  );
}

// ─── Root page ─────────────────────────────────────────────────────────────
export default function Page() {
  const [activeTab, setActiveTab] = useState<Tab>("demo");

  return (
    <>
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <main
        className="pt-14 min-h-screen"
        style={{ background: "var(--bg-base)" }}
      >
        {activeTab === "demo" && (
          <div className="mx-auto max-w-5xl px-6 py-8">
            <DemoTab />
          </div>
        )}

        {activeTab === "calculator" && (
          <div className="mx-auto max-w-6xl px-6">
            <div className="py-4 mb-2">
              <h1 className="text-2xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
                Tax Calculator
              </h1>
              <p className="mt-1 text-sm font-body" style={{ color: "var(--text-muted)" }}>
                Adjust any field to see recommendations update in real-time
              </p>
            </div>
            <Calculator />
          </div>
        )}

        {activeTab === "account" && <AccountPlaceholder />}
      </main>
    </>
  );
}
