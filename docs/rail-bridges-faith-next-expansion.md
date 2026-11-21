# Trains, Bridges and Faith — Next Pixel Civilization Expansion

**Status:** design proposal and review reference only. None of the new rail, new iconic bridge, or faith mechanics described below are implemented. Remain on a separate draft branch. Do not merge to main or deploy.

## 1. Train system: current defects confirmed in source

### Existing architecture
- `train_tracks` are 1x1 rail-network elements; `train_stops` and `train_depots` are non-network buildings with decorative rails inside their geometry.
- The rail flood-fill traverses `isRailNetwork` track tiles and uses adjacent buildings to activate a network, but it does not route trains through platforms, depots or their specific station faces.
- `getNetworkConnMask` treats adjacent transit stops and depots as connectors for track *appearance*, but this is not the same as train route connectivity.
- The renderer creates one-piece train agents on random connected track tiles. Trains select random neighboring tracks; there are no destinations, passengers, freight wagons, cargo manifests, signals, schedules, train lengths or capacity math.
- Rail has no genuine bridge/span distinction, no rail/road grade crossing rules or train conflict reservations.
- Railway density is capped to a small number of agents, independently of real service frequency.

### Stage A: make passenger trains work correctly
1. Add a track graph: each tile, junction, station approach, depot entry and rail bridge is a route node/edge with consistent orientation. Use road adjacency only to grant stations passenger access; never mistake a nearby road for railway track.
2. Correct train-track connections to passenger stops and depots, including rotated entrances, adjacent multiple-tile station footprints and valid track faces.
3. Start a line by connecting two or more stations. A depot manages rolling stock and service; trains actually arrive, pause, load/unload, reverse at termini or traverse loops.
4. Multi-car consists with one locomotive or powered railcar and 1–8 matching passenger coaches. Coaches follow the same continuous centerline at fixed distance; turns are smooth, not independently random tile hopping.
5. Establish platform dwell, shared single-track reservations, turnouts, stop signals and a deadlock-safe fallback. Distinct station level upgrades improve platform length, frequency and comfort.
6. Ridership is optional and gives a modest commute/congestion/happiness lift where road access exists. No population, housing or employment dependency on rail.
7. God Mode can construct and configure everything freely; Real and Survival use rail income, costs and staged unlocks.

### Stage B: freight and industry
- Freight platform/terminal, grain elevator, coal siding, recycling terminal, lumber yard, container depot, livestock dock, refrigerated food depot and fuel loading rack.
- Grain hoppers: collect fields/farms, deliver to mills or stores; boost agricultural effectiveness temporarily if supplied.
- Livestock/cold-chain wagons: dairy and meat distribution; boost associated farms and grocery food capacity.
- Coal hoppers: coal power plant stock support; small efficiency boost, never required to generate power.
- Waste gondolas: landfill and compacting plant logistics; extra waste capacity, reduced nuisance.
- Timber flatcars: forest/wood production; construction or commerce efficiency.
- Oil tankers: fuel facilities and power infrastructure; slight fuel handling efficiency.
- Containers/boxcars: factories, shops, malls, warehouses; commercial income and jobs.
- Station-to-industry cargo handoff: if the industry is adjacent, automatically links; otherwise road trucks handle last mile with optional small efficiency reduction.
- Cargo abstracted into shipments/throughput rather than punishing minute-by-minute inventory. Never stop core utilities if freight service pauses.
- Freight consists visibly change contents and load states; scale car count and delivery animations by station and train levels.

### Depot/rail UI
Tap any depot or station -> `Rail Operations`.
Tabs: Overview | Lines | Trains | Cars | Cargo | Upgrades.
Show accessible rail graph, rail-connected stations, available locomotives, whole train formations, service status, cargo demand, travel directions, and named routes.
Default one-click `Start Passenger Line` suggestions; advanced controls for consist choice, priority, loop/point-to-point, train frequency, platform and freight assignments.
If a route cannot run, show exact missing connection or wrong orientation highlighted on map; never silently dispatch a disconnected train.

