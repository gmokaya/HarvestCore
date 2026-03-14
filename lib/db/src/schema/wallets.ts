import { pgTable, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { generateId } from "../utils/id";

export const walletCurrencyEnum = pgEnum("wallet_currency", ["KES", "USDC"]);
export const walletStatusEnum = pgEnum("wallet_status", ["active", "suspended", "frozen"]);
export const txTypeEnum = pgEnum("tx_type", [
  "deposit",
  "withdrawal",
  "loan_disbursement",
  "loan_repayment",
  "trade_settlement",
  "escrow_lock",
  "escrow_release",
  "transfer_in",
  "transfer_out",
  "fee",
]);
export const txStatusEnum = pgEnum("tx_status", ["pending", "completed", "failed", "reversed"]);
export const railProviderEnum = pgEnum("rail_provider", [
  "mpesa",
  "pesalink",
  "paystack",
  "pesapal",
  "stablecoin",
  "internal",
]);

export const walletsTable = pgTable("wallets", {
  id: text("id").primaryKey().$defaultFn(() => generateId("WLT")),
  userId: text("user_id").notNull().references(() => usersTable.id),
  currency: walletCurrencyEnum("currency").notNull(),
  balance: numeric("balance", { precision: 18, scale: 4 }).notNull().default("0"),
  lockedBalance: numeric("locked_balance", { precision: 18, scale: 4 }).notNull().default("0"),
  status: walletStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: text("id").primaryKey().$defaultFn(() => generateId("TXN")),
  walletId: text("wallet_id").notNull().references(() => walletsTable.id),
  userId: text("user_id").notNull(),
  type: txTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  balanceBefore: numeric("balance_before", { precision: 18, scale: 4 }).notNull().default("0"),
  balanceAfter: numeric("balance_after", { precision: 18, scale: 4 }).notNull().default("0"),
  currency: walletCurrencyEnum("currency").notNull(),
  status: txStatusEnum("status").notNull().default("completed"),
  railProvider: railProviderEnum("rail_provider").notNull().default("internal"),
  reference: text("reference"),
  description: text("description"),
  relatedEntityId: text("related_entity_id"),
  relatedEntityType: text("related_entity_type"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWalletTxSchema = createInsertSchema(walletTransactionsTable).omit({ id: true, createdAt: true });

export type Wallet = typeof walletsTable.$inferSelect;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type InsertWalletTx = z.infer<typeof insertWalletTxSchema>;
