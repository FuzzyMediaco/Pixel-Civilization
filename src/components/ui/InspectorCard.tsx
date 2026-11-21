import React from "react";
import type { CivElementDef } from "../../game/catalog";
import { ElementFavicon } from "../ElementFavicon";

/** Thumb · title · subtitle header shared by the inspector, the placement bar and build previews. */
export function InspectorCard({def, title, subtitle, subtitleTone, trailing}: {
  def?: CivElementDef; title: React.ReactNode; subtitle?: React.ReactNode; subtitleTone?: "bad"; trailing?: React.ReactNode;
}) {
  return <div className="ui-icard">
    <span className="ui-icard-thumb">{def && <ElementFavicon def={def}/>}</span>
    <span className="ui-icard-body">
      <span className="ui-icard-title" role="heading" aria-level={2}>{title}</span>
      {subtitle && <span className={"ui-icard-sub" + (subtitleTone ? " is-" + subtitleTone : "")}>{subtitle}</span>}
    </span>
    {trailing}
  </div>;
}
