import { useState, useEffect, useCallback, Fragment } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Landmark, DropletIcon, ShieldCheck, BookOpen, RefreshCw,
  ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown,
  CheckCircle2, Clock, XCircle, AlertTriangle, Scale,
  Banknote, CircleDollarSign, Lock, ChevronRight, Filter,
  ArrowLeftRight, DollarSign, Layers, Building2, Activity,
  Link2, ShieldAlert, Users, FileCheck2, BadgePercent,
  TriangleAlert, Zap, AlertOctagon, ArrowRight, PhoneCall,
  CreditCard, Send, Wifi, WifiOff, GitMerge,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const AUTH = { Authorization: "Bearer mock-token-admin-001" };
const JSON_H = { ...AUTH, "Content-Type": "application/json" };
const fmt = (n: string | number) => Number(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "2-digit" });

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
  amount: string; currency: string; description: string | null; createdAt: string;
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
type RailTxn = {
  id: string; rail: string; externalRef: string; direction: string;
  amount: string; currency: string; phoneOrAccount: string | null;
  status: string; ledgerGroupId: string | null; walletTransactionId: string | null;
  discrepancyNote: string | null; importedAt: string; matchedAt: string | null;
};
type ReconSummary = {
  total: number; matched: number; unmatched: number; discrepancy: number;
  dismissed: number; matchRate: string;
  byRail: { rail: string; total: string; matched: string }[];
};
type FraudAlert = {
  id: string; alertType: string; severity: string; userId: string;
  walletId: string | null; amount: string | null; currency: string;
  description: string; transactionRef: string | null; status: string;
  resolvedBy: string | null; resolutionNote: string | null;
  createdAt: string; resolvedAt: string | null;
};
type AlertSummary = {
  total: number; open: number; investigating: number; resolved: number; dismissed: number;
  bySeverity: { critical: number; high: number; medium: number; low: number };
};
type Distribution = {
  id: string; poolId: string; investorId: string; investorName: string | null;
  period: string; grossAmount: string; feeAmount: string; netAmount: string;
  currency: string; yieldRate: string | null; status: string;
  createdAt: string; paidAt: string | null;
};
type DistSummary = {
  totalDistributed: string; pendingAmount: string; totalGross: string;
  totalFees: string; count: number; paidCount: number; pendingCount: number;
};

