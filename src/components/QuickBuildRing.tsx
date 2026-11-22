import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { ELEMENT_BY_ID } from "../game/catalog";
import { buildingCharges } from "../game/cityEconomy";
import type { GameState } from "../game/simulation";
import type { SelectionRingProjection } from "../game/worldRenderer";
import type {
  QuickBuildCategoryId,
  QuickCategorySuggestion,
  QuickElementSuggestion,
} from "../game/adaptiveQuickBuild";
import {
  getDecisionTreeParent,
  getDecisionTreeSubcategory,
  type DecisionTreeLeafElement,
  type DecisionTreeParentId,
  type QuickBuildMode,
} from "../game/quickBuildTree";
import { getOrderedDecisionTreeParents } from "../game/quickMenuPrefs";
import { CATEGORY_LABELS, CategoryFavicon, DecisionParentFavicon } from "./CategoryFavicon";
import { ElementFavicon } from "./ElementFavicon";

/**
 * Fast Builder Spiral Menu supporting three modes:
 *  - "adaptive" (Smart Build — default, 3 clicks): 6 smart categories → 6 smart elements → place + Quick Edit
 *  - "instant" (Quick Build — 2 clicks): 6 super-adaptive elements immediately → place + Quick Edit
 *  - "tree" (Exact Build — 4 clicks): non-adaptive 7 branches → 7 sub-branches → 4–6 elements → place + Quick Edit
 *
 * Uses the exact same smooth nested polar spiral animation as Quick Edit on every stage.
 */