### Train art progression
- Rural steam locomotive with wood coaches -> streamlined diesel -> electric commuter EMU -> double-decker passenger -> high-speed express.
- Diesel switcher, classic North American freight locomotive, heavy-haul diesel, modern electric.
- Grain hoppers; coal gondolas; livestock wagons; refrigerated boxcars; tankers; trash containers; log flats; passenger coaches; sleeper/dining cars.
- Animated couplers, smoke, exhaust, lights, passenger queues, crossing gates, bell, rail points, changing speed and station dwell.
- Distinct track materials and catenary upgrade levels; passenger and freight trains share safe geometry.

### Rail bridges
- Timber trestle -> masonry railway viaduct -> steel deck girder -> heavy truss -> high-level arch/cable-stayed rail crossing.
- Rail bridge pieces are route edges; trains never float off track. Ship clearance honored underneath.
- Straight spans must have land approaches, graded continuous height, bridge supports in the water and join at both ends.
- No rail crossing can be placed directly on a road tile until there is an explicit grade crossing or overpass tile.

## 2. Bridge system: real problems and redesign

### Code findings
- Current road bridges are still 1x1 network tiles and their voxel model uses a per-tile `deckY` of 2 for ordinary/suspension bridges and 5 for road overpasses.
- The model currently draws supports, deck, railings and even suspension pylons in each tile, rather than recognizing the entire contiguous bridge as one structure.
- Bridge segments can look like unrelated small gates, often with repeated towers; ramps at land endpoints are not a continuous height profile.
- The user has observed that bridge middle segments look shorter than end segments and upgrading lacks a coherent evolving silhouette. Treat this as an explicit bug to validate visually.
- Current bridge `level` increases tower height in individual suspension tiles but not as a connected global-span design.
- Ship-clearance behavior and mesh-world heights need an independent gameplay/visual collision check before claiming they match.

### Proposed bridge-component system
1. Detect a contiguous bridge group by archetype and connected heading. Decide **approach ramps, abutments, water span, towers, center span and exits** as roles.
2. Give the entire span one continuous deck centerline with smooth, constant grade or engineered ramps. Endpoint decks must meet adjoining road surfaces exactly.
3. Full-span visual upgrade instead of tile-local upgrade: selecting a bridge gives `Upgrade Whole Bridge` and `Upgrade Segment`. Treat a bridge as a named group while each tile retains compatibility with older saves.
4. Height and ship clearance derived from a shared bridge grade/clearance, not separately from decorative towers.
5. Draw pylons at sensible intervals and cable sag across actual span length, not one Golden Gate tower on every tile.
6. Each level increases structural detail, lighting, roadway capacity/clearance where applicable and visually coherent landmark features. Costs reflect the full length.
7. When span length and level cross thresholds, transition gradually to a recognizable iconic-style family rather than suddenly swapping at one level.
8. Preserve graceful performance with shared geometries/instancing and caching keyed by bridge group ID and shape.

### Iconic progression families
- Suspension: simple pedestrian/road crossing -> trussed cable bridge -> paired pylons -> longer hanging cable span -> tall red-orange Golden Gate-inspired landmark with main towers and anchorage.
- Stone: small stone arch -> long elegant multi-arch -> two large towers -> high bridge and drawbridge center -> Tower Bridge-inspired twin towers and lifting center section (for ships).
- Steel: modest truss -> high multi-span truss -> large steel arch with ornate tower approach -> Manhattan-Bridge-inspired blue suspension/truss hybrid.
- Concrete: simple beam -> multi-span flyover -> tall motorway viaduct -> cable-stayed high bridge.
- Rail: timber trestle -> stone viaduct -> riveted truss -> high arch -> landmark long-span rail bridge.

**Important:** 'Golden Gate', 'Tower Bridge' and 'Manhattan Bridge' are design references for recognizable shapes, not promises of precise scale replicas.

## 3. Faith and Blessings

