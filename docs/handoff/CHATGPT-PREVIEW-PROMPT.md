# Prompt: bring Round 2 into the live preview and illustrated handbook

You're continuing work on Pixel Civilization (repo `FuzzyMediaco/Pixel-Civilization`). A lot of new work was finished on the branch **`ccr-5480f4a8-nj27ci`**. It is 22 commits ahead of `main` and has not been merged yet. I want all of it playable in the **live preview build** and documented in the **illustrated handbook and field guide** so I can test it.

## 1. Get oriented (read these first)
- `git fetch && git checkout ccr-5480f4a8-nj27ci`. Base everything on this branch, or merge `main` into it if `main` has moved. Don't lose either side.
- `docs/review/ROUND2-REPORT.md` is the master summary of what changed. It links to every review and handoff.
- Handoffs in `docs/handoff/`:
  - `balance-round2.md`
  - `trains-round2.md`
  - `ui-round2.md`
  - `level-scaling.md`
  - `schools-round2.md`
  - `farms-round2.md`
  - `projects-a-round2.md`
  - `projects-b-round2.md`
  - `historical-round2.md`
- Reviews and ideas in `docs/review/`:
  - `systems-review.md`
  - `ui-review.md` (phone mockups in `docs/review/mockups/`)
  - `trains-review.md`
  - `level-scaling-audit.md`
  - `new-elements-proposal.md`
- Baseline: `npm run lint` is clean, `npm test` passes 364/364, and `npm run build` must succeed. Keep all three green.

## 2. What's new and must show up in the preview and handbook
1. **New phone-first UI** (`src/components/ui/*`, `Hud`, `BottomNav`, `BuildSheet`, `PlacementBar`, `InspectorSheet`, `LayersSheet`, `CitySheet`, `TransitSheet`, `MoreSheet`, `src/game/cityIssues.ts`):
   - four status chips, an alert pill, and five tabs (Build, Layers, City, Transit, More);
   - Undo toasts;
   - Issues with Fix buttons;
   - a tax slider and an auto-maintain toggle.

   The old TopHud, BottomDock, RightIconRail, HamburgerMenuModal, CursorControlButton and HeatmapPanel components were deleted. Update any preview, handbook or test code that referenced them.
2. **Balance round 2** (`simulation.ts`, `cityEconomy.ts`, `levelScaling.ts`):
   - the fixed money loop (trade and sales tax, household spending, tourism income);
   - `metrics.populationLimiter`;
   - day-averaged happiness;
   - new stage thresholds and stage grants;
   - all element benefits scale with level through one curve module.
3. **Trains round 2** (`railMovement.ts`, `mobility.ts`, `railModels.ts`, `mobilityVisuals.ts`, `RailOperations.tsx`):
   - block reservations and lines with several trains;
   - demand-based passengers;
   - speed set by track level;
   - world-scale rolling stock in 5 eras, parked in depots;
   - a 4-tab phone Rail Operations sheet with a "tap stations in order" line editor.
4. **Animated livestock:** `c.critters` in `designs/kit.ts`, `critterModels.ts`, and `CritterHerds` in `farmActivity.ts`.
5. **Redesigned elements:**
   - 11 schools (`designs/campuses.ts`);
   - 20 farm elements (`designs/farmsteads.ts`, `agriculture.ts`);
   - 22 wealth projects (`designs/projects.ts`, `designs/projectsFuture.ts`);
   - ferry landings and taxi ranks (`designs/landings.ts`).
6. **8 new historical wonders:** Colosseum, Stonehenge, Parthenon, Great Wall, Chichen Itza, Moai, Angkor Wat and Machu Picchu (`historicalCatalog.ts`, `designs/historical.ts`).

## 3. Tasks
1. **Live preview:** run `node scripts/build-preview.mjs ./portable`. Make sure the generated game, handbook, world launchers and standalone atlas include everything above. Fix anything the new UI or new files broke in the preview build, such as deleted components, new CSS (`src/styles/interface.css`, `src/components/ui/ui.css`) or new asset paths.
2. **Example islands for testing** (`src/game/exampleWorlds.ts`): add guided showcase spots, or a new example island, so each feature can be tested in one or two taps:
   - a wonders plaza with all 8 wonders at mixed levels;
   - a farm valley with animated herds (dairy, cattle, poultry, horse);
   - a school campus row;
   - a futuristic projects district (spaceport, teleportation depot, arcology, ocean habitat);
   - Switchyard City using the new multi-train lines and passing loop.
3. **Illustrated handbook** (`src/handbook/chapters.json`, `catalog.json`, `public/handbook/*`):
   - **Atlas art:** regenerate it for the 8 wonders and anything still stale. See the header of `scripts/render-handbook.mjs`; it needs `npm install --no-save --package-lock=false @napi-rs/canvas@1.1.1`, and `ATLAS_IDS` limits it to specific ids.
   - **New chapters or lessons:**
     - **The new interface:** where everything lives now, with phone screenshots.
     - **How your city grows:** the population limiter, the money loop, taxes, upkeep and level scaling.
     - **Trains:** lines with several trains, passing loops, signals, track levels, the line editor and freight.
     - **Livestock and farms.**
     - **Historical wonders.**
   - **Scene captures:** use the same headless-capture approach as the existing scenes (`public/handbook/scenes/*`).
4. **Field guide** (`field-guide.html`, `src/fieldGuide.tsx`): confirm that every element, including the 8 wonders, has an entry with all 5 levels and 4 styles, and that "operating instructions" links resolve.
5. **Playtest pass:**
   - **Viewports:** open the preview at phone size (430×930) and desktop.
   - **Example islands:** play each one for a few minutes in real mode.
   - **Flows:** check that build, place, upgrade, undo, Issues → Fix, Rail Operations line editing and the heatmaps all work.
   - **Errors:** check the console stays clean.
   - **Notes:** record findings in `docs/handoff/preview-round2-playcheck.md`, with screenshots.
6. **Finish:**
   - keep lint, test and build green;
   - commit to the branch and push;
   - open a PR to `main` with a summary and screenshots.

   Don't merge it; I'll review first.

## Notes
- Several agents shared the working tree earlier. **Don't use `git stash`, `git checkout -- <file>`, or `git reset`** on shared work. There is an old unrelated stash named "stale agent edits pre-main-sync"; ignore it.
- Saves seeded via localStorage get overwritten by the app's pagehide save. Inject saves with Playwright `page.addInitScript` before load.
- Known minor visual nits, which are fine to leave or fix:
  - rotors such as cranes, Ferris wheels and searchlights sweep past their lot;
  - hens walk through their coop;
  - a few farm L1/L2 pairs look alike;
  - Lv2/Lv4 track draws a mast on every tile.
