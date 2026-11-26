import { canDecorateForChristmas, christmasActionLabel, toggleChristmasDecorations } from "./game/christmasDecorations";
import { strokeRoadAxis } from "./game/roadCorridors";
import { downloadWorld, importWorldIntoSlot, readLinkedWorld, type TransferWorld } from "./game/worldTransfer";
import { autosync, scheduleAccountSync } from "./game/accountSync";
import { readPlayerItem, writePlayerItem, deviceIssue, onDeviceChange, flushDevice } from "./game/deviceSaves";
import { RailOperations } from "./components/RailOperations";
import { rememberBuildingEdit, undoBuildingEdit } from "./game/constructionHistory";
import { dispatchFire } from "./game/projectOperations";
import { dispatchVessel, previewWaterPassage } from "./game/mobility";
import { buildingCharges, constructionCost, transfer } from "./game/cityEconomy";
import "./islandDesk.css";
import { Connections, GodControls } from "./components/IslandControls";
import { InfrastructurePanel, defaultSculptTool, worksToolLabel } from "./components/InfrastructurePanel";
import { CityEconomyPanel } from "./components/CityEconomyPanel";
import { applyInfrastructureStroke, applyLandformPlacement, planInfrastructureStroke, undoInfrastructure, type GridPoint, type InfrastructureTool } from "./game/terrain";
import { VOXELS_PER_TILE, VOXEL_PITCH, effectiveVoxelRadius, isVoxelSculptTool } from "./game/voxelTerrain";
import { visitPracticeRailway } from "./game/practiceRailway";
import { ExampleIslands, WorldGuide } from "./components/ExampleIslands";
import { EXAMPLE_WORLDS, createExampleWorld, type ExampleMode, type ExampleWorldId } from "./game/exampleWorlds";
import { loadModeState, persistMode, readExampleRoute, resumeIsland, lastActiveSlot, islandSaveKey } from "./game/activeIsland";
import { createCanalDistrict } from "./game/canalDistrict";
import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { AlertOctagon, ArrowDown, ArrowUp, Check, ChevronLeft, Layers, Minus, Move, Plus, RotateCcw, RotateCw, ShieldAlert, Trash2, Undo2, Waves, X } from "lucide-react";
import { settleStreetFacing } from "./game/streetFacing";
import { GameDialog } from "./components/GameDialog";
import { SaveSlotsModal } from "./components/SaveSlotsModal";
import { ViewEnvPanel, type ViewEnvTab } from "./components/ViewEnvPanel";
import { BottomNav, type NavSheet } from "./components/BottomNav";
import { AlertPill, Hud, type HudStat } from "./components/Hud";
import { BuildSheet, type BuildCategory } from "./components/BuildSheet";
import { PlacementBar } from "./components/PlacementBar";
import { QuickBuildRing } from "./components/QuickBuildRing";
import { SelectionRing, type PendingConfirmAction } from "./components/SelectionRing";
import { EraThumbnailContext } from "./components/ElementFavicon";
import { islandProductAvailable, resumeAccessibleIsland } from "./game/islandLicenses";
import { IslandShop, useStoreAccess } from "./components/IslandShop";
import { productForMode, productForEra } from "./game/storeCatalog.mjs";
import { EraPresentation, PeriodPicker } from "./components/PeriodPicker";
import { eraStageTreatment } from "./game/eraStage";
import { eraElementName, normalizeEra, type EraKey } from "./game/eraStyles";
import { loadEraArt } from "./game/eraArtLoader";
import { GuideModal, type GuideModalState } from "./components/GuideModal";
import { InspectorSheet } from "./components/InspectorSheet";
import { LayersSheet, LAYERS } from "./components/LayersSheet";
import { CitySheet, type CityTab } from "./components/CitySheet";
import { SettingsSheet } from "./components/SettingsSheet";
import { MoreSheet, type CursorBehavior, type MorePage } from "./components/MoreSheet";
import { IdleModeBanner, ManagerDecisionCard } from "./components/ManagerDecisionCard";
import { IslandMapFallback } from "./components/IslandMapFallback";
import { PixBuilderModal, type PixTab } from "./components/PixBuilderModal";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { AnimatedSheetHost, BottomSheet, Button, ConfirmDialog, IconButton, Toasts, type SheetHeight, type UiToast } from "./components/ui";
import { alertIssues, type IssueFix } from "./game/cityIssues";
import {
  analyzeTileContext,
  createEmptyBuildHabits,
  loadBuildHabits,
  recordBuildHabit,
  recommendInstantQuickElements,
  recommendQuickCategories,
  recommendQuickElements,
  saveBuildHabits,
  type PlayerBuildHabits,
  type QuickBuildCategoryId,
} from "./game/adaptiveQuickBuild";
import {
  getDecisionTreeLeafElements,
  loadQuickBuildMode,
  saveQuickBuildMode,
  type DecisionTreeParentId,
  type QuickBuildMode,
} from "./game/quickBuildTree";
import {
  loadQuickMenuPrefs,
  recordQuickEditClick,
  recordQuickSculptUse,
  saveQuickMenuPrefs,
  type QuickMenuPrefs,
  type QuickSculptToolId,
  type SmartBuildFocus,
} from "./game/quickMenuPrefs";
import {
  createEmptyQuickDrawerHabits,
  loadQuickDrawerHabits,
  loadQuickDrawerPrefs,
  recommendQuickDrawerActions,
  recordQuickDrawerAction,
  saveQuickDrawerHabits,
  saveQuickDrawerPrefs,
  type QuickDrawerActionId,
  type QuickDrawerHabits,
  type QuickDrawerItem,
  type QuickDrawerPrefs,
} from "./game/adaptiveQuickDrawer";
import {
  type AutoCivProfile,
  type AutoStepOutcome,
  type ManagerChoice,
  type ManagerDecision,
  applyManagerChoice,
  createAutoCivProfile,
  generateManagerDecision,
  runAutoCivStep,
} from "./game/autoCivilization";
import { hydrateCustomElements } from "./game/customElements";
import { applyPixWorldPlan, type PixWorldApplyResult, type PixWorldPlan } from "./game/pixWorldActions";
import { MODE_TUTORIAL_LABELS, TUTORIAL_FLOWS, type TutorialEventKind } from "./game/tutorialFlows";
import {
  type CivElementDef,
  ELEMENT_BY_ID,
  type GameMode,
  STAGES,
  getMaxElementLevel,
  getStandardFootprintForLevel,
} from "./game/catalog";
import {
  type CivilizationSaveSlot,
  addCivilizationSlot,
  cloneGameStateSnapshot,
  deleteCivilizationSlot,
  loadSaveSlots,
  renameCivilizationSlot,
  persistNamedIsland,
} from "./game/saveSlots";
import {
  type GameState,
  type HeatmapKind,
  type PlacedElement,
  type SelectionFilter,
  type WeatherKind,
  checkPlacementValid,
  planConstruction,
  removePlacedElements,
  relocatePlacedElement,
  planRelocation,
  createInitialGameState,
  isNightTime,
  isUnconnectedBuilding,
  launchIslandAttack,
  maintainAllElements,
  maintainElement,
  maintenanceStatus,
  makeElementId,
  pushToast,
  randomVariant,
  recomputeConnectivityAndMetrics,
  resizeCrossing,resizeElementForLevel,
  stepSimulation,
  triggerCrimeIncident,
  upgradeElementDirect,
  upgradeGroup,
  groupMoveRestriction,
  planGroupRelocation,
  relocateGroup,
} from "./game/simulation";
import {
  type BuildBrush,
  type BulkSelectFilter,
  type CameraMode,
  type PendingNetworkStroke,
  type SelectionRingProjection,
  PixelWorldRenderer,
} from "./game/worldRenderer";

/** Outside God mode the sky runs on its own, so a save made with a locked clock or weather is unlocked on load. */
function unlockSky(state: GameState) {
  if (state.mode !== "god") { state.timeLocked = false; state.weatherLocked = false; }
  return state;
}

/** Inherit adjacent matching road/rail/canal variant so contiguous placed strips look cohesive rather than patchwork. */
function pickAdjacentNetworkVariant(elements: PlacedElement[], gx: number, gz: number, def: CivElementDef): number {
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dz] of dirs) {
    const nx = gx + dx;
    const nz = gz + dz;
    const neighbor = elements.find((el) => {
      if (nx < el.gx || nx >= el.gx + el.spanX || nz < el.gz || nz >= el.gz + el.spanZ) return false;
      const nDef = ELEMENT_BY_ID[el.defId];
      if (!nDef?.isNetwork) return false;
      return (
        nDef.id === def.id ||
        Boolean(def.isRoadNetwork && nDef.isRoadNetwork) ||
        Boolean(def.isRailNetwork && nDef.isRailNetwork)
      );
    });
    if (neighbor) return neighbor.variant;
  }
  return 0;
}

const DEFAULT_HEIGHT: Record<NavSheet, SheetHeight> = {build: "peek", layers: "peek", city: "peek", sculpt: "peek", more: "peek"};
const idleBrush = (b: BuildBrush): BuildBrush => ({...b, kind: "none", defId: undefined, movingElementId: undefined, movingGroupIds: undefined, groupDestination: undefined});

