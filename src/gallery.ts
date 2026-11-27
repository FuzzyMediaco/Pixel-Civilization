/**
 * Dev-only element gallery: renders elements at every level / variant in a grid so designs can be
 * reviewed side-by-side.  Open  /gallery.html?cat=housing&mode=full
 *
 * Query params
 *   cat      design module(s) to load: housing, agriculture, ... or "all" (comma list ok)
 *   ids      comma list of element ids (default: every id registered by the loaded modules)
 *   mode     levels (rows=element, cols=all playable levels, variant=`variant`)
 *            variants (rows=element, cols=V0..3 at level=`lv`)
 *            full (rows=element×variant, cols=all playable levels)
 *   variant  0..3 (levels mode)       lv  desired level (variants mode, clamped per element)
 *   era      canonical appearance ID (default original); active=1 shows an operating facility
 *   net      mix (default), bridge, one (mask), or atlas (standard joined carriageway)
 *   cell     cell size in px (default 260)
 *   night    1 = night lighting       angle  camera azimuth in degrees (default 45)
 *   water    1 = draw ocean under cells (boats, docks)
 */
import * as THREE from "three";
import { ELEMENT_BY_ID, getMaxElementLevel, getStandardFootprintForLevel } from "./game/catalog";
import { loadEraArt } from "./game/eraArtLoader";
import { ERA_LABELS, eraElementSpec, eraLevelName, normalizeEra } from "./game/eraStyles";
import type { ParcelAppearance } from "./game/parcelGeometry";
import { atlasPlots } from "./handbook/modelPlots";
import { DESIGNS } from "./game/designs/registry";
import { buildPlacedGroupFromAsset, getOrBuildElementAsset } from "./game/voxelArchitect";
import { poseDefenseDisplay } from "./game/defenseDisplay";
import { voxelNightUniform } from "./game/voxelCore";

const params = new URLSearchParams(location.search);
const statusEl = document.getElementById("status")!;

const modules = import.meta.glob("./game/designs/*.ts");

async function loadCats(cats: string[]): Promise<void> {
  for (const cat of cats) {
    if (cat === "all") {
      await import("./game/designs/index");
      continue;
    }
    const key = `./game/designs/${cat}.ts`;
    const loader = modules[key];
    if (!loader) throw new Error(`No design module ${key}`);
    await loader();
  }
}

function networkLayout(): [number, number, number][] {
  // [dx, dz, connMask]. Query param `net` picks a test layout:
  //   mix (default): 4-way, T's, corners, straights, dead ends and building driveways
  //   bridge: elevated spans over water with ramp ends, a ramped T, and a grade-separated crossing
  //   one: a single tile with `mask=<connMask>`
  // Legend: R = piece, w = piece over water, G = ground road at a different deck height (not drawn,
  // only sets connection + ramp bits), B = building (driveway bits).
  const allWater = Number(params.get("water") ?? 0) ? 4096 : 0;
  const net = params.get("net") ?? "mix";
  if (net === "one") return [[0, 0, Number(params.get("mask") ?? 5) | allWater]];
  const rows =
    net === "bridge"
      ? [".......", ".GwwwR.", "...G.R.", "GRRRRRG", "...G...", ".......", "......."]
      : [".......", "..BR...", "..RRRR.", "..BRBR.", ".RRRRR.", ".R.B...", "......."];
  const at = (x: number, z: number): string => rows[z + 3]?.[x + 3] ?? ".";
  const isNet = (ch: string) => ch === "R" || ch === "w";
  const out: [number, number, number][] = [];
  const nbs: [number, number, number][] = [
    [0, -1, 0],
    [1, 0, 1],
    [0, 1, 2],
    [-1, 0, 3],
  ];
  for (let z = -3; z <= 3; z++) {
    for (let x = -3; x <= 3; x++) {
      const ch = at(x, z);
      if (!isNet(ch)) continue;
      let mask = ch === "w" ? 4096 : allWater;
      for (const [dx, dz, k] of nbs) {
        const nb = at(x + dx, z + dz);
        if (isNet(nb)) mask |= 1 << k;
        if (nb === "G") mask |= (1 << k) | (256 << k);
        if (nb === "B") mask |= 16 << k;
      }
      out.push([x, z, mask]);
    }
  }
  return out;
}

