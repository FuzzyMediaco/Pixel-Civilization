import { christmasActionLabel } from "../game/christmasDecorations";
import { usePeriodNames } from "./PeriodPicker";
import React, { useEffect, useRef } from "react";
import {
  ArrowUp,
  Check,
  Flame,
  ListChecks,
  MoreHorizontal,
  Move,
  RotateCw,
  Shuffle,
  TreePine,
  TrainFront,
  Trash2,
  Undo2,
  Wrench,
} from "lucide-react";
import { type CivElementDef, getMaxElementLevel } from "../game/catalog";
import { buildingCharges, upgradeReadiness } from "../game/cityEconomy";
import { resolveQuickEditActions, type QuickEditPrefs } from "../game/quickMenuPrefs";
import { type GameState, type PlacedElement, placedUpgradeCost } from "../game/simulation";
import type { SelectionRingProjection } from "../game/worldRenderer";
import { RAIL_SITES } from "./InspectorSheet";

interface RingAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  tone?: "primary" | "danger" | "undo";
  disabled?: boolean;
  onClick: () => void;
}

export interface PendingConfirmAction {
  key: string;
  label: string;
  sublabel?: string;
  valid: boolean;
  onConfirm: () => void;
}

export function SelectionRing({
  state,
  el,
  def,
  deletedName,
  pendingConfirm,
  bulkCount = 0,
  bulkActive = false,
  canUndo,
  quickEditPrefs,
  onTrackQuickEditAction,
  onSubscribeProjection,
  onUpgrade,
  onDemolish,
  onBulkDemolish,
  onStartBulkSelect,
  onChristmas,
  onVariant,
  onMove,
  onRotate,
  onMaintain,
  onRailOps,
  onUndo,
  onOpenDetails,
}: {
  state: GameState;
  el?: PlacedElement;
  def?: CivElementDef;
  deletedName?: string;
  pendingConfirm?: PendingConfirmAction | null;
  bulkCount?: number;
  bulkActive?: boolean;
  canUndo: boolean;
  quickEditPrefs?: QuickEditPrefs;
  onTrackQuickEditAction?: (actionId: string) => void;
  onSubscribeProjection: (cb: (pos: SelectionRingProjection | null) => void) => () => void;
  onUpgrade: () => void;
  onDemolish: () => void;
  onBulkDemolish?: () => void;
  onStartBulkSelect?: () => void;
  onChristmas?: () => void;
  onVariant: () => void;
  onMove: () => void;
  onRotate: () => void;
  onMaintain: () => void;
  onRailOps: () => void;
  onUndo: () => void;
  onOpenDetails: () => void;
}) {
  const { name: periodName } = usePeriodNames();
  const ringRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const activeKey = pendingConfirm
    ? `confirm:${pendingConfirm.key}`
    : bulkActive && bulkCount > 0
      ? `bulk:${bulkCount}`
      : bulkCount > 1
        ? `multi:${bulkCount}`
        : deletedName
          ? `del:${deletedName}`
          : el?.id ?? "";

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
      host.style.setProperty("--ring-r", `${proj.radiusPx}px`);
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
  }, [onSubscribeProjection, activeKey]);

  // 1. Floating Checkmark confirmation for 2+ road/bridge stretches (tap anywhere else to cancel)
  if (pendingConfirm) {
    return (
      <div
        ref={ringRef}
        className="ui-ring is-confirm"
        data-ready="false"
        data-pending-confirm="true"
        role="toolbar"
        aria-label={pendingConfirm.label}
      >
        <span className={"ui-ring-confirm-halo" + (pendingConfirm.valid ? "" : " is-bad")} aria-hidden="true" />
        <button
          type="button"
          className={"ui-ring-btn ui-ring-btn-center is-confirm" + (pendingConfirm.valid ? "" : " is-danger")}
          aria-label={pendingConfirm.label}
          title={pendingConfirm.label}
          disabled={!pendingConfirm.valid}
          onClick={(e) => {
            e.stopPropagation();
            pendingConfirm.onConfirm();
          }}
        >
          <Check size={22} strokeWidth={2.75} aria-hidden="true" />
        </button>
        {pendingConfirm.sublabel && (
          <span className={"ui-ring-badge" + (pendingConfirm.valid ? "" : " is-bad")}>
            {pendingConfirm.sublabel}
          </span>
        )}
      </div>
    );
  }

  // 2. Floating Bulk Delete button hovering over multi-selected roads/buildings
  if ((bulkActive && bulkCount >= 1) || bulkCount > 1) {
    return (
      <div
        ref={ringRef}
        className="ui-ring is-bulk"
        data-ready="false"
        role="toolbar"
        aria-label={`Delete ${bulkCount} selected items`}
      >
        <span className="ui-ring-bulk-halo" aria-hidden="true" />
        <button
          type="button"
          className="ui-ring-btn ui-ring-btn-center is-danger"
          aria-label={`Delete ${bulkCount} selected ${bulkCount === 1 ? "item" : "items"}`}
          title={`Delete ${bulkCount} selected ${bulkCount === 1 ? "item" : "items"}`}
          onClick={(e) => {
            e.stopPropagation();
            onBulkDemolish?.();
          }}
        >
          <Trash2 size={20} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <span className="ui-ring-badge is-bad">
          Delete {bulkCount}
        </span>
      </div>
    );
  }

  // 3. Floating Undo button hovering over recently deleted item(s)
  if (deletedName && (!el || !def)) {
    return (
      <div
        ref={ringRef}
        className="ui-ring is-deleted"
        data-ready="false"
        role="toolbar"
        aria-label={`Removed ${deletedName}. Undo available`}
      >
        <span className="ui-ring-deleted-halo" aria-hidden="true" />
        <button
          type="button"
          className="ui-ring-btn ui-ring-btn-center is-undo"
          aria-label={`Undo demolish ${deletedName}`}
          title={`Undo demolish ${deletedName}`}
          onClick={onUndo}
        >
          <Undo2 size={19} strokeWidth={2.35} aria-hidden="true" />
        </button>
        <span className="ui-ring-badge">Undo {deletedName}</span>
      </div>
    );
  }

  if (!el || !def) return null;

  const god = state.mode === "god";
  const isIdle = state.mode === "idle";
  const isManager = state.mode === "manager";
  const max = getMaxElementLevel(el.defId);
  const atMax = el.level >= max;
  const charges = buildingCharges(state);
  const cost = atMax ? 0 : placedUpgradeCost(state, el);
  const ready = upgradeReadiness(state, el);
  const short = charges && !atMax && state.money < cost;
  const blocked = !atMax && (short || !ready.ready);
  const needsRepair = state.mode === "survival" && def.needsMaintenance && el.disrepair && !el.onFire;
  const isRail = RAIL_SITES.includes(def.id);

  const actions: RingAction[] = [];

  if (isIdle) {
    actions.push({
      id: "more",
      label: `Inspect ${periodName(def.id)} stats`,
      icon: <MoreHorizontal size={19} strokeWidth={2.4} aria-hidden="true" />,
      tone: "primary",
      onClick: onOpenDetails,
    });
  } else if (isManager) {
    actions.push({
      id: "variant",
      label: "Swap visual variant",
      icon: <Shuffle size={18} strokeWidth={2.25} aria-hidden="true" />,
      tone: "primary",
      onClick: onVariant,
    });
    actions.push({
      id: "more",
      label: `${periodName(def.id)} details & stats`,
      icon: <MoreHorizontal size={19} strokeWidth={2.4} aria-hidden="true" />,
      onClick: onOpenDetails,
    });
  } else {
    if (el.onFire) {
      actions.push({
        id: "fire",
        label: "Send fire crew",
        icon: <Flame size={19} strokeWidth={2.3} aria-hidden="true" />,
        tone: "danger",
        onClick: onMaintain,
      });
    } else {
      const upgradeLabel = atMax
        ? "Max level reached"
        : god || !charges
          ? `Upgrade to Lv ${el.level + 1}`
          : `Upgrade to Lv ${el.level + 1} ($${cost.toLocaleString()})`;
      actions.push({
        id: "upgrade",
        label: upgradeLabel,
        icon: <ArrowUp size={19} strokeWidth={2.4} aria-hidden="true" />,
        tone: "primary",
        disabled: atMax || (blocked && !god),
        onClick: onUpgrade,
      });
    }

    actions.push({
      id: "delete",
      label: `Delete ${periodName(def.id)}`,
      icon: <Trash2 size={18} strokeWidth={2.25} aria-hidden="true" />,
      tone: "danger",
      onClick: onDemolish,
    });

    if (onStartBulkSelect) {
      actions.push({
        id: "bulk",
        label: "Select multiple for bulk actions",
        icon: <ListChecks size={18} strokeWidth={2.25} aria-hidden="true" />,
        onClick: onStartBulkSelect,
      });
    }

    actions.push({
      id: "variant",
      label: "Swap visual variant",
      icon: <Shuffle size={18} strokeWidth={2.25} aria-hidden="true" />,
      onClick: onVariant,
    });

    actions.push({
      id: "move",
      label: `Move ${periodName(def.id)}`,
      icon: <Move size={18} strokeWidth={2.25} aria-hidden="true" />,
      onClick: onMove,
    });

    if (!def.isNetwork) {
      actions.push({
        id: "rotate",
        label: "Rotate 90°",
        icon: <RotateCw size={18} strokeWidth={2.25} aria-hidden="true" />,
        onClick: onRotate,
      });
    }

    if (needsRepair) {
      actions.push({
        id: "repair",
        label: "Repair building",
        icon: <Wrench size={18} strokeWidth={2.25} aria-hidden="true" />,
        onClick: onMaintain,
      });
    }

    if (isRail) {
      actions.push({
        id: "rail",
        label: "Rail Operations",
        icon: <TrainFront size={18} strokeWidth={2.25} aria-hidden="true" />,
        onClick: onRailOps,
      });
    }

    actions.push({
      id: "undo",
      label: canUndo ? "Undo last edit" : "Nothing to undo on this selection yet",
      icon: <Undo2 size={18} strokeWidth={2.3} aria-hidden="true" />,
      tone: "undo",
      disabled: !canUndo,
      onClick: onUndo,
    });

    actions.push({
      id: "more",
      label: `${periodName(def.id)} details & actions`,
      icon: <MoreHorizontal size={19} strokeWidth={2.4} aria-hidden="true" />,
      onClick: onOpenDetails,
    });
  }

  if (onChristmas) actions.push({ id: "christmas", label: christmasActionLabel(el), icon: <TreePine size={18} aria-hidden="true" />, onClick: onChristmas });

  const orderedActions = isIdle || isManager ? actions : resolveQuickEditActions(actions, quickEditPrefs);
  const count = orderedActions.length;

  return (
    <div
      ref={ringRef}
      className="ui-ring"
      data-ready="false"
      role="toolbar"
      aria-label={`Quick Edit ${periodName(def.id)}`}
    >
      <div key={el.id} className="ui-ring-cluster">
        {orderedActions.map((action, idx) => {
          const angDeg = Number((-90 + (idx / count) * 360).toFixed(2));
          return (
            <span
              key={action.id}
              className="ui-ring-spoke"
              style={{
                "--ang": `${angDeg}deg`,
                "--idx": idx,
              } as React.CSSProperties}
            >
              <span className="ui-ring-arm">
                <span className="ui-ring-counter">
                  <button
                    type="button"
                    className={
                      "ui-ring-btn" +
                      (action.tone ? ` is-${action.tone}` : "")
                    }
                    aria-label={action.label}
                    title={action.label}
                    disabled={action.disabled}
                    onClick={() => {
                      onTrackQuickEditAction?.(action.id);
                      action.onClick();
                    }}
                  >
                    {action.icon}
                  </button>
                </span>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
