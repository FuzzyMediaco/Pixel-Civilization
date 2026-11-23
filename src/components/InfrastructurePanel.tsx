import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpFromLine,
  Columns3,
  Droplet,
  Droplets,
  Eraser,
  FoldVertical,
  GitFork,
  Landmark,
  LandPlot,
  Lock,
  Minus,
  Mountain,
  Paintbrush,
  Shield,
  Slash,
  SlidersHorizontal,
  Sparkles,
  Spline,
  Triangle,
  Undo2,
  Waves,
  Waypoints,
  X,
} from "lucide-react";
import { RAIL_BRIDGES, railClearHeight, railShape, bridgeLandmark, bridgeTier, crossingPieces } from "../game/bridgeWorks";
import { placedUpgradeCost, upgradeElementDirect } from "../game/simulation";
import { buildingCharges, effective } from "../game/cityEconomy";
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
  type Material,
} from "../game/terrain";
import { VOXEL_PITCH, effectiveVoxelRadius, isVoxelSculptTool, sampleTerrainAt, worldToVoxel } from "../game/voxelTerrain";
import { TILE_SIZE } from "../game/voxelCore";

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
type Kind = InfrastructureTool["kind"];
type WorksFamily = "sculpt" | "shape" | "water" | "works";

type ToolEntry = {
  kind: Kind;
  label: string;
  short: string;
  desc: string;
  Icon: typeof Mountain;
};

const TOOL_GROUPS: { group: string; family: WorksFamily; Icon: typeof Mountain; entries: ToolEntry[] }[] = [
  {
    group: "Sculpt",
    family: "sculpt",
    Icon: ArrowUpFromLine,
    entries: [
      { kind: "raise", label: "Raise land", short: "Raise", desc: "Lift 0.25m voxels smoothly into hills, ramps, or terraces.", Icon: ArrowUp },
      { kind: "lower", label: "Lower land", short: "Lower", desc: "Carve down 0.25m voxels. Near the sea, digging below water opens saltwater.", Icon: ArrowDown },
      { kind: "smooth", label: "Smooth grade", short: "Smooth", desc: "Soften steep steps and blend terrain seamlessly.", Icon: Waves },
      { kind: "flatten", label: "Flatten", short: "Flatten", desc: "Level ground cleanly to the exact 0.25m height where your stroke starts.", Icon: Minus },
      { kind: "sharpen", label: "Sharpen", short: "Sharpen", desc: "Crisp up ridges, rocky cliff faces, and stepped voxel ledges.", Icon: Triangle },
      { kind: "paint", label: "Paint ground", short: "Paint", desc: "Paint grass, sand, rock, clay, wetland, or snow at 0.25m voxel detail.", Icon: Paintbrush },
    ],
  },
  {
    group: "Landforms",
    family: "shape",
    Icon: Mountain,
    entries: [
      { kind: "mountain", label: "Mountain ridge", short: "Mountain", desc: "Sculpt stepped granite ridges and snow-capped alpine peaks.", Icon: Mountain },
      { kind: "valley", label: "Carve valley", short: "Valley", desc: "Carve a natural U-shaped valley floor with softly graded slopes.", Icon: FoldVertical },
      { kind: "canyon", label: "Cut canyon", short: "Canyon", desc: "Excavate a steep rock-walled dry gorge.", Icon: Slash },
      { kind: "peninsula", label: "Reclaim coast", short: "Coast", desc: "Extend dry buildable land into the sea with a tapered sandy beach.", Icon: LandPlot },
    ],
  },
  {
    group: "Water",
    family: "water",
    Icon: Waves,
    entries: [
      { kind: "pond", label: "Dig pond", short: "Pond", desc: "Carve a compact freshwater pond with damp sandy banks.", Icon: Droplet },
      { kind: "lake", label: "Carve lake", short: "Lake", desc: "Excavate a wide freshwater lake blended smoothly into surrounding ground.", Icon: Droplets },
      { kind: "river", label: "Draw river", short: "River", desc: "Trace a flowing freshwater river from source to sea.", Icon: Spline },
      { kind: "canal", label: "Draw canal", short: "Canal", desc: "Cut a crisp freshwater canal and link it to nearby water.", Icon: Columns3 },
      { kind: "bay", label: "Open bay", short: "Bay", desc: "Carve a saltwater inlet seamlessly connected to the 0.25m ocean.", Icon: Waves },
      { kind: "spring", label: "Tap spring", short: "Spring", desc: "Create a freshwater spring feeding streams, ponds, and aqueducts.", Icon: Sparkles },
      { kind: "lock", label: "Canal lock", short: "Lock", desc: "Place a gate in a channel to regulate vessel passage.", Icon: Lock },
      { kind: "dam", label: "Dam gate", short: "Dam", desc: "Retain freshwater upstream and control hydraulic head.", Icon: Shield },
    ],
  },
  {
    group: "Crossings",
    family: "works",
    Icon: Waypoints,
    entries: [
      { kind: "bridge", label: "Span crossing", short: "Bridge", desc: "Drag bank to bank (or tap each bank) to span water or valleys.", Icon: Waypoints },
      { kind: "aqueduct", label: "Lay aqueduct", short: "Aqueduct", desc: "Trace a raised stone water conduit from source to consumers.", Icon: Landmark },
      { kind: "street", label: "Edit road", short: "Road", desc: "Trace roads to set lane count or junction signal timing.", Icon: SlidersHorizontal },
      { kind: "interchange", label: "Interchange", short: "Junction", desc: "Tap once to stamp a grade-separated highway junction.", Icon: GitFork },
      { kind: "erase", label: "Remove works", short: "Erase", desc: "Reset sculpted ground or remove a bridge, aqueduct, or road layer.", Icon: Eraser },
    ],
  },
];

