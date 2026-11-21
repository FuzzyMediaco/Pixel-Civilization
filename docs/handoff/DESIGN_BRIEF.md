# Pixel Civilization — Element Redesign Brief (shared by all design agents)

Repo: `/home/user/Pixel-Civilization` (React + three.js voxel city builder). The owner wants **every element,
every level (1–5) and every visual variant (0–3) radically redesigned** to be way cooler, more unique, more
distinct, more interesting. They explicitly said: take liberties, have fun, go crazy. This is a hobby game.

Original screenshots are no longer available; see git history (commit 340e4fb) for the old look.
`/root/.claude/uploads/82636313-3a2d-5962-b203-fb2d54579198/*.png` — cute chunky voxel style, isometric-ish
camera, bright palette, island setting. Current designs are generic boxes and many levels look the same.

## The new design system (already built — use it)

- `src/game/designs/registry.ts` — `defineDesigns({ id: DesignEntry })`. A `DesignEntry` is:
  ```ts
  {
    footprints: [[x,z],[x,z],[x,z],[x,z],[x,z]], // tiles for Lv1..Lv5 (local, unrotated)
    levels: ["Lv1 name", ..., "Lv5 name"],       // element-specific level titles shown in the UI
    growth: "one line: how it evolves as it levels", // shown in the UI
    build(c: Ctx) { ... }                         // voxel builder
  }
  ```
- `src/game/designs/kit.ts` — the helper library + `Ctx`. **Read it fully first.** Highlights: `lot`, `speckle`,
  `windows`, `ribbonWindows`, `curtainWall`, `door`, `block`, `band`, `balconies`, `gable`, `hip`, `mansard`,
  `flatRoof`, `barrelRoof`, `sawtooth`, `cyl`, `ring`, `coolingTower`, `onionDome`, `spire`, `column`, `colonnade`,
  `pediment`, `archway`, `clockFace`, `tree` (round/pine/palm/cypress/blossom/birch/oak/autumn/willow/fruit), `bush`,
  `flowerBed`, `hedge`, `rocks`, `car`, `truck`, `person`, `lamp`, `bench`, `flag`, `acUnit`, `antenna`, `chimney`,
  `awning`, `sign`, `fence`, `securityFence`, `pool`, `fountain`, `solarRow`, `container`, `crane`, `tank`,
  `smokestack`, `stairs`, `helipad`, `waterPlane`, `style(c)`, `byLv(c,[..5])`, `clamp`.
  Raw primitives live on `c.v` (a `PixelVox`, see `src/game/voxelCore.ts`): `put, box, clear, hollowBox, cylinderY,
  ringZ, cone, sphere, dome, roofGable, roofPyramid, windowsRow`. Colours = PALETTE names in voxelCore.ts or `#rrggbb`.
- Animated / live features available through `Ctx` (USE THEM where they make sense — the renderer supports them):
  - `c.addRotor({ vox, pivot:[x,y,z], axis:"x"|"y"|"z", speed, wind? })` — any number of spinning parts
    (wind blades, ferris wheels, radar dishes, propellers, carousels, water wheels, revolving restaurant tops).
    Build the rotor in its own `new PixelVox()` with voxels positioned RELATIVE to the pivot (pivot = rotation centre).
    `wind: true` makes it scale with weather wind speed.
  - `c.smoke(x,y,z, "smoke"|"steam"|"dark"|"spark")` — chimney / stack / cooling tower / forge emitters.
  - `c.blink(x,y,z, colour)` — blinking beacons (aircraft warning lights, masts, lighthouses, runway lights).
  - `c.bob()` — floating bob (water-domain elements bob automatically).
  - `emit` arg on voxels = glow (windows, neon signs, lamps) — stronger at night.
- `c.conn` — only for network pieces (roads/rails/bridges/water networks); see kit.ts comment for the bits.

### Coordinates & scale
- 16 voxels per grid tile (1 voxel = 0.25 m). x ∈ [-c.hx, c.hx), z ∈ [-c.hz, c.hz), where `c.hx = 8*spanX`.
- y = 0 is the ground lot layer; structures start at y = 1. **+z is the FRONT** (door/sign/driveway side).
- Anything outside the footprint is clipped automatically. Box ranges are half-open.
- Toy scale: person = 3 voxels tall, door = 2×3, storey ≈ 4 voxels, car = 5 long, tree 6–12 tall.
- **Always build relative to `c.hx/c.hz`**, not hard-coded spans: the same builder may be called with a
  different/swapped span (rotation, legacy saves). It must look OK for any span 1..4 on each axis, and great for its
  own footprint at that level.
- Performance: aim < 15k voxels typical, ≤ 40k for the biggest L5 monsters (gallery shows the count). Don't solid-fill
  huge volumes — use hollow shells (`v.hollowBox`, or box then `v.clear` interior) for big buildings.

