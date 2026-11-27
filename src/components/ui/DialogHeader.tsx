import React from "react";
import { X } from "lucide-react";

type Props = {
  /** lucide icon element, 20px. Every dialog leads with one. */
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
  /** Optional trailing actions placed before the close button. */
  actions?: React.ReactNode;
  focusClose?: boolean;
};

/** The one header every popup uses: icon tile, 19px title, muted subtitle, 44px × close. */
export function DialogHeader({icon, title, subtitle, onClose, closeLabel, actions, focusClose}: Props) {
  return <header className="ui-dialog-head">
    <span className="ui-dialog-icon" aria-hidden="true">{icon}</span>
    <div className="ui-dialog-titles">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {actions}
    <button type="button" className="ui-iconbtn ui-dialog-close" aria-label={closeLabel} onClick={onClose} data-dialog-dismiss {...(focusClose ? {"data-dialog-focus": ""} : {})}>
      <X size={20} aria-hidden="true" />
    </button>
  </header>;
}
