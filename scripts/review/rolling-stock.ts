// Dev sheet: every locomotive and car on the 0.25 m world grid, empty and loaded, on a strip of real track.
// Open http://localhost:5199/scripts/review/rolling-stock.html (Vite) — used by the trains round-2 work.
import * as THREE from "three";
import { buildRailModel, ROLLING_STOCK } from "../../src/game/railModels";
import { getPixelVoxelMaterial, TILE_SIZE } from "../../src/game/voxelCore";
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#cfe0d4");
scene.add(new THREE.HemisphereLight("#ffffff", "#7a8a70", 1.6));
const sun = new THREE.DirectionalLight("#fff3dd", 2.2);
sun.position.set(-20, 40, 30);
scene.add(sun);
const params = new URLSearchParams(location.search);
const colour = params.get("colour") ?? "#2f7fc1";
const rows: string[][] = [
  ["steam", "coach", "observation", "sleeper"],
  ["diesel", "hopper/full", "gondola/full", "box", "flat/full"],
  ["commuter", "coach", "coach"],
  ["electric", "tanker", "container/full", "reefer", "livestock/full", "waste/full"],
  ["express", "coach", "coach"],
  ["hopper", "gondola/partial", "container/partial", "flat"],
];
const group = new THREE.Group();
scene.add(group);
rows.forEach((row, r) => {
  let z = 0;
  const x = r * TILE_SIZE * 0.9;
  const track = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 40), new THREE.MeshLambertMaterial({ color: "#8b8172" }));
  track.position.set(x, -0.06, 16);
  group.add(track);
  for (const rx of [-0.62, 0.62]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 40), new THREE.MeshLambertMaterial({ color: "#59616a" }));
    rail.position.set(x + rx, 0.05, 16);
    group.add(rail);
  }
  for (const kind of row) {
    const base = kind.split("/")[0];
    const len = { steam: 15, diesel: 14, commuter: 14, electric: 14, express: 17, sleeper: 13, container: 13, coach: 12, observation: 12, reefer: 12, flat: 12, waste: 10 }[base] ?? 11;
    const m = new THREE.Mesh(buildRailModel(kind + "/" + colour), getPixelVoxelMaterial());
    m.position.set(x, 0.1, 36 - z - (len * 0.25) / 2);
    group.add(m);
    z += len * 0.25 + 0.25;
  }
});
void ROLLING_STOCK;
const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 500);
const zoom = Number(params.get("zoom") ?? 46);
cam.zoom = zoom;
cam.position.set(42, 30, 56);
cam.lookAt(9, 0, 31);
cam.updateProjectionMatrix();
renderer.render(scene, cam);
(window as unknown as { ready: boolean }).ready = true;
