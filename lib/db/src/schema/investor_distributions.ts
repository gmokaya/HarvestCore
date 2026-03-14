import { pgTable, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { generateId } from "../utils/id";

export const distributionStatusEnum = pgEnum("distribution_status", [
  "pending", "processing", "paid", "failed",
]);

export const investorDistributionsTable = pgTable("investor_distributions", {
  id:            varchar("id", { length: 64 }).primaryKey().$defaultFn(() => generateId("DIST")),
  poolId:        varchar("pool_id", { length: 64 }).notNull(),
  investorId:    varchar("investor_id", { length: 64 }).notNull(),
  investorName:  varchar("investor_name", { length: 128 }),
  period:        varchar("period", { length: 16 }).notNull(),
  grossAmount:   varchar("gross_amount", { length: 32 }).notNull(),
  feeAmount:     varchar("fee_amount", { length: 32 }).notNull().default("0"),
  netAmount:     varchar("net_amount", { length: 32 }).notNull(),
  currency:      varchar("currency", { length: 8 }).notNull().default("KES"),
  yieldRate:     varchar("yield_rate", { length: 16 }),
  status:        distributionStatusEnum("status").notNull().default("pending"),
  loanIds:       text("loan_ids"),
  note:          text("note"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  paidAt:        timestamp("paid_at", { withTimezone: true }),
});
