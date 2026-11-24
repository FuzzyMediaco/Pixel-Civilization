import {openDeviceSaves} from "../game/deviceSaves";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { UnifiedAtlas, type UnifiedAtlasRoute } from "../components/UnifiedAtlas";
import "../components/ui/ui.css";
import "../styles/interface.css";

const readLocation = () =>
  typeof location !== "undefined" ? new URLSearchParams(location.hash.slice(1)) : new URLSearchParams();

function hashToRoute(params: URLSearchParams): Partial<UnifiedAtlasRoute> {
  const courseLesson = params.get("course") ?? undefined;
  const design = params.get("design") ?? undefined;
  if (design) {
    return {
      tab: "atlas", courseLesson,
      elementId: design,
      level: Number(params.get("level")) || undefined,
      variant: Number(params.get("style")) || undefined,
      query: params.get("q") ?? undefined,
      category: params.get("category") ?? undefined,
    };
  }
  const section = params.get("section") ?? "";
  if (!section) return { tab: "course", courseLesson };
  if (section === "worlds") return { tab: "islands" };
  if (section === "catalog") {
    return {
      tab: "atlas", courseLesson,
      query: params.get("q") ?? undefined,
      category: params.get("category") ?? undefined,
    };
  }
  return {
    tab: "chapters", courseLesson,
    section: section || "start",
    lesson: params.get("lesson") ?? undefined,
  };
}

export interface HandbookViewProps {
  embedded?: boolean;
  initialRoute?: string;
  onClose?: () => void;
  onPlayWorld?: (worldId: string, mode?: "real" | "god", viewIndex?: number) => void;
}

export function HandbookView({ embedded = false, initialRoute, onClose, onPlayWorld }: HandbookViewProps) {
  const [route, setRoute] = useState<Partial<UnifiedAtlasRoute>>(() =>
    hashToRoute(
      embedded ? new URLSearchParams(initialRoute?.replace(/^#/, "") ?? "") : readLocation(),
    ),
  );

  useEffect(() => {
    if (embedded) return;
    const sync = () => setRoute(hashToRoute(readLocation()));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [embedded]);

  return (
    <UnifiedAtlas
      embedded={embedded}
      initialRoute={route}
      onClose={onClose}
      onPlayWorld={onPlayWorld}
      onChangeRoute={(next) => {
        if (embedded || typeof history === "undefined") return;
        const fields: Record<string, string> = {};
        if (next.courseLesson) fields.course = next.courseLesson;
        if (next.tab === "atlas") {
          if (next.elementId) {
            fields.design = next.elementId;
            if (next.level) fields.level = String(next.level);
            if (next.variant) fields.style = String(next.variant);
          }
          else fields.section = "catalog";
          if (next.query) fields.q = next.query;
          if (next.category) fields.category = next.category;
        } else if (next.tab === "islands") {
          fields.section = "worlds";
        } else if (next.tab === "chapters") {
          fields.section = next.section || "start";
          if (next.lesson) fields.lesson = next.lesson;
        }
        const hash = new URLSearchParams(fields).toString();
        history.replaceState(null, "", hash ? "#" + hash : location.pathname + location.search);
      }}
    />
  );
}

const standaloneMount = typeof document !== "undefined" ? document.getElementById("handbook") : null;
if (standaloneMount) void openDeviceSaves().then(()=>{
  createRoot(standaloneMount).render(<HandbookView />);
});
