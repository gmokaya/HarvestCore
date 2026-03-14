import { Router } from "express";
import { db } from "@workspace/db";
import { walletsTable, walletTransactionsTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { ensureWallets, creditWallet, debitWallet, lockBalance, releaseBalance } from "../services/wallet";

const router = Router();

const fmt = (n: any) => (n == null ? "0.00" : Number(n).toFixed(2));

// ── GET /api/wallet/summary/platform — admin stats ─────────────────────────────
// NOTE: static routes must come BEFORE /:userId to avoid route shadowing
router.get("/summary/platform", async (_req, res) => {
  try {
    const [kesStats] = await db
      .select({
        totalBalance: sql<string>`coalesce(sum(balance::numeric), 0)`,
        totalLocked: sql<string>`coalesce(sum(locked_balance::numeric), 0)`,
        walletCount: sql<number>`count(*)`,
      })
      .from(walletsTable)
      .where(eq(walletsTable.currency, "KES"));

    const [usdcStats] = await db
      .select({
        totalBalance: sql<string>`coalesce(sum(balance::numeric), 0)`,
        walletCount: sql<number>`count(*)`,
      })
      .from(walletsTable)
      .where(eq(walletsTable.currency, "USDC"));

    const [txStats] = await db
      .select({
        totalTxns: sql<number>`count(*)`,
        totalVolume: sql<string>`coalesce(sum(amount::numeric), 0)`,
      })
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.status, "completed"));

    res.json({
      kes: {
        totalBalance: fmt(kesStats.totalBalance),
        totalLocked: fmt(kesStats.totalLocked),
        walletCount: Number(kesStats.walletCount),
      },
      usdc: {
        totalBalance: fmt(usdcStats.totalBalance),
        walletCount: Number(usdcStats.walletCount),
      },
      transactions: {
        total: Number(txStats.totalTxns),
        totalVolume: fmt(txStats.totalVolume),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/wallet/transactions/:userId ──────────────────────────────────────
// NOTE: must come BEFORE /:userId
router.get("/transactions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, status, currency, limit = "50", offset = "0" } = req.query as Record<string, string>;

    const conditions: any[] = [eq(walletTransactionsTable.userId, userId)];
    if (type) conditions.push(eq(walletTransactionsTable.type, type as any));
    if (status) conditions.push(eq(walletTransactionsTable.status, status as any));
    if (currency) conditions.push(eq(walletTransactionsTable.currency, currency as any));

    const [txns, countResult] = await Promise.all([
      db.select()
        .from(walletTransactionsTable)
        .where(and(...conditions))
        .orderBy(desc(walletTransactionsTable.createdAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset)),
      db.select({ count: sql<number>`count(*)` })
        .from(walletTransactionsTable)
        .where(and(...conditions)),
    ]);

    res.json({
      transactions: txns.map((t) => ({
        ...t,
        amount: fmt(t.amount),
        balanceBefore: fmt(t.balanceBefore),
        balanceAfter: fmt(t.balanceAfter),
      })),
      total: Number(countResult[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/wallet/:userId — all wallets for user ────────────────────────────
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    await ensureWallets(userId);

    const wallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId));

    const kes = wallets.find((w) => w.currency === "KES");
    const usdc = wallets.find((w) => w.currency === "USDC");

    res.json({
      userId,
      kes: kes
        ? { id: kes.id, balance: fmt(kes.balance), lockedBalance: fmt(kes.lockedBalance), status: kes.status }
        : { id: null, balance: "0.00", lockedBalance: "0.00", status: "active" },
      usdc: usdc
        ? { id: usdc.id, balance: fmt(usdc.balance), lockedBalance: fmt(usdc.lockedBalance), status: usdc.status }
        : { id: null, balance: "0.00", lockedBalance: "0.00", status: "active" },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/wallet/deposit ──────────────────────────────────────────────────
router.post("/deposit", async (req, res) => {
  try {
    const { userId, amount, currency = "KES", railProvider = "mpesa", reference, description } = req.body;
    if (!userId || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: "userId and a positive amount are required" });

    const newBalance = await creditWallet({
      userId, amount: Number(amount),
      currency, type: "deposit",
      railProvider, reference,
      description: description ?? `Deposit via ${railProvider.toUpperCase()}`,
    });

    res.json({ success: true, newBalance: fmt(newBalance), currency, message: `KES ${Number(amount).toLocaleString()} deposited successfully` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/wallet/withdraw ─────────────────────────────────────────────────
router.post("/withdraw", async (req, res) => {
  try {
    const { userId, amount, currency = "KES", railProvider = "mpesa", reference, description } = req.body;
    if (!userId || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: "userId and a positive amount are required" });

    // Daily limit check (KES 500,000)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [{ total }] = await db
      .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)` })
      .from(walletTransactionsTable)
      .where(and(
        eq(walletTransactionsTable.userId, userId),
        eq(walletTransactionsTable.type, "withdrawal"),
        eq(walletTransactionsTable.status, "completed"),
        sql`created_at >= ${today}`,
      ));
    const DAILY_LIMIT = currency === "KES" ? 500_000 : 5_000;
    if (Number(total) + Number(amount) > DAILY_LIMIT)
      return res.status(400).json({ error: `Daily withdrawal limit (${currency} ${DAILY_LIMIT.toLocaleString()}) would be exceeded` });

    const newBalance = await debitWallet({
      userId, amount: Number(amount),
      currency, type: "withdrawal",
      railProvider, reference,
      description: description ?? `Withdrawal to ${railProvider.toUpperCase()}`,
    });

    res.json({ success: true, newBalance: fmt(newBalance), currency, message: `${currency} ${Number(amount).toLocaleString()} withdrawn successfully` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/wallet/transfer ─────────────────────────────────────────────────
router.post("/transfer", async (req, res) => {
  try {
    const { fromUserId, toUserId, amount, currency = "KES", description } = req.body;
    if (!fromUserId || !toUserId || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: "fromUserId, toUserId, and positive amount are required" });
    if (fromUserId === toUserId)
      return res.status(400).json({ error: "Cannot transfer to self" });
    if (Number(amount) > 200_000 && currency === "KES")
      return res.status(400).json({ error: "Single transfer limit is KES 200,000" });

    const [toUser] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, toUserId)).limit(1);
    if (!toUser) return res.status(404).json({ error: "Recipient user not found" });

    await debitWallet({ userId: fromUserId, amount: Number(amount), currency, type: "transfer_out", description: description ?? `Transfer to ${toUser.name}`, railProvider: "internal" });
    await creditWallet({ userId: toUserId, amount: Number(amount), currency, type: "transfer_in", description: description ?? "Received transfer", railProvider: "internal" });

    res.json({ success: true, message: `${currency} ${Number(amount).toLocaleString()} transferred to ${toUser.name}` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/wallet/escrow-lock ──────────────────────────────────────────────
router.post("/escrow-lock", async (req, res) => {
  try {
    const { userId, amount, currency = "KES", relatedEntityId, relatedEntityType, description } = req.body;
    await lockBalance({ userId, amount: Number(amount), currency, relatedEntityId, relatedEntityType, description });
    res.json({ success: true, message: "Funds locked in escrow" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/wallet/escrow-release ───────────────────────────────────────────
router.post("/escrow-release", async (req, res) => {
  try {
    const { userId, amount, currency = "KES", relatedEntityId, relatedEntityType, description } = req.body;
    await releaseBalance({ userId, amount: Number(amount), currency, relatedEntityId, relatedEntityType, description });
    res.json({ success: true, message: "Escrow funds released" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
