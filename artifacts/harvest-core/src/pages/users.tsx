import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
  Button,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Input, Label,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  Users, ShieldCheck, Building2, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Clock, UserPlus, Lock,
  Briefcase, Tractor, BarChart3, Landmark, Warehouse, Eye,
  BadgeCheck, AlertTriangle, UserX, UserCheck, KeyRound,
  ScrollText, Plus, Edit2, Activity,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function api(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", Authorization: "Bearer mock-token-admin-001" },
    ...opts,
  }).then((r) => r.json());
}

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string; description: string; permissions: string[] }> = {
  farmer: {
    label: "Farmer / Borrower",
    icon: Tractor,
    color: "text-green-400",
    description: "Agricultural producers accessing financing and storage",
    permissions: ["loan:create", "inventory:view", "marketplace:list", "receipts:view_own"],
  },
  trader: {
    label: "Trader",
    icon: BarChart3,
    color: "text-purple-400",
    description: "Commodity buyers and sellers in the marketplace",
    permissions: ["marketplace:trade", "inventory:view", "contracts:forward", "payments:initiate"],
  },
  collateral_manager: {
    label: "Collateral Manager",
    icon: Lock,
    color: "text-blue-400",
    description: "Oversee warehouse receipts and loan collateral approvals",
    permissions: ["receipts:manage", "inspections:approve", "loans:collateral_review", "tokens:lock"],
  },
  processor: {
    label: "Processor",
    icon: Briefcase,
    color: "text-orange-400",
    description: "Commodity processors placing purchase orders and managing contracts",
    permissions: ["marketplace:purchase", "contracts:manage", "payments:view", "inventory:purchase"],
  },
  warehouse_op: {
    label: "Warehouse Operator",
    icon: Warehouse,
    color: "text-yellow-400",
    description: "Manage physical storage, intake processing, and GRN issuance",
    permissions: ["inventory:manage", "receipts:issue", "ewrs:submit", "intake:weigh"],
  },
  checker: {
    label: "Checker / Auditor",
    icon: Eye,
    color: "text-teal-400",
    description: "Four-eyes verification for maker-checker workflows",
    permissions: ["inventory:verify", "inspections:conduct", "loans:review", "kyc:review"],
  },
  lender: {
    label: "Lender / Institution",
    icon: Landmark,
    color: "text-indigo-400",
    description: "Financial institutions monitoring loan portfolios and risk",
    permissions: ["loans:monitor", "risk:dashboard", "collateral:view", "ltv:alerts"],
  },
  admin: {
    label: "Platform Admin",
    icon: ShieldCheck,
    color: "text-red-400",
    description: "Full system access — all modules, analytics, and settings",
    permissions: ["*:all"],
  },
};

const KYC_CONFIG: Record<string, { class: string; icon: any; label: string }> = {
  approved: { class: "bg-green-500/15 text-green-400 border-green-500/30", icon: CheckCircle2, label: "KYC Approved" },
  pending: { class: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: Clock, label: "Pending Review" },
  rejected: { class: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle, label: "Rejected" },
};

const ORG_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  cooperative: { label: "Cooperative", color: "text-green-400" },
  processor: { label: "Processor", color: "text-orange-400" },
  lender: { label: "Lender", color: "text-indigo-400" },
  trader: { label: "Trader", color: "text-purple-400" },
  admin_entity: { label: "Admin Entity", color: "text-red-400" },
};

const AUDIT_ACTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  user_invited:   { label: "User Invited",    color: "text-blue-400",   icon: UserPlus },
  user_suspended: { label: "Suspended",       color: "text-red-400",    icon: UserX },
  user_activated: { label: "Re-activated",    color: "text-green-400",  icon: UserCheck },
  role_changed:   { label: "Role Changed",    color: "text-purple-400", icon: KeyRound },
  kyc_approved:   { label: "KYC Approved",    color: "text-green-400",  icon: BadgeCheck },
  kyc_rejected:   { label: "KYC Rejected",    color: "text-red-400",    icon: XCircle },
};

