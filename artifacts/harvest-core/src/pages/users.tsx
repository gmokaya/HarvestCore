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
  BadgeCheck, AlertTriangle,
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

export default function UsersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"users" | "orgs" | "rbac">("users");
  const [roleFilter, setRoleFilter] = useState("all");
  const [kycFilter, setKycFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectUserId, setRejectUserId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api("/users?limit=50"),
  });

  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => api("/organizations"),
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => api(`/users/${userId}/kyc/approve`, { method: "POST", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      api(`/users/${userId}/kyc/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setRejectUserId(null); setRejectReason(""); },
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

  const orgMap: Record<string, string> = {};
  orgs.forEach((o) => { orgMap[o.id] = o.name; });

  const filteredUsers = allUsers.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (kycFilter !== "all" && u.kycStatus !== kycFilter) return false;
    return true;
  });

  const stats = {
    total: allUsers.length,
    approved: allUsers.filter((u) => u.kycStatus === "approved").length,
    pending: allUsers.filter((u) => u.kycStatus === "pending").length,
    rejected: allUsers.filter((u) => u.kycStatus === "rejected").length,
  };

  const roleCounts: Record<string, number> = {};
  allUsers.forEach((u) => { roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1; });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity & Governance</h1>
          <p className="text-sm text-muted-foreground mt-1">Users, organizations, KYC verification, and role-based access control</p>
        </div>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Invite User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: stats.total, icon: Users, color: "text-foreground" },
          { label: "KYC Approved", value: stats.approved, icon: CheckCircle2, color: "text-green-400" },
          { label: "Pending KYC", value: stats.pending, icon: Clock, color: "text-yellow-400" },
          { label: "Organizations", value: orgs.length, icon: Building2, color: "text-blue-400" },
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
          { key: "users", label: "Users", icon: Users },
          { key: "orgs", label: "Organizations", icon: Building2 },
          { key: "rbac", label: "Roles & Permissions", icon: ShieldCheck },
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

      {/* USERS TAB */}
      {tab === "users" && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-0 px-6 pt-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Role:</span>
                <div className="flex gap-1">
                  {["all", ...Object.keys(ROLE_CONFIG)].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoleFilter(r)}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                        roleFilter === r ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      {r === "all" ? "All" : ROLE_CONFIG[r]?.label.split(" / ")[0] ?? r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">KYC:</span>
                {["all", "pending", "approved", "rejected"].map((k) => (
                  <button
                    key={k}
                    onClick={() => setKycFilter(k)}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                      kycFilter === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </button>
                ))}
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
                  <TableHead>KYC</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">Loading users…</TableCell>
                  </TableRow>
                )}
                {filteredUsers.map((user) => {
                  const orgName = user.orgId ? (orgMap[user.orgId] ?? user.orgId) : "—";
                  return (
                    <Fragment key={user.id}>
                      <TableRow
                        className="cursor-pointer border-border/30"
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
                        <TableCell><KycBadge status={user.kycStatus} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {user.kycStatus === "pending" && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
                                onClick={() => approveMutation.mutate(user.id)}
                                disabled={approveMutation.isPending}
                              >
                                <BadgeCheck className="w-3 h-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                                onClick={() => setRejectUserId(user.id)}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {user.kycStatus === "approved" && (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                            </span>
                          )}
                          {user.kycStatus === "rejected" && (
                            <span className="text-xs text-red-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Rejected
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedId === user.id && (
                        <TableRow className="border-border/30 bg-secondary/10 hover:bg-secondary/10">
                          <TableCell colSpan={7} className="py-3 px-6">
                            <UserDetailPanel user={user} orgName={orgName} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {!usersLoading && filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">No users match the selected filters</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ORGANIZATIONS TAB */}
      {tab === "orgs" && (
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
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                            onClick={() => suspendOrgMutation.mutate(org.id)}
                          >
                            Suspend
                          </Button>
                        ) : org.status === "suspended" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
                            onClick={() => activateOrgMutation.mutate(org.id)}
                          >
                            Re-activate
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* RBAC TAB */}
      {tab === "rbac" && (
        <div className="space-y-4">
          {/* Role Cards */}
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

          {/* Permission Matrix */}
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
                              {hasAccess ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mx-auto" />
                              ) : (
                                <span className="text-border">—</span>
                              )}
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

      {/* Reject Dialog */}
      <Dialog open={!!rejectUserId} onOpenChange={(open) => !open && setRejectUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject KYC Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Rejection</Label>
              <Input
                id="reason"
                placeholder="e.g. Document blurry, ID expired…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRejectUserId(null)}>Cancel</Button>
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => rejectUserId && rejectMutation.mutate({ userId: rejectUserId, reason: rejectReason })}
                disabled={rejectMutation.isPending || !rejectReason}
              >
                {rejectMutation.isPending ? "Rejecting…" : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
