import { Router } from "express";
import { getLedgerEntries, getReconciliation, getLedgerByGroup } from "../services/ledger";

const router = Router();
const fmt2 = (n: string | number) => Number(n).toFixed(2);

// ── GET /api/ledger — paginated journal ───────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { currency, accountId, relatedEntityId, limit = "60", offset = "0" } = req.query as Record<string, string>;
    const result = await getLedgerEntries({
      currency: currency as any,
      accountId,
      relatedEntityId,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({
      entries: result.entries.map((e) => ({ ...e, amount: fmt2(e.amount) })),
      total: result.total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/ledger/reconciliation ────────────────────────────────────────────
router.get("/reconciliation", async (_req, res) => {
  try {
    const result = await getReconciliation();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/ledger/group/:txnGroupId ─────────────────────────────────────────
router.get("/group/:txnGroupId", async (req, res) => {
  try {
    const entries = await getLedgerByGroup(req.params.txnGroupId);
    res.json({ entries: entries.map((e) => ({ ...e, amount: fmt2(e.amount) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
