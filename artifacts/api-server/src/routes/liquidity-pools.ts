import { Router } from "express";
import { db } from "@workspace/db";
import { liquidityPoolsTable, poolTransactionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAllPools, depositToPool, withdrawFromPool } from "../services/liquidity-pool";

const router = Router();
const fmt2 = (n: string | number) => Number(n).toFixed(2);

// ── GET /api/liquidity-pools ───────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const pools = await getAllPools();
    res.json({
      pools: pools.map((p) => {
        const avail = Number(p.balance) - Number(p.lockedBalance);
        const cap = Number(p.capacity);
        const utilization = cap > 0 ? ((Number(p.totalDeposited) - avail) / cap) * 100 : 0;
        return {
          ...p,
          balance: fmt2(p.balance),
          lockedBalance: fmt2(p.lockedBalance),
          totalDeposited: fmt2(p.totalDeposited),
          totalWithdrawn: fmt2(p.totalWithdrawn),
          capacity: fmt2(p.capacity),
          available: fmt2(Math.max(0, avail)),
          utilizationPct: Math.min(100, Math.max(0, utilization)).toFixed(1),
        };
      }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/liquidity-pools/:poolId/transactions ─────────────────────────────
router.get("/:poolId/transactions", async (req, res) => {
  try {
    const txns = await db
      .select()
      .from(poolTransactionsTable)
      .where(eq(poolTransactionsTable.poolId, req.params.poolId))
      .orderBy(desc(poolTransactionsTable.createdAt))
      .limit(50);
    res.json({
      transactions: txns.map((t) => ({
        ...t,
        amount: fmt2(t.amount),
        balanceBefore: fmt2(t.balanceBefore),
        balanceAfter: fmt2(t.balanceAfter),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/liquidity-pools/deposit ─────────────────────────────────────────
router.post("/deposit", async (req, res) => {
  try {
    const { poolType, amount, userId, description } = req.body;
    if (!poolType || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: "poolType and a positive amount are required" });

    const newBalance = await depositToPool({ poolType, amount: Number(amount), userId, description });
    res.json({ success: true, newBalance: fmt2(newBalance), message: `Deposited to ${poolType} pool` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/liquidity-pools/withdraw ────────────────────────────────────────
router.post("/withdraw", async (req, res) => {
  try {
    const { poolType, amount, userId, description } = req.body;
    if (!poolType || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: "poolType and a positive amount are required" });

    const newBalance = await withdrawFromPool({ poolType, amount: Number(amount), userId, description });
    res.json({ success: true, newBalance: fmt2(newBalance), message: `Withdrawn from ${poolType} pool` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
