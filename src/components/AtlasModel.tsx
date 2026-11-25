import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { EraSheetCell, renderIsometricVoxelThumb } from "./ElementFavicon";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "../game/designs/index";
import {
  getMaxElementLevel,
  type CivElementDef,
} from "../game/catalog";
import { buildDesignAsset, buildPlacedGroupFromAsset } from "../game/voxelArchitect";
import { getHandbookFrame } from "../game/handbookLayout";
import { atlasPlots } from "../handbook/modelPlots";
import { eraElementName, eraElementSpec, type EraKey } from "../game/eraStyles";
import { useEraArt } from "./useEraArt";
import { TILE_SIZE, voxelNightUniform } from "../game/voxelCore";

export interface AtlasModelProps {
  def: CivElementDef;
  level: number;
  variant: number;
  night: boolean;
  joined: boolean;
  era?: EraKey;
  active?: boolean;
  onStatic?: (value: boolean) => void;
  className?: string;
}

export function AtlasModel({
  def,
  level,
  variant,
  night,
  joined,
  era = "original",
  active = false,
  onStatic,
  className = "",
}: AtlasModelProps) {
  const mount = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [angle, setAngle] = useState(0);
  const [paused,setPaused] = useState(false);
  const pauseRef = useRef(false);
  pauseRef.current = paused;
  const [hasMotion,setHasMotion] = useState(false);
  const {ready,failed,retry} = useEraArt(era);
  const illustrated = useMemo(() => ready && error ? renderIsometricVoxelThumb(def,level,variant,angle,300,era,active,joined) : null,[ready,error,def,level,variant,angle,era,active,joined]);
  const description = eraElementName(def.id,era) + ", level " + level + ", style " + (variant + 1);
  const hasSheet=Boolean(eraElementSpec(def.id,era));
  const viewer = useRef<{
    show: (d: CivElementDef, lv: number, v: number, isJoined: boolean, key: EraKey, active: boolean) => void;
    zoomBy: (factor: number) => void;
    orbit: (radians: number) => void;
    reset: () => void;
    replay: () => void;
    light: (dark: boolean) => void;
  } | null>(null);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(true);
      onStatic?.(true);
      return;
    }

    const canvas = renderer.domElement;
    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      host.dataset.modelReady="false";
      setError(true);
      onStatic?.(true);
    };
    const onContextRestored = () => {
      setError(false);
      onStatic?.(false);
      draw=true;
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    host.prepend(canvas);
    renderer.setPixelRatio(Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const sky = new THREE.HemisphereLight(0xfff9e9, 0x91ad94, 1.95);
    const sun = new THREE.DirectionalLight(0xffefd9, 2.5);
    sun.position.set(-24, 52, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, far: 155 });
    sun.shadow.bias = -0.0004;
    sun.shadow.camera.updateProjectionMatrix();

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.ShadowMaterial({ opacity: 0.16 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.03;
    floor.receiveShadow = true;
    scene.add(sky, sun, floor);

    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 240);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minZoom = 0.5;
    controls.maxZoom = 3;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = Math.PI * 0.12;

    let model: THREE.Group | undefined;
    let radius = 10;
    let previousSelection = "";
    let nightMode = false;
    let draw = true;
    const changed = () => {
      draw = true;
    };
    controls.addEventListener("change", changed);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      const asp = w / Math.max(1, h);
      const half = radius / Math.min(1, asp);
      Object.assign(camera, { left: -half * asp, right: half * asp, top: half, bottom: -half });
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      draw = true;
    };

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(host);

    const clear = () => {
      if (!model) return;
      scene.remove(model);
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      model = undefined;
    };

    viewer.current = {
      show(d, lv, v, isJoined, key, running) {
        host.dataset.modelReady="false";
        host.dataset.modelSelection=[key,d.id,lv,v+1,isJoined ? "joined" : "single"].join("/");
        clear();
        model = new THREE.Group();
        const rotors = [];
        for (const plot of atlasPlots(d,lv,v,key,isJoined,running)) {
          const [sx,sz] = plot.span;
          const group = buildPlacedGroupFromAsset(buildDesignAsset(plot.def,plot.level,plot.variant,sx,sz,plot.mask,plot.appearance));
          group.position.set(plot.x*TILE_SIZE,0,plot.z*TILE_SIZE);
          group.rotation.y = plot.rotation * Math.PI / 2;
          model.add(group);
          rotors.push(...(group.userData.rotorList ?? []));
        }
        model.userData.rotorList = rotors;
        setHasMotion(rotors.length > 0);
        scene.add(model);
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const selection = [d.id,lv,v,isJoined].join(":");
        if (previousSelection !== selection) radius = Math.max(
          1.2,
          Math.hypot(size.x, size.z) * 0.54,
          size.y * 0.55 + Math.hypot(size.x, size.z) * 0.23,
        );
        const direction = camera.position.clone().sub(controls.target);
        if (direction.lengthSq() < 1) direction.set(1.05, 0.88, 1.3);
        previousSelection = selection;
        camera.position.copy(center).addScaledVector(direction.normalize(), 95);
        controls.target.copy(center);
        controls.update();
        resize();
      },
      zoomBy(factor) {
        camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom);
        camera.updateProjectionMatrix(); draw = true;
      },
      orbit(radians) {
        const offset=camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),radians);
        camera.position.copy(controls.target).add(offset);controls.update();draw=true;
      },
      reset() {
        camera.zoom = 1;
        camera.position.copy(controls.target).add(new THREE.Vector3(1.05,.88,1.3).normalize().multiplyScalar(95));
        controls.update(); resize();
      },
      replay() {
        for (const part of model?.userData.rotorList ?? []) part.pivot.rotation[part.axis] = 0;
        draw = true;
      },
      light(dark) {
        nightMode = dark;
        sky.color.setHex(dark ? 0xabbfff : 0xfff9e9);
        sky.intensity = dark ? 0.62 : 1.95;
        sun.color.setHex(dark ? 0xb2cdff : 0xffefd9);
        sun.intensity = dark ? 0.78 : 2.5;
        draw = true;
      },
    };

    let previous = 0;
    const reduced = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    renderer.setAnimationLoop((now: number) => {
      if (typeof document !== "undefined" && document.hidden) return;
      const dt = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      if (!reduced.matches && !pauseRef.current && model?.userData.rotorList?.length) {
        for (const part of model.userData.rotorList) part.pivot.rotation[part.axis] += dt * part.speed;
        draw = true;
      }
      if (draw) {
        const worldLighting = voxelNightUniform.value;
        voxelNightUniform.value = nightMode ? 1 : 0;
        renderer.render(scene, camera);
        if(model) host.dataset.modelReady="true";
        voxelNightUniform.value = worldLighting;
      }
      draw = false;
    });

    return () => {
      viewer.current = null;
      renderer.setAnimationLoop(null);
      clear();
      controls.dispose();
      observer?.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      floor.geometry.dispose();
      floor.material.dispose();
      sun.shadow.dispose();
      renderer.dispose();
      canvas.remove();

    };
  }, []);

  useEffect(() => {
    if (ready) viewer.current?.show(def, level, variant, joined, era, active);
    else if (mount.current) mount.current.dataset.modelReady="false";
  }, [ready,def, level, variant, joined, era, active]);

  useEffect(() => {
    viewer.current?.light(night);
  }, [night]);

  return (
    <>
    <div
      ref={mount}
      className={"pc-atlas-viewport" + (error ? " is-static" : "") + (className ? " " + className : "")}
      role={error ? "group" : "img"}
      aria-label={description}
      aria-busy={!ready && !failed}
    >
      {!ready && <div className="pc-model-loading" role="status">{failed
        ? <>{hasSheet && <EraSheetCell id={def.id} era={era} level={level} variant={variant} size={144} label={description}/>}<button type="button" onClick={retry}>Retry interactive artwork</button></>
        : "Loading time-period artwork…"}</div>}
      {error && illustrated && (
        <div className="pc-atlas-illustrated">
          <img src={illustrated} alt={description + ", angle " + (angle + 1) + " of four"} />
          <div className="pc-course-actions" aria-label="Rotate illustrated model">
            <button type="button" onClick={() => setAngle(a => (a + 3) % 4)}>Rotate left</button>
            <button type="button" onClick={() => setAngle(a => (a + 1) % 4)}>Rotate right</button>
          </div>
        </div>
      )}
      {ready && error && !illustrated && hasSheet && <EraSheetCell id={def.id} era={era} level={level} variant={variant} size={192} label={description}/>}
      {error && !illustrated && !hasSheet && (
        <div
          className="pc-atlas-flat-fallback"
          style={{
            ...getHandbookFrame(level, variant, Math.max(5, getMaxElementLevel(def.id))),
            backgroundImage: "url(./handbook/catalog/" + def.id + ".webp)",
          }}
        />
      )}
    </div>
    <div className="pc-model-controls" aria-label="Model controls">
      {!error && <>
        <button type="button" onClick={() => viewer.current?.zoomBy(1.25)} aria-label="Zoom in">＋</button>
        <button type="button" onClick={() => viewer.current?.zoomBy(0.8)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => viewer.current?.orbit(-Math.PI/4)} aria-label="Rotate model left">↶</button>
        <button type="button" onClick={() => viewer.current?.orbit(Math.PI/4)} aria-label="Rotate model right">↷</button>
      </>}
      <button type="button" onClick={() => {setAngle(0);viewer.current?.reset();}}>Reset view</button>
      {!error && hasMotion && <>
        <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Resume motion" : "Pause motion"}</button>
        <button type="button" onClick={() => {setPaused(false);viewer.current?.replay();}}>Replay motion</button>
      </>}
    </div>
    </>
  );
}
