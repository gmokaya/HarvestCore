import { useState, useEffect, useCallback, Fragment } from "react"
import {
  Card, CardHeader, CardTitle, CardContent,
  Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Button, Dialog, DialogContent, DialogHeader, DialogTitle,
  Input, Label,
} from "@/components/ui"
import { cn, formatCurrency } from "@/lib/utils"
import { downloadPDF } from "@/lib/pdf-report"
import {
  CheckCircle2, ChevronDown, ChevronRight,
  Plus, Users, FileDown,
} from "lucide-react"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")
const AUTH = { Authorization: "Bearer mock-token-admin-001", "Content-Type": "application/json" }

// ── Types ────────────────────────────────────────────────────────────────────
interface Loan {
  id: string; borrowerId: string; borrowerName: string; commodity: string
  principalAmount: number; interestRate: number; tenureDays: number
  ltv: number | null; status: string; riskScore: string | null; purpose: string | null
  outstandingBalance: number | null; collateralValue: number | null
  maxLoanEligible: number | null; maxLtv: number | null
  workflowStage: string; workflowStageLabel: string
  disbursedAt: string | null; dueDate: string | null; repaidAt: string | null
  disbursementMethod: string | null; rejectionReason: string | null
  collateralVerifiedAt: string | null; creditApprovedAt: string | null
  riskApprovedAt: string | null; financeApprovedAt: string | null
  createdAt: string; updatedAt: string
}
interface Approval {
  id: string; loanId: string; approverName: string; approverRole: string
  stage: string; decision: string; notes: string | null; createdAt: string
}
interface Approver {
  id: string; name: string; email: string; phone: string | null
  organization: string; role: string; approvalLimit: number | null; isActive: boolean
}
interface Stats {
  total: number; active: number; pending: number; repaid: number
  defaulted: number; portfolio: number; approvers: number
}

// ── Workflow Stages ──────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  { key: "submitted",           label: "Application" },
  { key: "collateral_verified", label: "Collateral Verify" },
  { key: "valuation_complete",  label: "Commodity Valuation" },
  { key: "credit_approved",     label: "Credit Assessment" },
  { key: "risk_approved",       label: "Risk Approval" },
  { key: "finance_approved",    label: "Finance Auth" },
  { key: "collateral_locked",   label: "Collateral Lock" },
  { key: "disbursed",           label: "Disbursement" },
  { key: "monitoring",          label: "Monitoring" },
  { key: "repaid",              label: "Repaid" },
]

const ROLE_LABELS: Record<string, string> = {
  collateral_manager: "Collateral Manager",
  credit_officer:     "Credit Officer",
  risk_manager:       "Risk Manager",
  finance_officer:    "Finance Officer",
  platform_admin:     "Platform Admin",
}
const ROLE_LIMITS: Record<string, string> = {
  collateral_manager: "Collateral verification only",
  credit_officer:     "Up to KES 1,000,000",
  risk_manager:       "Up to KES 5,000,000",
  finance_officer:    "Unlimited",
  platform_admin:     "System administration",
}

// ── Next-step approver role map ──────────────────────────────────────────────
function nextApproverFor(stage: string, amount: number): { role: string; label: string; action: string } {
  if (stage === "submitted" || stage === "pending_collateral")
    return { role: "collateral_manager", label: "Collateral Manager", action: "Verify Collateral" }
  if (stage === "collateral_verified" || stage === "pending_valuation")
    return { role: "system", label: "Risk Engine", action: "Run Commodity Valuation" }
  if (stage === "valuation_complete" || stage === "pending_credit")
    return { role: "credit_officer", label: "Credit Officer", action: "Approve Credit" }
  if (stage === "credit_approved" && amount >= 1_000_000)
    return { role: "risk_manager", label: "Risk Manager", action: "Risk Approval" }
  if (stage === "credit_approved" || stage === "risk_approved" || stage === "pending_finance")
    return { role: "finance_officer", label: "Finance Officer", action: "Authorize Disbursement" }
  if (stage === "finance_approved")
    return { role: "system", label: "Blockchain Gateway", action: "Lock Collateral" }
  if (stage === "collateral_locked")
    return { role: "finance_officer", label: "Finance Officer", action: "Disburse Loan" }
  if (stage === "disbursed")
    return { role: "system", label: "System", action: "Begin Monitoring" }
  return { role: "system", label: "System", action: "Advance" }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-green-500/15 text-green-700 border-green-300">Active</Badge>
  if (status === "pending") return <Badge className="bg-amber-500/15 text-amber-700 border-amber-300">Pending</Badge>
  if (status === "approved") return <Badge className="bg-blue-500/15 text-blue-700 border-blue-300">Approved</Badge>
  if (status === "repaid") return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300">Repaid</Badge>
  if (status === "defaulted") return <Badge variant="destructive">Defaulted</Badge>
  return <Badge variant="outline" className="capitalize">{status.replace(/_/g, " ")}</Badge>
}