export function QuickBuildRing({
  mode,
  state,
  tileKey,
  selectedCategory,
  categories,
  elements,
  instantElements,
  treeParentId,
  treeSubId,
  treeElements,
  exactParentOrder,
  onSubscribeProjection,
  onPickCategory,
  onPickTreeParent,
  onPickTreeSub,
  onPickElement,
  onBack,
  onClose,
}: {
  mode: QuickBuildMode;
  state: GameState;
  tileKey: string;
  selectedCategory: QuickBuildCategoryId | null;
  categories: QuickCategorySuggestion[];
  elements: QuickElementSuggestion[];
  instantElements: QuickElementSuggestion[];
  treeParentId: DecisionTreeParentId | null;
  treeSubId: string | null;
  treeElements: DecisionTreeLeafElement[];
  exactParentOrder?: DecisionTreeParentId[];
  onSubscribeProjection: (cb: (pos: SelectionRingProjection | null) => void) => () => void;
  onPickCategory: (cat: QuickBuildCategoryId) => void;
  onPickTreeParent: (parentId: DecisionTreeParentId) => void;
  onPickTreeSub: (subId: string) => void;
  onPickElement: (defId: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const ringRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const [hoveredTitle, setHoveredTitle] = useState<string | null>(null);

  const isTree = mode === "tree";
  const isInstant = mode === "instant";
  const orderedParents = getOrderedDecisionTreeParents(exactParentOrder);
  const activeParent = isTree && treeParentId ? getDecisionTreeParent(treeParentId) : undefined;
  const activeSub = isTree && treeParentId && treeSubId ? getDecisionTreeSubcategory(treeParentId, treeSubId) : undefined;

  const canStepBack = isInstant ? false : isTree ? treeParentId !== null : selectedCategory !== null;

  const stageKey = isInstant
    ? `${tileKey}:instant`
    : isTree
      ? treeSubId
        ? `${tileKey}:tree:${treeParentId}:${treeSubId}`
        : treeParentId
          ? `${tileKey}:tree:${treeParentId}`
          : `${tileKey}:tree:root`
      : selectedCategory
        ? `${tileKey}:cat:${selectedCategory}`
        : `${tileKey}:root`;

  const count = isInstant
    ? instantElements.length
    : isTree
      ? activeSub
        ? treeElements.length
        : activeParent
          ? activeParent.subcategories.length
          : orderedParents.length
      : selectedCategory !== null
        ? elements.length
        : categories.length;

  const charges = buildingCharges(state);

  useEffect(() => {
    setHoveredTitle(null);
  }, [stageKey]);

  useEffect(() => {
    readyRef.current = false;
    const node = ringRef.current;
    if (node) {
      node.dataset.ready = "false";
    }
    let raf = 0;
    const unsub = onSubscribeProjection((proj) => {
      const host = ringRef.current;
      if (!host) return;
      if (!proj || !proj.visible) {
        host.style.opacity = "0";
        host.dataset.hidden = "true";
        return;
      }
      host.dataset.hidden = "false";
      host.style.transform = `translate3d(${proj.x}px, ${proj.y}px, 0)`;
      // 7-node decision-tree rings get slightly more breathing room around the orbit
      const orbitR = count >= 7
        ? Math.max(86, Math.min(104, proj.radiusPx + 14))
        : Math.max(76, Math.min(96, proj.radiusPx + 8));
      host.style.setProperty("--ring-r", `${orbitR}px`);
      if (!readyRef.current) {
        readyRef.current = true;
        host.style.opacity = "1";
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          if (ringRef.current) ringRef.current.dataset.ready = "true";
        });
      } else {
        host.style.opacity = "1";
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      unsub();
    };
  }, [onSubscribeProjection, stageKey, count]);

  if (count === 0) return null;

  // Clean single-title caption (no extra helper text below)
  const fallbackTitle = isInstant
    ? null
    : isTree
      ? activeSub?.label ?? activeParent?.label ?? null
      : selectedCategory
        ? CATEGORY_LABELS[selectedCategory]
        : null;
  const displayTitle = hoveredTitle ?? fallbackTitle;

  const ariaLabel = isInstant
    ? "Quick Build elements"
    : isTree
      ? activeSub
        ? `Exact Build ${activeSub.label}`
        : activeParent
          ? `Exact Build ${activeParent.label}`
          : "Exact Build branches"
      : selectedCategory
        ? `Smart Build ${CATEGORY_LABELS[selectedCategory]}`
        : "Smart Build categories";

  return (
    <div
      ref={ringRef}
      className="ui-ring is-quickbuild"
      data-ready="false"
      role="toolbar"
      aria-label={ariaLabel}
    >
      <span className="ui-ring-qb-halo" aria-hidden="true" />

      {/* Center button: Back when drilled in, Close at root */}
      <button
        type="button"
        className="ui-ring-btn ui-ring-btn-center is-qb-center"
        aria-label={canStepBack ? "Back" : "Close quick build"}
        title={canStepBack ? "Back" : "Close quick build"}
        onClick={(e) => {
          e.stopPropagation();
          if (canStepBack) onBack();
          else onClose();
        }}
      >
        {canStepBack ? (
          <ArrowLeft size={18} strokeWidth={2.4} aria-hidden="true" />
        ) : (
          <X size={18} strokeWidth={2.4} aria-hidden="true" />
        )}
      </button>

      {/* Smooth nested polar spiral spokes */}
      <div key={stageKey} className="ui-ring-cluster">
        {isInstant ? (
          // Instant Smart Mode (2 taps): 6 super-adaptive placeable elements right away
          instantElements.map((item, idx) => {
            const angDeg = Number((-90 + (idx / count) * 360).toFixed(2));
            const priceText = charges ? `$${item.cost.toLocaleString()}` : "Free";
            return (
              <span
                key={item.def.id}
                className="ui-ring-spoke"
                style={{ "--ang": `${angDeg}deg`, "--idx": idx } as React.CSSProperties}
              >
                <span className="ui-ring-arm">
                  <span className="ui-ring-counter">
                    <button
                      type="button"
                      className={"ui-ring-btn is-qb-node is-qb-el" + (!item.canAfford ? " is-unaffordable" : "")}
                      disabled={!item.canAfford}
                      aria-label={`Build ${item.def.name} (${priceText})`}
                      title={`${item.def.name} · ${priceText}`}
                      onMouseEnter={() => setHoveredTitle(item.def.name)}
                      onMouseLeave={() => setHoveredTitle(null)}
                      onFocus={() => setHoveredTitle(item.def.name)}
                      onBlur={() => setHoveredTitle(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPickElement(item.def.id);
                      }}
                    >
                      <ElementFavicon def={item.def} className="ui-ring-el-favicon" />
                    </button>
                  </span>
                </span>
              </span>
            );
          })
        ) : !isTree ? (
          selectedCategory === null ? (
            categories.map((cat, idx) => {
              const angDeg = Number((-90 + (idx / count) * 360).toFixed(2));
              const label = CATEGORY_LABELS[cat.category];
              return (
                <span
                  key={cat.category}
                  className="ui-ring-spoke"
                  style={{ "--ang": `${angDeg}deg`, "--idx": idx } as React.CSSProperties}
                >
                  <span className="ui-ring-arm">
                    <span className="ui-ring-counter">
                      <button
                        type="button"
                        className={"ui-ring-btn is-qb-node" + (cat.urgent ? " is-urgent" : "")}
                        aria-label={`${label} — ${cat.reason}`}
                        title={`${label} · ${cat.reason}`}
                        onMouseEnter={() => setHoveredTitle(label)}
                        onMouseLeave={() => setHoveredTitle(null)}
                        onFocus={() => setHoveredTitle(label)}
                        onBlur={() => setHoveredTitle(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPickCategory(cat.category);
                        }}
                      >
                        <CategoryFavicon category={cat.category} size={25} />
                      </button>
                    </span>
                  </span>
                </span>
              );
            })
          ) : (
            elements.map((item, idx) => {
              const angDeg = Number((-90 + (idx / count) * 360).toFixed(2));
              const priceText = charges ? `$${item.cost.toLocaleString()}` : "Free";
              return (
                <span
                  key={item.def.id}
                  className="ui-ring-spoke"
                  style={{ "--ang": `${angDeg}deg`, "--idx": idx } as React.CSSProperties}
                >
                  <span className="ui-ring-arm">
                    <span className="ui-ring-counter">
                      <button
                        type="button"
                        className={"ui-ring-btn is-qb-node is-qb-el" + (!item.canAfford ? " is-unaffordable" : "")}
                        disabled={!item.canAfford}
                        aria-label={`Build ${item.def.name} (${priceText})`}
                        title={`${item.def.name} · ${priceText}`}
                        onMouseEnter={() => setHoveredTitle(item.def.name)}
                        onMouseLeave={() => setHoveredTitle(null)}
                        onFocus={() => setHoveredTitle(item.def.name)}
                        onBlur={() => setHoveredTitle(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPickElement(item.def.id);
                        }}
                      >
                        <ElementFavicon def={item.def} className="ui-ring-el-favicon" />
                      </button>
                    </span>
                  </span>
                </span>
              );
            })
          )
        ) : !activeParent ? (
          // Exact Build Stage 1: 7 Top Branches (in player's preferred order)
          orderedParents.map((parent, idx) => {
            const angDeg = Number((-90 + (idx / count) * 360).toFixed(2));
            return (
              <span
                key={parent.id}
                className="ui-ring-spoke"
                style={{ "--ang": `${angDeg}deg`, "--idx": idx } as React.CSSProperties}
              >
                <span className="ui-ring-arm">
                  <span className="ui-ring-counter">
                    <button
                      type="button"
                      className="ui-ring-btn is-qb-node is-qb-branch"
                      aria-label={parent.label}
                      title={`${parent.label} · ${parent.shortDesc}`}
                      onMouseEnter={() => setHoveredTitle(parent.label)}
                      onMouseLeave={() => setHoveredTitle(null)}
                      onFocus={() => setHoveredTitle(parent.label)}
                      onBlur={() => setHoveredTitle(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPickTreeParent(parent.id);
                      }}
                    >
                      <DecisionParentFavicon parentId={parent.id} size={25} />
                    </button>
                  </span>
                </span>
              </span>
            );
          })
        ) : !activeSub ? (
          // Decision Tree Stage 2: 7 Subcategories inside chosen parent
          activeParent.subcategories.map((sub, idx) => {
            const angDeg = Number((-90 + (idx / count) * 360).toFixed(2));
            const iconDef = ELEMENT_BY_ID[sub.iconDefId];
            return (
              <span
                key={sub.id}
                className="ui-ring-spoke"
                style={{ "--ang": `${angDeg}deg`, "--idx": idx } as React.CSSProperties}
              >
                <span className="ui-ring-arm">
                  <span className="ui-ring-counter">
                    <button
                      type="button"
                      className="ui-ring-btn is-qb-node is-qb-branch"
                      aria-label={sub.label}
                      title={sub.label}
                      onMouseEnter={() => setHoveredTitle(sub.label)}
                      onMouseLeave={() => setHoveredTitle(null)}
                      onFocus={() => setHoveredTitle(sub.label)}
                      onBlur={() => setHoveredTitle(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPickTreeSub(sub.id);
                      }}
                    >
                      {iconDef ? (
                        <ElementFavicon def={iconDef} className="ui-ring-el-favicon" />
                      ) : (
                        <DecisionParentFavicon parentId={activeParent.id} size={24} />
                      )}
                    </button>
                  </span>
                </span>
              </span>
            );
          })
        ) : (
          // Decision Tree Stage 3: 4–6 actual placeable elements
          treeElements.map((item, idx) => {
            const angDeg = Number((-90 + (idx / count) * 360).toFixed(2));
            const priceText = charges ? `$${item.cost.toLocaleString()}` : "Free";
            const disabled = !item.canAfford || !item.canPlace;
            const statusReason = item.lockReason ?? (!item.canAfford ? `Need ${priceText}` : item.placeReason);
            return (
              <span
                key={item.def.id}
                className="ui-ring-spoke"
                style={{ "--ang": `${angDeg}deg`, "--idx": idx } as React.CSSProperties}
              >
                <span className="ui-ring-arm">
                  <span className="ui-ring-counter">
                    <button
                      type="button"
                      className={"ui-ring-btn is-qb-node is-qb-el" + (disabled ? " is-unaffordable" : "")}
                      disabled={disabled}
                      aria-label={
                        disabled && statusReason
                          ? `${item.def.name} (${statusReason})`
                          : `Build ${item.def.name} (${priceText})`
                      }
                      title={statusReason ? `${item.def.name} · ${statusReason}` : `${item.def.name} · ${priceText}`}
                      onMouseEnter={() => setHoveredTitle(item.def.name)}
                      onMouseLeave={() => setHoveredTitle(null)}
                      onFocus={() => setHoveredTitle(item.def.name)}
                      onBlur={() => setHoveredTitle(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPickElement(item.def.id);
                      }}
                    >
                      <ElementFavicon def={item.def} className="ui-ring-el-favicon" />
                    </button>
                  </span>
                </span>
              </span>
            );
          })
        )}
      </div>

      {/* Minimal single-line label only (no extra instructional subtitle) */}
      {displayTitle && (
        <div className="ui-ring-qb-caption" aria-live="polite">
          <strong>{displayTitle}</strong>
        </div>
      )}
    </div>
  );
}
