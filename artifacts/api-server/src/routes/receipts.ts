import { Router } from "express";
import { db } from "@workspace/db";
import {
  warehouseReceiptsTable, usersTable, warehousesTable, intakesTable, inspectionsTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

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

    res.status(201).json(receipt);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const [updated] = await db.update(warehouseReceiptsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(warehouseReceiptsTable.id, req.params.id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/lock-collateral", async (req, res) => {
  try {
    const [updated] = await db.update(warehouseReceiptsTable)
      .set({ status: "collateral_locked", updatedAt: new Date() })
      .where(eq(warehouseReceiptsTable.id, req.params.id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/tokenize", async (req, res) => {
  try {
    const tokenId = `TH-WR-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const [updated] = await db.update(warehouseReceiptsTable)
      .set({ tokenId, updatedAt: new Date() })
      .where(eq(warehouseReceiptsTable.id, req.params.id)).returning();
    res.json({ ...updated, tokenId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
