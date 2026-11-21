import { defineDesigns } from "./registry";
import { ELEMENT_LEVEL_SPANS } from "../levelSpans";
import { type Ctx, bench, clockFace, flag, gable, hip, lamp, person, solidVoxels } from "./kit";

const colors = ["#287e79", "#b65342", "#3c6794", "#96652c"];
const timber = ["#ac7951", "#c79668", "#919da0", "#96694c"];
function landing({ v, lv, variant, hx, hz }: Ctx) {
  const box = solidVoxels(v);
  const color = colors[variant],
    pier = timber[variant],
    end = -hz + 2;
  const deck = (x0: number, z0: number, x1: number, z1: number) => {
    for (let z = z0; z <= z1; z++) box(x0, 0, z, x1, 1, z, z % 4 === 0 ? "woodDark" : pier);
    for (const x of [x0, x1])
      for (let z = z0; z <= z1; z += 7) {
        box(x, -3, z, x, 2, z, "woodDark");
        v.put(x, 3, z, "cream");
      }
  };
  // A passenger walks in from the front; the outer ends remain open for boarding.
  deck(-3, end, 3, hz - 1);
  const wing = lv >= 4 ? hx - 2 : lv === 1 ? 4 : 6;
  deck(-wing, end, wing, end + 4);
  if (lv >= 4) {
    for (const sign of [-1, 1]) {
      const x = sign * (wing - 2);
      deck(x - 1, end + 3, x + 1, lv === 5 ? 4 : -1);
      box(x, 1, end + 6, x, 3, end + 7, "rubber");
      lamp(v, x, 2, end + 5, 4, "iron", sign < 0 ? "red" : "lime");
    }
  }
  const post = variant === 1 ? "wood" : variant === 3 ? "woodDark" : "steelDark";
  if (lv >= 2) {
    for (const x of [-4, 4]) for (const z of [end, end + 4]) box(x, 2, z, x, 7, z, post);
    if (variant === 0) gable(v, -5, 7, end - 1, 6, end + 6, "z", color, "cream");
    if (variant === 1) hip(v, -5, 7, end - 1, 6, end + 6, "#dbbb75", "#ae8a4d", 4);
    if (variant === 2) {
      for (let x = -5; x <= 5; x++)
        box(
          x,
          7 + Math.round((5 - Math.abs(x)) / 3),
          end - 1,
          x,
          7 + Math.round((5 - Math.abs(x)) / 3),
          end + 5,
          "white",
        );
      box(-5, 7, end - 1, -5, 7, end + 5, color);
    }
    if (variant === 3)
      for (let x = -5; x <= 5; x++) {
        const y = 7 + Math.floor((5 - Math.abs(x)) / 2);
        box(x, y, end - 1, x, y, end + 5, (x + 5) % 4 < 2 ? color : "cream");
      }
    bench(v, 0, 2, end + 1, "x", "woodDark");
  }
  // Four recognizable berth markers also distinguish the one-tile landing.
  const markX = lv >= 4 ? wing - 2 : 3,
    markZ = lv >= 4 ? 2 : hz - 3;
  box(markX, 2, markZ, markX, 7, markZ, post);
  if (variant === 0) {
    box(markX - 1, 7, markZ, markX + 1, 8, markZ, color);
    v.put(markX, 9, markZ, "warmGlow", 0.8);
  }
  if (variant === 1) flag(v, markX, 3, markZ, 6, ["red", "cream"]);
  if (variant === 2)
    for (let i = 0; i < 3; i++) box(markX - i, 6 + i, markZ, markX + 1, 6 + i, markZ, i === 1 ? "white" : color);
  if (variant === 3) {
    v.sphere(markX, 8, markZ, 2, 2, 2, "amber", 0.35);
    v.put(markX, 10, markZ, "woodDark");
  }
  if (lv >= 3) {
    for (let z = end + 7; z < hz - 3; z += 3) box(-3, 2, z, -3, 4, z, post);
    box(-3, 4, end + 7, -3, 4, hz - 4, "cream");
    person(v, -1, 2, end + 7, "crimson");
    // Life ring on the public side, with a visible opening in its middle.
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ])
      v.put(-2 + dx, 5 + dy, 1, dy ? "orange" : "white");
  }
  if (lv >= 5) {
    // The wider landing has room for a shore-side ticket hall and a harbor beacon.
    deck(-9, 6, 8, 15);
    v.hollowBox(-8, 2, 7, 1, 9, 14, variant === 2 ? "white" : "cream", post);
    box(-7, 4, 13, -3, 7, 13, "glassDark");
    box(-7, 4, 14, -2, 4, 14, color);
    if (variant % 2 === 0) gable(v, -9, 9, 6, 2, 15, "x", color, "white");
    else hip(v, -9, 9, 6, 2, 15, variant === 1 ? "sandDark" : "terracotta", "cream", 3);
    for (let y = 2; y < 14; y++) box(5, y, 8, 7, y, 10, Math.floor(y / 3) % 2 ? color : "white");
    box(4, 14, 7, 8, 14, 11, post);
    box(5, 15, 8, 7, 17, 10, "warmGlow", 0.8);
    hip(v, 4, 18, 7, 9, 12, color, post, 2);
    person(v, 1, 2, 12, "blue", "steelDark", "#84583e");
  }
}
function rank({ v, lv, variant }: Ctx) {
  const box = solidVoxels(v);
  const color = ["busYellow", "#65b8ac", "#486cb3", "woodDark"][variant];
  box(-7, 0, -6, 7, 0, 7, variant === 3 ? "path" : "concrete");
  for (let x = -7; x <= 7; x++) v.put(x, 0, 7, (x + 7) % 4 < 2 ? "busYellow" : "charcoal");
  // A clear boarding strip stays between the shelter and the local street.
  for (let x = -6; x < 7; x += 3) box(x, 0, 5, x + 1, 0, 5, "white");
  box(-5, 1, 1, -5, 7, 1, variant === 3 ? "woodDark" : "iron");
  if (variant === 0) {
    box(-7, 7, 1, -3, 9, 1, "black");
    for (let x = -7; x <= -3; x++) v.put(x, 8, 2, x % 2 ? "busYellow" : "white");
  } else if (variant === 1) {
    for (let x = -7; x < -2; x++) box(x, 6 + Math.floor((x + 7) / 2), 1, x, 7 + Math.floor((x + 7) / 2), 1, "pink");
    v.put(-3, 10, 1, "warmGlow", 0.8);
  } else if (variant === 2) {
    box(-6, 5, 1, -4, 10, 1, color);
    box(-6, 7, 2, -4, 8, 2, "screenCyan", 0.7);
  } else {
    box(-6, 6, 0, -4, 8, 2, "warmGlow", 0.45);
    hip(v, -7, 9, -1, -2, 4, "tealDark", "woodDark", 2);
  }
  if (lv >= 2) {
    for (const x of [-3, 5]) box(x, 1, -4, x, 6, -4, "steelDark");
    bench(v, 1, 1, -3, "x", variant === 2 ? "steelLight" : "wood");
    if (variant === 0) {
      box(-4, 7, -5, 6, 7, -1, color);
      for (let x = -4; x <= 6; x++) v.put(x, 6, -1, x % 2 ? "black" : "white");
    } else if (variant === 1) {
      for (let x = -4; x <= 6; x++) {
        const top = 6 + Math.floor(Math.abs(x - 1) / 2);
        box(x, top, -5, x, top, 0, "teal");
        v.put(x, top, 0, "pink");
      }
    } else if (variant === 2) {
      for (let z = -5; z <= 0; z++)
        box(-4, 7 + Math.floor((z + 5) / 3), z, 6, 7 + Math.floor((z + 5) / 3), z, z % 3 ? "glass" : "steelDark");
    } else hip(v, -4, 6, -6, 7, 1, "tealDark", "wood", 3);
  }
  if (lv >= 3) {
    box(5, 1, 1, 6, 5, 2, "steelDark");
    box(5, 4, 3, 6, 5, 3, "screenGreen", 0.5);
    person(v, 1, 1, 2, ["brick", "pink", "blue", "teal"][variant]);
  }
  if (lv >= 4) {
    box(2, 1, -5, 5, 5, -5, color);
    box(5, 1, -4, 5, 5, -2, color);
    box(2, 1, -2, 5, 2, -2, "steelLight");
    box(3, 4, -4, 4, 4, -4, "amber", 0.5);
  }
  if (lv === 5) {
    if (variant === 0) {
      // The yellow taxi-top light doubles as the dispatch office sign.
      box(-2, 8, -5, 4, 8, -2, "black");
      box(-1, 9, -5, 3, 10, -2, "busYellow");
      box(0, 11, -4, 2, 11, -3, "warmGlow", 0.8);
    } else if (variant === 1) {
      for (let i = 0; i < 5; i++) box(-5 + i, 9 + i, -4, -3 + i, 10 + i, -4, i % 2 ? "pink" : "warmGlow", 0.6);
    } else if (variant === 2) {
      box(3, 8, -4, 5, 14, -3, color);
      box(1, 12, -4, 6, 13, -3, "screenCyan", 0.7);
    } else {
      box(-1, 8, -4, 2, 13, -2, "woodDark");
      clockFace(v, 0, 12, -1, 1);
      hip(v, -2, 14, -5, 4, 0, "tealDark", "wood", 3);
    }
    lamp(v, 6, 1, 4, 5, "iron", "warmGlow");
  }
}
defineDesigns({
  ferry_landings: {
    footprints: ELEMENT_LEVEL_SPANS.ferry_landings,
    levels: ["Canal Steps", "Ticket Canopy", "Waterbus Landing", "Twin Berth", "Passenger Pier"],
    growth:
      "A landing marker gains shelter and a railed boarding walk. Two docking fingers open beside the pier before a ticket hall and harbor beacon welcome the busiest sailings.",
    build: landing,
  },
  taxi_ranks: {
    footprints: ELEMENT_LEVEL_SPANS.taxi_ranks,
    levels: ["Hailing Post", "Sheltered Rank", "Neighborhood Stand", "Dispatch Kiosk", "Night Rank"],
    growth:
      "A signed curb gains a canopy, a waiting area, a fare reader, and staffed dispatch. The final night rank adds a rooftop landmark while keeping the boarding strip open.",
    build: rank,
  },
});
