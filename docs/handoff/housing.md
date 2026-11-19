# Housing designs — handoff (src/game/designs/housing.ts)

Typechecks clean (`npx tsc --noEmit 2>&1 | grep designs/housing` prints nothing). All 14 ids registered.

## Status
| id | status | footprints | levels |
|---|---|---|---|
| house | done (reference kept as-is) | 1x1,1x1,2x1,2x2,2x2 | Starter Bungalow / Two-Story Family Home / Home with Garage / Backyard-Pool Estate / Grand Family Manor |
| tiny_homes | done | 1x1,1x1,2x1,2x2,2x2 | Off-Grid Micro Cabin / Cabin with Fire Pit / Tiny Twin Plot / Tiny-Home Hamlet / Eco Tiny Village — V0 A-frame, V1 shipping container (stacked at L4+), V2 tiny house on wheels, V3 hobbit earth-house; L5 wind-turbine rotor |
| trailer_home | done | 1x1,2x1,2x2,3x2,3x3 | Lone Trailer / Twin-Trailer Lot / Trailer Court / Sunny Acres Park / Neon Palms RV Resort — V0 Airstream, V1 70s single-wide, V2 canned-ham pastel, V3 motorhome RV; office L4, pool + neon sign L5 |
| cottages | done | 1x1,1x1,1x1,2x1,2x2 | Woodcutter's / Rose-Gate / Ivy & Well / Kitchen-Garden / Millpond Storybook Cottage — V0 stone & thatch, V1 gingerbread half-timber, V2 alpine chalet, V3 Nordic turf roof (goat); L5 water-wheel rotor |
| medium_sized_homes | done | 1x1,2x1,2x1,2x2,2x2 | Split-Level Starter / Garage & Hoop Home / Second-Story Add-On / Backyard BBQ Home / Cul-de-Sac Dream Home — V0 60s split-level, V1 Cape Cod, V2 Dutch colonial (gambrel), V3 Prairie |
| townhomes | done | 1x1,2x1,2x1,3x1,3x2 | Twin Rowhouses / Four-House Row / Stoop-Lined Terrace / Block-Long Terrace / Garden-Square Terraces — V0 brownstones, V1 painted ladies, V2 Amsterdam canal houses (+canal & boat), V3 modern rows; L5 = L-shaped corner terrace (uses local `stampRotated`) |
| large_homes | done (minor issue) | 2x1,2x2,2x2,3x2,3x3 | Big Suburban Home / Three-Car-Garage Home / Poolside Family Home / Circle-Drive Estate / Tennis-Court Estate — V0 Colonial Revival, V1 Tudor, V2 modern farmhouse, V3 mid-century butterfly roof |
| apartments | done, NOT visually verified | 1x1,1x1,2x1,2x1,2x2 | Two-Flat / Three-Story Walk-Up / Corner Walk-Up & Shop / Five-Story Tenement / Grand Courtyard Block — V0 NYC brick + fire escapes + water tower, V1 Haussmann, V2 Miami deco neon fin, V3 Tokyo open-corridor |
| beach_houses | TODO placeholder (reuses medium home builder) | 1x1,1x1,2x1,2x2,2x2 | names set |
| villas | TODO placeholder (reuses large home builder) | 2x1,2x2,2x2,3x2,3x3 | names set |
| mansions | TODO placeholder (reuses large home builder) | 2x2,2x2,3x2,3x3,3x3 | names set |
| apartment_buildings | TODO placeholder (simple tower) | 1x1,2x1,2x1,2x2,2x2 | names set |
| condos | TODO placeholder (simple tower) | 1x1,1x1,2x1,2x2,2x2 | names set |
| skyscrapers | TODO placeholder (simple tower 50→220 tall, beacon) | 1x1,1x1,1x1,2x2,2x2 | names set |

## Known issues
- large_homes L2/L3 (2x2): garage wing doesn't fit (needs ≥10 voxels right of the 22-wide house) — shrink house or move garage.
- apartments: only typechecked; render & check all 20 cells.
- house L4→L5 very similar; could get a bigger finale.
- Placeholders need real designs (plans in the original brief notes: stilt beach houses w/ decks/docks; Tuscan/Santorini/riad/Balinese villas; Brutalist/Soviet mural/colourful balcony/bosco-verticale blocks; Miami/terraced/Marina-City/dark-glass condos; Palladian/château/Hollywood-modern/baronial mansions; 4 skyscraper styles art-deco/twisted/Jenga/twin+skybridge with c.blink beacons).

## Resume
```
./scripts/gallery-server.sh
node scripts/shoot-gallery.mjs "cat=housing&ids=apartments&mode=full&cell=300" /tmp/out.png
node scripts/shoot-gallery.mjs "cat=housing&ids=<id>&mode=variants&lv=5&cell=450" /tmp/out.png
```
Screenshots: /tmp/claude-0/-home-user-Pixel-Civilization/82636313-3a2d-5962-b203-fb2d54579198/scratchpad/housing/
