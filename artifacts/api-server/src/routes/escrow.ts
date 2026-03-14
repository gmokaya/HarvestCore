import { Router } from "express";
import { db } from "@workspace/db";
import { escrowAccountsTable, usersTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { createEscrow, fundEscrow, releaseEscrow, cancelEscrow, listEscrows } from "../services/escrow";

const router = Router();
const fmt2 = (n: string | number) => Number(n).toFixed(2);

// ── GET /api/escrow — list escrows ────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { buyerId, sellerId, status } = req.query as Record<string, string>;
    const escrows = await listEscrows({ buyerId, sellerId, status });

    // Enrich with user names
    const userIds = [...new Set([...escrows.map((e) => e.buyerId), ...escrows.map((e) => e.sellerId)])];
    const users = userIds.length
      ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    res.json({
      escrows: escrows.map((e) => ({
        ...e,
        amount: fmt2(e.amount),
        buyerName: userMap[e.buyerId] ?? e.buyerId,
        sellerName: userMap[e.sellerId] ?? e.sellerId,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/escrow/create ───────────────────────────────────────────────────
router.post("/create", async (req, res) => {
  try {
    const { buyerId, sellerId, amount, currency = "KES", relatedEntityId, relatedEntityType, description, expiresAt } = req.body;
    if (!buyerId || !sellerId || !amount || Number(amount) <= 0)
      return res.status(400).json({ error: "buyerId, sellerId, and positive amount are required" });

    const result = await createEscrow({
      buyerId, sellerId,
      amount: Number(amount),
      currency,
      relatedEntityId,
      relatedEntityType,
      description,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json({
      escrowId: result.escrow.id,
      status: result.escrow.status,
      buyerName: result.buyerName,
      sellerName: result.sellerName,
      amount: fmt2(result.escrow.amount),
      currency,
      message: `Escrow created for ${currency} ${Number(amount).toLocaleString()} between ${result.buyerName} and ${result.sellerName}`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/escrow/:escrowId/fund ──────────────────────────────────────────
router.post("/:escrowId/fund", async (req, res) => {
  try {
    await fundEscrow(req.params.escrowId);
    res.json({ success: true, escrowId: req.params.escrowId, status: "funded", message: "Buyer funds locked in escrow" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/escrow/:escrowId/release ───────────────────────────────────────
router.post("/:escrowId/release", async (req, res) => {
  try {
    await releaseEscrow(req.params.escrowId);
    res.json({ success: true, escrowId: req.params.escrowId, status: "released", message: "Escrow released — seller credited" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/escrow/:escrowId/cancel ────────────────────────────────────────
router.post("/:escrowId/cancel", async (req, res) => {
  try {
    await cancelEscrow(req.params.escrowId);
    res.json({ success: true, escrowId: req.params.escrowId, status: "cancelled", message: "Escrow cancelled — funds returned to buyer" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/escrow/:escrowId ─────────────────────────────────────────────────
router.get("/:escrowId", async (req, res) => {
  try {
    const [e] = await db.select().from(escrowAccountsTable).where(eq(escrowAccountsTable.id, req.params.escrowId)).limit(1);
    if (!e) return res.status(404).json({ error: "Escrow not found" });

    const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    res.json({
      ...e,
      amount: fmt2(e.amount),
      buyerName: userMap[e.buyerId] ?? e.buyerId,
      sellerName: userMap[e.sellerId] ?? e.sellerId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