function riskBadge(risk: string | null) {
  if (risk === "low") return <Badge className="bg-green-500/15 text-green-700 border-green-300 text-[10px] px-1 h-4">Low Risk</Badge>
  if (risk === "medium") return <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 text-[10px] px-1 h-4">Med Risk</Badge>
  if (risk === "high") return <Badge variant="destructive" className="text-[10px] px-1 h-4">High Risk</Badge>
  return null
}

function ltvBadge(ltv: number | null) {
  if (!ltv) return <span className="text-muted-foreground text-sm">—</span>
  if (ltv < 65) return <Badge className="bg-green-500/15 text-green-700 border-green-300">{ltv}% Healthy</Badge>
  if (ltv < 75) return <Badge className="bg-amber-500/15 text-amber-700 border-amber-300">{ltv}% Monitor</Badge>
  if (ltv < 85) return <Badge className="bg-orange-500/15 text-orange-700 border-orange-300">{ltv}% Margin Call</Badge>
  return <Badge variant="destructive">{ltv}% Liquidate</Badge>
}

function decisionBadge(d: string) {
  if (d === "approved") return <Badge className="bg-green-500/15 text-green-700 border-green-300 capitalize">Approved</Badge>
  if (d === "rejected") return <Badge variant="destructive">Rejected</Badge>
  if (d === "escalated") return <Badge className="bg-purple-500/15 text-purple-700 border-purple-300">Escalated</Badge>
  return <Badge variant="outline" className="capitalize">{d.replace(/_/g, " ")}</Badge>
}

function roleBadge(role: string) {
  const colors: Record<string, string> = {
    collateral_manager: "bg-blue-500/10 text-blue-700 border-blue-200",
    credit_officer:     "bg-indigo-500/10 text-indigo-700 border-indigo-200",
    risk_manager:       "bg-orange-500/10 text-orange-700 border-orange-200",
    finance_officer:    "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    platform_admin:     "bg-purple-500/10 text-purple-700 border-purple-200",
    system:             "bg-gray-500/10 text-gray-600 border-gray-200",
  }
  return (
    <Badge className={cn("capitalize text-[10px] px-1.5", colors[role] ?? colors.system)}>
      {ROLE_LABELS[role] ?? role.replace(/_/g, " ")}
    </Badge>
  )
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
}


