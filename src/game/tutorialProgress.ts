import type { GameMode } from "./catalog";

/** Saved tutorial progress so players can leave and come back to the same step. */
export interface TutorialProgress {
  mode: GameMode;
  stepIndex: number;
  status: "active" | "paused" | "done";
}

const KEY = "pixelciv.tutorial.v2";

export function loadTutorialProgress(): TutorialProgress | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as TutorialProgress;
    if (!p || typeof p.stepIndex !== "number" || !p.mode || !["active", "paused", "done"].includes(p.status)) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveTutorialProgress(p: TutorialProgress): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: progress lives for this session only */ }
}

/** True for a player who has never seen the tutorial and whose island is still empty. */
export function shouldAutoStartTutorial(progress: TutorialProgress | null, placedCount: number, mode: GameMode): boolean {
  if (progress) return progress.status === "active";
  return placedCount === 0 && (mode === "real" || mode === "survival" || mode === "god");
}
