import React from "react";
import type { CivElementDef } from "../game/catalog";
import { InspectorCard } from "./ui";

/** Slim bar above the nav while placing, moving or drawing; replaces every open sheet. */
export function PlacementBar({def, title, subtitle, subtitleTone, hint, hintBad, children, label}: {
  def?: CivElementDef;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  subtitleTone?: "bad";
  hint?: string;
  hintBad?: boolean;
  /** Trailing controls (rotate, level, done). */
  children: React.ReactNode;
  label: string;
}) {
  return <>
    {hint && <p className={"ui-placebar-hint" + (hintBad ? " is-bad" : "")} role={hintBad ? "alert" : "status"}>{hint}</p>}
    <div className="ui-placebar" role="toolbar" aria-label={label}>
      <InspectorCard def={def} title={title} subtitle={subtitle} subtitleTone={subtitleTone}/>
      {children}
    </div>
  </>;
}
