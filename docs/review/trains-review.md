# Trains & Rail — Design Review (round 2)

Reviewer: `review_trains`, a read-only rail designer. Base commit: `68542f5`. Line numbers come from that commit. `simulation.ts` is being edited by other agents, so its line numbers may drift by a few.

Evidence scripts (all are read-only):
- `scripts/review/trains-shots.mjs <outDir> [w h]`. Opens Switchyard City, then the Orchard Valley rail yard. It screenshots the yard, all Rail Operations tabs, motion frames and a zoomed view. Run it against a frozen copy of the repo (`git archive HEAD` into the scratchpad, Vite on :5288), because other agents' unfinished edits broke the shared :5199 server during this review.
- `scripts/review/trains-sim.ts` (`npx tsx`). Runs 600 s of headless simulation on Switchyard City plus the practice yard and reports how long each train spends in each status, plus its effects.
- `scripts/review/trains-perf.ts`. Times `stepMobility` and rail pathfinding.

Screenshots are in `/tmp/claude-0/-home-user-Pixel-Civilization/82636313-3a2d-5962-b203-fb2d54579198/scratchpad/review_trains/`. Below they are referred to as `shots/`.
`phone-*.png` (430x930), `desk-*.png` (1440x900), `gallery-stations.png`, `gallery-tracks.png`, `rolling-stock.png`, `desk-motion-grid.png`, `desk-bridge-crop.png`.

---

## 1. How it works now

### Track and connectivity
- **Track** is the `train_tracks` 1x1 network tile (`catalog.ts:1345`, `isRailNetwork`). The voxel model is `buildRails` in `designs/networks.ts:2272-2440`. It draws ballast, ties and rails, real quarter-circle arcs at corners, a switch drawing at T junctions, a diamond at 4-ways and a buffer stop at dead ends. Track level is visual only: Lv2 adds a signal mast on every tile, Lv3 concrete ties, Lv4 catenary masts on every tile, Lv5 a fenced slab.
- **Pathing** uses `TravelNetwork.path(..., "rail")` (`travelNetwork.ts:157-226`). It is a bidirectional, unweighted 4-neighbour BFS over rail tiles. There is no turn restriction, so trains can turn 90° on a diamond crossing that has no curve. Turnouts filter edges through `switchAllows` (`railOperations.ts:439`), and bridges through `railSpanAllows` (`bridgeWorks.ts:25`).
- **Station faces.** Depots and stops connect only on their *back* side, and freight terminals on any non-front side (`travelNetwork.ts:154-155`). Rail and road never share a tile (`canUse`, `travelNetwork.ts:114-116`), so level crossings do not exist.
- **Bridges.** Rail spans come in five kinds: timber, viaduct, steel, elevated, high-level (`bridgeWorks.ts:3-24`). They are drawn by the bridge renderer, and trains take their height from `surfaceTravelHeight`.

### Line, train and schedule model
- **One `Run` is one line and also exactly one train** (`mobility.ts:175 addLine`, the `rail?: RailRun` field). A route is always `[depot, ...stops]` and returns to the depot. `shuttle` reverses through the stops (`mobility.ts:144`).
- **"Frequency" is really a depot layover.** On arrival at the depot, `dwell = interval × (night ? 1.8 : 1)` (`mobility.ts:563`). The real headway is circuit time plus layover, and each line has one train.
- **Consist data.** `LOCOMOTIVES` (5 engines: steam, diesel, commuter, electric, express, with speed 1.3–2.88 tiles/s), `CARS` (12 types) and `CARGO` (8 commodities with producer and consumer id lists) are in `railOperations.ts:13-170`. Validation (`validateFormation`, :313) checks:
  - engine level against depot level;
  - the depot's `wire` work for electric;
  - the shortest platform length (`carLimit`: 3/4/5/6/8 cars by level, +1 with a platform extension);
  - a dispatch interval of 2–90 s.
- **Yard works** (`YARD_WORKS`, :181):
  - platform extension;
  - siding (+2 trains per depot);
  - "block signals", which only make the depot layover 20 % shorter;
  - catenary, which unlocks electric engines at that *depot*;
  - crane, which cuts freight dwell by 30 %;
  - sorting shed, which makes the benefit last 75 s.

