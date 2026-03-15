import { pgTable, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { generateId } from "../utils/id";

export const orgTypeEnum = pgEnum("org_type", [
  "cooperative",
  "processor",
  "lender",
  "trader",
  "admin_entity",
  "warehouse_operator",
]);

export const orgStatusEnum = pgEnum("org_status", ["active", "suspended", "pending"]);

export const organizationsTable = pgTable("organizations", {
  id: text("id").primaryKey().$defaultFn(() => generateId("ORG")),
  name: text("name").notNull(),
  type: orgTypeEnum("type").notNull(),
  registrationNumber: text("registration_number"),
  kraPin: text("kra_pin"),
  county: text("county"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  adminId: text("admin_id"),
  memberCount: integer("member_count").notNull().default(0),
  status: orgStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type Organization = typeof organizationsTable.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