## What "radically better" means here
1. **Unique silhouettes.** Every element must be instantly recognisable from the game camera at a distance and
   NOT confusable with any other element (e.g. Shoe Store ≠ Clothing Store ≠ Thrift Store; Church ≠ Christian Church
   ≠ Monastery; Highway ≠ Freeway). Give each a signature feature (giant shoe sign, neon, a mascot, a tower shape…).
2. **Leveling must be intuitive and RELATIONAL to what the element is.** Each element grows in its own way:
   - farms/fields/orchards/solar/wind farms/parks/graveyards/landfills/prisons/bases SPRAWL (more rows, plots,
     units, buildings, wider footprint, stay low);
   - skyscrapers/apartments/condos/towers/turbines GROW TALL (small footprint, height explodes, crowns/spires);
   - factories/schools/malls/shipyards/plants become COMPOUNDS (core + new wings, stacks, cranes, parking, rail spurs);
   - churches/temples/civic/landmarks/mansions gain PRESTIGE (spires, domes, colonnades, grounds, gardens, gold);
   - vessels upgrade HULL CLASS (rowboat → fishing boat → trawler → ferry → cruise liner; mini-sub → ballistic sub…);
   - nature MATURES (sapling → ancient giant; hillock → mountain range with snow & waterfall; pond → lake with island).
   Each level should look like the previous level *evolved* (recognisable continuity), and the 5 levels must be
   clearly different from each other at a glance — Lv5 should feel like a jaw-dropping "legendary" version.
   Level names (`levels`) should be specific and fun ("Lemonade-Stand Diner" → "Michelin-Star Rooftop Restaurant").
3. **Variants are real architectural/stylistic alternatives, not just recolours.** E.g. House: Craftsman / Victorian /
   Modernist / Mediterranean. Same function, same level progression, different style. Document the 4 styles in a
   comment above each builder.
4. **Readable charm.** Bright, saturated toy palette; contrast between wall/roof/trim; little life details (people,
   cars, lamps, flowers, signs, laundry lines, solar panels, AC units, flags, animals, crates, umbrellas). Night
   windows/neon glow. Animated parts where it makes sense.

## Footprint rules (gameplay depends on these)
- Each axis 1..4; each axis non-decreasing from Lv1 to Lv5. Keep [x, z] orientation consistent (x = width along front).
- Lv1 at most 2×2 (stage ≥ 15 "monumental" elements may start at 3×3). Merging two Lv(n) gives Lv(n+1), so
  area(Lv n+1) should usually be ≤ 2·area(Lv n) + 2.
- 4-wide only for genuinely sprawling things (big farms, airbases, carriers, prisons, nuclear, big parks, landmarks).
- Tall things stay narrow (1×1 → 2×2 max). Small props (ATM, bus stop, well, tree, umbrella) may stay 1×1 at all levels
  and level up in detail/height/count instead.
- Water-domain vessels: footprint is the hull size on water.

## Workflow (mandatory visual verification)
1. Read `kit.ts`, `registry.ts`, `src/game/designs/housing.ts` (reference example: the House), your elements' entries
   in `src/game/catalog.ts` (name/description/stats/stage/domain — do NOT edit catalog.ts), and the OLD builders for
   your ids in `src/game/voxelArchitect.ts` (`case "<id>":`) for context. Then redesign radically.
2. Write designs into YOUR category file(s) only (listed in your assignment). Keep a single
   `defineDesigns({...})` call (or several) registering EVERY id you were assigned. Local helper functions are fine
   (and encouraged) inside your file. Do NOT edit kit.ts / registry.ts / voxelArchitect.ts / catalog.ts / other
   category files (other agents are editing them concurrently). If you really need a kit change, put a local helper
   in your file and mention it in your report.
3. Start the shared gallery server (idempotent): `./scripts/gallery-server.sh`
   Render: `node scripts/shoot-gallery.mjs "cat=<file>&ids=<id1,id2>&mode=full&cell=300" <png>` then view the PNG with
   the Read tool. Modes: `full` (4 variant rows × 5 levels), `levels&variant=N`, `variants&lv=N`. Add `night=1` to check
   glow, `angle=225` to see the back, `water=1` for an ocean background (boats/docks). Multiple cats: `cat=a,b`.
   Save PNGs under your own folder in the scratchpad: `a scratch folder of your choice (e.g. /tmp/gallery/<name>/)`.
   If the page shows an error, it's printed by the script ("GALLERY ERROR"). A magenta box = your builder threw.
   Another agent's syntax error can't break your category (each category file loads on its own), but if the server
   itself died just rerun gallery-server.sh.
4. Iterate: look at every element at every level and variant. Fix clipping, floating bits, ugly blobs, sameness.
   Compare elements in your category side-by-side (`ids=a,b,c&mode=levels`) to make sure they're distinct.
5. Typecheck your file: `npx tsc --noEmit 2>&1 | grep "designs/<file>"` must print nothing.
6. Do NOT git commit (the lead will). Do not run `npm install`.

## Report back (keep it compact)
- For each element: footprints, the 5 level names, the 4 variant styles (one line).
- Anything you couldn't do / kit suggestions.
- Paths of 1–3 final overview PNGs.
