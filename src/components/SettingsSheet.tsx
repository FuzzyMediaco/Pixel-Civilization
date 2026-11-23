import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  FastForward,
  GraduationCap,
  Keyboard,
  ListChecks,
  Mountain,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Sliders,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { type GameMode } from "../game/catalog";
import type { QuickBuildMode } from "../game/quickBuildTree";
import {
  CORE_QUICK_EDIT_IDS,
  MAX_QUICK_SCULPT_SLOTS,
  MIN_QUICK_SCULPT_SLOTS,
  QUICK_BUILD_MODE_META,
  QUICK_EDIT_BUTTON_META,
  QUICK_SCULPT_TAP_BEHAVIOR_META,
  QUICK_SCULPT_TOOL_META,
  SMART_FOCUS_META,
  createDefaultQuickMenuPrefs,
  createDefaultQuickSculptPrefs,
  getOrderedDecisionTreeParents,
  moveExactParent,
  moveQuickEditButton,
  moveQuickSculptTool,
  toggleQuickEditButton,
  toggleQuickSculptTool,
  type QuickEditActionId,
  type QuickMenuPrefs,
  type QuickSculptToolId,
} from "../game/quickMenuPrefs";
import {
  MAX_MANUAL_DRAWER_SLOTS,
  QUICK_DRAWER_CATALOG_META,
  createDefaultQuickDrawerPrefs,
  moveManualDrawerAction,
  toggleManualDrawerAction,
  type QuickDrawerCatalogGroup,
  type QuickDrawerPrefs,
} from "../game/adaptiveQuickDrawer";
import type { GameState, SelectionFilter } from "../game/simulation";
import type { Material } from "../game/terrain";
import { VOXEL_PITCH } from "../game/voxelTerrain";
import { DecisionParentFavicon } from "./CategoryFavicon";
import { DrawerActionIcon } from "./Hud";
import type { CursorBehavior } from "./MoreSheet";
import { SculptToolIcon } from "./QuickBuildRing";
import { BottomSheet, Button, Chip, ChipRow, type SheetHeight } from "./ui";

const SCULPT_MATERIALS: { id: Material; label: string; hex: string }[] = [
  { id: "grass", label: "Grass", hex: "#81b561" },
  { id: "sand", label: "Sand", hex: "#e1cb91" },
  { id: "clay", label: "Clay", hex: "#a47b60" },
  { id: "rock", label: "Rock", hex: "#908781" },
  { id: "wetland", label: "Wetland", hex: "#6e8d68" },
  { id: "snow", label: "Snow", hex: "#e2ece8" },
];
const SCULPT_SIZE_PRESETS = [0, 1, 3, 6, 12];

const MODES: { id: GameMode; title: string }[] = [
  { id: "god", title: "God" },
  { id: "real", title: "Real" },
  { id: "survival", title: "Survival" },
  { id: "idle", title: "Idle" },
  { id: "manager", title: "Manager" },
];
const BEHAVIORS: { id: CursorBehavior; label: string; hint: string }[] = [
  { id: "auto", label: "Smart", hint: "Buildings place once; roads keep drawing until ✓." },
  { id: "select", label: "Once", hint: "Every placement returns to selecting." },
  { id: "place", label: "Continuous", hint: "Brush stays active until ✓." },
];
const FILTERS: { id: SelectionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "roads", label: "Roads" },
  { id: "buildings", label: "Buildings" },
  { id: "water", label: "Water" },
  { id: "power", label: "Power" },
  { id: "waste", label: "Waste" },
];
const KEYS: [string, string][] = [
  ["B / L / C / S / M", "Build, Layers, City, Sculpt, More"],
  ["T", "City → Transit"],
  ["R", "Rotate"],
  ["Del", "Demolish selection"],
  ["Space + Drag", "Pan camera anytime"],
  ["Right-Drag / Q·E", "Orbit camera"],
  ["Ctrl+Z", "Undo last edit"],
  ["Esc", "Step back / close"],
  ["+ / −", "Zoom"],
];
const DRAWER_GROUPS: QuickDrawerCatalogGroup[] = ["Quick Menus", "City & Map", "Tools & Studio", "Settings"];

