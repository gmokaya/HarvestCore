import { Router } from "express";
import { db } from "@workspace/db";
import {
  tokensTable, loansTable, listingsTable, usersTable,
  warehousesTable, intakesTable, settlementsTable,
  activityLogTable, kycRecordsTable,
} from "@workspace/db/schema";
import { eq, sql, inArray, and } from "drizzle-orm";

const router = Router();

/** Returns the set of member user IDs to scope queries to, or null for admin (no filter). */
async function resolveScope(reqUser?: Express.Request["user"]): Promise<{ farmerIds: string[] | null; orgId: string | null }> {
  if (!reqUser) return { farmerIds: null, orgId: null };
  if (reqUser.role === "admin") return { farmerIds: null, orgId: null };
  if (reqUser.orgId) {
    const members = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.orgId, reqUser.orgId));
    return { farmerIds: members.map((m) => m.id), orgId: reqUser.orgId };
  }
  // No org — scope to just the requesting user
  return { farmerIds: [reqUser.userId], orgId: null };
}

router.get("/stats", async (req, res) => {
  try {
    const { farmerIds, orgId } = await resolveScope(req.user);
    const scoped = farmerIds !== null && farmerIds.length > 0;

    const mf = (col: any) => (scoped ? inArray(col, farmerIds!) : undefined);

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
      db.select({ count: sql<number>`count(*)` })
        .from(tokensTable)
        .leftJoin(intakesTable, eq(tokensTable.intakeId, intakesTable.id))
        .where(scoped ? inArray(intakesTable.farmerId, farmerIds!) : undefined)
        .then(r => Number(r[0]?.count ?? 0)),

      db.select({ count: sql<number>`count(*)` })
        .from(loansTable)
        .where(and(eq(loansTable.status, "active"), mf(loansTable.borrowerId)))
        .then(r => Number(r[0]?.count ?? 0)),

      db.select({ total: sql<number>`coalesce(sum(principal_amount), 0)` })
        .from(loansTable)
        .where(and(eq(loansTable.status, "active"), mf(loansTable.borrowerId)))
        .then(r => Number(r[0]?.total ?? 0)),

      db.select({ count: sql<number>`count(*)` })
        .from(listingsTable)
        .where(and(eq(listingsTable.status, "active"), mf(listingsTable.sellerId)))
        .then(r => Number(r[0]?.count ?? 0)),

      scoped
        ? db.select({ count: sql<number>`count(*)` })
            .from(usersTable)
            .where(and(eq(usersTable.role, "farmer"), orgId ? eq(usersTable.orgId, orgId) : inArray(usersTable.id, farmerIds!)))
            .then(r => Number(r[0]?.count ?? 0))
        : db.select({ count: sql<number>`count(*)` })
            .from(usersTable).where(eq(usersTable.role, "farmer"))
            .then(r => Number(r[0]?.count ?? 0)),

      db.select({ count: sql<number>`count(*)` }).from(warehousesTable).then(r => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(settlementsTable).then(r => Number(r[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(kycRecordsTable).where(eq(kycRecordsTable.status, "pending")).then(r => Number(r[0]?.count ?? 0)),

      db.select({ count: sql<number>`count(*)` })
        .from(intakesTable)
        .where(and(eq(intakesTable.status, "pending"), mf(intakesTable.farmerId)))
        .then(r => Number(r[0]?.count ?? 0)),

      db.select({ total: sql<number>`coalesce(sum(asking_price), 0)` })
        .from(listingsTable)
        .where(and(eq(listingsTable.status, "sold"), mf(listingsTable.sellerId)))
        .then(r => Number(r[0]?.total ?? 0)),
    ]);

    res.json({
      totalTokens, activeLoans,
      totalLoanValue: loanValueResult,
      activeListings, totalFarmers, totalWarehouses,
      atRiskLoans, pendingKyc, pendingIntakes,
      totalVolumeTraded: tradeVolume,
      _scope: req.user?.orgId ?? (req.user?.role === "admin" ? "platform" : req.user?.userId ?? "all"),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/activity", async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) ?? "20");
    const { farmerIds } = await resolveScope(req.user);

    const activities = farmerIds
      ? await db.select().from(activityLogTable)
          .where(inArray(activityLogTable.actorId, farmerIds))
          .orderBy(activityLogTable.createdAt)
          .limit(limit)
      : await db.select().from(activityLogTable)
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
