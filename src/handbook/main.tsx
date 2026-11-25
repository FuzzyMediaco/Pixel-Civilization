import {openDeviceSaves} from "../game/deviceSaves";
import { prepareOfflineShell } from "../offlineShell";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { UnifiedAtlas, type UnifiedAtlasRoute } from "../components/UnifiedAtlas";
import { readAtlasRoute, writeAtlasRoute } from "./atlasRoute";
import "../components/ui/ui.css";
import "../styles/interface.css";

const readLocation = () =>
  typeof location !== "undefined" ? new URLSearchParams(location.hash.slice(1)) : new URLSearchParams();

export interface HandbookViewProps {
  embedded?: boolean;
  initialRoute?: string;
  onClose?: () => void;
  onPlayWorld?: (worldId: string, mode?: "real" | "god", viewIndex?: number) => void;
}

export function HandbookView({ embedded = false, initialRoute, onClose, onPlayWorld }: HandbookViewProps) {
  const [route, setRoute] = useState<Partial<UnifiedAtlasRoute>>(() =>
    readAtlasRoute(
      embedded ? new URLSearchParams(initialRoute?.replace(/^#/, "") ?? "") : readLocation(),
    ),
  );

  useEffect(() => {
    if (embedded) return;
    const sync = () => setRoute(readAtlasRoute(readLocation()));
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
        const hash = writeAtlasRoute(next);
        history.replaceState(null, "", hash ? "#" + hash : location.pathname + location.search);
      }}
    />
  );
}

const standaloneMount = typeof document !== "undefined" ? document.getElementById("handbook") : null;
if (standaloneMount) {
  void prepareOfflineShell();
  void openDeviceSaves().then(() => createRoot(standaloneMount).render(<HandbookView />));
}
