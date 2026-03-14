import { Router } from "express";
import { db } from "@workspace/db";
import { organizationsTable, usersTable } from "@workspace/db/schema";
import { generateId, ORG_ID_PREFIX } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const orgs = await db.select().from(organizationsTable).orderBy(desc(organizationsTable.createdAt));

    const withAdmins = await Promise.all(orgs.map(async (org) => {
      const admin = org.adminId
        ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
            .from(usersTable).where(eq(usersTable.id, org.adminId)).limit(1).then(r => r[0])
        : null;

      const memberCount = await db.select({ count: sql<number>`count(*)` })
        .from(usersTable).where(eq(usersTable.orgId, org.id))
        .then(r => Number(r[0]?.count ?? 0));

      return { ...org, adminName: admin?.name ?? null, adminEmail: admin?.email ?? null, memberCount };
    }));

    const stats = await db.select({ type: organizationsTable.type, count: sql<number>`count(*)` })
      .from(organizationsTable).groupBy(organizationsTable.type);

    res.json({ organizations: withAdmins, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.params.id)).limit(1);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const members = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, kycStatus: usersTable.kycStatus,
    }).from(usersTable).where(eq(usersTable.orgId, req.params.id));

    res.json({ ...org, members });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const prefix = ORG_ID_PREFIX[req.body.type as string] ?? "ORG";
    const [org] = await db.insert(organizationsTable).values({
      id: generateId(prefix),
      ...req.body,
    }).returning();
    res.status(201).json(org);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const [org] = await db.update(organizationsTable)
      .set({ status: req.body.status, updatedAt: new Date() })
      .where(eq(organizationsTable.id, req.params.id)).returning();
    res.json(org);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
