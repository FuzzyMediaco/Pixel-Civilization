import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  type CivElementDef,
  ELEMENT_BY_ID,
  getStandardFootprintForLevel,
} from "./catalog";
import {
  GRID_MAX,
  GRID_MIN,
  type GameState,
  type HeatmapKind,
  type PlacedElement,
  type SelectionFilter,
  canMergePair,
  checkPlacementValid,
  planNetworkPlacement,
  computeHeatmapCells,
  getConnectedRailCoordSet,
  getConnectedRoadCoordSet,
  getTrafficLoadMap,
  PEDESTRIAN_IDS,
  getNetworkConnMask,
  gridToWorldCenter,
  islandMarginAtWorld,
  matchesSelectionFilter,
  worldToGrid,
} from "./simulation";
import { buildPlacedGroupFromAsset, getOrBuildElementAsset } from "./voxelArchitect";
import {
  PixelVox,
  TILE_SIZE,
  PALETTE,
  VOXEL_SIZE,
  buildVoxelGeometry,
  getDimmedVoxelMaterial,
  getPixelVoxelMaterial,
  voxelNightUniform,
} from "./voxelCore";

export type CameraMode = "pan" | "orbit" | "walk";

export interface BuildBrush {
  kind: "place" | "move" | "none";
  defId?: string;
  level: number;
  /** -1 means random variant on each placement (default in Real/Survival, optional in God) */
  variantMode: number;
  rotation: number;
  movingElementId?: string;
}

export interface WorldCallbacks {
  onTilePlace: (gx: number, gz: number) => void;
  onTileMoveCommit: (elementId: string, gx: number, gz: number) => void;
  onSelectElement: (elementId: string | null, additiveShift: boolean) => void;
  onHoverInfo?: (info: { gx: number; gz: number; valid: boolean; reason?: string } | null) => void;
}

type RoadVehicleKind =
  | "sedan"
  | "sports_car"
  | "truck"
  | "military_truck"
  | "cybertruck"
  | "mini_cooper"
  | "bus"
  | "taxi";

interface TrafficAgent {
  kind: RoadVehicleKind | "train";
  isRail: boolean;
  mesh: THREE.Group;
  gx: number;
  gz: number;
  nextGx: number;
  nextGz: number;
  dirX: number;
  dirZ: number;
  facingAngle: number;
  progress: number;
  speed: number;
  laneOffset: number;
}

interface VillagerAgent {
  root: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  gx: number;
  gz: number;
  nextGx: number;
  nextGz: number;
  dirX: number;
  dirZ: number;
  facingAngle: number;
  progress: number;
  speed: number;
  sidewalkOffset: number;
  phase: number;
}

interface VoxelParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  gravity: number;
}

const vehicleGeoCache = new Map<string, THREE.BufferGeometry>();

function getVehicleGeometry(kind: RoadVehicleKind | "train", variantSeed: number): THREE.BufferGeometry {
  const key = `${kind}_${variantSeed % 4}`;
  const cached = vehicleGeoCache.get(key);
  if (cached) return cached;

  const v = new PixelVox(500 + variantSeed * 17);
  const paintSet = ["red", "blue", "teal", "orange", "purple", "lime", "white", "sky"];
  const paint = paintSet[variantSeed % paintSet.length];

  switch (kind) {
    case "sports_car": {
      const spCol = ["red", "yellow", "cyan", "orange"][variantSeed % 4];
      v.box(-2, 0, -4, 2, 2, 4, spCol);
      v.box(-2, 2, -1, 2, 3, 2, "glass", 0.25);
      v.box(-2, 2, -4, 2, 3, -3, spCol); // spoiler
      break;
    }
    case "cybertruck": {
      v.box(-2, 0, -4, 2, 2, 4, "silver");
      v.box(-2, 2, -2, 2, 3, 2, "steelLight");
      v.put(-1, 2, 2, "screenCyan", 0.8);
      v.put(1, 2, 2, "screenCyan", 0.8);
      break;
    }
    case "mini_cooper": {
      const mCol = ["red", "blue", "teal", "crimson"][variantSeed % 4];
      v.box(-2, 0, -3, 2, 2, 3, mCol);
      v.box(-2, 2, -2, 2, 3, 2, "white"); // iconic white roof!
      break;
    }
    case "military_truck": {
      v.box(-2, 0, -5, 2, 3, 5, "oliveDrab");
      v.box(-2, 3, -5, 2, 5, 1, "camoTan");
      v.box(-2, 3, 1, 2, 5, 4, "oliveDrab");
      break;
    }
    case "truck": {
      v.box(-2, 0, -5, 2, 3, 5, "steel");
      v.box(-2, 2, -5, 2, 5, 1, "white");
      v.box(-2, 2, 1, 2, 4, 5, paint);
      break;
    }
    case "bus": {
      const bCol = variantSeed % 2 === 0 ? "busYellow" : "blue";
      v.box(-2, 0, -6, 2, 4, 6, bCol);
      v.box(-2, 2, -5, 2, 3, 5, "glass", 0.35);
      v.box(-2, 4, -6, 2, 5, 6, "white");
      break;
    }
    case "taxi": {
      v.box(-2, 0, -4, 2, 2, 4, "busYellow");
      v.box(-2, 2, -2, 2, 3, 2, "busYellow");
      v.put(0, 3, 0, "warmGlow", 0.9); // taxi roof light
      break;
    }
    case "train": {
      const tCol = variantSeed % 2 === 0 ? "crimson" : "blueDark";
      v.box(-3, 0, -7, 3, 4, 7, tCol);
      v.box(-3, 2, -6, 3, 3, 6, "glass", 0.45);
      v.box(-2, 4, -7, 2, 5, 7, "silver");
      v.put(0, 2, 7, "warmGlow", 1.2);
      break;
    }
    default: {
      // sedan
      v.box(-2, 0, -4, 2, 2, 4, paint);
      v.box(-2, 2, -2, 2, 3, 2, paint);
      v.box(-2, 2, 1, 2, 3, 2, "glass", 0.25);
      break;
    }
  }

  // Wheels
  const wz = kind === "train" ? 5 : kind === "bus" || kind === "truck" ? 4 : 3;
  v.put(-2, 0, -wz + 1, "rubber");
  v.put(1, 0, -wz + 1, "rubber");
  v.put(-2, 0, wz - 1, "rubber");
  v.put(1, 0, wz - 1, "rubber");

  const geo = buildVoxelGeometry(v, 0.13);
  vehicleGeoCache.set(key, geo);
  return geo;
}

interface PlacedRenderEntry {
  key: string;
  group: THREE.Group;
  wx: number;
  baseY: number;
  wz: number;
  spanX: number;
  spanZ: number;
  topY: number;
  accentHex: string;
  isBuilding: boolean;
  lastLevel: number;
  disrepairBadge?: THREE.Mesh;
  disconnectBadge?: THREE.Mesh;
}

