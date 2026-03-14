import { db } from "@workspace/db";
import { walletsTable, walletTransactionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

type TxType = "deposit" | "withdrawal" | "loan_disbursement" | "loan_repayment" | "trade_settlement" | "escrow_lock" | "escrow_release" | "transfer_in" | "transfer_out" | "fee";
type Currency = "KES" | "USDC";
type RailProvider = "mpesa" | "pesalink" | "paystack" | "pesapal" | "stablecoin" | "internal";

export async function ensureWallets(userId: string) {
  for (const currency of ["KES", "USDC"] as Currency[]) {
    const [existing] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, userId), eq(walletsTable.currency, currency)))
      .limit(1);
    if (!existing) {
      await db.insert(walletsTable).values({ userId, currency });
    }
  }
}

export async function getWallet(userId: string, currency: Currency = "KES") {
  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(and(eq(walletsTable.userId, userId), eq(walletsTable.currency, currency)))
    .limit(1);
  return wallet ?? null;
}

export async function creditWallet(opts: {
  userId: string;
  amount: number;
  currency: Currency;
  type: TxType;
  description?: string;
  railProvider?: RailProvider;
  reference?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
}) {
  await ensureWallets(opts.userId);
  const wallet = await getWallet(opts.userId, opts.currency);
  if (!wallet) throw new Error(`Wallet not found for user ${opts.userId}`);

  const before = Number(wallet.balance);
  const after = before + opts.amount;

  await db
    .update(walletsTable)
    .set({ balance: String(after), updatedAt: new Date() })
    .where(eq(walletsTable.id, wallet.id));

  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    userId: opts.userId,
    type: opts.type,
    amount: String(opts.amount),
    balanceBefore: String(before),
    balanceAfter: String(after),
    currency: opts.currency,
    status: "completed",
    railProvider: opts.railProvider ?? "internal",
    reference: opts.reference ?? null,
    description: opts.description ?? null,
    relatedEntityId: opts.relatedEntityId ?? null,
    relatedEntityType: opts.relatedEntityType ?? null,
  });

  return after;
}

export async function debitWallet(opts: {
  userId: string;
  amount: number;
  currency: Currency;
  type: TxType;
  description?: string;
  railProvider?: RailProvider;
  reference?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
}) {
  await ensureWallets(opts.userId);
  const wallet = await getWallet(opts.userId, opts.currency);
  if (!wallet) throw new Error(`Wallet not found for user ${opts.userId}`);

  const before = Number(wallet.balance);
  if (before < opts.amount) throw new Error("Insufficient wallet balance");
  const after = before - opts.amount;

  await db
    .update(walletsTable)
    .set({ balance: String(after), updatedAt: new Date() })
    .where(eq(walletsTable.id, wallet.id));

  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    userId: opts.userId,
    type: opts.type,
    amount: String(opts.amount),
    balanceBefore: String(before),
    balanceAfter: String(after),
    currency: opts.currency,
    status: "completed",
    railProvider: opts.railProvider ?? "internal",
    reference: opts.reference ?? null,
    description: opts.description ?? null,
    relatedEntityId: opts.relatedEntityId ?? null,
    relatedEntityType: opts.relatedEntityType ?? null,
  });

  return after;
}

export async function lockBalance(opts: {
  userId: string;
  amount: number;
  currency: Currency;
  relatedEntityId?: string;
  relatedEntityType?: string;
  description?: string;
}) {
  await ensureWallets(opts.userId);
  const wallet = await getWallet(opts.userId, opts.currency);
  if (!wallet) throw new Error("Wallet not found");

  const avail = Number(wallet.balance);
  if (avail < opts.amount) throw new Error("Insufficient balance to lock");

  const newAvail = avail - opts.amount;
  const newLocked = Number(wallet.lockedBalance) + opts.amount;

  await db
    .update(walletsTable)
    .set({ balance: String(newAvail), lockedBalance: String(newLocked), updatedAt: new Date() })
    .where(eq(walletsTable.id, wallet.id));

  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    userId: opts.userId,
    type: "escrow_lock",
    amount: String(opts.amount),
    balanceBefore: String(avail),
    balanceAfter: String(newAvail),
    currency: opts.currency,
    status: "completed",
    railProvider: "internal",
    description: opts.description ?? "Escrow lock",
    relatedEntityId: opts.relatedEntityId ?? null,
    relatedEntityType: opts.relatedEntityType ?? null,
  });
}

export async function releaseBalance(opts: {
  userId: string;
  amount: number;
  currency: Currency;
  relatedEntityId?: string;
  relatedEntityType?: string;
  description?: string;
}) {
  const wallet = await getWallet(opts.userId, opts.currency);
  if (!wallet) throw new Error("Wallet not found");

  const locked = Number(wallet.lockedBalance);
  const release = Math.min(opts.amount, locked);
  const newLocked = locked - release;
  const newAvail = Number(wallet.balance) + release;

  await db
    .update(walletsTable)
    .set({ balance: String(newAvail), lockedBalance: String(newLocked), updatedAt: new Date() })
    .where(eq(walletsTable.id, wallet.id));

  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    userId: opts.userId,
    type: "escrow_release",
    amount: String(release),
    balanceBefore: String(Number(wallet.balance)),
    balanceAfter: String(newAvail),
    currency: opts.currency,
    status: "completed",
    railProvider: "internal",
    description: opts.description ?? "Escrow release",
    relatedEntityId: opts.relatedEntityId ?? null,
    relatedEntityType: opts.relatedEntityType ?? null,
  });
}
