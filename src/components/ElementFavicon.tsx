import React from "react";
import type { CivElementDef } from "../game/catalog";

/** The same cached design illustration appears in the build palette and handbook. */
export function ElementFavicon({def,className=""}:{def:CivElementDef;className?:string}) {
  return <img src={"./handbook/catalog/thumbs/"+def.id+".webp"} alt="" aria-hidden="true" loading="lazy"
    decoding="async" width={36} height={36} className={"element-favicon "+className}/>;
}