// ── Main Component ───────────────────────────────────────────────────────────
export default function Loans() {
  const [tab, setTab] = useState("Portfolio")
  const [loans, setLoans] = useState<Loan[]>([])
  const [approvers, setApprovers] = useState<Approver[]>([])
  const [auditLog, setAuditLog] = useState<Approval[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Dialogs
  const [advanceLoan, setAdvanceLoan] = useState<Loan | null>(null)
  const [advanceDecision, setAdvanceDecision] = useState("approved")
  const [advanceNotes, setAdvanceNotes] = useState("")
  const [advancePending, setAdvancePending] = useState(false)

  const [repayLoan, setRepayLoan] = useState<Loan | null>(null)
  const [repayAmount, setRepayAmount] = useState("")
  const [repayMethod, setRepayMethod] = useState("mpesa")
  const [repayPending, setRepayPending] = useState(false)

  const [newApprover, setNewApprover] = useState(false)
  const [apvForm, setApvForm] = useState({ name: "", email: "", phone: "", organization: "TokenHarvest Finance", role: "credit_officer", approvalLimit: "" })
  const [apvPending, setApvPending] = useState(false)

  const [stageFilter, setStageFilter] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [loansRes, stagesRes, approversRes, auditRes] = await Promise.all([
        fetch(`${BASE}/api/loan-workflow`, { headers: AUTH }),
        fetch(`${BASE}/api/loan-workflow/stats`, { headers: AUTH }),
        fetch(`${BASE}/api/loan-workflow/approvers/list`, { headers: AUTH }),
        fetch(`${BASE}/api/loan-workflow/approvals/audit`, { headers: AUTH }),
      ])
      const [ld, sd, ad, aad] = await Promise.all([loansRes.json(), stagesRes.json(), approversRes.json(), auditRes.json()])
      setLoans(ld.loans ?? [])
      setStats(sd)
      setApprovers(ad.approvers ?? [])
      setAuditLog(aad.approvals ?? [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdvance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!advanceLoan) return
    setAdvancePending(true)
    const next = nextApproverFor(advanceLoan.workflowStage, advanceLoan.principalAmount)
    await fetch(`${BASE}/api/loan-workflow/${advanceLoan.id}/advance`, {
      method: "POST", headers: AUTH,
      body: JSON.stringify({ decision: advanceDecision, notes: advanceNotes, approverName: next.label, approverRole: next.role }),
    })
    setAdvancePending(false)
    setAdvanceLoan(null)
    setAdvanceNotes("")
    setAdvanceDecision("approved")
    await load()
  }

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repayLoan) return
    setRepayPending(true)
    await fetch(`${BASE}/api/loan-workflow/${repayLoan.id}/repay`, {
      method: "POST", headers: AUTH,
      body: JSON.stringify({ amount: Number(repayAmount), paymentMethod: repayMethod, transactionRef: "TXN-" + Date.now() }),
    })
    setRepayPending(false)
    setRepayLoan(null)
    setRepayAmount("")
    await load()
  }

  const handleNewApprover = async (e: React.FormEvent) => {
    e.preventDefault()
    setApvPending(true)
    await fetch(`${BASE}/api/loan-workflow/approvers/list`, {
      method: "POST", headers: AUTH,
      body: JSON.stringify({ ...apvForm, approvalLimit: apvForm.approvalLimit ? Number(apvForm.approvalLimit) : null }),
    })
    setApvPending(false)
    setNewApprover(false)
    setApvForm({ name: "", email: "", phone: "", organization: "TokenHarvest Finance", role: "credit_officer", approvalLimit: "" })
    await load()
  }

  const TABS = ["Portfolio", "Approval Queue", "LTV Monitor", "Approvers", "Audit Trail"]

  const pendingLoans = loans.filter(l =>
    !["disbursed", "monitoring", "repaid", "defaulted"].includes(l.workflowStage ?? "")
  )
  const activeLoans = loans.filter(l => l.status === "active")

  const filteredLoans = stageFilter === "all" ? loans : loans.filter(l => l.workflowStage === stageFilter)

  const handleDownloadPDF = () => {
    if (tab === "Audit Trail") {
      downloadPDF({
        title: "Credit & Lending — Audit Trail",
        subtitle: `${auditLog.length} approval entries · ${new Date().toLocaleDateString("en-KE")}`,
        filename: `loan-audit-trail-${Date.now()}.pdf`,
        sections: [{
          heading: "Approval Audit Log",
          columns: ["Entry ID", "Loan ID", "Approver", "Role", "Stage", "Decision", "Date"],
          rows: auditLog.map(a => [
            a.id.slice(0, 8), a.loanId.slice(0, 8), a.approverName,
            ROLE_LABELS[a.approverRole] ?? a.approverRole,
            a.stage, a.decision.toUpperCase(),
            new Date(a.createdAt).toLocaleDateString("en-KE"),
          ]),
        }],
      })
    } else {
      downloadPDF({
        title: "Credit & Lending — Loan Portfolio",
        subtitle: `${filteredLoans.length} loans · ${new Date().toLocaleDateString("en-KE")}`,
        filename: `loan-portfolio-${Date.now()}.pdf`,
        summary: stats ? [
          ["Total Loans", String(stats.total)],
          ["Active", String(stats.active)],
          ["Pending", String(stats.pending)],
          ["Portfolio (KES)", formatCurrency(stats.portfolio)],
          ["Defaulted", String(stats.defaulted)],
        ] : undefined,
        sections: [{
          heading: "Loan Portfolio",
          columns: ["Loan ID", "Borrower", "Commodity", "Principal (KES)", "Outstanding (KES)", "Stage", "Status"],
          rows: filteredLoans.map(l => [
            l.id.slice(0, 10), l.borrowerName, l.commodity,
            formatCurrency(l.principalAmount),
            l.outstandingBalance != null ? formatCurrency(l.outstandingBalance) : "—",
            l.workflowStageLabel, l.status,
          ]),
        }],
      })
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading loan engine...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credit & Lending</h1>
          <p className="text-muted-foreground mt-1">Multi-stage approval workflow · Bank-grade governance · Full audit trail</p>
        </div>
        <button onClick={handleDownloadPDF}
          className="flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
          <FileDown className="w-4 h-4" /> Download PDF
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {[
            { label: "Total Loans",    value: stats.total,                      color: "text-foreground" },
            { label: "Active",         value: stats.active,                     color: "text-green-700" },
            { label: "Pending",        value: stats.pending,                    color: "text-amber-700" },
            { label: "Repaid",         value: stats.repaid,                     color: "text-emerald-700" },
            { label: "Defaulted",      value: stats.defaulted,                  color: "text-red-700" },
            { label: "Portfolio (KES)", value: formatCurrency(stats.portfolio), color: "text-[#0A2A2A]" },
            { label: "Active Approvers",value: stats.approvers,                 color: "text-indigo-700" },
          ].map(s => (
            <Card key={s.label} className="py-3 px-4">
              <p className="text-[11px] text-muted-foreground font-medium">{s.label}</p>
              <p className={cn("text-xl font-bold mt-0.5 font-display", s.color)}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t ? "border-[#0A2A2A] text-[#0A2A2A]" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t}
            {t === "Approval Queue" && pendingLoans.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5">{pendingLoans.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Portfolio Tab ─────────────────────────────────────────────────── */}
      {tab === "Portfolio" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Filter by stage:</span>
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
              className="text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none">
              <option value="all">All Stages</option>
              {WORKFLOW_STEPS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              <option value="defaulted">Defaulted</option>
            </select>
            <span className="text-sm text-muted-foreground">{filteredLoans.length} loan(s)</span>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6"></TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Workflow Stage</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No loans found</TableCell>
                  </TableRow>
                )}
                {filteredLoans.map(loan => (
                  <Fragment key={loan.id}>
                    <TableRow className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandedId(expandedId === loan.id ? null : loan.id)}>
                      <TableCell className="w-6">
                        {expandedId === loan.id ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{loan.borrowerName}</div>
                        <div className="mt-0.5">{riskBadge(loan.riskScore)}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{loan.commodity}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(loan.principalAmount)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{loan.outstandingBalance != null ? formatCurrency(loan.outstandingBalance) : "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{loan.workflowStageLabel}</span>
                      </TableCell>
                      <TableCell className="text-center">{statusBadge(loan.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {loan.status === "active" && (
                            <Button size="sm" variant="outline" onClick={() => setRepayLoan(loan)}>Repay</Button>
                          )}
                          {!["disbursed", "monitoring", "repaid", "defaulted"].includes(loan.workflowStage) && (
                            <Button size="sm" onClick={() => setAdvanceLoan(loan)}>Advance</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === loan.id && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/20 px-8 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Collateral Value</p>
                              <p className="font-medium">{loan.collateralValue != null ? formatCurrency(loan.collateralValue) : "Pending valuation"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Max Loan Eligible (65% LTV)</p>
                              <p className="font-medium">{loan.maxLoanEligible != null ? formatCurrency(loan.maxLoanEligible) : "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">LTV Health</p>
                              <div>{ltvBadge(loan.ltv)}</div>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Interest Rate</p>
                              <p className="font-medium">{loan.interestRate ? `${loan.interestRate}% APR` : "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tenure</p>
                              <p className="font-medium">{loan.tenureDays} days</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Due Date</p>
                              <p className="font-medium">{loan.dueDate ? fmt(loan.dueDate) : "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Disbursement Method</p>
                              <p className="font-medium capitalize">{loan.disbursementMethod?.replace("_", " ") ?? "M-PESA"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Applied On</p>
                              <p className="font-medium">{fmt(loan.createdAt)}</p>
                            </div>
                            {loan.purpose && (
                              <div className="col-span-2">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Purpose</p>
                                <p className="font-medium">{loan.purpose}</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── Approval Queue Tab ────────────────────────────────────────────── */}
      {tab === "Approval Queue" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Loans awaiting action at each approval stage.</p>
          {pendingLoans.length === 0 ? (
            <Card className="py-12 text-center text-muted-foreground">No loans pending approval</Card>
          ) : (
            <div className="space-y-3">
              {pendingLoans.map(loan => {
                const next = nextApproverFor(loan.workflowStage, loan.principalAmount)
                return (
                  <Card key={loan.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{loan.borrowerName}</span>
                          {statusBadge(loan.status)}
                          {riskBadge(loan.riskScore)}
                          {loan.principalAmount >= 1_000_000 && (
                            <Badge className="bg-red-500/10 text-red-700 border-red-200 text-[10px]">High Value</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Loan Amount</p>
                            <p className="font-medium">{formatCurrency(loan.principalAmount)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Commodity</p>
                            <p className="font-medium">{loan.commodity}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Current Stage</p>
                            <p className="font-medium">{loan.workflowStageLabel}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Awaiting</p>
                            <p className="font-medium">{next.label}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" className="h-7 text-xs px-3" onClick={() => setAdvanceLoan(loan)}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> {next.action}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-3 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => { setAdvanceLoan(loan); setAdvanceDecision("rejected") }}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LTV Monitor Tab ───────────────────────────────────────────────── */}
      {tab === "LTV Monitor" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Real-time collateral health for all active loans. Max LTV is 65%.</p>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Collateral Value</TableHead>
                  <TableHead className="text-right">Max Eligible</TableHead>
                  <TableHead className="text-center">LTV Health</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeLoans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No active loans</TableCell>
                  </TableRow>
                )}
                {activeLoans.map(loan => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{loan.borrowerName}</div>
                      {riskBadge(loan.riskScore)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{loan.commodity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(loan.principalAmount)}</TableCell>
                    <TableCell className="text-right font-medium">{loan.outstandingBalance != null ? formatCurrency(loan.outstandingBalance) : "—"}</TableCell>
                    <TableCell className="text-right">{loan.collateralValue != null ? formatCurrency(loan.collateralValue) : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{loan.maxLoanEligible != null ? formatCurrency(loan.maxLoanEligible) : "—"}</TableCell>
                    <TableCell className="text-center">{ltvBadge(loan.ltv)}</TableCell>
                    <TableCell className="text-sm">{loan.dueDate ? fmt(loan.dueDate) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setRepayLoan(loan)}>Record Payment</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── Approvers Tab ─────────────────────────────────────────────────── */}
      {tab === "Approvers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Authorized approvers with defined roles and approval limits.</p>
            <Button size="sm" onClick={() => setNewApprover(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Approver
            </Button>
          </div>

          {/* Role reference */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { role: "collateral_manager", label: "Collateral Manager", desc: "Verifies warehouse receipts & commodity quality", color: "bg-blue-500/8 border-blue-200" },
              { role: "credit_officer",     label: "Credit Officer",     desc: "Reviews borrower credit history & risk profile",  color: "bg-indigo-500/8 border-indigo-200" },
              { role: "risk_manager",       label: "Risk Manager",       desc: "Approves high-value loans above KES 1M",          color: "bg-orange-500/8 border-orange-200" },
              { role: "finance_officer",    label: "Finance Officer",    desc: "Final authorization & loan disbursement",          color: "bg-emerald-500/8 border-emerald-200" },
            ].map(r => (
              <div key={r.role} className={cn("rounded-lg border p-3", r.color)}>
                <p className="text-xs font-semibold mb-1">{r.label}</p>
                <p className="text-[11px] text-muted-foreground mb-1.5">{r.desc}</p>
                <p className="text-[10px] text-muted-foreground italic">{ROLE_LIMITS[r.role]}</p>
              </div>
            ))}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Approval Limit</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No approvers added yet. Add your first approver above.
                    </TableCell>
                  </TableRow>
                )}
                {approvers.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-sm">{a.name}</TableCell>
                    <TableCell>{roleBadge(a.role)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.organization}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.email}</TableCell>
                    <TableCell className="text-right">{a.approvalLimit != null ? formatCurrency(a.approvalLimit) : "—"}</TableCell>
                    <TableCell className="text-center">
                      {a.isActive
                        ? <Badge className="bg-green-500/15 text-green-700 border-green-300">Active</Badge>
                        : <Badge variant="outline">Inactive</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── Audit Trail Tab ───────────────────────────────────────────────── */}
      {tab === "Audit Trail" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Complete immutable log of every approval action across all loans.</p>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Loan ID</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Approver</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Decision</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No approval events yet</TableCell>
                  </TableRow>
                )}
                {auditLog.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmt(a.createdAt)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.loanId.slice(0, 8)}…</TableCell>
                    <TableCell className="text-sm">{a.stage.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm font-medium">{a.approverName}</TableCell>
                    <TableCell>{roleBadge(a.approverRole)}</TableCell>
                    <TableCell className="text-center">{decisionBadge(a.decision)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── Advance Workflow Dialog ──────────────────────────────────────── */}
      <Dialog open={!!advanceLoan} onOpenChange={open => { if (!open) { setAdvanceLoan(null); setAdvanceDecision("approved"); setAdvanceNotes("") } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Advance Loan Workflow</DialogTitle>
          </DialogHeader>
          {advanceLoan && (() => {
            const next = nextApproverFor(advanceLoan.workflowStage, advanceLoan.principalAmount)
            return (
              <form onSubmit={handleAdvance} className="space-y-4 pt-2">
                <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Borrower</span><span className="font-medium">{advanceLoan.borrowerName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Loan Amount</span><span className="font-medium">{formatCurrency(advanceLoan.principalAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Current Stage</span><span className="font-medium">{advanceLoan.workflowStageLabel}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Action By</span><span className="font-medium">{next.label}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Action</span><span className="font-medium text-[#0A2A2A]">{next.action}</span></div>
                </div>
                <div className="space-y-2">
                  <Label>Decision</Label>
                  <select value={advanceDecision} onChange={e => setAdvanceDecision(e.target.value)}
                    className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none">
                    <option value="approved">Approve</option>
                    <option value="rejected">Reject</option>
                    <option value="reinspection_requested">Request Reinspection</option>
                    <option value="info_requested">Request More Information</option>
                    <option value="escalated">Escalate</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input value={advanceNotes} onChange={e => setAdvanceNotes(e.target.value)} placeholder="Add approval notes…" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setAdvanceLoan(null); setAdvanceDecision("approved"); setAdvanceNotes("") }}>Cancel</Button>
                  <Button type="submit" disabled={advancePending}>
                    {advancePending ? "Processing…" : `Confirm — ${next.action}`}
                  </Button>
                </div>
              </form>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Repay Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!repayLoan} onOpenChange={open => { if (!open) setRepayLoan(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Loan Repayment</DialogTitle></DialogHeader>
          {repayLoan && (
            <form onSubmit={handleRepay} className="space-y-4 pt-2">
              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Borrower</span><span className="font-medium">{repayLoan.borrowerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="font-medium">{repayLoan.outstandingBalance != null ? formatCurrency(repayLoan.outstandingBalance) : "—"}</span></div>
              </div>
              <div className="space-y-2">
                <Label>Payment Amount (KES)</Label>
                <Input type="number" value={repayAmount} onChange={e => setRepayAmount(e.target.value)} placeholder="e.g. 50000" required min={1} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <select value={repayMethod} onChange={e => setRepayMethod(e.target.value)}
                  className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none">
                  <option value="mpesa">M-PESA</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="pesalink">PesaLink</option>
                  <option value="stablecoin">Stablecoin Wallet</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setRepayLoan(null)}>Cancel</Button>
                <Button type="submit" disabled={repayPending}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> {repayPending ? "Processing…" : "Confirm Payment"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── New Approver Dialog ───────────────────────────────────────────── */}
      <Dialog open={newApprover} onOpenChange={setNewApprover}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Loan Approver</DialogTitle></DialogHeader>
          <form onSubmit={handleNewApprover} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={apvForm.name} onChange={e => setApvForm(f => ({ ...f, name: e.target.value }))} required placeholder="Jane Mwangi" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={apvForm.email} onChange={e => setApvForm(f => ({ ...f, email: e.target.value }))} required placeholder="jane@harvestcore.io" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={apvForm.phone} onChange={e => setApvForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254700000000" />
              </div>
              <div className="space-y-1.5">
                <Label>Organization</Label>
                <Input value={apvForm.organization} onChange={e => setApvForm(f => ({ ...f, organization: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <select value={apvForm.role} onChange={e => setApvForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none">
                  <option value="collateral_manager">Collateral Manager</option>
                  <option value="credit_officer">Credit Officer</option>
                  <option value="risk_manager">Risk Manager</option>
                  <option value="finance_officer">Finance Officer</option>
                  <option value="platform_admin">Platform Admin</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Approval Limit (KES)</Label>
                <Input type="number" value={apvForm.approvalLimit} onChange={e => setApvForm(f => ({ ...f, approvalLimit: e.target.value }))} placeholder="e.g. 1000000" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setNewApprover(false)}>Cancel</Button>
              <Button type="submit" disabled={apvPending}>
                <Users className="w-4 h-4 mr-2" /> {apvPending ? "Adding…" : "Add Approver"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
