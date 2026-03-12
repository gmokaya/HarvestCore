import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, kycRecordsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  CreateUserBody, UpdateUserBody, SubmitKycBody
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { role, kycStatus, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions: Parameters<typeof and>[] = [];
    if (role) conditions.push(eq(usersTable.role, role as any));
    if (kycStatus) conditions.push(eq(usersTable.kycStatus, kycStatus as any));

    const [users, countResult] = await Promise.all([
      db.select().from(usersTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
        .limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(usersTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
    ]);

    const safeUsers = users.map(({ passwordHash: _, ...u }) => u);
    res.json({ users: safeUsers, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateUserBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const { password, ...rest } = body.data;
    const [user] = await db.insert(usersTable).values({
      ...rest,
      passwordHash: password,
    }).returning();
    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Email already exists" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId", async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:userId", async (req, res) => {
  try {
    const body = UpdateUserBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [user] = await db.update(usersTable)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.userId))
      .returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:userId/kyc", async (req, res) => {
  try {
    const body = SubmitKycBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [kyc] = await db.insert(kycRecordsTable).values({
      userId: req.params.userId,
      ...body.data,
      documentUrls: body.data.documentUrls ?? [],
    }).returning();
    res.json(kyc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId/kyc", async (req, res) => {
  try {
    const [kyc] = await db.select().from(kycRecordsTable)
      .where(eq(kycRecordsTable.userId, req.params.userId))
      .orderBy(kycRecordsTable.submittedAt)
      .limit(1);
    if (!kyc) { res.status(404).json({ error: "KYC record not found" }); return; }
    res.json(kyc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:userId/kyc/approve", async (req, res) => {
  try {
    const [kyc] = await db.update(kycRecordsTable)
      .set({ status: "approved", reviewedAt: new Date() })
      .where(eq(kycRecordsTable.userId, req.params.userId))
      .returning();
    await db.update(usersTable).set({ kycStatus: "approved", updatedAt: new Date() }).where(eq(usersTable.id, req.params.userId));
    res.json(kyc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:userId/kyc/reject", async (req, res) => {
  try {
    const { reason } = req.body;
    const [kyc] = await db.update(kycRecordsTable)
      .set({ status: "rejected", rejectionReason: reason, reviewedAt: new Date() })
      .where(eq(kycRecordsTable.userId, req.params.userId))
      .returning();
    await db.update(usersTable).set({ kycStatus: "rejected", updatedAt: new Date() }).where(eq(usersTable.id, req.params.userId));
    res.json(kyc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
