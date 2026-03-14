import { pgTable, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { generateId } from "../utils/id";

export const fraudAlertTypeEnum = pgEnum("fraud_alert_type", [
  "large_withdrawal",
  "rapid_transfers",
  "suspicious_pattern",
  "velocity_breach",
  "unusual_hours",
  "account_takeover",
]);
export const fraudAlertSeverityEnum = pgEnum("fraud_alert_severity", [
  "low", "medium", "high", "critical",
]);
export const fraudAlertStatusEnum = pgEnum("fraud_alert_status", [
  "open", "investigating", "resolved", "dismissed",
]);

export const fraudAlertsTable = pgTable("fraud_alerts", {
  id:                varchar("id", { length: 64 }).primaryKey().$defaultFn(() => generateId("FRA")),
  alertType:         fraudAlertTypeEnum("alert_type").notNull(),
  severity:          fraudAlertSeverityEnum("severity").notNull().default("medium"),
  userId:            varchar("user_id", { length: 64 }).notNull(),
  walletId:          varchar("wallet_id", { length: 64 }),
  amount:            varchar("amount", { length: 32 }),
  currency:          varchar("currency", { length: 8 }).notNull().default("KES"),
  description:       text("description").notNull(),
  transactionRef:    varchar("transaction_ref", { length: 128 }),
  status:            fraudAlertStatusEnum("status").notNull().default("open"),
  resolvedBy:        varchar("resolved_by", { length: 64 }),
  resolutionNote:    text("resolution_note"),
  createdAt:         timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt:        timestamp("resolved_at", { withTimezone: true }),
});
