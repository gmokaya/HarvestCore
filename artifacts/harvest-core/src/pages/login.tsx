import { useState, useEffect } from "react";
import { useAuth, DEMO_ACCOUNTS } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import {
  Eye, EyeOff, ArrowRight, Tractor, BarChart3, Lock,
  Briefcase, Warehouse, Eye as EyeIcon, Landmark, ShieldCheck,
  TrendingUp, Wheat,
} from "lucide-react";

const ROLE_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  admin:              { label: "Platform Admin",      color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",    icon: ShieldCheck },
  farmer:             { label: "Farmer",              color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20", icon: Tractor },
  trader:             { label: "Trader",              color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: BarChart3 },
  collateral_manager: { label: "Collateral Mgr",     color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",  icon: Lock },
  processor:          { label: "Processor",           color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: Briefcase },
  warehouse_op:       { label: "Warehouse Op",        color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", icon: Warehouse },
  checker:            { label: "Checker / Auditor",   color: "text-teal-400",   bg: "bg-teal-500/10 border-teal-500/20",  icon: EyeIcon },
  lender:             { label: "Lender",              color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20", icon: Landmark },
};

const STATS = [
  { label: "Active Farmers",   value: "12,400+", icon: Tractor },
  { label: "Tokenized Assets", value: "KES 2.4B", icon: Wheat },
  { label: "Loans Disbursed",  value: "KES 890M", icon: TrendingUp },
  { label: "Warehouses",       value: "340",      icon: Warehouse },
];

const COMMODITY_PRICES = [
  { name: "Maize",  price: "38.50", unit: "KES/kg",  trend: "+2.1%" },
  { name: "Coffee", price: "620",   unit: "KES/kg",  trend: "-1.9%" },
  { name: "Wheat",  price: "42.00", unit: "KES/kg",  trend: "+2.9%" },
  { name: "Tea",    price: "290",   unit: "KES/kg",  trend: "+0.8%" },
];

const QUICK_DEMO_ROLES = ["admin", "farmer", "trader", "collateral_manager", "processor", "lender"];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tickIndex, setTickIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTickIndex((i) => (i + 1) % COMMODITY_PRICES.length), 2400);
    return () => clearInterval(id);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    setError("");
    setTimeout(() => {
      const result = login(email, password);
      if (!result.ok) setError(result.error ?? "Login failed.");
      setLoading(false);
    }, 600);
  }

  function quickLogin(role: string) {
    const account = DEMO_ACCOUNTS.find((a) => a.role === role);
    if (!account) return;
    setEmail(account.email);
    setPassword(role === "admin" ? "admin123" : "Demo@2025");
    setError("");
  }

  const tick = COMMODITY_PRICES[tickIndex];

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── LEFT PANEL ─ brand dark ── */}
      <div
        className="hidden lg:flex lg:w-[58%] xl:w-[55%] flex-col relative overflow-hidden"
        style={{ backgroundColor: "#0A2A2A" }}
      >
        {/* Subtle background grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />
        {/* Gradient orbs */}
        <div className="absolute top-[-80px] right-[-60px] w-[340px] h-[340px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #c7d7da 0%, transparent 70%)" }} />
        <div className="absolute bottom-[80px] left-[-80px] w-[280px] h-[280px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #c7d7da 0%, transparent 70%)" }} />

        <div className="relative flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="flex items-baseline justify-between mb-16">
            <span style={{ fontFamily: "'Belleza', serif", fontSize: "26px", lineHeight: 1.2, color: "rgba(255,255,255,0.92)", letterSpacing: "0.01em" }}>
              TokenHarvest
            </span>
            <span style={{ fontFamily: "'Josefin Sans', 'Futura', 'Century Gothic', sans-serif", fontSize: "9px", letterSpacing: "0.196em", color: "rgba(199,215,218,0.7)", textTransform: "uppercase" }}>
              TRADE FINANCE
            </span>
          </div>

          {/* Hero text */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-3">
              <span className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full border"
                style={{ color: "#c7d7da", borderColor: "rgba(199,215,218,0.25)", background: "rgba(199,215,218,0.08)" }}>
                Agricultural Trade Finance
              </span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-5"
              style={{ color: "rgba(255,255,255,0.95)" }}>
              Commodity-Backed<br />
              <span style={{ color: "#c7d7da" }}>Digital Finance</span><br />
              for Africa
            </h1>
            <p className="text-base leading-relaxed mb-10 max-w-md" style={{ color: "rgba(255,255,255,0.5)" }}>
              Tokenize warehouse receipts, access working capital, and trade agricultural commodities, all in one secure platform.
            </p>

            {/* Platform stats */}
            <div className="grid grid-cols-2 gap-3 mb-10">
              {STATS.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(199,215,218,0.12)" }}>
                    <Icon className="w-4 h-4" style={{ color: "#c7d7da" }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>{value}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Live commodity ticker */}
            <div className="flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#4ade80" }} />
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Live</span>
              </div>
              <div className="flex items-center gap-3 transition-all duration-500">
                <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>{tick.name}</span>
                <span className="font-mono text-sm" style={{ color: "#c7d7da" }}>{tick.price} {tick.unit}</span>
                <span className={cn("text-xs font-medium", tick.trend.startsWith("+") ? "text-green-400" : "text-red-400")}>
                  {tick.trend}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom attribution */}
          <div className="mt-10">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              © 2026 TokenHarvest Ltd · Regulated by CBK & CMA Kenya · ISO 27001 Certified
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ─ login form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 bg-white min-h-screen">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-baseline justify-between w-full max-w-[280px]">
          <span style={{ fontFamily: "'Belleza', serif", fontSize: "22px", lineHeight: 1.2, color: "#0A2A2A" }}>TokenHarvest</span>
          <span style={{ fontFamily: "'Josefin Sans', 'Futura', 'Century Gothic', sans-serif", fontSize: "8.5px", letterSpacing: "0.196em", color: "#0A2A2A", textTransform: "uppercase", opacity: 0.55 }}>
            TRADE FINANCE
          </span>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: "#0A2A2A" }}>
              Welcome back
            </h2>
            <p className="text-sm" style={{ color: "#6b7280" }}>
              Sign in to your HarvestCore account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium" style={{ color: "#374151" }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.co.ke"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  border: error ? "1.5px solid #ef4444" : "1.5px solid #e5e7eb",
                  color: "#111827",
                  background: "#fafafa",
                }}
                onFocus={(e) => { if (!error) e.target.style.borderColor = "#0A2A2A"; }}
                onBlur={(e) => { if (!error) e.target.style.borderColor = "#e5e7eb"; }}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium" style={{ color: "#374151" }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all"
                  style={{
                    border: error ? "1.5px solid #ef4444" : "1.5px solid #e5e7eb",
                    color: "#111827",
                    background: "#fafafa",
                  }}
                  onFocus={(e) => { if (!error) e.target.style.borderColor = "#0A2A2A"; }}
                  onBlur={(e) => { if (!error) e.target.style.borderColor = "#e5e7eb"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                  style={{ color: "#9ca3af" }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                <span className="shrink-0">⚠</span> {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-150 mt-2"
              style={{
                backgroundColor: loading ? "#1a4040" : "#0A2A2A",
                color: "#fff",
                opacity: loading ? 0.8 : 1,
              }}
              onMouseEnter={(e) => !loading && ((e.target as HTMLElement).style.backgroundColor = "#0d3535")}
              onMouseLeave={(e) => !loading && ((e.target as HTMLElement).style.backgroundColor = "#0A2A2A")}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: "#f0f0f0" }} />
            <span className="text-xs font-medium" style={{ color: "#9ca3af" }}>Quick demo access</span>
            <div className="flex-1 h-px" style={{ background: "#f0f0f0" }} />
          </div>

          {/* Role quick-login chips */}
          <div className="grid grid-cols-2 gap-2 mb-8">
            {QUICK_DEMO_ROLES.map((role) => {
              const meta = ROLE_META[role];
              const Icon = meta.icon;
              const acc = DEMO_ACCOUNTS.find((a) => a.role === role);
              if (!acc) return null;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => quickLogin(role)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all hover:scale-[1.02] active:scale-[0.98] text-left",
                    meta.bg, meta.color
                  )}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="leading-tight">{meta.label}</span>
                </button>
              );
            })}
          </div>

          {/* Credentials hint */}
          <div className="px-4 py-3 rounded-xl text-xs space-y-1" style={{ background: "#f9fafb", border: "1px solid #f0f0f0" }}>
            <p className="font-semibold" style={{ color: "#374151" }}>Demo credentials</p>
            <p style={{ color: "#6b7280" }}>
              <span className="font-mono" style={{ color: "#0A2A2A" }}>admin@harvestcore.io</span> · <span className="font-mono">admin123</span>
            </p>
            <p style={{ color: "#6b7280" }}>All other roles use password <span className="font-mono" style={{ color: "#0A2A2A" }}>Demo@2025</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
