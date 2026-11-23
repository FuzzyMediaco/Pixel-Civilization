import { readPlayerItem, writePlayerItem } from "./deviceSaves";
import {
  type CivElementDef,
  type ElementCategory,
  type GameMode,
  type VoxelArchetype,
  ELEMENTS,
  ELEMENT_BY_ID,
} from "./catalog";
import { ELEMENT_LEVEL_SPANS, type LevelSpanTuple } from "./levelSpans";
import { defineDesigns } from "./designs/registry";
import { gable, lot, type CritterKind, type Ctx, type SmokeKind } from "./designs/kit";
import { PALETTE, PixelVox } from "./voxelCore";
import { invalidateVoxelAssetCache } from "./voxelArchitect";

export type CustomCategory = Exclude<ElementCategory, "starter">;

export interface CustomVoxelBox {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  color: string;
  emit?: number;
}

export interface CustomVoxelCylinder {
  cx: number;
  cz: number;
  y0: number;
  y1: number;
  radius: number;
  color: string;
  emit?: number;
}

export interface CustomVoxelRoof {
  style: "flat" | "gable" | "pyramid" | "dome" | "none";
  x0: number;
  y: number;
  z0: number;
  x1: number;
  z1: number;
  color: string;
  trimColor?: string;
}

export interface CustomVoxelBlinker {
  x: number;
  y: number;
  z: number;
  color: string;
}

export interface CustomVoxelRotor {
  px: number;
  py: number;
  pz: number;
  axis: "x" | "y" | "z";
  speed: number;
  radius: number;
  color: string;
}

export interface CustomVoxelCritter {
  kind: CritterKind;
  count: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface CustomVoxelSmoke {
  x: number;
  y: number;
  z: number;
  kind?: SmokeKind;
}

export interface CustomElementLevelStats {
  cost: number;
  popBase: number;
  jobs: number;
  food: number;
  power: number;
  water: number;
  waste: number;
  education: number;
  recreation: number;
  government: number;
  police: number;
  policeRadius: number;
  fireRadius: number;
  military: number;
  income: number;
}

export interface CustomElementLevelSpec {
  level: 1 | 2 | 3 | 4 | 5;
  title: string;
  description?: string;
  footprintCells: 1 | 2 | 3;
  stats: CustomElementLevelStats;
  boxes: CustomVoxelBox[];
  cylinders?: CustomVoxelCylinder[];
  roof?: CustomVoxelRoof;
  blinkers?: CustomVoxelBlinker[];
  rotors?: CustomVoxelRotor[];
  critters?: CustomVoxelCritter[];
  smoke?: CustomVoxelSmoke[];
}

export interface CustomElementSpec {
  id: string;
  name: string;
  description: string;
  architectNote?: string;
  category: CustomCategory;
  domain: "land" | "water";
  footprintCells: 1 | 2 | 3;
  cost: number;
  popBase: number;
  jobs: number;
  food: number;
  power: number;
  water: number;
  waste: number;
  education: number;
  recreation: number;
  government: number;
  police: number;
  policeRadius: number;
  fireRadius: number;
  military: number;
  income: number;
  accentHex: string;
  lotGround: "grass" | "asphalt" | "path" | "concrete" | "sand" | "deck";
  boxes: CustomVoxelBox[];
  cylinders?: CustomVoxelCylinder[];
  roof?: CustomVoxelRoof;
  blinkers?: CustomVoxelBlinker[];
  rotors?: CustomVoxelRotor[];
  critters?: CustomVoxelCritter[];
  smoke?: CustomVoxelSmoke[];
  /** Full 5-level visual & stat progression generated after user confirms the Lv 5 flagship design. */
  levelSpecs?: CustomElementLevelSpec[];
  confirmedLevels?: boolean;
  createdAt?: number;
  createdInMode?: GameMode;
}

export interface BalanceEnforcementResult {
  spec: CustomElementSpec;
  adjustments: string[];
}

const STORAGE_KEY = "pixel_civ_pix_custom_elements_v1";
const VALID_CATEGORIES = new Set<CustomCategory>([
  "housing",
  "agriculture",
  "commerce",
  "power_waste",
  "water_util",
  "roads_transit",
  "civic_parks",
  "police_military",
  "faith",
  "maritime",
  "nature_terrain",
  "landmarks",
  "wealth_projects",
]);

function clampInt(n: unknown, min: number, max: number, fallback = 0): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(min, Math.min(max, v));
}

function safeColor(c: unknown, fallback = "stone"): string {
  if (typeof c !== "string") return fallback;
  const trimmed = c.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (trimmed in PALETTE) return trimmed;
  return fallback;
}

function safeHex(c: unknown, fallback = "#0f766e"): string {
  if (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c.trim())) return c.trim();
  return fallback;
}

export function slugifyCustomId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 26) || "creation";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `custom_${base}_${suffix}`;
}

export function isCustomElementId(id: string): boolean {
  return id.startsWith("custom_");
}

function archetypeForCategory(category: CustomCategory, domain: "land" | "water"): VoxelArchetype {
  if (domain === "water") return "dock_pier";
  switch (category) {
    case "housing": return "midrise_residential";
    case "agriculture": return "barn_farmhouse";
    case "commerce": return "shop_front";
    case "power_waste": return "solar_array";
    case "water_util": return "water_plant";
    case "civic_parks": return "civic_hall";
    case "police_military": return "police_station";
    case "faith": return "church_steeple";
    case "maritime": return "shipyard";
    default: return "office_commercial";
  }
}

