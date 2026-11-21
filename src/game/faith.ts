import { ELEMENT_BY_ID } from "./catalog";
import type { GameState, PlacedElement } from "./simulation";
import { levelMultiplier } from "./levelScaling";

export const BLESSINGS = {
  harvest: {
    name: "Bountiful harvest",
    detail: "Local producers grow 20% more food.",
    color: 0xb8e36a,
  },
  roads: {
    name: "Clear passage",
    detail: "Shared journeys remove 18% of car trips.",
    color: 0x7cd5ed,
  },
  joy: {
    name: "Day of fellowship",
    detail: "City happiness gains six points.",
    color: 0xf8bb82,
  },
  recovery: {
    name: "Helping hands",
    detail: "Crews extinguish fires 40% faster.",
    color: 0x8de4ba,
  },
  prosperity: {
    name: "Flourishing trade",
    detail: "Local exports earn 15% more.",
    color: 0xf5d976,
  },
  protection: {
    name: "Safe harbor",
    detail: "The invasion withdrew before reaching the island.",
    color: 0xbeb5ff,
  },
} as const;
export type Blessing = keyof typeof BLESSINGS;
const ordinary = Object.keys(BLESSINGS).filter(
  (key): key is Exclude<Blessing, "protection"> => key !== "protection",
);
export interface FaithRecord {
  nextCheck: number;
  wardAfter: number;
  sheltered: number;
  recoveryGrant?: boolean;
  nextHomeCheck?: number;
  active?: { kind: Blessing; temple: string; until: number };
  history: { at: number; kind: Blessing }[];
}
export const isSanctuary = (el: PlacedElement) => el.defId === "lds_temples";
export const bedsAt = (el: PlacedElement) =>
  isSanctuary(el)
    ? [8, 15, 25, 40, 60][Math.min(5, Math.max(1, el.level)) - 1]
    : 0;
const working = (el: PlacedElement) =>
  el.connected && !el.onFire && !el.disrepair;
export function faithServices(s: GameState) {
  let strength = 0,
    beds = 0;
  for (const el of s.elements) {
    if (ELEMENT_BY_ID[el.defId]?.category !== "faith") continue;
    beds += bedsAt(el);
    if (working(el))
      strength +=
        (el.defId === "graveyards" ? 19 : 32) * levelMultiplier("reach", el.level);
  }
  const reach =
    strength / (strength + 35 + 1.45 * Math.sqrt(Math.max(0, s.population)));
  return {
    happiness: Math.round(8 * reach),
    crime: Math.round(12 * reach),
    civicRelief: 0.15 * reach,
    volunteerSupport: 0.22 * reach,
    beds,
  };
}
export function faithOf(s: GameState): FaithRecord {
  return (s.faith ??= {
    nextCheck: s.activePlaySec + 80,
    wardAfter: 0,
    sheltered: 0,
    history: [],
  });
}
export function activeBlessing(s: GameState) {
  const active = s.faith?.active;
  return active && active.until > s.activePlaySec ? active.kind : undefined;
}
function begin(
  s: GameState,
  temple: PlacedElement,
  kind: Blessing,
  random: () => number,
) {
  const f = faithOf(s);
  const duration =
    kind === "protection"
      ? 12
      : 36 + 4 * temple.level + Math.floor(random() * 15);
  f.active = { kind, temple: temple.id, until: s.activePlaySec + duration };
  f.history.unshift({ at: Math.floor(s.activePlaySec), kind });
  f.history.length = Math.min(6, f.history.length);
  f.nextCheck = f.active.until + 120 + Math.floor(random() * 120);
  return kind;
}
export function invokeBlessing(
  s: GameState,
  temple: PlacedElement,
  kind: Exclude<Blessing, "protection">,
) {
  if (
    s.mode !== "god" ||
    !s.elements.includes(temple) ||
    !isSanctuary(temple) ||
    !working(temple) ||
    !ordinary.includes(kind)
  )
    return false;
  begin(s, temple, kind, Math.random);
  return true;
}
/** Sample in simulation time so pausing, inspecting and reloading grant no extra rolls. */
export function advanceFaith(s: GameState, random = Math.random) {
  const f = faithOf(s);
  if (s.activePlaySec < f.nextCheck) return;
  const temples = s.elements.filter((el) => isSanctuary(el) && working(el));
  f.nextCheck = s.activePlaySec + 55 + random() * 80;
  if (!temples.length || activeBlessing(s) || random() >= 0.55) return;
  const temple = temples[Math.floor(random() * temples.length)];
  return begin(
    s,
    temple,
    ordinary[Math.floor(random() * ordinary.length)],
    random,
  );
}
export function evacuate(s: GameState) {
  const beds = s.elements.reduce((sum, el) => sum + bedsAt(el), 0);
  if (beds && s.population > 0) {
    const f = faithOf(s);
    f.nextHomeCheck = s.activePlaySec + 90;
    f.sheltered = Math.min(beds, Math.max(f.sheltered, s.population));
  }
}
export function repelInvasion(s: GameState, random = Math.random) {
  const f = faithOf(s);
  if (s.activePlaySec < f.wardAfter || activeBlessing(s)) return false;
  const temple = s.elements.find((el) => isSanctuary(el) && working(el));
  if (!temple) return false;
  f.wardAfter = s.activePlaySec + 260;
  if (random() >= 0.04 + 0.008 * temple.level) return false;
  begin(s, temple, "protection", random);
  return true;
}
export function sanctuaryPopulation(s: GameState, housed: number) {
  if (!s.faith?.sheltered) return housed;
  const beds = s.elements.reduce((sum, el) => sum + bedsAt(el), 0);
  s.faith.sheltered = Math.min(s.faith.sheltered, beds);
  return Math.max(housed, s.faith.sheltered);
}
export function rehouseResidents(s: GameState) {
  const f = s.faith;
  if (
    !f?.sheltered ||
    s.activeAttack ||
    s.elements.some((el) => el.onFire && ELEMENT_BY_ID[el.defId]?.popBase)
  )
    return 0;
  const spaces = Math.floor(
    s.elements.reduce((n, el) => {
      const base = ELEMENT_BY_ID[el.defId]?.popBase ?? 0;
      return n + (working(el) ? base * levelMultiplier("output", el.level) : 0);
    }, 0),
  );
  const moved = Math.min(f.sheltered, spaces);
  // Rehousing changes the location of existing residents, never the headcount. Wait
  // for enough rebuilt housing so repeated clicks cannot assign one bed twice.
  if (moved !== f.sheltered) return 0;
  s.growthPool = Math.max(s.growthPool, moved - spaces);
  f.sheltered = 0;
  return moved;
}
