import type { GameState } from "./simulation";
export interface IslandGiftTotal { key: string; islandId: string; total: number }
export function giftIslandId(state: GameState): string;
export function newIslandId(): string;
export function isIslandSaveKey(key: string): boolean;
export function creditIslandGift(state: GameState, accountId: string, saveKey: string, gift: IslandGiftTotal): number;
