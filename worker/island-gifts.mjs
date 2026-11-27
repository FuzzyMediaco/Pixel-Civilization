import { AccountError, json, readJson } from "./account-http.mjs";
import { encodeChunk, readSaveSnapshot } from "./saves.mjs";
import { creditIslandGift, giftIslandId, isIslandSaveKey } from "../src/game/islandGifts.mjs";

const modes = new Set(["real", "god", "survival", "idle", "manager"]);
const maxIslandBytes = 16 * 1024 * 1024;

export async function unpack(data) {
  if (typeof data !== "string" || !data.startsWith("pcgz1:")) return data;
  const bytes = Uint8Array.from(atob(data.slice(6)), ch => ch.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxIslandBytes) {
      await reader.cancel();
      throw new AccountError(413, "This island is too large to open.", "too_large");
    }
    parts.push(value);
  }
  return new Blob(parts).text();
}

async function islandFromSave(snapshot) {
  if (snapshot.deleted || !snapshot.data || !isIslandSaveKey(snapshot.key)) return null;
  let world;
  try { world = JSON.parse(await unpack(snapshot.data)); } catch { return null; }
  const slot = snapshot.key.startsWith("pixel_civ_slot_");
  const state = slot ? world?.state : world;
  if (!state || !modes.has(state.mode) || !Array.isArray(state.elements) || !Number.isFinite(state.money)) return null;
  if (state.islandId !== undefined && (typeof state.islandId !== "string" || !/^[\w-]{1,100}$/.test(state.islandId))) return null;
  const fallback = slot ? "Island " + (Number(snapshot.key.slice(15)) + 1) :
    typeof state.exampleWorldId === "string" ? state.exampleWorldId.replaceAll("-", " ") :
      state.mode[0].toUpperCase() + state.mode.slice(1) + " mode island";
  const name = slot && typeof world.name === "string" && world.name.trim() ? world.name.trim().slice(0,100) : fallback;
  return { world, state, name, slot };
}

export async function giftTotals(db, user, key) {
  const sql = `SELECT save_key AS key,island_id AS islandId,SUM(amount) AS total FROM island_gifts
    WHERE recipient_id=? AND retired=0` + (key === undefined ? "" : " AND save_key=?") + " GROUP BY save_key,island_id";
  return (await db.prepare(sql).bind(...(key === undefined ? [user] : [user,key])).all()).results;
}

export async function readGiftedSave(db, user, key, previous, stored) {
  const snapshot = await readSaveSnapshot(db, user, key, previous);
  if (previous || stored || snapshot.deleted || !isIslandSaveKey(key)) return json(snapshot);
  const totals = await giftTotals(db, user, key);
  if (totals.length) {
    const island = await islandFromSave(snapshot);
    const gift = island && totals.find(g => g.islandId === giftIslandId(island.state));
    if (gift && creditIslandGift(island.state, user, key, gift)) {
      if (island.slot) island.world.money = Math.floor(island.state.money);
      const text = JSON.stringify(island.world);
      if (snapshot.data.startsWith("pcgz1:")) {
        const gzip = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
        snapshot.data = "pcgz1:" + encodeChunk(new Uint8Array(await new Response(gzip).arrayBuffer()));
      } else snapshot.data = text;
    }
  }
  return json(snapshot);
}

async function lookupIslands(db, email) {
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    throw new AccountError(400, "Enter the player's email address.", "invalid_email");
  const user = await db.prepare("SELECT id FROM game_users WHERE email=?").bind(email.trim().toLowerCase()).first();
  if (!user) throw new AccountError(404, "There is no game account with that email.", "not_found");
  return recipientIslands(db, user.id);
}

export async function recipientIslands(db, recipientId) {
  const { results } = await db.prepare("SELECT save_key FROM game_saves WHERE user_id=? AND deleted=0 ORDER BY updated_at DESC")
    .bind(recipientId).all();
  let active;
  if (results.some(r => r.save_key === "pixel_civ_last_mode")) {
    const pointer = await unpack((await readSaveSnapshot(db,recipientId,"pixel_civ_last_mode")).data);
    active = /^slot-[0-9]$/.test(pointer) ? "pixel_civ_slot_" + pointer.slice(5) : "pixel_civ_save_v1_" + pointer;
  }
  const islands = [];
  for (const row of results) {
    if (!isIslandSaveKey(row.save_key)) continue;
    const island = await islandFromSave(await readSaveSnapshot(db,recipientId,row.save_key));
    if (island) islands.push({ key:row.save_key, islandId:giftIslandId(island.state), name:island.name, mode:island.state.mode, active:row.save_key===active });
  }
  islands.sort((a,b) => Number(b.active)-Number(a.active));
  return { recipientId, islands };
}

