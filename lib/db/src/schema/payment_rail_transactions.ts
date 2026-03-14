import { pgTable, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { generateId } from "../utils/id";

export const paymentRailEnum = pgEnum("payment_rail", [
  "mpesa", "pesalink", "paystack", "pesapal", "stablecoin", "manual",
]);
export const railTxnStatusEnum = pgEnum("rail_txn_status", [
  "unmatched", "matched", "discrepancy", "dismissed",
]);
export const railTxnDirectionEnum = pgEnum("rail_txn_direction", ["inbound", "outbound"]);

export const paymentRailTransactionsTable = pgTable("payment_rail_transactions", {
  id:                  varchar("id", { length: 64 }).primaryKey().$defaultFn(() => generateId("PRT")),
  rail:                paymentRailEnum("rail").notNull(),
  externalRef:         varchar("external_ref", { length: 128 }).notNull(),
  direction:           railTxnDirectionEnum("direction").notNull().default("inbound"),
  amount:              varchar("amount", { length: 32 }).notNull(),
  currency:            varchar("currency", { length: 8 }).notNull().default("KES"),
  phoneOrAccount:      varchar("phone_or_account", { length: 64 }),
  status:              railTxnStatusEnum("status").notNull().default("unmatched"),
  walletTransactionId: varchar("wallet_transaction_id", { length: 64 }),
  ledgerGroupId:       varchar("ledger_group_id", { length: 64 }),
  discrepancyNote:     text("discrepancy_note"),
  rawPayload:          text("raw_payload"),
  importedAt:          timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  matchedAt:           timestamp("matched_at", { withTimezone: true }),
});
