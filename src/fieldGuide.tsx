import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./game/designs/index";
import { CATEGORY_META, ELEMENT_BY_ID, getStandardFootprintForLevel, getElementLevelName, getMaxElementLevel, type CivElementDef } from "./game/catalog";
import designStyles from "./game/designStyles.json";
import { getGuideUsage } from "./game/guideUsage";
import {roadWidth,frontageWidth} from "./game/roadStandards";
import {guideCarriageway} from "./game/designs/carriageways";
import { getHandbookFrame } from "./game/handbookLayout";
import { DESIGNS } from "./game/designs/registry";
import { buildDesignAsset, buildPlacedGroupFromAsset } from "./game/voxelArchitect";
import { EDGE_LABELS } from "./game/parcelEdges";
import { findGuideElements, getGuidePartner, getGuideVariant, getNeighborPreview } from "./game/connectionPreview";
import { TILE_SIZE, voxelNightUniform } from "./game/voxelCore";
import "./fieldGuide.css";

function Model({ def, level, variant, night, joined, onStatic }: { def: CivElementDef; level: number; variant: number; night: boolean; joined: boolean; onStatic: (value: boolean)=>void }) {
  const mount = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const viewer = useRef<{ show: (d: CivElementDef, lv: number, v: number, joined: boolean) => void; light: (dark: boolean) => void } | null>(null);
  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setError(true); onStatic(true); return; }
    host.prepend(renderer.domElement);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
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
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.03;
    floor.receiveShadow = true;
    scene.add(sky, sun, floor);
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 240);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = Math.PI * 0.12;
    let model: THREE.Group | undefined;
    let radius = 10;
    let draw = true;
    const changed = () => { draw = true; };
    controls.addEventListener("change", changed);
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      const asp = w / Math.max(1, h);
      const half = radius / Math.min(1, asp);
      Object.assign(camera, { left: -half * asp, right: half * asp, top: half, bottom: -half });
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      draw = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const clear = () => {
      if (!model) return;
      scene.remove(model);
      model.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    };
    viewer.current = {
      show(d, lv, v, joined) {
        clear();
        const plots = joined ? getNeighborPreview(d.id,lv) : [];
        if (plots.length) {
          model = new THREE.Group();
          const rotors = [];
          for(const [idx,plot] of plots.entries()) {
            const {el,mask,edges}=plot, def=ELEMENT_BY_ID[el.defId];
            const [sx,sz]=getStandardFootprintForLevel(def,el.level);
            const asset=buildDesignAsset(def,el.level,getGuideVariant(d.id,el.defId,v,idx),sx,sz,mask,{edges});
            const group=buildPlacedGroupFromAsset(asset);
            group.position.set((el.gx+el.spanX*.5)*TILE_SIZE,0,(el.gz+el.spanZ*.5)*TILE_SIZE);
            group.rotation.y=def.isNetwork ? 0 : el.rotation*Math.PI/2;
            model.add(group);
            rotors.push(...(group.userData.rotorList??[]));
          }
          model.userData.rotorList=rotors;
        } else if(roadWidth(d.id)>1){
          model=new THREE.Group();
          for(let i=0;i<3;i++){
            const part=buildPlacedGroupFromAsset(buildDesignAsset(d,lv,v,1,1,10,{corridor:guideCarriageway(d.id,i)}));
            part.position.x=(i-1)*TILE_SIZE;model.add(part);
          }
        } else {
          const [sx, sz] = getStandardFootprintForLevel(d,lv);
          model = buildPlacedGroupFromAsset(buildDesignAsset(d, lv, v, sx, sz, d.isNetwork ? 5 : 0));
        }
        scene.add(model);
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        radius = Math.max(1.2, Math.hypot(size.x, size.z) * 0.54, size.y * 0.55 + Math.hypot(size.x, size.z) * 0.23);
        const direction = camera.position.clone().sub(controls.target);
        if (direction.lengthSq() < 1) direction.set(1.05, 0.88, 1.3);
        if (plots.length) {
          // Look toward the shared boundary so a railway or a rear vegetable garden
          // stays in view when the neighboring building is taller than its partner.
          const side=plots[0].edges.find(e=>e.neighbor===plots[1].el.defId)?.side;
          direction.set(side==="left" ? -1.05 : 1.05,0.95,side==="back" ? -1.3 : 1.3);
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
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    renderer.setAnimationLoop((now: number) => {
      if (document.hidden) return;
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
      observer.disconnect();
      floor.geometry.dispose();
      floor.material.dispose();
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(() => viewer.current?.show(def, level, variant, joined), [def, level, variant, joined]);
  useEffect(() => viewer.current?.light(night), [night]);
  return <div ref={mount} className={"viewport"+(error ? " illustrated" : "")} role="img" aria-label={def.name + ", level " + level + ", variant " + (variant + 1)}>
    {error && <div className="flat-model" style={{...getHandbookFrame(level,variant,Math.max(5,getMaxElementLevel(def.id))),backgroundImage:"url(./handbook/catalog/"+def.id+".webp)"}}/>}
  </div>;
}

// Local files can replace a fragment without navigating or changing their origin.
const fragment = new URLSearchParams(location.hash.slice(1));
const initial = location.protocol === "file:" && fragment.has("id") ? fragment : new URLSearchParams(location.search);
const numbered = (param: string, low: number, high: number, fallback: number) => {
  const n = Number(initial.get(param) ?? fallback);
  return Number.isInteger(n) && n >= low && n <= high ? n : fallback;
};
function Guide() {
  const [id, setId] = useState(ELEMENT_BY_ID[initial.get("id") ?? ""]?.id ?? "house");
  const [level, setLevel] = useState(Math.min(getMaxElementLevel(id), numbered("level", 1, getMaxElementLevel(id), 3)));
  const [variant, setVariant] = useState(numbered("variant", 1, 4, 1) - 1);
  const [joined, setJoined] = useState(false);
  const [night, setNight] = useState(false);
  const [staticImage,setStaticImage] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const def = ELEMENT_BY_ID[id], d = DESIGNS[id];
  const styleNames = designStyles[id as keyof typeof designStyles] ?? ["A","B","C","D"];
  const partner = ELEMENT_BY_ID[getGuidePartner(id)];
  const joins = useMemo(() => {
    const plot = getNeighborPreview(id, level)[0];
    return [...new Set(plot?.edges.filter(e=>e.neighbor===partner?.id).map(e=>e.kind))];
  }, [id, level, partner]);
  const group = CATEGORY_META.find(c => c.id === def.category)!.label;
  const matches = findGuideElements(query, category);
  useEffect(() => {
    const params = new URLSearchParams({ id, level: String(level), variant: String(variant + 1) });
    const route = (location.protocol === "file:" ? "#" : "?") + params.toString();
    history.replaceState(null, "", route);
  }, [id, level, variant]);
  return <>
    <header><div className="brand"><i aria-hidden="true" />Pixel Civilization</div><a href={"./handbook.html#design="+id}>Illustrated design sheet ↗</a><a href="./index.html">← Back to island</a></header>
    <main>
      <aside aria-label="Element library">
        <h1>Island field guide</h1>
        <input aria-label="Search elements" type="search" placeholder="Search elements" value={query} onChange={e => setQuery(e.target.value)} />
        <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>{CATEGORY_META.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <div className="matches">{matches.length} elements</div>
        <nav>{matches.map(e => <button aria-current={id === e.id ? "true" : undefined} key={e.id} onClick={() => { setId(e.id); setLevel(l => Math.min(l,getMaxElementLevel(e.id))); }}>
          <i style={{ backgroundColor: e.accentHex }} />{e.name}
        </button>)}{!matches.length && <p>No matching elements.</p>}</nav>
      </aside>
      <article>
        <section className={"stage" + (night ? " night" : "")}>
          <div className="caption"><span>{group}</span><h2>{def.name}</h2></div>
          {!staticImage && <button className="light" aria-pressed={night} onClick={() => setNight(!night)}>{night ? "☾  Night" : "☀  Day"}</button>}
          <Model def={def} level={level} variant={variant} night={night} joined={joined} onStatic={setStaticImage} />
          <div className="stage-foot"><div className="style-info"><b>{styleNames[variant]}</b><span>{staticImage ? "Daylight illustration" : "Drag to rotate"}</span></div><div className="variants" aria-label="Visual variant">{["A","B","C","D"].map((letter, i) => <button key={letter} title={styleNames[i]} aria-label={"Variant " + letter} aria-pressed={variant === i} onClick={() => setVariant(i)}>{letter}</button>)}</div></div>
        </section>
        <section className="progression"><div className="entry-title"><h3>{getElementLevelName(def,level)}</h3><span>{roadWidth(id)>1?frontageWidth(id):getStandardFootprintForLevel(def,level).join(" × ")+" tiles"}</span></div>
          <p>{d.growth}</p>
          <div className="steps" aria-label="Growth stages">{Array.from({length:getMaxElementLevel(id)},(_,i)=>getElementLevelName(def,i+1)).map((name, i) => <button key={i} aria-pressed={level === i+1} onClick={() => setLevel(i+1)}>
            <small>Level {i+1}</small><strong>{name}</strong></button>)}</div>
        </section>
        <section className="connection-entry"><div className="join-heading"><h3>Neighbor connections</h3>
          {partner && !staticImage && <button className="join-toggle" aria-pressed={joined} onClick={()=>setJoined(!joined)}>
            {joined ? "Show element alone" : "Show beside " + partner.name}</button>}</div>
          {joins.length>0 && <p className="join-readout">{(joined ? "Shown with " : "Compatible with ") + partner.name + " · " + joins.map(kind=>EDGE_LABELS[kind]).join(", ")}</p>}
          <p>{getGuideUsage(id,joins[0],def.description)}</p>
        </section>
      </article>
    </main>
  </>;
}
createRoot(document.getElementById("guide")!).render(<Guide />);
