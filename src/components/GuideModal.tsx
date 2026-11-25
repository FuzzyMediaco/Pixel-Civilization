import React from "react";
import type { GameMode } from "../game/catalog";
import type { EraKey } from "../game/eraStyles";
import { readAtlasRoute } from "../handbook/atlasRoute";
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
  return params.size ? readAtlasRoute(params) : {tab:"chapters",section:"interface"};
}

export function GuideModal({
  modal,
  currentMode = "real",
  currentEra = "original",
  showOriginalNames = false,
  onChange,
  onClose,
  onPlayWorld,
}: {
  modal: GuideModalState;
  currentMode?: GameMode;
  currentEra?: EraKey;
  showOriginalNames?: boolean;
  onChange: (next: GuideModalState) => void;
  onClose: () => void;
  onPlayWorld: (id: ExampleWorldId, mode: ExampleMode, viewIndex?: number) => void;
}) {
  const selection = toAtlasRoute(modal);
  return (
    <GameDialog label="Atlas & Handbook" className="ui-guide-modal" onDismiss={onClose}>
      <UnifiedAtlas
        embedded
        currentMode={currentMode}
        initialRoute={{...selection,era:selection.era ?? currentEra,originalNames:selection.originalNames ?? showOriginalNames}}
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
