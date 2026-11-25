import React, { createContext, useContext, useMemo, useState } from "react";
import { eraElementSpec, type EraKey } from "../game/eraStyles";
import { useEraArt } from "./useEraArt";
import { isEraArtReady } from "../game/eraArtLoader";
import { getMaxElementLevel, type CivElementDef } from "../game/catalog";
import { atlasPlots } from "../handbook/modelPlots";
import { isCustomElementId } from "../game/customElements";
import { buildCorridorVoxels, buildDesignVoxels } from "../game/voxelArchitect";
import { corridorTransform } from "../game/roadCorridors";
import { getVoxelStyleColor, packVoxKey, VOXEL_SIZE, VOXELS_PER_TILE } from "../game/voxelCore";

const ISO_THUMB_CACHE = new Map<string, string>();
export const EraThumbnailContext = createContext<EraKey>("original");
export const eraSheet = (id:string,era:EraKey) => "./handbook/era-pilot/models/"+era+"/"+id+".webp";

export function EraSheetCell({id,era,level,variant,size,className,label,onError}:{
  id:string;era:EraKey;level:number;variant:number;size:number;className?:string;label?:string;onError?:()=>void;
}) {
  const columns=getMaxElementLevel(id);
  const left=96*(Math.min(columns,Math.max(1,level))-1);
  return <svg width={size} height={size} viewBox={left+" "+(96*variant)+" 96 96"} className={className}
    aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
    <image href={eraSheet(id,era)} width={columns*96} height={384} onError={onError}/>
  </svg>;
}

/**
 * Renders a crisp 2D isometric miniature directly from the element's live 3D voxel blueprint
 * onto an offscreen canvas and caches the PNG data URL. Used for new balanced-catalog elements
 * (which don't have pre-baked static .webp files) and as a reliable fallback if any thumb fails.
 */
