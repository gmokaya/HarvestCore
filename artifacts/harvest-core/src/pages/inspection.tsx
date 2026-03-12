import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
  Badge, Button,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronRight, Thermometer, Droplets, Package,
  ShieldCheck, FlaskConical, Eye,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function api(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock-token-admin-001" },
    ...opts,
  }).then((r) => r.json());
}

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  intake: "Intake",
  periodic: "Periodic",
  pre_dispatch: "Pre-Dispatch",
  collateral_verification: "Collateral Verify",
};

const DAMAGE_COLORS: Record<string, string> = {
  none: "text-green-400",
  minor: "text-yellow-400",
  moderate: "text-orange-400",
  severe: "text-red-400",
};

const STATUS_VARIANT: Record<string, string> = {
  approved: "bg-green-500/15 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
  draft: "bg-secondary text-muted-foreground border-border",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", STATUS_VARIANT[status] ?? STATUS_VARIANT.draft)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-muted-foreground text-xs">—</span>;
  const colors: Record<string, string> = {
    A: "bg-green-500/15 text-green-400 border-green-500/30",
    B: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    C: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    D: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    Reject: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border", colors[grade] ?? "bg-secondary text-foreground border-border")}>
      {grade}
    </span>
  );
}

function RiskFlagRow({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {flags.map((f) => (
        <span key={f} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          <AlertTriangle className="w-3 h-3" />
          {f}
        </span>
      ))}
    </div>
  );
}

