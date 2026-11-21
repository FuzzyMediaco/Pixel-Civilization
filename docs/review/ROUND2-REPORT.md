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

## Partially done when credits ran out (resume these)
- **Balance fixes** from the systems top-15 (`simulation.ts`, `cityEconomy.ts`): part is applied, including the boat-harbor fix in progress. Re-run `npx tsx scripts/review/probe-*.ts` and `stage-feasibility.ts` to see the current state. Then continue top-15 items 1–15 as listed in `systems-review.md`.
- **Trains phase 0–1** (`railOperations.ts`, `railMovement.ts`, `practiceRailway.ts`, etc.):
  - work so far: short block reservations, `claimRailBlock`, depot-exit occupancy, and express trains yielding to other trains;
  - not checked: whether it has a handoff doc or before/after numbers;
  - next: re-run `scripts/review/trains-sim.ts` and continue the plan in `trains-review.md`.
- **UI revamp:** the agent stopped right as it started coding, so assume nothing is implemented. Begin with Phase 0 in `ui-review.md`.

## Open
- **Test 246, canal district solvency over two island days:** this is likely a result of the in-progress balance changes. Fix the economy or update the expectation deliberately.
- **Test 294, handbook metadata:** `src/handbook/catalog.json` is stale after the redesigns. Regenerate it with the handbook render script; see `scripts/render-handbook.mjs` and `docs/handoff/historical-round2.md` for how the wonder rows were produced.
- **Small visual nits:**
  - rotors such as cranes, Ferris wheels and searchlights can sweep past their lot;
  - hens walk through their coop;
  - a few farm L1/L2 pairs look too similar.
- **Old local stash** `stale agent edits pre-main-sync`: superseded by main and safe to drop.
