import {useStoreAccess} from "./IslandShop";
import {currentPlayer} from "../game/deviceSaves";
import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Compass,
  Hammer,
  Layers,
  Loader2,
  MessageSquare,
  Moon,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { ELEMENT_BY_ID, ELEMENTS, type GameMode } from "../game/catalog";
import {
  type CustomElementSpec,
  applyGeneratedLevelsToSpec,
  enforceModeBalance,
  isGiftedDesign,
  listCustomElements,
  registerCustomElement,
  removeCustomElement,
} from "../game/customElements";
import {
  type PixWorldApplyResult,
  type PixWorldPlan,
  applyPixWorldPlan,
  buildCompactIslandTelemetry,
} from "../game/pixWorldActions";
import { type GameState, type HeatmapKind, buildingLockReason } from "../game/simulation";
import { AtlasModel } from "./AtlasModel";
import { PixReportButton } from "./PixReportButton";
import { GameDialog } from "./GameDialog";

export type PixTab = "element" | "world" | "advise";

type ModelProvider = "free" | "anthropic" | "openai" | "gemini";

interface PixAdviceAction {
  label: string;
  kind: "select_element" | "open_layer" | "focus_site";
  elementId?: string;
  layerId?: string;
  gx?: number;
  gz?: number;
}

interface PixAdviceResponse {
  headline: string;
  diagnosis: string;
  tips: string[];
  actions: PixAdviceAction[];
}

const providerNames:Record<ModelProvider,string>={free:"Free Pix",gemini:"Google Gemini",openai:"OpenAI",anthropic:"Anthropic Claude"};

const ELEMENT_IDEAS = [
  "Rustic stone watermill bakery with a spinning wooden water wheel and chimney smoke",
  "Pastoral highland creamery barn with roaming cattle in a fenced meadow",
  "Coast Guard helicopter rescue tower with spinning rooftop radar and red beacon",
  "Art Deco seaside observatory with glowing brass dome",
];

const WORLD_IDEAS_GOD = [
  "Carve a deep canyon across the island with two tall bridges spanning over it and a cozy town on both rims",
  "Cover this entire island with a thriving civilization centered around a Spaceport in the middle",
  "Carve a wide grand canal with tall bridges and build a Naval Destroyer & B-2 Stealth defense hub beside it",
];

const WORLD_IDEAS_PLAY = [
  "Lay a connected starter road loop with homes, a farm, and core utilities",
  "Add a vibrant Main Street shopping block with bakeries, cafes, and diners",
  "Add an education & safety block with schools, police, and fire coverage",
];

const ADVISE_QUESTIONS = [
  "Analyze my island right now and give me the top 3 next moves",
  "Why aren't my neighborhoods getting enough water or food?",
  "How do I grow population fastest to the next stage?",
];

