import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
  Badge, Button,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui";
import { cn, formatCurrency } from "@/lib/utils";
import {
  FileSignature, TrendingUp, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Plus, Package, MapPin, Calendar,
  Coins, ShieldCheck, Activity, BarChart3, User, X,
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

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  draft:     { label: "Draft",     class: "bg-secondary text-muted-foreground border-border",              icon: Clock },
  open:      { label: "Open",      class: "bg-blue-500/15 text-blue-600 border-blue-500/30",              icon: FileSignature },
  accepted:  { label: "Accepted",  class: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",        icon: CheckCircle2 },
  active:    { label: "Active",    class: "bg-green-500/15 text-green-600 border-green-500/30",           icon: Activity },
  settled:   { label: "Settled",   class: "bg-teal-500/15 text-teal-600 border-teal-500/30",              icon: CheckCircle2 },
  cancelled: { label: "Cancelled", class: "bg-secondary text-muted-foreground border-border",              icon: X },
  defaulted: { label: "Defaulted", class: "bg-red-500/15 text-red-600 border-red-500/30",                 icon: AlertTriangle },
};

const NEXT_STATUSES: Record<string, string[]> = {
  draft:    ["open"],
  open:     ["accepted", "cancelled"],
  accepted: ["active", "cancelled"],
  active:   ["settled", "defaulted"],
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium", cfg.class)}>
      {status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
      {cfg.label}
    </span>
  );
}

const TABS = ["Contracts", "New Contract"] as const;
type Tab = typeof TABS[number];

export default function ForwardContracts() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Contracts");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

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

  const createContract = useMutation({
    mutationFn: (body: typeof form) =>
      api("/forward-contracts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forward-contracts"] });
      setTab("Contracts");
      setForm((f) => ({ ...f, quantity: "", forwardPrice: "", deliveryDate: "", deliveryLocation: "", grade: "" }));
    },
  });

  const totalContractValue = Number(form.quantity || 0) * Number(form.forwardPrice || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forward Contracts</h1>
          <p className="text-muted-foreground mt-1">
            Manage commodity forward contracts, delivery terms, and settlement
          </p>
        </div>
        <Button
          onClick={() => setTab("New Contract")}
          className="gap-2 text-white"
          style={{ backgroundColor: "#0A2A2A" }}
        >
          <Plus className="w-4 h-4" /> New Contract
        </Button>
      </div>

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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Contracts List */}
      {tab === "Contracts" && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter:</span>
            {["all", "draft", "open", "accepted", "active", "settled", "cancelled", "defaulted"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  statusFilter === s
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground"
                )}
              >
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
                    <TableHead>Delivery Date</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c: any) => (
                    <Fragment key={c.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-secondary/40"
                        onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                      >
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
                        <TableCell className="text-muted-foreground">{c.sellerName}</TableCell>
                        <TableCell className="text-muted-foreground">{c.buyerName ?? <span className="italic text-xs">TBD</span>}</TableCell>
                        <TableCell className="text-right font-display">
                          {Number(c.quantity).toLocaleString()} {c.unit}
                        </TableCell>
                        <TableCell className="text-right font-display">
                          KES {Number(c.forwardPrice).toLocaleString()}/{c.unit}
                        </TableCell>
                        <TableCell className="text-right font-display font-semibold">
                          {formatCurrency(c.totalValue)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.deliveryDate ? new Date(c.deliveryDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            {(NEXT_STATUSES[c.status] ?? []).map((next) => (
                              <Button
                                key={next}
                                size="sm"
                                variant="outline"
                                className="text-xs h-7"
                                disabled={updateStatus.isPending}
                                onClick={() => updateStatus.mutate({ id: c.id, status: next })}
                              >
                                → {STATUS_CONFIG[next]?.label ?? next}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Detail */}
                      {expanded === c.id && (
                        <TableRow className="bg-secondary/20">
                          <TableCell colSpan={11} className="py-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commodity Details</h4>
                                <DetailRow label="Type" value={c.commodity} />
                                <DetailRow label="Grade" value={c.grade ?? "—"} />
                                <DetailRow label="Quantity" value={`${Number(c.quantity).toLocaleString()} ${c.unit}`} />
                                <DetailRow label="Packaging" value={c.packagingType ?? "—"} />
                                <DetailRow label="Moisture" value={c.moistureContent ? `${c.moistureContent}%` : "—"} />
                                <DetailRow label="Origin" value={c.originLocation ?? "—"} />
                                {c.warehouseReceiptId && <DetailRow label="Receipt ID" value={c.warehouseReceiptId} mono />}
                              </div>
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing</h4>
                                <DetailRow label="Forward Price" value={`KES ${Number(c.forwardPrice).toLocaleString()}/${c.unit}`} />
                                <DetailRow label="Total Value" value={formatCurrency(c.totalValue)} />
                                <DetailRow label="AI Suggested" value={c.aiSuggestedPrice ? `KES ${Number(c.aiSuggestedPrice).toLocaleString()}` : "—"} />
                                <DetailRow label="Currency" value={c.currency} />
                                <DetailRow label="Payment" value={c.paymentMethod?.replace(/_/g, " ")} />
                                <DetailRow label="Schedule" value={c.paymentSchedule?.replace(/_/g, " ")} />
                              </div>
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery</h4>
                                <DetailRow label="Date" value={c.deliveryDate ? new Date(c.deliveryDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—"} />
                                <DetailRow label="Location" value={c.deliveryLocation} />
                                <DetailRow label="Method" value={c.deliveryMethod?.replace(/_/g, " ")} />
                                <DetailRow label="Partial Delivery" value={c.partialDeliveryAllowed ? "Yes" : "No"} />
                              </div>
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Collateral & Risk</h4>
                                <DetailRow label="Collateral" value={c.collateralType?.replace(/_/g, " ") ?? "—"} />
                                <DetailRow label="Collateral Value" value={c.collateralValue ? formatCurrency(c.collateralValue) : "—"} />
                                <DetailRow label="Locked" value={c.collateralLocked ? "Yes" : "No"} />
                                <DetailRow label="Buyer Risk" value={c.buyerRiskScore ?? "—"} />
                                <DetailRow label="Seller Risk" value={c.sellerRiskScore ?? "—"} />
                                <DetailRow label="Blockchain" value={c.blockchainNetwork ?? "IOTA"} />
                                {c.blockchainHash && <DetailRow label="Tx Hash" value={c.blockchainHash} mono />}
                              </div>
                            </div>
                            <div className="mt-3 px-4 flex items-center gap-3 text-xs text-muted-foreground">
                              <span>Created: {new Date(c.createdAt).toLocaleString("en-KE")}</span>
                              {c.settledAt && <span>• Settled: {new Date(c.settledAt).toLocaleString("en-KE")}</span>}
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

      {/* New Contract Form */}
      {tab === "New Contract" && (
        <div className="max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="w-5 h-5" />
                Create Forward Contract
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createContract.mutate(form);
                }}
                className="space-y-6"
              >
                {/* Commodity */}
                <Section title="Commodity Details" icon={Package}>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Commodity *">
                      <select
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                        value={form.commodity}
                        onChange={(e) => setForm((f) => ({ ...f, commodity: e.target.value }))}
                      >
                        {COMMODITIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Grade / Quality">
                      <input
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                        placeholder="e.g. Grade A, Export Grade"
                        value={form.grade}
                        onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                      />
                    </Field>
                    <Field label="Quantity *">
                      <input
                        type="number"
                        min="1"
                        required
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                        placeholder="e.g. 50000"
                        value={form.quantity}
                        onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                      />
                    </Field>
                    <Field label="Unit">
                      <select
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                        value={form.unit}
                        onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                      >
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </Field>
                  </div>
                </Section>

                {/* Pricing */}
                <Section title="Pricing Terms" icon={Coins}>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Forward Price (KES per unit) *">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                        placeholder="e.g. 42.00"
                        value={form.forwardPrice}
                        onChange={(e) => setForm((f) => ({ ...f, forwardPrice: e.target.value }))}
                      />
                    </Field>
                    <Field label="Total Contract Value">
                      <div className="w-full border border-border rounded-md px-3 py-2 text-sm bg-secondary text-muted-foreground">
                        {totalContractValue > 0 ? formatCurrency(totalContractValue) : "—"}
                      </div>
                    </Field>
                    <Field label="Payment Method">
                      <select
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                        value={form.paymentMethod}
                        onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                      >
                        {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </Section>

                {/* Delivery */}
                <Section title="Delivery Terms" icon={MapPin}>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Delivery Date *">
                      <input
                        type="date"
                        required
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                        value={form.deliveryDate}
                        onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))}
                      />
                    </Field>
                    <Field label="Delivery Method">
                      <select
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                        value={form.deliveryMethod}
                        onChange={(e) => setForm((f) => ({ ...f, deliveryMethod: e.target.value }))}
                      >
                        {DELIVERY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Delivery Location *" className="col-span-2">
                      <input
                        required
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                        placeholder="e.g. Kitale Grain Warehouse, Trans Nzoia"
                        value={form.deliveryLocation}
                        onChange={(e) => setForm((f) => ({ ...f, deliveryLocation: e.target.value }))}
                      />
                    </Field>
                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="partial"
                        checked={form.partialDeliveryAllowed}
                        onChange={(e) => setForm((f) => ({ ...f, partialDeliveryAllowed: e.target.checked }))}
                        className="rounded"
                      />
                      <label htmlFor="partial" className="text-sm text-muted-foreground">Allow partial delivery</label>
                    </div>
                  </div>
                </Section>

                {/* Collateral */}
                <Section title="Collateral" icon={ShieldCheck}>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Collateral Type" className="col-span-2">
                      <select
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                        value={form.collateralType}
                        onChange={(e) => setForm((f) => ({ ...f, collateralType: e.target.value }))}
                      >
                        {COLLATERAL_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </Section>

                {createContract.isError && (
                  <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-4 py-2">
                    Failed to create contract. Please check the form and try again.
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={createContract.isPending}
                    className="text-white gap-2"
                    style={{ backgroundColor: "#0A2A2A" }}
                  >
                    <FileSignature className="w-4 h-4" />
                    {createContract.isPending ? "Creating…" : "Create Contract"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setTab("Contracts")}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div>{children}</div>
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
      <span className={cn("text-right font-medium truncate max-w-[120px]", mono && "font-mono text-[10px]")} title={value}>{value}</span>
    </div>
  );
}
