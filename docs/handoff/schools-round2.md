# Schools round 2 — `src/game/designs/campuses.ts`

I rewrote all 11 education elements from scratch, each with its own builder. The old builder was one shared
`campus()` with per-id branches, and every school came out as the same gabled hall.
Footprints, level names, growth text and style names are unchanged. They still come from `CAMPUS_FARM_ART`
(`campusFarmArt.ts`) and `designStyles.json`, so `catalog.test.ts`, `handbookArt.test.ts` and `farmCampus.test.ts`
constraints hold. No other file was edited.

## Shared kit (local to the file)
- `hall()` / `roofOn()`: hollow shell with window modes (punch, tall, ribbon, curtain, logs, lit) and roof
  types (gable, gableZ, hip, tile, flat, slab, green, barrel, barrelZ, saw, mono).
- Play kit: slide, swings, sandbox, seesaw, climbDome, `merryGoRound` (rotor), tunnel, toyBlock, sunflower,
  rainbow, crayonFence.
- Sports kit: hoop/court, `stand` (bleachers with crowd and optional roof), `flood` (floodlight + `c.blink`),
  scoreboard, goal, `track` (stadium-shaped running oval that returns its infield), and `field` (soccer,
  gridiron, baseball or athletics markings).
- Towers and instruments: `clockTower` (spire, pinnacles, cupola, dome or tile top; clock on +z and +x),
  bellCupola, `observatory` (drum + rotating slit dome with telescope), `dish` (solid tilted paraboloid,
  y-rotor), mast (blink), `towerCrane` (rotating jib), `ferrisWheel` (z-rotor).
- People: children are 2 voxels tall and adults 3. `crowd()` only places them on free ground.