### Movement and "signals"
- **Speed.** Trains move at a constant `LOCOMOTIVES[engine].speed × (storm ? 0.78 : 1)` (`mobility.ts:521`). There is no acceleration, braking or curve speed.
- **Path.** Each leg is a list of tile-centre points. Each car is placed on a recorded `trail` at `i × CAR_PITCH` (0.56 tile) (`railMovement.ts:38-80`). At a terminus `prepareRailLeg` (:82) swaps the consist end-for-end (`rearCab`) so the train reverses instead of looping.
- **Blocks.** `remainingRailBlock` (:141) reserves **every tile of the remaining legs until the train is back in its depot**. `claimRailBlock` (:164) then refuses to move while any other moving train holds an overlapping tile. Ties go first to the oldest waiting train, then to the express priority, then to the lower id.
- **Signals and points** are drawn per junction in `MobilityVisuals.update` (`mobilityVisuals.ts:173-178`). A red/green mast per train is also drawn beside its head while it waits.
- **At the depot the train is invisible:** `railBodies` returns `[]` when `l.at === l.depot` (`railMovement.ts:39`).

### Passengers (code path)
1. When a train finishes a leg, `stepLine` calls `completeStop` (`mobility.ts:292`).
2. Riders whose destination is this stop get off. Their count is pushed to `m.deliveries` (kept for 120 s), and 25 % are flagged as transfers to another line (`transferAt`, :276).
3. Boarding uses a queue that grows by `rate × elapsed`. `rate = localDemand(catchment) × busy(night 0.38) × demandScale × m.demand × min(2, √pop/7) / 10 / competition`. `localDemand` (:263) is `popBase×0.6 + jobs×0.14 + education×0.03 + food×0.035` per building in the walking catchment, multiplied by √level. The queue is capped at 5 × capacity.
4. **Destination = `targets[departures % targets.length]`.** Destinations rotate round-robin; they do not come from origin–destination demand.

### Passenger effects
- `reliefAtStops` (`mobility.ts:831`) turns recent deliveries into relief. `streetDemand.ts:31-57` then spreads that relief over the stop's walking catchment and removes up to 70 % of each building's car trips. This is the main way trains improve traffic.
- `transitReadout` (:759) produces a score, coverage, wait and reliability.
  - **Score** feeds amenities as `+score×0.04`, capped at 14 (`simulation.ts:~1464`).
  - **Coverage** (`service.reachable`) marks buildings `connected` even with no road (`simulation.ts:~1161`).
  - **Served** feeds `m.transitTrips` and `transitShare` (:~1215), which drive the "Transit City" achievement.
- `TRANSIT_RELIEF` / `transitRelief()` (`cityDynamics.ts:143, 365`) is never called. It is dead code.

### Freight (code path)
1. A freight line is assigned one `FreightContract` (`assignContract`, `railOperations.ts:497`). The contract names a pickup terminal and a drop terminal. A source must sit beside the pickup terminal or inside its walking catchment, and a sink beside or near the drop terminal (`freightSites`, :482).
2. **Stock.** Food cargo (grain, dairy, livestock) draws on the farm site's `economy.sites[id].food`. Other cargo accrues in `railYard.stock` at `level × staffed × 0.65/s`, up to 48 × level (`advanceRailFreightStock`, :555). Stock accrues only while a contract exists.
3. `freightCall` (:603) loads at the pickup up to the matching car capacity. At the drop it:
   - adds food to the sink;
   - pays `0.09/unit` from outside to businesses;
   - records a delivery (worth 0.25 traffic relief);
   - writes a 60 s (75 s with a sorting shed) **×1.08 benefit** to both source and sink.
4. `railFreightBonus` (:729) applies that ×1.08 to:
   - farm yield, retail and export (`cityEconomy.ts:516, 543, 558`);
   - coal and gas power output, and waste capacity (`simulation.ts:~1274-1281`).
5. Separately, the `rail_freight` synergy (`cityDynamics.ts:191`) boosts factories, coal plants and others within 3 tiles of **any rail tile, whether or not a train runs**. A freight terminal also needs a freight edge to track for `railOK` (`cityEconomy.ts:534`).

