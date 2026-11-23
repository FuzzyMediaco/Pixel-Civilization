import { readPlayerItem, writePlayerItem } from "../game/deviceSaves";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  FolderOpen,
  ListChecks,
  Map as MapIcon,
  Moon,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import "../game/designs/index";
import {
  ELEMENT_BY_ID,
  type GameMode,
  getElementLevelName,
  getMaxElementLevel,
  getStandardFootprintForLevel,
} from "../game/catalog";
import designStyles from "../game/designStyles.json";
import { getGuidePartner, getNeighborPreview } from "../game/connectionPreview";
import { DESIGNS } from "../game/designs/registry";
import type { ExampleMode, ExampleWorldId } from "../game/exampleWorlds";
import { getGuideUsage } from "../game/guideUsage";
import { EDGE_LABELS } from "../game/parcelEdges";
import { frontageWidth, roadWidth } from "../game/roadStandards";
import catalog from "../handbook/catalog.json";
import chapters from "../handbook/chapters.json";
import {
  EXTRA_PLAYBOOK_CHAPTERS,
  HANDBOOK_SECTIONS,
  PLAYBOOK_MODES,
  getModeChapterBrief,
} from "../handbook/modePlaybook";
import { relatedLessons } from "../handbook/relatedLessons";
import { AtlasModel } from "./AtlasModel";
import type { BuildCategory } from "./BuildSheet";
import { CategoryFavicon } from "./CategoryFavicon";
import { ElementFavicon } from "./ElementFavicon";
import { BALANCED_EXPANSION_BY_ID, BALANCED_EXPANSION_ELEMENTS } from "../game/expansionBalancedCatalog";

export type AtlasTab = "atlas" | "chapters" | "islands";

export interface UnifiedAtlasRoute {
  tab: AtlasTab;
  elementId?: string;
  level?: number;
  variant?: number; // 1..4
  section?: string;
  lesson?: string;
  query?: string;
  category?: string;
}

type Picture = { image: string; caption: string; alt: string; width: number; height: number };
type Lesson = {
  id: string;
  title: string;
  steps: string[];
  examples: Picture[];
  designs?: string[];
  stock?: { image: string; name: string; detail: string }[];
  world?: string;
  visit?: { world: string; view: number };
  summary?: string;
};
type Chapter = { id: string; title: string; label: string; intro: string; cover: string; lessons: Lesson[] };

const BOOK: Chapter[] = chapters;
const QUICK_CHAPTER = EXTRA_PLAYBOOK_CHAPTERS.find((c) => c.id === "quick_menus");
const OTHER_EXTRA_CHAPTERS = EXTRA_PLAYBOOK_CHAPTERS.filter((c) => c.id !== "quick_menus");
const GUIDE_CHAPTERS: Chapter[] = [
  ...(QUICK_CHAPTER ? [QUICK_CHAPTER] : []),
  ...BOOK.filter((ch) => ch.id !== "worlds"),
  ...OTHER_EXTRA_CHAPTERS,
];
const CHAPTER_BY_ID = new Map(GUIDE_CHAPTERS.map((ch) => [ch.id, ch]));
const WORLD_LESSONS = BOOK.find((ch) => ch.id === "worlds")?.lessons ?? [];
const CHECKLIST_STORAGE_KEY = "pixel_civ_playbook_checks_v1";

const STAT_LABELS: Record<string, string> = {
  population: "Housing",
  jobs: "Jobs",
  power: "Power",
  water: "Water",
  waste: "Waste",
  food: "Food",
  education: "Education",
  recreation: "Recreation",
  government: "Gov",
  police: "Police",
  policeRadius: "Police radius",
  fireRadius: "Fire radius",
  military: "Defense",
  income: "Income",
  nuisanceRadius: "Nuisance",
};

const DOMAINS: Record<string, string> = {
  land: "Land",
  water: "Water",
  coast_or_water: "Coast / water",
  any: "Any",
};

const CATEGORY_NAME_BY_ID = new Map<string, string>(
  catalog.map((entry) => [entry.category, entry.categoryName]),
);
const EXISTING_CATALOG_IDS = new Set(catalog.map((entry) => entry.id));

type CatalogEntry = (typeof catalog)[number];

const EXPANSION_CATALOG_ENTRIES: CatalogEntry[] = BALANCED_EXPANSION_ELEMENTS.filter(
  (el) => !EXISTING_CATALOG_IDS.has(el.id),
).map((el) => {
  const stats: Record<string, number> = {};
  if (el.popBase) stats.population = el.popBase;
  if (el.jobs) stats.jobs = el.jobs;
  if (el.power) stats.power = el.power;
  if (el.water) stats.water = el.water;
  if (el.waste) stats.waste = el.waste;
  if (el.food) stats.food = el.food;
  if (el.education) stats.education = el.education;
  if (el.recreation) stats.recreation = el.recreation;
  if (el.government) stats.government = el.government;
  if (el.police) stats.police = el.police;
  if (el.policeRadius) stats.policeRadius = el.policeRadius;
  if (el.fireRadius) stats.fireRadius = el.fireRadius;
  if (el.military) stats.military = el.military;
  if (el.income) stats.income = el.income;

  const sample = catalog[0];
  return {
    ...sample,
    id: el.id,
    name: el.name,
    category: el.category,
    categoryName: CATEGORY_NAME_BY_ID.get(el.category) ?? el.category,
    stage: el.stage,
    cost: el.cost,
    domain: el.domain,
    isStarter: el.stage <= 1,
    maxLevel: 5,
    description: el.description,
    usage: el.description,
    growth: el.growth,
    stats,
    image: "/handbook/catalog/" + el.id + ".webp",
    thumbnail: "/handbook/catalog/thumbs/" + el.id + ".webp",
  } as CatalogEntry;
});

