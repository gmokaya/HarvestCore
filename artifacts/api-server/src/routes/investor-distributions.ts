import { Router } from "express";
import {
  createDistribution,
  markDistributionPaid,
  getDistributions,
  getDistributionSummary,
} from "../services/investor-distribution";

const router = Router();

router.get("/summary", async (_req, res) => {
  try {
    res.json(await getDistributionSummary());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { poolId, investorId, period, status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const data = await getDistributions({ poolId, investorId, period, status, limit: Number(limit), offset: Number(offset) });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { poolId, investorId, investorName, period, grossAmount, feeRate, currency, yieldRate, loanIds, note } = req.body;
    if (!poolId || !investorId || !period || !grossAmount) {
      return res.status(400).json({ error: "poolId, investorId, period, grossAmount required" });
    }
    const dist = await createDistribution({
      poolId, investorId, investorName, period, grossAmount: Number(grossAmount),
      feeRate: feeRate ? Number(feeRate) : undefined, currency, yieldRate, loanIds, note,
    });
    res.status(201).json(dist);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/pay", async (req, res) => {
  try {
    await markDistributionPaid(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
