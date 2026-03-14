import { pgTable, text, numeric, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tokensTable } from "./tokens";
import { generateId } from "../utils/id";

export const listingStatusEnum = pgEnum("listing_status", ["active", "sold", "cancelled", "expired"]);
export const listingTypeEnum = pgEnum("listing_type", ["fixed", "auction"]);
export const bidStatusEnum = pgEnum("bid_status", ["active", "accepted", "rejected", "outbid"]);
export const financingStatusEnum = pgEnum("financing_status", ["open", "funded", "closed"]);

export const listingsTable = pgTable("listings", {
  id: text("id").primaryKey().$defaultFn(() => generateId("LST")),
  tokenId: text("token_id").notNull().references(() => tokensTable.id),
  sellerId: text("seller_id").notNull().references(() => usersTable.id),
  commodity: text("commodity").notNull(),
  weightKg: numeric("weight_kg", { precision: 12, scale: 2 }).notNull(),
  grade: text("grade").notNull(),
  askingPrice: numeric("asking_price", { precision: 15, scale: 2 }).notNull(),
  currentBidPrice: numeric("current_bid_price", { precision: 15, scale: 2 }),
  listingType: listingTypeEnum("listing_type").notNull(),
  status: listingStatusEnum("status").notNull().default("active"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bidsTable = pgTable("bids", {
  id: text("id").primaryKey().$defaultFn(() => generateId("BID")),
  listingId: text("listing_id").notNull().references(() => listingsTable.id),
  bidderId: text("bidder_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  status: bidStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const financingRequestsTable = pgTable("financing_requests", {
  id: text("id").primaryKey().$defaultFn(() => generateId("FIN")),
  farmerId: text("farmer_id").notNull().references(() => usersTable.id),
  tokenId: text("token_id").notNull().references(() => tokensTable.id),
  commodity: text("commodity").notNull(),
  requestedAmount: numeric("requested_amount", { precision: 15, scale: 2 }).notNull(),
  maxInterestRate: numeric("max_interest_rate", { precision: 5, scale: 2 }).notNull(),
  tenureDays: integer("tenure_days").notNull(),
  status: financingStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const activityLogTable = pgTable("activity_log", {
  id: text("id").primaryKey().$defaultFn(() => generateId("ACT")),
  type: text("type").notNull(),
  description: text("description").notNull(),
  actorId: text("actor_id").references(() => usersTable.id),
  actorName: text("actor_name").notNull(),
  entityId: text("entity_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBidSchema = createInsertSchema(bidsTable).omit({ id: true, createdAt: true });
export const insertFinancingRequestSchema = createInsertSchema(financingRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activityLogTable).omit({ id: true, createdAt: true });

export type Listing = typeof listingsTable.$inferSelect;
export type Bid = typeof bidsTable.$inferSelect;
export type FinancingRequest = typeof financingRequestsTable.$inferSelect;
export type ActivityLog = typeof activityLogTable.$inferSelect;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type InsertBid = z.infer<typeof insertBidSchema>;