const ALL_CATALOG: CatalogEntry[] = [...catalog, ...EXPANSION_CATALOG_ENTRIES];

const CATEGORY_OPTIONS: { id: BuildCategory; name: string }[] = Array.from(
  new Map(
    ALL_CATALOG.map((entry) => [entry.categoryName, { id: entry.category as BuildCategory, name: entry.categoryName }]),
  ).values(),
);
const asset = (path: string) => "./" + path.replace(/^\//, "");
const money = (n: number) => "$" + n.toLocaleString("en");
const clampInt = (val: number | undefined, lo: number, hi: number, fallback: number) =>
  typeof val === "number" && Number.isInteger(val) && val >= lo && val <= hi ? val : fallback;

function findParentSectionId(chapterId: string): string {
  return HANDBOOK_SECTIONS.find((sec) => sec.chapterIds.includes(chapterId))?.id ?? HANDBOOK_SECTIONS[0].id;
}

function parseExternalRoute(route?: Partial<UnifiedAtlasRoute>): UnifiedAtlasRoute {
  const validId = route?.elementId && ELEMENT_BY_ID[route.elementId] ? route.elementId : undefined;
  const maxLv = validId ? Math.max(5, getMaxElementLevel(validId)) : 5;
  return {
    tab: validId ? "atlas" : route?.tab ?? "chapters",
    elementId: validId,
    level: clampInt(route?.level, 1, maxLv, validId ? Math.min(3, maxLv) : 3),
    variant: clampInt(route?.variant, 1, 4, 1),
    section: route?.section || GUIDE_CHAPTERS[0]?.id || "quick_menus",
    lesson: route?.lesson,
    query: route?.query ?? "",
    category: route?.category ?? "",
  };
}

export function UnifiedAtlas({
  embedded = true,
  currentMode = "real",
  initialRoute,
  onChangeRoute,
  onClose,
  onPlayWorld,
}: {
  embedded?: boolean;
  currentMode?: GameMode;
  initialRoute?: Partial<UnifiedAtlasRoute>;
  onChangeRoute?: (next: UnifiedAtlasRoute) => void;
  onClose?: () => void;
  onPlayWorld?: (id: ExampleWorldId, mode: ExampleMode, viewIndex?: number) => void;
}) {
  const [route, setRoute] = useState<UnifiedAtlasRoute>(() => parseExternalRoute(initialRoute));
  const [playbookMode, setPlaybookMode] = useState<GameMode>(currentMode);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const raw = typeof window !== "undefined" ? readPlayerItem(CHECKLIST_STORAGE_KEY) : null;
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [night, setNight] = useState(false);
  const [joined, setJoined] = useState(false);
  const [staticImage, setStaticImage] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [openSectionId, setOpenSectionId] = useState<string>(() =>
    findParentSectionId(parseExternalRoute(initialRoute).section ?? "quick_menus"),
  );
  const [openChapterId, setOpenChapterId] = useState<string>(
    () => parseExternalRoute(initialRoute).section ?? "quick_menus",
  );
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const globalSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPlaybookMode(currentMode);
  }, [currentMode]);

  useEffect(() => {
    if (initialRoute) {
      const parsed = parseExternalRoute(initialRoute);
      setRoute(parsed);
      setJoined(false);
      if (parsed.section) {
        setOpenSectionId(findParentSectionId(parsed.section));
        setOpenChapterId(parsed.section);
      }
    }
  }, [
    initialRoute?.tab,
    initialRoute?.elementId,
    initialRoute?.level,
    initialRoute?.variant,
    initialRoute?.section,
    initialRoute?.lesson,
  ]);

  const toggleCheck = (key: string) => {
    setCheckedItems((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        writePlayerItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage limits
      }
      return next;
    });
  };

  const updateRoute = (patch: Partial<UnifiedAtlasRoute>, scrollTop = false) => {
    setRoute((prev) => {
      const next: UnifiedAtlasRoute = { ...prev, ...patch };
      if (patch.elementId && patch.elementId !== prev.elementId) {
        const maxLv = Math.max(5, getMaxElementLevel(patch.elementId));
        next.level = clampInt(patch.level, 1, maxLv, Math.min(3, maxLv));
        next.variant = clampInt(patch.variant, 1, 4, 1);
      }
      onChangeRoute?.(next);
      return next;
    });
    if (patch.section) {
      setOpenSectionId(findParentSectionId(patch.section));
      setOpenChapterId(patch.section);
    }
    if (patch.elementId !== undefined) setJoined(false);
    if (scrollTop) {
      const host = bodyRef.current?.closest(".ui-guide-modal") ?? bodyRef.current;
      host?.scrollTo(0, 0);
    }
  };

  const query = route.query ?? "";
  const categoryFilter = route.category ?? "";
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_CATALOG.filter((entry) => {
      if (categoryFilter && entry.categoryName !== categoryFilter) return false;
      if (!q) return true;
      return (entry.name + " " + entry.id + " " + entry.categoryName + " " + entry.usage + " " + entry.description)
        .toLowerCase()
        .includes(q);
    });
  }, [query, categoryFilter]);

  const globalMatches = useMemo(() => {
    const raw = globalSearch.trim().toLowerCase();
    if (!raw) return null;
    const tokens = raw.split(/\s+/).filter(Boolean);
    const matchesAll = (haystack: string) => {
      const low = haystack.toLowerCase();
      return tokens.every((t) => low.includes(t));
    };

    const lessons: { chapterId: string; chapterLabel: string; lessonId: string; title: string; snippet: string }[] = [];
    for (const ch of GUIDE_CHAPTERS) {
      const brief = getModeChapterBrief(ch.id, playbookMode);
      const briefText = brief ? `${brief.goal} ${brief.tip} ${brief.watchOut}` : "";
      for (const l of ch.lessons) {
        const hay = `${ch.label} ${ch.title} ${ch.intro} ${l.title} ${l.steps.join(" ")} ${briefText}`;
        if (matchesAll(hay)) {
          const hitStep = l.steps.find((s) => tokens.some((t) => s.toLowerCase().includes(t))) ?? l.steps[0] ?? ch.intro;
          lessons.push({
            chapterId: ch.id,
            chapterLabel: ch.label,
            lessonId: l.id,
            title: l.title,
            snippet: hitStep,
          });
        }
      }
    }

    const elements = ALL_CATALOG
      .filter((entry) =>
        matchesAll(`${entry.name} ${entry.id} ${entry.categoryName} ${entry.usage} ${entry.description} ${entry.growth}`),
      )
      .slice(0, 10);

    const islands = WORLD_LESSONS.filter((w) =>
      matchesAll(`${w.title} ${w.summary ?? ""} ${w.steps.join(" ")}`),
    ).slice(0, 6);

    return {
      lessons: lessons.slice(0, 8),
      totalLessons: lessons.length,
      elements,
      totalElements: ALL_CATALOG.filter((entry) =>
        matchesAll(`${entry.name} ${entry.id} ${entry.categoryName} ${entry.usage} ${entry.description} ${entry.growth}`),
      ).length,
      islands,
      total: lessons.length + islands.length + elements.length,
    };
  }, [globalSearch, playbookMode]);

  const selectedEntry = useMemo(
    () => (route.elementId ? ALL_CATALOG.find((row) => row.id === route.elementId) : undefined),
    [route.elementId],
  );
  const selectedDef = selectedEntry ? ELEMENT_BY_ID[selectedEntry.id] : undefined;
  const selectedDesign = selectedEntry ? DESIGNS[selectedEntry.id] : undefined;
  const maxLevels = selectedEntry ? Math.max(5, getMaxElementLevel(selectedEntry.id)) : 5;
  const level = clampInt(route.level, 1, maxLevels, 3);
  const playableLevel = selectedEntry ? Math.min(level, getMaxElementLevel(selectedEntry.id)) : 1;
  const variantZero = clampInt(route.variant, 1, 4, 1) - 1;
  const styleNames = selectedEntry
    ? designStyles[selectedEntry.id as keyof typeof designStyles] ??
      BALANCED_EXPANSION_BY_ID[selectedEntry.id]?.styleNames ??
      ["Style A", "Style B", "Style C", "Style D"]
    : ["Style A", "Style B", "Style C", "Style D"];
  const partnerDef = selectedEntry ? ELEMENT_BY_ID[getGuidePartner(selectedEntry.id)] : undefined;
  const joins = useMemo(() => {
    if (!selectedEntry || !partnerDef) return [];
    const plot = getNeighborPreview(selectedEntry.id, playableLevel)[0];
    return [...new Set(plot?.edges.filter((e) => e.neighbor === partnerDef.id).map((e) => e.kind))];
  }, [selectedEntry, partnerDef, playableLevel]);

  const activeChapterIndex = useMemo(() => {
    const idx = GUIDE_CHAPTERS.findIndex((c) => c.id === route.section);
    return idx >= 0 ? idx : 0;
  }, [route.section]);
  const activeChapter = GUIDE_CHAPTERS[activeChapterIndex];

  const activeLessonIndex = useMemo(() => {
    if (!activeChapter) return 0;
    const idx = activeChapter.lessons.findIndex((l) => l.id === route.lesson);
    return idx >= 0 ? idx : 0;
  }, [activeChapter, route.lesson]);
  const activeLesson = activeChapter?.lessons[activeLessonIndex];
  const activeModeMeta = PLAYBOOK_MODES.find((m) => m.id === playbookMode) ?? PLAYBOOK_MODES[1];
  const chapterModeBrief = activeChapter ? getModeChapterBrief(activeChapter.id, playbookMode) : null;
  const activeParentSection = HANDBOOK_SECTIONS.find((s) => s.chapterIds.includes(activeChapter?.id ?? ""));

  const completedChecks = useMemo(() => {
    if (!chapterModeBrief || !activeChapter) return 0;
    return chapterModeBrief.checklist.filter((_, idx) => Boolean(checkedItems[`${playbookMode}:${activeChapter.id}:${idx}`])).length;
  }, [chapterModeBrief, activeChapter, checkedItems, playbookMode]);

  const goLesson = (delta: number) => {
    if (!activeChapter) return;
    const nextIdx = activeLessonIndex + delta;
    if (nextIdx >= 0 && nextIdx < activeChapter.lessons.length) {
      updateRoute({ lesson: activeChapter.lessons[nextIdx].id }, true);
      return;
    }
    if (delta > 0 && activeChapterIndex + 1 < GUIDE_CHAPTERS.length) {
      const nextCh = GUIDE_CHAPTERS[activeChapterIndex + 1];
      updateRoute({ section: nextCh.id, lesson: nextCh.lessons[0]?.id }, true);
    } else if (delta < 0 && activeChapterIndex - 1 >= 0) {
      const prevCh = GUIDE_CHAPTERS[activeChapterIndex - 1];
      updateRoute({ section: prevCh.id, lesson: prevCh.lessons[prevCh.lessons.length - 1]?.id }, true);
    }
  };

  const stageName = (lv: number) => {
    if (!selectedDef || !selectedDesign) return "Level " + lv;
    return lv > getMaxElementLevel(selectedDef.id) ? selectedDesign.levels[lv - 1] : getElementLevelName(selectedDef, lv);
  };

  const showGlobalResults = Boolean(globalMatches && (searchFocused || globalSearch.trim().length > 0));

  return (
    <div ref={bodyRef} className="pc-atlas-root is-compact">
      <header className="pc-atlas-topbar">
        <div className="pc-atlas-brand" title="Atlas & Handbook">
          <BookOpen size={15} aria-hidden="true" />
          <span>Handbook</span>
        </div>
        <nav className="pc-atlas-tabs" aria-label="Handbook sections">
          <button
            type="button"
            aria-pressed={route.tab === "chapters"}
            onClick={() => updateRoute({ tab: "chapters" }, true)}
          >
            <BookOpen size={13} aria-hidden="true" />
            <span>Playbook</span>
          </button>
          <button
            type="button"
            aria-pressed={route.tab === "atlas"}
            onClick={() => updateRoute({ tab: "atlas", elementId: route.tab === "atlas" ? undefined : route.elementId }, true)}
          >
            <Compass size={13} aria-hidden="true" />
            <span>Atlas</span>
          </button>
          <button
            type="button"
            aria-pressed={route.tab === "islands"}
            onClick={() => updateRoute({ tab: "islands" }, true)}
          >
            <MapIcon size={13} aria-hidden="true" />
            <span>Islands</span>
          </button>
        </nav>
        {embedded && onClose ? (
          <button type="button" className="pc-atlas-close" aria-label="Close Handbook" title="Close" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        ) : (
          <a className="pc-atlas-close-link" href="./index.html" aria-label="Back to Island">
            <ArrowLeft size={16} aria-hidden="true" />
          </a>
        )}
      </header>

      {/* Global Handbook Search (Playbook lessons, Atlas elements & Islands) */}
      <div className="pc-hb-search-wrap">
        <label className="pc-hb-search-bar">
          <Search size={14} aria-hidden="true" />
          <input
            ref={globalSearchRef}
            type="search"
            aria-label="Search Handbook"
            placeholder="Search Playbook, elements, controls, or islands…"
            value={globalSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 160)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && globalSearch) {
                e.stopPropagation();
                setGlobalSearch("");
                globalSearchRef.current?.blur();
              }
            }}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
          {globalSearch && (
            <button
              type="button"
              className="ui-mini-icon-btn"
              aria-label="Clear handbook search"
              onClick={() => {
                setGlobalSearch("");
                globalSearchRef.current?.focus();
              }}
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </label>

        {showGlobalResults && globalMatches && (
          <div className="pc-hb-search-results" role="region" aria-label="Handbook search results">
            {globalMatches.lessons.length === 0 &&
            globalMatches.elements.length === 0 &&
            globalMatches.islands.length === 0 ? (
              <p className="pc-hb-search-empty">No matching lessons, elements, or islands for “{globalSearch.trim()}”.</p>
            ) : (
              <>
                {globalMatches.lessons.length > 0 && (
                  <div className="pc-hb-search-group">
                    <span className="pc-hb-search-group-head">
                      Playbook lessons ({globalMatches.totalLessons})
                    </span>
                    <div className="pc-hb-search-list">
                      {globalMatches.lessons.map((hit) => (
                        <button
                          key={`${hit.chapterId}:${hit.lessonId}`}
                          type="button"
                          className="pc-hb-search-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            updateRoute({ tab: "chapters", section: hit.chapterId, lesson: hit.lessonId }, true);
                            setGlobalSearch("");
                            setSearchFocused(false);
                          }}
                        >
                          <BookOpen size={13} aria-hidden="true" />
                          <span>
                            <strong>{hit.title}</strong>
                            <small>{hit.chapterLabel} · {hit.snippet}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {globalMatches.elements.length > 0 && (
                  <div className="pc-hb-search-group">
                    <div className="pc-hb-search-group-row">
                      <span className="pc-hb-search-group-head">
                        Atlas elements ({globalMatches.totalElements})
                      </span>
                      {globalMatches.totalElements > globalMatches.elements.length && (
                        <button
                          type="button"
                          className="pc-hb-search-more"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const q = globalSearch.trim();
                            updateRoute({ tab: "atlas", elementId: undefined, query: q, category: "" }, true);
                            setGlobalSearch("");
                            setSearchFocused(false);
                          }}
                        >
                          View all {globalMatches.totalElements} in Atlas →
                        </button>
                      )}
                    </div>
                    <div className="pc-hb-search-el-grid">
                      {globalMatches.elements.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className="pc-hb-search-el"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            updateRoute(
                              {
                                tab: "atlas",
                                elementId: entry.id,
                                level: Math.min(3, entry.maxLevel),
                                variant: 1,
                              },
                              true,
                            );
                            setGlobalSearch("");
                            setSearchFocused(false);
                          }}
                        >
                          {ELEMENT_BY_ID[entry.id] ? (
                            <ElementFavicon def={ELEMENT_BY_ID[entry.id]} />
                          ) : (
                            <img src={asset(entry.thumbnail)} alt="" loading="lazy" />
                          )}
                          <span>
                            <strong>{entry.name}</strong>
                            <small>{entry.categoryName}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {globalMatches.islands.length > 0 && (
                  <div className="pc-hb-search-group">
                    <span className="pc-hb-search-group-head">
                      Playable islands ({globalMatches.islands.length})
                    </span>
                    <div className="pc-hb-search-list">
                      {globalMatches.islands.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          className="pc-hb-search-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            updateRoute({ tab: "islands" }, true);
                            setGlobalSearch("");
                            setSearchFocused(false);
                          }}
                        >
                          <MapIcon size={13} aria-hidden="true" />
                          <span>
                            <strong>{w.title}</strong>
                            {w.summary && <small>{w.summary}</small>}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="pc-atlas-main">
        {route.tab === "atlas" && selectedEntry && selectedDef && selectedDesign ? (
          <section className="pc-atlas-detail" aria-label={selectedEntry.name}>
            <div className="pc-atlas-crumb-bar">
              <button
                type="button"
                className="pc-atlas-back-btn"
                aria-label="Back to all elements"
                onClick={() => updateRoute({ elementId: undefined }, true)}
              >
                <ArrowLeft size={14} aria-hidden="true" />
                <span>Atlas</span>
              </button>
              <p className="pc-atlas-meta-line">
                <span>{selectedEntry.categoryName}</span>
                <span aria-hidden="true"> · </span>
                <span>{DOMAINS[selectedEntry.domain] ?? selectedEntry.domain}</span>
                <span aria-hidden="true"> · </span>
                <span>{selectedEntry.cost ? money(selectedEntry.cost) : "Free"}</span>
                <span aria-hidden="true"> · </span>
                <span>
                  {selectedEntry.wealthThreshold
                    ? money(selectedEntry.wealthThreshold) + " wealth"
                    : selectedEntry.isStarter
                      ? "Starter"
                      : "Stage " + selectedEntry.stage}
                </span>
              </p>
            </div>

            <div className="pc-atlas-detail-grid">
              <div className="pc-atlas-stage-col">
                <div className={"pc-atlas-stage" + (night ? " is-night" : "")}>
                  <div className="pc-atlas-stage-head">
                    <div>
                      <p className="pc-atlas-stage-kicker">
                        {selectedEntry.categoryName} · {roadWidth(selectedEntry.id) > 1
                          ? frontageWidth(selectedEntry.id)
                          : getStandardFootprintForLevel(selectedDef, level).join("×")}
                      </p>
                      <h1>{selectedEntry.name}</h1>
                    </div>
                    {!staticImage && (
                      <button
                        type="button"
                        className="pc-atlas-light-btn"
                        aria-pressed={night}
                        aria-label={night ? "Switch to day lighting" : "Switch to night lighting"}
                        title={night ? "Night" : "Day"}
                        onClick={() => setNight((n) => !n)}
                      >
                        {night ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
                      </button>
                    )}
                  </div>

                  <AtlasModel
                    def={selectedDef}
                    level={playableLevel}
                    variant={variantZero}
                    night={night}
                    joined={joined}
                    onStatic={setStaticImage}
                  />

                  <div className="pc-atlas-stage-foot">
                    <div className="pc-atlas-style-caption">
                      <strong>{styleNames[variantZero]}</strong>
                      <span>{staticImage ? "Illustrated fallback" : "Drag to orbit 360°"}</span>
                    </div>
                    <div className="pc-atlas-variants" role="group" aria-label="Visual style">
                      {["A", "B", "C", "D"].map((letter, idx) => (
                        <button
                          key={letter}
                          type="button"
                          title={styleNames[idx]}
                          aria-label={"Style " + letter + ": " + styleNames[idx]}
                          aria-pressed={variantZero === idx}
                          onClick={() => updateRoute({ variant: idx + 1 })}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <details className="pc-atlas-nest" open>
                  <summary>
                    <span>Lv {level} · {stageName(level)}</span>
                    <small>
                      {roadWidth(selectedEntry.id) > 1
                        ? frontageWidth(selectedEntry.id)
                        : getStandardFootprintForLevel(selectedDef, level).join("×") + " tiles"}
                    </small>
                  </summary>
                  <div className="pc-atlas-nest-body">
                    <p className="pc-atlas-prose">{selectedEntry.growth}</p>
                    {level > playableLevel && (
                      <p className="pc-atlas-note">
                        Legacy level matches level {playableLevel} footprint in new cities.
                      </p>
                    )}
                    <div className="pc-atlas-level-grid" role="group" aria-label="Select level">
                      {Array.from({ length: maxLevels }, (_, i) => i + 1).map((lvNum) => (
                        <button
                          key={lvNum}
                          type="button"
                          aria-pressed={level === lvNum}
                          onClick={() => updateRoute({ level: lvNum })}
                        >
                          <small>Lv {lvNum}</small>
                          <b>{stageName(lvNum)}</b>
                        </button>
                      ))}
                    </div>
                  </div>
                </details>

                <details className="pc-atlas-nest">
                  <summary>
                    <span>2D sprite sheet (all levels &amp; styles)</span>
                  </summary>
                  <div className="pc-atlas-nest-body">
                    <div className="pc-atlas-sheet-wrap">
                      <img
                        src={asset(selectedEntry.image)}
                        alt={selectedEntry.name + " in all levels and styles"}
                        loading="lazy"
                      />
                    </div>
                  </div>
                </details>
              </div>

              <aside className="pc-atlas-notes-col">
                <details className="pc-atlas-nest" open>
                  <summary><span>On the island</span></summary>
                  <div className="pc-atlas-nest-body">
                    <p className="pc-atlas-prose">{selectedEntry.description}</p>
                    <p className="pc-atlas-prose">{getGuideUsage(selectedEntry.id, joins[0], selectedEntry.description)}</p>
                  </div>
                </details>

                {Object.keys(selectedEntry.stats).length > 0 && (
                  <details className="pc-atlas-nest" open>
                    <summary><span>Level-1 stats</span></summary>
                    <div className="pc-atlas-nest-body">
                      <dl className="pc-atlas-facts">
                        {Object.entries(selectedEntry.stats)
                          .filter(([, n]) => n !== undefined)
                          .map(([key, n]) => (
                            <React.Fragment key={key}>
                              <dt>{STAT_LABELS[key] ?? key}</dt>
                              <dd>
                                {n! > 0 ? "+" : ""}
                                {n}
                              </dd>
                            </React.Fragment>
                          ))}
                      </dl>
                    </div>
                  </details>
                )}

                {partnerDef && (
                  <details className="pc-atlas-nest">
                    <summary><span>Neighbor connection</span></summary>
                    <div className="pc-atlas-nest-body">
                      {joins.length > 0 && (
                        <p className="pc-atlas-meta-line" style={{ marginBottom: 8 }}>
                          {(joined ? "Joined with " : "Auto-links with ") +
                            partnerDef.name +
                            " · " +
                            joins.map((kind) => EDGE_LABELS[kind]).join(", ")}
                        </p>
                      )}
                      <div className="pc-atlas-inline-btns">
                        {!staticImage && (
                          <button
                            type="button"
                            className="pc-atlas-toggle-btn"
                            aria-pressed={joined}
                            onClick={() => setJoined((j) => !j)}
                          >
                            {joined ? "Show alone" : "Beside " + partnerDef.name}
                          </button>
                        )}
                        <button
                          type="button"
                          className="pc-atlas-toggle-btn"
                          onClick={() => updateRoute({ elementId: partnerDef.id, level: 3, variant: 1 }, true)}
                        >
                          Inspect {partnerDef.name} →
                        </button>
                      </div>
                    </div>
                  </details>
                )}

                <details className="pc-atlas-nest">
                  <summary><span>Related lessons</span></summary>
                  <div className="pc-atlas-nest-body">
                    <div className="pc-atlas-lesson-links">
                      {relatedLessons(selectedEntry.id, selectedEntry.category).map((lesson) => (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => updateRoute({ tab: "chapters", section: lesson.section, lesson: lesson.id })}
                        >
                          {lesson.title} →
                        </button>
                      ))}
                    </div>
                  </div>
                </details>
              </aside>
            </div>
          </section>
        ) : route.tab === "atlas" ? (
          <section className="pc-atlas-browser" aria-label="Element catalog">
            <div className="pc-atlas-filters">
              <label className="pc-atlas-search">
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search elements"
                  placeholder="Search elements…"
                  value={query}
                  onChange={(e) => updateRoute({ query: e.target.value })}
                />
              </label>
              <span className="pc-atlas-count" aria-live="polite">
                {categoryFilter || "All"} · {results.length}/{ALL_CATALOG.length}
              </span>
            </div>

            <div className="pc-atlas-cat-icons" role="group" aria-label="Filter by category">
              <button
                type="button"
                className={"pc-atlas-cat-icon" + (!categoryFilter ? " is-active" : "")}
                aria-pressed={!categoryFilter}
                aria-label="All categories"
                title="All categories"
                onClick={() => updateRoute({ category: "" })}
              >
                <CategoryFavicon category="all" size={18} />
              </button>
              {CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={"pc-atlas-cat-icon" + (categoryFilter === c.name ? " is-active" : "")}
                  aria-pressed={categoryFilter === c.name}
                  aria-label={c.name}
                  title={c.name}
                  onClick={() => updateRoute({ category: categoryFilter === c.name ? "" : c.name })}
                >
                  <CategoryFavicon category={c.id} size={18} />
                </button>
              ))}
            </div>

            {results.length === 0 ? (
              <div className="pc-atlas-empty">
                <p>No elements match this search.</p>
                <button
                  type="button"
                  className="pc-atlas-toggle-btn"
                  onClick={() => updateRoute({ query: "", category: "" })}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="pc-atlas-grid">
                {results.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="pc-atlas-tile"
                    onClick={() =>
                      updateRoute(
                        {
                          tab: "atlas",
                          elementId: entry.id,
                          level: Math.min(3, entry.maxLevel),
                          variant: 1,
                        },
                        true,
                      )
                    }
                  >
                    {ELEMENT_BY_ID[entry.id] ? (
                      <ElementFavicon def={ELEMENT_BY_ID[entry.id]} />
                    ) : (
                      <img src={asset(entry.thumbnail)} alt="" loading="lazy" />
                    )}
                    <strong>{entry.name}</strong>
                    <span className="pc-atlas-tile-meta">
                      {entry.cost ? money(entry.cost) : "Free"} · {entry.isStarter ? "Start" : "S" + entry.stage}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : route.tab === "chapters" ? (
          <section className="pc-atlas-chapters" aria-label="Island playbook">
            {/* Compact single-row Mode bar */}
            <div className="pc-pb-compact-head">
              <div className="pc-pb-mode-pills" role="group" aria-label="Playbook game mode">
                {PLAYBOOK_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={playbookMode === m.id}
                    title={m.tagline}
                    onClick={() => setPlaybookMode(m.id)}
                  >
                    {m.shortLabel}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={"pc-pb-toc-btn" + (treeOpen ? " is-open" : "")}
                aria-expanded={treeOpen}
                onClick={() => setTreeOpen((v) => !v)}
              >
                <FolderOpen size={14} aria-hidden="true" />
                <span>{activeChapter?.label ?? "Chapters"}</span>
                {treeOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
              </button>
            </div>

            <div className="pc-pb-layout">
              {/* Nested Section -> Chapter -> Lesson Tree */}
              <aside className={"pc-pb-tree" + (treeOpen ? " is-open" : "")} aria-label="Handbook contents">
                {HANDBOOK_SECTIONS.map((sec) => {
                  const secOpen = openSectionId === sec.id;
                  const secChapters = sec.chapterIds
                    .map((id) => CHAPTER_BY_ID.get(id))
                    .filter((ch): ch is Chapter => Boolean(ch));
                  return (
                    <div key={sec.id} className="pc-pb-tree-sec">
                      <button
                        type="button"
                        className={"pc-pb-tree-sec-btn" + (secOpen ? " is-open" : "")}
                        aria-expanded={secOpen}
                        onClick={() => setOpenSectionId((cur) => (cur === sec.id ? "" : sec.id))}
                      >
                        {secOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                        <span>{sec.label}</span>
                        <small>{secChapters.length}</small>
                      </button>
                      {secOpen && (
                        <div className="pc-pb-tree-chapters">
                          {secChapters.map((ch) => {
                            const chActive = activeChapter?.id === ch.id;
                            const chOpen = openChapterId === ch.id;
                            return (
                              <div key={ch.id} className="pc-pb-tree-ch">
                                <button
                                  type="button"
                                  className={"pc-pb-tree-ch-btn" + (chActive ? " is-active" : "")}
                                  aria-expanded={chOpen}
                                  onClick={() => {
                                    if (chActive) {
                                      setOpenChapterId((cur) => (cur === ch.id ? "" : ch.id));
                                    } else {
                                      updateRoute({ section: ch.id, lesson: ch.lessons[0]?.id }, true);
                                    }
                                  }}
                                >
                                  {chOpen ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
                                  <span>{ch.label}</span>
                                  <small>{ch.lessons.length}</small>
                                </button>
                                {chOpen && (
                                  <div className="pc-pb-tree-lessons">
                                    {ch.lessons.map((l, idx) => (
                                      <button
                                        key={l.id}
                                        type="button"
                                        className={activeLesson?.id === l.id ? "is-current" : ""}
                                        aria-current={activeLesson?.id === l.id ? "page" : undefined}
                                        onClick={() => {
                                          updateRoute({ section: ch.id, lesson: l.id }, true);
                                          setTreeOpen(false);
                                        }}
                                      >
                                        <span>{idx + 1}. {l.title}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </aside>

              {/* Focused Compact Lesson Card */}
              {activeChapter && activeLesson && (
                <div className="pc-atlas-chapter-body">
                  <article id={"atlas-lesson-" + activeLesson.id} className="pc-atlas-lesson pc-pb-lesson-card">
                    <div className="pc-pb-breadcrumb">
                      <span>{activeParentSection?.label}</span>
                      <ChevronRight size={12} aria-hidden="true" />
                      <span>{activeChapter.label}</span>
                      <small>
                        {activeLessonIndex + 1}/{activeChapter.lessons.length}
                      </small>
                    </div>

                    <div className="pc-atlas-lesson-head">
                      <h2>{activeLesson.title}</h2>
                      {activeLesson.visit && onPlayWorld && (
                        <button
                          type="button"
                          className="pc-atlas-primary-btn"
                          onClick={() => {
                            onClose?.();
                            onPlayWorld(activeLesson.visit!.world as ExampleWorldId, "god", activeLesson.visit!.view);
                          }}
                        >
                          Visit →
                        </button>
                      )}
                    </div>

                    <p className="pc-pb-chapter-intro">{activeChapter.intro}</p>

                    <ol className="pc-atlas-steps pc-pb-steps">
                      {activeLesson.steps.map((step, i) => (
                        <li key={i}>
                          <span className="pc-pb-step-badge">{i + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>

                    {activeLesson.stock && activeLesson.stock.length > 0 && (
                      <div className="pc-atlas-stock">
                        {activeLesson.stock.map((item) => (
                          <figure key={item.name}>
                            <img src={asset(item.image)} alt={item.name} loading="lazy" />
                            <figcaption>
                              <strong>{item.name}</strong>
                              <small>{item.detail}</small>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    )}

                    {activeLesson.designs && activeLesson.designs.length > 0 && (
                      <div className="pc-atlas-lesson-designs" aria-label="Elements featured in this lesson">
                        {activeLesson.designs.map((id) => {
                          const item = ALL_CATALOG.find((row) => row.id === id);
                          if (!item) return null;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() =>
                                updateRoute(
                                  {
                                    tab: "atlas",
                                    elementId: item.id,
                                    level: Math.min(3, item.maxLevel),
                                    variant: 1,
                                  },
                                  true,
                                )
                              }
                            >
                              {ELEMENT_BY_ID[item.id] ? (
                                <ElementFavicon def={ELEMENT_BY_ID[item.id]} />
                              ) : (
                                <img src={asset(item.thumbnail)} alt="" loading="lazy" />
                              )}
                              <span>
                                <strong>{item.name}</strong>
                                <small>Lv 1–{item.maxLevel} · 3D →</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {activeLesson.examples.length > 0 && (
                      <div className="pc-atlas-plates">
                        {activeLesson.examples.map((pic) => (
                          <figure key={pic.image}>
                            <img src={asset(pic.image)} width={pic.width} height={pic.height} loading="lazy" alt={pic.alt} />
                            <figcaption>{pic.caption}</figcaption>
                          </figure>
                        ))}
                      </div>
                    )}

                    {/* Nested Collapsible Mode Strategy & Practice Checklist */}
                    {chapterModeBrief && (
                      <div className="pc-pb-nested-boxes">
                        <div className="pc-pb-fold">
                          <button
                            type="button"
                            className="pc-pb-fold-head"
                            aria-expanded={strategyOpen}
                            onClick={() => setStrategyOpen((v) => !v)}
                          >
                            <Sparkles size={13} aria-hidden="true" />
                            <span>{activeModeMeta.label} Strategy</span>
                            <small>{activeModeMeta.pace}</small>
                            {strategyOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                          </button>
                          {strategyOpen && (
                            <div className="pc-pb-brief-grid">
                              <div>
                                <span className="pc-pb-brief-label">Goal</span>
                                <p>{chapterModeBrief.goal}</p>
                              </div>
                              <div>
                                <span className="pc-pb-brief-label">Tip</span>
                                <p>{chapterModeBrief.tip}</p>
                              </div>
                              <div>
                                <span className="pc-pb-brief-label">Watch out</span>
                                <p>{chapterModeBrief.watchOut}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {chapterModeBrief.checklist.length > 0 && (
                          <div className="pc-pb-fold">
                            <button
                              type="button"
                              className="pc-pb-fold-head"
                              aria-expanded={checklistOpen}
                              onClick={() => setChecklistOpen((v) => !v)}
                            >
                              <ListChecks size={13} aria-hidden="true" />
                              <span>Practice Checklist</span>
                              <small>
                                {completedChecks}/{chapterModeBrief.checklist.length}
                              </small>
                              {checklistOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                            </button>
                            {checklistOpen && (
                              <ul className="pc-pb-check-list">
                                {chapterModeBrief.checklist.map((item, idx) => {
                                  const key = `${playbookMode}:${activeChapter.id}:${idx}`;
                                  const done = Boolean(checkedItems[key]);
                                  return (
                                    <li key={key}>
                                      <button
                                        type="button"
                                        className={"pc-pb-check-btn" + (done ? " is-done" : "")}
                                        aria-pressed={done}
                                        onClick={() => toggleCheck(key)}
                                      >
                                        <span className="pc-pb-check-box" aria-hidden="true">
                                          {done && <Check size={12} strokeWidth={3} />}
                                        </span>
                                        <span>{item}</span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Compact Page Turn Footer */}
                    <div className="pc-pb-pager">
                      <button
                        type="button"
                        className="pc-atlas-toggle-btn"
                        disabled={activeChapterIndex === 0 && activeLessonIndex === 0}
                        onClick={() => goLesson(-1)}
                      >
                        <ChevronLeft size={15} aria-hidden="true" />
                        <span>Prev</span>
                      </button>
                      <span className="pc-pb-pager-count">
                        {activeChapterIndex + 1}.{activeLessonIndex + 1} / {GUIDE_CHAPTERS.length}
                      </span>
                      <button
                        type="button"
                        className="pc-atlas-primary-btn"
                        disabled={
                          activeChapterIndex === GUIDE_CHAPTERS.length - 1 &&
                          activeLessonIndex === activeChapter.lessons.length - 1
                        }
                        onClick={() => goLesson(1)}
                      >
                        <span>
                          {activeLessonIndex + 1 < activeChapter.lessons.length
                            ? "Next"
                            : activeChapterIndex + 1 < GUIDE_CHAPTERS.length
                              ? GUIDE_CHAPTERS[activeChapterIndex + 1].label
                              : "Done"}
                        </span>
                        <ChevronRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="pc-atlas-worlds" aria-label="Playable islands">
            <div className="pc-atlas-world-list">
              {WORLD_LESSONS.map((w) => (
                <article key={w.id} className="pc-atlas-world-card">
                  <img
                    src={asset("/handbook/worlds/" + w.id + ".webp")}
                    alt={w.title}
                    loading="lazy"
                    className="pc-atlas-world-hero"
                  />
                  <div className="pc-atlas-world-body">
                    <h2>{w.title}</h2>
                    {w.summary && <p className="pc-atlas-prose">{w.summary}</p>}
                    <details className="pc-atlas-nest">
                      <summary><span>Tour highlights ({w.steps.length})</span></summary>
                      <div className="pc-atlas-nest-body">
                        <ol className="pc-atlas-steps">
                          {w.steps.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    </details>
                    <div className="pc-atlas-world-actions">
                      {onPlayWorld && w.world ? (
                        <>
                          <button
                            type="button"
                            className="pc-atlas-primary-btn"
                            onClick={() => {
                              onClose?.();
                              onPlayWorld(w.world as ExampleWorldId, "real");
                            }}
                          >
                            Real Mode
                          </button>
                          <button
                            type="button"
                            className="pc-atlas-toggle-btn"
                            onClick={() => {
                              onClose?.();
                              onPlayWorld(w.world as ExampleWorldId, "god");
                            }}
                          >
                            God Mode
                          </button>
                        </>
                      ) : (
                        <>
                          <a className="pc-atlas-primary-btn" href={"./index.html#world=" + encodeURIComponent(w.id) + "&mode=real"}>
                            Real Mode
                          </a>
                          <a className="pc-atlas-toggle-btn" href={"./index.html#world=" + encodeURIComponent(w.id)}>
                            God Mode
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
