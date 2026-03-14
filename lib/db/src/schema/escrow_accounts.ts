import { pgTable, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { generateId } from "../utils/id";

export const escrowStatusEnum = pgEnum("escrow_status", ["pending", "funded", "released", "cancelled", "disputed"]);
export const escrowCurrencyEnum = pgEnum("escrow_currency", ["KES", "USDC"]);

export const escrowAccountsTable = pgTable("escrow_accounts", {
  id:               varchar("id", { length: 64 }).primaryKey().$defaultFn(() => generateId("ESC")),
  buyerId:          varchar("buyer_id", { length: 64 }).notNull(),
  sellerId:         varchar("seller_id", { length: 64 }).notNull(),
  amount:           varchar("amount", { length: 32 }).notNull(),
  currency:         escrowCurrencyEnum("currency").notNull().default("KES"),
  status:           escrowStatusEnum("status").notNull().default("pending"),
  description:      text("description"),
  relatedEntityId:  varchar("related_entity_id", { length: 64 }),
  relatedEntityType:varchar("related_entity_type", { length: 64 }),
  fundedAt:         timestamp("funded_at", { withTimezone: true }),
  releasedAt:       timestamp("released_at", { withTimezone: true }),
  cancelledAt:      timestamp("cancelled_at", { withTimezone: true }),
  expiresAt:        timestamp("expires_at", { withTimezone: true }),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
