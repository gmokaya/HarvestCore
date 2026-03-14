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

// ─────────────────────────────────────────────────────────────────────────────
// Kenya Agricultural Price Model — 3-Year Trend + Seasonal + Supply/Demand
// ─────────────────────────────────────────────────────────────────────────────

// 3-year compounded annual growth rates (Kenya market 2022-2025)
// Sources: KNBS, FAO GIEWS, KACE market data, East Africa Grain Council
const CAGR_3YR: Record<string, number> = {
  Maize:   0.092,  // Input cost inflation + erratic LR rainfall 2022-24
  Coffee:  0.118,  // Global demand surge; Brazil supply disruption; Kenya AA premium
  Wheat:   0.134,  // 2022 Ukraine shock still embedded; import parity pricing
  Rice:    0.078,  // Import-linked; gradual USD/KES depreciation passthrough
  Sorghum: 0.055,  // Regional brewery demand growth (Tusker Lite, Chibuku)
  Beans:   0.124,  // Protein demand rising; two consecutive poor short rains
  Tea:     0.068,  // Mombasa auction volumes up; UK & Pakistan demand stable
  Cotton:  -0.028, // Synthetic fibre substitution; ginning capacity underused
  Sesame:  0.145,  // Asian export demand (China, Japan); acreage expanding
  Millet:  0.048,  // Local food security demand; climate-resilient crop uptake
};

// Per-commodity seasonal index by calendar month (1-12)
// Index > 1 = price above annual average (lean season / demand surge)
// Index < 1 = price below annual average (harvest flush / supply surplus)
// Based on Kenya's two agricultural seasons:
//   Long Rains (LR): planting Mar-Apr, harvest Jul-Aug
//   Short Rains (SR): planting Oct-Nov, harvest Dec-Jan
const SEASONAL_INDEX: Record<string, number[]> = {
  //          Jan    Feb    Mar    Apr    May    Jun    Jul    Aug    Sep    Oct    Nov    Dec
  Maize:   [0.93,  0.96,  1.02,  1.08,  1.13,  1.11,  0.97,  0.89,  0.92,  1.06,  1.09,  0.96],
  Coffee:  [1.04,  1.06,  1.02,  0.98,  0.95,  0.97,  1.05,  1.08,  1.07,  0.96,  0.91,  0.93],
  Wheat:   [1.06,  1.09,  1.11,  1.08,  1.04,  0.98,  0.88,  0.87,  0.92,  0.97,  1.01,  1.05],
  Rice:    [0.98,  0.99,  1.01,  1.02,  1.04,  1.05,  1.02,  0.99,  0.97,  0.96,  0.98,  0.99],
  Sorghum: [1.04,  1.06,  1.07,  1.05,  1.02,  0.99,  0.97,  0.94,  0.91,  0.88,  0.92,  1.00],
  Beans:   [0.91,  0.95,  1.04,  1.10,  1.14,  1.12,  1.00,  0.88,  0.90,  1.07,  1.10,  0.93],
  Tea:     [0.97,  0.95,  0.93,  0.92,  0.96,  1.01,  1.05,  1.07,  1.06,  1.03,  0.99,  0.98],
  Cotton:  [1.02,  1.04,  1.05,  1.03,  1.01,  0.99,  0.94,  0.90,  0.91,  0.96,  1.00,  1.03],
  Sesame:  [1.05,  1.07,  1.06,  1.04,  1.02,  0.99,  0.97,  0.95,  0.94,  0.92,  0.94,  1.00],
  Millet:  [1.03,  1.05,  1.06,  1.04,  1.01,  0.98,  0.96,  0.94,  0.93,  0.91,  0.95,  1.00],
};

// Supply pressure: months after harvest flush (excess supply dampens price)
// Demand drivers: key demand events driving price spikes per commodity
const SUPPLY_DEMAND_NOTES: Record<string, Record<number, string>> = {
  Maize:   { 5: "Pre-harvest lean season peak", 8: "LR harvest flush — highest supply", 11: "Pre-SR lean season" },
  Coffee:  { 7: "Low supply period — export premium peak", 10: "Main crop harvest begins — FCS intake" },
  Wheat:   { 3: "Import parity peak — low domestic stock", 7: "Domestic harvest — price dips" },
  Beans:   { 5: "Pre-LR harvest scarcity", 8: "LR harvest flush", 11: "Pre-SR scarcity" },
  Sorghum: { 6: "Pre-harvest peak", 10: "Post-harvest surplus" },
  Tea:     { 4: "Long rains — quality drop (lower prices)", 8: "Peak export auction season" },
  Rice:    { 6: "Mid-year demand (school season)", 9: "Off-season — import stocks drawn down" },
  Sesame:  { 9: "Pre-harvest scarcity — export demand peak", 11: "Post-harvest flush" },
  Cotton:  { 9: "Post-harvest, ginneries active", 4: "Pre-season planting demand" },
  Millet:  { 8: "Pre-harvest lean season", 11: "Post-harvest surplus" },
};

