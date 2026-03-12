import { useState, Fragment } from "react"
import { useListIntakes, useApproveIntake, useRejectIntake, useListWarehouses } from "@workspace/api-client-react"
import {
  Card, CardHeader, CardTitle, CardContent,
  Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Button, Dialog, DialogContent, DialogHeader, DialogTitle,
  Input, Label, Textarea, Select, SelectItem,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Progress,
} from "@/components/ui"
import { cn, formatWeight } from "@/lib/utils"
import {
  Scale, Plus, CheckCircle2, XCircle, Droplets, Tag, ClipboardList,
  Warehouse, ChevronRight, AlertCircle, Link2, Leaf, Hash,
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
  const { data, isLoading, refetch } = useListIntakes()
  const { data: warehouseData } = useListWarehouses()
  const approveIntake = useApproveIntake()
  const rejectIntake = useRejectIntake()

  const [activeTab, setActiveTab] = useState("pipeline")
  const [showNewIntake, setShowNewIntake] = useState(false)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logistics & Inventory</h1>
          <p className="text-muted-foreground mt-1">Commodity intake pipeline — Intake → Grading → GRN → Verification → IOTA Anchor</p>
        </div>
        <Button onClick={() => setShowNewIntake(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Intake
        </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
    </div>
  )
}
