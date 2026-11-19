import React, { useEffect, useState } from "react";
import * as THREE from "three";
import { type CivElementDef, getStandardFootprintForLevel } from "../game/catalog";
import { getOrBuildElementAsset } from "../game/voxelArchitect";
import { VOXEL_SIZE } from "../game/voxelCore";

interface ElementFaviconProps {
  def: CivElementDef;
  className?: string;
}

interface ProjectedTri {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
  cssColor: string;
}

const ICON_SIZE = 28;
const faviconCache = new Map<string, string>();
const listenersById = new Map<string, Set<(url: string) => void>>();
const renderQueue: CivElementDef[] = [];
const queuedIds = new Set<string>();
let rafScheduled = false;

function toSrgbByte(linear: number, shade: number): number {
  const v = Math.max(0, Math.min(1, linear * shade));
  return Math.max(0, Math.min(255, Math.round(Math.pow(v, 1 / 2.2) * 255)));
}

function collectGeoTris(
  geo: THREE.BufferGeometry,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  outRaw: {
    ix0: number;
    iy0: number;
    ix1: number;
    iy1: number;
    ix2: number;
    iy2: number;
    depth: number;
    cssColor: string;
  }[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): void {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute | undefined;
  const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
  const nrm = geo.getAttribute("normal") as THREE.BufferAttribute | undefined;
  if (!pos || pos.count === 0) return;

  const idx = geo.getIndex();
  const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);

  const COS30 = 0.8660254;
  const SIN30 = 0.5;
  const Y_SCALE = 1.06;

  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

    if (nrm) {
      const nx = nrm.getX(i0);
      const ny = nrm.getY(i0);
      const nz = nrm.getZ(i0);
      // Isometric camera looks from (+1, +0.85, +1) toward origin; skip back-facing tris
      if (nx + ny * 0.85 + nz <= 0.01) continue;
    }

    const vx0 = pos.getX(i0) + offsetX;
    const vy0 = pos.getY(i0) + offsetY;
    const vz0 = pos.getZ(i0) + offsetZ;

    const vx1 = pos.getX(i1) + offsetX;
    const vy1 = pos.getY(i1) + offsetY;
    const vz1 = pos.getZ(i1) + offsetZ;

    const vx2 = pos.getX(i2) + offsetX;
    const vy2 = pos.getY(i2) + offsetY;
    const vz2 = pos.getZ(i2) + offsetZ;

    const ix0 = (vx0 - vz0) * COS30;
    const iy0 = (vx0 + vz0) * SIN30 - vy0 * Y_SCALE;

    const ix1 = (vx1 - vz1) * COS30;
    const iy1 = (vx1 + vz1) * SIN30 - vy1 * Y_SCALE;

    const ix2 = (vx2 - vz2) * COS30;
    const iy2 = (vx2 + vz2) * SIN30 - vy2 * Y_SCALE;

    if (ix0 < bounds.minX) bounds.minX = ix0;
    if (ix1 < bounds.minX) bounds.minX = ix1;
    if (ix2 < bounds.minX) bounds.minX = ix2;
    if (ix0 > bounds.maxX) bounds.maxX = ix0;
    if (ix1 > bounds.maxX) bounds.maxX = ix1;
    if (ix2 > bounds.maxX) bounds.maxX = ix2;

    if (iy0 < bounds.minY) bounds.minY = iy0;
    if (iy1 < bounds.minY) bounds.minY = iy1;
    if (iy2 < bounds.minY) bounds.minY = iy2;
    if (iy0 > bounds.maxY) bounds.maxY = iy0;
    if (iy1 > bounds.maxY) bounds.maxY = iy1;
    if (iy2 > bounds.maxY) bounds.maxY = iy2;

    const depth =
      (vx0 + vx1 + vx2 + (vz0 + vz1 + vz2) + (vy0 + vy1 + vy2) * 0.82) * 0.333333;

    let shade = 1.0;
    if (nrm) {
      const nx = nrm.getX(i0);
      const ny = nrm.getY(i0);
      const nz = nrm.getZ(i0);
      if (ny > 0.5) shade = 1.08;
      else if (nx > 0.5) shade = 0.98;
      else if (nz > 0.5) shade = 0.84;
    }

    const rLin = col ? (col.getX(i0) + col.getX(i1) + col.getX(i2)) / 3 : 0.7;
    const gLin = col ? (col.getY(i0) + col.getY(i1) + col.getY(i2)) / 3 : 0.7;
    const bLin = col ? (col.getZ(i0) + col.getZ(i1) + col.getZ(i2)) / 3 : 0.7;

    const r = toSrgbByte(rLin, shade);
    const g = toSrgbByte(gLin, shade);
    const b = toSrgbByte(bLin, shade);

    outRaw.push({
      ix0,
      iy0,
      ix1,
      iy1,
      ix2,
      iy2,
      depth,
      cssColor: `rgb(${r},${g},${b})`,
    });
  }
}

