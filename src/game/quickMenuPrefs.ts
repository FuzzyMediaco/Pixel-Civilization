/**
 * Unified Quick Menus configuration & safe customization engine:
 *  - Quick Edit: Always-on radial spiral menu around any selected element.
 *    Users can switch between Fixed order and Adapt to my clicks (frequency-sorted),
 *    reorder buttons, or hide optional buttons — while core safety buttons (Delete, More details)
 *    and situational emergency buttons (Fire crew, Repair, Rail Ops) are protected and never broken.
 *  - Smart Build (default, 3 clicks): Adaptive 6 categories → 6 elements → place + Quick Edit.
 *  - Quick Build (2 clicks): Super-adaptive 6 immediate elements → place + Quick Edit.
 *  - Exact Build (4 clicks): Non-adaptive 7 × 7 × (4–6) decision tree covering all 270 elements.
 *    Users can safely reorder the 7 top branches so their favorite branch sits at 12 o'clock.
 */
import {
  QUICK_BUILD_TREE,
  type DecisionTreeParent,
  type DecisionTreeParentId,
  type QuickBuildMode,
} from "./quickBuildTree";

export type QuickEditActionId =
  | "upgrade"
  | "delete"
  | "bulk"
  | "variant"
  | "move"
  | "rotate"
  | "undo"
  | "more";

export type QuickEditOrderMode = "fixed" | "adaptive";

export type SmartBuildFocus = "balanced" | "needs" | "habits" | "local";

export interface QuickEditPrefs {
  orderMode: QuickEditOrderMode;
  buttonOrder: QuickEditActionId[];
  hiddenButtons: QuickEditActionId[];
  clickCounts: Record<string, number>;
}

export interface QuickMenuPrefs {
  quickEdit: QuickEditPrefs;
  smartFocus: SmartBuildFocus;
  openQuickEditAfterPlace: boolean;
  exactParentOrder: DecisionTreeParentId[];
}

export interface QuickEditButtonMeta {
  id: QuickEditActionId;
  label: string;
  desc: string;
  core?: boolean;
}

export const QUICK_BUILD_MODE_META: {
  id: QuickBuildMode;
  name: string;
  clicks: string;
  shortDesc: string;
  detail: string;
}[] = [
  {
    id: "adaptive",
    name: "Smart Build",
    clicks: "3 clicks · Default",
    shortDesc: "6 smart categories → 6 smart elements",
    detail:
      "Tap empty ground → pick from 6 adaptive categories → pick from 6 tailored elements. Balances city needs, map spot, stage, and your habits.",
  },
  {
    id: "instant",
    name: "Quick Build",
    clicks: "2 clicks",
    shortDesc: "Straight to 6 super-adaptive elements",
    detail:
      "Skips categories and immediately spirals out the 6 elements you are most likely to place right there based on stage, city needs, neighbors, and recent builds.",
  },
  {
    id: "tree",
    name: "Exact Build",
    clicks: "4 clicks",
    shortDesc: "Non-adaptive 7 × 7 × 6 decision tree",
    detail:
      "Never changes on you: all 270 elements organized into 7 top branches → 7 sub-branches → up to 6 elements so you always know exactly where everything lives.",
  },
];

export const SMART_FOCUS_META: { id: SmartBuildFocus; label: string; hint: string }[] = [
  { id: "balanced", label: "Balanced", hint: "Blends city needs, nearby tiles, game stage, and your habits." },
  { id: "needs", label: "City needs", hint: "Prioritizes shortages (power, water, food, safety, jobs) first." },
  { id: "habits", label: "My habits", hint: "Strongly favors the categories and elements you build most often." },
  { id: "local", label: "Nearby tiles", hint: "Emphasizes waterfront, streetfront, rail, and matching neighbors." },
];

export const QUICK_EDIT_BUTTON_META: QuickEditButtonMeta[] = [
  { id: "upgrade", label: "Upgrade", desc: "Level up the selected element" },
  { id: "delete", label: "Delete", desc: "Remove the selected element", core: true },
  { id: "bulk", label: "Bulk select", desc: "Select multiple items to delete together" },
  { id: "variant", label: "Visual style", desc: "Cycle between the 4 architectural styles" },
  { id: "move", label: "Move", desc: "Relocate the element to another tile" },
  { id: "rotate", label: "Rotate 90°", desc: "Turn buildings to face another street" },
  { id: "undo", label: "Undo edit", desc: "Step back the last change on this tile" },
  { id: "more", label: "Details & stats", desc: "Open the full inspector panel", core: true },
];

export const CORE_QUICK_EDIT_IDS = new Set<QuickEditActionId>(
  QUICK_EDIT_BUTTON_META.filter((b) => b.core).map((b) => b.id),
);

