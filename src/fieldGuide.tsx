import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { UnifiedAtlas, type UnifiedAtlasRoute } from "./components/UnifiedAtlas";
import "./components/ui/ui.css";
import "./styles/interface.css";

const fragment =
  typeof location !== "undefined" ? new URLSearchParams(location.hash.slice(1)) : new URLSearchParams();
const initialParams =
  typeof location !== "undefined"
    ? location.protocol === "file:" && fragment.has("id")
      ? fragment
      : new URLSearchParams(location.search)
    : new URLSearchParams();

const parseIntParam = (val: string | number | null | undefined): number | undefined => {
  if (val === null || val === undefined || val === "") return undefined;
  const n = Number(val);
  return Number.isInteger(n) ? n : undefined;
};

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
  const [route] = useState<Partial<UnifiedAtlasRoute>>(() => ({
    tab: "atlas",
    elementId: initialId ?? initialParams.get("id") ?? "house",
    level: initialLevel ?? parseIntParam(initialParams.get("level")),
    variant: initialVariant ?? parseIntParam(initialParams.get("variant")),
  }));

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
        if (next.elementId) {
          const params = new URLSearchParams({
            id: next.elementId,
            level: String(next.level ?? 3),
            variant: String(next.variant ?? 1),
          });
          const hashOrQuery = (location.protocol === "file:" ? "#" : "?") + params.toString();
          history.replaceState(null, "", hashOrQuery);
        }
      }}
    />
  );
}

const standaloneGuide = typeof document !== "undefined" ? document.getElementById("guide") : null;
if (standaloneGuide) {
  createRoot(standaloneGuide).render(<FieldGuideView />);
}
