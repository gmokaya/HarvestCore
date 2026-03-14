import { db } from "@workspace/db";
import { investorDistributionsTable, liquidityPoolsTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function createDistribution(opts: {
  poolId: string;
  investorId: string;
  investorName?: string;
  period: string;
  grossAmount: number;
  feeRate?: number;
  currency?: string;
  yieldRate?: string;
  loanIds?: string[];
  note?: string;
}) {
  const feeRate = opts.feeRate ?? 0.05;
  const feeAmount = opts.grossAmount * feeRate;
  const netAmount = opts.grossAmount - feeAmount;

  const [row] = await db.insert(investorDistributionsTable).values({
    poolId:       opts.poolId,
    investorId:   opts.investorId,
    investorName: opts.investorName ?? null,
    period:       opts.period,
    grossAmount:  opts.grossAmount.toFixed(2),
    feeAmount:    feeAmount.toFixed(2),
    netAmount:    netAmount.toFixed(2),
    currency:     opts.currency ?? "KES",
    yieldRate:    opts.yieldRate ?? null,
    loanIds:      opts.loanIds ? JSON.stringify(opts.loanIds) : null,
    note:         opts.note ?? null,
    status:       "pending",
  }).returning();
  return row;
}

export async function markDistributionPaid(distributionId: string) {
  await db.update(investorDistributionsTable).set({
    status: "paid",
    paidAt: new Date(),
  }).where(eq(investorDistributionsTable.id, distributionId));
}

export async function getDistributions(opts: {
  poolId?: string;
  investorId?: string;
  period?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const conds: any[] = [];
  if (opts.poolId)     conds.push(eq(investorDistributionsTable.poolId,     opts.poolId));
  if (opts.investorId) conds.push(eq(investorDistributionsTable.investorId, opts.investorId));
  if (opts.period)     conds.push(eq(investorDistributionsTable.period,     opts.period));
  if (opts.status)     conds.push(eq(investorDistributionsTable.status,     opts.status as any));

  const [rows, countRes] = await Promise.all([
    db.select().from(investorDistributionsTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(investorDistributionsTable.createdAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0),
    db.select({ count: sql<number>`count(*)` })
      .from(investorDistributionsTable)
      .where(conds.length ? and(...conds) : undefined),
  ]);
  return { distributions: rows, total: Number(countRes[0].count) };
}

export async function getDistributionSummary() {
  const [totals] = await db.select({
    totalDistributed: sql<string>`coalesce(sum(net_amount::numeric) filter (where status = 'paid'), 0)`,
    pendingAmount:    sql<string>`coalesce(sum(net_amount::numeric) filter (where status = 'pending'), 0)`,
    totalGross:       sql<string>`coalesce(sum(gross_amount::numeric), 0)`,
    totalFees:        sql<string>`coalesce(sum(fee_amount::numeric), 0)`,
    count:            sql<number>`count(*)`,
    paidCount:        sql<number>`count(*) filter (where status = 'paid')`,
    pendingCount:     sql<number>`count(*) filter (where status = 'pending')`,
  }).from(investorDistributionsTable);

  const byPool = await db.select({
    poolId:     investorDistributionsTable.poolId,
    total:      sql<string>`coalesce(sum(net_amount::numeric), 0)`,
    count:      sql<number>`count(*)`,
  })
    .from(investorDistributionsTable)
    .groupBy(investorDistributionsTable.poolId);

  return {
    totalDistributed: Number(totals.totalDistributed).toFixed(2),
    pendingAmount:    Number(totals.pendingAmount).toFixed(2),
    totalGross:       Number(totals.totalGross).toFixed(2),
    totalFees:        Number(totals.totalFees).toFixed(2),
    count:            Number(totals.count),
    paidCount:        Number(totals.paidCount),
    pendingCount:     Number(totals.pendingCount),
    byPool,
  };
}