// ── Config ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "accounts",       label: "Internal Accounts", icon: Landmark },
  { id: "pools",          label: "Liquidity Pools",   icon: DropletIcon },
  { id: "escrow",         label: "Escrow Engine",     icon: ShieldCheck },
  { id: "ledger",         label: "Ledger Audit",      icon: BookOpen },
  { id: "treasury",       label: "Treasury",          icon: Building2 },
  { id: "reconciliation", label: "Reconciliation",    icon: GitMerge },
  { id: "monitoring",     label: "Monitoring",        icon: ShieldAlert },
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
  treasury: Landmark, loan_pool: Banknote, trading_pool: ArrowLeftRight,
  stablecoin_pool: CircleDollarSign, escrow: ShieldCheck,
  settlement: Scale, fee_collection: DollarSign,
};
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  treasury: "Platform Treasury", loan_pool: "Loan Pool",
  trading_pool: "Trading Pool", stablecoin_pool: "Stablecoin Pool",
  escrow: "Escrow Engine", settlement: "Settlement Account",
  fee_collection: "Fee Collection",
};
const ESCROW_STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-700 bg-yellow-50",
  funded: "text-blue-700 bg-blue-50",
  released: "text-green-700 bg-green-50",
  cancelled: "text-slate-600 bg-slate-50",
  disputed: "text-red-700 bg-red-50",
};
const RAIL_ICONS: Record<string, React.ElementType> = {
  mpesa: PhoneCall, pesalink: Wifi, paystack: CreditCard,
  pesapal: Send, stablecoin: CircleDollarSign, manual: FileCheck2,
};
const RAIL_COLORS: Record<string, string> = {
  mpesa: "text-green-700 bg-green-50 border-green-200",
  pesalink: "text-blue-700 bg-blue-50 border-blue-200",
  paystack: "text-purple-700 bg-purple-50 border-purple-200",
  pesapal: "text-orange-700 bg-orange-50 border-orange-200",
  stablecoin: "text-teal-700 bg-teal-50 border-teal-200",
  manual: "text-slate-700 bg-slate-50 border-slate-200",
};
const RAIL_TXN_STATUS: Record<string, string> = {
  matched: "text-green-700 bg-green-50",
  unmatched: "text-amber-700 bg-amber-50",
  discrepancy: "text-red-700 bg-red-50",
  dismissed: "text-slate-500 bg-slate-50",
};
const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-800 bg-red-100 border-red-300",
  high: "text-red-700 bg-red-50 border-red-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  low: "text-blue-700 bg-blue-50 border-blue-200",
};
const ALERT_STATUS_COLORS: Record<string, string> = {
  open: "text-red-700 bg-red-50",
  investigating: "text-amber-700 bg-amber-50",
  resolved: "text-green-700 bg-green-50",
  dismissed: "text-slate-600 bg-slate-50",
};
const ALERT_TYPE_LABELS: Record<string, string> = {
  large_withdrawal: "Large Withdrawal",
  rapid_transfers: "Rapid Transfers",
  suspicious_pattern: "Suspicious Pattern",
  velocity_breach: "Velocity Breach",
  unusual_hours: "Unusual Hours",
  account_takeover: "Account Takeover",
};
const DIST_STATUS: Record<string, string> = {
  pending: "text-amber-700 bg-amber-50",
  processing: "text-blue-700 bg-blue-50",
  paid: "text-green-700 bg-green-50",
  failed: "text-red-700 bg-red-50",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
      <div className={cn("text-xl font-bold mt-0.5", color ?? "text-foreground")}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

// ── Pool Modal ────────────────────────────────────────────────────────────────
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
  const [form, setForm] = useState({ buyerId: "", sellerId: "", amount: "", currency: "KES", description: "", relatedEntityId: "", relatedEntityType: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handle = async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${BASE}/api/escrow`, {
        method: "POST", headers: JSON_H,
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error); return; }
      onDone(); onClose();
    } finally { setLoading(false); }
  };

  const field = (key: keyof typeof form, label: string, type = "text", placeholder = "") => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type} placeholder={placeholder} value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h3 className="text-sm font-semibold">Create Escrow</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">×</button>
        </div>
        <div className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
          {field("buyerId", "Buyer ID", "text", "user-id or admin-001")}
          {field("sellerId", "Seller ID", "text", "user-id or farmer-001")}
          {field("amount", "Amount", "number", "0.00")}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Currency</label>
            <select aria-label="Escrow currency" value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
              <option value="KES">KES</option>
              <option value="USDC">USDC</option>
            </select>
          </div>
          {field("description", "Description (optional)", "text", "Maize trade — 5 tonnes")}
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
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

// ── Import Rail Transaction Modal ─────────────────────────────────────────────
function ImportRailModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    rail: "mpesa", externalRef: "", direction: "inbound",
    amount: "", currency: "KES", phoneOrAccount: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handle = async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${BASE}/api/reconciliation/import`, {
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
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h3 className="text-sm font-semibold">Import Payment Rail Record</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Payment Rail</label>
            <select aria-label="Payment rail" value={form.rail}
              onChange={(e) => setForm((f) => ({ ...f, rail: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
              <option value="mpesa">M-PESA</option>
              <option value="pesalink">PesaLink</option>
              <option value="paystack">Paystack</option>
              <option value="pesapal">Pesapal</option>
              <option value="stablecoin">Stablecoin</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">External Reference</label>
            <input type="text" placeholder="MPE240301001" value={form.externalRef}
              onChange={(e) => setForm((f) => ({ ...f, externalRef: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Direction</label>
            <select aria-label="Transaction direction" value={form.direction}
              onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
              <option value="inbound">Inbound (deposit)</option>
              <option value="outbound">Outbound (withdrawal)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Amount</label>
              <input type="number" min="1" placeholder="0.00" value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Currency</label>
              <select aria-label="Currency" value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
                <option value="KES">KES</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Phone / Account (optional)</label>
            <input type="text" placeholder="+254712345678" value={form.phoneOrAccount}
              onChange={(e) => setForm((f) => ({ ...f, phoneOrAccount: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 border border-border rounded-md px-4 py-2 text-sm hover:bg-muted/50">Cancel</button>
            <button onClick={handle} disabled={!form.externalRef || !form.amount || loading}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#0A2A2A" }}>
              {loading ? "Importing..." : "Import Record"}
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
  // Existing state
  const [pools, setPools] = useState<Pool[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [showCreateEscrow, setShowCreateEscrow] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [filterType, setFilterType] = useState("");
  const [escrowFilter, setEscrowFilter] = useState("");
  // New state
  const [railTxns, setRailTxns] = useState<RailTxn[]>([]);
  const [reconSummary, setReconSummary] = useState<ReconSummary | null>(null);
  const [railFilter, setRailFilter] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [alertStatusFilter, setAlertStatusFilter] = useState("open");
  const [alertSeverityFilter, setAlertSeverityFilter] = useState("");
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [distSummary, setDistSummary] = useState<DistSummary | null>(null);
  const [distFilter, setDistFilter] = useState("");

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [poolsRes, ledgerRes, escrowsRes, reconRes, railTxnRes, reconSumRes, alertsRes, alertSumRes, distRes, distSumRes] = await Promise.all([
        fetch(`${BASE}/api/liquidity-pools`, { headers: AUTH }),
        fetch(`${BASE}/api/ledger?limit=60`, { headers: AUTH }),
        fetch(`${BASE}/api/escrow`, { headers: AUTH }),
        fetch(`${BASE}/api/ledger/reconciliation`, { headers: AUTH }),
        fetch(`${BASE}/api/reconciliation?limit=50`, { headers: AUTH }),
        fetch(`${BASE}/api/reconciliation/summary`, { headers: AUTH }),
        fetch(`${BASE}/api/fraud-alerts?limit=50`, { headers: AUTH }),
        fetch(`${BASE}/api/fraud-alerts/summary`, { headers: AUTH }),
        fetch(`${BASE}/api/investor-distributions?limit=50`, { headers: AUTH }),
        fetch(`${BASE}/api/investor-distributions/summary`, { headers: AUTH }),
      ]);
      if (poolsRes.ok) { const d = await poolsRes.json(); setPools(d.pools); }
      if (ledgerRes.ok) { const d = await ledgerRes.json(); setLedger(d.entries); setLedgerTotal(d.total); }
      if (escrowsRes.ok) { const d = await escrowsRes.json(); setEscrows(d.escrows); }
      if (reconRes.ok) { setReconciliation(await reconRes.json()); }
      if (railTxnRes.ok) { const d = await railTxnRes.json(); setRailTxns(d.transactions); }
      if (reconSumRes.ok) { setReconSummary(await reconSumRes.json()); }
      if (alertsRes.ok) { const d = await alertsRes.json(); setFraudAlerts(d.alerts); }
      if (alertSumRes.ok) { setAlertSummary(await alertSumRes.json()); }
      if (distRes.ok) { const d = await distRes.json(); setDistributions(d.distributions); }
      if (distSumRes.ok) { setDistSummary(await distSumRes.json()); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleEscrowAction = async (id: string, action: "fund" | "release" | "cancel") => {
    const r = await fetch(`${BASE}/api/escrow/${id}/${action}`, { method: "POST", headers: JSON_H });
    const d = await r.json();
    if (r.ok) { showToast(d.message); loadAll(); }
    else showToast(d.error, false);
  };

  const handleAlertAction = async (id: string, action: "resolve" | "dismiss" | "escalate") => {
    const r = await fetch(`${BASE}/api/fraud-alerts/${id}/${action}`, {
      method: "POST", headers: JSON_H,
      body: JSON.stringify({ resolvedBy: "admin-001", note: `${action}d via Finance Engine` }),
    });
    if (r.ok) { showToast(`Alert ${action}d`); loadAll(); }
    else showToast("Action failed", false);
  };

  const handleRailAction = async (id: string, action: "dismiss" | "discrepancy") => {
    const r = await fetch(`${BASE}/api/reconciliation/${id}/${action}`, {
      method: "POST", headers: JSON_H,
      body: JSON.stringify({ note: "Flagged via Finance Engine admin" }),
    });
    if (r.ok) { showToast(action === "dismiss" ? "Transaction dismissed" : "Discrepancy flagged"); loadAll(); }
    else showToast("Action failed", false);
  };

  const handlePayDist = async (id: string) => {
    const r = await fetch(`${BASE}/api/investor-distributions/${id}/pay`, { method: "POST", headers: JSON_H });
    if (r.ok) { showToast("Distribution marked as paid"); loadAll(); }
    else showToast("Action failed", false);
  };

  // Computed
  const filteredLedger = filterType ? ledger.filter((e) => e.entryType === filterType) : ledger;
  const filteredEscrows = escrowFilter ? escrows.filter((e) => e.status === escrowFilter) : escrows;
  const filteredRailTxns = railFilter ? railTxns.filter((t) => t.status === railFilter) : railTxns;
  const filteredAlerts = fraudAlerts.filter((a) => {
    if (alertStatusFilter && a.status !== alertStatusFilter) return false;
    if (alertSeverityFilter && a.severity !== alertSeverityFilter) return false;
    return true;
  });
  const filteredDist = distFilter ? distributions.filter((d) => d.status === distFilter) : distributions;

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

      {/* Modals */}
      {showCreateEscrow && <CreateEscrowModal onClose={() => setShowCreateEscrow(false)} onDone={() => { loadAll(); showToast("Escrow created"); }} />}
      {selectedPool && <PoolModal pool={selectedPool} onClose={() => setSelectedPool(null)} onDone={loadAll} />}
      {showImportModal && <ImportRailModal onClose={() => setShowImportModal(false)} onDone={() => { loadAll(); showToast("Record imported"); }} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#0A2A2A" }}>
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Finance Engine</h1>
            <p className="text-xs text-muted-foreground">Treasury · Reconciliation · Escrow · Ledger · Monitoring</p>
          </div>
        </div>
        <button onClick={loadAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-3 py-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Status Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {reconciliation && (
          <div className={cn("flex items-center gap-3 px-4 py-3 rounded-lg text-sm border",
            reconciliation.systemBalanced ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800")}>
            {reconciliation.systemBalanced ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span className="font-medium text-xs">
              {reconciliation.systemBalanced
                ? `Ledger balanced — ${reconciliation.totalEntries} entries`
                : `Imbalance — KES Δ${reconciliation.kes.difference}`}
            </span>
          </div>
        )}
        {alertSummary && alertSummary.open > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm border bg-amber-50 border-amber-200 text-amber-800">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="font-medium text-xs">
              {alertSummary.open} open fraud alert{alertSummary.open !== 1 ? "s" : ""}
              {alertSummary.bySeverity.critical > 0 && ` · ${alertSummary.bySeverity.critical} critical`}
            </span>
          </div>
        )}
        {reconSummary && (
          <div className={cn("flex items-center gap-3 px-4 py-3 rounded-lg text-sm border",
            reconSummary.unmatched > 0 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-green-50 border-green-200 text-green-800")}>
            <GitMerge className="w-4 h-4 shrink-0" />
            <span className="font-medium text-xs">
              Reconciliation {reconSummary.matchRate}% matched — {reconSummary.unmatched} unmatched, {reconSummary.discrepancy} discrepanc{reconSummary.discrepancy !== 1 ? "ies" : "y"}
            </span>
          </div>
        )}
        {distSummary && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm border bg-blue-50 border-blue-200 text-blue-800">
            <Users className="w-4 h-4 shrink-0" />
            <span className="font-medium text-xs">
              KES {fmt(distSummary.totalDistributed)} distributed to investors · KES {fmt(distSummary.pendingAmount)} pending
            </span>
          </div>
        )}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-0.5 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
              activeTab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted")}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.id === "monitoring" && alertSummary && alertSummary.open > 0 && (
              <span className="ml-1 text-[9px] bg-red-500 text-white rounded-full px-1 py-0.5 leading-none">{alertSummary.open}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Internal Accounts ───────────────────────────────────────────────── */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <SectionHeader title="Platform Internal Account Structure"
            sub="TokenHarvest's fintech-grade internal financial hierarchy — treasury, pools, escrow, settlement, and fee accounts" />
          <Card className="p-5 border border-border/60">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Account Hierarchy</h3>
            <div className="flex items-start gap-6 overflow-x-auto pb-2">
              {[
                { label: "Platform Treasury", desc: "Master accounts holding all platform capital", color: "bg-amber-600", items: ["Treasury (KES)", "Treasury (USDC)"] },
                { label: "Liquidity Pools", desc: "Capital pools funding loans and trades", color: "bg-blue-600", items: ["Loan Financing Pool", "Trading Settlement Pool", "Stablecoin Pool"] },
                { label: "Operational Accounts", desc: "Escrow, settlement, and fee collection", color: "bg-green-700", items: ["Escrow Engine", "Settlement Account", "Fee Collection"] },
                { label: "User Wallets", desc: "Individual farmer, trader, lender wallets", color: "bg-slate-600", items: ["KES Wallet", "USDC Wallet"] },
              ].map((tier, i) => (
                <div key={i} className="flex-1 min-w-[160px]">
                  <div className={cn("text-[10px] font-bold text-white px-2 py-1 rounded-t-md", tier.color)}>{tier.label}</div>
                  <div className="border border-t-0 rounded-b-md p-2 space-y-1">
                    <p className="text-[10px] text-muted-foreground mb-2">{tier.desc}</p>
                    {tier.items.map((item) => <div key={item} className="text-[10px] bg-muted/40 rounded px-2 py-1 font-medium">{item}</div>)}
                  </div>
                  {i < 3 && <div className="text-center mt-2 text-muted-foreground"><ChevronRight className="w-4 h-4 rotate-90 mx-auto" /></div>}
                </div>
              ))}
            </div>
          </Card>
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

      {/* ── Liquidity Pools ─────────────────────────────────────────────────── */}
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
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Utilization</span><span>{pool.utilizationPct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, utilPct)}%`, backgroundColor: utilPct > 80 ? "#ef4444" : utilPct > 60 ? "#f59e0b" : "#22c55e" }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><div className="text-[10px] text-muted-foreground">Total Deposited</div><div className="font-medium">{pool.currency} {fmt(pool.totalDeposited)}</div></div>
                        <div><div className="text-[10px] text-muted-foreground">Total Withdrawn</div><div className="font-medium">{pool.currency} {fmt(pool.totalWithdrawn)}</div></div>
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

          {/* Investor Distributions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Investor Distributions</h3>
                <p className="text-xs text-muted-foreground">Returns distributed to pool investors from loan repayments</p>
              </div>
              <div className="flex items-center gap-2">
                <select aria-label="Filter distribution status" value={distFilter}
                  onChange={(e) => setDistFilter(e.target.value)}
                  className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
            {distSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <StatCard label="Total Distributed" value={`KES ${fmt(distSummary.totalDistributed)}`} sub={`${distSummary.paidCount} payments`} color="text-green-700" />
                <StatCard label="Pending Payout" value={`KES ${fmt(distSummary.pendingAmount)}`} sub={`${distSummary.pendingCount} pending`} color="text-amber-700" />
                <StatCard label="Gross Distributed" value={`KES ${fmt(distSummary.totalGross)}`} sub="Before platform fees" />
                <StatCard label="Platform Fees" value={`KES ${fmt(distSummary.totalFees)}`} sub="5% management fee" color="text-blue-700" />
              </div>
            )}
            {loading ? (
              <div className="h-40 bg-muted/30 rounded-xl animate-pulse" />
            ) : filteredDist.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm text-muted-foreground">No distributions found.</p>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b bg-muted/30">
                      <th className="px-4 py-2.5 font-medium">Investor</th>
                      <th className="px-4 py-2.5 font-medium">Pool</th>
                      <th className="px-4 py-2.5 font-medium">Period</th>
                      <th className="px-4 py-2.5 font-medium text-right">Net Amount</th>
                      <th className="px-4 py-2.5 font-medium">Yield</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDist.map((d) => (
                      <tr key={d.id} className="border-b hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{d.investorName ?? d.investorId}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{d.investorId}</div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {d.poolId === "LP-LOAN-KES" ? "Loan Pool" : d.poolId === "LP-TRADING-KES" ? "Trading Pool" : "USDC Pool"}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{d.period}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-green-700">
                          {d.currency} {fmt(d.netAmount)}
                          <div className="text-[10px] text-muted-foreground font-normal">of {d.currency} {fmt(d.grossAmount)} gross</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {d.yieldRate && (
                            <span className="flex items-center gap-1 text-blue-700 font-medium">
                              <BadgePercent className="w-3 h-3" />{d.yieldRate}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", DIST_STATUS[d.status])}>
                            {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {d.status === "pending" && (
                            <button onClick={() => handlePayDist(d.id)}
                              className="text-[10px] font-medium px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 border border-green-200">
                              Mark Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>

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

      {/* ── Escrow Engine ───────────────────────────────────────────────────── */}
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
                    <step.icon className="w-3.5 h-3.5" />{step.label}
                  </div>
                  {i < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </Card>
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

      {/* ── Ledger Audit ────────────────────────────────────────────────────── */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          <SectionHeader title="Double-Entry Ledger Journal"
            sub="Every financial event creates a matching debit + credit pair. The system must always balance." />
          {reconciliation && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "KES Ledger", debits: reconciliation.kes.totalDebits, credits: reconciliation.kes.totalCredits, balanced: reconciliation.kes.balanced, currency: "KES" },
                { label: "USDC Ledger", debits: reconciliation.usdc.totalDebits, credits: reconciliation.usdc.totalCredits, balanced: reconciliation.usdc.balanced, currency: "USDC" },
              ].map((item) => (
                <Card key={item.label} className={cn("p-4 border", item.balanced ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30")}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">{item.label}</span>
                    <StatusDot ok={item.balanced} label={item.balanced ? "Balanced" : "Imbalanced"} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><div className="text-[10px] text-muted-foreground">Total Debits</div><div className="font-semibold text-red-600">{item.currency} {fmt(item.debits)}</div></div>
                    <div><div className="text-[10px] text-muted-foreground">Total Credits</div><div className="font-semibold text-green-600">{item.currency} {fmt(item.credits)}</div></div>
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
              <p className="text-sm text-muted-foreground">No ledger entries yet.</p>
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
                        <tr key={entry.id} className={cn("border-b transition-colors hover:bg-muted/10", ei === 0 && gi > 0 ? "border-t-2 border-muted" : "")}>
                          <td className="px-4 py-2 font-mono text-muted-foreground">{ei === 0 ? entry.txnGroupId : ""}</td>
                          <td className="px-4 py-2">
                            <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                              entry.entryType === "debit" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700")}>
                              {entry.entryType === "debit" ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                              {entry.entryType.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-2"><div className="font-medium">{entry.accountLabel}</div><div className="text-[10px] text-muted-foreground">{entry.accountType.replace("_", " ")}</div></td>
                          <td className={cn("px-4 py-2 text-right font-semibold", entry.entryType === "debit" ? "text-red-700" : "text-green-700")}>
                            {entry.currency} {fmt(entry.amount)}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">{entry.description ?? "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                            {new Date(entry.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                            <div className="text-[10px]">{new Date(entry.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</div>
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

      {/* ── Treasury ────────────────────────────────────────────────────────── */}
      {activeTab === "treasury" && (
        <div className="space-y-4">
          <SectionHeader title="Treasury Management"
            sub="Platform revenue collection, sub-account structure, and capital allocation across operating, reserve, and revenue accounts" />

          {/* Treasury Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Treasury (KES)" value="KES 86.35M" sub="Operating + Reserve + Revenue" color="text-amber-700" />
            <StatCard label="Operating Account" value="KES 12.5M" sub="Day-to-day expenses" />
            <StatCard label="Reserve Account" value="KES 20.0M" sub="6-month emergency runway" color="text-blue-700" />
            <StatCard label="Revenue Collected" value="KES 3.85M" sub="YTD platform fees" color="text-green-700" />
          </div>

          {/* Treasury Sub-Accounts */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Treasury Sub-Account Structure</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: "PA-OPERATING-KES", name: "Operating Account", balance: "12,500,000.00", currency: "KES",
                  icon: Activity, color: "border-blue-200 bg-blue-50/50",
                  desc: "Day-to-day operational expenses: salaries, infrastructure, vendor payments",
                  breakdown: [{ label: "Staff Salaries", pct: 45, color: "bg-blue-500" }, { label: "Infrastructure", pct: 30, color: "bg-blue-400" }, { label: "Vendors", pct: 25, color: "bg-blue-300" }],
                },
                {
                  id: "PA-RESERVE-KES", name: "Reserve Account", balance: "20,000,000.00", currency: "KES",
                  icon: ShieldCheck, color: "border-amber-200 bg-amber-50/50",
                  desc: "Emergency reserve — minimum 6-month operating runway requirement",
                  breakdown: [{ label: "Liquidity Buffer", pct: 60, color: "bg-amber-500" }, { label: "Contingency", pct: 40, color: "bg-amber-400" }],
                },
                {
                  id: "PA-REVENUE-KES", name: "Revenue Account", balance: "3,847,500.00", currency: "KES",
                  icon: TrendingUp, color: "border-green-200 bg-green-50/50",
                  desc: "Accumulated platform revenue: trading commissions, loan origination, service fees",
                  breakdown: [{ label: "Trading Fees", pct: 52, color: "bg-green-500" }, { label: "Loan Origination", pct: 30, color: "bg-green-400" }, { label: "Service Fees", pct: 18, color: "bg-green-300" }],
                },
              ].map((acc) => {
                const Icon = acc.icon;
                return (
                  <div key={acc.id} className={cn("rounded-xl border p-4 space-y-3", acc.color)}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 opacity-70" />
                      <span className="text-xs font-bold">{acc.name}</span>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Balance</div>
                      <div className="text-lg font-bold">{acc.currency} {acc.balance}</div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{acc.desc}</p>
                    <div className="space-y-1.5">
                      {acc.breakdown.map((b) => (
                        <div key={b.label}>
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span className="text-muted-foreground">{b.label}</span>
                            <span className="font-medium">{b.pct}%</span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", b.color)} style={{ width: `${b.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Revenue Breakdown by Source */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-1">Revenue Sources (YTD)</h3>
            <p className="text-xs text-muted-foreground mb-4">Platform revenue streams contributing to the Revenue Account</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { source: "Trading Commissions", amount: "2,000,500", pct: "52%", icon: ArrowLeftRight, color: "text-green-700 bg-green-50 border-green-200", desc: "1.5% on every commodity trade" },
                { source: "Loan Origination", amount: "1,153,500", pct: "30%", icon: Banknote, color: "text-blue-700 bg-blue-50 border-blue-200", desc: "2% origination fee on loans disbursed" },
                { source: "Platform Service Fees", amount: "462,750", pct: "12%", icon: Zap, color: "text-purple-700 bg-purple-50 border-purple-200", desc: "Subscription, KYC, and API fees" },
                { source: "Interest Margin", amount: "230,750", pct: "6%", icon: BadgePercent, color: "text-amber-700 bg-amber-50 border-amber-200", desc: "Spread between pool rate and loan rate" },
              ].map((rev) => {
                const Icon = rev.icon;
                return (
                  <div key={rev.source} className={cn("rounded-xl border p-4 space-y-2", rev.color)}>
                    <div className="flex items-center justify-between">
                      <Icon className="w-4 h-4 opacity-70" />
                      <span className="text-xs font-bold">{rev.pct}</span>
                    </div>
                    <div className="text-xs font-bold">{rev.source}</div>
                    <div className="text-sm font-bold">KES {rev.amount}</div>
                    <div className="text-[10px] opacity-70">{rev.desc}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Capital Allocation Flow */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Capital Allocation Flow</h3>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: "Revenue Collected", desc: "Fees & commissions", color: "bg-green-100 text-green-800" },
                { label: "Fee Account", desc: "PA-FEE-KES", color: "bg-orange-100 text-orange-800" },
                { label: "Treasury Split", desc: "Operating / Reserve / Revenue", color: "bg-amber-100 text-amber-800" },
                { label: "Pool Allocation", desc: "Boosts lending capacity", color: "bg-blue-100 text-blue-800" },
                { label: "Investor Returns", desc: "Pool yield distribution", color: "bg-purple-100 text-purple-800" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={cn("px-3 py-1.5 rounded-lg text-xs font-medium", step.color)}>
                    <div className="font-semibold">{step.label}</div>
                    <div className="text-[10px] opacity-70">{step.desc}</div>
                  </div>
                  {i < 4 && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Reconciliation ──────────────────────────────────────────────────── */}
      {activeTab === "reconciliation" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader title="Payment Rail Reconciliation"
              sub="Match platform ledger entries against external payment rails — M-PESA, PesaLink, Paystack, Pesapal, Stablecoin" />
            <button onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white"
              style={{ backgroundColor: "#0A2A2A" }}>
              <ArrowDownToLine className="w-3.5 h-3.5" /> Import Record
            </button>
          </div>

          {/* Summary Stats */}
          {reconSummary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Match Rate" value={`${reconSummary.matchRate}%`}
                sub={`${reconSummary.matched} of ${reconSummary.total}`}
                color={Number(reconSummary.matchRate) >= 80 ? "text-green-700" : "text-amber-700"} />
              <StatCard label="Total Records" value={String(reconSummary.total)} sub="Across all rails" />
              <StatCard label="Matched" value={String(reconSummary.matched)} sub="Confirmed" color="text-green-700" />
              <StatCard label="Unmatched" value={String(reconSummary.unmatched)} sub="Needs attention" color="text-amber-700" />
              <StatCard label="Discrepancies" value={String(reconSummary.discrepancy)} sub="Amount mismatch" color="text-red-700" />
            </div>
          )}

          {/* By Rail */}
          {reconSummary && (
            <Card className="p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status by Payment Rail</h3>
              <div className="flex flex-wrap gap-3">
                {reconSummary.byRail.map((r) => {
                  const Icon = RAIL_ICONS[r.rail] ?? Wifi;
                  const matchPct = r.total === "0" ? 0 : Math.round((Number(r.matched) / Number(r.total)) * 100);
                  return (
                    <div key={r.rail} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs min-w-[140px]", RAIL_COLORS[r.rail])}>
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <div>
                        <div className="font-bold capitalize">{r.rail}</div>
                        <div className="text-[10px] opacity-70">{r.matched}/{r.total} matched · {matchPct}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Filter + Table */}
          <div className="flex items-center gap-3">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select aria-label="Filter rail transaction status" value={railFilter}
              onChange={(e) => setRailFilter(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
              <option value="">All Records</option>
              <option value="unmatched">Unmatched</option>
              <option value="matched">Matched</option>
              <option value="discrepancy">Discrepancy</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{filteredRailTxns.length} record{filteredRailTxns.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="h-40 bg-muted/30 rounded-xl animate-pulse" />
          ) : filteredRailTxns.length === 0 ? (
            <Card className="p-10 text-center">
              <GitMerge className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm text-muted-foreground">No payment rail records. Import external payment data to begin reconciliation.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b bg-muted/30">
                    <th className="px-4 py-2.5 font-medium">Rail</th>
                    <th className="px-4 py-2.5 font-medium">External Ref</th>
                    <th className="px-4 py-2.5 font-medium">Direction</th>
                    <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Phone / Account</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRailTxns.map((txn) => {
                    const Icon = RAIL_ICONS[txn.rail] ?? Wifi;
                    return (
                      <tr key={txn.id} className="border-b hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border", RAIL_COLORS[txn.rail])}>
                            <Icon className="w-3 h-3" />{txn.rail}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground text-[10px]">{txn.externalRef}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded",
                            txn.direction === "inbound" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                            {txn.direction}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {txn.currency} {fmt(txn.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-[10px]">{txn.phoneOrAccount ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", RAIL_TXN_STATUS[txn.status])}>
                            {txn.status}
                          </span>
                          {txn.discrepancyNote && (
                            <div className="text-[9px] text-red-600 mt-0.5 max-w-[150px] truncate" title={txn.discrepancyNote}>
                              ⚠ {txn.discrepancyNote}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(txn.importedAt)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            {txn.status === "unmatched" && (
                              <button onClick={() => handleRailAction(txn.id, "discrepancy")}
                                className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200">
                                Flag
                              </button>
                            )}
                            {["unmatched", "discrepancy"].includes(txn.status) && (
                              <button onClick={() => handleRailAction(txn.id, "dismiss")}
                                className="text-[10px] px-2 py-0.5 rounded bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200">
                                Dismiss
                              </button>
                            )}
                            {txn.status === "matched" && (
                              <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" /> Matched
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ── Monitoring ──────────────────────────────────────────────────────── */}
      {activeTab === "monitoring" && (
        <div className="space-y-4">
          <SectionHeader title="Fraud & Risk Monitoring"
            sub="Real-time transaction surveillance — large withdrawals, velocity breaches, suspicious patterns, and account anomalies" />

          {/* Summary */}
          {alertSummary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label="Open Alerts" value={String(alertSummary.open)} sub="Needs review" color="text-red-700" />
                <StatCard label="Investigating" value={String(alertSummary.investigating)} sub="In progress" color="text-amber-700" />
                <StatCard label="Resolved" value={String(alertSummary.resolved)} sub="Closed safely" color="text-green-700" />
                <StatCard label="Dismissed" value={String(alertSummary.dismissed)} sub="False positives" />
                <StatCard label="Total Alerts" value={String(alertSummary.total)} sub="All time" />
              </div>
              <Card className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Severity Distribution</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { level: "critical", count: alertSummary.bySeverity.critical, color: "border-red-400 bg-red-100 text-red-900" },
                    { level: "high", count: alertSummary.bySeverity.high, color: "border-red-200 bg-red-50 text-red-700" },
                    { level: "medium", count: alertSummary.bySeverity.medium, color: "border-amber-200 bg-amber-50 text-amber-700" },
                    { level: "low", count: alertSummary.bySeverity.low, color: "border-blue-200 bg-blue-50 text-blue-700" },
                  ].map((s) => (
                    <div key={s.level} className={cn("flex items-center gap-2 rounded-lg border px-4 py-2 font-medium", s.color)}>
                      <span className="text-lg font-bold">{s.count}</span>
                      <span className="text-xs capitalize">{s.level}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select aria-label="Filter alert status" value={alertStatusFilter}
              onChange={(e) => setAlertStatusFilter(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <select aria-label="Filter alert severity" value={alertSeverityFilter}
              onChange={(e) => setAlertSeverityFilter(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{filteredAlerts.length} alert{filteredAlerts.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Alert List */}
          {loading ? (
            <div className="h-40 bg-muted/30 rounded-xl animate-pulse" />
          ) : filteredAlerts.length === 0 ? (
            <Card className="p-10 text-center">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm text-muted-foreground">No alerts match your filter. System is clean.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredAlerts.map((alert) => (
                <Card key={alert.id} className={cn("p-4 border-l-4",
                  alert.severity === "critical" ? "border-l-red-600" :
                  alert.severity === "high" ? "border-l-red-400" :
                  alert.severity === "medium" ? "border-l-amber-400" : "border-l-blue-400")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide", SEVERITY_COLORS[alert.severity])}>
                          {alert.severity}
                        </span>
                        <span className="text-xs font-semibold">{ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}</span>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", ALERT_STATUS_COLORS[alert.status])}>
                          {alert.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{alert.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        {alert.amount && <span className="font-medium text-foreground">{alert.currency} {fmt(alert.amount)}</span>}
                        {alert.transactionRef && <span className="font-mono">ref: {alert.transactionRef}</span>}
                        <span>{fmtDate(alert.createdAt)}</span>
                        {alert.resolvedAt && <span className="text-green-600">Resolved: {fmtDate(alert.resolvedAt)}</span>}
                      </div>
                      {alert.resolutionNote && (
                        <div className="mt-2 text-[10px] px-2 py-1.5 bg-green-50 border border-green-200 rounded text-green-700">
                          Resolution: {alert.resolutionNote}
                        </div>
                      )}
                    </div>
                    {["open", "investigating"].includes(alert.status) && (
                      <div className="flex flex-col gap-1 shrink-0">
                        {alert.status === "open" && (
                          <button onClick={() => handleAlertAction(alert.id, "escalate")}
                            className="text-[10px] font-medium px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 whitespace-nowrap">
                            Investigate
                          </button>
                        )}
                        <button onClick={() => handleAlertAction(alert.id, "resolve")}
                          className="text-[10px] font-medium px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 whitespace-nowrap">
                          Resolve
                        </button>
                        <button onClick={() => handleAlertAction(alert.id, "dismiss")}
                          className="text-[10px] font-medium px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 whitespace-nowrap">
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
