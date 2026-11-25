import { requireStore } from "./store-data.mjs";

// These are Cloudflare catalog IDs. Provider-native requests use the IDs and schemas in pix-plans.
export const GATEWAY_MODELS = Object.freeze({
  openai: "openai/gpt-6-luna",
  anthropic: "anthropic/claude-haiku-4.5",
  gemini: "google/gemini-2.5-flash-lite",
});

const balances = new WeakMap();
const cacheMs = 30000;

function verifiedModels(env) {
  return new Set((env.PIX_GATEWAY_VERIFIED_MODELS || "").split(",").map((value) => value.trim()));
}

export async function gatewayAccess(env, force = false) {
  const verified = verifiedModels(env);
  if (
    !env.AI?.run ||
    !/^[a-f0-9]{32}$/.test(env.PIX_GATEWAY_ACCOUNT || "") ||
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(env.PIX_GATEWAY_ID || "") ||
    !env.PIX_GATEWAY_READ_TOKEN ||
    !Object.values(GATEWAY_MODELS).some((model) => verified.has(model))
  )
    return null;
  const cached = balances.get(env);
  if (!force && cached && cached.expires > Date.now()) return cached.result;
  // This read-only token only checks credit availability. The Worker binding authenticates inference.
  const checkedAt = Date.now();
  const result = await (async () => {
    try {
      const response = await fetch(
        "https://api.cloudflare.com/client/v4/accounts/" +
          env.PIX_GATEWAY_ACCOUNT +
          "/ai-gateway/billing/credit-balance",
        {
          headers: { Authorization: "Bearer " + env.PIX_GATEWAY_READ_TOKEN },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) return null;
      const data = await response.json();
      const cents = data?.result?.balance;
      if (!data.success || !Number.isFinite(cents) || cents <= 0) return null;
      return { verified, checkedAt, availableMicros: Math.floor(cents * 10000) };
    } catch {
      return null;
    }
  })();
  balances.set(env, { expires: Date.now() + cacheMs, result });
  return result;
}

export function invalidateGatewayBalance(env) {
  balances.delete(env);
}

export function gatewayCanRun(access, provider, minimum = 0) {
  return Boolean(access?.verified.has(GATEWAY_MODELS[provider]) && access.availableMicros >= minimum);
}

export function runGateway(env, provider, body, signal) {
  // In the binding API the model is the first argument, not part of the input.
  const { model: _nativeModel, ...input } = body;
  return env.AI.run(GATEWAY_MODELS[provider], input, {
    gateway: { id: env.PIX_GATEWAY_ID, skipCache: true, collectLog: false },
    signal,
    returnRawResponse: true,
  });
}

export function checkGatewayBudget(access, costMicros) {
  requireStore(
    access && costMicros <= access.availableMicros,
    503,
    "Pix is waiting for its gateway credits to be replenished.",
    "provider_unavailable",
  );
}
