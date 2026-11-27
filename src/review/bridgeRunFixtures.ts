import { createInitialGameState, planConstruction, recomputeConnectivityAndMetrics, upgradeElementDirect } from "../game/simulation";
import { applyInfrastructureStroke, type SpanMode, type SpanShape, type WorksPreview } from "../game/terrain";
import type { RailBridgeKind } from "../game/bridgeWorks";

import { ELEMENT_BY_ID, getMaxElementLevel } from "../game/catalog";
import designStyles from "../game/designStyles.json";

const catalogForms = { bridges: "truss", stone_bridges: "arch", suspension_bridges: "suspension" } as const;
type BridgeId = keyof typeof catalogForms;

export interface BridgeStudy {
  label: string;
  shape: SpanShape;
  length: number;
  tier: number;
  axis: "x" | "z";
  mode?: SpanMode;
  reverse?: boolean;
  railType?: RailBridgeKind;
  lift?: "open" | "closed";
  catalogId?: BridgeId;
  variant?: number;
}

export const BRIDGE_STUDIES: Record<string, BridgeStudy[]> = {
  lengths: [
    { label: "Single span", shape: "suspension", length: 1, tier: 1, axis: "x" },
    { label: "Three joined spans", shape: "suspension", length: 3, tier: 5, axis: "x" },
    { label: "Six joined spans", shape: "suspension", length: 6, tier: 8, axis: "x" },
    { label: "Harbor crossing", shape: "suspension", length: 12, tier: 11, axis: "x" },
  ],
  landmarks: [
    { label: "Suspension crossing", shape: "suspension", length: 12, tier: 11, axis: "x" },
    { label: "Stone crossing", shape: "arch", length: 12, tier: 11, axis: "z", reverse: true },
    { label: "Steel through-arch", shape: "truss", length: 12, tier: 11, axis: "z", reverse: true },
    { label: "Two-tile highway", shape: "beam", length: 12, tier: 11, axis: "x", mode: "highway" },
    { label: "Lift lowered", shape: "lift", length: 6, tier: 11, axis: "x", reverse: true, lift: "closed" },
    { label: "Lift raised", shape: "lift", length: 6, tier: 11, axis: "x", reverse: true, lift: "open" },
  ],
  rail: [
    { label: "Timber trestle", shape: "truss", railType: "timber", length: 6, tier: 5, axis: "x", mode: "rail" },
    { label: "Stone viaduct", shape: "arch", railType: "viaduct", length: 6, tier: 5, axis: "x", mode: "rail" },
    { label: "Riveted truss", shape: "truss", railType: "steel", length: 6, tier: 5, axis: "x", mode: "rail" },
    { label: "Elevated railway", shape: "beam", railType: "elevated", length: 6, tier: 5, axis: "x", mode: "rail" },
    { label: "Cable-stayed railway", shape: "suspension", railType: "highlevel", length: 6, tier: 5, axis: "z", mode: "rail" },
  ],
};

export function catalogBridgeStudies(id: string, variantParam: string | null): BridgeStudy[] {
  if (!Object.hasOwn(catalogForms, id)) throw new Error("Unknown catalog bridge: " + id);
  const catalogId = id as BridgeId;
  const max = getMaxElementLevel(catalogId);
  const variants = variantParam === null || variantParam === "all" ? [0, 1, 2, 3] : [Number(variantParam)];
  const tiers = variantParam === null ? [max] : Array.from({ length: max }, (_, i) => i + 1);
  return variants.flatMap(variant => {
    if (!Number.isInteger(variant) || variant < 0 || variant > 3) throw new Error("Bridge variant must be 0 to 3");
    return tiers.map(tier => ({ catalogId, variant, tier, shape: catalogForms[catalogId],
      label: designStyles[catalogId][variant], length: 12, axis: "x" as const }));
  });
}

export function pitchedBridge(study: BridgeStudy) {
  const state = createInitialGameState("god");
  const { length, axis, shape, reverse, railType, mode = "road", lift = "closed" } = study;
  const left = -Math.floor(length / 2), right = left + length - 1;
  const p = (u: number, v = 0) => axis === "x" ? { gx: u, gz: v } : { gx: v, gz: u };
  const requirePlan = (plan: WorksPreview) => {
    if (!plan.valid) throw new Error(study.label + ": " + plan.reason);
  };
  for (let u = left; u <= right; u++)
    requirePlan(applyInfrastructureStroke(state, { kind: "canal", depth: 2.5 }, [p(u, -2), p(u, 2)]));
  for (let u = right + 1; u <= right + 2; u++)
    requirePlan(applyInfrastructureStroke(state, { kind: "raise", height: 1.5 }, [p(u, -2), p(u, 2)]));
  if (study.catalogId) {
    // Match brush placement: dry roads on each bank enclose the chosen bridge tiles.
    for (let u = left - 1; u <= right + 1; u++) {
      const { gx, gz } = p(u);
      const id = u < left || u > right ? "roads" : study.catalogId;
      const plan = planConstruction(state, ELEMENT_BY_ID[id], gx, gz, 1, 0);
      if (!plan.valid) throw new Error(id + ": " + plan.reason);
      state.elements.push({ gx, gz, id: "study-" + gx + "-" + gz, defId: plan.def.id, spanX: plan.spanX, spanZ: plan.spanZ,
        rotation: plan.rotation, level: plan.level, overWater: plan.overWater, variant: study.variant ?? 0,
        connected: false, hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0, maintTimerSec: 0,
        disrepair: false, onFire: false, animProgress: 1, animKind: "place" });
    }
    recomputeConnectivityAndMetrics(state);
    if (!state.infrastructure?.spans[p(left).gx + "," + p(left).gz]?.catalog) throw new Error("Brush span did not promote");
  } else {
    const banks = [p(left - 1), p(right + 1)];
    requirePlan(applyInfrastructureStroke(state, { kind: "bridge", mode, shape, height: railType ? 3.5 : 4, lift, railType }, reverse ? banks.reverse() : banks));
  }
  const first = p(left);
  const piece = state.elements.find(e => e.gx === first.gx && e.gz === first.gz)!;
  function upgradeTo(target: number) {
    while ((state.infrastructure!.spans[first.gx + "," + first.gz].tier ?? 1) < target) {
      const result = upgradeElementDirect(state, piece.id);
      if (!result.ok) throw new Error(study.label + ": upgrade to level " + target + " failed");
    }
  }
  upgradeTo(study.tier);
  return { state, left, right, upgradeTo };
}
