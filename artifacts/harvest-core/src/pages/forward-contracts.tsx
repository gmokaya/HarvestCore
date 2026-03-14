import { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
  Button,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui";
import { cn, formatCurrency } from "@/lib/utils";
import {
  FileSignature, TrendingUp, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Plus, Package, MapPin,
  Coins, ShieldCheck, Activity, Brain, Link2,
  ArrowRight, Zap,
  Layers, Lock,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function api(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock-token-admin-001" },
    ...opts,
  }).then((r) => r.json());
}

const COMMODITIES = ["Maize", "Coffee", "Wheat", "Rice", "Sorghum", "Beans", "Tea", "Cotton", "Sesame", "Millet"];
const UNITS = ["kg", "ton", "bag"];
const DELIVERY_METHODS = [
  { value: "warehouse_pickup", label: "Warehouse Pickup" },
  { value: "buyer_transport", label: "Buyer Transport" },
  { value: "platform_logistics", label: "Platform Logistics" },
];
const PAYMENT_METHODS = [
  { value: "mpesa", label: "M-PESA" },
  { value: "pesalink", label: "PesaLink" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "stablecoin", label: "Stablecoin" },
];
const COLLATERAL_TYPES = [
  { value: "tokenized_receipt", label: "Tokenized Warehouse Receipt" },
  { value: "inventory_lock", label: "Inventory Lock" },
  { value: "cash_margin", label: "Cash Margin Deposit" },
  { value: "loan_backed", label: "Loan-backed Commodity" },
];

