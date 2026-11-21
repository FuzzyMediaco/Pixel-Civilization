# Handoff: security_maritime (security.ts + maritime.ts)

Status: all 18 ids are DONE. They are registered and typecheck clean, and I checked each one in the gallery at Lv1-5 x V0-3. I also did a night pass on a sample.

## Security (src/game/designs/security.ts)
| id | footprints | levels | variants |
|---|---|---|---|
| police_precinct | 1x1,1x1,2x1,2x2,2x2 | Beat Cop Booth / Corner Police Station / Neighborhood Precinct / Precinct House & Motor Pool / Blue-Lantern Grand Precinct | Brownstone, Frontier Sheriff (false front, gold star), Modern Community (white/glass/blue), Tudor Bobby (Lv1 = blue police box) |
| jails | 1x1,1x1,1x2,2x2,2x2 | Drunk Tank / Town Lockup / County Jail / Detention Center / Lockdown Max Block | Wild-West sandstone, Victorian crenellated brick, Brutalist concrete, Log stockade |
| police_departments | 2x2,2x2,2x3,3x3,3x3 | City Police HQ / Metro PD / Police Plaza / Central Command Tower / Air-Unit Police HQ | Art-Deco setbacks, Blue-glass modern, Brutalist, Neo-classical colonnade |
| prisons | 2x2,3x2,3x3,4x3,4x4 | Work Camp / State Penitentiary / Walled Correctional / Max-Security / Legendary Fortress | Gothic stone, Modern supermax (razor fences), Alcatraz rock (lighthouse), Panopticon round blocks |
| military_base | 2x2,3x2,3x3,4x3,4x4 | Outpost Camp / Fire Base / Army Garrison / Fort w/ Training Grounds / Command Fortress | Woodland, Desert, Arctic, Jungle stilt huts |
| naval_base (coast) | 2x2,3x2,3x3,4x3,4x4 | Coastal Patrol Station / Naval Pier / Naval Station / Fleet Harbor & Dry Dock / Grand Fleet Naval Base | Modern grey, WWII dazzle+brick, Tropical white, Nordic red timber |
| swat_team_hq | 2x2,2x2,3x2,3x3,3x3 | Tactical Unit Garage / SWAT Station / Training Center / Tactical Ops Compound / Elite Counter-Terror HQ | Black/yellow, Navy/white, Urban grey/orange, Olive tactical |
| airforce_base | 2x2,3x2,3x3,4x3,4x4 | Airstrip / Air Station / Air Base / Strategic Air Base / Stealth Wing Command | Modern grey, Desert, WWII prop field, Stealth black w/ cyan |
| submarine_base (coast) | 2x2,3x2,3x3,4x3,4x4 | Sub Tender Pier / Submarine Pens / Fortified Sub Base / Nuclear Sub Base / Deep-Strike Sub Fortress | WWII ribbed bunker, Cold-War red stripe, Modern steel arched pens, Mountain lair |

## Maritime (src/game/designs/maritime.ts; also exports the hull/jet/heli/radar helpers that security.ts uses)
| id | footprints | levels | variants |
|---|---|---|---|
| docks (coast) | 1x1,1x2,2x2,2x3,3x3 | Fishing Pier / Bait-Shack Jetty / Harbor Marina / Bustling Wharf / Lighthouse Ferry Terminal | New England, Tropical, Industrial, Mediterranean |
| boats | 1x1,1x2,1x2,1x3,2x4 | Rowboat / Little Fishing Boat / Deep-Sea Trawler / Passenger Ferry / Grand Cruise Liner | Harbor classic, Retro red, Tropical teal, Ocean-liner navy |
| sail_boats | 1x1,1x2,1x2,1x3,2x3 | Dinghy / Sloop / Gaff Schooner / Brigantine / Three-Masted Tall Ship | Yacht-club white, Varnished wood, Pirate black, Regatta rainbow |
| speed_boats | 1x1,1x1,1x2,1x2,2x3 | Jet Ski / Runabout / Cigarette Racer / Flybridge Cruiser / Helipad Megayacht | Racing red, Black & gold, Miami pink/teal, Riva mahogany |
| ship_building_areas (coast) | 2x2,2x2,3x2,3x3,3x3 | Boatwright's Slip / Timber Slipway / Twin Slipways / Shipwright Works / Grand Launch Yard | Timber, Viking, Steel (sparks), Junk yard |
| shipyards (coast) | 2x2,3x2,3x3,4x3,4x4 | Repair Dry Dock / Graving Dock / Gantry Dock Yard / Twin-Goliath Shipyard / Mega Shipyard | Yellow cranes+cargo ship, Red cranes+LNG tanker, Blue cranes+cruise hull, Orange/green+warship |
| naval_vessels | 1x1,1x2,1x3,1x4,2x4 | Patrol Boat / Corvette / Frigate / Destroyer / Dreadnought Battleship | Haze grey, WWII dazzle, Coast-guard white, Stealth charcoal |
| submarines | 1x1,1x2,1x3,1x4,2x4 | Mini-Sub / Diesel Attack Sub / Nuclear Hunter-Killer / Ballistic Missile Sub / Twin-Hull Leviathan | Modern black, WWII U-boat, Yellow Submarine, Steampunk Nautilus |
| aircraft_carriers | 1x2,1x3,2x3,2x4,3x4 | Seaplane Tender / Escort Carrier / Fleet Carrier / Supercarrier / Nuclear Supercarrier (angled deck) | Modern grey, WWII wood deck, Royal Navy ski-jump, Neon stealth |

## Known issues / next steps
- The coast elements (docks, naval/sub bases, shipyards, slipways) always put land at -z and water at +z. They do not know which side the real coast is on.
- Submarine base V2 Lv5 is about 32k voxels because of solid barrel roofs. It is still under the 40k cap.
- Moving rotor parts (searchlights, radars, helicopters, propellers) are untested in the live game. I only saw them still in the gallery.
- Small polish left: Lv1 and Lv2 of the precinct (V0-V2) look alike, and the military base barracks are hard to see in V0.

## Resume
```
./scripts/gallery-server.sh
node scripts/shoot-gallery.mjs "cat=security&ids=prisons,military_base&mode=full&cell=280" out.png
node scripts/shoot-gallery.mjs "cat=maritime&ids=boats,naval_vessels&mode=full&cell=260&water=1" out.png
npx tsc --noEmit 2>&1 | grep -E "designs/(security|maritime)"
```
