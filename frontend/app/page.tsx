"use client";

import { useEffect, useState } from "react";
import type { InsightsResponse } from "@/lib/api";
import { fetchInsights } from "@/lib/api";
import TaxSummaryCard from "@/components/cards/TaxSummaryCard";
import CapitalGainsCard from "@/components/cards/CapitalGainsCard";
import HarvestingCard from "@/components/cards/HarvestingCard";
import HoldingPeriodCard from "@/components/cards/HoldingPeriodCard";
import AssetBreakdownCard from "@/components/cards/AssetBreakdownCard";

export default function Dashboard() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInsights()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-600">Failed to load insights: {error}</p>
          <p className="mt-1 text-xs text-neutral-500">Make sure the backend is running on :8000</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="flex items-center gap-2 text-neutral-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Loading insights…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">Investment Doctor</h1>
          <p className="text-sm text-neutral-500">Tax intelligence dashboard · 2024 tax year</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TaxSummaryCard data={data.tax_snapshot} />
          <CapitalGainsCard data={data.capital_gains} />
          <HarvestingCard data={data.harvesting} />
          <HoldingPeriodCard data={data.holding_period_alerts} />
          <div className="md:col-span-2 xl:col-span-1">
            <AssetBreakdownCard data={data.asset_breakdown} />
          </div>
        </div>
      </div>
    </main>
  );
}
