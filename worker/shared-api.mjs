import { currentSession } from "./accounts.mjs";
import { AccountError, json, readJson } from "./account-http.mjs";

export async function sharedRequest(request, env) {
  try {
    if (!env.SHARED_ISLANDS || !env.GAME_ACCOUNTS) throw new AccountError(503, "Shared islands are unavailable on this edition.", "unavailable");
    const url = new URL(request.url);
    const upgrade = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
    const origin = request.headers.get("Origin");
    if ((origin && origin !== url.origin) || (upgrade && origin !== url.origin) ||
        request.headers.get("Sec-Fetch-Site") === "cross-site") throw new AccountError(403, "Open Pixel Civilization to access this island.", "origin");
    const session = await currentSession(env.GAME_ACCOUNTS, request);
    if (!session) throw new AccountError(401, "Sign in to play together.", "unauthorized");

    const path = url.pathname.slice("/api/shared/".length);
    const db = env.GAME_ACCOUNTS;
    if (path === "rooms" && request.method === "GET") {
      const { results } = await db.prepare("SELECT room_id AS id,name,mode,role FROM game_shared_islands WHERE user_id=? ORDER BY joined_at DESC")
        .bind(session.user.id).all();
      return json({ rooms: results });
    }
    let match = /^rooms\/([a-f0-9-]{36})\/(join|room|socket|invite|member|export)$/.exec(path);
    let roomId = match?.[1], action = match?.[2], body;
    if (path === "rooms" && request.method === "POST") {
      body = await readJson(request, 4 * 1024 * 1024);
      if (body.world) body.world = JSON.parse(JSON.stringify(body.world), (key, value) =>
        key === "__proto__" || key === "constructor" || key === "prototype" ? undefined : value);
      if (typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/.test(body.requestId)) throw new AccountError(400, "Missing request ID.", "input");
      const { total } = await db.prepare("SELECT COUNT(*) AS total FROM game_shared_islands WHERE user_id=? AND role='owner'")
        .bind(session.user.id).first();
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(session.user.id + "/" + body.requestId));
      const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      roomId = hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20, 32);
      if (total >= 10 && !await db.prepare("SELECT 1 FROM game_shared_islands WHERE user_id=? AND room_id=?").bind(session.user.id, roomId).first()) {
        throw new AccountError(409, "You can own up to ten shared islands.", "limit");
      }
      action = "create";
    }
    if (!roomId || !action || !((action === "room" || action === "export" || action === "socket") ? request.method === "GET" : request.method === "POST")) {
      throw new AccountError(404, "Shared island action unavailable.", "not_found");
    }
    if (action === "create" || action === "join") {
      const { total } = await db.prepare("SELECT COUNT(*) AS total FROM game_shared_islands WHERE user_id=?").bind(session.user.id).first();
      if (total >= 30 && !await db.prepare("SELECT 1 FROM game_shared_islands WHERE user_id=? AND room_id=?").bind(session.user.id, roomId).first()) {
        throw new AccountError(409, "You have reached the shared island limit.", "limit");
      }
    }
    if (action === "socket" && !upgrade) throw new AccountError(426, "Open a live connection.", "upgrade");
    if (!body && request.method === "POST") body = await readJson(request, 4096);
    const requestedName = typeof body?.profile === "string" ? body.profile.trim().slice(0, 22) : "";
    const headers = new Headers({
      "x-player-id": session.user.id, "x-player-session": session.tokenHash,
      "x-player-expiry": String(session.expiresAt), "x-player-name": (requestedName || session.user.email.split("@")[0].slice(0, 22)).replace(/[^a-zA-Z0-9 _.-]/g, "") || "Player",
      "x-island-id": roomId,
      ...(upgrade ? { Upgrade: "websocket" } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    });
    const stub = env.SHARED_ISLANDS.get(env.SHARED_ISLANDS.idFromName(roomId));
    return await stub.fetch(new Request("https://shared-island.internal/" + action, {
      method: request.method, headers, body: body ? JSON.stringify(body) : undefined,
    }));
  } catch (error) {
    if (error instanceof AccountError) return json({ error: error.message, code: error.code }, error.status);
    console.error("Shared island request failed", error?.name);
    return json({ error: "The shared island service is temporarily unavailable." }, 503);
  }
}