const ALL_ENTRIES = TOOL_GROUPS.flatMap((g) => g.entries);

/** Plain name for a land & water tool (placement bar). */
export const worksToolLabel = (kind: Kind) =>
  ALL_ENTRIES.find((e) => e.kind === kind)?.label ?? kind;

const MATERIAL_SWATCHES: { id: Material; label: string; hex: string }[] = [
  { id: "grass", label: "Grass", hex: "#81b561" },
  { id: "sand", label: "Sand", hex: "#e1cb91" },
  { id: "clay", label: "Clay", hex: "#a47b60" },
  { id: "rock", label: "Rock", hex: "#908781" },
  { id: "wetland", label: "Wetland", hex: "#6e8d68" },
  { id: "snow", label: "Snow", hex: "#e2ece8" },
];

const VOXEL_PRESETS: { radius: number; label: string; title: string }[] = [
  { radius: 0, label: "1", title: "Single 0.25m voxel" },
  { radius: 1, label: "3", title: "3 voxels (0.75m)" },
  { radius: 3, label: "7", title: "7 voxels (1.75m)" },
  { radius: 6, label: "13", title: "13 voxels (3.25m)" },
  { radius: 12, label: "25", title: "25 voxels (6.25m)" },
];

function familyOf(kind: Kind): WorksFamily {
  return TOOL_GROUPS.find((g) => g.entries.some((e) => e.kind === kind))?.family ?? "sculpt";
}

export function defaultSculptTool(kind: Kind): InfrastructureTool {
  switch (kind) {
    case "bridge":
      return { kind, mode: "foot", shape: "arch", height: 2, lift: "auto" };
    case "aqueduct":
      return { kind, height: 3, style: 0, outlet: "auto" };
    case "interchange":
      return { kind, layout: "diamond", orientation: 0, lanes: 2, signal: "auto", period: 12 };
    case "street":
      return { kind, lanes: 2, signal: "yield", period: 12 };
    case "lock":
      return { kind, gate: "open" };
    case "dam":
      return { kind, gate: "open", height: 1 };
    case "erase":
      return { kind, eraseLayer: "terrain" };
    case "spring":
      return { kind, precision: "voxel", voxelRadius: 4, depth: 1, flow: 12, strength: 1 };
    case "river":
      return { kind, precision: "voxel", voxelRadius: 5, depth: 1.25, flow: 4, strength: 1 };
    case "pond":
      return { kind, precision: "voxel", voxelRadius: 6, depth: 1.25, strength: 1 };
    case "canal":
      return { kind, precision: "voxel", voxelRadius: 4, depth: 1.25, strength: 1 };
    case "lake":
      return { kind, precision: "voxel", voxelRadius: 12, depth: 2, strength: 1 };
    case "bay":
      return { kind, precision: "voxel", voxelRadius: 10, depth: 1.5, strength: 1 };
    case "paint":
      return { kind, precision: "voxel", voxelRadius: 3, material: "sand", strength: 1 };
    case "peninsula":
      return { kind, precision: "voxel", voxelRadius: 10, material: "sand", height: 1, strength: 1 };
    case "flatten":
    case "sharpen":
    case "smooth":
      return { kind, precision: "voxel", voxelRadius: 4, strength: 1 };
    case "mountain":
      return { kind, precision: "voxel", voxelRadius: 10, height: 1.5, strength: 1 };
    case "valley":
    case "canyon":
      return { kind, precision: "voxel", voxelRadius: 10, height: 1.5, strength: 1 };
    case "raise":
    case "lower":
    default:
      return { kind, precision: "voxel", voxelRadius: 3, height: 0.75, strength: 1 };
  }
}

