import { useState, useEffect, useCallback } from "react"
import { useListWarehouses } from "@workspace/api-client-react"
import { useAuth } from "@/contexts/auth"
import { cn } from "@/lib/utils"
import {
  Card, CardHeader, CardTitle, CardContent,
  Badge, Button, Input, Label, Textarea,
  Progress,
} from "@/components/ui"
import { Warehouse, Building2, Package, AlertTriangle, CheckCircle2,
  X, Plus, RefreshCw, ClipboardList, BarChart3, MapPin, User,
  TrendingUp, Box, ChevronRight, Clock, ShieldCheck, ShieldAlert,
} from "lucide-react"

/* ── helpers ──────────────────────────────────────── */
const COMMODITIES = ["Maize","Coffee","Wheat","Rice","Sorghum","Beans","Tea","Cotton","Sesame","Millet"]

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""

function useCallApi() {
  const { user } = useAuth()
  return useCallback(async (path: string, method = "GET", body?: unknown) => {
    const token = localStorage.getItem("auth_token")
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? "Request failed")
    }
    return res.json()
  }, [user])
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

const STATUS_COLORS: Record<string, string> = {
  pending:     "text-yellow-600 bg-yellow-50 border-yellow-200",
  approved:    "text-emerald-600 bg-emerald-50 border-emerald-200",
  rejected:    "text-red-600 bg-red-50 border-red-200",
  verified:    "text-blue-600 bg-blue-50 border-blue-200",
  graded:      "text-purple-600 bg-purple-50 border-purple-200",
  weighed:     "text-indigo-600 bg-indigo-50 border-indigo-200",
  anchored:    "text-teal-600 bg-teal-50 border-teal-200",
  rejected_i:  "text-red-600 bg-red-50 border-red-200",
}

