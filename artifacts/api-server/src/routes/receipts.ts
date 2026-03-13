import { Router } from "express";
import { db } from "@workspace/db";
import {
  warehouseReceiptsTable, dwrAuditLogTable,
  usersTable, warehousesTable, intakesTable, inspectionsTable,
} from "@workspace/db/schema";
import { eq, desc, sql, ne, and, isNull } from "drizzle-orm";

const router = Router();

async function writeAudit(
  receiptId: string,
  receiptNumber: string,
  action: string,
  opts: {
    fromOwnerId?: string; fromOwnerName?: string;
    toOwnerId?: string; toOwnerName?: string;
    performedBy?: string; metadata?: Record<string, unknown>; notes?: string;
  } = {}
) {
  await db.insert(dwrAuditLogTable).values({
    receiptId,
    receiptNumber,
    action,
    fromOwnerId: opts.fromOwnerId ?? null,
    fromOwnerName: opts.fromOwnerName ?? null,
    toOwnerId: opts.toOwnerId ?? null,
    toOwnerName: opts.toOwnerName ?? null,
    performedBy: opts.performedBy ?? "admin",
    metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
    notes: opts.notes ?? null,
  });
}

const formatReceipt = (row: any, owner: any, warehouse: any) => ({
  ...row,
  quantityKg: Number(row.quantityKg),
  ownerName: owner?.name ?? "Unknown",
  warehouseName: warehouse?.name ?? "Unknown",
});

