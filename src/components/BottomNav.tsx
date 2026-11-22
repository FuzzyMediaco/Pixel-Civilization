import React from "react";
import { Hammer, Landmark, Layers, MoreHorizontal, TrainFront } from "lucide-react";

export type NavSheet = "build" | "layers" | "city" | "transit" | "more";
export const NAV_ITEMS: {id: NavSheet; label: string; key: string; Icon: typeof Hammer}[] = [
  {id: "build", label: "Build", key: "B", Icon: Hammer},
  {id: "layers", label: "Layers", key: "L", Icon: Layers},
  {id: "city", label: "City", key: "C", Icon: Landmark},
  {id: "transit", label: "Transit", key: "T", Icon: TrainFront},
  {id: "more", label: "More", key: "M", Icon: MoreHorizontal},
];

/** The five homes. Every feature lives in exactly one of them. */
export function BottomNav({
  active,
  onToggle,
  badges,
  visibleIds,
  highlightId,
}: {
  active: NavSheet | null;
  onToggle: (id: NavSheet) => void;
  badges?: Partial<Record<NavSheet, number>>;
  /** Optional progressive reveal filter during interactive tutorials. */
  visibleIds?: NavSheet[];
  /** Optional spotlighted menu tab during interactive tutorials. */
  highlightId?: NavSheet;
}) {
  const items = visibleIds
    ? NAV_ITEMS.filter((item) => visibleIds.includes(item.id))
    : NAV_ITEMS;

  return <nav className={"ui-nav" + (visibleIds ? " is-tutorial" : "")} aria-label="Main">
    {items.map(({id, label, key, Icon}) => <button key={id} type="button" data-panel-toggle={id} aria-pressed={active === id}
      className={highlightId === id ? "is-tut-spotlight" : undefined}
      aria-controls={"sheet-" + id} aria-keyshortcuts={key} title={label + " (" + key + ")"} onClick={() => onToggle(id)}>
      <Icon size={18} aria-hidden="true"/><span>{label}</span>
      {badges?.[id] ? <span className="ui-nav-badge" aria-label={badges[id] + " issues"}>{badges[id]}</span> : null}
    </button>)}
  </nav>;
}