### Visuals
- **Rolling stock.** `railModels.ts` builds every engine and car as a 7 × 15 voxel box at **0.13 m per voxel** (`buildRailModel`, :224). World voxels are 0.25 m (`voxelCore.ts:4`). The models include couplers, steam puffs, loaders, points and signal masts. `MobilityVisuals` (`mobilityVisuals.ts:192-216`) draws one `THREE.Mesh` per car, coupler and puff, and lerps position (rate 14) and heading (rate 16).
- **Legacy model.** The old one-piece `"train"` road-vehicle model (`worldRenderer.ts:205-214`) can no longer be reached for rail. It is dead code.
- **Stations** (`designs/transit.ts:804-815`, `gallery-stations.png`): the stop grows from Request Halt to Grand Terminal, and the depot from Engine Shed to Grand Rail Works with a turntable and gantry. The freight terminal is in `designs/projects.ts:625`.

### UI
- `RailOperations.tsx` (1133 lines) is a modal `GameDialog` with six tabs: Overview, Lines, Trains, Cars, Cargo, Upgrades.
  - **Overview:** metrics, an SVG `TrackMap` (:73), a site picker, "Lay approach track" and a junction/turnout dropdown.
  - **Lines:** a list of lines, then name, depot, a checkbox stop list, frequency, hours, pattern, priority, locomotive, add/remove car.
  - **Trains:** status and an engine swap ("Exchange").
  - **Cars:** a catalog grid, the draft formation and reorder controls.
  - **Cargo:** commodity, platforms, producer and recipient dropdowns.
  - **Upgrades:** level and yard works.
- Entry is from the selection bar ("Rail Operations"), or from the Switchyard City guide via "Open Orchard Valley rail yard" (`App.tsx:819`, `practiceRailway.ts`).

---

## 2. What the run showed (headless sim, 600 s, `trains-sim.ts`)

| Line | En route | **Red signal (waiting)** | Depot | Boarding | Result |
|---|---|---|---|---|---|
| Local passenger (island, own depot) | 65 % | 0 % | 24 % | 10 % | 1012 delivered |
| Orchard Valley Local (yard) | 51 % | **26 %** | 13 % | 10 % | 718 delivered |
| Harvest Freight (yard, same depot) | 26 % | **46 %** | 16 % | 13 % | 534 grain delivered, **423 still waiting at the farm** |

Transit readout: score 72, coverage 46 %, **mean wait 454.7 s**, reliability 100 %, `transitShare` = **100 %**.

Performance: `stepMobility` costs about 0.35 ms per tick in the yard (2.1 s for 6000 ticks). Rail BFS costs about 0.035 ms per path on 65 tiles. Simulation cost is not a problem at this scale. Rendering is the risk (§3.4).

---

## 3. Problems

### 3.1 Mechanics
1. **Whole-route reservation means one moving train per shared track.**
   - The block is "everything until I'm back at my depot" (`railMovement.ts:141-162`), and every line begins and ends at its depot. So two lines from the same depot can never run at the same time.
   - Freight waits 46 % of the time. A second train on a line is impossible anyway, because one Run is one train.
   - Passing loops, double track and signals add no capacity. This is the biggest gameplay defect: building more track never helps.
2. **Line = train, and "frequency" is a layover.**
   - A line cannot have several trains or a real headway.
   - Every circuit makes a mandatory trip back into the depot. Real lines run between stations, and depots only store and serve trains.
   - The label "Frequency (seconds)" is misleading. Entering 6 s does not give a train every 6 s.
3. **Signals are fake.**
   - The "Block signals" yard work only shortens depot dwell (`railOperations.ts:202`, `mobility.ts:564`).
   - The Lv2 track tile draws a signal mast on *every* tile, unrelated to any logic (`networks.ts:2383-2395`).
   - The junction signal is red whenever any train has the tile reserved (`mobilityVisuals.ts:177`).
4. **Track level does nothing mechanically.**
   - There is no speed limit by track tier.
   - Catenary on track tiles is decorative, while electric engines are unlocked by the *depot's* `wire` work. An electric train can run on unelectrified timber track.
   - The "High-Speed Rail" track level gives no speed.
5. **No acceleration, braking or curve speed.** Trains move at full speed instantly and stop instantly. Express at 2.88 tiles/s takes corners and the 1-tile station at full speed.
6. **Pathing ignores geometry.**
   - It is an unweighted BFS, so it finds the fewest tiles, not the smoothest route.
   - It allows a 90° turn on a diamond crossing (no curve is drawn there) and arm-to-arm turns that the model has no rails for.
   - Nothing stops a train choosing a route through another line's platform.