function renderLevel1FaviconDataUrl(def: CivElementDef): string {
  const existing = faviconCache.get(def.id);
  if (existing) return existing;

  const [spanX, spanZ] = getStandardFootprintForLevel(def, 1);
  // Straight North-South connection mask (1 | 4 = 5) gives clean lane/rail/bridge detail on network tiles
  const connMask = def.isNetwork ? 5 : 0;
  const asset = getOrBuildElementAsset(def.id, 1, 0, spanX, spanZ, connMask);

  const rawTris: {
    ix0: number;
    iy0: number;
    ix1: number;
    iy1: number;
    ix2: number;
    iy2: number;
    depth: number;
    cssColor: string;
  }[] = [];

  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };

  collectGeoTris(asset.baseGeo, 0, 0, 0, rawTris, bounds);
  for (const r of asset.rotors ?? []) {
    collectGeoTris(r.geo, r.pivot[0] * VOXEL_SIZE, r.pivot[1] * VOXEL_SIZE, r.pivot[2] * VOXEL_SIZE, rawTris, bounds);
  }
  if (asset.rotorGeo && asset.rotorPivot) {
    collectGeoTris(
      asset.rotorGeo,
      asset.rotorPivot[0] * VOXEL_SIZE,
      asset.rotorPivot[1] * VOXEL_SIZE,
      asset.rotorPivot[2] * VOXEL_SIZE,
      rawTris,
      bounds,
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx || rawTris.length === 0 || !Number.isFinite(bounds.minX)) {
    return "";
  }

  ctx.imageSmoothingEnabled = false;

  const pad = 1.5;
  const avail = ICON_SIZE - pad * 2;
  const bw = Math.max(0.001, bounds.maxX - bounds.minX);
  const bh = Math.max(0.001, bounds.maxY - bounds.minY);
  const scale = avail / Math.max(bw, bh);
  const cx = (bounds.minX + bounds.maxX) * 0.5;
  const cy = (bounds.minY + bounds.maxY) * 0.5;
  const halfIcon = ICON_SIZE * 0.5;

  const tris: ProjectedTri[] = rawTris.map((t) => ({
    x0: halfIcon + (t.ix0 - cx) * scale,
    y0: halfIcon + (t.iy0 - cy) * scale,
    x1: halfIcon + (t.ix1 - cx) * scale,
    y1: halfIcon + (t.iy1 - cy) * scale,
    x2: halfIcon + (t.ix2 - cx) * scale,
    y2: halfIcon + (t.iy2 - cy) * scale,
    depth: t.depth,
    cssColor: t.cssColor,
  }));

  // Painter's algorithm: draw farthest-from-camera first, closest-to-camera last
  tris.sort((a, b) => a.depth - b.depth);

  ctx.lineJoin = "round";
  ctx.lineWidth = 0.55;
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    ctx.fillStyle = t.cssColor;
    ctx.strokeStyle = t.cssColor;
    ctx.beginPath();
    ctx.moveTo(t.x0, t.y0);
    ctx.lineTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  const url = canvas.toDataURL("image/png");
  faviconCache.set(def.id, url);
  return url;
}

function flushQueueFrame(): void {
  rafScheduled = false;
  const batchSize = 14;
  let processed = 0;
  while (renderQueue.length > 0 && processed < batchSize) {
    const def = renderQueue.shift()!;
    queuedIds.delete(def.id);
    const url = renderLevel1FaviconDataUrl(def);
    const subs = listenersById.get(def.id);
    if (subs) {
      for (const cb of subs) cb(url);
      listenersById.delete(def.id);
    }
    processed++;
  }
  if (renderQueue.length > 0) {
    rafScheduled = true;
    requestAnimationFrame(flushQueueFrame);
  }
}

function requestFavicon(def: CivElementDef, onReady: (url: string) => void): () => void {
  const cached = faviconCache.get(def.id);
  if (cached) {
    onReady(cached);
    return () => {};
  }

  // Render small immediate warm-up synchronously so visible first-row cards appear instantly with zero flash
  if (faviconCache.size < 16) {
    const immediate = renderLevel1FaviconDataUrl(def);
    onReady(immediate);
    return () => {};
  }

  let subs = listenersById.get(def.id);
  if (!subs) {
    subs = new Set();
    listenersById.set(def.id, subs);
  }
  subs.add(onReady);

  if (!queuedIds.has(def.id)) {
    queuedIds.add(def.id);
    renderQueue.push(def);
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(flushQueueFrame);
    }
  }

  return () => {
    const set = listenersById.get(def.id);
    if (set) {
      set.delete(onReady);
      if (set.size === 0) listenersById.delete(def.id);
    }
  };
}

export const ElementFavicon: React.FC<ElementFaviconProps> = React.memo(({ def, className = "h-5 w-5" }) => {
  const [src, setSrc] = useState<string>(() => faviconCache.get(def.id) ?? "");

  useEffect(() => {
    const cached = faviconCache.get(def.id);
    if (cached) {
      setSrc(cached);
      return;
    }
    return requestFavicon(def, (url) => setSrc(url));
  }, [def]);

  if (!src) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xs bg-stone-200/70 ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`select-none object-contain [image-rendering:pixelated] ${className}`}
    />
  );
});
