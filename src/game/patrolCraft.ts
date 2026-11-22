/**
 * Live ambient Sky & Sea Patrol Manager for Pixel Civilization.
 *
 * - Placing Police / Medevac / Fire / SAR helipads launches animated helicopters that patrol
 *   the sky (with fire helicopters circling active fires when blazes occur).
 * - Placing & upgrading Air Force / Marine Aviation bases launches iconic aircraft flyovers:
 *   B-52 Stratofortress, B-2 Spirit Stealth Bomber, Fighter Jets, Heavy Airlifters, AWACS Radar
 *   Planes (with spinning dorsal radome), Recon Craft, and Marine Tilt-Rotors.
 * - Placing Naval / Coast Guard / Harbor Police / Marine Amphibious bases launches diverse
 *   cruising naval boats & ships across open island water.
 * - Strictly NO roaming tanks!
 */
import * as THREE from "three";
import type { GameState } from "./simulation";
import { isWaterTile } from "./simulation";
import { TILE_SIZE } from "./voxelCore";

type AirCraftKind =
  | "police_heli"
  | "medevac_heli"
  | "fire_heli"
  | "sar_heli"
  | "b52"
  | "b2"
  | "fighter"
  | "cargo"
  | "awacs"
  | "recon"
  | "tiltrotor";

type SeaCraftKind =
  | "destroyer"
  | "frigate"
  | "cutter"
  | "coast_guard"
  | "harbor_police"
  | "rescue_boat"
  | "submarine"
  | "amphib_craft";

interface ActiveAirCraft {
  key: string;
  kind: AirCraftKind;
  group: THREE.Group;
  rotors: { obj: THREE.Object3D; axis: "x" | "y" | "z"; speed: number }[];
  beacon?: THREE.Mesh;
  homeX: number;
  homeZ: number;
  orbitR: number;
  altitude: number;
  phase: number;
  speed: number;
  flyoverMode: boolean;
  /** Heading vector for straight high-altitude flyovers */
  heading: number;
  progress: number;
}

interface ActiveSeaCraft {
  key: string;
  kind: SeaCraftKind;
  group: THREE.Group;
  radar?: THREE.Object3D;
  beacon?: THREE.Mesh;
  angle: number;
  radius: number;
  speed: number;
  dir: 1 | -1;
  centerX: number;
  centerZ: number;
}

const AIR_SPAWNERS: Record<string, AirCraftKind> = {
  police_heli_pad: "police_heli",
  police_departments: "police_heli",
  swat_team_hq: "police_heli",
  riot_command_center: "police_heli",
  medevac_heli_pad: "medevac_heli",
  army_medical_corps: "medevac_heli",
  fire_heli_base: "fire_heli",
  search_rescue_hq: "sar_heli",
  strategic_bomber_wing: "b52",
  stealth_bomber_hangar: "b2",
  fighter_wing_base: "fighter",
  airforce_base: "fighter",
  airlift_cargo_base: "cargo",
  awacs_radar_base: "awacs",
  drone_recon_base: "recon",
  marine_aviation_wing: "tiltrotor",
};

