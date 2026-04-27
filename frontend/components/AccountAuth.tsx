"use client";

import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/api";
import { authLogin, authMe, authRegister, getToken, removeToken, setToken } from "@/lib/api";

type View = "checking" | "login" | "register" | "profile";

// ─── Shared input styles (mirror Calculator) ──────────────────────────────────
const baseInput: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  borderColor: "rgba(255,255,255,0.10)",
  color: "var(--text-primary)",
};
const focusInput: React.CSSProperties = {
  background: "rgba(245,166,35,0.04)",
  borderColor: "rgba(245,166,35,0.45)",
  color: "var(--text-primary)",
};

function TextInput({
  label, type = "text", value, onChange, onBlur, error, placeholder, autoComplete,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  onBlur?: () => void; error?: string; placeholder?: string; autoComplete?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.(); }}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg px-3 py-2.5 text-sm font-body outline-none border transition-colors duration-150"
        style={focused ? focusInput : baseInput}
      />
      {error && (
        <p className="text-xs font-body" style={{ color: "var(--negative)" }}>{error}</p>
      )}
    </div>
  );
}

function PasswordInput({
  label, value, onChange, onBlur, error, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void;
  onBlur?: () => void; error?: string; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          autoComplete={autoComplete}
          className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm font-body outline-none border transition-colors duration-150"
          style={focused ? focusInput : baseInput}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
          tabIndex={-1}
        >
          {show ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error && (
        <p className="text-xs font-body" style={{ color: "var(--negative)" }}>{error}</p>
      )}
    </div>
  );
}

function StrengthBar({ password }: { password: string }) {
  const len = password.length;
  let score = 0;
  if (len >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;

  const labels = ["", "Weak", "Fair", "Strong"];
  const colors = ["", "var(--negative)", "var(--warning)", "var(--positive)"];
  const widths = ["0%", "33%", "67%", "100%"];

  if (!password) return null;

  return (
    <div className="mt-1.5">
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: widths[score], background: colors[score] }}
        />
      </div>
      <p className="mt-1 text-xs font-body" style={{ color: colors[score] }}>{labels[score]}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg px-4 py-3 text-sm font-body"
      style={{ background: "rgba(255,68,85,0.08)", border: "1px solid rgba(255,68,85,0.2)", color: "var(--negative)" }}
    >
      {message}
    </div>
  );
}

function PrimaryBtn({ onClick, loading, children }: { onClick?: () => void; loading?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-lg py-3 text-sm font-semibold font-display uppercase tracking-wider transition-opacity duration-150 flex items-center justify-center gap-2"
      style={{
        background: loading ? "rgba(245,166,35,0.6)" : "var(--accent)",
        color: "#070B12",
        opacity: loading ? 0.8 : 1,
      }}
    >
      {loading && (
        <div className="spinner h-4 w-4 rounded-full border-2" style={{ borderColor: "rgba(7,11,18,0.25)", borderTopColor: "#070B12" }} />
      )}
      {children}
    </button>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="flex items-center justify-center rounded-full text-xl font-bold font-display select-none"
      style={{
        width: 72, height: 72,
        background: "linear-gradient(135deg, rgba(245,166,35,0.3) 0%, rgba(245,166,35,0.12) 100%)",
        border: "2px solid rgba(245,166,35,0.4)",
        color: "var(--accent)",
        boxShadow: "0 0 24px rgba(245,166,35,0.18)",
      }}
    >
      {initials || "?"}
    </div>
  );
}

// ─── Feature lock card ────────────────────────────────────────────────────────
function LockedFeature({ label, description }: { label: string; description: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold font-display" style={{ color: "var(--text-secondary)" }}>{label}</p>
        <p className="text-xs font-body mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>
      </div>
      <span
        className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold font-display uppercase tracking-wider"
        style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", color: "rgba(245,166,35,0.6)" }}
      >
        Soon
      </span>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl px-8 py-9 w-full"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        backdropFilter: "blur(12px)",
      }}
    >
      {children}
    </div>
  );
}

// ─── Login view ───────────────────────────────────────────────────────────────
function LoginView({
  onSuccess, onToggle,
}: {
  onSuccess: (user: AuthUser, token: string) => void;
  onToggle: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authLogin(email, password);
      setToken(res.access_token);
      onSuccess(res.user, res.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
        Welcome back
      </h2>
      <p className="mt-1 mb-7 text-sm font-body" style={{ color: "var(--text-muted)" }}>
        Sign in to your Investment Doctor account
      </p>

      <form onSubmit={submit} className="space-y-4">
        <TextInput
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <PasswordInput
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        {error && <ErrorBanner message={error} />}
        <div className="pt-1">
          <PrimaryBtn loading={loading}>{loading ? "Signing in…" : "Sign In"}</PrimaryBtn>
        </div>
      </form>

      <p className="mt-6 text-center text-sm font-body" style={{ color: "var(--text-muted)" }}>
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onToggle}
          className="font-semibold transition-colors duration-150 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          Create one
        </button>
      </p>
    </Card>
  );
}