const RBAC_MATRIX: { feature: string; farmer: boolean; trader: boolean; collateral_manager: boolean; processor: boolean; warehouse_op: boolean; checker: boolean; lender: boolean; admin: boolean }[] = [
  { feature: "Dashboard", farmer: true, trader: true, collateral_manager: true, processor: true, warehouse_op: true, checker: true, lender: true, admin: true },
  { feature: "Loan: Create / Apply", farmer: true, trader: false, collateral_manager: false, processor: false, warehouse_op: false, checker: false, lender: false, admin: true },
  { feature: "Loan: Monitor Portfolio", farmer: false, trader: false, collateral_manager: true, processor: false, warehouse_op: false, checker: true, lender: true, admin: true },
  { feature: "Inventory: View", farmer: true, trader: true, collateral_manager: true, processor: true, warehouse_op: true, checker: true, lender: false, admin: true },
  { feature: "Inventory: Manage / Intake", farmer: false, trader: false, collateral_manager: false, processor: false, warehouse_op: true, checker: false, lender: false, admin: true },
  { feature: "Inspection: Conduct", farmer: false, trader: false, collateral_manager: false, processor: false, warehouse_op: false, checker: true, lender: false, admin: true },
  { feature: "Inspection: Approve / Reject", farmer: false, trader: false, collateral_manager: true, processor: false, warehouse_op: false, checker: false, lender: false, admin: true },
  { feature: "Warehouse Receipts: Issue", farmer: false, trader: false, collateral_manager: false, processor: false, warehouse_op: true, checker: false, lender: false, admin: true },
  { feature: "Warehouse Receipts: Lock Collateral", farmer: false, trader: false, collateral_manager: true, processor: false, warehouse_op: false, checker: false, lender: false, admin: true },
  { feature: "Marketplace: List / Trade", farmer: true, trader: true, collateral_manager: false, processor: true, warehouse_op: false, checker: false, lender: false, admin: true },
  { feature: "Tokens: Tokenize Assets", farmer: false, trader: false, collateral_manager: true, processor: false, warehouse_op: false, checker: false, lender: false, admin: true },
  { feature: "Contracts: Forward / Futures", farmer: false, trader: true, collateral_manager: false, processor: true, warehouse_op: false, checker: false, lender: false, admin: true },
  { feature: "eWRS: Registry Submit", farmer: false, trader: false, collateral_manager: false, processor: false, warehouse_op: true, checker: false, lender: false, admin: true },
  { feature: "Risk Dashboard", farmer: false, trader: false, collateral_manager: true, processor: false, warehouse_op: false, checker: true, lender: true, admin: true },
  { feature: "User Management", farmer: false, trader: false, collateral_manager: false, processor: false, warehouse_op: false, checker: false, lender: false, admin: true },
  { feature: "Analytics & Reports", farmer: false, trader: false, collateral_manager: false, processor: true, warehouse_op: false, checker: true, lender: true, admin: true },
];

const RBAC_ROLES = ["farmer", "trader", "collateral_manager", "processor", "warehouse_op", "checker", "lender", "admin"];

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role];
  if (!cfg) return <span className="text-xs text-muted-foreground capitalize">{role}</span>;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border bg-secondary/50 border-border/50", cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function KycBadge({ status }: { status: string }) {
  const cfg = KYC_CONFIG[status] ?? KYC_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cfg.class)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "suspended") return (
    <span className="inline-flex items-center gap-1 text-xs text-red-400 font-medium">
      <UserX className="w-3.5 h-3.5" /> Suspended
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Active
    </span>
  );
}

