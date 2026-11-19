# Pixel Civilization — Redesign Handoff (start here)

Branch: `ccr-5480f4a8-nj27ci`. Goal from the owner: radically redesign **every** element (≈149), all 5 levels
and all 4 visual variants; make leveling intuitive per element (farms sprawl, towers grow tall, ships climb hull
classes…); plus 10+ gameplay upgrades. Full design rules: `docs/handoff/DESIGN_BRIEF.md`.

## What's DONE (lead)
- **Design framework**: `src/game/designs/` — `registry.ts` (per-element footprints for Lv1-5, level names,
  growth note, builder), `kit.ts` (helper library + Ctx with rotors/smoke/blinkers/bob), `index.ts` (imports all
  category files). `voxelArchitect.ts` uses a registered design if present, else falls back to the OLD builder.
  `catalog.ts#getStandardFootprintForLevel` reads design footprints (max 4×4); `getElementLevelName/GrowthNote`.
- **Gallery tool**: `./scripts/gallery-server.sh` then
  `node scripts/shoot-gallery.mjs "cat=housing&ids=house&mode=full&cell=300" out.png` (modes: full / levels / variants,
  `night=1`, `angle=225`, `water=1`). Game screenshot: `node scripts/shoot-game.mjs out.png [scripts/seed-showcase.js]`
  (seed builds a God-mode city with every land element). `window.__pixelWorld` exposes the renderer.
- **Gameplay systems** (`src/game/cityDynamics.ts` + `simulation.ts`): traffic per road network (capacity by
  type/level, rush hours, transit relief, jammed shops earn less), pollution field (industry emits, trees/parks absorb),
  land value field (boosts housing pop & income), 17 neighbour synergies (+12% each), live power (solar/daylight &
  clouds, wind/wind speed, hydro/rain), upkeep + cash flow, auto-bridges (roads dragged over water become bridges,
  bridges can replace river tiles; `overWater` flag; conn-mask ramp bits 256-2048, water bit 4096), boats need a
  nearby dock/harbor, cars stay off pedestrian paths, history sparklines, 18 achievements, merge/upgrade support for
  element-specific footprints up to 4×4.
- **Renderer** (`worldRenderer.ts`): multi-rotor animation, pooled smoke/steam/spark particles, blinking beacons,
  rise-from-ground construction + dust, instanced heatmaps (+ Land Value / Pollution / Traffic), cached network sets,
  traffic-density-driven car counts, car-following (queues in jams).
- **UI**: inspector shows level name → next level name & footprint, land value, pollution, synergy emojis; HUD shows
  cash flow, live power %, congestion %; Advisor has a "Trends & Trophies" tab and updated rules text.

## Design agents (per-category status in the files next to this one)
| Area | File(s) | Handoff |
|---|---|---|
| Housing (14) | designs/housing.ts | housing.md |
| Farms (6) + Nature (18) | designs/agriculture.ts, nature.ts | agri_nature.md |
| Commerce (16) | designs/commerce.ts | commerce.md |
| Power & Waste (15) | designs/power.ts | power.md |
| Water (8) + Transit bldgs (5) + Landmarks (7) | designs/water.ts, transit.ts, landmarks.ts | water_transit_landmarks.md |
| Civic (13) + Faith (8) | designs/civic.ts, faith.ts | civic_faith.md |
| Police/Military (9) + Maritime (9) | designs/security.ts, maritime.ts | security_maritime.md |
| Roads/Bridges/Rail/Water networks (21) | designs/networks.ts | networks.md |
If a category handoff file is missing, that agent stopped before writing it — check its design file for which ids
are registered (`grep -o '^  [a-z_]*: {' src/game/designs/<file>.ts`).

## Remaining TODO (lead)
1. Resume each category from its handoff (one agent per file; same brief). Verify every id at all levels/variants.
2. Check coverage: every catalog id should be registered —
   `npx tsx -e "import './src/game/designs/index.ts'; import {ELEMENTS} from './src/game/catalog.ts'; import {DESIGNS} from './src/game/designs/registry.ts'; console.log(ELEMENTS.filter(e=>!DESIGNS[e.id]).map(e=>e.id))"`
3. Once all are registered, delete the legacy per-element `switch` and `buildNetworkElement` in `voxelArchitect.ts`.
4. Cross-category distinctness pass (gallery `cat=all&mode=levels`), night pass, performance pass (voxel counts).
5. In-game test with `scripts/seed-showcase.js`; test merging into the new footprints, auto-bridges, boats/docks.
6. `npx tsc --noEmit` clean, commit, push. NOTE: last push failed with 403 — the owner must reconnect GitHub at
   https://claude.ai/connect-github (and install the Claude GitHub App on the repo) before pushing works.
