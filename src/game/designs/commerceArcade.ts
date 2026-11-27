/**
 * Pixel Arcade Hall — Game Controller · Cabinet Tower · Pixel Jelly · Pinball Palace.
 * Original arcade characters only (no licensed mascots).
 */
import { type Ctx, lamp, person } from "./kit";
import { bulbs, crowd, disc, glassFront, neon, sculpt, spinner, type Fill } from "./commerceKit";
import { override } from "./commerceIcons";

const P = (c: Ctx, x0: number, z0: number, x1: number, z1: number, col = "asphaltDark") => c.v.box(x0, 0, z0, x1, 1, z1, col);

/** Gamepad lying on its back, grips toward +z. */
function controller(body: string, trim: string) {
  const btn = ["#ff4d5e", "#ffd23f", "#4cd47a", "#4d9bff"];
  return (u: number, h: number, w: number): Fill => {
    const inBody = u > 0.1 && u < 0.9 && w > 0.06 && w < 0.62 && !((u < 0.16 || u > 0.84) && (w < 0.12 || w > 0.56));
    const g1 = Math.hypot((u - 0.25) / 0.17, (w - 0.66) / 0.3) < 1;
    const g2 = Math.hypot((u - 0.75) / 0.17, (w - 0.66) / 0.3) < 1;
    if (!inBody && !g1 && !g2) return null;
    const base = inBody ? 0.52 : 0.44;
    // raised controls
    const dp = (Math.abs(u - 0.27) < 0.03 && Math.abs(w - 0.34) < 0.1) || (Math.abs(w - 0.34) < 0.03 && Math.abs(u - 0.27) < 0.1);
    let b = -1;
    [[0.73, 0.24], [0.81, 0.34], [0.73, 0.44], [0.65, 0.34]].forEach(([bu, bw], i) => { if (Math.hypot(u - bu, (w - bw) * 1.1) < 0.045) b = i; });
    const stick = Math.hypot(u - 0.4, w - 0.5) < 0.05 || Math.hypot(u - 0.6, w - 0.5) < 0.05;
    const shoulder = w < 0.12 && (Math.abs(u - 0.25) < 0.12 || Math.abs(u - 0.75) < 0.12);
    let top = base;
    if (dp) top = base + 0.1;
    if (b >= 0) top = base + 0.14;
    if (stick) top = base + 0.3;
    if (shoulder) top = base + 0.08;
    if (h > top) return null;
    if (h > base) {
      if (dp) return "#1b1b1f";
      if (b >= 0) return [btn[b], 0.9];
      if (stick) return h > top - 0.08 ? "#3a3a44" : "#1b1b1f";
      if (shoulder) return trim;
    }
    if (h > base - 0.06) {
      if (Math.abs(u - 0.5) < 0.06 && Math.abs(w - 0.2) < 0.03) return ["#7df9ff", 1.1]; // light bar
      if ((Math.abs(u - 0.45) < 0.025 || Math.abs(u - 0.55) < 0.025) && Math.abs(w - 0.3) < 0.02) return "#cfd3da";
    }
    if (h < 0.08) return "#1b1b1f";
    return Math.abs(h - base * 0.55) < 0.04 ? trim : body;
  };
}

/** Upright arcade cabinet facing +z (w=1 front). */
function cabinet(side: string, trim: string, screen: (u: number, h: number) => Fill) {
  return (u: number, h: number, w: number): Fill => {
    if (u < 0.04 || u > 0.96) { /* side art panels */ }
    let front: number;
    if (h < 0.4) front = 0.82;
    else if (h < 0.5) front = 0.82 + 0.18 * ((h - 0.4) / 0.1);
    else if (h < 0.53) front = 1;
    else if (h < 0.82) front = 0.74 - 0.04 * ((h - 0.53) / 0.29);
    else if (h < 0.96) front = 0.86;
    else front = 0.8;
    if (w > front) return null;
    const side2 = u < 0.06 || u > 0.94;
    const atFront = w > front - 0.06;
    if (side2) return h > 0.97 ? trim : Math.abs(Math.sin(h * 18 + u * 3)) < 0.18 ? trim : side;
    if (atFront) {
      if (h >= 0.82 && h < 0.96) return ["#fff1a8", 1.0];
      if (h >= 0.55 && h < 0.8 && u > 0.12 && u < 0.88) return screen((u - 0.12) / 0.76, (h - 0.55) / 0.25) ?? ["#0b1026", 0.2];
      if (h >= 0.48 && h < 0.53) return "#1b1b1f";
      if (h > 0.14 && h < 0.3 && Math.abs(u - 0.5) < 0.12) return Math.abs(u - 0.5) < 0.03 ? ["#ff4d5e", 1] : "#c9a227";
    }
    return side;
  };
}

