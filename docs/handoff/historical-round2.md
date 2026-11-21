# Historical wonders: round 2 handoff

This round adds eight historical wonders to the **Landmarks** category. Every wonder follows the same level arc:

1. Lv1: excavation site or early construction, with dirt, scaffolds, workers, tents and stone blocks.
2. Lv2: the monument half built, with cranes, sledges or elephants on site.
3. Lv3: the monument complete in its classic silhouette.
4. Lv4: the wider sacred or civic complex around it.
5. Lv5: the fully restored wonder, with a plaza, crowds, floodlights and night glow. The monument stone itself glows at night.

## Files
- `src/game/historicalCatalog.ts`: `HISTORICAL_WONDERS`, the catalog definitions plus footprints. `HISTORICAL_WONDER_IDS` is also exported.
- `src/game/designs/historical.ts`: all eight builders, registered with `defineDesigns`. Footprints are read from the catalog file, so they are defined in one place only.
- Wiring changes (all additive):
  - `catalog.ts`: imports `HISTORICAL_WONDERS` and spreads it after `EXPANSION_ELEMENTS`.
  - `levelSpans.ts`: spreads the wonder footprints.
  - `designs/index.ts`: `import "./historical"`.
  - `connectionPreview.ts`: the wonders' guide partner is `italian_gardens`.
  - `parcelEdges.ts`: the wonders are added to `viewers`, so they get the ceremonial promenade edge.
  - `connectionGuide.json`: one entry for all eight wonders.
  - `designStyles.json`: four style names per wonder.
  - `tests/parcelEdges.test.ts`: the guide count now includes `+ HISTORICAL_WONDERS.length`.
- Handbook: there are 8 new rows in `src/handbook/catalog.json`, in ELEMENTS order (merged in, the other rows are untouched). There are also new sheets and thumbs under `public/handbook/catalog/`. These were generated with a copy of `scripts/render-handbook.mjs` that only writes the wonder rows (`ATLAS_IDS`), using `@napi-rs/canvas` installed outside the repo.

## Elements
Benefits use the shared landmark level scaling in the simulation.

| id | stage | cost | stats | footprints Lv1→Lv5 |
|---|---|---|---|---|
| stonehenge | 13 | 1400 | rec 220, edu 70, income 70 | 1×1, 2×2, 2×2, 3×3, 3×3 |
| moai_statues | 13 | 1300 | rec 210, edu 60, income 75 | 1×1, 2×1, 3×1, 3×2, 4×2 |
| parthenon | 15 | 2400 | rec 300, edu 150, gov 60, income 120 | 2×1, 2×2, 3×2, 3×3, 4×3 |
| colosseum | 16 | 3000 | rec 520, income 220, jobs 40 | 2×2, 2×2, 3×2, 3×3, 4×3 |
| chichen_itza | 16 | 3100 | rec 450, edu 130, income 200 | 2×2, 2×2, 3×3, 3×3, 4×4 |
| great_wall | 17 | 3200 | rec 380, military 160, income 180 | 2×1, 3×1, 3×2, 4×2, 4×3 |
| angkor_wat | 19 | 3900 | rec 600, edu 170, income 280 | 2×2, 3×2, 3×3, 4×3, 4×4 |
| machu_picchu | 20 | 4600 | rec 720, edu 190, food 40, income 330 | 2×2, 3×2, 3×3, 4×3, 4×4 |

Levels and styles:
- **Colosseum**:
  - Levels: Arena Foundations → Rising Arcades → Flavian Amphitheatre → Imperial Colosseum → Colosseum of the Eternal City.
  - Elliptical arcade tiers with an attic storey. The arena has gladiators, and Lv5 adds a lion and a chariot.
  - Styles: Imperial travertine, Weathered ruin (collapsed outer ring and open hypogeum), Velarium sails, Naumachia flood (water arena with warships).
- **Stonehenge**:
  - Levels: Timber Woodhenge → Sarsen Arc → Lintel Circle → Trilithon Sanctuary → Midsummer Solstice Henge.
  - Lv5 adds a glowing solstice axis, a torch ring and a druid circle.
  - Styles: Salisbury sarsen, Bluestone, Moss & wildflower, Avebury earthwork (chalk bank and ditch).
- **Parthenon**:
  - Levels: Marble Foundations → Doric Colonnade → Temple of Athena → Sacred Acropolis → Golden Age Acropolis.
  - The craggy acropolis hill grows with level. Lv4 adds the Erechtheion caryatids and an Athena statue. Lv5 adds the Propylaea and floodlit columns.
  - Styles: Pentelic marble, Painted polychrome, Gilded Athena, Honey stone.
- **Great Wall**:
  - Levels: Rammed-Earth Rampart → Brick Battlement → Beacon Wall → Mountain Ramparts → Grand Pass Fortress.
  - The wall snakes over a heightfield whose hills rise with level, between watchtowers with beacon smoke, pavilions and red lanterns.
  - Styles: Ming brick, Rammed earth, Snowy pass, Red lantern autumn.
- **Chichén Itzá**:
  - Levels: Jungle Mound → Terrace Restoration → El Castillo → Feathered Serpent Plaza → Equinox Ceremonial City.
  - El Castillo has nine terraces, four stairs and a temple. Lv4 adds serpent heads and the Warriors columns. Lv5 adds a ball court and a glowing equinox serpent.
  - Styles: Limestone, Painted stucco, Jungle reclaimed, Equinox serpent.
- **Moai Statues**:
  - Levels: Quarry Carving → Walking Moai → Seaside Ahu → Ancestor Coast → Tongariki Ahu.
  - The sea runs along the back with the moai facing inland, from 2 up to 9 moai. Lv3+ adds a canoe and Lv4+ a hare paenga house.
  - Styles: Tuff ahu, Red pukao, Coral eyes, Rano Raraku slope (buried heads).
- **Angkor Wat**:
  - Levels: Laterite Base → Central Prasat → Quincunx Temple → Moated Sanctuary → Angkor Sunrise.
  - Elephants haul stone. Five lotus-bud towers stand above a galleried terrace. Lv4+ adds the moat, causeway and libraries. Lv5 adds a naga, lotus pads and monks.
  - Styles: Grey sandstone, Gilded spires, Ta Prohm jungle, Lotus moat.
- **Machu Picchu**:
  - Levels: Cloud-Forest Outpost → Terraced Hamlet → Royal Citadel → Huayna Picchu Sanctuary → Lost City of the Incas.
  - Terraces follow the ridge contours. Stone houses with gable ends are roofed at Lv5 and in the Thatch style. Lv4+ adds the Huayna Picchu peak, the Sun Temple and the Intihuatana stone, plus llamas and an Inca trail.
  - Styles: Granite ruins, Cloud forest, Thatch restored, Inti sunset.

## Notes / follow-ups
- The gallery's `cat=historical` fails while Vite is running. The dev server's `import.meta.glob` was built before the file existed, so restart the server to fix it. Until then, use `cat=all&ids=...`.
- After any change to a wonder's art or text, regenerate its handbook sheets. Run `ATLAS_IDS=<ids> node --import tsx scripts/render-handbook.mjs` (needs `@napi-rs/canvas`). Note that the stock script rewrites the whole `catalog.json`.
- Voxel counts peak at about 15.6k (Angkor and Machu Picchu Lv5).
