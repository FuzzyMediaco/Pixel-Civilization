import * as THREE from "three";

export const TILE_SIZE = 4.0;
export const VOXELS_PER_TILE = 16; // 0.25m crisp 32-bit pixel blocks for unmistakable architectural detail
export const VOXEL_SIZE = TILE_SIZE / VOXELS_PER_TILE;

export const PALETTE: Record<string, string> = {
  grass: "#86c864",
  grass2: "#78ba57",
  grass3: "#97d675",
  soil: "#8b5e3c",
  soilDark: "#70492c",
  path: "#e6d6b5",
  path2: "#d8c6a1",
  concrete: "#dcd6cb",
  stone: "#8e948c",
  concrete2: "#cfcac0",
  concreteDark: "#b4afa5",
  asphalt: "#52565e",
  asphaltDark: "#3e424a",
  slate: "#434854",
  slateLight: "#656d7d",
  brick: "#cc7a57",
  brick2: "#b96947",
  brickDark: "#945036",
  mortar: "#e5cbb0",
  plaster: "#f2eadb",
  cream: "#faf3e3",
  limestone: "#e8dfc8",
  marble: "#f5f2ec",
  marbleShade: "#e1ddd4",
  granite: "#7a7e85",
  wood: "#c9935b",
  woodLight: "#deb07c",
  woodDark: "#8f5e36",
  oak: "#a87444",
  crate: "#d4a366",
  leather: "#6e4328",
  terracotta: "#c86d49",
  steel: "#8c99a6",
  steelLight: "#b4c0cc",
  steelDark: "#59636e",
  iron: "#3b4048",
  chrome: "#d8e2eb",
  brass: "#d9a74a",
  gold: "#f4c44e",
  goldDark: "#c79428",
  copper: "#c8754b",
  hazard: "#f2be38",
  red: "#df5246",
  redDark: "#a8342b",
  crimson: "#be3438",
  orange: "#ec8438",
  amber: "#ffb642",
  yellow: "#f6d55c",
  busYellow: "#f5b82e",
  lime: "#96d65f",
  leaf: "#58ad52",
  leafDark: "#3e853b",
  leafLight: "#78c86c",
  olive: "#7c9c59",
  teal: "#47b0a3",
  tealDark: "#2d7d74",
  cyan: "#5ce6db",
  sky: "#6fb7f0",
  water: "#3fa4de",
  waterDeep: "#2678b2",
  foam: "#effafd",
  blue: "#4c82d4",
  blueDark: "#2f5696",
  solarBlue: "#1e3a8a",
  indigo: "#5b63b8",
  purple: "#9370cf",
  purpleDark: "#65469c",
  pink: "#ec8db0",
  magenta: "#d95ca3",
  white: "#fcfaf5",
  silver: "#c5ccd4",
  charcoal: "#262930",
  rubber: "#23252b",
  black: "#181a20",
  glass: "#9edaf0",
  glassDark: "#5da6c9",
  warmGlow: "#ffe29a",
  screenCyan: "#64f5df",
  screenGreen: "#5ef28c",
  fire: "#ff7426",
  lava: "#ff5a1f",
  basalt: "#363840",
  ash: "#6c6e75",
  sand: "#ead39c",
  sandDark: "#d4b87b",
  moss: "#4b9645",
  snow: "#f3f7fc",
  oliveDrab: "#4b6b3c",
  camoTan: "#b8a278",
};

const AO_LEVELS = [0.26, 0.54, 0.8, 1.0];

interface FaceDef {
  n: [number, number, number];
  corners: [number, number, number][];
  aoDirs: [number, number, number][][];
  stepU: [number, number, number];
  stepV: [number, number, number];
}

