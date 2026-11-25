import { normalizeEra, type EraKey } from "../game/eraStyles";

export type AtlasTab = "atlas" | "chapters" | "islands" | "course";
export interface UnifiedAtlasRoute {
  tab: AtlasTab;
  era?: EraKey;
  elementId?: string;
  courseLesson?: string;
  level?: number;
  variant?: number; // Both level and variant are one-based in links.
  section?: string;
  lesson?: string;
  query?: string;
  category?: string;
  originalNames?: boolean;
  returnChapter?: string;
  returnLesson?: string;
}

export function readAtlasRoute(p: URLSearchParams, guide = false): Partial<UnifiedAtlasRoute> {
  const id = p.get("design") ?? p.get("id") ?? undefined;
  const section = p.get("section") ?? undefined;
  const tab = id || section === "catalog" ? "atlas" : section === "worlds" ? "islands" : section ? "chapters" : guide && !p.has("course") ? "atlas" : "course";
  return {tab,elementId:id, courseLesson:p.get("course") ?? undefined, section,
    level:p.has("level") ? Number(p.get("level")) : undefined,
    variant:p.has("variant") || p.has("style") ? Number(p.get("variant") ?? p.get("style")) : undefined,
    era:p.has("era") ? normalizeEra(p.get("era")) : undefined, lesson:p.get("lesson") ?? undefined,
    originalNames:p.has("originalNames") ? p.get("originalNames") === "1" : undefined,
    query:p.get("q") ?? undefined, category:p.get("category") ?? undefined,
    returnChapter:p.get("fromChapter") ?? undefined, returnLesson:p.get("fromLesson") ?? undefined};
}

export function writeAtlasRoute(route: Partial<UnifiedAtlasRoute>, guide = false) {
  const p = new URLSearchParams();
  if (route.era) p.set("era",route.era);
  if (route.originalNames) p.set("originalNames","1");
  if (route.courseLesson) p.set("course",route.courseLesson);
  if (route.tab === "atlas") {
    if (route.elementId) {
      p.set(guide ? "id" : "design",route.elementId);
      p.set("level",String(route.level ?? 1));
      p.set(guide ? "variant" : "style",String(route.variant ?? 1));
    } else p.set("section","catalog");
    if (route.query) p.set("q",route.query);
    if (route.category) p.set("category",route.category);
  } else if (route.tab === "islands") p.set("section","worlds");
  else if (route.tab === "chapters") {
    p.set("section",route.section ?? "interface");
    if (route.lesson) p.set("lesson",route.lesson);
  } else if (guide && !route.courseLesson) p.set("course","frontage");
  if (route.returnChapter) p.set("fromChapter",route.returnChapter);
  if (route.returnLesson) p.set("fromLesson",route.returnLesson);
  return p.toString();
}
