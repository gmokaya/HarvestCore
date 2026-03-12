import { Router } from "express";
import { db } from "@workspace/db";
import { intakesTable, warehousesTable, usersTable, tokensTable, activityLogTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { CreateIntakeBody, UpdateIntakeBody } from "@workspace/api-zod";

const router = Router();

const formatIntake = (intake: any, farmer: any, warehouse: any) => ({
  ...intake,
  weightKg: Number(intake.weightKg),
  moisturePercent: Number(intake.moisturePercent),
  farmerName: farmer?.name ?? "Unknown",
  warehouseName: warehouse?.name ?? "Unknown",
});

router.get("/intakes", async (req, res) => {
  try {
    const { status, warehouseId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (status) conditions.push(eq(intakesTable.status, status as any));
    if (warehouseId) conditions.push(eq(intakesTable.warehouseId, warehouseId));

    const [intakes, countResult] = await Promise.all([
      db.select().from(intakesTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
        .orderBy(intakesTable.createdAt)
        .limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(intakesTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
    ]);

    const farmers = await Promise.all(intakes.map(i =>
      db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, i.farmerId)).limit(1).then(r => r[0])
    ));
    const warehouses = await Promise.all(intakes.map(i =>
      db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, i.warehouseId)).limit(1).then(r => r[0])
    ));

    const formatted = intakes.map((intake, idx) => formatIntake(intake, farmers[idx], warehouses[idx]));
    res.json({ intakes: formatted, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/intakes", async (req, res) => {
  try {
    const body = CreateIntakeBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [intake] = await db.insert(intakesTable).values({
      farmerId: body.data.farmerId,
      warehouseId: body.data.warehouseId,
      commodity: body.data.commodity,
      variety: body.data.variety ?? null,
      weightKg: String(body.data.weightKg),
      moisturePercent: String(body.data.moisturePercent),
    }).returning();

    const [farmer] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, intake.farmerId)).limit(1);
    const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, intake.warehouseId)).limit(1);

    await db.insert(activityLogTable).values({
      type: "intake_created",
      description: `New intake created: ${body.data.commodity} ${body.data.weightKg}kg`,
      actorName: farmer?.name ?? "System",
      actorId: body.data.farmerId,
      entityId: intake.id,
    });

    res.status(201).json(formatIntake(intake, farmer, warehouse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/intakes/:intakeId", async (req, res) => {
  try {
    const [intake] = await db.select().from(intakesTable).where(eq(intakesTable.id, req.params.intakeId)).limit(1);
    if (!intake) { res.status(404).json({ error: "Intake not found" }); return; }
    const [farmer] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, intake.farmerId)).limit(1);
    const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, intake.warehouseId)).limit(1);
    res.json(formatIntake(intake, farmer, warehouse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/intakes/:intakeId", async (req, res) => {
  try {
    const body = UpdateIntakeBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const updates: any = { updatedAt: new Date() };
    if (body.data.grade) updates.grade = body.data.grade;
    if (body.data.weightKg != null) updates.weightKg = String(body.data.weightKg);
    if (body.data.moisturePercent != null) updates.moisturePercent = String(body.data.moisturePercent);
    if (body.data.grnNumber) { updates.grnNumber = body.data.grnNumber; updates.status = "weighed"; }
    if (body.data.checkerNotes) updates.checkerNotes = body.data.checkerNotes;
    if (body.data.grade && !body.data.grnNumber) updates.status = "graded";

    const [intake] = await db.update(intakesTable).set(updates).where(eq(intakesTable.id, req.params.intakeId)).returning();
    if (!intake) { res.status(404).json({ error: "Intake not found" }); return; }

    const [farmer] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, intake.farmerId)).limit(1);
    const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, intake.warehouseId)).limit(1);
    res.json(formatIntake(intake, farmer, warehouse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/intakes/:intakeId/approve", async (req, res) => {
  try {
    const mockHash = `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`;
    const [intake] = await db.update(intakesTable)
      .set({ status: "anchored", iotaHash: mockHash, updatedAt: new Date() })
      .where(eq(intakesTable.id, req.params.intakeId))
      .returning();
    if (!intake) { res.status(404).json({ error: "Intake not found" }); return; }

    await db.insert(activityLogTable).values({
      type: "intake_created",
      description: `Intake ${req.params.intakeId} approved and anchored to IOTA`,
      actorName: "Checker",
      entityId: intake.id,
    });

    const [farmer] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, intake.farmerId)).limit(1);
    const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, intake.warehouseId)).limit(1);
    res.json(formatIntake(intake, farmer, warehouse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/intakes/:intakeId/reject", async (req, res) => {
  try {
    const [intake] = await db.update(intakesTable)
      .set({ status: "rejected", checkerNotes: req.body.reason, updatedAt: new Date() })
      .where(eq(intakesTable.id, req.params.intakeId))
      .returning();
    if (!intake) { res.status(404).json({ error: "Intake not found" }); return; }
    const [farmer] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, intake.farmerId)).limit(1);
    const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, intake.warehouseId)).limit(1);
    res.json(formatIntake(intake, farmer, warehouse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/warehouses", async (req, res) => {
  try {
    const warehouses = await db.select().from(warehousesTable);
    const formatted = warehouses.map(w => ({
      ...w,
      capacity: Number(w.capacity),
      currentStock: Number(w.currentStock),
    }));
    res.json({ warehouses: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
