import { useEffect, useRef } from "react";
import { ELEMENT_BY_ID } from "../game/catalog";
import { GRID_MIN, GRID_MAX, GRID_SIZE } from "../game/mapBounds";
import { roadBounds } from "../game/roadCorridors";
import type { GameState } from "../game/simulation";
import { getTerrainCell } from "../game/terrain";

interface Props {
  state: GameState;
  focus: [number, number] | undefined;
  onInspect: (id: string) => void;
}

function paintTerrain(map: HTMLCanvasElement, state: GameState) {
  map.width = map.height = GRID_SIZE;
  const ctx = map.getContext("2d");
  if (!ctx) return;
  for (let z = GRID_MIN; z <= GRID_MAX; z++) {
    for (let x = GRID_MIN; x <= GRID_MAX; x++) {
      const cell = getTerrainCell(state, x, z);
      const grain = ((Math.imul(x, 733) ^ Math.imul(z, 571)) & 7) - 4;
      ctx.fillStyle = cell.kind === "land" ? `hsl(94 35% ${53 + grain + cell.elevation}%)`
        : cell.kind === "coast" ? "#dfcb92"
        : `hsl(192 62% ${50 + grain * .3 - cell.depth * 2.1}%)`;
      ctx.fillRect(x - GRID_MIN, z - GRID_MIN, 1, 1);
    }
  }
}

export function IslandMapFallback({ state, focus, onInspect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const data = useRef({ state, focus, onInspect });
  const changeZoom = useRef<(factor: number) => void>(() => {});
  data.current = { state, focus, onInspect };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const terrain = document.createElement("canvas");
    let terrainKey = "";
    let frame = 0;
    let last = 0;
    let zoom = 22;
    changeZoom.current = factor => {
      zoom = Math.max(3, Math.min(60, zoom * factor));
    };
    let gx = 0;
    let gz = 0;
    let focusSeen: Props["focus"];
    let suspendedFocus: Props["focus"];
    let drag: {x: number; y: number; moved: boolean} | undefined;
    const paint = (time: number) => {
      const current = data.current;
      const { state, focus } = current;
      const dt = Math.min(.06, (time-last)/1000);
      last = time;
      focusSeen = focus;
      if (focus && focus !== suspendedFocus && !drag) {
        const factor = 1 - Math.exp(-dt * 6);
        gx += (focus[0] + .5 - gx) * factor;
        gz += (focus[1] + .5 - gz) * factor;
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
          if (el.animProgress > 0) {
            ctx.strokeStyle = `rgba(255,247,209,${el.animProgress})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(x-1,y-1,ew+2,eh+2);
            ctx.lineWidth = 1;
          }
        }
      }
      frame = requestAnimationFrame(paint);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      changeZoom.current(Math.exp(-event.deltaY*.0015));
    };
    const down = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
      suspendedFocus = focusSeen;
      drag = {x:event.clientX,y:event.clientY,moved:false};
    };
    const move = (event: PointerEvent) => {
      if (!drag) return;
      const dx=event.clientX-drag.x, dy=event.clientY-drag.y;
      if (!drag.moved && Math.abs(dx)+Math.abs(dy)<4) return;
      gx = Math.max(GRID_MIN,Math.min(GRID_MAX,gx-dx/zoom));
      gz = Math.max(GRID_MIN,Math.min(GRID_MAX,gz-dy/zoom));
      drag = {x:event.clientX,y:event.clientY,moved:true};
    };
    const up = (event: PointerEvent) => {
      if (drag && !drag.moved) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(gx + (event.clientX - rect.left - rect.width/2)/zoom);
        const z = Math.floor(gz + (event.clientY - rect.top - rect.height/2)/zoom);
        const el = data.current.state.elements.find(e=>x>=e.gx && x<e.gx+e.spanX && z>=e.gz && z<e.gz+e.spanZ);
        if (el) data.current.onInspect(el.id);
      }
      drag = undefined;
    };
    const cancel = () => { drag = undefined; };
    frame = requestAnimationFrame(paint);
    canvas.addEventListener("wheel", wheel, {passive:false});
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("wheel",wheel);
      canvas.removeEventListener("pointerdown",down);
      canvas.removeEventListener("pointermove",move);
      canvas.removeEventListener("pointerup",up);
      canvas.removeEventListener("pointercancel",cancel);
    };
  }, []);

  return <>
    <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full cursor-grab touch-none"
      aria-label="Pixel Civilization island map" />
    <div className="pc-map-controls" role="group" aria-label="Island map zoom">
      <button type="button" aria-label="Zoom out" onClick={() => changeZoom.current(.72)}>−</button>
      <button type="button" aria-label="Zoom in" onClick={() => changeZoom.current(1.38)}>+</button>
    </div>
  </>;
}
