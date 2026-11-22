import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Compass,
  Eye,
  EyeOff,
  FastForward,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Keyboard,
  ListChecks,
  Map,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Sliders,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { type GameMode, STAGES } from "../game/catalog";
import { MAX_SAVE_SLOTS } from "../game/saveSlots";
import type { QuickBuildMode } from "../game/quickBuildTree";
import {
  CORE_QUICK_EDIT_IDS,
  QUICK_BUILD_MODE_META,
  QUICK_EDIT_BUTTON_META,
  SMART_FOCUS_META,
  createDefaultQuickMenuPrefs,
  getOrderedDecisionTreeParents,
  moveExactParent,
  moveQuickEditButton,
  toggleQuickEditButton,
  type QuickEditActionId,
  type QuickMenuPrefs,
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
import { DecisionParentFavicon } from "./CategoryFavicon";
import { DrawerActionIcon } from "./Hud";
import { PWAInstallRow } from "./PWAInstallRow";
import { BottomSheet, Button, Chip, ChipRow, type SheetHeight } from "./ui";

export type CursorBehavior = "auto" | "select" | "place";
export type MorePage = "view" | "mode" | "god" | "settings" | null;

const MODES: { id: GameMode; title: string; desc: string }[] = [
  { id: "god", title: "God", desc: "Sandbox: free building, terrain sculpting, weather & clock." },
  { id: "real", title: "Real", desc: "Grow Stage 1 → 20 on a live treasury and balanced services." },
  { id: "survival", title: "Survival", desc: "Repairs, reserves & defense; shortages can collapse the city." },
  { id: "idle", title: "Idle", desc: "Autonomous algorithmic planner grows a Stage 1–20 island." },
  { id: "manager", title: "Manager", desc: "Executive Yes/No decisions while customizing architectural styles." },
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
  ["B / L / C / T / M", "Build, Layers, City, Transit, More"],
  ["R", "Rotate"],
  ["Del", "Demolish selection"],
  ["Space + Drag", "Pan camera anytime"],
  ["Right-Drag / Q·E", "Orbit camera"],
  ["Ctrl+Z", "Undo last edit"],
  ["Esc", "Step back / close"],
  ["+ / −", "Zoom"],
];
const DRAWER_GROUPS: QuickDrawerCatalogGroup[] = ["Quick Menus", "City & Map", "Tools & Studio", "Settings"];
const TITLES: Record<Exclude<MorePage, null>, string> = {
  view: "View",
  mode: "Game Mode",
  god: "God Tools",
  settings: "Settings",
};

export function MoreSheet({
  state,
  page,
  onPage,
  height,
  onHeight,
  onClose,
  savedCount,
  onSaves,
  onExamples,
  onOpenHandbook,
  onOpenPixBuilder,
  onChangeMode,
  onCopyIsland,
  onReset,
  view,
  godTools,
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
  learnedBuildsCount = 0,
  onResetBuildHabits,
  simSpeed = 1,
  onSimSpeed,
  onUndo,
  tutorialMode,
  onStartTutorial,
  onStopTutorial,
}: {
  state: GameState;
  page: MorePage;
  onPage: (p: MorePage) => void;
  height: SheetHeight;
  onHeight: (h: SheetHeight) => void;
  onClose: () => void;
  savedCount: number;
  onSaves: () => void;
  onExamples: () => void;
  onOpenHandbook: () => void;
  onOpenPixBuilder?: () => void;
  onOpenFieldGuide?: () => void;
  onChangeMode: (m: GameMode) => void;
  onCopyIsland: () => void;
  onReset: () => void;
  onUndo: () => void;
  view: React.ReactNode;
  godTools: React.ReactNode;
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
  /** Incremented whenever user clicks the Customize icon directly from the top-right drawer. */
  focusQuickDrawerConfig?: number;
  learnedBuildsCount?: number;
  onResetBuildHabits?: () => void;
  simSpeed?: number;
  onSimSpeed?: (v: number) => void;
  tutorialMode?: GameMode | null;
  onStartTutorial?: (m: GameMode) => void;
  onStopTutorial?: () => void;
}) {
  const [quickMenusOpen, setQuickMenusOpen] = useState(true);
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
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

  const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, state.currentStage - 1))];
  const modeName = MODES.find((m) => m.id === state.mode)?.title ?? state.mode;
  const activeFastMeta = QUICK_BUILD_MODE_META.find((m) => m.id === quickBuildMode) ?? QUICK_BUILD_MODE_META[0];
  const buttonMetaById = Object.fromEntries(QUICK_EDIT_BUTTON_META.map((b) => [b.id, b])) as Record<
    QuickEditActionId,
    (typeof QUICK_EDIT_BUTTON_META)[number]
  >;
  const drawerMetaById = Object.fromEntries(QUICK_DRAWER_CATALOG_META.map((m) => [m.id, m]));
  const orderedExactParents = getOrderedDecisionTreeParents(quickMenuPrefs.exactParentOrder);
  const hiddenSet = new Set(quickMenuPrefs.quickEdit.hiddenButtons);
  const manualSet = new Set(quickDrawerPrefs.manualIds);

  return (
    <BottomSheet
      id="sheet-more"
      title={page ? TITLES[page] : "More"}
      height={height}
      onHeightChange={onHeight}
      onClose={onClose}
      closeLabel="Close More"
      subtitle={page ? undefined : modeName + (state.mode === "god" ? "" : " · Stg " + stage.stage)}
      headerLead={
        page ? (
          <button
            type="button"
            className="ui-sheet-icon-btn"
            aria-label="Back to More"
            title="Back to More"
            onClick={() => onPage(null)}
          >
            <ChevronLeft size={16} />
          </button>
        ) : undefined
      }
    >
      {!page && (
        <div className="ui-more-wrap">
          <div className="ui-more-grid" role="group" aria-label="More actions">
            {onOpenPixBuilder && (
              <button type="button" className="ui-more-tile is-accent" onClick={onOpenPixBuilder} title="PixBuilder Studio & Advisor">
                <Sparkles size={18} aria-hidden="true" />
                <span>Pix</span>
              </button>
            )}
            <button type="button" className="ui-more-tile" onClick={() => onPage("view")} title="Camera, weather, time & defense">
              <Cloud size={18} aria-hidden="true" />
              <span>View</span>
            </button>
            <button type="button" className="ui-more-tile" onClick={onSaves} title={`${savedCount} of ${MAX_SAVE_SLOTS} save slots used`}>
              <Save size={18} aria-hidden="true" />
              <span>Saves</span>
              {savedCount > 0 && <em className="ui-more-badge">{savedCount}</em>}
            </button>
            <button type="button" className="ui-more-tile" onClick={() => onPage("mode")} title={`Current: ${modeName} mode`}>
              <Gamepad2 size={18} aria-hidden="true" />
              <span>{modeName}</span>
            </button>
            <button type="button" className="ui-more-tile" onClick={onExamples} title="Explore finished example islands">
              <Map size={18} aria-hidden="true" />
              <span>Islands</span>
            </button>
            <button type="button" className="ui-more-tile" onClick={onOpenHandbook} title="Compact Playbook & 3D Atlas">
              <BookOpen size={18} aria-hidden="true" />
              <span>Handbook</span>
            </button>
            <button type="button" className="ui-more-tile" onClick={() => onPage("settings")} title={`Settings & Quick Menus (${activeFastMeta.name})`}>
              <Settings size={18} aria-hidden="true" />
              <span>Settings</span>
            </button>
            {state.mode === "god" ? (
              <button type="button" className="ui-more-tile" onClick={() => onPage("god")} title="God tools: clock, snapshots & crime">
                <FlaskConical size={18} aria-hidden="true" />
                <span>God Tools</span>
              </button>
            ) : (
              <button type="button" className="ui-more-tile is-danger" onClick={onReset} title="Reset this island">
                <RotateCcw size={18} aria-hidden="true" />
                <span>Reset</span>
              </button>
            )}
          </div>
          {state.mode === "god" && (
            <div className="ui-more-foot">
              <PWAInstallRow />
              <button type="button" className="ui-more-mini-danger" onClick={onReset} title="Reset this island">
                <RotateCcw size={13} aria-hidden="true" />
                <span>Reset island</span>
              </button>
            </div>
          )}
          {state.mode !== "god" && <PWAInstallRow />}
        </div>
      )}

      {page === "view" && (
        <>
          {state.mode !== "god" && (
            <p className="ui-muted" style={{ marginBottom: 6 }}>
              Weather &amp; clock run automatically outside God mode.
            </p>
          )}
          {view}
        </>
      )}

      {page === "god" && godTools}

      {page === "mode" && (
        <div className="ui-modes">
          {MODES.map((m) => (
            <div key={m.id} className={"ui-mode-card" + (state.mode === m.id ? " is-active" : "")}>
              <div className="ui-mode-row">
                <button
                  type="button"
                  className="ui-mode"
                  aria-pressed={state.mode === m.id}
                  onClick={() => onChangeMode(m.id)}
                >
                  <b>
                    {m.title}
                    {state.mode === m.id ? " · active" : ""}
                  </b>
                  <small>{m.desc}</small>
                </button>
                {onStartTutorial && (
                  <button
                    type="button"
                    className={"ui-row-action-icon" + (tutorialMode === m.id ? " is-active" : "")}
                    aria-label={tutorialMode === m.id ? "Restart " + m.title + " tutorial" : "Play " + m.title + " tutorial"}
                    title={tutorialMode === m.id ? "Restart tutorial" : "Play tutorial"}
                    onClick={() => onStartTutorial(m.id)}
                  >
                    <GraduationCap size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {state.mode !== "god" && (
            <Button
              small
              block
              label="Copy into God mode"
              icon={<FlaskConical size={15} />}
              onClick={onCopyIsland}
            />
          )}
        </div>
      )}

      {page === "settings" && (
        <div className="ui-settings-stack">
          {/* Compact 1-row Speed & Undo bar */}
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

                {/* Sub-panel 2: Quick Edit (always on, customizable buttons & adaptive order) */}
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

                {/* Sub-panel 3: Build Menus customization */}
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
      )}
    </BottomSheet>
  );
}
