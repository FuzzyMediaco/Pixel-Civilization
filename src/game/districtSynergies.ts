import type { PlacedElement } from "./simulation";

/**
 * Neighbor synergies are physical: plots must share a full grid edge.
 * The two buildings remain individually placeable, upgradeable and selectable.
 * Recalculation is deterministic, with no persistent state or save migration.
 */
export type DistrictSynergyKind =
  | "athletic_campus"
  | "feed_production"
  | "innovation_district"
  | "orchard_pollination";

export interface DistrictSynergy {
  kind: DistrictSynergyKind;
  title: string;
  aId: string;
  bId: string;
  educationBonus: number;
  recreationBonus: number;
  foodBonus: number;
  jobsBonus: number;
  incomeBonus: number;
}

export interface DistrictSynergyAnalysis {
  active: DistrictSynergy[];
  educationMultiplier: Map<string, number>;
  recreationMultiplier: Map<string, number>;
  foodMultiplier: Map<string, number>;
  jobsMultiplier: Map<string, number>;
  incomeMultiplier: Map<string, number>;
}

const isAny = (id: string, ids: readonly string[]): boolean => ids.includes(id);
const GRAIN = ["grain_farm", "grain_fields", "fields", "farms"] as const;
const DAIRY = ["dairy_farm", "cattle_ranch"] as const;
const UNIVERSITY = ["university", "skybridge_university"] as const;
const SPORTS = ["sports_field", "stadiums"] as const;
const RESEARCH = ["research_institute", "research_university"] as const;
const ORCHARD = ["orchards", "orchard_block", "groves_of_olives"] as const;
const APIARY = ["apiary"] as const;
const districtSites = new Set<string>([
  "high_school",
  ...GRAIN,
  ...DAIRY,
  ...UNIVERSITY,
  ...SPORTS,
  ...RESEARCH,
  ...ORCHARD,
  ...APIARY,
]);

type BonusKey =
  | "educationMultiplier"
  | "recreationMultiplier"
  | "foodMultiplier"
  | "jobsMultiplier"
  | "incomeMultiplier";

