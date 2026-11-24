import { editedCoastline } from "./coastline";
import { GRID_SIZE, GRID_HALF } from "./mapBounds";
import { patrolPosition } from "./policeDispatch";
import { getTravelNetwork, travelSignature, type TravelNetwork } from "./travelNetwork";
import { advanceCarSegment, departureInterval, getRoadTripNetwork, roadTripPoints, trafficFleetTarget, type RoadTrip, type RoadTripNetwork, type TripPoint } from "./roadTraffic";
import { FarmActivityVisuals } from "./farmActivity";
import { MobilityVisuals, voyagePlacement } from "./mobilityVisuals";
import { PatrolCraftManager } from "./patrolCraft";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  type CivElementDef,
  ELEMENT_BY_ID,
} from "./catalog";
import {
  GRID_MAX,
  GRID_MIN,
  type GameState,
  type HeatmapKind,
  type PlacedElement,
  type SelectionFilter,
  planConstruction,
  maintenanceStatus,
  planRelocation,
  planGroupRelocation,
  buildOccupancyMap,
  computeHeatmapCells,
  getConnectedRoadCoordSet,
  getTrafficLoadMap,
  getNetworkConnMask,
  gridToWorldCenter,
  islandMarginAtWorld,
  matchesSelectionFilter,
  worldToGrid,
} from "./simulation";
import { TempleLights } from "./faithVisuals";
import { EngineeringView, VOXEL_EARTH, VOXEL_EARTH_SIDE, maskOceanFragment } from "./engineeringView";
import { elevationFromMargin, getTerrainCell, planInfrastructureStroke, registerRoadDemand, roadPortOpen, roadTravelOpen, surfaceTravelHeight, tileKey, type InfrastructureTool, type GridPoint } from "./terrain";
import { VOXELS_PER_TILE, VOXEL_PITCH, effectiveVoxelRadius, isVoxelSculptTool, sampleTerrainAt, worldToVoxel } from "./voxelTerrain";
import { detectCoastRotation, getTerrainInteractionProfile, stripsFlatGroundSlabInWorld } from "./terrainInteraction";
import { networkRoadProfile } from "./designs/networks";
import { planFirstStreetFacing } from "./streetFacing";
import { encodeRoadSitePort } from "./roadTopology";
import { cellBeyondEdge, getParcelEdgeKey, getParcelEdges } from "./parcelEdges";
import { getParcelSoils } from "./parcelGeometry";
import {roadBounds,corridorArt,strokeRoadAxis} from "./roadCorridors";
import { buildPlacedGroupFromAsset, getOrBuildElementAsset, releaseParcelGeometry } from "./voxelArchitect";
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

export interface SelectionRingProjection {
  x: number;
  y: number;
  radiusPx: number;
  visible: boolean;
}

export interface SelectionRingBox {
  gx: number;
  gz: number;
  spanX: number;
  spanZ: number;
  baseY?: number;
  topY?: number;
}

export interface IslandCameraView {
  mode: CameraMode;
  target: [number, number, number];
  radius: number;
  theta: number;
  phi: number;
  walk: [number, number, number];
  yaw: number;
  pitch: number;
  fov: number;
  autoSpin: boolean;
}

export interface BuildBrush {
  kind: "place" | "move" | "none";
  defId?: string;
  level: number;
  /** -1 means random variant on each placement (default in Real/Survival, optional in God) */
  variantMode: number;
  rotation: number;
  movingElementId?: string;
  movingGroupIds?: readonly string[];
  groupDestination?: [number, number];
  faceManually?: boolean;
}

export type BulkSelectFilter = "all" | "roads" | "buildings";

export interface PendingNetworkStroke {
  defId: string;
  points: GridPoint[];
}

