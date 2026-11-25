# Pixel Civilization time-period design plan

**Review draft · Ten era styles · Ancient Rome pilot**

A player can open the same island in a different era and feel like they are visiting a different civilization. Its streets, roofs, shopfronts, wayfinding, vehicles, and civic monuments all tell a consistent story. Tap an element in the Atlas and the model matches the one on the map, down to its level and variant. Switch eras and keep the island’s construction, services, history, and progress.

This revision defines the artwork, game and learning experience, production waves, and evidence required for approval. Multiplayer stays paused. The Rome prototype, production artwork, and release are future work under this plan.

## 1. Scope and player experience

**Ten packs plus Original.** Original is the default for existing saves and remains available in the picker. WWII is one pack with several regional influences. The historical packs are imaginative settings. Artists can combine recognizable influences across centuries and invent buildings, street details, and names. Use reference boards to make the choices deliberate. Present fictional equivalents as game designs, especially when a historic-looking building performs a modern function.

**One world, multiple appearances.** Add a Time period picker to More → View, new-island setup, and the Handbook and Atlas. Each available pack gets a stage 1 street, a mature skyline, and five representative elements. Preview on the current island and commit the choice with Apply. Switching back restores the original presentation. Find any element by either name, and provide a Show original names option. Existing custom designs use their own artwork and name by default. Log custom elements outside the authored base-catalog coverage total so a completion report is easy to interpret.

**Fixed simulation contract.** A style can change names, stage art, decorative landscaping, materials, model tiers, transit vehicle presentation, sound cues, and visual reactions. Keep canonical IDs, placement domains, supported levels and variants, footprints, rotation, ports, collision and pick behavior, routes, costs, upkeep, unlocks, construction history, and progression. Use a seeded replay to compare outcomes across Original and the new style. Decorative upper levels, balconies, caves, docks, and bridges must leave the canonical travel path and click targets legible.

