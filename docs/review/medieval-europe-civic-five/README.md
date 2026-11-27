# Medieval Europe civic five

Each daylight board pairs the previous production models on the left with their Medieval Europe redesigns on the right. Columns follow the five playable levels. Rows follow the four saved variants. The source for the before images was main at `d8449f8`. The gallery used its ordinary 45-degree view, 180-pixel cells, idle operation and the same lighting on both sides. Its automatic camera fits each row to the tallest and widest model.

| Service | Daylight comparison |
| --- | --- |
| Lantern Scriptorium | [All twenty library models](public_library-before-after.webp) |
| Guild Messenger Yard | [All twenty post office models](post_offices-before-after.webp) |
| Hall of the Assizes | [All twenty court models](courthouses-before-after.webp) |
| Market Cross Guild Offices | [All twenty town office models](city_offices-before-after.webp) |
| Guild Strongroom | [All twenty bank models](banks-before-after.webp) |

The [night board](night-before-after.webp) shows all twenty level-five variants under the same night lighting. All 100 structures have exposed emissive faces. Each has a distinct staffed state, and every raw voxel stays inside its assigned parcel.

The three-way silhouette comparison found zero look-alike service pairs, zero close variants and zero flat adjacent upgrades. Its closest pair scored 0.160 against the 0.120 flag threshold. The largest model contains 12,517 voxels. See the [geometry counts](budget.txt) and [silhouette results](near-silhouette.json).

For a daylight matrix, run the Vite development server and set `GALLERY_PORT` to its port. Repeat the command for each service. The night view accepts the same five IDs as a comma-separated list.

```sh
node scripts/shoot-gallery.mjs 'cat=all&era=medieval-europe&ids=public_library&mode=full&cell=180' library.webp
node scripts/shoot-gallery.mjs 'cat=all&era=medieval-europe&ids=public_library,post_offices,courthouses,city_offices,banks&mode=variants&lv=5&night=1&cell=180' civic-night.webp
node --import tsx scripts/review/near-silhouette.mjs eras=medieval-europe
node --import tsx scripts/review/voxel-budget.mjs eras=medieval-europe
```
