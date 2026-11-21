import { RailOperations } from "./components/RailOperations";
import { rememberBuildingEdit, undoBuildingEdit } from "./game/constructionHistory";
import { dispatchFire } from "./game/projectOperations";
import { dispatchVessel, previewWaterPassage } from "./game/mobility";
import { buildingCharges, transfer } from "./game/cityEconomy";
import "./islandDesk.css";
import { Connections, GodControls } from "./components/IslandControls";
import { InfrastructurePanel, worksToolLabel } from "./components/InfrastructurePanel";
import { CityEconomyPanel } from "./components/CityEconomyPanel";
import { applyInfrastructureStroke, applyLandformPlacement, planInfrastructureStroke, type GridPoint, type InfrastructureTool } from "./game/terrain";
import { visitPracticeRailway } from "./game/practiceRailway";
import { ExampleIslands, WorldGuide } from "./components/ExampleIslands";
import { EXAMPLE_WORLDS, createExampleWorld, type ExampleWorldId } from "./game/exampleWorlds";
import { loadModeState, persistMode, resumeIsland } from "./game/activeIsland";
import { createCanalDistrict } from "./game/canalDistrict";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertOctagon, Check, Layers, Minus, Plus, RotateCcw, RotateCw, ShieldAlert, X } from "lucide-react";
import { settleStreetFacing } from "./game/streetFacing";
import { GameDialog } from "./components/GameDialog";
import { SaveSlotsModal } from "./components/SaveSlotsModal";
import { ViewEnvPanel, type ViewEnvTab } from "./components/ViewEnvPanel";
import { BottomNav, type NavSheet } from "./components/BottomNav";
import { AlertPill, Hud, type HudStat } from "./components/Hud";
import { BuildSheet, type BuildCategory } from "./components/BuildSheet";
import { PlacementBar } from "./components/PlacementBar";
import { InspectorSheet } from "./components/InspectorSheet";
import { LayersSheet, LAYERS } from "./components/LayersSheet";
import { CitySheet, type CityTab } from "./components/CitySheet";
import { TransitSheet } from "./components/TransitSheet";
import { MoreSheet, type CursorBehavior, type MorePage } from "./components/MoreSheet";
import { Button, ConfirmDialog, IconButton, Toasts, type SheetHeight, type UiToast } from "./components/ui";
import { alertIssues, type IssueFix } from "./game/cityIssues";
import {
  ELEMENT_BY_ID,
  type GameMode,
  getMaxElementLevel,
  getStandardFootprintForLevel,
} from "./game/catalog";
import {
  type CivilizationSaveSlot,
  cloneGameStateSnapshot,
  deleteCivilizationSlot,
  loadSaveSlots,
  renameCivilizationSlot,
  saveCivilizationToSlot,
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
  launchIslandAttack,
  maintainAllElements,
  maintainElement,
  makeElementId,
  pushToast,
  randomVariant,
  recomputeConnectivityAndMetrics,
  resizeCrossing,resizeElementForLevel,
  stepSimulation,
  triggerCrimeIncident,
  upgradeElementDirect,
} from "./game/simulation";
import {
  type BuildBrush,
  type CameraMode,
  PixelWorldRenderer,
} from "./game/worldRenderer";

/** Outside God mode the sky runs on its own, so a save made with a locked clock or weather is unlocked on load. */
function unlockSky(state: GameState) {
  if (state.mode !== "god") { state.timeLocked = false; state.weatherLocked = false; }
  return state;
}

