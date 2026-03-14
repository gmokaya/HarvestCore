import { db } from "@workspace/db";
import { liquidityPoolsTable, poolTransactionsTable, platformAccountsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { recordDoubleEntry } from "./ledger";

type PoolType = "loan_financing" | "trading_settlement" | "stablecoin";

const PLATFORM_TREASURY_LABEL = "Platform Treasury";
const PLATFORM_TREASURY_TYPE = "platform_account" as const;

async function getPool(poolType: PoolType) {
  const [pool] = await db
    .select()
    .from(liquidityPoolsTable)
    .where(eq(liquidityPoolsTable.poolType, poolType))
    .limit(1);
  return pool ?? null;
}

async function getOrCreatePool(poolType: PoolType) {
  let pool = await getPool(poolType);
  if (!pool) {
    const config: Record<PoolType, { name: string; currency: string; capacity: string; description: string }> = {
      loan_financing: { name: "Loan Financing Pool", currency: "KES", capacity: "500000000", description: "Capital pool for agricultural loan disbursements" },
      trading_settlement: { name: "Trading Settlement Pool", currency: "KES", capacity: "200000000", description: "Liquidity pool for commodity trade settlements" },
      stablecoin: { name: "Stablecoin Pool", currency: "USDC", capacity: "10000000", description: "USDC pool for cross-border and DeFi settlements" },
    };
    const c = config[poolType];
    [pool] = await db.insert(liquidityPoolsTable).values({ poolType, ...c }).returning();
  }
  return pool;
}

export async function getAllPools() {
  // Ensure all 3 pools exist
  await Promise.all([
    getOrCreatePool("loan_financing"),
    getOrCreatePool("trading_settlement"),
    getOrCreatePool("stablecoin"),
  ]);
  return db.select().from(liquidityPoolsTable).orderBy(liquidityPoolsTable.poolType);
}

export async function depositToPool(opts: {
  poolType: PoolType;
  amount: number;
  userId?: string;
  description?: string;
  debitAccountId?: string;
  debitAccountLabel?: string;
}) {
  const pool = await getOrCreatePool(opts.poolType);
  const before = Number(pool.balance);
  const after = before + opts.amount;
  const newDeposited = Number(pool.totalDeposited) + opts.amount;

  await db
    .update(liquidityPoolsTable)
    .set({ balance: String(after), totalDeposited: String(newDeposited), updatedAt: new Date() })
    .where(eq(liquidityPoolsTable.id, pool.id));

  await db.insert(poolTransactionsTable).values({
    poolId: pool.id,
    txType: "deposit",
    amount: String(opts.amount),
    balanceBefore: String(before),
    balanceAfter: String(after),
    currency: pool.currency,
    userId: opts.userId ?? null,
    description: opts.description ?? `Deposit to ${pool.name}`,
    relatedEntityId: pool.id,
  });

  // Double-entry: Debit source → Credit pool
  await recordDoubleEntry({
    debit: {
      accountId: opts.debitAccountId ?? "EXTERNAL",
      accountType: opts.debitAccountId ? "platform_account" : "external",
      accountLabel: opts.debitAccountLabel ?? "External Investor",
    },
    credit: {
      accountId: pool.id,
      accountType: "platform_account",
      accountLabel: pool.name,
    },
    amount: opts.amount,
    currency: pool.currency as "KES" | "USDC",
    description: opts.description ?? `Pool deposit — ${pool.name}`,
    relatedEntityId: pool.id,
    relatedEntityType: "liquidity_pool",
  });

  return after;
}

export async function withdrawFromPool(opts: {
  poolType: PoolType;
  amount: number;
  userId?: string;
  description?: string;
  creditAccountId?: string;
  creditAccountLabel?: string;
}) {
  const pool = await getOrCreatePool(opts.poolType);
  const avail = Number(pool.balance) - Number(pool.lockedBalance);
  if (avail < opts.amount) throw new Error(`Insufficient pool liquidity. Available: ${pool.currency} ${avail.toFixed(2)}`);

  const before = Number(pool.balance);
  const after = before - opts.amount;
  const newWithdrawn = Number(pool.totalWithdrawn) + opts.amount;

  await db
    .update(liquidityPoolsTable)
    .set({ balance: String(after), totalWithdrawn: String(newWithdrawn), updatedAt: new Date() })
    .where(eq(liquidityPoolsTable.id, pool.id));

  await db.insert(poolTransactionsTable).values({
    poolId: pool.id,
    txType: "withdrawal",
    amount: String(opts.amount),
    balanceBefore: String(before),
    balanceAfter: String(after),
    currency: pool.currency,
    userId: opts.userId ?? null,
    description: opts.description ?? `Withdrawal from ${pool.name}`,
    relatedEntityId: pool.id,
  });

  // Double-entry: Debit pool → Credit destination
  await recordDoubleEntry({
    debit: {
      accountId: pool.id,
      accountType: "platform_account",
      accountLabel: pool.name,
    },
    credit: {
      accountId: opts.creditAccountId ?? "EXTERNAL",
      accountType: opts.creditAccountId ? "platform_account" : "external",
      accountLabel: opts.creditAccountLabel ?? "External Recipient",
    },
    amount: opts.amount,
    currency: pool.currency as "KES" | "USDC",
    description: opts.description ?? `Pool withdrawal — ${pool.name}`,
    relatedEntityId: pool.id,
    relatedEntityType: "liquidity_pool",
  });

  return after;
}

export async function fundLoanFromPool(opts: {
  loanId: string;
  borrowerWalletId: string;
  borrowerLabel: string;
  amount: number;
}) {
  return withdrawFromPool({
    poolType: "loan_financing",
    amount: opts.amount,
    description: `Loan disbursement — ${opts.loanId}`,
    creditAccountId: opts.borrowerWalletId,
    creditAccountLabel: opts.borrowerLabel,
  });
}

export async function repayToPool(opts: {
  loanId: string;
  borrowerWalletId: string;
  borrowerLabel: string;
  amount: number;
}) {
  return depositToPool({
    poolType: "loan_financing",
    amount: opts.amount,
    description: `Loan repayment — ${opts.loanId}`,
    debitAccountId: opts.borrowerWalletId,
    debitAccountLabel: opts.borrowerLabel,
  });
}

export { getPool, getOrCreatePool };
