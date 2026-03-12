import { Router } from "express";
import { db } from "@workspace/db";
import { tokensTable, loansTable, listingsTable, usersTable, warehousesTable, intakesTable, settlementsTable, activityLogTable, kycRecordsTable } from "@workspace/db/schema";
import { eq, sql, inArray } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const [
      totalTokens,
      activeLoans,
      loanValueResult,
      activeListings,
      totalFarmers,
      totalWarehouses,
      atRiskLoans,
      pendingKyc,
      pendingIntakes,
      tradeVolume,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(tokensTable).then(r => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(loansTable).where(eq(loansTable.status, "active")).then(r => Number(r[0]?.count ?? 0)),
      db.select({ total: sql<number>`coalesce(sum(principal_amount), 0)` }).from(loansTable).where(eq(loansTable.status, "active")).then(r => Number(r[0]?.total ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(listingsTable).where(eq(listingsTable.status, "active")).then(r => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, "farmer")).then(r => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(warehousesTable).then(r => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(settlementsTable).then(r => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(kycRecordsTable).where(eq(kycRecordsTable.status, "pending")).then(r => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(intakesTable).where(eq(intakesTable.status, "pending")).then(r => Number(r[0]?.count ?? 0)),
      db.select({ total: sql<number>`coalesce(sum(asking_price), 0)` }).from(listingsTable).where(eq(listingsTable.status, "sold")).then(r => Number(r[0]?.total ?? 0)),
    ]);

    res.json({
      totalTokens,
      activeLoans,
      totalLoanValue: loanValueResult,
      activeListings,
      totalFarmers,
      totalWarehouses,
      atRiskLoans,
      pendingKyc,
      pendingIntakes,
      totalVolumeTraded: tradeVolume,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/activity", async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) ?? "20");
    const activities = await db.select().from(activityLogTable)
      .orderBy(activityLogTable.createdAt)
      .limit(limit);

    const formatted = activities.map(a => ({
      id: a.id,
      type: a.type,
      description: a.description,
      actorName: a.actorName,
      entityId: a.entityId ?? null,
      createdAt: a.createdAt.toISOString(),
    }));

    res.json({ activities: formatted.reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
