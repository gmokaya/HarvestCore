import { pgTable, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { generateId } from "../utils/id";

export const poolTypeEnum = pgEnum("pool_type", ["loan_financing", "trading_settlement", "stablecoin"]);
export const poolStatusEnum = pgEnum("pool_status", ["active", "paused", "depleted"]);

export const liquidityPoolsTable = pgTable("liquidity_pools", {
  id:              varchar("id", { length: 64 }).primaryKey().$defaultFn(() => generateId("LP")),
  poolType:        poolTypeEnum("pool_type").notNull(),
  name:            varchar("name", { length: 128 }).notNull(),
  currency:        varchar("currency", { length: 10 }).notNull().default("KES"),
  balance:         varchar("balance", { length: 32 }).notNull().default("0"),
  lockedBalance:   varchar("locked_balance", { length: 32 }).notNull().default("0"),
  totalDeposited:  varchar("total_deposited", { length: 32 }).notNull().default("0"),
  totalWithdrawn:  varchar("total_withdrawn", { length: 32 }).notNull().default("0"),
  capacity:        varchar("capacity", { length: 32 }).notNull().default("100000000"),
  status:          poolStatusEnum("status").notNull().default("active"),
  description:     text("description"),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const poolTransactionsTable = pgTable("pool_transactions", {
  id:              varchar("id", { length: 64 }).primaryKey().$defaultFn(() => generateId("PTX")),
  poolId:          varchar("pool_id", { length: 64 }).notNull(),
  txType:          varchar("tx_type", { length: 32 }).notNull(),
  amount:          varchar("amount", { length: 32 }).notNull(),
  balanceBefore:   varchar("balance_before", { length: 32 }).notNull(),
  balanceAfter:    varchar("balance_after", { length: 32 }).notNull(),
  currency:        varchar("currency", { length: 10 }).notNull().default("KES"),
  userId:          varchar("user_id", { length: 64 }),
  description:     text("description"),
  relatedEntityId: varchar("related_entity_id", { length: 64 }),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