const RAW_FACES = [
  {
    n: [1, 0, 0] as [number, number, number],
    corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] as [number, number, number][],
    aoDirs: [
      [[1, -1, 0], [1, 0, 1], [1, -1, 1]],
      [[1, -1, 0], [1, 0, -1], [1, -1, -1]],
      [[1, 1, 0], [1, 0, -1], [1, 1, -1]],
      [[1, 1, 0], [1, 0, 1], [1, 1, 1]],
    ] as [number, number, number][][],
  },
  {
    n: [-1, 0, 0] as [number, number, number],
    corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] as [number, number, number][],
    aoDirs: [
      [[-1, -1, 0], [-1, 0, -1], [-1, -1, -1]],
      [[-1, -1, 0], [-1, 0, 1], [-1, -1, 1]],
      [[-1, 1, 0], [-1, 0, 1], [-1, 1, 1]],
      [[-1, 1, 0], [-1, 0, -1], [-1, 1, -1]],
    ] as [number, number, number][][],
  },
  {
    n: [0, 1, 0] as [number, number, number],
    corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] as [number, number, number][],
    aoDirs: [
      [[-1, 1, 0], [0, 1, 1], [-1, 1, 1]],
      [[1, 1, 0], [0, 1, 1], [1, 1, 1]],
      [[1, 1, 0], [0, 1, -1], [1, 1, -1]],
      [[-1, 1, 0], [0, 1, -1], [-1, 1, -1]],
    ] as [number, number, number][][],
  },
  {
    n: [0, -1, 0] as [number, number, number],
    corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] as [number, number, number][],
    aoDirs: [
      [[-1, -1, 0], [0, -1, -1], [-1, -1, -1]],
      [[1, -1, 0], [0, -1, -1], [1, -1, -1]],
      [[1, -1, 0], [0, -1, 1], [1, -1, 1]],
      [[-1, -1, 0], [0, -1, 1], [-1, -1, 1]],
    ] as [number, number, number][][],
  },
  {
    n: [0, 0, 1] as [number, number, number],
    corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] as [number, number, number][],
    aoDirs: [
      [[-1, 0, 1], [0, -1, 1], [-1, -1, 1]],
      [[1, 0, 1], [0, -1, 1], [1, -1, 1]],
      [[1, 0, 1], [0, 1, 1], [1, 1, 1]],
      [[-1, 0, 1], [0, 1, 1], [-1, 1, 1]],
    ] as [number, number, number][][],
  },
  {
    n: [0, 0, -1] as [number, number, number],
    corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] as [number, number, number][],
    aoDirs: [
      [[1, 0, -1], [0, -1, -1], [1, -1, -1]],
      [[-1, 0, -1], [0, -1, -1], [-1, -1, -1]],
      [[-1, 0, -1], [0, 1, -1], [-1, 1, -1]],
      [[1, 0, -1], [0, 1, -1], [1, 1, -1]],
    ] as [number, number, number][][],
  },
];

const FACES: FaceDef[] = RAW_FACES.map((f) => {
  const c0 = f.corners[0];
  const c1 = f.corners[1];
  const c3 = f.corners[3];
  return {
    ...f,
    stepU: [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]],
    stepV: [c3[0] - c0[0], c3[1] - c0[1], c3[2] - c0[2]],
  };
});

const rgbCache = new Map<string, [number, number, number]>();
export function parseColorLinear(hexOrName: string): [number, number, number] {
  const key = PALETTE[hexOrName] || hexOrName || "#eae4d7";
  let cached = rgbCache.get(key);
  if (!cached) {
    const c = new THREE.Color();
    try {
      c.set(key);
    } catch {
      c.set("#eae4d7");
    }
    const lum = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
    const sat = 1.16;
    cached = [
      Math.max(0, Math.min(1, lum + (c.r - lum) * sat)),
      Math.max(0, Math.min(1, lum + (c.g - lum) * sat)),
      Math.max(0, Math.min(1, lum + (c.b - lum) * sat)),
    ];
    rgbCache.set(key, cached);
  }
  return cached;
}

