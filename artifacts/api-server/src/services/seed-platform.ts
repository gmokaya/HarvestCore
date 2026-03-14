import { db } from "@workspace/db";
import {
  platformAccountsTable,
  liquidityPoolsTable,
  paymentRailTransactionsTable,
  fraudAlertsTable,
  investorDistributionsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateId } from "@workspace/db/utils/id";

const PLATFORM_ACCOUNTS = [
  {
    id: "PA-TREASURY-KES",
    name: "Platform Treasury (KES)",
    accountType: "treasury" as const,
    currency: "KES" as const,
    balance: "50000000",
    description: "Central KES treasury holding platform operational capital",
  },
  {
    id: "PA-TREASURY-USDC",
    name: "Platform Treasury (USDC)",
    accountType: "treasury" as const,
    currency: "USDC" as const,
    balance: "500000",
    description: "Central USDC treasury for stablecoin and cross-border operations",
  },
  {
    id: "PA-ESCROW-KES",
    name: "Escrow Engine (KES)",
    accountType: "escrow" as const,
    currency: "KES" as const,
    balance: "0",
    description: "Holds buyer funds during commodity trade and contract escrows",
  },
  {
    id: "PA-SETTLEMENT-KES",
    name: "Settlement Account (KES)",
    accountType: "settlement" as const,
    currency: "KES" as const,
    balance: "0",
    description: "Final settlement account for completed trades and contracts",
  },
  {
    id: "PA-FEE-KES",
    name: "Fee Collection (KES)",
    accountType: "fee_collection" as const,
    currency: "KES" as const,
    balance: "0",
    description: "Platform fee revenue collected on trades, loans, and settlements",
  },
  // Treasury sub-accounts
  {
    id: "PA-OPERATING-KES",
    name: "Operating Account",
    accountType: "treasury" as const,
    currency: "KES" as const,
    balance: "12500000",
    description: "Day-to-day operational expenses: salaries, infrastructure, vendor payments",
  },
  {
    id: "PA-RESERVE-KES",
    name: "Reserve Account",
    accountType: "treasury" as const,
    currency: "KES" as const,
    balance: "20000000",
    description: "Emergency reserve fund — minimum 6-month operating runway",
  },
  {
    id: "PA-REVENUE-KES",
    name: "Revenue Account",
    accountType: "fee_collection" as const,
    currency: "KES" as const,
    balance: "3847500",
    description: "Accumulated platform revenue: fees, commissions, interest margins",
  },
];

const LIQUIDITY_POOLS = [
  {
    id: "LP-LOAN-KES",
    poolType: "loan_financing" as const,
    name: "Loan Financing Pool",
    currency: "KES",
    balance: "250000000",
    totalDeposited: "250000000",
    capacity: "500000000",
    description: "Capital pool for agricultural loan disbursements. Funded by institutional lenders.",
  },
  {
    id: "LP-TRADING-KES",
    poolType: "trading_settlement" as const,
    name: "Trading Settlement Pool",
    currency: "KES",
    balance: "80000000",
    totalDeposited: "80000000",
    capacity: "200000000",
    description: "Liquidity pool for rapid commodity trade settlements on the marketplace.",
  },
  {
    id: "LP-USDC",
    poolType: "stablecoin" as const,
    name: "Stablecoin Pool",
    currency: "USDC",
    balance: "250000",
    totalDeposited: "250000",
    capacity: "10000000",
    description: "USDC pool for cross-border settlements and DeFi integration.",
  },
];

const SAMPLE_RAIL_TXNS = [
  { rail: "mpesa", externalRef: "MPE240301001", direction: "inbound",  amount: "50000",  currency: "KES", phoneOrAccount: "+254712345678", status: "matched",     ledgerGroupId: "TXG-SEED-001" },
  { rail: "mpesa", externalRef: "MPE240301002", direction: "inbound",  amount: "120000", currency: "KES", phoneOrAccount: "+254798765432", status: "matched",     ledgerGroupId: "TXG-SEED-002" },
  { rail: "mpesa", externalRef: "MPE240302001", direction: "outbound", amount: "75000",  currency: "KES", phoneOrAccount: "+254711223344", status: "unmatched" },
  { rail: "pesalink", externalRef: "PSL240301001", direction: "inbound",  amount: "500000", currency: "KES", phoneOrAccount: "0100123456", status: "matched",   ledgerGroupId: "TXG-SEED-003" },
  { rail: "pesalink", externalRef: "PSL240302001", direction: "outbound", amount: "250000", currency: "KES", phoneOrAccount: "0200987654", status: "discrepancy", discrepancyNote: "Amount mismatch: platform KES 250,000 vs PesaLink record KES 249,500" },
  { rail: "paystack", externalRef: "PST240301001", direction: "inbound",  amount: "30000",  currency: "KES", phoneOrAccount: "card_****4242", status: "matched",  ledgerGroupId: "TXG-SEED-004" },
  { rail: "paystack", externalRef: "PST240302001", direction: "inbound",  amount: "45000",  currency: "KES", phoneOrAccount: "card_****8888", status: "unmatched" },
  { rail: "stablecoin", externalRef: "USDC-TXN-0x1a2b3c", direction: "inbound",  amount: "5000",  currency: "USDC", phoneOrAccount: "0x1a2b3c...9f8e", status: "matched", ledgerGroupId: "TXG-SEED-005" },
  { rail: "stablecoin", externalRef: "USDC-TXN-0x4d5e6f", direction: "outbound", amount: "2500",  currency: "USDC", phoneOrAccount: "0x4d5e6f...1c2d", status: "unmatched" },
  { rail: "pesapal",  externalRef: "PPL240301001", direction: "inbound",  amount: "180000", currency: "KES", phoneOrAccount: "merchant_054", status: "matched",   ledgerGroupId: "TXG-SEED-006" },
  { rail: "mpesa", externalRef: "MPE240303001", direction: "inbound",  amount: "95000",  currency: "KES", phoneOrAccount: "+254733445566", status: "unmatched" },
  { rail: "mpesa", externalRef: "MPE240303002", direction: "outbound", amount: "15000",  currency: "KES", phoneOrAccount: "+254755667788", status: "dismissed" },
] as const;

