import { pgTable, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { intakesTable, warehousesTable } from "./inventory";
import { generateId } from "../utils/id";

export const tokenStateEnum = pgEnum("token_state", ["free", "pledged", "financed", "locked", "in_liquidation", "released"]);

export const tokensTable = pgTable("tokens", {
  id: text("id").primaryKey().$defaultFn(() => generateId("TKN")),
  intakeId: text("intake_id").notNull().references(() => intakesTable.id),
  ownerId: text("owner_id").notNull().references(() => usersTable.id),
  warehouseId: text("warehouse_id").notNull().references(() => warehousesTable.id),
  commodity: text("commodity").notNull(),
  weightKg: numeric("weight_kg", { precision: 12, scale: 2 }).notNull(),
  grade: text("grade").notNull(),
  tokenState: tokenStateEnum("token_state").notNull().default("free"),
  nftTokenId: text("nft_token_id"),
  contractAddress: text("contract_address"),
  txHash: text("tx_hash"),
  metadataUri: text("metadata_uri"),
  fairMarketValue: numeric("fair_market_value", { precision: 15, scale: 2 }),
  mintedAt: timestamp("minted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTokenSchema = createInsertSchema(tokensTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Token = typeof tokensTable.$inferSelect;
export type InsertToken = z.infer<typeof insertTokenSchema>;
