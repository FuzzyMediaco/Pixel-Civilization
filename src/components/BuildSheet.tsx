import { eraElementName } from "../game/eraStyles";
import { usePeriodNames } from "./PeriodPicker";
import React, { useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
import {
  CATEGORY_META,
  type CivElementDef,
  type ElementCategory,
  ELEMENTS,
} from "../game/catalog";
import { buildingCharges, constructionCost, unlockWealth } from "../game/cityEconomy";
import { type IssueFix, suppliesNeed } from "../game/cityIssues";
import { isCustomElementId } from "../game/customElements";
import { buildingLockReason, type GameState } from "../game/simulation";
import { CategoryFavicon } from "./CategoryFavicon";
import { ElementFavicon } from "./ElementFavicon";
import { BottomSheet, type SheetHeight } from "./ui";

export type BuildCategory = "suggested" | "all" | "custom" | ElementCategory;

export interface BuildSheetBrush {
  kind: string;
  defId?: string;
}

const STAT_LINE = (d: CivElementDef) => {
  if (d.popBase) return "+" + d.popBase + " homes";
  if (d.power && d.power > 0) return "+" + d.power + " power";
  if (d.water && d.water > 0) return "+" + d.water + " water";
  if (d.food && d.food > 0) return "+" + d.food + " food";
  if (d.waste && d.waste > 0) return "+" + d.waste + " waste";
  if (d.fireRadius) return "Fire r" + d.fireRadius;
  if (d.policeRadius) return "Police r" + d.policeRadius;
  if (d.education) return "+" + d.education + " school";
  if (d.recreation) return "+" + d.recreation + " park";
  if (d.jobs) return "+" + d.jobs + " jobs";
  if (d.isRoadNetwork) return "Road";
  if (d.isRailNetwork) return "Rail";
  return "";
};

const SUGGESTED_IDS = [
  "roads",
  "house",
  "cottages",
  "rowhouse_duplex",
  "farms",
  "wells",
  "windmills",
  "grocery_store",
  "school",
  "fire_department",
  "police_precinct",
  "park",
  "shops",
  "water_towers",
];

const CAT_LABELS: Record<string, string> = {
  suggested: "Suggested",
  all: "All Elements",
  custom: "Custom",
  ...Object.fromEntries(CATEGORY_META.map((c) => [c.id, c.label])),
};

const COMPACT_MONEY = (v: number) =>
  new Intl.NumberFormat("en", {
    notation: Math.abs(v) >= 100000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(v) >= 100000 ? 1 : 0,
  }).format(Math.floor(v));

export function BuildSheet({
  state,
  brush,
  cat,
  onCat,
  query,
  onQuery,
  fix,
  onClearFix,
  onPick,
  height,
  onHeight,
  onClose,
}: {
  state: GameState;
  brush: BuildSheetBrush;
  cat: BuildCategory;
  onCat: (c: BuildCategory) => void;
  query: string;
  onQuery: (q: string) => void;
  fix?: IssueFix;
  onClearFix: () => void;
  onPick: (defId: string) => void;
  height: SheetHeight;
  onHeight: (h: SheetHeight) => void;
  onClose: () => void;
}) {
  const { era, name: periodName } = usePeriodNames();
  const inputRef = useRef<HTMLInputElement>(null);
  const god = state.mode === "god";
  const charges = buildingCharges(state);
  const wealth = unlockWealth(state);
  const searching = query.trim().length > 0;
  const activeCat: BuildCategory = fix?.category ?? cat;

  const isUnlocked = (d: CivElementDef) => god || !buildingLockReason(d, state);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = ELEMENTS.filter((d) => isUnlocked(d));
    if (fix?.need) {
      const picked = list.filter((d) => suppliesNeed(d, fix.need!));
      if (picked.length) return picked;
    }
    if (q) {
      return list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          eraElementName(d.id, era).toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.searchAliases?.some(alias => alias.toLowerCase().includes(q)) ||
          d.category.includes(q),
      );
    }
    if (activeCat === "custom") return list.filter((d) => isCustomElementId(d.id));
    if (activeCat === "suggested") {
      const byId = new Map(list.map((d) => [d.id, d]));
      const top = SUGGESTED_IDS.map((id) => byId.get(id)).filter((d): d is CivElementDef => !!d);
      return top.length ? top : list.slice(0, 12);
    }
    if (activeCat === "starter") list = list.filter((d) => d.isStarter);
    else if (activeCat !== "all") list = list.filter((d) => d.category === activeCat);
    return list;
  }, [state, god, wealth, query, activeCat, fix, era]);

  const lockedCount = useMemo(() => {
    if (god || activeCat === "suggested" || activeCat === "custom" || searching) return 0;
    return ELEMENTS.filter(
      (d) =>
        (activeCat === "all" || (activeCat === "starter" ? d.isStarter : d.category === activeCat)) &&
        !isUnlocked(d),
    ).length;
  }, [god, activeCat, searching, state, wealth]);

  const activeTitle = fix ? fix.label : searching ? `Search · ${items.length}` : CAT_LABELS[activeCat] ?? "Build";
  const budgetLabel = charges ? `$${COMPACT_MONEY(state.money)}` : "Free";

  const hasCustom = useMemo(() => ELEMENTS.some((d) => isCustomElementId(d.id)), [ELEMENTS.length]);

  const cats: { id: BuildCategory; label: string }[] = [
    { id: "suggested", label: "Suggested" },
    { id: "all", label: "All elements" },
    ...(hasCustom ? [{ id: "custom" as BuildCategory, label: "Custom" }] : []),
    ...CATEGORY_META.map((c) => ({ id: c.id as BuildCategory, label: c.label })),
  ];

  return (
    <BottomSheet
      id="sheet-build"
      title={activeTitle}
      subtitle={budgetLabel}
      height={height}
      onHeightChange={onHeight}
      onClose={onClose}
      closeLabel="Close Build"
      dock={
        <div className="ui-sheet-dock is-tight">
          <div className="ui-build-toolbar">
            <label className="ui-search is-compact">
              <Search size={13} aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => {
                  onClearFix();
                  onQuery(e.target.value);
                }}
                placeholder={`Search ${activeTitle.toLowerCase()}…`}
                aria-label="Search buildable items"
              />
              {query && (
                <button
                  type="button"
                  className="ui-mini-icon-btn"
                  aria-label="Clear search"
                  onClick={() => {
                    onQuery("");
                    inputRef.current?.focus();
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </label>
            {fix && (
              <button
                type="button"
                className="ui-sheet-icon-btn"
                title="Clear filter"
                aria-label="Clear fix filter"
                onClick={onClearFix}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {!searching && (
            <div className="ui-icon-strip is-compact" role="group" aria-label="Build categories">
              {cats.map((c) => {
                const on = activeCat === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={"ui-cat-icon-btn" + (on ? " is-active" : "")}
                    aria-pressed={on}
                    aria-label={c.label}
                    title={c.label}
                    onClick={() => {
                      onClearFix();
                      onCat(c.id);
                    }}
                  >
                    <CategoryFavicon category={c.id} size={17} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      }
    >
      {items.length === 0 ? (
        <div className="ui-empty">
          Nothing unlocked matches {query ? `“${query}”` : "this category"} yet.
        </div>
      ) : (
        <>
          <div className="ui-cards is-compact" role="list" aria-label="Items">
            {items.map((d, i) => {
              const cost = constructionCost(state, d);
              const poor = cost > 0 && state.money < cost;
              const stat = STAT_LINE(d);
              const selected = brush.kind === "place" && brush.defId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="listitem"
                  className="ui-card is-compact"
                  aria-pressed={selected}
                  disabled={poor}
                  aria-label={
                    periodName(d.id) +
                    (stat ? ", " + stat : "") +
                    ", " +
                    (cost ? "$" + cost.toLocaleString() : "Free") +
                    (poor ? ", not enough funds" : "")
                  }
                  onClick={() => onPick(d.id)}
                >
                  <ElementFavicon def={d} eager={i < 12} />
                  <b>{periodName(d.id)}</b>
                  {stat && <small>{stat}</small>}
                  <span className={"ui-cost" + (poor ? " is-bad" : "")}>
                    {cost ? "$" + cost.toLocaleString() : "Free"}
                  </span>
                </button>
              );
            })}
          </div>
          {lockedCount > 0 && (
            <p className="ui-muted" style={{ marginTop: 8, textAlign: "center" }}>
              {lockedCount} more unlock at higher stages or city wealth.
            </p>
          )}
        </>
      )}
    </BottomSheet>
  );
}
