import { pgTable, text, numeric, integer, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tokensTable } from "./tokens";

export const loanStatusEnum = pgEnum("loan_status", ["pending", "approved", "active", "repaid", "defaulted", "in_liquidation"]);
export const riskScoreEnum = pgEnum("risk_score", ["low", "medium", "high"]);
export const ltvStatusEnum = pgEnum("ltv_status", ["healthy", "monitoring", "margin_call", "liquidation"]);
export const paymentMethodEnum = pgEnum("payment_method", ["mpesa", "bank_transfer", "stablecoin", "pesalink", "swift"]);
export const settlementStageEnum = pgEnum("settlement_stage", ["at_risk", "grace_period", "notice_sent", "for_sale", "settled"]);

export const loansTable = pgTable("loans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  borrowerId: text("borrower_id").notNull().references(() => usersTable.id),
  lenderId: text("lender_id").references(() => usersTable.id),
  tokenId: text("token_id").notNull().references(() => tokensTable.id),
  commodity: text("commodity").notNull(),
  principalAmount: numeric("principal_amount", { precision: 15, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  tenureDays: integer("tenure_days").notNull(),
  ltv: numeric("ltv", { precision: 5, scale: 2 }),
  status: loanStatusEnum("status").notNull().default("pending"),
  riskScore: riskScoreEnum("risk_score"),
  purpose: text("purpose"),
  outstandingBalance: numeric("outstanding_balance", { precision: 15, scale: 2 }),
  rejectionReason: text("rejection_reason"),
  conditions: text("conditions"),
  disbursedAt: timestamp("disbursed_at"),
  dueDate: timestamp("due_date"),
  repaidAt: timestamp("repaid_at"),
  isOnNegativeList: boolean("is_on_negative_list").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const repaymentsTable = pgTable("repayments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  loanId: text("loan_id").notNull().references(() => loansTable.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  transactionRef: text("transaction_ref").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settlementsTable = pgTable("settlements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  loanId: text("loan_id").notNull().references(() => loansTable.id),
  stage: settlementStageEnum("stage").notNull().default("at_risk"),
  salePrice: numeric("sale_price", { precision: 15, scale: 2 }),
  lenderRecovery: numeric("lender_recovery", { precision: 15, scale: 2 }),
  warehouseCharges: numeric("warehouse_charges", { precision: 15, scale: 2 }),
  operationalFees: numeric("operational_fees", { precision: 15, scale: 2 }),
  borrowerResidue: numeric("borrower_residue", { precision: 15, scale: 2 }),
  settlementTxHash: text("settlement_tx_hash"),
  gracePeriodEndsAt: timestamp("grace_period_ends_at"),
  noticeSentAt: timestamp("notice_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLoanSchema = createInsertSchema(loansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRepaymentSchema = createInsertSchema(repaymentsTable).omit({ id: true, createdAt: true });
export const insertSettlementSchema = createInsertSchema(settlementsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Loan = typeof loansTable.$inferSelect;
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Repayment = typeof repaymentsTable.$inferSelect;
export type Settlement = typeof settlementsTable.$inferSelect;