export function renderIsometricVoxelThumb(def: CivElementDef, level = 2, variant = 0, angle = 0, size = 72, era: EraKey = "original", active = false, joined = false): string | null {
  if (!isEraArtReady(era)) return null;
  const cacheKey = [def.id,level,variant,angle,size,era,active,joined].join(":");
  const cached = ISO_THUMB_CACHE.get(cacheKey);
  if (cached) return cached;
  if (typeof document === "undefined") return null;

  try {
    const source = new Map<number,number>();
    for (const plot of atlasPlots(def,level,variant,era,joined,active)) {
      const [sx, sz] = plot.span;
      const ctxData = buildDesignVoxels(plot.def,plot.level,plot.variant,sx,sz,plot.mask,plot.appearance);
      const fit = Math.min(1,sx / ctxData.spanX,sz / ctxData.spanZ);
      const rotation = plot.rotation * Math.PI / 2, cos = Math.cos(rotation), sin = Math.sin(rotation);
      const corridor = plot.appearance.corridor;
      const add = (voxels: Map<number,number>, pivot: readonly number[], scale = 1) => {
        for (const [key,style] of voxels) {
          let x = ((key >>> 20) - 512 + pivot[0]) * fit * scale;
          const y = (((key >>> 10) & 1023) - 512 + pivot[1]) * fit * scale;
          let z = ((key & 1023) - 512 + pivot[2]) * fit * scale;
          if (corridor?.axis==="x") z=corridorTransform(corridor,x*VOXEL_SIZE,z*VOXEL_SIZE)/VOXEL_SIZE;
          else if (corridor) x=corridorTransform(corridor,z*VOXEL_SIZE,x*VOXEL_SIZE)/VOXEL_SIZE;
          source.set(packVoxKey(Math.round(x*cos+z*sin+plot.x*VOXELS_PER_TILE),
            Math.round(y),Math.round(z*cos-x*sin+plot.z*VOXELS_PER_TILE)),style);
        }
      };
      if (corridor) add(buildCorridorVoxels(plot.def.id,plot.level,plot.variant,plot.mask,plot.appearance)!.v,[0,0,0],.5);
      else {
        add(ctxData.v.v,[0,0,0]);
        for (const rotor of ctxData.rotors) add(rotor.vox.v,rotor.pivot);
      }
    }
    const map = angle === 0 ? source : new Map(Array.from(source, ([k, style]) => {
      const x = ((k >>> 20) & 1023) - 512;
      const y = ((k >>> 10) & 1023) - 512;
      const z = (k & 1023) - 512;
      if (angle === 1) return [packVoxKey(z,y,-x), style];
      if (angle === 2) return [packVoxKey(-x,y,-z), style];
      return [packVoxKey(-z,y,x), style];
    }));
    if (map.size === 0) return null;

    // Extract visible surface voxels only (skip completely enclosed interior voxels)
    const voxels: { x: number; y: number; z: number; style: number; depth: number }[] = [];
    for (const [k, style] of map) {
      const x = ((k >>> 20) & 1023) - 512;
      const y = ((k >>> 10) & 1023) - 512;
      const z = (k & 1023) - 512;
      // Visible from (+x, +y, +z) isometric camera if any of (+1,0,0), (0,+1,0), (0,0,+1) is empty
      if (
        map.has(packVoxKey(x + 1, y, z)) &&
        map.has(packVoxKey(x, y + 1, z)) &&
        map.has(packVoxKey(x, y, z + 1))
      ) {
        continue;
      }
      voxels.push({ x, y, z, style, depth: (x + z) * 1000 + y });
    }
    if (voxels.length === 0) return null;

    // Isometric projection bounds: u = x - z, v = (x + z) * 0.5 - y * 1.12
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const vx of voxels) {
      const u = vx.x - vx.z;
      const vp = (vx.x + vx.z) * 0.5 - vx.y * 1.05;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (vp < minV) minV = vp;
      if (vp > maxV) maxV = vp;
    }

    const pad = size / 12;
    const spanU = Math.max(4, maxU - minU + 2.4);
    const spanV = Math.max(4, maxV - minV + 2.8);
    const scale = Math.min((size - pad * 2) / spanU, (size - pad * 2) / spanV);
    const ox = size / 2 - ((minU + maxU) * 0.5) * scale;
    const oy = size / 2 - ((minV + maxV) * 0.5) * scale;

    voxels.sort((a, b) => a.depth - b.depth);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const toSrgb = (lin: number, mul: number) =>
      Math.max(0, Math.min(255, Math.round(Math.pow(Math.max(0, Math.min(1, lin * mul)), 1 / 2.2) * 255)));

    const dx = scale;
    const dy = scale * 0.5;
    const h = scale * 1.05;

    for (const vx of voxels) {
      const [r, g, b] = getVoxelStyleColor(vx.style);
      const cx = ox + (vx.x - vx.z) * dx;
      const cy = oy + (vx.x + vx.z) * dy - vx.y * h;

      // Top face (brightest)
      ctx.fillStyle = `rgb(${toSrgb(r, 1.12)},${toSrgb(g, 1.12)},${toSrgb(b, 1.12)})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy - dy - h);
      ctx.lineTo(cx + dx, cy - h);
      ctx.lineTo(cx, cy + dy - h);
      ctx.lineTo(cx - dx, cy - h);
      ctx.closePath();
      ctx.fill();

      // Left face (-x / +z, medium warm shade)
      ctx.fillStyle = `rgb(${toSrgb(r, 0.84)},${toSrgb(g, 0.84)},${toSrgb(b, 0.84)})`;
      ctx.beginPath();
      ctx.moveTo(cx - dx, cy - h);
      ctx.lineTo(cx, cy + dy - h);
      ctx.lineTo(cx, cy + dy);
      ctx.lineTo(cx - dx, cy);
      ctx.closePath();
      ctx.fill();

      // Right face (+x / -z, deeper cool shade)
      ctx.fillStyle = `rgb(${toSrgb(r, 0.64)},${toSrgb(g, 0.64)},${toSrgb(b, 0.64)})`;
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy - h);
      ctx.lineTo(cx, cy + dy - h);
      ctx.lineTo(cx, cy + dy);
      ctx.lineTo(cx + dx, cy);
      ctx.closePath();
      ctx.fill();
    }

    const url = canvas.toDataURL("image/png");
    if (ISO_THUMB_CACHE.size >= 384) {
      const oldest = ISO_THUMB_CACHE.keys().next().value;
      if (oldest !== undefined) ISO_THUMB_CACHE.delete(oldest);
    }
    ISO_THUMB_CACHE.set(cacheKey, url);
    return url;
  } catch {
    return null;
  }
}

/** The same cached design illustration appears in the build palette and handbook. */
export function ElementFavicon({ def, className = "", eager = false, era: override, level = 2, variant = 0 }: { def: CivElementDef; className?: string; eager?: boolean; era?: EraKey; level?: number; variant?: number }) {
  const inherited = useContext(EraThumbnailContext);
  const era = override ?? inherited;
  const themed = Boolean(eraElementSpec(def.id, era));
  const source=themed ? eraSheet(def.id,era) : "./handbook/catalog/thumbs/"+def.id+".webp";
  const [failedFor,setFailedFor] = useState("");
  const imgFailed=source===failedFor;
  const {ready} = useEraArt(themed && imgFailed ? era : "original");

  const isoUrl = useMemo(() => {
    if (!ready || isCustomElementId(def.id) || !imgFailed) return null;
    return renderIsometricVoxelThumb(def, level, variant, 0, 72, era);
  }, [def, imgFailed, themed, ready, era, level, variant]);

  if (themed && !imgFailed) {
    return <EraSheetCell id={def.id} era={era} level={level} variant={variant} size={36} className={"element-favicon "+className} onError={()=>setFailedFor(source)}/>;
  }
  if (isoUrl) {
    return (
      <img
        src={isoUrl}
        alt=""
        aria-hidden="true"
        width={36}
        height={36}
        className={"element-favicon " + className}
      />
    );
  }

  if (isCustomElementId(def.id) || imgFailed || themed) {
    return (
      <svg
        viewBox="0 0 36 36"
        width={36}
        height={36}
        aria-hidden="true"
        className={"element-favicon " + className}
      >
        <rect
          x="2"
          y="2"
          width="32"
          height="32"
          rx="7"
          fill={def.accentHex || "#0f766e"}
          fillOpacity="0.16"
          stroke={def.accentHex || "#0f766e"}
          strokeWidth="1.5"
        />
        <polygon points="18,7 28,12.5 18,18 8,12.5" fill={def.accentHex || "#0f766e"} />
        <polygon points="8,12.5 18,18 18,29 8,23.5" fill={def.accentHex || "#0f766e"} fillOpacity="0.72" />
        <polygon points="28,12.5 18,18 18,29 28,23.5" fill={def.accentHex || "#0f766e"} fillOpacity="0.48" />
      </svg>
    );
  }

  return (
    <img
      src={source}
      alt=""
      aria-hidden="true"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      width={36}
      height={36}
      onError={() => setFailedFor(source)}
      className={"element-favicon " + className}
    />
  );
}
