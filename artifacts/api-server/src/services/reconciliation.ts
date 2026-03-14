import { db } from "@workspace/db";
import { paymentRailTransactionsTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { generateId } from "@workspace/db/utils/id";

type Rail = "mpesa" | "pesalink" | "paystack" | "pesapal" | "stablecoin" | "manual";
type Direction = "inbound" | "outbound";

export interface ImportRailTxnOpts {
  rail: Rail;
  externalRef: string;
  direction: Direction;
  amount: number;
  currency: string;
  phoneOrAccount?: string;
  rawPayload?: string;
}

export async function importRailTransaction(opts: ImportRailTxnOpts) {
  const [existing] = await db
    .select({ id: paymentRailTransactionsTable.id })
    .from(paymentRailTransactionsTable)
    .where(eq(paymentRailTransactionsTable.externalRef, opts.externalRef))
    .limit(1);
  if (existing) return { duplicate: true, id: existing.id };

  const [row] = await db.insert(paymentRailTransactionsTable).values({
    rail: opts.rail,
    externalRef: opts.externalRef,
    direction: opts.direction,
    amount: String(opts.amount),
    currency: opts.currency,
    phoneOrAccount: opts.phoneOrAccount ?? null,
    rawPayload: opts.rawPayload ?? null,
    status: "unmatched",
  }).returning();
  return { duplicate: false, id: row.id };
}

export async function matchRailTransaction(railTxnId: string, ledgerGroupId: string, walletTransactionId?: string) {
  await db.update(paymentRailTransactionsTable)
    .set({
      status: "matched",
      ledgerGroupId,
      walletTransactionId: walletTransactionId ?? null,
      matchedAt: new Date(),
    })
    .where(eq(paymentRailTransactionsTable.id, railTxnId));
}

export async function markDiscrepancy(railTxnId: string, note: string) {
  await db.update(paymentRailTransactionsTable)
    .set({ status: "discrepancy", discrepancyNote: note })
    .where(eq(paymentRailTransactionsTable.id, railTxnId));
}

export async function dismissRailTransaction(railTxnId: string) {
  await db.update(paymentRailTransactionsTable)
    .set({ status: "dismissed" })
    .where(eq(paymentRailTransactionsTable.id, railTxnId));
}

export async function getRailTransactions(opts: {
  rail?: Rail;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const conds: any[] = [];
  if (opts.rail) conds.push(eq(paymentRailTransactionsTable.rail, opts.rail));
  if (opts.status) conds.push(eq(paymentRailTransactionsTable.status, opts.status as any));

  const [rows, countRes] = await Promise.all([
    db.select().from(paymentRailTransactionsTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(paymentRailTransactionsTable.importedAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0),
    db.select({ count: sql<number>`count(*)` })
      .from(paymentRailTransactionsTable)
      .where(conds.length ? and(...conds) : undefined),
  ]);

  return { transactions: rows, total: Number(countRes[0].count) };
}

export async function getReconciliationSummary() {
  const [totals] = await db
    .select({
      total:      sql<number>`count(*)`,
      matched:    sql<number>`count(*) filter (where status = 'matched')`,
      unmatched:  sql<number>`count(*) filter (where status = 'unmatched')`,
      discrepancy:sql<number>`count(*) filter (where status = 'discrepancy')`,
      dismissed:  sql<number>`count(*) filter (where status = 'dismissed')`,
    })
    .from(paymentRailTransactionsTable);

  const byRail = await db
    .select({
      rail:     paymentRailTransactionsTable.rail,
      total:    sql<number>`count(*)`,
      matched:  sql<number>`count(*) filter (where status = 'matched')`,
    })
    .from(paymentRailTransactionsTable)
    .groupBy(paymentRailTransactionsTable.rail);

  return {
    total:       Number(totals.total),
    matched:     Number(totals.matched),
    unmatched:   Number(totals.unmatched),
    discrepancy: Number(totals.discrepancy),
    dismissed:   Number(totals.dismissed),
    matchRate:   totals.total > 0
      ? ((Number(totals.matched) / Number(totals.total)) * 100).toFixed(1)
      : "0.0",
    byRail,
  };
}
