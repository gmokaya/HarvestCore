import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { ShieldX, ArrowLeft, Home } from "lucide-react";
import { allowedPaths } from "@/lib/permissions";
import { Button } from "@/components/ui";

const PAGE_NAMES: Record<string, string> = {
  "/":                  "Dashboard",
  "/users":             "Identity & KYC",
  "/inventory":         "Inventory & Logistics",
  "/inspection":        "Inspection & Quality",
  "/receipts":          "Warehouse Receipts",
  "/tokens":            "Tokens",
  "/loans":             "Credit & Loans",
  "/forward-contracts": "Forward Contracts",
  "/wallet":            "Wallet & Payments",
  "/finance-hub":       "Finance Engine",
  "/marketplace":       "Marketplace",
  "/settlement":        "Settlement",
};

const ROLE_LABEL: Record<string, string> = {
  admin:              "Platform Admin",
  farmer:             "Farmer / Borrower",
  trader:             "Commodity Trader",
  collateral_manager: "Collateral Manager",
  processor:          "Processor",
  warehouse_op:       "Warehouse Operator",
  checker:            "Checker / Auditor",
  lender:             "Lender",
};

export default function AccessDenied() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const allowed = allowedPaths(role).filter((p) => p !== "/");

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.2)" }}>
        <ShieldX className="w-10 h-10 text-red-400" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-2">Access Restricted</h1>
      <p className="text-muted-foreground text-sm max-w-sm mb-1">
        Your account role — <span className="font-semibold text-foreground">{ROLE_LABEL[role] ?? role}</span> — does not have
        permission to view this page.
      </p>
      <p className="text-muted-foreground text-xs mb-8">
        Contact your platform administrator if you believe this is an error.
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-10">
        <Button variant="outline" className="gap-2" onClick={() => history.back()}>
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
        <Button className="gap-2" onClick={() => navigate("/")}>
          <Home className="w-4 h-4" /> Dashboard
        </Button>
      </div>

      {/* Pages this role CAN access */}
      {allowed.length > 0 && (
        <div className="max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Pages available to your role
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {allowed.map((path) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border/50 bg-secondary/50 hover:bg-secondary transition-colors text-foreground"
              >
                {PAGE_NAMES[path] ?? path}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
