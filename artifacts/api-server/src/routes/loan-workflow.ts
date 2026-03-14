import { Router } from "express";
import { db } from "@workspace/db";
import {
  loansTable, usersTable, tokensTable,
  loanApprovalsTable, loanApproversTable, repaymentsTable, activityLogTable,
} from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { creditWallet, debitWallet } from "../services/wallet";

const router = Router();

const COMMODITY_PRICES: Record<string, number> = {
  Maize: 38.5, Coffee: 620, Wheat: 42, Rice: 55, Sorghum: 35,
  Beans: 90, Tea: 280, Cotton: 95, Sesame: 120, Millet: 38,
};

const MAX_LTV = 0.65;
const RISK_ESCALATION_THRESHOLD = 1_000_000;

const STAGE_LABELS: Record<string, string> = {
  submitted:              "Application Submitted",
  pending_collateral:     "Pending Collateral Verification",
  collateral_verified:    "Collateral Verified",
  pending_valuation:      "Pending Commodity Valuation",
  valuation_complete:     "Commodity Valued",
  pending_credit:         "Pending Credit Assessment",
  credit_approved:        "Credit Approved",
  pending_risk:           "Pending Risk Approval",
  risk_approved:          "Risk Approved",
  pending_finance:        "Pending Finance Authorization",
  finance_approved:       "Finance Authorized",
  collateral_locked:      "Collateral Locked",
  disbursed:              "Loan Disbursed",
  monitoring:             "Under Monitoring",
  repaid:                 "Fully Repaid",
  defaulted:              "Defaulted",
};

function fmt(loan: any, borrower: any, lender: any) {
  return {
    ...loan,
    principalAmount: Number(loan.principalAmount),
    interestRate: Number(loan.interestRate),
    ltv: loan.ltv ? Number(loan.ltv) : null,
    outstandingBalance: loan.outstandingBalance ? Number(loan.outstandingBalance) : null,
    collateralValue: loan.collateralValue ? Number(loan.collateralValue) : null,
    maxLoanEligible: loan.maxLoanEligible ? Number(loan.maxLoanEligible) : null,
    maxLtv: loan.maxLtv ? Number(loan.maxLtv) : null,
    borrowerName: borrower?.name ?? "Unknown",
    lenderName: lender?.name ?? null,
    workflowStageLabel: STAGE_LABELS[loan.workflowStage ?? "submitted"] ?? loan.workflowStage,
  };
}

// ── Workflow pipeline stats ──────────────────────────────────────────────────
router.get("/stats", async (_req, res) => {
  try {
    const [total, active, pending, repaid, defaulted, portfolio, approvers] = await Promise.all([
      db.select({ c: sql<number>`count(*)` }).from(loansTable).then(r => Number(r[0].c)),
      db.select({ c: sql<number>`count(*)` }).from(loansTable).where(eq(loansTable.status, "active")).then(r => Number(r[0].c)),
      db.select({ c: sql<number>`count(*)` }).from(loansTable).where(eq(loansTable.status, "pending")).then(r => Number(r[0].c)),
      db.select({ c: sql<number>`count(*)` }).from(loansTable).where(eq(loansTable.status, "repaid")).then(r => Number(r[0].c)),
      db.select({ c: sql<number>`count(*)` }).from(loansTable).where(eq(loansTable.status, "defaulted")).then(r => Number(r[0].c)),
      db.select({ s: sql<string>`coalesce(sum(principal_amount),0)` }).from(loansTable).then(r => Number(r[0].s)),
      db.select({ c: sql<number>`count(*)` }).from(loanApproversTable).where(eq(loanApproversTable.isActive, true)).then(r => Number(r[0].c)),
    ]);
    res.json({ total, active, pending, repaid, defaulted, portfolio, approvers });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── All loans with workflow info ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { stage, status } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (status) conditions.push(eq(loansTable.status, status as any));
    if (stage) conditions.push(eq(loansTable.workflowStage, stage));

    const loans = await db.select().from(loansTable)
      .where(conditions.length ? and(...(conditions as any)) : undefined)
      .orderBy(desc(loansTable.createdAt));

    const borrowers = await Promise.all(loans.map(l =>
      db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, l.borrowerId)).limit(1).then(r => r[0])
    ));
    const lenders = await Promise.all(loans.map(l =>
      l.lenderId ? db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, l.lenderId)).limit(1).then(r => r[0]) : Promise.resolve(null)
    ));

    res.json({ loans: loans.map((l, i) => fmt(l, borrowers[i], lenders[i])) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Single loan with approvals ───────────────────────────────────────────────
router.get("/:loanId", async (req, res) => {
  try {
    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!loan) { res.status(404).json({ error: "Not found" }); return; }
    const [borrower] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, loan.borrowerId)).limit(1);
    const lender = loan.lenderId ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, loan.lenderId)).limit(1).then(r => r[0]) : null;
    const [token] = await db.select().from(tokensTable).where(eq(tokensTable.id, loan.tokenId)).limit(1);
    const approvals = await db.select().from(loanApprovalsTable).where(eq(loanApprovalsTable.loanId, loan.id)).orderBy(desc(loanApprovalsTable.createdAt));
    const repayments = await db.select().from(repaymentsTable).where(eq(repaymentsTable.loanId, loan.id)).orderBy(desc(repaymentsTable.createdAt));
    res.json({ loan: fmt(loan, borrower, lender), token, approvals, repayments });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Advance workflow stage ───────────────────────────────────────────────────