7. **Passenger demand is a round-robin fiction.**
   - Destinations cycle through the stops (`mobility.ts:370`).
   - The queue is capped at 5 × capacity and `queue.since` only resets when the queue empties. Once demand is higher than capacity, the reported wait grows without limit (454 s in the run).
   - The player gets no signal of "add capacity here".
   - `transitShare` compares a 120 s rolling rider count with hourly street trips (`simulation.ts:~1216`). The units differ, so it reports 100 % easily.
8. **Freight is shallow, and the rewards are tiny or come for free.**
   - A contract is one source and one sink, both adjacent to terminals. The reward is ×1.08 for 60 s plus 0.09 per unit.
   - The `rail_freight` synergy gives a bonus for merely being near track (`cityDynamics.ts:191`), so running trains matters less than laying one tile.
   - Food cargo moves food the economy already distributes.
   - There are no chains (farm → mill → bakery, mine → steelworks → factory → port), no demand pull and no truck last mile.
   - Non-food stock only grows while a contract exists.
9. **No grade crossings and no road interaction.** Rail can never cross a road at grade, so players must bridge everything. Rail bridges exist, but road-over-rail and rail-over-road placement is not discoverable from the rail UI.
10. **Dead code.** `transitRelief` (`cityDynamics.ts:365`) and the legacy `"train"` vehicle model (`worldRenderer.ts:205`).

### 3.2 Visuals
1. **Rolling stock uses a different voxel scale.**
   - Cars are built at 0.13 m per voxel, while the world uses 0.25 m (`railModels.ts:224`, `voxelCore.ts:4`).
   - Car body width is 7 × 0.13 = **0.91 m, narrower than the 1.25 m rail gauge** drawn by `buildRails` (rails at ±2.5 world voxels).
   - The trains look like toys riding *between* the rails and the detail grain clashes with the buildings (`shots/desk-motion-grid.png`, `desk-06-yard-zoom.png`). The design brief's single 16-voxels-per-tile grid is broken.
2. **Trains cut corners and leave the drawn arcs.**
   - Cars move along straight lines through tile centres (`atDistance` over tile-centre points).
   - The track arc passes about 0.8 m (3.3 world voxels) inside the corner-tile centre.
   - Car heading jumps 90° and is only smoothed by the visual lerp. Corners look like skids.
3. **Generic, small locomotives** (`shots/rolling-stock.png`).
   - Steam has no drive wheels, rods, cylinders or cowcatcher.
   - Diesel is a box; express is a flat wedge.
   - No locomotive has visible bogies. Each has 4 black dots for wheels.
   - Every car is the same length (15 voxels), and there is no line-colour livery.
   - The engine list mixes eras without distinct passenger and freight variants (no switcher, no heavy-haul freight, no EMU).
4. **Depot magic.**
   - The real train disappears while at the depot.
   - Meanwhile the depot model contains *baked-in static trains* (`gallery-stations.png`, depot L2-L5) that never match the real consist.
   - Departing trains pop out car by car.
5. **Stations do not show their track.**
   - Train stops have no rails in the model. The rail must be laid by the player behind the back edge.
   - L4/L5 stops are 2x2, but half the lot is empty lawn (`gallery-stations.png`).
   - Platform length (3-8 cars) is not visible: a 1-2 tile platform hosts an 8-car train.
   - No passengers wait on platforms, apart from up to 4 "rider" sprites walking from the building to the train.
6. **Track tiers are noisy.** A signal mast on every Lv2+ tile and catenary masts on every Lv4 tile create a picket fence of poles (`gallery-tracks.png`).
7. **Lighting.** Headlights and windows are emissive voxels only. There are no rear lights on the trailing car, no light pools at night, no interior glow and no flashing at crossings. Dusk shots are very dark (`desk-04-yard-world.png`).
8. **Animation.** There are puffs from steam engines, but no wheel rotation, rocking, dwell door animation, catenary pantograph or brake spark. Loader props bob by 3.5 cm.

### 3.3 UX
1. **On phone (430 px) the rail yard is hard to reach.**
   - The Switchyard "Island guide" button is covered by the right icon rail (Playwright click was intercepted; `phone-01-island.png` shows no guide at all).
   - The yard camera then frames mostly sky (`phone-04-yard-world.png`).
