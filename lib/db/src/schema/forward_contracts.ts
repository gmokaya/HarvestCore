import { pgTable, text, numeric, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { generateId } from "../utils/id";

export const forwardContractStatusEnum = pgEnum("forward_contract_status", [
  "draft", "open", "accepted", "active", "settled", "cancelled", "defaulted",
]);

export const forwardContractCollateralTypeEnum = pgEnum("forward_contract_collateral_type", [
  "tokenized_receipt", "inventory_lock", "cash_margin", "loan_backed",
]);

export const forwardContractPaymentMethodEnum = pgEnum("forward_contract_payment_method", [
  "mpesa", "pesalink", "stablecoin", "bank_transfer",
]);

export const forwardContractDeliveryMethodEnum = pgEnum("forward_contract_delivery_method", [
  "warehouse_pickup", "buyer_transport", "platform_logistics",
]);

export const forwardContractsTable = pgTable("forward_contracts", {
  id: text("id").primaryKey().$defaultFn(() => generateId("FC")),
  blockchainHash: text("blockchain_hash"),
  status: forwardContractStatusEnum("status").notNull().default("draft"),

  sellerId: text("seller_id").notNull().references(() => usersTable.id),
  buyerId: text("buyer_id").references(() => usersTable.id),
  sellerOrgId: text("seller_org_id"),
  buyerOrgId: text("buyer_org_id"),

  commodity: text("commodity").notNull(),
  grade: text("grade"),
  moistureContent: numeric("moisture_content", { precision: 5, scale: 2 }),
  packagingType: text("packaging_type"),
  quantity: numeric("quantity", { precision: 15, scale: 2 }).notNull(),
  unit: text("unit").notNull().default("kg"),
  warehouseReceiptId: text("warehouse_receipt_id"),
  tokenId: text("token_id"),
  originLocation: text("origin_location"),
  certification: text("certification"),

  forwardPrice: numeric("forward_price", { precision: 15, scale: 2 }).notNull(),
  totalValue: numeric("total_value", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("KES"),
  aiSuggestedPrice: numeric("ai_suggested_price", { precision: 15, scale: 2 }),
  priceLockAt: timestamp("price_lock_at"),
  priceAdjustmentClause: text("price_adjustment_clause"),

  deliveryDate: timestamp("delivery_date").notNull(),
  deliveryWindowStart: timestamp("delivery_window_start"),
  deliveryWindowEnd: timestamp("delivery_window_end"),
  deliveryLocation: text("delivery_location").notNull(),
  deliveryMethod: forwardContractDeliveryMethodEnum("delivery_method").notNull().default("warehouse_pickup"),
  partialDeliveryAllowed: boolean("partial_delivery_allowed").notNull().default(false),

  collateralType: forwardContractCollateralTypeEnum("collateral_type"),
  collateralValue: numeric("collateral_value", { precision: 15, scale: 2 }),
  collateralTokenId: text("collateral_token_id"),
  collateralLocked: boolean("collateral_locked").notNull().default(false),

  paymentMethod: forwardContractPaymentMethodEnum("payment_method").notNull().default("pesalink"),
  paymentSchedule: text("payment_schedule").notNull().default("on_delivery"),
  escrowWalletId: text("escrow_wallet_id"),

  buyerRiskScore: text("buyer_risk_score"),
  sellerRiskScore: text("seller_risk_score"),
  contractRiskRating: text("contract_risk_rating"),
  insuranceCoverage: boolean("insurance_coverage").notNull().default(false),

  smartContractAddress: text("smart_contract_address"),
  blockchainNetwork: text("blockchain_network").default("IOTA"),

  disputeStatus: text("dispute_status"),
  arbitrationAuthority: text("arbitration_authority"),

  createdById: text("created_by_id"),
  approvedById: text("approved_by_id"),
  deliveryConfirmedAt: timestamp("delivery_confirmed_at"),
  paymentConfirmedAt: timestamp("payment_confirmed_at"),
  settledAt: timestamp("settled_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const forwardContractEventsTable = pgTable("forward_contract_events", {
  id: text("id").primaryKey().$defaultFn(() => generateId("FCE")),
  contractId: text("contract_id").notNull().references(() => forwardContractsTable.id),
  event: text("event").notNull(),
  actor: text("actor").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertForwardContractSchema = createInsertSchema(forwardContractsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type ForwardContract = typeof forwardContractsTable.$inferSelect;
export type InsertForwardContract = z.infer<typeof insertForwardContractSchema>;
export type ForwardContractEvent = typeof forwardContractEventsTable.$inferSelect;