/* ── main component ───────────────────────────────── */
export default function WarehouseManagement() {
  const callApi = useCallApi()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "collateral_manager"

  const { data: warehouseList, refetch: refetchList } = useListWarehouses()
  const warehouses: any[] = warehouseList?.warehouses ?? []

  const [mainTab, setMainTab] = useState<"warehouses" | "network">("warehouses")
  const [selected, setSelected] = useState<any | null>(null)
  const [detailTab, setDetailTab] = useState<"overview" | "inventory" | "reconciliation">("overview")

  const [dashData, setDashData] = useState<any | null>(null)
  const [dashLoading, setDashLoading] = useState(false)
  const [reconciliations, setReconciliations] = useState<any[]>([])
  const [recLoading, setRecLoading] = useState(false)

  const [networkData, setNetworkData] = useState<any | null>(null)
  const [networkLoading, setNetworkLoading] = useState(false)

  const [showRecForm, setShowRecForm] = useState(false)
  const [recForm, setRecForm] = useState({ commodity: "", systemQty: "", physicalQty: "", remarks: "" })
  const [recError, setRecError] = useState("")
  const [recSubmitting, setRecSubmitting] = useState(false)

  // Load warehouse dashboard when selected
  useEffect(() => {
    if (!selected) return
    setDashLoading(true)
    setDashData(null)
    callApi(`/inventory/warehouses/${selected.id}/dashboard`)
      .then(d => setDashData(d))
      .catch(console.error)
      .finally(() => setDashLoading(false))
  }, [selected?.id, callApi])

  // Load reconciliations when on that tab
  useEffect(() => {
    if (!selected || detailTab !== "reconciliation") return
    setRecLoading(true)
    callApi(`/inventory/warehouses/${selected.id}/reconciliations`)
      .then(d => setReconciliations(d.reconciliations ?? []))
      .catch(console.error)
      .finally(() => setRecLoading(false))
  }, [selected?.id, detailTab, callApi])

  // Load network data when on network tab
  useEffect(() => {
    if (mainTab !== "network") return
    setNetworkLoading(true)
    callApi("/inventory/network-summary")
      .then(d => setNetworkData(d))
      .catch(console.error)
      .finally(() => setNetworkLoading(false))
  }, [mainTab, callApi])

  const handleCreateReconciliation = async () => {
    setRecError("")
    if (!recForm.commodity || !recForm.systemQty || !recForm.physicalQty) {
      setRecError("Commodity, system quantity and physical quantity are required."); return
    }
    setRecSubmitting(true)
    try {
      await callApi(`/inventory/warehouses/${selected.id}/reconciliations`, "POST", {
        commodity: recForm.commodity,
        systemQty: parseFloat(recForm.systemQty),
        physicalQty: parseFloat(recForm.physicalQty),
        remarks: recForm.remarks || undefined,
      })
      setRecForm({ commodity: "", systemQty: "", physicalQty: "", remarks: "" })
      setShowRecForm(false)
      // Reload
      callApi(`/inventory/warehouses/${selected.id}/reconciliations`)
        .then(d => setReconciliations(d.reconciliations ?? []))
    } catch (e: any) {
      setRecError(e.message)
    } finally {
      setRecSubmitting(false)
    }
  }

  const handleApproveRec = async (recId: string, action: "approve" | "reject") => {
    try {
      await callApi(`/inventory/warehouses/${selected.id}/reconciliations/${recId}/approve`, "PATCH", { action })
      callApi(`/inventory/warehouses/${selected.id}/reconciliations`)
        .then(d => setReconciliations(d.reconciliations ?? []))
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Summary stats
  const totalCapacity = warehouses.reduce((s, w) => s + Number(w.capacity), 0)
  const totalStock = warehouses.reduce((s, w) => s + Number(w.currentStock), 0)
  const avgUtilization = warehouses.length > 0
    ? Math.round(warehouses.reduce((s, w) => s + (w.utilizationPct ?? 0), 0) / warehouses.length)
    : 0
  const activeCount = warehouses.filter(w => w.status === "active").length

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Warehouse Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Monitor capacity, stock, and reconciliation across your warehouse network</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { refetchList(); if (mainTab === "network") { setNetworkData(null); setMainTab("warehouses"); setTimeout(() => setMainTab("network"), 50) } }}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Warehouses", value: activeCount, total: warehouses.length, icon: <Warehouse className="w-5 h-5 text-emerald-500" /> },
          { label: "Total Capacity", value: `${fmt(totalCapacity)} kg`, icon: <Box className="w-5 h-5 text-blue-500" /> },
          { label: "Network Utilization", value: `${avgUtilization}%`, icon: <BarChart3 className="w-5 h-5 text-amber-500" /> },
          { label: "Total Stock", value: `${fmt(totalStock)} kg`, icon: <TrendingUp className="w-5 h-5 text-purple-500" /> },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold mt-1">{s.value}</p>
                  {s.total !== undefined && (
                    <p className="text-xs text-muted-foreground mt-0.5">of {s.total} total</p>
                  )}
                </div>
                {s.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Main tabs ── */}
      <div className="flex gap-1 border-b">
        {[
          { id: "warehouses", label: "Warehouse Network", icon: <Warehouse className="w-4 h-4" /> },
          { id: "network", label: "Network Inventory", icon: <BarChart3 className="w-4 h-4" /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setMainTab(t.id as any)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              mainTab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── WAREHOUSE NETWORK TAB ── */}
      {mainTab === "warehouses" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {warehouses.length === 0 && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <Warehouse className="w-10 h-10 mx-auto mb-3 opacity-30" />
              No warehouses registered yet.
            </div>
          )}
          {warehouses.map((wh: any) => (
            <Card key={wh.id} className={cn("cursor-pointer hover:shadow-md transition-shadow", wh.status === "suspended" && "opacity-60")}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{wh.name}</CardTitle>
                    <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{wh.location}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={wh.status === "active" ? "outline" : "destructive"} className="text-xs capitalize">{wh.status}</Badge>
                    <span className="text-xs text-muted-foreground capitalize">{(wh.warehouseType ?? "").replace(/_/g," ")}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{wh.utilizationPct}% utilized</span>
                    <span>{fmt(wh.currentStock)} / {fmt(wh.capacity)} kg</span>
                  </div>
                  <Progress
                    value={wh.utilizationPct}
                    className={cn(wh.utilizationPct > 80 ? "[&>div]:bg-amber-400" : "[&>div]:bg-emerald-500")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-secondary/40 rounded px-2.5 py-1.5">
                    <p className="text-muted-foreground">Operator</p>
                    <p className="font-medium truncate">{wh.operatorName ?? "—"}</p>
                  </div>
                  <div className="bg-secondary/40 rounded px-2.5 py-1.5">
                    <p className="text-muted-foreground">Intakes</p>
                    <p className="font-medium">{String(Object.values(wh.intakeCounts ?? {}).reduce((a: number, b: unknown) => a + Number(b), 0))} records</p>
                  </div>
                </div>
                {wh.utilizationPct > 80 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5" /> Capacity above 80%
                  </div>
                )}
                <Button
                  size="sm"
                  className="w-full"
                  variant="outline"
                  onClick={() => { setSelected(wh); setDetailTab("overview") }}
                >
                  <ClipboardList className="w-4 h-4 mr-1.5" /> Manage Warehouse
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── NETWORK INVENTORY TAB ── */}
      {mainTab === "network" && (
        <div className="space-y-6">
          {networkLoading && (
            <div className="text-center py-16 text-muted-foreground">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" /> Loading network data…
            </div>
          )}
          {networkData && (
            <>
              {/* Stock by status summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Inventory Status Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {networkData.statusSummary.length === 0
                    ? <p className="text-sm text-muted-foreground">No intake records in the network yet.</p>
                    : (
                      <div className="flex flex-wrap gap-2">
                        {networkData.statusSummary.map((s: any) => (
                          <div key={s.status} className={cn("text-xs px-3 py-2 rounded-lg border", STATUS_COLORS[s.status] ?? "text-gray-600 bg-gray-50 border-gray-200")}>
                            <p className="font-semibold capitalize">{s.status}</p>
                            <p>{s.count} intakes · {fmt(s.totalKg)} kg</p>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </CardContent>
              </Card>

              {/* Total stock by commodity */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Commodity Distribution — Network Total</CardTitle>
                </CardHeader>
                <CardContent>
                  {networkData.totalByCommodity.length === 0
                    ? <p className="text-sm text-muted-foreground">No stock recorded across network.</p>
                    : (
                      <div className="space-y-3">
                        {networkData.totalByCommodity.map((c: any) => {
                          const pct = totalStock > 0 ? Math.round((c.totalKg / totalStock) * 100) : 0
                          return (
                            <div key={c.commodity}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium">{c.commodity}</span>
                                <span className="text-muted-foreground">{fmt(c.totalKg)} kg · {pct}% · {c.batches} batches</span>
                              </div>
                              <Progress value={pct} className="h-2" />
                            </div>
                          )
                        })}
                      </div>
                    )
                  }
                </CardContent>
              </Card>

              {/* Commodity × Warehouse matrix */}
              {networkData.commodityMatrix.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Stock by Warehouse &amp; Commodity</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Warehouse</th>
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Commodity</th>
                          <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Stock (kg)</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Batches</th>
                        </tr>
                      </thead>
                      <tbody>
                        {networkData.commodityMatrix.map((row: any, i: number) => {
                          const wh = networkData.warehouses.find((w: any) => w.id === row.warehouseId)
                          return (
                            <tr key={i} className="border-b last:border-0 hover:bg-secondary/30">
                              <td className="py-2 pr-4">{wh?.name ?? row.warehouseId}</td>
                              <td className="py-2 pr-4">{row.commodity}</td>
                              <td className="py-2 pr-4 text-right font-medium">{fmt(row.totalKg)}</td>
                              <td className="py-2 text-right">{row.batches}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* Warehouse utilization overview */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Warehouse Utilization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {networkData.warehouses.map((w: any) => (
                    <div key={w.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{w.name} <span className="text-muted-foreground">— {w.location}</span></span>
                        <span className="text-muted-foreground">{w.utilizationPct}% · {fmt(w.currentStock)}/{fmt(w.capacity)} kg</span>
                      </div>
                      <Progress value={w.utilizationPct} className={cn("h-2", w.utilizationPct > 80 ? "[&>div]:bg-amber-400" : "[&>div]:bg-emerald-500")} />
                    </div>
                  ))}
                  {networkData.warehouses.length === 0 && (
                    <p className="text-sm text-muted-foreground">No active warehouses.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────
          WAREHOUSE DETAIL DRAWER
      ───────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/40" onClick={() => setSelected(null)} />

          {/* Panel */}
          <div className="w-full max-w-2xl bg-background shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer header */}
            <div className="flex items-start justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" /> {selected.location}
                  <span className="text-muted-foreground/40">·</span>
                  <Badge variant={selected.status === "active" ? "outline" : "destructive"} className="text-xs capitalize">{selected.status}</Badge>
                  <span className="capitalize text-xs">{(selected.warehouseType ?? "").replace(/_/g," ")}</span>
                </div>
                {selected.organizationName && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {selected.organizationName}
                  </p>
                )}
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSelected(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Detail tabs */}
            <div className="flex gap-0 border-b bg-secondary/20 px-5">
              {[
                { id: "overview",        label: "Overview",         icon: <BarChart3 className="w-3.5 h-3.5" /> },
                { id: "inventory",       label: "Commodity Stock",  icon: <Package className="w-3.5 h-3.5" /> },
                { id: "reconciliation",  label: "Reconciliation",   icon: <ClipboardList className="w-3.5 h-3.5" /> },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setDetailTab(t.id as any)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                    detailTab === t.id
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {dashLoading && (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" /> Loading dashboard…
                </div>
              )}

              {/* ── OVERVIEW TAB ── */}
              {!dashLoading && dashData && detailTab === "overview" && (
                <>
                  {/* Capacity breakdown */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Capacity Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{dashData.capacity.utilizationPct}% utilized</span>
                        <span>{fmt(dashData.capacity.occupied)} / {fmt(dashData.capacity.total)} kg</span>
                      </div>
                      <Progress
                        value={dashData.capacity.utilizationPct}
                        className={cn("h-3", dashData.capacity.utilizationPct > 80 ? "[&>div]:bg-amber-400" : "[&>div]:bg-emerald-500")}
                      />
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        {[
                          { label: "Total Capacity", value: `${fmt(dashData.capacity.total)} kg`, color: "text-foreground" },
                          { label: "Occupied",        value: `${fmt(dashData.capacity.occupied)} kg`, color: "text-amber-600" },
                          { label: "Available",       value: `${fmt(dashData.capacity.available)} kg`, color: "text-emerald-600" },
                        ].map(s => (
                          <div key={s.label} className="bg-secondary/40 rounded-lg p-3 text-center">
                            <p className={cn("text-sm font-bold", s.color)}>{s.value}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>
                      {dashData.capacity.utilizationPct > 80 && (
                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          Warehouse above 80% capacity. Consider transferring stock or sourcing additional space.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Intake status + receipts */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Intake Pipeline</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {Object.keys(dashData.intakesByStatus).length === 0
                          ? <p className="text-xs text-muted-foreground">No intakes recorded.</p>
                          : (
                            <div className="space-y-1.5">
                              {Object.entries(dashData.intakesByStatus).map(([status, count]) => (
                                <div key={status} className="flex justify-between text-xs">
                                  <span className={cn("capitalize px-1.5 py-0.5 rounded", STATUS_COLORS[status] ?? "text-gray-600 bg-gray-50")}>{status}</span>
                                  <span className="font-medium">{String(count)}</span>
                                </div>
                              ))}
                            </div>
                          )
                        }
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Today's Activity</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="w-3.5 h-3.5" /> Receipts issued today</span>
                          <span className="font-bold text-base">{dashData.todayReceipts}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-muted-foreground"><User className="w-3.5 h-3.5" /> Operator</span>
                          <span className="font-medium">{dashData.warehouse.operatorName}</span>
                        </div>
                        {dashData.warehouse.organizationName && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><Building2 className="w-3.5 h-3.5" /> Organization</span>
                            <span className="font-medium">{dashData.warehouse.organizationName}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent reconciliations */}
                  {dashData.recentReconciliations.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Recent Reconciliations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {dashData.recentReconciliations.map((r: any) => (
                            <div key={r.id} className="flex items-center justify-between text-xs border-b last:border-0 pb-2 last:pb-0">
                              <div>
                                <p className="font-medium">{r.commodity}</p>
                                <p className="text-muted-foreground">Variance: {Number(r.variance) >= 0 ? "+" : ""}{Number(r.variance).toFixed(1)} kg · by {r.reconciled_by_name}</p>
                              </div>
                              <Badge variant={r.status === "approved" ? "outline" : r.status === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize">
                                {r.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* ── COMMODITY STOCK TAB ── */}
              {!dashLoading && dashData && detailTab === "inventory" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Commodity Stock Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashData.stockByCommodity.length === 0
                      ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No verified stock recorded yet.</p>
                          <p className="text-xs mt-1">Stock appears here after intake records reach verified/graded status.</p>
                        </div>
                      )
                      : (
                        <div className="space-y-4">
                          {dashData.stockByCommodity.map((c: any) => {
                            const pct = dashData.capacity.occupied > 0
                              ? Math.round((c.totalKg / dashData.capacity.occupied) * 100)
                              : 0
                            return (
                              <div key={c.commodity}>
                                <div className="flex justify-between text-xs mb-1.5">
                                  <span className="font-medium flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                    {c.commodity}
                                  </span>
                                  <span className="text-muted-foreground">{fmt(c.totalKg)} kg · {c.batchCount} batches · {pct}% of stock</span>
                                </div>
                                <Progress value={pct} className="h-2 [&>div]:bg-blue-500" />
                              </div>
                            )
                          })}
                          <div className="pt-3 border-t text-xs text-muted-foreground">
                            Total tracked: {fmt(dashData.stockByCommodity.reduce((s: number, c: any) => s + c.totalKg, 0))} kg across {dashData.stockByCommodity.length} commodities
                          </div>
                        </div>
                      )
                    }
                  </CardContent>
                </Card>
              )}

              {/* ── RECONCILIATION TAB ── */}
              {detailTab === "reconciliation" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">Stock reconciliation records ensure physical inventory matches system data.</p>
                    {isAdmin && (
                      <Button size="sm" onClick={() => setShowRecForm(v => !v)}>
                        <Plus className="w-4 h-4 mr-1.5" /> New Reconciliation
                      </Button>
                    )}
                  </div>

                  {/* New reconciliation form */}
                  {showRecForm && (
                    <Card className="border-dashed">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Record Physical Count</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5 col-span-2">
                            <Label className="text-xs">Commodity *</Label>
                            <select
                              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                              value={recForm.commodity}
                              onChange={e => setRecForm(f => ({ ...f, commodity: e.target.value }))}
                            >
                              <option value="">— Select commodity —</option>
                              {COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">System Quantity (kg) *</Label>
                            <Input
                              type="number" placeholder="e.g. 50000" className="h-8 text-sm"
                              value={recForm.systemQty}
                              onChange={e => setRecForm(f => ({ ...f, systemQty: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Physical Count (kg) *</Label>
                            <Input
                              type="number" placeholder="e.g. 49500" className="h-8 text-sm"
                              value={recForm.physicalQty}
                              onChange={e => setRecForm(f => ({ ...f, physicalQty: e.target.value }))}
                            />
                          </div>
                        </div>
                        {recForm.systemQty && recForm.physicalQty && (
                          <div className={cn("text-xs px-3 py-2 rounded border", Number(recForm.physicalQty) < Number(recForm.systemQty) ? "text-red-600 bg-red-50 border-red-200" : "text-emerald-600 bg-emerald-50 border-emerald-200")}>
                            Variance: {(Number(recForm.physicalQty) - Number(recForm.systemQty)).toFixed(1)} kg
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label className="text-xs">Remarks</Label>
                          <Textarea
                            placeholder="Describe any discrepancy or reason for variance…"
                            className="text-sm min-h-[60px]"
                            value={recForm.remarks}
                            onChange={e => setRecForm(f => ({ ...f, remarks: e.target.value }))}
                          />
                        </div>
                        {recError && <p className="text-xs text-red-500">{recError}</p>}
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setShowRecForm(false)}>Cancel</Button>
                          <Button size="sm" onClick={handleCreateReconciliation} disabled={recSubmitting}>
                            {recSubmitting ? "Submitting…" : "Submit Reconciliation"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Reconciliation list */}
                  {recLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                      <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" />
                    </div>
                  )}
                  {!recLoading && reconciliations.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                      <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No reconciliation records yet.</p>
                    </div>
                  )}
                  {!recLoading && reconciliations.map((r: any) => {
                    const variance = Number(r.variance)
                    const isPos = variance >= 0
                    return (
                      <Card key={r.id}>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex justify-between items-start gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{r.commodity}</p>
                                <Badge
                                  variant={r.status === "approved" ? "outline" : r.status === "rejected" ? "destructive" : "secondary"}
                                  className="text-xs capitalize"
                                >
                                  {r.status}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                <p>System: {fmt(Number(r.system_qty))} kg · Physical: {fmt(Number(r.physical_qty))} kg</p>
                                <p className={cn("font-medium", isPos ? "text-emerald-600" : "text-red-600")}>
                                  Variance: {isPos ? "+" : ""}{variance.toFixed(1)} kg
                                </p>
                                {r.remarks && <p className="text-muted-foreground italic">{r.remarks}</p>}
                                <p>By {r.reconciled_by_name} · {new Date(r.created_at).toLocaleDateString()}</p>
                                {r.approved_by_name && <p>Approved by {r.approved_by_name}</p>}
                              </div>
                            </div>
                            {r.status === "pending" && isAdmin && (
                              <div className="flex gap-1.5 shrink-0">
                                <Button size="sm" variant="outline" className="text-xs h-7 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                  onClick={() => handleApproveRec(r.id, "approve")}>
                                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => handleApproveRec(r.id, "reject")}>
                                  <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
