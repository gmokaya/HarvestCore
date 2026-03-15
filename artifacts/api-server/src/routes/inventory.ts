import { Router } from "express";
import { db } from "@workspace/db";
import { intakesTable, warehousesTable, usersTable, activityLogTable, organizationsTable } from "@workspace/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { CreateIntakeBody } from "@workspace/api-zod";

async function resolveOrgFarmerIds(reqUser?: Express.Request["user"]): Promise<string[] | null> {
  if (!reqUser) return null;
  if (reqUser.role === "admin") return null; // null = no filter
  if (reqUser.orgId) {
    const members = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.orgId, reqUser.orgId));
    return members.map((m) => m.id);
  }
  // No org — scope to own records only
  return [reqUser.userId];
}

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

    // Resolve org-scoped farmer IDs
    const farmerIds = await resolveOrgFarmerIds(req.user);
    const orgScoped = farmerIds !== null && farmerIds.length > 0;

    const conditions: any[] = [];
    if (status) conditions.push(eq(intakesTable.status, status as any));
    if (warehouseId) conditions.push(eq(intakesTable.warehouseId, warehouseId));
    if (orgScoped) conditions.push(inArray(intakesTable.farmerId, farmerIds!));

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
    }).from(intakesTable)
      .where(orgScoped ? inArray(intakesTable.farmerId, farmerIds!) : undefined)
      .groupBy(intakesTable.status);

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

      let orgName: string | null = null;
      if (w.organizationId) {
        const [org] = await db.select({ name: organizationsTable.name })
          .from(organizationsTable).where(eq(organizationsTable.id, w.organizationId)).limit(1);
        orgName = org?.name ?? null;
      }

      const utilizationPct = Number(w.capacity) > 0
        ? Math.round((Number(w.currentStock) / Number(w.capacity)) * 100)
        : 0;

      return {
        ...w,
        capacity: Number(w.capacity),
        currentStock: Number(w.currentStock),
        utilizationPct,
        operatorName: operator?.name ?? "Unknown",
        organizationName: orgName,
        intakeCounts: Object.fromEntries(intakeCounts.map(c => [c.status, Number(c.count)])),
      };
    }));

    res.json({ warehouses: warehousesWithStats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/warehouses", async (req, res) => {
  try {
    const { name, location, capacity, operatorId, organizationId, warehouseType, status } = req.body;
    if (!name || !location || !capacity || !operatorId) {
      res.status(400).json({ error: "name, location, capacity and operatorId are required" });
      return;
    }
    const [operator] = await db.select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, operatorId)).limit(1);
    if (!operator) { res.status(404).json({ error: "Operator user not found" }); return; }

    let orgName: string | null = null;
    if (organizationId) {
      const [org] = await db.select({ name: organizationsTable.name })
        .from(organizationsTable).where(eq(organizationsTable.id, organizationId)).limit(1);
      if (!org) { res.status(404).json({ error: "Organization not found" }); return; }
      orgName = org.name;
    }

    const [warehouse] = await db.insert(warehousesTable).values({
      name,
      location,
      capacity: String(capacity),
      operatorId,
      organizationId: organizationId ?? null,
      warehouseType: warehouseType ?? "multi_commodity",
      status: status ?? "active",
    }).returning();

    res.status(201).json({
      ...warehouse,
      capacity: Number(warehouse.capacity),
      currentStock: 0,
      operatorName: operator.name,
      organizationName: orgName,
    });
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

    let orgName: string | null = null;
    if (warehouse.organizationId) {
      const [org] = await db.select({ name: organizationsTable.name })
        .from(organizationsTable).where(eq(organizationsTable.id, warehouse.organizationId)).limit(1);
      orgName = org?.name ?? null;
    }

    const intakes = await db.select().from(intakesTable).where(eq(intakesTable.warehouseId, req.params.warehouseId));

    res.json({
      ...warehouse,
      capacity: Number(warehouse.capacity),
      currentStock: Number(warehouse.currentStock),
      utilizationPct: Math.round((Number(warehouse.currentStock) / Number(warehouse.capacity)) * 100),
      operatorName: operator?.name ?? "Unknown",
      organizationName: orgName,
      totalIntakes: intakes.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ─────────────────────────────────────────────
   WAREHOUSE MANAGEMENT MODULE
──────────────────────────────────────────────── */

// GET /warehouses/:warehouseId/dashboard
router.get("/warehouses/:warehouseId/dashboard", async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const [warehouse] = await db.select().from(warehousesTable)
      .where(eq(warehousesTable.id, warehouseId)).limit(1);
    if (!warehouse) { res.status(404).json({ error: "Warehouse not found" }); return; }

    const [operator] = await db.select({ name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, warehouse.operatorId)).limit(1);

    let orgName: string | null = null;
    if (warehouse.organizationId) {
      const [org] = await db.select({ name: organizationsTable.name })
        .from(organizationsTable).where(eq(organizationsTable.id, warehouse.organizationId)).limit(1);
      orgName = org?.name ?? null;
    }

    // Stock by commodity (verified/anchored intakes)
    const stockByCommodityRes = await db.execute(sql`
      SELECT commodity, SUM(weight_kg) as total_kg, COUNT(*) as batch_count
      FROM intakes
      WHERE warehouse_id = ${warehouseId}
        AND status IN ('verified','anchored','graded','weighed')
      GROUP BY commodity
      ORDER BY total_kg DESC
    `);
    const stockByCommodity = (stockByCommodityRes as any).rows ?? [];

    // Intake counts by status
    const intakesByStatusRes = await db.execute(sql`
      SELECT status, COUNT(*) as count
      FROM intakes WHERE warehouse_id = ${warehouseId}
      GROUP BY status
    `);
    const intakesByStatusRows: any[] = (intakesByStatusRes as any).rows ?? [];

    // Recent reconciliations
    const reconciliationsRes = await db.execute(sql`
      SELECT r.*, u.name as reconciled_by_name
      FROM stock_reconciliations r
      JOIN users u ON r.reconciled_by = u.id
      WHERE r.warehouse_id = ${warehouseId}
      ORDER BY r.created_at DESC LIMIT 5
    `);
    const reconciliationRows: any[] = (reconciliationsRes as any).rows ?? [];

    // Receipts issued today
    const todayReceiptsRes = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM warehouse_receipts
      WHERE warehouse_id = ${warehouseId}
        AND DATE(date_issued) = CURRENT_DATE
    `);
    const todayReceiptsRows: any[] = (todayReceiptsRes as any).rows ?? [];

    const capacity = Number(warehouse.capacity);
    const currentStock = Number(warehouse.currentStock);
    const available = Math.max(0, capacity - currentStock);
    const utilizationPct = capacity > 0 ? Math.round((currentStock / capacity) * 100) : 0;

    res.json({
      warehouse: {
        ...warehouse,
        capacity,
        currentStock,
        utilizationPct,
        operatorName: operator?.name ?? "Unknown",
        organizationName: orgName,
      },
      capacity: { total: capacity, occupied: currentStock, available, utilizationPct },
      stockByCommodity: stockByCommodity.map((r: any) => ({
        commodity: r.commodity,
        totalKg: Number(r.total_kg),
        batchCount: Number(r.batch_count),
      })),
      intakesByStatus: Object.fromEntries(
        intakesByStatusRows.map(r => [r.status, Number(r.count)])
      ),
      recentReconciliations: reconciliationRows,
      todayReceipts: Number(todayReceiptsRows[0]?.count ?? 0),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /network-summary — multi-warehouse commodity distribution
router.get("/network-summary", async (req, res) => {
  try {
    const warehouses = await db.select({
      id: warehousesTable.id,
      name: warehousesTable.name,
      location: warehousesTable.location,
      capacity: warehousesTable.capacity,
      currentStock: warehousesTable.currentStock,
      status: warehousesTable.status,
      warehouseType: warehousesTable.warehouseType,
    }).from(warehousesTable).where(eq(warehousesTable.status, "active"));

    // Commodity distribution across all warehouses
    const commodityMatrixRes = await db.execute(sql`
      SELECT i.warehouse_id, i.commodity, SUM(i.weight_kg) as total_kg, COUNT(*) as batches
      FROM intakes i
      WHERE i.status IN ('verified','anchored','graded','weighed')
      GROUP BY i.warehouse_id, i.commodity
      ORDER BY i.commodity, total_kg DESC
    `);
    const commodityMatrixRows: any[] = (commodityMatrixRes as any).rows ?? [];

    // Total stock by commodity
    const totalByCommodityRes = await db.execute(sql`
      SELECT commodity, SUM(weight_kg) as total_kg, COUNT(*) as batches
      FROM intakes
      WHERE status IN ('verified','anchored','graded','weighed')
      GROUP BY commodity ORDER BY total_kg DESC
    `);
    const totalByCommodityRows: any[] = (totalByCommodityRes as any).rows ?? [];

    // Status summary across network
    const statusSummaryRes = await db.execute(sql`
      SELECT status, COUNT(*) as count, SUM(weight_kg) as total_kg
      FROM intakes GROUP BY status
    `);
    const statusSummaryRows: any[] = (statusSummaryRes as any).rows ?? [];

    res.json({
      warehouses: warehouses.map(w => ({
        ...w,
        capacity: Number(w.capacity),
        currentStock: Number(w.currentStock),
        utilizationPct: Number(w.capacity) > 0
          ? Math.round((Number(w.currentStock) / Number(w.capacity)) * 100)
          : 0,
      })),
      commodityMatrix: commodityMatrixRows.map(r => ({
        warehouseId: r.warehouse_id,
        commodity: r.commodity,
        totalKg: Number(r.total_kg),
        batches: Number(r.batches),
      })),
      totalByCommodity: totalByCommodityRows.map(r => ({
        commodity: r.commodity,
        totalKg: Number(r.total_kg),
        batches: Number(r.batches),
      })),
      statusSummary: statusSummaryRows.map(r => ({
        status: r.status,
        count: Number(r.count),
        totalKg: Number(r.total_kg ?? 0),
      })),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /warehouses/:warehouseId/reconciliations
router.get("/warehouses/:warehouseId/reconciliations", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT r.*, 
        u1.name as reconciled_by_name,
        u2.name as approved_by_name
      FROM stock_reconciliations r
      JOIN users u1 ON r.reconciled_by = u1.id
      LEFT JOIN users u2 ON r.approved_by = u2.id
      WHERE r.warehouse_id = ${req.params.warehouseId}
      ORDER BY r.created_at DESC
    `);
    const rows: any[] = (result as any).rows ?? [];
    res.json({ reconciliations: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /warehouses/:warehouseId/reconciliations
router.post("/warehouses/:warehouseId/reconciliations", async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const { commodity, systemQty, physicalQty, remarks } = req.body;
    const userId = req.user?.userId;
    if (!commodity || systemQty == null || physicalQty == null || !userId) {
      res.status(400).json({ error: "commodity, systemQty, physicalQty are required" }); return;
    }
    const variance = Number(physicalQty) - Number(systemQty);
    const id = `REC-${Date.now().toString(36).toUpperCase()}`;
    await db.execute(sql`
      INSERT INTO stock_reconciliations (id, warehouse_id, commodity, system_qty, physical_qty, variance, status, remarks, reconciled_by)
      VALUES (${id}, ${warehouseId}, ${commodity}, ${Number(systemQty)}, ${Number(physicalQty)}, ${variance}, 'pending', ${remarks ?? null}, ${userId})
    `);
    res.status(201).json({ id, warehouseId, commodity, systemQty, physicalQty, variance, status: "pending", remarks });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// PATCH /warehouses/:warehouseId/reconciliations/:recId/approve
router.patch("/warehouses/:warehouseId/reconciliations/:recId/approve", async (req, res) => {
  try {
    const { recId } = req.params;
    const { action } = req.body; // "approve" | "reject"
    const userId = req.user?.userId;
    if (!action || !userId) { res.status(400).json({ error: "action is required" }); return; }
    const newStatus = action === "approve" ? "approved" : "rejected";
    await db.execute(sql`
      UPDATE stock_reconciliations
      SET status = ${newStatus}, approved_by = ${userId}, approved_at = now(), updated_at = now()
      WHERE id = ${recId}
    `);
    res.json({ id: recId, status: newStatus });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