/**
 * Enforces mode-aware game balance limits on AI-created elements:
 * - God mode: unrestricted creative freedom (only safe engine bounds).
 * - Real / Idle / Manager: balanced caps & proportional treasury cost.
 * - Survival: tight scarcity-respecting caps and higher fair build costs.
 */
export function enforceModeBalance(
  raw: Partial<CustomElementSpec>,
  mode: GameMode,
  existingId?: string,
): BalanceEnforcementResult {
  const adjustments: string[] = [];
  const name = (typeof raw.name === "string" && raw.name.trim().slice(0, 40)) || "Custom Creation";
  const description = (typeof raw.description === "string" && raw.description.trim().slice(0, 160)) || "Custom voxel structure designed with PixBuilder.";
  const architectNote = typeof raw.architectNote === "string" ? raw.architectNote.trim().slice(0, 180) : undefined;
  const category: CustomCategory = VALID_CATEGORIES.has(raw.category as CustomCategory)
    ? (raw.category as CustomCategory)
    : "landmarks";
  const domain: "land" | "water" = raw.domain === "water" ? "water" : "land";
  const footprintCells = clampInt(raw.footprintCells, 1, 3, 2) as 1 | 2 | 3;

  const caps =
    mode === "god"
      ? { popBase: 900, jobs: 700, food: 350, power: 700, water: 600, waste: 350, education: 400, recreation: 400, government: 350, police: 120, radius: 22, military: 180, income: 400, minCost: 10, maxCost: 50000 }
      : mode === "survival"
        ? { popBase: 70, jobs: 65, food: 32, power: 55, water: 50, waste: 35, education: 55, recreation: 55, government: 45, police: 20, radius: 8, military: 24, income: 40, minCost: 160, maxCost: 6500 }
        : { popBase: 180, jobs: 150, food: 75, power: 140, water: 130, waste: 85, education: 120, recreation: 120, government: 100, police: 45, radius: 13, military: 55, income: 110, minCost: 90, maxCost: 14000 };

  const capStat = (label: string, val: unknown, min: number, max: number) => {
    const rawNum = typeof val === "number" && Number.isFinite(val) ? Math.round(val) : 0;
    if (rawNum > max) adjustments.push(`${label} capped at ${max} for ${mode} mode`);
    if (rawNum < min) adjustments.push(`${label} raised to ${min} for ${mode} mode`);
    return Math.max(min, Math.min(max, rawNum));
  };

  const popBase = capStat("Pop", raw.popBase, 0, caps.popBase);
  const jobs = capStat("Jobs", raw.jobs, 0, caps.jobs);
  const food = capStat("Food", raw.food, 0, caps.food);
  const power = capStat("Power", raw.power, -100, caps.power);
  const water = capStat("Water", raw.water, -100, caps.water);
  const waste = capStat("Waste", raw.waste, 0, caps.waste);
  const education = capStat("Education", raw.education, 0, caps.education);
  const recreation = capStat("Recreation", raw.recreation, 0, caps.recreation);
  const government = capStat("Civic", raw.government, 0, caps.government);
  const police = capStat("Police", raw.police, 0, caps.police);
  const policeRadius = capStat("Police radius", raw.policeRadius, 0, caps.radius);
  const fireRadius = capStat("Fire radius", raw.fireRadius, 0, caps.radius);
  const military = capStat("Defense", raw.military, 0, caps.military);
  const income = capStat("Income", raw.income, 0, caps.income);

  const powerScore =
    popBase * 3 +
    jobs * 3 +
    food * 5 +
    Math.max(0, power) * 4 +
    Math.max(0, water) * 4 +
    waste * 4 +
    education * 3 +
    recreation * 3 +
    government * 4 +
    police * 10 +
    policeRadius * 20 +
    fireRadius * 20 +
    military * 14 +
    income * 7;
  const minFairCost = mode === "god" ? caps.minCost : Math.max(caps.minCost, Math.round(powerScore * (mode === "survival" ? 1.35 : 0.85)));
  let cost = clampInt(raw.cost, caps.minCost, caps.maxCost, Math.max(220, minFairCost));
  if (mode !== "god" && cost < minFairCost) {
    cost = Math.min(caps.maxCost, minFairCost);
    adjustments.push(`Cost balanced to $${cost} for ${mode} mode`);
  }

  const maxHalf = footprintCells === 1 ? 7 : footprintCells === 2 ? 11 : 12;
  const boxes: CustomVoxelBox[] = (Array.isArray(raw.boxes) ? raw.boxes : [])
    .slice(0, 32)
    .map((b) => {
      const x0 = clampInt(b.x0, -maxHalf, maxHalf - 1, -4);
      const x1 = clampInt(b.x1, x0 + 1, maxHalf, Math.min(maxHalf, x0 + 4));
      const y0 = clampInt(b.y0, 0, 30, 1);
      const y1 = clampInt(b.y1, y0 + 1, 32, y0 + 4);
      const z0 = clampInt(b.z0, -maxHalf, maxHalf - 1, -4);
      const z1 = clampInt(b.z1, z0 + 1, maxHalf, Math.min(maxHalf, z0 + 4));
      const emit = typeof b.emit === "number" && Number.isFinite(b.emit) ? Math.max(0, Math.min(1.8, b.emit)) : 0;
      return { x0, y0, z0, x1, y1, z1, color: safeColor(b.color, "stone"), emit };
    });

  if (boxes.length === 0) {
    boxes.push({ x0: -4, y0: 1, z0: -4, x1: 4, y1: 8, z1: 4, color: "cream", emit: 0 });
    boxes.push({ x0: -2, y0: 2, z0: 3, x1: 2, y1: 5, z1: 4, color: "warmGlow", emit: 0.7 });
  }

  const cylinders: CustomVoxelCylinder[] = (Array.isArray(raw.cylinders) ? raw.cylinders : [])
    .slice(0, 8)
    .map((cy) => ({
      cx: clampInt(cy.cx, -maxHalf + 1, maxHalf - 1, 0),
      cz: clampInt(cy.cz, -maxHalf + 1, maxHalf - 1, 0),
      y0: clampInt(cy.y0, 0, 28, 1),
      y1: clampInt(cy.y1, 2, 32, 8),
      radius: Math.max(1, Math.min(8, typeof cy.radius === "number" && Number.isFinite(cy.radius) ? cy.radius : 2.5)),
      color: safeColor(cy.color, "steel"),
      emit: typeof cy.emit === "number" && Number.isFinite(cy.emit) ? Math.max(0, Math.min(1.6, cy.emit)) : 0,
    }));

  let roof: CustomVoxelRoof | undefined;
  if (raw.roof && typeof raw.roof === "object" && raw.roof.style && raw.roof.style !== "none") {
    const style = (["flat", "gable", "pyramid", "dome"] as const).includes(raw.roof.style as "flat")
      ? (raw.roof.style as CustomVoxelRoof["style"])
      : "flat";
    const x0 = clampInt(raw.roof.x0, -maxHalf, maxHalf - 2, -4);
    const x1 = clampInt(raw.roof.x1, x0 + 2, maxHalf, Math.min(maxHalf, x0 + 6));
    const z0 = clampInt(raw.roof.z0, -maxHalf, maxHalf - 2, -4);
    const z1 = clampInt(raw.roof.z1, z0 + 2, maxHalf, Math.min(maxHalf, z0 + 6));
    roof = {
      style,
      x0,
      y: clampInt(raw.roof.y, 2, 30, 8),
      z0,
      x1,
      z1,
      color: safeColor(raw.roof.color, "slate"),
      trimColor: raw.roof.trimColor ? safeColor(raw.roof.trimColor, "white") : undefined,
    };
  }

  const blinkers: CustomVoxelBlinker[] = (Array.isArray(raw.blinkers) ? raw.blinkers : [])
    .slice(0, 4)
    .map((bl) => ({
      x: clampInt(bl.x, -maxHalf, maxHalf, 0),
      y: clampInt(bl.y, 2, 32, 10),
      z: clampInt(bl.z, -maxHalf, maxHalf, 0),
      color: safeColor(bl.color, "red"),
    }));

  const rotors: CustomVoxelRotor[] = (Array.isArray(raw.rotors) ? raw.rotors : [])
    .slice(0, 2)
    .map((r) => ({
      px: clampInt(r.px, -maxHalf, maxHalf, 0),
      py: clampInt(r.py, 2, 32, 10),
      pz: clampInt(r.pz, -maxHalf, maxHalf, 0),
      axis: r.axis === "x" || r.axis === "z" ? r.axis : "y",
      speed: Math.max(0.5, Math.min(8, typeof r.speed === "number" && Number.isFinite(r.speed) ? r.speed : 3)),
      radius: clampInt(r.radius, 2, 6, 4),
      color: safeColor(r.color, "silver"),
    }));

  const validCritters = new Set<CritterKind>(["cow", "sheep", "pig", "chicken", "horse", "goat", "duck", "bee"]);
  const critters: CustomVoxelCritter[] = (Array.isArray(raw.critters) ? raw.critters : [])
    .slice(0, 2)
    .map((cr) => {
      const x0 = clampInt(cr.x0, -maxHalf + 1, maxHalf - 3, -5);
      const z0 = clampInt(cr.z0, -maxHalf + 1, maxHalf - 3, -5);
      const x1 = clampInt(cr.x1, x0 + 2, maxHalf - 1, Math.min(maxHalf - 1, x0 + 6));
      const z1 = clampInt(cr.z1, z0 + 2, maxHalf - 1, Math.min(maxHalf - 1, z0 + 6));
      return {
        kind: validCritters.has(cr.kind as CritterKind) ? (cr.kind as CritterKind) : "cow",
        count: clampInt(cr.count, 1, 6, 3),
        x0,
        z0,
        x1,
        z1,
      };
    });

  const validSmoke = new Set<SmokeKind>(["smoke", "steam", "dark", "spark"]);
  const smoke: CustomVoxelSmoke[] = (Array.isArray(raw.smoke) ? raw.smoke : [])
    .slice(0, 2)
    .map((sm) => ({
      x: clampInt(sm.x, -maxHalf, maxHalf, 0),
      y: clampInt(sm.y, 2, 32, 10),
      z: clampInt(sm.z, -maxHalf, maxHalf, 0),
      kind: validSmoke.has(sm.kind as SmokeKind) ? (sm.kind as SmokeKind) : "smoke",
    }));

  const validGrounds = new Set(["grass", "asphalt", "path", "concrete", "sand", "deck"]);
  const lotGround = validGrounds.has(raw.lotGround as string)
    ? (raw.lotGround as CustomElementSpec["lotGround"])
    : domain === "water"
      ? "deck"
      : "asphalt";

  const spec: CustomElementSpec = {
    id: existingId || (typeof raw.id === "string" && isCustomElementId(raw.id) ? raw.id : slugifyCustomId(name)),
    name,
    description,
    architectNote,
    category,
    domain,
    footprintCells,
    cost,
    popBase,
    jobs,
    food,
    power,
    water,
    waste,
    education,
    recreation,
    government,
    police,
    policeRadius,
    fireRadius,
    military,
    income,
    accentHex: safeHex(raw.accentHex, "#0f766e"),
    lotGround,
    boxes,
    cylinders,
    roof,
    blinkers,
    rotors,
    critters,
    smoke,
    levelSpecs: Array.isArray(raw.levelSpecs) && raw.levelSpecs.length === 5 ? raw.levelSpecs : undefined,
    confirmedLevels: Boolean(raw.confirmedLevels),
    createdAt: raw.createdAt || Date.now(),
    createdInMode: raw.createdInMode || mode,
  };

  return { spec, adjustments };
}

