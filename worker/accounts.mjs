import { AccountError, json, readJson } from "./account-http.mjs";
// All persisted times are Unix milliseconds. Web, Android and desktop use same-origin cookies.
import { readSave, writeSave, listSaves } from "./saves.mjs";

const DAY = 86_400_000;
const SESSION_LIFETIME = 30 * DAY;
const SESSION_COOKIE = "__Host-pixel_session";
const PBKDF2_ITERATIONS = 100_000;
const AUTH_WINDOW = 10 * 60_000;
const encoder = new TextEncoder();

const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
const fromHex = text => Uint8Array.from(text.match(/../g) ?? [], byte => parseInt(byte, 16));
const randomHex = length => hex(crypto.getRandomValues(new Uint8Array(length)));
const digest = async text => hex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(salt), iterations: PBKDF2_ITERATIONS }, key, 256));
}

function matchesHash(actual, expected) {
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

function cookie(token, maxAge) {
  return SESSION_COOKIE + "=" + token + "; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=" + maxAge;
}

function sessionToken(request) {
  const match = (request.headers.get("Cookie") ?? "").match(/(?:^|;\s*)__Host-pixel_session=([0-9a-f]{64})(?:;|$)/);
  return match?.[1];
}

async function currentSession(db, request) {
  const token = sessionToken(request);
  if (!token) return null;
  const tokenHash = await digest(token);
  const user = await db.prepare(`SELECT game_users.id, game_users.email, game_sessions.expires_at FROM game_sessions
    JOIN game_users ON game_users.id = game_sessions.user_id
    WHERE token_hash = ? AND expires_at > ?`).bind(tokenHash, Date.now()).first();
  if (!user) return null;
  const { expires_at, ...profile } = user;
  return { user: profile, tokenHash, token, expiresAt: expires_at };
}

async function countAttempts(db, request, email, action) {
  const window = Math.floor(Date.now() / AUTH_WINDOW) * AUTH_WINDOW;
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const subjects = await Promise.all([digest(action + ":ip:" + ip), digest(action + ":email:" + email)]);
  const statements = subjects.map(subject => db.prepare(`INSERT INTO game_auth_attempts(subject,window_start,attempts)
    VALUES(?,?,1) ON CONFLICT(subject,window_start) DO UPDATE SET attempts=attempts+1 RETURNING attempts`).bind(subject, window));
  statements.push(db.prepare("DELETE FROM game_auth_attempts WHERE window_start < ?").bind(window));
  const [byIp, byEmail] = await db.batch(statements);
  if (byIp.results[0].attempts > (action === "register" ? 16 : 100) || byEmail.results[0].attempts > 20) {
    throw new AccountError(429, "Too many attempts. Try again in a few minutes.", "try_later");
  }
}

async function authenticate(db, request, action) {
  const body = await readJson(request, 4096);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body.password;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AccountError(400, "Enter a valid email address.", "invalid_email");
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 256) {
    throw new AccountError(400, "Use a password between 8 and 256 characters.", "invalid_password");
  }
  await countAttempts(db, request, email, action);

  const now = Date.now();
  const token = randomHex(32);
  const tokenHash = await digest(token);
  let user;
  const statements = [];
  if (action === "register") {
    const id = crypto.randomUUID();
    const salt = randomHex(16);
    const hash = await passwordHash(password, salt);
    user = { id, email };
    statements.push(db.prepare(`INSERT INTO game_users(id,email,password_salt,password_hash,created_at)
      VALUES(?,?,?,?,?) ON CONFLICT(email) DO NOTHING RETURNING id`).bind(id, email, salt, hash, now));
  } else {
    const row = await db.prepare("SELECT id,email,password_hash,password_salt FROM game_users WHERE email=?").bind(email).first();
    const hash = await passwordHash(password, row?.password_salt ?? "998d558508d0313d036b736d8e5e3b24");
    if (!row || !matchesHash(hash, row.password_hash)) {
      throw new AccountError(401, "Email or password is incorrect.", "invalid_credentials");
    }
    user = { id: row.id, email: row.email };
  }
  statements.push(db.prepare(`INSERT INTO game_sessions(token_hash,user_id,expires_at)
    SELECT ?,id,? FROM game_users WHERE id=?`).bind(tokenHash, now + SESSION_LIFETIME, user.id));
  statements.push(db.prepare("DELETE FROM game_sessions WHERE expires_at <= ?").bind(now));
  const result = await db.batch(statements);
  if (action === "register" && !result[0].results.length) {
    throw new AccountError(409, "An account already uses this email. Try signing in.", "email_taken");
  }
  return json({ user }, action === "register" ? 201 : 200, { "Set-Cookie": cookie(token, SESSION_LIFETIME / 1000) });
}

