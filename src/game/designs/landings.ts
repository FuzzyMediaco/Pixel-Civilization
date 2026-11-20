import { defineDesigns } from "./registry";
import { ELEMENT_LEVEL_SPANS } from "../levelSpans";
import { type Ctx, solidVoxels } from "./kit";

const colors = ["#287e79", "#b65342", "#3c6794", "#96652c"];
function landing({ v, lv, variant, hx, hz }: Ctx) {
  const box = solidVoxels(v);
  const c = colors[variant],
    south = hz - 2;
  for (let z = -hz + 1; z < south; z++) {
    const w = z < 0 ? Math.min(hx - 2, 3 + lv) : 3;
    box(-w, 1, z, w, 1, z, z % 3 === 0 ? "#a27b52" : "#be9767");
  }
  for (const x of [-3, 3]) for (const z of [-hz + 2, south - 1]) box(x, -3, z, x, 3, z, "#70553b");
  for (const x of [-4, 4]) box(x, 2, -hz + 2, x, 5 + lv, -hz + 2, c);
  if (lv > 1) {
    for (let x = -5; x <= 5; x++)
      box(
        x,
        5 + lv + Math.round((5 - Math.abs(x)) * 0.35),
        -hz + 1,
        x,
        5 + lv + Math.round((5 - Math.abs(x)) * 0.35),
        -hz + 4,
        x % 4 === 0 ? "#faf2d1" : c,
      );
  }
  for (let n = 0; n < lv; n++) box(-3, 2, -hz + 3 + n * 2, -2, 2, -hz + 3 + n * 2, "#503c2f");
  box(3, 3, south - 1, 3, 4 + lv, south - 1, "#563d31");
  box(3, 4 + lv, south - 1, 5, 5 + lv, south - 1, "#fff3ab", 0.8);
}
function rank({ v, lv, variant }: Ctx) {
  const box = solidVoxels(v);
  const c = colors[variant];
  box(-6, 0, -6, 5, 0, 6, "#b4afa0");
  box(-6, 0, 6, 5, 0, 7, "#e5bd49");
  for (let x = -6; x <= 5; x += 3) box(x, 1, 5, x + 1, 1, 5, "#fff4ad");
  box(-5, 1, -3, -5, 5 + lv, -3, "#4e514c");
  box(-6, 5 + lv, -3, -2, 6 + lv, -3, c);
  for (let n = 0; n < lv; n++) {
    box(-4 + n * 2, 1, 0, -3 + n * 2, 2, 1, "#8c6b43");
  }
  if (lv >= 2) {
    box(4, 1, -4, 4, 5, -4, "#565654");
    box(-4, 6, -5, 5, 6, -1, c);
  }
  if (lv >= 4) {
    box(-4, 1, -4, 3, 4, -4, "#96c7c1");
    box(-1, 3, -4, 3, 4, -4, "#ffce74", 0.4);
  }
}
defineDesigns({
  ferry_landings: {
    footprints: ELEMENT_LEVEL_SPANS.ferry_landings,
    levels: ["Canal Steps", "Ticket Canopy", "Waterbus Landing", "Twin Berth", "Passenger Pier"],
    growth: "A modest quay gains a shelter, longer boarding walk and illuminated berth.",
    build: landing,
  },
  taxi_ranks: {
    footprints: ELEMENT_LEVEL_SPANS.taxi_ranks,
    levels: ["Hailing Post", "Sheltered Rank", "Neighborhood Stand", "Dispatch Kiosk", "Night Rank"],
    growth: "Curbside seating, a dispatch display and night lighting keep the rank compact.",
    build: rank,
  },
});
