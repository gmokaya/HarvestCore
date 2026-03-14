import { pgTable, varchar, text, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { generateId } from "../utils/id";

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", ["debit", "credit"]);
export const ledgerAccountTypeEnum = pgEnum("ledger_account_type", ["platform_account", "user_wallet", "external"]);
export const ledgerCurrencyEnum = pgEnum("ledger_currency", ["KES", "USDC"]);

export const ledgerEntriesTable = pgTable("ledger_entries", {
  id:                varchar("id", { length: 64 }).primaryKey().$defaultFn(() => generateId("LED")),
  // Groups the two sides of a double-entry (debit + credit share same txnGroupId)
  txnGroupId:       varchar("txn_group_id", { length: 64 }).notNull(),
  entryType:        ledgerEntryTypeEnum("entry_type").notNull(),
  accountId:        varchar("account_id", { length: 64 }).notNull(),
  accountType:      ledgerAccountTypeEnum("account_type").notNull(),
  accountLabel:     varchar("account_label", { length: 128 }).notNull(),
  amount:           varchar("amount", { length: 32 }).notNull(),
  currency:         ledgerCurrencyEnum("currency").notNull().default("KES"),
  description:      text("description"),
  reference:        varchar("reference", { length: 256 }),
  relatedEntityId:  varchar("related_entity_id", { length: 64 }),
  relatedEntityType:varchar("related_entity_type", { length: 64 }),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