// Simulated AI price data
const AI_PRICES: Record<string, { price: number; trend: string; confidence: number; forecast: string }> = {
  Maize:   { price: 38.5,  trend: "+2.1%", confidence: 87, forecast: "Slight upward pressure due to reduced Eastern Africa rainfall" },
  Coffee:  { price: 620,   trend: "+5.4%", confidence: 91, forecast: "Global demand rising; supply constraints from Brazil" },
  Wheat:   { price: 42,    trend: "-0.8%", confidence: 78, forecast: "Stable; Ukraine supply recovering" },
  Rice:    { price: 55,    trend: "+1.2%", confidence: 83, forecast: "Seasonal demand increase expected Q3" },
  Sorghum: { price: 35,    trend: "+0.5%", confidence: 74, forecast: "Steady demand from regional breweries" },
  Beans:   { price: 90,    trend: "+3.2%", confidence: 85, forecast: "Protein demand driving prices; limited supply in Rift Valley" },
  Tea:     { price: 280,   trend: "+1.8%", confidence: 89, forecast: "Export volumes to UK and Pakistan increasing" },
  Cotton:  { price: 95,    trend: "-1.1%", confidence: 72, forecast: "Synthetic fibre competition keeping prices soft" },
  Sesame:  { price: 120,   trend: "+4.0%", confidence: 80, forecast: "Asian demand remains strong; Kenyan exports growing" },
  Millet:  { price: 38,    trend: "+0.9%", confidence: 76, forecast: "Stable with minor seasonal variation" },
};

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  draft:     { label: "Draft",     class: "bg-secondary text-muted-foreground border-border" },
  open:      { label: "Open",      class: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  accepted:  { label: "Accepted",  class: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30" },
  active:    { label: "Active",    class: "bg-green-500/15 text-green-600 border-green-500/30" },
  settled:   { label: "Settled",   class: "bg-teal-500/15 text-teal-600 border-teal-500/30" },
  cancelled: { label: "Cancelled", class: "bg-secondary text-muted-foreground border-border" },
  defaulted: { label: "Defaulted", class: "bg-red-500/15 text-red-600 border-red-500/30" },
};

const NEXT_STATUSES: Record<string, string[]> = {
  draft:    ["open"],
  open:     ["accepted", "cancelled"],
  accepted: ["active", "cancelled"],
  active:   ["settled", "defaulted"],
};

// Workflow step config — maps each status to a step index
const WORKFLOW_STEPS = [
  { label: "Create Contract",        desc: "Farmer / Trader",           icon: FileSignature, step: 1 },
  { label: "AI Price Suggestion",    desc: "Pricing Engine",            icon: Brain,         step: 2 },
  { label: "Accept Contract",        desc: "Commodity Processor",       icon: CheckCircle2,  step: 3 },
  { label: "Blockchain Tokenization",desc: "IOTA / BNC",                icon: Link2,         step: 4 },
  { label: "Automate Settlement",    desc: "On Delivery Confirmation",  icon: Zap,           step: 5 },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium", cfg.class)}>
      {status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
      {cfg.label}
    </span>
  );
}

const TABS = ["Contract Management", "AI Pricing", "Blockchain", "New Contract"] as const;
type Tab = typeof TABS[number];

export default function ForwardContracts() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Contract Management");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [aiCommodity, setAiCommodity] = useState("Maize");

  const { data, isLoading } = useQuery({
    queryKey: ["forward-contracts", statusFilter],
    queryFn: () => api(`/forward-contracts${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
    refetchInterval: 20000,
  });

  const contracts = data?.contracts ?? [];
  const stats = data?.stats ?? { total: 0, active: 0, settled: 0, totalValue: 0 };

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/forward-contracts/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forward-contracts"] }),
  });

  const [form, setForm] = useState({
    sellerId: "admin-001",
    commodity: "Maize",
    quantity: "",
    unit: "kg",
    forwardPrice: "",
    deliveryDate: "",
    deliveryLocation: "",
    deliveryMethod: "warehouse_pickup",
    paymentMethod: "pesalink",
    collateralType: "tokenized_receipt",
    grade: "",
    partialDeliveryAllowed: false,
  });

  const [aiForecast, setAiForecast] = useState<{
    aiSuggestedPrice: number; currentSpotPrice: number; changePct: number;
    confidence: number; daysAhead: number; method: string;
    breakdown: {
      trendContrib: number; seasonContrib: number; momentumContrib: number;
      cagr3yr: number; trendLabel: string; marketNote: string | null;
      priceHistory: { p24mo: number; p12mo: number; current: number };
    };
  } | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  useEffect(() => {
    if (!form.commodity) return;
    setForecastLoading(true);
    const params = new URLSearchParams({ commodity: form.commodity, unit: form.unit });
    if (form.deliveryDate) params.set("deliveryDate", form.deliveryDate);
    fetch(`${BASE}/api/forward-contracts/meta/ai-price?${params}`, {
      headers: { Authorization: "Bearer mock-token-admin-001" },
    })
      .then(r => r.json())
      .then(d => setAiForecast(d))
      .catch(() => setAiForecast(null))
      .finally(() => setForecastLoading(false));
  }, [form.commodity, form.unit, form.deliveryDate]);

  const createContract = useMutation({
    mutationFn: (body: typeof form) =>
      api("/forward-contracts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forward-contracts"] });
      setTab("Contract Management");
      setForm((f) => ({ ...f, quantity: "", forwardPrice: "", deliveryDate: "", deliveryLocation: "", grade: "" }));
    },
  });

  const totalContractValue = Number(form.quantity || 0) * Number(form.forwardPrice || 0);
  const aiData = AI_PRICES[aiCommodity] ?? AI_PRICES.Maize;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forward Contracts</h1>
          <p className="text-muted-foreground mt-1">Forwards Contracts Engine — AI pricing, blockchain tokenization &amp; automated settlement</p>
        </div>
        <Button onClick={() => setTab("New Contract")} className="gap-2 text-white" style={{ backgroundColor: "#0A2A2A" }}>
          <Plus className="w-4 h-4" /> New Contract
        </Button>
      </div>

      {/* Workflow Steps Banner */}
      <Card className="border-border">
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-0">
            {WORKFLOW_STEPS.map((step, idx) => (
              <div key={step.step} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1 min-w-0 px-2">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full mb-1.5 border-2"
                    style={{ backgroundColor: "#0A2A2A22", borderColor: "#0A2A2A55" }}>
                    <step.icon className="w-4 h-4" style={{ color: "#0A2A2A" }} />
                  </div>
                  <div className="text-xs font-semibold text-center leading-tight">{step.label}</div>
                  <div className="text-[10px] text-muted-foreground text-center mt-0.5">{step.desc}</div>
                  <div className="mt-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 border"
                    style={{ backgroundColor: "#0A2A2A11", borderColor: "#0A2A2A33", color: "#0A2A2A" }}>
                    Step {step.step}
                  </div>
                </div>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Contracts", value: stats.total, icon: FileSignature, color: "text-blue-600" },
          { label: "Active Contracts", value: stats.active, icon: Activity, color: "text-green-600" },
          { label: "Settled", value: stats.settled, icon: CheckCircle2, color: "text-teal-600" },
          { label: "Total Contract Value", value: formatCurrency(stats.totalValue), icon: TrendingUp, color: "text-purple-600", large: true },
        ].map(({ label, value, icon: Icon, color, large }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg bg-secondary", color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className={cn("font-bold", large ? "text-lg" : "text-2xl")}>{value}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engine Module Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Contract Management & Monitoring ── */}
      {tab === "Contract Management" && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filter:</span>
            {["all", "draft", "open", "accepted", "active", "settled", "cancelled", "defaulted"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  statusFilter === s ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground"
                )}>
                {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading contracts…</div>
          ) : contracts.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <FileSignature className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <div className="font-medium">No forward contracts yet</div>
                <div className="text-sm text-muted-foreground mt-1">Create the first contract to get started</div>
                <Button className="mt-4 gap-2 text-white" style={{ backgroundColor: "#0A2A2A" }} onClick={() => setTab("New Contract")}>
                  <Plus className="w-4 h-4" /> New Contract
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Contract ID</TableHead>
                    <TableHead>Commodity</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Forward Price</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Advance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c: any) => (
                    <Fragment key={c.id}>
                      <TableRow className="cursor-pointer hover:bg-secondary/40"
                        onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                        <TableCell>
                          {expanded === c.id
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">{c.id}</TableCell>
                        <TableCell>
                          <div className="font-medium">{c.commodity}</div>
                          {c.grade && <div className="text-xs text-muted-foreground">{c.grade}</div>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{c.sellerName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{c.buyerName ?? <span className="italic text-xs">TBD</span>}</TableCell>
                        <TableCell className="text-right font-display">{Number(c.quantity).toLocaleString()} {c.unit}</TableCell>
                        <TableCell className="text-right font-display">KES {Number(c.forwardPrice).toLocaleString()}/{c.unit}</TableCell>
                        <TableCell className="text-right font-display font-semibold">{formatCurrency(c.totalValue)}</TableCell>
                        <TableCell className="text-sm">
                          {c.deliveryDate ? new Date(c.deliveryDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </TableCell>
                        <TableCell className="text-center"><StatusBadge status={c.status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            {(NEXT_STATUSES[c.status] ?? []).map((next) => (
                              <Button key={next} size="sm" variant="outline" className="text-xs h-7"
                                disabled={updateStatus.isPending}
                                onClick={() => updateStatus.mutate({ id: c.id, status: next })}>
                                {STATUS_CONFIG[next]?.label ?? next}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>

                      {expanded === c.id && (
                        <TableRow className="bg-secondary/20">
                          <TableCell colSpan={11} className="py-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commodity</h4>
                                <DetailRow label="Type" value={c.commodity} />
                                <DetailRow label="Grade" value={c.grade ?? "—"} />
                                <DetailRow label="Quantity" value={`${Number(c.quantity).toLocaleString()} ${c.unit}`} />
                                <DetailRow label="Origin" value={c.originLocation ?? "—"} />
                                {c.warehouseReceiptId && <DetailRow label="Receipt" value={c.warehouseReceiptId} mono />}
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing</h4>
                                <DetailRow label="Forward Price" value={`KES ${Number(c.forwardPrice).toLocaleString()}/${c.unit}`} />
                                <DetailRow label="Total Value" value={formatCurrency(c.totalValue)} />
                                <DetailRow label="AI Suggested" value={c.aiSuggestedPrice ? `KES ${Number(c.aiSuggestedPrice).toLocaleString()}` : "—"} />
                                <DetailRow label="Payment" value={c.paymentMethod?.replace(/_/g, " ")} />
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery</h4>
                                <DetailRow label="Date" value={c.deliveryDate ? new Date(c.deliveryDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—"} />
                                <DetailRow label="Location" value={c.deliveryLocation} />
                                <DetailRow label="Method" value={c.deliveryMethod?.replace(/_/g, " ")} />
                                <DetailRow label="Partial OK" value={c.partialDeliveryAllowed ? "Yes" : "No"} />
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Collateral &amp; Blockchain</h4>
                                <DetailRow label="Collateral" value={c.collateralType?.replace(/_/g, " ") ?? "—"} />
                                <DetailRow label="Locked" value={c.collateralLocked ? "Yes" : "No"} />
                                <DetailRow label="Network" value={c.blockchainNetwork ?? "IOTA"} />
                                {c.blockchainHash && <DetailRow label="Tx Hash" value={c.blockchainHash} mono />}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* ── AI Pricing Module ── */}
      {tab === "AI Pricing" && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="w-4 h-4" /> AI Price Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium shrink-0">Select Commodity</label>
                <select
                  className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
                  value={aiCommodity}
                  onChange={(e) => setAiCommodity(e.target.value)}
                >
                  {COMMODITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">AI Suggested Price</div>
                  <div className="text-2xl font-bold">KES {aiData.price}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">per kg</div>
                </div>
                <div className="rounded-lg border border-border p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">7-Day Trend</div>
                  <div className={cn("text-2xl font-bold", aiData.trend.startsWith("+") ? "text-green-600" : "text-red-600")}>
                    {aiData.trend}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">vs last week</div>
                </div>
                <div className="rounded-lg border border-border p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Model Confidence</div>
                  <div className="text-2xl font-bold">{aiData.confidence}%</div>
                  <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
                    <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${aiData.confidence}%` }} />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <Brain className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-amber-800">Market Forecast — {aiCommodity}</div>
                    <div className="text-sm text-amber-700 mt-1">{aiData.forecast}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-3">All Commodity Index</div>
                <div className="space-y-2">
                  {Object.entries(AI_PRICES).map(([commodity, d]) => (
                    <div key={commodity} className="flex items-center gap-3">
                      <div className="w-20 text-xs font-medium shrink-0">{commodity}</div>
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div className="h-2 rounded-full" style={{
                          width: `${Math.min((d.price / 700) * 100, 100)}%`,
                          backgroundColor: "#0A2A2A",
                          opacity: 0.7,
                        }} />
                      </div>
                      <div className="w-20 text-xs font-display text-right">KES {d.price}/kg</div>
                      <div className={cn("w-14 text-xs text-right font-medium",
                        d.trend.startsWith("+") ? "text-green-600" : "text-red-600")}>
                        {d.trend}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Blockchain Module ── */}
      {tab === "Blockchain" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">IOTA Network</span>
                  <span className="ml-auto text-xs text-green-600 font-medium">Connected</span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Network</span><span className="font-mono font-medium text-foreground">IOTA Mainnet</span></div>
                  <div className="flex justify-between"><span>Protocol</span><span className="font-mono font-medium text-foreground">Tangle v2</span></div>
                  <div className="flex justify-between"><span>Finality</span><span className="font-medium text-foreground">~10s</span></div>
                  <div className="flex justify-between"><span>Tx Fee</span><span className="font-medium text-foreground">Zero</span></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">BNC Chain</span>
                  <span className="ml-auto text-xs text-green-600 font-medium">Connected</span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Network</span><span className="font-mono font-medium text-foreground">BNC Mainnet</span></div>
                  <div className="flex justify-between"><span>Standard</span><span className="font-mono font-medium text-foreground">ERC-20 / DRC-20</span></div>
                  <div className="flex justify-between"><span>Contracts</span><span className="font-medium text-foreground">Solidity v0.8</span></div>
                  <div className="flex justify-between"><span>Avg Gas</span><span className="font-medium text-foreground">0.002 BNC</span></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Secure Ledger</span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Tokenized</span><span className="font-medium text-foreground">{stats.total} contracts</span></div>
                  <div className="flex justify-between"><span>Active Tokens</span><span className="font-medium text-foreground">{stats.active}</span></div>
                  <div className="flex justify-between"><span>Settled On-chain</span><span className="font-medium text-foreground">{stats.settled}</span></div>
                  <div className="flex justify-between"><span>Ledger State</span><span className="text-green-600 font-medium">Verified</span></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tokenized contracts table */}
          {contracts.filter((c: any) => c.status === "active" || c.status === "settled").length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Tokenized Contracts
                </CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract ID</TableHead>
                    <TableHead>Commodity</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.filter((c: any) => c.status === "active" || c.status === "settled").map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.id}</TableCell>
                      <TableCell>{c.commodity}</TableCell>
                      <TableCell className="text-right">{Number(c.quantity).toLocaleString()} {c.unit}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(c.totalValue)}</TableCell>
                      <TableCell className="text-sm">{c.blockchainNetwork ?? "IOTA"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{c.blockchainHash ?? "Pending…"}</TableCell>
                      <TableCell className="text-center"><StatusBadge status={c.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No tokenized contracts yet. Contracts become tokenized when their status reaches <strong>Active</strong>.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── New Contract (Contract Creation Module) ── */}
      {tab === "New Contract" && (
        <div className="space-y-5">
          <div className="max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="w-5 h-5" /> Create Forward Contract
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => { e.preventDefault(); createContract.mutate(form); }} className="space-y-6">
                  <FormSection title="Commodity Details" icon={Package}>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Commodity *">
                        <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={form.commodity} onChange={(e) => setForm((f) => ({ ...f, commodity: e.target.value }))}>
                          {COMMODITIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </Field>
                      <Field label="Grade / Quality">
                        <input className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          placeholder="e.g. Grade A, Export Grade" value={form.grade}
                          onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))} />
                      </Field>
                      <Field label="Quantity *">
                        <input type="number" min="1" required
                          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          placeholder="e.g. 50000" value={form.quantity}
                          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
                      </Field>
                      <Field label="Unit">
                        <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                          {UNITS.map((u) => <option key={u}>{u}</option>)}
                        </select>
                      </Field>
                    </div>
                  </FormSection>

                  <FormSection title="Pricing Terms" icon={Coins}>
                    {/* AI forecast callout */}
                    <div className={cn(
                      "rounded-lg border px-3 py-2.5 mb-3 transition-opacity",
                      forecastLoading ? "opacity-50" : "opacity-100",
                      aiForecast ? "border-amber-200 bg-amber-50" : "border-muted bg-muted/40",
                    )}>
                      {!form.deliveryDate ? (
                        <div className="flex items-center gap-2">
                          <Brain className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">
                            Set a delivery date to get an AI-forecasted price for that date.
                          </span>
                        </div>
                      ) : forecastLoading ? (
                        <div className="flex items-center gap-2">
                          <Brain className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
                          <span className="text-xs text-amber-700">Calculating forecast…</span>
                        </div>
                      ) : aiForecast ? (
                        <div className="space-y-2">
                          {/* Main forecast line */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-start gap-2">
                              <Brain className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <div className="text-xs text-amber-900">
                                  <span className="font-semibold">KES {aiForecast.aiSuggestedPrice.toLocaleString()}/{form.unit}</span>
                                  {" "}forecasted at delivery
                                  <span className={cn("ml-1.5 font-medium", aiForecast.changePct >= 0 ? "text-green-700" : "text-red-700")}>
                                    ({aiForecast.changePct >= 0 ? "+" : ""}{aiForecast.changePct}% vs spot KES {aiForecast.currentSpotPrice.toLocaleString()})
                                  </span>
                                </div>
                                <div className="text-[10px] text-amber-600">
                                  {aiForecast.daysAhead} days ahead · {aiForecast.confidence}% confidence · reference only
                                </div>
                              </div>
                            </div>
                            <button type="button"
                              className="shrink-0 text-xs font-medium text-amber-700 border border-amber-300 rounded px-2 py-0.5 hover:bg-amber-100 transition-colors"
                              onClick={() => setForm((f) => ({ ...f, forwardPrice: String(aiForecast.aiSuggestedPrice) }))}>
                              Apply
                            </button>
                          </div>
                          {/* Breakdown row */}
                          <div className="flex items-center gap-3 pt-1.5 border-t border-amber-200 flex-wrap">
                            <span className="text-[10px] text-amber-700 font-medium">Model factors:</span>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded", aiForecast.breakdown.trendContrib >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                              3yr trend {aiForecast.breakdown.trendContrib >= 0 ? "+" : ""}{aiForecast.breakdown.trendContrib}% · {aiForecast.breakdown.trendLabel} ({aiForecast.breakdown.cagr3yr}% CAGR)
                            </span>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded", aiForecast.breakdown.seasonContrib >= 0 ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800")}>
                              Seasonal {aiForecast.breakdown.seasonContrib >= 0 ? "+" : ""}{aiForecast.breakdown.seasonContrib.toFixed(1)}%
                            </span>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded", aiForecast.breakdown.momentumContrib >= 0 ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-700")}>
                              Momentum {aiForecast.breakdown.momentumContrib >= 0 ? "+" : ""}{aiForecast.breakdown.momentumContrib.toFixed(1)}%
                            </span>
                          </div>
                          {/* Market note */}
                          {aiForecast.breakdown.marketNote && (
                            <div className="text-[10px] text-amber-700 italic">
                              ⚡ {aiForecast.breakdown.marketNote}
                            </div>
                          )}
                          {/* 3-yr price history */}
                          <div className="flex items-center gap-3 text-[10px] text-amber-600">
                            <span>24mo ago: KES {aiForecast.breakdown.priceHistory.p24mo.toLocaleString()}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                            <span>12mo ago: KES {aiForecast.breakdown.priceHistory.p12mo.toLocaleString()}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                            <span className="font-medium">Today: KES {aiForecast.breakdown.priceHistory.current.toLocaleString()}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Delivery Date *">
                        <input type="date" required
                          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={form.deliveryDate}
                          onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))} />
                      </Field>
                      <Field label="Forward Price (KES per unit) *">
                        <input type="number" min="0" step="0.01" required
                          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          placeholder="Enter your price"
                          value={form.forwardPrice}
                          onChange={(e) => setForm((f) => ({ ...f, forwardPrice: e.target.value }))} />
                      </Field>
                      <Field label="Total Contract Value">
                        <div className="w-full border border-border rounded-md px-3 py-2 text-sm bg-secondary text-muted-foreground">
                          {totalContractValue > 0 ? formatCurrency(totalContractValue) : "—"}
                        </div>
                      </Field>
                      <Field label="Payment Method">
                        <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </Field>
                    </div>
                  </FormSection>

                  <FormSection title="Delivery Terms" icon={MapPin}>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Delivery Method">
                        <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={form.deliveryMethod} onChange={(e) => setForm((f) => ({ ...f, deliveryMethod: e.target.value }))}>
                          {DELIVERY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Delivery Location *" className="col-span-2">
                        <input required className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          placeholder="e.g. Kitale Grain Warehouse, Trans Nzoia" value={form.deliveryLocation}
                          onChange={(e) => setForm((f) => ({ ...f, deliveryLocation: e.target.value }))} />
                      </Field>
                      <div className="col-span-2 flex items-center gap-2">
                        <input type="checkbox" id="partial" checked={form.partialDeliveryAllowed}
                          onChange={(e) => setForm((f) => ({ ...f, partialDeliveryAllowed: e.target.checked }))} className="rounded" />
                        <label htmlFor="partial" className="text-sm text-muted-foreground">Allow partial delivery</label>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="Collateral" icon={ShieldCheck}>
                    <Field label="Collateral Type" className="max-w-sm">
                      <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                        value={form.collateralType} onChange={(e) => setForm((f) => ({ ...f, collateralType: e.target.value }))}>
                        {COLLATERAL_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </Field>
                  </FormSection>

                  {createContract.isError && (
                    <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-4 py-2">
                      Failed to create contract. Please check the form and try again.
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={createContract.isPending} className="text-white gap-2" style={{ backgroundColor: "#0A2A2A" }}>
                      <FileSignature className="w-4 h-4" />
                      {createContract.isPending ? "Creating…" : "Create Contract"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setTab("Contract Management")}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

    </div>
  );
}


function FormSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-right font-medium truncate max-w-[130px]", mono && "font-mono text-[10px]")} title={value}>{value}</span>
    </div>
  );
}
