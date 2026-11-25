import {
  GATEWAY_MODELS,
  gatewayAccess,
  gatewayCanRun,
  checkGatewayBudget,
  invalidateGatewayBalance,
  runGateway,
} from "./pix-gateway.mjs";
import { capacitySql, capacityParams } from "./pix-capacity.mjs";
import { AccountError } from "./account-http.mjs";
import { currentSession } from "./accounts.mjs";
import { activeGrants, requireOrigin, requireStore, usageWindow, utf8 } from "./store-data.mjs";
import { productById } from "../src/game/storeCatalog.mjs";
import { handlePixRequest } from "./pix-requests.mjs";

// USD per million input/output tokens. Cost is stored in millionths of a dollar.
export const PIX_MODELS = {
  openai: {
    key: "OPENAI_API_KEY",
    model: "gpt-6-luna",
    label: "GPT-6 Luna",
    input: 0.1,
    output: 0.5,
    cached: 0.01,
    cacheWrite: 0.125,
  },
  anthropic: {
    key: "ANTHROPIC_API_KEY",
    model: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    input: 1,
    output: 5,
    cached: 0.1,
    cacheWrite: 1.25,
  },
  gemini: {
    key: "GEMINI_API_KEY",
    model: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    input: 0.1,
    output: 0.4,
    cached: 0.01,
  },
};
export async function enabledModels(env) {
  const gateway = await gatewayAccess(env);
  return Object.keys(PIX_MODELS).filter(
    (provider) =>
      env[PIX_MODELS[provider].key] ||
      gatewayCanRun(gateway, provider, minimumReservation(PIX_MODELS[provider])),
  );
}
const maxOutput = 4096;
function minimumReservation(config) {
  return maxOutput * config.output + 2048 * Math.max(config.input, config.cacheWrite ?? 0);
}
function schemaTypes(schema) {
  if (Array.isArray(schema)) return schema.map(schemaTypes);
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(
    Object.entries(schema).map(([k, v]) => [
      k,
      k === "type" && typeof v === "string" ? v.toLowerCase() : schemaTypes(v),
    ]),
  );
}
export function pixRequestSpec(provider, model, system, prompt, schema, key) {
  const lower = schemaTypes(schema);
  if (provider === "openai")
    return {
      url: "https://api.openai.com/v1/responses",
      headers: { Authorization: "Bearer " + key },
      body: {
        model,
        instructions: system + " Return one JSON object matching this schema: " + JSON.stringify(lower),
        // The Responses API also checks the input messages for an explicit JSON request.
        input: prompt + "\nReturn the requested JSON object.",
        store: false,
        reasoning: { effort: "none" },
        text: { format: { type: "json_object" } },
        max_output_tokens: maxOutput,
      },
      unpack: (data) => ({
        raw: data.output
          ?.flatMap((item) => item.content ?? [])
          .filter((part) => part.type === "output_text")
          .map((part) => part.text)
          .join(""),
        input: data.usage?.input_tokens,
        output: data.usage?.output_tokens,
        cached: data.usage?.input_tokens_details?.cached_tokens,
        written: data.usage?.input_tokens_details?.cache_write_tokens,
      }),
    };
  if (provider === "anthropic")
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: {
        model,
        system,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxOutput,
        tools: [{ name: "city_response", description: "Return the game response.", input_schema: lower }],
        tool_choice: { type: "tool", name: "city_response" },
      },
      unpack: (data) => ({
        raw: data.content?.find((p) => p.type === "tool_use" && p.name === "city_response")?.input,
        input:
          data.usage?.input_tokens == null
            ? undefined
            : data.usage.input_tokens +
              (data.usage.cache_creation_input_tokens ?? 0) +
              (data.usage.cache_read_input_tokens ?? 0),
        cached: data.usage?.cache_read_input_tokens,
        written: data.usage?.cache_creation_input_tokens,
        output: data.usage?.output_tokens,
      }),
    };
  return {
    url: "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
    headers: { "x-goog-api-key": key },
    body: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxOutput,
        responseMimeType: "application/json",
        responseSchema: schema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
    unpack: (data) => ({
      raw: data.candidates?.[0]?.content?.parts
        ?.filter((p) => p.text && !p.thought)
        .map((p) => p.text)
        .join(""),
      input: data.usageMetadata?.promptTokenCount,
      cached: data.usageMetadata?.cachedContentTokenCount,
      output: (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0),
    }),
  };
}
export async function reserveGeneration(
  db,
  user,
  id,
  grant,
  provider,
  worst,
  now = Date.now(),
  model = PIX_MODELS[provider].model,
  gateway = null,
) {
  const product = productById(grant.product_id),
    [start, end] = usageWindow(grant, now);
  // Reserve against one shared observed wallet as well as the player's plan. Keep recently
  // completed binding requests in the estimate while provider debits propagate.
  const gatewaySum = `SELECT COALESCE(SUM(cost_micros),0) AS committed FROM game_pix_usage
    WHERE model IN (?,?,?) AND state!='failed' AND (state='reserved' OR started_at>=?)`;
  // A complimentary request can use only the balance left after paying players' allowances.
  const sharedCapacity = gateway && grant.store === "complimentary";
  const discretionaryWhere = sharedCapacity ? " AND (SELECT available FROM capacity)>=?" : "";
  const gatewayWhere = gateway ? " AND (" + gatewaySum + ")+?<=?" : "";
  const gatewayParams = gateway
    ? [...Object.values(GATEWAY_MODELS), gateway.checkedAt - 120000, worst, gateway.availableMicros]
    : [];
  const row = await db
    .prepare(
      (sharedCapacity ? capacitySql : "") +
        `INSERT INTO game_pix_usage(user_id,request_key,started_at,provider,model,state,cost_micros)
    SELECT ?,?,?,?,?,'reserved',? WHERE (SELECT COUNT(*) FROM game_pix_usage WHERE user_id=? AND started_at>=? AND started_at<? AND state!='failed') < ?
    AND (SELECT COALESCE(SUM(cost_micros),0) FROM game_pix_usage WHERE user_id=? AND started_at>=? AND started_at<? AND state!='failed')+? <= ?${gatewayWhere}${discretionaryWhere}
    ON CONFLICT(user_id,request_key) DO NOTHING RETURNING request_key`,
    )
    .bind(
      ...(sharedCapacity ? capacityParams(gateway, now) : []),
      user,
      id,
      now,
      provider,
      model,
      worst,
      user,
      start,
      end,
      product.messages,
      user,
      start,
      end,
      worst,
      product.budgetMicros,
      ...gatewayParams,
      ...(sharedCapacity ? [worst] : []),
    )
    .first();
  if (!row) {
    const duplicate = await db
      .prepare("SELECT state FROM game_pix_usage WHERE user_id=? AND request_key=?")
      .bind(user, id)
      .first();
    if (duplicate)
      throw new AccountError(
        409,
        "This Pix request has already been submitted. Send a new request to generate again.",
        "duplicate_generation",
      );
    if (sharedCapacity) {
      const capacity = await db
        .prepare(capacitySql + "SELECT available FROM capacity")
        .bind(...capacityParams(gateway, now))
        .first();
      requireStore(
        capacity.available >= worst,
        503,
        "Pix is waiting for available gateway credits.",
        "provider_unavailable",
      );
    }
    if (gateway) {
      const row = await db
        .prepare(gatewaySum)
        .bind(...Object.values(GATEWAY_MODELS), gateway.checkedAt - 120000)
        .first();
      requireStore(
        row.committed + worst <= gateway.availableMicros,
        503,
        "Pix is waiting for available gateway credits.",
        "provider_unavailable",
      );
    }
    throw new AccountError(
      429,
      "Your plan has reached its message or model-cost allowance for this billing period.",
      "quota_reached",
    );
  }
}
async function paidClient(env, request, provider) {
  const config = PIX_MODELS[provider];
  const viaGateway = Boolean(config && !env[config.key]);
  const access = viaGateway ? await gatewayAccess(env) : null;
  requireStore(
    config && (!viaGateway || gatewayCanRun(access, provider, minimumReservation(config))),
    503,
    "This Pix provider is currently unavailable.",
    "provider_unavailable",
  );
  const db = env.GAME_ACCOUNTS,
    session = await currentSession(db, request);
  requireStore(session, 401, "Sign in to use your Pix plan.", "unauthorized");
  const expected = request.headers.get("X-Game-Account");
  requireStore(
    !expected || session.user.id === expected,
    409,
    "The signed-in account changed.",
    "account_changed",
  );
  const user = session.user.id,
    grant = (await activeGrants(db, user)).plan;
  requireStore(grant, 402, "A Pix subscription is required for this provider.", "plan_required");
  const requestId = request.headers.get("Idempotency-Key") || crypto.randomUUID();
  requireStore(/^[A-Za-z0-9_-]{8,100}$/.test(requestId), 400, "Invalid Pix request ID.", "bad_request");
  return {
    modelId: config.model,
    modelLabel: config.label,
    async generate(system, prompt, schema) {
      const spec = pixRequestSpec(provider, config.model, system, prompt, schema, env[config.key]),
        body = JSON.stringify(spec.body);
      // UTF-8 byte count plus protocol overhead bounds input conservatively. Release the difference on settlement.
      const worst = Math.ceil(
        (utf8(body).length + 2048) * Math.max(config.input, config.cacheWrite ?? 0) +
          maxOutput * config.output,
      );
      if (viaGateway) checkGatewayBudget(access, worst);
      await reserveGeneration(
        db,
        user,
        requestId,
        grant,
        provider,
        worst,
        Date.now(),
        viaGateway ? GATEWAY_MODELS[provider] : config.model,
        access,
      );
      const settle = async (state, cost, input = 0, output = 0) =>
        db
          .prepare(
            "UPDATE game_pix_usage SET state=?,cost_micros=?,input_tokens=?,output_tokens=? WHERE user_id=? AND request_key=? AND state='reserved'",
          )
          .bind(state, cost, input, output, user, requestId)
          .run();
      let response;
      try {
        const signal = AbortSignal.timeout(85000);
        response = viaGateway
          ? await runGateway(env, provider, spec.body, signal)
          : await fetch(spec.url, {
              method: "POST",
              headers: { ...spec.headers, "Content-Type": "application/json" },
              body,
              signal,
            });
      } catch {
        throw new AccountError(
          502,
          "The model timed out before reporting usage. Try again later.",
          "provider_timeout",
        );
      }
      if (!response.ok) {
        if (viaGateway && response.status === 402) invalidateGatewayBalance(env);
        await settle("failed", 0);
        throw new AccountError(
          502,
          "The model provider declined this generation. Your allowance was restored.",
          "provider_error",
        );
      }
      const result = spec.unpack(await response.json());
      if (
        Number.isSafeInteger(result.input) &&
        result.input >= 0 &&
        Number.isSafeInteger(result.output) &&
        result.output >= 0
      ) {
        const cached = Math.min(result.input, Math.max(0, Number(result.cached) || 0));
        const written = Math.min(result.input - cached, Math.max(0, Number(result.written) || 0));
        const ordinary = result.input - cached - written;
        const cost =
          ordinary * config.input +
          cached * (config.cached ?? config.input) +
          written * (config.cacheWrite ?? config.input) +
          result.output * config.output;
        await settle("settled", Math.ceil(cost), result.input, result.output);
      }
      const data = typeof result.raw === "string" ? JSON.parse(result.raw) : result.raw;
      requireStore(
        data && typeof data === "object" && !Array.isArray(data),
        502,
        "The model returned an unreadable design.",
        "model_format",
      );
      return data;
    },
  };
}
export async function pixWithPlans(request, env, freeClient) {
  try {
    const path = new URL(request.url).pathname;
    if (path === "/api/pix/status" && request.method === "GET") {
      const providers = await enabledModels(env);
      return Response.json(
        {
          ok: true,
          configured: Boolean(freeClient || providers.length),
          connectedModel: freeClient?.modelId ?? null,
          modelLabel: freeClient?.modelLabel ?? "Pix subscription",
          providers: [...(freeClient ? ["free"] : []), ...providers],
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    requireOrigin(request);
    const provider = request.headers.get("X-Pix-Provider") || "free";
    if (provider === "free") return handlePixRequest(request, freeClient);
    requireStore(Object.hasOwn(PIX_MODELS, provider), 400, "Unknown Pix provider.", "bad_provider");
    return await handlePixRequest(request, await paidClient(env, request, provider));
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof AccountError ? error.message : "Pix is currently unavailable.",
        code: error.code ?? "unavailable",
      },
      {
        status: error instanceof AccountError ? error.status : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
