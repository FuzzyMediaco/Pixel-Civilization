# Joined bridge review

The engineering gallery follows the same placement, upgrade and rendering paths as the game. The test canal has one bank at sea-level ground and the other 1.5 m higher. The two approach tiles at each end of a Works crossing carry its grade. A promoted catalog crossing has a single approach tile at either end.

| Crossing study | Before | After |
| --- | --- | --- |
| One, three, six and twelve interior spans | [Lengths](lengths-before.webp) | [Lengths](lengths-after.webp) |
| Suspension, stone, steel, wide highway and both vertical lift states | [Landmarks](landmarks-before.webp) | [Landmarks](landmarks-after.webp) |
| Timber, masonry, steel, elevated and cable-stayed railway | [Rail crossings](rail-before.webp) | [Rail crossings](rail-after.webp) |

The three-piece suspension has a single middle portal. Six pieces get two, and the main span between them lengthens across the twelve-piece crossing. A fifteenth piece introduces another tower. The road and its lamps rise 5 m on the vertical lift, while its counterweights descend 4.5 m. The piers and high walkways stay fixed. [Lit bridges at night](landmarks-night.webp).

The brush-laid catalog studies compare the four existing styles on finished twelve-piece, level-eleven crossings. [Steel](bridges-styles.webp) · [Stone](stone_bridges-styles.webp) · [Suspension](suspension_bridges-styles.webp).

Marina Cut uses the built-in Pelican Reach city with its five interior lift pieces upgraded to level 11. Both phone cameras show the same 210 objects, at 390 × 844 CSS pixels. The phone photos capture the structural redesign before the final level-eleven curb lights and under-deck trim. [Harbor approach](original-harbor.webp) · [Through the portal](original-lift.webp) · [Matched cameras and layout fingerprints](original-views.json).

## Repeat the captures

Run the gallery server once. The capture script accepts a local Chromium path through `CHROME_PATH` and a gallery server port through `GALLERY_PORT`. Its default completion timeout is four minutes. `GALLERY_TIMEOUT_MS` sets a longer limit for full catalogs on software-rendered previews.

```sh
bash scripts/gallery-server.sh
node scripts/shoot-gallery.mjs 'mode=bridge-runs&set=lengths' lengths.webp
node scripts/shoot-gallery.mjs 'mode=bridge-runs&set=landmarks' landmarks.webp
node scripts/shoot-gallery.mjs 'mode=bridge-runs&set=landmarks&night=1&angle=43' night.webp
node scripts/shoot-gallery.mjs 'mode=bridge-runs&set=rail' rail.webp
node scripts/shoot-gallery.mjs 'mode=bridge-runs&set=catalog&id=bridges' steel-styles.webp
node scripts/shoot-gallery.mjs 'mode=bridge-runs&set=catalog&id=stone_bridges&variant=2' granite-levels.webp
node scripts/shoot-gallery.mjs 'mode=bridge-runs&set=catalog&id=bridges&variant=all' steel-matrix.webp
node scripts/shoot-gallery.mjs 'cat=networks&ids=suspension_bridges&mode=full&net=bridge&water=1&cell=175' joins.webp
```

Each catalog ID supports four styles and eleven levels. Supplying a variant generates its entire level ladder. The final command checks the tile renderer used for standalone spans, bends, branches and approaches. The other commands review promoted runs with the production engineering renderer.


To photograph the working harbor, start a local production preview for each revision and pass the two origins to the existing game camera review. The command constructs Pelican Reach and applies the ten ordinary upgrades locally.

```sh
CHROME_PATH=/usr/bin/chromium node --import tsx scripts/review/bridge-city.mjs http://127.0.0.1:5325 http://127.0.0.1:5326
```
