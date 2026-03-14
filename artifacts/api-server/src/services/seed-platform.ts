import { db } from "@workspace/db";
import { platformAccountsTable, liquidityPoolsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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
}
