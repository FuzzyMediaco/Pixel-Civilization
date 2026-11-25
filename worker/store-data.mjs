import { AccountError } from "./account-http.mjs";
import { productById } from "../src/game/storeCatalog.mjs";

export const DAY = 86400000;
export const requireStore = (condition, status, message, code) => {
  if (!condition) throw new AccountError(status, message, code);
};
export const asId = (value) => (typeof value === "string" ? value : value?.id);
export const b64 = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
export const utf8 = (value) => new TextEncoder().encode(value);
export async function signJwt(header, claims, key, algorithm) {
  const content = [header, claims].map((item) => b64(utf8(JSON.stringify(item)))).join(".");
  return content + "." + b64(await crypto.subtle.sign(algorithm, key, utf8(content)));
}
export async function importPrivate(pem, algorithm) {
  const decoded = atob(pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----|\s/g, ""));
  return crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(decoded, (c) => c.charCodeAt(0)),
    algorithm,
    false,
    ["sign"],
  );
}
export function requireOrigin(request) {
  const origin = request.headers.get("Origin");
  requireStore(
    (!origin || origin === new URL(request.url).origin) &&
      request.headers.get("Sec-Fetch-Site") !== "cross-site",
    403,
    "Open the game to make this change.",
    "origin",
  );
}

export async function recordPurchase(db, entry) {
  const { store, key, user, product, active, start, end, checked, next, source } = entry;
  requireStore(productById(product), 400, "Unknown game product.", "unknown_product");
  const row = await db
    .prepare(
      `INSERT INTO game_purchases(store,receipt_key,user_id,product_id,active,period_start,expires_at,checked_at,refresh_at,source)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(store,receipt_key) DO UPDATE SET product_id=excluded.product_id,
    active=excluded.active,period_start=excluded.period_start,expires_at=excluded.expires_at,checked_at=excluded.checked_at,
    refresh_at=excluded.refresh_at,source=excluded.source WHERE game_purchases.user_id=excluded.user_id
    AND excluded.checked_at>=game_purchases.checked_at RETURNING user_id`,
    )
    .bind(store, key, user, product, active ? 1 : 0, start, end, checked, next, source)
    .first();
  if (!row) {
    const owner = await db
      .prepare("SELECT user_id FROM game_purchases WHERE store=? AND receipt_key=?")
      .bind(store, key)
      .first();
    requireStore(
      owner?.user_id === user,
      409,
      "This purchase belongs to a different game account.",
      "receipt_owner",
    );
  }
}
export async function activeGrants(db, user, now = Date.now()) {
  const rows = await db
    .prepare(
      `SELECT product_id,period_start,expires_at,checked_at,store FROM game_purchases
    WHERE user_id=? AND active=1 AND (expires_at IS NULL OR expires_at>?) AND (store NOT IN ('apple','google') OR checked_at>?)
    UNION ALL SELECT 'pix_complete',NULL,NULL,NULL,'complimentary' FROM game_complimentary_access WHERE user_id=?`,
    )
    .bind(user, now, now - 2 * DAY, user)
    .all();
  const permanent = rows.results.filter((r) => productById(r.product_id)?.kind !== "subscription");
  const plans = rows.results
    .filter((r) => productById(r.product_id)?.kind === "subscription")
    .sort(
      (a, b) =>
        Number(b.store === "complimentary") - Number(a.store === "complimentary") ||
        productById(b.product_id).usdCents - productById(a.product_id).usdCents ||
        b.expires_at - a.expires_at,
    );
  return { owned: [...new Set(permanent.map((r) => r.product_id))], plan: plans[0] };
}
export function usageWindow(grant, now = Date.now()) {
  if (grant.store === "complimentary") {
    const date = new Date(now);
    const year = date.getUTCFullYear(),
      month = date.getUTCMonth();
    return [Date.UTC(year, month, 1), Date.UTC(year, month + 1, 1)];
  }
  // Use the actual paid billing anniversary. The Google startTime can refer to the first signup.
  const end = grant.expires_at,
    date = new Date(end);
  if (end - grant.period_start <= 35 * DAY) return [Math.min(now, grant.period_start), end];
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  const maxDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, maxDay));
  return [Math.min(now, Math.max(grant.period_start, date.getTime())), end];
}
export async function getUsage(db, user, grant) {
  if (!grant) return { messages: 0, spendMicros: 0, limit: 0, budgetMicros: 0, periodEnd: 0 };
  const [start, end] = usageWindow(grant);
  const result = await db
    .prepare(
      `SELECT COUNT(*) AS messages,COALESCE(SUM(cost_micros),0) AS spendMicros
    FROM game_pix_usage WHERE user_id=? AND started_at>=? AND started_at<? AND state!='failed'`,
    )
    .bind(user, start, end)
    .first();
  const product = productById(grant.product_id);
  return { ...result, limit: product.messages, budgetMicros: product.budgetMicros, periodEnd: end };
}
export async function signAccess(env, snapshot) {
  if (!env.STORE_LEASE_SIGNING_JWK || !snapshot.accountId) return null;
  const key = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(env.STORE_LEASE_SIGNING_JWK),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  return signJwt(
    { alg: "ES256", typ: "JWT" },
    {
      aud: "pixel-civilization-offline",
      sub: snapshot.accountId,
      owned: snapshot.owned,
      plan: snapshot.plan,
      ...(snapshot.complimentary && { complimentary: true }),
      exp: Math.floor(snapshot.validUntil / 1000),
    },
    key,
    { name: "ECDSA", hash: "SHA-256" },
  );
}
