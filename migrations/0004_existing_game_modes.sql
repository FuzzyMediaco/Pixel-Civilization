-- This migration is the cutoff. Later application writes cannot mint founder grants.
INSERT OR IGNORE INTO game_purchases(store,receipt_key,user_id,product_id,active,period_start,expires_at,checked_at,refresh_at,source)
SELECT 'legacy',s.user_id||':'||s.save_key,s.user_id,
       CASE s.save_key WHEN 'pixel_civ_save_v1_god' THEN 'mode_god' ELSE 'mode_survival' END,
       1,s.updated_at,NULL,CAST(strftime('%s','now') AS INTEGER)*1000,0,'pre-store cloud autosave'
  FROM game_saves s
 WHERE s.deleted=0 AND s.save_key IN ('pixel_civ_save_v1_god','pixel_civ_save_v1_survival')
   AND EXISTS(SELECT 1 FROM game_save_chunks c WHERE c.user_id=s.user_id AND c.save_key=s.save_key AND c.revision=s.revision);

CREATE TABLE game_legacy_mode_slots (
  user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  save_key TEXT NOT NULL, revision TEXT NOT NULL, PRIMARY KEY(user_id,save_key)
);
CREATE TABLE game_legacy_mode_chunks (
  user_id TEXT NOT NULL, save_key TEXT NOT NULL, part INTEGER NOT NULL, payload TEXT NOT NULL,
  PRIMARY KEY(user_id,save_key,part),
  FOREIGN KEY(user_id,save_key) REFERENCES game_legacy_mode_slots(user_id,save_key) ON DELETE CASCADE
);
-- Preserve the compressed revision before the live player or another device can update the slot.
INSERT INTO game_legacy_mode_slots(user_id,save_key,revision)
SELECT user_id,save_key,revision FROM game_saves s WHERE deleted=0
AND (save_key GLOB 'pixel_civ_slot_[0-9]' OR save_key='pixel_civ_saved_slots_v1')
AND (SELECT COUNT(DISTINCT product_id) FROM game_purchases p WHERE p.user_id=s.user_id
     AND p.active=1 AND p.store='legacy' AND p.product_id IN ('mode_god','mode_survival'))<2;
INSERT INTO game_legacy_mode_chunks(user_id,save_key,part,payload)
SELECT c.user_id,c.save_key,c.part,c.payload FROM game_save_chunks c JOIN game_legacy_mode_slots s
  ON c.user_id=s.user_id AND c.save_key=s.save_key AND c.revision=s.revision;