/** Maze-and-dots screen pattern (original). */
const mazeScreen = (u: number, h: number): Fill => {
  const gx = Math.floor(u * 14), gy = Math.floor(h * 9);
  const wall = gy === 0 || gy === 8 || gx === 0 || gx === 13 || (gy === 4 && gx > 3 && gx < 10) || (gx === 6 && gy > 5) || (gx % 4 === 2 && gy % 3 === 1);
  if (wall) return ["#3b5bff", 1.1];
  if (Math.abs(u - 0.22) < 0.05 && Math.abs(h - 0.25) < 0.1) return ["#ffd23f", 1.2];
  if (Math.abs(u - 0.75) < 0.05 && Math.abs(h - 0.7) < 0.1) return ["#ff5fd2", 1.2];
  if ((gx + gy) % 2 === 0) return ["#ffe9a8", 0.8];
  return ["#0b1026", 0.2];
};

/** Original "pixel jelly" sprite: dome body, one big eye, fringe legs. */
const JELLY = [
  ".....###.....",
  "...#######...",
  "..#########..",
  ".###ooooo###.",
  ".###oo@oo###.",
  ".###ooooo###.",
  ".###########.",
  "..#########..",
  "..#.#.#.#.#..",
  ".#..#...#..#.",
];

function jelly(c: Ctx, x0: number, y0: number, z0: number, scale: number, depth: number, body: string, glowEdge = 0): void {
  const rows = JELLY.length, cols = JELLY[0].length;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const ch = JELLY[r][k];
    if (ch === ".") continue;
    const col: [string, number] = ch === "#" ? [body, glowEdge] : ch === "o" ? ["#ffffff", 0.9] : ["#14142b", 0];
    for (let sx = 0; sx < scale; sx++) for (let sy = 0; sy < scale; sy++) {
      const x = x0 + k * scale + sx, y = y0 + (rows - 1 - r) * scale + sy;
      c.v.box(x, y, z0, x + 1, y + 1, z0 + depth, col[0], col[1]);
    }
  }
}

/** Pinball machine facing +z: tilted glass playfield, backbox at the back. */
function pinball(cab: string, art: string) {
  return (u: number, h: number, w: number): Fill => {
    const legs = h < 0.25 && (u < 0.08 || u > 0.92) && (w < 0.33 || w > 0.9);
    if (legs) return "chrome";
    if (h < 0.25) return null;
    if (w < 0.22) {
      if (h > 0.98) return null;
      if (w > 0.16 && u > 0.08 && u < 0.92 && h > 0.6 && h < 0.94) {
        const t = Math.sin(u * 20) * 0.5 + Math.cos(h * 14) * 0.5;
        return [t > 0.3 ? art : t > -0.2 ? "#ffd23f" : "#3b5bff", 1.0];
      }
      return cab;
    }
    const top = 0.5 - 0.14 * ((w - 0.22) / 0.78);
    if (h > top) return null;
    if (h > top - 0.05 && u > 0.06 && u < 0.94 && w < 0.96) {
      // playfield seen through glass
      const bump = [[0.3, 0.42], [0.55, 0.36], [0.72, 0.5]].some(([bu, bw]) => Math.hypot(u - bu, w - bw) < 0.07);
      if (bump) return ["#ff4d5e", 1.2];
      if (Math.hypot(u - 0.5, w - 0.66) < 0.035) return ["#e6e6e6", 0.6];
      if (w > 0.8 && w < 0.86 && ((u > 0.28 && u < 0.45) || (u > 0.55 && u < 0.72))) return ["#ffd23f", 0.9];
      if (Math.abs(u - 0.5) + Math.abs(w - 0.55) < 0.42 && ((u * 30) | 0) % 5 === 0) return ["#7df9ff", 0.9];
      return ["#24124a", 0.4];
    }
    return Math.abs(h - (top - 0.12)) < 0.03 ? "chrome" : cab;
  };
}

