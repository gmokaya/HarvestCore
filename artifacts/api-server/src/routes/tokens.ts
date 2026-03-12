import { Router } from "express";
import { db } from "@workspace/db";
import { tokensTable, usersTable, warehousesTable, intakesTable, activityLogTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

const formatToken = (token: any, owner: any, warehouse: any) => ({
  ...token,
  weightKg: Number(token.weightKg),
  fairMarketValue: token.fairMarketValue ? Number(token.fairMarketValue) : null,
  ownerName: owner?.name ?? "Unknown",
  warehouseName: warehouse?.name ?? "Unknown",
});

router.get("/", async (req, res) => {
  try {
    const { status, ownerId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (status) conditions.push(eq(tokensTable.tokenState, status as any));
    if (ownerId) conditions.push(eq(tokensTable.ownerId, ownerId));

    const [tokens, countResult] = await Promise.all([
      db.select().from(tokensTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
        .orderBy(tokensTable.createdAt)
        .limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(tokensTable)
        .where(conditions.length ? and(...conditions as any) : undefined)
    ]);

    const owners = await Promise.all(tokens.map(t =>
      db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, t.ownerId)).limit(1).then(r => r[0])
    ));
    const warehouses = await Promise.all(tokens.map(t =>
      db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, t.warehouseId)).limit(1).then(r => r[0])
    ));

    const formatted = tokens.map((t, idx) => formatToken(t, owners[idx], warehouses[idx]));
    res.json({ tokens: formatted, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:tokenId", async (req, res) => {
  try {
    const [token] = await db.select().from(tokensTable).where(eq(tokensTable.id, req.params.tokenId)).limit(1);
    if (!token) { res.status(404).json({ error: "Token not found" }); return; }
    const [owner] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, token.ownerId)).limit(1);
    const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, token.warehouseId)).limit(1);
    res.json(formatToken(token, owner, warehouse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:tokenId/mint", async (req, res) => {
  try {
    const mockNftId = Math.floor(Math.random() * 10000).toString();
    const mockTxHash = `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`;
    const [token] = await db.update(tokensTable)
      .set({
        nftTokenId: mockNftId,
        contractAddress: "0xTokenHarvestReceiptBSC",
        txHash: mockTxHash,
        metadataUri: `ipfs://QmHarvestCore/${mockNftId}`,
        mintedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tokensTable.id, req.params.tokenId))
      .returning();
    if (!token) { res.status(404).json({ error: "Token not found" }); return; }

    await db.insert(activityLogTable).values({
      type: "token_minted",
      description: `Token ${token.id} minted on BSC (NFT #${mockNftId})`,
      actorName: "System",
      entityId: token.id,
    });

    const [owner] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, token.ownerId)).limit(1);
    const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, token.warehouseId)).limit(1);
    res.json(formatToken(token, owner, warehouse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:tokenId/transfer", async (req, res) => {
  try {
    const { toUserId } = req.body;
    const [existing] = await db.select().from(tokensTable).where(eq(tokensTable.id, req.params.tokenId)).limit(1);
    if (!existing) { res.status(404).json({ error: "Token not found" }); return; }
    if (existing.tokenState !== "free") { res.status(400).json({ error: "Token is not in Free state" }); return; }

    const [token] = await db.update(tokensTable)
      .set({ ownerId: toUserId, updatedAt: new Date() })
      .where(eq(tokensTable.id, req.params.tokenId))
      .returning();
    const [owner] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, token.ownerId)).limit(1);
    const [warehouse] = await db.select({ id: warehousesTable.id, name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, token.warehouseId)).limit(1);
    res.json(formatToken(token, owner, warehouse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
