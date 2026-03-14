import { Router } from "express";
import { db } from "@workspace/db";
import {
  forwardContractsTable,
  forwardContractEventsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

const router = Router();

const COMMODITIES = ["Maize", "Coffee", "Wheat", "Rice", "Sorghum", "Beans", "Tea", "Cotton", "Sesame", "Millet"];
const MARKET_PRICES: Record<string, number> = {
  Maize: 38.5, Coffee: 620, Wheat: 42, Rice: 55, Sorghum: 35,
  Beans: 90, Tea: 280, Cotton: 95, Sesame: 120, Millet: 38,
};

function formatContract(c: any, seller: any, buyer: any) {
  return {
    ...c,
    quantity: Number(c.quantity),
    forwardPrice: Number(c.forwardPrice),
    totalValue: Number(c.totalValue),
    aiSuggestedPrice: c.aiSuggestedPrice ? Number(c.aiSuggestedPrice) : null,
    collateralValue: c.collateralValue ? Number(c.collateralValue) : null,
    moistureContent: c.moistureContent ? Number(c.moistureContent) : null,
    sellerName: seller?.name ?? "Unknown",
    buyerName: buyer?.name ?? null,
  };
}

router.get("/", async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    const conditions = status ? [eq(forwardContractsTable.status, status as any)] : [];

    const contracts = await db
      .select()
      .from(forwardContractsTable)
      .where(conditions.length ? and(...(conditions as any)) : undefined)
      .orderBy(desc(forwardContractsTable.createdAt));

    const sellers = await Promise.all(
      contracts.map((c) =>
        db.select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable).where(eq(usersTable.id, c.sellerId)).limit(1).then((r) => r[0])
      )
    );
    const buyers = await Promise.all(
      contracts.map((c) =>
        c.buyerId
          ? db.select({ id: usersTable.id, name: usersTable.name })
              .from(usersTable).where(eq(usersTable.id, c.buyerId)).limit(1).then((r) => r[0])
          : Promise.resolve(null)
      )
    );

    const [total, active, settled, value] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(forwardContractsTable).then((r) => Number(r[0].count)),
      db.select({ count: sql<number>`count(*)` }).from(forwardContractsTable).where(eq(forwardContractsTable.status, "active")).then((r) => Number(r[0].count)),
      db.select({ count: sql<number>`count(*)` }).from(forwardContractsTable).where(eq(forwardContractsTable.status, "settled")).then((r) => Number(r[0].count)),
      db.select({ sum: sql<string>`coalesce(sum(total_value),0)` }).from(forwardContractsTable).then((r) => Number(r[0].sum)),
    ]);

    res.json({
      contracts: contracts.map((c, i) => formatContract(c, sellers[i], buyers[i])),
      stats: { total, active, settled, totalValue: value },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const rows = await db.select().from(forwardContractsTable).where(eq(forwardContractsTable.id, req.params.id)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    const c = rows[0];
    const [seller] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, c.sellerId)).limit(1);
    const buyer = c.buyerId ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, c.buyerId)).limit(1).then((r) => r[0]) : null;
    const events = await db.select().from(forwardContractEventsTable).where(eq(forwardContractEventsTable.contractId, c.id)).orderBy(desc(forwardContractEventsTable.createdAt));
    res.json({ contract: formatContract(c, seller, buyer), events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { sellerId, commodity, quantity, forwardPrice, deliveryDate, deliveryLocation, deliveryMethod, paymentMethod, collateralType, unit, grade, warehouseReceiptId, partialDeliveryAllowed } = req.body;
    if (!sellerId || !commodity || !quantity || !forwardPrice || !deliveryDate || !deliveryLocation) {
      res.status(400).json({ error: "Missing required fields" }); return;
    }

    const qty = Number(quantity);
    const price = Number(forwardPrice);
    const totalValue = qty * price;
    const aiPrice = MARKET_PRICES[commodity] ? MARKET_PRICES[commodity] * (unit === "kg" ? 1 : 90) : null;

    const [contract] = await db.insert(forwardContractsTable).values({
      sellerId,
      commodity,
      quantity: String(qty),
      unit: unit ?? "kg",
      forwardPrice: String(price),
      totalValue: String(totalValue),
      aiSuggestedPrice: aiPrice ? String(aiPrice) : null,
      priceLockAt: new Date(),
      deliveryDate: new Date(deliveryDate),
      deliveryLocation,
      deliveryMethod: deliveryMethod ?? "warehouse_pickup",
      paymentMethod: paymentMethod ?? "pesalink",
      collateralType: collateralType ?? null,
      grade: grade ?? null,
      warehouseReceiptId: warehouseReceiptId ?? null,
      partialDeliveryAllowed: partialDeliveryAllowed ?? false,
      status: "open",
      createdById: "admin-001",
    }).returning();

    await db.insert(forwardContractEventsTable).values({
      contractId: contract.id,
      event: "contract_created",
      actor: "admin-001",
      notes: `Forward contract created for ${qty} ${unit ?? "kg"} of ${commodity} at KES ${price}/unit`,
    });

    res.status(201).json({ contract });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status, notes } = req.body;
    const allowed = ["draft", "open", "accepted", "active", "settled", "cancelled", "defaulted"];
    if (!allowed.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

    const extra: Record<string, any> = {};
    if (status === "settled") extra.settledAt = new Date();
    if (status === "accepted") extra.priceLockAt = new Date();

    const [updated] = await db.update(forwardContractsTable)
      .set({ status, ...extra, updatedAt: new Date() })
      .where(eq(forwardContractsTable.id, req.params.id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    await db.insert(forwardContractEventsTable).values({
      contractId: req.params.id,
      event: `status_changed_to_${status}`,
      actor: "admin-001",
      notes: notes ?? `Status updated to ${status}`,
    });

    res.json({ contract: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Monthly drift rates per commodity (annualised trend / 12)
const MONTHLY_DRIFT: Record<string, number> = {
  Maize:   0.021 / 12,
  Coffee:  0.054 / 12,
  Wheat:  -0.008 / 12,
  Rice:    0.012 / 12,
  Sorghum: 0.005 / 12,
  Beans:   0.032 / 12,
  Tea:     0.018 / 12,
  Cotton: -0.011 / 12,
  Sesame:  0.040 / 12,
  Millet:  0.009 / 12,
};

// Seasonal adjustment by month (harvest vs lean season)
const SEASONAL_FACTOR: Record<number, number> = {
  1: -0.02, 2: -0.01, 3:  0.01, 4:  0.02,
  5:  0.03, 6:  0.02, 7: -0.01, 8: -0.03,
  9: -0.04, 10: -0.02, 11: 0.01, 12: 0.02,
};

router.get("/meta/ai-price", async (req, res) => {
  const { commodity, unit, deliveryDate } = req.query as Record<string, string>;
  const base = MARKET_PRICES[commodity] ?? 40;

  // Days until delivery
  const today = new Date();
  const delivery = deliveryDate ? new Date(deliveryDate) : null;
  const daysAhead = delivery ? Math.max(0, Math.round((delivery.getTime() - today.getTime()) / 86400000)) : 0;
  const monthsAhead = daysAhead / 30.44;

  // Compounded forward price: base × (1 + monthly_drift)^months
  const drift = MONTHLY_DRIFT[commodity] ?? 0.01;
  let forecasted = base * Math.pow(1 + drift, monthsAhead);

  // Add seasonal adjustment for the delivery month
  if (delivery) {
    const deliveryMonth = delivery.getMonth() + 1;
    const seasonal = SEASONAL_FACTOR[deliveryMonth] ?? 0;
    forecasted = forecasted * (1 + seasonal);
  }

  // Unit conversion
  const unitPrice = unit === "ton" ? forecasted * 1000 : unit === "bag" ? forecasted * 90 : forecasted;
  const baseUnitPrice = unit === "ton" ? base * 1000 : unit === "bag" ? base * 90 : base;

  // Confidence decays with time: starts ~90%, loses ~1% per 10 days
  const confidence = Math.max(50, Math.round(90 - (daysAhead / 10)));

  // Price change vs today
  const changePct = ((unitPrice - baseUnitPrice) / baseUnitPrice) * 100;

  res.json({
    aiSuggestedPrice: Math.round(unitPrice * 100) / 100,
    currentSpotPrice: Math.round(baseUnitPrice * 100) / 100,
    commodity,
    unit: unit ?? "kg",
    daysAhead,
    deliveryDate: deliveryDate ?? null,
    changePct: Math.round(changePct * 10) / 10,
    confidence,
    method: daysAhead > 0 ? "forward_projection" : "spot",
  });
});

export default router;