const SEA_SPAWNERS: Record<string, SeaCraftKind> = {
  naval_base: "destroyer",
  naval_destroyer_dock: "destroyer",
  naval_shipyard_base: "frigate",
  naval_carrier_berth: "destroyer",
  naval_coast_guard_base: "coast_guard",
  coast_rescue_station: "rescue_boat",
  harbor_patrol_pier: "harbor_police",
  submarine_base: "submarine",
  naval_amphibious_dock: "amphib_craft",
  marine_amphib_base: "amphib_craft",
};

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, emissive = 0x000000): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.2,
    emissive,
    emissiveIntensity: emissive ? 0.85 : 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function buildHelicopterMesh(bodyCol: number, stripeCol: number, beaconCol: number): {
  group: THREE.Group;
  rotors: { obj: THREE.Object3D; axis: "x" | "y" | "z"; speed: number }[];
  beacon: THREE.Mesh;
} {
  const group = new THREE.Group();
  // Fuselage + nose cockpit + tail boom
  group.add(box(0.85, 0.62, 1.85, bodyCol, 0, 0.25, 0.1));
  group.add(box(0.76, 0.32, 0.65, 0x93c5fd, 0, 0.34, 0.82, 0x1d4ed8));
  group.add(box(0.88, 0.14, 1.5, stripeCol, 0, 0.16, 0.05));
  group.add(box(0.22, 0.24, 1.55, bodyCol, 0, 0.32, -1.35));
  group.add(box(0.14, 0.58, 0.38, stripeCol, 0, 0.55, -2.0));
  // Skids
  group.add(box(0.08, 0.08, 1.55, 0x334155, -0.45, -0.18, 0.1));
  group.add(box(0.08, 0.08, 1.55, 0x334155, 0.45, -0.18, 0.1));
  // Main rotor hub
  const mainHub = new THREE.Group();
  mainHub.position.set(0, 0.66, 0.1);
  mainHub.add(box(2.8, 0.05, 0.14, 0x1e293b));
  mainHub.add(box(0.14, 0.05, 2.8, 0x1e293b));
  group.add(mainHub);
  // Tail rotor
  const tailHub = new THREE.Group();
  tailHub.position.set(0.16, 0.56, -2.02);
  tailHub.add(box(0.04, 0.58, 0.08, 0x1e293b));
  group.add(tailHub);
  const beacon = box(0.16, 0.16, 0.16, beaconCol, 0, -0.08, 0.65, beaconCol);
  group.add(beacon);
  return {
    group,
    rotors: [
      { obj: mainHub, axis: "y", speed: 18 },
      { obj: tailHub, axis: "x", speed: 24 },
    ],
    beacon,
  };
}

