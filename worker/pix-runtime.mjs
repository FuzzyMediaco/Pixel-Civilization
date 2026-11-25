// Existing Pix service recovered from Cloudflare deployment 7b6a3964-23a0-46a8-bd95-4340202bf72c.
import { DurableObject as G } from "cloudflare:workers";
import { PixLimit } from "./pix-requests.mjs";
import { pixWithPlans } from "./pix-plans.mjs";
var T = "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  b = 30,
  k = 6,
  v = class extends G {
    async fetch(t) {
      let o = Math.floor(Date.now() / 36e5),
        e = Math.floor(o / 24),
        { ipKey: i } = await t.json(),
        n = this.ctx.storage,
        c = n.transactionSync(() => {
          let s = n.sql;
          (s.exec(
            "CREATE TABLE IF NOT EXISTS counters (bucket TEXT PRIMARY KEY, expires INTEGER NOT NULL, used INTEGER NOT NULL)",
          ),
            s.exec("DELETE FROM counters WHERE expires <= ?", o));
          let y = "day:" + e,
            p = "ip:" + o + ":" + i,
            a = (d) =>
              Number(
                s
                  .exec("SELECT used FROM counters WHERE bucket = ?", d)
                  .toArray()[0]?.used ?? 0,
              );
          if (a(y) >= b || a(p) >= k) return !1;
          for (let [d, u] of [
            [y, (e + 1) * 24],
            [p, o + 1],
          ])
            s.exec(
              "INSERT INTO counters VALUES (?, ?, 1) ON CONFLICT(bucket) DO UPDATE SET used = used + 1",
              d,
              u,
            );
          return !0;
        });
      return new Response(null, { status: c ? 204 : 429 });
    }
  };
function f(r) {
  return Array.isArray(r)
    ? r.map(f)
    : !r || typeof r != "object"
      ? r
      : Object.fromEntries(
          Object.entries(r).map(([t, o]) => [
            t,
            t === "type" && typeof o == "string" ? o.toLowerCase() : f(o),
          ]),
        );
}
function S(r, t) {
  return {
    modelId: T,
    modelLabel: "Llama 3.3 \xB7 Cloudflare Workers AI",
    async generate(o, e, i) {
      let n = t.headers.get("CF-Connecting-IP") ?? "unknown",
        c = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(n)),
        s = Array.from(new Uint8Array(c), (u) =>
          u.toString(16).padStart(2, "0"),
        ).join(""),
        p = await r.PIX_BUDGET.get(r.PIX_BUDGET.idFromName("public-pix")).fetch(
          new Request("https://pix-budget.internal/reserve", {
            method: "POST",
            body: JSON.stringify({ ipKey: s }),
          }),
        );
      if (p.status === 429)
        throw new PixLimit("Pix has reached its generation limit. Try again later.");
      if (!p.ok) throw new Error("Pix generation budget unavailable");
      let a = await r.AI.run(T, {
          messages: [
            { role: "system", content: o },
            { role: "user", content: e },
          ],
          response_format: { type: "json_schema", json_schema: f(i) },
          max_tokens: 4096,
        }).catch((u) => {
          throw (
            console.error(
              "Workers AI inference failed",
              u instanceof Error ? u.message.slice(0, 240) : "Unknown error",
            ),
            u
          );
        }),
        d = a.response ?? a.choices?.[0]?.message?.content;
      return typeof d == "string" ? JSON.parse(d) : d;
    },
  };
}
var C = {
  async fetch(r, t) {
    let o = new URL(r.url).pathname;
    return o === "/api/health"
      ? Response.json(
          { ok: !0, app: "Pixel Civilization", sourceCommit: t.SOURCE_COMMIT },
          { headers: { "cache-control": "no-store" } },
        )
      : o.startsWith("/api/pix/")
        ? pixWithPlans(r, t, t.AI && t.PIX_BUDGET ? S(t, r) : null)
        : o.startsWith("/api/")
          ? Response.json({ ok: !1, error: "Not found." }, { status: 404 })
          : o === "/"
            ? t.ASSETS.fetch(new Request(new URL("/index.html", r.url), r))
            : t.ASSETS.fetch(r);
  },
};
export { v as PixBudget, C as default };
