import React from "react";
import { PlayerAccount } from "./PlayerAccount";
import { currentPlayer } from "../game/deviceSaves";
import {
  BookOpen,
  UserRound,
  ChevronLeft,
  Cloud,
  Download,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Map,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
} from "lucide-react";
import { type GameMode, STAGES } from "../game/catalog";
import type { GameState } from "../game/simulation";
import { PWAInstallRow } from "./PWAInstallRow";
import { BottomSheet, Button, type SheetHeight } from "./ui";

export type CursorBehavior = "auto" | "select" | "place";
export type MorePage = "view" | "mode" | "god" | "settings" | "account" | null;

const MODES: { id: GameMode; title: string; desc: string }[] = [
  { id: "god", title: "God", desc: "Sandbox: free building, terrain sculpting, weather & clock." },
  { id: "real", title: "Real", desc: "Grow Stage 1 → 20 on a live treasury and balanced services." },
  { id: "survival", title: "Survival", desc: "Repairs, reserves & defense; shortages can collapse the city." },
  { id: "idle", title: "Idle", desc: "Autonomous algorithmic planner grows a Stage 1–20 island." },
  { id: "manager", title: "Manager", desc: "Executive Yes/No decisions while customizing architectural styles." },
];
const TITLES: Record<Exclude<MorePage, null>, string> = {
  view: "View",
  mode: "Game Mode",
  god: "God Tools",
  settings: "Settings",
  account: "Account",
};

export function MoreSheet({
  saveNow,
  state,
  page,
  onPage,
  height,
  onHeight,
  onClose,
  savedCount,
  slotCount,
  onSaves,
  onExamples,
  onOpenHandbook,
  onOpenPixBuilder,
  onChangeMode,
  onCopyIsland,
  onReset,
  view,
  godTools,
  tutorialMode,
  onStartTutorial,
}: {
  saveNow: () => boolean;
  state: GameState;
  page: MorePage;
  onPage: (p: MorePage) => void;
  height: SheetHeight;
  onHeight: (h: SheetHeight) => void;
  onClose: () => void;
  savedCount: number;
  slotCount: number;
  onSaves: () => void;
  onExamples: () => void;
  onOpenHandbook: () => void;
  onOpenPixBuilder?: () => void;
  onChangeMode: (m: GameMode) => void;
  onCopyIsland: () => void;
  onReset: () => void;
  view: React.ReactNode;
  godTools: React.ReactNode;
  tutorialMode?: GameMode | null;
  onStartTutorial?: (m: GameMode) => void;
}) {
  const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, state.currentStage - 1))];
  const modeName = MODES.find((m) => m.id === state.mode)?.title ?? state.mode;

  return (
    <BottomSheet
      id="sheet-more"
      title={page ? TITLES[page] : "More"}
      height={height}
      onHeightChange={onHeight}
      onClose={onClose}
      closeLabel="Close More"
      subtitle={page ? undefined : modeName + (state.mode === "god" ? "" : " · Stg " + stage.stage)}
      headerLead={
        page ? (
          <button
            type="button"
            className="ui-sheet-icon-btn"
            aria-label="Back to More"
            title="Back to More"
            onClick={() => onPage(null)}
          >
            <ChevronLeft size={16} />
          </button>
        ) : undefined
      }
    >
      {!page && (
        <div className="ui-more-wrap">
          <div className="ui-more-grid" role="group" aria-label="More actions">
            <button type="button" className="ui-more-tile" onClick={()=>{onPage("account");onHeight("full");}} title={currentPlayer()?.email ?? "Create an account or sign in"}>
              <UserRound size={18} aria-hidden="true"/><span>Account</span>
            </button>
            <button type="button" className="ui-more-tile" onClick={() => onPage("settings")} title="Settings, Quick Menus & controls">
              <Settings size={18} aria-hidden="true" />
              <span>Settings</span>
            </button>
            {onOpenPixBuilder && (
              <button type="button" className="ui-more-tile is-accent" onClick={onOpenPixBuilder} title="PixBuilder Studio & Advisor">
                <Sparkles size={18} aria-hidden="true" />
                <span>Pix</span>
              </button>
            )}
            <button type="button" className="ui-more-tile" onClick={() => onPage("view")} title="Camera, weather, time & defense">
              <Cloud size={18} aria-hidden="true" />
              <span>View</span>
            </button>
            <button type="button" className="ui-more-tile" onClick={onSaves} title={`${savedCount} of ${slotCount} save slots used`}>
              <Save size={18} aria-hidden="true" />
              <span>Saves</span>
              {savedCount > 0 && <em className="ui-more-badge">{savedCount}</em>}
            </button>
            <button type="button" className="ui-more-tile" onClick={() => onPage("mode")} title={`Current: ${modeName} mode`}>
              <Gamepad2 size={18} aria-hidden="true" />
              <span>{modeName}</span>
            </button>
            <button type="button" className="ui-more-tile" onClick={onExamples} title="Explore finished example islands">
              <Map size={18} aria-hidden="true" />
              <span>Islands</span>
            </button>
            <button type="button" className="ui-more-tile" onClick={onOpenHandbook} title="Compact Playbook, Search & 3D Atlas">
              <BookOpen size={18} aria-hidden="true" />
              <span>Handbook</span>
            </button>
            <a className="ui-more-tile" style={{ textDecoration: "none" }} href={location.protocol === "file:" ? "https://pixelcivilization.app/downloads.html" : "./downloads.html"}>
              <Download size={18} aria-hidden="true" />
              <span>Downloads</span>
            </a>
            {state.mode === "god" && (
              <button type="button" className="ui-more-tile" onClick={() => onPage("god")} title="God tools: clock, snapshots & crime">
                <FlaskConical size={18} aria-hidden="true" />
                <span>God Tools</span>
              </button>
            )}
            <button type="button" className="ui-more-tile is-danger" onClick={onReset} title="Reset this island">
              <RotateCcw size={18} aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
          <PWAInstallRow />
        </div>
      )}

      {page === "account" && <PlayerAccount saveNow={saveNow}/>}
      {page === "view" && (
        <>
          {state.mode !== "god" && (
            <p className="ui-muted" style={{ marginBottom: 6 }}>
              Weather &amp; clock run automatically outside God mode.
            </p>
          )}
          {view}
        </>
      )}

      {page === "god" && godTools}

      {page === "mode" && (
        <div className="ui-modes">
          {MODES.map((m) => (
            <div key={m.id} className={"ui-mode-card" + (state.mode === m.id ? " is-active" : "")}>
              <div className="ui-mode-row">
                <button
                  type="button"
                  className="ui-mode"
                  aria-pressed={state.mode === m.id}
                  onClick={() => onChangeMode(m.id)}
                >
                  <b>
                    {m.title}
                    {state.mode === m.id ? " · active" : ""}
                  </b>
                  <small>{m.desc}</small>
                </button>
                {onStartTutorial && (
                  <button
                    type="button"
                    className={"ui-row-action-icon" + (tutorialMode === m.id ? " is-active" : "")}
                    aria-label={tutorialMode === m.id ? "Restart " + m.title + " tutorial" : "Play " + m.title + " tutorial"}
                    title={tutorialMode === m.id ? "Restart tutorial" : "Play tutorial"}
                    onClick={() => onStartTutorial(m.id)}
                  >
                    <GraduationCap size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {state.mode !== "god" && (
            <Button
              small
              block
              label="Copy into God mode"
              icon={<FlaskConical size={15} />}
              onClick={onCopyIsland}
            />
          )}
        </div>
      )}
    </BottomSheet>
  );
}
