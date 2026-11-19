# Networks handoff (src/game/designs/networks.ts)

All 21 network ids are registered and working (footprints [1,1] x5). Typecheck clean.

## Status
| id | status |
|---|---|
| roads, two_lane_roads, pretty_roads, side_walks | done (kerbed streets, crosswalks, signals, cul-de-sacs, driveways, L4+ roundabout on pretty_roads) |
| dirt_roads, paths, walking_paths, trails | done (arc-curved corners, organic edges) |
| highways, freeways | done (median/jersey barriers, gantries, sound walls, dead-end chevron barrier) |
| bridges, stone_bridges, suspension_bridges, over_passes | done (deck heights 4/5/6/7, ramps to ground, water piers, grade-separated crossings) |
| underpasses | done (trench + cut-and-cover lid, portals, road over the lid at grade-separated crossings) |
| boardwalks | done (planks on posts, sand or water) |
| train_tracks | done (true arc curves, wye switches at T's, buffer stops, trestle over water, catenary L4+) |
| canals, water_tile, rivers, wide_rivers | done (water at y=0 emit 0.08, banks/quays only on non-connected sides) |

## Known issues / ideas
- Variants are random per placement, so variant-coloured structure (truss paint, tower colour, stone colour) can look patchy along a mixed bridge. Surfaces and edge profiles are the same for every variant, so the tiles still line up.
- Suspension towers appear on every full-height straight tile, because a tile cannot see its global position.
- Junctions on motorways are at-grade (simple box + mast).
- Cars drive at y=1 in-game regardless of deck height (renderer, not design).
- Voxel counts not measured by the gallery for networks (counts are only shown for non-network cells); estimated < 2k/tile (stone bridge biggest).

## Gallery (networkLayout in src/gallery.ts now takes `net=mix|bridge|one&mask=N`)
```
./scripts/gallery-server.sh
node scripts/shoot-gallery.mjs "cat=networks&ids=roads,pretty_roads&mode=levels&cell=420" out.png
node scripts/shoot-gallery.mjs "cat=networks&ids=bridges,over_passes,underpasses&mode=levels&net=bridge&cell=400" out.png
node scripts/shoot-gallery.mjs "cat=networks&ids=over_passes&mode=variants&lv=4&net=one&mask=1295" out.png   # grade-separated crossing
node scripts/shoot-gallery.mjs "cat=networks&ids=train_tracks&mode=levels&net=one&mask=4101" out.png        # over water
```
