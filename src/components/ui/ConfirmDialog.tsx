import React from "react";
import { GameDialog } from "../GameDialog";
import { Button } from "./Button";

/** Two-button confirmation for destructive actions (demolish, reset, overwrite). */
export function ConfirmDialog({title, message, confirmLabel, onConfirm, onCancel}: {
  title: string; message: React.ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  return <GameDialog label={title} onDismiss={onCancel} className="island-modal fixed inset-0 z-50 flex items-center justify-center">
    <div className="ui-confirm">
      <h3>{title}</h3>
      <p>{message}</p>
      <div className="ui-actions">
        <Button label="Cancel" onClick={onCancel} data-dialog-focus/>
        <Button label={confirmLabel} variant="danger-solid" onClick={onConfirm}/>
      </div>
    </div>
  </GameDialog>;
}