const DEFAULT_HEIGHT: Record<NavSheet, SheetHeight> = {build: "half", layers: "peek", city: "half", transit: "half", more: "half"};
const idleBrush = (b: BuildBrush): BuildBrush => ({...b, kind: "none", defId: undefined, movingElementId: undefined});

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PixelWorldRenderer | null>(null);

  const [gameState, setGameState] = useState<GameState>(() => unlockSky(resumeIsland(location.hash)));
  const stateRef = useRef<GameState>(gameState);
  const [examplesOpen,setExamplesOpen] = useState(false);
  const [railSite,setRailSite] = useState<string>();
  const [saveError,setSaveError]=useState(false);
  const [slotError,setSlotError]=useState("");
  const saveModeState=useCallback((s:GameState)=>{const ok=persistMode(s);setSaveError(!ok);return ok;},[]);
  const captureView = useCallback((state: GameState) => {
    const view = rendererRef.current?.getCameraView();
    if (view) state.cameraView = view;
  }, []);
  const saveActiveMode = useCallback((state: GameState) => {
    captureView(state);
    return saveModeState(state);
  }, [captureView, saveModeState]);

  useEffect(() => {
    const route = new URLSearchParams(location.hash.slice(1));
    if (!gameState.exampleWorldId && !route.has("world")) return;
    if (gameState.exampleWorldId) route.set("world", gameState.exampleWorldId);
    else route.delete("world");
    history.replaceState(null, "", "#" + route.toString());
  }, [gameState.exampleWorldId]);

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
  const [sheetHeight,setSheetHeight]=useState<SheetHeight>("half");
  const [inspectorHeight,setInspectorHeight]=useState<SheetHeight>("half");
  const [cityTab,setCityTab]=useState<CityTab>("issues");
  const [morePage,setMorePage]=useState<MorePage>(null);
  const [buildCat,setBuildCat]=useState<BuildCategory>("suggested");
  const buildCatRef=useRef(buildCat);buildCatRef.current=buildCat;
  const [buildQuery,setBuildQuery]=useState("");
  const [buildFix,setBuildFix]=useState<IssueFix>();
  const [uiToasts,setUiToasts]=useState<UiToast[]>([]);
  const [confirmDemolish,setConfirmDemolish]=useState<string[]|null>(null);
  const [placeStats,setPlaceStats]=useState<{defId:string;count:number;spent:number}>();
  const [hintsLeft,setHintsLeft]=useState(()=>{try{return Number(localStorage.getItem("pixel_civ_place_hints")??3);}catch{return 3;}});

  const [followedService, setFollowedService] = useState<string>();
  const [returnLine,setReturnLine]=useState<string>();
  const [dispatchTarget,setDispatchTarget]=useState<string>();
  const targetRef=useRef<string|undefined>(undefined);targetRef.current=dispatchTarget;
  const [inspectPoint,setInspectPoint]=useState<GridPoint>();
  const [pendingWorks,setPendingWorks]=useState<{tool:InfrastructureTool;points:GridPoint[]}|null>(null);
  const [worksTool,setWorksTool]=useState<InfrastructureTool|null>(null);
  const [hasSnapshot,setHasSnapshot]=useState(()=>{try{return !!localStorage.getItem("pixel_civ_lab_snapshot");}catch{return false;}});
  const [cameraMode, setCameraMode] = useState<CameraMode>("pan");
  const [autoSpin, setAutoSpin] = useState(false);
  const restoreIslandView = useCallback((state: GameState) => {
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
  const [saveSlots, setSaveSlots] = useState<(CivilizationSaveSlot | null)[]>(() => loadSaveSlots());
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{gx: number; gz: number; valid: boolean; reason?: string} | null>(null);

  /** Toasts made by the interface (placement, demolish, upgrade), each optionally actionable. */
  const toastTimers=useRef(new Map<string,number>());
  const showToast=useCallback((t:UiToast,ms=4500)=>{
    setUiToasts(list=>[t,...list.filter(x=>x.id!==t.id)].slice(0,3));
    const timers=toastTimers.current;
    window.clearTimeout(timers.get(t.id));
    timers.set(t.id,window.setTimeout(()=>{setUiToasts(list=>list.filter(x=>x.id!==t.id));timers.delete(t.id);},ms));
  },[]);
  const dismissToast=useCallback((id:string)=>setUiToasts(list=>list.filter(x=>x.id!==id)),[]);
  const undoRef=useRef<()=>void>(()=>{});

  /** Open a home (or close it if it is already open). Every sheet replaces whatever was open. */
  const openSheet=useCallback((id:NavSheet|null,toggle=false)=>{
    setPendingWorks(null);setWorksTool(null);setDispatchTarget(undefined);
    setBrush(idleBrush);
    setSheetState(current=>{
      const next=toggle&&current===id?null:id;
      if(next&&next!==current)setSheetHeight(DEFAULT_HEIGHT[next]);
      if(next)setSelectedIds(ids=>next==="transit"?ids:[]);
      return next;
    });
    if(id!=="more")setMorePage(null);
  },[]);
  const openWorks=useCallback(()=>{setBuildFix(undefined);setBuildQuery("");setBuildCat("works");openSheet("build");},[openSheet]);
  const openTransit=useCallback(()=>openSheet("transit"),[openSheet]);
  const openCity=useCallback((tab:CityTab)=>{setCityTab(tab);openSheet("city");},[openSheet]);
  const openFix=useCallback((fix:IssueFix)=>{setBuildQuery("");setBuildFix(fix);openSheet("build");},[openSheet]);
  const showLayer=useCallback((layer:HeatmapKind)=>{setActiveHeatmap(layer);openSheet("layers");setSheetHeight("peek");},[openSheet]);
  const openMore=useCallback((page:MorePage)=>{openSheet("more");setMorePage(page);},[openSheet]);

  const navigation=useRef({sheet,morePage,pendingWorks,dispatchTarget,worksTool});
  navigation.current={sheet,morePage,pendingWorks,dispatchTarget,worksTool};

  const commitState = useCallback((mutator: (draft: GameState) => void) => {
    const next: GameState = structuredClone(stateRef.current);
    mutator(next);
    stateRef.current = next;
    setGameState(next);
    saveActiveMode(next);
  }, [saveActiveMode]);

  const setSimSpeed=(v:number)=>commitState(d=>{d.playSpeed=v;simSpeedRef.current=v;});

  const commitBuildingEdit = useCallback((label:string, mutate:(draft:GameState)=>void) => {
    const before=stateRef.current;
    commitState(draft=>{
      mutate(draft);
      rememberBuildingEdit(before,draft,label);
    });
  },[commitState]);

  const handleUndoBuilding = () => {
    commitState(draft=>{
      const result=undoBuildingEdit(draft);
      if(result.ok) {
        setSelectedIds(ids=>ids.filter(id=>draft.elements.some(e=>e.id===id)));
        showToast({id:"undo",title:"Undone",subtitle:result.refunded ? "Treasury refunded $" + result.refunded.toLocaleString() + "." : result.label ?? ""});
      } else showToast({id:"undo",title:"Nothing to undo",subtitle:result.reason??"",tone:"alert"});
    });
  };
  undoRef.current=handleUndoBuilding;

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
        if (buildingCharges(cur) && cur.money < plan.def.cost) {
          showToast({id:"funds",title:"Not enough money",subtitle:`Need $${plan.def.cost.toLocaleString()} to build ${plan.def.name}.`,tone:"alert"});
        }
        return;
      }
      const { def, level: placeLevel, spanX, spanZ, rotation, overWater, replaceId } = plan;
      const chosenVariant =
        cur.mode === "god" && curBrush.variantMode >= 0
          ? curBrush.variantMode
          : randomVariant();
      const charged = buildingCharges(cur) ? def.cost : 0;

      commitBuildingEdit("Place "+def.name,(draft) => {
        if (charged) transfer(draft,"treasury","outside",def.cost,"Construction");
        const placed: PlacedElement = {
          id: makeElementId(),
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
          pushToast(draft, "merge", `Auto-Bridge: ${def.name}`, "Roads dragged across water become bridges automatically.");
        }
        recomputeConnectivityAndMetrics(draft);
      });

      // One running toast per brush: "Placed 6 × Road −$60 · Undo".
      setPlaceStats(prev=>{
        const next=prev&&prev.defId===brushDef.id?{defId:brushDef.id,count:prev.count+1,spent:prev.spent+charged}:{defId:brushDef.id,count:1,spent:charged};
        showToast({id:"placed",title:"Placed "+(next.count>1?next.count+" × ":"")+def.name,subtitle:next.spent?"−$"+next.spent.toLocaleString()+" from the treasury":"Free in God mode",
          action:{label:"Undo",run:()=>undoRef.current()}});
        return next;
      });

      const beh = cursorBehaviorRef.current;
      if (beh === "select" || (beh === "auto" && !def.isNetwork)) setBrush(idleBrush);
    },
    [commitBuildingEdit,showToast],
  );

  // Move commit callback (God Mode relocation)
  const handleTileMoveCommit = useCallback(
    (elementId: string, gx: number, gz: number) => {
      const cur = stateRef.current;
      const el = cur.elements.find((e) => e.id === elementId);
      if (!el) return;
      if (!planRelocation(cur, el, gx, gz).valid) return;

      commitBuildingEdit("Move "+ELEMENT_BY_ID[el.defId].name,(draft) => {
        const target = draft.elements.find(e => e.id === elementId);
        if (target && relocatePlacedElement(draft, target, gx, gz)) {
          if (ELEMENT_BY_ID[target.defId].isRoadNetwork) settleStreetFacing(draft, target, false);
          recomputeConnectivityAndMetrics(draft);
        }
      });
      showToast({id:"moved",title:"Moved "+ELEMENT_BY_ID[el.defId].name,action:{label:"Undo",run:()=>undoRef.current()}});
      setBrush((b) => ({ ...b, kind: "none", movingElementId: undefined }));
    },
    [commitBuildingEdit,showToast],
  );

  // Tapping a building shows its inspector; sheets that work with a selection (Transit, Land & water) stay open.
  const handleSelectElement = useCallback((elementId: string | null) => {
    setSelectedIds(elementId ? [elementId] : []);
    const open=sheetRef.current;
    if(elementId && open && open!=="transit" && !(open==="build"&&buildCatRef.current==="works")) setSheetState(null);
  }, []);

  // Initialize Three.js renderer once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const world = new PixelWorldRenderer(canvas, stateRef.current, {
      onTilePlace: handleTilePlace,
      onTileMoveCommit: handleTileMoveCommit,
      onSelectElement: handleSelectElement,
      onFollowChange: setFollowedService,
      onSelectService:id=>{setReturnLine(id);openTransit();setSelectedIds([]);},
      onHoverInfo: setHoverInfo,
      onInspectTile: (gx,gz)=>{
        setInspectPoint({gx,gz});
        const target=targetRef.current;
        if(target){commitState(s=>dispatchVessel(s,target,"sail",[gx,gz]));setDispatchTarget(undefined);openTransit();return true;}
      },
      onInfrastructureStroke: (tool,points)=>setPendingWorks({tool:{...tool},points:points.map(p=>({...p}))}),
    });
    rendererRef.current = world;
    restoreIslandView(stateRef.current);
    (window as unknown as { __pixelWorld?: PixelWorldRenderer }).__pixelWorld = world;

    return () => {
      world.dispose();
      rendererRef.current = null;
    };
  }, [handleTilePlace, handleTileMoveCommit, handleSelectElement, commitState, restoreIslandView, openTransit]);

  useEffect(() => {rendererRef.current?.syncState(gameState, selectedIds);}, [gameState, selectedIds]);
  useEffect(()=>{rendererRef.current?.setInfrastructureTool(worksTool);},[worksTool]);
  useEffect(() => {rendererRef.current?.setBrush(brush);}, [brush]);
  useEffect(() => {rendererRef.current?.setHeatmap(activeHeatmap);}, [activeHeatmap]);
  useEffect(() => {rendererRef.current?.setAutoSpin(autoSpin);}, [autoSpin]);
  useEffect(() => {rendererRef.current?.setSelectionFilter(selectionFilter);}, [selectionFilter]);
  // A new brush starts a new running placement total; the first few brushes show a how-to hint.
  useEffect(() => {
    if (brush.kind !== "place") return;
    setPlaceStats(prev => prev?.defId === brush.defId ? prev : undefined);
    return () => setHintsLeft(h => {const n = Math.max(0, h - 1); try {localStorage.setItem("pixel_civ_place_hints", String(n));} catch {/* private mode */} return n;});
  }, [brush.kind, brush.defId]);

  // Simulation loop (250ms tick, pauses active Survival timers when tab is hidden)
  useEffect(() => {
    let lastMs = performance.now(), lastSave=lastMs;
    const flush=()=>saveActiveMode(stateRef.current);
    const visibility=()=>{if(document.hidden)flush();};
    window.addEventListener("pagehide",flush);
    document.addEventListener("visibilitychange",visibility);
    const timer = window.setInterval(() => {
      const now = performance.now();
      const rawDt = Math.min(1.0, (now - lastMs) / 1000);
      lastMs = now;

      const spd = simSpeedRef.current;
      if (spd <= 0) return;

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
        if(now-lastSave>=5000){saveActiveMode(next);lastSave=now;}
      } else {
        rendererRef.current?.syncState(next, selectedIdsRef.current);
      }
    }, 250);

    return () => {window.clearInterval(timer);window.removeEventListener("pagehide",flush);document.removeEventListener("visibilitychange",visibility);};
  }, []);

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
  },[commitBuildingEdit]);

  // Keyboard: B/L/C/T/M homes, R rotate, Del demolish (confirmed), Ctrl+Z undo, Esc steps back one level.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if(e.defaultPrevented || document.querySelector("dialog[open]")) return;
      const target=e.target instanceof HTMLElement ? e.target : undefined;
      const typing=!!target?.closest('input,textarea,select,[contenteditable="true"]');
      if((e.ctrlKey||e.metaKey) && e.code==="KeyZ" && !typing){e.preventDefault();undoRef.current();return;}
      if(e.ctrlKey || e.metaKey || e.altKey) return;
      if(e.key==="Escape") {
        const ui=navigation.current;
        if(ui.pendingWorks || ui.dispatchTarget) {setPendingWorks(null);setDispatchTarget(undefined);return;}
        if(ui.worksTool){setWorksTool(null);return;}
        if(brushRef.current.kind!=="none"){setBrush(idleBrush);return;}
        if(ui.sheet==="more"&&ui.morePage){setMorePage(null);return;}
        if(ui.sheet) {
          setSheetState(null);
          document.querySelector<HTMLButtonElement>('[data-panel-toggle="'+ui.sheet+'"]')?.focus({preventScroll:true});
          return;
        }
        rendererRef.current?.followService();
        setSelectedIds([]);
      } else if(typing) return;
      else if(e.repeat && ["KeyB","KeyL","KeyC","KeyT","KeyM","KeyH","KeyV","KeyR"].includes(e.code)) return;
      else if (["KeyB","KeyL","KeyC","KeyT","KeyM","KeyH"].includes(e.code)) {
        const keys:Record<string,NavSheet>={KeyB:"build",KeyL:"layers",KeyH:"layers",KeyC:"city",KeyT:"transit",KeyM:"more"};
        openSheet(keys[e.code],true);
      } else if (e.code==="KeyV") {
        openSheet("more");setMorePage("view");
      } else if (e.key === "=" || e.key === "+") {
        rendererRef.current?.zoomBy(0.8);
      } else if (e.key === "-" || e.key === "_") {
        rendererRef.current?.zoomBy(1.24);
      } else if (e.code === "KeyR") {
        if (brushRef.current.kind === "place") {
          setBrush((b) => ({ ...b, rotation: (b.rotation + 1) % 4, faceManually:true }));
        } else if (stateRef.current.mode === "god" && selectedIdsRef.current.length === 1) {
          rotateSelected(selectedIdsRef.current[0]);
        }
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIdsRef.current.length > 0) {
        setConfirmDemolish([...selectedIdsRef.current]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSheet,rotateSelected]);

  const resetTools=()=>{setDispatchTarget(undefined);setPendingWorks(null);setWorksTool(null);setSheetState(null);setMorePage(null);rendererRef.current?.followService();};

  // UI Handlers
  const handleSwitchMode = (mode: GameMode) => {
    resetTools();
    if(!saveActiveMode(stateRef.current))return false;
    const loaded = unlockSky(loadModeState(mode));
    if (!saveModeState(loaded)) return false;
    restoreIslandView(loaded);
    stateRef.current = loaded;
    setGameState(loaded);
    setSelectedIds([]);
    setActiveSlotIndex(null);
    setBrush({kind: "none", level: 1, variantMode: -1, rotation: 0});
    return true;
  };

  const handleSelectBrushDef = (defId: string | null) => {
    setWorksTool(null);
    if (!defId) {setBrush(idleBrush);return;}
    setSelectedIds([]);
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
    commitBuildingEdit("Upgrade building",(draft) => {
      const before = draft.money;
      const res = upgradeElementDirect(draft, id);
      if (!res.ok && res.reason) showToast({id:"upgrade",title:"Can't upgrade yet",subtitle:res.reason,tone:"alert"});
      else if (res.ok) {
        const el = draft.elements.find(e => e.id === id)!;
        const spent = Math.round(before - draft.money);
        showToast({id:"upgrade",title:ELEMENT_BY_ID[el.defId].name+" is now Lv "+el.level,subtitle:spent>0?"−$"+spent.toLocaleString():undefined,action:{label:"Undo",run:()=>undoRef.current()}});
      }
    });
  };

  const handleMaintainSelected = (id: string) => {
    commitState((draft) => {
      if(draft.elements.find(e=>e.id===id)?.onFire) dispatchFire(draft,id);
      else maintainElement(draft, id);
    });
  };

  const handleMaintainAll = () => {
    commitState((draft) => {
      const fixed = maintainAllElements(draft);
      if (fixed > 0) showToast({id:"maint",title:`Maintained ${fixed} building${fixed > 1 ? "s" : ""}`,subtitle:"Timers reset and fires put out."});
    });
  };

  const handleGodMutateSelected = (
    id: string,
    patch: { level?: number; variant?: number; rotation?: number },
  ) => {
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
    });
  };

  const demolish = (ids: string[]) => {
    const set = new Set(ids);
    const names = stateRef.current.elements.filter(e => set.has(e.id)).map(e => ELEMENT_BY_ID[e.defId].name);
    commitBuildingEdit("Remove building",(draft) => {
      removePlacedElements(draft, set);
      recomputeConnectivityAndMetrics(draft);
    });
    setSelectedIds([]);
    setConfirmDemolish(null);
    showToast({id:"removed",title:"Demolished "+(names.length>1?names.length+" buildings":names[0]??"building"),action:{label:"Undo",run:()=>undoRef.current()}});
  };

  const handleResetCurrentIsland = () => {
    resetTools();
    const previous = stateRef.current;
    const fresh = previous.exampleWorldId ? createExampleWorld(previous.exampleWorldId) : createInitialGameState(previous.mode);
    fresh.exampleReturnMode = previous.exampleReturnMode;
    restoreIslandView(fresh);
    stateRef.current = fresh;
    setGameState(fresh);
    saveModeState(fresh);
    setSelectedIds([]);
    setConfirmResetOpen(false);
  };

  const handleSaveToSlot = (slotIndex: number, name: string) => {
    captureView(stateRef.current);
    let updated:typeof saveSlots;
    try{updated=saveCivilizationToSlot(slotIndex,name,stateRef.current);setSlotError("");}catch{setSlotError("The slot could not be saved. Free browser storage and try again.");return;}
    setSaveSlots(updated);
    setActiveSlotIndex(slotIndex);
    const savedName = updated[slotIndex]?.name ?? `Civilization ${slotIndex + 1}`;
    showToast({id:"saved",title:`Saved "${savedName}"`,subtitle:`Slot ${slotIndex + 1}`});
  };

  const handleLoadSlot = (slotIndex: number) => {
    resetTools();
    const slot = saveSlots[slotIndex];
    if (!slot) return;
    if(!saveActiveMode(stateRef.current))return;
    const restored = unlockSky(cloneGameStateSnapshot(slot.state));
    pushToast(restored, "stage", `Loaded "${slot.name}"`, `Restored Slot #${slotIndex + 1} · ${restored.population.toLocaleString()} pop`);
    restoreIslandView(restored);
    stateRef.current = restored;
    setGameState(restored);
    saveModeState(restored);
    setSelectedIds([]);
    setActiveSlotIndex(slotIndex);
    setBrush({kind: "none", level: 1, variantMode: -1, rotation: 0});
    setSavesModalOpen(false);
  };

  const handleRenameSlot = (slotIndex: number, name: string) => {
    try{setSaveSlots(renameCivilizationSlot(slotIndex,name));setSlotError("");}catch{setSlotError("The name could not be saved in browser storage.");}
  };

  const handleDeleteSlot = (slotIndex: number) => {
    try{setSaveSlots(deleteCivilizationSlot(slotIndex));setSlotError("");}catch{setSlotError("The slot could not be removed from browser storage.");return;}
    if (activeSlotIndex === slotIndex) setActiveSlotIndex(null);
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
  const selectedDef=selected?ELEMENT_BY_ID[selected.defId]:undefined;
  const editCity=(fn:(draft:GameState)=>void)=>commitState(draft=>{fn(draft);recomputeConnectivityAndMetrics(draft);});
  const focusSite=(id:string)=>{setSelectedIds([id]);rendererRef.current?.focusElement(id);};
  const snapshot=(s:GameState)=>{
    try{localStorage.setItem("pixel_civ_lab_snapshot",JSON.stringify({...s,toasts:[]}));setHasSnapshot(true);return true;}
    catch{showToast({id:"snap",title:"Snapshot could not be saved",subtitle:"Free a save slot or browser storage, then try again.",tone:"alert"});return false;}
  };
  const activateSandbox=(s:GameState)=>{
    s.mode="god";s.gameOver=false;s.gameOverReason="";s.toasts=[];
    recomputeConnectivityAndMetrics(s);restoreIslandView(s);stateRef.current=s;setGameState(s);saveModeState(s);
    setSelectedIds([]);setActiveSlotIndex(null);setWorksTool(null);rendererRef.current?.followService();openMore("god");
  };
  const activeExample = EXAMPLE_WORLDS.find(world => world.id === gameState.exampleWorldId);
  const openExamples = () => { setSheetState(null); setExamplesOpen(true); };
  const visitExample = (id: ExampleWorldId) => {
    const previous = stateRef.current;
    if (!saveActiveMode(previous)) return;
    const next = previous.exampleWorldId === id ? previous : loadModeState("god", id);
    next.exampleReturnMode = previous.exampleReturnMode ?? previous.mode;
    if (!saveModeState(next)) return;
    stateRef.current = next;
    setGameState(next);
    setExamplesOpen(false);
    resetTools();
    setReturnLine(undefined); setSelectedIds([]); setActiveSlotIndex(null);
    setBrush(idleBrush);
    restoreIslandView(next);
  };
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
    const current=stateRef.current;if(!saveActiveMode(current))return;
    if(!snapshot(loadModeState("god")))return;
    activateSandbox(cloneGameStateSnapshot(current));
  };
  const worksPreview=pendingWorks?planInfrastructureStroke(gameState,pendingWorks.tool,pendingWorks.points):null;
  const passagePreview=useMemo(()=>pendingWorks?previewWaterPassage(stateRef.current,pendingWorks.tool,pendingWorks.points):[],[pendingWorks,gameState.infrastructure?.stamp,gameState.elements.length]);
  const savedCount = saveSlots.filter(Boolean).length;

  const onHudStat=(stat:HudStat)=>{
    if(stat==="power"){setActiveHeatmap("power");openSheet("layers");return;}
    openCity(stat==="people"?"people":stat==="money"?"money":"issues");
  };
  const showPanel=(p:"transit"|"money"|"people")=>p==="transit"?openTransit():openCity(p);

  // Context layer: placing / moving / drawing wins over sheets; the inspector shows a selection when no sheet is open.
  const brushDef=brush.kind==="place"&&brush.defId?ELEMENT_BY_ID[brush.defId]:undefined;
  const movingEl=brush.kind==="move"?gameState.elements.find(e=>e.id===brush.movingElementId):undefined;
  const placing=!!(brushDef||movingEl||worksTool||pendingWorks||dispatchTarget);
  const showInspector=!!(selected&&selectedDef&&!sheet&&!placing);
  const issues=alertIssues(gameState);
  const showAlert=!sheet&&!placing&&!showInspector&&issues.length>0;
  const charges=buildingCharges(gameState);
  const gameToasts:UiToast[]=gameState.toasts.map(t=>({id:t.id,title:t.title,subtitle:t.subtitle,tone:t.kind==="stage"?"gold":t.kind==="raid"||t.kind==="alert"?"alert":"normal"}));
  const layerName=LAYERS.find(l=>l.id===activeHeatmap)?.label;
  const hoverBad=brush.kind!=="none"&&hoverInfo&&!hoverInfo.valid?hoverInfo.reason:undefined;
  const sheetProps={height:sheetHeight,onHeight:setSheetHeight,onClose:()=>openSheet(null)};

  const worksPanel=<>
    {returnLine&&<Button variant="quiet" small label={"← Back to "+returnLine.replace("line-","service #")} onClick={openTransit}/>}
    <InfrastructurePanel onUseMap={t=>{setWorksTool(t);setSheetState(null);}} state={gameState} mutate={editCity} selected={selected}
      onPreview={(tool,points)=>{setPendingWorks({tool,points});setSheetState(null);}} inspectPoint={inspectPoint} tool={worksTool}
      onToolChange={t=>{setPendingWorks(null);setWorksTool(t);}} onClose={()=>openSheet(null)}/>
  </>;

  return (
    <main className={"island-app relative h-screen w-screen overflow-hidden select-none bg-[#c2e9ff]"+(showAlert?" has-alert":"")}>
      <canvas ref={canvasRef} className="block h-full w-full cursor-crosshair touch-none" aria-label="Pixel Civilization 3D Voxel Island"/>

      <Hud state={gameState} speed={simSpeed} onSpeed={setSimSpeed} onStat={onHudStat}/>
      {showAlert&&<AlertPill issues={issues} onOpen={()=>openCity("issues")}/>}
      {saveError&&<p className="storage-notice" role="alert">This island could not be saved in browser storage. Keep the game open while you free space.</p>}
      {gameState.activeAttack&&<div className="ui-banner" role="alert">
        <ShieldAlert size={18} aria-hidden="true"/>
        <span style={{flex:1}}>{gameState.activeAttack.units.length} enemies · {gameState.activeAttack.defenders.length} defenders
          {gameState.activeAttack.defenders.length?"":" · no defenders!"} · lost {gameState.activeAttack.buildingsDestroyed}</span>
        {gameState.mode==="god"&&<Button small label="Stop" onClick={handleClearAttack}/>}
      </div>}
      <Toasts items={[...uiToasts,...gameToasts]} onDismiss={dismissToast}/>

      {activeExample && !sheet && !showInspector && !placing &&
        <WorldGuide key={activeExample.id} world={activeExample} selected={gameState.exampleViewpoint} onVisit={visitViewpoint} onBrowse={openExamples} onRailYard={openRailYard}/>}
      {activeHeatmap!=="none"&&!sheet&&!placing&&!showInspector&&!activeExample&&<div className="ui-layer-chip">
        <button type="button" onClick={()=>openSheet("layers")} aria-label={"Layer: "+layerName+". Open Layers"}><Layers size={16} aria-hidden="true"/>{layerName}</button>
        <IconButton variant="quiet" aria-label="Clear layer" icon={<X size={16}/>} onClick={()=>setActiveHeatmap("none")}/>
      </div>}

      {/* Context layer */}
      {brushDef&&<PlacementBar label="Placing" def={brushDef} title={brushDef.name+(gameState.mode==="god"?" · Lv "+brush.level:"")}
        subtitle={(charges?"$"+brushDef.cost.toLocaleString()+(brushDef.isNetwork?" / tile":" each"):"Free")+(placeStats?.defId===brushDef.id?" · "+placeStats.count+" placed"+(placeStats.spent?" = $"+placeStats.spent.toLocaleString():""):"")}
        hint={hoverBad??(hintsLeft>0?"Tap or drag on the map to place"+(brushDef.isNetwork||cursorBehavior==="place"?" · keeps placing until you tap ✓":""):undefined)} hintBad={!!hoverBad}>
        {!brushDef.isNetwork&&<IconButton aria-label="Rotate 90° (R)" icon={<RotateCw size={18}/>} onClick={()=>setBrush(b=>({...b,rotation:(b.rotation+1)%4,faceManually:true}))}/>}
        {gameState.mode==="god"&&<span className="ui-level" role="group" aria-label="Placement level">
          <IconButton variant="quiet" aria-label="Lower placement level" icon={<Minus size={16}/>} disabled={brush.level<=1} onClick={()=>setBrush(b=>({...b,level:Math.max(1,b.level-1)}))}/>
          <span>Lv{brush.level}</span>
          <IconButton variant="quiet" aria-label="Raise placement level" icon={<Plus size={16}/>} disabled={brush.level>=getMaxElementLevel(brushDef.id)} onClick={()=>setBrush(b=>({...b,level:Math.min(getMaxElementLevel(brushDef.id),b.level+1)}))}/>
        </span>}
        <IconButton variant="primary" aria-label="Done placing" icon={<Check size={20}/>} onClick={()=>setBrush(idleBrush)}/>
      </PlacementBar>}
      {movingEl&&<PlacementBar label="Moving" def={ELEMENT_BY_ID[movingEl.defId]} title={"Moving "+ELEMENT_BY_ID[movingEl.defId].name} subtitle="Tap a free spot on the map" hint={hoverBad} hintBad={!!hoverBad}>
        <Button label="Cancel" onClick={()=>setBrush(idleBrush)}/>
      </PlacementBar>}
      {worksTool&&!pendingWorks&&<PlacementBar label="Land and water" title={worksToolLabel(worksTool.kind)} subtitle="Drag on the map to preview the works">
        <Button small label="Options" onClick={openWorks}/>
        <IconButton variant="primary" aria-label="Done with land and water tool" icon={<Check size={20}/>} onClick={()=>setWorksTool(null)}/>
      </PlacementBar>}
      {pendingWorks&&worksPreview&&<div className="ui-placebar is-works" role="toolbar" aria-label="Confirm works">
        <span className="ui-icard-body"><span className="ui-icard-title">{worksToolLabel(pendingWorks.tool.kind)} · {worksPreview.points.length} tiles</span>
          <span className={"ui-icard-sub"+(worksPreview.valid?"":" is-bad")}>{worksPreview.valid?("$"+worksPreview.cost.toLocaleString()+" · "+worksPreview.affected.length+" sites affected"):worksPreview.reason}</span></span>
        <Button label="Cancel" small onClick={()=>setPendingWorks(null)}/>
        <Button variant="primary" small label="Apply" disabled={!worksPreview.valid} onClick={()=>{const edit=pendingWorks;editCity(st=>{const p=applyInfrastructureStroke(st,edit.tool,edit.points);if(!p.valid)pushToast(st,"alert","Public works",p.reason);});setPendingWorks(null);}}/>
        {worksPreview.valid&&passagePreview.length>0&&<small>{passagePreview.join(" ")}</small>}
      </div>}
      {dispatchTarget&&<PlacementBar label="Send vessel" title="Choose a destination" subtitle="Tap the water where this vessel should sail">
        <Button label="Cancel" onClick={()=>{setDispatchTarget(undefined);openTransit();}}/>
      </PlacementBar>}

      {showInspector&&selected&&selectedDef&&<InspectorSheet key={selected.id} state={gameState} el={selected} def={selectedDef}
        height={inspectorHeight} onHeight={setInspectorHeight} onClose={()=>setSelectedIds([])}
        onUpgrade={()=>gameState.mode==="god"?handleGodMutateSelected(selected.id,{level:selected.level+1}):handleUpgradeSelected(selected.id)}
        onLevelDown={()=>handleGodMutateSelected(selected.id,{level:Math.max(1,selected.level-1)})}
        onMove={()=>setBrush(b=>({...b,kind:"move",movingElementId:selected.id,defId:undefined}))}
        onRotate={()=>rotateSelected(selected.id)} onVariant={()=>handleGodMutateSelected(selected.id,{variant:(selected.variant+1)%4})}
        onMaintain={()=>handleMaintainSelected(selected.id)} onDemolish={()=>setConfirmDemolish([selected.id])}
        onRailOps={()=>setRailSite(selected.id)} onFix={openFix} onShowLayer={showLayer}
        links={<Connections s={gameState} el={selected} change={editCity} go={t=>t==="transit"?openTransit():t==="works"?(setInspectPoint({gx:selected.gx,gz:selected.gz}),openWorks()):undefined}/>}
        info={<CityEconomyPanel state={gameState} mutate={editCity} selected={selected} onFocus={focusSite} initialPanel="site"/>}/>}

      {sheet==="build"&&<BuildSheet {...sheetProps} state={gameState} brush={brush} cat={buildCat} onCat={setBuildCat} query={buildQuery} onQuery={setBuildQuery}
        fix={buildFix} onClearFix={()=>setBuildFix(undefined)} onPick={id=>handleSelectBrushDef(id)} works={worksPanel}/>}
      {sheet==="layers"&&<LayersSheet {...sheetProps} state={gameState} active={activeHeatmap} onSelect={setActiveHeatmap} onFix={openFix}/>}
      {sheet==="city"&&<CitySheet {...sheetProps} state={gameState} tab={cityTab} onTab={setCityTab} mutate={editCity} selected={selected} onFocus={focusSite}
        onFix={openFix} onShowLayer={showLayer} onShowPanel={showPanel} onMaintainAll={handleMaintainAll}/>}
      {sheet==="transit"&&<TransitSheet {...sheetProps} state={gameState} mutate={editCity} selected={selected} onFocus={focusSite}
        onPickDestination={id=>{setDispatchTarget(id);setSheetState(null);}} onFollow={id=>rendererRef.current?.followService(id)} following={followedService}
        focusLine={returnLine} onGrid={(x,z,line)=>{setReturnLine(line);setInspectPoint({gx:x,gz:z});rendererRef.current?.focusGrid(x,z);setSelectedIds([]);openWorks();}}
        onRailOps={id=>setRailSite(id)}/>}
      {sheet==="more"&&<MoreSheet {...sheetProps} state={gameState} page={morePage} onPage={setMorePage} savedCount={savedCount}
        onSaves={()=>setSavesModalOpen(true)} onExamples={openExamples} onChangeMode={m=>{if(handleSwitchMode(m))openSheet(null);}} onCopyIsland={copyIsland}
        onReset={()=>setConfirmResetOpen(true)} cursorBehavior={cursorBehavior} onCursorBehavior={handleChangeCursorBehavior}
        selectionFilter={selectionFilter} onSelectionFilter={setSelectionFilter}
        view={<ViewEnvPanel activeTab={viewEnvTab} state={gameState} cameraMode={cameraMode} autoSpin={autoSpin} attackSeverity={attackSeverity}
          onChangeTab={setViewEnvTab} onChangeCameraMode={m=>{setCameraMode(m);rendererRef.current?.setCameraMode(m);}}
          onSpinLeft={()=>rendererRef.current?.rotateCameraBy(-Math.PI/4)} onSpinRight={()=>rendererRef.current?.rotateCameraBy(Math.PI/4)}
          onToggleAutoSpin={()=>setAutoSpin(s=>!s)} onZoomIn={()=>rendererRef.current?.zoomBy(0.76)} onZoomOut={()=>rendererRef.current?.zoomBy(1.3)}
          onRecentre={()=>rendererRef.current?.recentreCamera()} onSetTimeOfDay={handleSetTimeOfDay} onToggleTimeLocked={handleToggleTimeLocked}
          onSetWeather={handleSetWeather} onToggleWeatherLocked={handleToggleWeatherLocked} onSetWeatherIntensity={handleSetWeatherIntensity}
          onSetWindSpeed={handleSetWindSpeed} onTriggerLightning={handleTriggerLightning} onChangeAttackSeverity={setAttackSeverity}
          onLaunchAttack={handleLaunchAttack} onClearAttack={handleClearAttack} onToggleGodCrime={handleToggleGodCrime} onTriggerCrime={handleTriggerCrime}
          onClose={()=>setMorePage(null)}/>}
        godTools={gameState.mode==="god"&&<GodControls s={gameState} el={selected} change={editCity}
          onStep={()=>{setSimSpeed(0);commitState(s=>{stepSimulation(s,1,true);recomputeConnectivityAndMetrics(s);});rendererRef.current?.advanceStreetTraffic(1);}}
          onSave={()=>{if(snapshot(stateRef.current))showToast({id:"snap",title:"Snapshot saved",subtitle:"Restore it from God tools at any time."});}}
          canRestore={hasSnapshot} onRestore={()=>{try{const raw=localStorage.getItem("pixel_civ_lab_snapshot");if(raw)activateSandbox(cloneGameStateSnapshot(JSON.parse(raw)));}catch{showToast({id:"snap",title:"Unable to restore snapshot",subtitle:"The saved data could not be opened.",tone:"alert"});}}}
          onDistrict={()=>{const current=stateRef.current;const district=createCanalDistrict();if(saveActiveMode(current)&&snapshot(current.exampleWorldId?loadModeState("god"):current)){activateSandbox(district);openTransit();setSheetHeight("peek");rendererRef.current?.focusGrid(0,-1,74);}}}/>}/>}

      <BottomNav active={sheet} onToggle={id=>openSheet(id,true)} badges={{city:issues.length}}/>

      {railSite && gameState.elements.some(e=>e.id===railSite) && <RailOperations state={gameState} selected={gameState.elements.find(e=>e.id===railSite)!} change={editCity}
        onClose={()=>setRailSite(undefined)} onFocus={e=>{setRailSite(undefined);setSheetState(null);focusSite(e.id);}}
        onTrack={e=>{setRailSite(undefined);rendererRef.current?.focusElement(e.id);handleSelectBrushDef("train_tracks");}}/>}
      {examplesOpen && <ExampleIslands current={gameState.exampleWorldId} onOpen={visitExample} onClose={()=>setExamplesOpen(false)}
        error={saveError} onReturn={()=>{if(handleSwitchMode(stateRef.current.exampleReturnMode ?? "god"))setExamplesOpen(false);}}/>}
      <SaveSlotsModal open={savesModalOpen} slots={saveSlots} activeSlotIndex={activeSlotIndex} currentState={gameState}
        onClose={() => setSavesModalOpen(false)} onSaveToSlot={handleSaveToSlot} onLoadSlot={handleLoadSlot} error={slotError}
        onRenameSlot={handleRenameSlot} onDeleteSlot={handleDeleteSlot}/>
      {confirmDemolish&&<ConfirmDialog title={"Demolish "+(confirmDemolish.length>1?confirmDemolish.length+" buildings":ELEMENT_BY_ID[gameState.elements.find(e=>e.id===confirmDemolish[0])?.defId??""]?.name??"building")+"?"}
        message="It is removed from the island. You can undo right after." confirmLabel="Demolish" onCancel={()=>setConfirmDemolish(null)} onConfirm={()=>demolish(confirmDemolish)}/>}
      {confirmResetOpen&&<ConfirmDialog title={"Reset "+(gameState.mode==="god"?"God mode":gameState.mode==="real"?"Real mode":"Survival")+" island?"}
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
    </main>
  );
};
