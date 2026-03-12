import { Router } from "express";
import { db } from "@workspace/db";
import { loansTable, settlementsTable, tokensTable, usersTable, activityLogTable } from "@workspace/db/schema";
import { eq, or, inArray, sql } from "drizzle-orm";

const router = Router();

const WAREHOUSE_CHARGE_RATE = 0.03;
const OPERATIONAL_FEE_RATE = 0.02;

router.get("/defaulted-loans", async (req, res) => {
  try {
    const { stage } = req.query as Record<string, string>;

    let settlements = await db.select().from(settlementsTable);
    if (stage) settlements = settlements.filter(s => s.stage === stage);

    const result = await Promise.all(settlements.map(async (s) => {
      const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, s.loanId)).limit(1);
      const [borrower] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, loan?.borrowerId ?? "")).limit(1);
      const outstanding = Number(loan?.outstandingBalance ?? loan?.principalAmount ?? 0);
      const collateralValue = outstanding * 1.25;
      const currentLtv = collateralValue > 0 ? (outstanding / collateralValue) * 100 : 0;
      const dueDate = loan?.dueDate ? new Date(loan.dueDate) : new Date();
      const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86400000));

      return {
        id: s.id,
        loanId: s.loanId,
        borrowerName: borrower?.name ?? "Unknown",
        commodity: loan?.commodity ?? "Unknown",
        outstandingBalance: outstanding,
        collateralValue,
        currentLtv: Math.round(currentLtv * 100) / 100,
        daysOverdue,
        stage: s.stage,
        gracePeriodEndsAt: s.gracePeriodEndsAt?.toISOString() ?? null,
        noticeSentAt: s.noticeSentAt?.toISOString() ?? null,
      };
    }));

    res.json({ loans: result, total: result.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:loanId/initiate", async (req, res) => {
  try {
    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

    const gracePeriodEndsAt = new Date(Date.now() + 72 * 3600000);
    const [settlement] = await db.insert(settlementsTable).values({
      loanId: req.params.loanId,
      stage: "grace_period",
      gracePeriodEndsAt,
    }).returning();

    await db.update(loansTable).set({ status: "in_liquidation", updatedAt: new Date() }).where(eq(loansTable.id, req.params.loanId));
    await db.update(tokensTable).set({ tokenState: "in_liquidation", updatedAt: new Date() }).where(eq(tokensTable.id, loan.tokenId));

    await db.insert(activityLogTable).values({
      type: "settlement_initiated",
      description: `Liquidation initiated for loan ${req.params.loanId}`,
      actorName: "System",
      entityId: settlement.id,
    });

    res.json({ ...settlement, waterfall: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:loanId/waterfall", async (req, res) => {
  try {
    const salePrice = Number(req.query.salePrice);
    if (!salePrice || isNaN(salePrice)) { res.status(400).json({ error: "salePrice is required" }); return; }

    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

    const outstanding = Number(loan.outstandingBalance ?? loan.principalAmount);
    const lenderRecovery = Math.min(salePrice, outstanding);
    const remaining1 = salePrice - lenderRecovery;
    const warehouseCharges = Math.min(remaining1, outstanding * WAREHOUSE_CHARGE_RATE);
    const remaining2 = remaining1 - warehouseCharges;
    const operationalFees = Math.min(remaining2, outstanding * OPERATIONAL_FEE_RATE);
    const remaining3 = remaining2 - operationalFees;
    const borrowerResidue = Math.max(0, remaining3);
    const totalDistributed = lenderRecovery + warehouseCharges + operationalFees + borrowerResidue;
    const shortfall = Math.max(0, outstanding - salePrice);

    res.json({
      salePrice,
      lenderRecovery: Math.round(lenderRecovery * 100) / 100,
      warehouseCharges: Math.round(warehouseCharges * 100) / 100,
      operationalFees: Math.round(operationalFees * 100) / 100,
      borrowerResidue: Math.round(borrowerResidue * 100) / 100,
      totalDistributed: Math.round(totalDistributed * 100) / 100,
      shortfall: Math.round(shortfall * 100) / 100,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:loanId/finalize", async (req, res) => {
  try {
    const { salePrice, buyerId, paymentMethod, transactionRef } = req.body;
    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

    const outstanding = Number(loan.outstandingBalance ?? loan.principalAmount);
    const lenderRecovery = Math.min(salePrice, outstanding);
    const remaining1 = salePrice - lenderRecovery;
    const warehouseCharges = Math.min(remaining1, outstanding * WAREHOUSE_CHARGE_RATE);
    const remaining2 = remaining1 - warehouseCharges;
    const operationalFees = Math.min(remaining2, outstanding * OPERATIONAL_FEE_RATE);
    const borrowerResidue = Math.max(0, remaining2 - operationalFees);
    const txHash = `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`;

    const [settlement] = await db.update(settlementsTable)
      .set({
        stage: "settled",
        salePrice: String(salePrice),
        lenderRecovery: String(lenderRecovery),
        warehouseCharges: String(warehouseCharges),
        operationalFees: String(operationalFees),
        borrowerResidue: String(borrowerResidue),
        settlementTxHash: txHash,
        updatedAt: new Date(),
      })
      .where(eq(settlementsTable.loanId, req.params.loanId))
      .returning();

    await db.update(loansTable).set({ status: "repaid", updatedAt: new Date() }).where(eq(loansTable.id, req.params.loanId));
    await db.update(tokensTable).set({ tokenState: "released", updatedAt: new Date() }).where(eq(tokensTable.id, loan.tokenId));

    res.json({
      ...settlement,
      waterfall: {
        salePrice,
        lenderRecovery: Math.round(lenderRecovery * 100) / 100,
        warehouseCharges: Math.round(warehouseCharges * 100) / 100,
        operationalFees: Math.round(operationalFees * 100) / 100,
        borrowerResidue: Math.round(borrowerResidue * 100) / 100,
        totalDistributed: Math.round((lenderRecovery + warehouseCharges + operationalFees + borrowerResidue) * 100) / 100,
        shortfall: Math.max(0, outstanding - salePrice),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
