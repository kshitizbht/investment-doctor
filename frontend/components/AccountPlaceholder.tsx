export default function AccountPlaceholder() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-6 py-16">
      {/* Ambient glow orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: 400,
            height: 400,
            top: "20%",
            left: "15%",
            background: "radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 300,
            height: 300,
            top: "50%",
            right: "20%",
            background: "radial-gradient(circle, rgba(0,200,124,0.06) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 250,
            height: 250,
            bottom: "15%",
            left: "40%",
            background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      <div className="relative text-center max-w-sm">
        {/* Avatar */}
        <div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full font-display font-bold text-2xl"
          style={{
            background: "linear-gradient(135deg, #F5A623 0%, #e8940f 100%)",
            color: "#070B12",
            boxShadow: "0 0 40px rgba(245,166,35,0.3), 0 0 80px rgba(245,166,35,0.1)",
          }}
        >
          JD
        </div>

        {/* Name */}
        <h2 className="mb-1 text-2xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
          John Doe
        </h2>
        <p className="mb-5 text-sm font-body" style={{ color: "var(--text-secondary)" }}>
          2024 Tax Year &middot; Single Filer &middot; California
        </p>

        {/* Coming soon badge */}
        <div className="inline-flex items-center gap-2 mb-6">
          <span
            className="rounded-full px-4 py-1.5 text-xs font-semibold font-display uppercase tracking-wider"
            style={{
              background: "rgba(245,166,35,0.1)",
              border: "1px solid rgba(245,166,35,0.25)",
              color: "var(--accent)",
            }}
          >
            My Account — Coming Soon
          </span>
        </div>

        {/* Divider */}
        <div
          className="mx-auto mb-6 h-px w-24"
          style={{ background: "linear-gradient(90deg, transparent, var(--border), transparent)" }}
        />

        {/* Message */}
        <p className="text-sm leading-relaxed font-body" style={{ color: "var(--text-muted)" }}>
          Connect your accounts to unlock personalized<br />
          tax intelligence powered by your real data.
        </p>

        {/* Decorative locked features */}
        <div className="mt-8 space-y-2">
          {["PDF Import", "Multi-year Comparison", "CPA Export", "Real-time Sync"].map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <span style={{ color: "var(--text-muted)" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4.5 6V4a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </span>
              <span style={{ color: "var(--text-muted)" }}>{feature}</span>
              <span
                className="ml-auto rounded px-1.5 py-0.5 text-xs"
                style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}
              >
                Soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
