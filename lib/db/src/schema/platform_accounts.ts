import { pgTable, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { generateId } from "../utils/id";

export const platformAccountTypeEnum = pgEnum("platform_account_type", [
  "treasury",
  "loan_pool",
  "trading_pool",
  "stablecoin_pool",
  "escrow",
  "settlement",
  "fee_collection",
]);

export const platformAccountCurrencyEnum = pgEnum("platform_account_currency", ["KES", "USDC"]);
export const platformAccountStatusEnum = pgEnum("platform_account_status", ["active", "frozen"]);

export const platformAccountsTable = pgTable("platform_accounts", {
  id:           varchar("id", { length: 64 }).primaryKey().$defaultFn(() => generateId("PA")),
  name:         varchar("name", { length: 128 }).notNull(),
  accountType:  platformAccountTypeEnum("account_type").notNull(),
  currency:     platformAccountCurrencyEnum("currency").notNull().default("KES"),
  balance:      varchar("balance", { length: 32 }).notNull().default("0"),
  lockedBalance:varchar("locked_balance", { length: 32 }).notNull().default("0"),
  status:       platformAccountStatusEnum("status").notNull().default("active"),
  description:  text("description"),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
