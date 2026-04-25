"use client";

type Tab = "demo" | "calculator" | "account";

interface TabNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "demo",       label: "Demo" },
  { id: "calculator", label: "Calculator" },
  { id: "account",    label: "My Account" },
];

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-14"
      style={{
        background: "rgba(7,11,18,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="mx-auto max-w-6xl h-full px-6 flex items-center justify-between">
        {/* Wordmark */}
        <div className="font-display font-bold text-base tracking-tight select-none">
          <span style={{ color: "rgba(255,255,255,0.55)" }}>Investment</span>
          <span style={{ color: "var(--accent)" }}> Doctor</span>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 font-body"
                style={{
                  color: isActive ? "var(--accent)" : "rgba(255,255,255,0.45)",
                  background: isActive ? "rgba(245,166,35,0.07)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.75)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)";
                }}
              >
                {tab.label}
                {isActive && (
                  <span
                    className="tab-underline absolute bottom-0 left-3 right-3 h-px rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
