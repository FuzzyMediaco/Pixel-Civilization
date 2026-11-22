import React from "react";
import { CheckCircle2, Compass, Sparkles } from "lucide-react";
import type { ManagerChoice, ManagerDecision } from "../game/autoCivilization";

export function ManagerDecisionCard({
  decision,
  lastAction,
  onChoose,
}: {
  decision: ManagerDecision;
  lastAction?: string;
  onChoose: (choice: ManagerChoice) => void;
}) {
  return (
    <aside className="pc-mgr-card" aria-label="Manager Mode Decision">
      <div className="pc-mgr-head">
        <span className="pc-mgr-kicker">
          <Sparkles size={13} aria-hidden="true" />
          {decision.kicker}
        </span>
        {lastAction && <span className="pc-mgr-last">{lastAction}</span>}
      </div>
      <h3 className="pc-mgr-question">{decision.question}</h3>
      <p className="pc-mgr-context">{decision.context}</p>
      <div className="pc-mgr-choices">
        {decision.choices.map((c) => (
          <button
            key={c.id}
            type="button"
            className="pc-mgr-choice"
            onClick={() => onChoose(c)}
          >
            <span className="pc-mgr-choice-main">
              <CheckCircle2 size={16} aria-hidden="true" />
              <strong>{c.label}</strong>
            </span>
            <small>{c.detail}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}

export function IdleModeBanner({
  stage,
  stageName,
  lastAction,
  paused,
  onTogglePause,
}: {
  stage: number;
  stageName: string;
  lastAction: string;
  paused: boolean;
  onTogglePause: () => void;
}) {
  return (
    <div className="pc-idle-banner" role="status" aria-live="polite">
      <Compass size={15} aria-hidden="true" />
      <div className="pc-idle-copy">
        <strong>Idle Civilization · Stage {stage} ({stageName})</strong>
        <span>{lastAction || "Growing island autonomously… tap any building to inspect stats."}</span>
      </div>
      <button type="button" className="pc-idle-btn" onClick={onTogglePause}>
        {paused ? "Resume" : "Pause"}
      </button>
    </div>
  );
}
