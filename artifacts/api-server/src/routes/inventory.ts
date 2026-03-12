import { Router } from "express";
import { db } from "@workspace/db";
import { intakesTable, warehousesTable, usersTable, activityLogTable } from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { CreateIntakeBody } from "@workspace/api-zod";

const router = Router();

const formatIntake = (intake: any, farmer: any, warehouse: any) => ({
  ...intake,
  weightKg: Number(intake.weightKg),
  moisturePercent: Number(intake.moisturePercent),
  farmerName: farmer?.name ?? "Unknown",
  warehouseName: warehouse?.name ?? "Unknown",
});

const getIntakeWithRelations = async (intakeId: string) => {
  const [intake] = await db.select().from(intakesTable).where(eq(intakesTable.id, intakeId)).limit(1);
  if (!intake) return null;
  const [farmer] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, intake.farmerId)).limit(1);
  const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, intake.warehouseId)).limit(1);
  return formatIntake(intake, farmer, warehouse);
};

router.get("/intakes", async (req, res) => {
  try {
    const { status, warehouseId, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (status) conditions.push(eq(intakesTable.status, status as any));
    if (warehouseId) conditions.push(eq(intakesTable.warehouseId, warehouseId));

    const [intakes, countResult] = await Promise.all([
      db.select().from(intakesTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
        .orderBy(desc(intakesTable.createdAt))
        .limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(intakesTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
    ]);

    const [farmers, warehouses] = await Promise.all([
      Promise.all(intakes.map(i =>
        db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, i.farmerId)).limit(1).then(r => r[0])
      )),
      Promise.all(intakes.map(i =>
        db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, i.warehouseId)).limit(1).then(r => r[0])
      ))
    ]);

    const formatted = intakes.map((intake, idx) => formatIntake(intake, farmers[idx], warehouses[idx]));

    const stageCounts = await db.select({
      status: intakesTable.status,
      count: sql<number>`count(*)`
    }).from(intakesTable).groupBy(intakesTable.status);

    res.json({
      intakes: formatted,
      total: Number(countResult[0].count),
      page: pageNum,
      limit: limitNum,
      stageCounts: Object.fromEntries(stageCounts.map(s => [s.status, Number(s.count)])),
    });
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
      moisturePercent: String(body.data.moisturePercent ?? 0),
    }).returning();

    const [farmer] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, intake.farmerId)).limit(1);
    const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, intake.warehouseId)).limit(1);

    await db.insert(activityLogTable).values({
      type: "intake_created",
      description: `New intake: ${body.data.commodity} ${body.data.weightKg}kg at ${warehouse?.name ?? "warehouse"}`,
      actorName: farmer?.name ?? "Unknown",
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
    const result = await getIntakeWithRelations(req.params.intakeId);
    if (!result) { res.status(404).json({ error: "Intake not found" }); return; }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/intakes/:intakeId/grade", async (req, res) => {
  try {
    const { grade, moisturePercent, checkerNotes } = req.body;
    if (!grade) { res.status(400).json({ error: "Grade is required" }); return; }

    const [current] = await db.select({ status: intakesTable.status }).from(intakesTable).where(eq(intakesTable.id, req.params.intakeId)).limit(1);
    if (!current) { res.status(404).json({ error: "Intake not found" }); return; }
    if (current.status !== "pending") { res.status(400).json({ error: `Cannot grade intake in status: ${current.status}` }); return; }

    const updates: any = {
      grade,
      status: "graded",
      updatedAt: new Date(),
    };
    if (moisturePercent != null) updates.moisturePercent = String(moisturePercent);
    if (checkerNotes) updates.checkerNotes = checkerNotes;

    await db.update(intakesTable).set(updates).where(eq(intakesTable.id, req.params.intakeId));

    const result = await getIntakeWithRelations(req.params.intakeId);
    if (!result) { res.status(404).json({ error: "Intake not found" }); return; }

    await db.insert(activityLogTable).values({
      type: "intake_graded",
      description: `Intake ${req.params.intakeId} graded: Grade ${grade}`,
      actorName: "Grading Officer",
      entityId: req.params.intakeId,
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/intakes/:intakeId/weigh", async (req, res) => {
  try {
    const { grnNumber, confirmedWeightKg } = req.body;
    if (!grnNumber) { res.status(400).json({ error: "GRN number is required" }); return; }

    const [current] = await db.select({ status: intakesTable.status }).from(intakesTable).where(eq(intakesTable.id, req.params.intakeId)).limit(1);
    if (!current) { res.status(404).json({ error: "Intake not found" }); return; }
    if (current.status !== "graded") { res.status(400).json({ error: `Cannot weigh intake in status: ${current.status}` }); return; }

    const updates: any = {
      grnNumber,
      status: "weighed",
      updatedAt: new Date(),
    };
    if (confirmedWeightKg != null) updates.weightKg = String(confirmedWeightKg);

    await db.update(intakesTable).set(updates).where(eq(intakesTable.id, req.params.intakeId));

    const result = await getIntakeWithRelations(req.params.intakeId);
    if (!result) { res.status(404).json({ error: "Intake not found" }); return; }

    await db.insert(activityLogTable).values({
      type: "intake_weighed",
      description: `GRN ${grnNumber} issued for intake ${req.params.intakeId}`,
      actorName: "Warehouse Operator",
      entityId: req.params.intakeId,
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/intakes/:intakeId/approve", async (req, res) => {
  try {
    const [current] = await db.select({ status: intakesTable.status, farmerId: intakesTable.farmerId }).from(intakesTable).where(eq(intakesTable.id, req.params.intakeId)).limit(1);
    if (!current) { res.status(404).json({ error: "Intake not found" }); return; }
    if (!["weighed", "verified"].includes(current.status)) {
      res.status(400).json({ error: `Cannot approve intake in status: ${current.status}` });
      return;
    }

    const nextStatus = current.status === "weighed" ? "verified" : "anchored";
    const mockHash = nextStatus === "anchored" ? `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}` : null;

    const updates: any = { status: nextStatus, updatedAt: new Date() };
    if (mockHash) updates.iotaHash = mockHash;

    await db.update(intakesTable).set(updates).where(eq(intakesTable.id, req.params.intakeId));

    const result = await getIntakeWithRelations(req.params.intakeId);
    if (!result) { res.status(404).json({ error: "Intake not found" }); return; }

    await db.insert(activityLogTable).values({
      type: nextStatus === "anchored" ? "intake_anchored" : "intake_verified",
      description: nextStatus === "anchored"
        ? `Intake ${req.params.intakeId} anchored to IOTA: ${mockHash}`
        : `Intake ${req.params.intakeId} verified by checker`,
      actorName: "Checker",
      entityId: req.params.intakeId,
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/intakes/:intakeId/reject", async (req, res) => {
  try {
    const { reason } = req.body;
    await db.update(intakesTable)
      .set({ status: "rejected", checkerNotes: reason, updatedAt: new Date() })
      .where(eq(intakesTable.id, req.params.intakeId));

    const result = await getIntakeWithRelations(req.params.intakeId);
    if (!result) { res.status(404).json({ error: "Intake not found" }); return; }

    await db.insert(activityLogTable).values({
      type: "intake_rejected",
      description: `Intake ${req.params.intakeId} rejected: ${reason}`,
      actorName: "Checker",
      entityId: req.params.intakeId,
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/warehouses", async (req, res) => {
  try {
    const warehouses = await db.select().from(warehousesTable);

    const warehousesWithStats = await Promise.all(warehouses.map(async (w) => {
      const intakeCounts = await db.select({
        status: intakesTable.status,
        count: sql<number>`count(*)`,
      }).from(intakesTable).where(eq(intakesTable.warehouseId, w.id)).groupBy(intakesTable.status);

      const [operator] = await db.select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, w.operatorId)).limit(1);

      const utilizationPct = Number(w.capacity) > 0
        ? Math.round((Number(w.currentStock) / Number(w.capacity)) * 100)
        : 0;

      return {
        ...w,
        capacity: Number(w.capacity),
        currentStock: Number(w.currentStock),
        utilizationPct,
        operatorName: operator?.name ?? "Unknown",
        intakeCounts: Object.fromEntries(intakeCounts.map(c => [c.status, Number(c.count)])),
      };
    }));

    res.json({ warehouses: warehousesWithStats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/warehouses/:warehouseId", async (req, res) => {
  try {
    const [warehouse] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, req.params.warehouseId)).limit(1);
    if (!warehouse) { res.status(404).json({ error: "Warehouse not found" }); return; }

    const [operator] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, warehouse.operatorId)).limit(1);

    const intakes = await db.select().from(intakesTable).where(eq(intakesTable.warehouseId, req.params.warehouseId));

    res.json({
      ...warehouse,
      capacity: Number(warehouse.capacity),
      currentStock: Number(warehouse.currentStock),
      utilizationPct: Math.round((Number(warehouse.currentStock) / Number(warehouse.capacity)) * 100),
      operatorName: operator?.name ?? "Unknown",
      totalIntakes: intakes.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
