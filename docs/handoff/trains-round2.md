# Trains, round 2: implementation handoff

Agent: `trains_impl`. This implements `docs/review/trains-review.md`: Phase 0 in full, plus most of Phases 1–4 and parts of 5 and 7.

## Before and after (`npx tsx scripts/review/trains-sim.ts`, 600 s, Switchyard City plus Orchard Valley yard)

| | Before (review build) | After |
|---|---|---|
| Harvest Freight "Red signal" | **44 %** | **2 %** |
| Orchard Valley Local "Red signal" | 26 % | 13 % |
| Grain delivered (600 s) | 534 (369 left at the farm) | **1327** (145 left) |
| Yard passengers delivered | 832 | 1074 |
| Mean passenger wait (transit readout) | **409.9 s** (grew without bound) | **38.5 s** |
| Time with ≥2 yard trains moving at once | 299 s | 439 s |
| Trains squeezing past (ghost fallback) | n/a | 0 |
| Island "Local passenger" | 24 % of the time in the depot | never visits the depot; 66 % running, 34 % boarding |

Full outputs: `scratchpad/trains_impl/sim-before.txt` and `sim-after.txt`.

**Perf** (`scripts/review/trains-perf.ts`): `stepMobility` costs about 0.3 ms per tick (6000 ticks take 1.9 s; before, 2.1 s). Rail BFS costs 0.025 ms per path.

## What changed

### Running model (`src/game/railMovement.ts`, rewritten)

**Lines run station to station.** Depots only store trains:
- new trains start there;
- trains park there out of service hours;
- a train goes there to clear the line for another.

Old saves are migrated by `migrateRail` in `mobility.ts` (`rail.v = 2`).

**Reservations are short.** A train claims:
- the tiles under its body;
- its current leg, but only up to the end of the first plain stretch past the next junction that can hold the whole train (auto-blocks).

Tiles are released behind the tail. Trains therefore wait inside passing loops instead of holding the whole line. The old "everything until I'm back at the depot" plan is gone.

**Partial claims:**
- **Moving block** (signals): on Lv2+ track, or on a line whose depot has the *Block signals* work, a train may follow a train running away from it, two tiles behind.
- **Passing place**: when an oncoming train has reserved track beyond a junction, a train runs up to that junction and waits there. Its own route does not cross the oncoming train's route.

**Routing:**
- `TravelNetwork.railPath` is a weighted (Dijkstra) search. Tiles held by other trains cost +30, so trains take the free side of a loop or the other track of a double line.
- Reversing costs +40, so a train on a ring keeps going round.
- No 90° turn on a diamond, here or in `path()`; rail 4-way tiles are now added to `crossings`.

**Deadlocks:**
- `resolveRailConflicts` finds cycles of waiting trains. The lowest-priority train in the cycle goes to its depot.
- If that train is still stuck after 25 s, it "squeezes past" (ghost) and its status reads "build a passing loop".
- `starvingBehind`: a standing train that has blocked another for 25 s (45 s for an express) yields to the depot. It does this only when moving on would leave it in the other train's way again, and when the depot trip does not run through that train.

**Physics:**
- acceleration from engine `accel` ÷ consist mass (cars and load);
- braking curve to the stopping point;
- track-level speed limits, `TRACK_SPEED` = [1.5, 1.9, 2.4, 2.8, 3.5] tiles/s for Lv1–5;
- curve limit of 1.15 (1.35 at Lv3+), junction limit of 1.6;
- electric and express crawl at 0.55 on track below Lv4 (the catenary is Lv4);
- storm ×0.78.

**Curves:** trains follow the drawn arcs. A leg becomes a polyline: corner tiles become the same r = 0.5-tile quarter circle that `buildRails` draws. Each car sits on two bogie points on the trail, so it chords around the corner.

### Lines with N trains (`src/game/mobility.ts`)