const KEY_BIAS = 512;
const KEY_MASK = 1023;
export function packVoxKey(x: number, y: number, z: number): number {
  return (
    (((x + KEY_BIAS) & KEY_MASK) << 20) |
    (((y + KEY_BIAS) & KEY_MASK) << 10) |
    ((z + KEY_BIAS) & KEY_MASK)
  );
}

const styleKeyToId = new Map<string, number>();
const styleRgbs: ([number, number, number] | null)[] = [null];
const styleEmits: number[] = [0];

/** Linear color used by both the live mesh and the offline handbook illustrations. */
export function getVoxelStyleColor(style: number): readonly [number,number,number] {
  return styleRgbs[style] ?? [1,1,1];
}

function internVoxStyle(colStr: string, emitVal: number): number {
  const numEmit = Number(emitVal) || 0;
  const k = numEmit === 0 ? colStr : `${colStr}|${numEmit}`;
  let id = styleKeyToId.get(k);
  if (!id) {
    id = styleRgbs.length;
    styleKeyToId.set(k, id);
    styleRgbs.push(parseColorLinear(colStr));
    styleEmits.push(numEmit);
  }
  return id;
}

export class PixelVox {
  v = new Map<number, number>();
  seed: number;

  constructor(seed = 1) {
    this.seed = seed;
  }

  get size(): number {
    return this.v.size;
  }