const SAMPLE_FRAUD_ALERTS = [
  {
    alertType: "large_withdrawal" as const,
    severity: "high" as const,
    userId: "admin-001",
    walletId: "W-ADMIN-001",
    amount: "850000",
    currency: "KES",
    description: "Single withdrawal of KES 850,000 exceeds daily limit threshold of KES 500,000. Account: farmer_wanja@harvestcore.io",
    transactionRef: "WT-2403-8821",
    status: "open" as const,
  },
  {
    alertType: "rapid_transfers" as const,
    severity: "critical" as const,
    userId: "admin-001",
    walletId: "W-ADMIN-002",
    amount: "340000",
    currency: "KES",
    description: "7 transfers totalling KES 340,000 detected within 45 minutes. Pattern consistent with account compromise. User: trader_kimani@harvestcore.io",
    transactionRef: "WT-2403-BATCH-01",
    status: "investigating" as const,
  },
  {
    alertType: "unusual_hours" as const,
    severity: "medium" as const,
    userId: "admin-001",
    amount: "200000",
    currency: "KES",
    description: "Large transfer of KES 200,000 initiated at 02:34 AM local time. Flagged for unusual activity hours.",
    transactionRef: "WT-2403-9102",
    status: "open" as const,
  },
  {
    alertType: "velocity_breach" as const,
    severity: "high" as const,
    userId: "admin-001",
    amount: "1200000",
    currency: "KES",
    description: "Cumulative daily outflow of KES 1.2M breaches the KES 1M velocity limit for this account tier. User: lender_ochieng@harvestcore.io",
    transactionRef: "WT-2403-VELOC-01",
    status: "open" as const,
  },
  {
    alertType: "suspicious_pattern" as const,
    severity: "medium" as const,
    userId: "admin-001",
    amount: "99500",
    currency: "KES",
    description: "Repeated near-limit transactions of KES 99,500 (just below KES 100,000 reporting threshold) detected over 3 days. Potential structuring activity.",
    transactionRef: "WT-2403-STRUCT-01",
    status: "open" as const,
  },
  {
    alertType: "large_withdrawal" as const,
    severity: "low" as const,
    userId: "admin-001",
    amount: "620000",
    currency: "KES",
    description: "Withdrawal of KES 620,000 flagged for review. User provided export documentation — pending verification.",
    transactionRef: "WT-2403-7741",
    status: "resolved" as const,
  },
] as const;

