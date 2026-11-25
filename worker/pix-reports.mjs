import { AccountError, json, readJson } from "./account-http.mjs";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export async function expirePixReports(env) {
  if (env.GAME_ACCOUNTS) {
    const db = env.GAME_ACCOUNTS;
    await db.batch([
      db.prepare("DELETE FROM game_pix_reports WHERE created_at < ?").bind(Date.now() - 90 * DAY),
      db.prepare("DELETE FROM game_pix_report_limits WHERE window_start < ?").bind(Date.now() - 2 * HOUR),
    ]);
  }
}

export async function pixReport(request, env) {
  try {
    if (request.method !== "POST") return json({ error: "Send a report using the Pix menu." }, 405, { Allow: "POST" });
    if (request.headers.has("Origin") && request.headers.get("Origin") !== new URL(request.url).origin) {
      return json({ error: "Send the report from inside the game." }, 403);
    }
    const { id, kind, reason, excerpt } = await readJson(request, 20000);
    if (typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)
      || !["design","world","advice"].includes(kind) || !["inappropriate","harmful","other"].includes(reason)
      || typeof excerpt !== "string" || !excerpt.trim() || excerpt.length > 3000) {
      return json({ error: "Choose a reason and include part of the Pix result." }, 400);
    }
    const db = env.GAME_ACCOUNTS;
    const now = Date.now();
    const window = Math.floor(now / HOUR) * HOUR;
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("pix-report:" + window + ":" + ip));
    const subject = Array.from(new Uint8Array(bytes), v => v.toString(16).padStart(2, "0")).join("");
    // Only the hourly abuse counter is keyed to a network. Reports carry no account or network ID.
    const [counter, inserted] = await db.batch([
      db.prepare(`INSERT INTO game_pix_report_limits(subject,window_start,attempts)
        SELECT ?,?,1 WHERE NOT EXISTS (SELECT 1 FROM game_pix_reports WHERE id=?)
        ON CONFLICT(subject) DO UPDATE SET attempts=MIN(attempts+1,13) RETURNING attempts`).bind(subject,window,id),
      db.prepare(`INSERT INTO game_pix_reports(id,kind,reason,excerpt,created_at)
        SELECT ?,?,?,?,? WHERE (SELECT attempts FROM game_pix_report_limits WHERE subject=? AND window_start=?)<=12
        ON CONFLICT(id) DO NOTHING RETURNING id`).bind(id,kind,reason,excerpt.trim(),now,subject,window),
    ]);
    if (!inserted.results.length && counter.results[0]?.attempts > 12) {
      return json({ error: "Several reports have already been sent. Try again in an hour." }, 429);
    }
    return json({ received: true }, 200);
  } catch (error) {
    if (error instanceof AccountError) return json({ error: error.message }, error.status);
    return json({ error: "The report could not be saved. You can retry here." }, 503);
  }
}