function buildAirCraftMesh(kind: AirCraftKind): {
  group: THREE.Group;
  rotors: { obj: THREE.Object3D; axis: "x" | "y" | "z"; speed: number }[];
  beacon?: THREE.Mesh;
} {
  if (kind === "police_heli") return buildHelicopterMesh(0x1e3a8a, 0xffffff, 0x3b82f6);
  if (kind === "medevac_heli") return buildHelicopterMesh(0xf8fafc, 0xdc2626, 0xef4444);
  if (kind === "fire_heli") return buildHelicopterMesh(0xfacc15, 0xdc2626, 0xf97316);
  if (kind === "sar_heli") return buildHelicopterMesh(0xf97316, 0xf8fafc, 0xfacc15);

  const group = new THREE.Group();
  const rotors: { obj: THREE.Object3D; axis: "x" | "y" | "z"; speed: number }[] = [];

  if (kind === "b52") {
    // B-52 Stratofortress: slender long fuselage, wide swept wings, 4 twin-engine pods, tall tail
    group.add(box(0.55, 0.55, 4.6, 0x94a3b8, 0, 0, 0));
    group.add(box(0.45, 0.25, 0.7, 0x38bdf8, 0, 0.22, 1.7, 0x0284c7));
    for (let i = 1; i <= 6; i++) {
      const sweep = i * 0.24;
      group.add(box(0.58, 0.12, 0.72, 0xcbd5e1, -0.35 - i * 0.5, 0.1, 0.65 - sweep));
      group.add(box(0.58, 0.12, 0.72, 0xcbd5e1, 0.35 + i * 0.5, 0.1, 0.65 - sweep));
    }
    // 4 twin-engine nacelles (8 engines!)
    for (const dx of [-1.45, -2.55, 1.45, 2.55]) {
      const sw = Math.abs(dx) * 0.44;
      group.add(box(0.32, 0.22, 0.75, 0x334155, dx, -0.14, 0.62 - sw));
    }
    // High vertical tail + stabilizers
    group.add(box(0.14, 1.25, 0.85, 0x94a3b8, 0, 0.7, -1.9));
    group.add(box(1.9, 0.1, 0.45, 0x94a3b8, 0, 0.12, -2.05));
    return { group, rotors };
  }

  if (kind === "b2") {
    // B-2 Spirit Stealth Bomber: iconic charcoal sawtooth flying wing!
    for (let i = 0; i <= 6; i++) {
      const zOff = 0.85 - i * 0.34;
      const chord = i < 2 ? 1.55 : 1.05;
      group.add(box(0.62, 0.14 + (i === 0 ? 0.14 : 0), chord, 0x1e293b, -i * 0.52, 0, zOff));
      if (i > 0) group.add(box(0.62, 0.14, chord, 0x1e293b, i * 0.52, 0, zOff));
    }
    group.add(box(0.55, 0.12, 0.48, 0x475569, 0, 0.16, 1.05, 0x334155));
    // Sawtooth trailing edge notches
    group.add(box(0.7, 0.1, 0.45, 0x0f172a, 0, 0, -0.25));
    return { group, rotors };
  }

  if (kind === "fighter") {
    // Supersonic delta-wing fighter jet with glowing twin afterburners
    group.add(box(0.45, 0.34, 2.4, 0x94a3b8, 0, 0, 0));
    group.add(box(0.32, 0.22, 0.62, 0x60a5fa, 0, 0.2, 0.55, 0x1d4ed8));
    group.add(box(2.1, 0.08, 0.85, 0xcbd5e1, 0, 0, -0.25));
    group.add(box(1.3, 0.08, 0.65, 0x94a3b8, 0, 0, 0.25));
    group.add(box(0.1, 0.52, 0.55, 0x475569, -0.22, 0.28, -0.9));
    group.add(box(0.1, 0.52, 0.55, 0x475569, 0.22, 0.28, -0.9));
    group.add(box(0.16, 0.16, 0.28, 0xf97316, -0.13, 0, -1.32, 0xff6b00));
    group.add(box(0.16, 0.16, 0.28, 0xf97316, 0.13, 0, -1.32, 0xff6b00));
    return { group, rotors };
  }

  if (kind === "cargo" || kind === "awacs") {
    const col = kind === "awacs" ? 0xf1f5f9 : 0x94a3b8;
    group.add(box(0.75, 0.72, 3.6, col, 0, 0, 0));
    group.add(box(0.55, 0.28, 0.55, 0x38bdf8, 0, 0.24, 1.45, 0x0284c7));
    group.add(box(4.2, 0.14, 0.78, col, 0, 0.28, 0.1));
    for (const dx of [-1.05, -1.75, 1.05, 1.75]) {
      group.add(box(0.24, 0.24, 0.6, 0x334155, dx, 0.08, 0.28));
    }
    group.add(box(0.16, 1.15, 0.7, col, 0, 0.72, -1.55));
    group.add(box(1.65, 0.12, 0.42, col, 0, 1.25, -1.65));
    if (kind === "awacs") {
      const dish = new THREE.Group();
      dish.position.set(0, 0.76, -0.25);
      dish.add(box(1.35, 0.16, 1.35, 0xf8fafc));
      dish.add(box(1.38, 0.18, 0.28, 0x1e293b));
      group.add(dish);
      rotors.push({ obj: dish, axis: "y", speed: 3.4 });
    }
    return { group, rotors };
  }

  if (kind === "tiltrotor") {
    // Marine Osprey tilt-rotor
    group.add(box(0.65, 0.55, 2.2, 0x475569, 0, 0, 0));
    group.add(box(0.55, 0.25, 0.55, 0x60a5fa, 0, 0.16, 0.85, 0x1d4ed8));
    group.add(box(2.6, 0.14, 0.55, 0x64748b, 0, 0.24, 0.15));
    group.add(box(0.12, 0.55, 0.45, 0x475569, -0.55, 0.22, -1.0));
    group.add(box(0.12, 0.55, 0.45, 0x475569, 0.55, 0.22, -1.0));
    group.add(box(1.15, 0.1, 0.35, 0x475569, 0, 0.12, -1.0));
    for (const sx of [-1.28, 1.28]) {
      const p = new THREE.Group();
      p.position.set(sx, 0.38, 0.25);
      p.add(box(1.35, 0.05, 0.12, 0x1e293b));
      p.add(box(0.12, 0.05, 1.35, 0x1e293b));
      group.add(p);
      rotors.push({ obj: p, axis: "y", speed: sx < 0 ? 15 : -15 });
    }
    return { group, rotors };
  }

  // Recon high-altitude UAV
  group.add(box(0.32, 0.28, 1.9, 0xe2e8f0, 0, 0, 0));
  group.add(box(3.8, 0.08, 0.36, 0xf8fafc, 0, 0.08, -0.1));
  group.add(box(0.08, 0.42, 0.4, 0x0284c7, -0.18, 0.22, -0.82));
  group.add(box(0.08, 0.42, 0.4, 0x0284c7, 0.18, 0.22, -0.82));
  return { group, rotors };
}

