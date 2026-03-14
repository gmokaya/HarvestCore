import { pgTable, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { warehousesTable, intakesTable } from "./inventory";
import { inspectionsTable } from "./inspection";
import { generateId } from "../utils/id";

export const receiptStatusEnum = pgEnum("receipt_status", [
  "draft",
  "active",
  "collateral_locked",
  "under_trade",
  "settled",
  "expired",
  "cancelled",
]);

export const warehouseReceiptsTable = pgTable("warehouse_receipts", {
  id: text("id").primaryKey().$defaultFn(() => generateId("WR")),
  receiptNumber: text("receipt_number").notNull().unique(),
  registryRefId: text("registry_ref_id"),

  intakeId: text("intake_id").references(() => intakesTable.id),
  inspectionId: text("inspection_id").references(() => inspectionsTable.id),
  warehouseId: text("warehouse_id").notNull().references(() => warehousesTable.id),
  ownerId: text("owner_id").notNull().references(() => usersTable.id),
  organizationName: text("organization_name"),

  commodity: text("commodity").notNull(),
  grade: text("grade").notNull(),
  quantityKg: numeric("quantity_kg", { precision: 12, scale: 2 }).notNull(),
  packagingType: text("packaging_type"),
  storageLocation: text("storage_location"),
  stackPosition: text("stack_position"),

  inspectionDate: timestamp("inspection_date"),
  dateIssued: timestamp("date_issued").notNull().defaultNow(),
  expiryDate: timestamp("expiry_date"),
  reInspectionDate: timestamp("re_inspection_date"),

  status: receiptStatusEnum("status").notNull().default("draft"),
  tokenId: text("token_id"),

  warehouseOperatorSignature: text("warehouse_operator_signature"),
  inspectionAuthoritySignature: text("inspection_authority_signature"),
  registrySignature: text("registry_signature"),

  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const dwrAuditLogTable = pgTable("dwr_audit_log", {
  id: text("id").primaryKey().$defaultFn(() => generateId("AUD")),
  receiptId: text("receipt_id").notNull().references(() => warehouseReceiptsTable.id),
  receiptNumber: text("receipt_number").notNull(),
  action: text("action").notNull(),
  fromOwnerId: text("from_owner_id"),
  fromOwnerName: text("from_owner_name"),
  toOwnerId: text("to_owner_id"),
  toOwnerName: text("to_owner_name"),
  performedBy: text("performed_by").notNull().default("system"),
  metadata: text("metadata"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReceiptSchema = createInsertSchema(warehouseReceiptsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type WarehouseReceipt = typeof warehouseReceiptsTable.$inferSelect;
export type InsertWarehouseReceipt = z.infer<typeof insertReceiptSchema>;
export type DwrAuditLog = typeof dwrAuditLogTable.$inferSelect;