  put(x: number, y: number, z: number, color: string | null, emit = 0): this {
    const xi = Math.round(x) | 0;
    const yi = Math.round(y) | 0;
    const zi = Math.round(z) | 0;
    const k = packVoxKey(xi, yi, zi);
    if (!color) {
      this.v.delete(k);
    } else {
      const col = PALETTE[color] || color;
      this.v.set(k, internVoxStyle(col, emit));
    }
    return this;
  }

  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    color: string | null,
    emit = 0,
  ): this {
    const ax0 = Math.round(Math.min(x0, x1)) | 0;
    const ax1 = Math.round(Math.max(x0, x1)) | 0;
    const ay0 = Math.round(Math.min(y0, y1)) | 0;
    const ay1 = Math.round(Math.max(y0, y1)) | 0;
    const az0 = Math.round(Math.min(z0, z1)) | 0;
    const az1 = Math.round(Math.max(z0, z1)) | 0;
    if (!color) {
      if (this.v.size === 0) return this;
      for (let x = ax0; x < ax1; x++) {
        const kx = ((x + KEY_BIAS) & KEY_MASK) << 20;
        for (let y = ay0; y < ay1; y++) {
          const kxy = kx | (((y + KEY_BIAS) & KEY_MASK) << 10);
          for (let z = az0; z < az1; z++) {
            this.v.delete(kxy | ((z + KEY_BIAS) & KEY_MASK));
          }
        }
      }
      return this;
    }
    const styleId = internVoxStyle(PALETTE[color] || color, emit);
    for (let x = ax0; x < ax1; x++) {
      const kx = ((x + KEY_BIAS) & KEY_MASK) << 20;
      for (let y = ay0; y < ay1; y++) {
        const kxy = kx | (((y + KEY_BIAS) & KEY_MASK) << 10);
        for (let z = az0; z < az1; z++) {
          this.v.set(kxy | ((z + KEY_BIAS) & KEY_MASK), styleId);
        }
      }
    }
    return this;
  }

  clear(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): this {
    return this.box(x0, y0, z0, x1, y1, z1, null);
  }

  hollowBox(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    color: string,
    trim?: string,
  ): this {
    this.box(x0, y0, z0, x1, y1, z1, color);
    if (Math.abs(x1 - x0) > 2 && Math.abs(z1 - z0) > 2 && Math.abs(y1 - y0) > 2) {
      this.clear(x0 + 1, y0 + 1, z0 + 1, x1 - 1, y1 - 1, z1 - 1);
    }
    if (trim) {
      for (const px of [x0, x1 - 1]) {
        for (const pz of [z0, z1 - 1]) {
          this.box(px, y0, pz, px + 1, y1, pz + 1, trim);
        }
      }
    }
    return this;
  }

  cylinderY(
    cx: number,
    cz: number,
    y0: number,
    y1: number,
    radius: number,
    color: string,
    emit = 0,
  ): this {
    const ri = Math.ceil(Math.max(0.5, radius)) + 1;
    const ay0 = Math.round(Math.min(y0, y1));
    const ay1 = Math.max(ay0 + 1, Math.round(Math.max(y0, y1)));
    const r2 = radius * radius + 0.15;
    for (let x = Math.floor(cx - ri); x <= Math.ceil(cx + ri); x++) {
      for (let z = Math.floor(cz - ri); z <= Math.ceil(cz + ri); z++) {
        if ((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 <= r2) {
          this.box(x, ay0, z, x + 1, ay1, z + 1, color, emit);
        }
      }
    }
    return this;
  }

  ringZ(
    cx: number,
    cy: number,
    z0: number,
    z1: number,
    outerR: number,
    innerR: number,
    color: string,
    emit = 0,
  ): this {
    const ri = Math.ceil(outerR) + 1;
    const o2 = outerR * outerR + 0.2;
    const i2 = innerR * innerR;
    for (let x = Math.floor(cx - ri); x <= Math.ceil(cx + ri); x++) {
      for (let y = Math.floor(cy - ri); y <= Math.ceil(cy + ri); y++) {
        const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
        if (d2 <= o2 && d2 >= i2) {
          this.box(x, y, z0, x + 1, y + 1, z1, color, emit);
        }
      }
    }
    return this;
  }

  cone(
    cx: number,
    y0: number,
    y1: number,
    cz: number,
    rBottom: number,
    rTop: number,
    color: string,
    emit = 0,
  ): this {
    const ay0 = Math.round(Math.min(y0, y1));
    const ay1 = Math.max(ay0 + 1, Math.round(Math.max(y0, y1)));
    const span = Math.max(1, ay1 - ay0);
    for (let y = ay0; y < ay1; y++) {
      const t = (y - ay0) / span;
      const r = rBottom + (rTop - rBottom) * t;
      this.cylinderY(cx, cz, y, y + 1, Math.max(0.45, r), color, emit);
    }
    return this;
  }

  sphere(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    color: string,
    emit = 0,
  ): this {
    const arx = Math.max(0.5, rx);
    const ary = Math.max(0.5, ry);
    const arz = Math.max(0.5, rz);
    for (let x = Math.floor(cx - arx) - 1; x <= Math.ceil(cx + arx) + 1; x++) {
      for (let y = Math.floor(cy - ary) - 1; y <= Math.ceil(cy + ary) + 1; y++) {
        for (let z = Math.floor(cz - arz) - 1; z <= Math.ceil(cz + arz) + 1; z++) {
          const d =
            ((x + 0.5 - cx) / arx) ** 2 +
            ((y + 0.5 - cy) / ary) ** 2 +
            ((z + 0.5 - cz) / arz) ** 2;
          if (d <= 1.0) this.put(x, y, z, color, emit);
        }
      }
    }
    return this;
  }

  dome(cx: number, yBase: number, cz: number, radius: number, color: string, emit = 0): this {
    const r = Math.max(0.6, radius);
    const yb = Math.round(yBase);
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
      for (let y = yb; y <= Math.ceil(yb + r) + 1; y++) {
        for (let z = Math.floor(cz - r) - 1; z <= Math.ceil(cz + r) + 1; z++) {
          const d =
            ((x + 0.5 - cx) / r) ** 2 +
            ((y + 0.5 - yb) / r) ** 2 +
            ((z + 0.5 - cz) / r) ** 2;
          if (d <= 1.0) this.put(x, y, z, color, emit);
        }
      }
    }
    return this;
  }

  roofGable(
    x0: number,
    yBase: number,
    z0: number,
    x1: number,
    z1: number,
    rise: number,
    axis: "x" | "z",
    roofCol: string,
    trimCol?: string,
  ): this {
    const ax0 = Math.round(Math.min(x0, x1));
    const ax1 = Math.round(Math.max(x0, x1));
    const az0 = Math.round(Math.min(z0, z1));
    const az1 = Math.round(Math.max(z0, z1));
    for (let step = 0; step < rise; step++) {
      if (axis === "x") {
        if (az0 + step >= az1 - step) break;
        this.box(ax0, yBase + step, az0 + step, ax1, yBase + step + 1, az1 - step, roofCol);
        if (trimCol) {
          this.box(ax0, yBase + step, az0 + step, ax0 + 1, yBase + step + 1, az1 - step, trimCol);
          this.box(ax1 - 1, yBase + step, az0 + step, ax1, yBase + step + 1, az1 - step, trimCol);
        }
      } else {
        if (ax0 + step >= ax1 - step) break;
        this.box(ax0 + step, yBase + step, az0, ax1 - step, yBase + step + 1, az1, roofCol);
        if (trimCol) {
          this.box(ax0 + step, yBase + step, az0, ax1 - step, yBase + step + 1, az0 + 1, trimCol);
          this.box(ax0 + step, yBase + step, az1 - 1, ax1 - step, yBase + step + 1, az1, trimCol);
        }
      }
    }
    return this;
  }

  roofPyramid(
    x0: number,
    yBase: number,
    z0: number,
    x1: number,
    z1: number,
    roofCol: string,
    trimCol?: string,
  ): this {
    const ax0 = Math.round(Math.min(x0, x1));
    const ax1 = Math.round(Math.max(x0, x1));
    const az0 = Math.round(Math.min(z0, z1));
    const az1 = Math.round(Math.max(z0, z1));
    for (let s = 0; ax0 + s < ax1 - s && az0 + s < az1 - s; s++) {
      this.box(
        ax0 + s,
        yBase + s,
        az0 + s,
        ax1 - s,
        yBase + s + 1,
        az1 - s,
        s === 0 && trimCol ? trimCol : roofCol,
      );
    }
    return this;
  }

  windowsRow(
    x0: number,
    x1: number,
    y: number,
    z: number,
    axis: "x" | "z",
    glassCol = "glass",
    step = 2,
    emit = 0.28,
  ): this {
    if (axis === "x") {
      for (let x = x0; x < x1; x += step) {
        this.put(x, y, z, glassCol, emit);
      }
    } else {
      for (let zp = x0; zp < x1; zp += step) {
        this.put(z, y, zp, glassCol, emit);
      }
    }
    return this;
  }
}