const preset = defaultSculptTool("raise");
const field = "block w-full rounded border border-stone-300 bg-white/90 p-1.5 text-xs text-stone-900";
const btn =
  "rounded border border-stone-300 bg-white/90 px-2 py-1.5 text-xs font-semibold text-stone-800 hover:bg-amber-50 disabled:opacity-45";
const groups: <K extends string>(a: readonly K[]) => [K, string][] = (a) =>
  a.map((k) => [k, k.charAt(0).toUpperCase() + k.slice(1)]);

export function InfrastructurePanel({
  state,
  mutate,
  tool,
  onToolChange,
  onPreview,
  onUseMap,
  selected,
  inspectPoint,
}: Props) {
  const [draft, setDraft] = useState<InfrastructureTool>(tool ?? preset);
  const [family, setFamily] = useState<WorksFamily>(() => familyOf((tool ?? preset).kind));
  const [coords, setCoords] = useState<GridPoint>({ gx: selected?.gx ?? 0, gz: selected?.gz ?? 0 });
  const [end, setEnd] = useState<GridPoint>({ gx: (selected?.gx ?? 0) + 3, gz: selected?.gz ?? 0 });
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (tool) {
      setDraft(tool);
      setFamily(familyOf(tool.kind));
    }
  }, [tool?.kind]);

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
        railType: span.railType,
        height: Math.max(0.5, span.deck - bank),
        lift: span.lift,
      });
      setFamily("works");
    } else if (duct) {
      setDraft({
        ...preset,
        kind: "aqueduct",
        style: duct.style,
        height: duct.height - Math.max(0, ground.depth ? ground.waterLevel : ground.elevation),
        outlet: duct.outlet,
      });
      setFamily("works");
    } else if (road) {
      setDraft({ ...preset, kind: "street", lanes: road.lanes, signal: road.signal, period: road.period });
      setFamily("works");
    }
  }, [inspectPoint?.gx, inspectPoint?.gz, selected?.id]);

  const current = tool ?? draft;
  const kind = current.kind;
  const infra = state.infrastructure;
  const point = inspectPoint ?? (selected ? { gx: selected.gx, gz: selected.gz } : coords);
  const waterSystem = hydraulics(state);
  const key = tileKey(point.gx, point.gz);
  const span = infra?.spans[key];
  const flow = waterSystem.runs.get(key);
  const ground = getTerrainCell(state, point.gx, point.gz);
  const wx = (point.gx + 0.5) * TILE_SIZE;
  const wz = (point.gz + 0.5) * TILE_SIZE;
  const voxelSample = sampleTerrainAt(state, wx, wz);
  const [inspectVx, inspectVz] = worldToVoxel(wx, wz);

  const selectKind = (nextKind: Kind) => {
    const next = defaultSculptTool(nextKind);
    setDraft(next);
    setFamily(familyOf(nextKind));
    onToolChange(next);
    setFeedback("");
  };

  const set = (patch: Partial<InfrastructureTool>) => {
    const next: InfrastructureTool = {
      ...current,
      ...patch,
      ...(isVoxelSculptTool(current) ? { precision: "voxel" as const } : {}),
    };
    if (next.mode === "rail" && (patch.mode === "rail" || patch.railType)) {
      next.railType = patch.railType ?? next.railType ?? "steel";
      next.shape = railShape[next.railType];
      next.height = Math.max(next.height ?? 2, railClearHeight[next.railType]);
    }
    setDraft(next);
    if (tool) onToolChange(next);
    setFeedback("");
  };

  const choice = <K extends keyof InfrastructureTool>(k: K, title: string, values: [string, string][]) => (
    <label key={k} className="ui-works-field">
      <span>{title}</span>
      <select
        aria-label={title}
        className="ui-works-select"
        value={String(current[k] ?? preset[k] ?? "")}
        onChange={(e) => set({ [k]: e.target.value })}
      >
        {values.map(([v, name]) => (
          <option key={v} value={v}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );

  const num = (k: keyof InfrastructureTool, title: string, min: number, max: number, step = 1, factor = 1) => {
    const val = Number(current[k] ?? preset[k] ?? min) * factor;
    const minV = min * factor;
    const maxV = max * factor;
    const stepV = step * factor;
    return (
      <label key={k} className="ui-works-slider">
        <span className="ui-works-slider-head">
          <span>{title}</span>
          <strong className="tabular-nums">{Number.isInteger(val) ? val : val.toFixed(2)}</strong>
        </span>
        <input
          aria-label={title}
          className="ui-works-range"
          type="range"
          min={minV}
          max={maxV}
          step={stepV}
          value={val}
          onChange={(e) => set({ [k]: Math.min(max, Math.max(min, Number(e.target.value) / factor)) })}
        />
      </label>
    );
  };

  const cellInput = (label: string, pt: GridPoint, change: (v: GridPoint) => void) => (
    <fieldset className="flex gap-1.5">
      <legend className="text-[11px] font-bold">{label}</legend>
      {(["gx", "gz"] as const).map((axis) => (
        <label key={axis} className="ui-works-field flex-1">
          <span>{axis === "gx" ? "X" : "Z"}</span>
          <input
            className="ui-works-select"
            type="number"
            min={GRID_MIN}
            max={GRID_MAX}
            value={pt[axis]}
            onChange={(e) =>
              change({ ...pt, [axis]: Math.max(GRID_MIN, Math.min(GRID_MAX, Math.round(Number(e.target.value)))) })
            }
          />
        </label>
      ))}
    </fieldset>
  );

  const commit = (points: GridPoint[]) => onPreview(current, points);
  const pieces = span ? crossingPieces(state, point) : [];
  const road = span && state.elements.find((e) => e.gx === point.gx && e.gz === point.gz);
  const nav = buildWaterNavigation(state).cell(point.gx, point.gz);
  const art = [
    ["0", "Travertine arcade"],
    ["1", "Granite piers"],
    ["2", "Striped stone"],
    ["3", "Mossy ruins"],
  ];
  const familyTools = TOOL_GROUPS.find((g) => g.family === family)?.entries ?? [];
  const activeEntry = ALL_ENTRIES.find((e) => e.kind === kind);
  const isBrushTool = isVoxelSculptTool(current);
  const voxRadius = isBrushTool ? effectiveVoxelRadius(current) : 0;
  const voxDiameter = voxRadius * 2 + 1;
  const voxMeters = (voxDiameter * VOXEL_PITCH).toFixed(2);

  return (
    <section aria-label="Land and public works" className="ui-works-panel">
      {/* Compact icon+label family tabs */}
      <div className="ui-works-fam" role="tablist" aria-label="Sculpt tool families">
        {TOOL_GROUPS.map((g) => {
          const FamIcon = g.Icon;
          const active = family === g.family;
          return (
            <button
              key={g.family}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setFamily(g.family);
                const first = g.entries[0]?.kind;
                if (first && familyOf(kind) !== g.family) selectKind(first);
              }}
              className={"ui-works-fam-btn" + (active ? " is-active" : "")}
            >
              <FamIcon size={13} aria-hidden="true" />
              <span>{g.group}</span>
            </button>
          );
        })}
      </div>

      {/* Tactile icon-first tool grid */}
      <div className="ui-works-tool-grid" role="group" aria-label="Tools">
        {familyTools.map(({ kind: type, label, short, Icon }) => {
          const stage = requiredToolStage({ kind: type });
          const locked =
            (state.mode !== "god" || effective(state, "stageRules", 0) > 0) &&
            state.highestStageReached < stage;
          const on = kind === type;
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              title={label}
              onClick={() => selectKind(type)}
              className={"ui-works-tool-card" + (on ? " is-active" : "") + (locked ? " is-locked" : "")}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{short}</span>
              {locked && <em>S{stage}</em>}
            </button>
          );
        })}
      </div>

      {/* Primary live-map bar + quick Undo / Stop */}
      <div className="ui-works-bar">
        <button
          type="button"
          className="ui-works-use-btn"
          onClick={() => {
            const active = isBrushTool ? { ...current, precision: "voxel" as const, voxelRadius: voxRadius } : current;
            setDraft(active);
            onUseMap(active);
          }}
        >
          {isBrushTool ? `Sculpt · ${activeEntry?.short ?? kind}` : `Use · ${activeEntry?.short ?? kind}`}
        </button>
        <button
          type="button"
          className="ui-works-sub-btn"
          disabled={!infra?.undo.length}
          title="Undo last terrain edit"
          aria-label="Undo last terrain edit"
          onClick={() =>
            mutate((d) =>
              setFeedback(undoInfrastructure(d) ? "Last sculpt undone." : "A later building occupies this edit."),
            )
          }
        >
          <Undo2 size={14} aria-hidden="true" />
          <span>Undo</span>
        </button>
        {tool && (
          <button
            type="button"
            className="ui-works-sub-btn"
            title="Stop sculpting"
            aria-label="Stop sculpting"
            onClick={() => {
              setDraft(current);
              onToolChange(null);
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Material visual swatches for Paint & Reclaim Coast */}
      {["paint", "peninsula"].includes(kind) && (
        <div className="ui-works-swatches" role="group" aria-label="Ground material">
          {MATERIAL_SWATCHES.map((sw) => {
            const selectedMat = (current.material ?? "sand") === sw.id;
            return (
              <button
                key={sw.id}
                type="button"
                aria-pressed={selectedMat}
                title={sw.label}
                onClick={() => set({ material: sw.id })}
                className={"ui-works-swatch" + (selectedMat ? " is-active" : "")}
              >
                <i style={{ background: sw.hex }} aria-hidden="true" />
                <span>{sw.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* One-tap 0.25m voxel brush presets */}
      {isBrushTool && (
        <div className="ui-works-presets" role="group" aria-label="Brush size presets">
          <span className="ui-works-presets-lbl">0.25m vox</span>
          {VOXEL_PRESETS.map((pr) => {
            const on = voxRadius === pr.radius;
            return (
              <button
                key={pr.radius}
                type="button"
                aria-pressed={on}
                title={pr.title}
                onClick={() => set({ precision: "voxel", voxelRadius: pr.radius })}
                className={"ui-works-preset-btn" + (on ? " is-active" : "")}
              >
                {pr.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Fine compact sliders & parameters */}
      <div className="ui-works-controls">
        {isBrushTool && (
          <>
            <label className="ui-works-slider">
              <span className="ui-works-slider-head">
                <span>Brush width</span>
                <strong className="tabular-nums">
                  {voxRadius === 0 ? "1 vox · 0.25m" : `${voxDiameter} vox · ${voxMeters}m`}
                </strong>
              </span>
              <input
                aria-label="Brush width"
                className="ui-works-range"
                type="range"
                min={0}
                max={32}
                step={1}
                value={voxRadius}
                onChange={(e) => set({ precision: "voxel", voxelRadius: Number(e.target.value) })}
              />
            </label>
            <label className="ui-works-slider">
              <span className="ui-works-slider-head">
                <span>Strength</span>
                <strong className="tabular-nums">{Math.round((current.strength ?? 1) * 100)}%</strong>
              </span>
              <input
                aria-label="Brush strength"
                className="ui-works-range"
                type="range"
                min={0.25}
                max={2}
                step={0.25}
                value={current.strength ?? 1}
                onChange={(e) => set({ strength: Number(e.target.value) })}
              />
            </label>
          </>
        )}
        {["canal", "pond", "lake", "bay", "river", "spring"].includes(kind) && num("depth", "Depth (m)", 0.25, 8, 0.25)}
        {["raise", "lower", "mountain", "valley", "canyon", "peninsula", "bridge", "aqueduct"].includes(kind) &&
          num(
            "height",
            kind === "bridge"
              ? "Deck rise (m)"
              : kind === "aqueduct"
                ? "Support height (m)"
                : kind === "canyon" || kind === "valley"
                  ? "Cut depth (m)"
                  : "Height change (m)",
            0.25,
            9,
            0.25,
            kind === "mountain" || kind === "canyon" ? 2 : 1,
          )}
        {kind === "bridge" && (
          <>
            {current.mode === "rail"
              ? choice("railType", "Rail structure", Object.entries(RAIL_BRIDGES))
              : choice("shape", "Span", groups(["arch", "truss", "suspension", "lift", "beam"]))}
            {choice("mode", "Deck use", groups(["foot", "road", "rail", "highway", "freeway"]))}
            {current.shape === "lift" && choice("lift", "Lift gate", groups(["auto", "open", "closed"]))}
          </>
        )}
        {kind === "erase" && choice("eraseLayer", "Remove layer", groups(["terrain", "aqueduct", "deck", "street"]))}
        {["dam", "lock"].includes(kind) && choice("gate", "Gate", groups(["open", "closed"]))}
        {kind === "dam" && num("height", "Retained head (m)", 0.5, 5, 0.5)}
        {kind === "aqueduct" && (
          <>
            <label className="ui-works-field">
              <span>Masonry</span>
              <select
                className="ui-works-select"
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
            <label className="ui-works-field">
              <span>Total lanes</span>
              <select
                className="ui-works-select"
                value={current.lanes ?? 2}
                onChange={(e) => set({ lanes: Number(e.target.value) })}
              >
                {[2, 4, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} lanes
                  </option>
                ))}
              </select>
            </label>
            {choice("signal", "Signal phase", [
              ["yield", "Yield"],
              ["auto", "Timed cycle"],
              ["north", "Hold N–S green"],
              ["east", "Hold E–W green"],
            ])}
            {current.signal === "auto" && num("period", "Cycle (seconds)", 4, 60)}
          </>
        )}
        {kind === "interchange" && (
          <>
            {choice("layout", "Junction", groups(["diamond", "trumpet", "directional"]))}
            <label className="ui-works-field">
              <span>Orientation</span>
              <select
                className="ui-works-select"
                value={current.orientation ?? 0}
                onChange={(e) => set({ orientation: Number(e.target.value) })}
              >
                {["0°", "90°", "180°", "270°"].map((angle, i) => (
                  <option key={i} value={i}>
                    {angle}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {state.mode === "god" && ["spring", "river"].includes(kind) && num("flow", "Source flow", 0, 100)}
        {state.mode === "god" && ["pond", "lake", "canal", "river"].includes(kind) && (
          <label className="ui-works-field">
            <span>Water level (m)</span>
            <input
              className="ui-works-select"
              type="number"
              step=".25"
              placeholder="Local"
              value={current.waterLevel ?? ""}
              onChange={(e) => set({ waterLevel: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </label>
        )}
      </div>

      {activeEntry && <p className="ui-works-hint">{activeEntry.desc}</p>}

      <details>
        <summary className="cursor-pointer font-bold">Inspector &amp; coordinates</summary>
        {cellInput("Start", coords, setCoords)}
        {kind !== "interchange" && cellInput("End", end, setEnd)}
        <div className="mt-1 flex gap-1">
          {(kind !== "bridge" || span) && (
            <button className={btn} onClick={() => commit([coords])}>
              Preview point
            </button>
          )}
          {kind !== "interchange" && (
            <button className={btn} onClick={() => commit([coords, end])}>
              Preview run
            </button>
          )}
        </div>
        {selected && (
          <button className={btn} onClick={() => commit([point])}>
            Preview selected place
          </button>
        )}
        <p className="mt-2">
          Voxel {inspectVx}, {inspectVz} · {voxelSample.material} at {voxelSample.elevation.toFixed(2)} m.{" "}
          {nav.depth > 0 ? nav.depth.toFixed(1) + " m deep, " + nav.width.toFixed(1) + " m wide." : "Dry ground."}
        </p>
        {span && (
          <p>
            {bridgeLandmark(span, pieces.filter(([, s]) => !s.end).length)} · Level {bridgeTier(span)} ·{" "}
            {pieces.length * 4} m overall · {span.mode} deck at {span.deck.toFixed(1)} m.{" "}
            {Number.isFinite(nav.clearance)
              ? (nav.opening ? "Maximum raised headroom " : "Boat headroom ") + nav.clearance.toFixed(1) + " m."
              : "Opening available."}
            {road && pieces.length > 0 && bridgeTier(span) < (span.mode === "rail" || span.mode === "foot" ? 5 : 11) && (
              <button
                className={btn}
                onClick={() =>
                  mutate((d) => {
                    const result = upgradeElementDirect(d, road.id);
                    setFeedback(result.ok ? "Whole crossing upgraded." : result.reason ?? "Upgrade unavailable.");
                  })
                }
              >
                Upgrade whole crossing {buildingCharges(state) ? "$" + placedUpgradeCost(state, road) : "(free)"}
              </button>
            )}
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
        <div className="mt-1 flex gap-1">
          <button className={btn} onClick={() => mutate((d) => registerRoadDemand(d, point.gx, point.gz, 0, 1, 12))}>
            Queue N–S traffic
          </button>
          <button className={btn} onClick={() => mutate((d) => registerRoadDemand(d, point.gx, point.gz, 1, 0, 12))}>
            Queue E–W traffic
          </button>
        </div>
      )}
      {feedback && (
        <p role="status" className="ui-works-hint font-semibold">
          {feedback}
        </p>
      )}
    </section>
  );
}
