import { AccountError, json, readJson } from "./account-http.mjs";
import { recipientIslands, unpack } from "./island-gifts.mjs";
import { readSaveSnapshot } from "./saves.mjs";
import { activeGrants, DAY } from "./store-data.mjs";
import { productById } from "../src/game/storeCatalog.mjs";
import { giftDesignId } from "../src/game/giftDesignKeys.mjs";

const pageSize = 25;
const customLibrary = "pixel_civ_pix_custom_elements_v1";
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
const customPattern = /^custom_[a-z0-9_]{1,60}$/;
const notFound = () => new AccountError(404, "That player is no longer in the directory.", "player_not_found");

async function playerDirectory(db, body) {
  const { query = "", after = "" } = body;
  if (typeof query !== "string" || query.length > 254 || typeof after !== "string" || after.length > 254)
    throw new AccountError(400, "Enter a shorter search.", "invalid_search");
  // Account emails are unique and normalized at signup. A keyset cursor remains stable if a player leaves.
  const { results } = await db.prepare(`SELECT id,email FROM game_users
    WHERE email>? AND instr(email,?)>0 ORDER BY email LIMIT ?`)
    .bind(after, query.toLowerCase().trim(), pageSize + 1).all();
  const players = results.slice(0, pageSize);
  return { players, next: results.length > pageSize ? players[players.length - 1].email : null };
}

async function savedDesigns(db, user) {
  let raw;
  try { raw = (await readSaveSnapshot(db, user, customLibrary)).data; }
  catch (error) { if (error.code === "not_found") return []; throw error; }
  if (!raw) return [];
  let designs;
  try { designs = JSON.parse(await unpack(raw)); } catch { /* Show an actionable error for an unreadable library. */ }
  if (!Array.isArray(designs)) throw new AccountError(409, "Sync your Pix library and try again.", "library_unavailable");
  return designs.filter(d => d && typeof d.id === "string" && customPattern.test(d.id) &&
    typeof d.name === "string" && d.name.trim() && Array.isArray(d.boxes) && d.boxes.length);
}

async function recipientSummary(db, recipient) {
  const [{ owned, plan }, rewards] = await Promise.all([
    activeGrants(db, recipient.id),
    db.prepare(`SELECT kind,item_id AS itemId,label,expires_at AS expiresAt FROM game_account_rewards
      WHERE recipient_id=? AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC,id`)
      .bind(recipient.id, Date.now()).all()
  ]);
  return { player: recipient, owned, plan: plan?.product_id ?? null, rewards: rewards.results };
}

function receipt(row, issuer, intent, alreadyGiven) {
  if (row.issuer_id !== issuer || row.recipient_id !== intent.recipientId || row.kind !== intent.kind || row.item_id !== intent.itemId)
    throw new AccountError(409, "That receipt belongs to a different gift.", "receipt_conflict");
  return { label: row.label, expiresAt: row.expires_at, alreadyGiven };
}

async function giveReward(db, issuer, body) {
  const { kind, itemId, requestId, recipientId } = body;
  const sku = kind === "product" && productById(itemId);
  if (typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(requestId) ||
      !(sku || (kind === "design" && typeof itemId === "string" && customPattern.test(itemId))))
    throw new AccountError(400, "Choose a store item or a saved Pix design.", "invalid_reward");
  const byReceipt = () => db.prepare("SELECT issuer_id,recipient_id,kind,item_id,label,expires_at FROM game_account_rewards WHERE request_id=?").bind(requestId);
  const current = now => db.prepare(`SELECT issuer_id,recipient_id,kind,item_id,label,expires_at FROM game_account_rewards
    WHERE recipient_id=? AND kind=? AND item_id=? AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC LIMIT 1`)
    .bind(recipientId, kind, itemId, now);
  const prior = await byReceipt().first();
  if (prior) return receipt(prior, issuer, body, false);
  const now = Date.now();
  const existing = await current(now).first();
  if (existing) return receipt(existing, issuer, body, true);
  const id = crypto.randomUUID().replaceAll("-", "");
  let design = null;
  let label = sku?.label;
  if (kind === "design") {
    const spec = (await savedDesigns(db, issuer)).find(d => d.id === itemId);
    if (!spec) throw new AccountError(409, "This design is no longer in your synced Pix library.", "design_changed");
    label = spec.name.trim().slice(0, 40);
    design = JSON.stringify({ ...spec, id:"custom_gift_" + id, name:label });
    if (new TextEncoder().encode(design).length > 768 * 1024)
      throw new AccountError(413, "This design is too large to give.", "design_too_large");
  }
  const expires = sku?.kind === "subscription" ? now + 30 * DAY : null;
  // Serialize the owner check, recipient identity, and duplicate check with the insert.
  const insert = db.prepare(`INSERT INTO game_account_rewards(id,request_id,issuer_id,recipient_id,kind,item_id,label,design,created_at,expires_at)
    SELECT ?,?,o.user_id,u.id,?,?,?,?,?,? FROM game_account_owner o JOIN game_users u ON u.id=?
    WHERE o.user_id=? AND NOT EXISTS(SELECT 1 FROM game_account_rewards
      WHERE recipient_id=u.id AND kind=? AND item_id=? AND (expires_at IS NULL OR expires_at>?))
    ON CONFLICT DO NOTHING`).bind(id, requestId, kind, itemId, label, design, now, expires, recipientId, issuer, kind, itemId, now);
  const [, same, active] = await db.batch([insert, byReceipt(), current(now)]);
  if (same.results[0]) return receipt(same.results[0], issuer, body, false);
  if (active.results[0]) return receipt(active.results[0], issuer, body, true);
  throw new AccountError(409, "The account changed. Reopen the directory.", "account_changed");
}

export async function accountControls(request, db, issuer, action) {
  if (!await db.prepare("SELECT 1 AS ok FROM game_account_owner WHERE user_id=?").bind(issuer).first())
    throw new AccountError(403, "Account controls are available to the game owner.", "forbidden");
  if (request.method !== "POST") throw new AccountError(405, "Unsupported method.", "method");
  const body = await readJson(request, 4096);
  if (action === "directory") return json(await playerDirectory(db, body));
  if (action === "designs") {
    return json({ designs: (await savedDesigns(db, issuer)).map(d => ({ id:d.id, name:d.name.slice(0, 40) })) });
  }
  if (typeof body.recipientId !== "string" || !idPattern.test(body.recipientId)) throw notFound();
  const recipient = await db.prepare("SELECT id,email FROM game_users WHERE id=?").bind(body.recipientId).first();
  if (!recipient) throw notFound();
  if (action === "player") return json(await recipientSummary(db, recipient));
  if (action === "islands") return json(await recipientIslands(db, recipient.id));
  if (action === "give") return json(await giveReward(db, issuer, body));
  throw new AccountError(404, "Unknown account control.", "not_found");
}

export async function readGiftDesign(request, db, user, key) {
  if (request.method !== "GET") throw new AccountError(405, "Gifted designs are read-only.", "method");
  const row = await db.prepare("SELECT design,created_at FROM game_account_rewards WHERE id=? AND recipient_id=? AND kind='design'")
    .bind(giftDesignId(key), user).first();
  if (!row || new URL(request.url).searchParams.get("previous") === "1")
    throw new AccountError(404, "This design is unavailable.", "not_found");
  return json({ key, version:1, updatedAt:row.created_at, deleted:false, data:row.design });
}
