# Farms round 2: animated livestock and redesigned farm elements

## Animated livestock (critters)
- **Kit API** (`src/game/designs/kit.ts`): `c.critters({ kind, count, area:[x0,z0,x1,z1], y?, coat? })`.
  - `kind` is one of `cow | sheep | pig | chicken | horse | goat | duck | bee`.
  - `area` is in voxel coordinates and is half-open, like `box`.
  - `y` is the voxel layer the animals stand on. The default is 1.
  - `coat` picks the breed or colour scheme. The default is the variant.
  - Pens are stored on `c.critterPens`.
- **Models** (`src/game/critterModels.ts`, new file):
  - Each animal is a voxel model built at half-voxel resolution (`CRITTER_UNIT` = 0.125 m).
  - Each model is split into parts that move: body, head, two leg pairs (`legA`/`legB`) and wings. Every part has a pivot.
  - Coats:
    - Cows: Holstein, Jersey, Brown Swiss and Ayrshire are coats 0–3. The beef breeds Hereford, Angus, Longhorn and Shorthorn are coats 4–7.
    - Sheep, pigs, hens, horses, goats, ducks and bees have 4 coats each.
  - `CRITTER_TUNING` holds per-kind behaviour: speed, turn rate, idle times, spacing, stride, bounce and graze depth, plus flags for hop, waddle and fly.
  - `buildCritterPens` converts pens to element-local metres (the same frame as smokePoints).
  - `buildCritterPreview` makes the static rest-pose herd: one InstancedMesh per pen.
- **Asset** (`voxelArchitect.ts`):
  - `BuiltVoxelAsset.critters` holds the pens.
  - `buildPlacedGroupFromAsset` adds the static preview herd and stores it as `group.userData.critterPreview`. The pens are stored as `userData.critters`. This is why galleries, ghosts and the field guide show animals.
- **Live animation** (`farmActivity.ts`, class `CritterHerds`, owned by `FarmActivityVisuals.herds`):
  - **Rendering:**
    - One InstancedMesh per kind × coat × part covers the whole island, using the shared voxel material.
    - Animal state lives in a `Float32Array`. The per-frame update makes no allocations.
    - Instance matrices are `group.matrixWorld × animal × part`, so element rotation, bobbing and squash/stretch carry over.
  - **Behaviour:**
    - An animal walks toward a random target: usually a short amble, sometimes across the pen.
    - It turns smoothly, swings its legs and bounces as it walks.
    - When idle it grazes, dipping its head.
    - Chickens and ducks peck. Hens and goats hop, ducks waddle, and bees fly and buzz their wings.
    - Animals keep a minimum spacing and stay inside the pen.
  - **Performance:**
    - The total is capped at `MAX_ANIMALS` = 1400. Herds beyond the cap keep their static preview.
    - Herds more than 60 m from the camera update at 1/3 rate. Beyond 140 m they freeze.
    - Meshes are rebuilt only when a bin overflows during a sync. Herds keep their state across syncs unless their group is rebuilt.
  - Hidden groups (for example, overbuilt terrain) hide their animals.
- **Renderer hooks** (`worldRenderer.ts`, 3 lines):
  - The constructor passes a camera getter.
  - `syncHerds(state.elements, placedEntries)` runs after `rebuildEmittersAndBeacons()`.
  - `animateHerds(dt)` runs in `tick` next to smoke. It uses the real clock, so animals keep grazing while the game is paused.
- The `herd` farm job is now a stockman riding the shared bay horse model.

## Redesigned elements (`src/game/designs/farmsteads.ts`)
Footprints and level names come from `campusFarmArt.ts` and are unchanged.

### Regional variants
The four variants are regional styles shared by every anchor:

| Variant | Region | Look |
| --- | --- | --- |
| V0 | American | red gambrel barns, white board fence, Harvestore silo, windpump, red tractor |
| V1 | Tuscan | ochre stucco, terracotta low roofs, stone walls, stone dovecote, cypress, well |
| V2 | Dutch | dark brick, thatch hip roofs, green doors, sail windmill (rotor), willow |
| V3 | Japanese | plaster with dark timber posts, tiled roofs with upturned eaves, bamboo fence, waterwheel (rotor), blossom, kei truck |

Each element's catalog style is layered on top. Examples: cow breed, crop, grape colour, glasshouse type, beef breed, horse coat.

### Anchors
Each anchor sprawls by level, gaining more buildings, machinery and animals:

| Element | How it grows | Animals |
| --- | --- | --- |
| vegetable_farm | crop strips → packing shed → market stalls | hens |
| grain_farm | barn → storage towers → combine and bins → elevator and pivot | — |
| dairy_farm | paddocks → tanks → silo → tanker → creamery | 2–15 cows |
| poultry_farm | laying houses and yards; duck pond at Lv5 | hens and ducks |
| cattle_ranch | open range → sorting pens → windpump → chute → branded gate | beef cattle, plus horses at Lv5 |
| horse_ranch | stable with cupola → paddock → jump arena | horses |
| apiary | hive rows in a flower meadow → extraction hut → glass research dome | flying bees |
| vineyard | trellis rows → press → barrels → villa and tasting terrace | sheep mowing the rows |
| rice_farm | paddy grid → waterwheel → terraced paddies at Lv5 | ducks in the paddies |
| greenhouse_farm | 4 glasshouse types → boilers with steam → solar | — |
| vertical_farm | grows tall (2 → 13 glowing floors) with a rooftop turbine | — |

### Modules
Field modules keep crops running to the edges. Perimeter fences use parcel-fence colours at no more than 3 voxels high, so the shared farm edges between modules open up.

| Module | Animals or features |
| --- | --- |
| vegetable_fields | drip line with a rotating sprinkler |
| grain_fields | growth stages, sheaves, then harvest bales |
| orchard_block | hens foraging |
| grazing_pasture | cows, sheep or goats |
| livestock_pen | pigs in mud wallows, goats on a mound, sheep |
| chicken_coop | hens |
| feed_silo | silo rows with an elevator leg |
| irrigation_pond | ducks on the water |
| greenhouse_bay | glass bays |

### Older elements (`agriculture.ts`)
The static critters in these elements are replaced by animated pens:
- **farms:** animal pens and the Lv5 pigs.
- **farm_houses:** hens, horse corral, cow and goats, duck pond.
- **plantations:** hens on the manor lane.

The ox hitched to the plantation cart and the water buffalo in the fields stay static, because they are part of a scene.

## Verification
- **Gallery:** `node scripts/shoot-gallery.mjs "cat=farmsteads&ids=<id>&mode=full&cell=280" out.png`.
- **In game:**
  - `scratchpad/design_farms/shoot2.mjs` with `seed-farms.js` builds a save, injects it with `addInitScript` and calls `window.__pixelWorld.focusGrid`.
  - The script injects the save before the app loads because `App`'s pagehide flush overwrites a save written just before a reload.
  - Frames taken 1 s and 3 s apart differ across about 1k and 35k pixels as the animals move.
- **Types and tests:** `tsc` is clean for these files, and the catalog distinct-styles tests pass for every farm element.
- **Remaining test failures:** these belong to other in-progress work (railMovement exports, ferry/maritime styles, historical handbook, mall economy).
