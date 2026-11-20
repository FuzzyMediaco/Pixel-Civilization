import { rememberBuildingEdit, undoBuildingEdit } from "./game/constructionHistory";
import { dispatchFire } from "./game/projectOperations";
import { dispatchVessel, previewWaterPassage } from "./game/mobility";
import { buildingCharges, transfer } from "./game/cityEconomy";
import "./islandDesk.css";
import { CityBar, Connections, GodControls, tabs, type DeskTab } from "./components/IslandControls";
import { MobilityPanel } from "./components/MobilityPanel";
import { InfrastructurePanel } from "./components/InfrastructurePanel";
import { CityEconomyPanel } from "./components/CityEconomyPanel";
import { applyInfrastructureStroke, applyLandformPlacement, planInfrastructureStroke, type GridPoint, type InfrastructureTool } from "./game/terrain";
import { ExampleIslands, WorldGuide } from "./components/ExampleIslands";
import { EXAMPLE_WORLDS, createExampleWorld, type ExampleWorldId } from "./game/exampleWorlds";
import { loadModeState, persistMode, resumeIsland } from "./game/activeIsland";
import { createCanalDistrict } from "./game/canalDistrict";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertOctagon, Flame, Menu, RotateCcw, ShieldAlert, Sparkles, X } from "lucide-react";
import { AdvisorModal } from "./components/AdvisorModal";
import { BottomDock } from "./components/BottomDock";
import { type CursorBehavior, CursorControlButton } from "./components/CursorControlButton";
import { HamburgerMenuModal } from "./components/HamburgerMenuModal";
import { HeatmapPanel } from "./components/HeatmapPanel";
import { RightIconRail, type IslandPanel } from "./components/RightIconRail";
import { GameDialog } from "./components/GameDialog";
import { SaveSlotsModal } from "./components/SaveSlotsModal";
import { TopHud } from "./components/TopHud";
import { ViewEnvPanel, type ViewEnvTab } from "./components/ViewEnvPanel";
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
  resizeElementForLevel,
  stepSimulation,
  triggerCrimeIncident,
  upgradeElementDirect,
} from "./game/simulation";
import {
  type BuildBrush,
  type CameraMode,
  PixelWorldRenderer,
} from "./game/worldRenderer";

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PixelWorldRenderer | null>(null);

  const [gameState, setGameState] = useState<GameState>(() => resumeIsland(location.hash));
  const stateRef = useRef<GameState>(gameState);
  const [examplesOpen,setExamplesOpen] = useState(false);
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

  const [brush, setBrush] = useState<BuildBrush>({
    kind: "none",
    level: 1,
    variantMode: -1,
    rotation: 0,
  });
  const brushRef = useRef<BuildBrush>(brush);
  brushRef.current = brush;

  const simSpeed=gameState.playSpeed??1;
  const simSpeedRef = useRef<number>(simSpeed);
  simSpeedRef.current = simSpeed;

  const [desk,setDesk]=useState<DeskTab|null>(null);
  const [folded,setFolded]=useState(false);
  const [score,setScore]=useState<"population"|"happiness"|"wealth"|"safety"|"site"|"controls">("wealth");
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


  // Default layout: all menus start closed as compact right-side icons + standalone hamburger button
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [overlay,setOverlay] = useState<IslandPanel|null>(null);
  const topMenuOpen=overlay==="status", bottomMenuOpen=overlay==="build", heatmapsOpen=overlay==="layers", viewEnvOpen=overlay==="view";
  const [viewEnvTab, setViewEnvTab] = useState<ViewEnvTab>("weather");
  const [activeHeatmap, setActiveHeatmap] = useState<HeatmapKind>("none");
  const [attackSeverity, setAttackSeverity] = useState<number>(2);
  const [cursorBehavior, setCursorBehavior] = useState<CursorBehavior>("auto");
  const cursorBehaviorRef = useRef<CursorBehavior>(cursorBehavior);
  cursorBehaviorRef.current = cursorBehavior;
  const [selectionFilter, setSelectionFilter] = useState<SelectionFilter>("all");

  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [savesModalOpen, setSavesModalOpen] = useState(false);
  const [saveSlots, setSaveSlots] = useState<(CivilizationSaveSlot | null)[]>(() => loadSaveSlots());
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{
    gx: number;
    gz: number;
    valid: boolean;
    reason?: string;
  } | null>(null);

  const collapseOverlayMenus = useCallback(()=>setOverlay(null),[]);
  const revealOverlay = useCallback((panel:IslandPanel,toggle=false)=>{
    setDesk(null);setFolded(false);setPendingWorks(null);setWorksTool(null);setDispatchTarget(undefined);
    setOverlay(current=>toggle && current===panel ? null : panel);
  },[]);
  const navigation=useRef({overlay,desk,pendingWorks,dispatchTarget});
  navigation.current={overlay,desk,pendingWorks,dispatchTarget};

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
        pushToast(draft,"stage","Building edit undone",result.refunded ? "Treasury refunded $" + result.refunded.toLocaleString() + "." : result.label ?? "");
      } else pushToast(draft,"alert","Undo unavailable",result.reason??"");
    });
  };

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
          commitState(draft => pushToast(draft, "alert", "Insufficient Treasury", `Need $${plan.def.cost.toLocaleString()} to build ${plan.def.name}.`));
        }
        return;
      }
      const { def, level: placeLevel, spanX, spanZ, rotation, overWater, replaceId } = plan;
      const chosenVariant =
        cur.mode === "god" && curBrush.variantMode >= 0
          ? curBrush.variantMode
          : randomVariant();

      commitBuildingEdit("Place "+def.name,(draft) => {
        if (buildingCharges(draft)) transfer(draft,"treasury","outside",def.cost,"Construction");
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
          ...(plan.pedestrianDeck ? { pedestrianDeck: true } : {}),
        };
        if (replaceId) {
          placed.waterUnderlay = draft.elements.find(e => e.id === replaceId);
          draft.elements = draft.elements.filter(e => e.id !== replaceId);
        }
        draft.elements.push(placed);
        applyLandformPlacement(draft,placed);
        if (def.id !== brushDef.id && !draft.achievements?.includes("bridge_builder")) {
          pushToast(draft, "merge", `Auto-Bridge: ${def.name}`, "Roads dragged across water become bridges automatically.");
        }
        recomputeConnectivityAndMetrics(draft);
      });

      const beh = cursorBehaviorRef.current;
      if (beh === "select" || (beh === "auto" && !def.isNetwork)) {
        setBrush((b) => ({
          ...b,
          kind: "none",
          defId: undefined,
          movingElementId: undefined,
        }));
      }
    },
    [commitState,commitBuildingEdit],
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
        if (target && relocatePlacedElement(draft, target, gx, gz)) recomputeConnectivityAndMetrics(draft);
      });

      setBrush((b) => ({ ...b, kind: "none", movingElementId: undefined }));
    },
    [commitBuildingEdit],
  );

  const handleSelectElement = useCallback((elementId: string | null) => {
    setSelectedIds(elementId ? [elementId] : []);
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
      onSelectService:id=>{setSelectedIds([]);setReturnLine(id);setDesk("transit");setFolded(false);setOverlay(null);setWorksTool(null);},
      onHoverInfo: setHoverInfo,
      onInspectTile: (gx,gz)=>{
        setInspectPoint({gx,gz});
        const target=targetRef.current;
        if(target){commitState(s=>dispatchVessel(s,target,"sail",[gx,gz]));setDispatchTarget(undefined);setDesk("transit");setFolded(false);return true;}
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
  }, [handleTilePlace, handleTileMoveCommit, handleSelectElement, commitState, restoreIslandView]);

  // Sync game state & selection into 3D renderer
  useEffect(() => {
    rendererRef.current?.syncState(gameState, selectedIds);
  }, [gameState, selectedIds]);

  useEffect(()=>{rendererRef.current?.setInfrastructureTool(worksTool);},[worksTool]);
  // Sync brush into 3D renderer
  useEffect(() => {
    rendererRef.current?.setBrush(brush);
  }, [brush]);

  // Sync heatmap overlay into 3D renderer
  useEffect(() => {
    rendererRef.current?.setHeatmap(activeHeatmap);
  }, [activeHeatmap]);

  // Sync 360 auto-spin into 3D renderer
  useEffect(() => {
    rendererRef.current?.setAutoSpin(autoSpin);
  }, [autoSpin]);

  // Sync Layer Click Filter into 3D renderer
  useEffect(() => {
    rendererRef.current?.setSelectionFilter(selectionFilter);
  }, [selectionFilter]);

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
      // Update React UI whenever metrics/animations/weather/crime/attacks tick
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
        // Still sync animProgress & clock smoothly to rendererRef
        rendererRef.current?.syncState(next, selectedIdsRef.current);
      }
    }, 250);

    return () => {window.clearInterval(timer);window.removeEventListener("pagehide",flush);document.removeEventListener("visibilitychange",visibility);};
  }, []);

  // Keyboard controls for selection, building and view.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if(e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
      const target=e.target instanceof HTMLElement ? e.target : undefined;
      if(e.key==="Escape") {
        const ui=navigation.current;
        if(ui.pendingWorks || ui.dispatchTarget) {
          setPendingWorks(null);setDispatchTarget(undefined);setFolded(false);return;
        }
        if(ui.overlay) {
          setOverlay(null);
          document.querySelector<HTMLButtonElement>('[data-panel-toggle="'+ui.overlay+'"]')?.focus({preventScroll:true});
          return;
        }
        if(ui.desk){
          setWorksTool(null);setDesk(null);setFolded(false);
          requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(".island-launch")?.focus({preventScroll:true}));
          return;
        }
        rendererRef.current?.followService();
        setBrush(b=>({...b,kind:"none",defId:undefined,movingElementId:undefined}));
        setSelectedIds([]);
      } else if(target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      else if(e.repeat && ["KeyB","KeyT","KeyV","KeyH","KeyR"].includes(e.code)) return;
      else if (["KeyB","KeyT","KeyH","KeyV"].includes(e.code)) {
        const keys:Record<string,IslandPanel>={KeyT:"status",KeyB:"build",KeyH:"layers",KeyV:"view"};
        revealOverlay(keys[e.code],true);
      } else if (e.key === "=" || e.key === "+") {
        rendererRef.current?.zoomBy(0.8);
      } else if (e.key === "-" || e.key === "_") {
        rendererRef.current?.zoomBy(1.24);
      } else if (e.code === "KeyR") {
        if (brushRef.current.kind === "place") {
          setBrush((b) => ({ ...b, rotation: (b.rotation + 1) % 4, faceManually:true }));
        } else if (stateRef.current.mode === "god" && selectedIdsRef.current.length === 1) {
          const id = selectedIdsRef.current[0];
          commitBuildingEdit("Rotate building",(draft) => {
            const el = draft.elements.find((item) => item.id === id);
            if (!el) return;
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
        }
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIdsRef.current.length > 0
      ) {
        const toDel = new Set(selectedIdsRef.current);
        commitBuildingEdit("Remove building",(draft) => {
          removePlacedElements(draft, toDel);
          recomputeConnectivityAndMetrics(draft);
        });
        setSelectedIds([]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commitBuildingEdit,revealOverlay]);

  // UI Handlers
  const handleSwitchMode = (mode: GameMode) => {
    setDispatchTarget(undefined);setPendingWorks(null);setDesk(null);setWorksTool(null);rendererRef.current?.followService();
    if(!saveActiveMode(stateRef.current))return false;
    const loaded = loadModeState(mode);
    if (!saveModeState(loaded)) return false;
    restoreIslandView(loaded);
    stateRef.current = loaded;
    setGameState(loaded);
    setSelectedIds([]);
    setActiveSlotIndex(null);
    setBrush({
      kind: "none",
      level: 1,
      variantMode: -1,
      rotation: 0,
    });
    return true;
  };

  const handleSelectBrushDef = (defId: string | null) => {
    setWorksTool(null);setDesk(null);
    if (!defId) {
      setBrush((b) => ({ ...b, kind: "none", defId: undefined, movingElementId: undefined }));
      return;
    }
    setSelectedIds([]);
    setBrush((b) => ({
      ...b,
      kind: "place",
      defId,
      faceManually:false,
      level: stateRef.current.mode === "god" ? Math.min(b.level, getMaxElementLevel(defId)) : 1,
      movingElementId: undefined,
    }));
  };

  const handleReturnToSelect = () => {
    setBrush((b) => ({
      ...b,
      kind: "none",
      defId: undefined,
      movingElementId: undefined,
    }));
    setSelectedIds((prev) => (prev.length === 2 ? [prev[0]] : prev));
  };

  const handleChangeCursorBehavior = (mode: CursorBehavior) => {
    setCursorBehavior(mode);
    if (mode === "select") {
      setBrush((b) => ({
        ...b,
        kind: "none",
        defId: undefined,
        movingElementId: undefined,
      }));
    }
  };

  const handleUpgradeSelected = (id: string) => {
    commitBuildingEdit("Upgrade building",(draft) => {
      const res = upgradeElementDirect(draft, id);
      if (!res.ok && res.reason) {
        pushToast(draft, "alert", "Upgrade Unavailable", res.reason);
      }
    });
  };

  const handleMaintainSelected = (id: string) => {
    commitState((draft) => {
      if(draft.elements.find(e=>e.id===id)?.onFire) {
        dispatchFire(draft,id);
        setScore("safety");
        openDesk("city");
      } else maintainElement(draft, id);
    });
  };

  const handleMaintainAll = () => {
    commitState((draft) => {
      const fixed = maintainAllElements(draft);
      if (fixed > 0) {
        pushToast(
          draft,
          "merge",
          `Maintained ${fixed} Building${fixed > 1 ? "s" : ""}`,
          "All 5-minute maintenance timers reset and fires extinguished.",
        );
      }
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
        if (patch.level !== el.level && !resizeElementForLevel(draft, el, patch.level)) {
          const [w, h] = getStandardFootprintForLevel(ELEMENT_BY_ID[el.defId], patch.level);
          pushToast(draft, "alert", "More room needed", `Clear a ${w}×${h} site for this level.`);
          return;
        }
      }
      if (patch.variant !== undefined) el.variant = patch.variant;
      if (patch.rotation !== undefined) {
        const nextRot = ((patch.rotation % 4) + 4) % 4;
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
      }
      el.animProgress = 0.75;
      el.animKind = "upgrade";
      recomputeConnectivityAndMetrics(draft);
    });
  };

  const handleDeleteSelected = () => {
    const ids = new Set(selectedIds);
    commitBuildingEdit("Remove building",(draft) => {
      removePlacedElements(draft, ids);
      recomputeConnectivityAndMetrics(draft);
    });
    setSelectedIds([]);
  };

  const handleResetCurrentIsland = () => {
    setDispatchTarget(undefined);setPendingWorks(null);setDesk(null);setWorksTool(null);rendererRef.current?.followService();
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
    commitState((draft) => {
      pushToast(
        draft,
        "merge",
        `Saved "${savedName}"`,
        `Stored in Civilization Slot #${slotIndex + 1}`,
      );
    });
  };

  const handleLoadSlot = (slotIndex: number) => {
    setDispatchTarget(undefined);setPendingWorks(null);setDesk(null);setWorksTool(null);rendererRef.current?.followService();
    const slot = saveSlots[slotIndex];
    if (!slot) return;
    if(!saveActiveMode(stateRef.current))return;
    const restored = cloneGameStateSnapshot(slot.state);
    pushToast(
      restored,
      "stage",
      `Loaded "${slot.name}"`,
      `Restored Slot #${slotIndex + 1} · ${restored.population.toLocaleString()} pop`,
    );
    restoreIslandView(restored);
    stateRef.current = restored;
    setGameState(restored);
    saveModeState(restored);
    setSelectedIds([]);
    setActiveSlotIndex(slotIndex);
    setBrush({
      kind: "none",
      level: 1,
      variantMode: -1,
      rotation: 0,
    });
    setSavesModalOpen(false);
  };

  const handleRenameSlot = (slotIndex: number, name: string) => {
    try{setSaveSlots(renameCivilizationSlot(slotIndex,name));setSlotError("");}catch{setSlotError("The name could not be saved in browser storage.");}
  };

  const handleDeleteSlot = (slotIndex: number) => {
    try{setSaveSlots(deleteCivilizationSlot(slotIndex));setSlotError("");}catch{setSlotError("The slot could not be removed from browser storage.");return;}
    if (activeSlotIndex === slotIndex) {
      setActiveSlotIndex(null);
    }
  };

  const handleSetTimeOfDay = (hour: number) => {
    commitState((draft) => {
      draft.timeOfDay = hour;
      recomputeConnectivityAndMetrics(draft);
    });
  };

  const handleToggleTimeLocked = () => {
    commitState((draft) => {
      draft.timeLocked = !draft.timeLocked;
    });
  };

  const handleToggleDayNight = () => {
    const night = isNightTime(stateRef.current.timeOfDay ?? 10.5);
    handleSetTimeOfDay(night ? 12.0 : 23.0);
  };

  const handleSetWeather = (weather: WeatherKind) => {
    commitState((draft) => {
      draft.weather = weather;
      draft.weatherTimerSec = 55;
    });
  };

  const handleToggleWeatherLocked = () => {
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
  const editCity=(fn:(draft:GameState)=>void)=>commitState(draft=>{fn(draft);recomputeConnectivityAndMetrics(draft);});
  const openDesk=(tab:DeskTab)=>{
    setPendingWorks(null);setDispatchTarget(undefined);
    setDesk(tab);setFolded(false);setOverlay(null);
    if(tab!=="works")setWorksTool(null);
    setBrush(b=>({...b,kind:"none",defId:undefined,movingElementId:undefined}));
  };
  const openScore=(id:"population"|"happiness"|"wealth")=>{setScore(id);openDesk("city");};
  const focusSite=(id:string)=>{setSelectedIds([id]);rendererRef.current?.focusElement(id);};
  const snapshot=(s:GameState)=>{
    try{localStorage.setItem("pixel_civ_lab_snapshot",JSON.stringify({...s,toasts:[]}));setHasSnapshot(true);return true;}
    catch{commitState(d=>pushToast(d,"alert","Snapshot could not be saved","Free a save slot or browser storage, then try again."));return false;}
  };
  const activateSandbox=(s:GameState)=>{
    s.mode="god";s.gameOver=false;s.gameOverReason="";s.toasts=[];
    recomputeConnectivityAndMetrics(s);restoreIslandView(s);stateRef.current=s;setGameState(s);saveModeState(s);
    setSelectedIds([]);setActiveSlotIndex(null);setWorksTool(null);rendererRef.current?.followService();openDesk("god");
  };
  const activeExample = EXAMPLE_WORLDS.find(world => world.id === gameState.exampleWorldId);
  const openExamples = () => { setHamburgerOpen(false); setOverlay(null); setExamplesOpen(true); };
  const visitExample = (id: ExampleWorldId) => {
    const previous = stateRef.current;
    if (!saveActiveMode(previous)) return;
    const next = previous.exampleWorldId === id ? previous : loadModeState("god", id);
    next.exampleReturnMode = previous.exampleReturnMode ?? previous.mode;
    if (!saveModeState(next)) return;
    stateRef.current = next;
    setGameState(next);
    setExamplesOpen(false);
    setDesk(null); setOverlay(null); setFolded(false); setPendingWorks(null); setWorksTool(null);
    setReturnLine(undefined); setDispatchTarget(undefined); setSelectedIds([]); setActiveSlotIndex(null);
    setBrush(b => ({...b, kind:"none", defId:undefined, movingElementId:undefined}));
    restoreIslandView(next);
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
  const closeDesk=()=>{setReturnLine(undefined);setPendingWorks(null);setDesk(null);setWorksTool(null);setFolded(false);};
  const worksPreview=pendingWorks?planInfrastructureStroke(gameState,pendingWorks.tool,pendingWorks.points):null;
  const passagePreview=useMemo(()=>pendingWorks?previewWaterPassage(stateRef.current,pendingWorks.tool,pendingWorks.points):[],[pendingWorks,gameState.infrastructure?.stamp,gameState.elements.length]);
  const savedCount = saveSlots.filter(Boolean).length;

  return (
    <main className="island-app relative h-screen w-screen overflow-hidden select-none bg-[#c2e9ff]">
      {/* Full-Viewport 3D Sunlit Pixel-Voxel Island Canvas */}
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-crosshair touch-none"
        aria-label="Pixel Civilization 3D Voxel Island"
      />

      {examplesOpen && <ExampleIslands current={gameState.exampleWorldId} onOpen={visitExample} onClose={()=>setExamplesOpen(false)}
        error={saveError} onReturn={()=>{if(handleSwitchMode(stateRef.current.exampleReturnMode ?? "god"))setExamplesOpen(false);}}/>}
      {activeExample && !overlay && (!desk || folded) && !pendingWorks && !dispatchTarget &&
        <WorldGuide key={activeExample.id} world={activeExample} selected={gameState.exampleViewpoint} onVisit={visitViewpoint} onBrowse={openExamples}/>}
      {saveError&&<p className="storage-notice" role="alert">This island could not be saved in browser storage. Keep the game open while you free space.</p>}
      {dispatchTarget&&<div className="works-confirm" role="status">Tap the water where you want this vessel to sail.<button onClick={()=>{setDispatchTarget(undefined);setFolded(false);}}>Cancel voyage</button></div>}
      {pendingWorks&&worksPreview&&<div className="works-confirm" role="status"><strong>{pendingWorks.tool.kind} · {worksPreview.points.length} tiles</strong>
        <span>{worksPreview.valid?("$"+worksPreview.cost+" · "+worksPreview.affected.length+" affected sites"):worksPreview.reason}</span>
        {worksPreview.valid&&passagePreview.length>0&&<small>{passagePreview.join(" ")}</small>}
        <button disabled={!worksPreview.valid} onClick={()=>{const edit=pendingWorks;editCity(st=>{const p=applyInfrastructureStroke(st,edit.tool,edit.points);if(!p.valid)pushToast(st,"alert","Public works",p.reason);});setPendingWorks(null);}}>Apply works</button>
        <button onClick={()=>setPendingWorks(null)}>Cancel</button></div>}
      {!topMenuOpen&&<CityBar s={gameState} onOpen={openScore}/>}
      {(!desk||folded)&&<button className="island-launch" onClick={()=>{if(desk)setFolded(false);else openDesk("works");}}>{folded?"Return to "+tabs[desk!]:"Island tools"}</button>}
      {desk&&!folded&&<aside className="island-desk" aria-label="Island tools">
        <header><h2>{tabs[desk]}</h2><div className="island-actions"><button aria-label="Fold tools to view the map" onClick={()=>setFolded(true)}>View map</button><button aria-label="Close island tools" onClick={closeDesk}>×</button></div></header>
        <nav aria-label="Island tool sections">{(Object.keys(tabs) as DeskTab[]).filter(t=>(t!=="god"||gameState.mode==="god")&&(t!=="connections"||selected)).map(t=><button key={t} aria-current={desk===t} onClick={()=>openDesk(t)}>{tabs[t]}</button>)}</nav>
        {desk==="works"&&returnLine&&<button className="desk-back" onClick={()=>openDesk("transit")}>← Back to {returnLine.replace("line-","service #")}</button>}
        {desk==="works"&&<div className="desk-works"><InfrastructurePanel onUseMap={t=>{setWorksTool(t);setFolded(true);}} state={gameState} mutate={editCity} selected={selected} onPreview={(tool,points)=>{setPendingWorks({tool,points});setFolded(true);}} inspectPoint={inspectPoint} tool={worksTool} onToolChange={t=>{setPendingWorks(null);setWorksTool(t);}} onClose={closeDesk}/></div>}
        {desk==="transit"&&<MobilityPanel state={gameState} mutate={editCity} selected={selected} onFocus={focusSite} onPickDestination={id=>{setDispatchTarget(id);setFolded(true);}} onFollow={id=>rendererRef.current?.followService(id)} following={followedService} focusLine={returnLine} onGrid={(x,z,line)=>{setReturnLine(line);setInspectPoint({gx:x,gz:z});rendererRef.current?.focusGrid(x,z);setSelectedIds([]);openDesk("works");}}/>}
        {desk==="city"&&<CityEconomyPanel state={gameState} mutate={editCity} selected={selected} onFocus={focusSite} initialPanel={score}/>}
        {desk==="connections"&&<Connections s={gameState} el={selected} change={editCity} go={tab=>{if(tab==="city")setScore("site");openDesk(tab);}}/>}
        {desk==="god"&&gameState.mode==="god"&&<GodControls s={gameState} el={selected} change={editCity} go={tab=>{if(tab==="city")setScore("controls");openDesk(tab);}} paused={simSpeed===0} onPause={()=>setSimSpeed(simSpeed?0:1)}
          onStep={()=>{setSimSpeed(0);commitState(s=>{stepSimulation(s,1,true);recomputeConnectivityAndMetrics(s);});}}
          onWeather={()=>{closeDesk();setViewEnvTab("weather");revealOverlay("view");}} onDefense={()=>{closeDesk();setViewEnvTab("defense");revealOverlay("view");}}
          onSave={()=>{if(snapshot(stateRef.current))commitState(s=>pushToast(s,"stage","Snapshot saved","Restore it from God controls at any time."));}}
          canRestore={hasSnapshot} onRestore={()=>{try{const raw=localStorage.getItem("pixel_civ_lab_snapshot");if(raw)activateSandbox(cloneGameStateSnapshot(JSON.parse(raw)));}catch{commitState(s=>pushToast(s,"alert","Unable to restore snapshot","The saved data could not be opened."));}}}
          onExamples={openExamples} onDistrict={()=>{const current=stateRef.current; const district=createCanalDistrict();if(saveActiveMode(current) && snapshot(current.exampleWorldId ? loadModeState("god") : current)){activateSandbox(district);openDesk("transit");setFolded(true);rendererRef.current?.focusGrid(0,-1,74);}}}/>}
      </aside>}
      {/* Standalone Top-Left 3-Line Hamburger Menu Button */}
      <button
        type="button"
        onClick={() => setHamburgerOpen(true)}
        className="game-menu-trigger pointer-events-auto fixed left-2.5 top-2 z-35 flex h-9 w-9 items-center justify-center rounded-lg border border-stone-900/20 bg-[#fcfaf5]/95 text-stone-900 shadow-md hover:bg-white"
        title="Open Game Menu & Modes"
        aria-label="Open Game Menu"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {/* Right-Edge Compact Icon Rail (Always Accessible in Every Mode) */}
      <RightIconRail active={overlay} onToggle={id=>revealOverlay(id,true)} />

      {/* Persistent Bottom-Right Cursor & Layer Click Filter Control */}
      <CursorControlButton
        brush={brush}
        cursorBehavior={cursorBehavior}
        selectionFilter={selectionFilter}
        onReturnToSelect={handleReturnToSelect}
        onChangeCursorBehavior={handleChangeCursorBehavior}
        onChangeSelectionFilter={setSelectionFilter}
      />

      {/* Active Heatmap Quick Pill when panel is collapsed */}
      {activeHeatmap !== "none" && !heatmapsOpen && (
        <div
          className={`active-layer-pill pointer-events-auto fixed left-13 z-25 flex items-center gap-1.5 rounded-lg border border-stone-900/20 bg-[#fcfaf5]/95 px-2.5 py-1 text-[11px] font-bold text-stone-900 shadow-md ${
            topMenuOpen ? "top-13" : "top-2"
          }`}
        >
          <Flame className="h-3.5 w-3.5 text-amber-600" />
          <span className="capitalize">{activeHeatmap}</span>
          <button
            type="button"
            onClick={() => revealOverlay("layers")}
            className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold hover:bg-stone-300"
          >
            Switch
          </button>
          <button
            type="button"
            onClick={() => setActiveHeatmap("none")}
            className="rounded p-0.5 text-stone-600 hover:bg-stone-200"
            aria-label="Clear heat map" title="Clear Heat Map"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Active Invasion Status Banner */}
      {gameState.activeAttack && (
        <div
          className={`pointer-events-auto fixed left-1/2 z-25 flex max-w-[calc(100vw-7rem)] -translate-x-1/2 items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-950/95 px-3 py-1.5 text-[11px] text-rose-50 shadow-xl ${
            topMenuOpen ? "top-13" : "top-2"
          }`}
        >
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-300" />
          <div className="font-mono-num flex flex-wrap items-center gap-x-2 gap-y-0.5 font-bold">
            <span>
              {gameState.activeAttack.units.length} Enemies ·{" "}
              {gameState.activeAttack.defenders.length} Defenders
            </span>
            <span className="text-rose-200">
              {gameState.activeAttack.defenders.length > 0
                ? "Defense Engaging"
                : "NO DEFENDERS — Taking Fire"}
            </span>
            <span className="text-amber-300">
              Lost: {gameState.activeAttack.buildingsDestroyed} · Pop:{" "}
              {gameState.activeAttack.casualties}
            </span>
          </div>
          {gameState.mode === "god" && (
            <button
              type="button"
              onClick={handleClearAttack}
              className="shrink-0 rounded border border-rose-300/40 bg-rose-900 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-800"
            >
              Stop
            </button>
          )}
        </div>
      )}

      {/* Top HUD (Skinny single bar without Mode selector) */}
      <TopHud
        open={topMenuOpen}
        state={gameState}
        simSpeed={simSpeed}
        autoSpin={autoSpin}
        onChangeSimSpeed={setSimSpeed}
        onSpinLeft={() => rendererRef.current?.rotateCameraBy(-Math.PI / 4)}
        onSpinRight={() => rendererRef.current?.rotateCameraBy(Math.PI / 4)}
        onToggleAutoSpin={() => setAutoSpin((s) => !s)}
        onZoomIn={() => rendererRef.current?.zoomBy(0.76)}
        onZoomOut={() => rendererRef.current?.zoomBy(1.3)}
        onRecentre={() => rendererRef.current?.recentreCamera()}
        onOpenWeatherStudio={() => {

          setViewEnvTab("weather");
          revealOverlay("view");
        }}
        onToggleDayNight={handleToggleDayNight}
        onToggleGodCrime={handleToggleGodCrime}
        onOpenDefenseTab={() => {

          setViewEnvTab("defense");
          revealOverlay("view");
        }}
        onOpenAdvisor={() => setAdvisorOpen(true)}
        onOpenScore={openScore}
        onMaintainAll={handleMaintainAll}
        onClose={() => setOverlay(null)}
      />

      {/* Heat Maps Panel */}
      <HeatmapPanel
        open={heatmapsOpen}
        activeHeatmap={activeHeatmap}
        state={gameState}
        onSelectHeatmap={setActiveHeatmap}
        onClose={() => setOverlay(null)}
      />

      {/* Folded Studio Drawer: Weather Studio | 360 Cam | Defense & Attack */}
      <ViewEnvPanel
        open={viewEnvOpen}
        activeTab={viewEnvTab}
        state={gameState}
        cameraMode={cameraMode}
        autoSpin={autoSpin}
        attackSeverity={attackSeverity}
        onChangeTab={setViewEnvTab}
        onChangeCameraMode={(m) => {
          setCameraMode(m);
          rendererRef.current?.setCameraMode(m);
        }}
        onSpinLeft={() => rendererRef.current?.rotateCameraBy(-Math.PI / 4)}
        onSpinRight={() => rendererRef.current?.rotateCameraBy(Math.PI / 4)}
        onToggleAutoSpin={() => setAutoSpin((s) => !s)}
        onZoomIn={() => rendererRef.current?.zoomBy(0.76)}
        onZoomOut={() => rendererRef.current?.zoomBy(1.3)}
        onRecentre={() => rendererRef.current?.recentreCamera()}
        onSetTimeOfDay={handleSetTimeOfDay}
        onToggleTimeLocked={handleToggleTimeLocked}
        onSetWeather={handleSetWeather}
        onToggleWeatherLocked={handleToggleWeatherLocked}
        onSetWeatherIntensity={handleSetWeatherIntensity}
        onSetWindSpeed={handleSetWindSpeed}
        onTriggerLightning={handleTriggerLightning}
        onChangeAttackSeverity={setAttackSeverity}
        onLaunchAttack={handleLaunchAttack}
        onClearAttack={handleClearAttack}
        onToggleGodCrime={handleToggleGodCrime}
        onTriggerCrime={handleTriggerCrime}
        onClose={() => setOverlay(null)}
      />

      {/* Floating Event Toasts (Positioned clear of the Right Icon Rail) */}
      {gameState.toasts.length > 0 && (
        <div
          className={`event-toasts pointer-events-none fixed right-16 z-30 flex w-80 max-w-[calc(100vw-5rem)] flex-col gap-2 ${
            topMenuOpen ? "top-20" : "top-4"
          }`}
        >
          {gameState.toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border px-3.5 py-2.5 shadow-lg ${
                t.kind === "stage"
                  ? "border-amber-400 bg-stone-900/95 text-white"
                  : t.kind === "raid" || t.kind === "alert"
                    ? "border-rose-400 bg-rose-950/95 text-rose-50"
                    : "border-emerald-500 bg-[#fcfaf5]/96 text-stone-900"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>{t.title}</span>
              </div>
              <p className="mt-0.5 text-[11px] opacity-90">{t.subtitle}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Build Palette & Selection Dock */}
      <BottomDock
        open={bottomMenuOpen}
        state={gameState}
        brush={brush}
        selectedIds={selectedIds}
        hoverInfo={hoverInfo}
        onSelectBrushDef={handleSelectBrushDef}
        onUpdateBrushSettings={(patch) => setBrush((b) => ({ ...b, ...patch }))}
        onStartMoveSelected={(id) =>
          setBrush((b) => ({ ...b, kind: "move", movingElementId: id, defId: undefined }))
        }
        onInspectSystems={()=>openDesk("connections")}
        onOpenWorks={()=>openDesk("works")}
        onUpgradeSelected={handleUpgradeSelected}
        onMaintainSelected={handleMaintainSelected}
        onGodMutateSelected={handleGodMutateSelected}
        onDeleteSelected={handleDeleteSelected}
        onUndoBuilding={handleUndoBuilding}
        onClearSelection={() => {
          setSelectedIds([]);
        }}
        onClose={() => setOverlay(null)}
      />

      {/* City Info / Advisor & 20 Stages Modal */}
      <AdvisorModal
        state={gameState}
        open={advisorOpen}
        onShowMetric={id=>{setAdvisorOpen(false);if(["traffic","transit"].includes(id)){openDesk("transit");return;}
          if(["wealth","money","fire","jobs","econ","recovery","crime"].includes(id)){setScore(["fire","crime"].includes(id)?"safety":id==="jobs"?"population":"wealth");openDesk("city");return;}
          const map:Record<string,HeatmapKind>={edu:"education",food:"food",parks:"parks",water:"water",waste:"waste",power:"power",defense:"defense",pollution:"pollution"};
          if(map[id]){setActiveHeatmap(map[id]);revealOverlay("layers");}else openDesk("city");}}
        onClose={() => setAdvisorOpen(false)}
      />

      {/* Fullscreen Hamburger Main Menu (Game Modes, Stages & Shortcuts) */}
      <HamburgerMenuModal
        open={hamburgerOpen}
        state={gameState}
        simSpeed={simSpeed}
        savedCount={savedCount}
        onClose={() => setHamburgerOpen(false)}
        onChangeMode={handleSwitchMode}
        onChangeSimSpeed={setSimSpeed}
        onOpenWeatherStudio={() => {

          setViewEnvTab("weather");
          revealOverlay("view");
        }}
        onOpenHeatmaps={() => {

          revealOverlay("layers");
        }}
        onOpenAdvisor={() => setAdvisorOpen(true)}
        onOpenSaves={() => setSavesModalOpen(true)}
        onToggleGodCrime={handleToggleGodCrime}
        onOpenIsland={openDesk} onCopyIsland={copyIsland} onOpenExamples={openExamples}
        onResetIsland={() => setConfirmResetOpen(true)}
      />

      {/* 3-Slot Saved Civilizations Modal */}
      <SaveSlotsModal
        open={savesModalOpen}
        slots={saveSlots}
        activeSlotIndex={activeSlotIndex}
        currentState={gameState}
        onClose={() => setSavesModalOpen(false)}
        onSaveToSlot={handleSaveToSlot}
        onLoadSlot={handleLoadSlot}
        error={slotError}
        onRenameSlot={handleRenameSlot}
        onDeleteSlot={handleDeleteSlot}
      />

      {/* Reset Island Confirmation Modal */}
      {confirmResetOpen && (
        <GameDialog label="Reset current island" onDismiss={()=>setConfirmResetOpen(false)} className="island-modal fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-stone-900/20 bg-[#fcfaf5] p-5 shadow-2xl">
            <h3 className="font-display text-base font-extrabold text-stone-900">
              Reset {gameState.mode === "god" ? "God Mode" : gameState.mode === "real" ? "Real Mode" : "Survival"} Island?
            </h3>
            <p className="mt-1.5 text-xs text-stone-600">
              This clears all placed elements on your current mode's island and starts fresh. Your
              other game modes remain saved separately.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)} data-dialog-focus
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetCurrentIsland}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                Reset Island
              </button>
            </div>
          </div>
        </GameDialog>
      )}

      {/* Survival Mode Game Over Modal */}
      {gameState.gameOver && (
        <GameDialog label="Civilization collapsed" className="island-modal fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-rose-500/40 bg-[#fcfaf5] p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
              <AlertOctagon className="h-7 w-7" />
            </div>
            <h2 className="font-display mt-3 text-xl font-extrabold text-stone-900">
              Civilization Collapsed
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              {gameState.gameOverReason}
            </p>
            <div className="mt-5 flex justify-center gap-2.5">
              <button
                type="button"
                onClick={() => handleSwitchMode("real")}
                className="rounded-md border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-stone-800 hover:bg-stone-100"
              >
                Switch to Real Mode
              </button>
              <button
                type="button"
                onClick={handleResetCurrentIsland}
                className="flex items-center gap-1.5 rounded-md bg-stone-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-stone-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Start Over</span>
              </button>
            </div>
          </div>
        </GameDialog>
      )}
    </main>
  );
};