export const DEFAULT_QUICK_EDIT_ORDER: QuickEditActionId[] = QUICK_EDIT_BUTTON_META.map((b) => b.id);

export const DEFAULT_EXACT_PARENT_ORDER: DecisionTreeParentId[] = QUICK_BUILD_TREE.map((p) => p.id);

const QUICK_MENU_PREFS_KEY = "pixel_civ_quick_menu_prefs_v1";

export function createDefaultQuickMenuPrefs(): QuickMenuPrefs {
  return {
    quickEdit: {
      orderMode: "fixed",
      buttonOrder: [...DEFAULT_QUICK_EDIT_ORDER],
      hiddenButtons: [],
      clickCounts: {},
    },
    smartFocus: "balanced",
    openQuickEditAfterPlace: true,
    exactParentOrder: [...DEFAULT_EXACT_PARENT_ORDER],
  };
}

export function sanitizeQuickMenuPrefs(raw: Partial<QuickMenuPrefs> | null | undefined): QuickMenuPrefs {
  const def = createDefaultQuickMenuPrefs();
  if (!raw || typeof raw !== "object") return def;

  // Sanitize Quick Edit button order: keep valid unique IDs, then append any missing defaults
  const rawOrder = Array.isArray(raw.quickEdit?.buttonOrder) ? raw.quickEdit.buttonOrder : [];
  const validSet = new Set<QuickEditActionId>(DEFAULT_QUICK_EDIT_ORDER);
  const buttonOrder: QuickEditActionId[] = [];
  for (const id of rawOrder) {
    if (validSet.has(id as QuickEditActionId) && !buttonOrder.includes(id as QuickEditActionId)) {
      buttonOrder.push(id as QuickEditActionId);
    }
  }
  for (const id of DEFAULT_QUICK_EDIT_ORDER) {
    if (!buttonOrder.includes(id)) buttonOrder.push(id);
  }

  // Sanitize hidden buttons: core buttons (delete, more) can NEVER be hidden
  const rawHidden = Array.isArray(raw.quickEdit?.hiddenButtons) ? raw.quickEdit.hiddenButtons : [];
  const hiddenButtons: QuickEditActionId[] = [];
  for (const id of rawHidden) {
    if (
      validSet.has(id as QuickEditActionId) &&
      !CORE_QUICK_EDIT_IDS.has(id as QuickEditActionId) &&
      !hiddenButtons.includes(id as QuickEditActionId)
    ) {
      hiddenButtons.push(id as QuickEditActionId);
    }
  }

  // Sanitize click counts
  const rawCounts = raw.quickEdit?.clickCounts;
  const clickCounts: Record<string, number> = {};
  if (rawCounts && typeof rawCounts === "object") {
    for (const [k, v] of Object.entries(rawCounts)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        clickCounts[k] = Math.floor(v);
      }
    }
  }

  // Sanitize Exact Build 7 parent branch order
  const rawParents = Array.isArray(raw.exactParentOrder) ? raw.exactParentOrder : [];
  const validParents = new Set<DecisionTreeParentId>(DEFAULT_EXACT_PARENT_ORDER);
  const exactParentOrder: DecisionTreeParentId[] = [];
  for (const pid of rawParents) {
    if (validParents.has(pid as DecisionTreeParentId) && !exactParentOrder.includes(pid as DecisionTreeParentId)) {
      exactParentOrder.push(pid as DecisionTreeParentId);
    }
  }
  for (const pid of DEFAULT_EXACT_PARENT_ORDER) {
    if (!exactParentOrder.includes(pid)) exactParentOrder.push(pid);
  }

  const orderMode: QuickEditOrderMode = raw.quickEdit?.orderMode === "adaptive" ? "adaptive" : "fixed";
  const smartFocus: SmartBuildFocus =
    raw.smartFocus === "needs" || raw.smartFocus === "habits" || raw.smartFocus === "local"
      ? raw.smartFocus
      : "balanced";
  const openQuickEditAfterPlace =
    typeof raw.openQuickEditAfterPlace === "boolean" ? raw.openQuickEditAfterPlace : true;

  return {
    quickEdit: {
      orderMode,
      buttonOrder,
      hiddenButtons,
      clickCounts,
    },
    smartFocus,
    openQuickEditAfterPlace,
    exactParentOrder,
  };
}

export function loadQuickMenuPrefs(): QuickMenuPrefs {
  try {
    if (typeof localStorage === "undefined") return createDefaultQuickMenuPrefs();
    const raw = localStorage.getItem(QUICK_MENU_PREFS_KEY);
    if (!raw) return createDefaultQuickMenuPrefs();
    return sanitizeQuickMenuPrefs(JSON.parse(raw) as Partial<QuickMenuPrefs>);
  } catch {
    return createDefaultQuickMenuPrefs();
  }
}

