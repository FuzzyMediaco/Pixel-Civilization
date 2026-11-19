# Handoff — civic_faith (civic.ts + faith.ts)

All 21 assigned ids are registered and typecheck cleanly (`npx tsc --noEmit | grep -E "designs/(faith|civic)"` prints nothing).
Verified against catalog.ts: civic_parks = 13 ids and faith = 8 ids. None are missing.

## Status

### faith.ts — all 8 written (first pass, real designs)
| id | footprints | levels | variants (V0/V1/V2/V3) | status |
|---|---|---|---|---|
| churches | 1×1,1×2,2×2,2×3,3×4 | Bell-Cote Chapel → Village Parish Church → Steepled Church & Churchyard → Transept Basilica → Grand Cathedral | Gothic stone / New England clapboard / Italian Romanesque (campanile, crossing dome) / English Norman (crenellated towers) | done, checked visually |
| christian_churches | 1×1,2×1,2×2,3×2,3×3 | Humble Chapel → Mission Church → Community Church → Great Church → Cathedral of Glory | Russian Orthodox onion domes (St Basil swirl at L5) / Spanish Mission espadaña / Modern evangelical (storefront → A-frame → arena → Crystal Cathedral) / Nordic stave | done, checked visually |
| graveyards | 1×1,2×1,2×2,3×2,3×3 | Lonely Burial Plot → Churchyard Cemetery → Memorial Cemetery → Mausoleum Necropolis → Eternal Garden Necropolis | Victorian gothic / New England churchyard / Military memorial / Día de Muertos | written, NOT checked visually |
| monasteries | 1×1,2×1,2×2,3×3,4×4 | Hermit's Cell → Humble Priory → Cloistered Abbey → Walled Abbey → Hilltop Monastery Citadel | Benedictine / Tibetan gompa / Greek Orthodox (L5 Meteora rock pillars) / Provençal Cistercian with lavender | written, NOT checked visually |
| mosques | 1×1,2×1,2×2,3×2,3×3 | Neighborhood Masjid → Domed Mosque → Courtyard Mosque → Grand Mosque → Great Four-Minaret Mosque | Ottoman / Persian / Moorish / Mughal. Minarets per level: 1,1,2,2,4 | written, NOT checked visually |
| synagogues | 1×1,2×1,2×2,2×2,3×3 | Shtiebel Prayer House → Community Shul → Great Synagogue → Twin-Tower Synagogue → Grand Temple Synagogue | Moorish revival / Neoclassical / Modernist wedge / Wooden tiered | written, NOT checked visually |
| temples | 1×1,1×2,2×2,2×3,3×3 | Roadside Shrine → Temple Hall → Pagoda Temple → Temple Compound → Sacred Temple City | Chinese pagoda / Hindu shikhara + gopuram / Shinto torii tunnel / Thai wat + chedi | written, NOT checked visually |
| lds_temples | 2×2,2×2,2×3,3×3,3×4 | Small Temple → Regional Temple → District Temple → Grand Temple → Flagship Temple | Salt Lake granite towers / Modern single spire / Washington marble needles / Pacific terraces | written, NOT checked visually |

### civic.ts — all 13 are PLACEHOLDERS (todo)
They are registered with their final footprints and level names, but use generic builders (`placeholderPark` / `placeholderBuilding`).
The footprints and level names are in civic.ts. The design plan, still to be built:
- school: schoolhouse with bell → brick school + playground → campus with gym & field → high school with stadium lights → university quad with clock tower. Variants: brick / modern colourful / Spanish adobe / collegiate gothic.
- park (sprawl): playground → pond + gazebo → carousel via `c.addRotor` → skate park + amphitheater. Variants: meadow / tropical / autumn / cherry-blossom.
- little_parks: a pocket park that stays small (swings, splash pad, mural, food cart). Variants: urban plaza / playground / dog park / zen.
- gardens: raised beds → allotments + shed → greenhouse → conservatory → palm-house dome. Variants: cottage / desert cactus / tropical / rose.
- italian_gardens: formal terraces, cypress, fountains, statues, villa at L5. Variants: Tuscan / French parterre / Villa d'Este cascades / Baroque topiary.
- large_parks: Central-Park scale, with lake, boathouse, bandshell and bridges.
- city_offices, post_offices (mail trucks, mailbox, docks), tax_collecting_office (funny vault, giant coin, money truck), fire_department (red bay doors, engines, hose tower, `c.blink` siren), community_centers, courthouses (columns, scales of justice), government_buildings (capitol dome).
- Reuse the local helpers in faith.ts (`triFace`, `rose`, `crenel`, `lantern`, `steepHip`) by copying them into civic.ts. Don't import across category files.

## Known issues (faith)
- Orthodox L5: the cluster of satellite domes and crosses is busy. The brick L5 walls look unlike L1–L4.
- Mission L4/L5: the terracotta courtyard is large and empty and needs props. The L4 bell tower overlaps the nave corner.
- Church V0 L5: the crossing flèche reads as a thin black stub.
- Stave church: better after the tier rewrite, but it is still dark and dense.
- No night (`night=1`) or back (`angle=225`) checks have been done for any element.

## Resume
```
./scripts/gallery-server.sh
S=/tmp/claude-0/-home-user-Pixel-Civilization/82636313-3a2d-5962-b203-fb2d54579198/scratchpad/civic_faith
node scripts/shoot-gallery.mjs "cat=faith&ids=graveyards,monasteries&mode=full&cell=420" $S/x.png
node scripts/shoot-gallery.mjs "cat=faith&ids=mosques,synagogues&mode=full&cell=420" $S/y.png
node scripts/shoot-gallery.mjs "cat=faith&ids=temples,lds_temples&mode=full&cell=420" $S/z.png
node scripts/shoot-gallery.mjs "cat=civic&mode=levels&variant=0&cell=300" $S/c.png
npx tsc --noEmit 2>&1 | grep -E "designs/(faith|civic)"
```
Next steps:
1. Visually verify the 6 unchecked faith elements and fix them.
2. Build the 13 civic designs.
3. Check every element at night and from the back.