function UserDetailPanel({ user, orgName }: { user: any; orgName: string }) {
  const roleCfg = ROLE_CONFIG[user.role];
  return (
    <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">User ID</p>
          <p className="font-mono text-xs text-primary">{user.id}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Phone</p>
          <p className="text-sm">{user.phone ?? "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Organization</p>
          <p className="text-sm font-medium">{orgName || "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Wallet</p>
          <p className="font-mono text-xs text-muted-foreground truncate">{user.walletAddress ?? "Not assigned"}</p>
        </div>
      </div>
      {roleCfg && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Role Permissions</p>
          <div className="flex flex-wrap gap-1.5">
            {roleCfg.permissions.map((perm) => (
              <span key={perm} className={cn(
                "px-2 py-0.5 rounded font-mono text-xs border",
                perm === "*:all"
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-secondary border-border/50 text-muted-foreground"
              )}>
                {perm}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const INVITE_BLANK = { name: "", email: "", phone: "", role: "farmer", orgId: "", password: "TH@2025!" };
const ORG_BLANK = { name: "", type: "cooperative", registrationNumber: "", kraPin: "", county: "", contactEmail: "", contactPhone: "" };

export default function UsersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"users" | "orgs" | "rbac" | "audit">("users");
  const [roleFilter, setRoleFilter] = useState("all");
  const [kycFilter, setKycFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [rejectUserId, setRejectUserId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState(INVITE_BLANK);
  const [inviteError, setInviteError] = useState("");

  const [editUser, setEditUser] = useState<any | null>(null);
  const [editRole, setEditRole] = useState("");

  const [showNewOrg, setShowNewOrg] = useState(false);
  const [orgForm, setOrgForm] = useState(ORG_BLANK);
  const [orgError, setOrgError] = useState("");

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api("/users?limit=100"),
  });

  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => api("/organizations"),
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["user-audit"],
    queryFn: () => api("/users/audit"),
    enabled: tab === "audit",
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => api(`/users/${userId}/kyc/approve`, { method: "POST", body: "{}" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["user-audit"] }); },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      api(`/users/${userId}/kyc/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user-audit"] });
      setRejectUserId(null); setRejectReason("");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      api(`/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["user-audit"] }); },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api(`/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user-audit"] });
      setEditUser(null);
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (body: typeof INVITE_BLANK) => api("/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      if (data.error) { setInviteError(data.error); return; }
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user-audit"] });
      setShowInvite(false); setInviteForm(INVITE_BLANK); setInviteError("");
    },
    onError: () => setInviteError("Failed to create user. Please try again."),
  });

  const createOrgMutation = useMutation({
    mutationFn: (body: typeof ORG_BLANK) => api("/organizations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      if (data.error) { setOrgError(data.error); return; }
      qc.invalidateQueries({ queryKey: ["organizations"] });
      setShowNewOrg(false); setOrgForm(ORG_BLANK); setOrgError("");
    },
    onError: () => setOrgError("Failed to create organization."),
  });

  const suspendOrgMutation = useMutation({
    mutationFn: (id: string) => api(`/organizations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "suspended" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
  });

  const activateOrgMutation = useMutation({
    mutationFn: (id: string) => api(`/organizations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
  });

  const allUsers: any[] = usersData?.users ?? [];
  const orgs: any[] = orgsData?.organizations ?? [];
  const auditLogs: any[] = auditData?.logs ?? [];

  const orgMap: Record<string, string> = {};
  orgs.forEach((o) => { orgMap[o.id] = o.name; });

  const filteredUsers = allUsers.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (kycFilter !== "all" && u.kycStatus !== kycFilter) return false;
    if (statusFilter !== "all" && (u.status ?? "active") !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: allUsers.length,
    active: allUsers.filter((u) => (u.status ?? "active") === "active").length,
    suspended: allUsers.filter((u) => u.status === "suspended").length,
    pending: allUsers.filter((u) => u.kycStatus === "pending").length,
    approved: allUsers.filter((u) => u.kycStatus === "approved").length,
    orgs: orgs.length,
  };

  const roleCounts: Record<string, number> = {};
  allUsers.forEach((u) => { roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity & Governance</h1>
          <p className="text-sm text-muted-foreground mt-1">Users, organizations, KYC verification, and role-based access control</p>
        </div>
        <Button className="gap-2" onClick={() => { setShowInvite(true); setInviteError(""); }}>
          <UserPlus className="w-4 h-4" />
          Invite User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Total Users",   value: stats.total,     icon: Users,        color: "text-foreground" },
          { label: "Active",        value: stats.active,    icon: UserCheck,    color: "text-green-400" },
          { label: "Suspended",     value: stats.suspended, icon: UserX,        color: "text-red-400" },
          { label: "Pending KYC",   value: stats.pending,   icon: Clock,        color: "text-yellow-400" },
          { label: "KYC Approved",  value: stats.approved,  icon: CheckCircle2, color: "text-teal-400" },
          { label: "Organizations", value: stats.orgs,      icon: Building2,    color: "text-blue-400" },
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

      {/* Role Distribution */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">Users by Role</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(roleCounts).map(([role, count]) => {
              const cfg = ROLE_CONFIG[role];
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <div key={role} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-secondary/30 border-border/50 text-xs", cfg.color)}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cfg.label}</span>
                  <span className="font-bold ml-1">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-border/50 gap-1">
        {[
          { key: "users", label: "Users",               icon: Users },
          { key: "orgs",  label: "Organizations",       icon: Building2 },
          { key: "rbac",  label: "Roles & Permissions", icon: ShieldCheck },
          { key: "audit", label: "Audit Log",           icon: ScrollText },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {tab === "users" && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-0 px-6 pt-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                {["all", "active", "suspended"].map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn("px-2.5 py-1 rounded text-xs font-medium transition-colors",
                      statusFilter === s ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">KYC:</span>
                {["all", "pending", "approved", "rejected"].map((k) => (
                  <button key={k} onClick={() => setKycFilter(k)}
                    className={cn("px-2.5 py-1 rounded text-xs font-medium transition-colors",
                      kycFilter === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Role:</span>
                <div className="flex gap-1 flex-wrap">
                  {["all", ...Object.keys(ROLE_CONFIG)].map((r) => (
                    <button key={r} onClick={() => setRoleFilter(r)}
                      className={cn("px-2.5 py-1 rounded text-xs font-medium transition-colors",
                        roleFilter === r ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                      {r === "all" ? "All" : ROLE_CONFIG[r]?.label.split(" / ")[0] ?? r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="w-8" />
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">Loading users…</TableCell>
                  </TableRow>
                )}
                {filteredUsers.map((user) => {
                  const orgName = user.orgId ? (orgMap[user.orgId] ?? user.orgId) : "—";
                  const isSuspended = user.status === "suspended";
                  return (
                    <Fragment key={user.id}>
                      <TableRow
                        className={cn("cursor-pointer border-border/30", isSuspended && "opacity-60")}
                        onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
                      >
                        <TableCell className="w-8 text-muted-foreground">
                          {expandedId === user.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold">{user.name.slice(0, 2).toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><RoleBadge role={user.role} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">{orgName}</TableCell>
                        <TableCell><StatusDot status={user.status ?? "active"} /></TableCell>
                        <TableCell><KycBadge status={user.kycStatus} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 flex-wrap">
                            {user.kycStatus === "pending" && (
                              <>
                                <Button size="sm" variant="outline"
                                  className="h-7 px-2 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
                                  onClick={() => approveMutation.mutate(user.id)}
                                  disabled={approveMutation.isPending}>
                                  <BadgeCheck className="w-3 h-3 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline"
                                  className="h-7 px-2 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                                  onClick={() => setRejectUserId(user.id)}>
                                  Reject
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => { setEditUser(user); setEditRole(user.role); }}>
                              <Edit2 className="w-3 h-3 mr-1" /> Edit
                            </Button>
                            {!isSuspended ? (
                              <Button size="sm" variant="outline"
                                className="h-7 px-2 text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                                onClick={() => statusMutation.mutate({ userId: user.id, status: "suspended" })}
                                disabled={statusMutation.isPending}>
                                <UserX className="w-3 h-3 mr-1" /> Suspend
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline"
                                className="h-7 px-2 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
                                onClick={() => statusMutation.mutate({ userId: user.id, status: "active" })}
                                disabled={statusMutation.isPending}>
                                <UserCheck className="w-3 h-3 mr-1" /> Activate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedId === user.id && (
                        <TableRow className="border-border/30 bg-secondary/10 hover:bg-secondary/10">
                          <TableCell colSpan={8} className="py-3 px-6">
                            <UserDetailPanel user={user} orgName={orgName} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {!usersLoading && filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">No users match the selected filters</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── ORGANIZATIONS TAB ── */}
      {tab === "orgs" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => { setShowNewOrg(true); setOrgError(""); }}>
              <Plus className="w-4 h-4" /> New Organization
            </Button>
          </div>
          <Card className="bg-card border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead>Organization</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>Reg. Number</TableHead>
                    <TableHead>KRA PIN</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgsLoading && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-12">Loading organizations…</TableCell>
                    </TableRow>
                  )}
                  {orgs.map((org) => {
                    const typeCfg = ORG_TYPE_CONFIG[org.type] ?? { label: org.type, color: "text-foreground" };
                    return (
                      <TableRow key={org.id} className="border-border/30">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{org.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{org.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn("text-xs font-medium", typeCfg.color)}>{typeCfg.label}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{org.county ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{org.registrationNumber ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{org.kraPin ?? "—"}</TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{org.memberCount}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{org.adminName ?? "—"}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium border",
                            org.status === "active" ? "bg-green-500/15 text-green-400 border-green-500/30"
                              : org.status === "suspended" ? "bg-red-500/15 text-red-400 border-red-500/30"
                              : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                          )}>
                            {org.status.charAt(0).toUpperCase() + org.status.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {org.status === "active" ? (
                            <Button size="sm" variant="outline"
                              className="h-7 px-2 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                              onClick={() => suspendOrgMutation.mutate(org.id)}>
                              Suspend
                            </Button>
                          ) : org.status === "suspended" ? (
                            <Button size="sm" variant="outline"
                              className="h-7 px-2 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
                              onClick={() => activateOrgMutation.mutate(org.id)}>
                              Re-activate
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!orgsLoading && orgs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-12">No organizations found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── RBAC TAB ── */}
      {tab === "rbac" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
              const Icon = cfg.icon;
              return (
                <Card key={role} className="bg-card border-border/50">
                  <CardContent className="p-4">
                    <div className={cn("flex items-center gap-2 mb-2", cfg.color)}>
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-semibold">{cfg.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{cfg.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {cfg.permissions.slice(0, 3).map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-secondary border border-border/50 font-mono text-xs text-muted-foreground">{p}</span>
                      ))}
                      {cfg.permissions.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded bg-secondary border border-border/50 text-xs text-muted-foreground">+{cfg.permissions.length - 3} more</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Permission Matrix
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground min-w-[200px]">Feature / Engine</th>
                      {RBAC_ROLES.map((role) => {
                        const cfg = ROLE_CONFIG[role];
                        const Icon = cfg?.icon;
                        return (
                          <th key={role} className={cn("px-3 py-2.5 text-center font-medium", cfg?.color ?? "text-foreground")}>
                            <div className="flex flex-col items-center gap-1">
                              {Icon && <Icon className="w-3.5 h-3.5" />}
                              <span className="whitespace-nowrap">{cfg?.label.split(" / ")[0] ?? role}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {RBAC_MATRIX.map((row, i) => (
                      <tr key={row.feature} className={cn("border-b border-border/20", i % 2 === 0 ? "bg-secondary/10" : "")}>
                        <td className="px-4 py-2 text-muted-foreground font-medium">{row.feature}</td>
                        {RBAC_ROLES.map((role) => {
                          const hasAccess = (row as any)[role];
                          return (
                            <td key={role} className="px-3 py-2 text-center">
                              {hasAccess
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mx-auto" />
                                : <span className="text-border">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── AUDIT LOG TAB ── */}
      {tab === "audit" && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-0 px-6 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              User Management Audit Trail
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">All identity, access, and KYC decisions — immutable record</p>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Target User</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">Loading audit log…</TableCell>
                  </TableRow>
                )}
                {auditLogs.map((log) => {
                  const cfg = AUDIT_ACTION_CONFIG[log.action] ?? { label: log.action, color: "text-foreground", icon: Activity };
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={log.id} className="border-border/30">
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cfg.color)}>
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{log.actorName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.targetUserName ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{log.detail ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!auditLoading && auditLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                      No audit events yet — actions will appear here as you manage users
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Invite User Dialog ── */}
      <Dialog open={showInvite} onOpenChange={(open) => { if (!open) { setShowInvite(false); setInviteError(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Invite New User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-name">Full Name *</Label>
                <Input id="inv-name" placeholder="e.g. Jane Wanjiku" value={inviteForm.name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-email">Email Address *</Label>
                <Input id="inv-email" type="email" placeholder="jane@example.co.ke" value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-phone">Phone</Label>
                <Input id="inv-phone" placeholder="+254 7XX XXX XXX" value={inviteForm.phone}
                  onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-role">Role *</Label>
                <select id="inv-role" aria-label="Select role" value={inviteForm.role}
                  onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background">
                  {Object.entries(ROLE_CONFIG).map(([r, cfg]) => (
                    <option key={r} value={r}>{cfg.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-org">Organization</Label>
              <select id="inv-org" aria-label="Select organization" value={inviteForm.orgId}
                onChange={(e) => setInviteForm((f) => ({ ...f, orgId: e.target.value }))}
                className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background">
                <option value="">— No organization —</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-pw">Temporary Password</Label>
              <Input id="inv-pw" value={inviteForm.password}
                onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))} />
              <p className="text-xs text-muted-foreground">User must change this on first login.</p>
            </div>
            {inviteError && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">{inviteError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowInvite(false); setInviteError(""); }}>Cancel</Button>
              <Button
                onClick={() => inviteMutation.mutate(inviteForm)}
                disabled={inviteMutation.isPending || !inviteForm.name || !inviteForm.email}>
                {inviteMutation.isPending ? "Creating…" : "Create User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ── */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> Edit User — {editUser?.name}
            </DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 pt-2">
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{editUser.email}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Current Role</span><span>{ROLE_CONFIG[editUser.role]?.label ?? editUser.role}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={editUser.status === "suspended" ? "text-red-400" : "text-green-400"}>{editUser.status ?? "active"}</span></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Assign New Role</Label>
                <select id="edit-role" aria-label="Select new role" value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background">
                  {Object.entries(ROLE_CONFIG).map(([r, cfg]) => (
                    <option key={r} value={r}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Account Status</p>
                <div className="flex gap-2">
                  {(editUser.status ?? "active") !== "active" ? (
                    <Button size="sm" variant="outline"
                      className="gap-1.5 border-green-500/40 text-green-400 hover:bg-green-500/10"
                      onClick={() => { statusMutation.mutate({ userId: editUser.id, status: "active" }); setEditUser(null); }}>
                      <UserCheck className="w-3.5 h-3.5" /> Activate Account
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline"
                      className="gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10"
                      onClick={() => { statusMutation.mutate({ userId: editUser.id, status: "suspended" }); setEditUser(null); }}>
                      <UserX className="w-3.5 h-3.5" /> Suspend Account
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
                <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
                <Button
                  onClick={() => roleMutation.mutate({ userId: editUser.id, role: editRole })}
                  disabled={roleMutation.isPending || editRole === editUser.role}>
                  {roleMutation.isPending ? "Saving…" : "Save Role"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── New Organization Dialog ── */}
      <Dialog open={showNewOrg} onOpenChange={(open) => { if (!open) { setShowNewOrg(false); setOrgError(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4" /> New Organization
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="org-name">Organization Name *</Label>
                <Input id="org-name" placeholder="e.g. Kitale Farmers Cooperative" value={orgForm.name}
                  onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-type">Type *</Label>
                <select id="org-type" aria-label="Select organization type" value={orgForm.type}
                  onChange={(e) => setOrgForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background">
                  {Object.entries(ORG_TYPE_CONFIG).map(([t, cfg]) => (
                    <option key={t} value={t}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-county">County</Label>
                <Input id="org-county" placeholder="e.g. Trans Nzoia" value={orgForm.county}
                  onChange={(e) => setOrgForm((f) => ({ ...f, county: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-reg">Registration Number</Label>
                <Input id="org-reg" placeholder="e.g. CPY/2020/001234" value={orgForm.registrationNumber}
                  onChange={(e) => setOrgForm((f) => ({ ...f, registrationNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-kra">KRA PIN</Label>
                <Input id="org-kra" placeholder="e.g. P051234567A" value={orgForm.kraPin}
                  onChange={(e) => setOrgForm((f) => ({ ...f, kraPin: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-email">Contact Email</Label>
                <Input id="org-email" type="email" placeholder="contact@org.co.ke" value={orgForm.contactEmail}
                  onChange={(e) => setOrgForm((f) => ({ ...f, contactEmail: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-phone">Contact Phone</Label>
                <Input id="org-phone" placeholder="+254 7XX XXX XXX" value={orgForm.contactPhone}
                  onChange={(e) => setOrgForm((f) => ({ ...f, contactPhone: e.target.value }))} />
              </div>
            </div>
            {orgError && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">{orgError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowNewOrg(false); setOrgError(""); }}>Cancel</Button>
              <Button
                onClick={() => createOrgMutation.mutate(orgForm)}
                disabled={createOrgMutation.isPending || !orgForm.name}>
                {createOrgMutation.isPending ? "Creating…" : "Create Organization"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reject KYC Dialog ── */}
      <Dialog open={!!rejectUserId} onOpenChange={(open) => !open && setRejectUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject KYC Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Rejection</Label>
              <Input id="reason" placeholder="e.g. Document blurry, ID expired…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRejectUserId(null)}>Cancel</Button>
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => rejectUserId && rejectMutation.mutate({ userId: rejectUserId, reason: rejectReason })}
                disabled={rejectMutation.isPending || !rejectReason}>
                {rejectMutation.isPending ? "Rejecting…" : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
