import { db } from "@workspace/db";
import { ledgerEntriesTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { generateId } from "@workspace/db/utils/id";

type AccountType = "platform_account" | "user_wallet" | "external";
type Currency = "KES" | "USDC";

export interface LedgerSide {
  accountId: string;
  accountType: AccountType;
  accountLabel: string;
}

export interface DoubleEntryOpts {
  debit: LedgerSide;
  credit: LedgerSide;
  amount: number;
  currency: Currency;
  description: string;
  reference?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
}

/**
 * Record a balanced double-entry pair.
 * Both sides share the same txnGroupId so they can be reconciled together.
 */
export async function recordDoubleEntry(opts: DoubleEntryOpts): Promise<string> {
  const txnGroupId = generateId("TXG");

  await db.insert(ledgerEntriesTable).values([
    {
      txnGroupId,
      entryType: "debit",
      accountId: opts.debit.accountId,
      accountType: opts.debit.accountType,
      accountLabel: opts.debit.accountLabel,
      amount: String(opts.amount),
      currency: opts.currency,
      description: opts.description,
      reference: opts.reference ?? null,
      relatedEntityId: opts.relatedEntityId ?? null,
      relatedEntityType: opts.relatedEntityType ?? null,
    },
    {
      txnGroupId,
      entryType: "credit",
      accountId: opts.credit.accountId,
      accountType: opts.credit.accountType,
      accountLabel: opts.credit.accountLabel,
      amount: String(opts.amount),
      currency: opts.currency,
      description: opts.description,
      reference: opts.reference ?? null,
      relatedEntityId: opts.relatedEntityId ?? null,
      relatedEntityType: opts.relatedEntityType ?? null,
    },
  ]);

  return txnGroupId;
}

/** Fetch all ledger entries for a transaction group. */
export async function getLedgerByGroup(txnGroupId: string) {
  return db
    .select()
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.txnGroupId, txnGroupId))
    .orderBy(ledgerEntriesTable.entryType);
}

/** Fetch recent ledger entries with optional filters. */
export async function getLedgerEntries(opts: {
  currency?: Currency;
  accountId?: string;
  relatedEntityId?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions: any[] = [];
  if (opts.currency) conditions.push(eq(ledgerEntriesTable.currency, opts.currency));
  if (opts.accountId) conditions.push(eq(ledgerEntriesTable.accountId, opts.accountId));
  if (opts.relatedEntityId) conditions.push(eq(ledgerEntriesTable.relatedEntityId, opts.relatedEntityId));

  const [entries, countResult] = await Promise.all([
    db
      .select()
      .from(ledgerEntriesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(ledgerEntriesTable.createdAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(ledgerEntriesTable)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  return { entries, total: Number(countResult[0].count) };
}

/** Reconciliation: sum all debits and credits — they must always be equal. */
export async function getReconciliation() {
  const [kesDebits] = await db
    .select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
    .from(ledgerEntriesTable)
    .where(and(eq(ledgerEntriesTable.entryType, "debit"), eq(ledgerEntriesTable.currency, "KES")));

  const [kesCredits] = await db
    .select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
    .from(ledgerEntriesTable)
    .where(and(eq(ledgerEntriesTable.entryType, "credit"), eq(ledgerEntriesTable.currency, "KES")));

  const [usdcDebits] = await db
    .select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
    .from(ledgerEntriesTable)
    .where(and(eq(ledgerEntriesTable.entryType, "debit"), eq(ledgerEntriesTable.currency, "USDC")));

  const [usdcCredits] = await db
    .select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
    .from(ledgerEntriesTable)
    .where(and(eq(ledgerEntriesTable.entryType, "credit"), eq(ledgerEntriesTable.currency, "USDC")));

  const [totalEntries] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ledgerEntriesTable);

  const kesDiff = Number(kesDebits.total) - Number(kesCredits.total);
  const usdcDiff = Number(usdcDebits.total) - Number(usdcCredits.total);

  return {
    kes: {
      totalDebits: Number(kesDebits.total).toFixed(2),
      totalCredits: Number(kesCredits.total).toFixed(2),
      balanced: Math.abs(kesDiff) < 0.01,
      difference: kesDiff.toFixed(2),
    },
    usdc: {
      totalDebits: Number(usdcDebits.total).toFixed(2),
      totalCredits: Number(usdcCredits.total).toFixed(2),
      balanced: Math.abs(usdcDiff) < 0.01,
      difference: usdcDiff.toFixed(2),
    },
    totalEntries: Number(totalEntries.count),
    systemBalanced: Math.abs(kesDiff) < 0.01 && Math.abs(usdcDiff) < 0.01,
  };
}