export class PixelWorldRenderer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl = false;
  private disposed = false;

  private callbacks: WorldCallbacks;
  private gameState: GameState;
  private brush: BuildBrush = { kind: "none", level: 1, variantMode: -1, rotation: 0 };
  private selectedIds: string[] = [];

  // Camera state
  private cameraMode: CameraMode = "pan";
  private target = new THREE.Vector3(0, 0, 0);
  private spherical = { radius: 68, theta: Math.PI * 0.25, phi: 0.88 };
  private walkPos = new THREE.Vector3(0, 2.3, 18);
  private walkYaw = Math.PI;
  private walkPitch = -0.12;
  private keysDown = new Set<string>();

  // Scene groups & lighting
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private bounceLight!: THREE.DirectionalLight;
  private skyBgColor = new THREE.Color(0xc2e9ff);
  private fogColor = new THREE.Color(0xd7f0ff);

  private islandGroup = new THREE.Group();
  private placedGroup = new THREE.Group();
  private overlayGroup = new THREE.Group();
  private heatmapGroup = new THREE.Group();
  private trafficGroup = new THREE.Group();
  private villagerGroup = new THREE.Group();
  private crimeGroup = new THREE.Group();
  private attackGroup = new THREE.Group();
  private weatherGroup = new THREE.Group();
  private fxGroup = new THREE.Group();

  private oceanUniforms = { uTime: { value: 0 } };
  private placedEntries = new Map<string, PlacedRenderEntry>();
  private activeHeatmap: HeatmapKind = "none";
  private selectionFilter: SelectionFilter = "all";
  private heatmapKey = "";
  private autoSpin360 = false;

  // Clouds & Rain
  private cloudMeshes: THREE.Group[] = [];
  private rainDrops: THREE.Mesh[] = [];
  private lightningFlash = 0;
  private lightningCooldown = 6;
  private shockwaveRings: { mesh: THREE.Mesh; life: number; maxLife: number; maxScale: number }[] = [];

  // Shared crime & police materials (reused across all incidents to prevent GPU memory leaks)
  private crimeDarkMat = new THREE.MeshLambertMaterial({ color: 0x181a20 });
  private crimeStripeMat = new THREE.MeshLambertMaterial({ color: 0xd1d5db });
  private crimeSkinMat = new THREE.MeshLambertMaterial({ color: 0xf5cfa8 });
  private crimeLootMat = new THREE.MeshLambertMaterial({ color: 0xd4a366 });
  private crimeCrowbarMat = new THREE.MeshLambertMaterial({ color: 0x9ca3af });
  private crimeAlertMat = new THREE.MeshBasicMaterial({ color: 0xd946ef });
  private copBlackMat = new THREE.MeshLambertMaterial({ color: 0x181a20 });
  private copWhiteMat = new THREE.MeshLambertMaterial({ color: 0xfcfaf5 });
  private copNavyMat = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });
  private copCapMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
  private copGoldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  private copHeadlightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  private sirenRedMat = new THREE.MeshBasicMaterial({ color: 0xff2a3c });
  private sirenBlueMat = new THREE.MeshBasicMaterial({ color: 0x2a7bff });

  // Crime & Police Car Render Maps
  private crimeVisuals = new Map<
    string,
    {
      burglar: {
        root: THREE.Group;
        leftLeg: THREE.Mesh;
        rightLeg: THREE.Mesh;
        leftArm: THREE.Mesh;
        rightArm: THREE.Mesh;
        lootBag: THREE.Mesh;
        alertMesh: THREE.Mesh;
        crowbar: THREE.Mesh;
      };
      copCar: THREE.Group | null;
      sirenRed: THREE.Mesh | null;
      sirenBlue: THREE.Mesh | null;
      headlightL: THREE.Mesh | null;
      headlightR: THREE.Mesh | null;
      copOfficer: {
        root: THREE.Group;
        leftLeg: THREE.Mesh;
        rightLeg: THREE.Mesh;
        leftArm: THREE.Mesh;
        rightArm: THREE.Mesh;
      } | null;
      roadPath: [number, number][];
      copAngle: number;
      officerAngle: number;
      sparkAccum: number;
      captureBurstDone: boolean;
    }
  >();

  // Attack & Defender Unit Render Maps
  private attackVisuals = new Map<string, THREE.Group>();
  private defenderVisuals = new Map<
    string,
    { grp: THREE.Group; sirenA?: THREE.Mesh; sirenB?: THREE.Mesh; kind: string }
  >();
  private attackBoltAccum = 0;
  private defenderBoltAccum = 0;

  // Hover & Ghost
  private pointerNdc = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hoverGrid: [number, number] | null = null;
  private ghostGroup: THREE.Group | null = null;
  private ghostKey = "";
  private cursorOutline: THREE.LineSegments;
  private selectionOutlines: THREE.LineSegments[] = [];
  private mergeBridgeLine: THREE.Line | null = null;
  private radiusRingMesh: THREE.Mesh | null = null;

  // Shared badge & particle geometries
  private unitCubeGeo = new THREE.BoxGeometry(1, 1, 1);
  private wrenchMat = new THREE.MeshStandardMaterial({
    color: 0xffb642,
    emissive: 0xff8c1a,
    emissiveIntensity: 0.55,
    roughness: 0.4,
  });
  private disconnectMat = new THREE.MeshStandardMaterial({
    color: 0xdf5246,
    emissive: 0xa8342b,
    emissiveIntensity: 0.45,
    roughness: 0.5,
  });

  // Autonomous traffic, villagers & voxel FX
  private trafficAgents: TrafficAgent[] = [];
  private villagerAgents: VillagerAgent[] = [];
  private particles: VoxelParticle[] = [];
  private trafficSyncAccum = 0;
  // Cached network sets (recomputed only when the layout changes, not every frame)
  private netCacheKey = "";
  private cachedRoadSet = new Set<string>();
  private cachedRailSet = new Set<string>();
  private cachedCarSet = new Set<string>();
  // Pooled smoke / steam particles & blinking beacons
  private smokeMesh: THREE.InstancedMesh | null = null;
  private smokeParts: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; kind: number }[] = [];
  private smokeEmitters: { entryId: string; local: THREE.Vector3; kind: number; acc: number }[] = [];
  private blinkMesh: THREE.InstancedMesh | null = null;
  private blinkPhases: number[] = [];
  private blinkKey = "";
  private fireEmitAccum = 0;

  // Pointer & pinch-zoom interaction state
  private isPointerDown = false;
  private pointerButton = 0;
  private pointerDownPos = { x: 0, y: 0 };
  private lastPointerPos = { x: 0, y: 0 };
  private isDraggingCamera = false;
  private paintedTilesInStroke = new Set<string>();
  private lastPaintedGrid: [number, number] | null = null;
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist: number | null = null;
  private lastPinchAngle: number | null = null;
  private lastPinchMid: { x: number; y: number } | null = null;
  private hadMultiTouch = false;

  private clock = new THREE.Clock();
  private fencePixel = new Uint8Array(4);

  constructor(canvas: HTMLCanvasElement, initialState: GameState, callbacks: WorldCallbacks) {
    this.canvas = canvas;
    this.gameState = initialState;
    this.callbacks = callbacks;

    // 1. Probe WebGL renderer to adapt gracefully on software GL
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });

    const gl = this.renderer.getContext();
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererName = String(
      dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    this.isSoftwareGl = /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(rendererName);

    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Scene, Sky & Environment
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc2e9ff);
    this.scene.fog = new THREE.FogExp2(0xd7f0ff, 0.0021);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    roomEnv.dispose();
    pmrem.dispose();

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.5, 900);
    this.updateCameraTransform();

    // 4. Sunlit GeminIsland Lighting (modulated live by Day/Night & Weather)
    this.hemiLight = new THREE.HemisphereLight(0xf0f8ff, 0x6ea84f, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3db, 2.25);
    this.sunLight.position.set(88, 128, 72);
    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
      const d = 135;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.camera.near = 15;
      this.sunLight.shadow.camera.far = 340;
      this.sunLight.shadow.bias = -0.0005;
    }
    this.scene.add(this.sunLight);

    this.bounceLight = new THREE.DirectionalLight(0x9bd7ff, 0.42);
    this.bounceLight.position.set(-70, 48, -80);
    this.scene.add(this.bounceLight);

    // 5. Build Terrain + Ocean + Weather + Scene Hierarchy
    this.buildIslandAndOcean();
    this.buildWeatherVisuals();
    this.scene.add(this.islandGroup);
    this.scene.add(this.heatmapGroup);
    this.scene.add(this.placedGroup);
    this.scene.add(this.overlayGroup);
    this.scene.add(this.trafficGroup);
    this.scene.add(this.villagerGroup);
    this.scene.add(this.crimeGroup);
    this.scene.add(this.attackGroup);
    this.scene.add(this.weatherGroup);
    this.scene.add(this.fxGroup);

    // Cursor outline
    const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.cursorOutline = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
    );
    this.cursorOutline.visible = false;
    this.overlayGroup.add(this.cursorOutline);

    this.bindEvents();
    this.syncState(initialState, []);
    this.scheduleNextFrame();
  }

  private buildIslandAndOcean(): void {
    // Sculpted pixel-stepped island mesh covering [-165..165]m
    const segs = this.isSoftwareGl ? 96 : 144;
    const size = 320;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const cTmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const margin = islandMarginAtWorld(x, z);

      let y = 0;
      if (margin >= 2.0) {
        y = 0;
      } else if (margin >= -7.0) {
        // Gentle pixel-stepped sandy beach slope down to ocean
        const t = (2.0 - margin) / 9.0;
        const rawY = -t * 1.45;
        y = Math.round(rawY / 0.25) * 0.25;
      } else {
        const deep = Math.min(1, (-7.0 - margin) / 26.0);
        y = -1.45 - Math.round(deep * 12) * 0.45;
      }
      pos.setY(i, y);

      // Crisp pixel-checkerboard grass & warm beach sand colors
      const gx = Math.floor(x / (TILE_SIZE * 0.5));
      const gz = Math.floor(z / (TILE_SIZE * 0.5));
      const checker = (gx + gz) & 1;

      if (margin >= 2.2) {
        cTmp.setHex(checker ? 0x83c85f : 0x79be56);
      } else if (margin >= -2.5) {
        cTmp.setHex(checker ? 0xedd69f : 0xe2c78c);
      } else {
        cTmp.setHex(0xc8b282);
      }
      colors[i * 3] = cTmp.r;
      colors[i * 3 + 1] = cTmp.g;
      colors[i * 3 + 2] = cTmp.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const landMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: true, // Extra crisp pixel-terraced coastal steps!
    });

    const landMesh = new THREE.Mesh(geo, landMat);
    landMesh.receiveShadow = !this.isSoftwareGl;
    this.islandGroup.add(landMesh);

    // Subtle build-grid lines across the flat plateau so tile alignment is effortless
    const gridHelper = new THREE.GridHelper(64 * TILE_SIZE, 64, 0xffffff, 0xffffff);
    gridHelper.position.y = 0.018;
    const gMat = gridHelper.material as THREE.Material;
    gMat.transparent = true;
    gMat.opacity = 0.09;
    gMat.depthWrite = false;
    this.islandGroup.add(gridHelper);

    // Sunlit pixel-quantized turquoise ocean plane with lapping white foam
    const oceanGeo = new THREE.PlaneGeometry(1400, 1400, 1, 1);
    oceanGeo.rotateX(-Math.PI / 2);

    const oceanMat = new THREE.ShaderMaterial({
      uniforms: this.oceanUniforms,
      transparent: true,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vWorldPos;

        float islandMargin(vec2 p) {
          float halfE = 108.0;
          vec2 n = abs(p) / halfE;
          float sr = pow(pow(n.x, 3.6) + pow(n.y, 3.6), 1.0 / 3.6);
          float ang = atan(p.y, p.x);
          float wob = 0.045 * sin(ang * 3.0 + 0.7) + 0.03 * cos(ang * 5.0 - 1.1) + 0.02 * sin(ang * 7.0 + 2.2);
          return (1.0 + wob - sr) * halfE;
        }

        void main() {
          // Pixelate ocean coordinates to 0.66m voxel cells!
          vec2 pix = floor(vWorldPos.xz / 0.666) * 0.666;
          float m = islandMargin(pix);

          float wave = sin(pix.x * 0.22 + uTime * 1.7) * 0.5 + cos(pix.y * 0.20 - uTime * 1.3) * 0.5;
          float shallows = clamp((m + 26.0) / 26.0, 0.0, 1.0);

          vec3 deepCol = vec3(0.12, 0.48, 0.78);
          vec3 shallowCol = vec3(0.24, 0.75, 0.88);
          vec3 col = mix(deepCol, shallowCol, shallows);

          // Quantized sunlit wave sparkles
          if (wave > 0.68) {
            col += vec3(0.08, 0.11, 0.12);
          } else if (wave < -0.55) {
            col -= vec3(0.03, 0.05, 0.06);
          }

          // Crisp pixel seafoam ribbon lapping the sandy coast
          float shoreBand = abs(m + 2.2 + sin(uTime * 2.1 + pix.x * 0.18 + pix.y * 0.15) * 0.9);
          if (shoreBand < 1.15) {
            col = vec3(0.95, 0.99, 1.0);
          }

          float distFade = clamp(length(vWorldPos.xz) / 620.0, 0.0, 1.0);
          col = mix(col, vec3(0.80, 0.93, 1.0), distFade * 0.75);

          gl_FragColor = vec4(col, 0.92);
        }
      `,
    });

    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.y = -0.62;
    this.islandGroup.add(oceanMesh);
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    if (mode === "walk") {
      this.walkPos.set(this.target.x, 2.3, this.target.z + 12);
      this.walkYaw = Math.PI;
      this.walkPitch = -0.08;
    } else if (this.camera.fov !== 44) {
      this.camera.fov = 44;
      this.camera.updateProjectionMatrix();
    }
    this.updateCameraTransform();
  }

  public recentreCamera(): void {
    this.target.set(0, 0, 0);
    this.spherical = { radius: 68, theta: Math.PI * 0.25, phi: 0.88 };
    this.camera.fov = 44;
    this.camera.updateProjectionMatrix();
    if (this.cameraMode === "walk") {
      this.walkPos.set(0, 2.3, 18);
      this.walkYaw = Math.PI;
      this.walkPitch = -0.08;
    }
    this.updateCameraTransform();
  }

  public zoomBy(factor: number): void {
    if (this.cameraMode === "walk") {
      this.camera.fov = THREE.MathUtils.clamp(this.camera.fov * factor, 20, 68);
      this.camera.updateProjectionMatrix();
      return;
    }
    this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius * factor, 5.5, 250);
    this.updateCameraTransform();
  }

  public focusElement(elementId: string): void {
    const el = this.gameState.elements.find((e) => e.id === elementId);
    if (!el) return;
    const [wx, wz] = gridToWorldCenter(el.gx, el.gz, el.spanX, el.spanZ);
    const entry = this.placedEntries.get(el.id);
    const topY = (entry?.group.userData.topY as number) || 2.5;
    const lookY = Math.min(8, Math.max(0.6, topY * 0.35));

    if (this.cameraMode === "walk") {
      this.walkPos.set(wx, 2.3, wz + Math.max(6, el.spanZ * 4));
      this.walkYaw = Math.PI;
      this.walkPitch = -0.06;
    } else {
      this.target.set(wx, lookY, wz);
      this.spherical.radius = Math.max(9.5, Math.min(28, topY * 2.1 + el.spanX * 4.5));
      this.spherical.phi = 1.02;
    }
    this.updateCameraTransform();
  }

  public setBrush(brush: BuildBrush): void {
    this.brush = brush;
    this.ghostKey = ""; // force ghost refresh
    this.updateHoverOverlay();
  }

  public rotateCameraBy(deltaTheta: number): void {
    if (this.cameraMode === "walk") {
      this.walkYaw += deltaTheta;
    } else {
      this.spherical.theta += deltaTheta;
    }
    this.updateCameraTransform();
  }

  public setAutoSpin(enabled: boolean): void {
    this.autoSpin360 = enabled;
  }

  public setHeatmap(kind: HeatmapKind): void {
    this.activeHeatmap = kind;
    this.heatmapKey = "";
    this.rebuildHeatmapOverlay();
  }

  public setSelectionFilter(filter: SelectionFilter): void {
    if (this.selectionFilter === filter) return;
    this.selectionFilter = filter;
    for (const el of this.gameState.elements) {
      const entry = this.placedEntries.get(el.id);
      if (entry) {
        this.applySelectionFilterToEntry(entry, el);
      }
    }
  }

  private applySelectionFilterToEntry(entry: PlacedRenderEntry, el: PlacedElement): void {
    const def = ELEMENT_BY_ID[el.defId];
    const visibleMatch = !def || matchesSelectionFilter(def, this.selectionFilter);
    const mat = visibleMatch ? getPixelVoxelMaterial() : getDimmedVoxelMaterial();
    entry.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData?.isVoxelMesh) {
        child.material = mat;
      }
    });
    if (entry.disrepairBadge) {
      entry.disrepairBadge.visible = visibleMatch && el.disrepair;
    }
    if (entry.disconnectBadge) {
      entry.disconnectBadge.visible =
        visibleMatch &&
        this.gameState.mode !== "god" &&
        Boolean(def) &&
        !def!.isNetwork &&
        !def!.passiveNature &&
        def!.domain === "land" &&
        !el.connected;
    }
  }

  public syncState(state: GameState, selectedIds: string[]): void {
    this.gameState = state;
    this.selectedIds = selectedIds;

    const seenIds = new Set<string>();

    for (const el of state.elements) {
      seenIds.add(el.id);
      const def = ELEMENT_BY_ID[el.defId];
      if (!def) continue;

      const connMask = def.isNetwork ? getNetworkConnMask(state.elements, el) : 0;
      const oddRot = el.rotation % 2 === 1;
      const localSpanX = def.isNetwork || !oddRot ? el.spanX : el.spanZ;
      const localSpanZ = def.isNetwork || !oddRot ? el.spanZ : el.spanX;
      const renderKey = `${el.defId}|L${el.level}|V${el.variant}|${localSpanX}x${localSpanZ}|R${el.rotation}|C${connMask}`;

      let entry = this.placedEntries.get(el.id);
      const [wx, wz] = gridToWorldCenter(el.gx, el.gz, el.spanX, el.spanZ);
      const baseY = this.getGroundElevationForElement(def, wx, wz);

      if (!entry || entry.key !== renderKey) {
        const wasAttackDowngrade = Boolean(
          entry &&
            this.gameState.activeAttack &&
            el.level < entry.lastLevel,
        );
        const wasUpgradeOrMerge = !wasAttackDowngrade && (Boolean(entry) || el.animProgress > 0.5);
        if (entry) {
          if (wasAttackDowngrade) {
            this.spawnDestructionVfx(entry, true);
          }
          this.placedGroup.remove(entry.group);
        }

        const asset = getOrBuildElementAsset(
          el.defId,
          el.level,
          el.variant,
          localSpanX,
          localSpanZ,
          connMask,
        );
        const group = buildPlacedGroupFromAsset(asset, false);
        group.position.set(wx, baseY, wz);
        group.rotation.y = def.isNetwork ? 0 : (el.rotation * Math.PI) / 2;
        group.userData.elementId = el.id;
        group.userData.baseY = baseY;

        // Disrepair amber badge
        const disrepairBadge = new THREE.Mesh(this.unitCubeGeo, this.wrenchMat);
        disrepairBadge.scale.set(0.55, 0.55, 0.55);
        disrepairBadge.position.set(0, (asset.topY || 2.5) + 1.1, 0);
        disrepairBadge.visible = false;
        group.add(disrepairBadge);

        // Disconnected red road-needed badge
        const disconnectBadge = new THREE.Mesh(this.unitCubeGeo, this.disconnectMat);
        disconnectBadge.scale.set(0.42, 0.42, 0.42);
        disconnectBadge.position.set(0, (asset.topY || 2.5) + 0.9, 0);
        disconnectBadge.visible = false;
        group.add(disconnectBadge);

        this.placedGroup.add(group);
        entry = {
          key: renderKey,
          group,
          wx,
          baseY,
          wz,
          spanX: el.spanX,
          spanZ: el.spanZ,
          topY: asset.topY || 2.5,
          accentHex: def.accentHex,
          isBuilding: !def.isNetwork && !def.passiveNature,
          lastLevel: el.level,
          disrepairBadge,
          disconnectBadge,
        };
        this.placedEntries.set(el.id, entry);

        if (!entry && !wasUpgradeOrMerge && el.animKind === "place" && el.animProgress > 0.7 && !def.isNetwork) {
          this.spawnCelebrationBurst(wx, baseY + 0.3, wz, 8 + el.spanX * el.spanZ * 3, 0xd8c6a1);
        }
        if (wasUpgradeOrMerge && el.animProgress > 0.7) {
          this.spawnCelebrationBurst(
            wx,
            baseY + Math.min(8, (asset.topY || 2.2) * 0.65),
            wz,
            el.animKind === "merge" ? 26 : 14,
            el.animKind === "merge" ? 0xf4c44e : 0x64f5df,
          );
        }
      } else {
        entry.group.position.x = wx;
        entry.group.position.z = wz;
        entry.group.userData.baseY = baseY;
        entry.group.rotation.y = def.isNetwork ? 0 : (el.rotation * Math.PI) / 2;
        entry.wx = wx;
        entry.baseY = baseY;
        entry.wz = wz;
      }

      this.applySelectionFilterToEntry(entry, el);
    }

    // Remove deleted elements (trigger dramatic collapse/explosion VFX when destroyed during attacks!)
    for (const [id, entry] of this.placedEntries.entries()) {
      if (!seenIds.has(id)) {
        if (this.gameState.activeAttack && entry.isBuilding) {
          this.spawnDestructionVfx(entry, false);
        }
        this.placedGroup.remove(entry.group);
        this.placedEntries.delete(id);
      }
    }

    this.refreshNetworkCache();
    this.rebuildEmittersAndBeacons();
    this.rebuildSelectionAndRadiusOverlays();
    this.updateHoverOverlay();
    this.rebuildHeatmapOverlay();
    this.syncCrimeVisuals();
    this.syncAttackVisuals();
  }

  private getGroundElevationForElement(def: CivElementDef, wx: number, wz: number): number {
    if (def.domain === "water") return -0.58;
    const m = islandMarginAtWorld(wx, wz);
    if (m >= 2.0) return 0;
    if (def.archetype === "bridge_span" || def.archetype === "bridge_suspension" || def.archetype === "dock_pier") {
      return -0.15;
    }
    return Math.max(-0.55, -((2.0 - m) / 9.0) * 1.1);
  }

  public triggerLightningStrike(): void {
    this.lightningFlash = 1.0;
    this.lightningCooldown = 3.5 + Math.random() * 4;
    const lx = (Math.random() - 0.5) * 110;
    const lz = (Math.random() - 0.5) * 110;
    // Jagged glowing lightning bolt column reaching down to ground!
    for (let y = 0; y < 14; y++) {
      const seg = new THREE.Mesh(
        this.unitCubeGeo,
        new THREE.MeshBasicMaterial({ color: y % 2 === 0 ? 0xe0f2fe : 0x7dd3fc }),
      );
      seg.scale.set(0.32, 2.2, 0.32);
      seg.position.set(
        lx + Math.sin(y * 1.9) * 1.4,
        y * 2.1 + 1,
        lz + Math.cos(y * 2.3) * 1.4,
      );
      this.fxGroup.add(seg);
      this.particles.push({
        mesh: seg,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0,
        vz: (Math.random() - 0.5) * 1.5,
        life: 0,
        maxLife: 0.24,
        gravity: 0,
      });
    }
  }

  private spawnDestructionVfx(entry: PlacedRenderEntry, partialDamage: boolean): void {
    const accentNum = Number.parseInt(entry.accentHex.replace("#", ""), 16) || 0xd97706;
    const debrisColors = [accentNum, 0x78716c, 0x57534e, 0xa8a29e, 0xd6d3d1];
    const rubbleCount = partialDamage ? 14 : this.isSoftwareGl ? 18 : 28;
    const spread = Math.max(1.2, entry.spanX * 1.4);

    // 1. Tumbling structural rubble chunks
    for (let i = 0; i < rubbleCount; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: debrisColors[i % debrisColors.length],
      });
      const chunk = new THREE.Mesh(this.unitCubeGeo, mat);
      const s = 0.24 + Math.random() * 0.34;
      chunk.scale.set(s, s * (0.7 + Math.random() * 0.6), s);
      chunk.position.set(
        entry.wx + (Math.random() - 0.5) * spread,
        entry.baseY + 0.4 + Math.random() * Math.min(5, entry.topY * 0.85),
        entry.wz + (Math.random() - 0.5) * spread,
      );
      const ang = Math.random() * Math.PI * 2;
      const horiz = 3.2 + Math.random() * 7.5;
      this.fxGroup.add(chunk);
      this.particles.push({
        mesh: chunk,
        vx: Math.cos(ang) * horiz,
        vy: 5.5 + Math.random() * 8.5,
        vz: Math.sin(ang) * horiz,
        life: 0,
        maxLife: 1.05 + Math.random() * 0.65,
        gravity: 16.5,
      });
    }

    // 2. Fireball burst voxels
    const fireColors = [0xff5e1a, 0xff9f1c, 0xfff3b0];
    const fireCount = partialDamage ? 8 : 14;
    for (let i = 0; i < fireCount; i++) {
      const fMat = new THREE.MeshBasicMaterial({ color: fireColors[i % fireColors.length] });
      const fMesh = new THREE.Mesh(this.unitCubeGeo, fMat);
      const s = 0.36 + Math.random() * 0.32;
      fMesh.scale.set(s, s, s);
      fMesh.position.set(
        entry.wx + (Math.random() - 0.5) * spread * 0.7,
        entry.baseY + 0.6 + Math.random() * 1.8,
        entry.wz + (Math.random() - 0.5) * spread * 0.7,
      );
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.8 + Math.random() * 4.2;
      this.fxGroup.add(fMesh);
      this.particles.push({
        mesh: fMesh,
        vx: Math.cos(ang) * spd,
        vy: 3.5 + Math.random() * 4.5,
        vz: Math.sin(ang) * spd,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.25,
        gravity: 3.5,
      });
    }

    // 3. Rising dark collapse smoke plume
    const smokeCount = partialDamage ? 6 : 12;
    for (let i = 0; i < smokeCount; i++) {
      const sMat = new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? 0x292524 : 0x44403c });
      const smoke = new THREE.Mesh(this.unitCubeGeo, sMat);
      const sz = 0.48 + Math.random() * 0.42;
      smoke.scale.set(sz, sz, sz);
      smoke.position.set(
        entry.wx + (Math.random() - 0.5) * spread * 0.8,
        entry.baseY + 0.8 + Math.random() * 1.6,
        entry.wz + (Math.random() - 0.5) * spread * 0.8,
      );
      this.fxGroup.add(smoke);
      this.particles.push({
        mesh: smoke,
        vx: (Math.random() - 0.5) * 2.1,
        vy: 2.8 + Math.random() * 2.6,
        vz: (Math.random() - 0.5) * 2.1,
        life: 0,
        maxLife: 1.15 + Math.random() * 0.55,
        gravity: -1.4,
      });
    }

    // 4. Expanding ground crater/shockwave ring
    const ringGeo = new THREE.RingGeometry(0.45, 0.9, 20);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff8c1a,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(entry.wx, entry.baseY + 0.08, entry.wz);
    this.fxGroup.add(ring);
    this.shockwaveRings.push({
      mesh: ring,
      life: 0,
      maxLife: 0.55,
      maxScale: Math.max(3.2, entry.spanX * 2.8),
    });
  }

  private spawnCelebrationBurst(wx: number, wy: number, wz: number, count: number, hexColor: number): void {
    const paletteHexes = [hexColor, 0xfcfaf5, 0xffb642, 0x96d65f, 0x5ce6db];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: paletteHexes[i % paletteHexes.length],
      });
      const mesh = new THREE.Mesh(this.unitCubeGeo, mat);
      const s = 0.22 + Math.random() * 0.2;
      mesh.scale.set(s, s, s);
      mesh.position.set(
        wx + (Math.random() - 0.5) * 1.6,
        wy + Math.random() * 0.8,
        wz + (Math.random() - 0.5) * 1.6,
      );
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.2 + Math.random() * 4.8;
      this.fxGroup.add(mesh);
      this.particles.push({
        mesh,
        vx: Math.cos(ang) * spd,
        vy: 4.5 + Math.random() * 5.5,
        vz: Math.sin(ang) * spd,
        life: 0,
        maxLife: 0.75 + Math.random() * 0.45,
        gravity: 13.5,
      });
    }
  }

  private emitFireVoxels(dt: number): void {
    this.fireEmitAccum += dt;
    if (this.fireEmitAccum < 0.09) return;
    this.fireEmitAccum = 0;

    for (const el of this.gameState.elements) {
      if (!el.onFire) continue;
      const [wx, wz] = gridToWorldCenter(el.gx, el.gz, el.spanX, el.spanZ);
      const entry = this.placedEntries.get(el.id);
      const topY = (entry?.group.userData.topY as number) || 2.4;

      const isSmoke = Math.random() < 0.35;
      const col = isSmoke ? 0x52565e : Math.random() < 0.5 ? 0xff6b1a : 0xffbe3b;
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const mesh = new THREE.Mesh(this.unitCubeGeo, mat);
      const s = isSmoke ? 0.34 : 0.28;
      mesh.scale.set(s, s, s);
      mesh.position.set(
        wx + (Math.random() - 0.5) * el.spanX * 1.8,
        topY * 0.55 + Math.random() * 0.8,
        wz + (Math.random() - 0.5) * el.spanZ * 1.8,
      );
      this.fxGroup.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 1.1,
        vy: 2.6 + Math.random() * 2.2,
        vz: (Math.random() - 0.5) * 1.1,
        life: 0,
        maxLife: 0.65 + Math.random() * 0.4,
        gravity: -1.2, // rises upward!
      });
    }
  }

  private rebuildSelectionAndRadiusOverlays(): void {
    for (const line of this.selectionOutlines) {
      this.overlayGroup.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.selectionOutlines = [];

    if (this.mergeBridgeLine) {
      this.overlayGroup.remove(this.mergeBridgeLine);
      this.mergeBridgeLine.geometry.dispose();
      (this.mergeBridgeLine.material as THREE.Material).dispose();
      this.mergeBridgeLine = null;
    }

    const pairMergeable =
      this.selectedIds.length === 2 &&
      canMergePair(this.gameState, this.selectedIds[0], this.selectedIds[1]).ok;

    const centers: THREE.Vector3[] = [];

    this.selectedIds.forEach((id, idx) => {
      const el = this.gameState.elements.find((e) => e.id === id);
      if (!el) return;
      const entry = this.placedEntries.get(id);
      const baseY = entry?.baseY ?? 0;
      const h = Math.max(1.2, ((entry?.group.userData.topY as number) || 2.5) + 0.3);
      const [wx, wz] = gridToWorldCenter(el.gx, el.gz, el.spanX, el.spanZ);
      centers.push(new THREE.Vector3(wx, baseY + h * 0.5, wz));

      const box = new THREE.BoxGeometry(el.spanX * TILE_SIZE + 0.16, h, el.spanZ * TILE_SIZE + 0.16);
      const edges = new THREE.EdgesGeometry(box);
      box.dispose();
      const col = pairMergeable ? 0x5ef28c : idx === 0 ? 0xf4c44e : 0x5ce6db;
      const seg = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: col }));
      seg.position.set(wx, baseY + h * 0.5, wz);
      this.overlayGroup.add(seg);
      this.selectionOutlines.push(seg);
    });

    if (centers.length === 2 && pairMergeable) {
      const pts = [centers[0], centers[1]];
      const lGeo = new THREE.BufferGeometry().setFromPoints(pts);
      this.mergeBridgeLine = new THREE.Line(
        lGeo,
        new THREE.LineBasicMaterial({ color: 0x5ef28c }),
      );
      this.overlayGroup.add(this.mergeBridgeLine);
    }

    this.updateRadiusRing();
  }

  private updateRadiusRing(): void {
    if (this.radiusRingMesh) {
      this.overlayGroup.remove(this.radiusRingMesh);
      this.radiusRingMesh.geometry.dispose();
      (this.radiusRingMesh.material as THREE.Material).dispose();
      this.radiusRingMesh = null;
    }

    // Show radius ring either for active placement brush OR primary selected building
    let radTiles = 0;
    let ringHex = 0x4c82d4;
    let wx = 0;
    let wz = 0;

    if (this.brush.kind === "place" && this.brush.defId && this.hoverGrid) {
      const def = ELEMENT_BY_ID[this.brush.defId];
      if (def) {
        const [sx, sz] = getStandardFootprintForLevel(def, this.brush.level);
        [wx, wz] = gridToWorldCenter(this.hoverGrid[0], this.hoverGrid[1], sx, sz);
        if (def.policeRadius) {
          radTiles = def.policeRadius * (1 + (this.brush.level - 1) * 0.18);
          ringHex = 0x3b82f6;
        } else if (def.fireRadius) {
          radTiles = def.fireRadius * (1 + (this.brush.level - 1) * 0.18);
          ringHex = 0xf59e0b;
        } else if (def.nuisanceRadius) {
          radTiles = def.nuisanceRadius;
          ringHex = 0xef4444;
        }
      }
    } else if (this.selectedIds.length >= 1) {
      const el = this.gameState.elements.find((e) => e.id === this.selectedIds[0]);
      if (el) {
        const def = ELEMENT_BY_ID[el.defId];
        [wx, wz] = gridToWorldCenter(el.gx, el.gz, el.spanX, el.spanZ);
        if (def?.policeRadius) {
          radTiles = def.policeRadius * (el.disrepair ? 0.45 : 1 + (el.level - 1) * 0.18);
          ringHex = 0x3b82f6;
        } else if (def?.fireRadius) {
          radTiles = def.fireRadius * (el.disrepair ? 0.5 : 1 + (el.level - 1) * 0.18);
          ringHex = 0xf59e0b;
        } else if (def?.nuisanceRadius) {
          radTiles = def.nuisanceRadius;
          ringHex = 0xef4444;
        }
      }
    }

    if (radTiles > 0) {
      const outerR = radTiles * TILE_SIZE;
      const ringGeo = new THREE.RingGeometry(Math.max(0.5, outerR - 0.35), outerR, 56);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringHex,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.radiusRingMesh = new THREE.Mesh(ringGeo, ringMat);
      this.radiusRingMesh.position.set(wx, 0.09, wz);
      this.overlayGroup.add(this.radiusRingMesh);
    }
  }

  private updateHoverOverlay(): void {
    if (!this.hoverGrid || this.brush.kind === "none") {
      this.cursorOutline.visible = false;
      if (this.ghostGroup) {
        this.ghostGroup.visible = false;
      }
      this.updateRadiusRing();
      this.callbacks.onHoverInfo?.(null);
      return;
    }

    const [gx, gz] = this.hoverGrid;
    let def: CivElementDef | undefined;
    let spanX = 1;
    let spanZ = 1;
    let level = this.brush.level;
    let variant = this.brush.variantMode >= 0 ? this.brush.variantMode : 0;
    let rotation = this.brush.rotation;
    let ignoreIds: Set<string> | undefined;

    if (this.brush.kind === "move" && this.brush.movingElementId) {
      const moving = this.gameState.elements.find((e) => e.id === this.brush.movingElementId);
      if (moving) {
        def = ELEMENT_BY_ID[moving.defId];
        spanX = moving.spanX;
        spanZ = moving.spanZ;
        level = moving.level;
        variant = moving.variant;
        rotation = moving.rotation;
        ignoreIds = new Set([moving.id]);
      }
    } else if (this.brush.kind === "place" && this.brush.defId) {
      def = ELEMENT_BY_ID[this.brush.defId];
      if (def) {
        const [sx, sz] = getStandardFootprintForLevel(def, level);
        spanX = rotation % 2 === 1 ? sz : sx;
        spanZ = rotation % 2 === 1 ? sx : sz;
      }
    }

    if (!def) {
      this.cursorOutline.visible = false;
      if (this.ghostGroup) this.ghostGroup.visible = false;
      return;
    }

    let chk = checkPlacementValid(this.gameState, def, gx, gz, spanX, spanZ, ignoreIds);
    if (!chk.valid && def.isNetwork && this.brush.kind === "place") {
      const plan = planNetworkPlacement(this.gameState, def, gx, gz);
      if (plan.ok) {
        def = ELEMENT_BY_ID[plan.defId] ?? def;
        chk = { valid: true };
      } else if (plan.reason) {
        chk = { valid: false, reason: plan.reason };
      }
    }
    const [wx, wz] = gridToWorldCenter(gx, gz, spanX, spanZ);
    const baseY = this.getGroundElevationForElement(def, wx, wz);

    this.cursorOutline.visible = true;
    this.cursorOutline.scale.set(spanX * TILE_SIZE, 0.25, spanZ * TILE_SIZE);
    this.cursorOutline.position.set(wx, baseY + 0.14, wz);
    (this.cursorOutline.material as THREE.LineBasicMaterial).color.setHex(
      chk.valid ? 0x64f5df : 0xff5a5f,
    );

    const oddRot = rotation % 2 === 1;
    const localSpanX = def.isNetwork || !oddRot ? spanX : spanZ;
    const localSpanZ = def.isNetwork || !oddRot ? spanZ : spanX;
    const wantedGhostKey = `${def.id}|L${level}|V${variant}|${localSpanX}x${localSpanZ}|${chk.valid ? "ok" : "bad"}`;
    if (this.ghostKey !== wantedGhostKey) {
      if (this.ghostGroup) {
        this.overlayGroup.remove(this.ghostGroup);
      }
      const asset = getOrBuildElementAsset(def.id, level, variant, localSpanX, localSpanZ, 15);
      this.ghostGroup = buildPlacedGroupFromAsset(asset, true, chk.valid);
      this.overlayGroup.add(this.ghostGroup);
      this.ghostKey = wantedGhostKey;
    }

    if (this.ghostGroup) {
      this.ghostGroup.visible = true;
      this.ghostGroup.position.set(wx, baseY, wz);
      this.ghostGroup.rotation.y = def.isNetwork ? 0 : (rotation * Math.PI) / 2;
    }

    this.updateRadiusRing();
    this.callbacks.onHoverInfo?.({ gx, gz, valid: chk.valid, reason: chk.reason });
  }

  // ===================== AUTONOMOUS CARS, TRAINS & PIXEL VILLAGERS =====================

  private refreshNetworkCache(): void {
    let key = "";
    for (const e of this.gameState.elements) key += `${e.defId}${e.gx},${e.gz},${e.spanX}${e.spanZ}${e.connected ? 1 : 0};`;
    if (key === this.netCacheKey) return;
    this.netCacheKey = key;
    this.cachedRoadSet = getConnectedRoadCoordSet(this.gameState.elements);
    this.cachedRailSet = getConnectedRailCoordSet(this.gameState.elements);
    this.cachedCarSet = new Set<string>();
    const occ = new Map<string, string>();
    for (const e of this.gameState.elements) occ.set(`${e.gx},${e.gz}`, e.defId);
    for (const k of this.cachedRoadSet) {
      if (!PEDESTRIAN_IDS.has(occ.get(k) ?? "")) this.cachedCarSet.add(k);
    }
  }

  private syncAutonomousTrafficAndVillagers(): void {
    this.refreshNetworkCache();
    const connectedRoadSet = this.cachedRoadSet;
    const connectedRailSet = this.cachedRailSet;

    const roadTiles: PlacedElement[] = [];
    const carTiles: PlacedElement[] = [];
    const railTiles: PlacedElement[] = [];
    let hasBusDepot = false;
    let hasTaxiDepot = false;
    let hasMilitary = false;
    let hasTrainDepot = false;

    for (const el of this.gameState.elements) {
      const def = ELEMENT_BY_ID[el.defId];
      if (!def) continue;
      if (def.isRoadNetwork && connectedRoadSet.has(`${el.gx},${el.gz}`)) {
        roadTiles.push(el);
        if (this.cachedCarSet.has(`${el.gx},${el.gz}`)) carTiles.push(el);
      }
      if (def.isRailNetwork && connectedRailSet.has(`${el.gx},${el.gz}`)) railTiles.push(el);
      if (el.defId === "bus_depots" || el.defId === "bus_stops") hasBusDepot = true;
      if (el.defId === "taxi_depots") hasTaxiDepot = true;
      if (def.military) hasMilitary = true;
      if (el.defId === "train_depots" || el.defId === "train_stops") hasTrainDepot = true;
    }

    // Immediately remove any vehicles or villagers stranded on isolated/disconnected stubs
    this.trafficAgents = this.trafficAgents.filter((a) => {
      const net = a.isRail ? connectedRailSet : this.cachedCarSet;
      if (!net.has(`${a.gx},${a.gz}`)) {
        this.trafficGroup.remove(a.mesh);
        return false;
      }
      return true;
    });
    this.villagerAgents = this.villagerAgents.filter((v) => {
      if (!connectedRoadSet.has(`${v.gx},${v.gz}`)) {
        this.villagerGroup.remove(v.root);
        return false;
      }
      return true;
    });

    const activeBuildings = this.gameState.elements.filter((e) => {
      const d = ELEMENT_BY_ID[e.defId];
      return e.connected && !d?.isNetwork && !d?.passiveNature;
    }).length;

    // Target road vehicle & villager counts: require connected road tiles AND population > 0
    const hasPop = this.gameState.population > 0;
    const maxVehicles = this.isSoftwareGl ? 22 : 60;
    const m = this.gameState.metrics;
    const busyness = Math.min(1.8, 0.45 + (m.congestion ?? 0) / 100);
    const targetRoadVehicles =
      carTiles.length >= 2 && hasPop
        ? Math.min(
            maxVehicles,
            Math.max(2, Math.round((Math.floor(carTiles.length / 4) + Math.floor(activeBuildings / 3) + Math.sqrt(m.trafficTrips ?? 0)) * busyness)),
          )
        : 0;

    const targetTrains =
      railTiles.length >= 3 && (hasPop || activeBuildings >= 1)
        ? Math.min(6, Math.max(1, Math.floor(railTiles.length / 7) + (hasTrainDepot ? 1 : 0)))
        : 0;

    const currentRoadCount = this.trafficAgents.filter((a) => !a.isRail).length;
    const currentRailCount = this.trafficAgents.filter((a) => a.isRail).length;

    // Prune excess road vehicles
    if (currentRoadCount > targetRoadVehicles) {
      let toRemove = currentRoadCount - targetRoadVehicles;
      this.trafficAgents = this.trafficAgents.filter((a) => {
        if (!a.isRail && toRemove > 0) {
          this.trafficGroup.remove(a.mesh);
          toRemove -= 1;
          return false;
        }
        return true;
      });
    }

    // Spawn road vehicles (Cars, Sports Cars, Trucks, Military Trucks, Cybertrucks, Mini Coopers, Buses, Taxis!)
    for (let i = currentRoadCount; i < targetRoadVehicles; i++) {
      const tile = carTiles[Math.floor(Math.random() * carTiles.length)];
      const pool: RoadVehicleKind[] = ["sedan", "sedan", "mini_cooper", "sports_car", "truck", "cybertruck"];
      if (hasBusDepot || this.gameState.highestStageReached >= 5) pool.push("bus");
      if (hasTaxiDepot || this.gameState.highestStageReached >= 4) pool.push("taxi");
      if (hasMilitary) pool.push("military_truck");

      const kind = pool[Math.floor(Math.random() * pool.length)];
      const geo = getVehicleGeometry(kind, Math.floor(Math.random() * 16));
      const mesh = new THREE.Mesh(geo, getPixelVoxelMaterial());
      mesh.castShadow = !this.isSoftwareGl;
      const grp = new THREE.Group();
      grp.add(mesh);
      this.trafficGroup.add(grp);

      this.trafficAgents.push({
        kind,
        isRail: false,
        mesh: grp,
        gx: tile.gx,
        gz: tile.gz,
        nextGx: tile.gx,
        nextGz: tile.gz,
        dirX: 1,
        dirZ: 0,
        facingAngle: Math.atan2(1, 0),
        progress: 1,
        speed: kind === "sports_car" ? 2.6 : kind === "bus" || kind === "truck" ? 1.55 : 2.0,
        laneOffset: 0.36,
      });
    }

    // Prune / spawn trains on rail tracks
    if (currentRailCount > targetTrains) {
      let toRemove = currentRailCount - targetTrains;
      this.trafficAgents = this.trafficAgents.filter((a) => {
        if (a.isRail && toRemove > 0) {
          this.trafficGroup.remove(a.mesh);
          toRemove -= 1;
          return false;
        }
        return true;
      });
    }

    for (let i = currentRailCount; i < targetTrains; i++) {
      const tile = railTiles[Math.floor(Math.random() * railTiles.length)];
      const geo = getVehicleGeometry("train", i);
      const mesh = new THREE.Mesh(geo, getPixelVoxelMaterial());
      mesh.castShadow = !this.isSoftwareGl;
      const grp = new THREE.Group();
      grp.add(mesh);
      this.trafficGroup.add(grp);

      this.trafficAgents.push({
        kind: "train",
        isRail: true,
        mesh: grp,
        gx: tile.gx,
        gz: tile.gz,
        nextGx: tile.gx,
        nextGz: tile.gz,
        dirX: 1,
        dirZ: 0,
        facingAngle: Math.atan2(1, 0),
        progress: 1,
        speed: 2.8,
        laneOffset: 0,
      });
    }

    // Spawn / prune autonomous walking pixel villagers along roads when population > 0!
    const maxVillagers = this.isSoftwareGl ? 20 : 48;
    const targetVillagers =
      roadTiles.length >= 1 && hasPop
        ? Math.min(maxVillagers, Math.max(3, Math.floor(roadTiles.length / 2) + Math.floor(Math.sqrt(this.gameState.population + 10) / 3)))
        : 0;

    while (this.villagerAgents.length > targetVillagers) {
      const v = this.villagerAgents.pop()!;
      this.villagerGroup.remove(v.root);
    }

    while (this.villagerAgents.length < targetVillagers) {
      const tile = roadTiles[Math.floor(Math.random() * roadTiles.length)];
      const villager = this.createPixelVillager(tile.gx, tile.gz, this.villagerAgents.length);
      this.villagerGroup.add(villager.root);
      this.villagerAgents.push(villager);
    }
  }

  private createPixelVillager(gx: number, gz: number, seed: number): VillagerAgent {
    const root = new THREE.Group();
    const shirtColors = [0xdf5246, 0x4c82d4, 0x47b0a3, 0xf5b82e, 0x9370cf, 0xec8438, 0x58ad52];
    const hairColors = [0x3b2818, 0xd9a74a, 0x181a20, 0xa8342b, 0x8f5e36];
    const skinColors = [0xf5cfa8, 0xe0ac7e, 0x8d5524, 0xfce0c5];

    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColors[seed % shirtColors.length] });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2f5696 });
    const skinMat = new THREE.MeshLambertMaterial({ color: skinColors[seed % skinColors.length] });
    const hairMat = new THREE.MeshLambertMaterial({ color: hairColors[(seed * 3) % hairColors.length] });

    const torso = new THREE.Mesh(this.unitCubeGeo, shirtMat);
    torso.scale.set(0.26, 0.32, 0.16);
    torso.position.y = 0.44;
    root.add(torso);

    const head = new THREE.Mesh(this.unitCubeGeo, skinMat);
    head.scale.set(0.24, 0.24, 0.24);
    head.position.y = 0.74;
    root.add(head);

    const hair = new THREE.Mesh(this.unitCubeGeo, hairMat);
    hair.scale.set(0.26, 0.1, 0.26);
    hair.position.y = 0.88;
    root.add(hair);

    const leftLeg = new THREE.Mesh(this.unitCubeGeo, pantsMat);
    leftLeg.scale.set(0.1, 0.26, 0.12);
    leftLeg.position.set(-0.07, 0.15, 0);
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(this.unitCubeGeo, pantsMat);
    rightLeg.scale.set(0.1, 0.26, 0.12);
    rightLeg.position.set(0.07, 0.15, 0);
    root.add(rightLeg);

    const leftArm = new THREE.Mesh(this.unitCubeGeo, skinMat);
    leftArm.scale.set(0.08, 0.26, 0.1);
    leftArm.position.set(-0.19, 0.44, 0);
    root.add(leftArm);

    const rightArm = new THREE.Mesh(this.unitCubeGeo, skinMat);
    rightArm.scale.set(0.08, 0.26, 0.1);
    rightArm.position.set(0.19, 0.44, 0);
    root.add(rightArm);

    return {
      root,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      gx,
      gz,
      nextGx: gx,
      nextGz: gz,
      dirX: 1,
      dirZ: 0,
      facingAngle: Math.atan2(1, 0),
      progress: 1,
      speed: 0.52 + (seed % 5) * 0.07,
      sidewalkOffset: seed % 2 === 0 ? 0.88 : -0.88,
      phase: seed * 1.3,
    };
  }

  private stepTrafficAndVillagers(dt: number, elapsed: number): void {
    const roadSet = this.cachedRoadSet;
    const railSet = this.cachedRailSet;
    const loadMap = getTrafficLoadMap();

    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (const a of this.trafficAgents) {
      const net = a.isRail ? railSet : this.cachedCarSet;
      if (net.size === 0) continue;

      const load = a.isRail ? 0 : loadMap.get(`${a.gx},${a.gz}`) ?? 0;
      const jam = load > 0.85 ? 1 / (1 + (load - 0.85) * 2.2) : 1;
      a.progress += dt * a.speed * Math.max(0.25, jam);
      if (a.progress >= 1) {
        a.gx = a.nextGx;
        a.gz = a.nextGz;
        a.progress = 0;

        if (!net.has(`${a.gx},${a.gz}`)) {
          const first = net.values().next().value as string;
          const [fx, fz] = first.split(",").map(Number);
          a.gx = fx;
          a.gz = fz;
        }

        // Prefer continuing forward or turning, falling back to U-turn at dead ends
        const validDirs = dirs.filter(([dx, dz]) => net.has(`${a.gx + dx},${a.gz + dz}`));
        const nonReverse = validDirs.filter(([dx, dz]) => !(dx === -a.dirX && dz === -a.dirZ));
        const choices = nonReverse.length > 0 ? nonReverse : validDirs;

        if (choices.length > 0) {
          const [nx, nz] = choices[Math.floor(Math.random() * choices.length)];
          a.dirX = nx;
          a.dirZ = nz;
          a.nextGx = a.gx + nx;
          a.nextGz = a.gz + nz;
        } else {
          a.nextGx = a.gx;
          a.nextGz = a.gz;
        }
      }

      const [x0, z0] = gridToWorldCenter(a.gx, a.gz, 1, 1);
      const [x1, z1] = gridToWorldCenter(a.nextGx, a.nextGz, 1, 1);
      const wx = THREE.MathUtils.lerp(x0, x1, a.progress);
      const wz = THREE.MathUtils.lerp(z0, z1, a.progress);

      // Right-hand lane offset perpendicular to travel direction, pushed clear of building walls
      const perpX = -a.dirZ * a.laneOffset;
      const perpZ = a.dirX * a.laneOffset;
      const [carX, carZ] = a.isRail
        ? [wx + perpX, wz + perpZ]
        : this.resolveBuildingCollision(wx + perpX, wz + perpZ, 0.35);

      a.mesh.position.set(carX, VOXEL_SIZE + 0.02, carZ);
      const targetAngle = Math.atan2(a.dirX, a.dirZ);
      const angleDiff = Math.atan2(
        Math.sin(targetAngle - a.facingAngle),
        Math.cos(targetAngle - a.facingAngle),
      );
      a.facingAngle += angleDiff * Math.min(1, dt * 11);
      a.mesh.rotation.y = a.facingAngle;
    }

    for (const v of this.villagerAgents) {
      if (roadSet.size === 0) continue;
      v.progress += dt * v.speed;
      if (v.progress >= 1) {
        v.gx = v.nextGx;
        v.gz = v.nextGz;
        v.progress = 0;

        if (!roadSet.has(`${v.gx},${v.gz}`)) {
          const first = roadSet.values().next().value as string;
          const [fx, fz] = first.split(",").map(Number);
          v.gx = fx;
          v.gz = fz;
        }

        const validDirs = dirs.filter(([dx, dz]) => roadSet.has(`${v.gx + dx},${v.gz + dz}`));
        const nonReverse = validDirs.filter(([dx, dz]) => !(dx === -v.dirX && dz === -v.dirZ));
        const choices = nonReverse.length > 0 ? nonReverse : validDirs;
        if (choices.length > 0) {
          const [nx, nz] = choices[Math.floor(Math.random() * choices.length)];
          v.dirX = nx;
          v.dirZ = nz;
          v.nextGx = v.gx + nx;
          v.nextGz = v.gz + nz;
        } else {
          v.nextGx = v.gx;
          v.nextGz = v.gz;
        }
      }

      const [x0, z0] = gridToWorldCenter(v.gx, v.gz, 1, 1);
      const [x1, z1] = gridToWorldCenter(v.nextGx, v.nextGz, 1, 1);
      const wx = THREE.MathUtils.lerp(x0, x1, v.progress);
      const wz = THREE.MathUtils.lerp(z0, z1, v.progress);
      const perpX = -v.dirZ * v.sidewalkOffset;
      const perpZ = v.dirX * v.sidewalkOffset;
      const [vx, vz] = this.resolveBuildingCollision(wx + perpX, wz + perpZ, 0.36);

      const stride = Math.sin(elapsed * 8.5 + v.phase);
      v.root.position.set(vx, VOXEL_SIZE + Math.abs(stride) * 0.04, vz);
      const targetVAngle = Math.atan2(v.dirX, v.dirZ);
      const vDiff = Math.atan2(
        Math.sin(targetVAngle - v.facingAngle),
        Math.cos(targetVAngle - v.facingAngle),
      );
      v.facingAngle += vDiff * Math.min(1, dt * 11);
      v.root.rotation.y = v.facingAngle;
      v.leftLeg.rotation.x = stride * 0.55;
      v.rightLeg.rotation.x = -stride * 0.55;
      v.leftArm.rotation.x = -stride * 0.45;
      v.rightArm.rotation.x = stride * 0.45;
    }
  }

  private resolveBuildingCollision(wx: number, wz: number, margin = 0.45): [number, number] {
    let x = wx;
    let z = wz;
    for (let pass = 0; pass < 2; pass++) {
      for (const el of this.gameState.elements) {
        const def = ELEMENT_BY_ID[el.defId];
        if (!def || def.isNetwork || def.passiveNature || def.domain !== "land") continue;
        const minX = el.gx * TILE_SIZE - margin;
        const maxX = (el.gx + el.spanX) * TILE_SIZE + margin;
        const minZ = el.gz * TILE_SIZE - margin;
        const maxZ = (el.gz + el.spanZ) * TILE_SIZE + margin;
        if (x > minX && x < maxX && z > minZ && z < maxZ) {
          const dLeft = x - minX;
          const dRight = maxX - x;
          const dTop = z - minZ;
          const dBot = maxZ - z;
          const m = Math.min(dLeft, dRight, dTop, dBot);
          if (m === dLeft) x = minX;
          else if (m === dRight) x = maxX;
          else if (m === dTop) z = minZ;
          else z = maxZ;
        }
      }
    }
    return [x, z];
  }

  // ===================== ANIMATION & RENDER LOOP =====================

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.fencePixel);
      window.setTimeout(() => this.tick(), 0);
    } else {
      window.requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    if (this.disposed) return;
    const dt = Math.min(0.06, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    this.oceanUniforms.uTime.value = elapsed;
    this.handleKeyboardNavigation(dt);

    // Animate rotors, boats bobbing, merge/place squash-stretch, and badges
    for (const el of this.gameState.elements) {
      const entry = this.placedEntries.get(el.id);
      if (!entry) continue;
      const grp = entry.group;

      const rotor = grp.userData.rotorPivot as THREE.Group | undefined;
      if (rotor) {
        const axis = (grp.userData.rotorAxis as "x" | "y" | "z") || "z";
        const spd = ((grp.userData.rotorSpeed as number) || 1.6) * (0.45 + (this.gameState.windSpeed ?? 1.0) * 0.75);
        rotor.rotation[axis] += dt * spd;
      }
      const rotorList = grp.userData.rotorList as { pivot: THREE.Group; axis: "x" | "y" | "z"; speed: number; wind: boolean }[] | undefined;
      if (rotorList) {
        const windMul = 0.45 + (this.gameState.windSpeed ?? 1.0) * 0.75;
        const powered = el.connected && !el.disrepair && !el.onFire ? 1 : 0.15;
        for (const r of rotorList) {
          r.pivot.rotation[r.axis] += dt * r.speed * (r.wind ? windMul : 1) * powered;
        }
      }

      const baseY = (grp.userData.baseY as number) || 0;
      if (grp.userData.bobOnWater) {
        grp.position.y = baseY + Math.sin(elapsed * 1.9 + el.gx * 0.7 + el.gz * 0.5) * 0.09;
      } else {
        grp.position.y = baseY;
      }

      // New construction rises out of the ground; upgrades & merges squash-stretch
      if (el.animProgress > 0.001 && el.animKind === "place" && entry.isBuilding) {
        const t = 1 - el.animProgress; // 0 -> 1
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const ease = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        grp.scale.set(1, Math.max(0.03, ease), 1);
      } else if (el.animProgress > 0.001) {
        const t = 1 - el.animProgress; // 0 -> 1
        const bounce = Math.sin(t * Math.PI * 2.2) * Math.exp(-t * 3.2);
        const amp = el.animKind === "merge" ? 0.38 : 0.22;
        const sy = Math.max(0.2, 1 + bounce * amp);
        const sxz = Math.max(0.4, 1 - bounce * amp * 0.42);
        grp.scale.set(sxz, sy, sxz);
      } else {
        grp.scale.set(1, 1, 1);
      }

      if (entry.disrepairBadge?.visible) {
        entry.disrepairBadge.rotation.y = elapsed * 2.4;
        entry.disrepairBadge.rotation.x = Math.sin(elapsed * 3.2) * 0.35;
      }
      if (entry.disconnectBadge?.visible) {
        entry.disconnectBadge.rotation.y = -elapsed * 1.8;
      }
    }

    // Traffic & Villagers
    this.trafficSyncAccum += dt;
    if (this.trafficSyncAccum >= 1.25) {
      this.trafficSyncAccum = 0;
      this.syncAutonomousTrafficAndVillagers();
    }
    this.stepTrafficAndVillagers(dt, elapsed);

    // Day/Night Atmosphere + Weather Clouds, Rain & Lightning
    this.updateDayNightAndWeather(dt, elapsed);

    // Active Crime Robberies & Dispatched Police Cars
    this.stepCrimeAnimations(dt, elapsed);

    // Active Invasion Units (Ships, Tanks, Soldiers) & Island Defenders
    this.stepAttackAnimations(dt, elapsed);

    // Optional 360-degree continuous spin
    if (this.autoSpin360 && this.cameraMode !== "walk") {
      this.spherical.theta += dt * 0.42;
      this.updateCameraTransform();
    }

    // Smoke plumes, steam & blinking beacons
    this.stepSmokeAndBeacons(dt, elapsed);

    // Fire voxels, destruction rubble & celebration particles
    this.emitFireVoxels(dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.fxGroup.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += dt * 5.5;
      p.mesh.rotation.y += dt * 4.2;
      if (p.mesh.position.y < 0.1 && p.gravity > 0) {
        p.mesh.position.y = 0.1;
        p.vy = Math.abs(p.vy) * 0.42;
        p.vx *= 0.72;
        p.vz *= 0.72;
      }
      const fade = 1 - p.life / p.maxLife;
      p.mesh.scale.multiplyScalar(fade > 0.3 ? 0.995 : 0.92);
    }

    // Expanding ground shockwave crater rings from destroyed buildings
    for (let i = this.shockwaveRings.length - 1; i >= 0; i--) {
      const sw = this.shockwaveRings[i];
      sw.life += dt;
      if (sw.life >= sw.maxLife) {
        this.fxGroup.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        (sw.mesh.material as THREE.Material).dispose();
        this.shockwaveRings.splice(i, 1);
        continue;
      }
      const prog = sw.life / sw.maxLife;
      const sc = THREE.MathUtils.lerp(0.6, sw.maxScale, 1 - Math.pow(1 - prog, 2));
      sw.mesh.scale.set(sc, sc, 1);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - prog) * 0.85;
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  }

  // ===================== WEATHER, DAY/NIGHT, HEATMAPS, CRIME & INVASION VISUALS =====================

  private buildWeatherVisuals(): void {
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const count = this.isSoftwareGl ? 6 : 12;
    for (let i = 0; i < count; i++) {
      const cg = new THREE.Group();
      const blocks = 3 + (i % 3);
      for (let b = 0; b < blocks; b++) {
        const m = new THREE.Mesh(this.unitCubeGeo, cloudMat);
        m.scale.set(7 + (b % 2) * 4, 2.4 + (b === 1 ? 1.4 : 0), 5 + ((b + i) % 3) * 2);
        m.position.set((b - 1) * 4.5, b === 1 ? 1.1 : 0, (b % 2) * 2.1);
        cg.add(m);
      }
      cg.position.set(-140 + i * 26, 46 + (i % 4) * 5, -90 + ((i * 37) % 180));
      cg.userData.speed = 2.4 + (i % 4) * 0.75;
      this.weatherGroup.add(cg);
      this.cloudMeshes.push(cg);
    }

    const rainMat = new THREE.MeshBasicMaterial({ color: 0x9cd8ff, transparent: true, opacity: 0.65 });
    const rainCount = this.isSoftwareGl ? 70 : 170;
    for (let i = 0; i < rainCount; i++) {
      const drop = new THREE.Mesh(this.unitCubeGeo, rainMat);
      drop.scale.set(0.08, 1.4, 0.08);
      drop.position.set((Math.random() - 0.5) * 190, Math.random() * 44, (Math.random() - 0.5) * 190);
      drop.visible = false;
      this.weatherGroup.add(drop);
      this.rainDrops.push(drop);
    }
  }

  private updateDayNightAndWeather(dt: number, elapsed: number): void {
    const tod = this.gameState.timeOfDay ?? 10.5;
    const weather = this.gameState.weather ?? "clear";
    const intensity = THREE.MathUtils.clamp(this.gameState.weatherIntensity ?? 1.0, 0.25, 1.5);
    const wind = THREE.MathUtils.clamp(this.gameState.windSpeed ?? 1.0, 0.1, 2.6);

    // Sun angle across 24h (6:00 = sunrise, 12:00 = zenith, 18:00 = sunset, 0:00 = midnight)
    const sunRad = ((tod - 6) / 24) * Math.PI * 2;
    const sunElev = Math.sin(sunRad); // -1 midnight .. +1 noon
    const dayFactor = THREE.MathUtils.clamp((sunElev + 0.25) / 0.65, 0, 1);
    const duskFactor = Math.exp(-Math.pow(sunElev / 0.22, 2)); // peaks around sunrise & sunset

    // Night window glow factor
    voxelNightUniform.value = THREE.MathUtils.clamp(1 - dayFactor * 1.15, 0, 1);

    // Move directional sun/moon light
    if (sunElev >= -0.08) {
      this.sunLight.position.set(Math.cos(sunRad) * 125, Math.max(18, sunElev * 135), 72);
    } else {
      this.sunLight.position.set(-Math.cos(sunRad) * 105, Math.max(25, -sunElev * 110), -68);
    }

    const baseDim = weather === "storm" ? 0.52 : weather === "rain" ? 0.66 : weather === "cloudy" ? 0.84 : 1.0;
    const weatherDim = THREE.MathUtils.lerp(1.0, baseDim, Math.min(1.25, intensity));

    // Sky & Fog Colors
    const daySky = new THREE.Color(weather === "storm" ? 0x5c7288 : weather === "rain" ? 0x7f9bb3 : weather === "cloudy" ? 0xa3cbe6 : 0xc2e9ff);
    const duskSky = new THREE.Color(0xf2a36e);
    const nightSky = new THREE.Color(weather === "storm" ? 0x0b1220 : 0x101c36);

    this.skyBgColor.copy(nightSky).lerp(daySky, dayFactor).lerp(duskSky, duskFactor * 0.65);

    if (weather === "storm") {
      this.lightningCooldown -= dt * intensity;
      if (this.lightningCooldown <= 0) {
        this.triggerLightningStrike();
      }
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 6.5);
      this.skyBgColor.lerp(new THREE.Color(0xeef6ff), this.lightningFlash * 0.78);
    }

    this.scene.background = this.skyBgColor;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.fogColor.copy(this.skyBgColor);
      this.scene.fog.color.copy(this.fogColor);
      const baseFog = weather === "storm" ? 0.0044 : weather === "rain" ? 0.0034 : weather === "cloudy" ? 0.0026 : 0.0021;
      this.scene.fog.density = THREE.MathUtils.lerp(0.0021, baseFog, Math.min(1.3, intensity));
    }

    const sunDayCol = new THREE.Color(0xfff3db);
    const sunDuskCol = new THREE.Color(0xff9a52);
    const moonCol = new THREE.Color(0x6d93d6);
    this.sunLight.color.copy(moonCol).lerp(sunDayCol, dayFactor).lerp(sunDuskCol, duskFactor * 0.7);
    this.sunLight.intensity =
      (THREE.MathUtils.lerp(0.45, 2.25, dayFactor) + this.lightningFlash * 2.8) * weatherDim;
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.32, 0.88, dayFactor) * weatherDim;
    this.hemiLight.color.copy(nightSky).lerp(new THREE.Color(0xf0f8ff), dayFactor);
    this.bounceLight.intensity = THREE.MathUtils.lerp(0.18, 0.42, dayFactor);

    // Clouds modulated by intensity & windSpeed
    const showClouds = weather !== "clear" || dayFactor > 0.2;
    const cloudCol =
      weather === "storm"
        ? 0x4b5563
        : weather === "rain"
          ? 0x6b7280
          : weather === "cloudy"
            ? 0xdce4ee
            : 0xffffff;
    const cloudOpacity = Math.min(0.98, (weather === "clear" ? 0.45 : weather === "cloudy" ? 0.85 : 0.94) * (0.65 + intensity * 0.35));
    const maxVisibleClouds = Math.max(2, Math.round(this.cloudMeshes.length * Math.min(1, 0.4 + intensity * 0.55)));

    for (let i = 0; i < this.cloudMeshes.length; i++) {
      const cg = this.cloudMeshes[i];
      cg.visible = showClouds && i < maxVisibleClouds && (weather !== "clear" || i % 2 === 0);
      if (!cg.visible) continue;
      cg.position.x += ((cg.userData.speed as number) || 2.5) * wind * (weather === "storm" ? 1.85 : 1) * dt;
      if (cg.position.x > 165) cg.position.x = -165;
      const firstMesh = cg.children[0] as THREE.Mesh | undefined;
      if (firstMesh) {
        const mat = firstMesh.material as THREE.MeshLambertMaterial;
        mat.color.setHex(cloudCol);
        mat.opacity = cloudOpacity;
      }
    }

    // Raindrops modulated by intensity & windSpeed
    const isRaining = weather === "rain" || weather === "storm";
    const fallSpd = (weather === "storm" ? 54 : 38) * (0.75 + intensity * 0.3);
    const activeRainCount = Math.round(this.rainDrops.length * Math.min(1, intensity * 0.8));
    for (let i = 0; i < this.rainDrops.length; i++) {
      const drop = this.rainDrops[i];
      drop.visible = isRaining && i < activeRainCount;
      if (!drop.visible) continue;
      drop.position.y -= fallSpd * dt;
      drop.position.x += (weather === "storm" ? 8 : 2.5) * wind * dt;
      if (drop.position.y < 0) {
        drop.position.y = 42 + Math.random() * 8;
        drop.position.x = this.target.x + (Math.random() - 0.5) * 140;
        drop.position.z = this.target.z + (Math.random() - 0.5) * 140;
      }
    }

    void elapsed;
  }

  private rebuildHeatmapOverlay(): void {
    for (const ch of [...this.heatmapGroup.children]) {
      this.heatmapGroup.remove(ch);
      if (ch instanceof THREE.Mesh) {
        (ch.material as THREE.Material).dispose();
        if (ch instanceof THREE.InstancedMesh) ch.dispose();
      }
    }
    if (this.activeHeatmap === "none") return;

    const samples = computeHeatmapCells(this.gameState, this.activeHeatmap);
    if (samples.length === 0) return;
    const tileGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.94, TILE_SIZE * 0.94);
    tileGeo.rotateX(-Math.PI / 2);

    const goodCol = new THREE.Color(0x22c55e);
    const midCol = new THREE.Color(0xf59e0b);
    const badCol = new THREE.Color(0xef4444);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false });
    const inst = new THREE.InstancedMesh(tileGeo, mat, samples.length);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    samples.forEach((s, i) => {
      if (s.score >= 0) col.copy(midCol).lerp(goodCol, s.score);
      else col.copy(midCol).lerp(badCol, Math.min(1, Math.abs(s.score)));
      const [wx, wz] = gridToWorldCenter(s.gx, s.gz, 1, 1);
      m4.makeTranslation(wx, 0.09, wz);
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i, col);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.renderOrder = 2;
    this.heatmapGroup.add(inst);
  }

  // ===================== SMOKE PLUMES & BLINKING BEACONS =====================

  private static SMOKE_COLORS = [0xb7bcc4, 0xf4f8fb, 0x4b4f58, 0xffa040];
  private static SMOKE_MAX = 700;

  private ensureSmokeMesh(): THREE.InstancedMesh {
    if (this.smokeMesh) return this.smokeMesh;
    const mat = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.82, depthWrite: false });
    const mesh = new THREE.InstancedMesh(this.unitCubeGeo, mat, PixelWorldRenderer.SMOKE_MAX);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fxGroup.add(mesh);
    this.smokeMesh = mesh;
    return mesh;
  }

  private rebuildEmittersAndBeacons(): void {
    const kinds: Record<string, number> = { smoke: 0, steam: 1, dark: 2, spark: 3 };
    this.smokeEmitters = [];
    const beacons: { pos: THREE.Vector3; col: string }[] = [];
    for (const el of this.gameState.elements) {
      const entry = this.placedEntries.get(el.id);
      if (!entry) continue;
      const pts = (entry.group.userData.smokePoints as [number, number, number, string][]) ?? [];
      const active = el.connected && !el.disrepair;
      if (active) {
        for (const [x, y, z, k] of pts) {
          this.smokeEmitters.push({ entryId: el.id, local: new THREE.Vector3(x, y, z), kind: kinds[k] ?? 0, acc: Math.random() });
        }
      }
      const bl = (entry.group.userData.blinkers as [number, number, number, string][]) ?? [];
      if (bl.length) {
        entry.group.updateMatrixWorld(true);
        for (const [x, y, z, c] of bl) {
          beacons.push({ pos: entry.group.localToWorld(new THREE.Vector3(x, y, z)), col: c });
        }
      }
    }
    const bKey = beacons.map((b) => `${b.pos.x.toFixed(1)},${b.pos.y.toFixed(1)},${b.pos.z.toFixed(1)}${b.col}`).join("|");
    if (bKey === this.blinkKey) return;
    this.blinkKey = bKey;
    if (this.blinkMesh) {
      this.fxGroup.remove(this.blinkMesh);
      this.blinkMesh.dispose();
      this.blinkMesh = null;
    }
    if (beacons.length === 0) return;
    const mesh = new THREE.InstancedMesh(this.unitCubeGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), beacons.length);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    beacons.forEach((b, i) => {
      m4.makeScale(0.22, 0.22, 0.22).setPosition(b.pos);
      mesh.setMatrixAt(i, m4);
      col.set(PALETTE[b.col] ?? b.col);
      col.multiplyScalar(1.6);
      mesh.setColorAt(i, col);
    });
    mesh.frustumCulled = false;
    mesh.userData.positions = beacons.map((b) => b.pos);
    this.blinkPhases = beacons.map(() => Math.random());
    this.fxGroup.add(mesh);
    this.blinkMesh = mesh;
  }

  private stepSmokeAndBeacons(dt: number, elapsed: number): void {
    // Beacons: crisp on/off blink, a little desynchronised
    if (this.blinkMesh) {
      const positions = this.blinkMesh.userData.positions as THREE.Vector3[];
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < positions.length; i++) {
        const on = (elapsed * 0.9 + this.blinkPhases[i]) % 1 < 0.42;
        const sc = on ? 0.26 : 0.001;
        m4.makeScale(sc, sc, sc).setPosition(positions[i]);
        this.blinkMesh.setMatrixAt(i, m4);
      }
      this.blinkMesh.instanceMatrix.needsUpdate = true;
    }

    if (this.smokeEmitters.length === 0 && this.smokeParts.length === 0) {
      if (this.smokeMesh) this.smokeMesh.count = 0;
      return;
    }
    const mesh = this.ensureSmokeMesh();
    const wind = (this.gameState.windSpeed ?? 1) * 0.9;
    const budget = PixelWorldRenderer.SMOKE_MAX;
    const rate = this.isSoftwareGl ? 1.2 : 2.6;
    const tmp = new THREE.Vector3();
    for (const em of this.smokeEmitters) {
      em.acc += dt * rate * (em.kind === 1 ? 1.3 : em.kind === 3 ? 2.5 : 1);
      while (em.acc >= 1 && this.smokeParts.length < budget) {
        em.acc -= 1;
        const entry = this.placedEntries.get(em.entryId);
        if (!entry) break;
        tmp.copy(em.local);
        entry.group.localToWorld(tmp);
        const spark = em.kind === 3;
        this.smokeParts.push({
          x: tmp.x + (Math.random() - 0.5) * 0.2,
          y: tmp.y,
          z: tmp.z + (Math.random() - 0.5) * 0.2,
          vx: (Math.random() - 0.5) * (spark ? 1.6 : 0.3),
          vy: spark ? 1.2 + Math.random() * 1.4 : 0.9 + Math.random() * 0.5,
          vz: (Math.random() - 0.5) * (spark ? 1.6 : 0.3),
          life: 0,
          max: spark ? 0.6 + Math.random() * 0.4 : em.kind === 1 ? 2.4 + Math.random() : 3.4 + Math.random() * 1.4,
          size: spark ? 0.09 : em.kind === 1 ? 0.42 : 0.34,
          kind: em.kind,
        });
      }
      if (em.acc > 3) em.acc = 0;
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const col = new THREE.Color();
    let n = 0;
    for (let i = this.smokeParts.length - 1; i >= 0; i--) {
      const p = this.smokeParts[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.smokeParts[i] = this.smokeParts[this.smokeParts.length - 1];
        this.smokeParts.pop();
        continue;
      }
      const t = p.life / p.max;
      if (p.kind === 3) {
        p.vy -= 3.5 * dt;
      } else {
        p.vx += wind * 0.35 * dt;
        p.vz += wind * 0.18 * dt;
        p.vy *= 1 - dt * 0.25;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const grow = p.kind === 3 ? 1 - t : (0.6 + t * 2.4) * (t > 0.75 ? (1 - t) / 0.25 : 1);
      const s2 = p.size * Math.max(0.05, grow);
      pos.set(p.x, p.y, p.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.life * 0.6 + i);
      sc.set(s2, s2, s2);
      m4.compose(pos, q, sc);
      mesh.setMatrixAt(n, m4);
      col.setHex(PixelWorldRenderer.SMOKE_COLORS[p.kind] ?? 0xcccccc);
      if (p.kind === 0) col.lerp(new THREE.Color(0xe8ecf0), t);
      mesh.setColorAt(n, col);
      n += 1;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private findRoadPath(startGx: number, startGz: number, targetGx: number, targetGz: number): [number, number][] {
    const roadSet = new Set<string>();
    for (const el of this.gameState.elements) {
      const d = ELEMENT_BY_ID[el.defId];
      if (d?.isRoadNetwork) roadSet.add(`${el.gx},${el.gz}`);
    }

    // Find nearest road tile to start & target
    const nearestRoad = (gx: number, gz: number): [number, number] | null => {
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (const key of roadSet) {
        const [rx, rz] = key.split(",").map(Number);
        const d = Math.abs(rx - gx) + Math.abs(rz - gz);
        if (d < bestD) {
          bestD = d;
          best = [rx, rz];
        }
      }
      return best;
    };

    const sRoad = nearestRoad(startGx, startGz);
    const tRoad = nearestRoad(targetGx, targetGz);
    if (!sRoad || !tRoad) {
      return [
        [startGx, startGz],
        [targetGx, targetGz],
      ];
    }

    const q: [number, number][] = [sRoad];
    const prev = new Map<string, string | null>();
    prev.set(`${sRoad[0]},${sRoad[1]}`, null);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    while (q.length > 0) {
      const [cx, cz] = q.shift()!;
      if (cx === tRoad[0] && cz === tRoad[1]) break;
      for (const [dx, dz] of dirs) {
        const nx = cx + dx;
        const nz = cz + dz;
        const k = `${nx},${nz}`;
        if (!roadSet.has(k) || prev.has(k)) continue;
        prev.set(k, `${cx},${cz}`);
        q.push([nx, nz]);
      }
    }

    const path: [number, number][] = [];
    let cur: string | null = `${tRoad[0]},${tRoad[1]}`;
    if (!prev.has(cur)) {
      return [
        [startGx, startGz],
        [targetGx, targetGz],
      ];
    }
    while (cur) {
      const [px, pz] = cur.split(",").map(Number);
      path.unshift([px, pz]);
      cur = prev.get(cur) ?? null;
    }
    return path;
  }

  private createCriminalGroup() {
    const root = new THREE.Group();

    const leftLeg = new THREE.Mesh(this.unitCubeGeo, this.crimeDarkMat);
    leftLeg.scale.set(0.1, 0.28, 0.12);
    leftLeg.position.set(-0.07, 0.14, 0);
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(this.unitCubeGeo, this.crimeDarkMat);
    rightLeg.scale.set(0.1, 0.28, 0.12);
    rightLeg.position.set(0.07, 0.14, 0);
    root.add(rightLeg);

    const torso = new THREE.Mesh(this.unitCubeGeo, this.crimeStripeMat);
    torso.scale.set(0.28, 0.34, 0.18);
    torso.position.y = 0.45;
    root.add(torso);

    const stripeBand = new THREE.Mesh(this.unitCubeGeo, this.crimeDarkMat);
    stripeBand.scale.set(0.29, 0.09, 0.19);
    stripeBand.position.y = 0.44;
    root.add(stripeBand);

    const head = new THREE.Mesh(this.unitCubeGeo, this.crimeSkinMat);
    head.scale.set(0.24, 0.24, 0.24);
    head.position.y = 0.74;
    root.add(head);

    // Black burglar beanie & eye mask!
    const mask = new THREE.Mesh(this.unitCubeGeo, this.crimeDarkMat);
    mask.scale.set(0.26, 0.12, 0.26);
    mask.position.y = 0.84;
    root.add(mask);

    const eyeBand = new THREE.Mesh(this.unitCubeGeo, this.crimeDarkMat);
    eyeBand.scale.set(0.26, 0.08, 0.06);
    eyeBand.position.set(0, 0.75, 0.12);
    root.add(eyeBand);

    const leftArm = new THREE.Mesh(this.unitCubeGeo, this.crimeStripeMat);
    leftArm.scale.set(0.09, 0.26, 0.1);
    leftArm.position.set(-0.19, 0.46, 0);
    root.add(leftArm);

    const rightArm = new THREE.Mesh(this.unitCubeGeo, this.crimeStripeMat);
    rightArm.scale.set(0.09, 0.26, 0.1);
    rightArm.position.set(0.19, 0.46, 0);
    root.add(rightArm);

    const crowbar = new THREE.Mesh(this.unitCubeGeo, this.crimeCrowbarMat);
    crowbar.scale.set(0.06, 0.06, 0.32);
    crowbar.position.set(0.19, 0.36, 0.16);
    root.add(crowbar);

    // Loot sack slung over shoulder
    const lootBag = new THREE.Mesh(this.unitCubeGeo, this.crimeLootMat);
    lootBag.scale.set(0.24, 0.28, 0.24);
    lootBag.position.set(-0.18, 0.56, -0.14);
    root.add(lootBag);

    // Floating alert cube
    const alertMesh = new THREE.Mesh(this.unitCubeGeo, this.crimeAlertMat);
    alertMesh.scale.set(0.26, 0.26, 0.26);
    alertMesh.position.y = 1.45;
    root.add(alertMesh);

    return { root, leftLeg, rightLeg, leftArm, rightArm, lootBag, alertMesh, crowbar };
  }

  private createCopOfficerGroup() {
    const root = new THREE.Group();

    const leftLeg = new THREE.Mesh(this.unitCubeGeo, this.copBlackMat);
    leftLeg.scale.set(0.1, 0.28, 0.12);
    leftLeg.position.set(-0.07, 0.14, 0);
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(this.unitCubeGeo, this.copBlackMat);
    rightLeg.scale.set(0.1, 0.28, 0.12);
    rightLeg.position.set(0.07, 0.14, 0);
    root.add(rightLeg);

    const torso = new THREE.Mesh(this.unitCubeGeo, this.copNavyMat);
    torso.scale.set(0.28, 0.34, 0.18);
    torso.position.y = 0.45;
    root.add(torso);

    const badge = new THREE.Mesh(this.unitCubeGeo, this.copGoldMat);
    badge.scale.set(0.09, 0.09, 0.05);
    badge.position.set(0.06, 0.5, 0.1);
    root.add(badge);

    const head = new THREE.Mesh(this.unitCubeGeo, this.crimeSkinMat);
    head.scale.set(0.24, 0.22, 0.24);
    head.position.y = 0.73;
    root.add(head);

    const cap = new THREE.Mesh(this.unitCubeGeo, this.copCapMat);
    cap.scale.set(0.28, 0.12, 0.28);
    cap.position.y = 0.85;
    root.add(cap);

    const leftArm = new THREE.Mesh(this.unitCubeGeo, this.copNavyMat);
    leftArm.scale.set(0.09, 0.26, 0.1);
    leftArm.position.set(-0.19, 0.46, 0);
    root.add(leftArm);

    const rightArm = new THREE.Mesh(this.unitCubeGeo, this.copNavyMat);
    rightArm.scale.set(0.09, 0.26, 0.1);
    rightArm.position.set(0.19, 0.46, 0);
    root.add(rightArm);

    return { root, leftLeg, rightLeg, leftArm, rightArm };
  }

  private createPoliceCarGroup(): {
    car: THREE.Group;
    sirenRed: THREE.Mesh;
    sirenBlue: THREE.Mesh;
    headlightL: THREE.Mesh;
    headlightR: THREE.Mesh;
  } {
    const car = new THREE.Group();
    const sirenRed = new THREE.Mesh(this.unitCubeGeo, this.sirenRedMat);
    const sirenBlue = new THREE.Mesh(this.unitCubeGeo, this.sirenBlueMat);
    const headlightL = new THREE.Mesh(this.unitCubeGeo, this.copHeadlightMat);
    const headlightR = new THREE.Mesh(this.unitCubeGeo, this.copHeadlightMat);

    const body = new THREE.Mesh(this.unitCubeGeo, this.copBlackMat);
    body.scale.set(0.68, 0.34, 1.25);
    body.position.y = 0.24;
    car.add(body);

    const doors = new THREE.Mesh(this.unitCubeGeo, this.copWhiteMat);
    doors.scale.set(0.7, 0.32, 0.56);
    doors.position.y = 0.25;
    car.add(doors);

    const cabin = new THREE.Mesh(this.unitCubeGeo, this.copWhiteMat);
    cabin.scale.set(0.58, 0.24, 0.62);
    cabin.position.y = 0.52;
    car.add(cabin);

    sirenRed.scale.set(0.22, 0.12, 0.16);
    sirenRed.position.set(-0.14, 0.7, 0);
    car.add(sirenRed);

    sirenBlue.scale.set(0.22, 0.12, 0.16);
    sirenBlue.position.set(0.14, 0.7, 0);
    car.add(sirenBlue);

    headlightL.scale.set(0.12, 0.1, 0.08);
    headlightL.position.set(-0.22, 0.26, 0.63);
    car.add(headlightL);

    headlightR.scale.set(0.12, 0.1, 0.08);
    headlightR.position.set(0.22, 0.26, 0.63);
    car.add(headlightR);

    return { car, sirenRed, sirenBlue, headlightL, headlightR };
  }

  private syncCrimeVisuals(): void {
    const incidents = this.gameState.metrics?.crimeUnlocked
      ? (this.gameState.crimeIncidents ?? [])
      : [];
    const activeIds = new Set(incidents.map((c) => c.id));

    for (const [id, vis] of this.crimeVisuals.entries()) {
      if (!activeIds.has(id)) {
        this.crimeGroup.remove(vis.burglar.root);
        if (vis.copCar) this.crimeGroup.remove(vis.copCar);
        if (vis.copOfficer) this.crimeGroup.remove(vis.copOfficer.root);
        this.crimeVisuals.delete(id);
      }
    }

    for (const inc of incidents) {
      if (this.crimeVisuals.has(inc.id)) continue;
      const burglar = this.createCriminalGroup();
      this.crimeGroup.add(burglar.root);

      let copCar: THREE.Group | null = null;
      let sirenRed: THREE.Mesh | null = null;
      let sirenBlue: THREE.Mesh | null = null;
      let headlightL: THREE.Mesh | null = null;
      let headlightR: THREE.Mesh | null = null;
      let copOfficer: ReturnType<PixelWorldRenderer["createCopOfficerGroup"]> | null = null;
      let roadPath: [number, number][] = [];

      if (inc.policeGx !== null && inc.policeGz !== null) {
        const created = this.createPoliceCarGroup();
        copCar = created.car;
        sirenRed = created.sirenRed;
        sirenBlue = created.sirenBlue;
        headlightL = created.headlightL;
        headlightR = created.headlightR;
        this.crimeGroup.add(copCar);

        copOfficer = this.createCopOfficerGroup();
        copOfficer.root.visible = false;
        this.crimeGroup.add(copOfficer.root);

        roadPath = this.findRoadPath(inc.policeGx, inc.policeGz, inc.targetGx, inc.targetGz);
      }

      this.crimeVisuals.set(inc.id, {
        burglar,
        copCar,
        sirenRed,
        sirenBlue,
        headlightL,
        headlightR,
        copOfficer,
        roadPath,
        copAngle: 0,
        officerAngle: 0,
        sparkAccum: 0,
        captureBurstDone: false,
      });
    }
  }

  private stepCrimeAnimations(dt: number, elapsed: number): void {
    const incidents = this.gameState.crimeIncidents ?? [];
    for (const inc of incidents) {
      const vis = this.crimeVisuals.get(inc.id);
      if (!vis) continue;

      const targetEl = this.gameState.elements.find((e) => e.id === inc.targetElementId);
      const spanX = targetEl?.spanX ?? 1;
      const spanZ = targetEl?.spanZ ?? 1;
      const gx = targetEl?.gx ?? inc.targetGx;
      const gz = targetEl?.gz ?? inc.targetGz;
      const [tx, tz] = gridToWorldCenter(gx, gz, spanX, spanZ);

      // Prowl cleanly along the exterior perimeter outside the building walls, never phasing inside!
      const rx = spanX * TILE_SIZE * 0.5 + 0.58;
      const rz = spanZ * TILE_SIZE * 0.5 + 0.58;
      const isFleeing = inc.policeArrived;
      const cycle = (elapsed * 0.9) % 3.2;
      const isLootingPause = !isFleeing && cycle > 1.8;

      const orbitAng = isLootingPause
        ? Math.floor((elapsed * 0.9) / 3.2) * 1.9 + 1.62
        : elapsed * (isFleeing ? 2.85 : 1.75);

      const rawBx = tx + Math.cos(orbitAng) * rx;
      const rawBz = tz + Math.sin(orbitAng) * rz;
      const [bx, bz] = this.resolveBuildingCollision(rawBx, rawBz, 0.45);
      const stride = Math.sin(elapsed * (isFleeing ? 15 : 9));

      vis.burglar.root.position.set(
        bx,
        VOXEL_SIZE + (isLootingPause ? 0.02 : Math.abs(stride) * 0.11),
        bz,
      );
      if (isLootingPause) {
        // Face inward toward wall while prying / looting
        vis.burglar.root.rotation.y = Math.atan2(tx - bx, tz - bz);
        const pry = Math.sin(elapsed * 18);
        vis.burglar.leftLeg.rotation.x = 0.22;
        vis.burglar.rightLeg.rotation.x = -0.22;
        vis.burglar.leftArm.rotation.x = -0.6 + pry * 0.45;
        vis.burglar.rightArm.rotation.x = -0.9 + pry * 0.6;
        vis.burglar.crowbar.rotation.x = pry * 0.55;
        const bagPulse = 1 + Math.abs(pry) * 0.16;
        vis.burglar.lootBag.scale.set(0.24 * bagPulse, 0.28 * bagPulse, 0.24 * bagPulse);
        vis.sparkAccum += dt;
        if (vis.sparkAccum >= 0.45) {
          vis.sparkAccum = 0;
          this.spawnCelebrationBurst(bx, VOXEL_SIZE + 0.75, bz, 3, 0xfbbf24);
        }
      } else {
        vis.burglar.root.rotation.y = -orbitAng;
        vis.burglar.leftLeg.rotation.x = stride * 0.68;
        vis.burglar.rightLeg.rotation.x = -stride * 0.68;
        vis.burglar.leftArm.rotation.x = -stride * 0.55;
        vis.burglar.rightArm.rotation.x = stride * 0.55;
        vis.burglar.crowbar.rotation.x = 0;
        vis.burglar.lootBag.scale.set(0.24, 0.28, 0.24);
      }

      vis.burglar.alertMesh.position.y = 1.45 + Math.sin(elapsed * 6) * 0.12;
      vis.burglar.alertMesh.rotation.y = elapsed * 3.2;
      vis.burglar.root.visible = true;

      if (vis.copCar && vis.roadPath.length > 0) {
        const travelDur = Math.min(5.0, inc.maxSec * 0.4);
        const tNorm = Math.min(1, inc.progressSec / Math.max(0.5, travelDur));
        const idxFloat = tNorm * (vis.roadPath.length - 1);
        const idx0 = Math.floor(idxFloat);
        const idx1 = Math.min(vis.roadPath.length - 1, idx0 + 1);
        const frac = idxFloat - idx0;

        const [x0, z0] = gridToWorldCenter(vis.roadPath[idx0][0], vis.roadPath[idx0][1], 1, 1);
        const [x1, z1] = gridToWorldCenter(vis.roadPath[idx1][0], vis.roadPath[idx1][1], 1, 1);
        const rawCx = THREE.MathUtils.lerp(x0, x1, frac);
        const rawCz = THREE.MathUtils.lerp(z0, z1, frac);
        const [cx, cz] = this.resolveBuildingCollision(rawCx, rawCz, 0.65);
        vis.copCar.position.set(cx, VOXEL_SIZE + 0.02, cz);

        const dx = x1 - x0;
        const dz = z1 - z0;
        if (Math.hypot(dx, dz) > 0.01) {
          const targetCopAngle = Math.atan2(dx, dz);
          const diff = Math.atan2(
            Math.sin(targetCopAngle - vis.copAngle),
            Math.cos(targetCopAngle - vis.copAngle),
          );
          vis.copAngle += diff * Math.min(1, dt * 12);
          vis.copCar.rotation.y = vis.copAngle;
        }

        // Flash red & blue police sirens and activate headlights!
        const flash = Math.floor(elapsed * 10) % 2 === 0;
        if (vis.sirenRed) vis.sirenRed.visible = flash;
        if (vis.sirenBlue) vis.sirenBlue.visible = !flash;
        const lightsOn = this.gameState.timeOfDay < 6.5 || this.gameState.timeOfDay > 17.5 || tNorm < 1;
        if (vis.headlightL) vis.headlightL.visible = lightsOn;
        if (vis.headlightR) vis.headlightR.visible = lightsOn;

        // Articulated Police Officer hops out once the cruiser arrives and chases the fleeing burglar!
        if (vis.copOfficer) {
          vis.copOfficer.root.visible = inc.policeArrived;
          if (inc.policeArrived) {
            const copAng = orbitAng - 0.85;
            const rawOx = tx + Math.cos(copAng) * (rx + 0.15);
            const rawOz = tz + Math.sin(copAng) * (rz + 0.15);
            const [ox, oz] = this.resolveBuildingCollision(rawOx, rawOz, 0.45);
            const copStride = Math.sin(elapsed * 16 + 0.7);
            vis.copOfficer.root.position.set(
              ox,
              VOXEL_SIZE + Math.abs(copStride) * 0.12,
              oz,
            );
            const chaseAngle = Math.atan2(bx - ox, bz - oz);
            const cDiff = Math.atan2(
              Math.sin(chaseAngle - vis.officerAngle),
              Math.cos(chaseAngle - vis.officerAngle),
            );
            vis.officerAngle += cDiff * Math.min(1, dt * 14);
            vis.copOfficer.root.rotation.y = vis.officerAngle;
            vis.copOfficer.leftLeg.rotation.x = copStride * 0.75;
            vis.copOfficer.rightLeg.rotation.x = -copStride * 0.75;
            vis.copOfficer.leftArm.rotation.x = -copStride * 0.65;
            vis.copOfficer.rightArm.rotation.x = copStride * 0.65;

            if (!vis.captureBurstDone && inc.progressSec >= inc.maxSec - 0.8) {
              vis.captureBurstDone = true;
              this.spawnCelebrationBurst(bx, VOXEL_SIZE + 0.9, bz, 10, 0x38bdf8);
            }
          }
        }
      }
    }
  }

  private createAttackUnitGroup(kind: "ship" | "tank" | "soldier"): THREE.Group {
    const grp = new THREE.Group();
    const hullMat = new THREE.MeshLambertMaterial({ color: 0x3b4048 });
    const crimsonMat = new THREE.MeshLambertMaterial({ color: 0xc83434 });
    const armorMat = new THREE.MeshLambertMaterial({ color: 0x4b5340 });

    if (kind === "ship") {
      const hull = new THREE.Mesh(this.unitCubeGeo, hullMat);
      hull.scale.set(2.4, 0.9, 6.2);
      hull.position.y = 0.25;
      grp.add(hull);
      const bridge = new THREE.Mesh(this.unitCubeGeo, crimsonMat);
      bridge.scale.set(1.4, 1.1, 1.8);
      bridge.position.set(0, 1.1, -0.6);
      grp.add(bridge);
      const turret = new THREE.Mesh(this.unitCubeGeo, hullMat);
      turret.scale.set(0.45, 0.45, 1.6);
      turret.position.set(0, 0.95, 1.8);
      grp.add(turret);
    } else if (kind === "tank") {
      const body = new THREE.Mesh(this.unitCubeGeo, armorMat);
      body.scale.set(1.25, 0.6, 1.8);
      body.position.y = 0.35;
      grp.add(body);
      const turret = new THREE.Mesh(this.unitCubeGeo, crimsonMat);
      turret.scale.set(0.8, 0.45, 0.9);
      turret.position.y = 0.85;
      grp.add(turret);
      const barrel = new THREE.Mesh(this.unitCubeGeo, hullMat);
      barrel.scale.set(0.18, 0.18, 1.35);
      barrel.position.set(0, 0.85, 0.9);
      grp.add(barrel);
    } else {
      const body = new THREE.Mesh(this.unitCubeGeo, crimsonMat);
      body.scale.set(0.32, 0.55, 0.24);
      body.position.y = 0.35;
      grp.add(body);
      const helmet = new THREE.Mesh(this.unitCubeGeo, hullMat);
      helmet.scale.set(0.28, 0.22, 0.28);
      helmet.position.y = 0.72;
      grp.add(helmet);
    }
    return grp;
  }

  private createDefenderUnitGroup(kind: string): {
    grp: THREE.Group;
    sirenA?: THREE.Mesh;
    sirenB?: THREE.Mesh;
  } {
    const grp = new THREE.Group();
    const oliveMat = new THREE.MeshLambertMaterial({ color: 0x4b7f3e });
    const darkGreenMat = new THREE.MeshLambertMaterial({ color: 0x2f5327 });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x4b5563 });
    const navyMat = new THREE.MeshLambertMaterial({ color: 0x2563eb });
    const swatMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
    const badgeGoldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    if (kind === "boat") {
      const hull = new THREE.Mesh(this.unitCubeGeo, steelMat);
      hull.scale.set(1.9, 0.75, 4.8);
      hull.position.y = 0.2;
      grp.add(hull);
      const cabin = new THREE.Mesh(this.unitCubeGeo, navyMat);
      cabin.scale.set(1.15, 0.9, 1.45);
      cabin.position.set(0, 0.9, -0.4);
      grp.add(cabin);
      const turret = new THREE.Mesh(this.unitCubeGeo, oliveMat);
      turret.scale.set(0.35, 0.35, 1.35);
      turret.position.set(0, 0.78, 1.4);
      grp.add(turret);
      return { grp };
    }

    if (kind === "tank") {
      const body = new THREE.Mesh(this.unitCubeGeo, oliveMat);
      body.scale.set(1.25, 0.58, 1.75);
      body.position.y = 0.32;
      grp.add(body);
      const turret = new THREE.Mesh(this.unitCubeGeo, darkGreenMat);
      turret.scale.set(0.78, 0.45, 0.88);
      turret.position.y = 0.82;
      grp.add(turret);
      const barrel = new THREE.Mesh(this.unitCubeGeo, steelMat);
      barrel.scale.set(0.16, 0.16, 1.35);
      barrel.position.set(0, 0.82, 0.9);
      grp.add(barrel);
      return { grp };
    }

    if (kind === "cop_car") {
      const built = this.createPoliceCarGroup();
      return { grp: built.car, sirenA: built.sirenRed, sirenB: built.sirenBlue };
    }

    if (kind === "swat_car") {
      const van = new THREE.Mesh(this.unitCubeGeo, swatMat);
      van.scale.set(0.92, 0.62, 1.65);
      van.position.y = 0.38;
      grp.add(van);
      const cab = new THREE.Mesh(this.unitCubeGeo, steelMat);
      cab.scale.set(0.76, 0.25, 0.72);
      cab.position.y = 0.78;
      grp.add(cab);
      const sirenA = new THREE.Mesh(
        this.unitCubeGeo,
        new THREE.MeshBasicMaterial({ color: 0x3b82f6 }),
      );
      sirenA.scale.set(0.24, 0.14, 0.18);
      sirenA.position.set(-0.16, 0.95, 0);
      grp.add(sirenA);
      const sirenB = new THREE.Mesh(
        this.unitCubeGeo,
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
      );
      sirenB.scale.set(0.24, 0.14, 0.18);
      sirenB.position.set(0.16, 0.95, 0);
      grp.add(sirenB);
      return { grp, sirenA, sirenB };
    }

    if (kind === "cop") {
      const body = new THREE.Mesh(this.unitCubeGeo, navyMat);
      body.scale.set(0.3, 0.52, 0.22);
      body.position.y = 0.34;
      grp.add(body);
      const cap = new THREE.Mesh(this.unitCubeGeo, new THREE.MeshLambertMaterial({ color: 0x1e3a8a }));
      cap.scale.set(0.28, 0.18, 0.28);
      cap.position.y = 0.72;
      grp.add(cap);
      const badge = new THREE.Mesh(this.unitCubeGeo, badgeGoldMat);
      badge.scale.set(0.1, 0.1, 0.1);
      badge.position.set(0, 0.5, 0.14);
      grp.add(badge);
      return { grp };
    }

    if (kind === "swat") {
      const body = new THREE.Mesh(this.unitCubeGeo, swatMat);
      body.scale.set(0.36, 0.56, 0.28);
      body.position.y = 0.35;
      grp.add(body);
      const helmet = new THREE.Mesh(this.unitCubeGeo, steelMat);
      helmet.scale.set(0.3, 0.24, 0.3);
      helmet.position.y = 0.74;
      grp.add(helmet);
      const visor = new THREE.Mesh(this.unitCubeGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      visor.scale.set(0.24, 0.08, 0.06);
      visor.position.set(0, 0.72, 0.16);
      grp.add(visor);
      return { grp };
    }

    // Default: Defending Military Soldier
    const body = new THREE.Mesh(this.unitCubeGeo, oliveMat);
    body.scale.set(0.32, 0.55, 0.24);
    body.position.y = 0.35;
    grp.add(body);
    const helmet = new THREE.Mesh(this.unitCubeGeo, darkGreenMat);
    helmet.scale.set(0.28, 0.22, 0.28);
    helmet.position.y = 0.72;
    grp.add(helmet);
    return { grp };
  }

  private syncAttackVisuals(): void {
    const units = this.gameState.activeAttack?.units ?? [];
    const activeIds = new Set(units.map((u) => u.id));

    for (const [id, grp] of this.attackVisuals.entries()) {
      if (!activeIds.has(id)) {
        this.spawnCelebrationBurst(grp.position.x, grp.position.y + 0.8, grp.position.z, 10, 0xff7426);
        this.attackGroup.remove(grp);
        this.attackVisuals.delete(id);
      }
    }

    for (const u of units) {
      if (!this.attackVisuals.has(u.id)) {
        const grp = this.createAttackUnitGroup(u.kind);
        grp.position.set(u.x, u.kind === "ship" ? -0.45 : 0.15, u.z);
        this.attackGroup.add(grp);
        this.attackVisuals.set(u.id, grp);
      }
    }

    // Sync defending Soldiers, Tanks, Naval Boats, Police & SWAT
    const defenders = this.gameState.activeAttack?.defenders ?? [];
    const activeDefIds = new Set(defenders.map((d) => d.id));

    for (const [id, vis] of this.defenderVisuals.entries()) {
      if (!activeDefIds.has(id)) {
        this.spawnCelebrationBurst(vis.grp.position.x, vis.grp.position.y + 0.7, vis.grp.position.z, 6, 0x38bdf8);
        this.attackGroup.remove(vis.grp);
        this.defenderVisuals.delete(id);
      }
    }

    for (const d of defenders) {
      if (!this.defenderVisuals.has(d.id)) {
        const built = this.createDefenderUnitGroup(d.kind);
        built.grp.position.set(d.x, d.kind === "boat" ? -0.42 : 0.15, d.z);
        this.attackGroup.add(built.grp);
        this.defenderVisuals.set(d.id, { ...built, kind: d.kind });
      }
    }
  }

  private stepAttackAnimations(dt: number, elapsed: number): void {
    const atk = this.gameState.activeAttack;
    if (!atk) return;

    this.attackBoltAccum += dt;
    const emitBolt = this.attackBoltAccum >= 0.45;
    if (emitBolt) this.attackBoltAccum = 0;

    this.defenderBoltAccum += dt;
    const emitDefBolt = this.defenderBoltAccum >= 0.42;
    if (emitDefBolt) this.defenderBoltAccum = 0;

    for (const u of atk.units) {
      const grp = this.attackVisuals.get(u.id);
      if (!grp) continue;

      const bob = u.kind === "ship" ? Math.sin(elapsed * 2.2 + u.x) * 0.12 - 0.45 : u.kind === "soldier" ? Math.abs(Math.sin(elapsed * 9 + u.x)) * 0.14 : 0.05;
      const dx = u.x - grp.position.x;
      const dz = u.z - grp.position.z;
      grp.position.x = THREE.MathUtils.lerp(grp.position.x, u.x, Math.min(1, dt * 6));
      grp.position.z = THREE.MathUtils.lerp(grp.position.z, u.z, Math.min(1, dt * 6));
      grp.position.y = bob;

      if (Math.hypot(dx, dz) > 0.02) {
        grp.rotation.y = Math.atan2(dx, dz);
      }

      if (emitBolt && u.targetElementId) {
        const targ = this.gameState.elements.find((e) => e.id === u.targetElementId);
        if (targ) {
          const [tx, tz] = gridToWorldCenter(targ.gx, targ.gz, targ.spanX, targ.spanZ);
          const bMat = new THREE.MeshBasicMaterial({ color: u.kind === "ship" ? 0xffbe3b : 0xff4b2b });
          const bolt = new THREE.Mesh(this.unitCubeGeo, bMat);
          bolt.scale.set(0.24, 0.24, 0.24);
          bolt.position.set(grp.position.x, grp.position.y + 0.9, grp.position.z);
          this.fxGroup.add(bolt);
          const d = Math.max(1, Math.hypot(tx - grp.position.x, tz - grp.position.z));
          const spd = 34;
          this.particles.push({
            mesh: bolt,
            vx: ((tx - grp.position.x) / d) * spd,
            vy: 3.8,
            vz: ((tz - grp.position.z) / d) * spd,
            life: 0,
            maxLife: Math.min(1.4, d / spd),
            gravity: 6.5,
          });
        }
      }
    }

    // Step island defenders (Soldiers, Tanks, Patrol Boats, Policemen, Police Cars, SWAT & SWAT Cars)
    const sirenFlash = Math.floor(elapsed * 10) % 2 === 0;
    for (const defU of atk.defenders ?? []) {
      const vis = this.defenderVisuals.get(defU.id);
      if (!vis) continue;
      const { grp, sirenA, sirenB } = vis;

      const isFoot = defU.kind === "soldier" || defU.kind === "cop" || defU.kind === "swat";
      const bob =
        defU.kind === "boat"
          ? Math.sin(elapsed * 2.4 + defU.x) * 0.11 - 0.42
          : isFoot
            ? Math.abs(Math.sin(elapsed * 10 + defU.x)) * 0.14
            : 0.05;

      const dx = defU.x - grp.position.x;
      const dz = defU.z - grp.position.z;
      grp.position.x = THREE.MathUtils.lerp(grp.position.x, defU.x, Math.min(1, dt * 6));
      grp.position.z = THREE.MathUtils.lerp(grp.position.z, defU.z, Math.min(1, dt * 6));
      grp.position.y = bob;

      if (Math.hypot(dx, dz) > 0.02) {
        grp.rotation.y = Math.atan2(dx, dz);
      }

      if (sirenA) sirenA.visible = sirenFlash;
      if (sirenB) sirenB.visible = !sirenFlash;

      if (emitDefBolt && defU.targetUnitId) {
        const enemy = atk.units.find((e) => e.id === defU.targetUnitId);
        if (enemy) {
          const col =
            defU.kind === "cop" || defU.kind === "cop_car" || defU.kind === "swat" || defU.kind === "swat_car"
              ? 0x38bdf8
              : 0x4ade80;
          const bMat = new THREE.MeshBasicMaterial({ color: col });
          const bolt = new THREE.Mesh(this.unitCubeGeo, bMat);
          bolt.scale.set(0.22, 0.22, 0.22);
          bolt.position.set(grp.position.x, grp.position.y + 0.85, grp.position.z);
          this.fxGroup.add(bolt);
          const dist = Math.max(1, Math.hypot(enemy.x - grp.position.x, enemy.z - grp.position.z));
          const spd = 38;
          this.particles.push({
            mesh: bolt,
            vx: ((enemy.x - grp.position.x) / dist) * spd,
            vy: 2.6,
            vz: ((enemy.z - grp.position.z) / dist) * spd,
            life: 0,
            maxLife: Math.min(1.2, dist / spd),
            gravity: 4.5,
          });
        }
      }
    }
  }

  // ===================== CAMERA & INPUT EVENTS =====================

  private updateCameraTransform(): void {
    if (this.cameraMode === "walk") {
      this.camera.position.copy(this.walkPos);
      const lookDir = new THREE.Vector3(
        Math.sin(this.walkYaw) * Math.cos(this.walkPitch),
        Math.sin(this.walkPitch),
        Math.cos(this.walkYaw) * Math.cos(this.walkPitch),
      );
      this.camera.lookAt(this.walkPos.clone().add(lookDir));
      return;
    }

    this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius, 5.5, 250);
    this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi, 0.22, 1.44);
    this.target.x = THREE.MathUtils.clamp(this.target.x, -145, 145);
    this.target.y = THREE.MathUtils.clamp(this.target.y, 0, 14);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -145, 145);

    const sinPhi = Math.sin(this.spherical.phi);
    this.camera.position.set(
      this.target.x + this.spherical.radius * sinPhi * Math.sin(this.spherical.theta),
      this.target.y + this.spherical.radius * Math.cos(this.spherical.phi),
      this.target.z + this.spherical.radius * sinPhi * Math.cos(this.spherical.theta),
    );
    this.camera.lookAt(this.target);
  }

  private handleKeyboardNavigation(dt: number): void {
    if (this.keysDown.size === 0) return;

    const zoomIn = this.keysDown.has("Equal") || this.keysDown.has("NumpadAdd");
    const zoomOut = this.keysDown.has("Minus") || this.keysDown.has("NumpadSubtract");
    if (zoomIn || zoomOut) {
      const factor = zoomIn ? Math.pow(0.45, dt) : Math.pow(2.1, dt);
      this.zoomBy(factor);
    }

    const spinLeft = this.keysDown.has("KeyQ");
    const spinRight = this.keysDown.has("KeyE");
    if (spinLeft || spinRight) {
      this.rotateCameraBy((spinLeft ? -1 : 1) * dt * 1.45);
    }

    const forwardInput =
      (this.keysDown.has("KeyW") || this.keysDown.has("ArrowUp") ? 1 : 0) -
      (this.keysDown.has("KeyS") || this.keysDown.has("ArrowDown") ? 1 : 0);
    const rightInput =
      (this.keysDown.has("KeyD") || this.keysDown.has("ArrowRight") ? 1 : 0) -
      (this.keysDown.has("KeyA") || this.keysDown.has("ArrowLeft") ? 1 : 0);

    if (forwardInput === 0 && rightInput === 0) return;

    if (this.cameraMode === "walk") {
      const spd = 18 * dt;
      const fwd = new THREE.Vector3(Math.sin(this.walkYaw), 0, Math.cos(this.walkYaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      this.walkPos.addScaledVector(fwd, forwardInput * spd);
      this.walkPos.addScaledVector(right, rightInput * spd);
      this.walkPos.x = THREE.MathUtils.clamp(this.walkPos.x, -125, 125);
      this.walkPos.z = THREE.MathUtils.clamp(this.walkPos.z, -125, 125);
      this.updateCameraTransform();
    } else {
      const spd = this.spherical.radius * 0.65 * dt;
      const fwd = new THREE.Vector3(-Math.sin(this.spherical.theta), 0, -Math.cos(this.spherical.theta));
      const right = new THREE.Vector3(Math.cos(this.spherical.theta), 0, -Math.sin(this.spherical.theta));
      this.target.addScaledVector(fwd, forwardInput * spd);
      this.target.addScaledVector(right, rightInput * spd);
      this.target.y = THREE.MathUtils.lerp(this.target.y, 0, Math.min(1, dt * 4));
      this.updateCameraTransform();
    }
  }

  private computePointerGrid(clientX: number, clientY: number): [number, number] | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    const [gx, gz] = worldToGrid(hit.x, hit.z);
    if (gx < GRID_MIN || gx > GRID_MAX || gz < GRID_MIN || gz > GRID_MAX) return null;
    return [gx, gz];
  }

  private raycastPlacedElement(clientX: number, clientY: number): string | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.placedGroup.children, true);
    for (const h of hits) {
      let cur: THREE.Object3D | null = h.object;
      while (cur) {
        if (cur.userData?.elementId) {
          const elId = cur.userData.elementId as string;
          if (this.selectionFilter !== "all") {
            const el = this.gameState.elements.find((item) => item.id === elId);
            const def = el ? ELEMENT_BY_ID[el.defId] : undefined;
            if (def && !matchesSelectionFilter(def, this.selectionFilter)) {
              break; // Skip dimmed layers so clicks hit underlying roads/pipes/utilities
            }
          }
          return elId;
        }
        cur = cur.parent;
      }
    }
    return null;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.activePointers.size >= 2) {
      const pts = Array.from(this.activePointers.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      this.lastPinchDist = Math.hypot(dx, dy);
      this.lastPinchAngle = Math.atan2(dy, dx);
      this.lastPinchMid = {
        x: (pts[0].x + pts[1].x) * 0.5,
        y: (pts[0].y + pts[1].y) * 0.5,
      };
      this.hadMultiTouch = true;
      this.isPointerDown = false;
      this.isDraggingCamera = true;
      return;
    }

    this.hadMultiTouch = false;
    this.isPointerDown = true;
    this.pointerButton = e.button;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.lastPointerPos = { x: e.clientX, y: e.clientY };
    this.isDraggingCamera = false;
    this.paintedTilesInStroke.clear();

    const g = this.computePointerGrid(e.clientX, e.clientY);
    this.hoverGrid = g;
    this.updateHoverOverlay();

    // Support continuous click-drag painting for 1x1 roads, paths, tracks & starter tiles on left button!
    if (e.button === 0 && this.brush.kind === "place" && this.brush.defId && g) {
      const def = ELEMENT_BY_ID[this.brush.defId];
      if (def?.isNetwork) {
        const key = `${g[0]},${g[1]}`;
        this.paintedTilesInStroke.add(key);
        this.lastPaintedGrid = [g[0], g[1]];
        this.callbacks.onTilePlace(g[0], g[1]);
      }
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (this.activePointers.size >= 2) {
      const pts = Array.from(this.activePointers.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const mid = {
        x: (pts[0].x + pts[1].x) * 0.5,
        y: (pts[0].y + pts[1].y) * 0.5,
      };

      if (this.lastPinchDist && dist > 6) {
        const ratio = this.lastPinchDist / dist;
        this.zoomBy(THREE.MathUtils.clamp(ratio, 0.85, 1.18));
      }

      if (this.lastPinchAngle !== null) {
        const diff = Math.atan2(
          Math.sin(angle - this.lastPinchAngle),
          Math.cos(angle - this.lastPinchAngle),
        );
        if (Math.abs(diff) > 0.001) {
          this.rotateCameraBy(-diff);
        }
      }

      if (this.lastPinchMid !== null) {
        const midDy = mid.y - this.lastPinchMid.y;
        if (Math.abs(midDy) > 0.25) {
          if (this.cameraMode === "walk") {
            this.walkPitch = THREE.MathUtils.clamp(this.walkPitch - midDy * 0.004, -1.1, 0.9);
          } else {
            this.spherical.phi += midDy * 0.0045;
          }
          this.updateCameraTransform();
        }
      }

      this.lastPinchDist = dist;
      this.lastPinchAngle = angle;
      this.lastPinchMid = mid;
      return;
    }

    const g = this.computePointerGrid(e.clientX, e.clientY);
    if (!this.hoverGrid || !g || this.hoverGrid[0] !== g[0] || this.hoverGrid[1] !== g[1]) {
      this.hoverGrid = g;
      this.updateHoverOverlay();
    }

    if (!this.isPointerDown) return;

    const dx = e.clientX - this.lastPointerPos.x;
    const dy = e.clientY - this.lastPointerPos.y;
    this.lastPointerPos = { x: e.clientX, y: e.clientY };

    // Left-drag continuous Manhattan painting when placing roads/paths/tracks (zero gaps on fast sweeps!)
    if (this.pointerButton === 0 && this.brush.kind === "place" && this.brush.defId) {
      const def = ELEMENT_BY_ID[this.brush.defId];
      if (def?.isNetwork && g) {
        const [tx, tz] = g;
        if (!this.lastPaintedGrid) {
          this.lastPaintedGrid = [tx, tz];
          const key = `${tx},${tz}`;
          if (!this.paintedTilesInStroke.has(key)) {
            this.paintedTilesInStroke.add(key);
            this.callbacks.onTilePlace(tx, tz);
          }
        } else {
          let [cx, cz] = this.lastPaintedGrid;
          let guard = 0;
          while ((cx !== tx || cz !== tz) && guard < 40) {
            guard += 1;
            if (cx !== tx) {
              cx += Math.sign(tx - cx);
            } else if (cz !== tz) {
              cz += Math.sign(tz - cz);
            }
            const key = `${cx},${cz}`;
            if (!this.paintedTilesInStroke.has(key)) {
              this.paintedTilesInStroke.add(key);
              this.callbacks.onTilePlace(cx, cz);
            }
          }
          this.lastPaintedGrid = [tx, tz];
        }
        return;
      }
    }

    const totalDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (totalDist > 5) {
      this.isDraggingCamera = true;
    }

    if (!this.isDraggingCamera) return;

    if (this.cameraMode === "walk") {
      this.walkYaw -= dx * 0.0045;
      this.walkPitch = THREE.MathUtils.clamp(this.walkPitch - dy * 0.0035, -1.1, 0.9);
      this.updateCameraTransform();
      return;
    }

    const wantOrbit =
      this.pointerButton === 2 ||
      (this.pointerButton === 0 && (this.cameraMode === "orbit" || e.altKey));

    if (wantOrbit) {
      this.spherical.theta -= dx * 0.0065;
      this.spherical.phi -= dy * 0.0055;
    } else {
      const panScale = this.spherical.radius * 0.0016;
      const right = new THREE.Vector3(Math.cos(this.spherical.theta), 0, -Math.sin(this.spherical.theta));
      const fwd = new THREE.Vector3(-Math.sin(this.spherical.theta), 0, -Math.cos(this.spherical.theta));
      this.target.addScaledVector(right, -dx * panScale);
      this.target.addScaledVector(fwd, dy * panScale);
      this.target.y = THREE.MathUtils.lerp(this.target.y, 0, 0.15);
    }
    this.updateCameraTransform();
  };

  private onPointerUp = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDist = null;
      this.lastPinchAngle = null;
      this.lastPinchMid = null;
    }

    if (this.hadMultiTouch) {
      if (this.activePointers.size === 0) {
        this.hadMultiTouch = false;
      }
      this.isPointerDown = false;
      this.isDraggingCamera = false;
      this.lastPaintedGrid = null;
      return;
    }

    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    this.lastPaintedGrid = null;

    if (!this.isDraggingCamera && e.button === 0) {
      const g = this.computePointerGrid(e.clientX, e.clientY);
      if (this.brush.kind === "move" && this.brush.movingElementId && g) {
        this.callbacks.onTileMoveCommit(this.brush.movingElementId, g[0], g[1]);
      } else if (this.brush.kind === "place" && this.brush.defId && g) {
        const def = ELEMENT_BY_ID[this.brush.defId];
        if (!def?.isNetwork) {
          this.callbacks.onTilePlace(g[0], g[1]);
        }
      } else {
        const hitId = this.raycastPlacedElement(e.clientX, e.clientY);
        this.callbacks.onSelectElement(hitId, e.shiftKey);
      }
    }
  };

  private onPointerCancel = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDist = null;
      this.lastPinchAngle = null;
      this.lastPinchMid = null;
    }
    if (this.activePointers.size === 0) {
      this.hadMultiTouch = false;
      this.isPointerDown = false;
      this.isDraggingCamera = false;
      this.lastPaintedGrid = null;
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rawDelta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaMode === 2 ? e.deltaY * 120 : e.deltaY;
    const clamped = THREE.MathUtils.clamp(rawDelta, -180, 180);
    const factor = 1 + clamped * 0.0016;

    if (this.cameraMode === "walk") {
      this.zoomBy(factor);
      return;
    }

    // Gently pull target toward cursor ground intersection when zooming in on an element!
    if (clamped < 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
        const pull = Math.min(0.22, Math.abs(clamped) * 0.0014);
        this.target.x = THREE.MathUtils.lerp(this.target.x, hit.x, pull);
        this.target.z = THREE.MathUtils.lerp(this.target.z, hit.z, pull);
      }
    } else {
      this.target.y = THREE.MathUtils.lerp(this.target.y, 0, 0.12);
    }

    this.zoomBy(factor);
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
  };

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private bindEvents(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerCancel);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
  }

  public dispose(): void {
    this.disposed = true;
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    this.unitCubeGeo.dispose();
    this.wrenchMat.dispose();
    this.disconnectMat.dispose();
    this.crimeDarkMat.dispose();
    this.crimeStripeMat.dispose();
    this.crimeSkinMat.dispose();
    this.crimeLootMat.dispose();
    this.crimeCrowbarMat.dispose();
    this.crimeAlertMat.dispose();
    this.copBlackMat.dispose();
    this.copWhiteMat.dispose();
    this.copNavyMat.dispose();
    this.copCapMat.dispose();
    this.copGoldMat.dispose();
    this.copHeadlightMat.dispose();
    this.sirenRedMat.dispose();
    this.sirenBlueMat.dispose();
    this.renderer.dispose();
  }
}
