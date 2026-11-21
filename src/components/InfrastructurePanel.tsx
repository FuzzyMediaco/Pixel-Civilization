import React, { useEffect, useState } from "react";
import {RAIL_BRIDGES,railClearHeight,railShape,bridgeLandmark,bridgeTier,crossingPieces} from "../game/bridgeWorks";
import {placedUpgradeCost,upgradeElementDirect} from "../game/simulation";
import {buildingCharges} from "../game/cityEconomy";
import { effective } from "../game/cityEconomy";
import { GRID_MIN, GRID_MAX } from "../game/mapBounds";
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
  onUseMap: (tool: InfrastructureTool) => void;
  selected?: PlacedElement;
  inspectPoint?: GridPoint;
};
type Kind=InfrastructureTool["kind"];
const tools: {group:string; entries:[Kind,string,string][]}[]=[
  {group:"Shape land",entries:[
    ["paint","Paint ground","Change the surface material. The ground stays at its existing height."],
    ["raise","Raise land","Lift a patch of ground. Repeated passes add elevation."],
    ["lower","Lower land","Lower the ground. At the coast, excavating below sea level lets the sea in."],
    ["smooth","Smooth grade","Blend the selected ground with the heights of neighboring tiles."],
    ["mountain","Raise mountain","Build steep rock slopes. Tall peaks gain snow."],
    ["canyon","Cut canyon","Excavate a dry, rocky channel."],
    ["peninsula","Reclaim land","Raise dry, buildable ground from the shore and choose its surface."]]},
  {group:"Shape water",entries:[
    ["canal","Draw canal","Cut a freshwater channel and connect a river or spring to supply it."],
    ["river","Draw river","Trace the river from its source toward its outlet."],
    ["pond","Dig pond","Dig a basin. Connect a replenished source if the pond needs a steady water supply."],
    ["bay","Open bay","Excavate a saltwater inlet at sea level."],
    ["spring","Tap spring","Create a freshwater source to feed nearby channels."],
    ["lock","Canal lock","Set a gate in a channel to control passage."],
    ["dam","Dam gate","Retain freshwater upstream. Gate position controls the release."]]},
  {group:"Crossings & utilities",entries:[
    ["bridge","Span crossing","Drag from bank to bank, or tap one bank and then the opposite bank. Leave room for both approaches."],
    ["aqueduct","Lay aqueduct","Trace a raised supply line from a water source toward a consumer or an outlet."]]},
  {group:"Streets",entries:[
    ["street","Edit road","Trace existing road tiles to change the number of lanes or operate a junction signal."],
    ["interchange","Build interchange","Tap once to mark the center of the junction. Check the layout and affected sites in the preview."]]},
  {group:"Maintenance",entries:[["erase","Remove works","Remove the selected construction layer from the marked tiles."]]},
];
/** Plain name for a land & water tool (placement bar). */
export const worksToolLabel=(kind:Kind)=>tools.flatMap(g=>g.entries).find(e=>e[0]===kind)?.[1]??kind;
const brushKinds:Kind[]=["paint","raise","lower","smooth","mountain","canyon","peninsula","canal","river","pond","bay","spring"];
function defaultTool(kind:Kind): InfrastructureTool {
  switch(kind) {
    case "bridge": return {kind,mode:"foot",shape:"arch",height:2,lift:"auto"};
    case "aqueduct": return {kind,height:3,style:0,outlet:"auto"};
    case "interchange": return {kind,layout:"diamond",orientation:0,lanes:2,signal:"auto",period:12};
    case "street": return {kind,lanes:2,signal:"yield",period:12};
    case "lock": return {kind,gate:"open"};
    case "dam": return {kind,gate:"open",height:1};
    case "erase": return {kind,eraseLayer:"terrain"};
    case "spring": case "river": return {kind,radius:0,depth:1,flow:kind==="spring" ? 12 : 4};
    case "pond": case "canal": case "bay": return {kind,radius:0,depth:1};
    case "paint": return {kind,radius:0,material:"sand"};
    case "peninsula": return {kind,radius:0,material:"sand",height:1};
    case "smooth": return {kind,radius:0};
    default: return {kind,radius:0,height:1};
  }
}
const preset=defaultTool("canal");
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
  onUseMap,
  selected,
  inspectPoint,
}: Props) {
  const [draft,setDraft]=useState<InfrastructureTool>(tool??preset);
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
    if (span && !span.run.startsWith("junction-")) {
      const tiles = Object.entries(i!.spans).filter(([, s]) => s.run === span.run);
      const bank = Math.min(
        ...tiles.filter(([, s]) => s.ramp).map(([, s]) => Math.min(s.startHeight, s.endHeight)),
        span.deck,
      );
      setDraft({
        ...preset,
        kind: "bridge",
        mode: span.mode,
        shape: span.shape,
        railType:span.railType,
        height: Math.max(0.5, span.deck - bank),
        lift: span.lift,
      });
    } else if (duct)
      setDraft({
        ...preset,
        kind: "aqueduct",
        style: duct.style,
        height: duct.height - Math.max(0, ground.depth ? ground.waterLevel : ground.elevation),
        outlet: duct.outlet,
      });
    else if (road)
      setDraft({ ...preset, kind: "street", lanes: road.lanes, signal: road.signal, period: road.period });
  }, [inspectPoint?.gx, inspectPoint?.gz, selected?.id]);
  const current = tool ?? draft,
    kind = current.kind,
    infra = state.infrastructure,
    point = inspectPoint ?? (selected ? { gx: selected.gx, gz: selected.gz } : coords);
  const waterSystem = hydraulics(state);
  const key = tileKey(point.gx, point.gz),
    span = infra?.spans[key],
    flow = waterSystem.runs.get(key),
    ground = getTerrainCell(state, point.gx, point.gz);
  const set = (patch: Partial<InfrastructureTool>) => {
    const next={...current,...patch};
    if(next.mode==="rail"&&(patch.mode==="rail"||patch.railType)){
      next.railType=patch.railType??next.railType??"steel";next.shape=railShape[next.railType];
      next.height=Math.max(next.height??2,railClearHeight[next.railType]);
    }
    setDraft(next);
    if(tool) onToolChange(next);
    setFeedback("");
  };
  const choice = <K extends keyof InfrastructureTool>(key: K, title: string, values: [string, string][]) => (
    <label key={key}>
      {title}
      <select
        aria-label={title}
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
  const num = (key: keyof InfrastructureTool, title: string, min: number, max: number, step = 1, factor = 1) => (
    <label key={key}>
      {title}
      <input
        aria-label={title}
        className={field}
        type="number"
        min={min * factor}
        max={max * factor}
        step={step * factor}
        value={Number(current[key] ?? preset[key] ?? min) * factor}
        onChange={(e) => set({ [key]: Math.min(max, Math.max(min, Number(e.target.value) / factor)) })}
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
            min={GRID_MIN}
            max={GRID_MAX}
            value={pt[axis]}
            onChange={(e) => change({ ...pt, [axis]: Math.max(GRID_MIN, Math.min(GRID_MAX, Math.round(Number(e.target.value)))) })}
          />
        </label>
      ))}
    </fieldset>
  );
  const commit = (points: GridPoint[]) => onPreview(current, points);
  const pieces=span?crossingPieces(state,point):[], road=span&&state.elements.find(e=>e.gx===point.gx&&e.gz===point.gz);
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
          aria-label="Construction tool"
          className={field}
          value={kind}
          onChange={e=>{setDraft(defaultTool(e.target.value as Kind));onToolChange(null);setFeedback("");}}
        >
          {tools.map(group=><optgroup key={group.group} label={group.group}>{group.entries.map(([type, label]) => {
            const stage = requiredToolStage({ kind: type });
            return (
              <option key={type} value={type}>
                {label}
                {(state.mode !== "god" || effective(state, "stageRules", 0) > 0) && state.highestStageReached < stage
                  ? " · stage " + stage
                  : ""}
              </option>
            );
          })}</optgroup>)}
        </select>
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {brushKinds.includes(kind) && <label>Brush width<select aria-label="Brush width" className={field} value={current.radius??0} onChange={e=>set({radius:Number(e.target.value)})}>
          {[0,1,2,3].map(n=><option key={n} value={n}>{n===0 ? "Single tile" : (2*n+1)+" tiles across"}</option>)}</select></label>}
        {["canal", "pond", "bay", "river", "spring"].includes(kind) && num("depth", "Depth (m)", 0.25, 8, 0.25)}
        {["raise", "lower", "mountain", "canyon", "peninsula", "bridge", "aqueduct"].includes(kind) &&
          num(
            "height",
            kind === "bridge" ? "Deck rise (m)" : kind === "aqueduct" ? "Support height (m)" : kind==="canyon" ? "Cut depth (m)" : "Height change (m)",
            0.5,
            9,
            0.5,
            kind === "mountain" || kind === "canyon" ? 2 : 1,
          )}
        {["paint", "peninsula"].includes(kind) &&
          choice("material", "Ground", groups(["grass", "sand", "clay", "rock", "wetland", "snow"] as const))}
        {kind === "bridge" && (
          <>
            {current.mode==="rail"?choice("railType","Rail structure",Object.entries(RAIL_BRIDGES)):choice("shape", "Span", groups(["arch", "truss", "suspension", "lift","beam"]))}
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
            <label>Total lanes<select className={field} value={current.lanes??2} onChange={e=>set({lanes:Number(e.target.value)})}>
              {[2,4,6,8,10,12].map(n=><option key={n} value={n}>{n} lanes</option>)}</select></label>
            {choice("signal", "Signal phase", [
              ["yield", "Yield"],
              ["auto", "Timed cycle"],
              ["north", "Hold N–S green"],
              ["east", "Hold E–W green"],
            ])}
            {current.signal==="auto" && num("period", "Cycle (seconds)", 4, 60)}
          </>
        )}
        {kind === "interchange" && (
          <>
            {choice("layout", "Junction", groups(["diamond", "trumpet", "directional"]))}
            <label>Orientation<select className={field} value={current.orientation??0} onChange={e=>set({orientation:Number(e.target.value)})}>
              {["0°","90°","180°","270°"].map((angle,i)=><option key={i} value={i}>{angle}</option>)}</select></label>
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
      <p className="works-hint">{tools.flatMap(group=>group.entries).find(([id])=>id===kind)?.[2]}</p>
      <div className="works-actions">
        <button className="works-primary" onClick={()=>{setDraft(current);onUseMap(current);}}>Use on map</button>
        {tool && <button className={btn} onClick={()=>{setDraft(current);onToolChange(null);}}>Put tool away</button>}
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
        <summary className="cursor-pointer font-bold">Coordinates &amp; inspection</summary>
        {cellInput("Start tile", coords, setCoords)}
        {kind!=="interchange" && cellInput("End tile", end, setEnd)}
        <div className="mt-1 flex gap-1">
          {(kind!=="bridge"||span) && <button className={btn} onClick={() => commit([coords])}>Preview tile</button>}
          {kind!=="interchange" && <button className={btn} onClick={() => commit([coords, end])}>Preview run</button>}
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
            {bridgeLandmark(span,pieces.filter(([,s])=>!s.end).length)} · Level {bridgeTier(span)} · {pieces.length*4} m overall · {span.mode} deck at {span.deck.toFixed(1)} m.{" "}
            {Number.isFinite(nav.clearance)
              ? (nav.opening ? "Maximum raised headroom " : "Boat headroom ") + nav.clearance.toFixed(1) + " m."
              : "Opening available."}
            {road&&pieces.length>0&&bridgeTier(span)<(span.mode==="rail"||span.mode==="foot"?5:11)&&<button className={btn} onClick={()=>mutate(d=>{const result=upgradeElementDirect(d,road.id);setFeedback(result.ok?"Whole crossing upgraded.":result.reason??"Upgrade unavailable.");})}>Upgrade whole crossing {buildingCharges(state)?"$"+placedUpgradeCost(state,road):"(free)"}</button>}
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
