import { useState, Fragment } from "react"
import { useListIntakes, useApproveIntake, useRejectIntake, useListWarehouses, useCreateWarehouse, useListUsers } from "@workspace/api-client-react"
import { useAuth } from "@/contexts/auth"
import { useQueryClient } from "@tanstack/react-query"
import {
  Card, CardHeader, CardTitle, CardContent,
  Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Button, Dialog, DialogContent, DialogHeader, DialogTitle,
  Input, Label, Textarea, Select, SelectItem,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Progress,
} from "@/components/ui"
import { cn, formatWeight } from "@/lib/utils"
import { downloadPDF } from "@/lib/pdf-report"
import {
  Scale, Plus, CheckCircle2, XCircle, Droplets, Tag, ClipboardList,
  Warehouse, ChevronRight, AlertCircle, Link2, Leaf, Hash,
  Globe, RefreshCw, Upload, Download, ShieldCheck, Clock, AlertTriangle, Send,
} from "lucide-react"

const COMMODITIES = ["Maize", "Coffee", "Wheat", "Rice", "Sorghum", "Beans", "Tea", "Cotton", "Sesame", "Millet"]
const GRADES = ["A", "B", "C", "D"]

const PIPELINE_STAGES = [
  { key: "pending",  label: "Intake",    step: 1, color: "text-slate-400",   bg: "bg-slate-400"   },
  { key: "graded",   label: "Graded",    step: 2, color: "text-amber-400",   bg: "bg-amber-400"   },
  { key: "weighed",  label: "GRN",       step: 3, color: "text-blue-400",    bg: "bg-blue-400"    },
  { key: "verified", label: "Verified",  step: 4, color: "text-violet-400",  bg: "bg-violet-400"  },
  { key: "anchored", label: "Anchored",  step: 5, color: "text-emerald-400", bg: "bg-emerald-400" },
  { key: "rejected", label: "Rejected",  step: 0, color: "text-red-400",     bg: "bg-red-400"     },
]

const getStage = (status: string) => PIPELINE_STAGES.find(s => s.key === status) ?? PIPELINE_STAGES[0]

function StepIndicator({ status }: { status: string }) {
  const stages = PIPELINE_STAGES.filter(s => s.key !== "rejected")
  const currentStep = getStage(status).step
  const isRejected = status === "rejected"

  if (isRejected) return (
    <div className="flex items-center gap-1">
      <Badge variant="destructive">Rejected</Badge>
    </div>
  )

  return (
    <div className="flex items-center gap-0.5">
      {stages.map((stage, i) => (
        <div key={stage.key} className="flex items-center">
          <div className={cn(
            "w-2 h-2 rounded-full transition-all",
            currentStep > stage.step ? "bg-emerald-400" :
            currentStep === stage.step ? stage.bg + " ring-2 ring-offset-1 ring-offset-card ring-current scale-125" :
            "bg-muted"
          )} />
          {i < stages.length - 1 && (
            <div className={cn("w-3 h-px transition-all", currentStep > stage.step ? "bg-emerald-400/60" : "bg-muted")} />
          )}
        </div>
      ))}
      <span className={cn("ml-2 text-xs font-medium", getStage(status).color)}>{getStage(status).label}</span>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3 flex flex-col gap-1 bg-card/60 border-border/50")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-2xl font-bold font-display", color)}>{value}</span>
    </div>
  )
}

