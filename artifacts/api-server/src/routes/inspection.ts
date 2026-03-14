import { Router } from "express";
import { db } from "@workspace/db";
import {
  inspectionsTable, usersTable, warehousesTable, intakesTable,
} from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const router = Router();

const formatInspection = (row: any, inspector: any, warehouse: any, intake: any) => ({
  ...row,
  moisturePercent: row.moisturePercent ? Number(row.moisturePercent) : null,
  brokenGrainPercent: row.brokenGrainPercent ? Number(row.brokenGrainPercent) : null,
  foreignMatterPercent: row.foreignMatterPercent ? Number(row.foreignMatterPercent) : null,
  pestDamagePercent: row.pestDamagePercent ? Number(row.pestDamagePercent) : null,
  netWeightKg: row.netWeightKg ? Number(row.netWeightKg) : null,
  grossWeightKg: row.grossWeightKg ? Number(row.grossWeightKg) : null,
  bagCount: row.bagCount ? Number(row.bagCount) : null,
  temperatureCelsius: row.temperatureCelsius ? Number(row.temperatureCelsius) : null,
  humidityPercent: row.humidityPercent ? Number(row.humidityPercent) : null,
  inspectorName: inspector?.name ?? "Unknown",
  warehouseName: warehouse?.name ?? "Unknown",
  intakeCommodity: intake?.commodity ?? null,
  riskFlags: row.riskFlags ? JSON.parse(row.riskFlags) : [],
  certifications: row.certifications ? JSON.parse(row.certifications) : [],
  mediaEvidence: row.mediaEvidence ? JSON.parse(row.mediaEvidence) : [],
});

router.get("/", async (_req, res) => {
  try {
    const inspections = await db.select().from(inspectionsTable).orderBy(desc(inspectionsTable.inspectionDate));

    const [inspectors, warehouses, intakes] = await Promise.all([
      Promise.all(inspections.map(i =>
        db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, i.inspectorId)).limit(1).then(r => r[0])
      )),
      Promise.all(inspections.map(i =>
        db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, i.warehouseId)).limit(1).then(r => r[0])
      )),
      Promise.all(inspections.map(i =>
        i.intakeId
          ? db.select({ id: intakesTable.id, commodity: intakesTable.commodity }).from(intakesTable).where(eq(intakesTable.id, i.intakeId)).limit(1).then(r => r[0])
          : Promise.resolve(null)
      )),
    ]);

    const stats = await db.select({ status: inspectionsTable.status, count: sql<number>`count(*)` })
      .from(inspectionsTable).groupBy(inspectionsTable.status);

    const riskFlagged = await db.select({ count: sql<number>`count(*)` }).from(inspectionsTable)
      .where(sql`risk_flags IS NOT NULL AND risk_flags != '[]'`);

    res.json({
      inspections: inspections.map((insp, idx) => formatInspection(insp, inspectors[idx], warehouses[idx], intakes[idx])),
      stats: {
        total: inspections.length,
        approved: Number(stats.find(s => s.status === "approved")?.count ?? 0),
        pending: Number(stats.find(s => s.status === "pending")?.count ?? 0),
        rejected: Number(stats.find(s => s.status === "rejected")?.count ?? 0),
        riskFlagged: Number(riskFlagged[0]?.count ?? 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [inspection] = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, req.params.id)).limit(1);
    if (!inspection) return res.status(404).json({ error: "Not found" });

    const [inspector] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, inspection.inspectorId)).limit(1);
    const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, inspection.warehouseId)).limit(1);
    const intake = inspection.intakeId
      ? await db.select({ id: intakesTable.id, commodity: intakesTable.commodity }).from(intakesTable).where(eq(intakesTable.id, inspection.intakeId)).limit(1).then(r => r[0])
      : null;

    res.json(formatInspection(inspection, inspector, warehouse, intake));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;

    const riskFlags: string[] = [];
    if (body.moisturePercent && Number(body.moisturePercent) > 14) riskFlags.push("Moisture > 14% — High Storage Risk");
    if (body.aflatoxinDetected) riskFlags.push("Aflatoxin Detected — Financing Not Allowed");
    if (body.damageLevel === "severe") riskFlags.push("Damage Level: Severe — Reject");
    if (body.foreignMatterPercent && Number(body.foreignMatterPercent) > 3) riskFlags.push("Foreign Matter > 3% — Downgrade Required");
    if (body.pestDamagePercent && Number(body.pestDamagePercent) > 2) riskFlags.push("Pest Damage > 2% — Fumigation Required");
    if (body.discoloration) riskFlags.push("Discoloration Present — Grade Review Required");
    if (body.moldPresent) riskFlags.push("Mold Detected — Storage Risk");

    const [inspection] = await db.insert(inspectionsTable).values({
      ...body,
      riskFlags: JSON.stringify(riskFlags),
      certifications: JSON.stringify(body.certifications ?? []),
      mediaEvidence: JSON.stringify(body.mediaEvidence ?? []),
    }).returning();

    res.status(201).json({ ...inspection, riskFlags, certifications: body.certifications ?? [], mediaEvidence: body.mediaEvidence ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/media", async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) { res.status(400).json({ error: "items must be an array" }); return; }
    const [updated] = await db.update(inspectionsTable)
      .set({ mediaEvidence: JSON.stringify(items), updatedAt: new Date() })
      .where(eq(inspectionsTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Inspection not found" }); return; }
    res.json({ mediaEvidence: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/approve", async (req, res) => {
  try {
    const [updated] = await db.update(inspectionsTable)
      .set({ status: "approved", approvedBy: req.body.approvedBy ?? "admin-001", updatedAt: new Date() })
      .where(eq(inspectionsTable.id, req.params.id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/reject", async (req, res) => {
  try {
    const [updated] = await db.update(inspectionsTable)
      .set({ status: "rejected", notes: req.body.notes, updatedAt: new Date() })
      .where(eq(inspectionsTable.id, req.params.id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