export function PixBuilderModal({
  state,
  initialTab = "element",
  onClose,
  onPickElementToPlace,
  onApplyWorldPlan,
  onUndoWorld,
  onOpenLayer,
  onFocusGrid,
}: {
  state: GameState;
  initialTab?: PixTab;
  onClose: () => void;
  onPickElementToPlace: (defId: string) => void;
  onApplyWorldPlan: (plan: PixWorldPlan) => PixWorldApplyResult;
  onUndoWorld: () => void;
  onOpenLayer: (layer: HeatmapKind) => void;
  onFocusGrid: (gx: number, gz: number) => void;
}) {
  const canPlace = state.mode !== "idle" && state.mode !== "manager";
  const [tab, setTab] = useState<PixTab>(canPlace ? initialTab : "advise");
  const [provider, setProvider] = useState<ModelProvider>("free");
  const [modelLabel, setModelLabel] = useState("Pix AI");
  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);

  // Create Element tab state (defaults to Level 5 flagship first; confirms -> auto-generates Lv 1-4)
  const [elPrompt, setElPrompt] = useState("");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [elLoading, setElLoading] = useState(false);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [elError, setElError] = useState<string | null>(null);
  const [draftSpec, setDraftSpec] = useState<CustomElementSpec | null>(null);
  const [draftAdjustments, setDraftAdjustments] = useState<string[]>([]);
  const [previewRev, setPreviewRev] = useState(0);
  const [previewLevel, setPreviewLevel] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [previewVariant, setPreviewVariant] = useState(0);
  const [previewNight, setPreviewNight] = useState(false);
  const [savedLibrary, setSavedLibrary] = useState<CustomElementSpec[]>(() => listCustomElements());
  const [elSuccess, setElSuccess] = useState<string | null>(null);

  // Build World tab state
  const [worldPrompt, setWorldPrompt] = useState("");
  const [worldLoading, setWorldLoading] = useState(false);
  const [worldError, setWorldError] = useState<string | null>(null);
  const [worldPlan, setWorldPlan] = useState<PixWorldPlan | null>(null);
  const [worldResult, setWorldResult] = useState<PixWorldApplyResult | null>(null);

  // Advise tab state (multi-turn conversation)
  const [advQuestion, setAdvQuestion] = useState("");
  const [advLoading, setAdvLoading] = useState(false);
  const [advError, setAdvError] = useState<string | null>(null);
  const [advThread, setAdvThread] = useState<{ id: string; question: string; advice: PixAdviceResponse }[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/pix/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d && typeof d.configured === "boolean") {
          setServerConfigured(d.configured);
          if (typeof d.modelLabel === "string" && d.modelLabel.trim()) setModelLabel(d.modelLabel);
        }
      })
      .catch(() => {
        if (active) setServerConfigured(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const availableIds = useMemo(() => {
    return ELEMENTS.filter((d) => !buildingLockReason(d, state))
      .map((d) => d.id)
      .slice(0, 290);
  }, [state]);

  const draftDef = useMemo(() => {
    if (!draftSpec) return null;
    // Register temporarily in memory (without persisting) so AtlasModel renders the live 3D voxel model
    return registerCustomElement(draftSpec, false);
  }, [draftSpec, previewRev]);

  const access=useStoreAccess();
  const [consent,setConsent]=useState<Partial<Record<ModelProvider,boolean>>>({});
  const activeProvider={name:providerNames[provider],connected:provider==="free" ? serverConfigured!==false : Boolean(access.plan && access.providers.includes(provider))};
  const requestHeaders=()=>({"content-type":"application/json","X-Pix-Provider":provider,"Idempotency-Key":crypto.randomUUID(),...(currentPlayer()?{"X-Game-Account":currentPlayer()!.id}:{})});
  const mayShare=(show:(message:string)=>void)=>{
    if(consent[provider])return true;
    show("Allow sharing with "+providerNames[provider]+" below the model selector to send this request.");return false;
  };

  const requestElement = async (promptText: string, isRefinement: boolean) => {
    if (!mayShare(setElError)) return;
    if (!activeProvider.connected) {
      setElError(`${activeProvider.name} is not connected here. Switch the model selector to ${modelLabel} to run Pix live.`);
      return;
    }
    const clean = promptText.trim();
    if (!clean) return;
    setElLoading(true);
    setElError(null);
    setElSuccess(null);
    try {
      const resp = await fetch("/api/pix/element", {
        method: "POST",
        headers: requestHeaders(),
        body: JSON.stringify({
          prompt: clean,
          mode: state.mode,
          previousDesign: isRefinement ? draftSpec : undefined,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok || !json.design) {
        setElError(json.error || `Pix could not design that element (HTTP ${resp.status}).`);
        return;
      }
      const { spec, adjustments } = enforceModeBalance(
        { ...json.design, levelSpecs: undefined, confirmedLevels: false },
        state.mode,
        isRefinement ? draftSpec?.id : undefined,
      );
      setDraftSpec(spec);
      setDraftAdjustments(adjustments);
      setPreviewLevel(5);
      setPreviewRev((n) => n + 1);
      if (isRefinement) setRefinePrompt("");
    } catch {
      setElError("Network error contacting PixBuilder server.");
    } finally {
      setElLoading(false);
    }
  };

  const handleConfirmAndGenerateLevels = async () => {
    if (!draftSpec || levelsLoading) return;
    setLevelsLoading(true);
    setElError(null);
    setElSuccess(null);
    try {
      let rawLevels: Record<string, unknown>[] | undefined;
      if (activeProvider.connected && mayShare(setElError)) {
        const resp = await fetch("/api/pix/element-levels", {
          method: "POST",
          headers: requestHeaders(),
          body: JSON.stringify({
            mode: state.mode,
            level5Design: draftSpec,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        if (resp.ok && json.ok && Array.isArray(json.levels)) {
          rawLevels = json.levels as Record<string, unknown>[];
        }
      }
      const completed = applyGeneratedLevelsToSpec(draftSpec, rawLevels, state.mode);
      const def = registerCustomElement(completed, true);
      setDraftSpec(completed);
      setSavedLibrary(listCustomElements());
      setPreviewLevel(5);
      setPreviewRev((n) => n + 1);
      setElSuccess(`All 5 levels generated & saved! Preview Lv 1–5 below or place ${def.name} on your island.`);
    } catch {
      const completed = applyGeneratedLevelsToSpec(draftSpec, undefined, state.mode);
      const def = registerCustomElement(completed, true);
      setDraftSpec(completed);
      setSavedLibrary(listCustomElements());
      setPreviewLevel(5);
      setPreviewRev((n) => n + 1);
      setElSuccess(`All 5 levels generated & saved to Build → Pix Custom for ${def.name}!`);
    } finally {
      setLevelsLoading(false);
    }
  };

  const handleSaveAndPlace = () => {
    if (!draftSpec) return;
    const finalized = draftSpec.confirmedLevels ? draftSpec : applyGeneratedLevelsToSpec(draftSpec, undefined, state.mode);
    const def = registerCustomElement(finalized, true);
    setSavedLibrary(listCustomElements());
    setElSuccess(`${def.name} added to Build → Pix Custom!`);
    if (canPlace) {
      onClose();
      onPickElementToPlace(def.id);
    }
  };

  const handleDeleteCustom = (id: string) => {
    removeCustomElement(id);
    setSavedLibrary(listCustomElements());
    if (draftSpec?.id === id) setDraftSpec(null);
  };

  const requestWorldPlan = async (promptText: string) => {
    if (!mayShare(setWorldError)) return;
    if (!activeProvider.connected) {
      setWorldError(`${activeProvider.name} is not connected here. Switch to ${modelLabel} to build with Pix.`);
      return;
    }
    const clean = promptText.trim();
    if (!clean) return;
    setWorldLoading(true);
    setWorldError(null);
    setWorldResult(null);
    try {
      const resp = await fetch("/api/pix/world", {
        method: "POST",
        headers: requestHeaders(),
        body: JSON.stringify({
          prompt: clean,
          mode: state.mode,
          islandSummary: buildCompactIslandTelemetry(state),
          availableIds,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok || !json.plan) {
        setWorldError(json.error || `Pix could not draft that world plan (HTTP ${resp.status}).`);
        return;
      }
      setWorldPlan(json.plan as PixWorldPlan);
    } catch {
      setWorldError("Network error contacting PixBuilder server.");
    } finally {
      setWorldLoading(false);
    }
  };

  const handleApplyWorldPlan = () => {
    if (!worldPlan) return;
    const res = onApplyWorldPlan(worldPlan);
    setWorldResult(res);
  };

  const requestAdvice = async (questionText: string) => {
    if (!mayShare(setAdvError)) return;
    if (!activeProvider.connected) {
      setAdvError(`${activeProvider.name} is not connected here. Switch to ${modelLabel} for live advice.`);
      return;
    }
    const asked = questionText.trim() || "Analyze my island right now and tell me the best next moves.";
    setAdvLoading(true);
    setAdvError(null);
    try {
      const history = advThread.slice(0, 3).reverse().flatMap((turn) => [
        { role: "user", text: turn.question },
        { role: "pix", text: `${turn.advice.headline}. ${turn.advice.diagnosis}` },
      ]);
      const resp = await fetch("/api/pix/advise", {
        method: "POST",
        headers: requestHeaders(),
        body: JSON.stringify({
          question: asked,
          mode: state.mode,
          telemetry: buildCompactIslandTelemetry(state),
          availableIds,
          history,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok || !json.advice) {
        setAdvError(json.error || `Pix could not analyze your island (HTTP ${resp.status}).`);
        return;
      }
      setAdvThread((prev) => [{ id: crypto.randomUUID(), question: asked, advice: json.advice as PixAdviceResponse }, ...prev].slice(0, 6));
      setAdvQuestion("");
    } catch {
      setAdvError("Network error contacting PixBuilder server.");
    } finally {
      setAdvLoading(false);
    }
  };

  const triggerAdviceAction = (action: PixAdviceAction) => {
    if (action.kind === "open_layer" && action.layerId) {
      onClose();
      onOpenLayer(action.layerId as HeatmapKind);
      return;
    }
    if (action.kind === "focus_site" && typeof action.gx === "number" && typeof action.gz === "number") {
      onClose();
      onFocusGrid(action.gx, action.gz);
      return;
    }
    if (action.kind === "select_element" && action.elementId && ELEMENT_BY_ID[action.elementId] && canPlace) {
      onClose();
      onPickElementToPlace(action.elementId);
    }
  };

  const modeLabel: Record<GameMode, string> = {
    god: "God Mode (Unrestricted)",
    real: "Real Mode (Balanced)",
    survival: "Survival Mode (Strict Balance)",
    idle: "Idle Mode (Advisor Ready)",
    manager: "Manager Mode (Advisor Ready)",
  };

  return (
    <GameDialog label="PixBuilder Studio" className="ui-guide-modal ui-pix-modal" onDismiss={onClose}>
      <div className="pix-root">
        <header className="pix-topbar">
          <div className="pix-brand">
            <Sparkles size={18} aria-hidden="true" />
            <div>
              <strong>PixBuilder</strong>
              <span>{modeLabel[state.mode]}</span>
            </div>
          </div>

          <nav className="pix-tabs" aria-label="PixBuilder Studio tabs">
            <button
              type="button"
              aria-pressed={tab === "element"}
              onClick={() => setTab("element")}
            >
              <Wand2 size={15} aria-hidden="true" />
              <span>Create Element</span>
            </button>
            <button
              type="button"
              aria-pressed={tab === "world"}
              onClick={() => setTab("world")}
            >
              <Hammer size={15} aria-hidden="true" />
              <span>Build World</span>
            </button>
            <button
              type="button"
              aria-pressed={tab === "advise"}
              onClick={() => setTab("advise")}
            >
              <MessageSquare size={15} aria-hidden="true" />
              <span>Advise with Pix</span>
            </button>
          </nav>

          <button type="button" className="pc-atlas-close" aria-label="Close PixBuilder" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pix-model-bar" role="group" aria-label="AI Model">
          <span className="pix-model-label">Model:</span>
          {(Object.keys(providerNames) as ModelProvider[]).map(key=>(
            <button key={key} type="button" className={"pix-model-btn"+(provider===key?" is-active":"")} aria-pressed={provider===key} onClick={()=>setProvider(key)}>
              <b>{providerNames[key]}</b><small>{key==="free" ? modelLabel : !access.providers.includes(key) ? "Coming soon" : access.plan ? "Included" : "Pix subscription"}</small>
            </button>))}
        </div>
        {!activeProvider.connected && <p className="pix-notice">{providerNames[provider]} is currently unavailable for this account. View plans in More → Island Store.</p>}
        {activeProvider.connected && <label className="pix-notice"><input type="checkbox" checked={Boolean(consent[provider])} onChange={e=>setConsent(values=>({...values,[provider]:e.target.checked}))}/> Allow {provider==="free" ? modelLabel : providerNames[provider]} to receive my prompt and the island details used for this request. You can turn sharing off here.</label>}
        {provider!=="free" && access.plan && access.usage.limit > 0 && <p className="pix-notice">{access.usage.messages} of {access.usage.limit} messages used this period.</p>}

        <div className="pix-body">
          {tab === "element" && (
            <div className="pix-grid">
              <div className="pix-col">
                <section className="pix-card">
                  <h2>Describe a new 3D voxel element</h2>
                  <p className="pix-muted">
                    Pix designs the <strong>Level 5 flagship</strong> first for {modeLabel[state.mode]}. Once you confirm you love it, Pix automatically generates Levels 1–4 visuals and stats.
                  </p>
                  <div className="pix-prompt-row">
                    <textarea
                      rows={3}
                      value={elPrompt}
                      onChange={(e) => setElPrompt(e.target.value)}
                      placeholder="e.g. A glowing coastal lighthouse cafe with red brick base, white lantern tower, and rooftop spinning beacon…"
                    />
                  </div>
                  <div className="pix-ideas">
                    {ELEMENT_IDEAS.map((idea) => (
                      <button key={idea} type="button" className="pix-idea-btn" onClick={() => setElPrompt(idea)}>
                        {idea}
                      </button>
                    ))}
                  </div>
                  <div className="pix-actions">
                    <button
                      type="button"
                      className="pc-atlas-primary-btn"
                      disabled={elLoading || levelsLoading || !elPrompt.trim()}
                      onClick={() => requestElement(elPrompt, false)}
                    >
                      {elLoading ? <Loader2 size={15} className="pix-spin" /> : <Sparkles size={15} />}
                      <span>{elLoading ? "Designing Level 5 Flagship…" : "Generate Level 5 Element"}</span>
                    </button>
                  </div>
                  {elError && <p className="pix-error" role="alert">{elError}</p>}
                  {elSuccess && <p className="pix-success">{elSuccess}</p>}
                </section>

                {draftSpec && (
                  <section className="pix-card">
                    <h3>Refine Level 5 design</h3>
                    <div className="pix-inline-form">
                      <input
                        type="text"
                        value={refinePrompt}
                        onChange={(e) => setRefinePrompt(e.target.value)}
                        placeholder="e.g. Make the roof gold, add blinking red beacon, increase jobs…"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && refinePrompt.trim() && !elLoading && !levelsLoading) {
                            requestElement(refinePrompt, true);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="pc-atlas-toggle-btn"
                        disabled={elLoading || levelsLoading || !refinePrompt.trim()}
                        onClick={() => requestElement(refinePrompt, true)}
                      >
                        Refine
                      </button>
                    </div>
                    {draftSpec.architectNote && <p className="pix-muted" style={{ marginTop: 8 }}>{draftSpec.architectNote}</p>}
                    {draftAdjustments.length > 0 && (
                      <ul className="pix-adjust-list">
                        {draftAdjustments.map((adj, i) => (
                          <li key={i}>{adj}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                {savedLibrary.length > 0 && (
                  <section className="pix-card">
                    <h3>Your Pix Custom Library ({savedLibrary.length})</h3>
                    <div className="pix-lib-list">
                      {savedLibrary.map((item) => (
                        <div key={item.id} className="pix-lib-row">
                          <div>
                            <strong>{item.name}</strong>
                            <small>
                              {isGiftedDesign(item.id) ? "Gift · Free to place" : "$" + (item.levelSpecs?.[0]?.stats.cost ?? item.cost).toLocaleString()} · {item.footprintCells}×{item.footprintCells} · {item.levelSpecs?.length === 5 ? "5 levels" : item.domain}
                            </small>
                          </div>
                          <div className="pix-lib-btns">
                            <button
                              type="button"
                              className="pc-atlas-toggle-btn"
                              onClick={() => {
                                setDraftSpec(item);
                                setDraftAdjustments([]);
                                setPreviewLevel(5);
                                setPreviewRev((n) => n + 1);
                              }}
                            >
                              Preview
                            </button>
                            {canPlace && (
                              <button
                                type="button"
                                className="pc-atlas-primary-btn"
                                onClick={() => {
                                  onClose();
                                  onPickElementToPlace(item.id);
                                }}
                              >
                                Place
                              </button>
                            )}
                            {!isGiftedDesign(item.id) && <button
                              type="button"
                              className="pix-icon-del"
                              aria-label={`Delete ${item.name}`}
                              onClick={() => handleDeleteCustom(item.id)}
                            >
                              <Trash2 size={15} />
                            </button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <div className="pix-col">
                <section className="pix-card pix-preview-card">
                  {(() => {
                    const activeLvSpec = draftSpec?.levelSpecs?.[previewLevel - 1];
                    const shownTitle = activeLvSpec ? activeLvSpec.title : draftSpec?.name ?? "Waiting for your prompt";
                    const shownDesc = activeLvSpec?.description || draftSpec?.description || "";
                    const shownFp = activeLvSpec?.footprintCells ?? draftSpec?.footprintCells ?? 1;
                    const shownStats = activeLvSpec?.stats ?? (draftSpec ? {
                      cost: draftSpec.cost,
                      popBase: draftSpec.popBase,
                      jobs: draftSpec.jobs,
                      food: draftSpec.food,
                      power: draftSpec.power,
                      water: draftSpec.water,
                      waste: draftSpec.waste,
                      education: draftSpec.education,
                      recreation: draftSpec.recreation,
                      government: draftSpec.government,
                      police: draftSpec.police,
                      policeRadius: draftSpec.policeRadius,
                      fireRadius: draftSpec.fireRadius,
                      military: draftSpec.military,
                      income: draftSpec.income,
                    } : null);
                    const hasAllLevels = Boolean(draftSpec?.confirmedLevels && draftSpec.levelSpecs?.length === 5);

                    return (
                      <>
                        <div className="pix-preview-head">
                          <div>
                            <span className="pix-kicker">
                              {draftSpec
                                ? hasAllLevels
                                  ? `LEVEL ${previewLevel} OF 5 · ALL LEVELS READY`
                                  : "LEVEL 5 FLAGSHIP DRAFT · CONFIRM TO BUILD LV 1–4"
                                : "LIVE 3D VOXEL PREVIEW"}
                            </span>
                            <h3>{shownTitle}</h3>
                          </div>
                          {draftSpec && (
                            <button
                              type="button"
                              className="pc-atlas-light-btn"
                              onClick={() => setPreviewNight((n) => !n)}
                            >
                              {previewNight ? <Moon size={14} /> : <Sun size={14} />}
                              <span>{previewNight ? "Night" : "Day"}</span>
                            </button>
                          )}
                        </div>

                        {draftDef && draftSpec && shownStats ? (
                          <>
                            <div className={"pix-stage-wrap" + (previewNight ? " is-night" : "")}>
                              <AtlasModel
                                key={draftSpec.id + "-" + previewRev + "-lv" + previewLevel}
                                def={draftDef}
                                level={hasAllLevels ? previewLevel : 5}
                                variant={previewVariant}
                                night={previewNight}
                                joined={false}
                              />
                            </div>

                            {hasAllLevels && (
                              <div className="pix-level-strip" role="group" aria-label="Preview upgrade level">
                                {([1, 2, 3, 4, 5] as const).map((lv) => (
                                  <button
                                    key={lv}
                                    type="button"
                                    className={"pix-level-btn" + (previewLevel === lv ? " is-active" : "")}
                                    aria-pressed={previewLevel === lv}
                                    onClick={() => setPreviewLevel(lv)}
                                  >
                                    Lv {lv}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="pix-preview-controls">
                              <div className="pc-atlas-variants" role="group" aria-label="Preview variant">
                                {["A", "B", "C", "D"].map((l, idx) => (
                                  <button
                                    key={l}
                                    type="button"
                                    aria-pressed={previewVariant === idx}
                                    onClick={() => setPreviewVariant(idx)}
                                  >
                                    {l}
                                  </button>
                                ))}
                              </div>
                              {!hasAllLevels ? (
                                <button
                                  type="button"
                                  className="pc-atlas-primary-btn"
                                  disabled={levelsLoading || elLoading}
                                  onClick={handleConfirmAndGenerateLevels}
                                >
                                  {levelsLoading ? <Loader2 size={16} className="pix-spin" /> : <Check size={16} />}
                                  <span>{levelsLoading ? "Auto-Generating Lv 1–4…" : "Confirm & Generate Lv 1–4"}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="pc-atlas-primary-btn"
                                  onClick={handleSaveAndPlace}
                                >
                                  <Plus size={16} />
                                  <span>{canPlace ? "Place on Island" : "Saved in Build Menu"}</span>
                                </button>
                              )}
                            </div>
                            <p className="pix-muted" style={{ marginTop: 10 }}>{shownDesc}</p>
                            <PixReportButton key={`${draftSpec.id}-${previewRev}-${previewLevel}`} kind="design" excerpt={[shownTitle, shownDesc, draftSpec.architectNote].filter(Boolean).join("\n")} />
                            <dl className="pix-stats-dl">
                              <div><dt>Level</dt><dd>Lv {hasAllLevels ? previewLevel : 5}</dd></div>
                              <div><dt>Cost</dt><dd>${shownStats.cost.toLocaleString()}</dd></div>
                              <div><dt>Footprint</dt><dd>{shownFp}×{shownFp}</dd></div>
                              {shownStats.popBase > 0 && <div><dt>Housing</dt><dd>+{shownStats.popBase}</dd></div>}
                              {shownStats.jobs > 0 && <div><dt>Jobs</dt><dd>+{shownStats.jobs}</dd></div>}
                              {shownStats.food > 0 && <div><dt>Food</dt><dd>+{shownStats.food}</dd></div>}
                              {shownStats.power !== 0 && <div><dt>Power</dt><dd>{shownStats.power > 0 ? "+" : ""}{shownStats.power}</dd></div>}
                              {shownStats.water !== 0 && <div><dt>Water</dt><dd>{shownStats.water > 0 ? "+" : ""}{shownStats.water}</dd></div>}
                              {shownStats.income > 0 && <div><dt>Income</dt><dd>+${shownStats.income}</dd></div>}
                              {shownStats.military > 0 && <div><dt>Defense</dt><dd>+{shownStats.military}</dd></div>}
                              {shownStats.fireRadius > 0 && <div><dt>Fire</dt><dd>{shownStats.fireRadius} tiles</dd></div>}
                              {shownStats.policeRadius > 0 && <div><dt>Police</dt><dd>{shownStats.policeRadius} tiles</dd></div>}
                            </dl>
                          </>
                        ) : (
                          <div className="pix-empty-stage">
                            <Wand2 size={28} aria-hidden="true" />
                            <p>Describe your idea on the left. Pix builds the Level 5 flagship first so you can inspect and refine it, then automatically creates Levels 1–4 when you confirm.</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </section>
              </div>
            </div>
          )}

          {tab === "world" && (
            <div className="pix-stack">
              <section className="pix-card">
                <h2>Build Districts, Canals &amp; Landmarks with Pix</h2>
                <p className="pix-muted">
                  {state.mode === "god"
                    ? "God Mode active: Pix can carve canyons, canals, rivers, hills, roads, and place any Stage 1–20 building."
                    : state.mode === "idle" || state.mode === "manager"
                      ? "Switch to God, Real, or Survival mode to apply manual Pix world edits, or use Advise with Pix to coach this city."
                      : "Pix will lay connected roads and place unlocked structures within your live treasury (terrain carving is God-mode only)."}
                </p>
                <textarea
                  rows={3}
                  value={worldPrompt}
                  onChange={(e) => setWorldPrompt(e.target.value)}
                  placeholder="e.g. Carve a scenic canal through the island, bridge it with two roads, and build a cozy Main Street with bakeries, coffee roasteries, and homes…"
                />
                <div className="pix-ideas">
                  {(state.mode === "god" ? WORLD_IDEAS_GOD : WORLD_IDEAS_PLAY).map((idea) => (
                    <button key={idea} type="button" className="pix-idea-btn" onClick={() => setWorldPrompt(idea)}>
                      {idea}
                    </button>
                  ))}
                </div>
                <div className="pix-actions">
                  <button
                    type="button"
                    className="pc-atlas-primary-btn"
                    disabled={worldLoading || !worldPrompt.trim() || !canPlace}
                    onClick={() => requestWorldPlan(worldPrompt)}
                  >
                    {worldLoading ? <Loader2 size={15} className="pix-spin" /> : <Hammer size={15} />}
                    <span>{worldLoading ? "Planning World Edit…" : "Draft World Plan"}</span>
                  </button>
                  <button type="button" className="pc-atlas-toggle-btn" onClick={onUndoWorld}>
                    <RotateCcw size={15} />
                    <span>Undo Last Build</span>
                  </button>
                </div>
                {worldError && <p className="pix-error" role="alert">{worldError}</p>}
              </section>

              {worldPlan && (
                <section className="pix-card">
                  <h3>Proposed World Plan</h3>
                  <p className="pix-prose">{worldPlan.summary}</p>
                  <PixReportButton key={JSON.stringify(worldPlan)} kind="world" excerpt={worldPlan.summary} />
                  <dl className="pix-stats-dl">
                    <div><dt>Terrain Ops</dt><dd>{worldPlan.terrainOps?.length ?? 0}</dd></div>
                    <div><dt>Road Corridors</dt><dd>{worldPlan.roadLines?.length ?? 0}</dd></div>
                    <div><dt>Structures</dt><dd>{worldPlan.placements?.length ?? 0}</dd></div>
                  </dl>
                  <div className="pix-actions" style={{ marginTop: 12 }}>
                    <button type="button" className="pc-atlas-primary-btn" onClick={handleApplyWorldPlan}>
                      <Sparkles size={15} />
                      <span>Apply to Island Now</span>
                    </button>
                  </div>
                  {worldResult && (
                    <div className="pix-result-box">
                      <strong>
                        Applied: {worldResult.terrainOpsApplied} terrain ops · {worldResult.roadsPlaced} road tiles · {worldResult.buildingsPlaced} buildings
                      </strong>
                      {worldResult.skipped.length > 0 && (
                        <ul>
                          {worldResult.skipped.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {tab === "advise" && (
            <div className="pix-stack">
              <section className="pix-card">
                <h2>Advise with Pix</h2>
                <p className="pix-muted">
                  Live strategic coaching grounded in your island's real metrics, available in God, Real, Survival, Idle, and Manager modes.
                </p>
                <div className="pix-inline-form">
                  <input
                    type="text"
                    value={advQuestion}
                    onChange={(e) => setAdvQuestion(e.target.value)}
                    placeholder="Ask Pix anything about your city's economy, layout, safety, or next stage…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !advLoading) requestAdvice(advQuestion);
                    }}
                  />
                  <button
                    type="button"
                    className="pc-atlas-primary-btn"
                    disabled={advLoading}
                    onClick={() => requestAdvice(advQuestion)}
                  >
                    {advLoading ? <Loader2 size={15} className="pix-spin" /> : <Sparkles size={15} />}
                    <span>{advLoading ? "Analyzing…" : "Ask Pix"}</span>
                  </button>
                </div>
                <div className="pix-ideas">
                  {ADVISE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="pix-idea-btn"
                      onClick={() => {
                        setAdvQuestion(q);
                        requestAdvice(q);
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                {advError && <p className="pix-error" role="alert">{advError}</p>}
              </section>

              {advThread.map((turn) => (
                <section key={turn.id} className="pix-card">
                  <span className="pix-kicker">
                    PIX BRIEFING · {state.mode.toUpperCase()} MODE · “{turn.question}”
                  </span>
                  <h3>{turn.advice.headline}</h3>
                  <p className="pix-prose">{turn.advice.diagnosis}</p>
                  <ul className="pix-tip-list">
                    {turn.advice.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                  <PixReportButton kind="advice" excerpt={[turn.advice.headline, turn.advice.diagnosis, ...turn.advice.tips, ...turn.advice.actions.map(action => action.label)].join("\n")} />
                  {turn.advice.actions.length > 0 && (
                    <div className="pix-advice-actions">
                      {turn.advice.actions.map((act, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="pc-atlas-toggle-btn"
                          disabled={act.kind === "select_element" && !canPlace}
                          onClick={() => triggerAdviceAction(act)}
                        >
                          {act.kind === "open_layer" ? (
                            <Layers size={14} />
                          ) : act.kind === "focus_site" ? (
                            <Compass size={14} />
                          ) : (
                            <Plus size={14} />
                          )}
                          <span>{act.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </GameDialog>
  );
}
