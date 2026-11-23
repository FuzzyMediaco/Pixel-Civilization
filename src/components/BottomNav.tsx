import React from "react";
import { Building2, Hammer, Layers, MoreHorizontal, Mountain } from "lucide-react";

export type NavSheet = "build" | "layers" | "city" | "sculpt" | "more";

const ITEMS: { id: NavSheet; label: string; Icon: typeof Hammer; key: string; compact?: boolean }[] = [
  { id: "build", label: "Build", Icon: Hammer, key: "B" },
  { id: "layers", label: "Layers", Icon: Layers, key: "L" },
  { id: "city", label: "City", Icon: Building2, key: "C" },
  { id: "sculpt", label: "Sculpt", Icon: Mountain, key: "S" },
  { id: "more", label: "More", Icon: MoreHorizontal, key: "M", compact: true },
];

export function BottomNav({
  active,
  onToggle,
  badges,
  visibleIds,
  highlightId,
  hiddenForRing,
}: {
  active: NavSheet | null;
  onToggle: (id: NavSheet) => void;
  badges?: Partial<Record<NavSheet, number>>;
  /** When set (e.g. during an interactive tutorial or Idle/Manager mode), only these buttons are shown. */
  visibleIds?: NavSheet[];
  /** Optional button to softly pulse as the next interactive tutorial step. */
  highlightId?: NavSheet;
  /** Coordinated hide during Quick Menu spiral choreography. */
  hiddenForRing?: boolean;
}) {
  const shown = visibleIds ? ITEMS.filter((item) => visibleIds.includes(item.id)) : ITEMS;
  return (
    <nav
      className={
        "ui-nav" +
        (visibleIds && shown.length < ITEMS.length ? " is-tutorial" : "") +
        (hiddenForRing ? " is-chrome-hidden" : "")
      }
      aria-label="Main navigation"
      aria-hidden={hiddenForRing || undefined}
      inert={hiddenForRing}
    >
      {shown.map(({ id, label, Icon, key, compact }) => {
        const badge = badges?.[id] ?? 0;
        const on = active === id;
        const hi = highlightId === id && !on;
        return (
          <button
            key={id}
            type="button"
            data-panel-toggle={id}
            className={(compact ? "ui-nav-more" : "") + (hi ? " is-tut-spotlight" : "")}
            aria-pressed={on}
            aria-label={label + (badge ? ", " + badge + " alerts" : "") + " (" + key + ")"}
            title={label + " (" + key + ")"}
            onClick={() => onToggle(id)}
          >
            <Icon size={compact ? 19 : 18} aria-hidden="true" />
            {!compact && <span>{label}</span>}
            {badge > 0 && (
              <span className="ui-nav-badge" aria-hidden="true">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
