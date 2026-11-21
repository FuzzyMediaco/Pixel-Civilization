# Projects A — round 2 redesign (design_projects_a)

Files: `src/game/designs/projects.ts` (the block between `// ==== ROUND2 BEGIN/END`, plus the `REDESIGNED`
hook in the final `defineDesigns`) and `src/game/designs/landings.ts` (rewritten).
Untouched: the 11 ids that `projectsFuture.ts` overrides keep their old builders + `projectDetail` in projects.ts.

## How it hooks in
`REDESIGNED[id] = { growth, build }`. When an id has an entry, `defineDesigns` uses it and skips the old
`builders[id]` + `projectDetail`. The old builders and `projectDetail` switch cases for my 11 ids were deleted.
Footprints and level names still come from `wealthProjects.ts` / `levelSpans.ts` (unchanged).

## Shared style system (variants match designStyles.json labels)
0 Terracotta (stucco, clay gables) · 1 White & teal (modernist cantilever slabs) · 2 Brick & evergreen
(Victorian brick, sawtooth / steep gables, green iron) · 3 Slate & brass (stepped deco crowns, brass trim).
Helpers: `PS/ps`, `sroof`, `sbldg`, `heightfield` (skin-only terrain), `crowd`, `waterBack`, `pier`, `ferryBoat`.
Waterside projects always put water at the BACK (-z) and the street at the front.

## Elements (Lv1 → Lv5)
- **growers_exchange**: cart + parasol → 3-stall court + entry arch → round auction ring with tiered benches →
  arcaded market hall + lorries → grand exchange with clock tower and price boards. Giant fruit mascot per
  variant (lemon / apple / pumpkin / grapes) that climbs higher each level.
- **bakery_coop**: smoking dome oven → bakehouse + hanging sign → 3 chimneyed shopfronts → arched bread
  arcade + café → U court around a spinning windmill (rotor). Bread sign: loaf / croissant / pretzel / neon baguette.
- **open_pit_mine**: stepped crater (rim 3→14, benches 1→6), haul ramp, dump trucks, excavator dust (c.smoke),
  conveyor to ore pile + crusher (Lv3), rail load-out silo + floodlights with c.blink (Lv4), pit lake + spinning
  bucket-wheel (Lv5). Variants = geology: copper / limestone / coal / slate+gold.
- **regional_airport**: grass strip + prop plane (spinning propeller) → paved runway + village terminal →
  jet bridges, regional jets, control tower with rotating radar, blinking runway lights → long concourse,
  3 jets → crescent terminal, 4 jets incl. wide-body. Runway stays at z ≈ +hz/2 (plane path in projectOperations).
- **freight_rail_terminal**: siding + boxcars → first gantry → 4-track switchyard, signal box, loco (smoke),
  signal blinkers → container yard, 2 gantries → 3 giant gantries, long train, tower, floodlights.
- **district_heat_works**: exchanger hut + U expansion loop → pipe court + accumulator with glowing thermometer
  → round hall with 4 spinning heat-pump fans → tall accumulator + steaming stack → twin tanks + rainbow pipes.
- **water_reuse_works**: reed filter → clarifier with rotating skimmer bridge → cascading reed terraces →
  steaming cooling channel → rotating drum filter shed + glowing clean-water tower.
- **terraced_glasshouses**: cloche → twin ferneries → petal dome hothouse → 3-tier terraces → 4 tiers + great
  dome + heat stack. Variants: ridge house / geodesic domes / curved-iron conservatory / magenta vertical farm.
- **ferry_exchange**: pier + launch → twin finger piers → covered transfer pier + departure board → canopy
  concourse + 3 ferries → harbour hall with clock/beacon tower + big car ferry (hall kept to the left so berths show).
- **canal_boat_lift**: balance-beam lock → hoisted caisson between towers (spinning sheave) → twin caissons +
  counterweights → glass viewing gallery → Falkirk-style rotating wheel (axis z, faces the street) feeding an aqueduct.
- **maritime_college**: boathouse + dinghies → launch basin → sawtooth workshop, hull on cradle, crane →
  academy with clock tower + signal yardarm, training sloop → lighthouse (rotating beam + blink), tall ship, dome.
- **ferry_landings** (landings.ts): canal steps → pontoon + canopy → railed waterbus landing with timetable →
  T-pontoon twin berth (red/green blinkers) → shore ticket hall, lamp-lit pier, end pavilion + beacon.
  Styles: Harbor master / Island shade / Streamline / River market. Boarding end stays at -z.
- **taxi_ranks** (landings.ts, 1×1 always): sign post → styled shelter → waiting cab → dispatch kiosk + radio mast
  (blink) → giant glowing rooftop landmark. Styles: Checker cab / Googie / Metro glass / Lantern pavilion.
  Curb strip z 5..7 stays clear above ground.

## Verification
tsc clean. `npm test`: all catalog distinctness + handbookArt silhouette tests pass for these ids. At the time of
writing, 4 unrelated tests fail from other agents' concurrent work (stonehenge/landmark handbook entries,
bridge services, farm-campus growth, mall earnings). Screenshots: scratchpad `design_projects_a/final_*.png`.

## Notes / follow-ups
- designStyles.json labels for my 11 projects still read "Terracotta / White & teal / Brick & evergreen /
  Slate & brass"; the new styles were built to match them.
- Biggest models: terraced_glasshouses Lv5 (~28–33k voxels), others < 18k.