## Elements (footprints L1→L5 · styles)
| id | footprints | signature / growth | 4 styles |
|---|---|---|---|
| preschool | 1×1 2×1 2×2 3×2 3×3 | Low and colourful with a crayon fence. Playroom → yard (slide, swings, sandbox) → open-book "storybook" wing roof → adventure castle with rope bridge, tunnel, dome and merry-go-round rotor → playhouse village around a rainbow arch and splash pad | Toybox (stacked primary toy blocks) · Forest playhouse (log cabin, turf roof, treehouse) · Sunflower (stucco, sunflower mural, giant flowers) · Seaside (striped beach huts on stilts, sails, boat climber) |
| country_schoolhouse | 1×1 1×1 2×1 2×2 3×2 | One-room schoolhouse with its gable facing the road, porch and chimney smoke → bell cupola, pump and flag → teacher's cottage behind a picket fence → reading garden (swing tree, veg rows) → harvest fair (striped stalls, hay, pumpkins, bunting, Ferris wheel rotor) | Red clapboard · White chapel (steeple, steep roof) · Prairie timber (log corners, sod roof) · Fieldstone |
| elementary_school | 1×1 2×1 2×2 3×2 3×3 | Flat school block with sign, clock and porch; blacktop with hopscotch and four-square → playground → 2 storeys + library wing with round window → yellow bus loop with drop-off canopy → full-width academy with vaulted gym and garden | Garden brick · Coastal tiles (mission arcade, terracotta, palms) · Maplewood (timber, dark gables) · Sunburst (white modern, colour fins, mono roofs) |
| middle_school | 2×1 2×1 2×2 3×2 3×3 | Taller 2-storey block with bike racks → rooftop science loft (rotating observatory dome, lab dome, greenhouse, anemometer rotor) → two basketball courts → 3-storey block + vaulted gym → arts wing with rainbow mural and amphitheatre | Fieldstone · Copper roof (verdigris) · Lakeside (glass curtain, deck) · Red brick (white cupola) |
| high_school | 2×2 2×2 3×2 3×3 4×3 | 3-storey hall with portico and mascot banner, parking + bus → mascot-coloured barrel gym → track + gridiron → grandstand, press box, scoreboard, 4 floodlights (blink) → roofed stand, science wing, bus loop | Cardinals (red brick, white portico/dome) · Owls (purple/gold glass) · Mariners (white & navy, ship mast) · Hornets (yellow/black brutalist) |
| trade_school | 2×1 2×1 2×2 3×2 4×3 | Workshop with hazard-framed roll-up bays; open bays glow with welding sparks (`c.smoke spark`) → extraction stack (smoke) + roof duct → apprentice canopy with workbenches and car lift → stock yard (containers, forklift), gantry, rotating tower crane → second hall, scaffold training tower, line-worker poles | Boilermakers (soot brick, boiler tank) · Shipwrights (timber boat shed, hull on cradle) · Machinists (blue steel) · Auto works (white/red garage, tyres, cars on lifts) |
| community_college | 2×1 2×2 3×2 3×3 4×3 | Low learning centre with glass entry, CC pylon sign and parking → glowing evening classroom bar → glass library box with visible book stacks and cantilevered roof (taller at L4+) → garden commons (food truck, trees) → amphitheatre, solar carport, clock pylon | Adobe (stepped pueblo, vigas) · Green glazed (green glass, living roofs) · Harbor modern (white slabs, sail canopies) · City brick |
| university | 2×2 2×2 3×2 3×3 4×4 | Founders hall (tall windows, buttresses, gate turret) → cloister arcades round the lawn → 30-voxel clock tower → residential ranges with chimneys + fountain → enclosed quadrangle with gatehouse arch, clock tower, chapel spire or library dome | Limestone Gothic (pinnacles) · Federal brick (white portico, cupola) · Copper cloister (verdigris roofs, spire) · Pacific stone (sandstone arcades, red tile, palms) |
| research_university | 2×2 2×2 3×2 3×3 4×4 | Glass lab with fume stacks → windowless cleanroom with HVAC and steam → big rotating telescope dome → instrument tower with skybridge and blink mast, glass lecture rotunda, tree avenue → synchrotron ring, twin domes, second lab range | Ocean institute (wave roof, aquarium) · Alpine sciences (stone, snowy gables, pines) · Photon lab (black glass, cyan light bands) · Desert observatory (stepped adobe, white domes, cacti) |
| sports_field | 2×1 2×1 2×2 3×2 4×3 | Practice pitch (cones, shed) → bleachers, scoreboard, flag → running oval → roofed grandstand + 4 floodlights (blink) → enclosed bowl with side stands, video screen, flags and crowds | Soccer green · Gridiron (end zones, H posts) · Red clay (baseball diamond, backstop) · Blue track (blue oval, jumps) |
| research_institute | 2×1 2×1 2×2 3×2 3×3 | Gated lab with rooftop anemometer + small dish, scientists in white → glass atrium with flags → variant instrument → survey array of rotating dishes and blinking masts → second lab range + giant radio dish | Geosciences (drill derrick, core racks) · Astronomy (big radio dish) · Photonics (black glass, laser beam to the sky) · Atmospheric (radar dome, weather balloon) |

## Verification
- Gallery: I rendered every element at every level and variant (`mode=full`) plus zoomed variant sheets. Night overview:
  `scratchpad/design_schools/overview_night.png`.
- `npx tsc --noEmit`: no errors in `campuses.ts` (another agent's `BottomDock.tsx` error was present at the time).
- `npm test`: every catalog test for the campus elements passes, including the "four distinct styles" check. The 5–6 failing tests
  (bridge, ferry handbook text, grants, farm economy, settlement growth) fail the same way with the original
  `campuses.ts` restored, so they come from other agents' concurrent work.

## Notes / possible follow-ups
- The tower crane jib, Ferris wheel and dishes are rotors that can sweep a few voxels past the lot edge.
  Rotors are not clipped.
- Floodlights use `c.blink` as the brief asked. If the blink looks odd in game, a steady `emit` head is already
  drawn, so removing the blink is a one-line change.