router.get("/", async (_req, res) => {
  try {
    const receipts = await db.select().from(warehouseReceiptsTable).orderBy(desc(warehouseReceiptsTable.dateIssued));

    const [owners, warehouses] = await Promise.all([
      Promise.all(receipts.map(r =>
        db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.ownerId)).limit(1).then(x => x[0])
      )),
      Promise.all(receipts.map(r =>
        db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, r.warehouseId)).limit(1).then(x => x[0])
      )),
    ]);

    const stats = await db.select({ status: warehouseReceiptsTable.status, count: sql<number>`count(*)` })
      .from(warehouseReceiptsTable).groupBy(warehouseReceiptsTable.status);

    const totalKg = await db.select({ total: sql<number>`sum(quantity_kg)` }).from(warehouseReceiptsTable);

    res.json({
      receipts: receipts.map((r, idx) => formatReceipt(r, owners[idx], warehouses[idx])),
      stats: {
        total: receipts.length,
        active: Number(stats.find(s => s.status === "active")?.count ?? 0),
        collateralLocked: Number(stats.find(s => s.status === "collateral_locked")?.count ?? 0),
        underTrade: Number(stats.find(s => s.status === "under_trade")?.count ?? 0),
        settled: Number(stats.find(s => s.status === "settled")?.count ?? 0),
        expired: Number(stats.find(s => s.status === "expired")?.count ?? 0),
        totalKg: Number(totalKg[0]?.total ?? 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/eligible-inspections", async (_req, res) => {
  try {
    const approved = await db
      .select({
        id: inspectionsTable.id,
        inspectionNumber: inspectionsTable.inspectionNumber,
        commodity: inspectionsTable.commodity,
        commodityVariety: inspectionsTable.commodityVariety,
        grade: inspectionsTable.grade,
        netWeightKg: inspectionsTable.netWeightKg,
        packagingType: inspectionsTable.packagingType,
        warehouseId: inspectionsTable.warehouseId,
        inspectedAt: inspectionsTable.inspectedAt,
      })
      .from(inspectionsTable)
      .where(
        and(
          eq(inspectionsTable.status, "approved"),
          isNull(inspectionsTable.id)
        )
      )
      .orderBy(desc(inspectionsTable.inspectedAt));

    const allApproved = await db
      .select({
        id: inspectionsTable.id,
        inspectionNumber: inspectionsTable.inspectionNumber,
        commodity: inspectionsTable.commodity,
        commodityVariety: inspectionsTable.commodityVariety,
        grade: inspectionsTable.grade,
        netWeightKg: inspectionsTable.netWeightKg,
        packagingType: inspectionsTable.packagingType,
        warehouseId: inspectionsTable.warehouseId,
        inspectedAt: inspectionsTable.inspectedAt,
      })
      .from(inspectionsTable)
      .where(eq(inspectionsTable.status, "approved"))
      .orderBy(desc(inspectionsTable.inspectedAt));

    const linkedIds = await db
      .select({ inspectionId: warehouseReceiptsTable.inspectionId })
      .from(warehouseReceiptsTable)
      .where(ne(warehouseReceiptsTable.status, "cancelled"));

    const linkedSet = new Set(linkedIds.map(l => l.inspectionId).filter(Boolean));

    const warehouses = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable);
    const warehouseMap = Object.fromEntries(warehouses.map(w => [w.id, w.name]));

    const eligible = allApproved
      .filter(i => !linkedSet.has(i.id))
      .map(i => ({ ...i, warehouseName: warehouseMap[i.warehouseId ?? ""] ?? "Unknown" }));

    res.json({ inspections: eligible });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/reports", async (_req, res) => {
  try {
    const receipts = await db.select().from(warehouseReceiptsTable);

    const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

    const warehouses = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable);
    const warehouseMap = Object.fromEntries(warehouses.map(w => [w.id, w.name]));

    const byCommodity: Record<string, { count: number; totalKg: number; locked: number }> = {};
    const byOwner: Record<string, { name: string; count: number; totalKg: number; locked: number; active: number }> = {};
    const byWarehouse: Record<string, { name: string; count: number; totalKg: number }> = {};

    for (const r of receipts) {
      const qty = Number(r.quantityKg);
      const commodity = r.commodity;
      if (!byCommodity[commodity]) byCommodity[commodity] = { count: 0, totalKg: 0, locked: 0 };
      byCommodity[commodity].count++;
      byCommodity[commodity].totalKg += qty;
      if (r.status === "collateral_locked") byCommodity[commodity].locked++;

      const ownerName = userMap[r.ownerId] ?? "Unknown";
      if (!byOwner[r.ownerId]) byOwner[r.ownerId] = { name: ownerName, count: 0, totalKg: 0, locked: 0, active: 0 };
      byOwner[r.ownerId].count++;
      byOwner[r.ownerId].totalKg += qty;
      if (r.status === "collateral_locked") byOwner[r.ownerId].locked++;
      if (r.status === "active") byOwner[r.ownerId].active++;

      const whName = warehouseMap[r.warehouseId] ?? "Unknown";
      if (!byWarehouse[r.warehouseId]) byWarehouse[r.warehouseId] = { name: whName, count: 0, totalKg: 0 };
      byWarehouse[r.warehouseId].count++;
      byWarehouse[r.warehouseId].totalKg += qty;
    }

    res.json({
      byCommodity: Object.entries(byCommodity).map(([commodity, d]) => ({ commodity, ...d })).sort((a, b) => b.totalKg - a.totalKg),
      byOwner: Object.entries(byOwner).map(([ownerId, d]) => ({ ownerId, ...d })).sort((a, b) => b.count - a.count),
      byWarehouse: Object.entries(byWarehouse).map(([warehouseId, d]) => ({ warehouseId, ...d })).sort((a, b) => b.totalKg - a.totalKg),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/audit", async (_req, res) => {
  try {
    const logs = await db.select().from(dwrAuditLogTable).orderBy(desc(dwrAuditLogTable.createdAt)).limit(200);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/audit", async (req, res) => {
  try {
    const logs = await db.select().from(dwrAuditLogTable)
      .where(eq(dwrAuditLogTable.receiptId, req.params.id))
      .orderBy(desc(dwrAuditLogTable.createdAt));
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [receipt] = await db.select().from(warehouseReceiptsTable).where(eq(warehouseReceiptsTable.id, req.params.id)).limit(1);
    if (!receipt) return res.status(404).json({ error: "Not found" });

    const [owner] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, receipt.ownerId)).limit(1);
    const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, receipt.warehouseId)).limit(1);

    res.json(formatReceipt(receipt, owner, warehouse));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const count = await db.select({ count: sql<number>`count(*)` }).from(warehouseReceiptsTable);
    const next = Number(count[0].count) + 1;
    const receiptNumber = `WR-${new Date().getFullYear()}-${String(next).padStart(4, "0")}`;

    const [receipt] = await db.insert(warehouseReceiptsTable).values({
      ...req.body,
      receiptNumber,
      warehouseOperatorSignature: `SIG-WH-${Date.now()}`,
      inspectionAuthoritySignature: `SIG-INS-${Date.now()}`,
      registrySignature: `SIG-REG-${Date.now()}`,
    }).returning();

    const [owner] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, receipt.ownerId)).limit(1);

    await writeAudit(receipt.id, receiptNumber, "issued", {
      toOwnerId: receipt.ownerId,
      toOwnerName: owner?.name,
      performedBy: "admin",
      metadata: { commodity: receipt.commodity, quantityKg: Number(receipt.quantityKg), grade: receipt.grade },
      notes: `DWR issued for ${receipt.commodity} (${Number(receipt.quantityKg).toLocaleString()} kg)`,
    });

    res.status(201).json(receipt);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const [current] = await db.select().from(warehouseReceiptsTable).where(eq(warehouseReceiptsTable.id, req.params.id)).limit(1);
    if (!current) return res.status(404).json({ error: "Not found" });

    const [updated] = await db.update(warehouseReceiptsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(warehouseReceiptsTable.id, req.params.id)).returning();

    await writeAudit(current.id, current.receiptNumber, status === "active" ? "activated" : status, {
      performedBy: "admin",
      notes: `Status changed from ${current.status} to ${status}`,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/lock-collateral", async (req, res) => {
  try {
    const [current] = await db.select().from(warehouseReceiptsTable).where(eq(warehouseReceiptsTable.id, req.params.id)).limit(1);
    if (!current) return res.status(404).json({ error: "Not found" });

    const [updated] = await db.update(warehouseReceiptsTable)
      .set({ status: "collateral_locked", updatedAt: new Date() })
      .where(eq(warehouseReceiptsTable.id, req.params.id)).returning();

    await writeAudit(current.id, current.receiptNumber, "locked", {
      performedBy: "admin",
      notes: "Receipt locked as loan collateral",
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/tokenize", async (req, res) => {
  try {
    const [current] = await db.select().from(warehouseReceiptsTable).where(eq(warehouseReceiptsTable.id, req.params.id)).limit(1);
    if (!current) return res.status(404).json({ error: "Not found" });

    const tokenId = `TH-WR-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const [updated] = await db.update(warehouseReceiptsTable)
      .set({ tokenId, updatedAt: new Date() })
      .where(eq(warehouseReceiptsTable.id, req.params.id)).returning();

    await writeAudit(current.id, current.receiptNumber, "tokenized", {
      performedBy: "admin",
      metadata: { tokenId },
      notes: `Receipt tokenized — Token ID: ${tokenId}`,
    });

    res.json({ ...updated, tokenId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/transfer", async (req, res) => {
  try {
    const { newOwnerId, notes } = req.body;
    if (!newOwnerId) return res.status(400).json({ error: "newOwnerId is required" });

    const [current] = await db.select().from(warehouseReceiptsTable).where(eq(warehouseReceiptsTable.id, req.params.id)).limit(1);
    if (!current) return res.status(404).json({ error: "Not found" });
    if (current.status !== "active") return res.status(400).json({ error: "Only active receipts can be transferred" });

    const [fromOwner] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, current.ownerId)).limit(1);
    const [toOwner] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, newOwnerId)).limit(1);
    if (!toOwner) return res.status(400).json({ error: "New owner not found" });

    const [updated] = await db.update(warehouseReceiptsTable)
      .set({ ownerId: newOwnerId, status: "under_trade", updatedAt: new Date() })
      .where(eq(warehouseReceiptsTable.id, req.params.id)).returning();

    await writeAudit(current.id, current.receiptNumber, "transferred", {
      fromOwnerId: current.ownerId,
      fromOwnerName: fromOwner?.name,
      toOwnerId: newOwnerId,
      toOwnerName: toOwner.name,
      performedBy: "admin",
      notes: notes ?? `Ownership transferred from ${fromOwner?.name} to ${toOwner.name}`,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
