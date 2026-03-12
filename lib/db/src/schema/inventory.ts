import { pgTable, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const intakeStatusEnum = pgEnum("intake_status", ["pending", "graded", "weighed", "verified", "anchored", "rejected"]);
export const gradeEnum = pgEnum("grade", ["A", "B", "C", "D"]);
export const ewrsStatusEnum = pgEnum("ewrs_status", ["not_submitted", "pending", "verified", "rejected", "sync_error"]);

export const warehousesTable = pgTable("warehouses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  location: text("location").notNull(),
  capacity: numeric("capacity", { precision: 12, scale: 2 }).notNull(),
  currentStock: numeric("current_stock", { precision: 12, scale: 2 }).notNull().default("0"),
  operatorId: text("operator_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const intakesTable = pgTable("intakes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  farmerId: text("farmer_id").notNull().references(() => usersTable.id),
  warehouseId: text("warehouse_id").notNull().references(() => warehousesTable.id),
  commodity: text("commodity").notNull(),
  variety: text("variety"),
  weightKg: numeric("weight_kg", { precision: 12, scale: 2 }).notNull(),
  moisturePercent: numeric("moisture_percent", { precision: 5, scale: 2 }).notNull(),
  grade: gradeEnum("grade"),
  grnNumber: text("grn_number"),
  ewrsRegistryId: text("ewrs_registry_id"),
  ewrsStatus: ewrsStatusEnum("ewrs_status").notNull().default("not_submitted"),
  ewrsSubmittedAt: timestamp("ewrs_submitted_at"),
  ewrsSyncedAt: timestamp("ewrs_synced_at"),
  ewrsPayload: text("ewrs_payload"),
  iotaHash: text("iota_hash"),
  status: intakeStatusEnum("status").notNull().default("pending"),
  checkerNotes: text("checker_notes"),
  checkedBy: text("checked_by").references(() => usersTable.id),
  tokenId: text("token_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWarehouseSchema = createInsertSchema(warehousesTable).omit({ id: true, createdAt: true });
export const insertIntakeSchema = createInsertSchema(intakesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Warehouse = typeof warehousesTable.$inferSelect;
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type Intake = typeof intakesTable.$inferSelect;
export type InsertIntake = z.infer<typeof insertIntakeSchema>;
