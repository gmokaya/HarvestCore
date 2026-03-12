import { Router } from "express";
import { db } from "@workspace/db";
import { intakesTable, warehousesTable, usersTable, activityLogTable } from "@workspace/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

const router = Router();

const REGISTRY_BASE = "WRSC-KE";
const generateRegistryId = (intakeId: string) =>
  `${REGISTRY_BASE}-${new Date().getFullYear()}-${intakeId.split("-")[1]?.toUpperCase() ?? Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const buildEwrsPayload = (intake: any, farmer: any, warehouse: any) => ({
  receiptId: intake.ewrsRegistryId ?? null,
  commodity: intake.commodity,
  variety: intake.variety ?? null,
  weightKg: Number(intake.weightKg),
  grade: intake.grade,
  moisturePercent: Number(intake.moisturePercent),
  grnNumber: intake.grnNumber,
  iotaHash: intake.iotaHash,
  warehouseName: warehouse?.name,
  warehouseLocation: warehouse?.location,
  farmerName: farmer?.name,
  farmerId: intake.farmerId,
  intakeDate: intake.createdAt,
  anchoredAt: intake.updatedAt,
  submittedAt: new Date().toISOString(),
  source: "TokenHarvest",
  version: "1.0",
});

const getRelations = async (intake: any) => {
  const [farmer] = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, intake.farmerId)).limit(1);
  const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name, location: warehousesTable.location })
    .from(warehousesTable).where(eq(warehousesTable.id, intake.warehouseId)).limit(1);
  return { farmer, warehouse };
};

router.get("/stats", async (_req, res) => {
  try {
    const [total, submitted, verified, pending, errors] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(intakesTable).where(eq(intakesTable.status, "anchored")),
      db.select({ count: sql<number>`count(*)` }).from(intakesTable).where(eq(intakesTable.ewrsStatus, "verified")),
      db.select({ count: sql<number>`count(*)` }).from(intakesTable).where(eq(intakesTable.ewrsStatus, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(intakesTable).where(eq(intakesTable.ewrsStatus, "not_submitted")),
      db.select({ count: sql<number>`count(*)` }).from(intakesTable).where(eq(intakesTable.ewrsStatus, "sync_error")),
    ]);
    res.json({
      eligibleForSubmission: Number(total[0].count),
      verified: Number(verified[0].count),
      pending: Number(pending[0].count),
      notSubmitted: Number(pending[0].count),
      syncErrors: Number(errors[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/queue", async (_req, res) => {
  try {
    const intakes = await db.select().from(intakesTable)
      .where(eq(intakesTable.status, "anchored"))
      .orderBy(intakesTable.updatedAt);

    const enriched = await Promise.all(intakes.map(async (intake) => {
      const { farmer, warehouse } = await getRelations(intake);
      return {
        ...intake,
        weightKg: Number(intake.weightKg),
        moisturePercent: Number(intake.moisturePercent),
        farmerName: farmer?.name ?? "Unknown",
        warehouseName: warehouse?.name ?? "Unknown",
      };
    }));

    res.json({ intakes: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/submit/:intakeId", async (req, res) => {
  try {
    const [intake] = await db.select().from(intakesTable)
      .where(eq(intakesTable.id, req.params.intakeId)).limit(1);

    if (!intake) { res.status(404).json({ error: "Intake not found" }); return; }
    if (intake.status !== "anchored") {
      res.status(400).json({ error: "Only IOTA-anchored intakes can be submitted to the registry" }); return;
    }
    if (intake.ewrsStatus === "verified") {
      res.status(400).json({ error: "Already verified by registry" }); return;
    }

    const { farmer, warehouse } = await getRelations(intake);
    const registryId = intake.ewrsRegistryId ?? generateRegistryId(intake.id);
    const payload = buildEwrsPayload({ ...intake, ewrsRegistryId: registryId }, farmer, warehouse);

    await db.update(intakesTable)
      .set({
        ewrsStatus: "pending",
        ewrsRegistryId: registryId,
        ewrsSubmittedAt: new Date(),
        ewrsPayload: JSON.stringify(payload),
        updatedAt: new Date(),
      })
      .where(eq(intakesTable.id, req.params.intakeId));

    await db.insert(activityLogTable).values({
      type: "ewrs_submitted",
      description: `Receipt ${registryId} submitted to WRSC registry`,
      actorName: "System",
      entityId: req.params.intakeId,
    });

    setTimeout(async () => {
      const shouldVerify = Math.random() > 0.15;
      await db.update(intakesTable)
        .set({
          ewrsStatus: shouldVerify ? "verified" : "sync_error",
          ewrsSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(intakesTable.id, req.params.intakeId));

      await db.insert(activityLogTable).values({
        type: shouldVerify ? "ewrs_verified" : "ewrs_error",
        description: shouldVerify
          ? `Registry verified receipt ${registryId}`
          : `Registry validation failed for ${registryId} — manual review required`,
        actorName: "WRSC Registry",
        entityId: req.params.intakeId,
      });
    }, 3000);

    res.json({
      registryId,
      status: "pending",
      message: "Submitted to WRSC registry. Verification typically completes within 3–5 seconds.",
      payload,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sync/:intakeId", async (req, res) => {
  try {
    const [intake] = await db.select().from(intakesTable)
      .where(eq(intakesTable.id, req.params.intakeId)).limit(1);

    if (!intake) { res.status(404).json({ error: "Intake not found" }); return; }
    if (!intake.ewrsRegistryId) {
      res.status(400).json({ error: "Not yet submitted to registry" }); return;
    }

    const simulatedStatus = intake.ewrsStatus === "pending"
      ? (Math.random() > 0.2 ? "verified" : "sync_error")
      : intake.ewrsStatus;

    await db.update(intakesTable)
      .set({ ewrsStatus: simulatedStatus as any, ewrsSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(intakesTable.id, req.params.intakeId));

    res.json({
      registryId: intake.ewrsRegistryId,
      status: simulatedStatus,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/status/:registryId", async (req, res) => {
  try {
    const [intake] = await db.select().from(intakesTable)
      .where(eq(intakesTable.ewrsRegistryId, req.params.registryId)).limit(1);

    if (!intake) {
      res.status(404).json({ error: "No record found with that registry ID" }); return;
    }

    res.json({
      registryId: intake.ewrsRegistryId,
      ewrsStatus: intake.ewrsStatus,
      submittedAt: intake.ewrsSubmittedAt,
      syncedAt: intake.ewrsSyncedAt,
      intakeId: intake.id,
      commodity: intake.commodity,
      grnNumber: intake.grnNumber,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/pull", async (_req, res) => {
  try {
    const externalRecords = [
      {
        externalId: `WRSC-KE-EXT-${Date.now()}-A`,
        commodity: "Maize",
        variety: "White Maize",
        weightKg: 3200,
        grade: "A",
        moisturePercent: 12.8,
        grnNumber: `GRN-EXT-${Date.now().toString().slice(-4)}`,
        warehouseName: "Nairobi Central Warehouse",
        farmerName: "External Operator",
        registrationDate: new Date(Date.now() - 86400000).toISOString(),
        source: "WRSC External Feed",
        status: "verified",
      },
      {
        externalId: `WRSC-KE-EXT-${Date.now()}-B`,
        commodity: "Beans",
        variety: "Red Kidney",
        weightKg: 750,
        grade: "B",
        moisturePercent: 13.5,
        grnNumber: `GRN-EXT-${(Date.now() + 1).toString().slice(-4)}`,
        warehouseName: "Eldoret Highlands Store",
        farmerName: "Kipchoge Farms",
        registrationDate: new Date(Date.now() - 172800000).toISOString(),
        source: "WRSC External Feed",
        status: "verified",
      },
    ];

    await db.insert(activityLogTable).values({
      type: "ewrs_pull",
      description: `Pulled ${externalRecords.length} verified receipts from WRSC registry`,
      actorName: "System",
    });

    res.json({
      pulled: externalRecords.length,
      records: externalRecords,
      pulledAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/submit-batch", async (req, res) => {
  try {
    const { intakeIds } = req.body as { intakeIds: string[] };
    if (!Array.isArray(intakeIds) || intakeIds.length === 0) {
      res.status(400).json({ error: "intakeIds array is required" }); return;
    }

    const intakes = await db.select().from(intakesTable)
      .where(and(
        inArray(intakesTable.id, intakeIds),
        eq(intakesTable.status, "anchored"),
      ));

    const results = await Promise.all(intakes.map(async (intake) => {
      const { farmer, warehouse } = await getRelations(intake);
      const registryId = intake.ewrsRegistryId ?? generateRegistryId(intake.id);
      const payload = buildEwrsPayload({ ...intake, ewrsRegistryId: registryId }, farmer, warehouse);

      await db.update(intakesTable)
        .set({
          ewrsStatus: "pending",
          ewrsRegistryId: registryId,
          ewrsSubmittedAt: new Date(),
          ewrsPayload: JSON.stringify(payload),
          updatedAt: new Date(),
        })
        .where(eq(intakesTable.id, intake.id));

      return { intakeId: intake.id, registryId, status: "pending" };
    }));

    setTimeout(async () => {
      for (const r of results) {
        const shouldVerify = Math.random() > 0.1;
        await db.update(intakesTable)
          .set({ ewrsStatus: shouldVerify ? "verified" : "sync_error", ewrsSyncedAt: new Date(), updatedAt: new Date() })
          .where(eq(intakesTable.id, r.intakeId));
      }
    }, 4000);

    res.json({ submitted: results.length, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
