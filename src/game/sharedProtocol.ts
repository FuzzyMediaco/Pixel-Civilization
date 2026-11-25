import type { GameState } from "./simulation";
import type { IslandRole, SharedMode } from "./sharedIsland";

export const SHARED_PROTOCOL = 1;
export type SharedAccess = { id: string; name: string; mode: SharedMode; role: IslandRole };
export type SharedMember = { id: string; name: string; color: string; role: IslandRole };
export type SharedRoom = SharedAccess & { members: SharedMember[]; self: string; away: boolean };
export type SharedActivity = { label: string; actor: string; by: string; at: number; undoable: boolean };
export type SharedSnapshot = { revision: number; world: GameState; history: SharedActivity[]; undoActor: string | null };
export type SharedMessage =
  | ({ type: "welcome"; protocol: number; room: SharedRoom } & SharedSnapshot)
  | ({ type: "snapshot" } & SharedSnapshot)
  | { type: "room"; room: SharedRoom }
  | { type: "presence"; ids: string[] }
  | { type: "cursor"; user: string; gx: number; gz: number }
  | { type: "ack"; request: string; label: string }
  | { type: "error"; request?: string; message: string };
