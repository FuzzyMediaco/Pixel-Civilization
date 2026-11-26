// Old islands have no instance ID. Fresh, reset and imported islands get a new one.
export const giftIslandId = state => state.islandId || "legacy";

export function newIslandId() {
  return globalThis.crypto?.randomUUID?.() ?? ("island-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2));
}

export function isIslandSaveKey(key) {
  return /^pixel_civ_(?:slot_[0-9]|save_v1_(?:real|god|survival|idle|manager|example-[a-z0-9-]+))$/.test(key);
}

// The cumulative receipt travels with the money through saves, copies and offline play.
export function creditIslandGift(state, accountId, saveKey, gift) {
  if (gift.key !== saveKey || gift.islandId !== giftIslandId(state) || !Number.isFinite(state.money)) return 0;
  const receipt = accountId + "/" + saveKey + "/" + gift.islandId;
  const applied = state.islandGiftTotals?.[receipt] ?? 0;
  if (!Number.isSafeInteger(applied) || applied < 0 || !Number.isSafeInteger(gift.total) || gift.total <= applied) return 0;
  const amount = gift.total - applied;
  state.money += amount;
  state.islandGiftTotals = { ...state.islandGiftTotals, [receipt]: gift.total };
  if (Array.isArray(state.economy?.ledger)) {
    const entry = { time: Math.floor(state.activePlaySec || 0), from: "outside", to: "treasury", amount, label: "Island gift" };
    state.economy = { ...state.economy, ledger: [...state.economy.ledger.slice(-99), entry] };
  }
  return amount;
}
