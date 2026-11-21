# Train Depot Operations — Complete UI Design

Status: design specification and interactive mockup, not train simulator implementation. Keep main unchanged.

## Visual system
Reuse existing Pixel Civilization parchment surface (#fcfaf5), stone-dark text and controls, soft borders, compact typography, and voxel-inspired railway details. No alternate design system. Overlay with safe-area padding and internal scroll for 952x427 mobile landscape, phones in portrait, tablets, desktop.

## Entry and navigation
Tap a Train Depot or Train Stop, then Rail Operations. Top bar shows station, level, mode, rail connectivity, demo/live status, close. Six tabs: Overview, Lines, Trains, Cars, Cargo, Upgrades. Preserve selected depot and active tab during the session; Escape closes; map controls and forms must be usable by keyboard.

## Overview
Rail network graph with station names, connected vs disconnected approach, active passenger and freight routes, station selection and network health. Summary counts for connected stations, lines, engines and attached cars. Prominent actionable missing connection: 'North Harbor platform not linked to rail', highlight station approach and suggest track connection. Quick create passenger/freight links.

## Lines
Each line shows its name, passenger or freight purpose, ordered stops, locomotive, car count, service frequency, status and route validity. Create-line wizard: service type, name, origin, destination, locomotive, car count and frequency. Validate distinct stops, rail graph reachability, compatible locomotive/car class, platform length, line availability and treasury in Real/Survival. In God Mode costs are free. Block dispatch on invalid routes with precise fix, never silent.

## Trains
Selectable fleet roster with steam, diesel and electric traction; locomotive with coupled visible wagons; train name and ID; running, ready, maintenance and blocked states; current line; add/remove/reorder compatible cars; allow 1–8 cars initially with level-dependent caps. Respect platform length and siding capacity. Animations should show couplings and turns. Every edit must preview effect and retain undo/cancel before committing.

## Cars
Inventory/catalog: passenger coach, observation, sleeper, grain hopper, coal gondola, refrigerator, livestock, waste, timber, tanker, container and boxcar. Cards show service compatibility, capacity, level and cost; filter Passenger/Freight/All; select train then add cars and see formation change. No invalid mixed formations.

## Cargo
Freight contract cards for farm grain, dairy cold chain, coal supply, landfill waste, timber, fuel and commercial goods. Each shows origin/destination loading platform, required cars, route readiness, temporary boost and nonessential nature of deliveries. Assign to eligible freight line only with connected terminals. No bonus when route is blocked. Never make trains a prerequisite for food, power or waste service.

## Upgrades
Depot level 1–5 progression, platform length, yard tracks, signals, catenary/electric service, freight cranes and sorting. Preview building silhouette and service capacity change before buying. God Mode free, Real/Survival subject to available funds. Preserve original depot ID/position/save.

## Data contract for engine handoff
Depot {id, level, location, railEntryFaces, connectedTrackComponentId, platformCapacity, upgrades}.
Station {id, railAccess, roadAccess, platforms, cargoTerminals, eligibleLineIds}.
RailLine {id, name, service, stopIds[], headwaySec, trainIds[], enabled, validationErrors[], routeSegments[]}.
Train {id, engineId, carIds[], lineId, serviceState, positionAlongRoute, speed, dwellSec}.
Car {id, type, compatibleCargo[], capacity, modelVariant, loadedAmount}.
CargoContract {id, sourceBuildingId, destinationBuildingId, freightTerminalIds, type, requestedAmount, deliveredAmount, temporaryBoost}.
RailNetworkGraph {nodes[], edges[], componentIds[], bridges[], crossings[], blockedSegments[]}.
All edits should use explicit actions, revalidate the graph, emit updated UI state and persist to save slots safely. No fake local 'running' status when actual routing is unavailable.

## Interaction acceptance
- A user can open from a selected train depot and exit without losing selection.
- Passenger line creation requires two reachable stations; missing platform tracks produce clear, actionable errors.
- Three-car train becomes four-car train with visible connected units and corresponding capacity changes.
- Freight contract only activates when cargo terminals, track, rolling stock and path are valid.
- God Mode changes are unrestricted; regular-mode purchases are checked against wealth before commit.
- Mobile landscape fits with horizontal tab scrolling, internal panel scrolling, touch targets and no clipped exit/action.
- Empty city/no rails/disconnected depot state shows an empty-state with track-building actions, not fabricated sample services.

## Build order
1. Implement railway graph and station/depot track faces.
2. Implement train/line/consist model with real validation and save migration.
3. Connect this UI to live selectors/actions; remove demo fixtures.
4. Add passenger paths, schedules and car-following visuals.
5. Implement optional freight contracts and bonuses.
6. Finish level visuals, rail bridges, end-to-end game QA and save tests.

Review visuals before merging. The current codebase still has random single-body trains and no live logistics network.