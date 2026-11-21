import React from "react";
import { Undo2 } from "lucide-react";

export interface UiToast {
  id: string;
  title: string;
  subtitle?: string;
  tone?: "normal" | "alert" | "gold";
  action?: {label: string; run: () => void};
}

/** One stack under the HUD, at most two visible, with an optional action (Undo, Show…). */
export function Toasts({items, onDismiss}: {items: UiToast[]; onDismiss: (id: string) => void}) {
  if (!items.length) return null;
  return <div className="ui-toasts" aria-live="polite" role="status">
    {items.slice(0, 2).map(t => <div key={t.id} className={"ui-toast" + (t.tone && t.tone !== "normal" ? " is-" + t.tone : "")}>
      <span className="ui-toast-body"><b>{t.title}</b>{t.subtitle && <small>{t.subtitle}</small>}</span>
      {t.action && <button type="button" className="ui-btn is-small" onClick={() => {t.action!.run(); onDismiss(t.id);}}>
        {t.action.label === "Undo" && <Undo2 size={16} aria-hidden="true"/>}<span>{t.action.label}</span></button>}
    </div>)}
  </div>;
}