// Price volatility (annualised σ) per commodity — higher = wider confidence band
const VOLATILITY: Record<string, number> = {
  Maize: 0.18, Coffee: 0.22, Wheat: 0.25, Rice: 0.12, Sorghum: 0.14,
  Beans: 0.20, Tea: 0.13, Cotton: 0.16, Sesame: 0.19, Millet: 0.13,
};

// Simulated 36-month spot price trajectory (most recent 3 prices) for trend signal
// Format: [price 24mo ago, price 12mo ago, current price] — all KES/kg
const PRICE_HISTORY: Record<string, [number, number, number]> = {
  Maize:   [28.5,  33.2,  38.5],
  Coffee:  [440,   545,   620],
  Wheat:   [29,    37,    42],
  Rice:    [43,    50,    55],
  Sorghum: [30,    32.5,  35],
  Beans:   [63,    78,    90],
  Tea:     [244,   264,   280],
  Cotton:  [102,   98,    95],
  Sesame:  [90,    106,   120],
  Millet:  [33,    35.5,  38],
};

router.get("/meta/ai-price", async (req, res) => {
  const { commodity, unit, deliveryDate } = req.query as Record<string, string>;
  const c = commodity && MARKET_PRICES[commodity] ? commodity : "Maize";
  const base = MARKET_PRICES[c];

  const today = new Date();
  const delivery = deliveryDate ? new Date(deliveryDate) : null;
  const daysAhead = delivery
    ? Math.max(0, Math.round((delivery.getTime() - today.getTime()) / 86400000))
    : 0;

  // ── 1. Trend component — 3-year CAGR projection ──────────────────────────
  const cagr = CAGR_3YR[c] ?? 0.08;
  const trendPrice = base * Math.pow(1 + cagr, daysAhead / 365);

  // ── 2. Seasonal component — per-commodity Kenya calendar ─────────────────
  const deliveryMonth = delivery ? delivery.getMonth() + 1 : today.getMonth() + 1;
  const seasonalIdx = (SEASONAL_INDEX[c] ?? Array(12).fill(1))[deliveryMonth - 1];
  const seasonalPrice = trendPrice * seasonalIdx;

  // ── 3. Momentum signal — direction from 3-year history ───────────────────
  const [p24, p12, p0] = PRICE_HISTORY[c] ?? [base, base, base];
  const momentum1yr = (p0 - p12) / p12;   // last 12 months
  const momentum2yr = (p12 - p24) / p24;  // prior 12 months
  // Weighted momentum: recent year counts more
  const momentumSignal = (momentum1yr * 0.65 + momentum2yr * 0.35);
  // Apply a dampened momentum boost over the forecast horizon
  const momentumBoost = 1 + (momentumSignal * Math.min(daysAhead / 365, 1) * 0.35);
  const momentumPrice = seasonalPrice * momentumBoost;

  // ── 4. Unit conversion ────────────────────────────────────────────────────
  const multiplier = unit === "ton" ? 1000 : unit === "bag" ? 90 : 1;
  const forecastedUnitPrice = momentumPrice * multiplier;
  const spotUnitPrice = base * multiplier;

  // ── 5. Confidence — decays with time + commodity volatility ──────────────
  const sigma = VOLATILITY[c] ?? 0.18;
  const timePenalty = daysAhead / 365 * sigma * 100;
  const confidence = Math.max(48, Math.round(92 - timePenalty));

  // ── 6. Price change breakdown ─────────────────────────────────────────────
  const changePct = ((forecastedUnitPrice - spotUnitPrice) / spotUnitPrice) * 100;
  const trendContrib  = ((trendPrice - base) / base) * 100;
  const seasonContrib = (seasonalIdx - 1) * 100;
  const momentumContrib = (momentumBoost - 1) * 100;

  // ── 7. Supply/demand note for delivery month ──────────────────────────────
  const sdNotes = SUPPLY_DEMAND_NOTES[c] ?? {};
  const marketNote = sdNotes[deliveryMonth] ?? null;

  // ── 8. Trend label ────────────────────────────────────────────────────────
  const trendLabel = cagr >= 0.10 ? "Strong uptrend" : cagr >= 0.05 ? "Moderate uptrend"
    : cagr >= 0 ? "Stable" : "Declining trend";

  res.json({
    aiSuggestedPrice: Math.round(forecastedUnitPrice * 100) / 100,
    currentSpotPrice: Math.round(spotUnitPrice * 100) / 100,
    commodity: c,
    unit: unit ?? "kg",
    daysAhead,
    deliveryDate: deliveryDate ?? null,
    changePct: Math.round(changePct * 10) / 10,
    confidence,
    method: daysAhead > 0 ? "forward_projection" : "spot",
    // Breakdown for transparency
    breakdown: {
      trendContrib:    Math.round(trendContrib * 10) / 10,
      seasonContrib:   Math.round(seasonContrib * 10) / 10,
      momentumContrib: Math.round(momentumContrib * 10) / 10,
      cagr3yr:         Math.round(cagr * 1000) / 10,
      seasonalIndex:   Math.round(seasonalIdx * 1000) / 1000,
      trendLabel,
      marketNote,
      priceHistory: { p24mo: p24 * multiplier, p12mo: p12 * multiplier, current: base * multiplier },
    },
  });
});

export default router;