function token(c: Ctx, x: number, y: number, z: number, r: number): void {
  const t = spinner(c, x, y, z, "y", 1.6);
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    const d = Math.hypot(dx, dy);
    if (d > r + 0.3) continue;
    const star = (() => {
      const a = Math.atan2(dy, dx), rr = d / r;
      const lim = 0.32 + 0.28 * Math.cos(5 * (a - Math.PI / 2));
      return rr < lim;
    })();
    t.put(dx, dy, 0, d > r - 1 ? "#b8860b" : star ? "#fff3b0" : "#f2c230", star ? 1.1 : 0.4);
  }
}

function buildArcade(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  if (s === 0) {
    // Game Controller
    const body = "#2b2d42", trim = "#8d99ae";
    if (lv === 1) {
      P(c, -8, 4, 8, 8);
      v.box(-6, 1, -5, 6, 8, 4, "#1b1b2f");
      glassFront(v, -5, 5, 2, 6, 3, "#7df9ff", 3, "#7df9ff");
      sculpt(v, -7, 8, -5, 7, 13, 3, controller(body, trim));
      person(v, 5, 1, 6, "lime", "blueDark", "#c68a62");
    } else {
      const dims: Record<number, [number, number, number, number, number]> = {
        2: [-15, 15, -7, 7, 9], 3: [-15, 15, -15, 9, 14], 4: [-23, 23, -15, 11, 17], 5: [-23, 23, -22, 14, 24],
      };
      const [x0, x1, z0, z1, H] = dims[lv];
      const plinth = lv === 5 ? 4 : 1;
      if (lv === 5) { v.box(x0 + 2, 1, z0 + 2, x1 - 2, plinth, z1 - 6, "#3a3d55"); bulbs(v, x0 + 2, z1 - 6, x1 - 2, z1 - 6, plinth - 1); }
      P(c, x0, z1 - 2, x1, z1 + (lv === 2 ? 1 : 2));
      sculpt(v, x0, plinth, z0, x1, plinth + H, z1, controller(lv === 4 ? "#7a1f2b" : body, trim));
      // walk-in door between the grips
      const dz = Math.round(z0 + (z1 - z0) * 0.62);
      v.box(-3, plinth, dz - 1, 3, plinth + Math.min(6, H - 4), dz, ["#7df9ff"][0], 0.9);
      v.box(-3, plinth, dz, 3, plinth + Math.min(6, H - 4), dz + 1, null);
      // the cord snakes out of the back and round to the street as a covered walkway
      if (lv >= 3) {
        const pts: [number, number][] = [];
        for (let i = 0; i < 40; i++) {
          const t = i / 39;
          pts.push([Math.round(x1 - 3 + Math.sin(t * Math.PI * 1.5) * 2 - t * 2), Math.round(z0 + 1 + t * (z1 - z0 + 2))]);
        }
        for (const [x, z] of pts) v.box(x, 1, z, x + 2, 3, z + 1, "#1b1b1f");
      }
      crowd(c, 3 + lv * 2, x0 + 2, z1, x1 - 2, z1 + (lv === 2 ? 1 : 2));
      if (lv >= 4) crowd(c, 4, -8, Math.round(z0 + (z1 - z0) * 0.3), 8, Math.round(z0 + (z1 - z0) * 0.5), plinth + Math.round(H * 0.52));
      if (lv >= 3) neon(v, "PLAY", x0 + 2, plinth + 2, z1 - 1, "#7df9ff");
    }
  } else if (s === 1) {
    // Cabinet Tower with a spinning arcade token
    const side = ["#5b2a86", "#5b2a86", "#3b1f6e", "#2a1550", "#1d0f3d"][lv - 1];
    const trim = "#ff5fd2";
    if (lv === 1) {
      P(c, -8, 3, 8, 8);
      sculpt(v, -6, 1, -4, 0, 15, 4, cabinet(side, trim, mazeScreen));
      sculpt(v, 1, 1, -3, 6, 12, 3, cabinet("#1f6e5b", "#7df9ff", mazeScreen));
      person(v, -3, 1, 5, "yellow", "blueDark", "#e8b38f");
      person(v, 3, 1, 4, "teal", "charcoal", "#8d5a3b");
    } else if (lv === 2) {
      P(c, -16, 4, 16, 8);
      v.box(-8, 1, -6, 8, 10, 4, "#1b1b2f");
      glassFront(v, -7, 7, 2, 8, 3, "#ff5fd2", 3, "#ffb3ec");
      neon(v, "ARCADE", -11, 10, 3, "#ff5fd2");
      sculpt(v, -15, 1, -6, -8, 17, 4, cabinet(side, trim, mazeScreen));
      sculpt(v, 8, 1, -6, 15, 17, 4, cabinet("#1f6e5b", "#7df9ff", mazeScreen));
      crowd(c, 4, -12, 5, 12, 8);
    } else {
      const dims: Record<number, [number, number, number, number, number]> = {
        3: [-12, 12, -14, 6, 30], 4: [-14, 14, -15, 7, 36], 5: [-16, 16, -18, 10, 46],
      };
      const [x0, x1, z0, z1, H] = dims[lv];
      P(c, -24, z1, 24, z1 + 6);
      sculpt(v, x0, 1, z0, x1, H, z1, cabinet(side, trim, mazeScreen));
      neon(v, "ARCADE", -11, Math.round(H * 0.86), Math.round(z0 + (z1 - z0) * 0.86) + 0, "#ff3fb4", { emit: 1.3 });
      // ground-floor entrance in the coin door
      v.box(-3, 1, z0 + Math.round((z1 - z0) * 0.82) - 1, 3, 6, z0 + Math.round((z1 - z0) * 0.82), "#ffe1a6", 0.9);
      if (lv >= 4) {
        for (const x of [-22, -18, 17, 21]) if (x + 3 < 24) sculpt(v, x, 1, -4, x + 4, 12, 2, cabinet(x < 0 ? "#1f6e5b" : "#6e1f3a", "#7df9ff", mazeScreen));
      }
      if (lv === 5) token(c, 0, H + 6, (z0 + z1) / 2, 6);
      else if (lv === 4) token(c, 0, H + 4, (z0 + z1) / 2, 4);
      crowd(c, 4 + lv * 2, -20, z1 + 1, 20, z1 + 6);
    }
  } else if (s === 2) {
    // Pixel Jelly: an original pixel creature grows from a sign into the building itself
    const bodies = ["#7bd389", "#ff7ad9", "#7ad7ff", "#ffd23f"];
    if (lv === 1) {
      P(c, -8, 4, 8, 8);
      v.box(-6, 1, -4, 6, 7, 4, "#14142b");
      glassFront(v, -5, 5, 2, 6, 3, "#7bd389", 3, "#c9ffd3");
      jelly(c, -6, 7, -1, 1, 2, bodies[0], 0.5);
    } else if (lv === 2) {
      P(c, -16, 4, 16, 8);
      v.box(-14, 1, -6, 14, 9, 4, "#14142b");
      glassFront(v, -13, 13, 2, 7, 3, "#7ad7ff", 4, "#c9f1ff");
      [-14, -6, 2].forEach((x, i) => jelly(c, x + i, 9, -2, 1, 2, bodies[i], 0.5));
      crowd(c, 4, -12, 5, 12, 8);
    } else {
      const sc = lv === 3 ? 2 : 3;
      const W = 13 * sc, H = 10 * sc;
      const depth = lv === 3 ? 14 : 18;
      const plinth = lv === 5 ? 3 : 1;
      const x0 = -Math.floor(W / 2), z0 = lv === 3 ? -12 : -14;
      if (lv === 5) v.box(-23, 1, -22, 23, plinth, 18, "#14142b");
      jelly(c, x0, plinth, z0, sc, depth, bodies[lv - 3], 0.25);
      // doors between the fringe legs
      for (const k of [3, 7]) v.box(x0 + k * sc, plinth, z0 + depth - 1, x0 + k * sc + sc, plinth + sc * 2 - 1, z0 + depth, "#ffe1a6", 0.9);
      P(c, -24, z0 + depth, 24, z0 + depth + 8);
      if (lv >= 4) {
        // marching minis and a pixel cannon firing a laser at the sky
        [-22, 13].forEach((x, i) => jelly(c, x, plinth, z0 + depth + 2, 1, 2, bodies[(i + 1) % 4], 0.6));
        v.box(16, 1, -20, 22, 4, -15, "#3ad17a");
        v.box(18, 4, -18, 20, 7, -17, "#3ad17a");
        for (let y = 7; y < 30; y += 1) if (y % 3) v.put(19, y, -18, "#7df9ff", 1.3);
      }
      crowd(c, 6 + lv, -20, z0 + depth + 1, 20, z0 + depth + 7);
      if (lv === 5) [-21, 8].forEach((x, i) => jelly(c, x, 1, -21, 1, 2, bodies[(i + 2) % 4], 0.8));
    }
  } else {
    // Pinball Palace
    const cab = ["#c1121f", "#c1121f", "#1d3557", "#1d3557", "#3a0ca3"][lv - 1];
    if (lv === 1) {
      P(c, -8, 4, 8, 8);
      sculpt(v, -5, 1, -6, 5, 14, 5, pinball(cab, "#ff7ad9"));
      person(v, 0, 1, 6, "orange", "blueDark", "#f1c9a5");
    } else {
      const dims: Record<number, [number, number, number, number, number]> = {
        2: [-15, 15, -7, 6, 18], 3: [-14, 14, -15, 12, 28], 4: [-20, 20, -15, 12, 32], 5: [-22, 22, -22, 16, 44],
      };
      const [x0, x1, z0, z1, H] = dims[lv];
      sculpt(v, x0, 1, z0, x1, H, z1, pinball(cab, lv % 2 ? "#ff7ad9" : "#7df9ff"));
      // the space between the legs is the lit entry hall
      const legTop = Math.round(H * 0.25);
      glassFront(v, x0 + 3, x1 - 3, 1, legTop, z1 - 2, "chrome", 4, "#ffe1a6");
      P(c, x0, z1, x1, z1 + 4);
      if (lv >= 3) neon(v, "PINBALL", -13, legTop + 2, z1 - 1, "#ffd23f", { scale: lv === 5 ? 1 : 1 });
      crowd(c, 4 + lv * 2, x0 + 2, z1, x1 - 2, z1 + 4);
      if (lv >= 4) for (const x of [x0 + 1, x1 - 2]) lamp(v, x, 1, z1 + 2, 7, "chrome", "#ff7ad9");
      if (lv === 5) disc(v, 0, (z0 + z1) / 2 - 6, H - 1, H + 3, 4, (x, y) => ["#c0c0c0", y === H + 2 ? 0.8 : 0.3]);
    }
  }
}

override(
  "retro_arcade",
  buildArcade,
  ["Cabinet Nook", "Neon Arcade", "Game-Shaped Hall", "Arcade Landmark", "Mega Game Tower"],
  "A cabinet nook grows into a building shaped like the game itself: a walk-in controller, a cabinet tower crowned by a spinning token, a pixel creature, or a pinball palace.",
);
