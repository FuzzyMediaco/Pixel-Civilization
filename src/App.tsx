import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertOctagon, Flame, Menu, RotateCcw, ShieldAlert, Sparkles, X } from "lucide-react";
import { AdvisorModal } from "./components/AdvisorModal";
import { BottomDock } from "./components/BottomDock";
import { type CursorBehavior, CursorControlButton } from "./components/CursorControlButton";
import { HamburgerMenuModal } from "./components/HamburgerMenuModal";
import { HeatmapPanel } from "./components/HeatmapPanel";
import { MergeDock } from "./components/MergeDock";
import { RightIconRail } from "./components/RightIconRail";
import { SaveSlotsModal } from "./components/SaveSlotsModal";
import { TopHud } from "./components/TopHud";
import { ViewEnvPanel, type ViewEnvTab } from "./components/ViewEnvPanel";
import {
  ELEMENT_BY_ID,
  type GameMode,
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
  createInitialGameState,
  isNightTime,
  launchIslandAttack,
  maintainAllElements,
  maintainElement,
  makeElementId,
  mergeElementsInState,
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

const SAVE_PREFIX = "pixel_civ_save_v1_";

function loadModeState(mode: GameMode): GameState {
  try {
    const raw = localStorage.getItem(`${SAVE_PREFIX}${mode}`);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed && Array.isArray(parsed.elements) && parsed.mode === mode) {
        for (const el of parsed.elements) {
          el.animProgress = 0;
        }
        parsed.toasts = [];
        if (typeof parsed.timeOfDay !== "number") parsed.timeOfDay = 10.5;
        if (typeof parsed.timeLocked !== "boolean") parsed.timeLocked = false;
        if (!parsed.weather) parsed.weather = "clear";
        if (typeof parsed.weatherLocked !== "boolean") parsed.weatherLocked = false;
        if (typeof parsed.weatherIntensity !== "number") parsed.weatherIntensity = 1.0;
        if (typeof parsed.windSpeed !== "number") parsed.windSpeed = 1.0;
        if (typeof parsed.weatherTimerSec !== "number") parsed.weatherTimerSec = 55;
        if (typeof parsed.crimeCooldownSec !== "number") parsed.crimeCooldownSec = 12;
        if (typeof parsed.godCrimeEnabled !== "boolean") {
          parsed.godCrimeEnabled = false;
          parsed.crimeIncidents = [];
        }
        if (!Array.isArray(parsed.crimeIncidents)) parsed.crimeIncidents = [];
        if (parsed.activeAttack === undefined) parsed.activeAttack = null;
        if (parsed.activeAttack) {
          if (!Array.isArray(parsed.activeAttack.defenders)) parsed.activeAttack.defenders = [];
          if (typeof parsed.activeAttack.severity !== "number") parsed.activeAttack.severity = 1;
        }
        recomputeConnectivityAndMetrics(parsed);
        return parsed;
      }
    }
  } catch {
    // Ignore storage read issues
  }
  return createInitialGameState(mode);
}