function buildSeaCraftMesh(kind: SeaCraftKind): {
  group: THREE.Group;
  radar?: THREE.Object3D;
  beacon?: THREE.Mesh;
} {
  const group = new THREE.Group();
  if (kind === "submarine") {
    group.add(box(0.75, 0.45, 3.3, 0x1e293b, 0, 0.05, 0));
    group.add(box(0.34, 0.55, 0.85, 0x0f172a, 0, 0.46, 0.45));
    group.add(box(0.06, 0.35, 0.06, 0x94a3b8, 0, 0.85, 0.5));
    group.add(box(0.85, 0.06, 0.9, 0xe0f2fe, 0, -0.06, -1.85, 0x38bdf8));
    return { group };
  }

  const hullColor =
    kind === "coast_guard" || kind === "harbor_police"
      ? 0xf8fafc
      : kind === "rescue_boat"
        ? 0xf97316
        : kind === "amphib_craft"
          ? 0x475569
          : 0x64748b;
  const accent =
    kind === "coast_guard" || kind === "rescue_boat"
      ? 0xf97316
      : kind === "harbor_police"
        ? 0x2563eb
        : 0x334155;
  const len = kind === "destroyer" ? 3.8 : kind === "frigate" ? 3.2 : kind === "amphib_craft" ? 2.6 : 2.1;
  const beam = kind === "amphib_craft" ? 1.15 : kind === "destroyer" ? 0.95 : 0.78;

  group.add(box(beam, 0.42, len, hullColor, 0, 0.16, 0));
  group.add(box(beam * 0.7, 0.36, len * 0.25, hullColor, 0, 0.18, len * 0.52));
  group.add(box(beam + 0.04, 0.14, len * 0.4, accent, 0, 0.24, len * 0.12));
  // Bridge deckhouse
  group.add(box(beam * 0.72, 0.56, len * 0.34, hullColor, 0, 0.62, -len * 0.05));
  group.add(box(beam * 0.74, 0.16, len * 0.16, 0x93c5fd, 0, 0.72, len * 0.06, 0x1d4ed8));
  // Foam wake
  group.add(box(beam * 0.85, 0.05, 0.8, 0xf0f9ff, 0, 0.01, -len * 0.65));

  const radarBar = box(0.65, 0.08, 0.1, 0xf8fafc, 0, 1.05, -len * 0.05);
  group.add(radarBar);
  const beaconCol = kind === "harbor_police" ? 0x3b82f6 : kind === "rescue_boat" || kind === "coast_guard" ? 0xf97316 : 0xef4444;
  const beacon = box(0.14, 0.14, 0.14, beaconCol, 0, 1.18, -len * 0.05, beaconCol);
  group.add(beacon);

  return { group, radar: radarBar, beacon };
}

export class PatrolCraftManager {
  public readonly root = new THREE.Group();
  private air = new Map<string, ActiveAirCraft>();
  private sea = new Map<string, ActiveSeaCraft>();
  private syncTimer = 0;

  constructor() {
    this.root.name = "PatrolCraftManager";
  }