function scaleStat(lv5Val: number, factor: number, allowNegative = false): number {
  if (lv5Val === 0) return 0;
  if (lv5Val < 0) return allowNegative ? Math.min(-1, Math.round(lv5Val * factor)) : 0;
  return Math.max(1, Math.round(lv5Val * factor));
}

function clampVoxelCoord(v: number, maxHalf: number): number {
  return Math.max(-maxHalf, Math.min(maxHalf, Math.round(v)));
}

function scaleBoxesForLevel(boxes: CustomVoxelBox[], yFactor: number, xyFactor: number, maxHalf: number, keepRatio: number): CustomVoxelBox[] {
  const count = Math.max(1, Math.min(boxes.length, Math.ceil(boxes.length * keepRatio)));
  // Prioritize lower/core boxes so starter levels feel grounded and upper stories/ornaments appear on upgrades
  const sorted = [...boxes]
    .map((b, idx) => ({ b, idx, score: b.y0 * 1.4 + Math.hypot((b.x0 + b.x1) * 0.5, (b.z0 + b.z1) * 0.5) * 0.4 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .sort((a, b) => a.idx - b.idx)
    .map((item) => item.b);

  return sorted.map((b) => {
    const x0 = clampVoxelCoord(b.x0 * xyFactor, maxHalf - 1);
    const x1 = Math.max(x0 + 1, clampVoxelCoord(b.x1 * xyFactor, maxHalf));
    const z0 = clampVoxelCoord(b.z0 * xyFactor, maxHalf - 1);
    const z1 = Math.max(z0 + 1, clampVoxelCoord(b.z1 * xyFactor, maxHalf));
    const y0 = b.y0 <= 1 ? b.y0 : Math.max(1, Math.round(b.y0 * yFactor));
    const y1 = Math.max(y0 + 1, Math.round(b.y1 * yFactor));
    return { ...b, x0, x1, y0, y1, z0, z1 };
  });
}

function extractLevelStats(spec: CustomElementSpec): CustomElementLevelStats {
  return {
    cost: spec.cost,
    popBase: spec.popBase,
    jobs: spec.jobs,
    food: spec.food,
    power: spec.power,
    water: spec.water,
    waste: spec.waste,
    education: spec.education,
    recreation: spec.recreation,
    government: spec.government,
    police: spec.police,
    policeRadius: spec.policeRadius,
    fireRadius: spec.fireRadius,
    military: spec.military,
    income: spec.income,
  };
}

/**
 * Deterministically derives Levels 1-4 visuals & balanced stats from a confirmed Level 5 flagship spec.
 * Used both as a fallback when offline and to fill any missing fields from AI-generated progressions.
 */
export function synthesizeLowerLevelsFromLv5(lv5Spec: CustomElementSpec): CustomElementLevelSpec[] {
  const baseFp = lv5Spec.footprintCells;
  const lv5Stats = extractLevelStats(lv5Spec);
  const tiers: {
    level: 1 | 2 | 3 | 4 | 5;
    titlePrefix: string;
    statScale: number;
    costScale: number;
    yFactor: number;
    xyFactor: number;
    keepRatio: number;
    fp: 1 | 2 | 3;
    desc: string;
  }[] = [
    {
      level: 1,
      titlePrefix: `${lv5Spec.name} (Starter)`,
      statScale: 0.34,
      costScale: 0.35,
      yFactor: 0.48,
      xyFactor: baseFp >= 2 ? 0.72 : 0.85,
      keepRatio: 0.45,
      fp: (baseFp >= 2 ? Math.max(1, baseFp - 1) : 1) as 1 | 2 | 3,
      desc: `Compact starter edition of ${lv5Spec.name}.`,
    },
    {
      level: 2,
      titlePrefix: `${lv5Spec.name} II`,
      statScale: 0.5,
      costScale: 0.52,
      yFactor: 0.62,
      xyFactor: baseFp === 3 ? 0.82 : 0.9,
      keepRatio: 0.65,
      fp: (baseFp === 3 ? 2 : baseFp) as 1 | 2 | 3,
      desc: `Expanded neighborhood tier with added structure and capacity.`,
    },
    {
      level: 3,
      titlePrefix: `${lv5Spec.name} III`,
      statScale: 0.68,
      costScale: 0.68,
      yFactor: 0.76,
      xyFactor: 0.95,
      keepRatio: 0.8,
      fp: baseFp,
      desc: `Established mid-tier build with full lot footprint and key details.`,
    },
    {
      level: 4,
      titlePrefix: `${lv5Spec.name} IV`,
      statScale: 0.84,
      costScale: 0.84,
      yFactor: 0.89,
      xyFactor: 0.98,
      keepRatio: 0.92,
      fp: baseFp,
      desc: `Grand upgraded edition approaching flagship height and output.`,
    },
    {
      level: 5,
      titlePrefix: `${lv5Spec.name} V`,
      statScale: 1,
      costScale: 1,
      yFactor: 1,
      xyFactor: 1,
      keepRatio: 1,
      fp: baseFp,
      desc: lv5Spec.description,
    },
  ];

  return tiers.map((t) => {
    if (t.level === 5) {
      return {
        level: 5,
        title: lv5Spec.name,
        description: lv5Spec.description,
        footprintCells: baseFp,
        stats: lv5Stats,
        boxes: lv5Spec.boxes,
        cylinders: lv5Spec.cylinders,
        roof: lv5Spec.roof,
        blinkers: lv5Spec.blinkers,
        rotors: lv5Spec.rotors,
        critters: lv5Spec.critters,
        smoke: lv5Spec.smoke,
      };
    }

    const maxHalf = t.fp === 1 ? 7 : t.fp === 2 ? 11 : 12;
    const boxes = scaleBoxesForLevel(lv5Spec.boxes, t.yFactor, t.xyFactor, maxHalf, t.keepRatio);
    const maxBoxY = boxes.reduce((m, b) => Math.max(m, b.y1), 4);
    const cylinders = (lv5Spec.cylinders ?? [])
      .slice(0, t.level === 1 ? 1 : t.level === 2 ? 2 : (lv5Spec.cylinders?.length ?? 0))
      .map((cy) => ({
        ...cy,
        cx: clampVoxelCoord(cy.cx * t.xyFactor, maxHalf - 1),
        cz: clampVoxelCoord(cy.cz * t.xyFactor, maxHalf - 1),
        y0: cy.y0 <= 1 ? cy.y0 : Math.max(1, Math.round(cy.y0 * t.yFactor)),
        y1: Math.max(2, Math.round(cy.y1 * t.yFactor)),
        radius: Math.max(1, Math.round(cy.radius * t.xyFactor * 10) / 10),
      }));

    const roof = lv5Spec.roof
      ? {
          ...lv5Spec.roof,
          x0: clampVoxelCoord(lv5Spec.roof.x0 * t.xyFactor, maxHalf - 2),
          x1: Math.max(
            clampVoxelCoord(lv5Spec.roof.x0 * t.xyFactor, maxHalf - 2) + 2,
            clampVoxelCoord(lv5Spec.roof.x1 * t.xyFactor, maxHalf),
          ),
          z0: clampVoxelCoord(lv5Spec.roof.z0 * t.xyFactor, maxHalf - 2),
          z1: Math.max(
            clampVoxelCoord(lv5Spec.roof.z0 * t.xyFactor, maxHalf - 2) + 2,
            clampVoxelCoord(lv5Spec.roof.z1 * t.xyFactor, maxHalf),
          ),
          y: Math.max(2, Math.min(maxBoxY, Math.round(lv5Spec.roof.y * t.yFactor))),
        }
      : undefined;

    const blinkers =
      t.level >= 3
        ? (lv5Spec.blinkers ?? []).slice(0, t.level === 3 ? 1 : 4).map((bl) => ({
            ...bl,
            x: clampVoxelCoord(bl.x * t.xyFactor, maxHalf),
            y: Math.max(2, Math.round(bl.y * t.yFactor)),
            z: clampVoxelCoord(bl.z * t.xyFactor, maxHalf),
          }))
        : [];

    const rotors =
      t.level >= 2
        ? (lv5Spec.rotors ?? []).slice(0, t.level === 2 ? 1 : 2).map((rt) => ({
            ...rt,
            px: clampVoxelCoord(rt.px * t.xyFactor, maxHalf),
            py: Math.max(2, Math.round(rt.py * t.yFactor)),
            pz: clampVoxelCoord(rt.pz * t.xyFactor, maxHalf),
            radius: Math.max(2, Math.round(rt.radius * Math.max(0.75, t.xyFactor))),
          }))
        : [];

    const critters = (lv5Spec.critters ?? []).map((cr) => ({
      ...cr,
      count: Math.max(1, Math.round(cr.count * t.statScale)),
      x0: clampVoxelCoord(cr.x0 * t.xyFactor, maxHalf - 3),
      z0: clampVoxelCoord(cr.z0 * t.xyFactor, maxHalf - 3),
      x1: Math.max(clampVoxelCoord(cr.x0 * t.xyFactor, maxHalf - 3) + 2, clampVoxelCoord(cr.x1 * t.xyFactor, maxHalf - 1)),
      z1: Math.max(clampVoxelCoord(cr.z0 * t.xyFactor, maxHalf - 3) + 2, clampVoxelCoord(cr.z1 * t.xyFactor, maxHalf - 1)),
    }));

    const smoke =
      t.level >= 2
        ? (lv5Spec.smoke ?? []).slice(0, t.level === 2 ? 1 : 2).map((sm) => ({
            ...sm,
            x: clampVoxelCoord(sm.x * t.xyFactor, maxHalf),
            y: Math.max(2, Math.round(sm.y * t.yFactor)),
            z: clampVoxelCoord(sm.z * t.xyFactor, maxHalf),
          }))
        : [];

    return {
      level: t.level,
      title: t.titlePrefix,
      description: t.desc,
      footprintCells: t.fp,
      stats: {
        cost: Math.max(20, Math.round(lv5Stats.cost * t.costScale)),
        popBase: scaleStat(lv5Stats.popBase, t.statScale),
        jobs: scaleStat(lv5Stats.jobs, t.statScale),
        food: scaleStat(lv5Stats.food, t.statScale),
        power: scaleStat(lv5Stats.power, t.statScale, true),
        water: scaleStat(lv5Stats.water, t.statScale, true),
        waste: scaleStat(lv5Stats.waste, t.statScale),
        education: scaleStat(lv5Stats.education, t.statScale),
        recreation: scaleStat(lv5Stats.recreation, t.statScale),
        government: scaleStat(lv5Stats.government, t.statScale),
        police: scaleStat(lv5Stats.police, t.statScale),
        policeRadius: scaleStat(lv5Stats.policeRadius, Math.max(0.5, t.statScale)),
        fireRadius: scaleStat(lv5Stats.fireRadius, Math.max(0.5, t.statScale)),
        military: scaleStat(lv5Stats.military, t.statScale),
        income: scaleStat(lv5Stats.income, t.statScale),
      },
      boxes,
      cylinders,
      roof,
      blinkers,
      rotors,
      critters,
      smoke,
    };
  });
}

/**
 * Merges optional AI-generated Levels 1-4 with the confirmed Level 5 flagship,
 * enforces mode balance & monotonically non-decreasing footprints, and locks Level 5 verbatim.
 */
export function applyGeneratedLevelsToSpec(
  lv5Spec: CustomElementSpec,
  rawLevels: Record<string, unknown>[] | undefined,
  mode: GameMode,
): CustomElementSpec {
  const fallback = synthesizeLowerLevelsFromLv5(lv5Spec);
  const byLevel = new Map<number, Record<string, unknown>>();
  for (const item of rawLevels ?? []) {
    if (item && typeof item === "object") {
      const lv = Number(item.level);
      if (lv >= 1 && lv <= 4 && !byLevel.has(lv)) byLevel.set(lv, item);
    }
  }

  const finalLevels: CustomElementLevelSpec[] = [];
  let prevFp: 1 | 2 | 3 = 1;

  for (let lv = 1; lv <= 5; lv++) {
    if (lv === 5) {
      finalLevels.push(fallback[4]);
      continue;
    }
    const raw = byLevel.get(lv);
    const fb = fallback[lv - 1];
    if (!raw || !Array.isArray(raw.boxes) || raw.boxes.length === 0) {
      const fp = Math.max(prevFp, Math.min(lv5Spec.footprintCells, fb.footprintCells)) as 1 | 2 | 3;
      prevFp = fp;
      finalLevels.push({ ...fb, footprintCells: fp });
      continue;
    }

    const rawFp = clampInt(raw.footprintCells, prevFp, lv5Spec.footprintCells, fb.footprintCells) as 1 | 2 | 3;
    prevFp = rawFp;
    const { spec: sanitized } = enforceModeBalance(
      {
        ...lv5Spec,
        ...raw,
        name: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 40) : fb.title,
        description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim().slice(0, 140) : fb.description,
        footprintCells: rawFp,
        category: lv5Spec.category,
        domain: lv5Spec.domain,
        lotGround: lv5Spec.lotGround,
        accentHex: lv5Spec.accentHex,
      },
      mode,
      lv5Spec.id,
    );

    const clampUp = (val: number, maxVal: number) => (maxVal >= 0 ? Math.min(val, maxVal) : Math.max(val, maxVal));
    finalLevels.push({
      level: lv as 1 | 2 | 3 | 4,
      title: sanitized.name,
      description: sanitized.description,
      footprintCells: rawFp,
      stats: {
        cost: Math.min(sanitized.cost, lv5Spec.cost),
        popBase: clampUp(sanitized.popBase, lv5Spec.popBase),
        jobs: clampUp(sanitized.jobs, lv5Spec.jobs),
        food: clampUp(sanitized.food, lv5Spec.food),
        power: clampUp(sanitized.power, lv5Spec.power),
        water: clampUp(sanitized.water, lv5Spec.water),
        waste: clampUp(sanitized.waste, lv5Spec.waste),
        education: clampUp(sanitized.education, lv5Spec.education),
        recreation: clampUp(sanitized.recreation, lv5Spec.recreation),
        government: clampUp(sanitized.government, lv5Spec.government),
        police: clampUp(sanitized.police, lv5Spec.police),
        policeRadius: clampUp(sanitized.policeRadius, lv5Spec.policeRadius),
        fireRadius: clampUp(sanitized.fireRadius, lv5Spec.fireRadius),
        military: clampUp(sanitized.military, lv5Spec.military),
        income: clampUp(sanitized.income, lv5Spec.income),
      },
      boxes: sanitized.boxes,
      cylinders: sanitized.cylinders,
      roof: sanitized.roof,
      blinkers: sanitized.blinkers,
      rotors: sanitized.rotors,
      critters: sanitized.critters,
      smoke: sanitized.smoke,
    });
  }

  return {
    ...lv5Spec,
    levelSpecs: finalLevels,
    confirmedLevels: true,
  };
}

function tintForVariant(color: string, variant: number): string {
  if (variant === 0) return color;
  const swaps: Record<string, string[]> = {
    cream: ["cream", "sand", "white", "brickLight"],
    brick: ["brick", "terracotta", "stone", "slateLight"],
    stone: ["stone", "concrete", "cream", "slate"],
    slate: ["slate", "navy", "woodDark", "copper"],
    teal: ["teal", "cyan", "gold", "crimson"],
    red: ["red", "orange", "navy", "gold"],
    navy: ["navy", "olive", "slate", "teal"],
    wood: ["wood", "woodLight", "woodDark", "brick"],
  };
  const arr = swaps[color];
  return arr ? arr[variant % arr.length] : color;
}

function buildCustomBlueprint(c: Ctx, spec: CustomElementSpec): void {
  const { v, lv, variant, hx, hz } = c;
  if (spec.domain === "water") {
    c.floating = true;
    v.box(-hx + 1, 0, -hz + 1, hx - 1, 1, hz - 1, "woodDark");
    v.box(-hx + 2, 1, -hz + 2, hx - 2, 2, hz - 2, "concrete");
  } else {
    lot(c, spec.lotGround === "deck" ? "path" : spec.lotGround);
  }

  // If bespoke 5-level specs exist, render that exact level's geometry (no artificial y-stretch!)
  const levelGeom = spec.levelSpecs?.[Math.max(0, Math.min(spec.levelSpecs.length - 1, lv - 1))];
  const yScale = levelGeom ? 1 : lv === 5 ? 1 : 0.48 + (lv - 1) * 0.13;
  const boxes = levelGeom ? levelGeom.boxes : spec.boxes;
  const cylinders = levelGeom ? levelGeom.cylinders ?? [] : spec.cylinders ?? [];
  const roof = levelGeom ? levelGeom.roof : spec.roof;
  const blinkers = levelGeom ? levelGeom.blinkers ?? [] : spec.blinkers ?? [];
  const rotors = levelGeom ? levelGeom.rotors ?? [] : spec.rotors ?? [];
  const critters = levelGeom ? levelGeom.critters ?? [] : spec.critters ?? [];
  const smoke = levelGeom ? levelGeom.smoke ?? [] : spec.smoke ?? [];

  for (const b of boxes) {
    const col = tintForVariant(b.color, variant);
    const y0 = Math.max(0, Math.round(b.y0 * (b.y0 <= 1 ? 1 : yScale)));
    const y1 = Math.max(y0 + 1, Math.round(b.y1 * yScale));
    v.box(b.x0, y0, b.z0, b.x1, y1, b.z1, col, b.emit ?? 0);
  }

  for (const cy of cylinders) {
    const col = tintForVariant(cy.color, variant);
    const y0 = Math.max(0, Math.round(cy.y0 * (cy.y0 <= 1 ? 1 : yScale)));
    const y1 = Math.max(y0 + 1, Math.round(cy.y1 * yScale));
    v.cylinderY(cy.cx, cy.cz, y0, y1, cy.radius, col, cy.emit ?? 0);
  }

  if (roof && roof.style !== "none") {
    const r = roof;
    const ry = Math.max(2, Math.round(r.y * yScale));
    const rCol = tintForVariant(r.color, variant);
    const trim = r.trimColor || "white";
    if (r.style === "gable") {
      gable(v, r.x0, ry, r.z0, r.x1, r.z1, "x", rCol, trim);
    } else if (r.style === "pyramid") {
      const steps = Math.min(6, Math.floor(Math.min(r.x1 - r.x0, r.z1 - r.z0) / 2));
      for (let i = 0; i < steps; i++) {
        v.box(r.x0 + i, ry + i, r.z0 + i, r.x1 - i, ry + i + 1, r.z1 - i, i === steps - 1 ? trim : rCol);
      }
    } else if (r.style === "dome") {
      const cx = Math.round((r.x0 + r.x1) / 2);
      const cz = Math.round((r.z0 + r.z1) / 2);
      const rad = Math.max(2, Math.min(7, Math.floor(Math.min(r.x1 - r.x0, r.z1 - r.z0) / 2)));
      for (let dy = 0; dy <= rad; dy++) {
        const layerRad = Math.sqrt(Math.max(0.5, rad * rad - dy * dy));
        v.cylinderY(cx, cz, ry + dy, ry + dy + 1, layerRad, dy === rad ? trim : rCol);
      }
    } else {
      v.box(r.x0, ry, r.z0, r.x1, ry + 1, r.z1, rCol);
    }
  }

  for (const bl of blinkers) {
    const by = Math.max(2, Math.round(bl.y * yScale));
    v.put(bl.x, by, bl.z, bl.color, 1.3);
    c.blink(bl.x, by, bl.z, bl.color);
  }

  for (const rt of rotors) {
    const py = Math.max(2, Math.round(rt.py * yScale));
    const rv = new PixelVox();
    if (rt.axis === "y") {
      rv.box(-rt.radius, 0, 0, rt.radius + 1, 1, 1, rt.color);
      rv.box(0, 0, -rt.radius, 1, 1, rt.radius + 1, rt.color);
    } else {
      rv.box(0, -rt.radius, 0, 1, rt.radius + 1, 1, rt.color);
      rv.box(0, 0, -rt.radius, 1, 1, rt.radius + 1, rt.color);
    }
    c.addRotor({ vox: rv, pivot: [rt.px, py, rt.pz], axis: rt.axis, speed: rt.speed, wind: false });
  }

  for (const cr of critters) {
    c.critters({ kind: cr.kind, count: cr.count, area: [cr.x0, cr.z0, cr.x1, cr.z1], y: 1 });
  }

  for (const sm of smoke) {
    const sy = Math.max(2, Math.round(sm.y * yScale));
    c.smoke(sm.x, sy, sm.z, sm.kind ?? "smoke");
  }
}

const customRegistry = new Map<string, CustomElementSpec>();
let hydrated = false;

export function registerCustomElement(spec: CustomElementSpec, persist = true): CivElementDef {
  customRegistry.set(spec.id, spec);

  const lvSpecs = spec.levelSpecs;
  const footprints: LevelSpanTuple =
    lvSpecs && lvSpecs.length === 5
      ? [
          [lvSpecs[0].footprintCells, lvSpecs[0].footprintCells],
          [lvSpecs[1].footprintCells, lvSpecs[1].footprintCells],
          [lvSpecs[2].footprintCells, lvSpecs[2].footprintCells],
          [lvSpecs[3].footprintCells, lvSpecs[3].footprintCells],
          [lvSpecs[4].footprintCells, lvSpecs[4].footprintCells],
        ]
      : [
          [spec.footprintCells, spec.footprintCells],
          [spec.footprintCells, spec.footprintCells],
          [spec.footprintCells, spec.footprintCells],
          [spec.footprintCells, spec.footprintCells],
          [spec.footprintCells, spec.footprintCells],
        ];
  ELEMENT_LEVEL_SPANS[spec.id] = footprints;

  const levelTitles: [string, string, string, string, string] =
    lvSpecs && lvSpecs.length === 5
      ? [lvSpecs[0].title, lvSpecs[1].title, lvSpecs[2].title, lvSpecs[3].title, lvSpecs[4].title]
      : [spec.name, `${spec.name} II`, `${spec.name} III`, `${spec.name} IV`, `${spec.name} V`];

  defineDesigns({
    [spec.id]: {
      footprints,
      levels: levelTitles,
      growth: spec.description || `PixBuilder custom ${spec.category} structure.`,
      build: (c) => buildCustomBlueprint(c, spec),
    },
  });

  // Base Level 1 stats on CivElementDef (simulation multiplies by levelMultiplier across Lv 1 -> Lv 5)
  const baseStats = lvSpecs?.[0]?.stats;
  const def: CivElementDef = {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    stage: 1,
    cost: baseStats ? baseStats.cost : spec.cost,
    archetype: archetypeForCategory(spec.category, spec.domain),
    domain: spec.domain,
    popBase: (baseStats ? baseStats.popBase : spec.popBase) || undefined,
    jobs: (baseStats ? baseStats.jobs : spec.jobs) || undefined,
    power: (baseStats ? baseStats.power : spec.power) || undefined,
    water: (baseStats ? baseStats.water : spec.water) || undefined,
    waste: (baseStats ? baseStats.waste : spec.waste) || undefined,
    food: (baseStats ? baseStats.food : spec.food) || undefined,
    education: (baseStats ? baseStats.education : spec.education) || undefined,
    recreation: (baseStats ? baseStats.recreation : spec.recreation) || undefined,
    government: (baseStats ? baseStats.government : spec.government) || undefined,
    police: (baseStats ? baseStats.police : spec.police) || undefined,
    policeRadius: (baseStats ? baseStats.policeRadius : spec.policeRadius) || undefined,
    fireRadius: (baseStats ? baseStats.fireRadius : spec.fireRadius) || undefined,
    military: (baseStats ? baseStats.military : spec.military) || undefined,
    income: (baseStats ? baseStats.income : spec.income) || undefined,
    needsMaintenance: true,
    baseSpan: footprints[0],
    maxSpan: footprints[4],
    accentHex: spec.accentHex,
    description: `${spec.description} (PixBuilder Custom)`,
  };

  ELEMENT_BY_ID[spec.id] = def;
  const idx = ELEMENTS.findIndex((e) => e.id === spec.id);
  if (idx >= 0) ELEMENTS[idx] = def;
  else ELEMENTS.push(def);

  invalidateVoxelAssetCache(spec.id);

  if (persist) saveCustomElementsToStorage();
  return def;
}

export function listCustomElements(): CustomElementSpec[] {
  return Array.from(customRegistry.values()).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export function getCustomElementSpec(id: string): CustomElementSpec | undefined {
  return customRegistry.get(id);
}

export function removeCustomElement(id: string): void {
  customRegistry.delete(id);
  delete ELEMENT_BY_ID[id];
  const idx = ELEMENTS.findIndex((e) => e.id === id);
  if (idx >= 0) ELEMENTS.splice(idx, 1);
  invalidateVoxelAssetCache(id);
  saveCustomElementsToStorage();
}

export function saveCustomElementsToStorage(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    writePlayerItem(STORAGE_KEY, JSON.stringify(listCustomElements()));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Call once on browser app mount (NOT at module import time) so unit tests
 * checking static catalog parity never see runtime localStorage items.
 */
export function hydrateCustomElements(): CustomElementSpec[] {
  if (hydrated) return listCustomElements();
  hydrated = true;
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = readPlayerItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    for (const item of parsed) {
      if (item && typeof item === "object" && typeof item.id === "string" && isCustomElementId(item.id)) {
        const { spec } = enforceModeBalance(item, item.createdInMode || "real", item.id);
        registerCustomElement(spec, false);
      }
    }
  } catch {
    // Ignore corrupt localStorage
  }
  return listCustomElements();
}
