import * as THREE from "three";
import { EngineeringView } from "../game/engineeringView";
import { normalizeEra } from "../game/eraStyles";
import { voxelNightUniform } from "../game/voxelCore";
import { BRIDGE_STUDIES, catalogBridgeStudies, pitchedBridge } from "./bridgeRunFixtures";

/** The terrain, running deck, tower geometry and moving weights here all come from
 * the same engineering renderer as the game. Only the camera and distant banks
 * are staged, at fixed locations so art revisions can be photographed identically. */
export async function drawBridgeStudies(params: URLSearchParams, out: HTMLCanvasElement) {
  const set = params.get("set") ?? "lengths";
  const studies = set === "catalog" ? catalogBridgeStudies(params.get("id") ?? "bridges", params.get("variant")) : BRIDGE_STUDIES[set];
  if (!studies) throw new Error("Unknown bridge gallery set: " + set);
  const eraParam = params.get("era") ?? "original";
  const era = normalizeEra(eraParam);
  if (era !== eraParam) throw new Error("Unknown bridge gallery era: " + eraParam);
  const night = params.get("night") === "1";
  const angle = params.has("angle") ? Number(params.get("angle")) * Math.PI / 180 : Math.atan2(31, 83);
  voxelNightUniform.value = night ? 1 : 0;
  const matrix = set === "catalog" && params.get("variant") === "all";
  const width = matrix ? 310 : 570, height = matrix ? 150 : 276, caption = matrix ? 29 : 36;
  const cols = matrix ? studies.length / 4 : 2;
  const rows = Math.ceil(studies.length / cols);
  out.width = width * cols;
  out.height = rows * (height + caption);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#20242c";
  ctx.fillRect(0, 0, out.width, out.height);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  try {
    let catalogFixture: ReturnType<typeof pitchedBridge> | undefined;
    for (const [i, study] of studies.entries()) {
      if (study.catalogId && (!catalogFixture || studies[i - 1]?.variant !== study.variant)) {
        catalogFixture = pitchedBridge(study);
      }
      const fixture = catalogFixture ?? pitchedBridge(study);
      fixture.upgradeTo(study.tier);
      const { state, left, right } = fixture;
      const view = new EngineeringView();
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(night ? 0x28364E : 0xc3e3f1);
      const light = new THREE.DirectionalLight(night ? 0xB1C1E2 : 0xffe7ba, night ? 0.64 : 2.3);
      light.position.set(40, 60, 24);
      scene.add(view.group, light, new THREE.HemisphereLight(night ? 0x8B9FC8 : 0xf6f4eb, 0x8ca696, night ? 0.38 : 1.8));
      const alongX = study.axis === "x";
      const grass = new THREE.MeshLambertMaterial({ color: 0x9ab975 });
      const river = new THREE.MeshLambertMaterial({ color: 0x398D91 });
      const scenery: THREE.BoxGeometry[] = [];
      const horizon = (lo: number, hi: number, near: number, far: number, top: number, material: THREE.Material) => {
        const geo = new THREE.BoxGeometry(alongX ? hi - lo : far - near, 5, alongX ? far - near : hi - lo);
        const mesh = new THREE.Mesh(geo, material);
        const u = (lo + hi) / 2, v = (near + far) / 2;
        mesh.position.set(alongX ? u : v, top - 2.5, alongX ? v : u);
        scenery.push(geo);
        scene.add(mesh);
      };
      try {
        view.sync(state, era);
        view.animate(state, 0);
        // Extend the canal into the distance and avoid coplanar grass on the raised bank.
        const shoreA = left * 4, shoreB = (right + 1) * 4;
        horizon(shoreA - 100, shoreA, -100, 100, -0.06, grass);
        horizon(shoreB, shoreB + 100, -100, 100, 1.44, grass);
        horizon(shoreA, shoreB, -100, -8, -0.30, river);
        horizon(shoreA, shoreB, 12, 100, -0.30, river);
        const mid = (left + right) * 2 + 2;
        const target = new THREE.Vector3(alongX ? mid : 2, study.shape === "lift" ? 8.0 : study.catalogId ? 6.25 : 5.4, alongX ? 2 : mid);
        const half = Math.max(study.shape === "lift" ? 12 : 9.3, (study.length + 4) * 2.35 * height / width);
        const reach = half * width / height;
        const camera = new THREE.OrthographicCamera(-reach, reach, half, -half, 0.1, 900);
        const u = Math.sin(angle) * Math.hypot(31, 83), v = Math.cos(angle) * Math.hypot(31, 83);
        camera.position.copy(target).add(alongX ? new THREE.Vector3(u, 37, v) : new THREE.Vector3(v, 37, -u));
        camera.lookAt(target);
        renderer.render(scene, camera);
        const x = i % cols * width, y = Math.floor(i / cols) * (height + caption);
        ctx.drawImage(renderer.domElement, x, y);
        ctx.fillStyle = "#f5f2e9";
        ctx.font = "bold 15px system-ui";
        ctx.fillText(study.label, x + 10, y + height + 23);
        ctx.textAlign = "right";
        ctx.font = "13px system-ui";
        ctx.fillText(study.length + (study.length === 1 ? " span" : " spans") + " · Level " + study.tier, x + width - 10, y + height + 23);
        ctx.textAlign = "left";
      } finally {
        view.dispose();
        for (const geo of scenery) geo.dispose();
        grass.dispose();
        river.dispose();
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  } finally {
    renderer.dispose();
  }
}
