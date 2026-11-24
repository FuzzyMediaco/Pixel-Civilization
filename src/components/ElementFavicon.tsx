import React, { useMemo, useState } from "react";
import type { CivElementDef } from "../game/catalog";
import { getStandardFootprintForLevel } from "../game/catalog";
import { isCustomElementId } from "../game/customElements";
import { buildDesignVoxels } from "../game/voxelArchitect";
import { getVoxelStyleColor, packVoxKey } from "../game/voxelCore";

const ISO_THUMB_CACHE = new Map<string, string>();

/**
 * Renders a crisp 2D isometric miniature directly from the element's live 3D voxel blueprint
 * onto an offscreen canvas and caches the PNG data URL. Used for new balanced-catalog elements
 * (which don't have pre-baked static .webp files) and as a reliable fallback if any thumb fails.
 */
export function renderIsometricVoxelThumb(def: CivElementDef, level = 2, variant = 0, angle = 0, size = 72): string | null {
  const cacheKey = [def.id,level,variant,angle,size].join(":");
  const cached = ISO_THUMB_CACHE.get(cacheKey);
  if (cached) return cached;
  if (typeof document === "undefined") return null;

  try {
    const [sx, sz] = getStandardFootprintForLevel(def, level);
    const ctxData = buildDesignVoxels(def, level, variant, sx, sz, 0);
    const source = ctxData.v.v;
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
export function ElementFavicon({ def, className = "", eager = false }: { def: CivElementDef; className?: string; eager?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);

  const isoUrl = useMemo(() => {
    if (!imgFailed || isCustomElementId(def.id)) return null;
    return renderIsometricVoxelThumb(def);
  }, [def, imgFailed]);

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

  if (isCustomElementId(def.id) || imgFailed) {
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
      src={"./handbook/catalog/thumbs/" + def.id + ".webp"}
      alt=""
      aria-hidden="true"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      width={36}
      height={36}
      onError={() => setImgFailed(true)}
      className={"element-favicon " + className}
    />
  );
}
