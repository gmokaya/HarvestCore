import { pgTable, text, numeric, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { warehousesTable, intakesTable } from "./inventory";

export const inspectionTypeEnum = pgEnum("inspection_type", [
  "intake",
  "periodic",
  "pre_dispatch",
  "collateral_verification",
]);

export const inspectionDamageLevelEnum = pgEnum("inspection_damage_level", [
  "none",
  "minor",
  "moderate",
  "severe",
]);

export const inspectionPackagingEnum = pgEnum("inspection_packaging", [
  "bags",
  "bulk",
  "pallets",
]);

export const inspectionStatusEnum = pgEnum("inspection_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
]);

export const inspectionsTable = pgTable("inspections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  intakeId: text("intake_id").references(() => intakesTable.id),
  warehouseId: text("warehouse_id").notNull().references(() => warehousesTable.id),
  inspectorId: text("inspector_id").notNull().references(() => usersTable.id),
  inspectionType: inspectionTypeEnum("inspection_type").notNull().default("intake"),
  commodity: text("commodity").notNull(),
  variety: text("variety"),

  moisturePercent: numeric("moisture_percent", { precision: 5, scale: 2 }),
  brokenGrainPercent: numeric("broken_grain_percent", { precision: 5, scale: 2 }),
  foreignMatterPercent: numeric("foreign_matter_percent", { precision: 5, scale: 2 }),
  pestDamagePercent: numeric("pest_damage_percent", { precision: 5, scale: 2 }),
  moldPresent: boolean("mold_present").notNull().default(false),
  aflatoxinDetected: boolean("aflatoxin_detected").notNull().default(false),
  discoloration: boolean("discoloration").notNull().default(false),

  grade: text("grade"),
  damageLevel: inspectionDamageLevelEnum("damage_level").notNull().default("none"),

  netWeightKg: numeric("net_weight_kg", { precision: 12, scale: 2 }),
  grossWeightKg: numeric("gross_weight_kg", { precision: 12, scale: 2 }),
  bagCount: numeric("bag_count", { precision: 10, scale: 0 }),
  packagingType: inspectionPackagingEnum("packaging_type").default("bags"),

  temperatureCelsius: numeric("temperature_celsius", { precision: 5, scale: 1 }),
  humidityPercent: numeric("humidity_percent", { precision: 5, scale: 1 }),
  storageMethod: text("storage_method"),
  stackPosition: text("stack_position"),

  certifications: text("certifications"),
  licenseNumber: text("license_number"),
  organization: text("organization"),
  riskFlags: text("risk_flags"),

  notes: text("notes"),
  status: inspectionStatusEnum("status").notNull().default("pending"),
  approvedBy: text("approved_by").references(() => usersTable.id),
  inspectionDate: timestamp("inspection_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInspectionSchema = createInsertSchema(inspectionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type Inspection = typeof inspectionsTable.$inferSelect;
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