// ─── Register view ────────────────────────────────────────────────────────────
function RegisterView({
  onSuccess, onToggle,
}: {
  onSuccess: (user: AuthUser, token: string) => void;
  onToggle: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Touched state — only show inline errors after field interaction
  const [touched, setTouched] = useState({ email: false, confirm: false });

  const emailErr = touched.email && email && !email.includes("@") ? "Enter a valid email address" : "";
  const confirmErr = touched.confirm && confirm && confirm !== password ? "Passwords don't match" : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, confirm: true });
    if (!name.trim()) { setError("Display name is required"); return; }
    if (!email.includes("@")) { setError("Enter a valid email address"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await authRegister(email, name, password);
      setToken(res.access_token);
      onSuccess(res.user, res.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
        Create your account
      </h2>
      <p className="mt-1 mb-7 text-sm font-body" style={{ color: "var(--text-muted)" }}>
        Your personal tax intelligence, always on
      </p>

      <form onSubmit={submit} className="space-y-4">
        <TextInput
          label="Display Name"
          value={name}
          onChange={setName}
          placeholder="Jane Doe"
          autoComplete="name"
        />
        <TextInput
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={emailErr}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <div>
          <PasswordInput
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <StrengthBar password={password} />
        </div>
        <PasswordInput
          label="Confirm Password"
          value={confirm}
          onChange={setConfirm}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          error={confirmErr}
          autoComplete="new-password"
        />
        {error && <ErrorBanner message={error} />}
        <div className="pt-1">
          <PrimaryBtn loading={loading}>{loading ? "Creating account…" : "Create Account"}</PrimaryBtn>
        </div>
      </form>

      <p className="mt-6 text-center text-sm font-body" style={{ color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <button
          type="button"
          onClick={onToggle}
          className="font-semibold transition-colors duration-150 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          Sign in
        </button>
      </p>
    </Card>
  );
}

// ─── Profile view ─────────────────────────────────────────────────────────────
function ProfileView({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const memberSince = (() => {
    try {
      return new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return "—";
    }
  })();

  return (
    <Card>
      <div className="flex flex-col items-center text-center pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Avatar name={user.display_name} />
        <h2 className="mt-4 text-2xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
          {user.display_name}
        </h2>
        <p className="mt-1 text-sm font-body" style={{ color: "var(--text-secondary)" }}>
          {user.email}
        </p>
        <div
          className="mt-3 rounded-full px-3 py-1 text-xs font-semibold font-display uppercase tracking-wider"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "var(--text-muted)" }}
        >
          Member since {memberSince}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider font-display" style={{ color: "var(--text-muted)" }}>
          Coming up next
        </p>
        <LockedFeature
          label="PDF Import"
          description="Upload W2s and brokerage statements — we extract everything automatically."
        />
        <LockedFeature
          label="Multi-year History"
          description="Track tax trends and net worth across multiple years side by side."
        />
        <LockedFeature
          label="CPA Export"
          description="Generate a clean summary PDF ready to hand off to your accountant."
        />
      </div>

      <button
        onClick={onSignOut}
        className="mt-7 w-full rounded-lg py-2.5 text-sm font-semibold font-display uppercase tracking-wider transition-all duration-150"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "var(--text-muted)" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,68,85,0.3)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--negative)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.09)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
        }}
      >
        Sign Out
      </button>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AccountAuth() {
  const [view, setView] = useState<View>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [slideDir, setSlideDir] = useState<"left" | "right">("left");

  useEffect(() => {
    const token = getToken();
    if (!token) { setView("login"); return; }
    authMe(token)
      .then((u) => { setUser(u); setView("profile"); })
      .catch(() => { removeToken(); setView("login"); });
  }, []);

  const handleAuthSuccess = (u: AuthUser) => {
    setUser(u);
    setSlideDir("left");
    setAnimKey((k) => k + 1);
    setView("profile");
  };

  const handleSignOut = () => {
    removeToken();
    setUser(null);
    setView("login");
  };

  const toRegister = () => {
    setSlideDir("left");
    setAnimKey((k) => k + 1);
    setView("register");
  };

  const toLogin = () => {
    setSlideDir("right");
    setAnimKey((k) => k + 1);
    setView("login");
  };

  return (
    <div
      className="relative flex min-h-[calc(100vh-56px)] items-center justify-center px-6 py-16 overflow-hidden"
    >
      {/* Ambient glow orbs */}
      <div
        className="pointer-events-none absolute"
        style={{
          width: 600, height: 600, top: "50%", left: "50%",
          transform: "translate(-50%, -55%)",
          background: "radial-gradient(circle, rgba(245,166,35,0.045) 0%, transparent 65%)",
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          width: 300, height: 300, bottom: "10%", right: "15%",
          background: "radial-gradient(circle, rgba(0,200,124,0.035) 0%, transparent 65%)",
        }}
      />

      <div className="relative w-full max-w-md">
        {view === "checking" ? (
          <div className="flex justify-center py-20">
            <div
              className="spinner h-8 w-8 rounded-full border-2"
              style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "var(--accent)" }}
            />
          </div>
        ) : (
          <div
            key={animKey}
            className={slideDir === "left" ? "slide-from-right" : "slide-from-left"}
          >
            {view === "login" && (
              <LoginView onSuccess={handleAuthSuccess} onToggle={toRegister} />
            )}
            {view === "register" && (
              <RegisterView onSuccess={handleAuthSuccess} onToggle={toLogin} />
            )}
            {view === "profile" && user && (
              <ProfileView user={user} onSignOut={handleSignOut} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
