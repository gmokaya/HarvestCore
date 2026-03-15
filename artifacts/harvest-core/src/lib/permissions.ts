export type AppRole =
  | "admin"
  | "farmer"
  | "trader"
  | "collateral_manager"
  | "processor"
  | "warehouse_op"
  | "checker"
  | "lender";

/** Routes accessible to each role. "*" means all authenticated users. */
export const ROUTE_PERMISSIONS: Record<string, AppRole[] | "*"> = {
  "/":                  "*",
  "/users":             ["admin"],
  "/inventory":         ["admin", "farmer", "trader", "collateral_manager", "processor", "warehouse_op", "checker"],
  "/warehouse-management": ["admin", "collateral_manager", "warehouse_op", "checker"],
  "/inspection":        ["admin", "collateral_manager", "warehouse_op", "checker"],
  "/receipts":          ["admin", "collateral_manager", "warehouse_op"],
  "/tokens":            ["admin", "collateral_manager"],
  "/loans":             ["admin", "farmer", "collateral_manager", "checker", "lender"],
  "/forward-contracts": ["admin", "trader", "processor"],
  "/wallet":            ["admin", "farmer", "trader", "processor"],
  "/finance-hub":       ["admin"],
  "/marketplace":       ["admin", "farmer", "trader", "processor"],
  "/settlement":        ["admin", "collateral_manager", "lender"],
};

export function canAccess(role: string, path: string): boolean {
  const allowed = ROUTE_PERMISSIONS[path];
  if (!allowed) return true; // unknown paths fall through to NotFound
  if (allowed === "*") return true;
  return (allowed as AppRole[]).includes(role as AppRole);
}

/** Return every path the role is allowed to visit */
export function allowedPaths(role: string): string[] {
  return Object.entries(ROUTE_PERMISSIONS)
    .filter(([, v]) => v === "*" || (v as AppRole[]).includes(role as AppRole))
    .map(([path]) => path);
}
