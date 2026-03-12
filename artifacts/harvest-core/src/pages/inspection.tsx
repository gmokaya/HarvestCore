import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
  Button,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Input, Label, Select, SelectItem,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronRight, Thermometer, Camera, FileText, Award,
  Plus, Trash2, Printer, User, Scale, ShieldCheck, FlaskConical,
  Droplets, BadgeCheck, ClipboardList, TriangleAlert,
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

const COMMODITY_OPTIONS = ["Maize", "Coffee", "Wheat", "Rice", "Sorghum", "Beans", "Tea", "Cotton", "Sesame", "Millet"];
const GRADE_OPTIONS = ["A", "B", "C", "D", "Reject"];

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
          <AlertTriangle className="w-3 h-3" />{f}
        </span>
      ))}
    </div>
  );
}

function MediaEvidenceSection() {
  const slots = [
    { icon: Camera, label: "Inspection Photos", color: "text-blue-400", bg: "bg-blue-500/5 border-blue-500/20" },
    { icon: FlaskConical, label: "Lab Test Report", color: "text-purple-400", bg: "bg-purple-500/5 border-purple-500/20" },
    { icon: Award, label: "Certification Docs", color: "text-yellow-400", bg: "bg-yellow-500/5 border-yellow-500/20" },
    { icon: FileText, label: "Attachments", color: "text-muted-foreground", bg: "bg-secondary border-border/50" },
  ];
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> Media Evidence</p>
      <div className="grid grid-cols-4 gap-2">
        {slots.map(({ icon: Icon, label, color, bg }) => (
          <button key={label} className={cn("flex flex-col items-center gap-2 p-3 rounded-lg border border-dashed text-center hover:opacity-80 transition-colors", bg)}>
            <Icon className={cn("w-5 h-5", color)} />
            <span className="text-xs text-muted-foreground leading-tight">{label}</span>
            <span className={cn("text-xs font-medium", color)}>+ Upload</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ inspection }: { inspection: any }) {
  const qualityParams = [
    { label: "Moisture", value: inspection.moisturePercent != null ? `${inspection.moisturePercent}%` : "—", warn: inspection.moisturePercent > 14 },
    { label: "Broken Grain", value: inspection.brokenGrainPercent != null ? `${inspection.brokenGrainPercent}%` : "—", warn: false },
    { label: "Foreign Matter", value: inspection.foreignMatterPercent != null ? `${inspection.foreignMatterPercent}%` : "—", warn: inspection.foreignMatterPercent > 3 },
    { label: "Pest Damage", value: inspection.pestDamagePercent != null ? `${inspection.pestDamagePercent}%` : "—", warn: inspection.pestDamagePercent > 2 },
    { label: "Mold Present", value: inspection.moldPresent ? "Yes" : "No", warn: inspection.moldPresent },
    { label: "Aflatoxin", value: inspection.aflatoxinDetected ? "Detected" : "Not Detected", warn: inspection.aflatoxinDetected },
    { label: "Discoloration", value: inspection.discoloration ? "Present" : "None", warn: inspection.discoloration },
  ];
  const certs: any[] = Array.isArray(inspection.certifications) ? inspection.certifications : [];

  return (
    <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2">Quality Parameters</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {qualityParams.map((p) => (
            <div key={p.label} className={cn("bg-card rounded-lg p-3 border", p.warn ? "border-red-500/40" : "border-border/50")}>
              <p className="text-xs text-muted-foreground">{p.label}</p>
              <p className={cn("font-semibold text-sm mt-0.5", p.warn ? "text-red-400" : "text-foreground")}>{p.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" /> Weight & Packaging</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-card rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Net Weight</p>
              <p className="font-semibold text-sm">{inspection.netWeightKg ? `${Number(inspection.netWeightKg).toLocaleString()} kg` : "—"}</p>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Gross Weight</p>
              <p className="font-semibold text-sm">{inspection.grossWeightKg ? `${Number(inspection.grossWeightKg).toLocaleString()} kg` : "—"}</p>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border/50 col-span-2">
              <p className="text-xs text-muted-foreground">Bags / Packaging</p>
              <p className="font-semibold text-sm">{inspection.bagCount ? `${inspection.bagCount} × ${inspection.packagingType ?? "bags"}` : "—"}</p>
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5" /> Storage Conditions</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-card rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Temperature</p>
              <p className="font-semibold text-sm">{inspection.temperatureCelsius != null ? `${inspection.temperatureCelsius}°C` : "—"}</p>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Humidity</p>
              <p className="font-semibold text-sm">{inspection.humidityPercent != null ? `${inspection.humidityPercent}%` : "—"}</p>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Method</p>
              <p className="text-sm">{inspection.storageMethod ?? "—"}</p>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Stack Position</p>
              <p className="text-sm">{inspection.stackPosition ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Inspector Verification</p>
          <div className="bg-card rounded-lg p-3 border border-border/50 space-y-1.5">
            <p className="font-medium text-sm">{inspection.inspectorName}</p>
            <p className="text-xs text-muted-foreground">{inspection.organization ?? "—"}</p>
            <p className="text-xs font-mono text-primary">{inspection.licenseNumber ?? "—"}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Certifications</p>
          {certs.length > 0 ? (
            <div className="space-y-1.5">
              {certs.map((c: any, idx: number) => {
                const certName = typeof c === "string" ? c : c.type ?? "Certificate";
                const certAuth = typeof c === "object" ? c.authority : null;
                const certNum = typeof c === "object" ? c.certNumber : null;
                const certValid = typeof c === "object" ? c.validityDate : null;
                return (
                  <div key={idx} className="bg-card rounded-lg p-2.5 border border-primary/20 flex items-start gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-primary truncate">{certName}</p>
                      {certAuth && <p className="text-xs text-muted-foreground">{certAuth}</p>}
                      {certNum && <p className="text-xs font-mono text-muted-foreground">{certNum}</p>}
                      {certValid && <p className="text-xs text-muted-foreground">Valid until {certValid}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">No certifications recorded</p>
            </div>
          )}
        </div>
      </div>

      {inspection.riskFlags?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Risk Flags</p>
          <RiskFlagRow flags={inspection.riskFlags} />
        </div>
      )}
      <MediaEvidenceSection />
      {inspection.notes && (
        <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-3">{inspection.notes}</p>
      )}
    </div>
  );
}

function InspectionReportModal({ inspection, onClose }: { inspection: any; onClose: () => void }) {
  const reportId = inspection.id?.toUpperCase().replace(/-/g, "").slice(0, 12);
  const dateStr = new Date(inspection.inspectionDate).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
  const certs: any[] = Array.isArray(inspection.certifications) ? inspection.certifications : [];
  const isCertified = certs.length > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />Digital Inspection Report
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Inspection Report ID</p>
                <p className="font-mono font-bold text-primary text-lg">INS-{new Date(inspection.inspectionDate).getFullYear()}-{reportId}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={inspection.status} />
                <p className="text-xs text-muted-foreground mt-1">{dateStr}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["Commodity", `${inspection.commodity}${inspection.variety ? ` — ${inspection.variety}` : ""}`],
              ["Warehouse", inspection.warehouseName],
              ["Inspection Type", INSPECTION_TYPE_LABELS[inspection.inspectionType] ?? inspection.inspectionType],
              ["Grade", inspection.grade ? `Grade ${inspection.grade}` : "Not graded"],
            ].map(([label, value]) => (
              <div key={label} className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="font-semibold text-sm">{value}</p>
              </div>
            ))}
          </div>

          <div className="border border-border/50 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-secondary/50 border-b border-border/50">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quality Parameters</p>
            </div>
            <div className="divide-y divide-border/30">
              {[
                ["Moisture Content", inspection.moisturePercent != null ? `${inspection.moisturePercent}%` : "—", inspection.moisturePercent > 14],
                ["Broken Grain", inspection.brokenGrainPercent != null ? `${inspection.brokenGrainPercent}%` : "—", false],
                ["Foreign Matter", inspection.foreignMatterPercent != null ? `${inspection.foreignMatterPercent}%` : "—", inspection.foreignMatterPercent > 3],
                ["Pest Damage", inspection.pestDamagePercent != null ? `${inspection.pestDamagePercent}%` : "—", inspection.pestDamagePercent > 2],
                ["Mold / Aflatoxin", inspection.aflatoxinDetected ? "Aflatoxin Detected" : inspection.moldPresent ? "Mold Present" : "None Detected", inspection.aflatoxinDetected || inspection.moldPresent],
                ["Discoloration", inspection.discoloration ? "Present" : "None", inspection.discoloration],
              ].map(([label, value, warn]) => (
                <div key={label as string} className="flex items-center justify-between px-4 py-2.5">
                  <p className="text-sm text-muted-foreground">{label as string}</p>
                  <p className={cn("text-sm font-medium", warn ? "text-red-400" : "text-foreground")}>{value as string}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Net Weight</p>
              <p className="font-semibold text-sm mt-0.5">{inspection.netWeightKg ? `${Number(inspection.netWeightKg).toLocaleString()} kg` : "—"}</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Bag Count</p>
              <p className="font-semibold text-sm mt-0.5">{inspection.bagCount ? `${inspection.bagCount} ${inspection.packagingType ?? "bags"}` : "—"}</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Damage Level</p>
              <p className={cn("font-semibold text-sm mt-0.5 capitalize", DAMAGE_COLORS[inspection.damageLevel] ?? "")}>{inspection.damageLevel}</p>
            </div>
          </div>

          {isCertified && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Certifications</p>
              <div className="flex flex-wrap gap-2">
                {certs.map((c: any, idx: number) => (
                  <span key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-medium">
                    <Award className="w-3.5 h-3.5" />
                    {typeof c === "string" ? c : c.type ?? "Certificate"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {inspection.riskFlags?.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Risk Flags</p>
              <RiskFlagRow flags={inspection.riskFlags} />
            </div>
          )}

          <div className="border-t border-border/50 pt-4 flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Inspection Officer</p>
              <p className="font-semibold">{inspection.inspectorName}</p>
              <p className="text-xs text-muted-foreground">{inspection.organization ?? "—"}</p>
              <p className="text-xs font-mono text-primary mt-0.5">License: {inspection.licenseNumber ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Certified</p>
              <p className={cn("font-semibold text-sm", isCertified ? "text-green-400" : "text-muted-foreground")}>{isCertified ? "✓ Yes" : "No"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="border-border/50">Close</Button>
            <Button className="gap-2"><Printer className="w-4 h-4" /> Print / Export PDF</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── New Inspection Tab (inline form) ─────────────────────────────────────── */
type CertEntry = { type: string; authority: string; certNumber: string; validityDate: string };

function NewInspectionTab({ warehouses, inspectors, onSuccess }: {
  warehouses: any[];
  inspectors: any[];
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    warehouseId: "", inspectorId: "", inspectionType: "intake",
    commodity: "", variety: "",
    moisturePercent: "", brokenGrainPercent: "", foreignMatterPercent: "", pestDamagePercent: "",
    moldPresent: false, aflatoxinDetected: false, discoloration: false,
    grade: "A", damageLevel: "none",
    netWeightKg: "", grossWeightKg: "", bagCount: "", packagingType: "bags",
    temperatureCelsius: "", humidityPercent: "", storageMethod: "", stackPosition: "",
    licenseNumber: "", organization: "", notes: "",
  });
  const [certs, setCerts] = useState<CertEntry[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const createMutation = useMutation({
    mutationFn: (body: any) => api("/inspections", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      if (data.error) { setError(data.error); return; }
      qc.invalidateQueries({ queryKey: ["inspections"] });
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onSuccess(); }, 1500);
    },
    onError: (e: any) => setError(e.message),
  });

  const steps = [
    { label: "Basic Info", icon: ClipboardList },
    { label: "Quality", icon: FlaskConical },
    { label: "Weight & Storage", icon: Scale },
    { label: "Certifications", icon: Award },
  ];

  function handleSubmit() {
    if (!form.warehouseId) { setError("Warehouse is required"); return; }
    if (!form.inspectorId) { setError("Inspector is required"); return; }
    if (!form.commodity) { setError("Commodity is required"); return; }
    setError("");
    createMutation.mutate({
      ...form,
      moisturePercent: form.moisturePercent || null,
      brokenGrainPercent: form.brokenGrainPercent || null,
      foreignMatterPercent: form.foreignMatterPercent || null,
      pestDamagePercent: form.pestDamagePercent || null,
      netWeightKg: form.netWeightKg || null,
      grossWeightKg: form.grossWeightKg || null,
      bagCount: form.bagCount || null,
      temperatureCelsius: form.temperatureCelsius || null,
      humidityPercent: form.humidityPercent || null,
      certifications: certs,
      inspectionDate: new Date().toISOString(),
    });
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <CheckCircle2 className="w-12 h-12 text-green-400" />
        <p className="text-lg font-semibold text-green-400">Inspection Submitted</p>
        <p className="text-sm text-muted-foreground">Redirecting to Inspections list…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Step progress */}
      <div className="flex items-center gap-0">
        {steps.map(({ label, icon: Icon }, i) => (
          <Fragment key={label}>
            <button
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1 justify-center",
                step === i ? "bg-primary/10 text-primary" : i < step ? "text-green-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              {label}
            </button>
            {i < steps.length - 1 && <div className={cn("h-px flex-grow mx-1", i < step ? "bg-green-400/40" : "bg-border/40")} />}
          </Fragment>
        ))}
      </div>

      <Card className="bg-card border-border/50">
        <CardContent className="p-6 space-y-4">
          {/* Step 0: Basic Info */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Warehouse *</Label>
                  <Select className="bg-secondary border-border/50 h-9 text-sm" value={form.warehouseId} onChange={(e) => set("warehouseId", e.target.value)} placeholder="Select warehouse">
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Inspector *</Label>
                  <Select className="bg-secondary border-border/50 h-9 text-sm" value={form.inspectorId} onChange={(e) => set("inspectorId", e.target.value)} placeholder="Select inspector">
                    {inspectors.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Inspection Type</Label>
                  <Select className="bg-secondary border-border/50 h-9 text-sm" value={form.inspectionType} onChange={(e) => set("inspectionType", e.target.value)}>
                    {Object.entries(INSPECTION_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Commodity *</Label>
                  <Select className="bg-secondary border-border/50 h-9 text-sm" value={form.commodity} onChange={(e) => set("commodity", e.target.value)} placeholder="Select commodity">
                    {COMMODITY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Variety (optional)</Label>
                  <Input className="bg-secondary border-border/50 h-9 text-sm" placeholder="e.g. White Maize, Arabica" value={form.variety} onChange={(e) => set("variety", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Inspector Organization</Label>
                  <Input className="bg-secondary border-border/50 h-9 text-sm" placeholder="e.g. Kitale Inspection Unit" value={form.organization} onChange={(e) => set("organization", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">License Number</Label>
                  <Input className="bg-secondary border-border/50 h-9 text-sm" placeholder="e.g. INS-8821" value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Quality Parameters */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary" /> Quality Parameters</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "moisturePercent", label: "Moisture Content (%)", placeholder: "e.g. 12.5" },
                  { key: "brokenGrainPercent", label: "Broken Grain (%)", placeholder: "e.g. 2.0" },
                  { key: "foreignMatterPercent", label: "Foreign Matter (%)", placeholder: "e.g. 1.2" },
                  { key: "pestDamagePercent", label: "Pest Damage (%)", placeholder: "e.g. 0.5" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input type="number" step="0.1" className="bg-secondary border-border/50 h-9 text-sm" placeholder={placeholder} value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "moldPresent", label: "Mold Present" },
                  { key: "aflatoxinDetected", label: "Aflatoxin Detected" },
                  { key: "discoloration", label: "Discoloration" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set(key, !(form as any)[key])}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors",
                      (form as any)[key] ? "bg-red-500/10 border-red-500/40 text-red-400" : "bg-secondary border-border/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center", (form as any)[key] ? "bg-red-500 border-red-500" : "border-border")}>
                      {(form as any)[key] && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Commodity Grade</Label>
                  <Select className="bg-secondary border-border/50 h-9 text-sm" value={form.grade} onChange={(e) => set("grade", e.target.value)}>
                    {GRADE_OPTIONS.map((g) => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Damage Level</Label>
                  <Select className="bg-secondary border-border/50 h-9 text-sm" value={form.damageLevel} onChange={(e) => set("damageLevel", e.target.value)}>
                    {["none", "minor", "moderate", "severe"].map((d) => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Weight & Storage */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><Scale className="w-4 h-4 text-primary" /> Weight & Storage</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "netWeightKg", label: "Net Weight (kg)" },
                  { key: "grossWeightKg", label: "Gross Weight (kg)" },
                  { key: "bagCount", label: "Bag Count" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input type="number" className="bg-secondary border-border/50 h-9 text-sm" placeholder="0" value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-xs">Packaging Type</Label>
                  <Select className="bg-secondary border-border/50 h-9 text-sm" value={form.packagingType} onChange={(e) => set("packagingType", e.target.value)}>
                    {["bags", "bulk", "pallets"].map((p) => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                  </Select>
                </div>
                {[
                  { key: "temperatureCelsius", label: "Temperature (°C)" },
                  { key: "humidityPercent", label: "Humidity (%)" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input type="number" step="0.1" className="bg-secondary border-border/50 h-9 text-sm" value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-xs">Storage Method</Label>
                  <Input className="bg-secondary border-border/50 h-9 text-sm" placeholder="e.g. Raised platform, Silo" value={form.storageMethod} onChange={(e) => set("storageMethod", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Stack Position</Label>
                  <Input className="bg-secondary border-border/50 h-9 text-sm" placeholder="e.g. Bay A, Row 3" value={form.stackPosition} onChange={(e) => set("stackPosition", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea className="bg-secondary border-border/50 text-sm resize-none" rows={3} placeholder="Additional observations..." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 3: Certifications */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2"><Award className="w-4 h-4 text-primary" /> Certifications & Compliance</h3>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10" onClick={() => setCerts((c) => [...c, { type: "", authority: "", certNumber: "", validityDate: "" }])}>
                  <Plus className="w-3 h-3" /> Add Certificate
                </Button>
              </div>
              {certs.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border/50 rounded-lg">
                  <Award className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No certifications added</p>
                  <p className="text-xs text-muted-foreground mt-1">Examples: Export Grade · Organic · Phytosanitary · Warehouse Operator</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {certs.map((cert, idx) => (
                    <div key={idx} className="bg-secondary/40 rounded-lg p-4 border border-border/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Certificate {idx + 1}</p>
                        <button onClick={() => setCerts((c) => c.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: "type", label: "Certification Type", placeholder: "e.g. Export Grade" },
                          { key: "authority", label: "Certification Authority", placeholder: "e.g. KEBS" },
                          { key: "certNumber", label: "Certificate Number", placeholder: "e.g. EX-2026-0031" },
                          { key: "validityDate", label: "Validity Date", placeholder: "e.g. 2027-01-15" },
                        ].map(({ key, label, placeholder }) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs">{label}</Label>
                            <Input className="bg-card border-border/50 h-8 text-xs" placeholder={placeholder} value={(cert as any)[key]} onChange={(e) => setCerts((c) => c.map((item, i) => i === idx ? { ...item, [key]: e.target.value } : item))} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <Button variant="outline" className="border-border/50" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Next →</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={createMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {createMutation.isPending ? "Submitting…" : "Submit Inspection"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Certifications & Compliance Tab ──────────────────────────────────────── */
function CertificationsTab({ inspections }: { inspections: any[] }) {
  const allCerts = inspections.flatMap((ins) => {
    const certs: any[] = Array.isArray(ins.certifications) ? ins.certifications : [];
    return certs.map((c) => ({
      certName: typeof c === "string" ? c : c.type ?? "Certificate",
      authority: typeof c === "object" ? (c.authority ?? "—") : "—",
      certNumber: typeof c === "object" ? (c.certNumber ?? "—") : "—",
      validityDate: typeof c === "object" ? (c.validityDate ?? "—") : "—",
      commodity: ins.commodity,
      warehouse: ins.warehouseName,
      status: ins.status,
      date: ins.inspectionDate,
      inspectionId: ins.id,
    }));
  });

  const certTypes: Record<string, number> = {};
  allCerts.forEach((c) => { certTypes[c.certName] = (certTypes[c.certName] ?? 0) + 1; });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Certificates</p>
            <p className="text-2xl font-bold font-display text-primary">{allCerts.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Certificate Types</p>
            <p className="text-2xl font-bold font-display">{Object.keys(certTypes).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50 col-span-2">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">By Type</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(certTypes).map(([type, count]) => (
                <span key={type} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs">
                  <Award className="w-3 h-3" /> {type} <span className="font-bold">{count}</span>
                </span>
              ))}
              {Object.keys(certTypes).length === 0 && <span className="text-xs text-muted-foreground">No certifications on record</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cert table */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Certification Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allCerts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No certification records found across current inspections</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead>Certificate</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Cert Number</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Inspection Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allCerts.map((c, idx) => (
                  <TableRow key={idx} className="border-border/30">
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Award className="w-3.5 h-3.5 text-primary" /> {c.certName}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.authority}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.certNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.validityDate}</TableCell>
                    <TableCell className="text-sm">{c.commodity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.warehouse}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Inspector Registry Tab ────────────────────────────────────────────────── */
function InspectorRegistryTab({ inspections }: { inspections: any[] }) {
  const inspectorMap: Record<string, { name: string; org: string; license: string; count: number; lastDate: string; statuses: string[] }> = {};
  inspections.forEach((ins) => {
    const id = ins.inspectorId ?? ins.inspectorName;
    if (!inspectorMap[id]) {
      inspectorMap[id] = { name: ins.inspectorName, org: ins.organization ?? "—", license: ins.licenseNumber ?? "—", count: 0, lastDate: ins.inspectionDate, statuses: [] };
    }
    inspectorMap[id].count++;
    inspectorMap[id].statuses.push(ins.status);
    if (new Date(ins.inspectionDate) > new Date(inspectorMap[id].lastDate)) inspectorMap[id].lastDate = ins.inspectionDate;
  });
  const inspectors = Object.entries(inspectorMap).map(([id, v]) => ({ id, ...v }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Registered Inspectors</p>
            <p className="text-2xl font-bold font-display text-primary">{inspectors.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Inspections Conducted</p>
            <p className="text-2xl font-bold font-display">{inspections.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Approved Rate</p>
            <p className="text-2xl font-bold font-display text-green-400">
              {inspections.length > 0 ? Math.round((inspections.filter((i) => i.status === "approved").length / inspections.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-primary" /> Inspector Verification Registry</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {inspectors.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No inspector records found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead>Inspector</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>License Number</TableHead>
                  <TableHead>Inspections</TableHead>
                  <TableHead>Approval Rate</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspectors.map((insp) => {
                  const approved = insp.statuses.filter((s) => s === "approved").length;
                  const rate = insp.count > 0 ? Math.round((approved / insp.count) * 100) : 0;
                  return (
                    <TableRow key={insp.id} className="border-border/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {insp.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{insp.name}</p>
                            <p className="text-xs font-mono text-muted-foreground">{insp.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{insp.org}</TableCell>
                      <TableCell>
                        {insp.license !== "—" ? (
                          <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">{insp.license}</span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{insp.count}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", rate >= 70 ? "bg-green-400" : rate >= 40 ? "bg-yellow-400" : "bg-red-400")} style={{ width: `${rate}%` }} />
                          </div>
                          <span className={cn("text-xs font-medium", rate >= 70 ? "text-green-400" : rate >= 40 ? "text-yellow-400" : "text-red-400")}>{rate}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(insp.lastDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-xs text-green-400"><BadgeCheck className="w-3.5 h-3.5" /> Active</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Risk Engine Tab ───────────────────────────────────────────────────────── */
function RiskEngineTab({ inspections }: { inspections: any[] }) {
  const allFlags = inspections.flatMap((ins) =>
    (ins.riskFlags ?? []).map((f: string) => ({ flag: f, commodity: ins.commodity, warehouse: ins.warehouseName, status: ins.status, inspectionId: ins.id }))
  );

  const thresholds = [
    { flag: "Moisture > 14%", consequence: "High Storage Risk", level: "warn", icon: Droplets },
    { flag: "Aflatoxin Detected", consequence: "Financing Not Allowed", level: "danger", icon: XCircle },
    { flag: "Damage Level: Severe", consequence: "Reject", level: "danger", icon: XCircle },
    { flag: "Foreign Matter > 3%", consequence: "Downgrade Required", level: "warn", icon: AlertTriangle },
    { flag: "Pest Damage > 2%", consequence: "Fumigation Required", level: "warn", icon: AlertTriangle },
    { flag: "Humidity > 70%", consequence: "Storage Review", level: "info", icon: Thermometer },
    { flag: "Mold Detected", consequence: "Storage Risk", level: "warn", icon: AlertTriangle },
    { flag: "Discoloration Present", consequence: "Grade Review Required", level: "info", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* Active flags summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Active Risk Flags</p>
            <p className="text-2xl font-bold font-display text-red-400">{allFlags.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Inspections Flagged</p>
            <p className="text-2xl font-bold font-display text-orange-400">{inspections.filter((i) => i.riskFlags?.length > 0).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Financing Blocked</p>
            <p className="text-2xl font-bold font-display text-red-400">
              {inspections.filter((i) => i.riskFlags?.some((f: string) => f.includes("Aflatoxin"))).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active flag log */}
      {allFlags.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><TriangleAlert className="w-4 h-4 text-orange-400" /> Active Risk Flags</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead>Flag</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Inspection Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allFlags.map((f, idx) => (
                  <TableRow key={idx} className="border-border/30">
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-red-400 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{f.flag}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{f.commodity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.warehouse}</TableCell>
                    <TableCell><StatusBadge status={f.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Threshold reference */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary" /> Loan Risk Engine — Threshold Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {thresholds.map(({ flag, consequence, level, icon: Icon }) => (
              <div key={flag} className={cn(
                "flex items-start gap-3 p-4 rounded-lg border",
                level === "danger" ? "bg-red-500/5 border-red-500/20" : level === "warn" ? "bg-yellow-500/5 border-yellow-500/20" : "bg-blue-500/5 border-blue-500/20"
              )}>
                <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", level === "danger" ? "text-red-400" : level === "warn" ? "text-yellow-400" : "text-blue-400")} />
                <div>
                  <p className={cn("text-sm font-medium", level === "danger" ? "text-red-400" : level === "warn" ? "text-yellow-400" : "text-blue-400")}>{flag}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">→ {consequence}</p>
                </div>
                <span className={cn(
                  "ml-auto text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0",
                  level === "danger" ? "bg-red-500/10 border-red-500/30 text-red-400" : level === "warn" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                )}>
                  {level === "danger" ? "Critical" : level === "warn" ? "Warning" : "Advisory"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */
export default function InspectionPage() {
  const qc = useQueryClient();
  const [activeMainTab, setActiveMainTab] = useState("inspections");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState("all");
  const [activeType, setActiveType] = useState("all");
  const [reportInspection, setReportInspection] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: () => api("/inspections"),
  });

  const { data: warehousesData } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api("/inventory/warehouses"),
    enabled: activeMainTab === "new",
  });

  const { data: usersData } = useQuery({
    queryKey: ["users-for-inspection"],
    queryFn: () => api("/users?limit=100"),
    enabled: activeMainTab === "new",
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
  const filtered = inspections
    .filter((i) => activeStatus === "all" || i.status === activeStatus)
    .filter((i) => activeType === "all" || i.inspectionType === activeType);

  const warehouses = warehousesData?.warehouses ?? [];
  const inspectors = usersData?.users ?? [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Inspection & Quality</h1>
          <p className="text-sm text-muted-foreground mt-1">Commodity grading, quality verification, and risk assessment</p>
        </div>
        <Button onClick={() => setActiveMainTab("new")} className="gap-2">
          <ClipboardCheck className="w-4 h-4" /> New Inspection
        </Button>
      </div>

      {/* Stats bar */}
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

      {/* Main tabs */}
      <div className="flex items-center gap-1 bg-secondary/40 border border-border/50 rounded-lg p-1">
        {[
          { key: "inspections", label: "Inspections", icon: ClipboardList },
          { key: "new", label: "New Inspection", icon: Plus },
          { key: "certifications", label: "Certifications & Compliance", icon: Award },
          { key: "inspectors", label: "Inspector Registry", icon: BadgeCheck },
          { key: "risk", label: "Risk Engine", icon: TriangleAlert },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveMainTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors flex-1 justify-center",
              activeMainTab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Inspections tab ── */}
      {activeMainTab === "inspections" && (
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-0 px-6 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                {["all", "approved", "pending", "rejected"].map((tab) => (
                  <button key={tab} onClick={() => setActiveStatus(tab)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", activeStatus === tab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                    {tab === "all" ? `All (${inspections.length})` : `${tab.charAt(0).toUpperCase() + tab.slice(1)} (${inspections.filter((i) => i.status === tab).length})`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-border/30 pt-3">
                <span className="text-xs text-muted-foreground mr-1">Type:</span>
                {[
                  { key: "all", label: "All Types" },
                  { key: "intake", label: "Intake" },
                  { key: "periodic", label: "Periodic" },
                  { key: "pre_dispatch", label: "Pre-Dispatch" },
                  { key: "collateral_verification", label: "Collateral Verify" },
                ].map(({ key, label }) => {
                  const count = key === "all" ? null : inspections.filter((i) => i.inspectionType === key).length;
                  return (
                    <button key={key} onClick={() => { setActiveType(key); setExpandedId(null); }} className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5", activeType === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60")}>
                      {label}
                      {count !== null && (
                        <span className={cn("inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold", activeType === key ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>{count}</span>
                      )}
                    </button>
                  );
                })}
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
                  {isLoading && <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-12">Loading inspections…</TableCell></TableRow>}
                  {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-12">No inspections found</TableCell></TableRow>}
                  {filtered.map((ins) => (
                    <Fragment key={ins.id}>
                      <TableRow className="cursor-pointer border-border/30" onClick={() => setExpandedId(expandedId === ins.id ? null : ins.id)}>
                        <TableCell className="w-8 text-muted-foreground">
                          {expandedId === ins.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{ins.id.toUpperCase().slice(0, 12)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{ins.commodity}</p>
                            {ins.variety && <p className="text-xs text-muted-foreground">{ins.variety}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{ins.warehouseName}</TableCell>
                        <TableCell><span className="text-xs text-muted-foreground">{INSPECTION_TYPE_LABELS[ins.inspectionType] ?? ins.inspectionType}</span></TableCell>
                        <TableCell><GradeBadge grade={ins.grade} /></TableCell>
                        <TableCell><span className={cn("text-sm font-medium", ins.moisturePercent > 14 ? "text-red-400" : "text-foreground")}>{ins.moisturePercent != null ? `${ins.moisturePercent}%` : "—"}</span></TableCell>
                        <TableCell><span className={cn("text-sm capitalize font-medium", DAMAGE_COLORS[ins.damageLevel] ?? "text-foreground")}>{ins.damageLevel}</span></TableCell>
                        <TableCell>
                          {ins.riskFlags?.length > 0 ? (
                            <span className="flex items-center gap-1 text-red-400 text-xs"><AlertTriangle className="w-3.5 h-3.5" />{ins.riskFlags.length} flag{ins.riskFlags.length > 1 ? "s" : ""}</span>
                          ) : (
                            <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Clear</span>
                          )}
                        </TableCell>
                        <TableCell><StatusBadge status={ins.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(ins.inspectionDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 flex-wrap">
                            {ins.status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10" onClick={() => approveMutation.mutate(ins.id)} disabled={approveMutation.isPending}>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />Approve
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10" onClick={() => rejectMutation.mutate(ins.id)} disabled={rejectMutation.isPending}>Reject</Button>
                              </>
                            )}
                            {ins.status === "approved" && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10" onClick={() => setReportInspection(ins)}>
                                <FileText className="w-3 h-3 mr-1" />Report
                              </Button>
                            )}
                            {ins.status === "rejected" && <span className="text-xs text-red-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />Rejected</span>}
                          </div>
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
      )}

      {/* ── New Inspection tab ── */}
      {activeMainTab === "new" && (
        <NewInspectionTab
          warehouses={warehouses}
          inspectors={inspectors}
          onSuccess={() => setActiveMainTab("inspections")}
        />
      )}

      {/* ── Certifications tab ── */}
      {activeMainTab === "certifications" && (
        <CertificationsTab inspections={inspections} />
      )}

      {/* ── Inspector Registry tab ── */}
      {activeMainTab === "inspectors" && (
        <InspectorRegistryTab inspections={inspections} />
      )}

      {/* ── Risk Engine tab ── */}
      {activeMainTab === "risk" && (
        <RiskEngineTab inspections={inspections} />
      )}

      {reportInspection && (
        <InspectionReportModal inspection={reportInspection} onClose={() => setReportInspection(null)} />
      )}
    </div>
  );
}
