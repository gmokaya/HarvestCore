import { useState, useEffect, useCallback, Fragment } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Landmark, DropletIcon, ShieldCheck, BookOpen, RefreshCw,
  ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown,
  CheckCircle2, Clock, XCircle, AlertTriangle, Scale,
  Banknote, CircleDollarSign, Lock, ChevronRight, Filter,
  ArrowLeftRight, DollarSign, Layers,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const AUTH = { Authorization: "Bearer mock-token-admin-001" };
const JSON_H = { ...AUTH, "Content-Type": "application/json" };
const fmt = (n: string | number) => Number(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Types ─────────────────────────────────────────────────────────────────────
type Pool = {
  id: string; poolType: string; name: string; currency: string;
  balance: string; lockedBalance: string; available: string;
  totalDeposited: string; totalWithdrawn: string; capacity: string;
  utilizationPct: string; status: string;
};
type LedgerEntry = {
  id: string; txnGroupId: string; entryType: "debit" | "credit";
  accountId: string; accountType: string; accountLabel: string;
  amount: string; currency: string; description: string | null;
  createdAt: string;
};
type Escrow = {
  id: string; buyerId: string; sellerId: string; buyerName: string; sellerName: string;
  amount: string; currency: string; status: string; description: string | null;
  relatedEntityId: string | null; createdAt: string;
};
type Reconciliation = {
  kes: { totalDebits: string; totalCredits: string; balanced: boolean; difference: string };
  usdc: { totalDebits: string; totalCredits: string; balanced: boolean; difference: string };
  totalEntries: number; systemBalanced: boolean;
};
type PlatformAccount = {
  id: string; name: string; accountType: string; currency: string;
  balance: string; lockedBalance: string; status: string; description: string | null;
};

const TABS = [
  { id: "accounts", label: "Internal Accounts", icon: Landmark },
  { id: "pools", label: "Liquidity Pools", icon: DropletIcon },
  { id: "escrow", label: "Escrow Engine", icon: ShieldCheck },
  { id: "ledger", label: "Ledger Audit", icon: BookOpen },
];

const POOL_COLORS: Record<string, string> = {
  loan_financing: "from-blue-600 to-blue-800",
  trading_settlement: "from-purple-600 to-purple-800",
  stablecoin: "from-teal-600 to-teal-800",
};
const POOL_ICONS: Record<string, React.ElementType> = {
  loan_financing: Banknote,
  trading_settlement: ArrowLeftRight,
  stablecoin: CircleDollarSign,
};

const ACCOUNT_COLORS: Record<string, string> = {
  treasury: "border-amber-200 bg-amber-50",
  loan_pool: "border-blue-200 bg-blue-50",
  trading_pool: "border-purple-200 bg-purple-50",
  stablecoin_pool: "border-teal-200 bg-teal-50",
  escrow: "border-green-200 bg-green-50",
  settlement: "border-slate-200 bg-slate-50",
  fee_collection: "border-orange-200 bg-orange-50",
};
const ACCOUNT_ICON: Record<string, React.ElementType> = {
  treasury: Landmark,
  loan_pool: Banknote,
  trading_pool: ArrowLeftRight,
  stablecoin_pool: CircleDollarSign,
  escrow: ShieldCheck,
  settlement: Scale,
  fee_collection: DollarSign,
};
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  treasury: "Platform Treasury",
  loan_pool: "Loan Pool",
  trading_pool: "Trading Pool",
  stablecoin_pool: "Stablecoin Pool",
  escrow: "Escrow Engine",
  settlement: "Settlement Account",
  fee_collection: "Fee Collection",
};

const ESCROW_STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-700 bg-yellow-50",
  funded: "text-blue-700 bg-blue-50",
  released: "text-green-700 bg-green-50",
  cancelled: "text-slate-600 bg-slate-50",
  disputed: "text-red-700 bg-red-50",
};

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded",
      ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
      <span className={cn("w-1.5 h-1.5 rounded-full", ok ? "bg-green-500" : "bg-red-500")} />
      {label}
    </span>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Deposit-to-Pool Modal ─────────────────────────────────────────────────────
