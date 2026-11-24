import React from "react";
import { ArrowUpRight, TrainFront } from "lucide-react";
import { ELEMENT_BY_ID } from "../game/catalog";
import { lineKey } from "../game/mobility";
import type { GameState, PlacedElement } from "../game/simulation";
import { RAIL_SITES } from "./InspectorSheet";
import { MobilityPanel } from "./MobilityPanel";
import { BottomSheet, ListRow, type SheetHeight } from "./ui";

export interface TransitContentProps {
  state: GameState;
  mutate: (fn: (s: GameState) => void) => void;
  selected?: PlacedElement;
  onFocus: (id: string) => void;
  onPickDestination: (id: string) => void;
  onFollow: (id?: string) => void;
  following?: string;
  focusLine?: string;
  onGrid: (x: number, z: number, line: string) => void;
  onRailOps: (id: string) => void;
}

/**
 * Transit view rendered inside City → Transit (single sheet, single scroll owner).
 * Leads with active services, transit share/congestion health, Rail Ops yards, and MobilityPanel.
 */
export function TransitContent({
  state,
  mutate,
  selected,
  onFocus,
  onPickDestination,
  onFollow,
  following,
  focusLine,
  onGrid,
  onRailOps,
}: TransitContentProps) {
  const yards = state.elements.filter((e) => RAIL_SITES.includes(e.defId) && e.defId !== "train_stops");
  const lines = state.mobility?.lines ?? [];
  const enabled = lines.filter(line => line.enabled);
  const lineCount = new Set(enabled.map(lineKey)).size;
  const share = Math.round(state.metrics.transitShare ?? 0);
  const congestion = Math.round(state.metrics.congestion ?? 0);
  const obstructed = new Set(enabled.filter(line => line.blocked).map(lineKey)).size;

  return (
    <div className="ui-city-section">
      <div className="ui-kpi-strip" role="group" aria-label="Transit summary">
        <div className="ui-kpi-card">
          <span className="ui-kpi-label">Active lines</span>
          <strong className="ui-kpi-val">{lineCount}</strong>
          <small className={"ui-kpi-sub" + (obstructed > 0 ? " is-bad" : "")}>
            {obstructed ? `${obstructed} ${obstructed === 1 ? "line needs" : "lines need"} attention` : lineCount ? "No lines blocked" : "No lines running"}
          </small>
        </div>
        <div className="ui-kpi-card">
          <span className="ui-kpi-label">Transit share</span>
          <strong className="ui-kpi-val">{share}%</strong>
          <small className="ui-kpi-sub">of commutes</small>
        </div>
        <div className="ui-kpi-card">
          <span className="ui-kpi-label">Road load</span>
          <strong className={"ui-kpi-val" + (congestion > 100 ? " is-bad" : congestion > 75 ? " is-warn" : "")}>
            {congestion}%
          </strong>
          <small className="ui-kpi-sub">{congestion > 100 ? "Congested" : "Flowing"}</small>
        </div>
      </div>

      {yards.length > 0 && (
        <div className="ui-list" style={{ marginBottom: 6 }}>
          {yards.slice(0, 3).map((y) => (
            <ListRow
              key={y.id}
              icon={<TrainFront size={16} />}
              title={"Rail Ops · " + ELEMENT_BY_ID[y.defId].name}
              subtitle={"At " + y.gx + ", " + y.gz}
              trailing={<ArrowUpRight size={15} />}
              onClick={() => onRailOps(y.id)}
            />
          ))}
        </div>
      )}

      <MobilityPanel
        state={state}
        mutate={mutate}
        selected={selected}
        onFocus={onFocus}
        onPickDestination={onPickDestination}
        onFollow={onFollow}
        following={following}
        focusLine={focusLine}
        onGrid={onGrid}
        onRailOps={onRailOps}
      />
    </div>
  );
}

/** Backwards-compatible standalone wrapper if needed. */
export function TransitSheet({
  height,
  onHeight,
  onClose,
  ...props
}: TransitContentProps & {
  height: SheetHeight;
  onHeight: (h: SheetHeight) => void;
  onClose: () => void;
}) {
  const count = new Set(props.state.mobility?.lines.map(lineKey)).size;
  return (
    <BottomSheet
      id="sheet-transit"
      title="Transit"
      subtitle={count + (count === 1 ? " line · " : " lines · ") + (props.state.metrics.transitShare ?? 0) + "% transit"}
      height={height}
      onHeightChange={onHeight}
      onClose={onClose}
      closeLabel="Close Transit"
    >
      <TransitContent {...props} />
    </BottomSheet>
  );
}
