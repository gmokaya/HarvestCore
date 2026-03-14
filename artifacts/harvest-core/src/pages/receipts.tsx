import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
  Badge, Button,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  FileCheck2, Lock, Coins, ChevronDown, ChevronRight,
  CheckCircle2, Clock, AlertTriangle, BarChart3, CalendarDays,
  Building2, User, Link2, Package, ArrowRightLeft, ScrollText,
  ClipboardCheck, Plus, Warehouse, Activity, TrendingUp, Search,
  ShieldCheck, RefreshCw, Leaf,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function api(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock-token-admin-001" },
    ...opts,
  }).then((r) => r.json());
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  draft:            { label: "Draft",            class: "bg-secondary text-muted-foreground border-border" },
  active:           { label: "Active",           class: "bg-green-500/15 text-green-400 border-green-500/30" },
  collateral_locked:{ label: "Collateral Locked",class: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  under_trade:      { label: "Under Trade",      class: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  settled:          { label: "Settled",          class: "bg-teal-500/15 text-teal-400 border-teal-500/30" },
  expired:          { label: "Expired",          class: "bg-red-500/15 text-red-400 border-red-500/30" },
  cancelled:        { label: "Cancelled",        class: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
};

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  issued:      { label: "Issued",           color: "text-green-400" },
  activated:   { label: "Activated",        color: "text-emerald-400" },
  tokenized:   { label: "Tokenized",        color: "text-primary" },
  locked:      { label: "Locked as Collateral", color: "text-blue-400" },
  transferred: { label: "Ownership Transferred", color: "text-purple-400" },
  settled:     { label: "Settled",          color: "text-teal-400" },
  cancelled:   { label: "Cancelled",        color: "text-red-400" },
  active:      { label: "Activated",        color: "text-emerald-400" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap", cfg.class)}>
      {cfg.label}
    </span>
  );
}

function DaysUntilExpiry({ expiryDate }: { expiryDate: string | null }) {
  if (!expiryDate) return <span className="text-muted-foreground text-xs">—</span>;
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return <span className="text-red-400 text-xs font-medium">Expired {Math.abs(days)}d ago</span>;
  if (days <= 30) return <span className="text-orange-400 text-xs font-medium">Expires in {days}d</span>;
  return <span className="text-muted-foreground text-xs">{new Date(expiryDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</span>;
}

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span className={cn(
      "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border",
      grade === "A" ? "bg-green-500/15 text-green-400 border-green-500/30"
        : grade === "B" ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
        : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
    )}>
      {grade}
    </span>
  );
}

function DetailPanel({ receipt }: { receipt: any }) {
  const hasSignatures = receipt.warehouseOperatorSignature || receipt.inspectionAuthoritySignature || receipt.registrySignature;
  return (
    <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Package className="w-3 h-3" /> Commodity</p>
          <p className="font-semibold text-sm">{receipt.commodity}</p>
          <p className="text-xs text-muted-foreground">Grade {receipt.grade} · {receipt.packagingType ?? "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Building2 className="w-3 h-3" /> Warehouse</p>
          <p className="font-semibold text-sm">{receipt.warehouseName}</p>
          <p className="text-xs text-muted-foreground">{receipt.storageLocation ?? "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><User className="w-3 h-3" /> Owner</p>
          <p className="font-semibold text-sm">{receipt.ownerName}</p>
          {receipt.organizationName && <p className="text-xs text-muted-foreground">{receipt.organizationName}</p>}
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Link2 className="w-3 h-3" /> References</p>
          {receipt.registryRefId && <p className="text-xs font-mono text-primary">{receipt.registryRefId}</p>}
          {receipt.inspectionId && <p className="text-xs font-mono text-muted-foreground">{receipt.inspectionId.toUpperCase()}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Quantity</p>
          <p className="font-semibold">{receipt.quantityKg.toLocaleString()} kg</p>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Stack Position</p>
          <p className="font-semibold text-sm">{receipt.stackPosition ?? "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Re-inspection Date</p>
          <p className="font-semibold text-sm">
            {receipt.reInspectionDate
              ? new Date(receipt.reInspectionDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
              : "—"}
          </p>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Token ID</p>
          <p className={cn("font-mono text-sm font-semibold", receipt.tokenId ? "text-primary" : "text-muted-foreground")}>
            {receipt.tokenId ?? "Not tokenized"}
          </p>
        </div>
      </div>
      {hasSignatures && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Digital Signatures</p>
          <div className="space-y-1">
            {[
              { label: "Warehouse Operator", value: receipt.warehouseOperatorSignature },
              { label: "Inspection Authority", value: receipt.inspectionAuthoritySignature },
              { label: "Registry", value: receipt.registrySignature },
            ].filter(s => s.value).map(sig => (
              <div key={sig.label} className="flex items-center gap-3 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                <span className="text-muted-foreground w-40 flex-shrink-0">{sig.label}</span>
                <span className="font-mono text-muted-foreground/60 truncate">{sig.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {receipt.notes && (
        <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-3">{receipt.notes}</p>
      )}
    </div>
  );
}

function TransferModal({ receipt, users, onClose, onTransfer }: {
  receipt: any; users: any[]; onClose: () => void;
  onTransfer: (newOwnerId: string, notes: string) => void;
}) {
  const [newOwnerId, setNewOwnerId] = useState("");
  const [notes, setNotes] = useState("");
  const eligible = users.filter(u => u.id !== receipt.ownerId && ["farmer", "trader"].includes(u.role));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-5">
        <div>
          <h2 className="font-display font-bold text-lg">Transfer Ownership</h2>
          <p className="text-sm text-muted-foreground mt-1">Transfer <span className="font-mono text-primary">{receipt.receiptNumber}</span> to a new owner. Status will change to Under Trade.</p>
        </div>
        <div className="bg-secondary/40 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Commodity</span>
            <span className="font-medium">{receipt.commodity} · Grade {receipt.grade}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Quantity</span>
            <span className="font-medium">{receipt.quantityKg.toLocaleString()} kg</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Current Owner</span>
            <span className="font-medium">{receipt.ownerName}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">New Owner *</label>
            <select
              value={newOwnerId}
              onChange={e => setNewOwnerId(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select new owner…</option>
              {eligible.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Transfer Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Reason for transfer (optional)"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 gap-2"
            disabled={!newOwnerId}
            onClick={() => onTransfer(newOwnerId, notes)}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transfer Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}

function IssueDWRTab({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient();

  const { data: eligibleData, isLoading: eligibleLoading } = useQuery({
    queryKey: ["eligible-inspections"],
    queryFn: () => api("/receipts/eligible-inspections"),
  });
  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => api("/users"),
  });

  const eligibleInspections: any[] = eligibleData?.inspections ?? [];
  const users: any[] = (usersData?.users ?? []).filter((u: any) => ["farmer", "trader"].includes(u.role));

  const [selectedInspection, setSelectedInspection] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [packagingType, setPackagingType] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const insp = eligibleInspections.find(i => i.id === selectedInspection);

  const issueMutation = useMutation({
    mutationFn: (body: any) => api("/receipts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["eligible-inspections"] });
      setSuccess(true);
    },
    onError: (e: any) => setSubmitError(e.message),
  });

  function handleSubmit() {
    setSubmitError("");
    if (!selectedInspection || !ownerId) { setSubmitError("Inspection and Owner are required."); return; }
    issueMutation.mutate({
      inspectionId: insp.id,
      warehouseId: insp.warehouseId,
      ownerId,
      commodity: insp.commodity,
      grade: insp.grade,
      quantityKg: insp.netWeightKg ?? 0,
      packagingType: packagingType || insp.packagingType,
      storageLocation: storageLocation || undefined,
      expiryDate: expiryDate || undefined,
      notes: notes || undefined,
      status: "draft",
    });
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
          <FileCheck2 className="w-8 h-8 text-green-400" />
        </div>
        <div className="text-center">
          <h3 className="font-display font-bold text-lg text-foreground">DWR Issued Successfully</h3>
          <p className="text-sm text-muted-foreground mt-1">The receipt has been created in Draft status. Activate it to make it available for collateralization or trading.</p>
        </div>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={() => { setSuccess(false); setSelectedInspection(""); setOwnerId(""); setExpiryDate(""); setPackagingType(""); setStorageLocation(""); setNotes(""); }}>
            Issue Another
          </Button>
          <Button onClick={onSuccess}>View Receipts</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="font-display font-bold text-lg">Issue Digital Warehouse Receipt</h2>
        <p className="text-sm text-muted-foreground mt-1">DWRs can only be issued against an approved inspection report. Select one below to auto-fill commodity details.</p>
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-primary" /> Step 1 — Link Approved Inspection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {eligibleLoading ? (
            <p className="text-sm text-muted-foreground">Loading eligible inspections…</p>
          ) : eligibleInspections.length === 0 ? (
            <div className="flex items-center gap-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <p className="text-sm text-orange-300">No approved inspections are currently available. All approved inspections may already have receipts issued.</p>
            </div>
          ) : (
            <select
              value={selectedInspection}
              onChange={e => setSelectedInspection(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
            >
              <option value="">Select an approved inspection…</option>
              {eligibleInspections.map(i => (
                <option key={i.id} value={i.id}>
                  {i.inspectionNumber} — {i.commodity} {i.commodityVariety ? `(${i.commodityVariety})` : ""} · Grade {i.grade} · {i.warehouseName}
                </option>
              ))}
            </select>
          )}

          {insp && (
            <div className="grid grid-cols-3 gap-3 mt-2">
              {[
                { label: "Commodity", value: `${insp.commodity}${insp.commodityVariety ? ` (${insp.commodityVariety})` : ""}` },
                { label: "Grade", value: insp.grade },
                { label: "Net Weight", value: insp.netWeightKg ? `${Number(insp.netWeightKg).toLocaleString()} kg` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-semibold text-sm mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Step 2 — Owner & Storage Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Owner (Farmer / Trader) *</label>
              <select
                value={ownerId}
                onChange={e => setOwnerId(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
              >
                <option value="">Select owner…</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Packaging Type</label>
              <select
                value={packagingType}
                onChange={e => setPackagingType(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
              >
                <option value="">Use from inspection</option>
                <option value="90kg Bags">90 kg Bags</option>
                <option value="100kg Bags">100 kg Bags</option>
                <option value="50kg Bags">50 kg Bags</option>
                <option value="Bulk">Bulk</option>
                <option value="Jumbo Bags">Jumbo Bags</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Storage Location</label>
              <input
                type="text"
                value={storageLocation}
                onChange={e => setStorageLocation(e.target.value)}
                placeholder="e.g. Bay 3, Row A"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional storage or handling notes…"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {submitError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {submitError}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          className="flex-1 gap-2"
          disabled={!selectedInspection || !ownerId || issueMutation.isPending}
          onClick={handleSubmit}
        >
          <FileCheck2 className="w-4 h-4" />
          {issueMutation.isPending ? "Issuing…" : "Issue DWR"}
        </Button>
      </div>

      <Card className="bg-secondary/30 border-border/30">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Issuance Rules</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Only inspections with <span className="text-green-400 font-medium">Approved</span> status can be linked to a DWR</li>
            <li>Each inspection may only be used for one active DWR</li>
            <li>Issued receipts start in <span className="text-muted-foreground font-medium">Draft</span> status — activate to enable financing or trading</li>
            <li>Digital signatures are generated and appended automatically at issuance</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["receipts-reports"],
    queryFn: () => api("/receipts/reports"),
  });

  const byCommodity: any[] = data?.byCommodity ?? [];
  const byOwner: any[] = data?.byOwner ?? [];
  const byWarehouse: any[] = data?.byWarehouse ?? [];
  const maxKg = Math.max(...byCommodity.map(c => c.totalKg), 1);

  if (isLoading) return <div className="text-center text-muted-foreground py-16">Loading reports…</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Leaf className="w-4 h-4 text-green-400" /> By Commodity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCommodity.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
            {byCommodity.map(c => (
              <div key={c.commodity} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.commodity}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">{c.count} receipts</span>
                    {c.locked > 0 && <span className="text-blue-400 text-xs">{c.locked} locked</span>}
                    <span className="font-semibold text-xs">{(c.totalKg / 1000).toFixed(1)} t</span>
                  </div>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(c.totalKg / maxKg) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Warehouse className="w-4 h-4 text-blue-400" /> By Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            {byWarehouse.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Receipts</TableHead>
                  <TableHead className="text-right">Total (t)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byWarehouse.map(w => (
                  <TableRow key={w.warehouseId} className="border-border/30">
                    <TableCell className="text-sm font-medium">{w.name}</TableCell>
                    <TableCell className="text-right text-sm">{w.count}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{(w.totalKg / 1000).toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4 text-purple-400" /> Receipts by Owner</CardTitle>
        </CardHeader>
        <CardContent>
          {byOwner.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Locked</TableHead>
                <TableHead className="text-right">Qty (t)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byOwner.map(o => (
                <TableRow key={o.ownerId} className="border-border/30">
                  <TableCell className="text-sm font-medium">{o.name}</TableCell>
                  <TableCell className="text-right text-sm">{o.count}</TableCell>
                  <TableCell className="text-right text-sm text-green-400">{o.active}</TableCell>
                  <TableCell className="text-right text-sm text-blue-400">{o.locked}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{(o.totalKg / 1000).toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AuditLogTab() {
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dwr-audit"],
    queryFn: () => api("/receipts/audit"),
    refetchInterval: 15000,
  });

  const logs: any[] = (data?.logs ?? []).filter((l: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.receiptNumber?.toLowerCase().includes(q)
      || l.action?.toLowerCase().includes(q)
      || l.fromOwnerName?.toLowerCase().includes(q)
      || l.toOwnerName?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search receipt, action, owner…"
            className="w-full pl-9 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-xs text-muted-foreground">{logs.length} events</span>
      </div>

      {isLoading && <div className="text-center text-muted-foreground py-16">Loading audit log…</div>}
      {!isLoading && logs.length === 0 && (
        <div className="text-center text-muted-foreground py-16">
          <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No audit events found</p>
        </div>
      )}

      <div className="space-y-2">
        {logs.map((log, idx) => {
          const action = ACTION_CONFIG[log.action] ?? { label: log.action, color: "text-muted-foreground" };
          return (
            <div key={log.id ?? idx} className="flex items-start gap-4 p-3 bg-card border border-border/40 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-primary/60 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-primary font-semibold">{log.receiptNumber}</span>
                  <span className={cn("text-xs font-medium", action.color)}>{action.label}</span>
                  {log.fromOwnerName && log.toOwnerName && (
                    <span className="text-xs text-muted-foreground">
                      {log.fromOwnerName} <ArrowRightLeft className="w-3 h-3 inline" /> {log.toOwnerName}
                    </span>
                  )}
                </div>
                {log.notes && <p className="text-xs text-muted-foreground mt-0.5">{log.notes}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</p>
                <p className="text-xs text-muted-foreground/60">{new Date(log.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReceiptsPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("receipts");
  const [transferReceipt, setTransferReceipt] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["receipts"],
    queryFn: () => api("/receipts"),
  });
  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => api("/users"),
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => api(`/receipts/${id}/lock-collateral`, { method: "PATCH", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receipts"] }),
  });
  const tokenizeMutation = useMutation({
    mutationFn: (id: string) => api(`/receipts/${id}/tokenize`, { method: "PATCH", body: "{}" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receipts"] }); qc.invalidateQueries({ queryKey: ["dwr-audit"] }); },
  });
  const activateMutation = useMutation({
    mutationFn: (id: string) => api(`/receipts/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receipts"] }); qc.invalidateQueries({ queryKey: ["dwr-audit"] }); },
  });
  const transferMutation = useMutation({
    mutationFn: ({ id, newOwnerId, notes }: { id: string; newOwnerId: string; notes: string }) =>
      api(`/receipts/${id}/transfer`, { method: "PATCH", body: JSON.stringify({ newOwnerId, notes }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["dwr-audit"] });
      setTransferReceipt(null);
    },
  });

  const receipts: any[] = data?.receipts ?? [];
  const stats = data?.stats ?? {};
  const users: any[] = usersData?.users ?? [];

  const TAB_FILTERS: Record<string, string | null> = {
    all: null, active: "active", collateral_locked: "collateral_locked",
    draft: "draft", expired: "expired",
  };
  const filtered = statusFilter === "all" ? receipts : receipts.filter((r) => r.status === TAB_FILTERS[statusFilter]);

  const TABS = [
    { key: "receipts",  label: "Receipts",    icon: FileCheck2 },
    { key: "reports",   label: "Reports",     icon: TrendingUp },
    { key: "audit",     label: "Audit Log",   icon: ScrollText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Digital Warehouse Receipts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verifiable proof of commodity ownership, quality, and storage — the collateral instrument
          </p>
        </div>
        <Button className="gap-2" onClick={() => setActiveTab("issue")}>
          <Plus className="w-4 h-4" />
          Issue Receipt
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Receipts",    value: stats.total ?? 0,           icon: FileCheck2,   color: "text-foreground" },
          { label: "Active",            value: stats.active ?? 0,          icon: CheckCircle2, color: "text-green-400" },
          { label: "Collateral Locked", value: stats.collateralLocked ?? 0,icon: Lock,         color: "text-blue-400" },
          { label: "Under Trade",       value: stats.underTrade ?? 0,      icon: BarChart3,    color: "text-purple-400" },
          { label: "Expired",           value: stats.expired ?? 0,         icon: AlertTriangle,color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={cn("w-4 h-4", color)} />
              </div>
              <p className={cn("text-2xl font-bold font-display", color)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total KG metric */}
      {stats.totalKg > 0 && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Commodity Under Receipt Management</p>
              <p className="text-3xl font-bold font-display text-primary mt-1">
                {(stats.totalKg / 1000).toFixed(1)} <span className="text-base font-normal text-muted-foreground">metric tons</span>
              </p>
            </div>
            <Package className="w-10 h-10 text-primary/40" />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-secondary/40 border border-border/50 rounded-lg p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors",
              activeTab === key
                ? "bg-card border border-border/50 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
        {activeTab === "issue" && (
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-card border border-border/50 text-foreground shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Issue DWR
          </button>
        )}
      </div>

      {/* Tab: Receipts */}
      {activeTab === "receipts" && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-0 px-6 pt-4">
            <div className="flex items-center gap-2 flex-wrap">
              {Object.keys(TAB_FILTERS).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    statusFilter === tab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  {tab === "all" ? `All (${receipts.length})`
                    : tab === "collateral_locked" ? "Locked"
                    : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="w-8" />
                  <TableHead>Receipt No.</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-12">Loading receipts…</TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-12">No receipts found</TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => (
                  <Fragment key={r.id}>
                    <TableRow
                      className="cursor-pointer border-border/30"
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    >
                      <TableCell className="w-8 text-muted-foreground">
                        {expandedId === r.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold text-primary">{r.receiptNumber}</span>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{r.commodity}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{r.ownerName}</p>
                          {r.organizationName && <p className="text-xs text-muted-foreground truncate max-w-[120px]">{r.organizationName}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[100px] truncate">{r.warehouseName}</TableCell>
                      <TableCell className="text-sm font-medium">{r.quantityKg.toLocaleString()} kg</TableCell>
                      <TableCell><GradeBadge grade={r.grade} /></TableCell>
                      <TableCell>
                        {r.tokenId
                          ? <span className="font-mono text-xs text-primary">{r.tokenId}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.dateIssued).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell><DaysUntilExpiry expiryDate={r.expiryDate} /></TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 flex-wrap">
                          {r.status === "draft" && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 px-2 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
                              onClick={() => activateMutation.mutate(r.id)}
                              disabled={activateMutation.isPending}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Activate
                            </Button>
                          )}
                          {r.status === "active" && (
                            <>
                              <Button
                                size="sm" variant="outline"
                                className="h-7 px-2 text-xs border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                                onClick={() => lockMutation.mutate(r.id)}
                                disabled={lockMutation.isPending}
                              >
                                <Lock className="w-3 h-3 mr-1" /> Lock
                              </Button>
                              {!r.tokenId && (
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 px-2 text-xs border-primary/40 text-primary hover:bg-primary/10"
                                  onClick={() => tokenizeMutation.mutate(r.id)}
                                  disabled={tokenizeMutation.isPending}
                                >
                                  <Coins className="w-3 h-3 mr-1" /> Tokenize
                                </Button>
                              )}
                              <Button
                                size="sm" variant="outline"
                                className="h-7 px-2 text-xs border-purple-500/40 text-purple-400 hover:bg-purple-500/10"
                                onClick={() => setTransferReceipt(r)}
                              >
                                <ArrowRightLeft className="w-3 h-3 mr-1" /> Transfer
                              </Button>
                            </>
                          )}
                          {["collateral_locked", "expired", "settled", "under_trade"].includes(r.status) && (
                            <span className="text-xs text-muted-foreground italic">{STATUS_CONFIG[r.status]?.label}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === r.id && (
                      <TableRow className="border-border/30 bg-secondary/10 hover:bg-secondary/10">
                        <TableCell colSpan={12} className="py-3 px-6">
                          <DetailPanel receipt={r} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tab: Issue DWR */}
      {activeTab === "issue" && (
        <IssueDWRTab onSuccess={() => setActiveTab("receipts")} />
      )}

      {/* Tab: Reports */}
      {activeTab === "reports" && <ReportsTab />}

      {/* Tab: Audit Log */}
      {activeTab === "audit" && <AuditLogTab />}

      {/* Lifecycle reference (receipts tab only) */}
      {activeTab === "receipts" && (
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Receipt Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              {["Draft", "Active", "Collateral Locked", "Under Trade", "Settled"].map((s, i, arr) => (
                <div key={s} className="flex items-center gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border",
                    s === "Draft" ? "bg-secondary text-muted-foreground border-border"
                      : s === "Active" ? "bg-green-500/15 text-green-400 border-green-500/30"
                      : s === "Collateral Locked" ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                      : s === "Under Trade" ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                      : "bg-teal-500/15 text-teal-400 border-teal-500/30"
                  )}>
                    {s}
                  </span>
                  {i < arr.length - 1 && <span className="text-muted-foreground text-sm">→</span>}
                </div>
              ))}
              <span className="text-muted-foreground text-sm mx-1">|</span>
              <span className="px-3 py-1 rounded-full text-xs font-medium border bg-red-500/15 text-red-400 border-red-500/30">Expired</span>
              <span className="px-3 py-1 rounded-full text-xs font-medium border bg-gray-500/15 text-gray-400 border-gray-500/30">Cancelled</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transfer Modal */}
      {transferReceipt && (
        <TransferModal
          receipt={transferReceipt}
          users={users}
          onClose={() => setTransferReceipt(null)}
          onTransfer={(newOwnerId, notes) => transferMutation.mutate({ id: transferReceipt.id, newOwnerId, notes })}
        />
      )}
    </div>
  );
}
