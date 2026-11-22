import React from "react";
import type { CivElementDef } from "../game/catalog";
import { isCustomElementId } from "../game/customElements";

/** The same cached design illustration appears in the build palette and handbook. */
export function ElementFavicon({def,className=""}:{def:CivElementDef;className?:string}) {
  if (isCustomElementId(def.id)) {
    return (
      <svg
        viewBox="0 0 36 36"
        width={36}
        height={36}
        aria-hidden="true"
        className={"element-favicon " + className}
      >
        <rect x="2" y="2" width="32" height="32" rx="7" fill={def.accentHex || "#0f766e"} fillOpacity="0.16" stroke={def.accentHex || "#0f766e"} strokeWidth="1.5" />
        <polygon points="18,7 28,12.5 18,18 8,12.5" fill={def.accentHex || "#0f766e"} />
        <polygon points="8,12.5 18,18 18,29 8,23.5" fill={def.accentHex || "#0f766e"} fillOpacity="0.72" />
        <polygon points="28,12.5 18,18 18,29 28,23.5" fill={def.accentHex || "#0f766e"} fillOpacity="0.48" />
      </svg>
    );
  }
  return <img src={"./handbook/catalog/thumbs/"+def.id+".webp"} alt="" aria-hidden="true" loading="lazy"
    decoding="async" width={36} height={36} className={"element-favicon "+className}/>;
}