export function SettingsSheet({
  state,
  height,
  onHeight,
  onClose,
  cursorBehavior,
  onCursorBehavior,
  selectionFilter,
  onSelectionFilter,
  quickBuildMode,
  onQuickBuildMode,
  quickMenuPrefs,
  onQuickMenuPrefs,
  quickDrawerPrefs,
  onQuickDrawerPrefs,
  focusQuickDrawerConfig,
  focusQuickSculptConfig,
  learnedBuildsCount = 0,
  onResetBuildHabits,
  simSpeed = 1,
  onSimSpeed,
  onUndo,
  tutorialMode,
  onStartTutorial,
  onStopTutorial,
  headerLead,
}: {
  state: GameState;
  height: SheetHeight;
  onHeight: (h: SheetHeight) => void;
  onClose: () => void;
  cursorBehavior: CursorBehavior;
  onCursorBehavior: (b: CursorBehavior) => void;
  selectionFilter: SelectionFilter;
  onSelectionFilter: (f: SelectionFilter) => void;
  quickBuildMode: QuickBuildMode;
  onQuickBuildMode: (m: QuickBuildMode) => void;
  quickMenuPrefs: QuickMenuPrefs;
  onQuickMenuPrefs: (next: QuickMenuPrefs) => void;
  quickDrawerPrefs: QuickDrawerPrefs;
  onQuickDrawerPrefs: (next: QuickDrawerPrefs) => void;
  focusQuickDrawerConfig?: number;
  focusQuickSculptConfig?: number;
  learnedBuildsCount?: number;
  onResetBuildHabits?: () => void;
  simSpeed?: number;
  onSimSpeed?: (v: number) => void;
  onUndo: () => void;
  tutorialMode?: GameMode | null;
  onStartTutorial?: (m: GameMode) => void;
  onStopTutorial?: () => void;
  headerLead?: React.ReactNode;
}) {
  const [quickMenusOpen, setQuickMenusOpen] = useState(true);
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickSculptOpen, setQuickSculptOpen] = useState(false);
  const [buildCustomOpen, setBuildCustomOpen] = useState(false);
  const [tutorialsOpen, setTutorialsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);

  useEffect(() => {
    if (focusQuickDrawerConfig && focusQuickDrawerConfig > 0) {
      setQuickMenusOpen(true);
      setQuickDrawerOpen(true);
    }
  }, [focusQuickDrawerConfig]);

  useEffect(() => {
    if (focusQuickSculptConfig && focusQuickSculptConfig > 0) {
      setQuickMenusOpen(true);
      setQuickSculptOpen(true);
    }
  }, [focusQuickSculptConfig]);

  const modeName = MODES.find((m) => m.id === state.mode)?.title ?? state.mode;
  const activeFastMeta = QUICK_BUILD_MODE_META.find((m) => m.id === quickBuildMode) ?? QUICK_BUILD_MODE_META[0];
  const buttonMetaById = Object.fromEntries(QUICK_EDIT_BUTTON_META.map((b) => [b.id, b])) as Record<
    QuickEditActionId,
    (typeof QUICK_EDIT_BUTTON_META)[number]
  >;
  const sculptMetaById = Object.fromEntries(QUICK_SCULPT_TOOL_META.map((t) => [t.id, t])) as Record<
    QuickSculptToolId,
    (typeof QUICK_SCULPT_TOOL_META)[number]
  >;
  const drawerMetaById = Object.fromEntries(QUICK_DRAWER_CATALOG_META.map((m) => [m.id, m]));
  const orderedExactParents = getOrderedDecisionTreeParents(quickMenuPrefs.exactParentOrder);
  const hiddenSet = new Set(quickMenuPrefs.quickEdit.hiddenButtons);
  const manualSet = new Set(quickDrawerPrefs.manualIds);
  const qs = quickMenuPrefs.quickSculpt;
  const qsSet = new Set(qs.tools);

  return (
    <BottomSheet
      id="sheet-settings"
      title="Settings"
      subtitle={`${activeFastMeta.name} · ${quickDrawerPrefs.mode === "manual" ? "Manual drawer" : "Adaptive drawer"}`}
      height={height}
      onHeightChange={onHeight}
      onClose={onClose}
      closeLabel="Close Settings"
      headerLead={headerLead}
      dock={
        <div className="ui-sheet-dock">
          <div className="ui-settings-quickbar">
            <button
              type="button"
              className="ui-qbar-btn"
              disabled={!state.constructionHistory?.length}
              title="Undo last building edit"
              aria-label="Undo last building edit"
              onClick={onUndo}
            >
              <Undo2 size={14} aria-hidden="true" />
              <span>Undo</span>
            </button>
            {onSimSpeed && (
              <div className="ui-speed-seg" role="group" aria-label="Simulation speed">
                {[
                  { v: 0, label: "Pause", icon: <Pause size={12} /> },
                  { v: 1, label: "1×", icon: <Play size={12} /> },
                  { v: 2, label: "2×", icon: <FastForward size={12} /> },
                  { v: 4, label: "4×", icon: <FastForward size={12} /> },
                ].map((s) => (
                  <button
                    key={s.v}
                    type="button"
                    aria-pressed={simSpeed === s.v}
                    title={`Simulation speed: ${s.label}`}
                    onClick={() => onSimSpeed(s.v)}
                  >
                    {s.icon}
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="ui-settings-stack">
        {/* Collapsible Quick Menus section */}
        <div className="ui-qm-accordion">
          <button
            type="button"
            className="ui-qm-toggle"
            aria-expanded={quickMenusOpen}
            onClick={() => setQuickMenusOpen((v) => !v)}
          >
            <span className="ui-qm-toggle-title">
              <Sliders size={15} aria-hidden="true" />
              <strong>Quick Menus</strong>
              <span className="ui-qm-pill">{activeFastMeta.name}</span>
            </span>
            {quickMenusOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {quickMenusOpen && (
            <div className="ui-qm-body">
              <p className="ui-qm-label">Fast builder (tap empty ground)</p>
              <ChipRow label="Fast builder menu">
                {QUICK_BUILD_MODE_META.map((m) => (
                  <Chip
                    key={m.id}
                    label={m.name}
                    selected={quickBuildMode === m.id}
                    onClick={() => onQuickBuildMode(m.id)}
                  />
                ))}
              </ChipRow>
              <p className="ui-qm-hint">
                <strong>{activeFastMeta.name}</strong> ({activeFastMeta.clicks}) — {activeFastMeta.shortDesc}
              </p>

              {/* Sub-panel 1: Top-Right Quick Menu (Adaptive vs Manual in EVERY mode) */}
              <div className="ui-qm-sub">
                <button
                  type="button"
                  className="ui-qm-sub-head"
                  aria-expanded={quickDrawerOpen}
                  onClick={() => setQuickDrawerOpen((v) => !v)}
                >
                  <span className="ui-qm-sub-title">
                    <ListChecks size={14} aria-hidden="true" />
                    <span>
                      <strong>Top-Right Quick Menu</strong>
                      <small>
                        {quickDrawerPrefs.mode === "manual"
                          ? `Manual · ${quickDrawerPrefs.manualIds.length}/${MAX_MANUAL_DRAWER_SLOTS} pinned`
                          : "Adaptive · learns in every mode"}
                      </small>
                    </span>
                  </span>
                  {quickDrawerOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>

                {quickDrawerOpen && (
                  <div className="ui-qm-sub-body">
                    <ChipRow label="Top-right quick menu mode">
                      <Chip
                        label="Adaptive"
                        selected={quickDrawerPrefs.mode === "adaptive"}
                        onClick={() => onQuickDrawerPrefs({ ...quickDrawerPrefs, mode: "adaptive" })}
                      />
                      <Chip
                        label="Manual"
                        selected={quickDrawerPrefs.mode === "manual"}
                        onClick={() => onQuickDrawerPrefs({ ...quickDrawerPrefs, mode: "manual" })}
                      />
                    </ChipRow>
                    <p className="ui-qm-hint">
                      {quickDrawerPrefs.mode === "manual"
                        ? `Manual mode is active across every game mode. Reorder or pick up to ${MAX_MANUAL_DRAWER_SLOTS} shortcuts below.`
                        : "Adaptive mode starts with Bulk Select, Quick Menus & Speed, then adapts to your city and clicks."}
                    </p>

                    {quickDrawerPrefs.mode === "manual" && (
                      <>
                        <p className="ui-qm-label">
                          Pinned slots ({quickDrawerPrefs.manualIds.length}/{MAX_MANUAL_DRAWER_SLOTS})
                        </p>
                        <div className="ui-qm-list">
                          {quickDrawerPrefs.manualIds.map((id, idx) => {
                            const meta = drawerMetaById[id];
                            if (!meta) return null;
                            return (
                              <div key={id} className="ui-qm-row">
                                <div className="ui-qm-row-icon">
                                  <DrawerActionIcon id={id} speed={simSpeed} size={14} />
                                </div>
                                <div className="ui-qm-row-text">
                                  <strong>
                                    {idx + 1}. {meta.label}
                                    {meta.modeNote && <span className="ui-qm-badge">{meta.modeNote}</span>}
                                  </strong>
                                  <small>{meta.desc}</small>
                                </div>
                                <div className="ui-qm-row-controls">
                                  <button
                                    type="button"
                                    className="ui-qm-mini-btn"
                                    aria-label={`Move ${meta.label} up`}
                                    title="Move up"
                                    disabled={idx === 0}
                                    onClick={() => onQuickDrawerPrefs(moveManualDrawerAction(quickDrawerPrefs, id, -1))}
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="ui-qm-mini-btn"
                                    aria-label={`Move ${meta.label} down`}
                                    title="Move down"
                                    disabled={idx === quickDrawerPrefs.manualIds.length - 1}
                                    onClick={() => onQuickDrawerPrefs(moveManualDrawerAction(quickDrawerPrefs, id, 1))}
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="ui-qm-mini-btn is-off"
                                    aria-label={`Remove ${meta.label}`}
                                    title="Remove slot"
                                    disabled={quickDrawerPrefs.manualIds.length <= 1}
                                    onClick={() => onQuickDrawerPrefs(toggleManualDrawerAction(quickDrawerPrefs, id))}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <p className="ui-qm-label" style={{ marginTop: 10 }}>
                          Feature &amp; settings catalog
                        </p>
                        {DRAWER_GROUPS.map((grp) => (
                          <div key={grp} className="ui-qm-cat-group">
                            <span className="ui-qm-cat-head">{grp}</span>
                            <div className="ui-qm-pick-grid">
                              {QUICK_DRAWER_CATALOG_META.filter((m) => m.group === grp).map((m) => {
                                const picked = manualSet.has(m.id);
                                const full = !picked && quickDrawerPrefs.manualIds.length >= MAX_MANUAL_DRAWER_SLOTS;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    className={"ui-qm-pick-btn" + (picked ? " is-picked" : "")}
                                    disabled={full || (picked && quickDrawerPrefs.manualIds.length <= 1)}
                                    title={m.desc + (m.modeNote ? ` (${m.modeNote})` : "")}
                                    onClick={() => onQuickDrawerPrefs(toggleManualDrawerAction(quickDrawerPrefs, m.id))}
                                  >
                                    <DrawerActionIcon id={m.id} speed={simSpeed} size={13} />
                                    <span>{m.label}</span>
                                    {picked ? <Check size={11} /> : <Plus size={11} />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        <div className="ui-qm-foot">
                          <Button
                            small
                            variant="quiet"
                            icon={<RotateCcw size={13} />}
                            label="Reset slots"
                            onClick={() =>
                              onQuickDrawerPrefs({
                                ...createDefaultQuickDrawerPrefs(),
                                mode: "manual",
                              })
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Sub-panel 2: Quick Edit */}
              <div className="ui-qm-sub">
                <button
                  type="button"
                  className="ui-qm-sub-head"
                  aria-expanded={quickEditOpen}
                  onClick={() => setQuickEditOpen((v) => !v)}
                >
                  <span className="ui-qm-sub-title">
                    <Compass size={14} aria-hidden="true" />
                    <span>
                      <strong>Quick Edit</strong>
                      <small>
                        Always on · {quickMenuPrefs.quickEdit.orderMode === "adaptive" ? "Adaptive order" : "Fixed order"}
                      </small>
                    </span>
                  </span>
                  {quickEditOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>

                {quickEditOpen && (
                  <div className="ui-qm-sub-body">
                    <ChipRow label="Quick Edit button order">
                      <Chip
                        label="Fixed"
                        selected={quickMenuPrefs.quickEdit.orderMode === "fixed"}
                        onClick={() =>
                          onQuickMenuPrefs({
                            ...quickMenuPrefs,
                            quickEdit: { ...quickMenuPrefs.quickEdit, orderMode: "fixed" },
                          })
                        }
                      />
                      <Chip
                        label="Adapt to clicks"
                        selected={quickMenuPrefs.quickEdit.orderMode === "adaptive"}
                        onClick={() =>
                          onQuickMenuPrefs({
                            ...quickMenuPrefs,
                            quickEdit: { ...quickMenuPrefs.quickEdit, orderMode: "adaptive" },
                          })
                        }
                      />
                    </ChipRow>

                    <div className="ui-qm-list">
                      {quickMenuPrefs.quickEdit.buttonOrder.map((id, idx) => {
                        const meta = buttonMetaById[id];
                        if (!meta) return null;
                        const isCore = CORE_QUICK_EDIT_IDS.has(id);
                        const isHidden = !isCore && hiddenSet.has(id);
                        const clicks = quickMenuPrefs.quickEdit.clickCounts[id] ?? 0;
                        return (
                          <div key={id} className={"ui-qm-row" + (isHidden ? " is-dim" : "")}>
                            <div className="ui-qm-row-text">
                              <strong>
                                {meta.label}
                                {isCore && <span className="ui-qm-badge">Core</span>}
                                {clicks > 0 && <span className="ui-qm-count">{clicks}×</span>}
                              </strong>
                              <small>{meta.desc}</small>
                            </div>
                            <div className="ui-qm-row-controls">
                              {quickMenuPrefs.quickEdit.orderMode === "fixed" && (
                                <>
                                  <button
                                    type="button"
                                    className="ui-qm-mini-btn"
                                    aria-label={`Move ${meta.label} up`}
                                    disabled={idx === 0}
                                    onClick={() => onQuickMenuPrefs(moveQuickEditButton(quickMenuPrefs, id, -1))}
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="ui-qm-mini-btn"
                                    aria-label={`Move ${meta.label} down`}
                                    disabled={idx === quickMenuPrefs.quickEdit.buttonOrder.length - 1}
                                    onClick={() => onQuickMenuPrefs(moveQuickEditButton(quickMenuPrefs, id, 1))}
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                </>
                              )}
                              {!isCore && (
                                <button
                                  type="button"
                                  className={"ui-qm-mini-btn" + (isHidden ? " is-off" : " is-on")}
                                  aria-label={isHidden ? `Show ${meta.label}` : `Hide ${meta.label}`}
                                  title={isHidden ? `Show ${meta.label}` : `Hide ${meta.label}`}
                                  onClick={() => onQuickMenuPrefs(toggleQuickEditButton(quickMenuPrefs, id))}
                                >
                                  {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="ui-qm-foot">
                      <Button
                        small
                        variant="quiet"
                        icon={<RotateCcw size={13} />}
                        label="Reset Quick Edit"
                        onClick={() => {
                          const def = createDefaultQuickMenuPrefs();
                          onQuickMenuPrefs({ ...quickMenuPrefs, quickEdit: def.quickEdit });
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-panel 3: Quick Sculpt spiral customization */}
              <div className="ui-qm-sub">
                <button
                  type="button"
                  className="ui-qm-sub-head"
                  aria-expanded={quickSculptOpen}
                  onClick={() => setQuickSculptOpen((v) => !v)}
                >
                  <span className="ui-qm-sub-title">
                    <Mountain size={14} aria-hidden="true" />
                    <span>
                      <strong>Quick Sculpt Spiral</strong>
                      <small>
                        {qs.tools.length} tools · {qs.voxelRadius * 2 + 1}v ({((qs.voxelRadius * 2 + 1) * VOXEL_PITCH).toFixed(2)}m)
                      </small>
                    </span>
                  </span>
                  {quickSculptOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>

                {quickSculptOpen && (
                  <div className="ui-qm-sub-body">
                    <p className="ui-qm-label">On spiral tool tap</p>
                    <ChipRow label="Quick Sculpt tap behavior">
                      {QUICK_SCULPT_TAP_BEHAVIOR_META.map((b) => (
                        <Chip
                          key={b.id}
                          label={b.label}
                          selected={qs.tapBehavior === b.id}
                          onClick={() =>
                            onQuickMenuPrefs({ ...quickMenuPrefs, quickSculpt: { ...qs, tapBehavior: b.id } })
                          }
                        />
                      ))}
                    </ChipRow>
                    <p className="ui-qm-hint">
                      {QUICK_SCULPT_TAP_BEHAVIOR_META.find((b) => b.id === qs.tapBehavior)?.hint}
                    </p>

                    <p className="ui-qm-label">Spiral order</p>
                    <ChipRow label="Quick Sculpt spiral order">
                      <Chip
                        label="Pinned order"
                        selected={qs.orderMode === "fixed"}
                        onClick={() =>
                          onQuickMenuPrefs({ ...quickMenuPrefs, quickSculpt: { ...qs, orderMode: "fixed" } })
                        }
                      />
                      <Chip
                        label="Adapt to clicks"
                        selected={qs.orderMode === "adaptive"}
                        onClick={() =>
                          onQuickMenuPrefs({ ...quickMenuPrefs, quickSculpt: { ...qs, orderMode: "adaptive" } })
                        }
                      />
                    </ChipRow>

                    <p className="ui-qm-label">
                      Default 0.25m brush ({qs.voxelRadius * 2 + 1} vox · {((qs.voxelRadius * 2 + 1) * VOXEL_PITCH).toFixed(2)}m)
                    </p>
                    <div className="ui-works-presets" role="group" aria-label="Quick Sculpt default brush size">
                      <span className="ui-works-presets-lbl">0.25m vox</span>
                      {SCULPT_SIZE_PRESETS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          aria-pressed={qs.voxelRadius === r}
                          className={"ui-works-preset-btn" + (qs.voxelRadius === r ? " is-active" : "")}
                          onClick={() =>
                            onQuickMenuPrefs({ ...quickMenuPrefs, quickSculpt: { ...qs, voxelRadius: r } })
                          }
                        >
                          {r * 2 + 1}
                        </button>
                      ))}
                    </div>

                    <label className="ui-works-slider" style={{ marginTop: 4 }}>
                      <span className="ui-works-slider-head">
                        <span>Stamp strength</span>
                        <strong className="tabular-nums">{Math.round(qs.strength * 100)}%</strong>
                      </span>
                      <input
                        aria-label="Quick Sculpt stamp strength"
                        className="ui-works-range"
                        type="range"
                        min={0.25}
                        max={2}
                        step={0.25}
                        value={qs.strength}
                        onChange={(e) =>
                          onQuickMenuPrefs({
                            ...quickMenuPrefs,
                            quickSculpt: { ...qs, strength: Number(e.target.value) },
                          })
                        }
                      />
                    </label>

                    <p className="ui-qm-label">Default paint material</p>
                    <div className="ui-works-swatches" role="group" aria-label="Quick Sculpt default material">
                      {SCULPT_MATERIALS.map((sw) => {
                        const on = qs.paintMaterial === sw.id;
                        return (
                          <button
                            key={sw.id}
                            type="button"
                            aria-pressed={on}
                            className={"ui-works-swatch" + (on ? " is-active" : "")}
                            onClick={() =>
                              onQuickMenuPrefs({ ...quickMenuPrefs, quickSculpt: { ...qs, paintMaterial: sw.id } })
                            }
                          >
                            <i style={{ background: sw.hex }} aria-hidden="true" />
                            <span>{sw.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <p className="ui-qm-label" style={{ marginTop: 6 }}>
                      Spiral slots ({qs.tools.length}/{MAX_QUICK_SCULPT_SLOTS})
                    </p>
                    <div className="ui-qm-list">
                      {qs.tools.map((tid, idx) => {
                        const meta = sculptMetaById[tid];
                        if (!meta) return null;
                        return (
                          <div key={tid} className="ui-qm-row">
                            <div className="ui-qm-row-icon">
                              <SculptToolIcon id={tid} size={14} />
                            </div>
                            <div className="ui-qm-row-text">
                              <strong>
                                {idx + 1}. {meta.short}
                              </strong>
                              <small>{meta.label}</small>
                            </div>
                            <div className="ui-qm-row-controls">
                              {qs.orderMode === "fixed" && (
                                <>
                                  <button
                                    type="button"
                                    className="ui-qm-mini-btn"
                                    aria-label={`Move ${meta.short} up`}
                                    disabled={idx === 0}
                                    onClick={() => onQuickMenuPrefs(moveQuickSculptTool(quickMenuPrefs, tid, -1))}
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="ui-qm-mini-btn"
                                    aria-label={`Move ${meta.short} down`}
                                    disabled={idx === qs.tools.length - 1}
                                    onClick={() => onQuickMenuPrefs(moveQuickSculptTool(quickMenuPrefs, tid, 1))}
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className="ui-qm-mini-btn"
                                aria-label={`Remove ${meta.short}`}
                                disabled={qs.tools.length <= MIN_QUICK_SCULPT_SLOTS}
                                onClick={() => onQuickMenuPrefs(toggleQuickSculptTool(quickMenuPrefs, tid))}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="ui-qm-label" style={{ marginTop: 6 }}>
                      Add / remove tools
                    </p>
                    <div className="ui-qm-catalog-chips">
                      {QUICK_SCULPT_TOOL_META.map((t) => {
                        const picked = qsSet.has(t.id);
                        const full = !picked && qs.tools.length >= MAX_QUICK_SCULPT_SLOTS;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className={"ui-qm-cat-chip" + (picked ? " is-picked" : "")}
                            disabled={full || (picked && qs.tools.length <= MIN_QUICK_SCULPT_SLOTS)}
                            title={t.label}
                            onClick={() => onQuickMenuPrefs(toggleQuickSculptTool(quickMenuPrefs, t.id))}
                          >
                            <SculptToolIcon id={t.id} size={12} />
                            <span>{t.short}</span>
                            {picked ? <Check size={11} /> : <Plus size={11} />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="ui-qm-foot">
                      <Button
                        small
                        variant="quiet"
                        icon={<RotateCcw size={13} />}
                        label="Reset Quick Sculpt"
                        onClick={() =>
                          onQuickMenuPrefs({ ...quickMenuPrefs, quickSculpt: createDefaultQuickSculptPrefs() })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-panel 4: Build Menus customization */}
              <div className="ui-qm-sub">
                <button
                  type="button"
                  className="ui-qm-sub-head"
                  aria-expanded={buildCustomOpen}
                  onClick={() => setBuildCustomOpen((v) => !v)}
                >
                  <span className="ui-qm-sub-title">
                    <Sparkles size={14} aria-hidden="true" />
                    <span>
                      <strong>Customize Build Menus</strong>
                      <small>Smart Build · Quick Build · Exact Build</small>
                    </span>
                  </span>
                  {buildCustomOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>

                {buildCustomOpen && (
                  <div className="ui-qm-sub-body">
                    <p className="ui-qm-label">Adaptive focus</p>
                    <ChipRow label="Adaptive build focus">
                      {SMART_FOCUS_META.map((f) => (
                        <Chip
                          key={f.id}
                          label={f.label}
                          selected={quickMenuPrefs.smartFocus === f.id}
                          onClick={() => onQuickMenuPrefs({ ...quickMenuPrefs, smartFocus: f.id })}
                        />
                      ))}
                    </ChipRow>

                    <p className="ui-qm-label">After placing</p>
                    <ChipRow label="After fast build placement">
                      <Chip
                        label="Open Quick Edit"
                        selected={quickMenuPrefs.openQuickEditAfterPlace}
                        onClick={() => onQuickMenuPrefs({ ...quickMenuPrefs, openQuickEditAfterPlace: true })}
                      />
                      <Chip
                        label="Stay on map"
                        selected={!quickMenuPrefs.openQuickEditAfterPlace}
                        onClick={() => onQuickMenuPrefs({ ...quickMenuPrefs, openQuickEditAfterPlace: false })}
                      />
                    </ChipRow>

                    {onResetBuildHabits && (
                      <div className="ui-qm-foot">
                        <Button
                          small
                          variant="quiet"
                          icon={<RotateCcw size={13} />}
                          label={learnedBuildsCount > 0 ? `Reset habits (${learnedBuildsCount})` : "Habits clean"}
                          disabled={learnedBuildsCount === 0}
                          onClick={onResetBuildHabits}
                        />
                      </div>
                    )}

                    <p className="ui-qm-label" style={{ marginTop: 8 }}>
                      Exact Build branch order
                    </p>
                    <div className="ui-qm-list">
                      {orderedExactParents.map((parent, idx) => (
                        <div key={parent.id} className="ui-qm-row">
                          <div className="ui-qm-row-icon">
                            <DecisionParentFavicon parentId={parent.id} size={18} />
                          </div>
                          <div className="ui-qm-row-text">
                            <strong>
                              {idx + 1}. {parent.label}
                            </strong>
                            <small>{parent.shortDesc}</small>
                          </div>
                          <div className="ui-qm-row-controls">
                            <button
                              type="button"
                              className="ui-qm-mini-btn"
                              aria-label={`Move ${parent.label} up`}
                              disabled={idx === 0}
                              onClick={() => onQuickMenuPrefs(moveExactParent(quickMenuPrefs, parent.id, -1))}
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              className="ui-qm-mini-btn"
                              aria-label={`Move ${parent.label} down`}
                              disabled={idx === orderedExactParents.length - 1}
                              onClick={() => onQuickMenuPrefs(moveExactParent(quickMenuPrefs, parent.id, 1))}
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="ui-qm-foot">
                      <Button
                        small
                        variant="quiet"
                        icon={<RotateCcw size={13} />}
                        label="Reset order"
                        onClick={() => {
                          const def = createDefaultQuickMenuPrefs();
                          onQuickMenuPrefs({ ...quickMenuPrefs, exactParentOrder: def.exactParentOrder });
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Interactive Tutorials */}
        {onStartTutorial && (
          <div className="ui-qm-accordion">
            <button
              type="button"
              className="ui-qm-toggle"
              aria-expanded={tutorialsOpen}
              onClick={() => setTutorialsOpen((v) => !v)}
            >
              <span className="ui-qm-toggle-title">
                <GraduationCap size={15} aria-hidden="true" />
                <strong>Tutorials</strong>
                {tutorialMode && <span className="ui-qm-pill">Active</span>}
              </span>
              {tutorialsOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
            {tutorialsOpen && (
              <div className="ui-qm-body">
                {tutorialMode ? (
                  <Button
                    small
                    block
                    variant="danger"
                    icon={<X size={14} />}
                    label="Exit active tutorial"
                    onClick={onStopTutorial}
                  />
                ) : (
                  <Button
                    small
                    block
                    variant="primary"
                    icon={<GraduationCap size={15} />}
                    label={"Start " + modeName + " tutorial"}
                    onClick={() => onStartTutorial(state.mode)}
                  />
                )}
                <div style={{ marginTop: 8 }}>
                  <ChipRow label="Launch tutorial for a mode">
                    {MODES.map((m) => (
                      <Chip
                        key={m.id}
                        label={m.title}
                        selected={tutorialMode === m.id}
                        onClick={() => onStartTutorial(m.id)}
                      />
                    ))}
                  </ChipRow>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Placement & Tap Controls */}
        <div className="ui-qm-accordion">
          <button
            type="button"
            className="ui-qm-toggle"
            aria-expanded={controlsOpen}
            onClick={() => setControlsOpen((v) => !v)}
          >
            <span className="ui-qm-toggle-title">
              <Settings size={15} aria-hidden="true" />
              <strong>Brush &amp; Tap Filters</strong>
            </span>
            {controlsOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          {controlsOpen && (
            <div className="ui-qm-body">
              <p className="ui-qm-label">After placing</p>
              <ChipRow label="Placement behaviour">
                {BEHAVIORS.map((b) => (
                  <Chip key={b.id} label={b.label} selected={cursorBehavior === b.id} onClick={() => onCursorBehavior(b.id)} />
                ))}
              </ChipRow>
              <p className="ui-qm-hint">{BEHAVIORS.find((b) => b.id === cursorBehavior)?.hint}</p>
              <p className="ui-qm-label">Tapping the map selects</p>
              <ChipRow label="Tap filter">
                {FILTERS.map((f) => (
                  <Chip key={f.id} label={f.label} selected={selectionFilter === f.id} onClick={() => onSelectionFilter(f.id)} />
                ))}
              </ChipRow>
            </div>
          )}
        </div>

        {/* Collapsible Keyboard Shortcuts */}
        <div className="ui-qm-accordion">
          <button
            type="button"
            className="ui-qm-toggle"
            aria-expanded={keysOpen}
            onClick={() => setKeysOpen((v) => !v)}
          >
            <span className="ui-qm-toggle-title">
              <Keyboard size={15} aria-hidden="true" />
              <strong>Keyboard Shortcuts</strong>
            </span>
            {keysOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          {keysOpen && (
            <div className="ui-qm-body">
              <div className="ui-keys" style={{ marginTop: 6 }}>
                {KEYS.map(([k, v]) => (
                  <React.Fragment key={k}>
                    <kbd>{k}</kbd>
                    <span>{v}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