2. **The dialog is a long settings form, not a map.**
   - The Lines tab scrolls about 1000 px on phone (`phone-03-tab-Lines.png`).
   - Creating a line means ticking checkboxes whose order *is* the travel order, which you cannot see or reorder.
   - Stations are named by coordinates ("Train Stop (4, 65)").
   - The list includes stations on other, unconnected networks (Lines tab lists the island main-line stops while editing the yard line).
3. **Six tabs for one train.**
   - Formation controls are duplicated in Lines, Trains and Cars.
   - The Cargo tab shows a commodity picker even for passenger lines.
   - The Trains tab adds little beyond Lines.
   - The bottom sheet changes height on every tab (`phone-03-tab-Cargo.png` vs `-Lines.png`).
4. **No "why is it red?" feedback.** The status text exists, but the map never highlights the conflicting train, the blocked tile or the full queue.
5. **Turnout control** is a dropdown of "Junction -1, 0" with no map pick. "Hold all trains" is a footgun.
6. **The TrackMap is static.**
   - It shows a train dot, but not line colours, direction or occupancy.
   - You cannot tap the map to add a stop or select a train.
7. **Jargon** ("Exchange assignments at the depot", "consist", "cargo units") without a simple path for beginners.

### 3.4 Performance
- **Rendering.**
  - One `Mesh` per car, per coupler and per puff, each with `castShadow`. There is no instancing.
  - Each geometry kind is cached, but an 8-car train costs about 17 draw calls.
  - Fine for 3 trains; costly at 30. Swiftshader managed 2-5 fps overall, which mostly reflects the city, not trains.
- `claimRailBlock` scans every line with `Array.includes` over tile-key strings (O(lines × tiles²)) on every tick. Whole-route reservations make the arrays large.
- `remainingRailBlock` runs one BFS per remaining stop on each new leg. That is cheap now, but it multiplies with the "many trains" goal.
- The switch list for points and signals is rebuilt from all elements whenever the network object changes (`mobilityVisuals.ts:170`).

---

## 4. Proposal: "perfect trains" (cute voxel Mini Metro with a bit of OpenTTD)

### 4.1 Visuals

**One scale rule.** Rebuild rolling stock on the world grid (0.25 m voxels, 16 per tile).
- A standard car is 6 voxels wide (1.5 m, a little over the 1.25 m gauge) and 14–18 voxels long by type. The pitch follows the car length.
- Wheels are 2-axle bogies at 0.15 from each end, with a visible dark frame and a brass coupler.
- Toy proportion: cars stay chunky and taller than real (a body of 6–7 voxels plus a roof), like everything else.

**Eras (each with a passenger and a freight variant):**

| Era (unlocks) | Passenger | Freight | Signature details |
|---|---|---|---|
| 1 Steam (L1) | 2-4-0 "Prairie" tank, red buffer beam, brass dome | 0-6-0 saddle-tank shunter | rotating spoked drivers + side rods, chimney puffs scaled by speed, warm oil headlamp, wooden 4-window coaches with clerestory roof |
| 2 Diesel (L2) | streamliner "bulldog nose" in line colour | road-switcher with hood + cab, number boards | exhaust shimmer puffs on throttle-up, roof fans spin |
| 3 Commuter (L3) | double-deck push-pull, cab car at rear (no reversal swap needed) | heavy-haul 6-axle diesel | door-open animation at platforms, destination LED shows next stop |
| 4 Electric (L4, needs electrified track) | EMU, 3–6 articulated cars | box-cab electric | pantograph raises, blue arc spark at wire joints at night |
| 5 High-speed (L5, needs HS track) | long-nose bullet, white + line stripe | intermodal double-stack | nose lights strip, tilting on curves, slipstream particles |

**Cars:**
- Each cargo has a distinct silhouette, and its load is visible:
  - grain hopper (sloped bays, golden heap);
  - coal gondola (black lumps);
  - reefer (white, roof unit, frost tint);
  - livestock (slatted, cow heads);
  - tanker (cylinder, ladder);
  - log flat (stakes and logs);
  - container well (stackable coloured boxes);
  - waste (green skip).
- Line colour appears as a stripe on every passenger car, and as a small flag on the freight engine.