### Current state
Eight faith-category elements exist: Churches, Graveyards, Christian Churches, Monasteries, Mosques, Synagogues, Temples and LDS Temples.
They primarily add recreation (which currently feeds happiness) and some education/food. There is no dedicated faith -> crime/government requirement reduction, no probabilistic blessings and no disaster sanctuary protection.
The current raid code can burn or destroy eligible buildings without checking religious protection.

### Proposed base effects (always-on; illustrative balance targets)
- Faithful civic life bonus: +3 to +12 *happiness points*, depending on building type/level and population coverage, subject to a combined citywide cap of +15. Do not stack hundreds of temples into unlimited happiness.
- Lower crime: a small local neighborhood coverage radius and combined citywide crime modifier capped at a 20% *relative reduction*. Police still matter.
- Lower required government capacity: combined reduction capped at 15% from compatible faith structures. Government buildings and stage-gated city functions remain useful.
- Higher levels add community volunteering, food support, local refuge and education, where appropriate; retain distinct building identities.
- All faith buildings can provide meaningful ordinary benefits. Rare 'blessing' mechanics below are specially assigned to LDS Temples per this creative game design.

### LDS Temple blessing system
- Random periodic blessing check on active game ticks while one or more temples are present. Cap total effects and add cooldowns so cloning temples cannot flood benefits.
- Example blessings, **proposed probabilities / durations only, tune after simulation**:
  - Abundant Harvest: +15% food production for 60–120 seconds.
  - Clear Roads: -15% simulated road congestion for 60 seconds (without artificially changing visible car counts).
  - Community Help: +8 city happiness for 60 seconds.
  - Rapid Recovery: faster fire recovery for a limited period.
  - Industry Prosperity: +10% jobs and income for 60–90 seconds.
  - Divine Protection: on an invasion, an occasional single-use low-probability chance (e.g. 5%) of repelling all attackers **with zero additional casualties**. This should be rolled at a safe moment before casualties occur, and visual celebration clearly distinguishes a miracle from ordinary military success.
- Blessings should show distinctive subtle light or bell animations and be labeled in the temple inspector, with optional `Blessings History`.

### Permanent refuge and indestructibility requested for LDS Temples
- Mark placed LDS Temple entities exempt from enemy target selection, destructive fires, deletion via disaster logic and population-erasing catastrophe logic. Normal player-authorized move or deletion remains possible; game cheats and God Mode can still remove intentionally.
- Refuge cap per temple scales by upgrade level (example 8/15/25/40/60 sheltered residents).
- Disaster survivors persist in a dedicated `shelteredPopulation` state and emerge into total population when safe; never double-count them or inflate housing capacity.
- An attack that destroys every house and normal civilian still leaves the protected temple(s) and sheltered population; a survival game-over trigger must respect protected survivors, while still allowing the player to rebuild. Explicitly define a `Recovery` state instead of declaring a win or losing a city with surviving residents.
- Add tests for simultaneous fire, invasion, forced zero-house population, multiple temples, save/reload and attack retry idempotence.
- **No faith building should be presented as required** for survival or city growth; the advantages are optional, clearly labeled gameplay fantasy.

## 4. Preview and release plan

### Available for review now
- Draft PR #3 includes new education, agriculture, adjacency, traffic balancing and initial voxel visuals, with automated simulation and voxel smoke tests. Source is not yet the published game.
- The current branch's bridge and rail visuals are mostly the existing catalog implementation, *not* the imagined future systems.
- Concept art is not a screenshot. Do not use concept images as QA evidence.

### Must be reviewed before any merge
1. Capture actual branch gameplay screenshots on phone landscape/portrait, tablet, desktop and small-screen software rendering.
2. Review school campus adjacency, modular fields, dynamic tractors, roads at 1/5/11 and existing bridge appearance.
3. Verify older God/Real/Survival saves and check that all new objects appear and upgrade in the UI.
4. Simulate population and traffic over at least several hours of accelerated in-game time in all modes.
5. For next rail/bridge/faith expansion, create separate route, whole-span bridge and sanctuary tests. No main merge without approval.
