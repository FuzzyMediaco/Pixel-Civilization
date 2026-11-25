import { importLegacySlots } from "./legacy-modes.mjs";
import { AccountError, json, readJson } from "./account-http.mjs";
import { currentSession } from "./accounts.mjs";
import { activeGrants, DAY, getUsage, requireOrigin, requireStore, signAccess } from "./store-data.mjs";
import { activeNativeStores, verifyNative, refreshNative } from "./native-purchases.mjs";
import {
  checkout,
  keyCheckoutReady,
  portal,
  reconcileSession,
  stripeAvailable,
  stripeWebhook,
} from "./stripe-store.mjs";
import { cleanOrphanPayments, existingHostedPlan, recurringLinksReady, recurringSandbox } from "./stripe-recurring-links.mjs";
import { enabledModels } from "./pix-plans.mjs";
import { canUseProduct, productById } from "../src/game/storeCatalog.mjs";

async function snapshot(env, user, url) {
  const db = env.GAME_ACCOUNTS;
  if (user) {
    await importLegacySlots(db, user.id);
    await refreshNative(env, user.id);
  }
  const sandbox = recurringSandbox(env, url);
  const hosted = recurringLinksReady(env, url);
  const { owned, plan } = user ? await activeGrants(db, user.id, Date.now(), sandbox) : { owned: [], plan: null };
  const readyStores = activeNativeStores(env);
  if (stripeAvailable(env) || hosted) readyStores.push("stripe");
  const providers = await enabledModels(env);
  const access = {
    accountId: user?.id ?? null,
    owned,
    plan: plan?.product_id ?? null,
    usage: await getUsage(db, user?.id, plan),
    providers,
    readyStores,
    webSubscriptionsReady: (keyCheckoutReady(env) || hosted) && providers.length === 3,
    canManageHostedBilling: Boolean(user && sandbox && (await existingHostedPlan(db, user.id))),
    validUntil: Math.min(Date.now() + 7 * DAY, plan?.expires_at ?? Infinity),
  };
  return { ...access, lease: await signAccess(env, access) };
}
async function rateCheck(db, user) {
  const window = Math.floor(Date.now() / 600000);
  const row = await db
    .prepare(
      `INSERT INTO game_store_checks(user_id,window,attempts) VALUES(?,?,1) ON CONFLICT(user_id,window)
    DO UPDATE SET attempts=attempts+1 RETURNING attempts`,
    )
    .bind(user, window)
    .first();
  requireStore(row.attempts <= 80, 429, "Try again in a few minutes.", "try_later");
}
export async function commerceRequest(request, env) {
  try {
    const path = new URL(request.url).pathname.slice("/api/commerce/".length);
    requireStore(env.GAME_ACCOUNTS, 503, "The game store is unavailable.", "unavailable");
    if (path === "stripe/webhook" && request.method === "POST") return await stripeWebhook(request, env);
    requireOrigin(request);
    const session = await currentSession(env.GAME_ACCOUNTS, request),
      user = session?.user;
    const expected = request.headers.get("X-Game-Account");
    requireStore(
      !expected || user?.id === expected,
      409,
      "The signed-in account changed.",
      "account_changed",
    );
    if (path === "access" && request.method === "GET") return json(await snapshot(env, user, request.url));
    requireStore(request.method === "POST", 405, "Unsupported method.", "method");
    requireStore(user, 401, "Sign in to your game account first.", "unauthorized");
    await rateCheck(env.GAME_ACCOUNTS, user.id);
    const body = await readJson(request, 16384);
    if (path === "purchase") {
      await verifyNative(env, body, user.id);
      return json(await snapshot(env, user, request.url));
    }
    if (path === "checkout") {
      const sku = productById(body.productId);
      requireStore(sku, 400, "Unknown game product.", "bad_product");
      const access = await snapshot(env, user, request.url);
      if (sku.kind === "subscription")
        requireStore(
          access.providers.length === 3,
          503,
          "Pix subscriptions open when all three included providers are connected.",
          "providers_unavailable",
        );
      requireStore(!canUseProduct(access, sku.id), 409, "Your account already includes this item.", "owned");
      if (sku.kind === "subscription" && access.plan) {
        const grant = (await activeGrants(env.GAME_ACCOUNTS, user.id, Date.now(), recurringSandbox(env, request.url))).plan;
        if (grant.store === "stripe") return json(await portal(env, user, request.url));
        throw new AccountError(
          409,
          "Manage the existing plan in the store where you subscribed.",
          "manage_subscription",
        );
      }
      return json(await checkout(env, user, sku.id, request.url));
    }
    if (path === "checkout/complete") {
      requireStore(
        typeof body.sessionId === "string" && /^cs_[a-zA-Z0-9_]{8,220}$/.test(body.sessionId),
        400,
        "Invalid checkout session.",
        "bad_session",
      );
      await reconcileSession(env, body.sessionId, user.id, request.url);
      return json(await snapshot(env, user, request.url));
    }
    if (path === "portal") return json(await portal(env, user, request.url));
    throw new AccountError(404, "Unknown store page.", "not_found");
  } catch (error) {
    if (error instanceof AccountError) return json({ error: error.message, code: error.code }, error.status);
    console.error("Commerce request failed", error?.name ?? "error");
    return json(
      {
        error: "The game store could not finish this request. Your purchases can be restored.",
        code: "store_unavailable",
      },
      503,
    );
  }
}
export async function maintainCommerce(env) {
  if (!env.GAME_ACCOUNTS) return;
  await refreshNative(env);
  const db = env.GAME_ACCOUNTS,
    now = Date.now();
  if (env.STRIPE_RECURRING_LINKS_SANDBOX === "true") await cleanOrphanPayments(db, now);
  await db.batch([
    db.prepare("DELETE FROM game_store_checks WHERE window<?").bind(Math.floor(now / 600000) - 2),
    db.prepare("DELETE FROM game_stripe_events WHERE processed_at<?").bind(now - 60 * DAY),
    db.prepare("DELETE FROM game_pix_usage WHERE started_at<?").bind(now - 100 * DAY),
  ]);
}
