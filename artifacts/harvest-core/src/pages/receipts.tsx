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
  Building2, User, Link2, Package,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function api(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock-token-admin-001" },
    ...opts,
  }).then((r) => r.json());
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  draft: { label: "Draft", class: "bg-secondary text-muted-foreground border-border" },
  active: { label: "Active", class: "bg-green-500/15 text-green-400 border-green-500/30" },
  collateral_locked: { label: "Collateral Locked", class: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  under_trade: { label: "Under Trade", class: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  settled: { label: "Settled", class: "bg-teal-500/15 text-teal-400 border-teal-500/30" },
  expired: { label: "Expired", class: "bg-red-500/15 text-red-400 border-red-500/30" },
  cancelled: { label: "Cancelled", class: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
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

function DetailPanel({ receipt }: { receipt: any }) {
  const hasSignatures = receipt.warehouseOperatorSignature || receipt.inspectionAuthoritySignature || receipt.registrySignature;
  return (
    <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Package className="w-3 h-3" /> Commodity</p>
          <p className="font-semibold text-sm">{receipt.commodity}</p>
          <p className="text-xs text-muted-foreground">Grade {receipt.grade} · {receipt.packagingType}</p>
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

export default function ReceiptsPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["receipts"],
    queryFn: () => api("/receipts"),
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => api(`/receipts/${id}/lock-collateral`, { method: "PATCH", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receipts"] }),
  });

  const tokenizeMutation = useMutation({
    mutationFn: (id: string) => api(`/receipts/${id}/tokenize`, { method: "PATCH", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receipts"] }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api(`/receipts/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receipts"] }),
  });

  const receipts: any[] = data?.receipts ?? [];
  const stats = data?.stats ?? {};

  const TAB_FILTERS: Record<string, string | null> = {
    all: null,
    active: "active",
    collateral_locked: "collateral_locked",
    draft: "draft",
    expired: "expired",
  };

  const filtered = activeTab === "all" ? receipts : receipts.filter((r) => r.status === TAB_FILTERS[activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Digital Warehouse Receipts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verifiable proof of commodity ownership, quality, and storage — the collateral instrument
          </p>
        </div>
        <Button className="gap-2">
          <FileCheck2 className="w-4 h-4" />
          Issue Receipt
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Receipts", value: stats.total ?? 0, icon: FileCheck2, color: "text-foreground" },
          { label: "Active", value: stats.active ?? 0, icon: CheckCircle2, color: "text-green-400" },
          { label: "Collateral Locked", value: stats.collateralLocked ?? 0, icon: Lock, color: "text-blue-400" },
          { label: "Under Trade", value: stats.underTrade ?? 0, icon: BarChart3, color: "text-purple-400" },
          { label: "Expired", value: stats.expired ?? 0, icon: AlertTriangle, color: "text-red-400" },
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

      {/* Total KG Under Management */}
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

      {/* Receipts Table */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-0 px-6 pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            {Object.keys(TAB_FILTERS).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  activeTab === tab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
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
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border",
                        r.grade === "A" ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : r.grade === "B" ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                          : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                      )}>
                        {r.grade}
                      </span>
                    </TableCell>
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
                      <div className="flex items-center gap-1">
                        {r.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
                            onClick={() => activateMutation.mutate(r.id)}
                            disabled={activateMutation.isPending}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Activate
                          </Button>
                        )}
                        {r.status === "active" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                              onClick={() => lockMutation.mutate(r.id)}
                              disabled={lockMutation.isPending}
                            >
                              <Lock className="w-3 h-3 mr-1" />
                              Lock
                            </Button>
                            {!r.tokenId && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-primary/40 text-primary hover:bg-primary/10"
                                onClick={() => tokenizeMutation.mutate(r.id)}
                                disabled={tokenizeMutation.isPending}
                              >
                                <Coins className="w-3 h-3 mr-1" />
                                Tokenize
                              </Button>
                            )}
                          </>
                        )}
                        {(r.status === "collateral_locked" || r.status === "expired" || r.status === "settled") && (
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

      {/* Lifecycle Reference */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
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
    </div>
  );
}