/** A unique source gets only one copy of any one synergy class, so a cluster is valuable, not exploitable. */
export function analyzeDistrictSynergies(
  elements: PlacedElement[],
  sharesOpenEdge?: (a: PlacedElement, b: PlacedElement) => boolean,
): DistrictSynergyAnalysis {
  const result: DistrictSynergyAnalysis = {
    active: [],
    educationMultiplier: new Map(),
    recreationMultiplier: new Map(),
    foodMultiplier: new Map(),
    jobsMultiplier: new Map(),
    incomeMultiplier: new Map(),
  };

  const occupied = new Map<string, PlacedElement>();
  for (const el of elements) {
    if (!districtSites.has(el.defId) || el.onFire || el.disrepair || !el.connected) continue;
    for (let x = el.gx; x < el.gx + el.spanX; x++) {
      for (let z = el.gz; z < el.gz + el.spanZ; z++) occupied.set(`${x},${z}`, el);
    }
  }

  const pairs = new Map<string, [PlacedElement, PlacedElement]>();
  for (const el of elements) {
    if (!districtSites.has(el.defId) || el.onFire || el.disrepair || !el.connected) continue;
    for (let x = el.gx; x < el.gx + el.spanX; x++) {
      for (let z = el.gz; z < el.gz + el.spanZ; z++) {
        for (const [dx, dz] of [
          [1, 0],
          [0, 1],
        ]) {
          const other = occupied.get(`${x + dx},${z + dz}`);
          if (!other || other.id === el.id) continue;
          const [a, b] = el.id < other.id ? [el, other] : [other, el];
          pairs.set(`${a.id}:${b.id}`, [a, b]);
        }
      }
    }
  }

  const grant = (key: BonusKey, id: string, amount: number, type: DistrictSynergyKind): void => {
    // A building can receive each district bonus once; differing districts may stack.
    const marker = `${type}:${key}:${id}`;
    if (applied.has(marker)) return;
    applied.add(marker);
    const current = result[key].get(id) ?? 1;
    result[key].set(id, Math.min(1.6, current + amount));
  };
  const applied = new Set<string>();
  const sortedPairs = [...pairs.values()].sort((a, b) => (a[0].id + a[1].id).localeCompare(b[0].id + b[1].id));
  for (const [a, b] of sortedPairs) {
    const ai = a.defId,
      bi = b.defId;
    if (sharesOpenEdge && !sharesOpenEdge(a, b)) continue;
    let synergy: DistrictSynergy | null = null;

    if ((ai === "high_school" && isAny(bi, SPORTS)) || (bi === "high_school" && isAny(ai, SPORTS))) {
      const school = ai === "high_school" ? a : b;
      const field = school.id === a.id ? b : a;
      grant("educationMultiplier", school.id, 0.16, "athletic_campus");
      grant("recreationMultiplier", school.id, 0.22, "athletic_campus");
      grant("recreationMultiplier", field.id, 0.2, "athletic_campus");
      synergy = {
        kind: "athletic_campus",
        title: "Athletic Campus",
        aId: school.id,
        bId: field.id,
        educationBonus: 0.16,
        recreationBonus: 0.22,
        foodBonus: 0,
        jobsBonus: 0,
        incomeBonus: 0,
      };
    } else if ((isAny(ai, DAIRY) && isAny(bi, GRAIN)) || (isAny(bi, DAIRY) && isAny(ai, GRAIN))) {
      const dairy = isAny(ai, DAIRY) ? a : b;
      const grain = dairy.id === a.id ? b : a;
      grant("foodMultiplier", dairy.id, 0.24, "feed_production");
      grant("foodMultiplier", grain.id, 0.12, "feed_production");
      synergy = {
        kind: "feed_production",
        title: "Feed Production",
        aId: dairy.id,
        bId: grain.id,
        educationBonus: 0,
        recreationBonus: 0,
        foodBonus: 0.24,
        jobsBonus: 0,
        incomeBonus: 0,
      };
    } else if (
      (isAny(ai, UNIVERSITY) && isAny(bi, RESEARCH)) ||
      (isAny(bi, UNIVERSITY) && isAny(ai, RESEARCH))
    ) {
      const university = isAny(ai, UNIVERSITY) ? a : b;
      const research = university.id === a.id ? b : a;
      grant("educationMultiplier", university.id, 0.2, "innovation_district");
      grant("jobsMultiplier", university.id, 0.12, "innovation_district");
      grant("jobsMultiplier", research.id, 0.18, "innovation_district");
      grant("incomeMultiplier", university.id, 0.18, "innovation_district");
      grant("incomeMultiplier", research.id, 0.15, "innovation_district");
      synergy = {
        kind: "innovation_district",
        title: "Innovation District",
        aId: university.id,
        bId: research.id,
        educationBonus: 0.2,
        recreationBonus: 0,
        foodBonus: 0,
        jobsBonus: 0.18,
        incomeBonus: 0.18,
      };
    } else if ((isAny(ai, ORCHARD) && isAny(bi, APIARY)) || (isAny(bi, ORCHARD) && isAny(ai, APIARY))) {
      const orchard = isAny(ai, ORCHARD) ? a : b;
      const bees = orchard.id === a.id ? b : a;
      grant("foodMultiplier", orchard.id, 0.18, "orchard_pollination");
      grant("incomeMultiplier", bees.id, 0.12, "orchard_pollination");
      synergy = {
        kind: "orchard_pollination",
        title: "Orchard Pollination",
        aId: orchard.id,
        bId: bees.id,
        educationBonus: 0,
        recreationBonus: 0,
        foodBonus: 0.18,
        jobsBonus: 0,
        incomeBonus: 0.12,
      };
    }
    if (synergy) {
      // Record all unique pairs for inspection, but cap displayed counters to genuine pairs.
      result.active.push(synergy);
    }
  }
  return result;
}