**Stations** (built from track tiles, not separate boxes):
- A stop is placed *over* track as a platform that lengthens. A 1-tile halt grows to a 2-, 3- or 4-tile platform with level, and the platform length *is* the car limit.
- Level silhouettes: a halt sign and bench; then a canopy and a wooden shelter; then a brick station with a clock; then an island platform with a footbridge; finally a glass-vault terminal over 2–4 tracks.
- Platforms show waiting passenger sprites (1 sprite per 10 waiting, up to 12), so crowding is visible.
- **Depot** becomes a real train shed. Trains park visibly inside on stub tracks; remove the baked-in static trains. Lv3 adds a turntable that really spins a locomotive. Lv5 adds a works gantry that lifts a car.
- **Freight terminals** are typed: grain elevator, coal tipple, tank-farm rack, crane container yard, log yard. The loading animation plays only while a train is present.

**Signals and catenary:**
- Signals are a separate piece the player places (or that is auto-placed at junction entries).
  - Semaphore arm at L1–2, colour light at L3+.
  - Red, yellow and green state comes from real block occupancy.
  - Remove the decorative mast drawn on every tile.
- Catenary masts every 2 tiles on straight track; 1 inside mast on curves; portal frames at junctions.

**Animation and night:**
- Acceleration lean, car rocking (±0.5° roll noise), brake sparks when braking hard, and a wheel-clack sound cue at each tile.
- At night:
  - headlight cone, a cheap additive quad on the ground ahead;
  - red tail lamps on the last vehicle;
  - warm window glow in coaches;
  - station lamps.
- Crossing gates drop with a flashing red pair and a bell.

### 4.2 Mechanics

**Track graph:**
- Precompute a directed edge graph per tile entry and exit, with allowed moves per tile shape. Straight goes straight. A corner allows its arc. A T allows stem↔both arms and arm↔arm straight. A diamond allows only straight.
- Run A* weighted by length plus a curve penalty plus a reverse penalty. Cache by `railRevision`.
- Keep `switchAllows` as a forced-route override.

**Movement on curves:**
- Move along the drawn arc. Store each leg as a polyline sampled from the same arc math as `buildRails`, so trains sit on the rails.
- Physics:
  - `v` is limited by `min(engine vmax, track tier vmax, curve vmax)`;
  - acceleration and braking come from engine power ÷ (engine + cars) mass;
  - braking curve to the station stop point and to red signals.
- Track tier limits: L1 60 %, L2 75 %, L3 90 %, L4 100 %, L5 HS 140 % of base.

**Signals and blocks** (OpenTTD-lite, auto by default):
- **Auto-blocks:** each run of track between junctions or stations is a block. A train reserves only the *next* block(s) needed to reach a safe stopping point: the next station platform or the block after a junction.
- **Path reservation at junctions** (PBS): reserve through the junction to the exit block atomically. This lets two trains on a double-track line, or at a passing loop, run at the same time.
- **Deadlock guard:** if a single-track section has opposing demand, the first train to request it gets the section to the next loop. Others wait at the loop signal.
- **Player signals are optional:** placing a signal on a long block splits it, which adds capacity. The UI shows block colour on the map.

**Line model (Mini Metro style):**
- A **Line** is an ordered list of stations, either a loop or end-to-end, with a colour and a name.
- **Trains are assigned to lines** (1..N). Headway is derived as circuit time ÷ trains; the UI shows "a train every ~40 s".
- The depot is where trains spawn, are stored, and are serviced (optional "service every N trips" at L3+). Trains do not visit the depot on each circuit.
- Termini reverse. Push-pull and EMU stock reverse instantly; a locomotive needs a run-round loop or a turntable (L3 depot), or it pays a reversal-time penalty.

**Demand model** (light origin–destination demand, cheap):
- Each station gets a catchment built from the current walking catchment. Classify the catchment into **homes / jobs / shops / leisure**.
- Every N seconds, generate trips from each station to every station reachable on the rail network (including transfers), weighted by `homes_i × jobs_j / distance^0.8` plus a time-of-day profile (morning to jobs, evening to homes).
- Riders carry a *destination*, board only trains that reach it, and transfer at shared stations.
- Platform queues are capped with **real loss**. People who give up become car trips, which shows up in traffic. Report `boarded`, `left behind` and `average wait`. Fix `queue.since`: use an arrival-time FIFO, or track the mean waiting age.
- Effects:
  - delivered trips → road relief (keep `streetDemand` relief);
  - happiness and land value near well-served stations (+ up to 10 % land value within 3 tiles of a station with good service);
  - job reach (workers can fill jobs on connected stations);
  - fare income to the treasury.
- Drop the unit mismatch in `transitShare`: compare per-minute trips with per-minute trips.

