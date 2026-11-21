import React from "react";

export function Chip({label, icon, selected, count, onClick, title}: {
  label: string; icon?: React.ReactNode; selected?: boolean; count?: number | string; onClick: () => void; title?: string;
}) {
  return <button type="button" className="ui-chip" aria-pressed={!!selected} onClick={onClick} title={title}>
    {icon}<span>{label}</span>{count !== undefined && <span className="ui-chip-count">{count}</span>}
  </button>;
}

/** Horizontally scrolling single row of chips. */
export function ChipRow({label, children}: {label: string; children: React.ReactNode}) {
  return <div className="ui-chiprow" role="group" aria-label={label}>{children}</div>;
}

export function Tag({tone = "good", icon, children, title}: {tone?: "good" | "warn" | "bad" | "info"; icon?: React.ReactNode; children: React.ReactNode; title?: string}) {
  return <span className={"ui-tag" + (tone === "good" ? "" : " is-" + tone)} title={title}>{icon}{children}</span>;
}
