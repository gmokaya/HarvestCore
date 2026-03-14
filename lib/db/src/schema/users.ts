import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { generateId } from "../utils/id";

export const roleEnum = pgEnum("role", ["farmer", "trader", "collateral_manager", "processor", "warehouse_op", "checker", "lender", "admin"]);
export const kycStatusEnum = pgEnum("kyc_status", ["pending", "approved", "rejected"]);
export const kycTypeEnum = pgEnum("kyc_type", ["individual", "company", "cooperative"]);
export const idTypeEnum = pgEnum("id_type", ["national_id", "passport", "driving_license"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "invited"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => generateId("USR")),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("farmer"),
  orgId: text("org_id"),
  phone: text("phone"),
  walletAddress: text("wallet_address"),
  kycStatus: kycStatusEnum("kyc_status").notNull().default("pending"),
  status: userStatusEnum("status").notNull().default("active"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const kycRecordsTable = pgTable("kyc_records", {
  id: text("id").primaryKey().$defaultFn(() => generateId("KYC")),
  userId: text("user_id").notNull().references(() => usersTable.id),
  kycType: kycTypeEnum("kyc_type").notNull(),
  idNumber: text("id_number").notNull(),
  idType: idTypeEnum("id_type").notNull(),
  businessName: text("business_name"),
  kraPin: text("kra_pin"),
  status: kycStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  documentUrls: text("document_urls").array().notNull().default([]),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const userAuditLogsTable = pgTable("user_audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => generateId("UAL")),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  targetUserId: text("target_user_id"),
  targetUserName: text("target_user_name"),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKycSchema = createInsertSchema(kycRecordsTable).omit({ id: true, submittedAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type KycRecord = typeof kycRecordsTable.$inferSelect;
export type InsertKyc = z.infer<typeof insertKycSchema>;
export type UserAuditLog = typeof userAuditLogsTable.$inferSelect;
