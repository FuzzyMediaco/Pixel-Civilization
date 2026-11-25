export interface StoreProduct {
  id: string;
  label: string;
  kind: "era" | "mode" | "subscription";
  usdCents: number;
  era?: string;
  mode?: string;
  messages?: number;
  budgetMicros?: number;
  includes: string[];
}
export interface StoreAccess {
  accountId: string | null;
  owned: string[];
  complimentary?: boolean;
  plan: string | null;
  providers: string[];
  readyStores: string[];
  webSubscriptionsReady?: boolean;
  pixBilling?: {
    state: "setup_open" | "invoice_open" | "active" | "processing" | "revoked" | "ended";
    productId?: string;
    setupUrl?: string;
    setupExpires?: number;
    cancelPending?: boolean;
    invoiceUrl?: string;
    renews: boolean;
    paidThrough: number | null;
  } | null;
  pixAdmission?: {
    native: boolean;
    tiers: Record<string, { available: boolean; reason: "available" | "wallet_capacity" | "providers_unavailable" | "billing_unavailable" }>;
  };
  usage: { messages: number; spendMicros: number; limit: number; budgetMicros: number; periodEnd: number };
  validUntil: number;
}
export const STORE_PRODUCTS: StoreProduct[];
export function productById(id: string): StoreProduct | undefined;
export function productForEra(era: string): string | undefined;
export function productForMode(mode: string): string | undefined;
export function canUseProduct(
  snapshot: StoreAccess | null | undefined,
  id: string | null | undefined,
): boolean;
