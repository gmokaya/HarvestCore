import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  RefreshCw, TrendingUp, TrendingDown, Lock, Banknote,
  CircleDollarSign, CheckCircle2, Clock, XCircle, Filter,
  ChevronRight, AlertTriangle,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const AUTH = { Authorization: "Bearer mock-token-admin-001" };
const JSON_H = { ...AUTH, "Content-Type": "application/json" };

const DEMO_USER = "admin-001";

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: string | number) {
  return Number(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TX_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  loan_disbursement: "Loan Disbursement",
  loan_repayment: "Loan Repayment",
  trade_settlement: "Trade Settlement",
  escrow_lock: "Escrow Lock",
  escrow_release: "Escrow Release",
  transfer_in: "Received",
  transfer_out: "Sent",
  fee: "Platform Fee",
};

const TX_COLORS: Record<string, string> = {
  deposit:          "text-[#0a2a2a] bg-[#c7d7da]/40",
  withdrawal:       "text-[#a6a6a6] bg-[#a6a6a6]/10",
  loan_disbursement:"text-[#0a2a2a] bg-[#c7d7da]/30",
  loan_repayment:   "text-[#a6a6a6] bg-[#a6a6a6]/10",
  trade_settlement: "text-[#0a2a2a] bg-[#c7d7da]/20",
  escrow_lock:      "text-[#a6a6a6] bg-[#a6a6a6]/10",
  escrow_release:   "text-[#0a2a2a] bg-[#c7d7da]/30",
  transfer_in:      "text-[#0a2a2a] bg-[#c7d7da]/40",
  transfer_out:     "text-[#a6a6a6] bg-[#a6a6a6]/10",
  fee:              "text-[#a6a6a6] bg-[#a6a6a6]/10",
};

const CREDIT_TYPES = new Set(["deposit", "loan_disbursement", "trade_settlement", "escrow_release", "transfer_in"]);

const RAIL_LABELS: Record<string, string> = {
  mpesa: "M-PESA", pesalink: "PesaLink", paystack: "Paystack",
  pesapal: "Pesapal", stablecoin: "Stablecoin", internal: "Internal",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type WalletInfo = { id: string | null; balance: string; lockedBalance: string; status: string };
type Wallets = { userId: string; kes: WalletInfo; usdc: WalletInfo };
type Tx = {
  id: string; type: string; amount: string; balanceBefore: string; balanceAfter: string;
  currency: string; status: string; railProvider: string; reference: string | null;
  description: string | null; relatedEntityId: string | null; relatedEntityType: string | null;
  createdAt: string;
};

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, React.ElementType]> = {
    completed: ["text-[#0a2a2a] bg-[#c7d7da]/50",  CheckCircle2],
    pending:   ["text-[#a6a6a6] bg-[#a6a6a6]/10",  Clock],
    failed:    ["text-[#a6a6a6] bg-[#a6a6a6]/10",  XCircle],
    reversed:  ["text-[#a6a6a6] bg-[#a6a6a6]/10",  AlertTriangle],
  };
  const [cls, Icon] = map[status] ?? ["text-slate-600 bg-slate-50", Clock];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded", cls)}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WalletPage() {
  const [wallets, setWallets] = useState<Wallets | null>(null);
  const [txns, setTxns] = useState<Tx[]>([]);
  const [totalTxns, setTotalTxns] = useState(0);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "transactions">("overview");
  const [modal, setModal] = useState<"deposit" | "withdraw" | "transfer" | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");

  // Modal form state
  const [form, setForm] = useState({ amount: "", currency: "KES", railProvider: "mpesa", toUserId: "", reference: "", description: "" });

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const loadWallets = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/wallet/${DEMO_USER}`, { headers: AUTH });
      if (r.ok) setWallets(await r.json());
    } finally { setLoading(false); }
  }, []);

  const loadTxns = useCallback(async () => {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (filterCurrency) params.set("currency", filterCurrency);
      const r = await fetch(`${BASE}/api/wallet/transactions/${DEMO_USER}?${params}`, { headers: AUTH });
      if (r.ok) {
        const d = await r.json();
        setTxns(d.transactions);
        setTotalTxns(d.total);
      }
    } finally { setTxLoading(false); }
  }, [filterType, filterStatus, filterCurrency]);

  useEffect(() => { loadWallets(); }, [loadWallets]);
  useEffect(() => { loadTxns(); }, [loadTxns]);

  const resetForm = () => setForm({ amount: "", currency: "KES", railProvider: "mpesa", toUserId: "", reference: "", description: "" });

  const handleDeposit = async () => {
    const r = await fetch(`${BASE}/api/wallet/deposit`, {
      method: "POST", headers: JSON_H,
      body: JSON.stringify({ userId: DEMO_USER, amount: Number(form.amount), currency: form.currency, railProvider: form.railProvider, reference: form.reference || undefined }),
    });
    const d = await r.json();
    if (r.ok) { showToast(d.message); setModal(null); resetForm(); loadWallets(); loadTxns(); }
    else showToast(d.error, false);
  };

  const handleWithdraw = async () => {
    const r = await fetch(`${BASE}/api/wallet/withdraw`, {
      method: "POST", headers: JSON_H,
      body: JSON.stringify({ userId: DEMO_USER, amount: Number(form.amount), currency: form.currency, railProvider: form.railProvider, reference: form.reference || undefined }),
    });
    const d = await r.json();
    if (r.ok) { showToast(d.message); setModal(null); resetForm(); loadWallets(); loadTxns(); }
    else showToast(d.error, false);
  };

  const handleTransfer = async () => {
    const r = await fetch(`${BASE}/api/wallet/transfer`, {
      method: "POST", headers: JSON_H,
      body: JSON.stringify({ fromUserId: DEMO_USER, toUserId: form.toUserId, amount: Number(form.amount), currency: form.currency, description: form.description || undefined }),
    });
    const d = await r.json();
    if (r.ok) { showToast(d.message); setModal(null); resetForm(); loadWallets(); loadTxns(); }
    else showToast(d.error, false);
  };

  const kes = wallets?.kes;
  const usdc = wallets?.usdc;
  const kesTotal = kes ? Number(kes.balance) + Number(kes.lockedBalance) : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={cn("fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all",
          toast.ok ? "bg-green-600" : "bg-red-600")}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallet & Payments</h1>
          <p className="text-sm text-muted-foreground">Multi-currency wallet · KES & USDC · M-PESA · PesaLink</p>
        </div>
        <button onClick={() => { loadWallets(); loadTxns(); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-3 py-1.5 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Wallet Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-36 bg-muted/40 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KES Card */}
          <Card className="p-5 space-y-3 border-0 shadow-sm" style={{ background: "linear-gradient(135deg, #0A2A2A 0%, #1a4a4a 100%)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-white/70" />
                <span className="text-xs font-medium text-white/70">KES Wallet</span>
              </div>
              <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-white/15 text-white/90">
                {kes?.status ?? "active"}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">KES {fmt(kes?.balance ?? "0")}</div>
              <div className="text-xs text-white/50 mt-0.5">Available balance</div>
            </div>
            <div className="flex items-center gap-4 pt-1 border-t border-white/10">
              <div>
                <div className="text-xs text-white/40">Locked</div>
                <div className="text-xs font-medium text-white/70">KES {fmt(kes?.lockedBalance ?? "0")}</div>
              </div>
              <div>
                <div className="text-xs text-white/40">Total</div>
                <div className="text-xs font-medium text-white/70">KES {fmt(kesTotal)}</div>
              </div>
            </div>
          </Card>

          {/* USDC Card */}
          <Card className="p-5 space-y-3 border border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="w-4 h-4 text-[#0a2a2a]" />
                <span className="text-xs font-medium text-muted-foreground">USDC Wallet</span>
              </div>
              <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-[#c7d7da]/40 text-[#0a2a2a]">Stablecoin</span>
            </div>
            <div>
              <div className="text-2xl font-bold">USDC {fmt(usdc?.balance ?? "0")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Available balance</div>
            </div>
            <div className="flex items-center gap-4 pt-1 border-t">
              <div>
                <div className="text-xs text-muted-foreground">Locked</div>
                <div className="text-xs font-medium">USDC {fmt(usdc?.lockedBalance ?? "0")}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">For DeFi/cross-border</div>
              </div>
            </div>
          </Card>

          {/* Locked Collateral */}
          <Card className="p-5 space-y-3 border border-[#c7d7da] bg-[#c7d7da]/10">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#0a2a2a]" />
              <span className="text-xs font-medium text-[#0a2a2a]">Locked / Collateral</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0a2a2a]">KES {fmt(kes?.lockedBalance ?? "0")}</div>
              <div className="text-xs text-[#a6a6a6] mt-0.5">Reserved for active loans & escrow</div>
            </div>
            <div className="pt-1 border-t border-[#c7d7da]">
              <div className="text-xs text-[#a6a6a6]">Funds release automatically on loan repayment or contract settlement</div>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { resetForm(); setModal("deposit"); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: "#0A2A2A" }}>
          <ArrowDownToLine className="w-4 h-4" /> Deposit
        </button>
        <button onClick={() => { resetForm(); setModal("withdraw"); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background hover:bg-muted/50 transition-colors">
          <ArrowUpFromLine className="w-4 h-4" /> Withdraw
        </button>
        <button onClick={() => { resetForm(); setModal("transfer"); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background hover:bg-muted/50 transition-colors">
          <ArrowLeftRight className="w-4 h-4" /> Send Money
        </button>
        <div className="ml-auto flex items-center gap-1">
          {(["overview", "transactions"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeTab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
              {t === "overview" ? "Overview" : "All Transactions"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === "overview" ? (
        <div className="space-y-4">
          {/* Payment Rails */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Connected Payment Rails</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { name: "M-PESA", desc: "Mobile money" },
                { name: "PesaLink", desc: "Bank transfer" },
                { name: "Paystack", desc: "Card payments" },
                { name: "Pesapal", desc: "Bulk settlement" },
                { name: "Stablecoin", desc: "USDC/USDT" },
              ].map((rail) => (
                <div key={rail.name} className="rounded-lg p-3 border border-[#c7d7da] bg-[#c7d7da]/15 text-[#0a2a2a]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0a2a2a]" />
                    <span className="text-xs font-semibold">{rail.name}</span>
                  </div>
                  <p className="text-xs opacity-70">{rail.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Transaction Limits */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4">Transaction Limits</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Daily Withdrawal", limit: "KES 500,000", icon: ArrowUpFromLine },
                { label: "Single Transfer", limit: "KES 200,000", icon: ArrowLeftRight },
                { label: "Daily USDC Withdrawal", limit: "USDC 5,000", icon: CircleDollarSign },
                { label: "Instant Settlement", limit: "KES 50,000", icon: TrendingUp },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <item.icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="text-xs font-semibold mt-0.5">{item.limit}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Recent Transactions</h3>
              <button onClick={() => setActiveTab("transactions")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <TxList txns={txns.slice(0, 8)} loading={txLoading} />
          </Card>
        </div>
      ) : (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="w-3.5 h-3.5" /> Filters:
            </div>
            <select aria-label="Filter transaction type" value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
              <option value="">All Types</option>
              {Object.entries(TX_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select aria-label="Filter transaction status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="reversed">Reversed</option>
            </select>
            <select aria-label="Filter currency" value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
              <option value="">All Currencies</option>
              <option value="KES">KES</option>
              <option value="USDC">USDC</option>
            </select>
            {(filterType || filterStatus || filterCurrency) && (
              <button onClick={() => { setFilterType(""); setFilterStatus(""); setFilterCurrency(""); }}
                className="text-xs text-red-600 hover:underline">Clear</button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{totalTxns} record{totalTxns !== 1 ? "s" : ""}</span>
          </div>
          <TxList txns={txns} loading={txLoading} showBalance />
        </Card>
      )}

      {/* ── Deposit Modal ─────────────────────────────────────────────────────── */}
      {modal === "deposit" && (
        <Modal title="Deposit Funds" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <Field label="Currency">
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
                <option value="KES">KES — Kenyan Shilling</option>
                <option value="USDC">USDC — Stablecoin</option>
              </select>
            </Field>
            <Field label="Amount">
              <input type="number" min="1" placeholder="0.00" value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
            </Field>
            <Field label="Payment Rail">
              <select value={form.railProvider} onChange={(e) => setForm((f) => ({ ...f, railProvider: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
                <option value="mpesa">M-PESA</option>
                <option value="pesalink">PesaLink (Bank Transfer)</option>
                <option value="paystack">Paystack (Card)</option>
                <option value="pesapal">Pesapal</option>
                <option value="stablecoin">Stablecoin</option>
              </select>
            </Field>
            <Field label="Reference (optional)">
              <input type="text" placeholder="e.g. MPESA transaction code" value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)}
                className="flex-1 border border-border rounded-md px-4 py-2 text-sm hover:bg-muted/50 transition-colors">Cancel</button>
              <button onClick={handleDeposit} disabled={!form.amount || Number(form.amount) <= 0}
                className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "#0A2A2A" }}>
                <ArrowDownToLine className="w-4 h-4 inline mr-1.5" /> Deposit
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Withdraw Modal ────────────────────────────────────────────────────── */}
      {modal === "withdraw" && (
        <Modal title="Withdraw Funds" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/40 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available KES</span>
              <span className="font-semibold">KES {fmt(kes?.balance ?? "0")}</span>
            </div>
            <Field label="Currency">
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
                <option value="KES">KES — Kenyan Shilling</option>
                <option value="USDC">USDC — Stablecoin</option>
              </select>
            </Field>
            <Field label="Amount">
              <input type="number" min="1" placeholder="0.00" value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
              <p className="text-xs text-muted-foreground mt-1">Daily limit: KES 500,000 · Single transfer limit: KES 200,000</p>
            </Field>
            <Field label="Destination Rail">
              <select value={form.railProvider} onChange={(e) => setForm((f) => ({ ...f, railProvider: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
                <option value="mpesa">M-PESA (Mobile Money)</option>
                <option value="pesalink">PesaLink (Bank)</option>
                <option value="stablecoin">Stablecoin Wallet</option>
              </select>
            </Field>
            <Field label="Reference (optional)">
              <input type="text" placeholder="Phone / Account number" value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)}
                className="flex-1 border border-border rounded-md px-4 py-2 text-sm hover:bg-muted/50 transition-colors">Cancel</button>
              <button onClick={handleWithdraw} disabled={!form.amount || Number(form.amount) <= 0}
                className="flex-1 border border-red-200 rounded-md px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors">
                <ArrowUpFromLine className="w-4 h-4 inline mr-1.5" /> Withdraw
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Transfer Modal ────────────────────────────────────────────────────── */}
      {modal === "transfer" && (
        <Modal title="Send Money" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/40 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available KES</span>
              <span className="font-semibold">KES {fmt(kes?.balance ?? "0")}</span>
            </div>
            <Field label="Recipient User ID">
              <input type="text" placeholder="e.g. FMR-2026-ATGP4P" value={form.toUserId}
                onChange={(e) => setForm((f) => ({ ...f, toUserId: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background font-mono" />
            </Field>
            <Field label="Currency">
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
                <option value="KES">KES — Kenyan Shilling</option>
                <option value="USDC">USDC — Stablecoin</option>
              </select>
            </Field>
            <Field label="Amount">
              <input type="number" min="1" placeholder="0.00" value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
              <p className="text-xs text-muted-foreground mt-1">Single transfer limit: KES 200,000</p>
            </Field>
            <Field label="Description (optional)">
              <input type="text" placeholder="Reason for transfer" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" />
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)}
                className="flex-1 border border-border rounded-md px-4 py-2 text-sm hover:bg-muted/50 transition-colors">Cancel</button>
              <button onClick={handleTransfer} disabled={!form.amount || !form.toUserId || Number(form.amount) <= 0}
                className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "#0A2A2A" }}>
                <ArrowLeftRight className="w-4 h-4 inline mr-1.5" /> Send
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Transaction List Sub-Component ────────────────────────────────────────────
function TxList({ txns, loading, showBalance = false }: { txns: Tx[]; loading: boolean; showBalance?: boolean }) {
  if (loading) return <div className="h-40 animate-pulse bg-muted/30 rounded-lg" />;
  if (!txns.length) return (
    <div className="text-center py-12 text-sm text-muted-foreground">
      <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
      No transactions yet. Make a deposit to get started.
    </div>
  );

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b">
            <th className="pb-2 pr-4 font-medium">ID</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium text-right">Amount</th>
            {showBalance && <th className="pb-2 pr-4 font-medium text-right">Balance After</th>}
            <th className="pb-2 pr-4 font-medium">Rail</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {txns.map((t) => {
            const isCredit = CREDIT_TYPES.has(t.type);
            return (
              <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 pr-4 font-mono text-muted-foreground">{t.id}</td>
                <td className="py-2.5 pr-4">
                  <span className={cn("inline-block text-xs font-medium px-1.5 py-0.5 rounded", TX_COLORS[t.type] ?? "text-slate-600 bg-slate-50")}>
                    {TX_TYPE_LABELS[t.type] ?? t.type}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right font-semibold">
                  <span className={cn(isCredit ? "text-[#0a2a2a] font-semibold" : "text-[#a6a6a6]")}>
                    <span className="mr-0.5">{isCredit ? "+" : "−"}</span>
                    {t.currency} {fmt(t.amount)}
                  </span>
                  {t.description && <div className="text-xs text-muted-foreground font-normal truncate max-w-[140px]">{t.description}</div>}
                </td>
                {showBalance && (
                  <td className="py-2.5 pr-4 text-right text-muted-foreground">
                    {t.currency} {fmt(t.balanceAfter)}
                  </td>
                )}
                <td className="py-2.5 pr-4">
                  <span className="text-xs text-muted-foreground">{RAIL_LABELS[t.railProvider] ?? t.railProvider}</span>
                </td>
                <td className="py-2.5 pr-4"><StatusBadge status={t.status} /></td>
                <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                  {new Date(t.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}
                  <div className="text-xs">{new Date(t.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