export interface WorldCallbacks {
  onInfrastructureStroke?: (tool:InfrastructureTool,points:GridPoint[])=>void;
  onTilePlace: (gx: number, gz: number) => void;
  onPendingNetworkStroke?: (stroke: PendingNetworkStroke) => void;
  onCancelPendingStroke?: () => void;
  onBulkSelectElements?: (ids: string[], mode: "add" | "toggle") => void;
  onGroupMoveTarget?: (gx: number, gz: number) => void;
  onTileMoveCommit: (elementId: string, gx: number, gz: number) => void;
  onInspectTile?: (gx:number,gz:number)=>boolean|void;
  onSelectService?: (id: string) => void;
  onFollowChange?: (id?: string) => void;
  onSelectElement: (elementId: string | null, additiveShift: boolean) => void;
  onEmptyTileTap?: (gx: number, gz: number) => void;
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
  id: number;
  kind: RoadVehicleKind;
  trip: RoadTrip;
  points: TripPoint[];
  mesh: THREE.Mesh;
  segment: number;
  progress: number;
  velocity: number;
  speed: number;
  dwell: number;
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

function getVehicleGeometry(kind: RoadVehicleKind, variantSeed: number): THREE.BufferGeometry {
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
      const body="#257d77",cream="#f8e6bb",window="#416478";
      v.box(-3,1,-9,3,5,9,body);
      v.box(-3,5,-8,3,7,8,cream);
      for(const z of [-7,-4,-1,2,5])v.box(-3,5,z,3,6,z+1,window,.17);
      v.box(-2,5,9,2,6,9,window,.17);
      v.box(-2,7,9,2,7,9,"#fbd284",.6);
      v.box(3,2,5,3,6,7,"#424f4d");v.box(3,5,5,3,6,6,"#80aeb0",.2);
      v.box(-2,8,-7,2,8,7,cream);v.box(-1,9,-3,1,9,0,"#a9b9ab");
      break;
    }
    case "taxi": {
      const yellow="#eeb237";
      v.box(-3,1,-6,3,3,6,yellow);v.box(-2,4,-3,2,5,2,"#466571",.18);
      v.box(-2,6,-2,2,6,1,yellow);v.box(-1,7,-1,1,7,0,"#fff3c2",.7);
      for(const x of [-3,3])for(let z=-4;z<4;z++)v.put(x,3,z,z%2?"#3d4140":"#f9eacd");
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

  if(["bus","taxi"].includes(kind)){
    const axle=kind==="bus"?6:4,nose=kind==="bus"?9:6;
    for(const x of [-3,3])for(const z of [-axle,axle])v.box(x,0,z-1,x,1,z+1,"rubber");
    for(const x of [-2,2]){v.put(x,2,nose,"warmGlow",.8);v.put(x,2,-nose,"#ce583d",.3);}
  }
  // Wheels
  const wz = kind === "bus" || kind === "truck" ? 4 : 3;
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
  private farmActivity: FarmActivityVisuals;
  private mobilityVisuals: MobilityVisuals;
  private following?: string;
  private activeTravel?: TravelNetwork;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl = false;
  private disposed = false;

  private callbacks: WorldCallbacks;
  private gameState: GameState;
  private brush: BuildBrush = { kind: "none", level: 1, variantMode: -1, rotation: 0 };
  private selectedIds: string[] = [];
  private quickBuildTile: GridPoint | null = null;

  // Camera state
  private cameraMode: CameraMode = "pan";
  private constructionTarget?: THREE.Vector3;
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

  private templeLights = new TempleLights();
  private engineering = new EngineeringView(true);
  private worksTool:InfrastructureTool|null=null;
  private hoverVoxel:[number,number]|null=null;
  private worksStroke:GridPoint[]=[];
  private worksAnchor:GridPoint|null=null;
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

  private coastlineTexture?:THREE.DataTexture;
  private naturalCoastline?:Uint8Array;
  private coastalStamp="";
  private renderedGeography?:number;
  private oceanUniforms = { uTime: { value: 0 }, uDaylight: { value: 1 } };
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
  private curbPreviews = new Map<string,{key:string; original:THREE.Group; ghost:THREE.Group; wasVisible:boolean}>();
  private cursorOutline: THREE.LineSegments;
  private groupOutline = new THREE.LineSegments(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ transparent: true, opacity: 0.92 }));
  private selectionOutlines: THREE.LineSegments[] = [];
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
  private patrolCraft = new PatrolCraftManager();
  // Cached network sets (recomputed only when the layout changes, not every frame)
  private roadTrips?: RoadTripNetwork;
  private cachedRoadSet = new Set<string>();
  private carSequence = 0;
  private routeCursor = 0;
  private departureTimer = 0;
  private carClock = 0;
  private availableAfter: number[] = [];
  /** Road deck height (m) per tile for bridges / overpasses so vehicles ride on top */
  private streets = new Map<string, { base: number; profile: ReturnType<typeof networkRoadProfile> }>();
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
  private pointerPanOverride = false;
  private spaceDown = false;
  private pendingTouchStart: { gx: number; gz: number; clientX: number; clientY: number } | null = null;
  private paintedTilesInStroke = new Set<string>();
  private lastPaintedGrid: [number, number] | null = null;
  private networkStroke: GridPoint[] = [];
  private pendingNetworkStroke: PendingNetworkStroke | null = null;
  private hasPendingBridgeConfirm = false;
  private pendingBridgeStroke: { tool: InfrastructureTool; points: GridPoint[] } | null = null;
  private cancelPendingOnTap = false;
  private networkPreviewGroup = new THREE.Group();
  private bulkSelectMode = false;
  private bulkSelectFilter: BulkSelectFilter = "all";
  private bulkStrokeIds = new Set<string>();
  private bulkLastGrid: [number, number] | null = null;
  private bulkHasDragged = false;
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist: number | null = null;
  private lastPinchAngle: number | null = null;
  private lastPinchMid: { x: number; y: number } | null = null;
  private hadMultiTouch = false;

  // Billboard selection ring observer & projection scratch
  private selectionRingObserver: ((pos: SelectionRingProjection | null) => void) | null = null;
  private customRingTarget: SelectionRingBox | null = null;
  private lastRingProjectionKey = "";
  private projVec = new THREE.Vector3();

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
    this.renderer.toneMappingExposure = 0.97;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Scene, Sky & Environment
    this.scene = new THREE.Scene();
    this.farmActivity = new FarmActivityVisuals(this.scene, () => this.camera);
    this.mobilityVisuals = new MobilityVisuals(this.scene, getVehicleGeometry);
    this.scene.background = new THREE.Color(0xc2e9ff);
    this.scene.fog = new THREE.FogExp2(0xd7f0ff, 0.0021);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    this.scene.environmentIntensity = 0.28;
    roomEnv.dispose();
    pmrem.dispose();

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.5, 2000);
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
    this.scene.add(this.engineering.group,this.engineering.preview,this.templeLights.group);
    this.buildWeatherVisuals();
    this.scene.add(this.islandGroup);
    this.scene.add(this.heatmapGroup);
    this.scene.add(this.placedGroup);
    this.scene.add(this.overlayGroup);
    this.scene.add(this.trafficGroup);
    this.scene.add(this.villagerGroup);
    this.scene.add(this.crimeGroup);
    this.scene.add(this.attackGroup);
    this.scene.add(this.patrolCraft.root);
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
    this.groupOutline.visible = false;
    this.overlayGroup.add(this.groupOutline);
    this.overlayGroup.add(this.networkPreviewGroup);

    this.bindEvents();
    this.syncState(initialState, []);
    this.scheduleNextFrame();
  }

  private buildIslandAndOcean(): void {
    this.renderedGeography = this.gameState.terrainVersion ?? 1;
    const size = GRID_SIZE * TILE_SIZE;
    const version = this.renderedGeography;

    // Native 0.25m voxel base island mesh:
    // - Interior flat grass plateaus emit merged quads shaded with exact 0.25m voxel micro-checker
    // - Every coastline, beach, cove, sandbar & shallow terrace is subdivided to true 0.25m voxel columns
    //   and 2D greedy-meshed with real vertical 0.25m step skirts (zero 4m grid, zero blurry 4m vertices!)
    const posArr: number[] = [];
    const normArr: number[] = [];
    const colArr: number[] = [];

    const topColors = [
      new THREE.Color(0x000000),
      new THREE.Color(VOXEL_EARTH.grass),
      new THREE.Color(VOXEL_EARTH.sand),
      new THREE.Color(0xd2b882), // wet shoreline sand
      new THREE.Color(0xb49668), // shallow submerged seabed
    ];
    const sideColors = [
      new THREE.Color(0x000000),
      new THREE.Color(VOXEL_EARTH_SIDE.grass),
      new THREE.Color(VOXEL_EARTH_SIDE.sand),
      new THREE.Color(0xa98d62),
      new THREE.Color(0x9c8259),
    ];

    const pushQuad = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number,
      dx: number, dy: number, dz: number,
      nx: number, ny: number, nz: number,
      c: THREE.Color,
    ) => {
      posArr.push(
        ax, ay, az, bx, by, bz, cx, cy, cz,
        ax, ay, az, cx, cy, cz, dx, dy, dz,
      );
      normArr.push(
        nx, ny, nz, nx, ny, nz, nx, ny, nz,
        nx, ny, nz, nx, ny, nz, nx, ny, nz,
      );
      const r = c.r, g = c.g, b = c.b;
      colArr.push(
        r, g, b, r, g, b, r, g, b,
        r, g, b, r, g, b, r, g, b,
      );
    };

    const PAD = VOXELS_PER_TILE + 2; // 18x18 padded column grid for seamless cross-chunk skirts
    const yGrid = new Float32Array(PAD * PAD);
    const bGrid = new Uint8Array(PAD * PAD);
    const visited = new Uint8Array(VOXELS_PER_TILE * VOXELS_PER_TILE);
    const grassTop = topColors[1];

    for (let gz = -GRID_HALF; gz < GRID_HALF; gz++) {
      const z0 = gz * TILE_SIZE;
      const z1 = z0 + TILE_SIZE;
      const zMid = z0 + TILE_SIZE * 0.5;
      for (let gx = -GRID_HALF; gx < GRID_HALF; gx++) {
        const x0 = gx * TILE_SIZE;
        const x1 = x0 + TILE_SIZE;
        const xMid = x0 + TILE_SIZE * 0.5;

        const m00 = islandMarginAtWorld(x0, z0, version);
        const m10 = islandMarginAtWorld(x1, z0, version);
        const m01 = islandMarginAtWorld(x0, z1, version);
        const m11 = islandMarginAtWorld(x1, z1, version);
        const mc = islandMarginAtWorld(xMid, zMid, version);
        const mMin = Math.min(m00, m10, m01, m11, mc);
        const mMax = Math.max(m00, m10, m01, m11, mc);

        // Deep seabed under opaque ocean: skip geometry
        if (mMax < -7.5) continue;

        // Flat interior grass plateau: 1 quad rendered with exact 0.25m voxel checker in fragment shader
        if (mMin >= 3.2) {
          pushQuad(x0, 0, z0, x0, 0, z1, x1, 0, z1, x1, 0, z0, 0, 1, 0, grassTop);
          continue;
        }

        // Coastal / shoreline / beach / terrace transition: true 0.25m voxel columns
        for (let pz = 0; pz < PAD; pz++) {
          const wz = z0 + (pz - 0.5) * VOXEL_PITCH;
          const rowOff = pz * PAD;
          for (let px = 0; px < PAD; px++) {
            const wx = x0 + (px - 0.5) * VOXEL_PITCH;
            const m = islandMarginAtWorld(wx, wz, version);
            const y = elevationFromMargin(m);
            const idx = rowOff + px;
            yGrid[idx] = y;
            if (y < -2.25) {
              bGrid[idx] = 0;
            } else if (m >= 2.2) {
              bGrid[idx] = 1;
            } else if (m >= 1.2 && y > -0.34) {
              bGrid[idx] = 2;
            } else if (y >= -0.62) {
              bGrid[idx] = 3;
            } else {
              bGrid[idx] = 4;
            }
          }
        }

        // 2D greedy meshing of 0.25m voxel top faces
        visited.fill(0);
        for (let lz = 0; lz < VOXELS_PER_TILE; lz++) {
          for (let lx = 0; lx < VOXELS_PER_TILE; lx++) {
            const vIdx = lz * VOXELS_PER_TILE + lx;
            if (visited[vIdx]) continue;
            const pIdx = (lz + 1) * PAD + (lx + 1);
            const bucket = bGrid[pIdx];
            if (bucket === 0) {
              visited[vIdx] = 1;
              continue;
            }
            const y = yGrid[pIdx];

            let w = 1;
            while (lx + w < VOXELS_PER_TILE) {
              const nV = lz * VOXELS_PER_TILE + (lx + w);
              const nP = (lz + 1) * PAD + (lx + w + 1);
              if (visited[nV] || bGrid[nP] !== bucket || yGrid[nP] !== y) break;
              w++;
            }

            let h = 1;
            outerH: while (lz + h < VOXELS_PER_TILE) {
              for (let dx = 0; dx < w; dx++) {
                const nV = (lz + h) * VOXELS_PER_TILE + (lx + dx);
                const nP = (lz + h + 1) * PAD + (lx + dx + 1);
                if (visited[nV] || bGrid[nP] !== bucket || yGrid[nP] !== y) break outerH;
              }
              h++;
            }

            for (let dz = 0; dz < h; dz++) {
              for (let dx = 0; dx < w; dx++) {
                visited[(lz + dz) * VOXELS_PER_TILE + (lx + dx)] = 1;
              }
            }

            const qx0 = x0 + lx * VOXEL_PITCH;
            const qz0 = z0 + lz * VOXEL_PITCH;
            const qx1 = qx0 + w * VOXEL_PITCH;
            const qz1 = qz0 + h * VOXEL_PITCH;
            pushQuad(qx0, y, qz0, qx0, y, qz1, qx1, y, qz1, qx1, y, qz0, 0, 1, 0, topColors[bucket]);
          }
        }

        // Exposed vertical 0.25m step skirts along every elevation drop
        for (let lz = 0; lz < VOXELS_PER_TILE; lz++) {
          const vz0 = z0 + lz * VOXEL_PITCH;
          const vz1 = vz0 + VOXEL_PITCH;
          const pRow = (lz + 1) * PAD;
          for (let lx = 0; lx < VOXELS_PER_TILE; lx++) {
            const pIdx = pRow + (lx + 1);
            const bucket = bGrid[pIdx];
            if (bucket === 0) continue;
            const y = yGrid[pIdx];
            const vx0 = x0 + lx * VOXEL_PITCH;
            const vx1 = vx0 + VOXEL_PITCH;
            const sc = sideColors[bucket];

            const nN = yGrid[pIdx - PAD];
            if (nN < y - 0.005) {
              pushQuad(vx0, nN, vz0, vx0, y, vz0, vx1, y, vz0, vx1, nN, vz0, 0, 0, -1, sc);
            }
            const nS = yGrid[pIdx + PAD];
            if (nS < y - 0.005) {
              pushQuad(vx1, nS, vz1, vx1, y, vz1, vx0, y, vz1, vx0, nS, vz1, 0, 0, 1, sc);
            }
            const nW = yGrid[pIdx - 1];
            if (nW < y - 0.005) {
              pushQuad(vx0, nW, vz1, vx0, y, vz1, vx0, y, vz0, vx0, nW, vz0, -1, 0, 0, sc);
            }
            const nE = yGrid[pIdx + 1];
            if (nE < y - 0.005) {
              pushQuad(vx1, nE, vz0, vx1, y, vz0, vx1, y, vz1, vx1, nE, vz1, 1, 0, 0, sc);
            }
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normArr, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colArr, 3));
    geo.computeBoundingSphere();

    const landMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.87,
      metalness: 0.0,
      flatShading: true,
    });

    this.engineering.patchLand(landMat, true);
    const landMesh = new THREE.Mesh(geo, landMat);
    landMesh.receiveShadow = !this.isSoftwareGl;
    this.islandGroup.add(landMesh);

    // High-resolution shoreline distance map (768x768 = 1m/texel, quantized to 0.25m voxels in ocean shader)
    const coastRes = GRID_SIZE * 4;
    const coast = new Uint8Array(coastRes * coastRes);
    const worldMin = -GRID_HALF * TILE_SIZE;
    const stepM = size / coastRes;
    for (let z = 0; z < coastRes; z++) {
      const wz = worldMin + (z + 0.5) * stepM;
      for (let x = 0; x < coastRes; x++) {
        const wx = worldMin + (x + 0.5) * stepM;
        const margin = islandMarginAtWorld(wx, wz, version);
        coast[z * coastRes + x] = Math.round(THREE.MathUtils.clamp((margin + 36) / 48, 0, 1) * 255);
      }
    }
    this.naturalCoastline = coast;
    this.coastalStamp = "";
    this.coastlineTexture = new THREE.DataTexture(coast, coastRes, coastRes, THREE.RedFormat);
    this.coastlineTexture.minFilter = this.coastlineTexture.magFilter = THREE.LinearFilter;
    this.coastlineTexture.needsUpdate = true;

    const oceanGeo = new THREE.PlaneGeometry(size * 4, size * 4, 1, 1);
    oceanGeo.rotateX(-Math.PI / 2);

    const oceanMat = new THREE.ShaderMaterial({
      uniforms: { ...this.oceanUniforms, uCoast: { value: this.coastlineTexture }, uWorksMask: { value: this.engineering.mask } },
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
        uniform sampler2D uWorksMask;
        uniform float uTime;
        uniform float uDaylight;
        varying vec3 vWorldPos;

        uniform sampler2D uCoast;
        float islandMargin(vec2 p){
          vec2 uv=p/${size.toFixed(1)}+.5;
          if(any(lessThan(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return -36.;
          return texture2D(uCoast,uv).r*48.-36.;
        }

        void main() {
          vec2 vWorksXZ=vWorldPos.xz;
          ${maskOceanFragment}
          // Native 0.25m voxel ocean lattice!
          vec2 vCell = floor(vWorldPos.xz / 0.25);
          vec2 pix = (vCell + 0.5) * 0.25;
          float m = islandMargin(pix);

          float shallows = clamp((m + 24.0) / 24.0, 0.0, 1.0);

          vec3 deepCol = vec3(0.12, 0.48, 0.78);
          vec3 shallowCol = vec3(0.24, 0.75, 0.88);
          vec3 col = mix(deepCol, shallowCol, shallows);

          // Crisp 0.25m voxel water checker micro-shimmer
          float voxCk = mod(vCell.x + vCell.y, 2.0);
          col *= mix(1.0, 0.968, voxCk);

          // Crisp 0.25m voxel seafoam ribbon lapping the 0.25m stepped beach
          float shoreBand = abs(m + 1.85 + sin(uTime * 2.1 + pix.x * 0.2 + pix.y * 0.17) * 0.55);
          if (shoreBand < 0.72) {
            col = vec3(0.94, 0.99, 1.0);
          }

          float distFade = clamp(length(vWorldPos.xz) / 620.0, 0.0, 1.0);
          col = mix(col, vec3(0.80, 0.93, 1.0), distFade * 0.75);

          vec3 moonlit = col * vec3(0.22, 0.34, 0.48);
          gl_FragColor = vec4(mix(moonlit, col, uDaylight), 0.91);
        }
      `,
    });

    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.y = -0.62;
    this.islandGroup.add(oceanMesh);
  }

  public getCameraView(): IslandCameraView {
    return {
      mode: this.cameraMode,
      target: this.target.toArray(),
      ...this.spherical,
      walk: this.walkPos.toArray(),
      yaw: this.walkYaw, pitch: this.walkPitch, fov: this.camera.fov,
      autoSpin: this.autoSpin360,
    };
  }

  /** Returns false for older or incomplete saves so the island can use its own starting view. */
  public restoreCameraView(view?: IslandCameraView): boolean {
    this.stopWatchingConstruction();
    this.followService();
    this.keysDown.clear();
    const vector = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
    if (!view || !["pan", "orbit", "walk"].includes(view.mode) || !vector(view.target) || !vector(view.walk) ||
        ![view.radius, view.theta, view.phi, view.yaw, view.pitch, view.fov].every(Number.isFinite)) {
      this.cameraMode = "pan";
      this.autoSpin360 = false;
      this.recentreCamera();
      return false;
    }
    this.cameraMode = view.mode;
    this.target.fromArray(view.target);
    this.spherical = {radius:view.radius, theta:view.theta, phi:view.phi};
    this.walkPos.fromArray(view.walk);
    this.walkYaw = view.yaw;
    this.walkPitch = view.pitch;
    this.camera.fov = THREE.MathUtils.clamp(view.fov, 20, 68);
    this.autoSpin360 = view.autoSpin === true;
    this.camera.updateProjectionMatrix();
    this.updateCameraTransform();
    return true;
  }

  public setCameraMode(mode: CameraMode): void {
    if (mode === "walk") this.followService();
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
    this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius * factor, 5.5, GRID_SIZE*TILE_SIZE*1.7);
    this.updateCameraTransform();
  }

  public followService(id?: string): void {
    if (this.following === id) return;
    this.following = id;
    this.callbacks.onFollowChange?.(id);
    if(id){this.spherical.radius=21;this.cameraMode="pan";this.updateCameraTransform();}
  }
  public focusGrid(gx: number, gz: number, distance = 21): void {
    this.stopWatchingConstruction();
    this.followService();
    const [x,z]=gridToWorldCenter(gx,gz);
    this.target.set(x,.6,z);this.spherical.radius=distance;this.updateCameraTransform();
  }
  public watchConstruction(gx: number, gz: number): void {
    if (this.cameraMode === "walk" || this.following || this.activePointers.size) return;
    const [x, z] = gridToWorldCenter(gx, gz);
    this.constructionTarget = new THREE.Vector3(x, .6, z);
  }
  public stopWatchingConstruction(): void {
    this.constructionTarget = undefined;
  }
  public focusElement(elementId: string): void {
    this.stopWatchingConstruction();
    this.followService();
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

  public setInfrastructureTool(tool:InfrastructureTool|null):void{
    this.worksTool=tool;this.worksStroke=[];this.worksAnchor=null;this.updateHoverOverlay();
  }

  public setBrush(brush: BuildBrush): void {
    this.brush = brush;
    this.ghostKey = ""; // force ghost refresh
    if (brush.kind !== "place") {
      this.networkStroke = [];
      this.pendingNetworkStroke = null;
      this.rebuildNetworkStrokePreview();
    }
    this.updateHoverOverlay();
  }

  public setPendingNetworkStroke(stroke: PendingNetworkStroke | null): void {
    this.pendingNetworkStroke = stroke;
    if (!stroke) {
      this.networkStroke = [];
    }
    this.rebuildNetworkStrokePreview();
    this.updateHoverOverlay();
  }

  public setHasPendingBridgeConfirm(
    active: boolean,
    pending?: { tool: InfrastructureTool; points: GridPoint[] } | null,
  ): void {
    this.hasPendingBridgeConfirm = active;
    this.pendingBridgeStroke = active && pending ? pending : null;
    this.updateHoverOverlay();
  }

  public setBulkSelect(active: boolean, filter: BulkSelectFilter = "all"): void {
    const changed = this.bulkSelectMode !== active || this.bulkSelectFilter !== filter;
    this.bulkSelectMode = active;
    this.bulkSelectFilter = filter;
    if (!active) {
      this.bulkStrokeIds.clear();
      this.bulkLastGrid = null;
      this.bulkHasDragged = false;
    }
    if (changed) {
      this.rebuildSelectionAndRadiusOverlays();
      this.updateHoverOverlay();
    }
  }

  public setQuickBuildTile(pt: GridPoint | null): void {
    const changed =
      (this.quickBuildTile?.gx ?? null) !== (pt?.gx ?? null) ||
      (this.quickBuildTile?.gz ?? null) !== (pt?.gz ?? null);
    this.quickBuildTile = pt ? { gx: pt.gx, gz: pt.gz } : null;
    if (changed) {
      this.rebuildSelectionAndRadiusOverlays();
    }
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

  public setSelectionRingObserver(cb: ((pos: SelectionRingProjection | null) => void) | null): void {
    this.selectionRingObserver = cb;
    this.lastRingProjectionKey = "";
    this.projectSelectionRing();
  }

  public setCustomRingTarget(box: SelectionRingBox | null): void {
    this.customRingTarget = box;
    this.lastRingProjectionKey = "";
    this.projectSelectionRing();
  }

  private projectSelectionRing(): void {
    if (!this.selectionRingObserver) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let hasTarget = false;

    if (this.customRingTarget) {
      const box = this.customRingTarget;
      minX = box.gx * TILE_SIZE;
      maxX = (box.gx + box.spanX) * TILE_SIZE;
      minZ = box.gz * TILE_SIZE;
      maxZ = (box.gz + box.spanZ) * TILE_SIZE;
      minY = box.baseY ?? 0;
      maxY = minY + Math.max(1.2, box.topY ?? 2.4);
      hasTarget = true;
    } else if (this.selectedIds.length === 1) {
      const selId = this.selectedIds[0];
      const el = this.gameState.elements.find((e) => e.id === selId);
      const entry = this.placedEntries.get(selId);
      if (el) {
        const voyage = this.gameState.mobility?.voyages[el.id];
        if (voyage && entry) {
          const halfW = (el.spanX * TILE_SIZE) * 0.5;
          const halfD = (el.spanZ * TILE_SIZE) * 0.5;
          minX = entry.group.position.x - halfW;
          maxX = entry.group.position.x + halfW;
          minZ = entry.group.position.z - halfD;
          maxZ = entry.group.position.z + halfD;
          minY = entry.group.position.y;
          maxY = minY + Math.max(1.2, (entry.group.userData.topY as number) || 2.2);
        } else {
          const bounds = roadBounds(el);
          minX = bounds.minX * TILE_SIZE;
          maxX = bounds.maxX * TILE_SIZE;
          minZ = bounds.minZ * TILE_SIZE;
          maxZ = bounds.maxZ * TILE_SIZE;
          minY = entry?.baseY ?? 0;
          maxY = minY + Math.max(1.2, (entry?.group.userData.topY as number) || 2.5);
        }
        hasTarget = true;
      }
    } else if (this.selectedIds.length > 1) {
      // Combined bounding box for multi-selection / bulk-delete floating toolbar
      for (const id of this.selectedIds) {
        const el = this.gameState.elements.find((e) => e.id === id);
        if (!el) continue;
        const entry = this.placedEntries.get(id);
        const bounds = roadBounds(el);
        const ex0 = bounds.minX * TILE_SIZE;
        const ex1 = bounds.maxX * TILE_SIZE;
        const ez0 = bounds.minZ * TILE_SIZE;
        const ez1 = bounds.maxZ * TILE_SIZE;
        const ey0 = entry?.baseY ?? 0;
        const ey1 = ey0 + Math.max(1.2, (entry?.group.userData.topY as number) || 2.5);
        if (ex0 < minX) minX = ex0;
        if (ex1 > maxX) maxX = ex1;
        if (ez0 < minZ) minZ = ez0;
        if (ez1 > maxZ) maxZ = ez1;
        if (ey0 < minY) minY = ey0;
        if (ey1 > maxY) maxY = ey1;
        hasTarget = true;
      }
    }

    if (!hasTarget) {
      if (this.lastRingProjectionKey !== "none") {
        this.lastRingProjectionKey = "none";
        this.selectionRingObserver(null);
      }
      return;
    }

    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const cxW = (minX + maxX) * 0.5;
    const cyW = (minY + maxY) * 0.5;
    const czW = (minZ + maxZ) * 0.5;

    this.projVec.set(cxW, cyW, czW).project(this.camera);
    const inFront = this.projVec.z >= -1 && this.projVec.z <= 1;
    const centerX = (this.projVec.x * 0.5 + 0.5) * w;
    const centerY = (-this.projVec.y * 0.5 + 0.5) * h;

    let maxCornerDist = 0;
    const xs = [minX, maxX];
    const ys = [minY, maxY];
    const zs = [minZ, maxZ];
    for (const x of xs) {
      for (const y of ys) {
        for (const z of zs) {
          this.projVec.set(x, y, z).project(this.camera);
          const sx = (this.projVec.x * 0.5 + 0.5) * w;
          const sy = (-this.projVec.y * 0.5 + 0.5) * h;
          const d = Math.hypot(sx - centerX, sy - centerY);
          if (d > maxCornerDist) maxCornerDist = d;
        }
      }
    }

    const maxAllowedRadius = Math.max(66, Math.min(w, h) * 0.34);
    const radiusPx = THREE.MathUtils.clamp(Math.round(maxCornerDist * 0.8 + 30), 66, Math.min(132, maxAllowedRadius));
    const padX = Math.min(w * 0.45, radiusPx + 28);
    const padY = Math.min(h * 0.45, radiusPx + 28);
    const x = Math.round(THREE.MathUtils.clamp(centerX, padX, w - padX));
    const y = Math.round(THREE.MathUtils.clamp(centerY, padY, h - padY));
    const visible = inFront && centerX > -180 && centerX < w + 180 && centerY > -180 && centerY < h + 180;

    const key = `${x},${y},${radiusPx},${visible ? 1 : 0}`;
    if (key !== this.lastRingProjectionKey) {
      this.lastRingProjectionKey = key;
      this.selectionRingObserver({ x, y, radiusPx, visible });
    }
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
      const status = maintenanceStatus(this.gameState, el);
      entry.disrepairBadge.visible = visibleMatch && (el.disrepair || status === "soon" || status === "due");
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

  private clearGeography(){
    this.islandGroup.traverse(o=>{
      if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){
        o.geometry.dispose();for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();
      }
    });
    this.islandGroup.clear();
    this.coastlineTexture?.dispose();
  }
  public syncState(state: GameState, selectedIds: string[]): void {
    this.gameState = state;
    if(this.renderedGeography!==(state.terrainVersion??1)){this.clearGeography();this.buildIslandAndOcean();}
    this.selectedIds = selectedIds;
    this.engineering.sync(state);
    const coastalStamp=(state.terrainVersion??1)+"/"+(state.infrastructure?.stamp??state.infrastructure?.revision??0);
    if(coastalStamp!==this.coastalStamp && this.coastlineTexture && this.naturalCoastline){
      this.coastalStamp=coastalStamp;
      this.coastlineTexture.image.data=editedCoastline(state,this.naturalCoastline);
      this.coastlineTexture.needsUpdate=true;
    }
    this.activeTravel = state.mobility || state.projectOps?.calls.length || state.crimeIncidents?.some(i=>i.policeOriginId) ? getTravelNetwork(state) : undefined;

    const seenIds = new Set<string>();

    const occupancy = buildOccupancyMap(state.elements);
    for (const el of state.elements) {
      seenIds.add(el.id);
      const def = ELEMENT_BY_ID[el.defId];
      if (!def) continue;

      const connMask = def.isNetwork ? getNetworkConnMask(state.elements, el, occupancy,state) : 0;
      const oddRot = el.rotation % 2 === 1;
      const localSpanX = def.isNetwork || !oddRot ? el.spanX : el.spanZ;
      const localSpanZ = def.isNetwork || !oddRot ? el.spanZ : el.spanX;
      const worksSpan=state.infrastructure?.spans[tileKey(el.gx,el.gz)];
      let terrainOverbuilt=false;
      if(el.sculptsTerrain&&!def.isNetwork){
        for(let dx=0;dx<el.spanX&&!terrainOverbuilt;dx++)for(let dz=0;dz<el.spanZ;dz++)if(occupancy.get(tileKey(el.gx+dx,el.gz+dz))?.id!==el.id){terrainOverbuilt=true;break;}
      }
      const pose = def.isNetwork ? { ...el, rotation: 0 } : el;
      const edges = getParcelEdges(pose, occupancy, state).filter(e => !["road","rail","channel"].includes(e.kind));
      const soils = def.domain === "land" ? getParcelSoils(state, pose) : undefined;
      const lighting = el.exteriorLighting ?? "auto";
      const corridor=corridorArt(el,occupancy);
      let hasFootprintVoxelOrCoast = false;
      if (el.sculptsTerrain || stripsFlatGroundSlabInWorld(el.defId)) {
        for (let dx = 0; dx < el.spanX && !hasFootprintVoxelOrCoast; dx++) {
          for (let dz = 0; dz < el.spanZ; dz++) {
            const k = tileKey(el.gx + dx, el.gz + dz);
            if (state.infrastructure?.voxels?.[k] || (!el.sculptsTerrain && getTerrainCell(state, el.gx + dx, el.gz + dz).kind === "coast")) {
              hasFootprintVoxelOrCoast = true;
              break;
            }
          }
        }
      }
      const worldSculpted = Boolean((el.sculptsTerrain || stripsFlatGroundSlabInWorld(el.defId)) && hasFootprintVoxelOrCoast);
      const renderKey = `${JSON.stringify(corridor)??""}|${terrainOverbuilt?"coexist":""}|${worldSculpted?"ws":""}|${worksSpan?.run??""}|${el.defId}|L${el.level}|V${el.variant}|${localSpanX}x${localSpanZ}|R${el.rotation}|C${connMask}|${getParcelEdgeKey(edges)}|${soils ?? ""}|${lighting}`;

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
          releaseParcelGeometry(entry.group);
        }

        const asset = getOrBuildElementAsset(
          el.defId,
          el.level,
          el.variant,
          localSpanX,
          localSpanZ,
          connMask,
          { edges, soils, lighting, corridor, worldSculpted },
        );
        const group = buildPlacedGroupFromAsset(asset, false);
        group.position.set(wx, baseY, wz);
        group.rotation.y = def.isNetwork ? 0 : (el.rotation * Math.PI) / 2;
        if(terrainOverbuilt||worksSpan && !worksSpan.run.startsWith("junction-")) group.traverse(o=>{if(o instanceof THREE.Mesh)o.visible=false;});
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
        if (!state.mobility?.voyages[el.id]) {
          entry.group.position.x = wx;
          entry.group.position.z = wz;
        }
        entry.group.userData.baseY = baseY;
        if(!state.mobility?.voyages[el.id])entry.group.rotation.y = def.isNetwork ? 0 : (el.rotation * Math.PI) / 2;
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
        releaseParcelGeometry(entry.group);
        this.placedEntries.delete(id);
      }
    }

    this.refreshNetworkCache();
    this.rebuildEmittersAndBeacons();
    this.farmActivity.syncHerds(state.elements, this.placedEntries);
    this.rebuildSelectionAndRadiusOverlays();
    this.updateHoverOverlay();
    this.rebuildHeatmapOverlay();
    this.syncCrimeVisuals();
    this.syncAttackVisuals();
  }

  private getGroundElevationForElement(def: CivElementDef, wx: number, wz: number): number {
    const [gx, gz] = worldToGrid(wx, wz);
    const hasVoxel = Boolean(this.gameState.infrastructure?.voxels?.[tileKey(gx, gz)]);
    if (hasVoxel) {
      const sample = sampleTerrainAt(this.gameState, wx, wz);
      if (def.domain === "water" || def.isWaterFeature) {
        return sample.depth > 0.02 ? sample.waterLevel + 0.015 : sample.elevation + 0.015;
      }
      return (sample.depth > 0.02 ? sample.waterLevel : sample.elevation) + 0.025 - VOXEL_SIZE;
    }
    const cell = this.gameState.infrastructure?.cells[tileKey(gx, gz)];
    if (cell) {
      if (def.domain === "water" || def.isWaterFeature) return cell.depth ? cell.waterLevel + 0.015 : cell.elevation + 0.015;
      return (cell.depth ? cell.waterLevel : cell.elevation) + 0.025 - VOXEL_SIZE;
    }
    if (def.domain === "water") return -0.58;
    const m = islandMarginAtWorld(wx, wz, this.gameState.terrainVersion);
    // The top of a lot's ground voxel meets the island surface. A small clearance prevents z-fighting.
    if (m >= 2.0) return 0.025 - VOXEL_SIZE;
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
    ring.position.set(entry.wx, entry.baseY + VOXEL_SIZE + 0.04, entry.wz);
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

    this.selectedIds.forEach((id) => {
      const el = this.gameState.elements.find((e) => e.id === id);
      if (!el) return;
      const entry = this.placedEntries.get(id);
      const baseY = entry?.baseY ?? 0;
      const h = Math.max(1.2, ((entry?.group.userData.topY as number) || 2.5) + 0.3);
      const [wx, wz] = gridToWorldCenter(el.gx, el.gz, el.spanX, el.spanZ);


      const bounds = roadBounds(el);
      const width = (bounds.maxX - bounds.minX) * TILE_SIZE;
      const depth = (bounds.maxZ - bounds.minZ) * TILE_SIZE;
      const box = new THREE.BoxGeometry(width + 0.16, h, depth + 0.16);
      const edges = new THREE.EdgesGeometry(box);
      box.dispose();
      const col = this.bulkSelectMode || this.selectedIds.length > 1 ? 0xff5a5f : 0xf4c44e;
      const seg = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: col }));
      seg.position.set(wx, baseY + h * .5, wz);
      this.overlayGroup.add(seg);
      this.selectionOutlines.push(seg);
    });

    if (this.quickBuildTile) {
      const { gx, gz } = this.quickBuildTile;
      const [wx, wz] = gridToWorldCenter(gx, gz, 1, 1);
      const box = new THREE.BoxGeometry(TILE_SIZE + 0.14, 0.36, TILE_SIZE + 0.14);
      const edges = new THREE.EdgesGeometry(box);
      box.dispose();
      const seg = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x2fb996 }));
      seg.position.set(wx, 0.24, wz);
      this.overlayGroup.add(seg);
      this.selectionOutlines.push(seg);
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
        const { spanX, spanZ } = planConstruction(this.gameState, def, this.hoverGrid[0], this.hoverGrid[1], this.brush.level, this.brush.rotation, this.brush.faceManually);
        [wx, wz] = gridToWorldCenter(this.hoverGrid[0], this.hoverGrid[1], spanX, spanZ);
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

  private updateCurbPreviews(roads: {site:PlacedElement; mask:number}[] = []): void {
    if (!roads.length && !this.curbPreviews.size) return;
    const keep=new Set<string>();
    for (const {site,mask} of roads) {
      const entry=this.placedEntries.get(site.id);
      if (!entry) continue;
      const key=entry.key+"|preview"+mask;
      const prior=this.curbPreviews.get(site.id);
      if (prior?.key===key && prior.original===entry.group) {keep.add(site.id);continue;}
      if(prior) this.removeCurbPreview(site.id);
      const soils=getParcelSoils(this.gameState,site);
      const asset=getOrBuildElementAsset(site.defId,site.level,site.variant,site.spanX,site.spanZ,mask,{soils});
      const ghost=buildPlacedGroupFromAsset(asset,true,true);
      ghost.position.copy(entry.group.position);
      this.curbPreviews.set(site.id,{key,original:entry.group,ghost,wasVisible:entry.group.visible});
      this.overlayGroup.add(ghost);
      entry.group.visible=false;
      keep.add(site.id);
    }
    for(const id of this.curbPreviews.keys())if(!keep.has(id))this.removeCurbPreview(id);
  }

  private removeCurbPreview(id:string):void {
    const previous=this.curbPreviews.get(id);
    if(!previous)return;
    previous.original.visible=previous.wasVisible;
    this.overlayGroup.remove(previous.ghost);
    releaseParcelGeometry(previous.ghost);
    this.curbPreviews.delete(id);
  }

  private clearNetworkStrokePreview(): void {
    while (this.networkPreviewGroup.children.length > 0) {
      const child = this.networkPreviewGroup.children[0];
      this.networkPreviewGroup.remove(child);
      if (child instanceof THREE.Group) {
        releaseParcelGeometry(child);
      } else if (child instanceof THREE.LineSegments || child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }

  private rebuildNetworkStrokePreview(): void {
    this.clearNetworkStrokePreview();
    const activeDefId = this.networkStroke.length > 0 ? this.brush.defId : this.pendingNetworkStroke?.defId;
    const activePoints = this.networkStroke.length > 0 ? this.networkStroke : (this.pendingNetworkStroke?.points ?? []);
    if (!activeDefId || activePoints.length === 0) return;
    const baseDef = ELEMENT_BY_ID[activeDefId];
    if (!baseDef) return;

    const level = this.brush.level;
    const variant = this.brush.variantMode >= 0 ? this.brush.variantMode : 0;
    const occ = buildOccupancyMap(this.gameState.elements);
    const virtual: GameState = { ...this.gameState, elements: [...this.gameState.elements] };
    const plans: { pt: GridPoint; plan: ReturnType<typeof planConstruction> }[] = [];

    for (const [index, pt] of activePoints.entries()) {
      const plan = planConstruction(virtual, baseDef, pt.gx, pt.gz, level, this.brush.rotation, this.brush.faceManually, strokeRoadAxis(activePoints,index));
      plans.push({ pt, plan });
      if (plan.valid) {
        const key = tileKey(pt.gx, pt.gz);
        const virt: PlacedElement = {
          id: `__preview_${pt.gx}_${pt.gz}`,
          defId: plan.def.id,
          gx: pt.gx,
          gz: pt.gz,
          spanX: plan.spanX,
          spanZ: plan.spanZ,
          rotation: 0,
          level: plan.level,
          variant,
          connected: true,
          hasPoliceCover: false,
          hasFireCover: false,
          nuisancePenalty: 0,
          maintTimerSec: 0,
          disrepair: false,
          onFire: false,
          animProgress: 0,
          animKind: "place",
          ...(plan.overWater ? { overWater: true } : {}),
          ...(plan.roadAxis ? { roadAxis: plan.roadAxis } : {}),
        };
        occ.set(key, virt);
        if (plan.replaceId) virtual.elements = virtual.elements.filter(el => el.id !== plan.replaceId);
        virtual.elements.push(virt);
        virtual.money -= plan.cost;
      }
    }

    for (const { pt, plan } of plans) {
      const def = plan.def;
      const mask = def.isNetwork
        ? getNetworkConnMask(
            virtual.elements,
            { defId: def.id, gx: pt.gx, gz: pt.gz, overWater: plan.overWater },
            occ,
            this.gameState,
          )
        : 0;
      const [wx, wz] = gridToWorldCenter(pt.gx, pt.gz, plan.spanX, plan.spanZ);
      const baseY = this.getGroundElevationForElement(def, wx, wz);
      const pose = { gx: pt.gx, gz: pt.gz, defId: def.id, roadAxis: plan.roadAxis, spanX: plan.spanX, spanZ: plan.spanZ };
      const bounds = roadBounds(pose);
      const asset = getOrBuildElementAsset(def.id, plan.level, variant, plan.spanX, plan.spanZ, mask, { corridor: corridorArt(pose, occ) });
      const ghost = buildPlacedGroupFromAsset(asset, true, plan.valid);
      ghost.position.set(wx, baseY + 0.04, wz);
      this.networkPreviewGroup.add(ghost);

      const box = new THREE.BoxGeometry((bounds.maxX - bounds.minX) * TILE_SIZE, 0.25, (bounds.maxZ - bounds.minZ) * TILE_SIZE);
      const edges = new THREE.EdgesGeometry(box);
      box.dispose();
      const outline = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: plan.valid ? 0x64f5df : 0xff5a5f, transparent: true, opacity: 0.92 }),
      );
      outline.position.set(wx, baseY + VOXEL_SIZE + 0.08, wz);
      this.networkPreviewGroup.add(outline);
    }
  }

  private showGroupMovePreview(ids: readonly string[], gx: number, gz: number) {
    const plan = planGroupRelocation(this.gameState, ids, gx, gz);
    const vertices: number[] = [];
    for (const site of plan.targets) {
      const def = ELEMENT_BY_ID[site.defId];
      if (!def) continue;
      const [x, z] = gridToWorldCenter(site.gx, site.gz, site.spanX, site.spanZ);
      const y = this.getGroundElevationForElement(def, x, z) + VOXEL_SIZE + 0.12;
      const bounds = roadBounds(site);
      const left = bounds.minX * TILE_SIZE, right = bounds.maxX * TILE_SIZE;
      const top = bounds.minZ * TILE_SIZE, bottom = bounds.maxZ * TILE_SIZE;
      vertices.push(left,y,top, right,y,top, right,y,top, right,y,bottom,
        right,y,bottom, left,y,bottom, left,y,bottom, left,y,top);
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    this.groupOutline.geometry.dispose();
    this.groupOutline.geometry = next;
    this.groupOutline.material.color.setHex(plan.valid ? 0x64f5df : 0xff5a5f);
    this.groupOutline.visible = vertices.length > 0;
    this.callbacks.onHoverInfo?.({ gx, gz, valid: plan.valid, reason: plan.reason });
  }

  private updateHoverOverlay(): void {
    this.groupOutline.visible = false;
    if (this.pendingNetworkStroke || this.networkStroke.length > 0 || this.bulkSelectMode) {
      this.updateCurbPreviews();
      this.cursorOutline.visible = false;
      if (this.ghostGroup) this.ghostGroup.visible = false;
      this.updateRadiusRing();
      if (this.bulkSelectMode) this.callbacks.onHoverInfo?.(null);
      return;
    }
    if (this.pendingBridgeStroke && this.pendingBridgeStroke.points.length >= 2) {
      this.updateCurbPreviews();
      this.cursorOutline.visible = false;
      if (this.ghostGroup) this.ghostGroup.visible = false;
      const plan = planInfrastructureStroke(this.gameState, this.pendingBridgeStroke.tool, this.pendingBridgeStroke.points);
      this.engineering.showPreview(this.gameState, plan, this.pendingBridgeStroke.tool);
      return;
    }
    if(this.worksTool && this.hoverGrid){
      this.updateCurbPreviews();
      this.cursorOutline.visible=false;if(this.ghostGroup)this.ghostGroup.visible=false;
      const [gx,gz]=this.hoverGrid;
      const voxelTool = isVoxelSculptTool(this.worksTool);
      const p: GridPoint = voxelTool && this.hoverVoxel
        ? { gx, gz, vx: this.hoverVoxel[0], vz: this.hoverVoxel[1] }
        : { gx, gz };
      const points=this.worksStroke.length?[...this.worksStroke,p]:this.worksAnchor?[this.worksAnchor,p]:[p];
      const plan=planInfrastructureStroke(this.gameState,this.worksTool,points);
      this.engineering.showPreview(this.gameState,plan,this.worksTool,points);
      const vr = voxelTool ? effectiveVoxelRadius(this.worksTool) : 0;
      const sizeSummary = voxelTool
        ? (vr === 0 ? "1 vox (0.25m)" : `${vr * 2 + 1} vox (${((vr * 2 + 1) * VOXEL_PITCH).toFixed(2)}m)`)
        : plan.points.length + " span";
      const costSummary = plan.cost > 0 ? " · $" + plan.cost : " · Free";
      this.callbacks.onHoverInfo?.({gx,gz,valid:plan.valid,reason:plan.reason||sizeSummary+costSummary+(plan.affected.length?" · "+plan.affected.length+" affected":"")});return;
    }
    this.engineering.showPreview(this.gameState,null);
    if (this.brush.kind === "move" && this.brush.movingGroupIds?.length) {
      this.updateCurbPreviews();
      this.cursorOutline.visible = false;
      if (this.ghostGroup) this.ghostGroup.visible = false;
      const destination = this.brush.groupDestination ?? this.hoverGrid;
      if (destination) this.showGroupMovePreview(this.brush.movingGroupIds, ...destination);
      else this.callbacks.onHoverInfo?.(null);
      return;
    }
    if (!this.hoverGrid || this.brush.kind === "none") {
      this.updateCurbPreviews();
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
    let relocation: ReturnType<typeof planRelocation> | undefined;
    let placement: ReturnType<typeof planConstruction> | undefined;
    const moving = this.brush.kind === "move" ? this.gameState.elements.find(e => e.id === this.brush.movingElementId) : undefined;

    if (this.brush.kind === "move" && this.brush.movingElementId) {
      const moving = this.gameState.elements.find((e) => e.id === this.brush.movingElementId);
      if (moving) {
        def = ELEMENT_BY_ID[moving.defId];
        spanX = moving.spanX;
        spanZ = moving.spanZ;
        level = moving.level;
        variant = moving.variant;
        rotation = moving.rotation;
        relocation = planRelocation(this.gameState, moving, gx, gz);
      }
    } else if (this.brush.kind === "place" && this.brush.defId) {
      def = ELEMENT_BY_ID[this.brush.defId];
      if (def) {
        placement = planConstruction(this.gameState, def, gx, gz, level, rotation,this.brush.faceManually);
        ({ def, level, spanX, spanZ, rotation } = placement);
        const profile = getTerrainInteractionProfile(def.id);
        if (profile?.orientToWater && !this.brush.faceManually) {
          rotation = detectCoastRotation(this.gameState, gx, gz, spanX, spanZ, rotation).rotation;
        }
      }
    }

    if (!def) {
      this.updateCurbPreviews();
      this.cursorOutline.visible = false;
      if (this.ghostGroup) this.ghostGroup.visible = false;
      return;
    }

    const chk = placement ?? relocation ?? { valid: false, reason: "Select an element" };
    const occupancy = buildOccupancyMap(this.gameState.elements, moving ? new Set([moving.id]) : undefined);
    const pose = { ...moving, defId: def.id, gx, gz, spanX, spanZ, rotation: def.isNetwork ? 0 : rotation };
    // Use the same prospective orientation on the first local street as the committed edit.
    if (placement?.valid && def.isRoadNetwork) {
      for (const {site,rotation:newFacing,autoDrive} of planFirstStreetFacing(pose,occupancy,this.gameState)) {
        const turned={...site,rotation:newFacing,autoDrive:autoDrive??site.autoDrive};
        for(let x=site.gx;x<site.gx+site.spanX;x++)for(let z=site.gz;z<site.gz+site.spanZ;z++){
          occupancy.set(tileKey(x,z),turned);
        }
      }
    }
    const edges = getParcelEdges(pose, occupancy, this.gameState).filter(e => !["road","rail","channel"].includes(e.kind));
    const changedRoads:{site:PlacedElement;mask:number}[]=[];
    if(chk.valid && !def.isNetwork) {
      for (const edge of edges) {
        if (edge.kind!=="drive" && edge.kind!=="bus" && edge.kind!=="freight") continue;
        const [x,z]=cellBeyondEdge(pose,edge.side,edge.slot), road=occupancy.get(tileKey(x,z));
        if(!road || !ELEMENT_BY_ID[road.defId]?.isRoadNetwork)continue;
        const dir=x<gx?1:x>=gx+spanX?3:z<gz?2:0;
        const mask=getNetworkConnMask(this.gameState.elements,road,occupancy,this.gameState);
        changedRoads.push({site:road,mask:mask|encodeRoadSitePort(dir,edge.kind)});
      }
    }
    this.updateCurbPreviews(changedRoads);
    const soils = def.domain === "land" ? getParcelSoils(this.gameState, pose) : undefined;
    const lighting = moving?.exteriorLighting ?? "auto";
    const mask = def.isNetwork ? getNetworkConnMask(this.gameState.elements, {
      defId: def.id, gx, gz, edgeOverrides: moving?.edgeOverrides, crossingAxis: moving?.crossingAxis, overWater: placement?.overWater || Boolean(relocation?.underlay),
    }, occupancy,this.gameState) : 0;
    const [wx, wz] = gridToWorldCenter(gx, gz, spanX, spanZ);
    const baseY = this.getGroundElevationForElement(def, wx, wz);

    this.cursorOutline.visible = true;
    this.cursorOutline.scale.set(spanX * TILE_SIZE, 0.25, spanZ * TILE_SIZE);
    this.cursorOutline.position.set(wx, baseY + VOXEL_SIZE + 0.06, wz);
    (this.cursorOutline.material as THREE.LineBasicMaterial).color.setHex(
      chk.valid ? 0x64f5df : 0xff5a5f,
    );

    const oddRot = rotation % 2 === 1;
    const localSpanX = def.isNetwork || !oddRot ? spanX : spanZ;
    const localSpanZ = def.isNetwork || !oddRot ? spanZ : spanX;
    const corridor=corridorArt({gx,gz,defId:def.id,roadAxis:placement?.roadAxis??moving?.roadAxis},occupancy);
    if(corridor){const a=corridor.axis==="x";this.cursorOutline.scale.set((a?1:corridor.width)*4,.25,(a?corridor.width:1)*4); }
    const wantedGhostKey = `${JSON.stringify(corridor)??""}|${def.id}|L${level}|V${variant}|${localSpanX}x${localSpanZ}|C${mask}|${getParcelEdgeKey(edges)}|${soils ?? ""}|${lighting}|${chk.valid ? "ok" : "bad"}`;
    if (this.ghostKey !== wantedGhostKey) {
      if (this.ghostGroup) {
        this.overlayGroup.remove(this.ghostGroup);
        releaseParcelGeometry(this.ghostGroup);
      }
      const asset = getOrBuildElementAsset(def.id, level, variant, localSpanX, localSpanZ, mask, { edges, soils, lighting, corridor });
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
    const trips = getRoadTripNetwork(this.gameState);
    if (trips === this.roadTrips) return;
    if (!this.roadTrips?.routes.length || !trips.routes.length) {
      this.departureTimer = 0;
      this.availableAfter = [];
    }
    this.roadTrips = trips;
    const stillReachable = new Set(trips.routes.map(trip => trip.key));
    this.trafficAgents = this.trafficAgents.filter(car => {
      if (stillReachable.has(car.trip.key)) return true;
      this.trafficGroup.remove(car.mesh);
      return false;
    });
    this.cachedRoadSet = getConnectedRoadCoordSet(this.gameState.elements, this.gameState);
    this.streets.clear();
    const occ = buildOccupancyMap(this.gameState.elements);
    const profiles = new Map<string, ReturnType<typeof networkRoadProfile>>();
    for (const e of this.gameState.elements) {
      const d = ELEMENT_BY_ID[e.defId];
      if (!d?.isRoadNetwork) continue;
      const key = `${e.gx},${e.gz}`;
      const mask = getNetworkConnMask(this.gameState.elements, e, occ,this.gameState);
      const profileKey = d.id + ":" + mask;
      if (!profiles.has(profileKey)) profiles.set(profileKey, networkRoadProfile(d.id, mask));
      const [wx, wz] = gridToWorldCenter(e.gx, e.gz);
      this.streets.set(key, { profile: profiles.get(profileKey), base: this.getGroundElevationForElement(d, wx, wz) });
    }
  }

  private streetHeight(wx: number, wz: number, eastWest: boolean): number {
    const [gx, gz] = worldToGrid(wx, wz);
    const street = this.streets.get(`${gx},${gz}`);
    const s=this.gameState.infrastructure?.spans[tileKey(gx,gz)];
    if(s){
      const fraction=eastWest?wx/TILE_SIZE-gx:wz/TILE_SIZE-gz;
      return surfaceTravelHeight(this.gameState,gx,gz,eastWest?"x":"z",fraction)-VOXEL_SIZE;
    }
    if (!street) return getTerrainCell(this.gameState,gx,gz).elevation;
    const profile = street.profile;
    let height = 0;
    if (profile && (profile.elevatedAxis < 0 || (profile.elevatedAxis === 1) === eastWest)) {
      const x = Math.min(15, Math.floor((wx - gx * TILE_SIZE) / VOXEL_SIZE));
      const z = Math.min(15, Math.floor((wz - gz * TILE_SIZE) / VOXEL_SIZE));
      height = profile.heights[x * 16 + z] * VOXEL_SIZE;
    }
    return street.base + height;
  }

  private canTurn(gx: number, gz: number, incomingX: number, outgoingX: number): boolean {
    const axis = this.streets.get(`${gx},${gz}`)?.profile?.elevatedAxis ?? -1;
    return axis < 0 || (incomingX === 0) === (outgoingX === 0);
  }

  private syncAutonomousTrafficAndVillagers(): void {
    this.refreshNetworkCache();
    const connectedRoadSet = this.cachedRoadSet;
    const roadTiles = this.gameState.elements.filter(el =>
      ELEMENT_BY_ID[el.defId]?.isRoadNetwork && connectedRoadSet.has(tileKey(el.gx, el.gz))
    );
    this.villagerAgents = this.villagerAgents.filter((v) => {
      if (!connectedRoadSet.has(`${v.gx},${v.gz}`)) {
        this.villagerGroup.remove(v.root);
        return false;
      }
      return true;
    });

    const hasPop = this.gameState.population > 0;
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

  /** Vehicle inspection reads the same paths/positions used by the scene. Positions are world metres. */
  public ambientCarTrips() {
    return this.trafficAgents.map((car) => ({
      id: car.id,
      kind: car.kind,
      origin: car.trip.origin,
      destination: car.trip.destination,
      path: car.trip.path,
      cursor: car.segment,
      progress: car.progress,
      speed: car.velocity,
      position: [car.mesh.position.x, car.mesh.position.z],
      arrived: car.segment === car.points.length - 1,
    }));
  }

  private dispatchAmbientCar(dt: number) {
    const network = this.roadTrips;
    this.carClock += dt;
    if (!network?.routes.length) return;
    if (this.availableAfter.length)
      this.availableAfter = this.availableAfter.filter((time) => time > this.carClock);
    this.departureTimer -= dt;
    const state = this.gameState;
    const demand = state.metrics.trafficTrips;
    const target = trafficFleetTarget(
      network,
      state.population,
      demand,
      this.isSoftwareGl ? 22 : 60,
      state.timeOfDay,
    );
    if (this.departureTimer > 0 || this.trafficAgents.length + this.availableAfter.length >= target) return;
    for (let i = 0; i < network.routes.length; i++) {
      const trip = network.routes[this.routeCursor++ % network.routes.length];
      const gate = trip.origin;
      const x = (gate.gx + 0.5 + gate.dx * 0.495) * TILE_SIZE;
      const z = (gate.gz + 0.5 + gate.dz * 0.495) * TILE_SIZE;
      if (
        this.trafficAgents.some(
          (c) => Math.hypot(c.mesh.position.x - x, c.mesh.position.z - z) < TILE_SIZE * 0.55,
        )
      )
        continue;
      const points = roadTripPoints(trip,buildOccupancyMap(state.elements));
      const id = this.carSequence++;
      const kinds: RoadVehicleKind[] = ["sedan", "mini_cooper", "truck", "sports_car", "sedan", "cybertruck"];
      const military = state.elements.some(
        (e) => (e.id === gate.siteId || e.id === trip.destination.siteId) && ELEMENT_BY_ID[e.defId].military,
      );
      const kind = military && id % 3 === 0 ? "military_truck" : kinds[id % kinds.length];
      const mesh = new THREE.Mesh(getVehicleGeometry(kind, id % 8), getPixelVoxelMaterial());
      mesh.castShadow = !this.isSoftwareGl;
      mesh.position.set(x, this.streetHeight(x, z, !!gate.dx) + VOXEL_SIZE + 0.02, z);
      mesh.rotation.y = Math.atan2(points[1].x - points[0].x, points[1].z - points[0].z);
      this.trafficGroup.add(mesh);
      this.trafficAgents.push({
        id,
        kind,
        trip,
        points,
        mesh,
        segment: 0,
        progress: 0,
        velocity: 0,
        speed: kind === "sports_car" ? 2 : kind === "truck" || kind === "military_truck" ? 1.35 : 1.65,
        dwell: 0.25,
      });
      this.departureTimer = departureInterval(target, demand, state.timeOfDay);
      return;
    }
    this.departureTimer = 0.3;
  }

  private stepAmbientCars(dt: number) {
    this.dispatchAmbientCar(dt);
    const state = this.gameState;
    const loads = getTrafficLoadMap(this.gameState);
    const grip = state.weather === "storm" ? 0.65 : state.weather === "rain" ? 0.82 : 1;
    for (let i = this.trafficAgents.length - 1; i >= 0; i--) {
      const car = this.trafficAgents[i];
      const a = car.points[car.segment],
        b = car.points[car.segment + 1];
      if (!b) {
        car.dwell -= dt;
        if (car.dwell <= 0) {
          this.trafficGroup.remove(car.mesh);
          this.trafficAgents.splice(i, 1);
          const fleet = trafficFleetTarget(
            this.roadTrips!,
            state.population,
            state.metrics.trafficTrips,
            this.isSoftwareGl ? 22 : 60,
            state.timeOfDay,
          );
          // A completed journey frees its fleet slot after the driver has spent time at the destination.
          this.availableAfter.push(
            this.carClock + departureInterval(fleet, state.metrics.trafficTrips, state.timeOfDay),
          );
        }
        continue;
      }
      const dx = b.x - a.x,
        dz = b.z - a.z,
        length = Math.hypot(dx, dz);
      const tx = b.tile[0] - a.tile[0],
        tz = b.tile[1] - a.tile[1];
      let room = Infinity;
      if (tx || tz) {
        registerRoadDemand(state, b.tile[0], b.tile[1], tx, tz, dt);
        if (car.progress <= 0.4 && !roadTravelOpen(state, b.tile[0], b.tile[1], tx, tz))
          room = Math.max(0, 0.36 - car.progress) * length;
      }
      // Leave space behind vehicles advancing along the same carriageway, including at a stop line.
      for (const other of this.trafficAgents) {
        if (other === car) continue;
        const aheadX = (other.mesh.position.x - car.mesh.position.x) / TILE_SIZE;
        const aheadZ = (other.mesh.position.z - car.mesh.position.z) / TILE_SIZE;
        const along = (aheadX * dx + aheadZ * dz) / length,
          sideways = Math.abs(aheadX * dz - aheadZ * dx) / length;
        if (along <= 0.002 || along > 0.72 || sideways > 0.13) continue;
        const start = other.points[other.segment],
          end = other.points[other.segment + 1];
        if (end && (end.x - start.x) * dx + (end.z - start.z) * dz > 0)
          room = Math.min(room, Math.max(0, along - 0.34 / grip));
      }
      const load = loads.get(tileKey(...a.tile)) ?? 0;
      const flow = Math.max(0.3, 1 / (1 + Math.max(0, load - 0.85) * 2.2));
      const cruise = car.speed * grip * flow;
      if (car.segment === car.points.length - 2) room = Math.min(room, (1 - car.progress) * length);
      const movement = advanceCarSegment(car.progress, car.velocity, length, cruise, room, dt, grip);
      car.progress = movement.progress;
      car.velocity = movement.velocity;
      const wx = (a.x + dx * car.progress) * TILE_SIZE,
        wz = (a.z + dz * car.progress) * TILE_SIZE;
      const deck = this.streetHeight(wx, wz, Math.abs(dx) > Math.abs(dz));
      car.mesh.position.set(wx, deck + VOXEL_SIZE + 0.02, wz);
      const angle = Math.atan2(dx, dz) - car.mesh.rotation.y;
      car.mesh.rotation.y += Math.atan2(Math.sin(angle), Math.cos(angle)) * Math.min(1, dt * 12);
      if (car.progress >= 1 - 0.00001) {
        car.segment++;
        car.progress = 0;
      }
    }
  }

  public advanceStreetTraffic(seconds: number): void {
    this.farmActivity.update(this.gameState,seconds);
    // Keep lane following and braking stable when the simulation runs faster or steps a whole second.
    for (let left = seconds; left > 0; left -= .08) {
      const delta = Math.min(left, .08);
      this.stepTrafficAndVillagers(delta, this.carClock + delta);
    }
  }

  private stepTrafficAndVillagers(dt: number, elapsed: number): void {
    this.stepAmbientCars(dt);
    const roadSet = this.cachedRoadSet;
    const dirs: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];

    for (const v of this.villagerAgents) {
      if (roadSet.size === 0) continue;
      const mayWalk = roadTravelOpen(this.gameState,v.nextGx,v.nextGz,v.dirX,v.dirZ);
      if (mayWalk || v.progress>.4) v.progress += dt * v.speed;
      else v.progress=Math.max(v.progress,Math.min(.36,v.progress+dt*v.speed));
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

        const validDirs = dirs.filter(([dx, dz]) => roadSet.has(`${v.gx + dx},${v.gz + dz}`) && roadPortOpen(this.gameState,v.gx,v.gz,dx,dz) && this.canTurn(v.gx, v.gz, v.dirX, dx));
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
      const vDeck = this.streetHeight(vx, vz, v.dirX !== 0);
      v.root.position.set(vx, VOXEL_SIZE + vDeck + Math.abs(stride) * 0.04, vz);
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
      // Yield between software-rendered frames so the simulation and touch controls stay responsive.
      window.setTimeout(() => this.tick(), document.hidden ? 250 : 32);
    } else {
      window.requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    if (this.disposed) return;
    const dt = Math.min(0.06, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    this.oceanUniforms.uTime.value = elapsed;
    this.engineering.animate(this.gameState);
    this.templeLights.update(this.gameState, this.placedEntries, elapsed);
    this.handleKeyboardNavigation(dt);
    if (this.constructionTarget && !this.activePointers.size && !this.keysDown.size && !this.following && this.cameraMode !== "walk") {
      this.target.lerp(this.constructionTarget, 1 - Math.exp(-dt * 4.2));
      this.spherical.radius += (Math.min(64, Math.max(28, this.spherical.radius)) - this.spherical.radius) * dt * 2;
      if (this.target.distanceToSquared(this.constructionTarget) < .065) this.stopWatchingConstruction();
      this.updateCameraTransform();
    }

    // Animate rotors, boats bobbing, merge/place squash-stretch, and badges
    for (const el of this.gameState.elements) {
      const entry = this.placedEntries.get(el.id);
      if (!entry) continue;
      const grp = entry.group;

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

      const voyage = this.gameState.mobility?.voyages[el.id];
      if (voyage) {
        const p = voyagePlacement(this.gameState, voyage.position, voyage.status === "Submerged", this.activeTravel);
        const blend = 1 - Math.exp(-dt*14);
        grp.position.x += (p.x - grp.position.x) * blend;
        grp.position.z += (p.z - grp.position.z) * blend;
        grp.position.y = p.y + Math.sin(elapsed * 1.5) * .06;
        const turn=voyage.heading-grp.rotation.y;
        grp.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*blend;
      }
      if (entry.disrepairBadge?.visible) {
        entry.disrepairBadge.rotation.y = elapsed * 2.4;
        entry.disrepairBadge.rotation.x = Math.sin(elapsed * 3.2) * 0.35;
      }
      if (entry.disconnectBadge?.visible) {
        entry.disconnectBadge.rotation.y = -elapsed * 1.8;
      }
    }

    this.mobilityVisuals.update(this.gameState, dt, this.activeTravel);
    if (this.following && this.cameraMode !== "walk") {
      const p = this.mobilityVisuals.position(this.following) ?? this.placedEntries.get(this.following)?.group.position;
      if (p) {
        this.target.lerp(p, 1-Math.exp(-dt*8));
        this.updateCameraTransform();
      } else {
        this.followService();
      }
    }
    // Traffic & Villagers
    this.trafficSyncAccum += dt;
    if (this.trafficSyncAccum >= 1.25) {
      this.trafficSyncAccum = 0;
      this.syncAutonomousTrafficAndVillagers();
    }
    this.advanceStreetTraffic(dt * (this.gameState.playSpeed ?? 1));

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
    this.farmActivity.animateHerds(dt);
    this.patrolCraft.update(this.gameState, dt, elapsed);

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
    this.projectSelectionRing();
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

    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.055, 0.28, dayFactor) * weatherDim;
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(0.90, 0.97, dayFactor);
    this.oceanUniforms.uDaylight.value = dayFactor;
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
      (THREE.MathUtils.lerp(0.58, 2.25, dayFactor) + this.lightningFlash * 2.8) * weatherDim;
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.32, 0.88, dayFactor) * weatherDim;
    this.hemiLight.color.setHex(0x748cba).lerp(new THREE.Color(0xf0f8ff), dayFactor);
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
    const state=this.gameState,kind=this.activeHeatmap;
    // Channel dimensions, entrances and lanes do not change between city edits.
    // Live services refresh once a second even when the player holds the camera still.
    const staticLayer=kind==="clearance"||kind==="neighbors"||kind==="lanes";
    const trafficClock = kind === "traffic" ? "|" + Math.round(state.timeOfDay * 12) + "|" + state.metrics.trafficTrips : "";
    const key=kind==="none"?"none":kind+"|"+travelSignature(state)+(staticLayer?"":"|"+Math.floor(state.activePlaySec))+trafficClock;
    if(this.heatmapKey===key)return;
    this.heatmapKey=key;
    for (const ch of [...this.heatmapGroup.children]) {
      this.heatmapGroup.remove(ch);
      if (ch instanceof THREE.Mesh) {
        (ch.material as THREE.Material).dispose();
        ch.geometry.dispose();
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
      const cell=getTerrainCell(this.gameState,s.gx,s.gz),k=tileKey(s.gx,s.gz);
      const y=this.activeHeatmap==="flow"?this.gameState.infrastructure?.conduits[k]?.height:this.activeHeatmap==="lanes"?this.gameState.infrastructure?.spans[k]?.deck:undefined;
      m4.makeTranslation(wx, (y??(cell.depth?cell.waterLevel:cell.elevation))+.12, wz);
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
      const prior=this.crimeVisuals.get(inc.id);
      const pose=patrolPosition(this.gameState,inc,this.activeTravel);
      if (prior && Boolean(prior.copCar)===Boolean(pose)) continue;
      if(prior){
        this.crimeGroup.remove(prior.burglar.root);
        if(prior.copCar)this.crimeGroup.remove(prior.copCar);
        if(prior.copOfficer)this.crimeGroup.remove(prior.copOfficer.root);
      }
      const burglar = this.createCriminalGroup();
      burglar.root.visible=false;
      this.crimeGroup.add(burglar.root);

      let copCar: THREE.Group | null = null;
      let sirenRed: THREE.Mesh | null = null;
      let sirenBlue: THREE.Mesh | null = null;
      let headlightL: THREE.Mesh | null = null;
      let headlightR: THREE.Mesh | null = null;
      let copOfficer: ReturnType<PixelWorldRenderer["createCopOfficerGroup"]> | null = null;

      if (pose) {
        const created = this.createPoliceCarGroup();
        copCar = created.car;
        sirenRed = created.sirenRed;
        sirenBlue = created.sirenBlue;
        headlightL = created.headlightL;
        headlightR = created.headlightR;
        copCar.position.set(pose.gx*TILE_SIZE,pose.height+.025,pose.gz*TILE_SIZE);
        copCar.rotation.y=Math.atan2(pose.dx,pose.dz);
        this.crimeGroup.add(copCar);

        copOfficer = this.createCopOfficerGroup();
        copOfficer.root.visible = false;
        this.crimeGroup.add(copOfficer.root);

      }

      this.crimeVisuals.set(inc.id, {
        burglar,
        copCar,
        sirenRed,
        sirenBlue,
        headlightL,
        headlightR,
        copOfficer,
        copAngle: pose ? Math.atan2(pose.dx,pose.dz):0,
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

      const pose=patrolPosition(this.gameState,inc,this.activeTravel);
      if(vis.copCar)vis.copCar.visible=Boolean(pose);
      if(!pose && vis.copOfficer)vis.copOfficer.root.visible=false;
      if (vis.copCar && pose) {
        const cx=pose.gx*TILE_SIZE,cz=pose.gz*TILE_SIZE, {dx,dz}=pose;
        vis.copCar.position.set(cx,pose.height+.025,cz);
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
        const lightsOn = this.gameState.timeOfDay < 6.5 || this.gameState.timeOfDay > 17.5 || !inc.policeArrived;
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
              this.streetHeight(ox,oz,false)+VOXEL_SIZE + Math.abs(copStride) * 0.12,
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

    this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius, 5.5, GRID_SIZE*TILE_SIZE*1.7);
    this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi, 0.06, 1.44);
    this.target.x = THREE.MathUtils.clamp(this.target.x,-GRID_HALF*TILE_SIZE,GRID_HALF*TILE_SIZE);
    this.target.y = THREE.MathUtils.clamp(this.target.y, 0, 14);
    this.target.z = THREE.MathUtils.clamp(this.target.z,-GRID_HALF*TILE_SIZE,GRID_HALF*TILE_SIZE);

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
      const step = fwd.multiplyScalar(forwardInput).addScaledVector(right, rightInput).normalize().multiplyScalar(spd);
      const [x, z] = this.resolveBuildingCollision(this.walkPos.x + step.x, this.walkPos.z + step.z, 0.27);
      this.walkPos.x = THREE.MathUtils.clamp(x,-GRID_HALF*TILE_SIZE+1,GRID_HALF*TILE_SIZE-1);
      this.walkPos.z = THREE.MathUtils.clamp(z,-GRID_HALF*TILE_SIZE+1,GRID_HALF*TILE_SIZE-1);
      const deck = this.streetHeight(this.walkPos.x, this.walkPos.z, Math.abs(step.x) > Math.abs(step.z));
      this.walkPos.y = THREE.MathUtils.lerp(this.walkPos.y, 2.3 + deck, Math.min(1, dt * 14));
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
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      this.hoverVoxel = null;
      return null;
    }
    const fineVoxelAim = Boolean(this.worksTool && isVoxelSculptTool(this.worksTool));
    if(this.gameState.infrastructure?.revision || fineVoxelAim){
      // Raymarch the 0.25m voxel surface (including natural stepped coastlines, raised hills, and submerged beds).
      const ray=this.raycaster.ray;const topHit=new THREE.Vector3();
      const ceilingY = this.gameState.infrastructure?.revision ? 28 : 4;
      if(ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-ceilingY),topHit)&&ray.direction.y<-.01){
        const step = fineVoxelAim ? 0.25 : 0.55;
        for(let d=0;d<Math.min(550,(topHit.y+12)/-ray.direction.y);d+=step){
          const x=topHit.x+ray.direction.x*d,z=topHit.z+ray.direction.z*d;
          const ground=sampleTerrainAt(this.gameState,x,z);
          if(topHit.y+ray.direction.y*d<=Math.max(ground.elevation,ground.depth?ground.waterLevel:-Infinity)){hit.set(x,ground.elevation,z);break;}
        }
      }
    }
    const [gx, gz] = worldToGrid(hit.x, hit.z);
    if (gx < GRID_MIN || gx > GRID_MAX || gz < GRID_MIN || gz > GRID_MAX) {
      this.hoverVoxel = null;
      return null;
    }
    this.hoverVoxel = worldToVoxel(hit.x, hit.z);
    return [gx, gz];
  }

  private matchesBulkFilter(el: PlacedElement): boolean {
    const def = ELEMENT_BY_ID[el.defId];
    if (!def) return false;
    if (this.bulkSelectFilter === "roads") return Boolean(def.isRoadNetwork || def.isRailNetwork);
    if (this.bulkSelectFilter === "buildings") return !def.isNetwork;
    return true;
  }

  private collectBulkAtGrid(gx: number, gz: number): string[] {
    const added: string[] = [];
    for (const el of this.gameState.elements) {
      if (gx >= el.gx && gx < el.gx + el.spanX && gz >= el.gz && gz < el.gz + el.spanZ) {
        if (!this.matchesBulkFilter(el)) continue;
        if (!this.bulkStrokeIds.has(el.id)) {
          this.bulkStrokeIds.add(el.id);
          added.push(el.id);
        }
      }
    }
    return added;
  }

  private raycastPlacedElement(clientX: number, clientY: number): string | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    // Prioritize placed roads and buildings FIRST so buses/taxis/transit trails riding over a road
    // NEVER hijack a road tap into opening the full-screen Transit sheet!
    const placedHits = this.raycaster.intersectObjects(this.placedGroup.children, true);
    for (const h of placedHits) {
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
    if (!this.bulkSelectMode) {
      const mobilityHits = this.raycaster.intersectObjects([this.mobilityVisuals.root], true);
      for (const h of mobilityHits) {
        let cur: THREE.Object3D | null = h.object;
        while (cur) {
          if (cur.userData?.serviceId) {
            return cur.userData.serviceId as string;
          }
          cur = cur.parent;
        }
      }
    }
    return null;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.stopWatchingConstruction();
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
      this.pendingTouchStart = null;
      this.worksStroke = [];
      this.networkStroke = [];
      this.cancelPendingOnTap = false;
      this.bulkLastGrid = null;
      this.bulkHasDragged = false;
      this.paintedTilesInStroke.clear();
      this.lastPaintedGrid = null;
      this.isPointerDown = false;
      this.pointerPanOverride = false;
      this.isDraggingCamera = true;
      this.rebuildNetworkStrokePreview();
      this.updateHoverOverlay();
      return;
    }

    this.hadMultiTouch = false;
    this.isPointerDown = true;
    this.pointerButton = e.button;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.lastPointerPos = { x: e.clientX, y: e.clientY };
    this.isDraggingCamera = false;
    this.pendingTouchStart = null;
    this.cancelPendingOnTap = false;
    this.paintedTilesInStroke.clear();

    const panOverride = e.button === 1 || (e.button === 0 && this.spaceDown) || (e.button === 2 && e.shiftKey);
    this.pointerPanOverride = panOverride;
    if (panOverride || e.button === 2) {
      return;
    }

    // If a 2+ road/bridge stretch checkmark is hovering, tapping anywhere else on the canvas cancels it!
    if (e.button === 0 && (this.pendingNetworkStroke || this.hasPendingBridgeConfirm)) {
      this.cancelPendingOnTap = true;
      return;
    }

    const g = this.computePointerGrid(e.clientX, e.clientY);
    this.hoverGrid = g;
    this.updateHoverOverlay();

    // Bulk draw-to-select mode: prepare stroke across roads/buildings
    if (e.button === 0 && this.bulkSelectMode) {
      this.bulkStrokeIds.clear();
      this.bulkHasDragged = false;
      this.bulkLastGrid = g ? [g[0], g[1]] : null;
      return;
    }

    if (e.button === 0 && this.worksTool && g) {
      const pt: GridPoint =
        isVoxelSculptTool(this.worksTool) && this.hoverVoxel
          ? { gx: g[0], gz: g[1], vx: this.hoverVoxel[0], vz: this.hoverVoxel[1] }
          : { gx: g[0], gz: g[1] };
      this.worksStroke = this.worksAnchor ? [this.worksAnchor, pt] : [pt];
      this.updateHoverOverlay();
      return;
    }

    // Continuous drag painting for 1x1 networks.
    // Roads & bridges (isRoadNetwork) accumulate into a live ghost stretch:
    //   1 tile -> places immediately on release; 2+ tiles -> freezes with floating Checkmark confirmation!
    if (e.button === 0 && this.brush.kind === "place" && this.brush.defId && g) {
      const def = ELEMENT_BY_ID[this.brush.defId];
      if (def?.isRoadNetwork) {
        if (e.pointerType === "touch") {
          this.pendingTouchStart = { gx: g[0], gz: g[1], clientX: e.clientX, clientY: e.clientY };
        } else {
          const key = `${g[0]},${g[1]}`;
          this.paintedTilesInStroke.add(key);
          this.lastPaintedGrid = [g[0], g[1]];
          this.networkStroke = [{ gx: g[0], gz: g[1] }];
          this.rebuildNetworkStrokePreview();
          this.updateHoverOverlay();
        }
      } else if (def?.isNetwork) {
        if (e.pointerType === "touch") {
          this.pendingTouchStart = { gx: g[0], gz: g[1], clientX: e.clientX, clientY: e.clientY };
        } else {
          const key = `${g[0]},${g[1]}`;
          this.paintedTilesInStroke.add(key);
          this.lastPaintedGrid = [g[0], g[1]];
          this.callbacks.onTilePlace(g[0], g[1]);
        }
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

      if (this.lastPinchDist && dist > 6 && Math.abs(dist - this.lastPinchDist) > 0.5) {
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
        const midDx = mid.x - this.lastPinchMid.x;
        const midDy = mid.y - this.lastPinchMid.y;
        if (Math.abs(midDx) > 0.25 || Math.abs(midDy) > 0.25) {
          if (this.cameraMode === "walk") {
            this.walkYaw -= midDx * 0.0045;
            this.walkPitch = THREE.MathUtils.clamp(this.walkPitch - midDy * 0.0045, -1.1, 0.9);
          } else if (this.cameraMode === "orbit") {
            // In 1-finger orbit mode, 2-finger drag pans smoothly across the island
            const viewH = Math.max(200, this.canvas.clientHeight || window.innerHeight);
            const worldPerPx = (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * this.spherical.radius) / viewH;
            const fwdScale = worldPerPx / Math.max(0.35, Math.cos(this.spherical.phi));
            const right = new THREE.Vector3(Math.cos(this.spherical.theta), 0, -Math.sin(this.spherical.theta));
            const fwd = new THREE.Vector3(-Math.sin(this.spherical.theta), 0, -Math.cos(this.spherical.theta));
            this.target.addScaledVector(right, -midDx * worldPerPx);
            this.target.addScaledVector(fwd, midDy * fwdScale);
          } else {
            // In default pan mode: 2-finger vertical drag tilts viewing angle (straight overhead <-> low angle),
            // while horizontal slide glides smoothly sideways.
            if (Math.abs(midDy) > 0.25) {
              this.spherical.phi -= midDy * 0.0065;
            }
            if (Math.abs(midDx) > 0.25) {
              const viewH = Math.max(200, this.canvas.clientHeight || window.innerHeight);
              const worldPerPx = (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * this.spherical.radius) / viewH;
              const right = new THREE.Vector3(Math.cos(this.spherical.theta), 0, -Math.sin(this.spherical.theta));
              this.target.addScaledVector(right, -midDx * worldPerPx);
            }
          }
          this.updateCameraTransform();
        }
      }

      this.lastPinchDist = dist;
      this.lastPinchAngle = angle;
      this.lastPinchMid = mid;
      return;
    }

    const prevVoxel = this.hoverVoxel;
    const g = this.computePointerGrid(e.clientX, e.clientY);
    const voxelChanged =
      Boolean(this.worksTool && isVoxelSculptTool(this.worksTool)) &&
      ((!prevVoxel && Boolean(this.hoverVoxel)) ||
        (Boolean(prevVoxel) && !this.hoverVoxel) ||
        (prevVoxel && this.hoverVoxel && (prevVoxel[0] !== this.hoverVoxel[0] || prevVoxel[1] !== this.hoverVoxel[1])));
    if (!this.hoverGrid || !g || this.hoverGrid[0] !== g[0] || this.hoverGrid[1] !== g[1] || voxelChanged) {
      this.hoverGrid = g;
      this.updateHoverOverlay();
    }

    if (!this.isPointerDown) return;

    const dx = e.clientX - this.lastPointerPos.x;
    const dy = e.clientY - this.lastPointerPos.y;
    this.lastPointerPos = { x: e.clientX, y: e.clientY };

    // PC camera pan/orbit overrides always take priority over placement strokes
    const panOverrideNow = this.pointerPanOverride || this.pointerButton === 1 || (this.pointerButton === 0 && this.spaceDown);
    if (panOverrideNow || this.pointerButton === 2) {
      const totalDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (totalDist > 2 || panOverrideNow) {
        this.isDraggingCamera = true;
      }
      if (this.cameraMode === "walk") {
        this.walkYaw -= dx * 0.0045;
        this.walkPitch = THREE.MathUtils.clamp(this.walkPitch - dy * 0.0035, -1.1, 0.9);
      } else if (this.pointerButton === 2 && !e.shiftKey && !panOverrideNow) {
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
      return;
    }

    // Bulk draw-to-select brush sweep (Manhattan interpolated so fast drags never miss a road tile)
    if (this.bulkSelectMode && this.pointerButton === 0 && !this.cancelPendingOnTap && g) {
      const moved = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (moved > 5) {
        const newlyAdded: string[] = [];
        if (!this.bulkHasDragged) {
          this.bulkHasDragged = true;
          if (this.bulkLastGrid) {
            newlyAdded.push(...this.collectBulkAtGrid(this.bulkLastGrid[0], this.bulkLastGrid[1]));
          }
        }
        const [tx, tz] = g;
        if (!this.bulkLastGrid) {
          this.bulkLastGrid = [tx, tz];
          newlyAdded.push(...this.collectBulkAtGrid(tx, tz));
        } else {
          let [cx, cz] = this.bulkLastGrid;
          let guard = 0;
          while ((cx !== tx || cz !== tz) && guard < 48) {
            guard += 1;
            if (cx !== tx) cx += Math.sign(tx - cx);
            else if (cz !== tz) cz += Math.sign(tz - cz);
            newlyAdded.push(...this.collectBulkAtGrid(cx, cz));
          }
          this.bulkLastGrid = [tx, tz];
        }
        if (newlyAdded.length > 0) {
          this.callbacks.onBulkSelectElements?.(newlyAdded, "add");
        }
        return;
      }
      return;
    }

    if (this.worksTool && this.worksStroke.length && this.pointerButton === 0) {
      const previous = this.worksStroke.at(-1)!;
      if (isVoxelSculptTool(this.worksTool) && g && this.hoverVoxel) {
        const [vx, vz] = this.hoverVoxel;
        if (vx !== previous.vx || vz !== previous.vz) {
          this.worksStroke.push({ gx: g[0], gz: g[1], vx, vz });
          this.updateHoverOverlay();
        }
      } else if (g && (g[0] !== previous.gx || g[1] !== previous.gz)) {
        this.worksStroke.push({ gx: g[0], gz: g[1] });
        this.updateHoverOverlay();
      }
      return;
    }

    // Left-drag continuous Manhattan painting when placing roads/paths/bridges/tracks (zero gaps on fast sweeps!)
    if (!this.cancelPendingOnTap && this.pointerButton === 0 && this.brush.kind === "place" && this.brush.defId) {
      const def = ELEMENT_BY_ID[this.brush.defId];
      if (def?.isRoadNetwork && g) {
        let strokeChanged = false;
        if (this.pendingTouchStart) {
          const moved = Math.hypot(e.clientX - this.pendingTouchStart.clientX, e.clientY - this.pendingTouchStart.clientY);
          if (moved <= 4) return;
          const start = this.pendingTouchStart;
          this.pendingTouchStart = null;
          const startKey = `${start.gx},${start.gz}`;
          this.paintedTilesInStroke.add(startKey);
          this.lastPaintedGrid = [start.gx, start.gz];
          this.networkStroke = [{ gx: start.gx, gz: start.gz }];
          strokeChanged = true;
        }

        const [tx, tz] = g;
        if (!this.lastPaintedGrid) {
          this.lastPaintedGrid = [tx, tz];
          const key = `${tx},${tz}`;
          if (!this.paintedTilesInStroke.has(key)) {
            this.paintedTilesInStroke.add(key);
            this.networkStroke.push({ gx: tx, gz: tz });
            strokeChanged = true;
          }
        } else {
          let [cx, cz] = this.lastPaintedGrid;
          let guard = 0;
          while ((cx !== tx || cz !== tz) && guard < 48) {
            guard += 1;
            if (cx !== tx) {
              cx += Math.sign(tx - cx);
            } else if (cz !== tz) {
              cz += Math.sign(tz - cz);
            }
            const key = `${cx},${cz}`;
            if (!this.paintedTilesInStroke.has(key)) {
              this.paintedTilesInStroke.add(key);
              this.networkStroke.push({ gx: cx, gz: cz });
              strokeChanged = true;
            }
          }
          this.lastPaintedGrid = [tx, tz];
        }
        if (strokeChanged) {
          this.rebuildNetworkStrokePreview();
          this.updateHoverOverlay();
        }
        return;
      } else if (def?.isNetwork && g) {
        if (this.pendingTouchStart) {
          const moved = Math.hypot(e.clientX - this.pendingTouchStart.clientX, e.clientY - this.pendingTouchStart.clientY);
          if (moved <= 4) return;
          const start = this.pendingTouchStart;
          this.pendingTouchStart = null;
          const startKey = `${start.gx},${start.gz}`;
          this.paintedTilesInStroke.add(startKey);
          this.lastPaintedGrid = [start.gx, start.gz];
          this.callbacks.onTilePlace(start.gx, start.gz);
        }

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
      this.spherical.theta -= dx * 0.0072;
      this.spherical.phi -= dy * 0.0062;
    } else {
      const viewH = Math.max(200, this.canvas.clientHeight || window.innerHeight);
      const worldPerPx = (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * this.spherical.radius) / viewH;
      const fwdScale = worldPerPx / Math.max(0.35, Math.cos(this.spherical.phi));
      const right = new THREE.Vector3(Math.cos(this.spherical.theta), 0, -Math.sin(this.spherical.theta));
      const fwd = new THREE.Vector3(-Math.sin(this.spherical.theta), 0, -Math.cos(this.spherical.theta));
      this.target.addScaledVector(right, -dx * worldPerPx);
      this.target.addScaledVector(fwd, dy * fwdScale);
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
      if (this.activePointers.size === 1) {
        // Seamless 2-finger -> 1-finger handoff without needing to lift and retouch
        const remaining = Array.from(this.activePointers.values())[0];
        this.lastPointerPos = { x: remaining.x, y: remaining.y };
        this.pointerDownPos = { x: remaining.x, y: remaining.y };
        this.isPointerDown = true;
        this.isDraggingCamera = true;
        return;
      }
      this.hadMultiTouch = false;
      this.pendingTouchStart = null;
      this.isPointerDown = false;
      this.pointerPanOverride = false;
      this.isDraggingCamera = false;
      this.lastPaintedGrid = null;
      return;
    }

    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    this.lastPaintedGrid = null;

    if (this.pointerPanOverride) {
      this.pointerPanOverride = false;
      this.pendingTouchStart = null;
      return;
    }

    if (this.cancelPendingOnTap) {
      this.cancelPendingOnTap = false;
      if (!this.isDraggingCamera && e.button === 0) {
        this.callbacks.onCancelPendingStroke?.();
      }
      return;
    }

    if (this.bulkSelectMode && e.button === 0) {
      const wasDragged = this.bulkHasDragged;
      this.bulkHasDragged = false;
      this.bulkLastGrid = null;
      this.bulkStrokeIds.clear();
      if (!wasDragged && !this.isDraggingCamera) {
        const hitId = this.raycastPlacedElement(e.clientX, e.clientY);
        if (hitId) {
          const hitEl = this.gameState.elements.find((item) => item.id === hitId);
          if (hitEl && this.matchesBulkFilter(hitEl)) {
            this.callbacks.onBulkSelectElements?.([hitId], "toggle");
          }
        }
      }
      return;
    }

    if (this.networkStroke.length > 0 && e.button === 0 && this.brush.kind === "place" && this.brush.defId) {
      const pts = [...this.networkStroke];
      this.networkStroke = [];
      if (pts.length === 1) {
        this.rebuildNetworkStrokePreview();
        this.updateHoverOverlay();
        this.callbacks.onTilePlace(pts[0].gx, pts[0].gz);
      } else {
        const pending: PendingNetworkStroke = { defId: this.brush.defId, points: pts };
        this.pendingNetworkStroke = pending;
        this.rebuildNetworkStrokePreview();
        this.updateHoverOverlay();
        this.callbacks.onPendingNetworkStroke?.(pending);
      }
      return;
    }

    if (this.pendingTouchStart) {
      const start = this.pendingTouchStart;
      this.pendingTouchStart = null;
      if (e.button === 0 && !this.isDraggingCamera) {
        this.callbacks.onTilePlace(start.gx, start.gz);
      }
      return;
    }

    if (this.worksTool && this.worksStroke.length && e.button === 0) {
      const points = this.worksStroke;
      this.worksStroke = [];
      if (this.worksTool.kind === "bridge" && points.length === 1 && !this.worksAnchor && !this.gameState.infrastructure?.spans[tileKey(points[0].gx, points[0].gz)]) this.worksAnchor = points[0];
      else {
        this.worksAnchor = null;
        this.callbacks.onInfrastructureStroke?.(this.worksTool, points);
      }
      this.updateHoverOverlay();
      return;
    }

    if (!this.isDraggingCamera && e.button === 0) {
      const g = this.computePointerGrid(e.clientX, e.clientY);
      if (this.brush.kind === "move" && this.brush.movingGroupIds?.length && g) {
        this.callbacks.onGroupMoveTarget?.(g[0], g[1]);
      } else if (this.brush.kind === "move" && this.brush.movingElementId && g) {
        this.callbacks.onTileMoveCommit(this.brush.movingElementId, g[0], g[1]);
      } else if (this.brush.kind === "place" && this.brush.defId && g) {
        const def = ELEMENT_BY_ID[this.brush.defId];
        if (!def?.isNetwork) {
          this.callbacks.onTilePlace(g[0], g[1]);
        }
      } else {
        if (g && this.callbacks.onInspectTile?.(g[0], g[1])) return;
        const hitId = this.raycastPlacedElement(e.clientX, e.clientY);
        if (hitId && this.gameState.mobility?.lines.some((l) => l.id === hitId)) this.callbacks.onSelectService?.(hitId);
        else if (hitId) this.callbacks.onSelectElement(hitId, e.shiftKey);
        else if (g && this.callbacks.onEmptyTileTap) this.callbacks.onEmptyTileTap(g[0], g[1]);
        else this.callbacks.onSelectElement(null, e.shiftKey);
      }
    }
  };

  private onPointerCancel = (e: PointerEvent) => {
    this.worksStroke = [];
    this.worksAnchor = null;
    this.networkStroke = [];
    this.cancelPendingOnTap = false;
    this.bulkHasDragged = false;
    this.bulkLastGrid = null;
    this.bulkStrokeIds.clear();
    this.pendingTouchStart = null;
    this.rebuildNetworkStrokePreview();
    this.updateHoverOverlay();
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDist = null;
      this.lastPinchAngle = null;
      this.lastPinchMid = null;
    }
    if (this.activePointers.size === 0) {
      this.hadMultiTouch = false;
      this.isPointerDown = false;
      this.pointerPanOverride = false;
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
    if (document.querySelector("dialog[open]") || (e.target instanceof Element && e.target.closest("input,textarea,select,button,summary,a,[contenteditable=true]"))) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.code === "Space") {
      this.spaceDown = true;
      e.preventDefault();
    }
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      this.spaceDown = false;
    }
    this.keysDown.delete(e.code);
  };

  private onWindowBlur = () => {
    this.keysDown.clear();
    this.spaceDown = false;
    this.pointerPanOverride = false;
    this.pendingTouchStart = null;
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
    window.addEventListener("blur", this.onWindowBlur);
    window.addEventListener("resize", this.onResize);
  }

  public dispose(): void {
    this.updateCurbPreviews();
    if (this.ghostGroup) releaseParcelGeometry(this.ghostGroup);
    for (const entry of this.placedEntries.values()) releaseParcelGeometry(entry.group);
    this.setHeatmap("none");
    this.clearGeography();
    this.engineering.dispose();
    this.templeLights.dispose();
    this.disposed = true;
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onWindowBlur);
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
    this.farmActivity.dispose();
    this.patrolCraft.dispose();
    this.mobilityVisuals.dispose();
    this.groupOutline.geometry.dispose();
    this.groupOutline.material.dispose();
    this.renderer.dispose();
  }
}