export const voxelNightUniform = { value: 0.0 };

let sharedPixelVoxelMaterial: THREE.MeshStandardMaterial | null = null;
let sharedGhostMaterial: THREE.MeshStandardMaterial | null = null;

export function getPixelVoxelMaterial(): THREE.MeshStandardMaterial {
  if (sharedPixelVoxelMaterial) return sharedPixelVoxelMaterial;
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.76,
    metalness: 0.05,
    dithering: true,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNightGlow = voxelNightUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aEmit;
        attribute float aJitterSeed;
        varying float vEmit;
        varying float vJitterSeed;
        varying vec2 vVoxUv;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vEmit = aEmit;
        vJitterSeed = aJitterSeed;
        vVoxUv = uv;`,
      );

    //Crisper pixel-block grid borders & quantized cell tone variation for unmistakable pixel-art charm!
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uNightGlow;
        varying float vEmit;
        varying float vJitterSeed;
        varying vec2 vVoxUv;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float voxPx = max(fwidth(vVoxUv.x), fwidth(vVoxUv.y));
        float voxDetail = 1.0 - smoothstep(0.06, 0.22, voxPx);
        vec2 cellUv = fract(vVoxUv);
        if (vJitterSeed >= 0.0 && voxDetail > 0.005) {
          vec2 cellId = floor(vVoxUv);
          vec2 jq = fract(cellId * vec2(123.34, 456.21) + vJitterSeed);
          jq += dot(jq, jq + 45.32);
          float cellJ = (floor(fract(jq.x * jq.y) * 4.0) / 3.0) - 0.5;
          diffuseColor.rgb *= 1.0 + cellJ * 0.095 * voxDetail;
        }
        float edgeDist = min(min(cellUv.x, 1.0 - cellUv.x), min(cellUv.y, 1.0 - cellUv.y));
        float seam = smoothstep(0.0, max(0.105, voxPx * 1.45), edgeDist);
        float hi = smoothstep(0.16, 0.03, edgeDist) * (cellUv.y * 0.65 + 0.35);
        diffuseColor.rgb *= mix(1.0 - 0.28 * voxDetail, 1.0, seam);
        diffuseColor.rgb += hi * 0.065 * voxDetail;
        if (vEmit > 0.05) {
          diffuseColor.rgb *= mix(0.65, 1.15, uNightGlow);
        }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * min(vEmit * (0.55 + uNightGlow * 1.65), 2.3);`,
      );
  };
  mat.customProgramCacheKey = () => "pixel-civ-voxel-mat-v2";
  sharedPixelVoxelMaterial = mat;
  return mat;
}

