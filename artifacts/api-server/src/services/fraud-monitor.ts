import { db } from "@workspace/db";
import { fraudAlertsTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

type AlertType = "large_withdrawal" | "rapid_transfers" | "suspicious_pattern" | "velocity_breach" | "unusual_hours" | "account_takeover";
type Severity   = "low" | "medium" | "high" | "critical";

export async function createFraudAlert(opts: {
  alertType: AlertType;
  severity: Severity;
  userId: string;
  walletId?: string;
  amount?: number;
  currency?: string;
  description: string;
  transactionRef?: string;
}) {
  const [row] = await db.insert(fraudAlertsTable).values({
    alertType:      opts.alertType,
    severity:       opts.severity,
    userId:         opts.userId,
    walletId:       opts.walletId ?? null,
    amount:         opts.amount != null ? String(opts.amount) : null,
    currency:       opts.currency ?? "KES",
    description:    opts.description,
    transactionRef: opts.transactionRef ?? null,
    status:         "open",
  }).returning();
  return row;
}

export async function resolveAlert(alertId: string, resolvedBy: string, note: string) {
  await db.update(fraudAlertsTable).set({
    status:         "resolved",
    resolvedBy,
    resolutionNote: note,
    resolvedAt:     new Date(),
    updatedAt:      new Date(),
  }).where(eq(fraudAlertsTable.id, alertId));
}

export async function dismissAlert(alertId: string, resolvedBy: string, note: string) {
  await db.update(fraudAlertsTable).set({
    status:         "dismissed",
    resolvedBy,
    resolutionNote: note,
    resolvedAt:     new Date(),
    updatedAt:      new Date(),
  }).where(eq(fraudAlertsTable.id, alertId));
}

export async function escalateAlert(alertId: string) {
  await db.update(fraudAlertsTable).set({
    status:    "investigating",
    updatedAt: new Date(),
  }).where(eq(fraudAlertsTable.id, alertId));
}

export async function getFraudAlerts(opts: {
  status?: string;
  severity?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}) {
  const conds: any[] = [];
  if (opts.status)   conds.push(eq(fraudAlertsTable.status,   opts.status   as any));
  if (opts.severity) conds.push(eq(fraudAlertsTable.severity, opts.severity as any));
  if (opts.userId)   conds.push(eq(fraudAlertsTable.userId,   opts.userId));

  const [rows, countRes] = await Promise.all([
    db.select().from(fraudAlertsTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(fraudAlertsTable.createdAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0),
    db.select({ count: sql<number>`count(*)` })
      .from(fraudAlertsTable)
      .where(conds.length ? and(...conds) : undefined),
  ]);
  return { alerts: rows, total: Number(countRes[0].count) };
}

export async function getAlertSummary() {
  const [totals] = await db.select({
    total:        sql<number>`count(*)`,
    open:         sql<number>`count(*) filter (where status = 'open')`,
    investigating:sql<number>`count(*) filter (where status = 'investigating')`,
    resolved:     sql<number>`count(*) filter (where status = 'resolved')`,
    dismissed:    sql<number>`count(*) filter (where status = 'dismissed')`,
    critical:     sql<number>`count(*) filter (where severity = 'critical')`,
    high:         sql<number>`count(*) filter (where severity = 'high')`,
    medium:       sql<number>`count(*) filter (where severity = 'medium')`,
    low:          sql<number>`count(*) filter (where severity = 'low')`,
  }).from(fraudAlertsTable);

  return {
    total:         Number(totals.total),
    open:          Number(totals.open),
    investigating: Number(totals.investigating),
    resolved:      Number(totals.resolved),
    dismissed:     Number(totals.dismissed),
    bySeverity: {
      critical: Number(totals.critical),
      high:     Number(totals.high),
      medium:   Number(totals.medium),
      low:      Number(totals.low),
    },
  };
}

/** Automated check: flag any wallet_transaction that exceeds KES 1M single withdrawal */
export async function runAutomatedChecks() {
  // This function is called at startup and could be called by a cron job.
  // For now it's a placeholder that returns the current alert count.
  const [res] = await db.select({ count: sql<number>`count(*)` }).from(fraudAlertsTable)
    .where(eq(fraudAlertsTable.status, "open"));
  return { openAlerts: Number(res.count) };
}