  public sync(state: GameState): void {
    const wantedAir = new Map<string, { kind: AirCraftKind; x: number; z: number; lv: number }>();
    const wantedSea = new Map<string, { kind: SeaCraftKind; x: number; z: number; lv: number }>();

    for (const el of state.elements) {
      if (el.disrepair || el.onFire) continue;
      const airKind = AIR_SPAWNERS[el.defId];
      if (airKind) {
        // Upgraded Air Force / Heli bases spawn up to 2 aircraft (capped globally for smooth FPS)
        const count = el.level >= 4 && wantedAir.size < 16 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          if (wantedAir.size >= 18) break;
          wantedAir.set(`${el.id}:a${i}`, {
            kind: airKind,
            x: (el.gx + el.spanX * 0.5) * TILE_SIZE,
            z: (el.gz + el.spanZ * 0.5) * TILE_SIZE,
            lv: el.level,
          });
        }
      }
      const seaKind = SEA_SPAWNERS[el.defId];
      if (seaKind) {
        const count = el.level >= 3 && wantedSea.size < 14 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          if (wantedSea.size >= 16) break;
          wantedSea.set(`${el.id}:s${i}`, {
            kind: seaKind,
            x: (el.gx + el.spanX * 0.5) * TILE_SIZE,
            z: (el.gz + el.spanZ * 0.5) * TILE_SIZE,
            lv: el.level,
          });
        }
      }
    }

    // Remove obsolete air craft
    for (const [key, item] of this.air) {
      if (!wantedAir.has(key)) {
        this.disposeGroup(item.group);
        this.root.remove(item.group);
        this.air.delete(key);
      }
    }
    // Add new air craft
    let idx = 0;
    for (const [key, info] of wantedAir) {
      idx++;
      if (this.air.has(key)) continue;
      const built = buildAirCraftMesh(info.kind);
      const isJetOrBomber =
        info.kind === "b52" ||
        info.kind === "b2" ||
        info.kind === "fighter" ||
        info.kind === "cargo" ||
        info.kind === "awacs" ||
        info.kind === "recon";
      const craft: ActiveAirCraft = {
        key,
        kind: info.kind,
        group: built.group,
        rotors: built.rotors,
        beacon: built.beacon,
        homeX: info.x,
        homeZ: info.z,
        orbitR: isJetOrBomber ? 38 + (idx % 4) * 14 : 18 + (idx % 4) * 9,
        altitude: isJetOrBomber ? 22 + (idx % 5) * 3.2 : 11.5 + (idx % 3) * 2.1,
        phase: idx * 1.37,
        speed:
          info.kind === "fighter"
            ? 0.46
            : info.kind === "b52" || info.kind === "b2" || info.kind === "cargo"
              ? 0.24
              : 0.34,
        flyoverMode: info.kind === "b52" || info.kind === "b2" || info.kind === "fighter" || info.kind === "cargo",
        heading: (idx * 0.9) % (Math.PI * 2),
        progress: (idx * 0.23) % 1,
      };
      this.root.add(craft.group);
      this.air.set(key, craft);
    }

    // Remove obsolete sea craft
    for (const [key, item] of this.sea) {
      if (!wantedSea.has(key)) {
        this.disposeGroup(item.group);
        this.root.remove(item.group);
        this.sea.delete(key);
      }
    }
    // Add new sea craft cruising open water around the island perimeter
    let sIdx = 0;
    for (const [key, info] of wantedSea) {
      sIdx++;
      if (this.sea.has(key)) continue;
      const built = buildSeaCraftMesh(info.kind);
      const angle = Math.atan2(info.z, info.x) + (sIdx % 2 === 0 ? 0.18 : -0.18);
      const radius = 128 + (sIdx % 5) * 11;
      const craft: ActiveSeaCraft = {
        key,
        kind: info.kind,
        group: built.group,
        radar: built.radar,
        beacon: built.beacon,
        angle,
        radius,
        speed: info.kind === "harbor_police" || info.kind === "rescue_boat" ? 0.085 : info.kind === "submarine" ? 0.042 : 0.055,
        dir: sIdx % 2 === 0 ? 1 : -1,
        centerX: 0,
        centerZ: 0,
      };
      this.root.add(craft.group);
      this.sea.set(key, craft);
    }
  }

  public update(state: GameState, dt: number, elapsed: number): void {
    this.syncTimer += dt;
    if (this.syncTimer >= 1.5) {
      this.syncTimer = 0;
      this.sync(state);
    }
    const mult = Math.max(0.2, state.playSpeed ?? 1);
    const step = dt * mult;

    // Locate an active fire so fire helicopters circle right over emergencies!
    const activeFire = state.elements.find((e) => e.onFire);
    const fireX = activeFire ? (activeFire.gx + activeFire.spanX * 0.5) * TILE_SIZE : null;
    const fireZ = activeFire ? (activeFire.gz + activeFire.spanZ * 0.5) * TILE_SIZE : null;

    for (const a of this.air.values()) {
      for (const r of a.rotors) {
        r.obj.rotation[r.axis] += dt * r.speed;
      }
      if (a.beacon) {
        a.beacon.visible = Math.sin(elapsed * 8 + a.phase) > 0;
      }

      if (a.flyoverMode) {
        // Sweeping cross-island high-altitude flyover passes
        a.progress += step * a.speed * 0.14;
        if (a.progress >= 1.35) {
          a.progress = -0.35;
          a.heading = (a.heading + 1.15) % (Math.PI * 2);
        }
        const span = 185;
        const t = a.progress * 2 - 1; // -1.7 .. 1.7
        const dx = Math.sin(a.heading);
        const dz = Math.cos(a.heading);
        const offset = ((a.phase * 19) % 56) - 28;
        const px = dx * t * span + dz * offset;
        const pz = dz * t * span - dx * offset;
        a.group.position.set(px, a.altitude + Math.sin(elapsed * 1.4 + a.phase) * 0.45, pz);
        a.group.rotation.set(0, a.heading, Math.sin(elapsed * 0.9 + a.phase) * 0.08);
        a.group.visible = Math.abs(px) < 220 && Math.abs(pz) < 220;
      } else {
        // Patrol orbit (fire helis divert straight over active fires!)
        a.phase += step * a.speed;
        const cx = a.kind === "fire_heli" && fireX !== null ? fireX : a.homeX * 0.45;
        const cz = a.kind === "fire_heli" && fireZ !== null ? fireZ : a.homeZ * 0.45;
        const rad = a.kind === "fire_heli" && fireX !== null ? 9.5 : a.orbitR;
        const nx = cx + Math.cos(a.phase) * rad;
        const nz = cz + Math.sin(a.phase * 0.85) * rad;
        const vx = -Math.sin(a.phase) * rad;
        const vz = Math.cos(a.phase * 0.85) * rad * 0.85;
        a.group.position.set(nx, a.altitude + Math.sin(elapsed * 2.2 + a.phase) * 0.35, nz);
        a.group.rotation.set(0.06, Math.atan2(vx, vz), -0.14);
        a.group.visible = true;
      }
    }

    for (const s of this.sea.values()) {
      s.angle += step * s.speed * s.dir;
      let r = s.radius;
      let x = s.centerX + Math.cos(s.angle) * r;
      let z = s.centerZ + Math.sin(s.angle) * r;
      // Nudge slightly seaward if a peninsula reaches this tile so ships never clip land
      const gx = Math.round(x / TILE_SIZE);
      const gz = Math.round(z / TILE_SIZE);
      if (!isWaterTile(state.elements, gx, gz, state)) {
        r += 18;
        x = s.centerX + Math.cos(s.angle) * r;
        z = s.centerZ + Math.sin(s.angle) * r;
      }
      const tx = -Math.sin(s.angle) * s.dir;
      const tz = Math.cos(s.angle) * s.dir;
      const bob = Math.sin(elapsed * 2.1 + s.angle * 3) * 0.09;
      s.group.position.set(x, -0.32 + bob, z);
      s.group.rotation.set(Math.sin(elapsed * 1.7 + s.angle) * 0.03, Math.atan2(tx, tz), Math.cos(elapsed * 1.9 + s.angle) * 0.04);
      if (s.radar) s.radar.rotation.y += dt * 2.8;
      if (s.beacon) s.beacon.visible = Math.sin(elapsed * 6 + s.angle) > 0;
    }
  }

  private disposeGroup(grp: THREE.Group): void {
    grp.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }

  public dispose(): void {
    for (const a of this.air.values()) {
      this.disposeGroup(a.group);
      this.root.remove(a.group);
    }
    for (const s of this.sea.values()) {
      this.disposeGroup(s.group);
      this.root.remove(s.group);
    }
    this.air.clear();
    this.sea.clear();
  }
}