function DetailPanel({ inspection }: { inspection: any }) {
  const params = [
    { label: "Moisture", value: inspection.moisturePercent != null ? `${inspection.moisturePercent}%` : "—", warn: inspection.moisturePercent > 14 },
    { label: "Broken Grain", value: inspection.brokenGrainPercent != null ? `${inspection.brokenGrainPercent}%` : "—", warn: false },
    { label: "Foreign Matter", value: inspection.foreignMatterPercent != null ? `${inspection.foreignMatterPercent}%` : "—", warn: inspection.foreignMatterPercent > 3 },
    { label: "Pest Damage", value: inspection.pestDamagePercent != null ? `${inspection.pestDamagePercent}%` : "—", warn: inspection.pestDamagePercent > 2 },
    { label: "Mold Present", value: inspection.moldPresent ? "Yes" : "No", warn: inspection.moldPresent },
    { label: "Aflatoxin", value: inspection.aflatoxinDetected ? "Detected" : "Not Detected", warn: inspection.aflatoxinDetected },
  ];

  return (
    <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {params.map((p) => (
          <div key={p.label} className={cn("bg-card rounded-lg p-3 border", p.warn ? "border-red-500/40" : "border-border/50")}>
            <p className="text-xs text-muted-foreground">{p.label}</p>
            <p className={cn("font-semibold text-sm mt-0.5", p.warn ? "text-red-400" : "text-foreground")}>{p.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground">Net Weight</p>
          <p className="font-semibold text-sm">{inspection.netWeightKg ? `${inspection.netWeightKg.toLocaleString()} kg` : "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground">Bags / Packaging</p>
          <p className="font-semibold text-sm">{inspection.bagCount ? `${inspection.bagCount} × ${inspection.packagingType}` : "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50 flex items-start gap-2">
          <Thermometer className="w-4 h-4 text-orange-400 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">Temperature</p>
            <p className="font-semibold text-sm">{inspection.temperatureCelsius != null ? `${inspection.temperatureCelsius}°C` : "—"}</p>
          </div>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50 flex items-start gap-2">
          <Droplets className="w-4 h-4 text-blue-400 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">Humidity</p>
            <p className="font-semibold text-sm">{inspection.humidityPercent != null ? `${inspection.humidityPercent}%` : "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Storage</p>
          <p className="text-sm">{inspection.storageMethod ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">{inspection.stackPosition ?? ""}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Inspector</p>
          <p className="text-sm font-medium">{inspection.inspectorName}</p>
          <p className="text-xs text-muted-foreground">{inspection.organization}</p>
          <p className="text-xs text-muted-foreground font-mono">{inspection.licenseNumber}</p>
        </div>
      </div>

      {inspection.certifications?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Certifications</p>
          <div className="flex flex-wrap gap-1.5">
            {inspection.certifications.map((c: string) => (
              <span key={c} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs">
                <ShieldCheck className="w-3 h-3" />
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {inspection.riskFlags?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Risk Flags</p>
          <RiskFlagRow flags={inspection.riskFlags} />
        </div>
      )}

      {inspection.notes && (
        <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-3">{inspection.notes}</p>
      )}
    </div>
  );
}

export default function InspectionPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: () => api("/inspections"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api(`/inspections/${id}/approve`, { method: "PATCH", body: JSON.stringify({ approvedBy: "admin-001" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspections"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api(`/inspections/${id}/reject`, { method: "PATCH", body: JSON.stringify({ notes: "Failed quality standards" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspections"] }),
  });

  const inspections: any[] = data?.inspections ?? [];
  const stats = data?.stats ?? {};

  const filtered = activeTab === "all" ? inspections : inspections.filter((i) => i.status === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Inspection & Quality</h1>
          <p className="text-sm text-muted-foreground mt-1">Commodity grading, quality verification, and risk assessment</p>
        </div>
        <Button className="gap-2">
          <ClipboardCheck className="w-4 h-4" />
          New Inspection
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total ?? 0, icon: ClipboardCheck, color: "text-foreground" },
          { label: "Approved", value: stats.approved ?? 0, icon: CheckCircle2, color: "text-green-400" },
          { label: "Pending", value: stats.pending ?? 0, icon: Clock, color: "text-yellow-400" },
          { label: "Rejected", value: stats.rejected ?? 0, icon: XCircle, color: "text-red-400" },
          { label: "Risk Flagged", value: stats.riskFlagged ?? 0, icon: AlertTriangle, color: "text-orange-400" },
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

      {/* Table */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-0 px-6 pt-4">
          <div className="flex items-center gap-2">
            {["all", "approved", "pending", "rejected"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  activeTab === tab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {tab === "all" ? `All (${inspections.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-8" />
                <TableHead>Inspection ID</TableHead>
                <TableHead>Commodity</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Moisture</TableHead>
                <TableHead>Damage</TableHead>
                <TableHead>Risk Flags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-12">Loading inspections…</TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-12">No inspections found</TableCell>
                </TableRow>
              )}
              {filtered.map((ins) => (
                <Fragment key={ins.id}>
                  <TableRow
                    className="cursor-pointer border-border/30"
                    onClick={() => setExpandedId(expandedId === ins.id ? null : ins.id)}
                  >
                    <TableCell className="w-8 text-muted-foreground">
                      {expandedId === ins.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{ins.id.toUpperCase()}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{ins.commodity}</p>
                        {ins.variety && <p className="text-xs text-muted-foreground">{ins.variety}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{ins.warehouseName}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{INSPECTION_TYPE_LABELS[ins.inspectionType] ?? ins.inspectionType}</span>
                    </TableCell>
                    <TableCell><GradeBadge grade={ins.grade} /></TableCell>
                    <TableCell>
                      <span className={cn("text-sm font-medium", ins.moisturePercent > 14 ? "text-red-400" : "text-foreground")}>
                        {ins.moisturePercent != null ? `${ins.moisturePercent}%` : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-sm capitalize font-medium", DAMAGE_COLORS[ins.damageLevel] ?? "text-foreground")}>
                        {ins.damageLevel}
                      </span>
                    </TableCell>
                    <TableCell>
                      {ins.riskFlags?.length > 0 ? (
                        <span className="flex items-center gap-1 text-red-400 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {ins.riskFlags.length} flag{ins.riskFlags.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-green-400 text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Clear
                        </span>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={ins.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(ins.inspectionDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {ins.status === "pending" && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
                            onClick={() => approveMutation.mutate(ins.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                            onClick={() => rejectMutation.mutate(ins.id)}
                            disabled={rejectMutation.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {ins.status === "approved" && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      )}
                      {ins.status === "rejected" && (
                        <span className="text-xs text-red-400 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Rejected
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedId === ins.id && (
                    <TableRow className="border-border/30 bg-secondary/10 hover:bg-secondary/10">
                      <TableCell colSpan={12} className="py-3 px-6">
                        <DetailPanel inspection={ins} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Risk Legend */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" />
            Loan Risk Engine Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { flag: "Moisture > 14%", consequence: "High Storage Risk", level: "warn" },
              { flag: "Aflatoxin Detected", consequence: "Financing Not Allowed", level: "danger" },
              { flag: "Damage Level: Severe", consequence: "Reject", level: "danger" },
              { flag: "Foreign Matter > 3%", consequence: "Downgrade Required", level: "warn" },
              { flag: "Pest Damage > 2%", consequence: "Fumigation Required", level: "warn" },
              { flag: "Humidity > 70%", consequence: "Storage Review", level: "info" },
            ].map(({ flag, consequence, level }) => (
              <div key={flag} className={cn(
                "flex items-start gap-2 p-3 rounded-lg border text-xs",
                level === "danger" ? "bg-red-500/5 border-red-500/20 text-red-400"
                  : level === "warn" ? "bg-yellow-500/5 border-yellow-500/20 text-yellow-400"
                  : "bg-blue-500/5 border-blue-500/20 text-blue-400"
              )}>
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">{flag}</p>
                  <p className="opacity-75 mt-0.5">→ {consequence}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