function requireMethod(request, expected) {
  if (request.method !== expected) throw new AccountError(405, "Unsupported method.", "method");
}

export async function accountRequest(request, env) {
  try {
    const url = new URL(request.url);
    if (!["GET", "HEAD"].includes(request.method)) {
      const origin = request.headers.get("Origin");
      if ((origin && origin !== url.origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") {
        throw new AccountError(403, "Open the game to make this change.", "origin");
      }
    }
    const db = env.GAME_ACCOUNTS;
    if (!db) throw new AccountError(503, "Account storage is unavailable.", "unavailable");
    const path = url.pathname.slice("/api/account/".length);
    if (path === "register" || path === "login") {
      requireMethod(request, "POST");
      return await authenticate(db, request, path);
    }
    const session = await currentSession(db, request);
    const expected = request.headers.get("X-Game-Account");
    if (session && expected && session.user.id !== expected) {
      throw new AccountError(409, "The signed-in account changed.", "account_changed");
    }
    if (path === "me") {
      requireMethod(request, "GET");
      const now = Date.now();
      if (session && session.expiresAt - now < 7 * DAY) {
        const refreshed = await db.prepare("UPDATE game_sessions SET expires_at=? WHERE token_hash=? AND expires_at>? RETURNING token_hash")
          .bind(now + SESSION_LIFETIME, session.tokenHash, now).first();
        if (refreshed) return json({ user: session.user }, 200, { "Set-Cookie": cookie(session.token, SESSION_LIFETIME / 1000) });
        return json({ user: null });
      }
      return json({ user: session?.user ?? null });
    }
    if (path === "logout") {
      requireMethod(request, "POST");
      if (session) await db.prepare("DELETE FROM game_sessions WHERE token_hash=?").bind(session.tokenHash).run();
      return json({ user: null }, 200, { "Set-Cookie": cookie("", 0) });
    }
    if (path !== "saves" && !path.startsWith("saves/")) throw new AccountError(404, "Unknown account page.", "not_found");
    if (!session) throw new AccountError(401, "Sign in to access cloud saves.", "unauthorized");
    if (path === "saves") {
      requireMethod(request, "GET");
      return await listSaves(db, session.user.id);
    }
    let key;
    try { key = decodeURIComponent(path.slice("saves/".length)); } catch { key = ""; }
    if (!key || key.length > 160 || /[\u0000-\u001f\u007f]/.test(key)) {
      throw new AccountError(400, "Invalid save name.", "invalid_key");
    }
    if (request.method === "GET") return await readSave(db, session.user.id, key, url.searchParams.get("previous") === "1");
    if (request.method === "PUT" || request.method === "DELETE") return await writeSave(db, session.user.id, key, request);
    throw new AccountError(405, "Unsupported method.", "method");
  } catch (error) {
    if (error instanceof AccountError) return json({ error: error.message, code: error.code, ...error.extra }, error.status);
    console.error("Account storage request failed", error?.name ?? "Error");
    return json({ error: "Could not reach cloud saves. Your device can keep playing.", code: "storage_unavailable" }, 503);
  }
}