**Train membership:**
- `Run.group` names the line. `addTrainToLine` and `removeTrainFromLine` add or retire a train.
- `lineTrains` lists a line's trains. Edits to the formation or the stops apply to the whole line.

**Headway:**
- `circuitSeconds` returns the measured circuit time (an EMA per train), or a track estimate before any train has run.
- `lineHeadway` = circuit ÷ trains.
- Trains leaving the depot are spaced by the headway. Trains already in service are not held, because on shared track holding did more harm than good.

**Layover:** "Frequency" is now the *layover at the ends* (half the value applies at termini).

### Passenger demand (`completeStop`, shared by bus and rail)

**Arrivals:**
- Riders arrive continuously into one oldest-first cohort queue per (line, stop), shared by every train of the line.
- Competition divides demand by *lines*, not by trains.

**Waits and lost riders:**
- A cohort's wait is real: board time minus arrival time.
- Riders give up after 150 s, or when the queue is over 4× capacity. They are recorded in `m.lost`, which feeds the "N gave up — add a train" hint.

**Destinations** use a light gravity model: `demand(dest) / distance^0.8`, split with the largest-remainder method. Round-robin is gone.

**Readout:** `transitReadout.served` and `freight` are now **per minute**, and a new `lost` field gives riders per minute who gave up. Street relief (`reliefAtStops`) keeps its old magnitude; halving it made the canal-district test fail.

### Freight (`railOperations.ts`)

- The 60 s ×1.08 blink is replaced by `railFreightBonus = 1 + 0.3·q/(q+60)`, where q is the units moved to or from that site over the last 120 s (150 s with a sorting shed), by lines that are still running.
- It applies only to the contract's own source and sink.
- `railServedSites()` is exported so the `rail_freight` proximity synergy can require real service. See "Not done".

### Rolling stock (`railModels.ts`, `mobilityVisuals.ts`)

**Models (new, on the world grid):**
- 0.25 m voxels; bodies 7 voxels wide, wider than the 5-voxel gauge.
- Lengths: 10–17 voxels for cars, from new `length` fields on `LOCOMOTIVES` and `CARS`.
- Every vehicle has two-axle bogies and brass couplers.

**Eras:**
- **Steam** 2-6-0: red spoked drivers, side rods, cylinders, cowcatcher, brass dome, green cab.
- **Diesel** bulldog nose in the line colour.
- **Commuter** double-deck.
- **Electric** box-cab with pantograph.
- **Express** bullet with a tapered nose and line stripe.

**Cars** have distinct silhouettes and visible loads:
- hopper with a grain heap;
- gondola with coal lumps;
- livestock wagon with cow heads;
- tanker with ladder;
- container well car with stacked boxes;
- flat with logs;
- reefer with roof unit;
- waste skip.

**Rendering details:**
- **Line colours:** `lineColor(l)` gives a stable palette per line.
- **Sway:** cars sway slightly while running.
- **Steam puffs:** scale with speed.
- **Couplers:** the old stretched coupler meshes are removed.
- **Depot parking:** trains park visibly in the depot, on its drawn shed roads with the nose at the door (`parkedBodies`).
- **Depot model:** the baked-in static trains and wagons are removed from `buildTrainDepot` (`designs/transit.ts`) and buffer stops added.
- **Legacy model:** the `"train"` road-vehicle model is deleted from `worldRenderer.ts`.

### Practice yard (`practiceRailway.ts`)

- It gained a passing loop at z = −2, with its own steel bridge over the canal.
- The passenger platform faces the loop, with a new street and houses north of it. Freight uses the main line.
- The drop terminal moved west so a waiting freight train no longer stands over the east junction.
- Yard track stays Lv1, so the Lv2 per-tile signal masts don't appear.

### Rail Operations UI (`RailOperations.tsx` and css, rewritten)

**Sheet:**
- Constant height: 84 dvh, or a 78 dvh bottom sheet on phones.
- Four tabs: **Lines · Fleet · Freight · Yard**.

