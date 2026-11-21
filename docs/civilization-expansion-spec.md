# Pixel Civilization: Living Districts Expansion

Status: **draft feature branch, not merged to main**.
Branch: `feature/civilization-schools-farms-roads-2026-11`
Draft review: https://github.com/FuzzyMediaco/Pixel-Civilization/pull/3

## Player promise

Construct recognizable, mutually beneficial communities rather than disconnected blocks. A town can place a country school, high school and athletic field; arrange a university next to research labs; and grow a road-connected farm into a 100-field rural operation.

The game remains playable if these bonuses are ignored. Benefits derive from spatial layouts, not from manually attaching or opening street connections.

## Implemented on branch (subject to visual QA)

### Neighborhood districts
- High School + Sports Field: Athletic Campus; education and recreation benefits.
- Dairy Farm or Cattle Ranch + Grain Farm/Fields: Feed Production; added food yield.
- University + Research Institute: Innovation District; education, employment and income benefits.
- Orchard/Olive Grove + Apiary: Orchard Pollination; fruit output and honey enterprise bonus.
- Cardinal-adjacency trigger; a building keeps its independent model, level, selection and production.
- Capped synergies; pair detection is deterministic and computed from current positions.
- Active district names displayed in the selected-building inspector.

### Schools
- Preschool, Country Schoolhouse, Elementary School, Middle School, High School, Trade & Technical College, Community College, University and Research University.
- Sports Field and Research Institute are separately placeable district members.
- Five distinct voxel upgrade states per element.
- Trade schools support industrial work; colleges/universities improve commercial work and income; country schools deliver budget rural education.

### Farms
- Vegetable, grain, dairy, poultry, cattle, horse, apiary, vineyard, rice, greenhouse and vertical farm anchors.
- Connected vegetable/grain fields, orchard blocks, grazing pastures, livestock pens, chicken coops, feed silos, irrigation ponds and greenhouse bays.
- Existing Farm, Farm House, Plantation and Orchard work as road-connected anchors.
- A field-chain inherits one anchor's road connection, including multi-turn shapes and up to 100+ parcels.
- Anchors get a capped nonlinear yield multiplier from connected field count.
- One field has one owner. Multiple adjacent anchor farms do not duplicate output.
- Added food output for all original/new farm and food-service definitions; higher yield scaling per level.
- Connected parcel boundaries open and use matching dirt/footpath trims; recognizable separate voxel models.
- 5/10/25/50-module tiers activate more agricultural machinery animations.

### Roads and growth
- Two-lane starter road.
- In-place road upgrades from Level 1 through Level 11, paid in Real/Survival and free in God Mode.
- Increased modeled capacity at **every** road level, with changing painted lane designs.
- Highways have broader visual pavement than streets; freeways broader than highways.
- Auto connection when any road touches a building; no second building or manual road link needed.
- Sampled home-to-work routes and road congestion advisor.
- God Mode active ticks can now increase population, despite its earlier early-return rule.

## Important remaining work before merging

1. **True multi-tile highway/freeway occupation is NOT complete**. All road elements still own 1x1 grid footprints, despite wider visual pavement and capacity. To make them occupy more cells, update placement/rotation, road flood-fill, connectivity masks, vehicle tile routing, collision checks and save migration together, then test intersecting wide roads. Do not silently claim that visual width equals physical collision width.
2. **Traffic visuals are still simplified.** Commuter-route load now affects metrics, but decorative autonomous vehicles have not been routed by that demand or assigned real multiple lanes. Integrate visible lane-aware routing and bottleneck visualization.
3. **Review rendered voxels on real devices.** CI builds geometry but cannot verify composition, material, legibility, clipping, nighttime lights, placement previews, or frame rates.
4. **Save migration and in-game playtesting.** Test loading older God/Real/Survival saves containing Level 1–5 roads and pre-expansion farms. Preserve item IDs and restore data without destructive resets.
5. **Balance playtests.** Adjust food supply/demand, specialized income, simulation cost, and population growth through early/mid/late game test towns, avoiding a late-game trivially infinite supply.
6. **Production rollout.** Keep this PR draft and do not merge/deploy until review and acceptance.

## Release acceptance scenarios

- Build two buildings touching different road types and observe instant connection without manual edits.
- Place a Level 1 starter street and upgrade ten times in place; each step must increase traffic capacity and street silhouette without losing other buildings.
- Make a 10x10 block of 100 field modules connected through one plantation to one road. All production must register. Move the plantation and check disconnected state updates.
- Connect dairy to grain, high school to sports, university to research, orchard to apiary. Inspect each district and verify actual gains.
- Separate adjacent elements by one tile and verify the corresponding district bonus disappears.
- Check adjacent farm parcels from several camera angles: open matching edges, no raised soil slabs, farm identity remains recognizable.
- Check farm machinery tiers at 4, 5, 9, 10, 24, 25, 49 and 50 modules.
- Verify God Mode population grows on active ticks while God treasury remains unrestricted.
- Validate normal/Survival upgrade costs and old save compatibility before publishing.

## Source and checks

- `src/game/expansionCatalog.ts`: new placeable elements.
- `src/game/farmNetworks.ts`: deterministic connected farms and visuals.
- `src/game/districtSynergies.ts`: neighbor district rules and shared edge masks.
- `src/game/trafficModel.ts`: simulated capacity and demand by road segment.
- `src/game/simulation.ts`: city metrics, school bonuses and population.
- `src/game/voxelArchitect.ts`: pixel architecture and visual expansion.
- `src/game/worldRenderer.ts`: shared farm borders and active machinery.
- `src/components/BottomDock.tsx`: selected-element bonuses and road upgrades.
- `scripts/test-expansion.ts`: regression tests.
- `scripts/test-voxel-expansion.ts`: voxel runtime smoke test.
- `.github/workflows/expansion-ci.yml`: compile/build/simulation/voxel checks.

Run `npm run lint && npm run build && npm run test:expansion && npm run test:voxels`.
