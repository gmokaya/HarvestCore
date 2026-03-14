import { Router } from "express";
import {
  importRailTransaction,
  matchRailTransaction,
  markDiscrepancy,
  dismissRailTransaction,
  getRailTransactions,
  getReconciliationSummary,
} from "../services/reconciliation";

const router = Router();

router.get("/summary", async (_req, res) => {
  try {
    res.json(await getReconciliationSummary());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { rail, status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const data = await getRailTransactions({
      rail: rail as any,
      status,
      limit: Number(limit),
      offset: Number(offset),
    });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/import", async (req, res) => {
  try {
    const { rail, externalRef, direction, amount, currency, phoneOrAccount, rawPayload } = req.body;
    if (!rail || !externalRef || !direction || !amount) {
      return res.status(400).json({ error: "rail, externalRef, direction, amount required" });
    }
    const result = await importRailTransaction({
      rail, externalRef, direction, amount: Number(amount),
      currency: currency ?? "KES", phoneOrAccount, rawPayload,
    });
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/match", async (req, res) => {
  try {
    const { ledgerGroupId, walletTransactionId } = req.body;
    if (!ledgerGroupId) return res.status(400).json({ error: "ledgerGroupId required" });
    await matchRailTransaction(req.params.id, ledgerGroupId, walletTransactionId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/discrepancy", async (req, res) => {
  try {
    const { note } = req.body;
    await markDiscrepancy(req.params.id, note ?? "Manual discrepancy flag");
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/dismiss", async (req, res) => {
  try {
    await dismissRailTransaction(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
