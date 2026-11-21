import React from "react";
import { TrainFront } from "lucide-react";
import { ELEMENT_BY_ID } from "../game/catalog";
import type { GameState, PlacedElement } from "../game/simulation";
import { RAIL_SITES } from "./InspectorSheet";
import { MobilityPanel } from "./MobilityPanel";
import { BottomSheet, ListRow, type SheetHeight } from "./ui";

/** Lines, vehicles, harbor and rail yards. Rail Operations opens from here (or from a depot's inspector). */
export function TransitSheet({state, mutate, selected, onFocus, onPickDestination, onFollow, following, focusLine, onGrid, onRailOps, height, onHeight, onClose}: {
  state: GameState; mutate: (fn: (s: GameState) => void) => void; selected?: PlacedElement;
  onFocus: (id: string) => void; onPickDestination: (id: string) => void; onFollow: (id?: string) => void; following?: string;
  focusLine?: string; onGrid: (x: number, z: number, line: string) => void; onRailOps: (id: string) => void;
  height: SheetHeight; onHeight: (h: SheetHeight) => void; onClose: () => void;
}) {
  const yards = state.elements.filter(e => RAIL_SITES.includes(e.defId) && e.defId !== "train_stops");
  return <BottomSheet id="sheet-transit" title="Transit" subtitle={(state.mobility?.lines.length ?? 0) + " lines · " + (state.metrics.transitShare ?? 0) + "% of trips by transit"}
    height={height} onHeightChange={onHeight} onClose={onClose} closeLabel="Close Transit">
    {yards.length > 0 && <div className="ui-list" style={{marginBottom: 10}}>
      {yards.slice(0, 3).map(y => <ListRow key={y.id} icon={<TrainFront size={18}/>} title={"Rail Operations · " + ELEMENT_BY_ID[y.defId].name}
        subtitle={"Lines, trains and cars · at " + y.gx + ", " + y.gz} trailing="Open →" onClick={() => onRailOps(y.id)}/>)}
    </div>}
    <MobilityPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} onPickDestination={onPickDestination}
      onFollow={onFollow} following={following} focusLine={focusLine} onGrid={onGrid}/>
  </BottomSheet>;
}