const SAMPLE_DISTRIBUTIONS = [
  { poolId: "LP-LOAN-KES",    investorId: "INV-001", investorName: "Equity Bank Kenya",          period: "2026-02", grossAmount: "1875000", feeAmount: "93750",  netAmount: "1781250", currency: "KES",  yieldRate: "9.0%",  status: "paid" as const },
  { poolId: "LP-LOAN-KES",    investorId: "INV-002", investorName: "KCB Capital Ltd",            period: "2026-02", grossAmount: "1250000", feeAmount: "62500",  netAmount: "1187500", currency: "KES",  yieldRate: "9.0%",  status: "paid" as const },
  { poolId: "LP-LOAN-KES",    investorId: "INV-003", investorName: "Stanbic Investments",        period: "2026-02", grossAmount: "937500",  feeAmount: "46875",  netAmount: "890625",  currency: "KES",  yieldRate: "9.0%",  status: "paid" as const },
  { poolId: "LP-TRADING-KES", investorId: "INV-001", investorName: "Equity Bank Kenya",          period: "2026-02", grossAmount: "480000",  feeAmount: "24000",  netAmount: "456000",  currency: "KES",  yieldRate: "7.2%",  status: "paid" as const },
  { poolId: "LP-TRADING-KES", investorId: "INV-004", investorName: "Centum Investment Co",       period: "2026-02", grossAmount: "320000",  feeAmount: "16000",  netAmount: "304000",  currency: "KES",  yieldRate: "7.2%",  status: "paid" as const },
  { poolId: "LP-LOAN-KES",    investorId: "INV-001", investorName: "Equity Bank Kenya",          period: "2026-03", grossAmount: "1950000", feeAmount: "97500",  netAmount: "1852500", currency: "KES",  yieldRate: "9.4%",  status: "pending" as const },
  { poolId: "LP-LOAN-KES",    investorId: "INV-002", investorName: "KCB Capital Ltd",            period: "2026-03", grossAmount: "1300000", feeAmount: "65000",  netAmount: "1235000", currency: "KES",  yieldRate: "9.4%",  status: "pending" as const },
  { poolId: "LP-LOAN-KES",    investorId: "INV-003", investorName: "Stanbic Investments",        period: "2026-03", grossAmount: "975000",  feeAmount: "48750",  netAmount: "926250",  currency: "KES",  yieldRate: "9.4%",  status: "pending" as const },
  { poolId: "LP-USDC",        investorId: "INV-005", investorName: "Chainlink Capital DAO",      period: "2026-03", grossAmount: "3750",    feeAmount: "187.5",  netAmount: "3562.5",  currency: "USDC", yieldRate: "18.0%", status: "pending" as const },
  { poolId: "LP-TRADING-KES", investorId: "INV-004", investorName: "Centum Investment Co",       period: "2026-03", grossAmount: "340000",  feeAmount: "17000",  netAmount: "323000",  currency: "KES",  yieldRate: "7.6%",  status: "pending" as const },
];

async function tableIsEmpty(countQuery: any): Promise<boolean> {
  const [res] = await db.execute(countQuery);
  return Number((res as any).count) === 0;
}

export async function seedPlatformAccounts() {
  for (const account of PLATFORM_ACCOUNTS) {
    const [existing] = await db
      .select({ id: platformAccountsTable.id })
      .from(platformAccountsTable)
      .where(eq(platformAccountsTable.id, account.id))
      .limit(1);
    if (!existing) {
      await db.insert(platformAccountsTable).values(account);
      console.log(`[seed] Created platform account: ${account.name}`);
    }
  }

  for (const pool of LIQUIDITY_POOLS) {
    const [existing] = await db
      .select({ id: liquidityPoolsTable.id })
      .from(liquidityPoolsTable)
      .where(eq(liquidityPoolsTable.id, pool.id))
      .limit(1);
    if (!existing) {
      await db.insert(liquidityPoolsTable).values(pool);
      console.log(`[seed] Created liquidity pool: ${pool.name}`);
    }
  }

  // Seed payment rail transactions if table is empty
  const [railCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(paymentRailTransactionsTable);
  if (Number(railCount.count) === 0) {
    for (const txn of SAMPLE_RAIL_TXNS) {
      await db.insert(paymentRailTransactionsTable).values({
        id: generateId("PRT"),
        rail: txn.rail,
        externalRef: txn.externalRef,
        direction: txn.direction,
        amount: txn.amount,
        currency: txn.currency,
        phoneOrAccount: txn.phoneOrAccount,
        status: txn.status,
        ledgerGroupId: ("ledgerGroupId" in txn ? txn.ledgerGroupId : null) ?? null,
        discrepancyNote: ("discrepancyNote" in txn ? (txn as any).discrepancyNote : null) ?? null,
        matchedAt: txn.status === "matched" ? new Date() : null,
      });
    }
    console.log(`[seed] Created ${SAMPLE_RAIL_TXNS.length} payment rail transactions`);
  }

  // Seed fraud alerts if table is empty
  const [fraudCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(fraudAlertsTable);
  if (Number(fraudCount.count) === 0) {
    for (const alert of SAMPLE_FRAUD_ALERTS) {
      await db.insert(fraudAlertsTable).values({
        id: generateId("FRA"),
        ...alert,
        resolvedBy: alert.status === "resolved" ? "admin-001" : null,
        resolutionNote: alert.status === "resolved" ? "Verified legitimate export transaction with proper documentation" : null,
        resolvedAt: alert.status === "resolved" ? new Date() : null,
        updatedAt: new Date(),
      });
    }
    console.log(`[seed] Created ${SAMPLE_FRAUD_ALERTS.length} fraud alerts`);
  }

  // Seed investor distributions if table is empty
  const [distCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(investorDistributionsTable);
  if (Number(distCount.count) === 0) {
    for (const dist of SAMPLE_DISTRIBUTIONS) {
      await db.insert(investorDistributionsTable).values({
        id: generateId("DIST"),
        ...dist,
        feeAmount: dist.feeAmount,
        paidAt: dist.status === "paid" ? new Date(2026, 1, 28) : null,
      });
    }
    console.log(`[seed] Created ${SAMPLE_DISTRIBUTIONS.length} investor distributions`);
  }
}