export default function Inventory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading, refetch } = useListIntakes()
  const { data: warehouseData, refetch: refetchWarehouses } = useListWarehouses()
  const { data: usersData } = useListUsers()
  const approveIntake = useApproveIntake()
  const rejectIntake = useRejectIntake()
  const createWarehouse = useCreateWarehouse()

  const [showNewIntake, setShowNewIntake] = useState(false)
  const [showNewWarehouse, setShowNewWarehouse] = useState(false)
  const [warehouseForm, setWarehouseForm] = useState({ name: "", location: "", capacity: "", operatorId: "" })
  const [warehouseError, setWarehouseError] = useState("")
  const [gradeDialog, setGradeDialog] = useState<string | null>(null)
  const [weighDialog, setWeighDialog] = useState<string | null>(null)
  const [rejectDialog, setRejectDialog] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [newIntakeForm, setNewIntakeForm] = useState({
    farmerId: "farmer-001", warehouseId: "", commodity: "", variety: "", weightKg: "", moisturePercent: ""
  })
  const [gradeForm, setGradeForm] = useState({ grade: "", moisturePercent: "", checkerNotes: "" })
  const [weighForm, setWeighForm] = useState({ grnNumber: "", confirmedWeightKg: "" })
  const [rejectReason, setRejectReason] = useState("")

  const [submitting, setSubmitting] = useState(false)

  const [registryQueue, setRegistryQueue] = useState<any[]>([])
  const [registryStats, setRegistryStats] = useState<any>(null)
  const [registryLoading, setRegistryLoading] = useState(false)
  const [selectedIntakes, setSelectedIntakes] = useState<Set<string>>(new Set())
  const [pulledRecords, setPulledRecords] = useState<any[]>([])
  const [syncing, setSyncing] = useState<string | null>(null)
  const [pullLoading, setPullLoading] = useState(false)
  const [submitPayload, setSubmitPayload] = useState<any>(null)

  const intakes = data?.intakes ?? []
  const warehouses = warehouseData?.warehouses ?? []
  const stageCounts = intakes.reduce((acc: Record<string, number>, intake: any) => {
    acc[intake.status] = (acc[intake.status] ?? 0) + 1
    return acc
  }, {})

  const callApi = async (path: string, method: string, body?: any) => {
    const r = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: "Bearer mock-token-admin-001" },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  }

  const loadRegistryData = async () => {
    setRegistryLoading(true)
    try {
      const [queue, stats] = await Promise.all([
        callApi("/ewrs/queue", "GET"),
        callApi("/ewrs/stats", "GET"),
      ])
      setRegistryQueue(queue.intakes ?? [])
      setRegistryStats(stats)
    } catch (err) {
      console.error(err)
    } finally {
      setRegistryLoading(false)
    }
  }

  const handleCreateWarehouse = async () => {
    setWarehouseError("")
    if (!warehouseForm.name || !warehouseForm.location || !warehouseForm.capacity || !warehouseForm.operatorId) {
      setWarehouseError("All fields are required.")
      return
    }
    try {
      await createWarehouse.mutateAsync({ data: {
        name: warehouseForm.name,
        location: warehouseForm.location,
        capacity: parseFloat(warehouseForm.capacity),
        operatorId: warehouseForm.operatorId,
      }})
      setShowNewWarehouse(false)
      setWarehouseForm({ name: "", location: "", capacity: "", operatorId: "" })
      refetchWarehouses()
    } catch (e: any) {
      setWarehouseError(e?.message ?? "Failed to create warehouse")
    }
  }

  const handleSubmitToRegistry = async (intakeId: string) => {
    try {
      const result = await callApi(`/ewrs/submit/${intakeId}`, "POST")
      setSubmitPayload(result)
      await loadRegistryData()
      refetch()
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmitBatch = async () => {
    if (selectedIntakes.size === 0) return
    setSubmitting(true)
    try {
      await callApi("/ewrs/submit-batch", "POST", { intakeIds: Array.from(selectedIntakes) })
      setSelectedIntakes(new Set())
      setTimeout(async () => { await loadRegistryData(); refetch() }, 4500)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSync = async (intakeId: string) => {
    setSyncing(intakeId)
    try {
      await callApi(`/ewrs/sync/${intakeId}`, "POST")
      await loadRegistryData()
      refetch()
    } catch (err) {
      console.error(err)
    } finally {
      setSyncing(null)
    }
  }

  const handlePullFromRegistry = async () => {
    setPullLoading(true)
    try {
      const result = await callApi("/ewrs/pull", "POST")
      setPulledRecords(result.records ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setPullLoading(false)
    }
  }

  const toggleSelectIntake = (id: string) => {
    setSelectedIntakes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const ewrsStatusConfig: Record<string, { label: string; variant: any; icon: any }> = {
    not_submitted: { label: "Not Submitted", variant: "outline",     icon: Upload },
    pending:       { label: "Pending",       variant: "warning",     icon: Clock },
    verified:      { label: "Verified",      variant: "success",     icon: ShieldCheck },
    rejected:      { label: "Rejected",      variant: "destructive", icon: XCircle },
    sync_error:    { label: "Sync Error",    variant: "destructive", icon: AlertTriangle },
  }

  const EwrsBadge = ({ status }: { status: string }) => {
    const cfg = ewrsStatusConfig[status] ?? ewrsStatusConfig.not_submitted
    const Icon = cfg.icon
    return (
      <Badge variant={cfg.variant} className="text-xs gap-1">
        <Icon className="w-3 h-3" />{cfg.label}
      </Badge>
    )
  }

  const handleNewIntake = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await callApi("/inventory/intakes", "POST", {
        farmerId: newIntakeForm.farmerId,
        warehouseId: newIntakeForm.warehouseId,
        commodity: newIntakeForm.commodity,
        variety: newIntakeForm.variety || undefined,
        weightKg: parseFloat(newIntakeForm.weightKg),
        moisturePercent: parseFloat(newIntakeForm.moisturePercent || "0"),
      })
      setShowNewIntake(false)
      setNewIntakeForm({ farmerId: "farmer-001", warehouseId: "", commodity: "", variety: "", weightKg: "", moisturePercent: "" })
      refetch()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleGrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gradeDialog) return
    setSubmitting(true)
    try {
      await callApi(`/inventory/intakes/${gradeDialog}/grade`, "POST", {
        grade: gradeForm.grade,
        moisturePercent: gradeForm.moisturePercent ? parseFloat(gradeForm.moisturePercent) : undefined,
        checkerNotes: gradeForm.checkerNotes || undefined,
      })
      setGradeDialog(null)
      setGradeForm({ grade: "", moisturePercent: "", checkerNotes: "" })
      refetch()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleWeigh = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!weighDialog) return
    setSubmitting(true)
    try {
      await callApi(`/inventory/intakes/${weighDialog}/weigh`, "POST", {
        grnNumber: weighForm.grnNumber,
        confirmedWeightKg: weighForm.confirmedWeightKg ? parseFloat(weighForm.confirmedWeightKg) : undefined,
      })
      setWeighDialog(null)
      setWeighForm({ grnNumber: "", confirmedWeightKg: "" })
      refetch()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (intakeId: string) => {
    await approveIntake.mutateAsync({ intakeId })
    refetch()
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectDialog) return
    setSubmitting(true)
    try {
      await rejectIntake.mutateAsync({ intakeId: rejectDialog, data: { reason: rejectReason } })
      setRejectDialog(null)
      setRejectReason("")
      refetch()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Loading inventory...</p>
      </div>
    </div>
  )

  const handleDownloadPDF = () => {
    downloadPDF({
      title: "Logistics & Inventory — Intake Register",
      subtitle: `${intakes.length} intake records · ${new Date().toLocaleDateString("en-KE")}`,
      filename: `inventory-register-${Date.now()}.pdf`,
      summary: [
        ["Total Intakes", String(intakes.length)],
        ["Graded", String(stageCounts["graded"] ?? 0)],
        ["GRN Issued", String(stageCounts["weighed"] ?? 0)],
        ["Verified", String(stageCounts["verified"] ?? 0)],
        ["Anchored", String(stageCounts["anchored"] ?? 0)],
      ],
      sections: [{
        heading: "Commodity Intake Register",
        columns: ["ID", "Commodity", "Warehouse", "Weight (kg)", "Grade", "Moisture %", "Stage", "Date"],
        rows: intakes.map((i: any) => [
          i.id?.slice(0, 8) ?? "—",
          `${i.commodity}${i.variety ? ` (${i.variety})` : ""}`,
          i.warehouseName ?? "—",
          i.confirmedWeightKg ?? i.weightKg ?? "—",
          i.grade ?? "—",
          i.moisturePercent != null ? `${i.moisturePercent}%` : "—",
          i.stage ?? "—",
          new Date(i.createdAt).toLocaleDateString("en-KE"),
        ]),
      }],
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logistics & Inventory</h1>
          <p className="text-muted-foreground mt-1">Commodity intake pipeline — Intake → Grading → GRN → Verification → IOTA Anchor</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
            <Download className="w-4 h-4" /> Download PDF
          </button>
          <Button onClick={() => setShowNewIntake(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Intake
          </Button>
        </div>
      </div>

      {/* Stage counters */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard label="Pending Intake" value={stageCounts["pending"] ?? 0} color="text-slate-300" />
        <StatCard label="Graded" value={stageCounts["graded"] ?? 0} color="text-amber-400" />
        <StatCard label="GRN Issued" value={stageCounts["weighed"] ?? 0} color="text-blue-400" />
        <StatCard label="Verified" value={stageCounts["verified"] ?? 0} color="text-violet-400" />
        <StatCard label="IOTA Anchored" value={stageCounts["anchored"] ?? 0} color="text-emerald-400" />
        <StatCard label="Rejected" value={stageCounts["rejected"] ?? 0} color="text-red-400" />
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">
            <ClipboardList className="w-4 h-4 mr-2" /> Pipeline ({intakes.length})
          </TabsTrigger>
          <TabsTrigger value="warehouses">
            <Warehouse className="w-4 h-4 mr-2" /> Warehouses ({warehouses.length})
          </TabsTrigger>
          <TabsTrigger value="registry" onClick={loadRegistryData}>
            <Globe className="w-4 h-4 mr-2" /> Registry Sync
          </TabsTrigger>
        </TabsList>

        {/* ─── PIPELINE TAB ─── */}
        <TabsContent value="pipeline">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Commodity</TableHead>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead>Moisture</TableHead>
                  <TableHead>GRN</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intakes.map((intake) => (
                  <Fragment key={intake.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(expandedId === intake.id ? null : intake.id)}
                    >
                      <TableCell>
                        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", expandedId === intake.id && "rotate-90")} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Leaf className="w-4 h-4 text-emerald-500" />
                          <div>
                            <span className="font-medium">{intake.commodity}</span>
                            {intake.variety && <span className="text-muted-foreground text-xs ml-1">({intake.variety})</span>}
                            {intake.grade && <Badge variant="outline" className="ml-2 text-xs">{intake.grade}</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{intake.farmerName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm truncate max-w-[140px]">{intake.warehouseName}</TableCell>
                      <TableCell className="text-right font-display font-medium text-sm">{formatWeight(intake.weightKg)}</TableCell>
                      <TableCell>
                        {intake.moisturePercent > 0 ? (
                          <span className={cn("flex items-center gap-1 text-sm", intake.moisturePercent > 14 ? "text-amber-400" : "text-muted-foreground")}>
                            <Droplets className="w-3 h-3" />{intake.moisturePercent}%
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell>
                        {intake.grnNumber
                          ? <span className="font-mono text-xs text-blue-400">{intake.grnNumber}</span>
                          : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <StepIndicator status={intake.status} />
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {intake.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => { setGradeDialog(intake.id); setGradeForm({ grade: intake.grade ?? "", moisturePercent: String(intake.moisturePercent), checkerNotes: "" }) }}>
                            <Tag className="w-3 h-3 mr-1" /> Grade
                          </Button>
                        )}
                        {intake.status === "graded" && (
                          <Button size="sm" variant="outline" onClick={() => { setWeighDialog(intake.id); setWeighForm({ grnNumber: `GRN-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`, confirmedWeightKg: String(intake.weightKg) }) }}>
                            <Scale className="w-3 h-3 mr-1" /> Assign GRN
                          </Button>
                        )}
                        {intake.status === "weighed" && (
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="outline" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20" onClick={() => handleApprove(intake.id)}>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Verify
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => setRejectDialog(intake.id)}>
                              <XCircle className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                        {intake.status === "verified" && (
                          <Button size="sm" variant="outline" className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 border-violet-500/20" onClick={() => handleApprove(intake.id)}>
                            <Link2 className="w-3 h-3 mr-1" /> Anchor IOTA
                          </Button>
                        )}
                        {intake.status === "anchored" && (
                          <Badge variant="success" className="text-xs cursor-default">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Anchored
                          </Badge>
                        )}
                        {intake.status === "rejected" && (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {expandedId === intake.id && (
                      <TableRow className="bg-secondary/20 hover:bg-secondary/20">
                        <TableCell colSpan={9} className="py-4 px-6">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div className="space-y-1">
                              <p className="text-muted-foreground text-xs uppercase tracking-wide">Intake ID</p>
                              <p className="font-mono text-xs">{intake.id}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground text-xs uppercase tracking-wide">IOTA Hash</p>
                              <p className="font-mono text-xs text-emerald-400 truncate">{intake.iotaHash ?? "Not anchored"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground text-xs uppercase tracking-wide">Checker Notes</p>
                              <p className="text-xs">{intake.checkerNotes ?? "None"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground text-xs uppercase tracking-wide">Registered</p>
                              <p className="text-xs">{new Date(intake.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</p>
                            </div>
                          </div>
                          {intake.status === "anchored" && (
                            <div className="mt-3 pt-3 border-t border-border/50 flex gap-2">
                              <Button size="sm" variant="outline" className="text-blue-400 border-blue-500/20 hover:bg-blue-500/10" onClick={() => window.location.href = "/tokens"}>
                                <Hash className="w-3 h-3 mr-1" /> View / Mint Token
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
                {intakes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No intakes found. Click "New Intake" to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── WAREHOUSES TAB ─── */}
        <TabsContent value="warehouses">
          <div className="flex justify-end mb-4">
            {(user?.role === "admin" || user?.role === "collateral_manager") && (
              <Button size="sm" onClick={() => setShowNewWarehouse(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Warehouse
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {warehouses.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                No warehouses yet. Click "Add Warehouse" to register one.
              </div>
            )}
            {warehouses.map((wh: any) => (
              <Card key={wh.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{wh.name}</CardTitle>
                      <p className="text-muted-foreground text-sm mt-0.5">{wh.location}</p>
                    </div>
                    <Badge variant={wh.utilizationPct > 80 ? "warning" : "success"} className="text-xs">
                      {wh.utilizationPct}% full
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Capacity utilization</span>
                      <span>{wh.currentStock.toLocaleString()} / {wh.capacity.toLocaleString()} kg</span>
                    </div>
                    <Progress value={wh.utilizationPct} className={cn(wh.utilizationPct > 80 ? "[&>div]:bg-amber-400" : "")} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-secondary/40 px-3 py-2">
                      <p className="text-muted-foreground text-xs">Operator</p>
                      <p className="font-medium text-xs mt-0.5">{wh.operatorName ?? "—"}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 px-3 py-2">
                      <p className="text-muted-foreground text-xs">Active Intakes</p>
                      <p className="font-medium text-xs mt-0.5">
                        {Object.values(wh.intakeCounts ?? {}).reduce((a: number, b) => a + Number(b), 0)} records
                      </p>
                    </div>
                  </div>
                  {wh.intakeCounts && Object.keys(wh.intakeCounts).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(wh.intakeCounts).map(([status, count]) => (
                        <span key={status} className={cn("text-xs px-2 py-0.5 rounded-full border", getStage(status).color, "border-current/20 bg-current/5")}>
                          {count as number} {status}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── REGISTRY SYNC TAB ─── */}
        <TabsContent value="registry">
          <div className="space-y-5">

            {/* Stats row */}
            {registryStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Anchored (Eligible)</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{registryStats.eligibleForSubmission}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <p className="text-xs text-emerald-400/70">Registry Verified</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{registryStats.verified}</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                  <p className="text-xs text-amber-400/70">Pending Confirmation</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{registryStats.pending}</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <p className="text-xs text-red-400/70">Sync Errors</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{registryStats.syncErrors}</p>
                </div>
              </div>
            )}

            {/* Submission queue */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Send className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">WRSC Submission Queue</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">IOTA-anchored intakes ready for Kenyan Warehouse Receipt System Council</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedIntakes.size > 0 && (
                      <Button size="sm" onClick={handleSubmitBatch} disabled={submitting} className="bg-blue-600 hover:bg-blue-500">
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        {submitting ? "Submitting..." : `Submit ${selectedIntakes.size} Selected`}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={loadRegistryData} disabled={registryLoading}>
                      <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", registryLoading && "animate-spin")} />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Commodity</TableHead>
                    <TableHead>Farmer</TableHead>
                    <TableHead>GRN</TableHead>
                    <TableHead>Registry ID</TableHead>
                    <TableHead>WRSC Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registryLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Fetching registry queue...
                      </TableCell>
                    </TableRow>
                  ) : registryQueue.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <Globe className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-muted-foreground text-sm">No anchored intakes yet.</p>
                        <p className="text-muted-foreground/60 text-xs mt-1">Move intakes through the pipeline to the Anchored stage to enable registry submission.</p>
                      </TableCell>
                    </TableRow>
                  ) : registryQueue.map((intake) => (
                    <TableRow key={intake.id}>
                      <TableCell>
                        {intake.ewrsStatus !== "verified" && (
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary cursor-pointer"
                            checked={selectedIntakes.has(intake.id)}
                            onChange={() => toggleSelectIntake(intake.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Leaf className="w-4 h-4 text-emerald-500" />
                          <div>
                            <span className="font-medium text-sm">{intake.commodity}</span>
                            <span className="text-muted-foreground text-xs ml-1">{intake.grade && `Grade ${intake.grade}`}</span>
                            <p className="text-xs text-muted-foreground">{formatWeight(intake.weightKg)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{intake.farmerName}</TableCell>
                      <TableCell className="font-mono text-xs text-blue-400">{intake.grnNumber ?? "—"}</TableCell>
                      <TableCell>
                        {intake.ewrsRegistryId
                          ? <span className="font-mono text-xs text-violet-400">{intake.ewrsRegistryId}</span>
                          : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <EwrsBadge status={intake.ewrsStatus ?? "not_submitted"} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {intake.ewrsSubmittedAt
                          ? new Date(intake.ewrsSubmittedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {(intake.ewrsStatus === "not_submitted" || intake.ewrsStatus == null) && (
                            <Button size="sm" variant="outline" className="text-blue-400 border-blue-500/20 hover:bg-blue-500/10 text-xs" onClick={() => handleSubmitToRegistry(intake.id)}>
                              <Upload className="w-3 h-3 mr-1" /> Submit
                            </Button>
                          )}
                          {intake.ewrsStatus === "pending" && (
                            <Button size="sm" variant="outline" className="text-amber-400 border-amber-500/20 hover:bg-amber-500/10 text-xs" onClick={() => handleSync(intake.id)} disabled={syncing === intake.id}>
                              <RefreshCw className={cn("w-3 h-3 mr-1", syncing === intake.id && "animate-spin")} /> Re-check
                            </Button>
                          )}
                          {intake.ewrsStatus === "sync_error" && (
                            <Button size="sm" variant="outline" className="text-red-400 border-red-500/20 hover:bg-red-500/10 text-xs" onClick={() => handleSubmitToRegistry(intake.id)}>
                              <RefreshCw className="w-3 h-3 mr-1" /> Retry
                            </Button>
                          )}
                          {intake.ewrsStatus === "verified" && (
                            <Badge variant="success" className="text-xs">
                              <ShieldCheck className="w-3 h-3 mr-1" /> Confirmed
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Pull from external registry */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <Download className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Pull from External Registry</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Import verified receipts submitted by warehouse operators directly to WRSC</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={handlePullFromRegistry} disabled={pullLoading} className="text-violet-400 border-violet-500/20 hover:bg-violet-500/10">
                    <Download className={cn("w-3.5 h-3.5 mr-1.5", pullLoading && "animate-bounce")} />
                    {pullLoading ? "Fetching..." : "Pull from WRSC"}
                  </Button>
                </div>
              </CardHeader>
              {pulledRecords.length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {pulledRecords.map((record, i) => (
                      <div key={i} className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                            <div>
                              <p className="text-xs text-muted-foreground">External ID</p>
                              <p className="font-mono text-xs text-violet-400 mt-0.5">{record.externalId}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Commodity</p>
                              <p className="text-sm font-medium mt-0.5">{record.commodity} <span className="text-muted-foreground text-xs">({record.variety})</span></p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Weight / Grade</p>
                              <p className="text-sm mt-0.5">{record.weightKg.toLocaleString()} kg — Grade {record.grade}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">GRN</p>
                              <p className="font-mono text-xs text-blue-400 mt-0.5">{record.grnNumber}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Warehouse</p>
                              <p className="text-xs mt-0.5">{record.warehouseName}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Farmer / Operator</p>
                              <p className="text-xs mt-0.5">{record.farmerName}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Source</p>
                              <p className="text-xs mt-0.5">{record.source}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Registry Status</p>
                              <Badge variant="success" className="text-xs mt-0.5"><ShieldCheck className="w-3 h-3 mr-1" />{record.status}</Badge>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 text-xs shrink-0">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Import
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

      </Tabs>

      {/* ─── NEW INTAKE DIALOG ─── */}
      <Dialog open={showNewIntake} onOpenChange={setShowNewIntake}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Leaf className="w-5 h-5 text-emerald-500" /> New Commodity Intake</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleNewIntake} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Commodity *</Label>
                <Select
                  value={newIntakeForm.commodity}
                  onChange={(e) => setNewIntakeForm(f => ({ ...f, commodity: e.target.value }))}
                  placeholder="Select commodity"
                  required
                >
                  {COMMODITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Variety (optional)</Label>
                <Input placeholder="e.g. White Maize" value={newIntakeForm.variety} onChange={(e) => setNewIntakeForm(f => ({ ...f, variety: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Warehouse *</Label>
              <Select
                value={newIntakeForm.warehouseId}
                onChange={(e) => setNewIntakeForm(f => ({ ...f, warehouseId: e.target.value }))}
                placeholder="Select warehouse"
                required
              >
                {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name} ({w.utilizationPct}% full)</SelectItem>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weight (kg) *</Label>
                <Input type="number" min="1" step="0.01" placeholder="5000" value={newIntakeForm.weightKg} onChange={(e) => setNewIntakeForm(f => ({ ...f, weightKg: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Moisture % (initial)</Label>
                <Input type="number" min="0" max="30" step="0.1" placeholder="13.5" value={newIntakeForm.moisturePercent} onChange={(e) => setNewIntakeForm(f => ({ ...f, moisturePercent: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowNewIntake(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Recording..." : "Record Intake"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── GRADE DIALOG ─── */}
      <Dialog open={!!gradeDialog} onOpenChange={(open) => !open && setGradeDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag className="w-5 h-5 text-amber-400" /> Record Grading</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGrade} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quality Grade *</Label>
                <Select
                  value={gradeForm.grade}
                  onChange={(e) => setGradeForm(f => ({ ...f, grade: e.target.value }))}
                  placeholder="Select grade"
                  required
                >
                  {GRADES.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Moisture % (confirmed)</Label>
                <Input type="number" min="0" max="30" step="0.1" placeholder="13.0" value={gradeForm.moisturePercent} onChange={(e) => setGradeForm(f => ({ ...f, moisturePercent: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Inspection Notes</Label>
              <Textarea placeholder="Observation notes, damage assessment, storage conditions..." value={gradeForm.checkerNotes} onChange={(e) => setGradeForm(f => ({ ...f, checkerNotes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setGradeDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-amber-500 hover:bg-amber-400 text-black">{submitting ? "Saving..." : "Record Grade"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── WEIGH / GRN DIALOG ─── */}
      <Dialog open={!!weighDialog} onOpenChange={(open) => !open && setWeighDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="w-5 h-5 text-blue-400" /> Assign GRN Number</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWeigh} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>GRN Number *</Label>
              <Input placeholder="GRN-2026-001" value={weighForm.grnNumber} onChange={(e) => setWeighForm(f => ({ ...f, grnNumber: e.target.value }))} required />
              <p className="text-xs text-muted-foreground">Goods Received Note — issued after final weighbridge measurement</p>
            </div>
            <div className="space-y-2">
              <Label>Confirmed Weight (kg)</Label>
              <Input type="number" min="1" step="0.01" value={weighForm.confirmedWeightKg} onChange={(e) => setWeighForm(f => ({ ...f, confirmedWeightKg: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setWeighDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-500">{submitting ? "Saving..." : "Issue GRN"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── REJECT DIALOG ─── */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><XCircle className="w-5 h-5" /> Reject Intake</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReject} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Reason for Rejection *</Label>
              <Textarea
                placeholder="Describe the issue: moisture too high, contamination found, weight discrepancy..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={submitting}>{submitting ? "Rejecting..." : "Confirm Rejection"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── NEW WAREHOUSE DIALOG ─── */}
      <Dialog open={showNewWarehouse} onOpenChange={(open) => { setShowNewWarehouse(open); setWarehouseError("") }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-emerald-500" /> Register New Warehouse
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Warehouse Name *</Label>
              <Input
                placeholder="e.g. Nairobi Central Grain Store"
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Location *</Label>
              <Input
                placeholder="e.g. Nairobi, Kenya"
                value={warehouseForm.location}
                onChange={(e) => setWarehouseForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Capacity (kg) *</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 500000"
                value={warehouseForm.capacity}
                onChange={(e) => setWarehouseForm(f => ({ ...f, capacity: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Warehouse Operator *</Label>
              <select
                aria-label="Select warehouse operator"
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={warehouseForm.operatorId}
                onChange={(e) => setWarehouseForm(f => ({ ...f, operatorId: e.target.value }))}
              >
                <option value="">— Select operator —</option>
                {(usersData?.users ?? []).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
            {warehouseError && <p className="text-sm text-red-500">{warehouseError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewWarehouse(false)}>Cancel</Button>
              <Button onClick={handleCreateWarehouse} disabled={createWarehouse.isPending}>
                {createWarehouse.isPending ? "Creating..." : "Create Warehouse"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
