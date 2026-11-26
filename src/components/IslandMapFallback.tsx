import { useEffect, useMemo, useRef } from "react";
import { ELEMENT_BY_ID } from "../game/catalog";
import { GRID_MIN, GRID_MAX, GRID_SIZE, withinMap } from "../game/mapBounds";
import { roadBounds } from "../game/roadCorridors";
import { computeHeatmapCells, maintenanceStatus, type GameState, type HeatmapKind } from "../game/simulation";
import { getTerrainCell, type GridPoint } from "../game/terrain";
import { TILE_SIZE, VOXELS_PER_TILE } from "../game/voxelCore";

import type { SelectionRingBox, SelectionRingProjection } from "../game/worldRenderer";

interface Props {
  state: GameState;
  focus: [number, number] | undefined;
  buildingPulse?: { id: string; startedAt: number };
  draw: boolean;
  following?: string;
  onStopFollowing: () => void;
  heatmap: HeatmapKind;
  startAt?: {gx:number;gz:number;zoom:number};
  onStroke: (points: GridPoint[]) => void;
  onTap: () => boolean;
  ringTarget?: Pick<SelectionRingBox, "gx" | "gz" | "spanX" | "spanZ">;
  onRingProjection: (projection: SelectionRingProjection | null) => void;
  onInspect: (point: GridPoint) => void;
}

function paintTerrain(map: HTMLCanvasElement, state: GameState) {
  map.width = map.height = GRID_SIZE;
  const ctx = map.getContext("2d");
  if (!ctx) return;
  for (let z = GRID_MIN; z <= GRID_MAX; z++) {
    for (let x = GRID_MIN; x <= GRID_MAX; x++) {
      const cell = getTerrainCell(state, x, z);
      const grain = ((Math.imul(x, 733) ^ Math.imul(z, 571)) & 7) - 4;
      ctx.fillStyle = cell.kind === "land" ? `hsl(94 35% ${53 + grain + cell.elevation * 3}%)`
        : cell.kind === "coast" ? "#dfcb92"
        : `hsl(192 62% ${50 + grain * .3 - cell.depth * 2.1}%)`;
      ctx.fillRect(x - GRID_MIN, z - GRID_MIN, 1, 1);
    }
  }
}