function saveModeState(state: GameState): void {
  try {
    const slim: GameState = {
      ...state,
      toasts: [],
    };
    localStorage.setItem(`${SAVE_PREFIX}${state.mode}`, JSON.stringify(slim));
  } catch {
    // Ignore storage quota issues
  }
}

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PixelWorldRenderer | null>(null);

  // Default to Real Mode or God Mode — let's start in Real Mode with clean Mode tabs right at top-left, or God Mode?
  // Let's start in God Mode? Let's check: in God Mode all 148+ elements are immediately selectable & placeable on first click, AND Real Mode & Survival Mode are 1-click away in the top bar!
  const [gameState, setGameState] = useState<GameState>(() => loadModeState("god"));
  const stateRef = useRef<GameState>(gameState);
  stateRef.current = gameState;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdsRef = useRef<string[]>(selectedIds);
  selectedIdsRef.current = selectedIds;

  const [pairSelectMode, setPairSelectMode] = useState(false);
  const pairSelectModeRef = useRef(pairSelectMode);
  pairSelectModeRef.current = pairSelectMode;

  const [brush, setBrush] = useState<BuildBrush>({
    kind: "none",
    level: 1,
    variantMode: -1,
    rotation: 0,
  });
  const brushRef = useRef<BuildBrush>(brush);
  brushRef.current = brush;

  const [simSpeed, setSimSpeed] = useState<number>(1);
  const simSpeedRef = useRef<number>(simSpeed);
  simSpeedRef.current = simSpeed;

  const [cameraMode, setCameraMode] = useState<CameraMode>("pan");
  const [autoSpin, setAutoSpin] = useState(false);

  // Default layout: all menus start closed as compact right-side icons + standalone hamburger button
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [bottomMenuOpen, setBottomMenuOpen] = useState(false);
  const [heatmapsOpen, setHeatmapsOpen] = useState(false);
  const [viewEnvOpen, setViewEnvOpen] = useState(false);
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

  const collapseOverlayMenus = useCallback(() => {
    setTopMenuOpen(false);
    setBottomMenuOpen(false);
    setHeatmapsOpen(false);
    setViewEnvOpen(false);
  }, []);

  const commitState = useCallback((mutator: (draft: GameState) => void) => {
    const next: GameState = {
      ...stateRef.current,
      elements: stateRef.current.elements.map((e) => ({ ...e })),
      toasts: [...stateRef.current.toasts],
    };
    mutator(next);
    stateRef.current = next;
    setGameState(next);
    saveModeState(next);
  }, []);

  // Place tile callback from 3D canvas
  const handleTilePlace = useCallback(
    (gx: number, gz: number) => {
      const curBrush = brushRef.current;
      if (curBrush.kind !== "place" || !curBrush.defId) return;
      const def = ELEMENT_BY_ID[curBrush.defId];
      if (!def) return;

      const cur = stateRef.current;
      if (cur.gameOver) return;

      const placeLevel = cur.mode === "god" ? curBrush.level : 1;
      const [sx, sz] = getStandardFootprintForLevel(def, placeLevel);
      const spanX = curBrush.rotation % 2 === 1 ? sz : sx;
      const spanZ = curBrush.rotation % 2 === 1 ? sx : sz;

      const chk = checkPlacementValid(cur, def, gx, gz, spanX, spanZ);
      if (!chk.valid) return;

      if (cur.mode !== "god" && cur.money < def.cost) {
        commitState((draft) => {
          pushToast(
            draft,
            "alert",
            "Insufficient Treasury",
            `Need $${def.cost.toLocaleString()} to build ${def.name}.`,
          );
        });
        return;
      }

      const chosenVariant =
        cur.mode === "god" && curBrush.variantMode >= 0
          ? curBrush.variantMode
          : randomVariant();

      commitState((draft) => {
        if (draft.mode !== "god") {
          draft.money -= def.cost;
        }
        const placed: PlacedElement = {
          id: makeElementId(),
          defId: def.id,
          gx,
          gz,
          spanX,
          spanZ,
          rotation: curBrush.rotation,
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
        };
        draft.elements.push(placed);
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
    [commitState],
  );

  // Move commit callback (God Mode relocation)
  const handleTileMoveCommit = useCallback(
    (elementId: string, gx: number, gz: number) => {
      const cur = stateRef.current;
      const el = cur.elements.find((e) => e.id === elementId);
      if (!el) return;
      const def = ELEMENT_BY_ID[el.defId];
      if (!def) return;

      const chk = checkPlacementValid(
        cur,
        def,
        gx,
        gz,
        el.spanX,
        el.spanZ,
        new Set([el.id]),
      );
      if (!chk.valid) return;

      commitState((draft) => {
        const target = draft.elements.find((e) => e.id === elementId);
        if (target) {
          target.gx = gx;
          target.gz = gz;
          target.animProgress = 0.85;
          target.animKind = "place";
          recomputeConnectivityAndMetrics(draft);
        }
      });

      setBrush((b) => ({ ...b, kind: "none", movingElementId: undefined }));
    },
    [commitState],
  );

  // Selection callback (supports Shift+Click, Pair-Select toggle, or Merge cursor mode)
  const handleSelectElement = useCallback(
    (elementId: string | null, additiveShift: boolean) => {
      if (!elementId) {
        setSelectedIds([]);
        setPairSelectMode(false);
        return;
      }

      const isMergeCursor = cursorBehaviorRef.current === "merge";
      const wantPair = additiveShift || pairSelectModeRef.current || isMergeCursor;
      const curSelected = selectedIdsRef.current;

      if (wantPair && curSelected.length >= 1 && curSelected[0] !== elementId) {
        setPairSelectMode(false);
        collapseOverlayMenus();
        setSelectedIds([curSelected[0], elementId]);
        return;
      }

      if (isMergeCursor) {
        setPairSelectMode(true);
        collapseOverlayMenus();
        setSelectedIds([elementId]);
        return;
      }

      setPairSelectMode(false);
      setSelectedIds([elementId]);
    },
    [collapseOverlayMenus],
  );

  // Initialize Three.js renderer once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const world = new PixelWorldRenderer(canvas, stateRef.current, {
      onTilePlace: handleTilePlace,
      onTileMoveCommit: handleTileMoveCommit,
      onSelectElement: handleSelectElement,
      onHoverInfo: setHoverInfo,
    });
    rendererRef.current = world;

    return () => {
      world.dispose();
      rendererRef.current = null;
    };
  }, [handleTilePlace, handleTileMoveCommit, handleSelectElement]);

  // Sync game state & selection into 3D renderer
  useEffect(() => {
    rendererRef.current?.syncState(gameState, selectedIds);
  }, [gameState, selectedIds]);

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
    let lastMs = performance.now();
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
        if (changed) saveModeState(next);
      } else {
        // Still sync animProgress & clock smoothly to rendererRef
        rendererRef.current?.syncState(next, selectedIdsRef.current);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  // Keyboard shortcuts (Esc, T/B/H/V menus, R rotate, M merge, +/- zoom, Delete demolish)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        setBrush((b) => ({ ...b, kind: "none", defId: undefined, movingElementId: undefined }));
        setPairSelectMode(false);
        setSelectedIds((prev) => (prev.length === 2 ? [prev[0]] : prev));
        setHeatmapsOpen(false);
        setViewEnvOpen(false);
      } else if (e.code === "KeyT") {
        setTopMenuOpen((o) => !o);
      } else if (e.code === "KeyB") {
        setBottomMenuOpen((o) => !o);
      } else if (e.code === "KeyH") {
        setHeatmapsOpen((o) => !o);
        setViewEnvOpen(false);
      } else if (e.code === "KeyV") {
        setViewEnvOpen((o) => !o);
        setHeatmapsOpen(false);
      } else if (e.key === "=" || e.key === "+") {
        rendererRef.current?.zoomBy(0.8);
      } else if (e.key === "-" || e.key === "_") {
        rendererRef.current?.zoomBy(1.24);
      } else if (e.code === "KeyR") {
        if (brushRef.current.kind === "place") {
          setBrush((b) => ({ ...b, rotation: (b.rotation + 1) % 4 }));
        } else if (stateRef.current.mode === "god" && selectedIdsRef.current.length === 1) {
          const id = selectedIdsRef.current[0];
          commitState((draft) => {
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
          });
        }
      } else if (e.code === "KeyM" && selectedIdsRef.current.length === 2) {
        const [a, b] = selectedIdsRef.current;
        let mergedId: string | undefined;
        commitState((draft) => {
          const res = mergeElementsInState(draft, a, b);
          if (res.ok) mergedId = res.mergedId;
        });
        if (mergedId) setSelectedIds([mergedId]);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIdsRef.current.length > 0
      ) {
        const toDel = new Set(selectedIdsRef.current);
        commitState((draft) => {
          draft.elements = draft.elements.filter((el) => !toDel.has(el.id));
          recomputeConnectivityAndMetrics(draft);
        });
        setSelectedIds([]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commitState]);

  // UI Handlers
  const handleSwitchMode = (mode: GameMode) => {
    saveModeState(stateRef.current);
    const loaded = loadModeState(mode);
    stateRef.current = loaded;
    setGameState(loaded);
    setSelectedIds([]);
    setPairSelectMode(false);
    setActiveSlotIndex(null);
    setBrush({
      kind: "none",
      level: 1,
      variantMode: -1,
      rotation: 0,
    });
  };

  const handleSelectBrushDef = (defId: string | null) => {
    if (!defId) {
      setBrush((b) => ({ ...b, kind: "none", defId: undefined, movingElementId: undefined }));
      return;
    }
    if (cursorBehaviorRef.current === "merge") {
      setCursorBehavior("auto");
    }
    setSelectedIds([]);
    setPairSelectMode(false);
    setBrush((b) => ({
      ...b,
      kind: "place",
      defId,
      level: stateRef.current.mode === "god" ? b.level : 1,
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
    setPairSelectMode(false);
    setSelectedIds((prev) => (prev.length === 2 ? [prev[0]] : prev));
    if (cursorBehaviorRef.current === "merge") {
      setCursorBehavior("auto");
    }
  };

  const handleChangeCursorBehavior = (mode: CursorBehavior) => {
    setCursorBehavior(mode);
    if (mode === "select" || mode === "merge") {
      setBrush((b) => ({
        ...b,
        kind: "none",
        defId: undefined,
        movingElementId: undefined,
      }));
    }
    if (mode !== "merge") {
      setPairSelectMode(false);
    }
  };

  const handleMergeSelectedPair = () => {
    if (selectedIds.length !== 2) return;
    let newId: string | undefined;
    commitState((draft) => {
      const res = mergeElementsInState(draft, selectedIds[0], selectedIds[1]);
      if (res.ok) {
        newId = res.mergedId;
      } else if (res.reason) {
        pushToast(draft, "alert", "Cannot Merge Pair", res.reason);
      }
    });
    if (newId) {
      setSelectedIds([newId]);
      setPairSelectMode(false);
    }
  };

  const handleUpgradeSelected = (id: string) => {
    commitState((draft) => {
      const res = upgradeElementDirect(draft, id);
      if (!res.ok && res.reason) {
        pushToast(draft, "alert", "Upgrade Unavailable", res.reason);
      }
    });
  };

  const handleMaintainSelected = (id: string) => {
    commitState((draft) => {
      maintainElement(draft, id);
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
    commitState((draft) => {
      const el = draft.elements.find((item) => item.id === id);
      if (!el) return;
      if (patch.level !== undefined) {
        resizeElementForLevel(draft, el, patch.level);
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
    commitState((draft) => {
      draft.elements = draft.elements.filter((e) => !ids.has(e.id));
      recomputeConnectivityAndMetrics(draft);
    });
    setSelectedIds([]);
    setPairSelectMode(false);
  };

  const handleResetCurrentIsland = () => {
    const fresh = createInitialGameState(stateRef.current.mode);
    stateRef.current = fresh;
    setGameState(fresh);
    saveModeState(fresh);
    setSelectedIds([]);
    setPairSelectMode(false);
    setConfirmResetOpen(false);
  };

  const handleSaveToSlot = (slotIndex: number, name: string) => {
    const updated = saveCivilizationToSlot(slotIndex, name, stateRef.current);
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
    const slot = saveSlots[slotIndex];
    if (!slot) return;
    saveModeState(stateRef.current);
    const restored = cloneGameStateSnapshot(slot.state);
    pushToast(
      restored,
      "stage",
      `Loaded "${slot.name}"`,
      `Restored Slot #${slotIndex + 1} · ${restored.population.toLocaleString()} pop`,
    );
    stateRef.current = restored;
    setGameState(restored);
    saveModeState(restored);
    setSelectedIds([]);
    setPairSelectMode(false);
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
    setSaveSlots(renameCivilizationSlot(slotIndex, name));
  };

  const handleDeleteSlot = (slotIndex: number) => {
    setSaveSlots(deleteCivilizationSlot(slotIndex));
    if (activeSlotIndex === slotIndex) {
      setActiveSlotIndex(null);
    }
  };

  const handleTogglePairSelectMode = () => {
    setPairSelectMode((prev) => {
      const next = !prev;
      if (next) {
        collapseOverlayMenus();
        setBrush((b) => ({ ...b, kind: "none", defId: undefined, movingElementId: undefined }));
      }
      return next;
    });
  };

  const handleCancelMerge = () => {
    setPairSelectMode(false);
    setSelectedIds((prev) => (prev.length >= 1 ? [prev[0]] : []));
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

  const savedCount = saveSlots.filter(Boolean).length;
  const issueCount = gameState.diagnostics.filter(
    (d) => d.severity === "critical" || d.severity === "warning",
  ).length;
  const isMerging = pairSelectMode || selectedIds.length === 2;

  return (
    <main className="relative h-screen w-screen overflow-hidden select-none bg-[#c2e9ff]">
      {/* Full-Viewport 3D Sunlit Pixel-Voxel Island Canvas */}
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-crosshair touch-none"
        aria-label="Pixel Civilization 3D Voxel Island"
      />

      {/* Standalone Top-Left 3-Line Hamburger Menu Button */}
      <button
        type="button"
        onClick={() => setHamburgerOpen(true)}
        className="pointer-events-auto fixed left-2.5 top-2 z-35 flex h-9 w-9 items-center justify-center rounded-lg border border-stone-900/20 bg-[#fcfaf5]/95 text-stone-900 shadow-md hover:bg-white"
        title="Open Game Menu & Modes"
        aria-label="Open Game Menu"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {/* Right-Edge Compact Icon Rail (Always Accessible in Every Mode) */}
      <RightIconRail
        state={gameState}
        topMenuOpen={topMenuOpen}
        bottomMenuOpen={bottomMenuOpen}
        heatmapsOpen={heatmapsOpen}
        viewEnvOpen={viewEnvOpen}
        activeHeatmap={activeHeatmap}
        autoSpin={autoSpin}
        savedCount={savedCount}
        issueCount={issueCount}
        isMerging={isMerging}
        onToggleTopMenu={() => setTopMenuOpen((o) => !o)}
        onToggleBottomMenu={() => setBottomMenuOpen((o) => !o)}
        onToggleHeatmaps={() => {
          setHeatmapsOpen((o) => !o);
          setViewEnvOpen(false);
        }}
        onToggleWeatherStudio={() => {
          setHeatmapsOpen(false);
          if (viewEnvOpen && viewEnvTab !== "defense") {
            setViewEnvOpen(false);
          } else {
            setViewEnvTab("weather");
            setViewEnvOpen(true);
          }
        }}
        onToggleDefensePanel={() => {
          setHeatmapsOpen(false);
          if (viewEnvOpen && viewEnvTab === "defense") {
            setViewEnvOpen(false);
          } else {
            setViewEnvTab("defense");
            setViewEnvOpen(true);
          }
        }}
        onToggleAutoSpin={() => setAutoSpin((s) => !s)}
        onLaunchAttack={() => handleLaunchAttack(attackSeverity)}
        onOpenAdvisor={() => setAdvisorOpen(true)}
        onOpenSaves={() => setSavesModalOpen(true)}
        onHideAllMenus={collapseOverlayMenus}
      />

      {/* Persistent Bottom-Right Cursor & Layer Click Filter Control */}
      <CursorControlButton
        brush={brush}
        cursorBehavior={cursorBehavior}
        selectionFilter={selectionFilter}
        pairSelectMode={pairSelectMode}
        onReturnToSelect={handleReturnToSelect}
        onChangeCursorBehavior={handleChangeCursorBehavior}
        onChangeSelectionFilter={setSelectionFilter}
      />

      {/* Active Heatmap Quick Pill when panel is collapsed */}
      {activeHeatmap !== "none" && !heatmapsOpen && (
        <div
          className={`pointer-events-auto fixed left-13 z-25 flex items-center gap-1.5 rounded-lg border border-stone-900/20 bg-[#fcfaf5]/95 px-2.5 py-1 text-[11px] font-bold text-stone-900 shadow-md ${
            topMenuOpen ? "top-13" : "top-2"
          }`}
        >
          <Flame className="h-3.5 w-3.5 text-amber-600" />
          <span className="capitalize">{activeHeatmap}</span>
          <button
            type="button"
            onClick={() => setHeatmapsOpen(true)}
            className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold hover:bg-stone-300"
          >
            Switch
          </button>
          <button
            type="button"
            onClick={() => setActiveHeatmap("none")}
            className="rounded p-0.5 text-stone-600 hover:bg-stone-200"
            title="Clear Heat Map"
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
        open={topMenuOpen && !isMerging}
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
          setHeatmapsOpen(false);
          setViewEnvTab("weather");
          setViewEnvOpen(true);
        }}
        onToggleDayNight={handleToggleDayNight}
        onToggleGodCrime={handleToggleGodCrime}
        onOpenDefenseTab={() => {
          setHeatmapsOpen(false);
          setViewEnvTab("defense");
          setViewEnvOpen(true);
        }}
        onOpenAdvisor={() => setAdvisorOpen(true)}
        onMaintainAll={handleMaintainAll}
        onClose={() => setTopMenuOpen(false)}
      />

      {/* Heat Maps Panel */}
      <HeatmapPanel
        open={heatmapsOpen && !isMerging}
        activeHeatmap={activeHeatmap}
        state={gameState}
        onSelectHeatmap={setActiveHeatmap}
        onClose={() => setHeatmapsOpen(false)}
      />

      {/* Folded Studio Drawer: Weather Studio | 360 Cam | Defense & Attack */}
      <ViewEnvPanel
        open={viewEnvOpen && !isMerging}
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
        onClose={() => setViewEnvOpen(false)}
      />

      {/* Floating Event Toasts (Positioned clear of the Right Icon Rail) */}
      {gameState.toasts.length > 0 && (
        <div
          className={`pointer-events-none fixed right-16 z-30 flex w-80 max-w-[calc(100vw-5rem)] flex-col gap-2 ${
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
        isMerging={isMerging}
        state={gameState}
        brush={brush}
        selectedIds={selectedIds}
        pairSelectMode={pairSelectMode}
        hoverInfo={hoverInfo}
        onSelectBrushDef={handleSelectBrushDef}
        onUpdateBrushSettings={(patch) => setBrush((b) => ({ ...b, ...patch }))}
        onStartMoveSelected={(id) =>
          setBrush((b) => ({ ...b, kind: "move", movingElementId: id, defId: undefined }))
        }
        onTogglePairSelectMode={handleTogglePairSelectMode}
        onMergeSelectedPair={handleMergeSelectedPair}
        onUpgradeSelected={handleUpgradeSelected}
        onMaintainSelected={handleMaintainSelected}
        onGodMutateSelected={handleGodMutateSelected}
        onDeleteSelected={handleDeleteSelected}
        onClearSelection={() => {
          setSelectedIds([]);
          setPairSelectMode(false);
        }}
        onClose={() => setBottomMenuOpen(false)}
      />

      {/* Dedicated Bottom Merge Dock (Shown while merging with top & bottom menus auto-collapsed) */}
      {isMerging && (
        <MergeDock
          state={gameState}
          selectedIds={selectedIds}
          pairSelectMode={pairSelectMode}
          onMergeNow={handleMergeSelectedPair}
          onCancelMerge={handleCancelMerge}
        />
      )}

      {/* City Info / Advisor & 20 Stages Modal */}
      <AdvisorModal
        state={gameState}
        open={advisorOpen}
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
          setHeatmapsOpen(false);
          setViewEnvTab("weather");
          setViewEnvOpen(true);
        }}
        onOpenHeatmaps={() => {
          setViewEnvOpen(false);
          setHeatmapsOpen(true);
        }}
        onOpenAdvisor={() => setAdvisorOpen(true)}
        onOpenSaves={() => setSavesModalOpen(true)}
        onToggleGodCrime={handleToggleGodCrime}
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
        onRenameSlot={handleRenameSlot}
        onDeleteSlot={handleDeleteSlot}
      />

      {/* Reset Island Confirmation Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4">
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
                onClick={() => setConfirmResetOpen(false)}
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
        </div>
      )}

      {/* Survival Mode Game Over Modal */}
      {gameState.gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-4">
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
        </div>
      )}
    </main>
  );
};
