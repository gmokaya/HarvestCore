import { Router } from "express";
import {
  createFraudAlert,
  resolveAlert,
  dismissAlert,
  escalateAlert,
  getFraudAlerts,
  getAlertSummary,
} from "../services/fraud-monitor";

const router = Router();

router.get("/summary", async (_req, res) => {
  try {
    res.json(await getAlertSummary());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { status, severity, userId, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const data = await getFraudAlerts({ status, severity, userId, limit: Number(limit), offset: Number(offset) });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { alertType, severity, userId, walletId, amount, currency, description, transactionRef } = req.body;
    if (!alertType || !severity || !userId || !description) {
      return res.status(400).json({ error: "alertType, severity, userId, description required" });
    }
    const alert = await createFraudAlert({
      alertType, severity, userId, walletId, amount: amount ? Number(amount) : undefined,
      currency, description, transactionRef,
    });
    res.status(201).json(alert);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/resolve", async (req, res) => {
  try {
    const { resolvedBy, note } = req.body;
    await resolveAlert(req.params.id, resolvedBy ?? "admin-001", note ?? "Resolved by admin");
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/dismiss", async (req, res) => {
  try {
    const { resolvedBy, note } = req.body;
    await dismissAlert(req.params.id, resolvedBy ?? "admin-001", note ?? "Dismissed by admin");
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/escalate", async (req, res) => {
  try {
    await escalateAlert(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
