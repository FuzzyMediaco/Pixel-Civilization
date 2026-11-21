# Round 2: Review, rebalance and redesign (start here)

Branch `ccr-5480f4a8-nj27ci`, built on `main` at 68542f5. Status at hand-off: `tsc` is clean and **358/360 tests pass**. The two failures are listed under "Open".

## Reviews (read these for the "how would you change it" answers)
- `docs/review/systems-review.md` covers every system: population, happiness, needs, economy, stages, land value, pollution, synergies, traffic, rail, faith, disasters and survival. It gives formulas with code refs, probe-city numbers and a ranked top-15 change list.
  - **Headline:** the money loop is broken (trade tax is always $0, and grocer imports drain the treasury). The population cap is hidden from the player. Every probe city stalls at a waste or food cap, and stage 20 needs more tiles than the island has.
- `docs/review/level-scaling-audit.md` checks 60 metrics for whether they scale with level.
- `docs/review/ui-review.md` covers about 37 screens and proposes a unified phone UI. The mockups are in `docs/review/mockups/`. Headline problems:
  - there are 6 overlapping ways to navigate;
  - important status is hidden;
  - the inspector is unlabeled icons;
  - 173 tap targets are smaller than 40px.

  The redesign uses a top bar of 4 status chips, an alert pill, and 5 bottom tabs, with one bottom-sheet component.
- `docs/review/trains-review.md` covers all of rail. Problems:
  - each train reserves its whole route back to the depot, so only one train moves on shared track;
  - each line runs exactly one train;
  - signals and track level are decorative;
  - passenger wait times and transit share are miscalculated;
  - rolling stock is at the wrong scale.

  The doc has a phased plan to fix all of this.
- `docs/review/new-elements-proposal.md` proposes **25 new elements** that fill gaps: healthcare, tourism, goods chains, battery storage, metro/tram/gondola, lighthouse/seawall and others.

## Built
- **Level scaling:** `src/game/levelScaling.ts` defines one set of curves, and every benefit, cost, radius and pollution value scales with level. `elementLevelStats()` feeds both the simulation and the UI. Tests in `tests/levelScaling.test.ts`. Details in `docs/handoff/level-scaling.md`.
  - Dead `income` stats on 46 sites now earn.
- **Schools:** all 11 redesigned (`designs/campuses.ts`, `docs/handoff/schools-round2.md`).
- **Farms:** all 20 redesigned in 4 regional styles. **Animated livestock** walk, graze and peck in their pens: cows, sheep, pigs, chickens, horses, goats, ducks and bees (`critterModels.ts`, `farmActivity.ts`, `kit.ts` `c.critters`, `docs/handoff/farms-round2.md`).
- **Wealth projects:** all 22 redesigned, plus ferry landings and taxi ranks (`designs/projects.ts`, `designs/projectsFuture.ts`, `designs/landings.ts`).
- **8 historical wonders:** Colosseum, Stonehenge, Parthenon, Great Wall, Chichen Itza, Moai, Angkor Wat and Machu Picchu (`historicalCatalog.ts`, `designs/historical.ts`, `docs/handoff/historical-round2.md`).

## Finished after resuming
- **Balance round 2** (`docs/handoff/balance-round2.md`, `tests/balanceRound2.test.ts`):
  - **Money loop:** trade and sales tax are collected, grocers pay for their own imports, and income sites earn from household spending and tourism.
  - **Population limit:** `metrics.populationLimiter` is exposed.
  - **Other systems:** day-averaged happiness; rebalanced waste, water and power caps, defense, crime and traffic; stages 13–20 compressed; staggered survival maintenance; fire auto-repair; a 12% tax rate; and stage grants.
  - **Probe results:** starter, mid and late cities all grow further with a positive treasury.
- **Trains round 2** (`docs/handoff/trains-round2.md`):
  - **Track sharing:** short block reservations, so loops and double track add capacity, and lines with N trains.
  - **Simulation:** demand-based passengers with real wait times; freight rewards scale with the amount delivered.
  - **Movement:** track level sets the speed limit, and trains accelerate, brake and slow for curves.
  - **Visuals:** rolling stock is rebuilt at world scale in 5 eras and follows the drawn curves. Trains park in their depots.
  - **UI:** a 4-tab phone Rail Operations sheet with a "tap stations in order" line editor.
  - **Yard freight, red-signal time:** 44% → 2%.
  - **Mean passenger wait:** 410 s → 38 s.
- **UI revamp** (`docs/handoff/ui-round2.md`):
  - **Layout:** four status chips, an alert pill, and Build/Layers/City/Transit/More tabs.
  - **Building screens:** BuildSheet with costs, a PlacementBar while placing, and an InspectorSheet with labelled actions and a confirm before demolishing.
  - **Feedback:** Undo toasts, and a City → Issues list with Fix buttons (`cityIssues.ts`).
  - **Checks:** every control is ≥44px, and the old nav components were deleted.
- **Lead fixes:**
  - the transit-share unit bug;
  - the Rail Freight synergy now needs a running freight line;
  - the handbook atlas is regenerated for all 61 redesigned elements.

## Status
`tsc` is clean and **364/364 tests pass**. The game loads with no console errors.

## Next ideas (not started)
- **Happiness heat map layer,** plus a "show where it would grow" preview for blocked upgrades.
- **Trains:**
  - stations with their own rails;
  - freight chains (farm → mill, mine → factory → port);
  - instanced train rendering and night lights.
  - In `networks.ts`, Lv2/Lv4 track draws a mast on every tile.
- **The 25 proposed elements** in `new-elements-proposal.md`, with the Health, Tourism and Goods systems.
- **Visual nits:**
  - rotors such as cranes and Ferris wheels can sweep past their lot;
  - hens walk through their coop;
  - a few farm L1/L2 pairs look alike.
