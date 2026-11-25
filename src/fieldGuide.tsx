import {openDeviceSaves} from "./game/deviceSaves";
import { prepareOfflineShell } from "./offlineShell";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { UnifiedAtlas, type UnifiedAtlasRoute } from "./components/UnifiedAtlas";
import { readAtlasRoute, writeAtlasRoute } from "./handbook/atlasRoute";
import "./components/ui/ui.css";
import "./styles/interface.css";

function locationRoute() {
  const params = new URLSearchParams(location.protocol === "file:" ? location.hash.slice(1) : location.search);
  const route = readAtlasRoute(params,true);
  if (!params.size) route.elementId = "house";
  return route;
}

export interface FieldGuideViewProps {
  embedded?: boolean;
  initialId?: string;
  initialLevel?: number;
  initialVariant?: number;
  onClose?: () => void;
}

export function FieldGuideView({
  embedded = false,
  initialId,
  initialLevel,
  initialVariant,
  onClose,
}: FieldGuideViewProps) {
  const [route,setRoute] = useState<Partial<UnifiedAtlasRoute>>(() => {
    const next = locationRoute();
    if (initialId) next.elementId = initialId;
    if (initialLevel !== undefined) next.level = initialLevel;
    if (initialVariant !== undefined) next.variant = initialVariant;
    return next;
  });
  useEffect(() => {
    if (embedded) return;
    const sync = () => setRoute(locationRoute());
    window.addEventListener("popstate",sync); window.addEventListener("hashchange",sync);
    return () => {window.removeEventListener("popstate",sync);window.removeEventListener("hashchange",sync);};
  },[embedded]);

  useEffect(() => {
    if (embedded || typeof document === "undefined") return;
    document.title = "Atlas & Handbook · Pixel Civilization";
  }, [embedded]);

  return (
    <UnifiedAtlas
      embedded={embedded}
      initialRoute={route}
      onClose={onClose}
      onChangeRoute={(next) => {
        if (embedded || typeof location === "undefined" || typeof history === "undefined") return;
        history.replaceState(null, "", (location.protocol === "file:" ? "#" : "?") + writeAtlasRoute(next,true));
      }}
    />
  );
}

const standaloneGuide = typeof document !== "undefined" ? document.getElementById("guide") : null;
if (standaloneGuide) {
  void prepareOfflineShell();
  void openDeviceSaves().then(() => createRoot(standaloneGuide).render(<FieldGuideView />));
}
