const MAX_BYTES = 24 * 1024 * 1024;
const unpack64 = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
async function unzip(bytes) {
  const stream = new Blob(bytes).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader(),
    decoder = new TextDecoder(),
    parts = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw Error("save_too_large");
    }
    parts.push(decoder.decode(value, { stream: true }));
  }
  parts.push(decoder.decode());
  return parts.join("");
}
export async function importLegacySlots(db, user) {
  const { results } = await db
    .prepare("SELECT save_key FROM game_legacy_mode_slots WHERE user_id=?")
    .bind(user)
    .all();
  if (!results.length) return;
  const found = await db
    .prepare("SELECT DISTINCT product_id FROM game_purchases WHERE user_id=? AND store='legacy' AND active=1")
    .bind(user)
    .all();
  const granted = new Set(found.results.map((r) => r.product_id));
  for (const slot of results) {
    if (granted.has("mode_god") && granted.has("mode_survival")) {
      await db.prepare("DELETE FROM game_legacy_mode_slots WHERE user_id=?").bind(user).run();
      break;
    }
    const { results: chunks } = await db
      .prepare("SELECT payload FROM game_legacy_mode_chunks WHERE user_id=? AND save_key=? ORDER BY part")
      .bind(user, slot.save_key)
      .all();
    const statements = [];
    try {
      let raw = await unzip(chunks.map((c) => unpack64(c.payload)));
      if (raw.startsWith("pcgz1:")) raw = await unzip([unpack64(raw.slice(6))]);
      const value = JSON.parse(raw),
        slots =
          slot.save_key === "pixel_civ_saved_slots_v1" && Array.isArray(value) ? value.slice(0, 10) : [value];
      for (const data of slots) {
        const state = data?.state,
          mode = state?.mode;
        if (
          !["god", "survival"].includes(mode) ||
          !Array.isArray(state.elements) ||
          (data.mode && data.mode !== mode)
        )
          continue;
        const product = "mode_" + mode;
        if (granted.has(product)) continue;
        granted.add(product);
        statements.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO game_purchases(store,receipt_key,user_id,product_id,active,period_start,expires_at,checked_at,refresh_at,source)
          VALUES('legacy',?,?,?,1,?,NULL,?,0,'pre-store named island')`,
            )
            .bind(user + ":" + product, user, product, Date.now(), Date.now()),
        );
      }
    } catch (error) {
      // Keep exceptionally large, legitimate archived slots available for operator review.
      if (error?.message === "save_too_large") continue;
      // Malformed records cannot establish access; their original live saves remain intact.
    }
    statements.push(
      db
        .prepare("DELETE FROM game_legacy_mode_slots WHERE user_id=? AND save_key=?")
        .bind(user, slot.save_key),
    );
    await db.batch(statements);
  }
}
