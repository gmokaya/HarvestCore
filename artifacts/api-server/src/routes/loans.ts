import { Router } from "express";
import { db } from "@workspace/db";
import { loansTable, usersTable, tokensTable, repaymentsTable, activityLogTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { CreateLoanRequestBody, ApproveLoanBody, RepayLoanBody } from "@workspace/api-zod";

const router = Router();

const COMMODITY_PRICES: Record<string, number> = {
  Maize: 38.5, Coffee: 620, Wheat: 42, Rice: 55, Sorghum: 35, Beans: 90,
};

const formatLoan = (loan: any, borrower: any, lender: any) => ({
  ...loan,
  principalAmount: Number(loan.principalAmount),
  interestRate: Number(loan.interestRate),
  ltv: loan.ltv ? Number(loan.ltv) : null,
  outstandingBalance: loan.outstandingBalance ? Number(loan.outstandingBalance) : null,
  borrowerName: borrower?.name ?? "Unknown",
  lenderName: lender?.name ?? null,
});

router.get("/", async (req, res) => {
  try {
    const { status, borrowerId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (status) conditions.push(eq(loansTable.status, status as any));
    if (borrowerId) conditions.push(eq(loansTable.borrowerId, borrowerId));

    const [loans, countResult] = await Promise.all([
      db.select().from(loansTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
        .orderBy(loansTable.createdAt)
        .limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(loansTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
    ]);

    const borrowers = await Promise.all(loans.map(l =>
      db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, l.borrowerId)).limit(1).then(r => r[0])
    ));
    const lenders = await Promise.all(loans.map(l =>
      l.lenderId ? db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, l.lenderId)).limit(1).then(r => r[0]) : Promise.resolve(null)
    ));

    res.json({ loans: loans.map((l, i) => formatLoan(l, borrowers[i], lenders[i])), total: Number(countResult[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateLoanRequestBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [token] = await db.select().from(tokensTable).where(eq(tokensTable.id, body.data.tokenId)).limit(1);
    if (!token || token.tokenState !== "free") { res.status(400).json({ error: "Token not available for financing" }); return; }

    const riskOptions = ["low", "medium", "high"] as const;
    const riskScore = riskOptions[Math.floor(Math.random() * riskOptions.length)];
    const [loan] = await db.insert(loansTable).values({
      borrowerId: token.ownerId,
      tokenId: body.data.tokenId,
      commodity: token.commodity,
      principalAmount: String(body.data.principalAmount),
      interestRate: "0",
      tenureDays: body.data.tenureDays,
      status: "pending",
      purpose: body.data.purpose ?? null,
      riskScore,
    }).returning();

    await db.update(tokensTable).set({ tokenState: "pledged", updatedAt: new Date() }).where(eq(tokensTable.id, body.data.tokenId));

    const [borrower] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, loan.borrowerId)).limit(1);
    await db.insert(activityLogTable).values({
      type: "loan_approved",
      description: `Loan request submitted for ${token.commodity}, KES ${body.data.principalAmount}`,
      actorName: borrower?.name ?? "Farmer",
      actorId: loan.borrowerId,
      entityId: loan.id,
    });

    res.status(201).json(formatLoan(loan, borrower, null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:loanId", async (req, res) => {
  try {
    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }
    const [borrower] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, loan.borrowerId)).limit(1);
    const lender = loan.lenderId ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, loan.lenderId)).limit(1).then(r => r[0]) : null;
    res.json(formatLoan(loan, borrower, lender));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:loanId/approve", async (req, res) => {
  try {
    const body = ApproveLoanBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!existing) { res.status(404).json({ error: "Loan not found" }); return; }

    const disbursedAt = new Date();
    const dueDate = new Date(disbursedAt.getTime() + existing.tenureDays * 86400000);
    const [loan] = await db.update(loansTable)
      .set({
        status: "active",
        interestRate: String(body.data.interestRate),
        conditions: body.data.conditions ?? null,
        outstandingBalance: existing.principalAmount,
        disbursedAt,
        dueDate,
        updatedAt: new Date(),
      })
      .where(eq(loansTable.id, req.params.loanId))
      .returning();

    await db.update(tokensTable).set({ tokenState: "financed", updatedAt: new Date() }).where(eq(tokensTable.id, loan.tokenId));

    await db.insert(activityLogTable).values({
      type: "loan_approved",
      description: `Loan ${loan.id} approved at ${body.data.interestRate}% interest`,
      actorName: "Lender",
      entityId: loan.id,
    });

    const [borrower] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, loan.borrowerId)).limit(1);
    res.json(formatLoan(loan, borrower, null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:loanId/reject", async (req, res) => {
  try {
    const [existing] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!existing) { res.status(404).json({ error: "Loan not found" }); return; }

    const [loan] = await db.update(loansTable)
      .set({ status: "defaulted", rejectionReason: req.body.reason, updatedAt: new Date() })
      .where(eq(loansTable.id, req.params.loanId))
      .returning();

    await db.update(tokensTable).set({ tokenState: "free", updatedAt: new Date() }).where(eq(tokensTable.id, existing.tokenId));

    const [borrower] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, loan.borrowerId)).limit(1);
    res.json(formatLoan(loan, borrower, null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:loanId/repay", async (req, res) => {
  try {
    const body = RepayLoanBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

    const currentBalance = Number(loan.outstandingBalance ?? loan.principalAmount);
    const newBalance = Math.max(0, currentBalance - body.data.amount);
    const isFullyRepaid = newBalance === 0;

    await db.insert(repaymentsTable).values({
      loanId: loan.id,
      amount: String(body.data.amount),
      paymentMethod: body.data.paymentMethod as any,
      transactionRef: body.data.transactionRef,
    });

    const [updated] = await db.update(loansTable)
      .set({
        outstandingBalance: String(newBalance),
        status: isFullyRepaid ? "repaid" : "active",
        repaidAt: isFullyRepaid ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(loansTable.id, req.params.loanId))
      .returning();

    if (isFullyRepaid) {
      await db.update(tokensTable).set({ tokenState: "released", updatedAt: new Date() }).where(eq(tokensTable.id, loan.tokenId));
      await db.insert(activityLogTable).values({
        type: "loan_repaid",
        description: `Loan ${loan.id} fully repaid`,
        actorName: "Borrower",
        actorId: loan.borrowerId,
        entityId: loan.id,
      });
    }

    const [borrower] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.borrowerId)).limit(1);
    const lender = updated.lenderId ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.lenderId)).limit(1).then(r => r[0]) : null;
    res.json(formatLoan(updated, borrower, lender));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:loanId/ltv", async (req, res) => {
  try {
    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

    const [token] = await db.select().from(tokensTable).where(eq(tokensTable.id, loan.tokenId)).limit(1);
    const pricePerKg = COMMODITY_PRICES[token?.commodity ?? "Maize"] ?? 40;
    const collateralValue = Number(token?.weightKg ?? 0) * pricePerKg;
    const outstanding = Number(loan.outstandingBalance ?? loan.principalAmount);
    const currentLtv = collateralValue > 0 ? (outstanding / collateralValue) * 100 : 0;

    let ltvStatus: "healthy" | "monitoring" | "margin_call" | "liquidation" = "healthy";
    if (currentLtv >= 90) ltvStatus = "liquidation";
    else if (currentLtv >= 80) ltvStatus = "margin_call";
    else if (currentLtv >= 70) ltvStatus = "monitoring";

    res.json({
      loanId: loan.id,
      currentLtv: Math.round(currentLtv * 100) / 100,
      outstandingBalance: outstanding,
      collateralValue,
      ltvStatus,
      commodityPrice: pricePerKg,
      priceLastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:loanId/risk", async (req, res) => {
  try {
    const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, req.params.loanId)).limit(1);
    if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

    const riskMap: Record<string, { score: number; repayment: string }> = {
      low: { score: 750, repayment: "excellent" },
      medium: { score: 620, repayment: "good" },
      high: { score: 480, repayment: "fair" },
    };
    const riskData = riskMap[loan.riskScore ?? "medium"];

    res.json({
      userId: loan.borrowerId,
      riskScore: loan.riskScore ?? "medium",
      creditScore: riskData.score,
      dscr: 1.35,
      isOnNegativeList: loan.isOnNegativeList,
      repaymentHistory: riskData.repayment,
      assessedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