export const App: React.FC = () => {
  useStoreAccess();
  const [shop,setShop]=useState<string|null>(()=>new URLSearchParams(location.search).has("purchase")?"":null);
  const gate=(product:string|undefined)=>{if(islandProductAvailable(product))return true;setShop(product??"");return false;};
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PixelWorldRenderer | null>(null);

  const [initialIsland]=useState(()=>resumeAccessibleIsland(location.hash));
  const [gameState, setGameState] = useState<GameState>(() => unlockSky(initialIsland.city));
  const stateRef = useRef<GameState>(gameState);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(() => initialIsland.slot);
  const activeSave = useRef<{ index: number; name: string } | null>(null);
  if (activeSlotIndex !== null && activeSave.current === null) {
    const slot = loadSaveSlots()[activeSlotIndex];
    if (slot) activeSave.current = { index: activeSlotIndex, name: slot.name };
  }
  const useNamedIsland = (index: number, name: string) => {
    activeSave.current = { index, name };
    setActiveSlotIndex(index);
  };
  const leaveNamedIsland = () => {
    activeSave.current = null;
    setActiveSlotIndex(null);
  };
  const [examplesOpen,setExamplesOpen] = useState(false);
  const [railSite,setRailSite] = useState<string>();
  const [saveError,setSaveError]=useState(false);
  const [slotError,setSlotError]=useState("");
  const [deviceNotice,setDeviceNotice]=useState(deviceIssue);
  useEffect(()=>onDeviceChange(()=>setDeviceNotice(deviceIssue())),[]);
  const saveModeState = useCallback((state: GameState) => {
    const ok = persistMode(state);
    setSaveError(!ok);
    if (ok) scheduleAccountSync();
    return ok;
  }, []);
  const captureView = useCallback((state: GameState) => {
    const view = rendererRef.current?.getCameraView();
    if (view) state.cameraView = view;
  }, []);
  const saveActiveMode = useCallback((state: GameState) => {
    captureView(state);
    const named = activeSave.current;
    if (!named) return saveModeState(state);
    try {
      persistNamedIsland(named.index, named.name, state);
      setSaveError(false);
      scheduleAccountSync();
      return true;
    } catch {
      setSaveError(true);
      return false;
    }
  }, [captureView, saveModeState]);

  useEffect(() => {
    const route = new URLSearchParams(location.hash.slice(1));
    if (!gameState.exampleWorldId && !route.has("world")) return;
    if (gameState.exampleWorldId && activeSlotIndex === null) route.set("world", gameState.exampleWorldId);
    else route.delete("world");
    if (gameState.exampleWorldId && activeSlotIndex === null && gameState.mode === "real") route.set("mode", "real");
    else route.delete("mode");
    route.delete("era"); // Era tour links apply once; subsequent saves own the choice.
    route.delete("view"); // A tour link sets the initial camera once. Refresh resumes the player's view.
    history.replaceState(null, "", "#" + route.toString());
  }, [gameState.exampleWorldId, gameState.mode, activeSlotIndex]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdsRef = useRef<string[]>(selectedIds);
  selectedIdsRef.current = selectedIds;

  const [brush, setBrush] = useState<BuildBrush>({kind: "none", level: 1, variantMode: -1, rotation: 0});
  const brushRef = useRef<BuildBrush>(brush);
  brushRef.current = brush;

  const simSpeed=gameState.playSpeed??1;
  const simSpeedRef = useRef<number>(simSpeed);
  simSpeedRef.current = simSpeed;

  // One sheet at a time (plus the contextual inspector for a selection).
  const [sheet,setSheetState]=useState<NavSheet|null>(null);
  const sheetRef=useRef<NavSheet|null>(null);sheetRef.current=sheet;
  const [sheetHeight,setSheetHeight]=useState<SheetHeight>("peek");
  const [inspectorHeight,setInspectorHeight]=useState<SheetHeight>("peek");
  const [cityTab,setCityTab]=useState<CityTab>("issues");
  const [morePage,setMorePage]=useState<MorePage>(null);
  const [previewEra, setPreviewEra] = useState<EraKey | null>(null);
  const [readyEra, setReadyEra] = useState<EraKey>("original");
  const [eraError, setEraError] = useState("");
  const storedEra = normalizeEra(gameState.appearanceEra);
  const savedEra=gameState.exampleWorldId || islandProductAvailable(productForEra(storedEra)) ? storedEra : "original";
  const isPreviewing = sheet === "more" && morePage === "view";
  const requestedEra = isPreviewing ? previewEra ?? savedEra : savedEra;
  const displayedEra = requestedEra === readyEra ? readyEra : "original";
  useEffect(() => {
    if (!isPreviewing) setPreviewEra(null);
  }, [isPreviewing]);
  useEffect(() => {
    let current = true;
    setEraError("");
    void loadEraArt(requestedEra).then(() => {
      if (current) setReadyEra(requestedEra);
    }).catch(() => {
      if (current) setEraError("This artwork could not be opened. Reconnect and select the period again.");
    });
    return () => { current = false; };
  }, [requestedEra]);
  const displayedEraRef = useRef(displayedEra);
  displayedEraRef.current = displayedEra;
  const displayName = useCallback((id: string) => eraElementName(id, stateRef.current.showOriginalNames ? "original" : displayedEraRef.current), []);
  useEffect(() => { rendererRef.current?.setAppearanceEra(displayedEra); }, [displayedEra]);
  const [buildCat,setBuildCat]=useState<BuildCategory>("suggested");
  const buildCatRef=useRef(buildCat);buildCatRef.current=buildCat;
  const [buildQuery,setBuildQuery]=useState("");
  const [buildFix,setBuildFix]=useState<IssueFix>();
  const [uiToasts,setUiToasts]=useState<UiToast[]>([]);
  const [inspectorDetailOpen, setInspectorDetailOpen] = useState(false);
  const [deletedAnchor, setDeletedAnchor] = useState<{
    gx: number;
    gz: number;
    spanX: number;
    spanZ: number;
    baseY?: number;
    topY?: number;
    name: string;
    restoredId: string;
  } | null>(null);
  const deletedAnchorRef = useRef(deletedAnchor);
  deletedAnchorRef.current = deletedAnchor;
  const [quickBuild, setQuickBuild] = useState<{
    gx: number;
    gz: number;
    category: QuickBuildCategoryId | null;
    treeParentId: DecisionTreeParentId | null;
    treeSubId: string | null;
  } | null>(null);
  const quickBuildRef = useRef(quickBuild);
  quickBuildRef.current = quickBuild;
  const [quickBuildMode, setQuickBuildMode] = useState<QuickBuildMode>(() => loadQuickBuildMode());
  const quickBuildModeRef = useRef<QuickBuildMode>(quickBuildMode);
  quickBuildModeRef.current = quickBuildMode;
  const handleChangeQuickBuildMode = useCallback((mode: QuickBuildMode) => {
    setQuickBuildMode(mode);
    quickBuildModeRef.current = mode;
    saveQuickBuildMode(mode);
    setQuickBuild(null);
  }, []);
  const [quickMenuPrefs, setQuickMenuPrefs] = useState<QuickMenuPrefs>(() => loadQuickMenuPrefs());
  const quickMenuPrefsRef = useRef<QuickMenuPrefs>(quickMenuPrefs);
  quickMenuPrefsRef.current = quickMenuPrefs;
  const handleChangeQuickMenuPrefs = useCallback((next: QuickMenuPrefs) => {
    setQuickMenuPrefs(next);
    quickMenuPrefsRef.current = next;
    saveQuickMenuPrefs(next);
  }, []);
  const handleTrackQuickEditAction = useCallback((actionId: string) => {
    setQuickMenuPrefs((prev) => {
      const next = recordQuickEditClick(prev, actionId);
      quickMenuPrefsRef.current = next;
      saveQuickMenuPrefs(next);
      return next;
    });
  }, []);
  const [buildHabits, setBuildHabits] = useState<PlayerBuildHabits>(() => loadBuildHabits());
  const buildHabitsRef = useRef<PlayerBuildHabits>(buildHabits);
  buildHabitsRef.current = buildHabits;
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const quickDrawerOpenRef = useRef(false);
  quickDrawerOpenRef.current = quickDrawerOpen;
  const [quickDrawerHabits, setQuickDrawerHabits] = useState<QuickDrawerHabits>(() => loadQuickDrawerHabits());
  const quickDrawerHabitsRef = useRef<QuickDrawerHabits>(quickDrawerHabits);
  quickDrawerHabitsRef.current = quickDrawerHabits;
  const [quickDrawerPrefs, setQuickDrawerPrefs] = useState<QuickDrawerPrefs>(() => loadQuickDrawerPrefs());
  const quickDrawerPrefsRef = useRef<QuickDrawerPrefs>(quickDrawerPrefs);
  quickDrawerPrefsRef.current = quickDrawerPrefs;
  const handleChangeQuickDrawerPrefs = useCallback((next: QuickDrawerPrefs) => {
    setQuickDrawerPrefs(next);
    quickDrawerPrefsRef.current = next;
    saveQuickDrawerPrefs(next);
  }, []);
  const [focusQuickDrawerConfig, setFocusQuickDrawerConfig] = useState(0);
  const [focusQuickSculptConfig, setFocusQuickSculptConfig] = useState(0);
  const trackDrawerAction = useCallback((actionId: QuickDrawerActionId, weight = 1) => {
    setQuickDrawerHabits((prev) => {
      const next = recordQuickDrawerAction(prev, actionId, weight);
      quickDrawerHabitsRef.current = next;
      saveQuickDrawerHabits(next);
      return next;
    });
  }, []);
  const handleResetBuildHabits = useCallback(() => {
    const empty = createEmptyBuildHabits();
    setBuildHabits(empty);
    buildHabitsRef.current = empty;
    saveBuildHabits(empty);
    const emptyDrawer = createEmptyQuickDrawerHabits();
    setQuickDrawerHabits(emptyDrawer);
    quickDrawerHabitsRef.current = emptyDrawer;
    saveQuickDrawerHabits(emptyDrawer);
  }, []);
  const [selectionUndo, setSelectionUndo] = useState<{ targetId: string; steps: number } | null>(null);
  const [guideModal, setGuideModal] = useState<GuideModalState | null>(null);
  const [pixModal, setPixModal] = useState<{ open: boolean; tab: PixTab }>({ open: false, tab: "element" });
  const autoProfileRef = useRef<AutoCivProfile>(createAutoCivProfile());
  const [idlePaused, setIdlePaused] = useState(false);
  const [autoLastAction, setAutoLastAction] = useState("");
  const [followGrowth, setFollowGrowth] = useState(true);
  const [mapFallback, setMapFallback] = useState(false);
  const [mapFocus, setMapFocus] = useState<[number, number]>();
  const [mapBuildingPulse, setMapBuildingPulse] = useState<{ id: string; startedAt: number }>();
  const followGrowthRef = useRef(true);
  followGrowthRef.current = followGrowth;
  const showAutoAction = useCallback((outcome: AutoStepOutcome) => {
    setAutoLastAction(outcome.summary);
    if (outcome.focusGrid && followGrowthRef.current && stateRef.current.mode === "idle" && !sheetRef.current) {
      if (rendererRef.current) rendererRef.current.watchConstruction(...outcome.focusGrid);
      else setMapFocus(outcome.focusGrid);
    }
  }, []);
  const [managerDecision, setManagerDecision] = useState<ManagerDecision | null>(null);
  const managerDecisionRef = useRef<ManagerDecision | null>(null);
  managerDecisionRef.current = managerDecision;
  const idlePausedRef = useRef(false);
  idlePausedRef.current = idlePaused;

  useEffect(() => {
    hydrateCustomElements();
  }, []);

  const [tutorialState, setTutorialState] = useState<{ mode: GameMode; stepIndex: number; completed: boolean } | null>(null);
  const tutorialStateRef = useRef(tutorialState);
  tutorialStateRef.current = tutorialState;
  const tutorialTimerRef = useRef<number | null>(null);
  const [placeStats,setPlaceStats]=useState<{defId:string;count:number;spent:number}>();
  const [hintsLeft,setHintsLeft]=useState(()=>{try{return Number(readPlayerItem("pixel_civ_place_hints")??3);}catch{return 3;}});

  const [followedService, setFollowedService] = useState<string>();
  const [returnLine,setReturnLine]=useState<string>();
  const [dispatchTarget,setDispatchTarget]=useState<string>();
  const targetRef=useRef<string|undefined>(undefined);targetRef.current=dispatchTarget;
  const [inspectPoint,setInspectPoint]=useState<GridPoint>();
  const [pendingWorks,setPendingWorks]=useState<{tool:InfrastructureTool;points:GridPoint[]}|null>(null);
  const pendingWorksRef = useRef<{tool:InfrastructureTool;points:GridPoint[]}|null>(null);
  pendingWorksRef.current = pendingWorks;
  const [worksTool,setWorksTool]=useState<InfrastructureTool|null>(null);
  const [pendingRoadStroke, setPendingRoadStroke] = useState<PendingNetworkStroke | null>(null);
  const pendingRoadStrokeRef = useRef<PendingNetworkStroke | null>(null);
  pendingRoadStrokeRef.current = pendingRoadStroke;
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const bulkSelectModeRef = useRef(false);
  bulkSelectModeRef.current = bulkSelectMode;
  const [bulkFilter, setBulkFilter] = useState<BulkSelectFilter>("all");
  const [hasSnapshot,setHasSnapshot]=useState(()=>{try{return !!readPlayerItem("pixel_civ_lab_snapshot");}catch{return false;}});
  const [cameraMode, setCameraMode] = useState<CameraMode>("pan");
  const [autoSpin, setAutoSpin] = useState(false);
  const restoreIslandView = useCallback((state: GameState) => {
    setUiToasts([]);
    setMapBuildingPulse(undefined);
    const world = rendererRef.current;
    if (!world) return;
    const restored = world.restoreCameraView(state.cameraView);
    if (!restored) {
      const example = EXAMPLE_WORLDS.find(w => w.id === state.exampleWorldId);
      const point = example && (example.viewpoints[state.exampleViewpoint ?? -1] ?? example.camera);
      if (point) world.focusGrid(point.gx, point.gz, point.zoom);
    }
    setCameraMode(restored ? state.cameraView!.mode : "pan");
    setAutoSpin(restored && state.cameraView!.autoSpin === true);
  }, []);

  const [viewEnvTab, setViewEnvTab] = useState<ViewEnvTab>("weather");
  const [activeHeatmap, setActiveHeatmap] = useState<HeatmapKind>("none");
  const [attackSeverity, setAttackSeverity] = useState<number>(2);
  const [cursorBehavior, setCursorBehavior] = useState<CursorBehavior>("auto");
  const cursorBehaviorRef = useRef<CursorBehavior>(cursorBehavior);
  cursorBehaviorRef.current = cursorBehavior;
  const [selectionFilter, setSelectionFilter] = useState<SelectionFilter>("all");

  const [savesModalOpen, setSavesModalOpen] = useState(false);
  const [linkedWorlds, setLinkedWorlds] = useState<TransferWorld[]>([]);
  useEffect(() => {
    const transfer = new URLSearchParams(location.hash.slice(1)).get("transfer");
    if (!transfer) return;
    setSavesModalOpen(true);
    const controller = new AbortController();
    void readLinkedWorld(transfer, controller.signal).then(worlds => {
      if (!controller.signal.aborted) setLinkedWorlds(worlds);
    }, error => {
      if (!controller.signal.aborted) setSlotError(error instanceof Error ? error.message : "The private world could not be opened.");
    });
    return () => controller.abort();
  }, []);
  const [saveSlots, setSaveSlots] = useState<(CivilizationSaveSlot | null)[]>(() => loadSaveSlots());
  useEffect(() => onDeviceChange(() => setSaveSlots(loadSaveSlots())), []);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{gx: number; gz: number; valid: boolean; reason?: string} | null>(null);

  /** Toasts made by the interface (failures / alerts). */
  const toastTimers=useRef(new Map<string,number>());
  const showToast=useCallback((t:UiToast,ms=4500)=>{
    setUiToasts(list=>[t,...list.filter(x=>x.id!==t.id && !(t.action && x.action))].slice(0,3));
    const timers=toastTimers.current;
    window.clearTimeout(timers.get(t.id));
    timers.set(t.id,window.setTimeout(()=>{setUiToasts(list=>list.filter(x=>x.id!==t.id));timers.delete(t.id);},ms));
  },[]);
  const undoRef=useRef<()=>void>(()=>{});
  const demolishRef=useRef<(ids:string[])=>void>(()=>{});
  const ringObserverRef = useRef<((pos: SelectionRingProjection | null) => void) | null>(null);
  const subscribeRingProjection = useCallback((cb: (pos: SelectionRingProjection | null) => void) => {
    ringObserverRef.current = cb;
    rendererRef.current?.setSelectionRingObserver(cb);
    return () => {
      if (ringObserverRef.current === cb) ringObserverRef.current = null;
      rendererRef.current?.setSelectionRingObserver(null);
    };
  }, []);

  const clearTutorialTimer = useCallback(() => {
    if (tutorialTimerRef.current !== null) {
      window.clearTimeout(tutorialTimerRef.current);
      tutorialTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTutorialTimer(), [clearTutorialTimer]);

  const stopTutorial = useCallback((showCompleteToast = false, completedMode?: GameMode) => {
    clearTutorialTimer();
    setTutorialState(null);
    if (showCompleteToast && completedMode) {
      showToast({
        id: "tutorial-done",
        title: `${MODE_TUTORIAL_LABELS[completedMode]} tutorial complete`,
        subtitle: "All menus are now unlocked. Replay anytime in Settings.",
        tone: "gold",
      });
    }
  }, [clearTutorialTimer, showToast]);

  const advanceTutorial = useCallback(() => {
    clearTutorialTimer();
    setTutorialState((cur) => {
      if (!cur) return null;
      const steps = TUTORIAL_FLOWS[cur.mode];
      if (cur.stepIndex + 1 >= steps.length) {
        const finishedMode = cur.mode;
        window.setTimeout(() => {
          showToast({
            id: "tutorial-done",
            title: `${MODE_TUTORIAL_LABELS[finishedMode]} tutorial complete`,
            subtitle: "All menus are now unlocked. Replay anytime in Settings.",
            tone: "gold",
          });
        }, 0);
        return null;
      }
      return { mode: cur.mode, stepIndex: cur.stepIndex + 1, completed: false };
    });
  }, [clearTutorialTimer, showToast]);

  const notifyTutorial = useCallback((event: TutorialEventKind) => {
    const cur = tutorialStateRef.current;
    if (!cur || cur.completed) return;
    const steps = TUTORIAL_FLOWS[cur.mode];
    const step = steps[cur.stepIndex];
    if (!step || !step.completeOn.includes(event)) return;
    setTutorialState({ ...cur, completed: true });
    clearTutorialTimer();
    tutorialTimerRef.current = window.setTimeout(() => {
      tutorialTimerRef.current = null;
      setTutorialState((latest) => {
        if (!latest || latest.mode !== cur.mode || latest.stepIndex !== cur.stepIndex) return latest;
        if (latest.stepIndex + 1 >= steps.length) {
          showToast({
            id: "tutorial-done",
            title: `${MODE_TUTORIAL_LABELS[latest.mode]} tutorial complete`,
            subtitle: "All menus are now unlocked. Replay anytime in Settings.",
            tone: "gold",
          });
          return null;
        }
        return { mode: latest.mode, stepIndex: latest.stepIndex + 1, completed: false };
      });
    }, 900);
  }, [clearTutorialTimer, showToast]);

  /** Open a home (or close it if it is already open). Every sheet replaces whatever was open. */
  const openSheet=useCallback((id:NavSheet|null,toggle=false,preserveSelection=false)=>{
    setPendingWorks(null);
    if (id !== "sculpt") setWorksTool(null);
    setDispatchTarget(undefined);
    setPendingRoadStroke(null);
    setBulkSelectMode(false);
    setQuickBuild(null);
    setQuickDrawerOpen(false);
    setBrush(idleBrush);
    setDeletedAnchor(null);
    setInspectorDetailOpen(false);
    setSelectionUndo(null);
    const current = sheetRef.current;
    const next = toggle && current === id ? null : id;
    if (next && next !== current) setSheetHeight(DEFAULT_HEIGHT[next]);
    if (next && !preserveSelection) setSelectedIds([]);
    setSheetState(next);
    if (id !== "more") setMorePage(null);
    if (next === "build") notifyTutorial("open_build");
    else if (next === "layers") notifyTutorial("open_layers");
    else if (next === "city") notifyTutorial("open_city");
    else if (next === "more") notifyTutorial("open_more");
  },[notifyTutorial]);
  const openWorks=useCallback(()=>{openSheet("sculpt");},[openSheet]);
  const openSettings=useCallback(()=>{openSheet("more");setMorePage("settings");},[openSheet]);
  const openTransit=useCallback(()=>{setCityTab("transit");openSheet("city",false,true);notifyTutorial("open_transit");},[openSheet,notifyTutorial]);
  const openCity=useCallback((tab:CityTab)=>{setCityTab(tab);openSheet("city",false,tab==="transit");if(tab==="transit")notifyTutorial("open_transit");},[openSheet,notifyTutorial]);
  const openFix=useCallback((fix:IssueFix)=>{setBuildQuery("");setBuildFix(fix);openSheet("build");},[openSheet]);
  const showLayer=useCallback((layer:HeatmapKind)=>{setActiveHeatmap(layer);openSheet("layers");setSheetHeight("peek");},[openSheet]);
  const openMore=useCallback((page:MorePage)=>{openSheet("more");setMorePage(page);},[openSheet]);

  const navigation=useRef({sheet,morePage,pendingWorks,pendingRoadStroke,bulkSelectMode,dispatchTarget,worksTool,inspectorDetailOpen,quickBuild,quickDrawerOpen});
  navigation.current={sheet,morePage,pendingWorks,pendingRoadStroke,bulkSelectMode,dispatchTarget,worksTool,inspectorDetailOpen,quickBuild,quickDrawerOpen};

  const commitState = useCallback((mutator: (draft: GameState) => void) => {
    const next: GameState = structuredClone(stateRef.current);
    mutator(next);
    stateRef.current = next;
    setGameState(next);
    saveActiveMode(next);
  }, [saveActiveMode]);

  const dismissToast=useCallback((id:string)=>{
    setUiToasts(list=>list.filter(t=>t.id!==id));
    if (stateRef.current.toasts.some(t=>t.id===id)) {
      commitState(draft=>{draft.toasts=draft.toasts.filter(t=>t.id!==id);});
    }
  },[commitState]);

  const setSimSpeed=(v:number)=>commitState(d=>{d.playSpeed=v;simSpeedRef.current=v;});

  const commitBuildingEdit = useCallback((label:string, mutate:(draft:GameState)=>void) => {
    const before=stateRef.current;
    commitState(draft=>{
      mutate(draft);
      rememberBuildingEdit(before,draft,label);
    });
  },[commitState]);

  const handleUndoBuilding = () => {
    setUiToasts(list=>list.filter(toast=>!toast.action));
    commitState(draft=>{
      const result=undoBuildingEdit(draft);
      if(result.ok) {
        setSelectedIds(ids=>ids.filter(id=>draft.elements.some(e=>e.id===id)));
      } else showToast({id:"undo",title:"Nothing to undo",subtitle:result.reason??"",tone:"alert"});
    });
  };
  undoRef.current=handleUndoBuilding;

  const recordPlacementHabit = useCallback((def: CivElementDef, gx: number, gz: number) => {
    const ctx = analyzeTileContext(stateRef.current, gx, gz);
    setBuildHabits((prev) => {
      const next = recordBuildHabit(prev, def, ctx.contextTag);
      buildHabitsRef.current = next;
      saveBuildHabits(next);
      return next;
    });
  }, []);

  const selectAfterPlacement = useCallback((id: string) => {
    const select = quickMenuPrefsRef.current.openQuickEditAfterPlace;
    setInspectorDetailOpen(false);
    setDeletedAnchor(null);
    setSelectedIds(select ? [id] : []);
    setSelectionUndo(select ? { targetId: id, steps: 1 } : null);
  }, []);

  // Place tile callback from 3D canvas
  const handleTilePlace = useCallback(
    (gx: number, gz: number) => {
      const curBrush = brushRef.current;
      if (curBrush.kind !== "place" || !curBrush.defId) return;
      const brushDef = ELEMENT_BY_ID[curBrush.defId];
      if (!brushDef) return;

      const cur = stateRef.current;
      if (cur.gameOver) return;

      const plan = planConstruction(cur, brushDef, gx, gz, curBrush.level, curBrush.rotation, curBrush.faceManually);
      if (!plan.valid) {
        if (plan.cost > 0 && cur.money < plan.cost) {
          showToast({id:"funds",title:"Not enough money",subtitle:`Need $${plan.cost.toLocaleString()} to build ${displayName(plan.def.id)}.`,tone:"alert"});
        } else if (plan.reason) {
          showToast({id:"placement-blocked",title:"Can't build here",subtitle:plan.reason,tone:"alert"});
        }
        return;
      }
      const { def, level: placeLevel, spanX, spanZ, rotation, overWater, replaceId } = plan;
      const chosenVariant =
        cur.mode === "god" && curBrush.variantMode >= 0
          ? curBrush.variantMode
          : def.isNetwork
            ? pickAdjacentNetworkVariant(cur.elements, gx, gz, def)
            : randomVariant();
      const charged = plan.cost;

      const placedId = makeElementId();
      commitBuildingEdit("Place "+displayName(def.id),(draft) => {
        if (charged) transfer(draft,"treasury","outside",charged,"Construction");
        const placed: PlacedElement = {
          id: placedId,
          defId: def.id,
          gx,
          gz,
          spanX,
          spanZ,
          rotation,
          level: placeLevel,
          variant: chosenVariant,
          connected: false,
          hasPoliceCover: false,
          hasFireCover: false,
          nuisancePenalty: 0,
          maintTimerSec: 0,
          disrepair: false,
          onFire: false,
          animProgress: 1.0,
          animKind: "place",
          ...(overWater ? { overWater: true } : {}),
          ...(plan.roadAxis ? {roadAxis:plan.roadAxis} : {}),
          ...(plan.pedestrianDeck ? { pedestrianDeck: true } : {}),
        };
        if (replaceId) {
          placed.waterUnderlay = draft.elements.find(e => e.id === replaceId);
          draft.elements = draft.elements.filter(e => e.id !== replaceId);
        }
        draft.elements.push(placed);
        applyLandformPlacement(draft,placed);
        settleStreetFacing(draft, placed, curBrush.faceManually === true);
        if (def.id !== brushDef.id && !draft.achievements?.includes("bridge_builder")) {
          pushToast(draft, "merge", `Auto-Bridge: ${displayName(def.id)}`, "Roads dragged across water become bridges automatically.");
        }
        recomputeConnectivityAndMetrics(draft);
      });

      recordPlacementHabit(def, gx, gz);
      setPlaceStats(prev=>prev&&prev.defId===brushDef.id?{defId:brushDef.id,count:prev.count+1,spent:prev.spent+charged}:{defId:brushDef.id,count:1,spent:charged});
      notifyTutorial("place_item");

      const beh = cursorBehaviorRef.current;
      if (beh === "select" || (beh === "auto" && !def.isNetwork)) {
        setBrush(idleBrush);
        selectAfterPlacement(placedId);
      }
    },
    [commitBuildingEdit,showToast,notifyTutorial,recordPlacementHabit,selectAfterPlacement],
  );

  // Move commit callback
  const handleTileMoveCommit = useCallback(
    (elementId: string, gx: number, gz: number) => {
      const cur = stateRef.current;
      const el = cur.elements.find((e) => e.id === elementId);
      if (!el) return;
      if (!planRelocation(cur, el, gx, gz).valid) return;

      let moved = false;
      commitBuildingEdit("Move "+ELEMENT_BY_ID[el.defId].name,(draft) => {
        const target = draft.elements.find(e => e.id === elementId);
        if (target && relocatePlacedElement(draft, target, gx, gz)) {
          if (ELEMENT_BY_ID[target.defId].isRoadNetwork) settleStreetFacing(draft, target, false);
          recomputeConnectivityAndMetrics(draft);
          moved = true;
        }
      });
      if (moved) {
        setSelectionUndo(prev => ({ targetId: elementId, steps: (prev?.targetId === elementId ? prev.steps : 0) + 1 }));
      }
      setBrush((b) => ({ ...b, kind: "none", movingElementId: undefined }));
    },
    [commitBuildingEdit],
  );

  // Tapping an element shows the floating radial quick-menu around it and closes any screen-covering sheet.
  const handleSelectElement = useCallback((elementId: string | null) => {
    const prevId = selectedIdsRef.current[0];
    setDeletedAnchor(null);
    setInspectorDetailOpen(false);
    setBulkSelectMode(false);
    setQuickBuild(null);
    setQuickDrawerOpen(false);
    if (!elementId || elementId !== prevId) {
      setSelectionUndo(null);
    }
    const city = stateRef.current;
    const site = elementId ? city.elements.find(el => el.id === elementId) : undefined;
    const status = site ? maintenanceStatus(city, site) : "none";
    if (site && status !== "none" && status !== "healthy") {
      commitState(draft => { maintainElement(draft, site.id); });
      showToast({id:"maintenance",title:"Maintained " + (displayName(site.defId)),subtitle:"Full service restored for free."});
    }
    setSelectedIds(elementId ? [elementId] : []);
    if (elementId) notifyTutorial("select_element");
    const open = sheetRef.current;
    if (elementId && open) setSheetState(null);
  }, [commitState, notifyTutorial, showToast]);

  // A map tap dismisses an open panel before it can trigger a world action.
  const dismissMapPanel = useCallback(() => {
    const ui = navigation.current;
    if (ui.sheet) {
      setSelectedIds([]);
      openSheet(null);
      return true;
    }
    if (ui.inspectorDetailOpen) {
      setInspectorDetailOpen(false);
      setSelectedIds([]);
      setSelectionUndo(null);
      return true;
    }
    return false;
  }, [openSheet]);

  // Tapping an empty tile dismisses any open sheet/selection/ring first, or opens the Quick-Build Spiral Menu.
  const handleEmptyTileTap = useCallback((gx: number, gz: number) => {
    const hadSheet = sheetRef.current !== null;
    const hadSelection = selectedIdsRef.current.length > 0;
    const hadDeleted = deletedAnchorRef.current !== null;
    const hadQuickBuild = quickBuildRef.current !== null;
    const hadQuickDrawer = quickDrawerOpenRef.current;

    if (hadSheet || hadSelection || hadDeleted || hadQuickBuild || hadQuickDrawer) {
      setSheetState(null);
      setSelectedIds([]);
      setDeletedAnchor(null);
      setInspectorDetailOpen(false);
      setSelectionUndo(null);
      setQuickBuild(null);
      setQuickDrawerOpen(false);
      return;
    }

    const cur = stateRef.current;
    if (cur.gameOver || cur.mode === "idle" || cur.mode === "manager") return;
    if (quickBuildModeRef.current === "sculpt") {
      setQuickBuild({ gx, gz, category: null, treeParentId: null, treeSubId: null });
      return;
    }
    if (quickBuildModeRef.current === "tree") {
      setQuickBuild({ gx, gz, category: null, treeParentId: null, treeSubId: null });
      return;
    }
    if (quickBuildModeRef.current === "instant") {
      const instant = recommendInstantQuickElements(
        cur,
        gx,
        gz,
        buildHabitsRef.current,
        6,
        quickMenuPrefsRef.current.smartFocus,
      );
      if (instant.length > 0) {
        setQuickBuild({ gx, gz, category: null, treeParentId: null, treeSubId: null });
      }
      return;
    }
    const cats = recommendQuickCategories(
      cur,
      gx,
      gz,
      buildHabitsRef.current,
      6,
      quickMenuPrefsRef.current.smartFocus,
    );
    if (cats.length > 0) {
      setQuickBuild({ gx, gz, category: null, treeParentId: null, treeSubId: null });
    }
  }, []);

  // Placing an element directly from the Quick-Build Spiral Menu (Adaptive or Decision Tree),
  // then immediately opening the standard element-editing SelectionRing around the placed element.
  const handleQuickBuildPlace = useCallback(
    (defId: string) => {
      const qb = quickBuildRef.current;
      if (!qb) return;
      const brushDef = ELEMENT_BY_ID[defId];
      if (!brushDef) return;
      const cur = stateRef.current;
      if (cur.gameOver) return;

      const { gx, gz } = qb;
      const plan = planConstruction(cur, brushDef, gx, gz, 1, 0, false);
      if (!plan.valid) {
        if (plan.cost > 0 && cur.money < plan.cost) {
          showToast({
            id: "funds",
            title: "Not enough money",
            subtitle: `Need $${plan.cost.toLocaleString()} to build ${displayName(plan.def.id)}.`,
            tone: "alert",
          });
        } else {
          showToast({
            id: "qb-blocked",
            title: "Can't build here",
            subtitle: plan.reason || `${brushDef.name} doesn't fit on this tile.`,
            tone: "alert",
          });
        }
        return;
      }

      const { def, level: placeLevel, spanX, spanZ, rotation, overWater, replaceId } = plan;
      const chosenVariant = def.isNetwork
        ? pickAdjacentNetworkVariant(cur.elements, gx, gz, def)
        : randomVariant();
      const charged = plan.cost;
      const placedId = makeElementId();

      commitBuildingEdit("Place " + def.name, (draft) => {
        if (charged) transfer(draft, "treasury", "outside", charged, "Construction");
        const placed: PlacedElement = {
          id: placedId,
          defId: def.id,
          gx,
          gz,
          spanX,
          spanZ,
          rotation,
          level: placeLevel,
          variant: chosenVariant,
          connected: false,
          hasPoliceCover: false,
          hasFireCover: false,
          nuisancePenalty: 0,
          maintTimerSec: 0,
          disrepair: false,
          onFire: false,
          animProgress: 1.0,
          animKind: "place",
          ...(overWater ? { overWater: true } : {}),
          ...(plan.roadAxis ? { roadAxis: plan.roadAxis } : {}),
          ...(plan.pedestrianDeck ? { pedestrianDeck: true } : {}),
        };
        if (replaceId) {
          placed.waterUnderlay = draft.elements.find((e) => e.id === replaceId);
          draft.elements = draft.elements.filter((e) => e.id !== replaceId);
        }
        draft.elements.push(placed);
        applyLandformPlacement(draft, placed);
        settleStreetFacing(draft, placed, false);
        recomputeConnectivityAndMetrics(draft);
      });

      recordPlacementHabit(def, gx, gz);
      notifyTutorial("place_item");
      setQuickBuild(null);
      selectAfterPlacement(placedId);
    },
    [commitBuildingEdit, notifyTutorial, recordPlacementHabit, selectAfterPlacement, showToast],
  );

  // Dragging 2+ road/bridge tiles holds the stretch in place with a floating checkmark to confirm (click elsewhere to cancel).
  const handlePendingNetworkStroke = useCallback((stroke: PendingNetworkStroke) => {
    setDeletedAnchor(null);
    setSelectionUndo(null);
    setSelectedIds([]);
    setQuickBuild(null);
    setPendingRoadStroke(stroke.points.length >= 2 ? stroke : null);
  }, []);

  const handleCancelPendingStroke = useCallback(() => {
    setPendingRoadStroke(null);
    if (pendingWorksRef.current?.tool.kind === "bridge") {
      setPendingWorks(null);
    }
  }, []);

  const handleConfirmRoadStroke = useCallback(() => {
    const stroke = pendingRoadStrokeRef.current;
    if (!stroke || stroke.points.length === 0) return;
    const brushDef = ELEMENT_BY_ID[stroke.defId];
    if (!brushDef) {
      setPendingRoadStroke(null);
      return;
    }
    const cur = stateRef.current;
    if (cur.gameOver) {
      setPendingRoadStroke(null);
      return;
    }
    const curBrush = brushRef.current;
    let placedCount = 0;
    let totalSpent = 0;
    let autoBridgeName: string | null = null;

    commitBuildingEdit(`Place ${stroke.points.length} ${brushDef.name}`, (draft) => {
      for (const [index, pt] of stroke.points.entries()) {
        const plan = planConstruction(draft, brushDef, pt.gx, pt.gz, curBrush.level, curBrush.rotation, curBrush.faceManually, strokeRoadAxis(stroke.points,index));
        if (!plan.valid) continue;
        const { def, level: placeLevel, spanX, spanZ, rotation, overWater, replaceId } = plan;
        const chosenVariant =
          draft.mode === "god" && curBrush.variantMode >= 0
            ? curBrush.variantMode
            : def.isNetwork
              ? pickAdjacentNetworkVariant(draft.elements, pt.gx, pt.gz, def)
              : randomVariant();
        const charged = plan.cost;
        if (charged) transfer(draft, "treasury", "outside", charged, "Construction");
        const placed: PlacedElement = {
          id: makeElementId(),
          defId: def.id,
          gx: pt.gx,
          gz: pt.gz,
          spanX,
          spanZ,
          rotation,
          level: placeLevel,
          variant: chosenVariant,
          connected: false,
          hasPoliceCover: false,
          hasFireCover: false,
          nuisancePenalty: 0,
          maintTimerSec: 0,
          disrepair: false,
          onFire: false,
          animProgress: 1.0,
          animKind: "place",
          ...(overWater ? { overWater: true } : {}),
          ...(plan.roadAxis ? { roadAxis: plan.roadAxis } : {}),
          ...(plan.pedestrianDeck ? { pedestrianDeck: true } : {}),
        };
        if (replaceId) {
          placed.waterUnderlay = draft.elements.find((e) => e.id === replaceId);
          draft.elements = draft.elements.filter((e) => e.id !== replaceId);
        }
        draft.elements.push(placed);
        applyLandformPlacement(draft, placed);
        settleStreetFacing(draft, placed, curBrush.faceManually === true);
        if (def.id !== brushDef.id) autoBridgeName = def.name;
        placedCount++;
        totalSpent += charged;
      }
      if (autoBridgeName && !draft.achievements?.includes("bridge_builder")) {
        pushToast(draft, "merge", `Auto-Bridge: ${autoBridgeName}`, "Roads dragged across water become bridges automatically.");
      }
      if (placedCount > 0) {
        recomputeConnectivityAndMetrics(draft);
      }
    });

    setPendingRoadStroke(null);
    if (placedCount === 0) {
      showToast({
        id: "road-confirm",
        title: "Could not build stretch",
        subtitle: buildingCharges(cur) ? "Check funds or blocked tiles." : "All tiles in this stretch were blocked.",
        tone: "alert",
      });
      return;
    }
    if (stroke.points[0]) {
      recordPlacementHabit(brushDef, stroke.points[0].gx, stroke.points[0].gz);
    }
    setPlaceStats((prev) =>
      prev && prev.defId === brushDef.id
        ? { defId: brushDef.id, count: prev.count + placedCount, spent: prev.spent + totalSpent }
        : { defId: brushDef.id, count: placedCount, spent: totalSpent },
    );
    notifyTutorial("place_item");
    if (cursorBehaviorRef.current === "select") setBrush(idleBrush);
  }, [commitBuildingEdit, notifyTutorial, recordPlacementHabit, showToast]);
  const confirmRoadStrokeRef = useRef(handleConfirmRoadStroke);
  confirmRoadStrokeRef.current = handleConfirmRoadStroke;

  const handleBulkSelectElements = useCallback((ids: string[], mode: "add" | "toggle") => {
    setDeletedAnchor(null);
    setInspectorDetailOpen(false);
    setSelectionUndo(null);
    setQuickBuild(null);
    if (mode === "toggle") {
      const target = ids[0];
      if (!target) return;
      setSelectedIds((prev) => (prev.includes(target) ? prev.filter((id) => id !== target) : [...prev, target]));
      return;
    }
    if (ids.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return Array.from(next);
    });
  }, []);

  const handleSelectConnectedRoads = useCallback(() => {
    const cur = stateRef.current;
    const currentSet = new Set(selectedIdsRef.current);
    const seeds = cur.elements.filter((el) => {
      if (!currentSet.has(el.id)) return false;
      const def = ELEMENT_BY_ID[el.defId];
      return Boolean(def?.isRoadNetwork || def?.isRailNetwork);
    });
    if (seeds.length === 0) return;
    const matchRail = seeds.every((el) => ELEMENT_BY_ID[el.defId]?.isRailNetwork);
    const tileToId = new Map<string, string>();
    const elById = new Map<string, PlacedElement>();
    for (const el of cur.elements) {
      const def = ELEMENT_BY_ID[el.defId];
      const matches = matchRail ? Boolean(def?.isRailNetwork) : Boolean(def?.isRoadNetwork);
      if (!matches) continue;
      elById.set(el.id, el);
      for (let x = el.gx; x < el.gx + el.spanX; x++) {
        for (let z = el.gz; z < el.gz + el.spanZ; z++) {
          tileToId.set(`${x},${z}`, el.id);
        }
      }
    }
    const visited = new Set<string>(seeds.map((s) => s.id));
    const queue = [...seeds];
    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length > 0) {
      const el = queue.shift()!;
      for (let x = el.gx; x < el.gx + el.spanX; x++) {
        for (let z = el.gz; z < el.gz + el.spanZ; z++) {
          for (const [dx, dz] of dirs) {
            const nid = tileToId.get(`${x + dx},${z + dz}`);
            if (nid && !visited.has(nid)) {
              visited.add(nid);
              const neighbor = elById.get(nid);
              if (neighbor) queue.push(neighbor);
            }
          }
        }
      }
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of visited) next.add(id);
      return Array.from(next);
    });
  }, []);

  // Initialize Three.js renderer once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let world: PixelWorldRenderer;
    try {
      world = new PixelWorldRenderer(canvas, stateRef.current, {
        onTilePlace: handleTilePlace,
        onPendingNetworkStroke: handlePendingNetworkStroke,
        onCancelPendingStroke: handleCancelPendingStroke,
        onBulkSelectElements: handleBulkSelectElements,
        onTileMoveCommit: handleTileMoveCommit,
        onGroupMoveTarget: (gx, gz) => setBrush(current => current.movingGroupIds ? { ...current, groupDestination: [gx, gz] } : current),
        onMapTap: dismissMapPanel,
        onSelectElement: handleSelectElement,
        onEmptyTileTap: handleEmptyTileTap,
        onFollowChange: setFollowedService,
        onSelectService:id=>{setReturnLine(id);openTransit();setSelectedIds([]);setDeletedAnchor(null);setSelectionUndo(null);setQuickBuild(null);},
        onHoverInfo: setHoverInfo,
        onInspectTile: (gx,gz)=>{
          setInspectPoint({gx,gz});
          const target=targetRef.current;
          if(target){commitState(s=>dispatchVessel(s,target,"sail",[gx,gz]));setDispatchTarget(undefined);openTransit();return true;}
        },
        onInfrastructureStroke: (tool,points)=>setPendingWorks({tool:{...tool},points:points.map(p=>({...p}))}),
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("WebGL context")) throw error;
      setMapFallback(true);
      return;
    }
    rendererRef.current = world;
    world.setAppearanceEra(displayedEraRef.current);
    if (ringObserverRef.current) world.setSelectionRingObserver(ringObserverRef.current);
    restoreIslandView(stateRef.current);
    (window as unknown as { __pixelWorld?: PixelWorldRenderer }).__pixelWorld = world;

    return () => {
      world.dispose();
      rendererRef.current = null;
    };
  }, [
    handleTilePlace,
    dismissMapPanel,
    handlePendingNetworkStroke,
    handleCancelPendingStroke,
    handleBulkSelectElements,
    handleTileMoveCommit,
    handleSelectElement,
    handleEmptyTileTap,
    commitState,
    restoreIslandView,
    openTransit,
  ]);

  useEffect(() => {rendererRef.current?.syncState(gameState, selectedIds);}, [gameState, selectedIds]);
  useEffect(() => {rendererRef.current?.setQuickBuildTile(quickBuild ? { gx: quickBuild.gx, gz: quickBuild.gz } : null);}, [quickBuild]);
  useEffect(() => {rendererRef.current?.setPendingNetworkStroke(pendingRoadStroke);}, [pendingRoadStroke]);
  useEffect(() => {
    const bridgePending = Boolean(pendingWorks && pendingWorks.tool.kind === "bridge" && pendingWorks.points.length >= 2);
    rendererRef.current?.setHasPendingBridgeConfirm(bridgePending, bridgePending ? pendingWorks : null);
  }, [pendingWorks]);
  useEffect(() => {rendererRef.current?.setBulkSelect(bulkSelectMode && !brush.movingGroupIds, bulkFilter);}, [bulkSelectMode, bulkFilter, brush.movingGroupIds]);
  useEffect(() => {
    if (pendingRoadStroke && pendingRoadStroke.points.length >= 2) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of pendingRoadStroke.points) {
        if (p.gx < minX) minX = p.gx;
        if (p.gx > maxX) maxX = p.gx;
        if (p.gz < minZ) minZ = p.gz;
        if (p.gz > maxZ) maxZ = p.gz;
      }
      rendererRef.current?.setCustomRingTarget({
        gx: minX,
        gz: minZ,
        spanX: Math.max(1, maxX - minX + 1),
        spanZ: Math.max(1, maxZ - minZ + 1),
        topY: 1.5,
      });
      return;
    }
    if (pendingWorks && pendingWorks.tool.kind === "bridge" && pendingWorks.points.length >= 2) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of pendingWorks.points) {
        if (p.gx < minX) minX = p.gx;
        if (p.gx > maxX) maxX = p.gx;
        if (p.gz < minZ) minZ = p.gz;
        if (p.gz > maxZ) maxZ = p.gz;
      }
      rendererRef.current?.setCustomRingTarget({
        gx: minX,
        gz: minZ,
        spanX: Math.max(1, maxX - minX + 1),
        spanZ: Math.max(1, maxZ - minZ + 1),
        topY: 2.2,
      });
      return;
    }
    if (quickBuild) {
      rendererRef.current?.setCustomRingTarget({
        gx: quickBuild.gx,
        gz: quickBuild.gz,
        spanX: 1,
        spanZ: 1,
        topY: 1.1,
      });
      return;
    }
    rendererRef.current?.setCustomRingTarget(
      deletedAnchor
        ? {
            gx: deletedAnchor.gx,
            gz: deletedAnchor.gz,
            spanX: deletedAnchor.spanX,
            spanZ: deletedAnchor.spanZ,
            baseY: deletedAnchor.baseY,
            topY: deletedAnchor.topY,
          }
        : null,
    );
  }, [pendingRoadStroke, pendingWorks, quickBuild, deletedAnchor]);
  useEffect(()=>{rendererRef.current?.setInfrastructureTool(worksTool);},[worksTool]);
  useEffect(() => {rendererRef.current?.setBrush(brush);}, [brush]);
  useEffect(() => {rendererRef.current?.setHeatmap(activeHeatmap);}, [activeHeatmap]);
  useEffect(() => {rendererRef.current?.setAutoSpin(autoSpin);}, [autoSpin]);
  useEffect(() => {rendererRef.current?.setSelectionFilter(selectionFilter);}, [selectionFilter]);
  // A new brush starts a new running placement total; the first few brushes show a how-to hint.
  useEffect(() => {
    if (brush.kind !== "place") return;
    setPlaceStats(prev => prev?.defId === brush.defId ? prev : undefined);
    return () => setHintsLeft(h => {const n = Math.max(0, h - 1); try {writePlayerItem("pixel_civ_place_hints", String(n));} catch {/* private mode */} return n;});
  }, [brush.kind, brush.defId]);

  // Simulation loop (250ms tick, pauses active Survival timers when tab is hidden)
  useEffect(() => {
    let lastMs = performance.now(), lastSave=lastMs;
    let queuedSave: number | undefined;
    const idleAvailable = typeof window.requestIdleCallback === "function";
    const unqueue=()=>{
      if(queuedSave===undefined)return;
      if(idleAvailable)window.cancelIdleCallback(queuedSave);else window.clearTimeout(queuedSave);
      queuedSave=undefined;
    };
    const flush=()=>{unqueue();return saveActiveMode(stateRef.current);};
    const queueSave=()=>{
      if(queuedSave!==undefined)return;
      // Keep the five-second checkpoint off the simulation/render turn; page hide and island changes flush immediately.
      queuedSave=idleAvailable ? window.requestIdleCallback(flush,{timeout:750}) : window.setTimeout(flush,0);
    };
    const closeSave = () => { if (flush()) void autosync(); };
    const visibility=()=>{if(document.hidden)closeSave();};
    window.addEventListener("pagehide",closeSave);
    window.addEventListener("pixel-save-before-switch",flush);
    document.addEventListener("visibilitychange",visibility);
    const timer = window.setInterval(() => {
      const now = performance.now();
      const rawDt = Math.min(1.0, (now - lastMs) / 1000);
      lastMs = now;

      const spd = simSpeedRef.current;
      if (spd <= 0 || document.hidden) return;

      const visible = !document.hidden;
      const next: GameState = {
        ...stateRef.current,
        elements: stateRef.current.elements.map((e) => ({ ...e })),
        toasts: [...stateRef.current.toasts],
      };

      const changed = stepSimulation(next, rawDt * spd, visible);
      stateRef.current = next;
      if (
        changed ||
        next.mode === "survival" ||
        next.activeAttack !== null ||
        next.crimeIncidents.length > 0 ||
        next.elements.some((e) => e.animProgress > 0)
      ) {
        setGameState(next);
        if(now-lastSave>=5000){queueSave();lastSave=now;}
      } else {
        rendererRef.current?.syncState(next, selectedIdsRef.current);
      }
    }, 250);

    return () => {unqueue();window.clearInterval(timer);window.removeEventListener("pagehide",closeSave);window.removeEventListener("pixel-save-before-switch",flush);document.removeEventListener("visibilitychange",visibility);};
  }, []);

  // Construction advances on active play time and shares the selected simulation speed.
  useEffect(() => {
    if (gameState.mode !== "idle" && gameState.mode !== "manager") return;
    let lastPlay = stateRef.current.activePlaySec;
    let nextProjectAt = lastPlay + 1.5;
    const interval = window.setInterval(() => {
      const current = stateRef.current;
      const mode = current.mode;
      if (current.activePlaySec < lastPlay) nextProjectAt = current.activePlaySec + 1.5;
      lastPlay = current.activePlaySec;
      if (document.hidden || simSpeedRef.current <= 0 || current.gameOver ||
        (mode !== "idle" && mode !== "manager") ||
        (mode === "idle" && idlePausedRef.current) || managerDecisionRef.current) return;
      if (current.activePlaySec < nextProjectAt) return;
      nextProjectAt = current.activePlaySec + 1.5;

      const turn = (current.autoCiv?.turn ?? 0) + 1;
      if (mode === "manager" && turn % 3 === 0) {
        const decision = generateManagerDecision(current, autoProfileRef.current, turn);
        managerDecisionRef.current = decision;
        setManagerDecision(decision);
        return;
      }

      let outcome: AutoStepOutcome | undefined;
      commitState((draft) => {
        outcome = runAutoCivStep(draft, autoProfileRef.current, turn);
      });
      if (outcome) showAutoAction(outcome);
    }, 250);
    return () => window.clearInterval(interval);
  }, [gameState.mode, commitState, showAutoAction]);

  const rotateSelected=useCallback((id:string)=>{
    commitBuildingEdit("Rotate building",(draft) => {
      const el = draft.elements.find((item) => item.id === id);
      if (!el) return;
      delete el.awaitingStreet;
      const nextRot = (el.rotation + 1) % 4;
      if (el.spanX !== el.spanZ && nextRot % 2 !== el.rotation % 2) {
        const def = ELEMENT_BY_ID[el.defId];
        if (def && checkPlacementValid(draft, def, el.gx, el.gz, el.spanZ, el.spanX, new Set([el.id])).valid) {
          const tmp = el.spanX;
          el.spanX = el.spanZ;
          el.spanZ = tmp;
          el.rotation = nextRot;
        } else {
          el.rotation = (el.rotation + 2) % 4;
        }
      } else {
        el.rotation = nextRot;
      }
      recomputeConnectivityAndMetrics(draft);
    });
    setSelectionUndo(prev => ({ targetId: id, steps: (prev?.targetId === id ? prev.steps : 0) + 1 }));
  },[commitBuildingEdit]);

  // Keyboard: B/L/C/T/M homes, R rotate, Del demolish immediately, Ctrl+Z undo, Esc steps back one level.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if(e.defaultPrevented || document.querySelector("dialog[open]")) return;
      const target=e.target instanceof HTMLElement ? e.target : undefined;
      const typing=!!target?.closest('input,textarea,select,[contenteditable="true"]');
      if((e.ctrlKey||e.metaKey) && e.code==="KeyZ" && !typing){e.preventDefault();undoRef.current();return;}
      if(e.ctrlKey || e.metaKey || e.altKey) return;
      if(e.key==="Enter" && !typing) {
        if (pendingRoadStrokeRef.current) {
          e.preventDefault();
          confirmRoadStrokeRef.current();
          return;
        }
        if (pendingWorksRef.current?.tool.kind === "bridge") {
          const edit = pendingWorksRef.current;
          const preview = planInfrastructureStroke(stateRef.current, edit.tool, edit.points);
          if (preview.valid) {
            e.preventDefault();
            commitBuildingEdit("Build bridge", (st) => {
              const p = applyInfrastructureStroke(st, edit.tool, edit.points);
              if (!p.valid) pushToast(st, "alert", "Public works", p.reason);
              recomputeConnectivityAndMetrics(st);
            });
            setPendingWorks(null);
            return;
          }
        }
      }
      if(e.key==="Escape") {
        const ui=navigation.current;
        if(ui.quickDrawerOpen) {setQuickDrawerOpen(false);return;}
        if(ui.quickBuild) {
          if (ui.quickBuild.treeSubId) setQuickBuild({ ...ui.quickBuild, treeSubId: null });
          else if (ui.quickBuild.treeParentId) setQuickBuild({ ...ui.quickBuild, treeParentId: null, treeSubId: null });
          else if (ui.quickBuild.category) setQuickBuild({ ...ui.quickBuild, category: null });
          else setQuickBuild(null);
          return;
        }
        if(ui.pendingRoadStroke) {setPendingRoadStroke(null);return;}
        if(ui.pendingWorks || ui.dispatchTarget) {setPendingWorks(null);setDispatchTarget(undefined);return;}
        if(brushRef.current.movingGroupIds){setBrush(idleBrush);return;}
        if(ui.bulkSelectMode) {setBulkSelectMode(false);setSelectedIds([]);return;}
        if(ui.worksTool){setWorksTool(null);return;}
        if(brushRef.current.kind!=="none"){setBrush(idleBrush);return;}
        if(ui.sheet==="more"&&ui.morePage){setMorePage(null);return;}
        if(ui.sheet) {
          setSheetState(null);
          document.querySelector<HTMLButtonElement>('[data-panel-toggle="'+ui.sheet+'"]')?.focus({preventScroll:true});
          return;
        }
        if(ui.inspectorDetailOpen){setInspectorDetailOpen(false);return;}
        rendererRef.current?.followService();
        setSelectedIds([]);
        setDeletedAnchor(null);
        setSelectionUndo(null);
      } else if(typing) return;
      else if(e.repeat && ["KeyB","KeyL","KeyC","KeyS","KeyT","KeyM","KeyH","KeyV","KeyR"].includes(e.code)) return;
      else if (["KeyB","KeyL","KeyC","KeyS","KeyM","KeyH"].includes(e.code)) {
        const keys:Record<string,NavSheet>={KeyB:"build",KeyL:"layers",KeyH:"layers",KeyC:"city",KeyS:"sculpt",KeyM:"more"};
        openSheet(keys[e.code],true);
      } else if (e.code === "KeyT") {
        if (sheetRef.current === "city" && cityTab === "transit") openSheet(null);
        else openTransit();
      } else if (e.code==="KeyV") {
        openSheet("more");setMorePage("view");
      } else if (e.key === "=" || e.key === "+") {
        rendererRef.current?.zoomBy(0.8);
      } else if (e.key === "-" || e.key === "_") {
        rendererRef.current?.zoomBy(1.24);
      } else if (e.code === "KeyR") {
        if (brushRef.current.kind === "place") {
          setBrush((b) => ({ ...b, rotation: (b.rotation + 1) % 4, faceManually:true }));
        } else if (selectedIdsRef.current.length === 1) {
          rotateSelected(selectedIdsRef.current[0]);
        }
      } else if ((e.key === "Delete" || e.key === "Backspace") && !brushRef.current.movingGroupIds && selectedIdsRef.current.length > 0) {
        demolishRef.current([...selectedIdsRef.current]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSheet,rotateSelected,commitBuildingEdit]);

  const resetTools=()=>{setFollowedService(undefined);setMapFocus(undefined);setDispatchTarget(undefined);setPendingWorks(null);setPendingRoadStroke(null);setBulkSelectMode(false);setQuickBuild(null);setQuickDrawerOpen(false);setWorksTool(null);setSheetState(null);setMorePage(null);setInspectorDetailOpen(false);setDeletedAnchor(null);setSelectionUndo(null);rendererRef.current?.followService();};

  // UI Handlers
  const handleSwitchMode = (mode: GameMode) => {
    if (!gate(productForMode(mode))) return false;
    resetTools();
    if(!saveActiveMode(stateRef.current))return false;
    const loaded = unlockSky(loadModeState(mode));
    if (!saveModeState(loaded)) return false;
    restoreIslandView(loaded);
    stateRef.current = loaded;
    setGameState(loaded);
    setSelectedIds([]);
    leaveNamedIsland();
    setBrush({kind: "none", level: 1, variantMode: -1, rotation: 0});
    autoProfileRef.current = createAutoCivProfile();
    setManagerDecision(null);
    setAutoLastAction("");
    setMapFocus(undefined);
    setIdlePaused(false);
    return true;
  };

  const handleStartTutorial = (mode: GameMode) => {
    clearTutorialTimer();
    if (stateRef.current.mode !== mode) {
      if (!handleSwitchMode(mode)) return;
    } else {
      resetTools();
      setSelectedIds([]);
      setBrush(idleBrush);
    }
    setSheetState(null);
    setActiveHeatmap("none");
    setTutorialState({ mode, stepIndex: 0, completed: false });
  };

  const handleSelectBrushDef = (defId: string | null) => {
    setWorksTool(null);
    setPendingRoadStroke(null);
    setBulkSelectMode(false);
    setQuickBuild(null);
    if (!defId) {setBrush(idleBrush);return;}
    setSelectedIds([]);
    setDeletedAnchor(null);
    setInspectorDetailOpen(false);
    setSelectionUndo(null);
    setSheetState(null);
    setBrush((b) => ({
      ...b,
      kind: "place",
      defId,
      faceManually:false,
      level: stateRef.current.mode === "god" ? Math.min(b.level, getMaxElementLevel(defId)) : 1,
      movingElementId: undefined,
    }));
  };

  const handleChangeCursorBehavior = (mode: CursorBehavior) => {
    setCursorBehavior(mode);
    if (mode === "select") setBrush(idleBrush);
  };

  const handleUpgradeSelected = (id: string) => {
    let upgraded = false;
    commitBuildingEdit("Upgrade building",(draft) => {
      const res = upgradeElementDirect(draft, id);
      if (!res.ok && res.reason) showToast({id:"upgrade",title:"Can't upgrade yet",subtitle:res.reason,tone:"alert"});
      else if (res.ok) upgraded = true;
    });
    if (upgraded) {
      setSelectionUndo(prev => ({ targetId: id, steps: (prev?.targetId === id ? prev.steps : 0) + 1 }));
    }
  };

  const handleUpgradeGroup = () => {
    commitBuildingEdit("Bulk upgrade",(draft) => {
      const result = upgradeGroup(draft, selectedIds);
      const skippedCount = [...result.skipped.values()].reduce((sum, count) => sum + count, 0);
      const reason = result.skipped.keys().next().value;
      const detail = [
        result.spent ? `$${result.spent.toLocaleString()} spent` : "",
        skippedCount ? `${skippedCount} skipped. ${reason}` : "",
      ].filter(Boolean).join(" · ");
      showToast({
        id: "bulk-upgrade",
        title: result.upgraded ? `Upgraded ${result.upgraded} ${result.upgraded === 1 ? "site" : "sites"}` : "No selected sites could upgrade",
        subtitle: detail,
        tone: result.upgraded ? undefined : "alert",
      });
    });
  };

  const startGroupMove = () => {
    const ids = new Set(selectedIds);
    for (const el of stateRef.current.elements) {
      if (!ids.has(el.id)) continue;
      const reason = groupMoveRestriction(stateRef.current, el);
      if (reason) {
        showToast({id: "bulk-move", title: "Selection cannot move", subtitle: reason, tone: "alert"});
        return;
      }
    }
    setBrush(brush => ({ ...idleBrush(brush), kind: "move", movingGroupIds: [...selectedIds] }));
  };

  const confirmGroupMove = () => {
    const { movingGroupIds, groupDestination } = brushRef.current;
    if (!movingGroupIds || !groupDestination) return;
    const plan = planGroupRelocation(stateRef.current, movingGroupIds, ...groupDestination);
    if (!plan.valid) {
      showToast({id: "bulk-move", title: "Move blocked", subtitle: plan.reason, tone: "alert"});
      return;
    }
    commitBuildingEdit("Bulk move", draft => { relocateGroup(draft, movingGroupIds, ...groupDestination); });
    setBrush(idleBrush);
    showToast({id: "bulk-move", title: `Moved ${plan.targets.length} ${plan.targets.length === 1 ? "item" : "items"}`});
  };

  const handleMaintainSelected = (id: string) => {
    commitState((draft) => {
      const site = draft.elements.find(element => element.id === id);
      if (!site) return;
      if (site.onFire) dispatchFire(draft,id);
      else if (maintainElement(draft,id)) {
        showToast({id:"maintenance",title:"Maintained " + (displayName(site.defId)),subtitle:"Full service restored for free."});
      }
    });
  };

  const handleMaintainAll = () => {
    commitState((draft) => {
      const fixed = maintainAllElements(draft);
      if (fixed === 0) showToast({id:"maint",title:"No buildings repaired",subtitle:"No maintenance is due. Burning buildings need a fire crew."});
      else showToast({id:"maint",title:`Maintained ${fixed} building${fixed > 1 ? "s" : ""}`,subtitle:"Service timers reset."});
    });
  };

  const handleGodMutateSelected = (
    id: string,
    patch: { level?: number; variant?: number; rotation?: number },
  ) => {
    let mutated = false;
    commitBuildingEdit("Change building",(draft) => {
      const el = draft.elements.find((item) => item.id === id);
      if (!el) return;
      if (patch.level !== undefined) {
        const crossing=draft.infrastructure?.spans[el.gx+","+el.gz];
        if (patch.level !== el.level && !(crossing&&!crossing.run.startsWith("junction-")?resizeCrossing(draft,el,patch.level):resizeElementForLevel(draft, el, patch.level))) {
          const [w, h] = getStandardFootprintForLevel(ELEMENT_BY_ID[el.defId], patch.level);
          showToast({id:"upgrade",title:"More room needed",subtitle:`Clear a ${w}×${h} site for this level.`,tone:"alert"});
          return;
        }
      }
      if (patch.variant !== undefined) el.variant = patch.variant;
      el.animProgress = 0.75;
      el.animKind = "upgrade";
      recomputeConnectivityAndMetrics(draft);
      mutated = true;
    });
    if (mutated) {
      setSelectionUndo(prev => ({ targetId: id, steps: (prev?.targetId === id ? prev.steps : 0) + 1 }));
    }
  };

  const demolish = (ids: string[]) => {
    const set = new Set(ids);
    const removed = stateRef.current.elements.filter((e) => set.has(e.id));
    if (removed.length === 0) return;
    if (bulkSelectModeRef.current) {
      const spans = stateRef.current.infrastructure?.spans;
      const runs = new Set(removed.map(el => spans?.[`${el.gx},${el.gz}`]?.run).filter(run => run && !run.startsWith("junction-")));
      if (runs.size && stateRef.current.elements.some(el => !set.has(el.id) && runs.has(spans?.[`${el.gx},${el.gz}`]?.run))) {
        showToast({id: "bulk-delete", title: "Select the entire crossing", subtitle: "A partial deletion would split the engineered deck.", tone: "alert"});
        return;
      }
    }
    const primary = removed[0];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const el of removed) {
      if (el.gx < minX) minX = el.gx;
      if (el.gx + el.spanX > maxX) maxX = el.gx + el.spanX;
      if (el.gz < minZ) minZ = el.gz;
      if (el.gz + el.spanZ > maxZ) maxZ = el.gz + el.spanZ;
    }
    commitBuildingEdit(removed.length > 1 ? `Remove ${removed.length} items` : "Remove building", (draft) => {
      removePlacedElements(draft, set);
      recomputeConnectivityAndMetrics(draft);
    });
    setSelectedIds([]);
    setBulkSelectMode(false);
    setInspectorDetailOpen(false);
    setDeletedAnchor({
      gx: minX,
      gz: minZ,
      spanX: Math.max(1, maxX - minX),
      spanZ: Math.max(1, maxZ - minZ),
      name: removed.length > 1 ? `${removed.length} items` : (ELEMENT_BY_ID[primary.defId]?.name ?? "building"),
      restoredId: primary.id,
    });
    setSelectionUndo((prev) => ({
      targetId: primary.id,
      steps: (prev?.targetId === primary.id ? prev.steps : 0) + 1,
    }));
  };
  demolishRef.current = demolish;

  const handleRingUndo = () => {
    const anchor = deletedAnchor;
    let restored = false;
    commitState((draft) => {
      const res = undoBuildingEdit(draft);
      if (res.ok) {
        restored = true;
        if (anchor && draft.elements.some((e) => e.id === anchor.restoredId)) {
          setSelectedIds([anchor.restoredId]);
        } else {
          setSelectedIds((ids) => ids.filter((id) => draft.elements.some((e) => e.id === id)));
        }
      }
    });
    if (restored) {
      if (anchor) setDeletedAnchor(null);
      setSelectionUndo((prev) => (prev && prev.steps > 1 ? { ...prev, steps: prev.steps - 1 } : null));
    }
  };

  const handleResetCurrentIsland = () => {
    resetTools();
    const previous = stateRef.current;
    const fresh = previous.exampleWorldId ? createExampleWorld(previous.exampleWorldId, previous.mode === "real" ? "real" : "god") : createInitialGameState(previous.mode);
    fresh.appearanceEra = previous.appearanceEra;
    fresh.showOriginalNames = previous.showOriginalNames;
    fresh.exampleReturnMode = previous.exampleReturnMode;
    restoreIslandView(fresh);
    stateRef.current = fresh;
    setGameState(fresh);
    saveActiveMode(fresh);
    setSelectedIds([]);
    setConfirmResetOpen(false);
    autoProfileRef.current = createAutoCivProfile();
    setManagerDecision(null);
    setAutoLastAction("");
    setMapFocus(undefined);
    setIdlePaused(false);
  };

  const handleManagerChoice = (choice: ManagerChoice) => {
    if (!managerDecisionRef.current || stateRef.current.mode !== "manager") return;
    managerDecisionRef.current = null;
    setManagerDecision(null);
    let outcome: AutoStepOutcome | undefined;
    commitState((draft) => {
      outcome = applyManagerChoice(draft, autoProfileRef.current, choice, (draft.autoCiv?.turn ?? 0) + 1);
    });
    if (outcome) showAutoAction(outcome);
  };

  const handleAddSaveSlot = async () => {
    try {
      const slots = await addCivilizationSlot();
      setSaveSlots(slots);
      setSlotError("");
      void autosync();
      return slots.length - 1;
    } catch (error) {
      setSlotError(error instanceof Error ? error.message : "The slot could not be added.");
    }
  };

  const handleSaveToSlot = async (slotIndex: number, name: string) => {
    const current = stateRef.current;
    if (activeSave.current?.index !== slotIndex && !saveActiveMode(current)) return;
    const savedName = name.trim() || `Civilization ${slotIndex + 1}`;
    try {
      persistNamedIsland(slotIndex, savedName, current);
      useNamedIsland(slotIndex, savedName);
      setSlotError("");
      setSaveSlots(loadSaveSlots());
      await flushDevice();
      showToast({id:"saved",title:`Autosaving “${savedName}”`});
      void autosync();
    } catch {
      setSlotError("The island could not be saved to this device.");
    }
  };

  const handleExportWorld = (slotIndex?: number) => {
    try {
      const slot = slotIndex === undefined ? undefined : loadSaveSlots()[slotIndex];
      if (slotIndex !== undefined && !slot) return;
      const current = !slot || activeSave.current?.index === slotIndex;
      if (current) captureView(stateRef.current);
      downloadWorld(slot?.name ?? activeSave.current?.name ?? "Current Civilization", current ? stateRef.current : slot.state);
      setSlotError("");
    } catch (error) {
      setSlotError(error instanceof Error ? error.message : "This world could not be exported.");
    }
  };

  const handleImportWorld = async (slotIndex: number, world: TransferWorld) => {
    try {
      const slots = await importWorldIntoSlot(slotIndex, world);
      setSaveSlots(slots);
      setSlotError("");
      if (linkedWorlds.includes(world)) {
        const url = new URL(location.href);
        const hash = new URLSearchParams(url.hash.slice(1));
        hash.delete("transfer");
        url.hash = hash.toString();
        history.replaceState(null, "", url);
        setLinkedWorlds([]);
      }
      void autosync();
      return true;
    } catch (error) {
      setSlotError(error instanceof Error ? error.message : "This world could not be saved.");
      return false;
    }
  };

  const handleLoadSlot = (slotIndex: number) => {
    resetTools();
    const slot = loadSaveSlots()[slotIndex];
    if (!slot || activeSave.current?.index === slotIndex) return;
    if (!slot.state.exampleWorldId && !gate(productForMode(slot.state.mode))) return;
    if(!saveActiveMode(stateRef.current))return;
    const restored = unlockSky(cloneGameStateSnapshot(slot.state));
    pushToast(restored, "stage", `Loaded "${slot.name}"`, `Restored Slot #${slotIndex + 1} · ${restored.population.toLocaleString()} pop`);
    try { writePlayerItem("pixel_civ_last_mode", "slot-" + slotIndex); }
    catch { setSlotError("The island could not be opened from device storage."); return; }
    useNamedIsland(slotIndex, slot.name);
    setSaveSlots(loadSaveSlots());
    scheduleAccountSync();
    restoreIslandView(restored);
    stateRef.current = restored;
    setGameState(restored);
    setSelectedIds([]);
    setBrush({kind: "none", level: 1, variantMode: -1, rotation: 0});
    setSavesModalOpen(false);
  };

  const handleRenameSlot = (slotIndex: number, name: string) => {
    try {
      const slots = renameCivilizationSlot(slotIndex,name);
      const slot = slots[slotIndex];
      if (slot && activeSave.current?.index === slotIndex) useNamedIsland(slotIndex, slot.name);
      setSaveSlots(slots);
      setSlotError("");
      scheduleAccountSync();
    }catch{setSlotError("The name could not be saved in browser storage.");}
  };

  const handleDeleteSlot = (slotIndex: number) => {
    if (activeSave.current?.index === slotIndex && !saveModeState(stateRef.current)) return;
    try{setSaveSlots(deleteCivilizationSlot(slotIndex));setSlotError("");}catch{setSlotError("The slot could not be removed from browser storage.");return;}
    if (activeSlotIndex === slotIndex) leaveNamedIsland();
    scheduleAccountSync();
  };
  // Clock, weather and wind are sandbox controls: in real and survival the sky runs on its own.
  const envLocked = () => stateRef.current.mode !== "god";
  const handleSetTimeOfDay = (hour: number) => {
    if (envLocked()) return;
    commitState((draft) => {
      draft.timeOfDay = hour;
      recomputeConnectivityAndMetrics(draft);
    });
  };

  const handleToggleTimeLocked = () => {
    if (envLocked()) return;
    commitState((draft) => {
      draft.timeLocked = !draft.timeLocked;
    });
  };

  const handleToggleDayNight = () => {
    const night = isNightTime(stateRef.current.timeOfDay ?? 10.5);
    handleSetTimeOfDay(night ? 12.0 : 23.0);
  };

  const handleSetWeather = (weather: WeatherKind) => {
    if (envLocked()) return;
    commitState((draft) => {
      draft.weather = weather;
      draft.weatherTimerSec = 55;
    });
  };

  const handleToggleWeatherLocked = () => {
    if (envLocked()) return;
    commitState((draft) => {
      draft.weatherLocked = !draft.weatherLocked;
    });
  };

  const handleSetWeatherIntensity = (val: number) => {
    commitState((draft) => {
      draft.weatherIntensity = val;
    });
  };

  const handleSetWindSpeed = (val: number) => {
    if (envLocked()) return;
    commitState((draft) => {
      draft.windSpeed = val;
    });
  };

  const handleTriggerLightning = () => {
    rendererRef.current?.triggerLightningStrike();
  };

  const handleLaunchAttack = (severity = attackSeverity) => {
    commitState((draft) => {
      launchIslandAttack(draft, severity);
    });
  };

  const handleClearAttack = () => {
    commitState((draft) => {
      draft.activeAttack = null;
    });
  };

  const handleToggleGodCrime = () => {
    commitState((draft) => {
      draft.godCrimeEnabled = !draft.godCrimeEnabled;
      if (!draft.godCrimeEnabled) {
        draft.crimeIncidents = [];
      }
      recomputeConnectivityAndMetrics(draft);
      pushToast(
        draft,
        draft.godCrimeEnabled ? "alert" : "merge",
        draft.godCrimeEnabled ? "Crime Enabled (God Mode)" : "Crime Disabled (God Mode)",
        draft.godCrimeEnabled
          ? "Burglars & police cruiser responses are now active."
          : "All crime & burglar animations turned off.",
      );
    });
  };

  const handleTriggerCrime = () => {
    commitState((draft) => {
      if (draft.mode === "god" && !draft.godCrimeEnabled) {
        draft.godCrimeEnabled = true;
        recomputeConnectivityAndMetrics(draft);
      }
      const ok = triggerCrimeIncident(draft, true);
      if (!ok) {
        pushToast(
          draft,
          "alert",
          "Cannot Trigger Crime",
          "Place a building first (or wait for one of the 4 active prowls to finish).",
        );
      }
    });
  };


  const selected=gameState.elements.find(e=>e.id===selectedIds[0]);
  const decorateSelected = selected && gameState.mode !== "idle" && canDecorateForChristmas(ELEMENT_BY_ID[selected.defId]) ? () => {
    const label = christmasActionLabel(selected);
    commitBuildingEdit(label, draft => {
      const el = draft.elements.find(site => site.id === selected.id);
      if (el) toggleChristmasDecorations(el, ELEMENT_BY_ID[el.defId]);
    });
    setSelectionUndo(prev => ({targetId:selected.id, steps:(prev?.targetId === selected.id ? prev.steps : 0) + 1}));
  } : undefined;
  const selectedDef=selected?ELEMENT_BY_ID[selected.defId]:undefined;
  const editCity=(fn:(draft:GameState)=>void,buildingEdit?:string)=>{
    const update=(draft:GameState)=>{fn(draft);recomputeConnectivityAndMetrics(draft);};
    if(buildingEdit)commitBuildingEdit(buildingEdit,update);
    else commitState(update);
  };
  const focusSite=(id:string)=>{
    setSelectedIds([id]);
    if (rendererRef.current) rendererRef.current.focusElement(id);
    else {
      const site=stateRef.current.elements.find(el=>el.id===id);
      if (site) setMapFocus([site.gx,site.gz]);
    }
  };
  const locateUnconnected = () => {
    const site = stateRef.current.elements.find(isUnconnectedBuilding);
    if (!site) return;
    openSheet(null);
    setSelectedIds([]);
    setFollowedService(undefined);

    const world = rendererRef.current;
    if (world) {
      if (cameraMode === "walk") {
        setCameraMode("pan");
        world.setCameraMode("pan");
      }
      setAutoSpin(false);
      world.setAutoSpin(false);
      world.focusElement(site.id, true);
    } else {
      setMapFocus(undefined);
      setMapBuildingPulse({ id: site.id, startedAt: performance.now() });
    }
  };
  const snapshot=(s:GameState)=>{
    try{writePlayerItem("pixel_civ_lab_snapshot",JSON.stringify({...s,toasts:[]}));setHasSnapshot(true);return true;}
    catch{showToast({id:"snap",title:"Snapshot could not be saved",subtitle:"Free a save slot or browser storage, then try again.",tone:"alert"});return false;}
  };
  const activateSandbox=(s:GameState)=>{
    if(!gate(productForMode("god")))return;
    if (!saveActiveMode(stateRef.current)) return;
    s.mode="god";s.gameOver=false;s.gameOverReason="";s.toasts=[];
    recomputeConnectivityAndMetrics(s);restoreIslandView(s);stateRef.current=s;setGameState(s);saveModeState(s);
    setSelectedIds([]);leaveNamedIsland();setWorksTool(null);rendererRef.current?.followService();openMore("god");
  };
  const activeExample = EXAMPLE_WORLDS.find(world => world.id === gameState.exampleWorldId);
  const openExamples = () => { setSheetState(null); setExamplesOpen(true); };
  const visitExample = (id: ExampleWorldId, mode: ExampleMode, viewIndex?: number, linkedEra?: string | null) => {
    const previous = stateRef.current;
    if (!saveActiveMode(previous)) return;
    const next = previous.exampleWorldId === id && previous.mode === mode ? { ...previous } : loadModeState(mode, id);
    if (viewIndex !== undefined) {
      next.exampleViewpoint = viewIndex;
      delete next.cameraView;
    }
    if (linkedEra != null && id.startsWith("rome-")) next.appearanceEra = normalizeEra(linkedEra);
    next.exampleReturnMode = previous.exampleReturnMode ?? previous.mode;
    if (!saveModeState(next)) return;
    stateRef.current = next;
    setGameState(next);
    setExamplesOpen(false);
    resetTools();
    setReturnLine(undefined); setSelectedIds([]); leaveNamedIsland();
    setBrush(idleBrush);
    restoreIslandView(next);
  };
  const followExampleLink = useEffectEvent(() => {
    const route = readExampleRoute(location.hash);
    if (route) visitExample(route.id, route.mode, route.viewIndex, new URLSearchParams(location.hash.slice(1)).get("era"));
  });
  useEffect(() => {
    const onHashChange = () => followExampleLink();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const openRailYard=()=>{
    try {
      const {state:next,depot}=visitPracticeRailway(stateRef.current);
      stateRef.current=next;
      setGameState(next);saveActiveMode(next);
      const site=next.elements.find(e=>e.id===depot)!;
      setSelectedIds([depot]);setCameraMode("pan");rendererRef.current?.setCameraMode("pan");
      rendererRef.current?.focusGrid(site.gx+5,site.gz-1,50);setRailSite(depot);
    } catch(error) {showToast({id:"yard",title:"Orchard Valley rail yard",subtitle:error instanceof Error?error.message:"The yard could not be opened.",tone:"alert"});}
  };
  const visitViewpoint = (index: number) => {
    if (!activeExample) return;
    const point = activeExample.viewpoints[index] ?? activeExample.camera;
    setCameraMode("pan"); rendererRef.current?.setCameraMode("pan");
    rendererRef.current?.focusGrid(point.gx,point.gz,point.zoom);
    commitState(draft => { draft.exampleViewpoint = index; });
  };
  const copyIsland=()=>{
    if(!gate(productForMode("god")))return;
    const current=stateRef.current;if(!saveActiveMode(current))return;
    if(!snapshot(loadModeState("god")))return;
    const sandbox = cloneGameStateSnapshot(current);
    delete sandbox.exampleWorldId;
    delete sandbox.exampleReturnMode;
    delete sandbox.exampleViewpoint;
    activateSandbox(sandbox);
  };
  const worksPreview=pendingWorks?planInfrastructureStroke(gameState,pendingWorks.tool,pendingWorks.points):null;
  const passagePreview=useMemo(()=>pendingWorks?previewWaterPassage(stateRef.current,pendingWorks.tool,pendingWorks.points):[],[pendingWorks,gameState.infrastructure?.stamp,gameState.elements.length]);
  const savedCount = saveSlots.filter(Boolean).length;

  const onHudStat=(stat:HudStat)=>{
    if(stat==="power"){setActiveHeatmap("power");openSheet("layers");return;}
    openCity(stat==="people"?"people":stat==="money"?"money":"issues");
  };
  const showPanel=(p:"transit"|"money"|"people")=>p==="transit"?openTransit():openCity(p);

  // Context layer: any specialized menu, sheet, tool, ring, or modal takes clean screen focus and hides outer chrome.
  const brushDef=brush.kind==="place"&&brush.defId?ELEMENT_BY_ID[brush.defId]:undefined;
  const movingEl=brush.kind==="move"?gameState.elements.find(e=>e.id===brush.movingElementId):undefined;
  const brushCost = brushDef ? constructionCost(gameState, brushDef) : 0;
  const roadStrokeStats = useMemo(() => {
    if (!pendingRoadStroke || pendingRoadStroke.points.length < 2) return null;
    const def = ELEMENT_BY_ID[pendingRoadStroke.defId];
    if (!def) return null;
    const virtualState: GameState = {
      ...gameState,
      elements: [...gameState.elements],
      money: gameState.money,
    };
    let validCount = 0;
    let totalCost = 0;
    for (const [index, pt] of pendingRoadStroke.points.entries()) {
      const plan = planConstruction(virtualState, def, pt.gx, pt.gz, brush.level, brush.rotation, brush.faceManually, strokeRoadAxis(pendingRoadStroke.points,index));
      if (!plan.valid) continue;
      const cost = plan.cost;
      virtualState.money -= cost;
      if (plan.replaceId) virtualState.elements = virtualState.elements.filter(el => el.id !== plan.replaceId);
      virtualState.elements.push({
        id: `preview-${validCount}`,
        defId: plan.def.id,
        gx: pt.gx,
        gz: pt.gz,
        spanX: plan.spanX,
        spanZ: plan.spanZ,
        rotation: plan.rotation,
        level: plan.level,
        variant: 0,
        connected: false,
        hasPoliceCover: false,
        hasFireCover: false,
        nuisancePenalty: 0,
        maintTimerSec: 0,
        disrepair: false,
        onFire: false,
        animProgress: 0,
        animKind: "place",
        roadAxis: plan.roadAxis,
      });
      validCount++;
      totalCost += cost;
    }
    return { def, validCount, totalCount: pendingRoadStroke.points.length, totalCost };
  }, [pendingRoadStroke, gameState, brush.level, brush.rotation, brush.faceManually]);

  const isBridgeConfirm = Boolean(
    pendingWorks && pendingWorks.tool.kind === "bridge" && worksPreview && worksPreview.points.length >= 2,
  );
  const pendingConfirm: PendingConfirmAction | null = roadStrokeStats
    ? {
        key: `road:${roadStrokeStats.def.id}:${pendingRoadStroke!.points.map((p) => `${p.gx},${p.gz}`).join(";")}`,
        label: `Build ${displayName(roadStrokeStats.def.id)} · ${roadStrokeStats.validCount} tiles`,
        sublabel:
          roadStrokeStats.validCount > 0
            ? (roadStrokeStats.totalCost > 0 ? `$${roadStrokeStats.totalCost.toLocaleString()}` : "Free")
            : "No tiles can be built along this route",
        valid: roadStrokeStats.validCount > 0,
        onConfirm: handleConfirmRoadStroke,
      }
    : isBridgeConfirm && pendingWorks && worksPreview
      ? {
          key: `bridge:${pendingWorks.points.map((p) => `${p.gx},${p.gz}`).join(";")}`,
          label: `Build ${worksPreview.points.length}-tile bridge`,
          sublabel: worksPreview.valid
            ? (worksPreview.cost > 0 ? `$${worksPreview.cost.toLocaleString()}` : "Free")
            : worksPreview.reason,
          valid: worksPreview.valid,
          onConfirm: () => {
            const edit = pendingWorks;
            editCity((st) => {
              const p = applyInfrastructureStroke(st, edit.tool, edit.points);
              if (!p.valid) pushToast(st, "alert", "Public works", p.reason);
            }, "Build bridge");
            setPendingWorks(null);
          },
        }
      : null;

  const placing=!!(brushDef||movingEl||brush.movingGroupIds||worksTool||pendingWorks||dispatchTarget);
  const mapTile = ({gx,gz}:GridPoint) => {
    if (dispatchTarget) {
      commitState(draft=>dispatchVessel(draft,dispatchTarget,"sail",[gx,gz]));
      setDispatchTarget(undefined);
      openTransit();
      return;
    }
    setInspectPoint({gx,gz});
    const hit = stateRef.current.elements.find(el=>gx>=el.gx && gx<el.gx+el.spanX && gz>=el.gz && gz<el.gz+el.spanZ);
    if (bulkSelectMode && hit) {
      const isRoad = ELEMENT_BY_ID[hit.defId]?.isNetwork;
      if (bulkFilter==="all" || (bulkFilter==="roads" ? isRoad : !isRoad)) handleBulkSelectElements([hit.id],"toggle");
      return;
    }
    if (hit) handleSelectElement(hit.id);
    else if (!bulkSelectMode) handleSelectElement(null);
  };
  const mapStroke = (points:GridPoint[]) => {
    if (pendingWorks || pendingRoadStroke || !points.length) return;
    const first=points[0];
    if (worksTool) setPendingWorks({tool:worksTool,points});
    else if (brush.movingGroupIds) setBrush(current=>({...current,groupDestination:[first.gx,first.gz]}));
    else if (movingEl) handleTileMoveCommit(movingEl.id,first.gx,first.gz);
    else if (brushDef) {
      if (!brushDef.isNetwork) {
        handleTilePlace(first.gx,first.gz);
        return;
      }
      const route:GridPoint[]=[{gx:first.gx,gz:first.gz}];
      for (const next of points.slice(1)) {
        let {gx,gz}=route.at(-1)!;
        while (gx!==next.gx || gz!==next.gz) {
          if (Math.abs(next.gx-gx)>=Math.abs(next.gz-gz)) gx+=Math.sign(next.gx-gx);
          else gz+=Math.sign(next.gz-gz);
          route.push({gx,gz});
        }
      }
      if (route.length>1) handlePendingNetworkStroke({defId:brushDef.id,points:route});
      else handleTilePlace(first.gx,first.gz);
    }
  };
  const showQuickBuildRing = Boolean(
    !mapFallback && quickBuild &&
      !sheet &&
      !inspectorDetailOpen &&
      !guideModal &&
      !pixModal.open &&
      !placing &&
      !bulkSelectMode &&
      !pendingConfirm &&
      selectedIds.length === 0 &&
      !deletedAnchor,
  );
  const quickCategories = useMemo(
    () =>
      showQuickBuildRing && quickBuild && quickBuildMode === "adaptive"
        ? recommendQuickCategories(gameState, quickBuild.gx, quickBuild.gz, buildHabits, 6, quickMenuPrefs.smartFocus)
        : [],
    [showQuickBuildRing, quickBuild, quickBuildMode, gameState, buildHabits, quickMenuPrefs.smartFocus],
  );
  const quickElements = useMemo(
    () =>
      showQuickBuildRing && quickBuildMode === "adaptive" && quickBuild?.category
        ? recommendQuickElements(
            gameState,
            quickBuild.category,
            quickBuild.gx,
            quickBuild.gz,
            buildHabits,
            6,
            quickMenuPrefs.smartFocus,
          )
        : [],
    [showQuickBuildRing, quickBuildMode, quickBuild, gameState, buildHabits, quickMenuPrefs.smartFocus],
  );
  const quickInstantElements = useMemo(
    () =>
      showQuickBuildRing && quickBuild && quickBuildMode === "instant"
        ? recommendInstantQuickElements(
            gameState,
            quickBuild.gx,
            quickBuild.gz,
            buildHabits,
            6,
            quickMenuPrefs.smartFocus,
          )
        : [],
    [showQuickBuildRing, quickBuild, quickBuildMode, gameState, buildHabits, quickMenuPrefs.smartFocus],
  );
  const quickTreeElements = useMemo(
    () =>
      showQuickBuildRing && quickBuildMode === "tree" && quickBuild?.treeParentId && quickBuild?.treeSubId
        ? getDecisionTreeLeafElements(
            gameState,
            quickBuild.treeParentId,
            quickBuild.treeSubId,
            quickBuild.gx,
            quickBuild.gz,
          )
        : [],
    [showQuickBuildRing, quickBuildMode, quickBuild, gameState],
  );
  const showSelectionRing = Boolean(
    !showQuickBuildRing &&
      !sheet &&
      !inspectorDetailOpen &&
      !guideModal &&
      !pixModal.open &&
      ((!mapFallback && pendingConfirm) ||
        (!bulkSelectMode && !placing && (selectedIds.length > 1 || (selected && selectedDef) || deletedAnchor))),
  );
  const showInspector=!!(selected&&selectedDef&&inspectorDetailOpen&&!sheet&&!placing&&!bulkSelectMode&&!guideModal&&!pixModal.open);
  const ringOpen = Boolean(showQuickBuildRing || showSelectionRing);
  const hardHideChrome = Boolean(
    showInspector ||
      bulkSelectMode ||
      pendingRoadStroke ||
      placing ||
      railSite ||
      examplesOpen ||
      savesModalOpen ||
      guideModal ||
      pixModal.open ||
      confirmResetOpen ||
      gameState.gameOver,
  );
  const inFocusMenu = Boolean(ringOpen || hardHideChrome);
  const projectFallbackRing = useCallback((position: SelectionRingProjection | null) => {
    ringObserverRef.current?.(position);
  }, []);
  const hideChrome = hardHideChrome;
  const issues=alertIssues(gameState);
  const showAlert=!hideChrome&&!ringOpen&&!quickDrawerOpen&&!sheet&&issues.length>0;
  const repairNotice = uiToasts.find(toast => toast.id === "maintenance");
  const gameToasts:UiToast[]=gameState.toasts.map(t=>({id:t.id,title:t.title,subtitle:t.subtitle,tone:t.kind==="stage"?"gold":t.kind==="raid"||t.kind==="alert"?"alert":"normal"}));
  const layerName=LAYERS.find(l=>l.id===activeHeatmap)?.label;
  const hoverBad=brush.kind!=="none"&&hoverInfo&&!hoverInfo.valid?hoverInfo.reason:undefined;
  const sheetProps={height:sheetHeight,onHeight:setSheetHeight,onClose:()=>openSheet(null)};
  const ringCanUndo = Boolean(
    (deletedAnchor && selectionUndo && selectionUndo.steps > 0) ||
      (selected && selectionUndo?.targetId === selected.id && selectionUndo.steps > 0),
  );
  const selectedHasNetwork = useMemo(
    () => selectedIds.some((id) => {
      const el = gameState.elements.find((e) => e.id === id);
      const d = el ? ELEMENT_BY_ID[el.defId] : undefined;
      return Boolean(d?.isRoadNetwork || d?.isRailNetwork);
    }),
    [selectedIds, gameState.elements],
  );
  const canManualEdit = gameState.mode !== "idle" && gameState.mode !== "manager";
  const startBulkSelect = (initialFilter: BulkSelectFilter = "all", keepSelection = false) => {
    setSheetState(null);
    setWorksTool(null);
    setPendingWorks(null);
    setPendingRoadStroke(null);
    setQuickBuild(null);
    setQuickDrawerOpen(false);
    setBrush(idleBrush);
    setDeletedAnchor(null);
    setInspectorDetailOpen(false);
    setSelectionUndo(null);
    if (!keepSelection) setSelectedIds([]);
    setBulkFilter(initialFilter);
    setBulkSelectMode(true);
  };

  const worksPanel=<>
    {returnLine&&<Button variant="quiet" small label={"← Back to "+returnLine.replace("line-","service #")} onClick={openTransit}/>}
    <InfrastructurePanel onUseMap={t=>{setWorksTool(t);setSheetState(null);}} state={gameState} mutate={editCity} selected={selected}
      onPreview={(tool,points)=>{setPendingWorks({tool,points});setSheetState(null);}} inspectPoint={inspectPoint} tool={worksTool}
      onToolChange={t=>{setPendingWorks(null);setWorksTool(t);}} onClose={()=>openSheet(null)}/>
  </>;

  const activeTutorialStep = tutorialState ? TUTORIAL_FLOWS[tutorialState.mode][tutorialState.stepIndex] ?? null : null;
  const showTutorialOverlay = Boolean(
    tutorialState &&
      activeTutorialStep &&
      !guideModal &&
      !savesModalOpen &&
      !examplesOpen &&
      !confirmResetOpen &&
      !gameState.gameOver,
  );
  const showHud = !hideChrome && (!activeTutorialStep || activeTutorialStep.showHud);
  const openPixStudio = (tab?: PixTab) => {
    setSheetState(null);
    setQuickBuild(null);
    setQuickDrawerOpen(false);
    const defaultTab: PixTab = tab ?? (gameState.mode === "idle" || gameState.mode === "manager" ? "advise" : "element");
    setPixModal({ open: true, tab: defaultTab });
  };
  const quickDrawerItems = useMemo(
    () =>
      recommendQuickDrawerActions(
        gameState,
        {
          quickBuildMode,
          quickMenuPrefs,
          bulkSelectMode,
          canManualEdit,
          simSpeed,
          activeHeatmap,
          autoSpin,
          canUndo: Boolean(gameState.constructionHistory?.length),
        },
        quickDrawerHabits,
        7,
        quickDrawerPrefs,
      ),
    [
      gameState,
      quickBuildMode,
      quickMenuPrefs,
      bulkSelectMode,
      canManualEdit,
      simSpeed,
      activeHeatmap,
      autoSpin,
      quickDrawerHabits,
      quickDrawerPrefs,
    ],
  );
  const handlePickQuickDrawerItem = useCallback(
    (item: QuickDrawerItem) => {
      trackDrawerAction(item.id, 1);
      switch (item.id) {
        case "bulk_select":
          if (bulkSelectMode) {
            setBulkSelectMode(false);
            setSelectedIds([]);
          } else {
            startBulkSelect("all", false);
          }
          break;
        case "mode_smart":
          handleChangeQuickBuildMode("adaptive");
          break;
        case "mode_quick":
          handleChangeQuickBuildMode("instant");
          break;
        case "mode_exact":
          handleChangeQuickBuildMode("tree");
          break;
        case "mode_sculpt":
          handleChangeQuickBuildMode("sculpt");
          break;
        case "sim_speed": {
          const nextSpd = simSpeed === 0 ? 1 : simSpeed === 1 ? 2 : simSpeed === 2 ? 4 : 0;
          setSimSpeed(nextSpd);
          break;
        }
        case "undo":
          handleUndoBuilding();
          break;
        case "city_issues":
          openCity("issues");
          break;
        case "repair_all":
          handleMaintainAll();
          break;
        case "camera_recenter":
          rendererRef.current?.recentreCamera();
          break;
        case "camera_orbit":
          setAutoSpin((s) => !s);
          break;
        case "heatmap_power":
          setActiveHeatmap((h) => (h === "power" ? "none" : "power"));
          break;
        case "heatmap_water":
          setActiveHeatmap((h) => (h === "water" ? "none" : "water"));
          break;
        case "heatmap_safety":
          setActiveHeatmap((h) => (h === "police" ? "none" : "police"));
          break;
        case "heatmap_traffic":
          setActiveHeatmap((h) => (h === "traffic" ? "none" : "traffic"));
          break;
        case "public_works":
          openWorks();
          break;
        case "save_slots":
          setSheetState(null);
          setSlotError("");
          setSavesModalOpen(true);
          break;
        case "handbook":
          setSheetState(null);
          setGuideModal({ kind: "unified", atlasRoute: { tab: "course" } });
          break;
        case "pix_advise":
          openPixStudio("advise");
          break;
        case "quick_edit_order": {
          const curP = quickMenuPrefsRef.current;
          handleChangeQuickMenuPrefs({
            ...curP,
            quickEdit: {
              ...curP.quickEdit,
              orderMode: curP.quickEdit.orderMode === "adaptive" ? "fixed" : "adaptive",
            },
          });
          break;
        }
        case "after_place_qe": {
          const curP = quickMenuPrefsRef.current;
          handleChangeQuickMenuPrefs({
            ...curP,
            openQuickEditAfterPlace: !curP.openQuickEditAfterPlace,
          });
          break;
        }
        case "build_focus": {
          const curP = quickMenuPrefsRef.current;
          const order: SmartBuildFocus[] = ["balanced", "needs", "habits", "local"];
          const nextFocus = order[(order.indexOf(curP.smartFocus) + 1) % order.length];
          handleChangeQuickMenuPrefs({ ...curP, smartFocus: nextFocus });
          break;
        }
        case "weather_cycle": {
          const wOrder: WeatherKind[] = ["clear", "cloudy", "rain", "storm"];
          const curW = stateRef.current.weather;
          handleSetWeather(wOrder[(wOrder.indexOf(curW) + 1) % wOrder.length]);
          break;
        }
        case "day_night": {
          const hr = stateRef.current.timeOfDay;
          const currentlyNight = hr < 6 || hr >= 19;
          handleSetTimeOfDay(currentlyNight ? 12 : 22.5);
          break;
        }
        case "game_mode":
          openMore("mode");
          break;
        case "settings":
          openSettings();
          break;
      }
      if (!item.stayOpen) {
        setQuickDrawerOpen(false);
      }
    },
    [
      bulkSelectMode,
      handleChangeQuickBuildMode,
      handleChangeQuickMenuPrefs,
      handleMaintainAll,
      handleSetTimeOfDay,
      handleSetWeather,
      handleUndoBuilding,
      openCity,
      openMore,
      openSettings,
      openWorks,
      setSimSpeed,
      simSpeed,
      startBulkSelect,
      trackDrawerAction,
    ],
  );
  const currentStageMeta = STAGES[Math.max(0, Math.min(STAGES.length - 1, gameState.currentStage - 1))];
  const autoVisibleNav: NavSheet[] | undefined = activeTutorialStep?.visibleNav
    ?? (gameState.mode === "idle" || gameState.mode === "manager" ? ["layers", "city", "more"] : undefined);

  const activeSheetKey = showInspector && selected && selectedDef
    ? `inspector:${selected.id}`
    : sheet
      ? `sheet:${sheet}${sheet === "more" && morePage === "settings" ? ":settings" : ""}`
      : null;

  return (
    <EraPresentation.Provider value={{era: displayedEra, originalNames: gameState.showOriginalNames === true}}>
    <EraThumbnailContext.Provider value={displayedEra}>
    <main className={"island-app relative h-screen w-screen overflow-hidden select-none bg-[#c2e9ff]"+(showAlert?" has-alert":"")+(inFocusMenu?" has-focus-menu":"")+(ringOpen?" is-ring-open":"")}>
      {mapFallback
        ? <IslandMapFallback key={gameState.mode + (gameState.exampleWorldId ?? "")} state={gameState} focus={gameState.mode === "idle" && !followGrowth ? undefined : mapFocus} buildingPulse={mapBuildingPulse}
            startAt={activeExample?.viewpoints[gameState.exampleViewpoint ?? -1] ?? activeExample?.camera}
            following={followedService} onStopFollowing={()=>setFollowedService(undefined)} heatmap={activeHeatmap} draw={Boolean(worksTool || brushDef || movingEl || brush.movingGroupIds)} onStroke={mapStroke} onTap={dismissMapPanel} onInspect={mapTile}
            ringTarget={showSelectionRing ? deletedAnchor ?? selected : undefined} onRingProjection={projectFallbackRing} />
        : <canvas ref={canvasRef} className="block h-full w-full cursor-crosshair touch-none" aria-label="Pixel Civilization 3D Voxel Island" />}

      {showHud && (
        <Hud
          state={gameState}
          speed={simSpeed}
          hiddenForRing={ringOpen}
          onStat={(s) => {
            setQuickDrawerOpen(false);
            onHudStat(s);
          }}
          onOpenPix={() => openPixStudio()}
          quickDrawerOpen={quickDrawerOpen && !ringOpen}
          quickDrawerManual={quickDrawerPrefs.mode === "manual"}
          bulkSelectActive={bulkSelectMode}
          drawerItems={quickDrawerItems}
          onToggleQuickDrawer={() => {
            setQuickBuild(null);
            setQuickDrawerOpen((o) => !o);
          }}
          onPickDrawerItem={handlePickQuickDrawerItem}
          onCustomizeQuickDrawer={() => {
            setQuickDrawerOpen(false);
            setFocusQuickDrawerConfig((c) => c + 1);
            openSettings();
            setSheetHeight("half");
          }}
        />
      )}
      {!hideChrome && !ringOpen && gameState.mode === "idle" && (
        <IdleModeBanner
          stage={gameState.currentStage}
          stageName={eraStageTreatment(gameState.showOriginalNames ? "original" : displayedEra, currentStageMeta.stage).name}
          lastAction={autoLastAction}
          paused={idlePaused}
          followGrowth={followGrowth}
          onToggleFollow={() => {
            if (followGrowth) rendererRef.current?.stopWatchingConstruction();
            setFollowGrowth(value => !value);
          }}
          onTogglePause={() => setIdlePaused((p) => !p)}
        />
      )}
      {!hideChrome && !ringOpen && gameState.mode === "manager" && managerDecision && (
        <ManagerDecisionCard
          decision={managerDecision}
          lastAction={autoLastAction}
          onChoose={handleManagerChoice}
        />
      )}
      {showTutorialOverlay && tutorialState && activeTutorialStep && (
        <TutorialOverlay
          mode={tutorialState.mode}
          step={activeTutorialStep}
          stepIndex={tutorialState.stepIndex}
          totalSteps={TUTORIAL_FLOWS[tutorialState.mode].length}
          completedStep={tutorialState.completed}
          belowHud={showHud && !ringOpen}
          onNext={advanceTutorial}
          onExit={() => stopTutorial(false)}
        />
      )}
      {showAlert&&<AlertPill issues={issues} onOpen={()=>openCity("issues")}/>}
      {(saveError || deviceNotice)&&<p className="storage-notice" role="alert">{deviceNotice || "This island could not be saved. Keep the game open while you free device storage."}</p>}
      {!hideChrome && !ringOpen && gameState.activeAttack&&<div className="ui-banner" role="alert">
        <ShieldAlert size={18} aria-hidden="true"/>
        <span style={{flex:1}}>{gameState.activeAttack.units.length} enemies · {gameState.activeAttack.defenders.length} defenders
          {gameState.activeAttack.defenders.length?"":" · no defenders!"} · lost {gameState.activeAttack.buildingsDestroyed}</span>
        {gameState.mode==="god"&&<Button small label="Stop" onClick={handleClearAttack}/>}
      </div>}
      {!hideChrome && !ringOpen
        ? <Toasts items={[...uiToasts,...gameToasts]} onDismiss={dismissToast}/>
        : repairNotice && (showSelectionRing || showInspector) &&
          <Toasts items={[repairNotice]} onDismiss={dismissToast}/>}

      {!hideChrome && !ringOpen && activeExample && !sheet && !showInspector && !placing &&
        <WorldGuide key={activeExample.id} world={activeExample} selected={gameState.exampleViewpoint} onVisit={visitViewpoint} onBrowse={openExamples} onRailYard={openRailYard}/>}
      {!hideChrome && !ringOpen && activeHeatmap!=="none"&&!sheet&&!placing&&!showInspector&&!activeExample&&<div className="ui-layer-chip">
        <button type="button" onClick={()=>openSheet("layers")} aria-label={"Layer: "+layerName+". Open Layers"}><Layers size={16} aria-hidden="true"/>{layerName}</button>
        <IconButton variant="quiet" aria-label="Clear layer" icon={<X size={16}/>} onClick={()=>setActiveHeatmap("none")}/>
      </div>}

      {/* Context layer */}
      {brushDef&&<PlacementBar label="Placing" def={brushDef} title={eraElementName(brushDef.id,gameState.showOriginalNames ? "original" : displayedEra)+(gameState.mode==="god"?" · Lv "+brush.level:"")}
        subtitle={(brushCost?"$"+brushCost.toLocaleString()+(brushDef.isNetwork?" / tile":" each"):"Free")+(placeStats?.defId===brushDef.id?" · "+placeStats.count+" placed"+(placeStats.spent?" = $"+placeStats.spent.toLocaleString():""):"")}
        hint={
          pendingRoadStroke
            ? (mapFallback ? undefined : "Tap ✓ above the road stretch to build · Tap anywhere else to cancel")
            : hoverBad ??
              (brushDef.isRoadNetwork
                ? (mapFallback ? "Tap to place a tile · Drag to draw a route" : "Tap to place a tile · Drag to draw a route, then tap ✓")
                : hintsLeft > 0
                  ? (brushDef.isNetwork || cursorBehavior === "place"
                      ? "Tap or drag to draw · 2-finger pan/zoom · Space+drag or Right-drag camera · ✓ done"
                      : "Tap map to place · 2-finger pan/zoom")
                  : undefined)
        }
        hintBad={!!hoverBad && !pendingRoadStroke}>
        {!brushDef.isNetwork&&<IconButton aria-label="Rotate 90° (R)" icon={<RotateCw size={18}/>} onClick={()=>setBrush(b=>({...b,rotation:(b.rotation+1)%4,faceManually:true}))}/>}
        {gameState.mode==="god"&&<span className="ui-level" role="group" aria-label="Placement level">
          <IconButton variant="quiet" aria-label="Lower placement level" icon={<Minus size={16}/>} disabled={brush.level<=1} onClick={()=>setBrush(b=>({...b,level:Math.max(1,b.level-1)}))}/>
          <span>Lv{brush.level}</span>
          <IconButton variant="quiet" aria-label="Raise placement level" icon={<Plus size={16}/>} disabled={brush.level>=getMaxElementLevel(brushDef.id)} onClick={()=>setBrush(b=>({...b,level:Math.min(getMaxElementLevel(brushDef.id),b.level+1)}))}/>
        </span>}
        <IconButton variant="primary" aria-label="Done placing" icon={<Check size={20}/>} onClick={()=>{setPendingRoadStroke(null);setBrush(idleBrush);}}/>
      </PlacementBar>}
      {movingEl&&<PlacementBar label="Moving" def={ELEMENT_BY_ID[movingEl.defId]} title={"Moving "+ELEMENT_BY_ID[movingEl.defId].name} subtitle="Tap a free spot on the map" hint={hoverBad} hintBad={!!hoverBad}>
        <Button label="Cancel" onClick={()=>setBrush(idleBrush)}/>
      </PlacementBar>}
      {worksTool&&!pendingWorks&&sheet!=="sculpt"&&(()=>{
        const isVoxelBrush = isVoxelSculptTool(worksTool);
        const radius = isVoxelBrush ? effectiveVoxelRadius(worksTool) : 0;
        const diam = radius * 2 + 1;
        const meters = (diam * VOXEL_PITCH).toFixed(2);
        const stepRadius = (dir: -1 | 1) => {
          const steps = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32];
          const curIdx = steps.findIndex((s) => s >= radius);
          const idx = curIdx === -1 ? steps.length - 1 : curIdx;
          const next = steps[Math.max(0, Math.min(steps.length - 1, idx + dir))];
          setWorksTool((t) => (t ? { ...t, precision: "voxel", voxelRadius: next } : t));
        };
        const isTerrainFlip = worksTool.kind === "raise" || worksTool.kind === "lower" || worksTool.kind === "smooth";
        return (
          <PlacementBar
            label="Sculpt"
            title={worksToolLabel(worksTool.kind)}
            subtitle={
              worksTool.kind === "bridge"
                ? (mapFallback ? "Drag from one bank to the other" : "Drag from one bank to the other, then tap ✓")
                : isVoxelBrush
                  ? `${diam} vox (${meters}m) · Drag to sculpt${mapFallback ? " · Shift+drag to pan" : " · 2-finger pan/zoom"}`
                  : mapFallback ? "Drag to draw · Shift+drag to pan" : "Drag on the map · 2-finger or Space+drag to move camera"
            }
          >
            {isTerrainFlip && (
              <span className="ui-sculpt-quick" role="group" aria-label="Quick sculpt mode">
                <IconButton variant={worksTool.kind === "raise" ? "primary" : "quiet"} aria-label="Raise land" icon={<ArrowUp size={15} />} onClick={() => setWorksTool((t) => (t ? { ...t, kind: "raise", precision: "voxel" } : t))} />
                <IconButton variant={worksTool.kind === "lower" ? "primary" : "quiet"} aria-label="Lower land" icon={<ArrowDown size={15} />} onClick={() => setWorksTool((t) => (t ? { ...t, kind: "lower", precision: "voxel" } : t))} />
                <IconButton variant={worksTool.kind === "smooth" ? "primary" : "quiet"} aria-label="Smooth grade" icon={<Waves size={15} />} onClick={() => setWorksTool((t) => (t ? { ...t, kind: "smooth", precision: "voxel" } : t))} />
              </span>
            )}
            {isVoxelBrush && (
              <span className="ui-level" role="group" aria-label="Brush voxel size">
                <IconButton variant="quiet" aria-label="Smaller brush" icon={<Minus size={15} />} disabled={radius <= 0} onClick={() => stepRadius(-1)} />
                <span>{diam}v</span>
                <IconButton variant="quiet" aria-label="Larger brush" icon={<Plus size={15} />} disabled={radius >= 32} onClick={() => stepRadius(1)} />
              </span>
            )}
            <IconButton
              variant="quiet"
              aria-label="Undo last sculpt"
              icon={<Undo2 size={16} />}
              disabled={!gameState.infrastructure?.undo.length}
              onClick={() => editCity((d) => { undoInfrastructure(d); })}
            />
            <Button small label="Tools" onClick={openWorks} />
            <IconButton variant="primary" aria-label="Done sculpting" icon={<Check size={20} />} onClick={() => setWorksTool(null)} />
          </PlacementBar>
        );
      })()}
      {mapFallback && pendingConfirm && <div className="ui-placebar is-works" role="toolbar" aria-label="Confirm construction">
        <span className="ui-icard-body"><span className="ui-icard-title">{pendingConfirm.label}</span>
          <span className="ui-icard-sub">{pendingConfirm.sublabel}</span></span>
        <Button label="Cancel" small onClick={handleCancelPendingStroke}/>
        <Button label="Build" small variant="primary" disabled={!pendingConfirm.valid} onClick={pendingConfirm.onConfirm}/>
      </div>}
      {pendingWorks&&worksPreview&&isBridgeConfirm&&!mapFallback&&(
        <p className={"ui-placebar-hint" + (worksPreview.valid ? "" : " is-bad")} role={worksPreview.valid ? "status" : "alert"}>
          {worksPreview.valid
            ? `Tap ✓ above the ${worksPreview.points.length}-tile bridge to build · Tap anywhere else to cancel`
            : `${worksPreview.reason} · Tap anywhere to cancel`}
        </p>
      )}
      {pendingWorks&&worksPreview&&!isBridgeConfirm&&<div className="ui-placebar is-works" role="toolbar" aria-label="Confirm works">
        <span className="ui-icard-body"><span className="ui-icard-title">{worksToolLabel(pendingWorks.tool.kind)} · {worksPreview.points.length} tiles</span>
          <span className={"ui-icard-sub"+(worksPreview.valid?"":" is-bad")}>{worksPreview.valid?("$"+worksPreview.cost.toLocaleString()+" · "+worksPreview.affected.length+" sites affected"):worksPreview.reason}</span></span>
        <Button label="Cancel" small onClick={()=>setPendingWorks(null)}/>
        <Button variant="primary" small label="Apply" disabled={!worksPreview.valid} onClick={()=>{const edit=pendingWorks;editCity(st=>{const p=applyInfrastructureStroke(st,edit.tool,edit.points);if(!p.valid)pushToast(st,"alert","Public works",p.reason);});setPendingWorks(null);}}/>
        {worksPreview.valid&&passagePreview.length>0&&<small>{passagePreview.join(" ")}</small>}
      </div>}
      {dispatchTarget&&<PlacementBar label="Send vessel" title="Choose a destination" subtitle="Tap the water where this vessel should sail">
        <Button label="Cancel" onClick={()=>{setDispatchTarget(undefined);openTransit();}}/>
      </PlacementBar>}

      {bulkSelectMode && (
        <div className="ui-placebar ui-bulkbar" role="toolbar" aria-label="Bulk actions">
          {brush.movingGroupIds ? (
            <>
              <p className="ui-bulk-hint" role="status">
                {brush.groupDestination
                  ? hoverInfo?.valid ? "Destination ready. Tap another tile to change it." : hoverInfo?.reason ?? "Checking destination…"
                  : "Tap a destination for the first selected item. Everything else keeps its spacing."}
              </p>
              <div className="ui-bulk-actions">
                <Button small label="Cancel" onClick={() => setBrush(idleBrush)} />
                <Button small variant="primary" label="Confirm move"
                  disabled={!brush.groupDestination || !hoverInfo?.valid ||
                    hoverInfo.gx !== brush.groupDestination[0] || hoverInfo.gz !== brush.groupDestination[1]}
                  onClick={confirmGroupMove} />
              </div>
            </>
          ) : (
            <>
              <p className="ui-bulk-hint" role="status">{selectedIds.length
                ? `${selectedIds.length} ${selectedIds.length === 1 ? "item" : "items"} selected`
                : "Draw across the map or tap items to select."}</p>
              <div className="ui-bulk-filters" role="group" aria-label="Selection filter">
                {(["all", "roads", "buildings"] as BulkSelectFilter[]).map(f => (
                  <button key={f} type="button" className="ui-bulk-chip" aria-pressed={bulkFilter === f}
                    onClick={() => setBulkFilter(f)}>
                    {f === "all" ? "All" : f === "roads" ? "Roads" : "Buildings"}
                  </button>
                ))}
                {selectedHasNetwork && <button type="button" className="ui-bulk-chip is-accent"
                  onClick={handleSelectConnectedRoads}>Connected</button>}
              </div>
              <div className="ui-bulk-actions">
                <Button small icon={<ArrowUp size={15} />} label="Upgrade" disabled={!selectedIds.length} onClick={handleUpgradeGroup} />
                <Button small icon={<Move size={15} />} label="Move" disabled={!selectedIds.length} onClick={startGroupMove} />
                <Button small variant="danger" icon={<Trash2 size={15} />} label="Delete" disabled={!selectedIds.length}
                  onClick={() => demolish(selectedIds)} />
                {gameState.constructionHistory?.at(-1)?.label.startsWith("Bulk ") &&
                  <Button small variant="quiet" icon={<Undo2 size={15} />} label="Undo" onClick={handleUndoBuilding} />}
                {selectedIds.length > 0 && <Button small variant="quiet" label="Clear" onClick={() => setSelectedIds([])} />}
                <IconButton variant="primary" aria-label="Done bulk selecting" icon={<Check size={19} />}
                  onClick={() => {setBulkSelectMode(false);setSelectedIds([]);}} />
              </div>
            </>
          )}
        </div>
      )}

      {showQuickBuildRing && quickBuild && (
        <QuickBuildRing
          mode={quickBuildMode}
          state={gameState}
          tileKey={`${quickBuild.gx},${quickBuild.gz}`}
          selectedCategory={quickBuild.category}
          categories={quickCategories}
          elements={quickElements}
          instantElements={quickInstantElements}
          treeParentId={quickBuild.treeParentId}
          treeSubId={quickBuild.treeSubId}
          treeElements={quickTreeElements}
          exactParentOrder={quickMenuPrefs.exactParentOrder}
          quickSculptPrefs={quickMenuPrefs.quickSculpt}
          canUndoSculpt={Boolean(gameState.infrastructure?.undo.length)}
          onPickSculptTool={(toolId: QuickSculptToolId) => {
            const qs = quickMenuPrefsRef.current.quickSculpt;
            const base = defaultSculptTool(toolId);
            const configured: InfrastructureTool = isVoxelSculptTool(base)
              ? {
                  ...base,
                  precision: "voxel",
                  voxelRadius: qs.voxelRadius,
                  strength: qs.strength,
                  ...(toolId === "paint" || toolId === "peninsula" ? { material: qs.paintMaterial } : {}),
                }
              : base;
            const nextPrefs = recordQuickSculptUse(quickMenuPrefsRef.current, toolId);
            handleChangeQuickMenuPrefs(nextPrefs);
            if (toolId === "bridge" || qs.tapBehavior === "arm_brush") {
              setWorksTool(configured);
              setQuickBuild(null);
              return;
            }
            const vx = quickBuild.gx * VOXELS_PER_TILE + 8;
            const vz = quickBuild.gz * VOXELS_PER_TILE + 8;
            editCity((st) => {
              const res = applyInfrastructureStroke(st, configured, [{ gx: quickBuild.gx, gz: quickBuild.gz, vx, vz }]);
              if (!res.valid && res.reason) {
                pushToast(st, "alert", "Quick Sculpt", res.reason);
              }
            });
            if (qs.tapBehavior === "stamp_and_brush") {
              setWorksTool(configured);
              setQuickBuild(null);
            }
          }}
          onCycleSculptRadius={() => {
            const presets = [0, 1, 3, 6, 12];
            const cur = quickMenuPrefsRef.current.quickSculpt.voxelRadius;
            const idx = presets.findIndex((r) => r > cur);
            const nextRadius = idx === -1 ? presets[0] : presets[idx];
            handleChangeQuickMenuPrefs({
              ...quickMenuPrefsRef.current,
              quickSculpt: { ...quickMenuPrefsRef.current.quickSculpt, voxelRadius: nextRadius },
            });
          }}
          onUndoSculpt={() => editCity((d) => { undoInfrastructure(d); })}
          onCustomizeQuickSculpt={() => {
            setQuickBuild(null);
            setFocusQuickSculptConfig((c) => c + 1);
            openSettings();
            setSheetHeight("half");
          }}
          onSubscribeProjection={subscribeRingProjection}
          onPickCategory={(cat) =>
            setQuickBuild({ gx: quickBuild.gx, gz: quickBuild.gz, category: cat, treeParentId: null, treeSubId: null })
          }
          onPickTreeParent={(parentId) =>
            setQuickBuild({ gx: quickBuild.gx, gz: quickBuild.gz, category: null, treeParentId: parentId, treeSubId: null })
          }
          onPickTreeSub={(subId) =>
            setQuickBuild({
              gx: quickBuild.gx,
              gz: quickBuild.gz,
              category: null,
              treeParentId: quickBuild.treeParentId,
              treeSubId: subId,
            })
          }
          onPickElement={handleQuickBuildPlace}
          onBack={() =>
            setQuickBuild((prev) => {
              if (!prev) return null;
              if (quickBuildMode === "tree") {
                if (prev.treeSubId) return { ...prev, treeSubId: null };
                if (prev.treeParentId) return { ...prev, treeParentId: null, treeSubId: null };
                return null;
              }
              return prev.category ? { ...prev, category: null } : null;
            })
          }
          onClose={() => setQuickBuild(null)}
        />
      )}

      {showSelectionRing && (
        <SelectionRing
          state={gameState}
          el={selected}
          def={selectedDef}
          deletedName={deletedAnchor?.name}
          pendingConfirm={mapFallback ? null : pendingConfirm}
          bulkCount={selectedIds.length}
          bulkActive={bulkSelectMode}
          canUndo={ringCanUndo}
          quickEditPrefs={quickMenuPrefs.quickEdit}
          onTrackQuickEditAction={handleTrackQuickEditAction}
          onSubscribeProjection={subscribeRingProjection}
          onUpgrade={() => {
            if (!selected) return;
            if (gameState.mode === "god") handleGodMutateSelected(selected.id, { level: selected.level + 1 });
            else handleUpgradeSelected(selected.id);
          }}
          onDemolish={() => {
            if (selected) demolish([selected.id]);
          }}
          onBulkDemolish={() => {
            if (selectedIds.length > 0) demolish(selectedIds);
          }}
          onStartBulkSelect={
            canManualEdit
              ? () => {
                  const defaultFilter: BulkSelectFilter = selectedDef?.isRoadNetwork ? "roads" : "all";
                  startBulkSelect(defaultFilter, true);
                }
              : undefined
          }
          onChristmas={decorateSelected}
          onVariant={() => {
            if (selected) handleGodMutateSelected(selected.id, { variant: (selected.variant + 1) % 4 });
          }}
          onMove={() => {
            if (selected) setBrush((b) => ({ ...b, kind: "move", movingElementId: selected.id, defId: undefined }));
          }}
          onRotate={() => {
            if (selected) rotateSelected(selected.id);
          }}
          onMaintain={() => {
            if (selected) handleMaintainSelected(selected.id);
          }}
          onRailOps={() => {
            if (selected) setRailSite(selected.id);
          }}
          onUndo={handleRingUndo}
          onOpenDetails={() => { setInspectorHeight("half"); setInspectorDetailOpen(true); notifyTutorial("open_inspector"); }}
        />
      )}

      <AnimatedSheetHost activeKey={activeSheetKey} navigationPanel={showInspector ? undefined : sheet ?? undefined}>
        {showInspector&&selected&&selectedDef ? (
          <InspectorSheet key={selected.id} state={gameState} el={selected} def={selectedDef}
            height={inspectorHeight} onHeight={setInspectorHeight} onClose={()=>setInspectorDetailOpen(false)}
            onUpgrade={()=>gameState.mode==="god"?handleGodMutateSelected(selected.id,{level:selected.level+1}):handleUpgradeSelected(selected.id)}
            onLevelDown={()=>handleGodMutateSelected(selected.id,{level:Math.max(1,selected.level-1)})}
            onMove={()=>{setInspectorDetailOpen(false);setBrush(b=>({...b,kind:"move",movingElementId:selected.id,defId:undefined}));}}
            onChristmas={decorateSelected} onRotate={()=>rotateSelected(selected.id)} onVariant={()=>handleGodMutateSelected(selected.id,{variant:(selected.variant+1)%4})}
            onMaintain={()=>handleMaintainSelected(selected.id)} onDemolish={()=>demolish([selected.id])}
            onRailOps={()=>setRailSite(selected.id)}
            onFieldGuide={()=>setGuideModal({kind:"field_guide",elementId:selectedDef.id,level:selected.level,variant:selected.variant+1})}
            onFix={openFix} onShowLayer={showLayer}
            links={<Connections s={gameState} el={selected} change={editCity} go={t=>t==="transit"?openTransit():t==="works"?(setInspectPoint({gx:selected.gx,gz:selected.gz}),openWorks()):undefined}/>}
            info={<CityEconomyPanel state={gameState} mutate={editCity} selected={selected} onFocus={focusSite} initialPanel="site" compactSite/>}/>
        ) : sheet==="build" ? (
          <BuildSheet {...sheetProps} state={gameState} brush={brush} cat={buildCat} onCat={setBuildCat} query={buildQuery} onQuery={setBuildQuery}
            fix={buildFix} onClearFix={()=>setBuildFix(undefined)} onPick={id=>handleSelectBrushDef(id)}/>
        ) : sheet==="layers" ? (
          <LayersSheet {...sheetProps} state={gameState} active={activeHeatmap} onSelect={l=>{setActiveHeatmap(l);if(l==="power")trackDrawerAction("heatmap_power",0.5);else if(l==="water")trackDrawerAction("heatmap_water",0.5);else if(l==="police")trackDrawerAction("heatmap_safety",0.5);else if(l==="traffic")trackDrawerAction("heatmap_traffic",0.5);if(l!=="none")notifyTutorial("pick_layer");}} onFix={openFix}/>
        ) : sheet==="city" ? (
          <CitySheet {...sheetProps} state={gameState} tab={cityTab} onTab={t=>{setCityTab(t);if(t==="transit")notifyTutorial("open_transit");}} mutate={editCity} selected={selected} onFocus={id=>{openSheet(null);focusSite(id);}}
            onLocateUnconnected={locateUnconnected} onFix={openFix} onShowLayer={showLayer} onShowPanel={showPanel} onMaintainAll={()=>{trackDrawerAction("repair_all",0.5);handleMaintainAll();}}
            transitProps={{
              onPickDestination:id=>{setDispatchTarget(id);setSheetState(null);},
              onFollow:id=>{
                if (rendererRef.current) rendererRef.current.followService(id);
                else {
                  setFollowedService(id);
                  if (id) setSheetState(null);
                }
              },
              following:followedService,
              focusLine:returnLine,
              onGrid:(x,z,line)=>{setReturnLine(line);setInspectPoint({gx:x,gz:z});if(rendererRef.current)rendererRef.current.focusGrid(x,z);else setMapFocus([x,z]);setSelectedIds([]);openWorks();},
              onRailOps:id=>setRailSite(id),
            }}/>
        ) : sheet==="sculpt" ? (
          <BottomSheet
            id="sheet-sculpt"
            title="Sculpt"
            subtitle={
              worksTool && isVoxelSculptTool(worksTool)
                ? `${worksToolLabel(worksTool.kind)} · ${effectiveVoxelRadius(worksTool) * 2 + 1} vox (${((effectiveVoxelRadius(worksTool) * 2 + 1) * VOXEL_PITCH).toFixed(2)}m)`
                : "0.25m voxel terrain"
            }
            height={sheetHeight}
            onHeightChange={setSheetHeight}
            onClose={() => openSheet(null)}
            closeLabel="Close Sculpt"
          >
            <div className="ui-works-embedded">{worksPanel}</div>
          </BottomSheet>
        ) : sheet==="more" && morePage==="settings" ? (
          <SettingsSheet {...sheetProps} state={gameState}
            headerLead={
              <IconButton
                variant="quiet"
                aria-label="Back to More"
                icon={<ChevronLeft size={18} />}
                onClick={() => setMorePage(null)}
              />
            }
            onUndo={()=>{trackDrawerAction("undo",0.5);handleUndoBuilding();}}
            cursorBehavior={cursorBehavior} onCursorBehavior={handleChangeCursorBehavior}
            selectionFilter={selectionFilter} onSelectionFilter={setSelectionFilter}
            quickBuildMode={quickBuildMode} onQuickBuildMode={(m)=>{trackDrawerAction(m==="adaptive"?"mode_smart":m==="instant"?"mode_quick":m==="sculpt"?"mode_sculpt":"mode_exact",0.5);handleChangeQuickBuildMode(m);}}
            quickMenuPrefs={quickMenuPrefs} onQuickMenuPrefs={handleChangeQuickMenuPrefs}
            quickDrawerPrefs={quickDrawerPrefs} onQuickDrawerPrefs={handleChangeQuickDrawerPrefs}
            focusQuickDrawerConfig={focusQuickDrawerConfig}
            focusQuickSculptConfig={focusQuickSculptConfig}
            learnedBuildsCount={Object.values(buildHabits.elementCounts).reduce((a, b) => a + b, 0) + quickDrawerHabits.totalUses}
            onResetBuildHabits={handleResetBuildHabits}
            simSpeed={simSpeed} onSimSpeed={(v)=>{trackDrawerAction("sim_speed",0.5);setSimSpeed(v);}}
            tutorialMode={tutorialState?.mode ?? null} onStartTutorial={handleStartTutorial} onStopTutorial={()=>stopTutorial(false)}/>
        ) : sheet==="more" ? (
          <MoreSheet onShop={()=>setShop("")} periodPicker={<PeriodPicker stage={gameState.currentStage} saved={savedEra} selected={requestedEra} locked={!gameState.exampleWorldId && !islandProductAvailable(productForEra(requestedEra))} ready={readyEra === requestedEra} error={eraError}
            originalNames={gameState.showOriginalNames === true} onSelect={setPreviewEra}
            onApply={() => { if(!gameState.exampleWorldId && !gate(productForEra(requestedEra)))return; commitState(draft => { draft.appearanceEra = requestedEra; }); setPreviewEra(null); }}
            onOriginalNames={value => commitState(draft => { draft.showOriginalNames = value; })}/>} {...sheetProps} saveNow={()=>saveActiveMode(stateRef.current)} state={gameState} page={morePage} onPage={setMorePage} savedCount={savedCount} slotCount={saveSlots.length}
            onSaves={()=>{trackDrawerAction("save_slots",0.5);setSheetState(null);setSlotError("");setSaveSlots(loadSaveSlots());setSavesModalOpen(true);}} onExamples={openExamples}
            onOpenHandbook={()=>{trackDrawerAction("handbook",0.5);setSheetState(null);setGuideModal({kind:"unified",atlasRoute:{tab:"course"}});}}
            onOpenPixBuilder={()=>{trackDrawerAction("pix_advise",0.5);openPixStudio();}}
            onChangeMode={m=>{trackDrawerAction("game_mode",0.5);stopTutorial(false);if(handleSwitchMode(m))openSheet(null);}} onCopyIsland={()=>{stopTutorial(false);copyIsland();}}
            onReset={()=>setConfirmResetOpen(true)}
            tutorialMode={tutorialState?.mode ?? null} onStartTutorial={handleStartTutorial}
            view={<ViewEnvPanel activeTab={viewEnvTab} state={gameState} cameraMode={cameraMode} autoSpin={autoSpin} attackSeverity={attackSeverity}
              onChangeTab={setViewEnvTab} onChangeCameraMode={m=>{setCameraMode(m);rendererRef.current?.setCameraMode(m);}}
              onSpinLeft={()=>rendererRef.current?.rotateCameraBy(-Math.PI/4)} onSpinRight={()=>rendererRef.current?.rotateCameraBy(Math.PI/4)}
              onToggleAutoSpin={()=>{trackDrawerAction("camera_orbit",0.5);setAutoSpin(s=>!s);}} onZoomIn={()=>rendererRef.current?.zoomBy(0.76)} onZoomOut={()=>rendererRef.current?.zoomBy(1.3)}
              onRecentre={()=>{trackDrawerAction("camera_recenter",0.5);rendererRef.current?.recentreCamera();}} onSetTimeOfDay={handleSetTimeOfDay} onToggleTimeLocked={handleToggleTimeLocked}
              onSetWeather={handleSetWeather} onToggleWeatherLocked={handleToggleWeatherLocked} onSetWeatherIntensity={handleSetWeatherIntensity}
              onSetWindSpeed={handleSetWindSpeed} onTriggerLightning={handleTriggerLightning} onChangeAttackSeverity={setAttackSeverity}
              onLaunchAttack={handleLaunchAttack} onClearAttack={handleClearAttack} onToggleGodCrime={handleToggleGodCrime} onTriggerCrime={handleTriggerCrime}
              onClose={()=>setMorePage(null)}/>}
            godTools={gameState.mode==="god"&&<GodControls s={gameState} el={selected} change={editCity}
              onStep={()=>{setSimSpeed(0);commitState(s=>{stepSimulation(s,1,true);recomputeConnectivityAndMetrics(s);});rendererRef.current?.advanceStreetTraffic(1);}}
              onSave={()=>{if(snapshot(stateRef.current))showToast({id:"snap",title:"Snapshot saved",subtitle:"Restore it from God tools at any time."});}}
              canRestore={hasSnapshot} onRestore={()=>{try{const raw=readPlayerItem("pixel_civ_lab_snapshot");if(raw)activateSandbox(cloneGameStateSnapshot(JSON.parse(raw)));}catch{showToast({id:"snap",title:"Unable to restore snapshot",subtitle:"The saved data could not be opened.",tone:"alert"});}}}
              onDistrict={()=>{const current=stateRef.current;const district=createCanalDistrict();if(saveActiveMode(current)&&snapshot(current.exampleWorldId?loadModeState("god"):current)){activateSandbox(district);openTransit();setSheetHeight("peek");rendererRef.current?.focusGrid(0,-1,74);}}}/>}/>
        ) : null}
      </AnimatedSheetHost>

      {!hideChrome && <BottomNav active={sheet} onToggle={id=>openSheet(id,true)} badges={{city:issues.length}}
        visibleIds={autoVisibleNav} highlightId={activeTutorialStep?.highlightNav} hidden={!!sheet || ringOpen}/>}

      {railSite && gameState.elements.some(e=>e.id===railSite) && <RailOperations state={gameState} selected={gameState.elements.find(e=>e.id===railSite)!} change={editCity}
        onClose={()=>setRailSite(undefined)} onFocus={e=>{setRailSite(undefined);setSheetState(null);focusSite(e.id);}}
        onTrack={e=>{setRailSite(undefined);rendererRef.current?.focusElement(e.id);handleSelectBrushDef("train_tracks");}}/>}
      {examplesOpen && <ExampleIslands current={gameState.exampleWorldId} currentMode={gameState.mode === "real" ? "real" : "god"} onOpen={visitExample} onClose={()=>setExamplesOpen(false)}
        error={saveError} onReturn={()=>{if(handleSwitchMode(stateRef.current.exampleReturnMode ?? "god"))setExamplesOpen(false);}}/>}
      <SaveSlotsModal onShop={setShop} open={savesModalOpen} slots={saveSlots} activeSlotIndex={activeSlotIndex} currentState={gameState} saveKey={islandSaveKey(gameState)} deviceError={deviceNotice || (saveError ? "Could not save to this device." : "")}
        onClose={() => setSavesModalOpen(false)} onAddSlot={handleAddSaveSlot} onSaveToSlot={handleSaveToSlot} onLoadSlot={handleLoadSlot} error={slotError}
        onRenameSlot={handleRenameSlot} onDeleteSlot={handleDeleteSlot}
        linkedWorlds={linkedWorlds} onImportWorld={handleImportWorld} onExportWorld={handleExportWorld}/>
      {guideModal && <GuideModal currentEra={displayedEra} showOriginalNames={gameState.showOriginalNames === true} modal={guideModal} currentMode={gameState.mode} onChange={setGuideModal} onClose={() => setGuideModal(null)}
        onPlayWorld={visitExample}/>}
      {pixModal.open && (
        <PixBuilderModal
          state={gameState}
          initialTab={pixModal.tab}
          onClose={() => setPixModal((p) => ({ ...p, open: false }))}
          onPickElementToPlace={(defId) => {
            setBuildCat("custom");
            handleSelectBrushDef(defId);
          }}
          onApplyWorldPlan={(plan: PixWorldPlan): PixWorldApplyResult => {
            let result: PixWorldApplyResult = {
              terrainOpsApplied: 0,
              roadsPlaced: 0,
              buildingsPlaced: 0,
              skipped: [],
              terrainDirty: false,
            };
            commitState((draft) => {
              result = applyPixWorldPlan(draft, plan);
            });
            showToast({
              id: "pix-world",
              title: "PixBuilder applied",
              subtitle: `${result.terrainOpsApplied} terrain ops · ${result.roadsPlaced} roads · ${result.buildingsPlaced} buildings`,
              tone: "gold",
            });
            return result;
          }}
          onUndoWorld={handleUndoBuilding}
          onOpenLayer={(layer) => showLayer(layer)}
          onFocusGrid={(gx, gz) => rendererRef.current?.focusGrid(gx, gz, 46)}
        />
      )}
      {confirmResetOpen&&<ConfirmDialog title={"Reset "+(MODE_TUTORIAL_LABELS[gameState.mode] ?? gameState.mode)+" island?"}
        message="This clears every placed element on this mode's island. Other modes and your save slots stay as they are."
        confirmLabel="Reset island" onCancel={()=>setConfirmResetOpen(false)} onConfirm={handleResetCurrentIsland}/>}

      {gameState.gameOver && (
        <GameDialog label="Civilization collapsed" className="island-modal fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-4">
          <div className="ui-confirm" style={{textAlign:"center"}}>
            <AlertOctagon size={36} color="var(--ui-bad)" style={{margin:"0 auto"}} aria-hidden="true"/>
            <h3>Civilization collapsed</h3>
            <p>{gameState.gameOverReason}</p>
            <div className="ui-actions" style={{justifyContent:"center"}}>
              <Button label="Switch to Real mode" onClick={() => handleSwitchMode("real")}/>
              <Button variant="primary" icon={<RotateCcw size={18}/>} label="Start over" onClick={handleResetCurrentIsland}/>
            </div>
          </div>
        </GameDialog>
      )}
      {shop!==null && <IslandShop initial={shop} onClose={()=>setShop(null)} saveNow={()=>saveActiveMode(stateRef.current)}/>}
    </main>
    </EraThumbnailContext.Provider>
    </EraPresentation.Provider>
  );
};