**Freight chains** (cargo flows, with trucks for the last mile):
- **Primary producers** create cargo stock while staffed, whether or not a train exists: farms (grain, livestock, dairy), mines (coal, ore, stone), forests (timber), oil wells/docks (fuel).
- **Processors** consume inputs and output goods:
  - mill (grain → flour);
  - bakery/food plant (flour + dairy → food);
  - sawmill (timber → lumber);
  - steelworks (coal + ore → steel);
  - factory (steel + lumber → goods);
  - refinery (fuel).
- **Consumers:** shops, malls and groceries take food and goods; power plants take coal and fuel; construction takes lumber and steel; the port exports anything for money.
- **Stations accept and supply what is in their catchment.** Remove the need to pick a "producer" and "recipient". A freight line automatically picks up whatever its stations supply that some downstream station accepts. Contracts become optional overrides.
- **Benefits scale with throughput, not a 60 s blink:**
  - processors run only when supplied, or at 30 % on "local trucks" without rail;
  - rail-fed processors get ×1.5 output;
  - power plants supplied by rail drop their fuel cost;
  - export earnings at the port.
  - Remove the free proximity `rail_freight` synergy, or make it require an active freight line serving that site.
- Trucks (existing road traffic) handle station ↔ industry within the catchment, so freight adds visible street life.

**Upgrades by level** (each one changes the silhouette *and* a number):
- Track L1–5: speed tier, catenary at L4, HS slab at L5. Upgrading a whole stretch costs per tile.
- Station L1–5: platform length (2/3/4/6/8 cars), tracks (1/1/2/2/4 platforms), comfort (dwell −10 % per level), catchment +1.
- Depot L1–5: number of trains (2/3/5/8/12), max era, turntable (L3), servicing (reliability), works (L5: −20 % purchase cost).
- Freight terminal: loading speed, cargo types accepted, storage.

### 4.3 UI/UX (phone-first, "draw a line")

**Primary flow: Line mode** (a new `Rail` tool in the build dock):
1. Tap **"New line"**. A colour chip appears, and every station gets a big round tap target on the map.
2. **Tap stations in order.** The line draws itself along the track path as a coloured route ribbon. If two stations are not connected, the gap shows as a dashed red segment with "Lay track" and a one-tap auto-track suggestion (A* over buildable tiles).
3. Tap the first station again to make a **loop**, or "Done" for end-to-end.
4. A sheet shows `Trains: [−] 2 [+]` with the derived headway ("every ~35 s"), the train era chip, and the cost. That is all.

**Line card** (what to show):
- colour, name and the stations as dots on a line;
- trains as moving pills on that strip, with load bars;
- a waiting count per station (people icon with a number);
- one health line: "Busy: 140 waiting at Market St, add a train".

**Hide behind "Advanced":** car-by-car formation, day/night hours, priority, turnouts, contracts, train exchange.

**Tap a train in the world** to get a small floating card with line, next stop, load, a "Follow" button and a "Send to depot" button.

**Tap a signal or junction in the world** to cycle its state. Remove the junction dropdown.

**Overlay toggle "Rail"** (in Layers):
- dims the city and shows line ribbons in their colours;
- shows block occupancy (red segments) and station crowding halos;
- shows freight flows as animated arrows coloured by cargo.

**Station naming:** auto-name from the nearest landmark or street ("Cheesesteak Row", "Orchard Halt"), and allow renaming. Never show coordinates.

**Merge tabs.** Use Lines (list and editor), Fleet (depot view with trains parked visually, buy and upgrade), and Freight (flows and chains). Upgrades belong in the existing element sheet. Use a fixed-height sheet with internal scroll so the size doesn't jump between tabs.

**Phone fixes:** keep the island guide toggle clear of the right rail. The yard camera should frame the track bounding box at its current pitch, not a fixed distance.

### 4.4 Performance plan
- Render cars with `InstancedMesh`: one instanced mesh per car model kind, updated per frame. Couplers and puffs are instanced too. Shadows: only the locomotive casts, or use a blob-shadow decal.
- Store reservations as an `Int32Array` block-owner table indexed by block id. A claim then costs O(blocks per path).
- Build the rail graph and block segmentation once per `railRevision` and cache them on `TravelNetwork`.
- Demand generation runs at 1 Hz on station pairs, using a precomputed station-to-station travel-time matrix per network revision.

---

## 5. Phased implementation plan

