import { AccountError, json, readJson } from "./account-http.mjs";

const MAX_DATA = 16 * 1024 * 1024;
const CHUNK_BYTES = 512 * 1024;
const MAX_KEYS = 256;

function metadata(key, version, updatedAt, deleted) {
  return { key, version, updatedAt, deleted: Boolean(deleted) };
}
export async function listSaves(db, user) {
  const { results } = await db.prepare(`SELECT save_key,version,updated_at,deleted FROM game_saves
    WHERE user_id=? ORDER BY save_key`).bind(user).all();
  return json({ saves: results.map(r => metadata(r.save_key, r.version, r.updated_at, r.deleted)) });
}

function encodeChunk(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16000));
  }
  return btoa(binary);
}
function decodeChunk(text) {
  const binary = atob(text);
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < result.length; i++) result[i] = binary.charCodeAt(i);
  return result;
}

export async function readSave(db, user, key, previous) {
  const revision = previous ? "previous_revision" : "revision";
  // One database snapshot for both metadata and bytes, even if another device saves twice.
  const [headers, chunks] = await db.batch([
    db.prepare(`SELECT version,updated_at,deleted,previous_revision,previous_updated_at,previous_deleted
      FROM game_saves WHERE user_id=? AND save_key=?`).bind(user, key),
    db.prepare(`SELECT c.payload FROM game_saves s JOIN game_save_chunks c
      ON c.user_id=s.user_id AND c.save_key=s.save_key AND c.revision=s.${revision}
      WHERE s.user_id=? AND s.save_key=? ORDER BY c.part`).bind(user, key),
  ]);
  const row = headers.results[0];
  if (!row || (previous && !row.previous_revision)) throw new AccountError(404, "This save does not exist.", "not_found");
  const item = previous
    ? metadata(key, row.version - 1, row.previous_updated_at, row.previous_deleted)
    : metadata(key, row.version, row.updated_at, row.deleted);
  let data = null;
  if (!item.deleted) {
    const gzip = new Blob(chunks.results.map(chunk => decodeChunk(chunk.payload)));
    data = await new Response(gzip.stream().pipeThrough(new DecompressionStream("gzip"))).text();
  }
  return json({ ...item, data });
}

export async function writeSave(db, user, key, request) {
  const deleted = request.method === "DELETE";
  const { baseVersion, data } = await readJson(request, deleted ? 4096 : MAX_DATA * 2 + 4096);
  if (!Number.isSafeInteger(baseVersion) || baseVersion < 0) {
    throw new AccountError(400, "A save version is required.", "invalid_version");
  }
  if (!deleted && typeof data !== "string") throw new AccountError(400, "Missing save data.", "invalid_save");
  const input = new Blob(deleted ? [] : [data]);
  if (input.size > MAX_DATA) throw new AccountError(413, "This save is larger than 16 MiB.", "too_large");
  const compressed = deleted ? new ArrayBuffer(0)
    : await new Response(input.stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  // A repeated network request can recognize its own successful write after a lost response.
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", compressed));
  const revision = (baseVersion + 1) + "-" + encodeChunk(hash);
  const now = Date.now();
  const statements = [
    db.prepare(`INSERT INTO game_saves(user_id,save_key,version,revision,updated_at,deleted)
      SELECT ?,?,1,?,?,? WHERE
        (?=0 AND (SELECT COUNT(*) FROM game_saves WHERE user_id=?) < ?)
        OR EXISTS(SELECT 1 FROM game_saves WHERE user_id=? AND save_key=? AND version=?)
      ON CONFLICT(user_id,save_key) DO UPDATE SET
        previous_revision=game_saves.revision,
        previous_updated_at=game_saves.updated_at,
        previous_deleted=game_saves.deleted,
        version=game_saves.version+1,
        revision=excluded.revision,
        updated_at=excluded.updated_at,
        deleted=excluded.deleted
      WHERE game_saves.version=?
      RETURNING version`).bind(user, key, revision, now, Number(deleted),
        baseVersion, user, MAX_KEYS, user, key, baseVersion, baseVersion),
  ];
  const bytes = new Uint8Array(compressed);
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    const payload = encodeChunk(bytes.subarray(offset, offset + CHUNK_BYTES));
    statements.push(db.prepare(`INSERT OR IGNORE INTO game_save_chunks(user_id,save_key,revision,part,payload)
      SELECT user_id,save_key,revision,?,? FROM game_saves
      WHERE user_id=? AND save_key=? AND revision=?`).bind(offset / CHUNK_BYTES, payload, user, key, revision));
  }
  statements.push(db.prepare(`DELETE FROM game_save_chunks WHERE user_id=? AND save_key=?
    AND revision NOT IN (SELECT revision FROM game_saves WHERE user_id=? AND save_key=?
      UNION ALL SELECT previous_revision FROM game_saves WHERE user_id=? AND save_key=? AND previous_revision IS NOT NULL)`)
    .bind(user, key, user, key, user, key));
  statements.push(db.prepare("SELECT version,updated_at,deleted,revision FROM game_saves WHERE user_id=? AND save_key=?").bind(user, key));
  // D1 batches are transactional. A stale version cannot advance a head or attach any bytes.
  const results = await db.batch(statements);
  const row = results.at(-1).results[0];
  if (!row && baseVersion === 0) throw new AccountError(409, "Your cloud save slots are full.", "slots_full");
  if (!row || row.revision !== revision || Boolean(row.deleted) !== deleted) {
    throw new AccountError(409, "A different version was saved on another device.", "conflict", { version: row?.version ?? 0 });
  }
  return json(metadata(key, row.version, row.updated_at, row.deleted));
}
