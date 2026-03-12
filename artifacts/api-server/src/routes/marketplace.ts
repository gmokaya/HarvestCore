import { Router } from "express";
import { db } from "@workspace/db";
import { listingsTable, bidsTable, financingRequestsTable, tokensTable, usersTable, activityLogTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { CreateListingBody, PlaceBidBody } from "@workspace/api-zod";

const router = Router();

const COMMODITY_PRICES = [
  { commodity: "Maize", pricePerKg: 38.5, change24h: 0.8, changePercent24h: 2.12, volume24h: 142000 },
  { commodity: "Coffee", pricePerKg: 620, change24h: -12, changePercent24h: -1.9, volume24h: 28000 },
  { commodity: "Wheat", pricePerKg: 42, change24h: 1.2, changePercent24h: 2.94, volume24h: 95000 },
  { commodity: "Rice", pricePerKg: 55, change24h: -0.5, changePercent24h: -0.9, volume24h: 67000 },
  { commodity: "Sorghum", pricePerKg: 35, change24h: 0.3, changePercent24h: 0.87, volume24h: 43000 },
  { commodity: "Beans", pricePerKg: 90, change24h: 2.1, changePercent24h: 2.39, volume24h: 31000 },
];

router.get("/listings", async (req, res) => {
  try {
    const { commodity, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (status) conditions.push(eq(listingsTable.status, status as any));

    const [listings, countResult] = await Promise.all([
      db.select().from(listingsTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
        .orderBy(listingsTable.createdAt)
        .limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(listingsTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
    ]);

    const sellers = await Promise.all(listings.map(l =>
      db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, l.sellerId)).limit(1).then(r => r[0])
    ));
    const bidCounts = await Promise.all(listings.map(l =>
      db.select({ count: sql<number>`count(*)` }).from(bidsTable).where(eq(bidsTable.listingId, l.id)).then(r => Number(r[0]?.count ?? 0))
    ));

    const formatted = listings.map((l, i) => ({
      ...l,
      weightKg: Number(l.weightKg),
      askingPrice: Number(l.askingPrice),
      currentBidPrice: l.currentBidPrice ? Number(l.currentBidPrice) : null,
      sellerName: sellers[i]?.name ?? "Unknown",
      bidsCount: bidCounts[i],
    }));

    res.json({ listings: formatted, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/listings", async (req, res) => {
  try {
    const body = CreateListingBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [token] = await db.select().from(tokensTable).where(eq(tokensTable.id, body.data.tokenId)).limit(1);
    if (!token || token.tokenState !== "free") { res.status(400).json({ error: "Token not available for listing" }); return; }

    const expiresAt = body.data.expiresInDays ? new Date(Date.now() + body.data.expiresInDays * 86400000) : null;
    const [listing] = await db.insert(listingsTable).values({
      tokenId: body.data.tokenId,
      sellerId: token.ownerId,
      commodity: token.commodity,
      weightKg: token.weightKg,
      grade: token.grade,
      askingPrice: String(body.data.askingPrice),
      listingType: body.data.listingType,
      expiresAt,
    }).returning();

    const [seller] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, listing.sellerId)).limit(1);
    await db.insert(activityLogTable).values({
      type: "listing_created",
      description: `Listed ${token.commodity} ${token.weightKg}kg at KES ${body.data.askingPrice}`,
      actorName: seller?.name ?? "Seller",
      actorId: seller?.id,
      entityId: listing.id,
    });

    res.status(201).json({ ...listing, weightKg: Number(listing.weightKg), askingPrice: Number(listing.askingPrice), currentBidPrice: null, sellerName: seller?.name ?? "Unknown", bidsCount: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/listings/:listingId", async (req, res) => {
  try {
    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, req.params.listingId)).limit(1);
    if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
    const [seller] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, listing.sellerId)).limit(1);
    const [bidsCount] = await db.select({ count: sql<number>`count(*)` }).from(bidsTable).where(eq(bidsTable.listingId, listing.id));
    res.json({ ...listing, weightKg: Number(listing.weightKg), askingPrice: Number(listing.askingPrice), currentBidPrice: listing.currentBidPrice ? Number(listing.currentBidPrice) : null, sellerName: seller?.name ?? "Unknown", bidsCount: Number(bidsCount.count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/listings/:listingId/bids", async (req, res) => {
  try {
    const bids = await db.select().from(bidsTable).where(eq(bidsTable.listingId, req.params.listingId));
    const bidders = await Promise.all(bids.map(b =>
      db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, b.bidderId)).limit(1).then(r => r[0])
    ));
    const formatted = bids.map((b, i) => ({ ...b, amount: Number(b.amount), bidderName: bidders[i]?.name ?? "Unknown" }));
    res.json({ bids: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/listings/:listingId/bids", async (req, res) => {
  try {
    const body = PlaceBidBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, req.params.listingId)).limit(1);
    if (!listing || listing.status !== "active") { res.status(400).json({ error: "Listing not active" }); return; }

    const bidderId = (req.headers["x-user-id"] as string) ?? "unknown";
    const [bid] = await db.insert(bidsTable).values({
      listingId: req.params.listingId,
      bidderId,
      amount: String(body.data.amount),
    }).returning();

    await db.update(listingsTable).set({ currentBidPrice: String(body.data.amount), updatedAt: new Date() }).where(eq(listingsTable.id, req.params.listingId));

    const [bidder] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, bidderId)).limit(1);
    await db.insert(activityLogTable).values({
      type: "bid_placed",
      description: `Bid placed on listing ${req.params.listingId}: KES ${body.data.amount}`,
      actorName: bidder?.name ?? "Bidder",
      actorId: bidderId,
      entityId: bid.id,
    });

    res.status(201).json({ ...bid, amount: Number(bid.amount), bidderName: bidder?.name ?? "Unknown" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/financing-requests", async (req, res) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (status) conditions.push(eq(financingRequestsTable.status, status as any));

    const [requests, countResult] = await Promise.all([
      db.select().from(financingRequestsTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
        .limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(financingRequestsTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
    ]);

    const farmers = await Promise.all(requests.map(r =>
      db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.farmerId)).limit(1).then(f => f[0])
    ));

    const formatted = requests.map((r, i) => ({
      ...r,
      requestedAmount: Number(r.requestedAmount),
      maxInterestRate: Number(r.maxInterestRate),
      farmerName: farmers[i]?.name ?? "Unknown",
      offersCount: 0,
    }));
    res.json({ requests: formatted, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/prices", async (req, res) => {
  const withJitter = COMMODITY_PRICES.map(p => ({
    ...p,
    currency: "KES",
    lastUpdated: new Date().toISOString(),
  }));
  res.json({ prices: withJitter, updatedAt: new Date().toISOString() });
});

export default router;