| Phase | Goal | Files | Acceptance |
|---|---|---|---|
| **0. Quick fixes (1 day)** | Make today's system honest | `railMovement.ts` (reserve only to the next platform or the depot exit, not the whole circuit), `mobility.ts` (fix `queue.since` wait; relabel layover), `RailOperations.tsx` (rename "Frequency" to "Depot layover"; filter stops to the depot's connected component; hide Cargo for passenger lines; fixed-height sheet), `cityDynamics.ts` (delete `transitRelief`; gate `rail_freight` on an active freight line), `worldRenderer.ts` (drop legacy `"train"` model), `ExampleIslands.tsx` CSS (guide clear of rail at 430 px) | Yard sim: freight "Red signal" < 15 % (now 46 %), wait < 60 s, tsc and tests green |
| **1. Track graph and smooth motion** | Trains ride the drawn arcs; turn rules | new `src/game/railGraph.ts` (tile-entry graph, arc polylines shared with `designs/networks.ts buildRails` constants), `travelNetwork.ts` (rail delegates to railGraph A*), `railMovement.ts` (trail sampled from arcs; accel, brake, curve limits), tests `tests/railGraph.test.ts` | No 90° turn on a diamond; cars stay within 0.1 tile of the rail centreline on corners |
| **2. Blocks and signals** | Real capacity from double track and loops | `railGraph.ts` (block segmentation), new `railSignals.ts` (PBS reservations, deadlock guard), `mobilityVisuals.ts` (signal state from blocks; signal placement piece), `catalog.ts` + `designs/networks.ts` (signal piece; remove the per-tile decorative mast) | Two trains on a double-track line run at the same time; a single track with a loop passes trains without deadlock (test) |
| **3. Line ≠ train** | Mini Metro lines with N trains | `mobility.ts` (`Line {stations, color, loop, trainIds}`, `Train {lineId, consist, pos}`; save migration from `Run.rail`), `railOperations.ts` (fleet per depot, servicing), `RailOperations.tsx` → Lines/Fleet/Freight | Adding a train halves the headway; old saves load with one train per line |
| **4. Scale-correct rolling stock and stations** | The cute voxel look | `railModels.ts` rewrite on the 0.25 m grid with per-era models (bogies, rods, pantograph, liveries via line colour), `mobilityVisuals.ts` (InstancedMesh, wheel and rod animation, night lamps, tail lights, door animation), `designs/transit.ts` (stop as a platform over track with lengthening; depot sheds with real parked trains; drop baked trains), `designs/projects.ts` (typed freight terminals), gallery entries for rolling stock | Gallery sheet of all eras; the in-game train is wider than the gauge; trains are visible inside the depot |
| **5. OD demand and effects** | Ridership the player can read | new `railDemand.ts` (station catchments by type, gravity origin–destination, time-of-day profile, transfers), `mobility.ts` boarding by destination, `streetDemand.ts` (lost riders → car trips), `cityEconomy.ts` (land value near served stations, fares) | Crowding shows as a number and sprites; adding a train lowers waits; traffic visibly drops |
| **6. Freight chains** | Farms, mines, factories and ports matter | new `freightFlows.ts` (producer stock, processor recipes, acceptance per station catchment), `catalog.ts` / `expansionCatalog.ts` (mill, sawmill, steelworks and others if missing), `railOperations.ts` (contracts become optional overrides), `cityEconomy.ts` / `simulation.ts` (processor output and power fuel tied to supply) | A coal mine → power plant line lowers fuel cost; grain → mill → bakery raises food |
| **7. Line-drawing UI and overlay** | Phone-first management | new `components/RailLineTool.tsx` (tap stations, auto-track suggestion), `RailOperations.tsx` slimmed to cards, `HeatmapPanel` / Layers "Rail" overlay, floating train card, station auto-names | A new player makes a 3-station loop with 2 trains in under 30 s on a 430 px phone |
| **8. Polish** | Night, sound, crossings | grade-crossing tile (rail × road with gates), `mobilityVisuals.ts` headlight quads, puff and spark particles, audio hooks | Night shots read clearly; trains and cars share crossings safely |

Recommended order: 0 → 1 → 2 → 3 in that sequence, since everything else builds on the graph, blocks and line model. 4 can run in parallel with 2–3, assigned to a separate art agent. 5–6 come after 3. 7 can start after 3 with a mock graph.