let sharedDimmedMaterial: THREE.MeshStandardMaterial | null = null;

export function getGhostPreviewMaterial(valid = true): THREE.MeshStandardMaterial {
  if (!sharedGhostMaterial) {
    sharedGhostMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.55,
      metalness: 0.05,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
    });
  }
  sharedGhostMaterial.emissive.set(valid ? "#3fb963" : "#df5246");
  sharedGhostMaterial.emissiveIntensity = valid ? 0.22 : 0.45;
  return sharedGhostMaterial;
}

export function getDimmedVoxelMaterial(): THREE.MeshStandardMaterial {
  if (!sharedDimmedMaterial) {
    sharedDimmedMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.02,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
  }
  return sharedDimmedMaterial;
}

let greedyMaskScratch = new Int32Array(4096);

export function buildVoxelGeometry(vox: PixelVox, scale = VOXEL_SIZE): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const emits: number[] = [];
  const jSeeds: number[] = [];
  const indices: number[] = [];

  const map = vox.v;
  const seedBase = (vox.seed & 1023) * 0.73;
  let vertCount = 0;

  const emitQuad = (
    x0: number,
    y0: number,
    z0: number,
    w: number,
    h: number,
    face: FaceDef,
    fi: number,
    sliceW: number,
    u0: number,
    v0: number,
    br: number,
    bg: number,
    bb: number,
    ao0: number,
    ao1: number,
    ao2: number,
    ao3: number,
    emit: number,
    dirShade: number,
  ) => {
    const [nx, ny, nz] = face.n;
    const c0 = face.corners[0];
    const su = face.stepU;
    const sv = face.stepV;
    const bx = x0 + c0[0];
    const by = y0 + c0[1];
    const bz = z0 + c0[2];
    const wx = w * su[0];
    const wy = w * su[1];
    const wz = w * su[2];
    const hx = h * sv[0];
    const hy = h * sv[1];
    const hz = h * sv[2];

    positions.push(
      bx * scale,
      by * scale,
      bz * scale,
      (bx + wx) * scale,
      (by + wy) * scale,
      (bz + wz) * scale,
      (bx + wx + hx) * scale,
      (by + wy + hy) * scale,
      (bz + wz + hz) * scale,
      (bx + hx) * scale,
      (by + hy) * scale,
      (bz + hz) * scale,
    );
    normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);

    const s0 = ao0 * dirShade;
    const s1 = ao1 * dirShade;
    const s2 = ao2 * dirShade;
    const s3 = ao3 * dirShade;
    colors.push(
      Math.min(1, br * s0),
      Math.min(1, bg * s0),
      Math.min(1, bb * s0),
      Math.min(1, br * s1),
      Math.min(1, bg * s1),
      Math.min(1, bb * s1),
      Math.min(1, br * s2),
      Math.min(1, bg * s2),
      Math.min(1, bb * s2),
      Math.min(1, br * s3),
      Math.min(1, bg * s3),
      Math.min(1, bb * s3),
    );

    const uBase = u0 + 512;
    const vBase = v0 + 512;
    uvs.push(uBase, vBase, uBase + w, vBase, uBase + w, vBase + h, uBase, vBase + h);
    emits.push(emit, emit, emit, emit);

    const jSeed = seedBase + fi * 13.1 + (sliceW + 512) * 2.3;
    jSeeds.push(jSeed, jSeed, jSeed, jSeed);

    if (ao0 + ao2 < ao1 + ao3) {
      indices.push(
        vertCount + 1,
        vertCount + 2,
        vertCount + 3,
        vertCount + 1,
        vertCount + 3,
        vertCount + 0,
      );
    } else {
      indices.push(
        vertCount + 0,
        vertCount + 1,
        vertCount + 2,
        vertCount + 0,
        vertCount + 2,
        vertCount + 3,
      );
    }
    vertCount += 4;
  };

  type SliceBucket = { minU: number; maxU: number; minV: number; maxV: number; items: number[] };
  const faceSlices: Map<number, SliceBucket>[] = [
    new Map(),
    new Map(),
    new Map(),
    new Map(),
    new Map(),
    new Map(),
  ];

  for (const [k, styleId] of map.entries()) {
    const x = ((k >> 20) & KEY_MASK) - KEY_BIAS;
    const y = ((k >> 10) & KEY_MASK) - KEY_BIAS;
    const z = (k & KEY_MASK) - KEY_BIAS;
    const emit = styleEmits[styleId];
    const parsedRgb = styleRgbs[styleId]!;

    for (let fi = 0; fi < 6; fi++) {
      const face = FACES[fi];
      const [nx, ny, nz] = face.n;
      if (map.has(packVoxKey(x + nx, y + ny, z + nz))) continue;

      let ai0 = 3;
      let ai1 = 3;
      let ai2 = 3;
      let ai3 = 3;
      if (emit < 0.5) {
        const dirs = face.aoDirs;
        const calcAo = (idx: number) => {
          const [d1, d2, dc] = dirs[idx];
          const s1 = map.has(packVoxKey(x + d1[0], y + d1[1], z + d1[2]));
          const s2 = map.has(packVoxKey(x + d2[0], y + d2[1], z + d2[2]));
          const sc = map.has(packVoxKey(x + dc[0], y + dc[1], z + dc[2]));
          return s1 && s2 ? 0 : 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (sc ? 1 : 0));
        };
        ai0 = calcAo(0);
        ai1 = calcAo(1);
        ai2 = calcAo(2);
        ai3 = calcAo(3);
      }

      const su = face.stepU;
      const sv = face.stepV;
      const sliceW = x * nx + y * ny + z * nz;
      const u = x * su[0] + y * su[1] + z * su[2];
      const v = x * sv[0] + y * sv[1] + z * sv[2];

      const canMergeU = ai0 === ai1 && ai2 === ai3;
      const canMergeV = ai0 === ai3 && ai1 === ai2;
      if (canMergeU || canMergeV) {
        let bucket = faceSlices[fi].get(sliceW);
        if (!bucket) {
          bucket = { minU: u, maxU: u, minV: v, maxV: v, items: [] };
          faceSlices[fi].set(sliceW, bucket);
        } else {
          if (u < bucket.minU) bucket.minU = u;
          if (u > bucket.maxU) bucket.maxU = u;
          if (v < bucket.minV) bucket.minV = v;
          if (v > bucket.maxV) bucket.maxV = v;
        }
        const token = (styleId << 8) | (ai0 << 6) | (ai1 << 4) | (ai2 << 2) | ai3;
        bucket.items.push(u, v, token);
      } else {
        const dirShade =
          ny > 0 ? 1.05 : ny < 0 ? 0.62 : nz > 0 ? 0.96 : nx > 0 ? 0.88 : nx < 0 ? 0.82 : 0.78;
        emitQuad(
          x,
          y,
          z,
          1,
          1,
          face,
          fi,
          sliceW,
          u,
          v,
          parsedRgb[0],
          parsedRgb[1],
          parsedRgb[2],
          AO_LEVELS[ai0],
          AO_LEVELS[ai1],
          AO_LEVELS[ai2],
          AO_LEVELS[ai3],
          emit,
          dirShade,
        );
      }
    }
  }

  for (let fi = 0; fi < 6; fi++) {
    const face = FACES[fi];
    const [nx, ny, nz] = face.n;
    const su = face.stepU;
    const sv = face.stepV;
    const dirShade =
      ny > 0 ? 1.05 : ny < 0 ? 0.62 : nz > 0 ? 0.96 : nx > 0 ? 0.88 : nx < 0 ? 0.82 : 0.78;

    for (const [sliceW, bucket] of faceSlices[fi].entries()) {
      const items = bucket.items;
      const { minU, minV } = bucket;
      const spanU = bucket.maxU - minU + 1;
      const spanV = bucket.maxV - minV + 1;
      const area = spanU * spanV;
      if (area > greedyMaskScratch.length) {
        greedyMaskScratch = new Int32Array(Math.max(area, greedyMaskScratch.length * 2));
      }
      const mask = greedyMaskScratch;
      mask.fill(0, 0, area);

      for (let idx = 0; idx < items.length; idx += 3) {
        mask[(items[idx + 1] - minV) * spanU + (items[idx] - minU)] = items[idx + 2];
      }

      for (let dv = 0; dv < spanV; dv++) {
        const rowOff = dv * spanU;
        for (let du = 0; du < spanU; du++) {
          const token = mask[rowOff + du];
          if (token === 0) continue;

          const ai0 = (token >>> 6) & 3;
          const ai1 = (token >>> 4) & 3;
          const ai2 = (token >>> 2) & 3;
          const ai3 = token & 3;
          const allowU = ai0 === ai1 && ai2 === ai3;
          const allowV = ai0 === ai3 && ai1 === ai2;

          let w = 1;
          if (allowU) {
            while (du + w < spanU && mask[rowOff + du + w] === token) w++;
          }

          let h = 1;
          if (allowV) {
            outerH: while (dv + h < spanV) {
              const nextRow = (dv + h) * spanU + du;
              for (let k = 0; k < w; k++) {
                if (mask[nextRow + k] !== token) break outerH;
              }
              h++;
            }
          }

          for (let r = 0; r < h; r++) {
            const clrRow = (dv + r) * spanU + du;
            for (let k = 0; k < w; k++) mask[clrRow + k] = 0;
          }

          const u0 = minU + du;
          const v0 = minV + dv;
          const x0 = sliceW * nx + u0 * su[0] + v0 * sv[0];
          const y0 = sliceW * ny + u0 * su[1] + v0 * sv[1];
          const z0 = sliceW * nz + u0 * su[2] + v0 * sv[2];
          const styleId = token >>> 8;
          const rgb = styleRgbs[styleId]!;
          emitQuad(
            x0,
            y0,
            z0,
            w,
            h,
            face,
            fi,
            sliceW,
            u0,
            v0,
            rgb[0],
            rgb[1],
            rgb[2],
            AO_LEVELS[ai0],
            AO_LEVELS[ai1],
            AO_LEVELS[ai2],
            AO_LEVELS[ai3],
            styleEmits[styleId],
            dirShade,
          );
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("aEmit", new THREE.Float32BufferAttribute(emits, 1));
  geo.setAttribute("aJitterSeed", new THREE.Float32BufferAttribute(jSeeds, 1));
  geo.setIndex(
    vertCount <= 65535
      ? new THREE.Uint16BufferAttribute(indices, 1)
      : new THREE.Uint32BufferAttribute(indices, 1),
  );
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}