function PoolModal({ pool, onClose, onDone }: { pool: Pool; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handle = async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${BASE}/api/liquidity-pools/${action}`, {
        method: "POST", headers: JSON_H,
        body: JSON.stringify({ poolType: pool.poolType, amount: Number(amount), description }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error); return; }
      onDone(); onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h3 className="text-sm font-semibold">{pool.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            {(["deposit", "withdraw"] as const).map((a) => (
              <button key={a} onClick={() => setAction(a)}
                className={cn("flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
                  action === a ? "text-white" : "border border-border text-muted-foreground hover:text-foreground")}
                style={action === a ? { backgroundColor: "#0A2A2A" } : {}}>
                {a === "deposit" ? "Add Capital" : "Withdraw"}
              </button>
            ))}
          </div>
          <div className="p-3 rounded-lg bg-muted/40 text-xs flex justify-between">
            <span className="text-muted-foreground">Available</span>
            <span className="font-semibold">{pool.currency} {fmt(pool.available)}</span>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Amount ({pool.currency})</label>
            <input type="number" min="1" placeholder="0.00" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
            <input type="text" placeholder="Reason..." value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-border rounded-md px-4 py-2 text-sm hover:bg-muted/50">Cancel</button>
            <button onClick={handle} disabled={!amount || Number(amount) <= 0 || loading}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#0A2A2A" }}>
              {loading ? "Processing..." : action === "deposit" ? "Add Capital" : "Withdraw"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Escrow Modal ───────────────────────────────────────────────────────
function CreateEscrowModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ buyerId: "", sellerId: "", amount: "", currency: "KES", description: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handle = async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${BASE}/api/escrow/create`, {
        method: "POST", headers: JSON_H,
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error); return; }
      onDone(); onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h3 className="text-sm font-semibold">Create Escrow</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-800">
            Funds are locked from the buyer's wallet and held safely until the commodity is delivered.
          </div>
          {[
            { label: "Buyer User ID", key: "buyerId", placeholder: "e.g. FMR-2026-XXXXX" },
            { label: "Seller User ID", key: "sellerId", placeholder: "e.g. TRD-2026-XXXXX" },
          ].map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <input type="text" placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background font-mono" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Amount</label>
              <input type="number" min="1" placeholder="0.00" value={form.amount}
                onChange={(e) => setForm((x) => ({ ...x, amount: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Currency</label>
              <select value={form.currency} onChange={(e) => setForm((x) => ({ ...x, currency: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
                <option value="KES">KES</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <input type="text" placeholder="e.g. 500 bags of Maize — Nairobi delivery"
              value={form.description}
              onChange={(e) => setForm((x) => ({ ...x, description: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-border rounded-md px-4 py-2 text-sm hover:bg-muted/50">Cancel</button>
            <button onClick={handle} disabled={!form.buyerId || !form.sellerId || !form.amount || loading}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#0A2A2A" }}>
              {loading ? "Creating..." : "Create Escrow"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FinanceHubPage() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [pools, setPools] = useState<Pool[]>([]);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [showCreateEscrow, setShowCreateEscrow] = useState(false);
  const [escrowAction, setEscrowAction] = useState<{ id: string; action: "fund" | "release" | "cancel" } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [filterType, setFilterType] = useState("");
  const [escrowFilter, setEscrowFilter] = useState("");

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [poolsRes, ledgerRes, escrowsRes, reconRes] = await Promise.all([
        fetch(`${BASE}/api/liquidity-pools`, { headers: AUTH }),
        fetch(`${BASE}/api/ledger?limit=60`, { headers: AUTH }),
        fetch(`${BASE}/api/escrow`, { headers: AUTH }),
        fetch(`${BASE}/api/ledger/reconciliation`, { headers: AUTH }),
      ]);
      if (poolsRes.ok) { const d = await poolsRes.json(); setPools(d.pools); }
      if (ledgerRes.ok) { const d = await ledgerRes.json(); setLedger(d.entries); setLedgerTotal(d.total); }
      if (escrowsRes.ok) { const d = await escrowsRes.json(); setEscrows(d.escrows); }
      if (reconRes.ok) { setReconciliation(await reconRes.json()); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleEscrowAction = async (id: string, action: "fund" | "release" | "cancel") => {
    const r = await fetch(`${BASE}/api/escrow/${id}/${action}`, { method: "POST", headers: JSON_H });
    const d = await r.json();
    if (r.ok) { showToast(d.message); loadAll(); }
    else showToast(d.error, false);
  };

  const filteredLedger = filterType
    ? ledger.filter((e) => e.entryType === filterType)
    : ledger;

  const filteredEscrows = escrowFilter
    ? escrows.filter((e) => e.status === escrowFilter)
    : escrows;

  // Group ledger by txnGroupId for pair display
  const ledgerGroups: LedgerEntry[][] = [];
  const seen = new Set<string>();
  for (const entry of filteredLedger) {
    if (seen.has(entry.txnGroupId)) continue;
    seen.add(entry.txnGroupId);
    ledgerGroups.push(filteredLedger.filter((e) => e.txnGroupId === entry.txnGroupId));
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={cn("fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white",
          toast.ok ? "bg-green-600" : "bg-red-600")}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Escrow Modals */}
      {showCreateEscrow && <CreateEscrowModal onClose={() => setShowCreateEscrow(false)} onDone={() => { loadAll(); showToast("Escrow created"); }} />}
      {selectedPool && <PoolModal pool={selectedPool} onClose={() => setSelectedPool(null)} onDone={loadAll} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#0A2A2A" }}>
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Finance Engine</h1>
            <p className="text-xs text-muted-foreground">Internal accounts · Liquidity pools · Escrow · Double-entry ledger</p>
          </div>
        </div>
        <button onClick={loadAll}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-3 py-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Reconciliation Banner */}
      {reconciliation && (
        <div className={cn("flex items-center gap-3 px-4 py-3 rounded-lg text-sm border",
          reconciliation.systemBalanced
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800")}>
          {reconciliation.systemBalanced
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="font-medium">
            {reconciliation.systemBalanced
              ? `Ledger balanced — ${reconciliation.totalEntries.toLocaleString()} entries · KES debits = KES credits · USDC debits = USDC credits`
              : `Ledger imbalance detected — KES diff: ${reconciliation.kes.difference} · USDC diff: ${reconciliation.usdc.difference}`}
          </span>
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px",
              activeTab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted")}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Internal Accounts ────────────────────────────────────────────────── */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <SectionHeader title="Platform Internal Account Structure"
            sub="TokenHarvest's fintech-grade internal financial hierarchy — treasury, pools, escrow, settlement, and fee accounts" />

          {/* Architecture Diagram */}
          <Card className="p-5 border border-border/60">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Account Hierarchy</h3>
            <div className="flex items-start gap-6 overflow-x-auto pb-2">
              {[
                {
                  label: "Platform Treasury",
                  desc: "Master accounts holding all platform capital",
                  color: "bg-amber-600",
                  items: ["Treasury (KES)", "Treasury (USDC)"],
                },
                {
                  label: "Liquidity Pools",
                  desc: "Capital pools funding loans and trades",
                  color: "bg-blue-600",
                  items: ["Loan Financing Pool", "Trading Settlement Pool", "Stablecoin Pool"],
                },
                {
                  label: "Operational Accounts",
                  desc: "Escrow, settlement, and fee collection",
                  color: "bg-green-700",
                  items: ["Escrow Engine", "Settlement Account", "Fee Collection"],
                },
                {
                  label: "User Wallets",
                  desc: "Individual farmer, trader, lender wallets",
                  color: "bg-slate-600",
                  items: ["KES Wallet", "USDC Wallet"],
                },
              ].map((tier, i) => (
                <div key={i} className="flex-1 min-w-[160px]">
                  <div className={cn("text-[10px] font-bold text-white px-2 py-1 rounded-t-md", tier.color)}>{tier.label}</div>
                  <div className="border border-t-0 rounded-b-md p-2 space-y-1">
                    <p className="text-[10px] text-muted-foreground mb-2">{tier.desc}</p>
                    {tier.items.map((item) => (
                      <div key={item} className="text-[10px] bg-muted/40 rounded px-2 py-1 font-medium">{item}</div>
                    ))}
                  </div>
                  {i < 3 && (
                    <div className="text-center mt-2 text-muted-foreground">
                      <ChevronRight className="w-4 h-4 rotate-90 mx-auto" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Predefined Platform Accounts Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: "PA-TREASURY-KES", name: "Platform Treasury (KES)", type: "treasury", currency: "KES", balance: "50,000,000.00", desc: "Master KES capital reserve" },
              { id: "PA-TREASURY-USDC", name: "Platform Treasury (USDC)", type: "treasury", currency: "USDC", balance: "500,000.00", desc: "Master USDC reserve" },
              { id: "PA-ESCROW-KES", name: "Escrow Engine", type: "escrow", currency: "KES", balance: "0.00", desc: "Holds trade escrow funds" },
              { id: "PA-SETTLEMENT-KES", name: "Settlement Account", type: "settlement", currency: "KES", balance: "0.00", desc: "Final trade settlements" },
              { id: "PA-FEE-KES", name: "Fee Collection", type: "fee_collection", currency: "KES", balance: "0.00", desc: "Platform fee revenue" },
              { id: "LP-LOAN-KES", name: "Loan Financing Pool", type: "loan_pool", currency: "KES", balance: "250,000,000.00", desc: "Agricultural loan capital" },
              { id: "LP-TRADING-KES", name: "Trading Settlement Pool", type: "trading_pool", currency: "KES", balance: "80,000,000.00", desc: "Trade liquidity" },
              { id: "LP-USDC", name: "Stablecoin Pool", type: "stablecoin_pool", currency: "USDC", balance: "250,000.00", desc: "USDC for cross-border" },
            ].map((acc) => {
              const Icon = ACCOUNT_ICON[acc.type] ?? Landmark;
              return (
                <div key={acc.id} className={cn("rounded-xl p-4 border space-y-2", ACCOUNT_COLORS[acc.type] ?? "border-border bg-muted/20")}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 opacity-70" />
                    <span className="text-[10px] font-semibold">{ACCOUNT_TYPE_LABELS[acc.type]}</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold">{acc.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{acc.desc}</div>
                  </div>
                  <div className="pt-1 border-t border-black/10">
                    <div className="text-[10px] text-muted-foreground">Balance</div>
                    <div className="text-sm font-bold">{acc.currency} {acc.balance}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Flow Diagram: End-to-End Commodity Sale */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">End-to-End Commodity Sale Flow</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: "Buyer deposits", sub: "M-PESA / PesaLink" },
                { label: "Buyer Wallet", sub: "KES Balance credited" },
                { label: "Escrow Lock", sub: "Funds held safely" },
                { label: "Commodity Delivered", sub: "Inspection confirmed" },
                { label: "Seller Wallet", sub: "Credited on release" },
                { label: "Seller withdraws", sub: "M-PESA payout" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="text-center">
                    <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold"
                      style={{ borderColor: "#0A2A2A", color: "#0A2A2A" }}>{i + 1}</div>
                    <div className="text-[10px] font-medium mt-1 max-w-[80px]">{step.label}</div>
                    <div className="text-[9px] text-muted-foreground max-w-[80px]">{step.sub}</div>
                  </div>
                  {i < 5 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Liquidity Pools ───────────────────────────────────────────────────── */}
      {activeTab === "pools" && (
        <div className="space-y-4">
          <SectionHeader title="Liquidity Pool System"
            sub="Capital pools funding agricultural loans, commodity trades, and stablecoin settlements" />

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => <div key={i} className="h-48 bg-muted/30 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pools.map((pool) => {
                const PoolIcon = POOL_ICONS[pool.poolType] ?? Banknote;
                const grad = POOL_COLORS[pool.poolType] ?? "from-slate-600 to-slate-800";
                const utilPct = parseFloat(pool.utilizationPct);
                return (
                  <div key={pool.id} className="rounded-xl overflow-hidden border shadow-sm">
                    <div className={cn("p-5 text-white bg-gradient-to-br", grad)}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <PoolIcon className="w-4 h-4 text-white/80" />
                          <span className="text-xs font-medium text-white/80">{pool.name}</span>
                        </div>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium",
                          pool.status === "active" ? "bg-green-500/20 text-green-200" : "bg-red-500/20 text-red-200")}>
                          {pool.status}
                        </span>
                      </div>
                      <div className="text-xl font-bold">{pool.currency} {fmt(pool.balance)}</div>
                      <div className="text-xs text-white/60 mt-0.5">Total balance</div>
                      <div className="mt-3 flex gap-4 text-xs text-white/70">
                        <div><div className="text-[10px] text-white/40">Available</div>{pool.currency} {fmt(pool.available)}</div>
                        <div><div className="text-[10px] text-white/40">Capacity</div>{pool.currency} {fmt(pool.capacity)}</div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3 bg-background">
                      {/* Utilization bar */}
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Utilization</span>
                          <span>{pool.utilizationPct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, utilPct)}%`, backgroundColor: utilPct > 80 ? "#ef4444" : utilPct > 60 ? "#f59e0b" : "#22c55e" }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Total Deposited</div>
                          <div className="font-medium">{pool.currency} {fmt(pool.totalDeposited)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">Total Withdrawn</div>
                          <div className="font-medium">{pool.currency} {fmt(pool.totalWithdrawn)}</div>
                        </div>
                      </div>
                      <button onClick={() => setSelectedPool(pool)}
                        className="w-full text-xs font-medium border border-border rounded-md py-1.5 hover:bg-muted/50 transition-colors">
                        Manage Pool
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pool Funding Sources */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Pool Funding Sources</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { source: "Institutional Lenders", pool: "Loan Financing", color: "text-blue-700 bg-blue-50 border-blue-200" },
                { source: "Platform Treasury", pool: "All Pools", color: "text-amber-700 bg-amber-50 border-amber-200" },
                { source: "DeFi / Stablecoin", pool: "Stablecoin Pool", color: "text-teal-700 bg-teal-50 border-teal-200" },
                { source: "Loan Repayments", pool: "Loan Financing", color: "text-green-700 bg-green-50 border-green-200" },
              ].map((s) => (
                <div key={s.source} className={cn("rounded-lg p-3 border", s.color)}>
                  <div className="text-[10px] font-bold">{s.source}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">→ {s.pool}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Escrow Engine ─────────────────────────────────────────────────────── */}
      {activeTab === "escrow" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader title="Escrow Engine"
              sub="Buyer → Escrow → Seller workflow for commodity trades and forward contracts" />
            <button onClick={() => setShowCreateEscrow(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white"
              style={{ backgroundColor: "#0A2A2A" }}>
              <ShieldCheck className="w-3.5 h-3.5" /> New Escrow
            </button>
          </div>

          {/* Workflow Diagram */}
          <Card className="p-5 bg-gradient-to-r from-muted/30 to-background">
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { icon: ArrowDownToLine, label: "Buyer Deposits", color: "bg-blue-100 text-blue-700" },
                { icon: Lock, label: "Escrow Lock", color: "bg-amber-100 text-amber-700" },
                { icon: CheckCircle2, label: "Commodity Delivered", color: "bg-purple-100 text-purple-700" },
                { icon: ArrowUpFromLine, label: "Seller Credited", color: "bg-green-100 text-green-700" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium", step.color)}>
                    <step.icon className="w-3.5 h-3.5" />
                    {step.label}
                  </div>
                  {i < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </Card>

          {/* Filter + List */}
          <div className="flex items-center gap-3">
            <select aria-label="Filter escrow status" value={escrowFilter} onChange={(e) => setEscrowFilter(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="funded">Funded</option>
              <option value="released">Released</option>
              <option value="cancelled">Cancelled</option>
              <option value="disputed">Disputed</option>
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{filteredEscrows.length} escrow{filteredEscrows.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="h-40 bg-muted/30 rounded-xl animate-pulse" />
          ) : filteredEscrows.length === 0 ? (
            <Card className="p-10 text-center">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm text-muted-foreground">No escrows found. Create one to protect a commodity trade.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredEscrows.map((e) => (
                <Card key={e.id} className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{e.id}</span>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", ESCROW_STATUS_COLORS[e.status])}>
                        {e.status}
                      </span>
                    </div>
                    <div className="text-sm font-semibold mt-1">{e.currency} {fmt(e.amount)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {e.buyerName} → {e.sellerName}
                      {e.description && <span className="ml-2 opacity-70">· {e.description}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {e.status === "pending" && (
                      <button onClick={() => handleEscrowAction(e.id, "fund")}
                        className="text-[10px] font-medium px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">
                        Fund Escrow
                      </button>
                    )}
                    {e.status === "funded" && (
                      <>
                        <button onClick={() => handleEscrowAction(e.id, "release")}
                          className="text-[10px] font-medium px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200">
                          Release to Seller
                        </button>
                        <button onClick={() => handleEscrowAction(e.id, "cancel")}
                          className="text-[10px] font-medium px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">
                          Cancel
                        </button>
                      </>
                    )}
                    {["released", "cancelled"].includes(e.status) && (
                      <span className="text-[10px] text-muted-foreground">Settled</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Ledger Audit ──────────────────────────────────────────────────────── */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          <SectionHeader title="Double-Entry Ledger Journal"
            sub="Every financial event creates a matching debit + credit pair. The system must always balance." />

          {/* Reconciliation Summary */}
          {reconciliation && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  label: "KES Ledger",
                  debits: reconciliation.kes.totalDebits,
                  credits: reconciliation.kes.totalCredits,
                  balanced: reconciliation.kes.balanced,
                  currency: "KES",
                },
                {
                  label: "USDC Ledger",
                  debits: reconciliation.usdc.totalDebits,
                  credits: reconciliation.usdc.totalCredits,
                  balanced: reconciliation.usdc.balanced,
                  currency: "USDC",
                },
              ].map((item) => (
                <Card key={item.label} className={cn("p-4 border", item.balanced ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30")}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">{item.label}</span>
                    <StatusDot ok={item.balanced} label={item.balanced ? "Balanced" : "Imbalanced"} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Total Debits</div>
                      <div className="font-semibold text-red-600">{item.currency} {fmt(item.debits)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Total Credits</div>
                      <div className="font-semibold text-green-600">{item.currency} {fmt(item.credits)}</div>
                    </div>
                  </div>
                </Card>
              ))}
              <Card className="p-4 border">
                <div className="text-xs font-semibold mb-2">System Status</div>
                <div className="flex items-center gap-2">
                  {reconciliation.systemBalanced
                    ? <CheckCircle2 className="w-8 h-8 text-green-500" />
                    : <AlertTriangle className="w-8 h-8 text-red-500" />}
                  <div>
                    <div className="text-sm font-bold">{reconciliation.systemBalanced ? "All Clear" : "Action Required"}</div>
                    <div className="text-[10px] text-muted-foreground">{reconciliation.totalEntries.toLocaleString()} total entries</div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Filter + Journal */}
          <div className="flex items-center gap-3">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select aria-label="Filter ledger entries" value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
              <option value="">All Entries</option>
              <option value="debit">Debits only</option>
              <option value="credit">Credits only</option>
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{ledgerTotal} total entries · showing {filteredLedger.length}</span>
          </div>

          {loading ? (
            <div className="h-40 bg-muted/30 rounded-xl animate-pulse" />
          ) : ledgerGroups.length === 0 ? (
            <Card className="p-10 text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm text-muted-foreground">No ledger entries yet. Every wallet and pool transaction is recorded here.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b bg-muted/30">
                    <th className="px-4 py-2.5 font-medium">Tx Group</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Account</th>
                    <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Description</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerGroups.map((group, gi) => (
                    <Fragment key={group[0].txnGroupId}>
                      {group.map((entry, ei) => (
                        <tr key={entry.id}
                          className={cn("border-b transition-colors hover:bg-muted/10",
                            ei === 0 && gi > 0 ? "border-t-2 border-muted" : "")}>
                          <td className="px-4 py-2 font-mono text-muted-foreground">
                            {ei === 0 ? entry.txnGroupId : ""}
                          </td>
                          <td className="px-4 py-2">
                            <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                              entry.entryType === "debit" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700")}>
                              {entry.entryType === "debit"
                                ? <TrendingDown className="w-3 h-3" />
                                : <TrendingUp className="w-3 h-3" />}
                              {entry.entryType.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="font-medium">{entry.accountLabel}</div>
                            <div className="text-[10px] text-muted-foreground">{entry.accountType.replace("_", " ")}</div>
                          </td>
                          <td className={cn("px-4 py-2 text-right font-semibold",
                            entry.entryType === "debit" ? "text-red-700" : "text-green-700")}>
                            {entry.currency} {fmt(entry.amount)}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">
                            {entry.description ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                            {new Date(entry.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                            <div className="text-[10px]">
                              {new Date(entry.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
