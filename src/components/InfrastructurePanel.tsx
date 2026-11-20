import React, { useEffect, useState } from "react";
import { effective } from "../game/cityEconomy";
import type { GameState, PlacedElement } from "../game/simulation";
import {
  buildWaterNavigation,
  setFacilityControl,
  registerRoadDemand,
  getTerrainCell,
  hydraulics,
  requiredToolStage,
  tileKey,
  undoInfrastructure,
  type GridPoint,
  type InfrastructureTool,
} from "../game/terrain";

type Props = {
  state: GameState;
  mutate: (fn: (draft: GameState) => void) => void;
  tool: InfrastructureTool | null;
  onToolChange: (t: InfrastructureTool | null) => void;
  onPreview: (tool: InfrastructureTool, points: GridPoint[]) => void;
  onClose: () => void;
  selected?: PlacedElement;
  inspectPoint?: GridPoint;
};
const tools: [InfrastructureTool["kind"], string][] = [
  ["canal", "Draw canal"],
  ["river", "Draw river"],
  ["pond", "Dig pond"],
  ["bay", "Open bay"],
  ["peninsula", "Reclaim land"],
  ["paint", "Paint ground"],
  ["raise", "Raise land"],
  ["lower", "Lower land"],
  ["smooth", "Smooth grade"],
  ["mountain", "Raise mountain"],
  ["canyon", "Cut canyon"],
  ["spring", "Tap spring"],
  ["lock", "Canal lock"],
  ["dam", "Dam gate"],
  ["aqueduct", "Lay aqueduct"],
  ["bridge", "Span crossing"],
  ["street", "Edit road"],
  ["interchange", "Build interchange"],
  ["erase", "Remove works"],
];
const preset: InfrastructureTool = {
  kind: "canal",
  radius: 0,
  depth: 1,
  height: 2,
  material: "sand",
  shape: "arch",
  mode: "foot",
  signal: "yield",
  period: 12,
  lanes: 2,
  layout: "diamond",
  outlet: "auto",
  lift: "auto",
  style: 0,
};
const field = "block w-full rounded border border-stone-300 bg-white p-1.5 text-sm text-stone-900";
const btn =
  "rounded border border-stone-300 bg-white px-2 py-1.5 text-sm font-semibold text-stone-800 hover:bg-amber-50 disabled:opacity-45";
const groups: <K extends string>(a: readonly K[]) => [K, string][] = (a) =>
  a.map((k) => [k, k.charAt(0).toUpperCase() + k.slice(1)]);
