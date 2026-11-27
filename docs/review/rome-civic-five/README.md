# Aqueduct City civic services

Each board compares all 20 playable Roman models for one service. Rows hold variant slots A–D, and columns run from levels one to five. All captures use the game gallery, the same street-facing camera, and the same parcel footprint on both sides.

| Service | What to look for |
| --- | --- |
| [Vaults of the Record Keepers](public_library.webp) | Stepped scroll vaults, unequal barrel rooms, rows of deep scroll shelves or a recital cavea face an open reading court. |
| [Cursus Publicus Relay](post_offices.webp) | See the public counter, separated sorting racks, horses, carts and packet gate in each yard. |
| [Basilica of the Tribunal](courthouses.webp) | A pediment, exedra, judgment arch or crossing lantern sits above the central hearing stair and its listening galleries. |
| [Forum of the Magistrates](city_offices.webp) | Four different timekeepers rise above notice boards, speaking platforms and a low magistrate’s gallery. |
| [Aerarium Counting House](banks.webp) | Drum, paired vaults, beveled bronze chest and faceted treasury enclose guarded counting rooms. |

[Model measurements](models.json) cover all 100 raw signatures and 800 cross-service variant pairings. Every idle mesh has exposed emissive faces, every authored voxel fits its parcel, and the tallest city-office feature exceeds the other four civic roles at each matching level and slot. The maximum active model uses 10,663 static voxels. [The silhouette scan](silhouettes.json) found no cross-service pairs or same-service variant pairs below 0.12 and no adjacent upgrades below 0.06.

These five services use the normal production-era model and metadata routes. The Rome pilot’s existing baked-sheet list covers a different set of elements. Static thumbnails for the five civic services resolve from their Roman model builders. The separate Forum City pilot and Original render samples matched the baseline across the 100 cells checked for each style.

At phone size the district shows how five civic parcels break up the surrounding Roman roofline. The street view shows the work yards and court from the entrance side. The overhead view removes color to make footprints and open spaces easier to compare. Both builds render the same 245 placed elements at 390 × 844, at 14:00 in clear weather. [District](rome-aqueduct-district.webp) · [Street](rome-aqueduct-street.webp) · [Overhead](rome-aqueduct-overhead.webp) · [Camera and layout measurements](rome-aqueduct-views.json) · [Importable island](../civic-neighborhood/island.json)

```sh
bash scripts/gallery-server.sh
node scripts/shoot-gallery.mjs 'cat=all&ids=public_library,post_offices,courthouses,city_offices,banks&mode=full&cell=174&era=rome-aqueduct' /tmp/roman-civic-five.webp
node --import tsx scripts/review/near-silhouette.mjs eras=rome-aqueduct
```
