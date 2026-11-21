import React from "react";

/** 52px list row: icon · title / subtitle · trailing action. Pass onClick to make the whole row a button. */
export function ListRow({icon, title, subtitle, trailing, tone, onClick, ariaLabel}: {
  icon?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; trailing?: React.ReactNode;
  tone?: "bad" | "warn"; onClick?: () => void; ariaLabel?: string;
}) {
  const cls = "ui-row" + (tone ? " is-" + tone : "");
  const body = <>
    {icon !== undefined && <span className="ui-row-icon" aria-hidden="true">{icon}</span>}
    <span className="ui-row-body"><b>{title}</b>{subtitle && <small>{subtitle}</small>}</span>
    {trailing && <span className="ui-row-trail">{trailing}</span>}
  </>;
  return onClick ? <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel}>{body}</button> : <div className={cls}>{body}</div>;
}
