import React from "react";
import type { GameMode } from "../game/catalog";
import { GameDialog } from "./GameDialog";
import { UnifiedAtlas, type UnifiedAtlasRoute } from "./UnifiedAtlas";
import type { ExampleMode, ExampleWorldId } from "../game/exampleWorlds";

export type GuideModalState =
  | {
      kind: "handbook";
      route?: string;
    }
  | {
      kind: "field_guide";
      elementId?: string;
      level?: number;
      variant?: number;
    }
  | {
      kind: "unified";
      atlasRoute?: Partial<UnifiedAtlasRoute>;
    };

function toAtlasRoute(modal: GuideModalState): Partial<UnifiedAtlasRoute> {
  if (modal.kind === "unified") return modal.atlasRoute ?? { tab: "atlas" };
  if (modal.kind === "field_guide") {
    return {
      tab: "atlas",
      elementId: modal.elementId,
      level: modal.level,
      variant: modal.variant,
    };
  }
  const params = new URLSearchParams(modal.route?.replace(/^#/, "") ?? "");
  const section = params.get("section") ?? undefined;
  const design = params.get("design") ?? undefined;
  const lesson = params.get("lesson") ?? undefined;
  if (design) {
    return { tab: "atlas", elementId: design };
  }
  if (section === "worlds") {
    return { tab: "islands" };
  }
  if (section === "catalog") {
    return { tab: "atlas" };
  }
  if (section) {
    return { tab: "chapters", section, lesson };
  }
  return { tab: "chapters", section: "interface" };
}

export function GuideModal({
  modal,
  currentMode = "real",
  onChange,
  onClose,
  onPlayWorld,
}: {
  modal: GuideModalState;
  currentMode?: GameMode;
  onChange: (next: GuideModalState) => void;
  onClose: () => void;
  onPlayWorld: (id: ExampleWorldId, mode: ExampleMode, viewIndex?: number) => void;
}) {
  return (
    <GameDialog label="Atlas & Handbook" className="ui-guide-modal" onDismiss={onClose}>
      <UnifiedAtlas
        embedded
        currentMode={currentMode}
        initialRoute={toAtlasRoute(modal)}
        onChangeRoute={(atlasRoute) => onChange({ kind: "unified", atlasRoute })}
        onClose={onClose}
        onPlayWorld={(worldId, mode = "god", viewIndex) => {
          onClose();
          onPlayWorld(worldId, mode, viewIndex);
        }}
      />
    </GameDialog>
  );
}