export function IslandMapFallback({ state, focus, buildingPulse, draw, following, onStopFollowing, heatmap, startAt, onStroke, onTap, onInspect, ringTarget, onRingProjection }: Props) {
  const layer = useMemo(() => computeHeatmapCells(state, heatmap), [state, heatmap]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const data = useRef({ state, focus, buildingPulse, draw, following, layer, startAt, onStroke, onTap, onInspect, ringTarget, onRingProjection });
  const changeZoom = useRef<(factor: number) => void>(() => {});
  data.current = { state, focus, buildingPulse, draw, following, layer, startAt, onStroke, onTap, onInspect, ringTarget, onRingProjection };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const terrain = document.createElement("canvas");
    let terrainKey = "";
    let frame = 0;
    let last = 0;
    const opening = data.current;
    const camera = opening.state.cameraView;
    let zoom = camera ? Math.max(3,Math.min(40,1150/camera.radius)) : opening.startAt ? Math.max(4,Math.min(34,1150/opening.startAt.zoom)) : 22;
    changeZoom.current = factor => {
      zoom = Math.max(3, Math.min(60, zoom * factor));
    };
    let gx = camera ? camera.target[0]/TILE_SIZE : (opening.startAt?.gx ?? 0);
    let gz = camera ? camera.target[2]/TILE_SIZE : (opening.startAt?.gz ?? 0);
    let focusSeen: Props["focus"];
    let suspendedFocus: Props["focus"];
    let pulseSeen: Props["buildingPulse"];
    let drag: {id: number; x: number; y: number; moved: boolean; drawing: boolean} | undefined;
    let stroke: GridPoint[] = [];
    const pointAt = (event: PointerEvent): GridPoint => {
      const rect = canvas.getBoundingClientRect();
      const x = gx + (event.clientX - rect.left - rect.width/2)/zoom;
      const z = gz + (event.clientY - rect.top - rect.height/2)/zoom;
      return {gx: Math.floor(x), gz: Math.floor(z), vx: Math.floor(x*VOXELS_PER_TILE), vz: Math.floor(z*VOXELS_PER_TILE)};
    };
    const addPoint = (event: PointerEvent) => {
      const point = pointAt(event);
      const previous = stroke.at(-1);
      if (withinMap(point.gx,point.gz) && (previous?.vx!==point.vx || previous?.vz!==point.vz)) stroke.push(point);
    };
    const paint = (time: number) => {
      const current = data.current;
      const { state, focus, following, buildingPulse } = current;
      const dt = Math.min(.06, (time-last)/1000);
      last = time;
      focusSeen = focus;
      const lines = state.mobility?.lines ?? [];
      const voyages = state.mobility?.voyages ?? {};
      const vehicle = following && (lines.find(line=>line.id===following)?.position ?? voyages[following]?.position);
      const target = vehicle || (focus !== suspendedFocus ? focus : undefined);
      if (target && !drag) {
        const factor = 1 - Math.exp(-dt * 6);
        gx += (target[0] + .5 - gx) * factor;
        gz += (target[1] + .5 - gz) * factor;
      }
      const pulseAge = buildingPulse ? Math.max(0, time - buildingPulse.startedAt) : Infinity;
      const pulseSite = pulseAge < 2400 && state.elements.find(el => el.id === buildingPulse?.id);
      if (pulseSite && pulseSeen !== buildingPulse) {
        pulseSeen = buildingPulse;
        gx = pulseSite.gx + pulseSite.spanX / 2;
        gz = pulseSite.gz + pulseSite.spanZ / 2;
        zoom = Math.min(36, Math.min(canvas.clientWidth, canvas.clientHeight) / (Math.max(pulseSite.spanX, pulseSite.spanZ) + 4));
      }
      const cacheKey = (state.terrainVersion ?? 1) + ":" + (state.infrastructure?.stamp ?? "");
      if (terrainKey !== cacheKey) {
        terrainKey = cacheKey;
        paintTerrain(terrain, state);
      }
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const scale = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(w * scale), height = Math.round(h * scale);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = "hsl(192 62% 36%)";
      ctx.fillRect(0, 0, w, h);
      const left = w / 2 - gx * zoom, top = h / 2 - gz * zoom;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(terrain, Math.floor(left + GRID_MIN * zoom), Math.floor(top + GRID_MIN * zoom), GRID_SIZE * zoom, GRID_SIZE * zoom);
      for (const tile of current.layer) {
        const x = left + tile.gx * zoom, y = top + tile.gz * zoom;
        if (x+zoom < 0 || y+zoom < 0 || x > w || y > h) continue;
        ctx.fillStyle = tile.score < 0
          ? `rgba(244,90,63,${.2 + Math.abs(tile.score)*.45})`
          : `rgba(85,225,194,${.2 + tile.score*.45})`;
        ctx.fillRect(x,y,zoom+1,zoom+1);
      }
      for (const el of state.elements) {
        const def = ELEMENT_BY_ID[el.defId];
        if (!def) continue;
        const x = left + el.gx * zoom, y = top + el.gz * zoom;
        const ew = el.spanX * zoom, eh = el.spanZ * zoom;
        if (x + ew < 0 || y + eh < 0 || x > w || y > h) continue;
        const span = state.infrastructure?.spans[`${el.gx},${el.gz}`];
        if (def.isRoadNetwork || span || def.isRailNetwork) {
          const { minX, minZ, maxX, maxZ } = roadBounds(el);
          ctx.fillStyle = span ? "#e1c494" : def.isRailNetwork ? "#735b47" : "#4c5661";
          ctx.fillRect(left + minX*zoom, top + minZ*zoom, (maxX-minX)*zoom + 1, (maxZ-minZ)*zoom + 1);
          ctx.fillStyle = span ? "#635c55" : "#e7d1a6";
          const horizontal = span ? span.axis === "x" : el.roadAxis === "x";
          if (span || el.roadAxis) {
            if (horizontal) ctx.fillRect(x + ew*.3, y + eh*.48, ew*.42, Math.max(1, eh*.06));
            else ctx.fillRect(x + ew*.48, y + eh*.3, Math.max(1, ew*.06), eh*.42);
          }
        } else {
          const inset = Math.max(1, zoom * .12);
          const lift = Math.min(eh*.3, (el.level+1)*zoom*.08);
          ctx.fillStyle = "rgba(21,42,42,.32)";
          ctx.fillRect(x+inset+lift, y+inset+lift, Math.max(1,ew-inset*2), Math.max(1,eh-inset*2));
          ctx.fillStyle = def.accentHex;
          ctx.fillRect(x+inset, y+inset, ew-inset*2, eh-inset*2);
          ctx.strokeStyle = "rgba(255,255,255,.42)";
          ctx.strokeRect(x+inset+.5, y+inset+.5, Math.max(0,ew-inset*2-1), Math.max(0,eh-inset*2-1));
          if (el.christmasDecorated) {
            const colors = ["#bd3542", "#ffdb80", "#3ca57e"];
            const spacing = Math.max(3, zoom * .23);
            for (let i=0; i*spacing<ew-2*inset; i++) {
              ctx.fillStyle=colors[i % colors.length];
              ctx.fillRect(x+inset+i*spacing, y+eh-inset-2, 2, 2);
            }
          }
          if (el.animProgress > 0) {
            ctx.strokeStyle = `rgba(255,247,209,${el.animProgress})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(x-1,y-1,ew+2,eh+2);
            ctx.lineWidth = 1;
          }
        }
        const maintenance = maintenanceStatus(state, el);
        if (maintenance === "soon" || maintenance === "due" || maintenance === "overdue") {
          const size = Math.max(3, zoom * .24);
          ctx.fillStyle = "#ffc457";
          ctx.strokeStyle = "#4d3109";
          ctx.fillRect(x + ew - size, y, size, size);
          ctx.strokeRect(x + ew - size, y, size, size);
        }
      }
      if (pulseSite) {
        const progress = (pulseAge % 1200) / 1200;
        const pad = 2 + progress * zoom * 0.4;
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(255, 205, 92, ${1 - progress})`;
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 9;
        ctx.strokeRect(left + pulseSite.gx * zoom - pad, top + pulseSite.gz * zoom - pad,
          pulseSite.spanX * zoom + pad * 2, pulseSite.spanZ * zoom + pad * 2);
        ctx.restore();
      }
      const drawVehicle = (id:string,x:number,z:number,rail=false) => {
        const selected=id===following;
        const size=Math.max(2,zoom*(selected ? .28 : .17));
        ctx.beginPath();
        ctx.arc(left+(x+.5)*zoom,top+(z+.5)*zoom,size,0,Math.PI*2);
        ctx.fillStyle=rail ? "#fbbf24" : "#8ee9f5";
        ctx.fill();
        ctx.strokeStyle=selected ? "#fff" : "#23434d";
        ctx.stroke();
      };
      for(const line of lines) if (line.position && line.enabled) drawVehicle(line.id,...line.position,line.mode==="rail");
      for(const [id,voyage] of Object.entries(voyages)) if(voyage.position && !voyage.moored) drawVehicle(id,...voyage.position);
      if (stroke.length) {
        ctx.beginPath();
        for (const [i, point] of stroke.entries()) {
          const x = left + ((point.vx ?? 0)+.5)/VOXELS_PER_TILE*zoom;
          const z = top + ((point.vz ?? 0)+.5)/VOXELS_PER_TILE*zoom;
          if (i) ctx.lineTo(x,z);
          else ctx.moveTo(x,z);
        }
        ctx.lineWidth = Math.max(3, zoom*.35);
        ctx.lineCap = "round";
        ctx.strokeStyle = "#e9fcaa";
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      const ring = current.ringTarget;
      if (ring) {
        const rect = canvas.getBoundingClientRect();
        const x = left + (ring.gx + ring.spanX / 2) * zoom;
        const y = top + (ring.gz + ring.spanZ / 2) * zoom;
        const radiusPx = Math.min(84, Math.max(56, Math.max(ring.spanX, ring.spanZ) * zoom / 2 + 27));
        current.onRingProjection({
          x: rect.left + Math.min(w - radiusPx - 20, Math.max(radiusPx + 20, x)),
          y: rect.top + Math.min(h - radiusPx - 20, Math.max(radiusPx + 20, y)),
          radiusPx,
          visible: x >= 0 && x <= w && y >= 0 && y <= h,
        });
      }
      frame = requestAnimationFrame(paint);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      changeZoom.current(Math.exp(-event.deltaY*.0015));
    };
    const down = (event: PointerEvent) => {
      if (drag || (event.button !== 0 && event.button !== 2)) return;
      canvas.setPointerCapture(event.pointerId);
      suspendedFocus = focusSeen;
      const drawing = data.current.draw && event.button === 0 && !event.shiftKey;
      drag = {id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,drawing};
      if (drawing) addPoint(event);
    };
    const move = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return;
      if (drag.drawing) {
        addPoint(event);
        return;
      }
      const dx=event.clientX-drag.x, dy=event.clientY-drag.y;
      if (!drag.moved && Math.abs(dx)+Math.abs(dy)<4) return;
      gx = Math.max(GRID_MIN,Math.min(GRID_MAX,gx-dx/zoom));
      gz = Math.max(GRID_MIN,Math.min(GRID_MAX,gz-dy/zoom));
      drag = {...drag,x:event.clientX,y:event.clientY,moved:true};
    };
    const up = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return;
      if (drag.drawing) {
        addPoint(event);
        if (stroke.length) data.current.onStroke(stroke);
      } else if (!drag.moved && event.button === 0 && !data.current.onTap()) {
        const point = pointAt(event);
        if (withinMap(point.gx,point.gz)) data.current.onInspect(point);
      }
      drag = undefined;
      stroke = [];
    };
    const cancel = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return;
      drag = undefined;
      stroke = [];
    };
    const contextMenu = (event: Event) => event.preventDefault();
    frame = requestAnimationFrame(paint);
    canvas.addEventListener("wheel", wheel, {passive:false});
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("contextmenu", contextMenu);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("wheel",wheel);
      canvas.removeEventListener("pointerdown",down);
      canvas.removeEventListener("pointermove",move);
      canvas.removeEventListener("pointerup",up);
      canvas.removeEventListener("pointercancel",cancel);
      canvas.removeEventListener("contextmenu",contextMenu);
    };
  }, []);

  return <>
    <canvas ref={canvasRef} className={`absolute inset-0 block h-full w-full touch-none ${draw ? "cursor-crosshair" : "cursor-grab"}`}
      aria-label="Pixel Civilization island map" />
    <div className="pc-map-controls" role="group" aria-label="Island map controls">
      {following && <button type="button" className="pc-map-stop" onClick={onStopFollowing}>Stop following</button>}
      <button type="button" aria-label="Zoom out" onClick={() => changeZoom.current(.72)}>−</button>
      <button type="button" aria-label="Zoom in" onClick={() => changeZoom.current(1.38)}>+</button>
    </div>
  </>;
}