router.post("/:loanId/advance", async (req, res) => {
  try {
    const { decision, notes, approverName, approverRole } = req.body;
    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!loan) { res.status(404).json({ error: "Not found" }); return; }

    const stage = loan.workflowStage ?? "submitted";
    let nextStage = stage;
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (decision === "rejected") {
      nextStage = "defaulted";
      updates.status = "defaulted";
      updates.rejectionReason = notes ?? "Rejected at stage: " + stage;
      await db.update(tokensTable).set({ tokenState: "free", updatedAt: new Date() }).where(eq(tokensTable.id, loan.tokenId));
    } else {
      // Happy path transitions
      const transitions: Record<string, string> = {
        submitted:           "collateral_verified",
        pending_collateral:  "collateral_verified",
        collateral_verified: "valuation_complete",
        valuation_complete:  "credit_approved",
        pending_credit:      "credit_approved",
        credit_approved:     Number(loan.principalAmount) >= RISK_ESCALATION_THRESHOLD ? "risk_approved" : "finance_approved",
        pending_risk:        "risk_approved",
        risk_approved:       "finance_approved",
        pending_finance:     "finance_approved",
        finance_approved:    "collateral_locked",
        collateral_locked:   "disbursed",
        disbursed:           "monitoring",
      };
      nextStage = transitions[stage] ?? stage;

      // Update timestamps per stage
      if (nextStage === "collateral_verified") updates.collateralVerifiedAt = new Date();
      if (nextStage === "valuation_complete") {
        const [token] = await db.select().from(tokensTable).where(eq(tokensTable.id, loan.tokenId)).limit(1);
        const pricePerKg = COMMODITY_PRICES[token?.commodity ?? "Maize"] ?? 40;
        const collVal = Number(token?.weightKg ?? 0) * pricePerKg;
        const maxLoanElig = collVal * MAX_LTV;
        updates.collateralValue = String(collVal);
        updates.maxLtv = "65";
        updates.maxLoanEligible = String(maxLoanElig);
      }
      if (nextStage === "credit_approved") {
        updates.creditApprovedAt = new Date();
        updates.riskScore = (["low", "medium", "high"] as const)[Math.floor(Math.random() * 3)];
      }
      if (nextStage === "risk_approved") updates.riskApprovedAt = new Date();
      if (nextStage === "finance_approved") {
        updates.financeApprovedAt = new Date();
        updates.status = "approved";
      }
      if (nextStage === "collateral_locked") {
        await db.update(tokensTable).set({ tokenState: "pledged", updatedAt: new Date() }).where(eq(tokensTable.id, loan.tokenId));
      }
      if (nextStage === "disbursed") {
        const disbursedAt = new Date();
        const dueDate = new Date(disbursedAt.getTime() + (loan.tenureDays ?? 90) * 86400000);
        updates.status = "active";
        updates.disbursedAt = disbursedAt;
        updates.dueDate = dueDate;
        updates.outstandingBalance = loan.principalAmount;
        updates.interestRate = "14";
        await db.update(tokensTable).set({ tokenState: "financed", updatedAt: new Date() }).where(eq(tokensTable.id, loan.tokenId));
        // Credit borrower wallet with disbursed principal
        await creditWallet({
          userId: loan.borrowerId,
          amount: Number(loan.principalAmount),
          currency: "KES",
          type: "loan_disbursement",
          description: `Loan disbursement — ${loan.id}`,
          railProvider: (loan.disbursementMethod ?? "mpesa") as any,
          relatedEntityId: loan.id,
          relatedEntityType: "loan",
        });
      }
      if (nextStage === "monitoring") {
        const ltvVal = loan.collateralValue
          ? (Number(loan.principalAmount) / Number(loan.collateralValue)) * 100
          : null;
        if (ltvVal) updates.ltv = String(Math.round(ltvVal * 100) / 100);
      }
    }

    updates.workflowStage = nextStage;
    const [updated] = await db.update(loansTable).set(updates).where(eq(loansTable.id, req.params.loanId)).returning();

    // Log the approval action
    await db.insert(loanApprovalsTable).values({
      loanId: loan.id,
      approverName: approverName ?? "System",
      approverRole: approverRole ?? "system",
      stage,
      decision: decision ?? "approved",
      notes: notes ?? null,
    });

    // Activity log
    await db.insert(activityLogTable).values({
      type: "loan_approved",
      description: `Loan ${loan.id} advanced: ${STAGE_LABELS[stage]} → ${STAGE_LABELS[nextStage]}`,
      actorName: approverName ?? "System",
      entityId: loan.id,
    });

    const [borrower] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.borrowerId)).limit(1);
    res.json({ loan: fmt(updated, borrower, null) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Repay loan ───────────────────────────────────────────────────────────────
router.post("/:loanId/repay", async (req, res) => {
  try {
    const { amount, paymentMethod, transactionRef } = req.body;
    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!loan) { res.status(404).json({ error: "Not found" }); return; }

    const currentBalance = Number(loan.outstandingBalance ?? loan.principalAmount);
    const repayAmount = Number(amount);
    const newBalance = Math.max(0, currentBalance - repayAmount);
    const isFullyRepaid = newBalance === 0;

    // Debit borrower wallet (best-effort — wallet may not have balance if external payment)
    try {
      await debitWallet({
        userId: loan.borrowerId,
        amount: repayAmount,
        currency: "KES",
        type: "loan_repayment",
        description: `Loan repayment — ${loan.id}`,
        railProvider: (paymentMethod ?? "mpesa") as any,
        reference: transactionRef,
        relatedEntityId: loan.id,
        relatedEntityType: "loan",
      });
    } catch { /* wallet debit failed — record repayment anyway (external payment rail) */ }

    await db.insert(repaymentsTable).values({
      loanId: loan.id,
      amount: String(repayAmount),
      paymentMethod: (paymentMethod ?? "mpesa") as any,
      transactionRef: transactionRef ?? ("TXN-" + Date.now()),
    });

    const nextStage = isFullyRepaid ? "repaid" : "monitoring";
    const [updated] = await db.update(loansTable).set({
      outstandingBalance: String(newBalance),
      status: isFullyRepaid ? "repaid" : "active",
      repaidAt: isFullyRepaid ? new Date() : null,
      workflowStage: nextStage,
      updatedAt: new Date(),
    }).where(eq(loansTable.id, req.params.loanId)).returning();

    if (isFullyRepaid) {
      await db.update(tokensTable).set({ tokenState: "released", updatedAt: new Date() }).where(eq(tokensTable.id, loan.tokenId));
      await db.insert(loanApprovalsTable).values({
        loanId: loan.id,
        approverName: "System",
        approverRole: "system",
        stage: "monitoring",
        decision: "approved",
        notes: `Fully repaid. Amount: KES ${repayAmount.toLocaleString()}`,
      });
    }

    const [borrower] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.borrowerId)).limit(1);
    res.json({ loan: fmt(updated, borrower, null) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Approvers CRUD ───────────────────────────────────────────────────────────
router.get("/approvers/list", async (_req, res) => {
  try {
    const approvers = await db.select().from(loanApproversTable).orderBy(loanApproversTable.role);
    res.json({ approvers: approvers.map(a => ({ ...a, approvalLimit: a.approvalLimit ? Number(a.approvalLimit) : null })) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/approvers/list", async (req, res) => {
  try {
    const { name, email, phone, organization, role, approvalLimit } = req.body;
    if (!name || !email || !role) { res.status(400).json({ error: "name, email, and role are required" }); return; }
    const [approver] = await db.insert(loanApproversTable).values({
      name, email,
      phone: phone ?? null,
      organization: organization ?? "TokenHarvest Finance",
      role,
      approvalLimit: approvalLimit ? String(approvalLimit) : null,
    }).returning();
    res.status(201).json({ approver });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Audit trail ──────────────────────────────────────────────────────────────
router.get("/approvals/audit", async (_req, res) => {
  try {
    const approvals = await db.select().from(loanApprovalsTable).orderBy(desc(loanApprovalsTable.createdAt)).limit(100);
    res.json({ approvals });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
