import {transfer} from "./cityEconomy";
import type { CityMetrics, GameState } from "./simulation";

interface GrantTarget {
  label: string;
  metric: keyof CityMetrics;
  minimum: number;
  /** Require enough supply for this city's actual demand once it exceeds the minimum. */
  demand?: keyof CityMetrics;
  unit?: string;
}

interface CityGrant {
  id: string;
  name: string;
  reward: number;
  targets: GrantTarget[];
}

export const CITY_GRANTS: CityGrant[] = [
  {
    id: "first_street",
    name: "First Street",
    reward: 120,
    targets: [{ label: "Connected homes", metric: "connectedHouses", minimum: 2 }],
  },
  {
    id: "market_town",
    name: "Market Town",
    reward: 240,
    targets: [
      { label: "Connected homes", metric: "connectedHouses", minimum: 3 },
      { label: "Food supply", metric: "foodSupply", minimum: 35, demand: "foodDemand" },
    ],
  },
  {
    id: "shared_commute",
    name: "Shared Commute",
    reward: 750,
    targets: [
      { label: "Transit trips", metric: "transitTrips", minimum: 25 },
      { label: "Share of trips on transit", metric: "transitShare", minimum: 35, unit: "%" },
    ],
  },
  {
    id: "clean_power",
    name: "Clean Power District",
    reward: 1100,
    targets: [
      { label: "Connected homes", metric: "connectedHouses", minimum: 8 },
      { label: "Power supply", metric: "powerSupply", minimum: 150, demand: "powerDemand" },
      { label: "Renewable generation", metric: "renewablePct", minimum: 85, unit: "%" },
    ],
  },
  // Stage ladder: each milestone pays a development grant, so growth also funds the next step.
  ...([
    [2, 1_000], [3, 2_500], [4, 5_000], [5, 10_000], [6, 15_000], [7, 20_000], [8, 30_000],
    [9, 40_000], [10, 60_000], [12, 90_000], [15, 150_000], [20, 250_000],
  ] as const).map(([stage, reward]): CityGrant => ({
    id: "stage_" + stage,
    name: "Stage " + stage + " Development Grant",
    reward,
    targets: [{ label: "Stage reached", metric: "stageReached", minimum: stage }],
  })),
];

function required(target: GrantTarget, metrics: CityMetrics): number {
  return Math.max(target.minimum, target.demand ? Number(metrics[target.demand]) || 0 : 0);
}

export function grantProgress(grant: CityGrant, metrics: CityMetrics) {
  return grant.targets.map((target) => ({
    label: target.label,
    current: Number(metrics[target.metric]) || 0,
    goal: required(target, metrics),
    unit: target.unit ?? "",
  }));
}

/** Only active economic simulations call this. Saves and UI can read progress without paying. */
export function payEarnedGrants(state: GameState): CityGrant[] {
  if (state.mode === "god" || state.gameOver) return [];
  const alreadyPaid = state.awardedGrants ?? [];
  const earned = CITY_GRANTS.filter(
    (grant) =>
      !alreadyPaid.includes(grant.id) &&
      grant.targets.every(
        (target) => Number(state.metrics[target.metric]) >= required(target, state.metrics),
      ),
  );
  if (earned.length) {
    state.awardedGrants = alreadyPaid.concat(earned.map((grant) => grant.id));
    for (const grant of earned) transfer(state,"outside","treasury",grant.reward,grant.name+" grant");
  }
  return earned;
}