**Line cards:**
- colour, name, and stations as dots on a coloured strip;
- live train pills and waiting counts per station;
- `[−] N trains [+]` and "every ~38s";
- one health line: "Busy: 246 gave up at Spaceport — add a train".

**Line editor:**
- *Tap stations in travel order*: numbered chips. Only stations reachable by rail from the depot are listed.
- Loop or Back & forth.
- Engine chips by era (locked by depot level; electric and express are labelled "needs Lv4+ wired track").
- Car counters capped by the shortest platform, and a side-view consist preview drawn at real lengths.
- Layover, hours and priority live under "Advanced".

**Freight tab:** cargo chips for the cars the line has, From/To dropdowns, and live stock and output multiplier.

**Yard tab:**
- live map with line-coloured routes and trains (a red ring means waiting);
- station picker, rename, show on map, lay track, upgrade and yard works;
- a "How track works" explainer;
- junction points listed by nearest station.

**Station names:** stations are auto-named from their most prominent neighbour ("Grocery Store Halt", "Farm Yard", "Shop Depot"), with North/South/East/West added for duplicates. They can be renamed (`stationName`, `renameStation`). Coordinates never appear.

## Tests (`tests/railOperations.test.ts`, 6 new; suite 364/364, tsc clean)

- A passing loop vs single track: the loop gives more departures and fewer red-signal seconds, with no ghosts. No two trains ever hold the same tile.
- N trains: adding a train halves `lineHeadway`, and the mean wait drops (on a ring, under 60 s).
- Cars ride the arc: samples lie within 0.1 of the r = 0.5 circle, and a diamond refuses a 90° turn.
- Track level: Lv4 track is under 0.6× the trip time of Lv1, and an electric train crawls on Lv1.
- Orchard yard: freight red signal stays under 15 % with no ghosts.
- The existing tests were updated for the throughput bonus.

## Screenshots (`/tmp/claude-0/-home-user-Pixel-Civilization/82636313-3a2d-5962-b203-fb2d54579198/scratchpad/trains_impl/`)

Taken from a frozen copy on :5288, because the shared tree's `App.tsx` was mid-edit (CityBar).

- `rolling-stock.png`: every era and car type, loaded and empty. The dev sheet is `scripts/review/rolling-stock.html`.
- `shots/desk-loop-motion-*.png`: freight and passenger trains moving at once beside the loop.
- `shots/desk-bend-close.png`: steam train on the arcs; loaded diesel freight on the bridge.
- `shots/desk-yard-day.png`: the yard, with the empty depot sheds.
- `shots/phone-ui-Lines.png`, `phone-ui-editor.png`, `phone-ui-Fleet.png`, `phone-ui-Freight.png`, `phone-ui-Yard.png` (430×930).
- `shots/phone-loop-close.png`: world scale against the gauge.

## Not done / handoff

- **`cityDynamics.ts` `rail_freight` synergy** still rewards mere proximity to track, and `transitRelief` is still dead code. Both are in the balance agent's file. Gate the synergy with `railServedSites(state)` and delete `transitRelief`.
- **`simulation.ts` `transitShare`** compares per-minute `served` with `streetDemand.trips` (a "per game-hour" figure; 1 game hour = 5 s). Pick one time base there. In the yard run the share still reads 100 % because that state's trips are small.
- **Lv2 track (`designs/networks.ts`)** still draws a signal mast on every tile; Lv4 also draws catenary on every tile. Now that Lv2 carries real signals, draw masts only at junction entries and every 3–4 tiles.
- **Stations** still don't include their own rails; the platform meets the player's track. "Stop over track" lengthening platforms are not done. Platform crowd sprites are not driven by `stopCrowd` yet.
- **Not started:** full origin–destination demand with transfers by destination; freight chains (Phase 6); `InstancedMesh` rolling stock; wheel and rod animation; night headlight quads; grade crossings; a tap-a-train floating card; a Rail overlay.
- **Phone camera:** `focusGrid` frames high on phone, so the yard sits low in the 430 px shots.