export function InfrastructurePanel({
  state,
  mutate,
  tool,
  onToolChange,
  onClose,
  onPreview,
  selected,
  inspectPoint,
}: Props) {
  const [coords, setCoords] = useState<GridPoint>({ gx: selected?.gx ?? 0, gz: selected?.gz ?? 0 });
  const [end, setEnd] = useState<GridPoint>({ gx: (selected?.gx ?? 0) + 3, gz: selected?.gz ?? 0 });
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    const p = inspectPoint ?? selected;
    if (!p) return;
    setCoords({ gx: p.gx, gz: p.gz });
    const i = state.infrastructure,
      k = tileKey(p.gx, p.gz),
      span = i?.spans[k],
      duct = i?.conduits[k],
      road = i?.streets[k],
      ground = getTerrainCell(state, p.gx, p.gz);
    if (span) {
      const tiles = Object.entries(i!.spans).filter(([, s]) => s.run === span.run);
      const bank = Math.min(
        ...tiles.filter(([, s]) => s.ramp).map(([, s]) => Math.min(s.startHeight, s.endHeight)),
        span.deck,
      );
      onToolChange({
        ...preset,
        kind: "bridge",
        mode: span.mode,
        shape: span.shape,
        height: Math.max(0.5, span.deck - bank),
        lift: span.lift,
      });
    } else if (duct)
      onToolChange({
        ...preset,
        kind: "aqueduct",
        style: duct.style,
        height: duct.height - Math.max(0, ground.depth ? ground.waterLevel : ground.elevation),
        outlet: duct.outlet,
      });
    else if (road)
      onToolChange({ ...preset, kind: "street", lanes: road.lanes, signal: road.signal, period: road.period });
  }, [inspectPoint?.gx, inspectPoint?.gz, selected?.id]);
  const current = tool ?? preset,
    kind = current.kind,
    infra = state.infrastructure,
    point = inspectPoint ?? (selected ? { gx: selected.gx, gz: selected.gz } : coords);
  const waterSystem = hydraulics(state);
  const key = tileKey(point.gx, point.gz),
    span = infra?.spans[key],
    flow = waterSystem.runs.get(key),
    ground = getTerrainCell(state, point.gx, point.gz);
  const set = (patch: Partial<InfrastructureTool>) => {
    onToolChange({ ...current, ...patch });
    setFeedback("");
  };
  const choice = <K extends keyof InfrastructureTool>(key: K, title: string, values: [string, string][]) => (
    <label key={key}>
      {title}
      <select
        className={field}
        value={String(current[key] ?? preset[key] ?? "")}
        onChange={(e) => set({ [key]: e.target.value })}
      >
        {values.map(([v, name]) => (
          <option key={v} value={v}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  const num = (key: keyof InfrastructureTool, title: string, min: number, max: number, step = 1) => (
    <label key={key}>
      {title}
      <input
        className={field}
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(current[key] ?? preset[key] ?? min)}
        onChange={(e) => set({ [key]: Math.min(max, Math.max(min, Number(e.target.value))) })}
      />
    </label>
  );
  const cellInput = (label: string, pt: GridPoint, change: (v: GridPoint) => void) => (
    <fieldset className="flex gap-1">
      <legend>{label}</legend>
      {(["gx", "gz"] as const).map((axis) => (
        <label key={axis} className="flex-1">
          {axis === "gx" ? "X" : "Z"}
          <input
            className={field}
            type="number"
            min="-32"
            max="31"
            value={pt[axis]}
            onChange={(e) => change({ ...pt, [axis]: Math.max(-32, Math.min(31, Number(e.target.value))) })}
          />
        </label>
      ))}
    </fieldset>
  );
  const commit = (points: GridPoint[]) => onPreview(current, points);
  const nav = buildWaterNavigation(state).cell(point.gx, point.gz);
  const art = [
    ["0", "Travertine arcade"],
    ["1", "Granite piers"],
    ["2", "Striped stone"],
    ["3", "Mossy ruins"],
  ];
  return (
    <section
      aria-label="Land and public works"
      className="pointer-events-auto fixed z-40 left-2 top-16 bottom-24 w-80 max-w-[calc(100vw-1rem)] max-h-[72dvh] overflow-auto rounded-xl border border-stone-400 bg-[#faf8ef] p-3 text-xs text-stone-800 shadow-xl"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Land & public works</h2>
        <button className={btn} aria-label="Close public works" onClick={onClose}>
          Close
        </button>
      </header>
      <label className="mt-2 block">
        Construction tool
        <select
          className={field}
          value={kind}
          onChange={(e) => set({ kind: e.target.value as InfrastructureTool["kind"] })}
        >
          {tools.map(([type, label]) => {
            const stage = requiredToolStage({ kind: type });
            return (
              <option key={type} value={type}>
                {label}
                {(state.mode !== "god" || effective(state, "stageRules", 0) > 0) && state.highestStageReached < stage
                  ? " · stage " + stage
                  : ""}
              </option>
            );
          })}
        </select>
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {!["bridge", "aqueduct", "street", "interchange", "erase"].includes(kind) &&
          num("radius", "Brush radius", 0, 3)}
        {["canal", "pond", "bay", "river", "spring"].includes(kind) && num("depth", "Depth (m)", 0.25, 8, 0.25)}
        {["raise", "lower", "mountain", "canyon", "peninsula", "bridge", "aqueduct"].includes(kind) &&
          num(
            "height",
            kind === "bridge" ? "Deck rise (m)" : kind === "aqueduct" ? "Support height (m)" : "Height change (m)",
            0.5,
            9,
            0.5,
          )}
        {["paint", "peninsula"].includes(kind) &&
          choice("material", "Ground", groups(["grass", "sand", "clay", "rock", "wetland", "snow"] as const))}
        {kind === "bridge" && (
          <>
            {choice("shape", "Span", groups(["arch", "truss", "suspension", "lift"]))}
            {choice("mode", "Deck use", groups(["foot", "road", "rail", "highway", "freeway"]))}
            {current.shape === "lift" && choice("lift", "Lift gate", groups(["auto", "open", "closed"]))}
          </>
        )}
        {kind === "erase" && choice("eraseLayer", "Remove layer", groups(["terrain", "aqueduct", "deck", "street"]))}
        {["dam", "lock"].includes(kind) && choice("gate", "Gate", groups(["open", "closed"]))}
        {kind === "dam" && num("height", "Retained head (m)", 0.5, 5, 0.5)}
        {kind === "aqueduct" && (
          <>
            <label>
              Masonry
              <select
                className={field}
                value={current.style ?? 0}
                onChange={(e) => set({ style: Number(e.target.value) })}
              >
                {art.map(([v, name]) => (
                  <option key={v} value={v}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {choice("outlet", "Side spout", groups(["auto", "north", "east", "south", "west", "cap"]))}
          </>
        )}
        {["street", "interchange"].includes(kind) && (
          <>
            {num("lanes", "Total lanes", 2, 8, 2)}
            {choice("signal", "Signal phase", [
              ["yield", "Yield"],
              ["auto", "Timed cycle"],
              ["north", "Hold N–S green"],
              ["east", "Hold E–W green"],
            ])}
            {num("period", "Cycle (seconds)", 4, 60)}
          </>
        )}
        {kind === "interchange" && (
          <>
            {choice("layout", "Junction", groups(["diamond", "trumpet", "directional"]))}
            {num("orientation", "Quarter turns", 0, 3)}
          </>
        )}
        {state.mode === "god" && ["spring", "river"].includes(kind) && num("flow", "Source flow", 0, 100)}
        {state.mode === "god" && ["pond", "canal", "river"].includes(kind) && (
          <label>
            Water level (m)
            <input
              className={field}
              type="number"
              step=".25"
              placeholder="Local"
              value={current.waterLevel ?? ""}
              onChange={(e) => set({ waterLevel: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </label>
        )}
      </div>
      <p className="my-2">
        {kind === "bridge"
          ? "Drag bank to bank, or tap the first bank and then the opposite bank."
          : kind === "interchange"
            ? "Tap the center of the junction to place it."
            : "Drag to trace a run or tap one tile."}
      </p>
      <div className="flex flex-wrap gap-1">
        <button className={btn} onClick={() => onToolChange(tool ? null : current)}>
          {tool ? "Put tool away" : "Use on map"}
        </button>
        <button
          className={btn}
          disabled={!infra?.undo.length}
          onClick={() =>
            mutate((d) =>
              setFeedback(undoInfrastructure(d) ? "Last works undone." : "A later building occupies this edit."),
            )
          }
        >
          Undo last works
        </button>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer font-bold">Coordinates & inspection</summary>
        {cellInput("Start tile", coords, setCoords)}
        {cellInput("End tile", end, setEnd)}
        <div className="mt-1 flex gap-1">
          <button className={btn} onClick={() => commit([coords])}>
            Preview tile
          </button>
          <button className={btn} onClick={() => commit([coords, end])}>
            Preview run
          </button>
        </div>
        {selected && (
          <button className={btn} onClick={() => commit([point])}>
            Preview selected place
          </button>
        )}
        <p className="mt-2">
          Tile {point.gx}, {point.gz} · {ground.material} at {ground.elevation.toFixed(1)} m.{" "}
          {nav.depth > 0 ? nav.depth.toFixed(1) + " m deep, " + nav.width.toFixed(1) + " m wide." : "Dry ground."}
        </p>
        {span && (
          <p>
            {span.shape} {span.mode} deck at {span.deck.toFixed(1)} m.{" "}
            {Number.isFinite(nav.clearance)
              ? "Boat headroom " + nav.clearance.toFixed(1) + " m."
              : "Opening available."}
          </p>
        )}
        {ground.depth > 0 && ground.water === "fresh" && (
          <p>
            {waterSystem.channels.get(key)
              ? waterSystem.channels.get(key)!.toFixed(1) + " freshwater flow · irrigates adjoining farms"
              : "Still freshwater"}
          </p>
        )}
        {flow && (
          <p>
            {flow.flow ? flow.flow.toFixed(1) + " flow" : "Dry trough"} ·{" "}
            {flow.target ? "Connected outlet" : flow.spill ? "Spilling at outlet" : "Capped or through run"}
          </p>
        )}
        {state.mode === "god" &&
          selected &&
          ["water_pumping_station", "desalination_plant", "wells"].includes(selected.defId) && (
            <label>
              Source pressure head (m)
              <input
                className={field}
                type="number"
                min="0"
                max="40"
                step=".5"
                value={infra?.facilities?.[selected.id]?.pressure ?? (selected.defId === "wells" ? 5 : 20)}
                onChange={(ev) => {
                  const n = Number(ev.target.value);
                  mutate((d) => setFacilityControl(d, selected.id, "pressure", n));
                }}
              />
            </label>
          )}
        {state.mode === "god" && selected && ["municipal_reservoir", "water_towers"].includes(selected.defId) && (
          <label>
            Stored water
            <input
              className={field}
              type="number"
              min="0"
              max={100 * selected.level}
              value={Math.round(infra?.storage[selected.id] ?? 0)}
              onChange={(ev) => {
                const n = Number(ev.target.value);
                mutate((d) => setFacilityControl(d, selected.id, "fill", n));
              }}
            />
          </label>
        )}
        {state.mode === "god" && selected && ["municipal_reservoir", "water_towers"].includes(selected.defId) && (
          <button
            className={btn}
            onClick={() =>
              mutate((d) =>
                setFacilityControl(
                  d,
                  selected.id,
                  "heldStorage",
                  infra?.facilities?.[selected.id]?.heldStorage === undefined
                    ? (infra?.storage[selected.id] ?? 0)
                    : undefined,
                ),
              )
            }
          >
            {infra?.facilities?.[selected.id]?.heldStorage === undefined ? "Hold current fill" : "Release held fill"}
          </button>
        )}
      </details>
      {state.mode === "god" && infra?.streets[key]?.signal === "auto" && (
        <div className="flex gap-1">
          <button className={btn} onClick={() => mutate((d) => registerRoadDemand(d, point.gx, point.gz, 0, 1, 12))}>
            Queue N–S traffic
          </button>
          <button className={btn} onClick={() => mutate((d) => registerRoadDemand(d, point.gx, point.gz, 1, 0, 12))}>
            Queue E–W traffic
          </button>
        </div>
      )}
      <p role="status" className="mt-1 font-semibold">
        {feedback}
      </p>
    </section>
  );
}
