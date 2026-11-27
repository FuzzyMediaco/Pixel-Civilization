import React from "react";
import { CheckCircle2, ChevronRight, GraduationCap, X } from "lucide-react";
import type { GameMode } from "../game/catalog";
import { MODE_TUTORIAL_LABELS, type TutorialStep } from "../game/tutorialFlows";

export function TutorialOverlay({
  mode,
  step,
  stepIndex,
  totalSteps,
  completedStep,
  belowHud,
  onNext,
  onExit,
}: {
  mode: GameMode;
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  completedStep: boolean;
  belowHud: boolean;
  onNext: () => void;
  onExit: () => void;
}) {
  const isLast = stepIndex >= totalSteps - 1;
  const manual = step.completeOn.length === 0;

  return (
    <aside
      className={"ui-tut-card" + (belowHud ? " is-below-hud" : "") + (completedStep ? " is-done" : "")}
      role="region"
      aria-label={`${MODE_TUTORIAL_LABELS[mode]} tutorial step ${stepIndex + 1} of ${totalSteps}`}
    >
      <div className="ui-tut-head">
        <span className="ui-tut-kicker">
          <GraduationCap size={14} aria-hidden="true" />
          <span>
            {MODE_TUTORIAL_LABELS[mode]} · Step {stepIndex + 1}/{totalSteps}
          </span>
        </span>
        <button
          type="button"
          className="ui-tut-exit"
          aria-label="Pause tutorial and show all menus"
          title="Pause tutorial (resume from More → Tutorial)"
          onClick={onExit}
        >
          <X size={15} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      <div className="ui-tut-progress" aria-hidden="true"><i style={{ width: `${((stepIndex + (completedStep ? 1 : 0)) / totalSteps) * 100}%` }} /></div>
      <strong className="ui-tut-title">{step.title}</strong>
      <p className="ui-tut-body">{step.body}</p>

      <div className="ui-tut-foot">
        <span className="ui-tut-demo">
          {completedStep ? (
            <>
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>Nice work!</span>
            </>
          ) : (
            <span>{manual ? step.demoHint : <>Your turn: {step.demoHint}</>}</span>
          )}
        </span>
        <button type="button" className="ui-tut-next" onClick={onNext}>
          <span>{isLast && (completedStep || manual) ? "Finish" : manual ? "Let's go" : completedStep ? "Next" : "Skip step"}</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
