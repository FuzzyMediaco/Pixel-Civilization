# Pixel Civilization | Google AI Studio Builder prompt

Implement this update in the existing **Pixel Civilization** app. Work in the actual game code and deliver a playable build with polished menus, voxel-resolution land and water, terrain-aware element placement, and a larger, more balanced build catalog. This brief includes my original notes verbatim at the end. Every feature in those notes is part of the request.

## 1. Start from the existing game

The source review used [FuzzyMediaco/Pixel-Civilization at commit `2fe5caf825bff49b31ff33925c5a18cffaacd349`](https://github.com/FuzzyMediaco/Pixel-Civilization/tree/2fe5caf825bff49b31ff33925c5a18cffaacd349). If the AI Studio project is on a newer revision, inspect the live files and carry the behavior in this brief forward against that revision. Start with the React/Vite game entry in `src/main.tsx` and `src/App.tsx`, the Three.js world renderer, and the current test suite. The repo also contains older handoff/review notes and a separate `client/` tree. Follow the imports from the running entry points before touching parallel implementations. Reuse the game's components, state, world data, construction rules, and art direction.

| Area | Existing implementation to inspect |
| --- | --- |
| Menu routing and focus | `src/App.tsx` owns sheet, height, navigation, keyboard shortcuts, quick rings, placement, and HUD visibility. `src/components/BottomNav.tsx` currently lists Build, Layers, City, Transit, and More. |
| Shared sheets and menu styling | `src/components/ui/BottomSheet.tsx` has peek, half, and full heights, pointer-based stepping, and a dedicated title/close/expand row. See `src/components/ui/ui.css`, `src/styles/interface.css`, and panel-specific styles. |
| Build flow | `BuildSheet.tsx` has a Suggested default, search, category icons, Works, and catalog cards. `QuickBuildRing.tsx`, `SelectionRing.tsx`, `Hud.tsx`, `quickBuildTree.ts`, `adaptiveQuickBuild.ts`, `adaptiveQuickDrawer.ts`, and `quickMenuPrefs.ts` support the quick menus. |
| City and Settings | `CitySheet.tsx` has Issues, People, Money, and Goals. See `CityEconomyPanel.tsx`, `CityReport.tsx`, and `game/cityEconomy.ts`. `TransitSheet.tsx` composes mobility and engineering controls. Settings lives inside `MoreSheet.tsx` today. |
| Terrain and water | `src/game/voxelCore.ts` defines a 4-unit tile and 16 voxels per tile edge, so a voxel is 0.25 world units. `terrain.ts` stores edited terrain at tile resolution and handles engineering strokes, placement-driven landforms, hydraulics, and navigable water. `coastline.ts`, `engineeringView.ts`, and `worldRenderer.ts` handle related render and sampling paths. |
| Placement, saves, and examples | Inspect `simulation.ts`, `App.tsx` call sites of `applyLandformPlacement`, `constructionHistory.ts`, `activeIsland.ts`, `saveSlots.ts`, `exampleWorlds.ts`, `pixWorldActions.ts`, and `autoCivilization.ts`. Look for additional construction callers, mode-specific persistence, previous terrain versions, and prepared worlds. |
| Catalog and visuals | `catalog.ts` combines base and expansion definitions. Inspect `designs/index.ts`, `designs/registry.ts`, `levelSpans.ts`, `designStyles.json`, `voxelArchitect.ts`, and parcel geometry and edge helpers. Relevant art includes `designs/landforms.ts`, `designs/nature.ts`, `designs/wetlands.ts`, `designs/water.ts`, and both Spaceport registrations in `designs/projects.ts` and `designs/projectsFuture.ts`. |
| Companion interfaces and verification | `src/handbook/`, `field-guide.html`, `handbook.html`, the gallery, `scripts/render-handbook.mjs`, `scripts/sync-expansion-handbook.ts`, `scripts/review/`, and `tests/` provide catalog, instruction, and verification entry points. Update affected references and assets. |

Before editing, run the game, map how each screen is actually reached, record a baseline for the current catalog and legacy saves, and note any pre-existing test failures. Then implement the feature in the phases below. Deliver the playable changes through the existing entry points.

## 2. Compact Build and gesture-driven menus

### Build at its default height

- Open Build at peek height by default. On phones, a full first row of element icons or cards must be visible immediately with their labels and essential status. Current peek sizing is capped at `min(26dvh, 236px)`, the grid uses three columns by default, and cards have a 92px minimum height and 42px art. Allocate the space across the grip, search, category strip, and cards together. Adjust height when a viewport requires it.
- Remove the large separate “Suggested” header, its X, and its expand button. Suggested remains a working starting category. Integrate the grip and utility controls into the search area, or place a simple, small title with a subtle shadow just above the row. Use a compact equivalent on sheets that have tabs or controls instead of search. Keep context that helps the player, such as the active category, money or Free status where relevant, and a real Back action for nested content.
- Shrink the visible art and card chrome, keep names readable, and tune columns, spacing, and row density by width. Keep touch targets generous, aiming for 44 CSS px where the layout supports it. Preserve search, Clear search, filters, custom items, lock and affordability state, element selection, tutorial highlights, and Works. For longer descriptions, keep essentials in the card and expose the rest through an accessible detail or focus path. Keep extra catalog rows scrollable at peek and easy to browse at half and full.
- Check default Suggested, each category, All, filters, empty and populated searches, focused mobile keyboard, free and priced modes, locked and unaffordable results, and orientation changes. In very short landscape layouts, a compact complete row or equivalent reachable arrangement should still be obvious.

### Shared motion and input

- Every bottom menu should rise smoothly into view, follow a finger or mouse drag, and settle into peek, half, full, or dismissed. A deliberate downward swipe from peek closes it. From a taller state, a short drag can collapse one snap and a strong, deliberate swipe can dismiss. Upward drags expand. Support spring-like settling or easing with tunable thresholds. Keep menu motion consistent across Build, Layers, City and nested Transit, Settings, More, Inspector, Works, and other bottom-docked tools.
- Keep exit motion visible by retaining the outgoing view for the transition while immediately removing it from hit testing and tab order. Handle rapid reopen, repeated taps, switching tabs mid-animation, interrupted swipes, changes of orientation, and pointer cancellation. Keep logical focus, visual state, and hit testing in sync. Prefer transform and opacity for entrance and exit and update drag position without re-rendering the game on every pointer event.
- Put the swipe affordance in a small grip or safe gesture area. Let the scroll body take normal scroll. A downward drag beginning over scrollable content can become a dismissal when the content is at the top and the motion clearly indicates intent. Avoid capturing search text, sliders, lists, horizontal chips, swipes on the game canvas, orbit gestures, or placement taps. Releasing outside a panel must never also place, erase, or select an element.
- Replace routine X controls with the gesture and compact access paths such as Escape, a keyboard-operable grip using arrows, an invoker toggle when visible, and an accessible dismissal action for assistive technology. Respect reduced motion with an instant or brief fade path, restore focus to the invoking control or its visible equivalent, and retain explicit Cancel/Back for confirmations and multi-step tasks. Keep modal focus trapping and guard unsaved changes where already supported.
- Use a matching motion style for top HUD/dropdown menus, small anchored menus, and dialogs. Let a top-anchored control open from its own edge or origin. Menus anchored to a tile retain their spiral. Keep fade, easing, duration, focus handling, and reduced-motion treatment coherent across the game. As starting values, try roughly 180–260 ms for sheet entry/exit and a shorter, lower-distance chrome transition. Test the feel on a phone.

### Coordinate the quick menus and surrounding chrome

- Keep the existing spiral reveals for Smart Build, Quick Build, Exact Build, and Quick Edit/SelectionRing. When a spiral opens, have the HUD, bottom nav, and any eligible surrounding menu subtly shift away and fade during the same opening interval. Coordinate both from the same logical transition so chrome does not blink out before the spiral begins.
- While the ring owns the interaction, the outgoing chrome must stop intercepting input. When it closes, restore the appropriate chrome and any menu state that the current flow intends to resume. Preserve intended dismissal when placement, selection inspection, or an explicit navigation takes over. Verify the immediate build-to-Quick Edit handoff, branch changes, tapped tiles near screen edges, bulk selection, cancel, opening a second ring, keyboard Escape, and the top-right adaptive and manual drawer. Avoid replaying the entire HUD transition at each Exact Build step.
- Give menus and the canvas a clear input priority. Keep tutorial focus, mode-dependent restrictions, user-configured drawer items and edit order, ring accessibility, existing branch navigation, and the unobstructed map. With reduced motion, silently switch visibility and interaction ownership in the same state update.

## 3. Make all menus visually cohesive and improve City, Money, and Transit

Walk through the actual game on phone and desktop and inspect each visible state. Include top HUD/stats, top-right drawer and customization, all bottom nav homes and subpages, Build and Works, Layers and filters, every City subtab, Transit and rail detail, More pages, Settings groups, inspector/Quick Edit, placement bars, notices, Saves, example islands, Pix, onboarding/tutorials, confirmations, and in-game Handbook/Atlas. Review the Field Guide, Handbook, and gallery routes for shared styles and affected navigation text. Use the existing Pixel Civilization typography, colors, and island backdrop. Standardize spacing, type hierarchy, glass/translucent treatments, contrast over terrain and water, focus/selected states, safe areas, compact buttons, lists, and scroll behavior. Remove duplicate headings and idle bars. Keep wording concise and controls discoverable.

### Navigation structure

Use **Build · Layers · City · Settings · …**. Make Settings a direct nav destination using the current Settings content and preference store. Make the More ellipsis visually smaller than the four primary tabs through its treatment and optical size, with a usable touch target and accessible name. Keep the rest of More reachable.

Add **Transit** as a visible City subtab alongside Issues, People, Money, and Goals. Extract or reuse Transit content so City has one sheet, one header, and one scroll owner. Keep transit routing, operators, line planning, stops, dispatch, bridge/harbor controls, and Rail Operations. Route existing HUD, inspector, map, example-island, keyboard, and tutorial links to City → Transit and preserve target-line selection or return context. Carry the current Transit shortcut to the new destination unless there is a collision. Update Settings entry points, existing More → Settings callers, HUD customization links, labels/ARIA controls, tutorials, guide instructions, and navigation tests. Verify each game mode, including progressive tutorial navigation.

### City tabs

| Tab | Preferred presentation and behavior |
| --- | --- |
| Issues | Put actionable issues and severity first, group them logically, show the growth constraint and service needs clearly, and keep each Fix shortcut connected to the right filtered build view, layer, or action. Keep the safety view and Survival auto-maintain. |
| People | Lead with population, capacity, and happiness, then show the biggest drivers and relevant details such as households, jobs, or services when available. Preserve the existing drill-downs and selected-site focus. |
| Money | Give spendable funds/treasury, City Wealth, and net cash flow distinct names and visual weight. Use the game's exact definitions and units. In the first viewport, answer what I can spend, whether I'm gaining or losing money, and what's driving it. Put income, costs, upkeep, taxes, and transactions or account detail in expandable groups backed by existing selectors. Use real simulation history for any trend. Show readable currency, sign, time window, and missing-data states. Keep tax rules and effects, fees/costs, grants, transfers, balances, economy progression, selected-site accounts, and God controls wherever currently available. Avoid conflating treasury balance with wealth unlocks or silently changing game balance for a visual redesign. |
| Goals | Lead with next stage, requirements, and progress. Organize stages, trends, trophies, and rules underneath. Handle God mode, a fresh city, and max-stage or completed states. |
| Transit | Lead with existing services, health, and the next clear action. Group rail, road transit, and water transit where there is enough content. Keep route editing, validation, empty states, map focus, selected line, return from map targeting, rail details, and relevant engineering shortcuts accessible. |

Use the same hierarchy for intermediate and large screens. Review dense, empty, locked, warning, keyboard-open, and long-scroll states. Reuse CityEconomyPanel or its proven computations, with focused layouts for each City subtab so several copies of overlapping navigation or reports do not crowd the first view.

## 4. Put land and water on the same voxel grid as element art

### Actual editable geometry

- Treat the existing 4-unit tile as a parcel and simulation envelope. Expose **16 × 16 independently addressable horizontal terrain columns per tile**, with height steps at the canonical **0.25 world-unit voxel pitch** where editing or generated landforms use the voxel lattice. Land treads, banks, seabed, and which subcells are wet must be editable at that scale. Keep connected water physically coherent so neighboring wet subcells form a credible surface. Preserve slopes, flows, locks, and lifts where the current water system supports them. A single brush edit should visibly and functionally affect one column at the finest setting.
- Use a versioned, deterministic coarse-to-fine representation with sparse edited patches or chunks. Sample existing natural terrain and legacy edited cells where fine data is absent. Canonicalize coordinate conversion using the shared constants and test negative coordinates, shared tile edges, boundaries, mixed land/water parcels, and rotated footprints. Derive the coarse classifications current simulation systems need through a consistent adapter. Keep parcel IDs, save compatibility, road and rail topology, costs, and example islands functioning.
- Build a shared terrain sampling path for material, height, dry/fresh/salt state, depth, and water surface at a world position. Use it for rendered terrain, shoreline/foam and water masking, raycasts, brush hover, preview, support and grade checks, structure placement, walk and drive surfaces, and relevant water access/clearance. Make the coarse consumers use meaningful edge or footprint samples when a mixed tile would otherwise give an incorrect result. Document the aggregation choices and where the simulation still resolves per tile.
- Support local visual refresh immediately after an edit. Cache deterministic natural terrain, remesh dirty chunks plus neighboring seams, batch repeat geometry, reuse resources, and dispose superseded buffers. Use view distance or level of detail if needed while keeping authoritative fine data. Keep ocean continuity, shore foam, depth colors, water effects, docks and hulls, and the visible horizon intact. Use performance measurements on a developed city and a large brush stroke to catch excessive rebuilds or memory growth.
- Route new fine state through every relevant save, reload, clone, example-world, undo, and snapshot path. Legacy worlds should open with the same placements and familiar overall coastline, including previously edited land, water, crossings, and waterways. Migrate or inherit old terrain deterministically on first write. Preserve older undo records where supported; avoid replaying old element stamps over player edits during load.

### Better land and water tools

Build on the current Works panel and planning/commit flow. Provide compact tool groups and a visible brush or path preview before any committed edit.

| Tool family | Player behavior |
| --- | --- |
| Sculpt | Raise, lower, smooth, flatten to sampled height, sharpen edges, and paint material. Offer a one-voxel precision mode plus larger brush sizes and strength/falloff for natural hills, valleys, slopes, terraces, and mountain crests. |
| Shape | Draw mountain ridges, valley and gorge paths, canyon walls, or coastal shapes with width, depth/height, and edge blending appropriate to each tool. Use drag and interpolation so fast strokes leave continuous results. Offer a precise tap for touch users. |
| Water | Create and shape ponds, lakes, rivers, canals, bays, peninsulas, and springs. Show expected depth/wetness, reach, flow direction when available, and which connections will change. Preserve current dam, gate, lift, and bridge functionality. Test freshwater containment/outflow, ocean reconnection, and dry shoreline transitions. |
| Inspect and apply | Display the affected area, width/radius, elevation or depth changes, affected assets, cost where applicable, and specific invalidity reasons. Let the player cancel without changing state. Apply each accepted stroke atomically and make it undoable as one action including reflow and tracked cost. |

Keep current mode/stage permissions, cost and refund rules, occupancy and critical infrastructure checks. Default to safe behavior around occupied parcels and network links. Route deliberate changes through existing replacement/validation behavior with a clear preview. Retain camera, pan, and zoom controls through touch gestures and desktop pointer/keyboard input.

## 5. Make terrain-aware elements part of the actual world

### One placement contract

- Replace the current coarse-only behavior of `applyLandformPlacement` with a shared terrain interaction planner that works in preview and commit. The current method maps Beaches and Deserts to paint, Hills to raise, and other landforms to bulk tile tools. Define data-driven behavior for placement intent, foundation/stamp shape, edge blending, wet/dry transitions, supported anchors, and restrictions. Use consistent inputs including element ID, level, variant, orientation, real footprint, and surrounding terrain.
- Separate world terrain shape and materials from model decoration so a parcel does not draw a second slab or fake sea on top of the real surface. Level and variant must control both the composed outline where appropriate and the recognizable accessories. Use stable seeds and local coordinates so reload, repeat previews, rotations, and thumbnails are consistent. Keep standalone atlas/gallery artwork readable with an isolated preview context.
- Route Build, Smart/Quick/Exact Build, and applicable Pix/auto-building paths through the same rules. Match the hovered preview, placement validation, affordability, and committed result. Plan building and terrain edits together, verify them against current state, then commit once. Handle move, rotate, upgrade/footprint growth, swap style, demolish, bulk edit, restore, and undo. Prevent double-applying relative elevation. Track or compose changes so an edit to an element does not roll back overlapping manual sculpting or another element. Keep undo transactional and define the removal behavior clearly. For deliberate earthworks, persistent reshaping can be appropriate, with a preview or clear feedback and a recoverable undo path.
- Handle ground and water integration across the catalog according to how each element actually works. For every family, decide how it should meet the surface and whether it stamps material, changes grade, needs visible supports, needs shoreline access, or has no earthwork. Prefer small, local changes that strengthen the visual composition and preserve nearby roads, rail, buildings, water links, and other placement rules.

### Behaviors to build and playtest

| Element or family | Required result |
| --- | --- |
| Beaches | Finding a real coast and placing a Beach should reshape that shore in the world. Draw a graded transition from inland material into dry sand, wet sand, and shallow water. Match real water height, contour, and foam so adjacent tiles read as one coast. Place level/variant-appropriate art such as chairs, umbrellas, paths, or beach facilities on plausible dry anchors. Rotate or auto-align along the shoreline, keep coastline changes small and local, and show a clear placement reason at invalid locations. Where compatible with existing rules, adjacent beaches blend into one continuous shoreline. |
| Deserts, sand, and dunes | Extend the chosen sand/rock palette into neighboring terrain with intentional transitions and light sculpting where the model calls for it. Anchor details on the sculpted surface. Keep standalone sand art or props on top of local ground where they are decorations. |
| Hills, mountains, canyons, and gorges | Build the rise or cut into the real land. Blend the perimeter into the neighbors, keep the voxel profile crisp, and ground rock, trees, paths, cliff detail, and any water feature in the generated contour. A canyon should actually be lower and readable from more than one camera angle, with path/water sampling agreeing with the shape. |
| Rivers, lakes, ponds, canals, and wetlands | Form usable banks, bottoms, inlets, and outlets. Anchor water level, edge decorations, and land/water transitions to actual water. Preserve existing hydraulics and vessel clearance. Neighboring water and terrain should meet without obvious duplicate planes, gaps, or overlapping square borders. |
| Roads, rail, docks, bridges, harbor, farms, buildings, parks | Grade a local approach or pad where useful, conform paths and landscaping, carry network seams across adjacent parcels, match dock decks and piles to water, and keep bridges over genuine clearances. Keep grade and footprint validation for steep, obstructed, or unsupported locations. Use a visual contact treatment or real supports when these suit the element. |

Test coast directions and diagonal/corner shorelines, a flat site, steep slopes, neighboring edits, all levels and style variants for focal elements, mixed land/water footprints, camera angles, day/night, moving and rotating elements, undo, and reload. Use the example islands to compare reclaimed shorelines, operational harbors, bridges, and built-up districts.

## 6. Remove meaningless platforms and expand the catalog by addition

### Ground the art

- Audit every built-in element visually in the gallery and on the live island where grounding, water, and terrain seams can be judged. Use the design registry to find shared base helpers and check levels and variants. Record which elements have a meaningful foundation, useful terrain treatment, support requirement, or unnecessary slab. Fix unnecessary slabs across the catalog.
- **Spaceport is required at every supported level and variant.** Inspect `designs/index.ts` load order and the effective Spaceport registration in `projectsFuture.ts`; the earlier `projects.ts` also contains a Spaceport builder. In the registered art, remove the all-parcel platform impression around `lot(...)` and integrate the apron and access into actual terrain. Preserve the purpose-built launch pad, flame trench, roads and paths where relevant, gantry, launch mount, rocket, operations, effects, orientation, and level progression.
- Keep functional decks, piles, structural foundations, plazas that serve a purpose, raised roads and rails, flood defenses, and other visually justified supports. Where a generic art helper lays down a solid ground plate, use terrain/material painting, a locally fitted footprint, or a small structural support as appropriate. Verify asset anchoring, selection rings, previews, entrances, occlusion, and sidewalks after removing artificial bases.

### Balance the catalog and Exact Build together

The reviewed catalog exports **270 built-in definitions**. The Exact Build audit reports zero missing, unknown, and duplicate IDs. These counts come from the catalog at the reviewed Git commit. Recompute them if the AI Studio checkout has changed.

| True catalog category | Count | True catalog category | Count |
| --- | ---: | --- | ---: |
| Housing | 14 | Roads & Transit | 23 |
| Commerce | 36 | Farms & Food | 26 |
| Power & Waste | 15 | Water | 10 |
| Civic & Parks | 24 | Police & Military | 43 |
| Faith | 8 | Maritime | 14 |
| Nature & Land | 20 | Landmarks | 15 |
| Wealth Projects | 22 | | |

There are 222 land, 21 coast-or-water, 16 any-domain, and 11 water definitions. The separate starter flag matches 12 items, even though the category metadata still uses the label “Starter 10.” Check what the Build sheet actually shows before changing any starter labels or filters. Counts point to Water and Faith as the smallest true categories, with Housing and Maritime next. They also expose a real planning constraint. Equalizing every true category to 43 would add 289 definitions, which is well beyond the 24 empty slots in the current Exact Build tree. Aim for materially closer category counts with meaningful additions, and redesign the tree deliberately when the required additions exceed its current capacity. Prioritize sparse roles and a better land/water mix while keeping menu paths quick to learn.

1. Produce before counts from the running `ELEMENTS` and `CATEGORY_META`, by true category/type, placement domain, stage or unlock, and Exact Build parent/leaf. Include all built-ins, and identify filtered views such as Suggested, Starter, All, Works, and Pix Custom so they are handled deliberately. Keep the Starter experience curated and player-generated entries intact.
2. Preserve **every existing element** and saved ID. Add genuinely distinct, visually developed elements to underrepresented categories and gameplay roles. A new entry needs an understandable purpose, placement domain, cost/stage or wealth unlock, icon, art, level style and footprint behavior, and handbook/guide information in the same standard as existing elements. Tune the gaps by function and progression as well as raw counts. Example candidates to validate against the catalog include a beach access stair, contour orchard, spring-fed wetland crossing, watershed park, shoreline overlook, neighborhood market hall, or transit transfer shelter. Pick additions based on actual gaps and skip concepts already served by existing entries.
3. Keep Exact Build fixed and predictable. The checked-in tree has **7 parents × 7 leaves** with **4–6 items per leaf**. Its explicit lists contain 270 entries across parents with 38, 39, 41, 36, 37, 42, and 37 assigned entries in order. These are tree counts from the reviewed revision. Recompute against the current catalog and classify Pix Custom separately under the existing custom-element policy. Filling all existing leaves to 6 would yield 42 per parent and up to 24 more placements in the existing tree. Prefer filling meaningful gaps within that capacity first. If the catalog needs more, adjust the tree and tests deliberately with readable grouping, manageable choices on mobile, stable parent IDs and preference migration, and a clear path to every built-in. Maintain the four-tap flow where feasible. Prefer balancing genuine categories and reachability over introducing filler just to fill every slot.
4. Update registered definitions, level span and variant data, thumbnails and handbook assets, Build search and filters, Exact Build navigation and associated tests, Adaptive recommendations when relevant, and tutorial/handbook references for changed paths. Validate `auditDecisionTreeCoverage()` against the final catalog with zero omissions, duplicates, or unknown IDs and valid representative icons. Preserve context-aware placement/depth, lock, affordability, and mode behavior. Verify Pix Custom and the three fast-builder modes still work end to end.
5. Report after counts by true catalog category and Exact Build branch, with added IDs and roles and any remaining intentional asymmetry. Preserve common paths and saved ordering where possible. Explain design decisions that change the shape of the tree.

## 7. Implementation order and definition of done

At the reviewed commit, the source compiled with `npm run lint` and the production build passed. The baseline test run passed 453 of 454 tests. The existing failure is the mode-specialized Playbook check in `tests/expansionAndAutoCiv.test.ts:94`, which expects three extra chapters and observes four. Recheck the baseline in AI Studio and validate the intended chapter count when updating the guide. The baseline menu details above come from source review. Capture the on-device or browser visual baseline during implementation.

1. **Baseline and navigation.** Capture representative phone and desktop views, map entry points and existing modes, and audit the live catalog. Implement shared sheet/gesture behavior, compact Build, ring choreography, and City/Settings/More routing. Run the interface and quick menu checks before moving on.
2. **Terrain precision.** Add storage, coordinates, edit planning, sampling, rendering, and migration as one playable vertical slice. Demonstrate single-column editing, one hill/valley path, one freshwater case, and one real shoreline. Extend coverage to the other tools and verify network and placement compatibility.
3. **Terrain-aware placement and art.** Make Beach, Desert, Hill, Mountain, and Canyon work end to end first, including preview, placement, style/level changes, undo, and save/reload. Extend to the broader catalog and complete the platform audit. Add and register the balance entries, then verify Exact Build.
4. **Integrated QA.** Run `npm run lint`, `npm test`, and `npm run build` with the project's supported dependency/runtime setup. Reuse `tests/interface.test.ts`, `tests/engineering.test.ts`, `tests/construction.test.ts`, `tests/constructionHistory.test.ts`, `tests/economy.test.ts`, `tests/quickBuildTree.test.ts`, `tests/adaptiveQuickBuild.test.ts`, `tests/adaptiveQuickDrawer.test.ts`, and example world, rail, mobility, and handbook tests. Add focused regression coverage for behaviors the current tests miss, especially voxel coordinate seams, migration, transactional landform undo and preview parity, and final catalog membership.
5. **Playtest the normal controls.** Use a narrow portrait phone (approximately 360 px wide), a larger phone, landscape, and desktop. Check touch, keyboard, mouse, reduced motion, focus, screen reader labels, viewport insets, scroll, and quick repeated navigation. Use fresh and developed worlds plus at least one pre-change save. Run a Before/After check on representative menus, Spaceport, a continuous beach, a canyon, and a working transit site. Record actual results and distinguish baseline failures, new failures, and checks you could not run.

| Acceptance check | Visible result |
| --- | --- |
| Open Build at its default height | The first element row is fully visible and selectable in portrait. Search and category choices fit without the separate Suggested/X bar. |
| Open, drag, switch, and exit menus | Bottom sheets feel like one consistent interface. Swiping down dismisses, scrolling and text entry still work, and keyboard dismissal/focus return are available. |
| Open Smart, Quick, Exact, and Quick Edit | Chrome eases away during the existing spiral and returns appropriately, with no stray tap, flash, or lost selection state. |
| Use the City and Settings destinations | Money distinguishes cash and wealth at a glance. Every City subtab remains usable, Transit opens in City, Settings opens directly, and the compact ellipsis remains easy to use. All shortcuts land correctly. |
| Sculpt 1 column, then a ridge or gorge crossing a tile boundary | The visible and sampled terrain are both edited at the voxel pitch. The seam, raycast, preview, undo, and reload agree. |
| Place a styled Beach beside water | The world gains shaped sand, believable shallows and surf, and level/variant-appropriate decoration. Nearby water and objects remain operational. |
| Place, restyle, and upgrade landforms and Spaceport | Landforms blend into the world, their transitions are reversible through the supported undo flow, and Spaceport keeps its launch infrastructure with the unnecessary parcel slab gone. |
| Build an added element via search and Exact Build | It is playable, discoverable, documented, and covered exactly once by Exact Build. All original IDs still resolve. |
| Reload a pre-change developed city and create a new one | Existing placements, finances, permissions, routes, and edited terrain survive. New fine terrain and integrated elements save and reopen reliably. |

Finish with a concise implementation report listing the changes, catalog totals and added IDs, platform decisions, affected save/terrain behavior, test commands and outcomes, and any differences between this brief and the shipped build. Include representative before/after screenshots if the preview environment supports capture. Treat documentation and sample images as supporting material for changes that actually work in the game.

## Original notes (verbatim)

```text
New Menu Prompt:

Make the bottom menu for build it a little more sleek, like make the invidual element icons a little more compact so that one row of elements is visible when the default menu high pulls up

And make all the menus kind like pull up when you click them with like a little animation, just like a smooth like animated type movement up from the bottom, apply that to all menus across the game

And also get rid of that like big bar at the top that says suggested and has the X, and just make it be like a swipe down that gets rid of the menu

And make that the way with all the menus, and just generally make all the menus more gesture based and like less X buttons, and like generally just more animated movement and stuff when menus change and move and come off and on the screen

And same with like when the quick menus open up I want the other menus to temporarily hide like they already do but a subtle animation that occurs at the same time as the spiral animation that all those menus have as they're revealed 

New Land & Water Manipulation + Land & Water Element Interaction and Integration Prompt:

Basically we need to match the bit size of the land and water to the bit size of the elements, like how many individually manipulatable squares the elements are made up of, needs to be matches by the land water, and the land and water like manipulation tools for like making mountains and valleys and gorges and hills and all that need to be upgraded to be like WAY better. 

I want to make it so the beaches, like when you place a beach it actually like makes that part of the shore of the island into a beach that like looks the beach element and the water still like looks good and stuff but now it has like nicer sand and like beach beach chairs or whatever to look like the elements visual variant and level, but like is integrated visually and seamlessly with the actual shore and water 

Same with other land based or water based elements, like the deserts, canyons, hills, mountains etc. like first we gotta make the actual land of the world and island and stuff match the amount of bits in the elements and then make it so the land interactive elements like hills, beaches, sand, desert, mountains etc. all like seamlessly visually like morph and the land morphs to match so it looks like it's apart of the land and stuff, ya know? Let's do that. Let's make that happen. 

And this just needs to be applied broadly to all the elements and the mechanisms of the whole game, like when it makes sense the ground needs to morph to match or appropriately like change or interact in some way with the elements placed on top of it

Element Design Refinements and New Elements Additions: 

Some of the elements still have like platforms underneath them, obviously some times a platform make sense but very often it does not make sense, so we need to make sure any elements with meaningless platforms needs to be fixed and the platform needs to be taken off, the space port for sure, but I'm sure there are other ones

And we need to make sure there are a balanced amount of elements, so without taking away elements but only by adding elements we need to evaluate the number of elements in each section and make sure there are a good equal number in each section and type and then the like exact build decision quick menu will need to be upgraded accordingly

Menu Evaluation and Improvement Prompt:

Visually inspect all of the menus, all pages, top and bottom and make sure they are all visually cohesive and optimized.

And like get rid of those most useless top bar on the bottom menu, that has like just the name of the menu and an x and expand button, like consolidated that into where the search bar is, and maybe just put the name of menu above it but just as text with a subtle shadow.

And like evaluate them all but definitely improve the city tab and all sub tabs, especially money, but all of them, and almost the transit tab, and the transit tab could be nested into the city tab and then be replaced with settings tab which is currently under the three dots, and make the three dots smaller than the other ones, like not the same size as the other tabs, but make it visually cohesive but like ya know?
```
