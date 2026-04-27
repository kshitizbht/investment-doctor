"use client";

import { useEffect, useState } from "react";
import type {
  AccountPosition, AccountRSUGrant, AccountRealEstate, AuthUser, RetirementData, TaxData,
} from "@/lib/api";
import {
  getPositions, getRSUGrants, getRealEstate, getRetirementData, getTaxData,
} from "@/lib/api";

const fmt = (n: number) => {
  const abs = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${s}$${(abs / 1_000).toFixed(0)}k`;
  return `${s}$${abs.toLocaleString()}`;
};

function Card({ children, onEdit, title, icon }: {
  children: React.ReactNode;
  onEdit?: () => void;
  title: string;
  icon: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
            {title}
          </span>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="rounded-lg px-3 py-1 text-xs font-semibold font-display uppercase tracking-wider transition-colors duration-150"
            style={{
              background: "rgba(245,166,35,0.06)",
              border: "1px solid rgba(245,166,35,0.2)",
              color: "var(--accent)",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(245,166,35,0.12)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(245,166,35,0.06)")}
          >
            Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-body" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm font-mono font-semibold" style={{ color: muted ? "var(--text-muted)" : "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

function Chip({ label, color = "rgba(255,255,255,0.12)" }: { label: string; color?: string }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-body"
      style={{ background: color, color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {label}
    </span>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider font-display"
      style={{ background: `${color}18`, border: `1px solid ${color}44`, color }}
    >
      {label}
    </span>
  );
}

interface Props {
  user: AuthUser | null;
  onEdit: (section: "tax" | "retirement" | "brokerage" | "equity" | "real_estate") => void;
  onSignOut: () => void;
}

export default function AccountDashboard({ user, onEdit, onSignOut }: Props) {
  const [tax, setTax] = useState<TaxData | null>(null);
  const [retirement, setRetirement] = useState<RetirementData | null>(null);
  const [positions, setPositions] = useState<AccountPosition[]>([]);
  const [rsu, setRsu] = useState<AccountRSUGrant[]>([]);
  const [realEstate, setRealEstate] = useState<AccountRealEstate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getTaxData(), getRetirementData(), getPositions(), getRSUGrants(), getRealEstate()])
      .then(([t, r, p, g, re]) => {
        setTax(t);
        setRetirement(r);
        setPositions(p);
        setRsu(g);
        setRealEstate(re);
      })
      .finally(() => setLoading(false));
  }, []);

  const filingLabel: Record<string, string> = {
    single: "Single",
    married_filing_jointly: "Married (Joint)",
    married_filing_separately: "Married (Sep.)",
    head_of_household: "Head of Household",
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="flex items-center gap-3" style={{ color: "var(--text-muted)" }}>
          <div className="spinner h-5 w-5 rounded-full border-2" style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "var(--accent)" }} />
          <span className="text-sm font-body">Loading your data…</span>
        </div>
      </div>
    );
  }

  // Derive position type counts
  const typeCounts = positions.reduce<Record<string, number>>((acc, p) => {
    acc[p.asset_type] = (acc[p.asset_type] ?? 0) + 1;
    return acc;
  }, {});

  const typeColor: Record<string, string> = {
    stock: "#F5A623",
    crypto: "#FF4455",
    option: "#00C87C",
  };

  const totalRetirement = (retirement?.k401_contribution ?? 0) + (retirement?.hsa_contribution ?? 0) + (retirement?.ira_contribution ?? 0);
  const totalDeductions = (retirement?.charitable_donations ?? 0) + (retirement?.property_tax_paid ?? 0);
  const totalRental = realEstate.reduce((s, r) => s + r.annual_rental_income, 0);

  const initials = user
    ? user.display_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const memberSince = user
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  return (
    <div className="mx-auto max-w-screen-lg px-8 py-10">
      {/* Avatar row */}
      <div
        className="mb-8 flex items-center justify-between rounded-xl px-6 py-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold font-display"
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
        <button
          onClick={onSignOut}
          className="rounded-lg px-4 py-2 text-xs font-semibold font-display uppercase tracking-wider transition-colors duration-150"
          style={{ background: "rgba(255,68,85,0.06)", border: "1px solid rgba(255,68,85,0.2)", color: "var(--negative)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,68,85,0.12)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,68,85,0.06)")}
        >
          Sign Out
        </button>
      </div>

      <h2 className="mb-5 text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
        Your Financial Profile
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Tax & Income */}
        <Card title="Tax & Income" icon="📋" onEdit={() => onEdit("tax")}>
          {tax ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5 mb-1">
                <Badge label={filingLabel[tax.filing_status] ?? tax.filing_status} color="#F5A623" />
                <Badge label={tax.state} color="#00C87C" />
              </div>
              <Row label="W2 Wages" value={fmt(tax.wages)} />
              {tax.bonus > 0 && <Row label="Bonus" value={fmt(tax.bonus)} />}
              <Row label="Fed Withheld" value={fmt(tax.federal_tax_withheld)} />
              <Row label="State Withheld" value={fmt(tax.state_tax_withheld)} />
            </div>
          ) : (
            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>No tax data added yet.</p>
          )}
        </Card>

        {/* Retirement & Deductions */}
        <Card title="Retirement & Deductions" icon="🏦" onEdit={() => onEdit("retirement")}>
          {retirement ? (
            <div className="space-y-2">
              <Row label="401k / 403b" value={fmt(retirement.k401_contribution)} />
              <Row label="HSA" value={fmt(retirement.hsa_contribution)} />
              <Row label="IRA" value={fmt(retirement.ira_contribution)} />
              {totalRetirement > 0 && (
                <Row label="Total Pre-Tax" value={fmt(totalRetirement)} />
              )}
              {totalDeductions > 0 && (
                <Row label="Itemized Deductions" value={fmt(totalDeductions)} />
              )}
            </div>
          ) : (
            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>No retirement data added yet.</p>
          )}
        </Card>

        {/* Brokerage */}
        <Card title="Brokerage" icon="📈" onEdit={() => onEdit("brokerage")}>
          {positions.length > 0 ? (
            <div className="space-y-2">
              <Row label="Open Positions" value={String(positions.length)} />
              <div className="flex flex-wrap gap-1">
                {Object.entries(typeCounts).map(([type, count]) => (
                  <Chip key={type} label={`${count} ${type}`} color={`${typeColor[type] ?? "#fff"}18`} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>No positions added yet.</p>
          )}
        </Card>

        {/* Equity Comp */}
        <Card title="Equity Comp" icon="💼" onEdit={() => onEdit("equity")}>
          {rsu.length > 0 ? (
            <div className="space-y-2">
              <Row label="RSU Grants" value={String(rsu.length)} />
              <div className="flex flex-wrap gap-1">
                {rsu.slice(0, 4).map((g) => (
                  <Chip key={g.ticker} label={g.ticker} color="rgba(245,166,35,0.12)" />
                ))}
                {rsu.length > 4 && <Chip label={`+${rsu.length - 4} more`} />}
              </div>
            </div>
          ) : (
            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>No RSU grants added yet.</p>
          )}
        </Card>

        {/* Real Estate */}
        <Card title="Real Estate" icon="🏠" onEdit={() => onEdit("real_estate")}>
          {realEstate.length > 0 ? (
            <div className="space-y-2">
              <Row label="Properties" value={String(realEstate.length)} />
              {totalRental > 0 && <Row label="Annual Rental Income" value={fmt(totalRental)} />}
              <div className="flex flex-wrap gap-1">
                {realEstate.slice(0, 2).map((re) => (
                  <Chip key={re.label} label={re.label || "Unnamed"} />
                ))}
                {realEstate.length > 2 && <Chip label={`+${realEstate.length - 2} more`} />}
              </div>
            </div>
          ) : (
            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>No properties added yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