**Coverage baseline.** The reviewed catalog contains 294 base elements, 20 stages, and 1,534 element-level combinations. With four current Atlas variant slots, the planning ceiling is 6,136 element-level-variant combinations per era, or 61,360 across ten eras, plus 200 stage treatments. These are coverage entries. A reusable recipe can generate many approved entries. Inventory the combinations actually supported by each element and level on the branch chosen for implementation. Validate against catalog functions so exceptions, including roads with 11 levels and bus stops with three, stay visible in the worklist. [Original plan and catalog baseline](https://github.com/FuzzyMediaco/Pixel-Civilization/blob/38d150dab80e072eaadfd5ac5588ee80584fdeb1/docs/design/era-styles.md)

## 2. Ten standalone art briefs

Treat the proposed names below as art direction. During production, pair each with a canonical ID and confirm that the name communicates the gameplay function. Review unnamed silhouettes in a desaturated pass as well as the finished palette.

### 1. Ancient China

- **Shape and palette.** Layer courtyards behind vermilion walls. Use charcoal and jade roofs on common buildings, glazed gold roofs on imperial landmarks, pale stone at gate thresholds, and dark timber brackets at close zoom. Repeat upturned eaves selectively so palaces, homes, and shops have different roof profiles.
- **Street and terrain.** Stone gates frame streets. Canal markets sit on raised quays with cloth banners and plank landings. Bamboo, flowering trees, and sculpted garden stones soften the blocks. Climbing paths, stair-oriented entrances, and shaded retaining walls make hillside sites feel intentional.
- **Progression.** A Walled Courtyard starts with one low wing and a tiled entrance. Its later tiers enclose a garden, add a second wing, and grow into a stacked residential court. A Lantern Canal Market adds awnings, stalls, and loading stairs as it grows. A Gatehouse Passenger Depot gives trains an unmistakable through-platform. Mature landmarks include the Vermilion Imperial Palace, a jade-garden complex, and a hidden mountain fortress with interlocking gates.
- **Lighting, signs, and motion.** Warm lantern clusters mark active shops at dusk. Use distinctive shop plaques and house gates as wayfinding. Boat poles, moving cargo, and rippling banners make trade visible. A palace passage can reveal an open inner court as the camera turns.
- **Recognition test.** A HUD-free silhouette shows enclosed courts, sweeping tiered eaves, a gate sequence, and a mountain fortress. A close street shot distinguishes an ordinary residence from a lantern-lit commercial court by shape and its relationship to the canal.

### 2. Ancient Egypt

- **Shape and palette.** Build low, flat-roof mudbrick neighborhoods against broad sandstone gateways. Use chalk wash, ochre, lapis and turquoise bands, striped linen shade, and fields of river green. Give pylons sloped sides, ceremonial buildings deeply recessed doors, and workshops broad shade roofs.
- **Street and terrain.** Follow river bends with low quays and stepped loading landings. Line main avenues with palms, planted temple courts, and directional posts. Show flood marks and stone embankments where street and water meet. Farmland reads as irrigated strips behind the riverfront.
- **Progression.** A Mudbrick Courtyard gains a granary loft, a shaded upper deck, and eventually a connected residential court. A River Granary Market expands through distinct storage wings and loading bays. A Quay Passage Depot serves the original passenger route with a clear approach and departure path. Mature landmarks include a painted temple avenue, a terraced tomb complex, and a grand river granary. Ordinary sheds and reed-roof houses stay visually strong by the water.
- **Lighting, signs, and motion.** Strong midday shapes give way to cool water and warm temple entry lights at dusk. Give streets painted trade emblems and quays readable landing markers. Animate reed boats, unload events, irrigation flow, and flags where activity warrants them.
- **Recognition test.** Even with monuments out of frame, flat mudbrick roofs, a heavily working river, stepped quays, and green irrigation strips identify the era. In the skyline, ceremonial gateways and long avenues draw the eye inland.

### 3. Ancient Rome

- **Shape and palette.** Use warm terracotta roofs, pale travertine, deep arch shadows, brick service walls, and selective bronze and painted signs. Build a grammar of repeated arches with distinct rhythms for apartments, markets, baths, and aqueducts.
- **Street and terrain.** Give stone streets continuous curbs, drainage seams, and sheltered arcades. Place clipped shade trees, water basins, and planted courtyards at public buildings. Use terraced masonry foundations on steep lots. Keep the route deck and its stone approach visible at every junction.
- **Progression.** A Domus starts as a modest courtyard house. A higher residential tier gains a street-facing arcade, additional stories, and a roof court. A Forum Market matures from an open selling court to a roofed trading hall with service bays. Add a Bathhouse Waterworks, an arched Passenger Terminus, and landmarks such as the Great Forum and a hill-crossing aqueduct. At stage 20, apartment blocks and neighborhood markets still frame the monuments.
- **Lighting, signs, and motion.** Clay roofs catch amber dusk light. Painted stall identifiers, bronze civic plaques, and stone numbers give streets hierarchy. Water runs through an active aqueduct to the bathhouse. Porters, awnings, and lit arcades make the forum feel occupied.
- **Recognition test.** At city zoom, dense brick and terracotta massing is interrupted by wide civic arches and civil engineering that crosses the landscape. From normal zoom, a Forum Market is identifiable by its open bays and a waterworks by its visible channel.

### 4. Ancient Greece

- **Shape and palette.** Favor open terraces, bright plaster, painted column bands, cool blue doors, limestone steps, and warm timber on ships. Roof slopes are low and building volumes leave room for open air. Use light colonnades to frame views rather than filling every lot with a solid mass.
- **Street and terrain.** Stepped hillside streets overlook blue water. Open plazas run between residences. Olive trees, cypress, sculpted terrace edges, and low harbor walls carry the theme across the island. Use simple painted pottery motifs and carved signs along public approaches.
- **Progression.** A Courtyard Oikos grows from a quiet one-court home into a terraced cluster. An Agora Provision Stall becomes an open colonnaded market and gains clear delivery access. A Harbor Passenger Court shows arrival and boarding along a visible quay platform. Late destinations include a hillside theater, a shipyard district, and a hilltop sanctuary that reads in silhouette.
- **Lighting, signs, and motion.** Use bright sun and long, readable colonnade shadows. At dusk use restrained courtyard lights. Open-market shades move with wind, a theater can illuminate during an applicable civic event, and a dock shows ropes and cargo movement when a vessel calls.
- **Recognition test.** From overhead, broad open courts, light terraces, exposed painted columns, and an amphitheater cut into the slope give the era a distinct geometry. Hold the same route layout used in Rome and check that the city still reads airy and coastal.

### 5. Medieval Europe

- **Shape and palette.** Use steep timber gables, smoke-dark beams, warm plaster, weathered slate, and thick stone at mills and public buildings. Reinforce important silhouettes with projecting upper stories, crenellations, banners, and roof pinnacles.
- **Street and terrain.** Narrow streets feel irregular through staggered shop bays, awnings, and stone verge treatments inside the existing parcel edges. Use painted hanging signs, courtyard wells, kitchen gardens, willows by streams, and stone retaining walls below the castle road.
- **Progression.** A Timber Cottage gains a workshop annex, an overhanging floor, and later a shared inner court. A Market Guildhall starts as a timber shelter and develops stalls, signed entrances, and a square-facing façade. A Wayfarer Depot has a clear covered platform behind an arched opening. Grow the skyline toward a fortified center with towers, a hill castle, and a working mill district.
- **Lighting, signs, and motion.** Use warm hearth light, smoky winter-blue shadows, and torchlight at gates. Shop signs swing in the wind. Grain and water jobs drive visible scoop, wheel, or unloading animation.
- **Recognition test.** Tall gables, narrow shadowed lanes, timber grids, and a stone hill keep identify the era before banners or color are apparent. At street zoom, see clearly which buildings are housing, workshops, and markets.

### 6. Renaissance Italy

- **Shape and palette.** Design symmetrical civic fronts, pastel painted plaster, patterned marble, tiled roofs, domes, and loggias. Put emphasis on horizontal cornices, carefully framed windows, and courtyard geometry. Give high-level buildings deliberate façade rhythm.
- **Street and terrain.** Compose long street views toward fountains and civic squares. Bridge workshops show distinct shop openings and pedestrian edges without covering the bridge controls. Cypress, clipped hedges, formal gardens, and canal stairs organize public space. Use painted trade crests and carved street signs.
- **Progression.** A Merchant Dwelling becomes a shop-house with a rear court, then a palazzo-style residential block. A Provision Arcade expands into a market surrounding a square. A Canal Passenger Hall has a clear slip or platform tied to the actual service. Mature sites include a printing quarter, an observatory with a rotating feature, a domed civic center, and a bridge lined with workshops.
- **Lighting, signs, and motion.** Afternoon gold makes stucco and marble distinct. Lantern reflections mark active canal edges at night. Fountains, presses, and craft yards show activity based on their category and operational state.
- **Recognition test.** The view reads as a composed sequence of piazzas, domes, civic axes, and palazzo courtyards. Compare the same river bend with Medieval Europe and Rome. The space between buildings should identify Renaissance Italy as clearly as the palette.

### 7. World War II era

- **Shape and palette.** Make one civilian-industrial style combining Allied and Axis-era regional influences. Use muted brick, rendered masonry, concrete lintels, olive utility paint, cream station signs, and restrained industrial lettering. Regional variants can emphasize terraced rows or perimeter courts. They share road trims, signage hierarchy, colors, and progression.
- **Street and terrain.** Use close curb lines, marked crossings, rail sidings, warehouse yards, canal walls, and utilitarian planting such as street trees and allotments. Build legible transition parcels where one regional block meets another. Use civic, industrial, and railway signs for orientation.
- **Progression.** A Brick Terrace expands into denser residential rows or an enclosed Courtyard Block variant. A Provisions Shop grows from a small ration counter into a staffed supply hall with distribution bays. A Regional Passenger Terminal expands its canopy and track-facing front. Mature landmarks include a coastal shipyard, railway sorting district, radio tower, and monumental civic shelter complex.
- **Lighting, signs, and motion.** Compose dusk with blackout shades, isolated amber windows, and directional platform lamps. Show a bicycle, trolley, rolling cargo, or signal change according to the service. Keep the focus on ordinary life, public works, civil protection, and logistics.
- **Recognition test.** Housing rows, rail yards, utilitarian concrete, restrained signage, and a dark street-lighting pattern identify one cohesive era. Inspect a block containing both regional expressions. Its roads, civic buildings, and utilities should belong together.

### 8. Art Deco metropolis

- **Shape and palette.** Use stepped stone masses, broad windows, precise reliefs, rounded station corners, brass trims, and copper or teal accents. Make crowns, corner entrances, and elevator cores recognizable in silhouette.
- **Street and terrain.** Build avenues with strong curb rhythm, ribbed subway portals, street trees in geometric planters, tiled shop entries, and patterned public terraces. Wayfinding uses lettered marquees, building numerals, and coordinated station graphics.
- **Progression.** A Terrace Apartment grows from a low walk-up to a stepped high-rise with a lit crown. A Corner Emporium expands from a corner shop into a department store with loading courts. A Metropolitan Express Station develops a distinctive canopy and high-volume entry. Let the largest civic hall and signature tower finish a skyline of multiple heights.
- **Lighting, signs, and motion.** Build a deliberate night scene. Light shop marquees, entry canopies, occupied windows, and tower crowns in layers. Train arrivals and foot traffic make station entries feel active. Cap the emissive effect so the street and tools remain readable.
- **Recognition test.** A silhouette pass shows stair-stepped towers and prominent geometric portals. A night street without skyscrapers still reads as Art Deco through its marquees, stone patterns, and rounded corners.

### 9. 3027

- **Shape and palette.** Use interlocking modules, suspended volumes, visible support ribs, light ceramic, dark composite, planting, and a controlled cyan or amber light system. Assign lighting and edge shapes to actual classes of infrastructure.
- **Street and terrain.** Layer the visual city vertically with visible ground entries and preserved canonical travel decks. Put docking arms and station canopies along actual vehicle paths. Perch garden terraces on level parcels and use foundations that follow the slope. Tie signage and pavement cues to transport, utilities, and public services.
- **Progression.** A Habitat Stack starts with a modest pod and evolves into a dense cluster with shared gardens and a transit-facing concourse. A Nutrient Exchange adds delivery bays and a visible conveyor. A Corridor Maglev Terminal gains docks and a larger canopy. Mature landmarks include a climate tower, a sky garden district, and an orbital exchange with a visible vehicle interface.
- **Lighting, signs, and motion.** Use emissive bands where they explain service direction or activity. Animate dock arrivals, loading arms, and utility pulses when the relevant services operate. Give idle and disconnected states their own quieter cues.
- **Recognition test.** Even at low color saturation, stacked streets, suspended transit, exposed cores, and multi-height planting distinguish the future city. From play zoom, the player can still see which deck carries the network and where an element connects.

### 10. Post-apocalyptic

- **Shape and palette.** Show a city regaining confidence. Use galvanized patches, rust, reclaimed timber, repurposed concrete, faded paint, and increasingly bright gardens and fabrics as the city grows. Keep homes, trade, industry, and public services recognizable through distinct shapes.
- **Street and terrain.** Trace old roadbeds with repaired seams, bollards, and painted direction arrows. Use salvaged gantries along rail corridors, stepped embankments at water, and low planters made from reused containers. Hand-painted signs and fabric flags mark civic routes.
- **Progression.** A Salvage Shelter gains a dry roof and workshop, then becomes a vibrant residential block with a shared garden. A Supply Exchange grows from a barter shelter to a repaired depot with stocked lanes. A Reclaimed Rail Station progresses from an improvised platform to a clean working concourse. Mature landmarks include a reclaimed floodwall, a restored mechanical power hall, and a community rooftop greenhouse.
- **Lighting, signs, and motion.** Use warm pockets of light and sparse utility lighting early, then visibly brighter community spaces as services come online. Lift doors, repair benches, rain catchments, and rotating machinery show what the city can do again.
- **Recognition test.** The skyline shows old infrastructure visibly reused alongside newer repaired blocks. A stage 20 view still reads as recovery and reinvention. Compare it with the WWII industrial district and check that layered repairs, improvised structures, and reclaimed planting carry the distinction.

## 3. Turn each brief into an element specification

Create one machine-readable manifest per era, keyed by the canonical element ID. Keep level and variant numbering canonical. Generate the catalog worklist from that manifest and the game catalog. Give each row an art owner, implementation and review status, and evidence links.

| Part of the spec | Required contents and review |
| --- | --- |
| Identity | Era name, original name, search aliases, level names, accessibility description, in-world signage, and Atlas description. Search both names and open the same canonical entry. |
| Geometry and change by level | Silhouette sketch, level-by-level change, standard span and height envelope, doors and ports, connection masks, interaction anchors, and placement on flat, sloped, and shoreline tiles where legal. Check each supported orientation. |
| Variants | A visible design decision per slot. Record distinct geometry, roof shape, façade rhythm, material pattern, or yard layout. Compare the variants on the same level under neutral light. Record exceptional cases where a constrained network piece needs a subtler treatment. |
| Art recipe | Model or deterministic recipe, material and detail modules, authored landmark flags, animation cues, and performance cost. A single approved kit can generate related buildings. Give each functional family a readable silhouette and check repeated blocks across multiple rotations and variants. |
| Surfaces | In-world model, thumbnail, Quick Build view, Quick Edit and Details labels, Atlas mesh and thumbnails, Handbook illustrations, scenario links, and stage art. Render images from the same selected recipe or authored model. |
| Game state | Planned reactions, the actual source state or event, stable anchors and paths, and reduced-motion cues. Show what players can trigger, what they observe, and which decor simply animates. |

**Model detail at three distances.** At the default city view, lead with the roof silhouette, road network, vehicle route, and landmark hierarchy. At normal play zoom, make entrances, signage, service areas, upgrades, and active status legible. At close zoom, add authored detail such as tiling rhythms, patterned lintels, loading tackles, weathered joints, or moving gears. Spend geometry where the camera sees it. Reduce tiny animation and geometry at distance, and keep the important state indicator visible.

**Network art needs its own review.** Test straight, corner, T, four-way, terminus, bridge approach, elevation change, and transitions between road classes. Trace real service paths through stations, ramps, quays, and beds. Compare centerlines and port geometry before and after a theme switch. Show the road, highway, and rail hierarchy with geometry and marking as well as color.

**Connect activity to mechanics.** Derive market deliveries from real supply or freight events, station doors and passengers from arrival and boarding, waterworks flow from service state, and utility repair cues from uptime or maintenance changes. Keep movement bounded inside the visual envelope and away from selection controls. Supply an idle or disconnected appearance and a readable low-motion equivalent. In a test scene, toggle the underlying state and show the corresponding change. Catalog labels should make imagined period equivalents clear. A Roman Celestial Observatory, for example, still exposes the canonical spaceport function in Details and Atlas.

**Use one model pipeline.** The Atlas already calls the game’s `buildDesignAsset` builder and handles joined network examples. Add the era resolver at that shared boundary, carry its key into mesh and thumbnail caches, and retain existing connectivity masks, dimensions, level indexes, and variant slots. Extend the resolver to title and level strings used by Build, Details, goals, notifications, Handbook, and Atlas. Persist an optional appearance key. Unknown or missing keys resolve to Original. Pack assets load on demand and enter the offline cache when downloaded. Publish a pack when its required coverage passes. [Atlas model implementation](https://github.com/FuzzyMediaco/Pixel-Civilization/blob/15e3db5e98014a3c8a03897ad403527b3fb6084e/src/components/AtlasModel.tsx) · [Shared voxel asset builder](https://github.com/FuzzyMediaco/Pixel-Civilization/blob/15e3db5e98014a3c8a03897ad403527b3fb6084e/src/game/voxelArchitect.ts)

## 4. Illustrated Handbook and interactive Atlas

### Atlas

Reuse the standalone and in-game Atlas routes. Open to the selected era and preserve an explicit era override in a shareable deep link. Include era, canonical element ID, level, and variant in the URL. If a comparison changes era, keep the level, variant, camera angle, and framing scale when supported. When a link has an invalid level, show the closest valid level and make the selection visible.

- Each released element and every supported level and variant loads the same themed geometry used in the game. The model supports orbit, zoom, and reset with desktop and touch controls. Use unobstructed controls and show an illustrated fallback with the same era and selection when 3D is unavailable.
- Put the era name, original name, function, footprint, level name, variant, and key interpretation of the upgrade beside the model. Keep a compact original-versus-era comparison and a stepper for successive upgrades. Clearly identify artwork changes and simulation changes.
- Show standalone and joined examples for networks. Add a small number of functional scenes for moving vehicles, water, or repair where animation explains how the element works. Provide pause, replay, and reduced-motion controls.
- Search through either name, link from game Details to the exact current element, and link back to related Handbook lessons. Dispose of old models as the selection changes. On a 320 CSS-pixel portrait screen, selectors and reset must stay within reach without horizontal scrolling. Check keyboard focus, zoom and touch behavior on long lists, and repeated model switches.

### Handbook

Keep the illustrated course usable on its own and embed the Atlas viewer or a deep link at the relevant moment in a lesson. Use the same game renderer and era pack for lesson illustrations, interactive examples, and linked test islands. Make the era selector available in embedded examples and preserve the parent lesson and selected model when returning from the Atlas.

Every era gets a playable starter settlement, working district, and mature city. Teach a common set of systems through places and scenarios distinctive to the era. Each guided exercise uses a practice island with its own reset. Introduce the objective, show the action, let the player try it, and show the outcome.

| Practice exercise | Player action | Evidence of completion |
| --- | --- | --- |
| Read a street connection | Place or orient a building beside a route and inspect access | Street access changes in the simulation and the themed entrance visibly meets the route |
| Dispatch a service | Select a station and follow a real vehicle through a departure and stop | The vehicle uses the real network and the Atlas explains the themed depot and joins at the exact level and variant |
| Inspect a waterworks | Inspect flow or service, then change the relevant supply connection | The visible route or status changes with service, and the lesson explains why |
| Compare an upgrade | Open the current building in the Atlas, compare adjacent levels, then upgrade the practice world | Level, appearance, and genuine stat change agree between game, Atlas, and lesson |

Use the existing Unified Atlas route, Handbook hash routing, and Course Panel as entry points for the shared selection and lesson return path. [Unified Atlas](https://github.com/FuzzyMediaco/Pixel-Civilization/blob/15e3db5e98014a3c8a03897ad403527b3fb6084e/src/components/UnifiedAtlas.tsx) · [Standalone Handbook routing](https://github.com/FuzzyMediaco/Pixel-Civilization/blob/15e3db5e98014a3c8a03897ad403527b3fb6084e/src/handbook/main.tsx)

## 5. Rome pilot and production waves

**Pilot art comparison.** Build the same small block twice with the same parcel layout and default camera. **Forum City** emphasizes bright civic stone, painted shopfronts, open public courts, and long arcade shadows. **Aqueduct City** emphasizes rugged brickwork, heavier terracotta silhouettes, terraced streets, working water channels, and strong vertical infrastructure. Use one humble home, one larger housing tier, a shop, a farm, a waterworks, a power equivalent, a road hierarchy, rail, a crossing, and one late landmark in both directions. Use at least two levels and two representative variants on the pivotal families in this first comparison. Carry the winning direction into full pilot coverage for those families.

| Wave | Work and exit evidence |
| --- | --- |
| **0. Foundation and baseline** | Inventory the catalog, capture Original fixtures, agree on theme schema and stage map, connect both Atlas entry points, and record performance on agreed test devices. Demo switching style on a copy of a save. Show a round trip, bridge port parity, and a deterministic simulation parity report. |
| **1. Rome pilot** | Compare directions in the same playable block. Turn the chosen direction into starter, midgame, and mature test islands. Include difficult slopes, a coast, bridges, mixed networks, and repeated assets. Produce sample Handbook exercises and Atlas paths. Complete two documented redesign passes and present the review package. **Obtain Brigham’s approval before scaling production.** |
| **2. Complete Rome and establish the ancient contrast set** | Finish Rome’s full coverage. Build Ancient China, Ancient Egypt, and Ancient Greece as separate briefs and compare them with Rome in matched layout tests. Approve the flagship landmarks, ordinary streets, and waterfront for each before expanding its kits. |
| **3. European urban styles** | Build Medieval Europe, Renaissance Italy, and Art Deco. Test the same market block and connecting bridge across all three. Check that gabled close streets, formal avenues, and vertical metropolitan massing stay distinct, including when viewed without colors. |
| **4. Industrial and speculative styles** | Build the unified WWII era, 3027, and Post-apocalyptic. Compare the same transit yard and industrial neighborhood across the three. Review WWII regional variants together in one city. Test vehicle alignment, light glare, infrastructure readability, and mobile performance in dense districts. |
| **5. Finish and release per era** | Finish models, stage art, search, names, all interactive previews, lessons, offline download checks, and platform playthroughs. Keep each unapproved era in preview until it passes the gates and receives a release decision. |

Estimate model and review time after the pilot from actual throughput for original landmark art, kit families, levels, variants, and fixture creation. Keep a separate estimate for Handbook and Atlas content, device testing, and revision passes.

## 6. Repeatable visual review and approval

### Required captures and play checks

Use three saved fixtures per era and a canonical set of camera bookmarks. Match build, lighting time, placement, zoom, and viewports between passes and when comparing eras. Record the build identifier, fixture, camera, handset or desktop, and level and variant where relevant. Aim for a starter street, a midgame public and transit district, a shoreline crossing, and a late skyline in each era’s review package.

| Check | Evidence required |
| --- | --- |
| Era identity | A HUD-free wide view, a desaturated skyline, and a same-layout comparison with the two most visually similar approved or proposed eras. Ask five reviewers familiar with the brief to match unlabeled images to the era names. Target four of five correct identifications for the wide and street views separately. Investigate repeated confusion and recapture after revision. |
| Readability | Record whether reviewers can identify a home, market, utility, depot, and landmark from the normal play view. They should identify at least four during the first unaided pass. Verify angles near vegetation and buildings, in daytime and at dusk. |
| Detail and variety | Play-zoom and close shots of adjoining levels, all supported variant slots for selected families, and a repeated block. Run the full catalog through thumbnail and 3D contact sheets, then inspect high-risk families and every flagship in the playable world. A reviewer must be able to point to a specific visible change for each adjacent flagship level and each chosen variant. |
| Placement and interaction | Shots of entrances, slopes, shorelines, intersections, bridge approaches, and vehicle paths. Clip at least one real delivery, transit arrival, and utility change. Play a construction, selection, upgrade, and network-connection sequence on desktop and phone. Log any occlusion, clipping, false connection cue, or effect that looks active during a service outage. |
| Handbook and Atlas | Phone and desktop captures of the same model and selection, a variant comparison, a joined network model, and a practice exercise completion. Test standalone links and the return to the precise Handbook step. |
| Performance | Compare the same dense city and camera path with Original on an agreed mid-range Android phone and desktop browser. Record frame time, memory, first Atlas model time, and asset downloads. Use a proposed gate of median frame time within 15% of Original and at least 30 fps in the measured phone scene. Capture three runs. Agree on memory, loading, and pack-size budgets from the measured pilot before scaling. |

### Redesign cycle and authority to move on

- **Initial pass.** Capture the whole pilot matrix and hold a visual critique. Log issues with era, element ID, level, variant, camera, device, impact, proposed fix, and before capture. Prioritize player confusion and compromised silhouettes first.
- **Revision pass 1.** Fix shape and composition, including identity, network seams, stage escalation, and repetition. Recapture the exact problem views and repeat the unlabeled comparison.
- **Revision pass 2.** Fix close details, operational cues, terrain fit, night readability, and model viewer behavior. Retest performance and practice lessons. Follow the same two-pass minimum for the visual review of each subsequent era. Repeat targeted passes while a gate still fails.
- **Pilot approval.** Present the two initial directions, chosen direction, paired after captures, a short playable tour on phone and desktop, the Atlas and Handbook demo, and the decisions that need Brigham’s sign-off. Include where the team deliberately took creative liberties. Production scaling follows that approval.
- **Per-era release gate.** Require 100% validated catalog, level, variant, and stage coverage for the release pack, no unresolved high-impact visual or usability defects, measured performance within agreed budgets, passed save and simulation parity checks, and sample replays on both platforms. Each approval names the exact preview build reviewed.

### Example review entry

*Illustrative example for the planned process. The measurements below are proposed review evidence.*

| Field | Example |
| --- | --- |
| Where | Rome · Forum Market · level 3 · variant 2 · midgame forum fixture · normal play zoom · 390-pixel mobile viewport · dusk |
| Before | The market is a solid terracotta rectangle with tiny arch cutouts. Its roof matches nearby Domus blocks, its entrance is hidden under the façade, and a supply delivery produces no visible change. |
| Redesign | Break the roof into unequal wings around a visible selling court. Enlarge three street-facing arches, bring lower striped awnings to the arcade edge, and add a marked loading bay aligned to the canonical access anchor. At the actual freight delivery event, crates move into the bay and occupied stalls light up. |
| After check | Repeat the camera and light. In a mixed block, four of five viewers should identify the market without labels. Test all four rotations, compare levels 2 and 3 and variants 1 through 4, and toggle supply in the same scene. The new court is visible at normal zoom, the path remains clear, idle stalls quiet down, and the matching Atlas model shows the same roof and loading bay. Record paired images, the clip, and the mobile frame-time comparison before closing the issue. |

## Review decisions

Approve the ten briefs as a direction, including the unified WWII style and imaginative historical treatment. For the Rome pilot, approve the winning architectural direction after the two revision passes, along with the density of visual detail, the canonical readability checks, and the first Handbook and Atlas experience. Use measured pilot evidence to set asset budgets and the production schedule.