async function main() {
  const cats = (params.get("cat") ?? "all").split(",").filter(Boolean);
  await loadCats(cats);
  let ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0) ids = Object.keys(DESIGNS);
  if (!ids.length) throw new Error("No elements registered in the selected design modules.");
  for (const id of ids) {
    if (!ELEMENT_BY_ID[id] || !DESIGNS[id]) throw new Error(`Unknown or unloaded element: ${id}`);
  }
  const eraId = params.get("era") ?? "original";
  const era = normalizeEra(eraId);
  if (era !== eraId) throw new Error(`Unknown gallery era: ${eraId}`);
  await loadEraArt(era);
  const active = params.get("active") === "1";
  const appearance: ParcelAppearance = { era, eraActivity: active ? "active" : "idle" };
  const defensePose = params.get("defensePose") ?? "idle";
  if (defensePose !== "idle" && defensePose !== "alert" && defensePose !== "training") throw new Error("Unknown defense pose");
  const poseSeconds = Number(params.get("poseSec") ?? 8);
  if (!Number.isFinite(poseSeconds) || poseSeconds < 0) throw new Error("Invalid poseSec");
  const reducedMotion = params.get("reducedMotion") === "1";
  const mode = params.get("mode") ?? "levels";
  const cell = Number(params.get("cell") ?? 260);
  const night = params.get("night") === "1";
  const azimuth = (Number(params.get("angle") ?? 45) * Math.PI) / 180;
  const waterBg = params.get("water") === "1";
  if (!Number.isSafeInteger(cell) || cell <= 0) throw new Error("Gallery cell size must be a positive integer.");
  voxelNightUniform.value = night ? 1 : 0;

  type CellSpec = { id: string; lv: number; variant: number };
  const rows: CellSpec[][] = [];
  for (const id of ids) {
    const maxLevel = getMaxElementLevel(id);
    const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);
    if (mode === "variants") {
      const requested = Number(params.get("lv") ?? 3);
      if (!Number.isInteger(requested)) throw new Error("Gallery level must be an integer.");
      const lv = Math.max(1, Math.min(maxLevel, requested));
      rows.push([0, 1, 2, 3].map((variant) => ({ id, lv, variant })));
    } else if (mode === "full") {
      for (let variant = 0; variant < 4; variant++) {
        rows.push(levels.map((lv) => ({ id, lv, variant })));
      }
    } else if (mode === "levels") {
      const variant = Number(params.get("variant") ?? 0);
      if (!Number.isInteger(variant) || variant < 0 || variant > 3) throw new Error("Gallery variant must be 0 to 3.");
      rows.push(levels.map((lv) => ({ id, lv, variant })));
    } else throw new Error(`Unknown gallery mode: ${mode}`);
  }

  const cols = Math.max(...rows.map((r) => r.length));
  const labelH = era === "original" ? 34 : 64;
  const out = document.getElementById("out") as HTMLCanvasElement;
  out.width = cols * cell;
  out.height = rows.length * (cell + labelH);
  const ctx2 = out.getContext("2d")!;
  ctx2.fillStyle = "#20242c";
  ctx2.fillRect(0, 0, out.width, out.height);

  const glCanvas = document.createElement("canvas");
  glCanvas.width = cell;
  glCanvas.height = cell;
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(cell, cell, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;

  const tileM = 4;
  for (let r = 0; r < rows.length; r++) {
    statusEl.textContent = `row ${r + 1}/${rows.length}`;
    // Build all groups in row first to get common scale
    const built = rows[r].map((spec) => {
      const def = ELEMENT_BY_ID[spec.id]!;
      const group = new THREE.Group();
      const fp = getStandardFootprintForLevel(def, spec.lv);
      if (def.isNetwork && params.get("net") !== "atlas") {
        for (const [dx, dz, mask] of networkLayout()) {
          const asset = getOrBuildElementAsset(spec.id, spec.lv, spec.variant, 1, 1, mask, appearance);
          const g = buildPlacedGroupFromAsset(asset);
          g.position.set(dx * tileM, 0, dz * tileM);
          group.add(g);
        }
      } else {
        const plots = atlasPlots(def, spec.lv, spec.variant, era, false, active);
        for (const plot of plots) {
          const asset = getOrBuildElementAsset(spec.id, spec.lv, spec.variant, ...plot.span, plot.mask, plot.appearance);
          const g = buildPlacedGroupFromAsset(asset);
          if (g.userData.defenseDisplay) poseDefenseDisplay(g.userData.defenseDisplay, defensePose, poseSeconds, reducedMotion);
          g.position.set(plot.x * tileM, 0, plot.z * tileM);
          group.add(g);
          if (plots.length === 1) group.userData.asset = asset;
        }
      }
      const box = new THREE.Box3().setFromObject(group);
      return { spec, def, group, fp, box };
    });
    let maxR = 4;
    let maxH = 2;
    for (const b of built) {
      const sz = new THREE.Vector3();
      b.box.getSize(sz);
      maxR = Math.max(maxR, Math.hypot(sz.x, sz.z) * 0.5 + 0.5, sz.y * 0.62);
      maxH = Math.max(maxH, b.box.max.y);
    }

    for (let ci = 0; ci < built.length; ci++) {
      const b = built[ci];
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(night ? 0x16203a : 0xc2e9ff);
      scene.add(new THREE.HemisphereLight(night ? 0x4060a0 : 0xf0f8ff, 0x6ea84f, night ? 0.35 : 0.85));
      const sun = new THREE.DirectionalLight(night ? 0x8090c0 : 0xfff3db, night ? 0.5 : 2.2);
      sun.position.set(40, 70, 30);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      const d = maxR * 1.6;
      Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 300 });
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0x9bd7ff, 0.42);
      fill.position.set(-40, 30, -50);
      scene.add(fill);

      // ground
      const groundSize = maxR * 6;
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(groundSize, groundSize),
        new THREE.MeshStandardMaterial({ color: waterBg ? 0x3f9fdc : 0x86c864, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = waterBg ? -0.3 : -0.01;
      ground.receiveShadow = true;
      scene.add(ground);
      const grid = new THREE.GridHelper(groundSize, Math.round(groundSize / tileM), 0x5c9a45, 0x6fae55);
      grid.position.y = 0.005;
      if (!waterBg) scene.add(grid);
      // footprint outline
      const fx = b.def.isNetwork ? 1 : b.fp[0];
      const fz = b.def.isNetwork ? 1 : b.fp[1];
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(fx * tileM, 0.02, fz * tileM)),
        new THREE.LineBasicMaterial({ color: 0xffe066 }),
      );
      outline.position.y = 0.02;
      scene.add(outline);

      b.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      scene.add(b.group);

      const aspect = 1;
      const half = maxR * 1.08;
      const cam = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.1, 2000);
      const elev = 0.62;
      const target = new THREE.Vector3(0, Math.min(maxH * 0.45, half * 0.8), 0);
      cam.position.set(
        target.x + Math.sin(azimuth) * Math.cos(elev) * 400,
        target.y + Math.sin(elev) * 400,
        target.z + Math.cos(azimuth) * Math.cos(elev) * 400,
      );
      cam.lookAt(target);
      renderer.render(scene, cam);
      const x = ci * cell;
      const y = r * (cell + labelH);
      ctx2.drawImage(glCanvas, x, y + labelH);

      // label
      const asset = b.group.userData.asset as { rotors?: unknown[]; smokePoints?: unknown[]; blinkers?: unknown[]; voxelCount?: number } | undefined;
      const eraSpec = eraElementSpec(b.spec.id, era);
      const fullName = eraLevelName(b.spec.id, b.spec.lv, era);
      const namePrefix = eraSpec?.name + " · ";
      const lvName = fullName.startsWith(namePrefix) ? fullName.slice(namePrefix.length) : fullName;
      ctx2.fillStyle = "#2c313b";
      ctx2.fillRect(x, y, cell, labelH);
      ctx2.fillStyle = "#fff";
      ctx2.font = "bold 12px system-ui";
      ctx2.fillText(`${b.spec.id} L${b.spec.lv} V${b.spec.variant}  ${fx}x${fz}`, x + 4, y + 13, cell - 8);
      ctx2.fillStyle = "#ffd76a";
      ctx2.font = "11px system-ui";
      const extras = asset
        ? `${asset.rotors?.length ? ` ⟳${asset.rotors.length}` : ""}${asset.smokePoints?.length ? ` ☁${asset.smokePoints.length}` : ""}${asset.blinkers?.length ? ` ✦${asset.blinkers.length}` : ""}`
        : "";
      const stats = `h=${b.box.max.y.toFixed(1)}m${asset?.voxelCount ? `  ${(asset.voxelCount / 1000).toFixed(1)}k vox` : ""}${extras}`;
      if (era === "original") {
        ctx2.fillText(`${lvName}  ${stats}`, x + 4, y + 28, cell - 8);
      } else {
        ctx2.fillText(lvName, x + 4, y + 28, cell - 8);
        const style = eraSpec?.variants[b.spec.variant];
        const caption = [ERA_LABELS[era], style].filter(Boolean).join(" · ");
        ctx2.fillStyle = "#fff";
        ctx2.fillText(caption, x + 4, y + 43, cell - 8);
        ctx2.fillText(stats, x + 4, y + 58, cell - 8);
      }
      ctx2.strokeStyle = "#111";
      ctx2.strokeRect(x + 0.5, y + 0.5, cell - 1, cell + labelH - 1);
      scene.remove(b.group);
      ground.geometry.dispose();
      ground.material.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      outline.geometry.dispose();
      outline.material.dispose();
      sun.shadow.dispose();
    }
    await new Promise((res) => setTimeout(res, 0));
  }
  renderer.dispose();
  statusEl.textContent = "done";
  (window as unknown as { __galleryDone: boolean }).__galleryDone = true;
}

main().catch((err) => {
  statusEl.textContent = `ERROR: ${err?.message ?? err}`;
  console.error(err);
  (window as unknown as { __galleryError: string }).__galleryError = String(err?.stack ?? err);
});