export function saveQuickMenuPrefs(prefs: QuickMenuPrefs): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(QUICK_MENU_PREFS_KEY, JSON.stringify(sanitizeQuickMenuPrefs(prefs)));
  } catch {
    // Ignore private-mode / quota errors
  }
}

export function recordQuickEditClick(prefs: QuickMenuPrefs, actionId: string): QuickMenuPrefs {
  const nextCounts = {
    ...prefs.quickEdit.clickCounts,
    [actionId]: (prefs.quickEdit.clickCounts[actionId] ?? 0) + 1,
  };
  return {
    ...prefs,
    quickEdit: {
      ...prefs.quickEdit,
      clickCounts: nextCounts,
    },
  };
}

export function toggleQuickEditButton(prefs: QuickMenuPrefs, id: QuickEditActionId): QuickMenuPrefs {
  if (CORE_QUICK_EDIT_IDS.has(id)) return prefs;
  const hidden = new Set(prefs.quickEdit.hiddenButtons);
  if (hidden.has(id)) hidden.delete(id);
  else hidden.add(id);
  return {
    ...prefs,
    quickEdit: {
      ...prefs.quickEdit,
      hiddenButtons: [...hidden],
    },
  };
}

export function moveQuickEditButton(prefs: QuickMenuPrefs, id: QuickEditActionId, delta: -1 | 1): QuickMenuPrefs {
  const order = [...prefs.quickEdit.buttonOrder];
  const idx = order.indexOf(id);
  const nextIdx = idx + delta;
  if (idx < 0 || nextIdx < 0 || nextIdx >= order.length) return prefs;
  const [item] = order.splice(idx, 1);
  order.splice(nextIdx, 0, item);
  return {
    ...prefs,
    quickEdit: {
      ...prefs.quickEdit,
      buttonOrder: order,
    },
  };
}

export function moveExactParent(prefs: QuickMenuPrefs, id: DecisionTreeParentId, delta: -1 | 1): QuickMenuPrefs {
  const order = [...prefs.exactParentOrder];
  const idx = order.indexOf(id);
  const nextIdx = idx + delta;
  if (idx < 0 || nextIdx < 0 || nextIdx >= order.length) return prefs;
  const [item] = order.splice(idx, 1);
  order.splice(nextIdx, 0, item);
  return {
    ...prefs,
    exactParentOrder: order,
  };
}

/**
 * Safely filters and sorts Quick Edit spiral actions according to user preferences.
 * Emergency/situational actions (`fire`, `repair`, `rail`) and core buttons (`delete`, `more`)
 * are NEVER hidden so gameplay functions can never break.
 */
export function resolveQuickEditActions<T extends { id: string }>(
  actions: T[],
  prefs?: QuickEditPrefs,
): T[] {
  if (!prefs) return actions;
  const hidden = new Set<string>(prefs.hiddenButtons.filter((id) => !CORE_QUICK_EDIT_IDS.has(id)));
  const visible = actions.filter((a) => !hidden.has(a.id));
  if (visible.length === 0) return actions;

  const orderIndex = new Map<string, number>();
  prefs.buttonOrder.forEach((id, i) => orderIndex.set(id, i));

  // Situational priority: fire always sits at 12 o'clock when a building is burning
  const emergencyRank = (id: string) => (id === "fire" ? -2 : id === "repair" ? -1 : 0);

  return [...visible].sort((a, b) => {
    const ea = emergencyRank(a.id);
    const eb = emergencyRank(b.id);
    if (ea !== eb) return ea - eb;

    if (prefs.orderMode === "adaptive") {
      const ca = prefs.clickCounts[a.id] ?? 0;
      const cb = prefs.clickCounts[b.id] ?? 0;
      if (ca !== cb) return cb - ca;
    }

    const ia = orderIndex.get(a.id) ?? 99;
    const ib = orderIndex.get(b.id) ?? 99;
    return ia - ib;
  });
}

/** Returns the 7 Exact Build parent branches in the player's customized order (always all 7). */
export function getOrderedDecisionTreeParents(order?: DecisionTreeParentId[]): DecisionTreeParent[] {
  if (!order || order.length === 0) return QUICK_BUILD_TREE;
  const byId = new Map(QUICK_BUILD_TREE.map((p) => [p.id, p]));
  const result: DecisionTreeParent[] = [];
  for (const id of order) {
    const p = byId.get(id);
    if (p && !result.includes(p)) result.push(p);
  }
  for (const p of QUICK_BUILD_TREE) {
    if (!result.includes(p)) result.push(p);
  }
  return result;
}
