import { AccountError } from "./account-http.mjs";
import { DAY, importPrivate, recordPurchase, requireStore, signJwt } from "./store-data.mjs";
import { productById } from "../src/game/storeCatalog.mjs";

const APP = "app.pixelcivilization.game";
const googleApi = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/";
const googleTokens = new Map();
const required = (value) =>
  requireStore(
    value,
    503,
    "Store verification is unavailable. Your purchase can be restored later.",
    "store_unavailable",
  );
export function activeNativeStores(env) {
  return [
    ...(env.APPLE_IAP_KEY && env.APPLE_IAP_KEY_ID && env.APPLE_IAP_ISSUER ? ["apple"] : []),
    ...(env.GOOGLE_PLAY_SERVICE_ACCOUNT ? ["google"] : []),
  ];
}
async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
  if (response.status === 404 || response.status === 410)
    throw new AccountError(404, "The store could not find that purchase.", "no_receipt");
  if (!response.ok)
    throw new AccountError(
      503,
      "The store could not confirm that purchase. Try Restore again.",
      "store_unavailable",
    );
  return response.status === 204 ? {} : response.json();
}
async function googleAccess(env) {
  required(env.GOOGLE_PLAY_SERVICE_ACCOUNT);
  const credentials = JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT);
  const cached = googleTokens.get(credentials.private_key_id);
  if (cached && cached.until > Date.now()) return cached.token;
  const now = Math.floor(Date.now() / 1000),
    aud = "https://oauth2.googleapis.com/token";
  const key = await importPrivate(credentials.private_key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" });
  const assertion = await signJwt(
    { alg: "RS256", typ: "JWT", kid: credentials.private_key_id },
    {
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud,
      iat: now,
      exp: now + 900,
    },
    key,
    "RSASSA-PKCS1-v1_5",
  );
  const token = await jsonRequest(aud, {
    method: "POST",
    body: new URLSearchParams({ assertion, grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer" }),
  });
  required(typeof token.access_token === "string");
  googleTokens.set(credentials.private_key_id, {
    token: token.access_token,
    until: Date.now() + Math.max(0, token.expires_in - 120) * 1000,
  });
  return token.access_token;
}
export async function checkGoogle(env, receipt, user, checked) {
  const product = productById(receipt.productId),
    token = receipt.purchaseToken;
  requireStore(
    product && typeof token === "string" && token.length >= 8 && token.length < 4096,
    400,
    "Invalid Google purchase details.",
    "bad_receipt",
  );
  const headers = { Authorization: "Bearer " + (await googleAccess(env)) };
  const base = googleApi + encodeURIComponent(env.ANDROID_APP_ID || APP) + "/purchases/";
  const encoded = encodeURIComponent(token),
    isPlan = product.kind === "subscription";
  const url = (isPlan ? "subscriptionsv2/tokens/" : "productsv2/tokens/") + encoded;
  const purchase = await jsonRequest(base + url, { headers });
  const testPurchase = isPlan ? Boolean(purchase.testPurchase) : Boolean(purchase.testPurchaseContext);
  requireStore(
    !testPurchase || env.GOOGLE_PLAY_ALLOW_TEST_PURCHASES === "true",
    403,
    "Use the store testing environment for this purchase.",
    "test_store",
  );
  const owner = isPlan
    ? purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId
    : purchase.obfuscatedExternalAccountId;
  requireStore(owner === user, 403, "Sign in to the game account used at checkout.", "receipt_owner");
  const lines = isPlan ? purchase.lineItems : purchase.productLineItem;
  const line = lines?.find((item) => item.productId === product.id);
  requireStore(
    line,
    409,
    "This token belongs to another store product. Restore the current purchase.",
    "wrong_product",
  );
  const payState = purchase.purchaseStateContext?.purchaseState;
  const pending = isPlan
    ? purchase.subscriptionState === "SUBSCRIPTION_STATE_PENDING"
    : payState === "PENDING";
  requireStore(!pending, 409, "Payment is pending. Restore after payment completes.", "payment_pending");
  const end = isPlan ? Date.parse(line.expiryTime) : null;
  const start = isPlan ? Date.parse(purchase.startTime) : Date.parse(purchase.purchaseCompletionTime);
  const active = isPlan
    ? [
        "SUBSCRIPTION_STATE_ACTIVE",
        "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
        "SUBSCRIPTION_STATE_CANCELED",
      ].includes(purchase.subscriptionState) && end > checked
    : payState === "PURCHASED" && line.productOfferDetails?.refundableQuantity !== 0;
  requireStore(
    (!active || Number.isFinite(start)) && (!isPlan || Number.isFinite(end)),
    502,
    "The store returned an incomplete purchase.",
    "bad_store_data",
  );
  const acknowledged = purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
  return {
    entry: {
      store: "google",
      key: token,
      user,
      product: product.id,
      active,
      start: Number.isFinite(start) ? start : checked,
      end,
      checked,
      next: checked + 12 * 3600000,
      source: token,
    },
    replaced: isPlan ? purchase.linkedPurchaseToken : null,
    async acknowledge() {
      if (!active || acknowledged) return;
      const path =
        (isPlan ? "subscriptions/" : "products/") + product.id + "/tokens/" + encoded + ":acknowledge";
      const res = await fetch(base + path, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(12000),
      });
      required(res.ok);
    },
  };
}
// Only decode JWS data fetched directly from an authenticated, fixed Apple HTTPS endpoint.
// The client supplies a transaction ID. Its signed payload and claimed entitlements are never accepted as evidence.
function applePayload(signed) {
  const parts = typeof signed === "string" ? signed.split(".") : [];
  requireStore(parts.length === 3, 502, "Apple returned incomplete transaction data.", "bad_store_data");
  try {
    return JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
      ),
    );
  } catch {
    throw new AccountError(502, "Apple returned unreadable transaction data.", "bad_store_data");
  }
}
export async function checkApple(env, receipt, user, checked) {
  required(activeNativeStores(env).includes("apple"));
  const id = receipt.transactionId;
  requireStore(
    typeof id === "string" && /^\d{1,32}$/.test(id),
    400,
    "Invalid Apple transaction number.",
    "bad_receipt",
  );
  const bundle = env.IOS_APP_ID || APP,
    now = Math.floor(checked / 1000);
  const key = await importPrivate(env.APPLE_IAP_KEY, { name: "ECDSA", namedCurve: "P-256" });
  const auth = await signJwt(
    { alg: "ES256", kid: env.APPLE_IAP_KEY_ID, typ: "JWT" },
    { iss: env.APPLE_IAP_ISSUER, iat: now, exp: now + 300, aud: "appstoreconnect-v1", bid: bundle },
    key,
    { name: "ECDSA", hash: "SHA-256" },
  );
  // Isolate test purchases in a separate Worker/database. Never fall back from production to the sandbox.
  const sandbox = env.APPLE_STORE_ENV === "Sandbox";
  const base =
    "https://" + (sandbox ? "api.storekit-sandbox.apple.com" : "api.storekit.apple.com") + "/inApps/v1/";
  const get = (path) => jsonRequest(base + path, { headers: { Authorization: "Bearer " + auth } });
  let tx = applePayload((await get("transactions/" + id)).signedTransactionInfo);
  const original = tx.originalTransactionId;
  requireStore(
    tx.transactionId === id && /^\d{1,32}$/.test(original),
    400,
    "Unrecognized Apple transaction.",
    "bad_receipt",
  );
  const validate = (t) =>
    requireStore(
      t.bundleId === bundle &&
        t.environment === (sandbox ? "Sandbox" : "Production") &&
        t.appAccountToken?.toLowerCase() === user &&
        t.originalTransactionId === original,
      403,
      "Sign in to the game account used at checkout.",
      "receipt_owner",
    );
  validate(tx);
  requireStore(productById(tx.productId), 400, "Unknown Apple game product.", "wrong_product");
  let active = !tx.revocationDate,
    end = null;
  if (productById(tx.productId).kind === "subscription") {
    const account = await get("subscriptions/" + original);
    const last = account.data
      ?.flatMap((group) => group.lastTransactions ?? [])
      .find((item) => item.originalTransactionId === original);
    requireStore(last, 502, "Apple has not supplied the subscription status.", "bad_store_data");
    tx = applePayload(last.signedTransactionInfo);
    validate(tx);
    requireStore(
      productById(tx.productId)?.kind === "subscription",
      400,
      "Unknown Apple subscription.",
      "wrong_product",
    );
    end = Number(tx.expiresDate);
    if (last.status === 4 && last.signedRenewalInfo)
      end = Number(applePayload(last.signedRenewalInfo).gracePeriodExpiresDate ?? end);
    active = !tx.revocationDate && [1, 4].includes(last.status) && end > checked;
  }
  requireStore(
    Number.isFinite(tx.purchaseDate) && (end === null || Number.isFinite(end)),
    502,
    "Apple returned incomplete dates.",
    "bad_store_data",
  );
  return {
    entry: {
      store: "apple",
      key: original,
      user,
      product: tx.productId,
      active,
      start: tx.purchaseDate,
      end,
      checked,
      next: checked + 12 * 3600000,
      source: original,
    },
  };
}
export async function verifyNative(env, receipt, user) {
  const checked = Date.now();
  requireStore(
    receipt.platform === "apple" || receipt.platform === "google",
    400,
    "Choose an installed store.",
    "bad_store",
  );
  const record = await (receipt.platform === "apple" ? checkApple : checkGoogle)(env, receipt, user, checked);
  const db = env.GAME_ACCOUNTS;
  await recordPurchase(db, record.entry);
  if (record.replaced && record.entry.active)
    await db
      .prepare(
        "UPDATE game_purchases SET active=0,refresh_at=?,checked_at=? WHERE store='google' AND receipt_key=? AND user_id=?",
      )
      .bind(checked + 365 * DAY, checked, record.replaced, user)
      .run();
  await record.acknowledge?.();
  return record.entry;
}
export async function refreshNative(env, user = null) {
  const db = env.GAME_ACCOUNTS,
    now = Date.now();
  const due = user
    ? await db
        .prepare(
          "SELECT * FROM game_purchases WHERE user_id=? AND store IN ('apple','google') AND refresh_at<=? ORDER BY refresh_at LIMIT 4",
        )
        .bind(user, now)
        .all()
    : await db
        .prepare(
          "SELECT * FROM game_purchases WHERE store IN ('apple','google') AND refresh_at<=? ORDER BY refresh_at LIMIT 8",
        )
        .bind(now)
        .all();
  for (const row of due.results) {
    try {
      await verifyNative(
        env,
        {
          platform: row.store,
          productId: row.product_id,
          transactionId: row.source,
          purchaseToken: row.source,
        },
        row.user_id,
      );
    } catch (error) {
      // Store outages expire the online grant after its short lease. A definitive removal revokes immediately.
      if (error.code === "no_receipt")
        await db
          .prepare("UPDATE game_purchases SET active=0 WHERE store=? AND receipt_key=? AND checked_at<=?")
          .bind(row.store, row.receipt_key, now)
          .run();
      await db
        .prepare("UPDATE game_purchases SET refresh_at=? WHERE store=? AND receipt_key=? AND checked_at<=?")
        .bind(now + 3600000, row.store, row.receipt_key, now)
        .run();
    }
  }
}
