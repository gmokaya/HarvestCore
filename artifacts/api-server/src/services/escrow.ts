import { db } from "@workspace/db";
import { escrowAccountsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { lockBalance, releaseBalance, debitWallet, creditWallet } from "./wallet";
import { recordDoubleEntry } from "./ledger";

type Currency = "KES" | "USDC";

const ESCROW_ENGINE_ID = "ESCROW-ENGINE";
const ESCROW_ENGINE_LABEL = "Escrow Engine";

export async function createEscrow(opts: {
  buyerId: string;
  sellerId: string;
  amount: number;
  currency: Currency;
  relatedEntityId?: string;
  relatedEntityType?: string;
  description?: string;
  expiresAt?: Date;
}) {
  const [buyer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, opts.buyerId)).limit(1);
  const [seller] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, opts.sellerId)).limit(1);
  if (!buyer) throw new Error("Buyer not found");
  if (!seller) throw new Error("Seller not found");

  const [escrow] = await db
    .insert(escrowAccountsTable)
    .values({
      buyerId: opts.buyerId,
      sellerId: opts.sellerId,
      amount: String(opts.amount),
      currency: opts.currency,
      status: "pending",
      description: opts.description ?? `Commodity trade escrow`,
      relatedEntityId: opts.relatedEntityId ?? null,
      relatedEntityType: opts.relatedEntityType ?? null,
      expiresAt: opts.expiresAt ?? null,
    })
    .returning();

  return { escrow, buyerName: buyer.name, sellerName: seller.name };
}

export async function fundEscrow(escrowId: string) {
  const [escrow] = await db.select().from(escrowAccountsTable).where(eq(escrowAccountsTable.id, escrowId)).limit(1);
  if (!escrow) throw new Error("Escrow not found");
  if (escrow.status !== "pending") throw new Error(`Cannot fund escrow in status: ${escrow.status}`);

  const amount = Number(escrow.amount);
  const currency = escrow.currency as Currency;

  // Lock buyer's funds
  await lockBalance({
    userId: escrow.buyerId,
    amount,
    currency,
    relatedEntityId: escrowId,
    relatedEntityType: "escrow",
    description: `Escrow lock — ${escrow.description ?? escrowId}`,
  });

  // Double-entry: Debit buyer wallet → Credit escrow engine
  await recordDoubleEntry({
    debit: {
      accountId: escrow.buyerId,
      accountType: "user_wallet",
      accountLabel: `Buyer (${escrow.buyerId})`,
    },
    credit: {
      accountId: ESCROW_ENGINE_ID,
      accountType: "platform_account",
      accountLabel: ESCROW_ENGINE_LABEL,
    },
    amount,
    currency,
    description: `Escrow funded — ${escrow.description ?? escrowId}`,
    relatedEntityId: escrowId,
    relatedEntityType: "escrow",
  });

  await db
    .update(escrowAccountsTable)
    .set({ status: "funded", fundedAt: new Date(), updatedAt: new Date() })
    .where(eq(escrowAccountsTable.id, escrowId));

  return escrowId;
}

export async function releaseEscrow(escrowId: string) {
  const [escrow] = await db.select().from(escrowAccountsTable).where(eq(escrowAccountsTable.id, escrowId)).limit(1);
  if (!escrow) throw new Error("Escrow not found");
  if (escrow.status !== "funded") throw new Error(`Cannot release escrow in status: ${escrow.status}`);

  const amount = Number(escrow.amount);
  const currency = escrow.currency as Currency;

  // Release locked funds from buyer (cancels the lock)
  await releaseBalance({
    userId: escrow.buyerId,
    amount,
    currency,
    relatedEntityId: escrowId,
    relatedEntityType: "escrow",
    description: `Escrow release (buyer lock cleared)`,
  });

  // Debit buyer's available balance (previously locked, now released for transfer)
  await debitWallet({
    userId: escrow.buyerId,
    amount,
    currency,
    type: "trade_settlement",
    description: `Escrow payment to seller — ${escrow.description ?? escrowId}`,
    railProvider: "internal",
    relatedEntityId: escrowId,
    relatedEntityType: "escrow",
  });

  // Credit seller wallet
  await creditWallet({
    userId: escrow.sellerId,
    amount,
    currency,
    type: "trade_settlement",
    description: `Escrow received from buyer — ${escrow.description ?? escrowId}`,
    railProvider: "internal",
    relatedEntityId: escrowId,
    relatedEntityType: "escrow",
  });

  // Double-entry: Debit escrow engine → Credit seller wallet
  await recordDoubleEntry({
    debit: {
      accountId: ESCROW_ENGINE_ID,
      accountType: "platform_account",
      accountLabel: ESCROW_ENGINE_LABEL,
    },
    credit: {
      accountId: escrow.sellerId,
      accountType: "user_wallet",
      accountLabel: `Seller (${escrow.sellerId})`,
    },
    amount,
    currency,
    description: `Escrow released to seller — ${escrow.description ?? escrowId}`,
    relatedEntityId: escrowId,
    relatedEntityType: "escrow",
  });

  await db
    .update(escrowAccountsTable)
    .set({ status: "released", releasedAt: new Date(), updatedAt: new Date() })
    .where(eq(escrowAccountsTable.id, escrowId));

  return escrowId;
}

export async function cancelEscrow(escrowId: string) {
  const [escrow] = await db.select().from(escrowAccountsTable).where(eq(escrowAccountsTable.id, escrowId)).limit(1);
  if (!escrow) throw new Error("Escrow not found");
  if (!["pending", "funded"].includes(escrow.status)) throw new Error(`Cannot cancel escrow in status: ${escrow.status}`);

  if (escrow.status === "funded") {
    // Release locked buyer funds back
    await releaseBalance({
      userId: escrow.buyerId,
      amount: Number(escrow.amount),
      currency: escrow.currency as Currency,
      relatedEntityId: escrowId,
      relatedEntityType: "escrow",
      description: `Escrow cancelled — funds returned`,
    });

    await recordDoubleEntry({
      debit: {
        accountId: ESCROW_ENGINE_ID,
        accountType: "platform_account",
        accountLabel: ESCROW_ENGINE_LABEL,
      },
      credit: {
        accountId: escrow.buyerId,
        accountType: "user_wallet",
        accountLabel: `Buyer (${escrow.buyerId})`,
      },
      amount: Number(escrow.amount),
      currency: escrow.currency as Currency,
      description: `Escrow cancelled — refund to buyer`,
      relatedEntityId: escrowId,
      relatedEntityType: "escrow",
    });
  }

  await db
    .update(escrowAccountsTable)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(escrowAccountsTable.id, escrowId));

  return escrowId;
}

export async function listEscrows(opts: { buyerId?: string; sellerId?: string; status?: string }) {
  const all = await db.select().from(escrowAccountsTable).orderBy(escrowAccountsTable.createdAt);
  return all.filter((e) => {
    if (opts.buyerId && e.buyerId !== opts.buyerId) return false;
    if (opts.sellerId && e.sellerId !== opts.sellerId) return false;
    if (opts.status && e.status !== opts.status) return false;
    return true;
  });
}