function checkReceipt(row, issuer, intent) {
  if (row.issuer_id !== issuer || row.recipient_id !== intent.recipientId || row.save_key !== intent.saveKey ||
      row.island_id !== intent.islandId || row.amount !== intent.amount)
    throw new AccountError(409, "This gift receipt belongs to a different request.", "receipt_conflict");
  return { requestId:row.request_id, amount:row.amount };
}

export async function issueIslandGift(db, issuer, intent) {
  const { recipientId, saveKey, islandId, amount, requestId } = intent;
  if (typeof requestId !== "string" || !/^[\w-]{16,100}$/.test(requestId) || typeof recipientId !== "string" || recipientId.length > 100 ||
      !isIslandSaveKey(saveKey) || typeof islandId !== "string" || !/^[\w-]{1,100}$/.test(islandId) || !Number.isSafeInteger(amount) || amount < 1)
    throw new AccountError(400, "Choose an island and enter a positive whole-dollar amount.", "invalid_gift");
  const getReceipt = () => db.prepare("SELECT * FROM island_gifts WHERE request_id=?").bind(requestId).first();
  const prior = await getReceipt();
  if (prior) return checkReceipt(prior,issuer,intent);
  for (let tryNumber=0; tryNumber<3; tryNumber++) {
    const snapshot = await readSaveSnapshot(db,recipientId,saveKey);
    const island = await islandFromSave(snapshot);
    if (!island || giftIslandId(island.state) !== islandId)
      throw new AccountError(409, "That island has changed. Find the player's islands again.", "island_changed");
    const totals = await giftTotals(db, recipientId, saveKey);
    const gift = totals.find(g => g.islandId === islandId);
    if (gift) creditIslandGift(island.state,recipientId,saveKey,gift);
    if (!Number.isSafeInteger(Math.floor(island.state.money)+amount) || !Number.isSafeInteger((gift?.total??0)+amount))
      throw new AccountError(400, "This amount exceeds the island treasury limit.", "amount_too_large");
    // The same D1 transaction checks capability, current save version and cumulative precision.
    // Ordinary autosaves can race the lookup. Reread that island before retrying.
    const insert = db.prepare(`INSERT INTO island_gifts(request_id,issuer_id,recipient_id,save_key,island_id,amount,created_at)
      SELECT ?,?,s.user_id,s.save_key,?,?,? FROM game_saves s
      WHERE s.user_id=? AND s.save_key=? AND s.version=? AND s.deleted=0
        AND EXISTS(SELECT 1 FROM island_gift_issuers WHERE user_id=?)
        AND COALESCE((SELECT SUM(amount) FROM island_gifts WHERE recipient_id=s.user_id AND save_key=s.save_key AND island_id=? AND retired=0),0)=?
      ON CONFLICT(request_id) DO NOTHING`)
      .bind(requestId,issuer,islandId,amount,Date.now(),recipientId,saveKey,snapshot.version,issuer,islandId,gift?.total??0);
    const [, saved] = await db.batch([insert, db.prepare("SELECT * FROM island_gifts WHERE request_id=?").bind(requestId)]);
    if (saved.results[0]) return checkReceipt(saved.results[0],issuer,intent);
  }
  throw new AccountError(409, "The island is syncing. Try sending this gift again.", "island_busy");
}

export async function islandGiftRequest(request, db, user, path) {
  const allowed = !!(await db.prepare("SELECT 1 AS allowed FROM island_gift_issuers WHERE user_id=?").bind(user).first());
  if (path === "access" && request.method === "GET") {
    const owner = await db.prepare("SELECT 1 AS ok FROM game_account_owner WHERE user_id=?").bind(user).first();
    return json({ canGive:allowed, ...(owner && { canManageAccounts:true }) });
  }
  if (!allowed) throw new AccountError(403, "This account cannot give island funds.", "forbidden");
  if (request.method !== "POST") throw new AccountError(405, "Unsupported method.", "method");
  const body = await readJson(request,4096);
  if (path === "islands") return json(await lookupIslands(db,body.email));
  if (path === "send") return json(await issueIslandGift(db,user,body));
  throw new AccountError(404, "Unknown gift action.", "not_found");
}
