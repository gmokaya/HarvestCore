# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## HarvestCore Platform Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | KPIs, activity feed |
| `/users` | Identity & KYC | Farmer/user management |
| `/inventory` | Inventory & Logistics | 5-stage intake pipeline, warehouses, eWRS registry sync |
| `/inspection` | Inspection & Quality | Commodity grading, quality params, risk flags, approve/reject |
| `/receipts` | Digital Warehouse Receipts | DWR lifecycle, collateral locking, tokenization |
| `/tokens` | Tokens | NFT state machine (free→pledged→financed→locked→liquidation) |
| `/loans` | Credit & Loans | Multi-stage approval workflow, LTV monitoring, audit trail, approver management |
| `/marketplace` | Marketplace | Commodity listings, trade |
| `/settlement` | Settlement & Liquidation | Settlement processing |

## DB Schema Tables

- `users` — all platform users; roles: farmer, trader, collateral_manager, processor, warehouse_op, checker, lender, admin
- `organizations` — cooperatives, processors, lenders, trader associations (multi-tenancy scope)
- `kyc_records` — KYC document submissions linked to users
- `warehouses` — storage facilities with capacity tracking
- `intakes` — commodity intake pipeline (5 stages + eWRS registry columns)
- `inspections` — quality inspection records with grading params and risk flags
- `warehouse_receipts` — Digital Warehouse Receipts (DWR) with lifecycle status
- `tokens` — NFT-backed commodity tokens
- `loans` — collateralized lending with 10-stage approval workflow, LTV thresholds, workflow fields
- `loan_approvers` — authorized approvers (Collateral Manager, Credit Officer, Risk Manager, Finance Officer) with approval limits
- `loan_approvals` — immutable audit trail of every approval action across the pipeline
- `marketplace_listings` — commodity trade listings
- `activity_log` — platform audit trail

## Finance Engine (Bank-Grade Architecture)

### Internal Account Structure
Seven typed platform accounts seeded at startup (in `services/seed-platform.ts`):
- **PA-TREASURY-KES / PA-TREASURY-USDC** — Master platform capital reserves
- **PA-ESCROW-KES** — Central escrow holding account
- **PA-SETTLEMENT-KES** — Final trade settlement account
- **PA-FEE-KES** — Platform fee revenue collection

### Liquidity Pools (seeded at startup)
| Pool ID | Type | Currency | Initial Balance |
|---|---|---|---|
| LP-LOAN-KES | loan_financing | KES | 250,000,000 |
| LP-TRADING-KES | trading_settlement | KES | 80,000,000 |
| LP-USDC | stablecoin | USDC | 250,000 |

### Double-Entry Ledger
Every financial event creates **two paired entries** (debit + credit) sharing a `txnGroupId`. The system is always reconciled — `totalDebits === totalCredits` for each currency.
- Route: `GET /api/ledger`, `GET /api/ledger/reconciliation`, `GET /api/ledger/group/:txnGroupId`
- Service: `services/ledger.ts` — `recordDoubleEntry()`, `getReconciliation()`

### Escrow Engine
Full buyer → escrow → seller workflow:
1. `POST /api/escrow/create` — create escrow record
2. `POST /api/escrow/:id/fund` — lock buyer funds + ledger entry
3. `POST /api/escrow/:id/release` — debit buyer → credit seller + ledger entry
4. `POST /api/escrow/:id/cancel` — refund buyer
- Service: `services/escrow.ts`

### Frontend: Finance Engine page (`/finance-hub`)
4 tabs: Internal Accounts · Liquidity Pools · Escrow Engine · Ledger Audit

## User Roles & RBAC

| Role | Label | Key Permissions |
|---|---|---|
| `farmer` | Farmer / Borrower | loan:create, inventory:view, marketplace:list |
| `trader` | Trader | marketplace:trade, contracts:forward |
| `collateral_manager` | Collateral Manager | receipts:manage, inspections:approve, tokens:lock |
| `processor` | Processor | marketplace:purchase, contracts:manage, payments:view |
| `warehouse_op` | Warehouse Operator | inventory:manage, receipts:issue, ewrs:submit |
| `checker` | Checker / Auditor | inventory:verify, inspections:conduct, kyc:review |
| `lender` | Lender / Institution | loans:monitor, risk:dashboard |
| `admin` | Platform Admin | *:all |

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only), `./utils/id` (generateId utility)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
