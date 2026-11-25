# Time period styles for Pixel Civilization

A time period changes what the player sees and what things are called. The same civilization can be saved, shared, and played in any style. A Roman waterworks and a 3027 waterworks occupy the same cells, have the same levels, and serve the same population. Era names and artwork belong to the presentation layer.

## Launch selection

| Style | Visual language | Example house | Example grocery | Example passenger rail |
| --- | --- | --- | --- | --- |
| Ancient Rome | Pale stone, terracotta, arches, shaded arcades | Domus | Forum market | Imperial passenger line |
| Ancient China (Han-inspired) | Timber frames, tiered roofs, gray courtyard walls. Anchor the first set in Han-era towns | Courtyard dwelling | Market hall | Imperial passenger corridor |
| Medieval Europe | Timber framing, masonry, pitched roofs, fortified civic buildings | Timber cottage | Market guildhall | Wayfarer line |
| WWII Allied home front | Brick terraces, concrete, utility sheds, civil service signs | Brick terrace | Ration shop | Home-front passenger line |
| WWII Axis-era civilian infrastructure | Distinct period town plans, rendered masonry and utilitarian depots. Focus on civilian life | Courtyard block | Municipal provisions hall | Regional passenger line |
| Ancient Greece | Whitewashed walls, painted trim, colonnades, stepped plazas | Courtyard oikos | Agora provisions stall | Polis passenger corridor |
| 3027 | Modular towers, suspended platforms, luminous conduits | Habitat stack | Nutrient exchange | Maglev corridor |
| Post-apocalyptic | Reclaimed steel, patched roofs, reused roadbeds, improvised greenery | Salvage shelter | Supply exchange | Reclaimed rail line |
| Ancient Egypt | Sandstone, mud brick, river-front quays, striped textiles | Mudbrick courtyard | River granary market | Nile passenger corridor |
| Renaissance Italy | Stucco, tiled roofs, classical civic squares, river workshops | Merchant dwelling | Provision arcade | Grand canal passenger line |
| Art Deco metropolis | Stepped silhouettes, geometric trim, subway portals and electric signage | Terrace apartment | Corner emporium | Metropolitan express |

Period sets are stylized. WWII packs focus on housing, public works, transport, civil protection, logistics and everyday life. Avoid faction praise, hate symbols and playable historical targeting. Preserve defensive abstractions with era-appropriate civic shelter, coast-watch and logistics visuals. Use historical and primary visual references during production and clearly label speculative substitutions.

## Player experience

- Add a **Time period** selector to More → View, new island setup, and the Atlas. Show a small panel with a stage 1 street, a high-stage skyline, and five sample elements for each available set.
- Preview a period using the user's island. Confirm the style change in one tap, provide **Original** as a permanent choice, and allow switching mid-game.
- Save the preferred visual period per island. When sharing, the room owner can choose the room's default appearance. Each player may locally preview a different appearance while all players edit the same canonical objects.
- Search by the era name or the original game name. The Atlas shows the period label, capability, footprint, upgrade chain and variants. The tutorial and handbook use the selected period labels where they refer to an element.
- Provide a quick **Show original names** setting. Give custom designs their original names and visuals unless the creator supplies explicit themed counterparts.

## Stable IDs and data

- Keep all existing element IDs, category and service IDs, save formats, stage unlock conditions, ports, costs, upkeep, movement, construction rules, and multiplayer commands.
- Add an optional appearance key to world metadata or a versioned presentation preference. Missing and unknown keys resolve to the original style. A style switch never writes element coordinates, level, variant, construction history or the economy.
- Define a manifest per period keyed by canonical element ID. Each entry includes localized names, aliases, level names, thumbnail reference, variant art recipe, accessibility description and missing-art flag. Add a separate 20-entry stage presentation map for period names and artwork. Derive coverage from the canonical catalog on each build and keep the exact same level and variant indexes.
- Resolve all presentation through a common accessor. Build, Quick Build, Quick Edit, Details, the Atlas, tutorial, transit labels, goals and notifications should agree on names. Use canonical IDs for lookup, persistence, routing and indexing.
- Preserve the footprint and interaction anchors for every level. Render authored models where a silhouette matters. For family members use controlled recipes with shared materials and building modules, then hand-tune the landmarks and silhouettes players must distinguish from above.
- Include era art in PWA caches on demand. Load the selected pack by category when needed. Keep base meshes compressed and keep screenshots/icon atlases versioned independently. Ship packs only when measured frame time and memory are close to the base game on mid-range mobile hardware.

## Modern mechanics in historical scenery

Use readable equivalent visual roles for mechanics that arrived later. Preserve the functional icon and the canonical type in the Atlas. Roman airports can read visually as expedition terminals, spaceports as celestial observatories, electric utilities as waterwheel or civic energy complexes, and transit corridors as styled route infrastructure with the original travel and connectivity rules. Do not imply the historical names or structures actually performed their modern equivalents. Keep ports, deck spans, street alignments, network widths, emergency access and animated route paths visibly legible in every style.

## Production gates

| Pass | Work | Exit checks |
| --- | --- | --- |
| Foundation | Inventory every catalog entry, level, variant, label, interaction and existing art touchpoint. Add the manifest schema and resolver | Original mode renders and saves identically. Missing art resolves predictably. A headless replay of identical commands produces identical simulation results across themes |
| Pilot | Ancient Rome across starter housing, roads, rail, food, water, power, civic and one late landmark. Build the picker and Atlas state | Theme changes live and survives reload. Existing personal and shared rooms load. Tests compare base vs themed geometry, camera and UI on mobile and desktop |
| Architecture wave | Finish Rome. Add Ancient China, Ancient Greece, Ancient Egypt, Medieval Europe and Renaissance Italy | Validate coverage for every canonical element, level and variant. Review every core silhouette and each landmark visually |
| Modern and speculative wave | Art Deco, both WWII civilian packs, 3027 and post-apocalyptic | Review visual distinction, period naming, civilian historical treatment, readability and performance |
| Release and maintenance | Automated coverage, downloadable cache checks, user playthrough by era and follow-up improvements | Complete catalog, stage, and variant coverage per published pack. Publish only packs that pass. New catalog entries require mappings for released packs or an explicit fallback |

The multiplayer branch contains 294 base catalog entries, 20 progression stages, and 1,534 element-level combinations. Eleven packs give 16,874 element-level mappings before counting visual variants. Refresh these counts at the branch we ship. Count canonical IDs × authored level slots × supported variant slots for each pack, then report reusable recipes versus manually authored assets. Keep representative canonical World IDs and camera views in visual regression fixtures so screenshots can be compared across packs. Budget separate art and QA batches once the pilot establishes the per-family cost.
