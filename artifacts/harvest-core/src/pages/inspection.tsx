import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
  Badge, Button,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Input, Label, Select, SelectItem,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronRight, Thermometer, Droplets, Package,
  ShieldCheck, FlaskConical, Camera, FileText, Award, Plus, Trash2,
  Printer, Building2, User, Scale, Layers,
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

function MediaEvidenceSection() {
  const slots = [
    { icon: Camera, label: "Inspection Photos", count: 0, accept: "image/*", color: "text-blue-400", bg: "bg-blue-500/5 border-blue-500/20" },
    { icon: FlaskConical, label: "Lab Test Report", count: 0, accept: ".pdf,.docx", color: "text-purple-400", bg: "bg-purple-500/5 border-purple-500/20" },
    { icon: Award, label: "Certification Documents", count: 0, accept: ".pdf", color: "text-yellow-400", bg: "bg-yellow-500/5 border-yellow-500/20" },
    { icon: FileText, label: "Additional Attachments", count: 0, accept: "*", color: "text-muted-foreground", bg: "bg-secondary border-border/50" },
  ];
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
        <Camera className="w-3.5 h-3.5" /> Media Evidence
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {slots.map(({ icon: Icon, label, color, bg }) => (
          <button
            key={label}
            className={cn("flex flex-col items-center gap-2 p-3 rounded-lg border border-dashed text-center transition-colors hover:opacity-80", bg)}
          >
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

  const certs: any[] = Array.isArray(inspection.certifications)
    ? inspection.certifications
    : [];

  return (
    <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 space-y-4">
      {/* Quality Parameters */}
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

      {/* Weight & Packaging + Storage Conditions */}
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

      {/* Inspector + Certifications */}
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
                const certName = typeof c === "string" ? c : c.type ?? c.name ?? "Certificate";
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

      {/* Risk Flags */}
      {inspection.riskFlags?.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Risk Flags</p>
          <RiskFlagRow flags={inspection.riskFlags} />
        </div>
      )}

      {/* Media Evidence */}
      <MediaEvidenceSection />

      {inspection.notes && (
        <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-3">{inspection.notes}</p>
      )}
    </div>
  );
}

function InspectionReportModal({ inspection, onClose }: { inspection: any; onClose: () => void }) {
  const reportId = inspection.id?.toUpperCase().replace(/-/g, "").slice(0, 12);
  const dateStr = new Date(inspection.inspectionDate).toLocaleDateString("en-KE", {
    day: "numeric", month: "long", year: "numeric",
  });
  const certs: any[] = Array.isArray(inspection.certifications) ? inspection.certifications : [];
  const isCertified = certs.length > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Digital Inspection Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header block */}
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

          {/* Commodity & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Commodity</p>
              <p className="font-semibold">{inspection.commodity}</p>
              {inspection.variety && <p className="text-xs text-muted-foreground">{inspection.variety}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Warehouse</p>
              <p className="font-semibold">{inspection.warehouseName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Inspection Type</p>
              <p className="font-semibold">{INSPECTION_TYPE_LABELS[inspection.inspectionType] ?? inspection.inspectionType}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Grade</p>
              <div className="flex items-center gap-2">
                <GradeBadge grade={inspection.grade} />
                <span className="text-sm">{inspection.grade ? `Grade ${inspection.grade}` : "Not graded"}</span>
              </div>
            </div>
          </div>

          {/* Quality Summary */}
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

          {/* Weight & Damage */}
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

          {/* Certifications */}
          {isCertified && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Certifications</p>
              <div className="flex flex-wrap gap-2">
                {certs.map((c: any, idx: number) => {
                  const name = typeof c === "string" ? c : c.type ?? c.name ?? "Certificate";
                  return (
                    <span key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-medium">
                      <Award className="w-3.5 h-3.5" />
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Risk Flags */}
          {inspection.riskFlags?.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Risk Flags</p>
              <RiskFlagRow flags={inspection.riskFlags} />
            </div>
          )}

          {/* Inspector footer */}
          <div className="border-t border-border/50 pt-4 flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Inspection Officer</p>
              <p className="font-semibold">{inspection.inspectorName}</p>
              <p className="text-xs text-muted-foreground">{inspection.organization ?? "—"}</p>
              <p className="text-xs font-mono text-primary mt-0.5">License: {inspection.licenseNumber ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Certified</p>
              <p className={cn("font-semibold text-sm", isCertified ? "text-green-400" : "text-muted-foreground")}>
                {isCertified ? "✓ Yes" : "No"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="border-border/50">Close</Button>
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Printer className="w-4 h-4" /> Print / Export PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const COMMODITY_OPTIONS = ["Maize", "Coffee", "Wheat", "Rice", "Sorghum", "Beans", "Tea", "Cotton", "Sesame", "Millet"];
const GRADE_OPTIONS = ["A", "B", "C", "D", "Reject"];

type CertEntry = { type: string; authority: string; certNumber: string; validityDate: string };

function NewInspectionDialog({ onClose, warehouses, inspectors }: {
  onClose: () => void;
  warehouses: any[];
  inspectors: any[];
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    warehouseId: "",
    inspectorId: "",
    inspectionType: "intake",
    commodity: "",
    variety: "",
    moisturePercent: "",
    brokenGrainPercent: "",
    foreignMatterPercent: "",
    pestDamagePercent: "",
    moldPresent: false,
    aflatoxinDetected: false,
    discoloration: false,
    grade: "A",
    damageLevel: "none",
    netWeightKg: "",
    grossWeightKg: "",
    bagCount: "",
    packagingType: "bags",
    temperatureCelsius: "",
    humidityPercent: "",
    storageMethod: "",
    stackPosition: "",
    licenseNumber: "",
    organization: "",
    notes: "",
  });
  const [certs, setCerts] = useState<CertEntry[]>([]);
  const [error, setError] = useState("");

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const createMutation = useMutation({
    mutationFn: (body: any) => api("/inspections", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      if (data.error) { setError(data.error); return; }
      qc.invalidateQueries({ queryKey: ["inspections"] });
      onClose();
    },
    onError: (e: any) => setError(e.message),
  });

  const steps = ["Basic Info", "Quality", "Weight & Storage", "Certifications"];

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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            New Inspection
          </DialogTitle>
        </DialogHeader>

        {/* Step tabs */}
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
          {steps.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={cn(
                "flex-1 text-xs py-1.5 rounded-md font-medium transition-colors",
                step === i ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {step === 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Warehouse *</Label>
                  <Select
                    className="bg-secondary border-border/50 h-9 text-sm"
                    value={form.warehouseId}
                    onChange={(e) => set("warehouseId", e.target.value)}
                    placeholder="Select warehouse"
                  >
                    {warehouses.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Inspector *</Label>
                  <Select
                    className="bg-secondary border-border/50 h-9 text-sm"
                    value={form.inspectorId}
                    onChange={(e) => set("inspectorId", e.target.value)}
                    placeholder="Select inspector"
                  >
                    {inspectors.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Inspection Type</Label>
                  <Select
                    className="bg-secondary border-border/50 h-9 text-sm"
                    value={form.inspectionType}
                    onChange={(e) => set("inspectionType", e.target.value)}
                  >
                    {Object.entries(INSPECTION_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Commodity *</Label>
                  <Select
                    className="bg-secondary border-border/50 h-9 text-sm"
                    value={form.commodity}
                    onChange={(e) => set("commodity", e.target.value)}
                    placeholder="Select commodity"
                  >
                    {COMMODITY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Variety (optional)</Label>
                  <Input
                    className="bg-secondary border-border/50 h-9 text-sm"
                    placeholder="e.g. White Maize, Arabica"
                    value={form.variety}
                    onChange={(e) => set("variety", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Inspector Organization</Label>
                  <Input
                    className="bg-secondary border-border/50 h-9 text-sm"
                    placeholder="e.g. Kitale Inspection Unit"
                    value={form.organization}
                    onChange={(e) => set("organization", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">License Number</Label>
                  <Input
                    className="bg-secondary border-border/50 h-9 text-sm"
                    placeholder="e.g. INS-8821"
                    value={form.licenseNumber}
                    onChange={(e) => set("licenseNumber", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "moisturePercent", label: "Moisture Content (%)", placeholder: "e.g. 12.5" },
                  { key: "brokenGrainPercent", label: "Broken Grain (%)", placeholder: "e.g. 2.0" },
                  { key: "foreignMatterPercent", label: "Foreign Matter (%)", placeholder: "e.g. 1.2" },
                  { key: "pestDamagePercent", label: "Pest Damage (%)", placeholder: "e.g. 0.5" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="bg-secondary border-border/50 h-9 text-sm"
                      placeholder={placeholder}
                      value={(form as any)[key]}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Boolean flags */}
              <div className="grid grid-cols-3 gap-2">
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
                      (form as any)[key]
                        ? "bg-red-500/10 border-red-500/40 text-red-400"
                        : "bg-secondary border-border/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center",
                      (form as any)[key] ? "bg-red-500 border-red-500" : "border-border"
                    )}>
                      {(form as any)[key] && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Commodity Grade</Label>
                  <Select
                    className="bg-secondary border-border/50 h-9 text-sm"
                    value={form.grade}
                    onChange={(e) => set("grade", e.target.value)}
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Damage Level</Label>
                  <Select
                    className="bg-secondary border-border/50 h-9 text-sm"
                    value={form.damageLevel}
                    onChange={(e) => set("damageLevel", e.target.value)}
                  >
                    {["none", "minor", "moderate", "severe"].map((d) => (
                      <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" /> Weight & Packaging</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "netWeightKg", label: "Net Weight (kg)" },
                  { key: "grossWeightKg", label: "Gross Weight (kg)" },
                  { key: "bagCount", label: "Bag Count" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      className="bg-secondary border-border/50 h-9 text-sm"
                      placeholder="0"
                      value={(form as any)[key]}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-xs">Packaging Type</Label>
                  <Select
                    className="bg-secondary border-border/50 h-9 text-sm"
                    value={form.packagingType}
                    onChange={(e) => set("packagingType", e.target.value)}
                  >
                    {["bags", "bulk", "pallets"].map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 mt-2"><Thermometer className="w-3.5 h-3.5" /> Storage Conditions</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "temperatureCelsius", label: "Temperature (°C)" },
                  { key: "humidityPercent", label: "Humidity (%)" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="bg-secondary border-border/50 h-9 text-sm"
                      value={(form as any)[key]}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-xs">Storage Method</Label>
                  <Input
                    className="bg-secondary border-border/50 h-9 text-sm"
                    placeholder="e.g. Raised platform, Silo"
                    value={form.storageMethod}
                    onChange={(e) => set("storageMethod", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Stack Position</Label>
                  <Input
                    className="bg-secondary border-border/50 h-9 text-sm"
                    placeholder="e.g. Bay A, Row 3"
                    value={form.stackPosition}
                    onChange={(e) => set("stackPosition", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5 mt-1">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  className="bg-secondary border-border/50 text-sm resize-none"
                  rows={3}
                  placeholder="Additional observations..."
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Certifications & Compliance</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setCerts((c) => [...c, { type: "", authority: "", certNumber: "", validityDate: "" }])}
                >
                  <Plus className="w-3 h-3" /> Add Certificate
                </Button>
              </div>

              {certs.length === 0 && (
                <div className="text-center py-6 border border-dashed border-border/50 rounded-lg">
                  <Award className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No certifications added</p>
                  <p className="text-xs text-muted-foreground">e.g. Export Grade, Organic, Phytosanitary</p>
                </div>
              )}

              {certs.map((cert, idx) => (
                <div key={idx} className="bg-secondary/40 rounded-lg p-3 border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Certificate {idx + 1}</p>
                    <button
                      onClick={() => setCerts((c) => c.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "type", label: "Certification Type", placeholder: "e.g. Export Grade" },
                      { key: "authority", label: "Certification Authority", placeholder: "e.g. KEBS" },
                      { key: "certNumber", label: "Certificate Number", placeholder: "e.g. EX-2026-0031" },
                      { key: "validityDate", label: "Validity Date", placeholder: "e.g. 2027-01-15" },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <Input
                          className="bg-card border-border/50 h-8 text-xs"
                          placeholder={placeholder}
                          value={(cert as any)[key]}
                          onChange={(e) => setCerts((c) => c.map((item, i) => i === idx ? { ...item, [key]: e.target.value } : item))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <Button
              variant="outline"
              className="border-border/50"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="border-border/50" onClick={onClose}>Cancel</Button>
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)}>
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {createMutation.isPending ? "Saving…" : "Submit Inspection"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function InspectionPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [activeType, setActiveType] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [reportInspection, setReportInspection] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: () => api("/inspections"),
  });

  const { data: warehousesData } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api("/inventory/warehouses"),
    enabled: showNew,
  });

  const { data: usersData } = useQuery({
    queryKey: ["users-for-inspection"],
    queryFn: () => api("/users?limit=100"),
    enabled: showNew,
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
    .filter((i) => activeTab === "all" || i.status === activeTab)
    .filter((i) => activeType === "all" || i.inspectionType === activeType);

  const warehouses = warehousesData?.warehouses ?? [];
  const inspectors = usersData?.users ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Inspection & Quality</h1>
          <p className="text-sm text-muted-foreground mt-1">Commodity grading, quality verification, and risk assessment</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
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
        <CardHeader className="pb-0 px-6 pt-4 space-y-3">
          {/* Status filter */}
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
                {tab === "all"
                  ? `All (${inspections.length})`
                  : `${tab.charAt(0).toUpperCase() + tab.slice(1)} (${inspections.filter((i) => i.status === tab).length})`}
              </button>
            ))}
          </div>
          {/* Inspection type filter */}
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
                <button
                  key={key}
                  onClick={() => { setActiveType(key); setExpandedId(null); }}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
                    activeType === key
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  {label}
                  {count !== null && (
                    <span className={cn(
                      "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
                      activeType === key ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                    )}>
                      {count}
                    </span>
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
                    <TableCell className="font-mono text-xs text-muted-foreground">{ins.id.toUpperCase().slice(0, 12)}</TableCell>
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
                      <div className="flex gap-1 flex-wrap">
                        {ins.status === "pending" && (
                          <>
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
                          </>
                        )}
                        {ins.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => setReportInspection(ins)}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Report
                          </Button>
                        )}
                        {ins.status === "rejected" && (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Rejected
                          </span>
                        )}
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
              { flag: "Mold Detected", consequence: "Storage Risk", level: "warn" },
              { flag: "Discoloration Present", consequence: "Grade Review Required", level: "info" },
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

      {/* Dialogs */}
      {showNew && (
        <NewInspectionDialog
          onClose={() => setShowNew(false)}
          warehouses={warehouses}
          inspectors={inspectors}
        />
      )}
      {reportInspection && (
        <InspectionReportModal
          inspection={reportInspection}
          onClose={() => setReportInspection(null)}
        />
      )}
    </div>
  );
}
