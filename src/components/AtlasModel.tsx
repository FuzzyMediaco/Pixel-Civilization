import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { renderIsometricVoxelThumb } from "./ElementFavicon";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "../game/designs/index";
import {
  ELEMENT_BY_ID,
  getMaxElementLevel,
  getStandardFootprintForLevel,
  type CivElementDef,
} from "../game/catalog";
import { guideCarriageway } from "../game/designs/carriageways";
import { buildDesignAsset, buildPlacedGroupFromAsset } from "../game/voxelArchitect";
import { getHandbookFrame } from "../game/handbookLayout";
import { getGuideVariant, getNeighborPreview } from "../game/connectionPreview";
import { roadWidth } from "../game/roadStandards";
import { TILE_SIZE, voxelNightUniform } from "../game/voxelCore";

export interface AtlasModelProps {
  def: CivElementDef;
  level: number;
  variant: number;
  night: boolean;
  joined: boolean;
  onStatic?: (value: boolean) => void;
  className?: string;
}

export function AtlasModel({
  def,
  level,
  variant,
  night,
  joined,
  onStatic,
  className = "",
}: AtlasModelProps) {
  const mount = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [angle, setAngle] = useState(0);
  const illustrated = useMemo(() => error ? renderIsometricVoxelThumb(def,level,variant,angle,300) : null,[error,def,level,variant,angle]);
  const description = def.name + ", level " + level + ", style " + (variant + 1);
  const viewer = useRef<{
    show: (d: CivElementDef, lv: number, v: number, isJoined: boolean) => void;
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
      setError(true);
      onStatic?.(true);
    };
    const onContextRestored = () => {
      setError(false);
      onStatic?.(false);
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
    controls.enableZoom = false;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = Math.PI * 0.12;

    let model: THREE.Group | undefined;
    let radius = 10;
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
      show(d, lv, v, isJoined) {
        clear();
        const plots = isJoined ? getNeighborPreview(d.id, lv) : [];
        if (plots.length) {
          model = new THREE.Group();
          const rotors = [];
          for (const [idx, plot] of plots.entries()) {
            const { el, mask, edges } = plot;
            const pDef = ELEMENT_BY_ID[el.defId];
            const [sx, sz] = getStandardFootprintForLevel(pDef, el.level);
            const asset = buildDesignAsset(pDef, el.level, getGuideVariant(d.id, el.defId, v, idx), sx, sz, mask, {
              edges,
            });
            const group = buildPlacedGroupFromAsset(asset);
            group.position.set((el.gx + el.spanX * 0.5) * TILE_SIZE, 0, (el.gz + el.spanZ * 0.5) * TILE_SIZE);
            group.rotation.y = pDef.isNetwork ? 0 : (el.rotation * Math.PI) / 2;
            model.add(group);
            rotors.push(...(group.userData.rotorList ?? []));
          }
          model.userData.rotorList = rotors;
        } else if (roadWidth(d.id) > 1) {
          model = new THREE.Group();
          for (let i = 0; i < 3; i++) {
            const part = buildPlacedGroupFromAsset(
              buildDesignAsset(d, lv, v, 1, 1, 10, { corridor: guideCarriageway(d.id, i) }),
            );
            part.position.x = (i - 1) * TILE_SIZE;
            model.add(part);
          }
        } else {
          const [sx, sz] = getStandardFootprintForLevel(d, lv);
          model = buildPlacedGroupFromAsset(buildDesignAsset(d, lv, v, sx, sz, d.isNetwork ? 5 : 0));
        }
        scene.add(model);
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        radius = Math.max(
          1.2,
          Math.hypot(size.x, size.z) * 0.54,
          size.y * 0.55 + Math.hypot(size.x, size.z) * 0.23,
        );
        const direction = camera.position.clone().sub(controls.target);
        if (direction.lengthSq() < 1) direction.set(1.05, 0.88, 1.3);
        if (plots.length) {
          const side = plots[0].edges.find((e) => e.neighbor === plots[1].el.defId)?.side;
          direction.set(side === "left" ? -1.05 : 1.05, 0.95, side === "back" ? -1.3 : 1.3);
        }
        camera.position.copy(center).addScaledVector(direction.normalize(), 95);
        controls.target.copy(center);
        controls.update();
        resize();
      },
      light(dark) {
        voxelNightUniform.value = dark ? 1 : 0;
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
      if (!reduced.matches && model?.userData.rotorList?.length) {
        for (const part of model.userData.rotorList) part.pivot.rotation[part.axis] += dt * part.speed;
        draw = true;
      }
      if (draw) renderer.render(scene, camera);
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
      voxelNightUniform.value = 0;
    };
  }, []);

  useEffect(() => {
    viewer.current?.show(def, level, variant, joined);
  }, [def, level, variant, joined]);

  useEffect(() => {
    viewer.current?.light(night);
  }, [night]);

  return (
    <div
      ref={mount}
      className={"pc-atlas-viewport" + (error ? " is-static" : "") + (className ? " " + className : "")}
      role={error ? "group" : "img"}
      aria-label={description}
    >
      {error && illustrated && (
        <div className="pc-atlas-illustrated">
          <img src={illustrated} alt={description + ", angle " + (angle + 1) + " of four"} />
          <div className="pc-course-actions" aria-label="Rotate illustrated model">
            <button type="button" onClick={() => setAngle(a => (a + 3) % 4)}>Rotate left</button>
            <button type="button" onClick={() => setAngle(a => (a + 1) % 4)}>Rotate right</button>
          </div>
        </div>
      )}
      {error && !illustrated && (
        <div
          className="pc-atlas-flat-fallback"
          style={{
            ...getHandbookFrame(level, variant, Math.max(5, getMaxElementLevel(def.id))),
            backgroundImage: "url(./handbook/catalog/" + def.id + ".webp)",
          }}
        />
      )}
    </div>
  );
}
