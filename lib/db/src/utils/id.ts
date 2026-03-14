const year = () => new Date().getFullYear();
const rand = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export function generateId(prefix: string): string {
  return `${prefix}-${year()}-${rand()}`;
}

export const USER_ID_PREFIX: Record<string, string> = {
  farmer:             "FMR",
  trader:             "TRD",
  warehouse_op:       "WH",
  checker:            "INS",
  lender:             "LND",
  admin:              "ADM",
  collateral_manager: "COL",
  processor:          "PRC",
};

export const ORG_ID_PREFIX: Record<string, string> = {
  cooperative:   "COP",
  processor:     "PRC",
  lender:        "BNK",
  trader:        "TRD",
  admin_entity:  "ADM",
};
