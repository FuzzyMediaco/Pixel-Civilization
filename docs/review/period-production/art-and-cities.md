# Art and city review

Use the [matched island views](cities/index.md) to compare the same street, market district, river crossing and mature skyline in every era. Use the [model index](art/index.md) to browse every supported level and variant. The [fifty flagship models](art/flagships.webp) and [working facilities](art/working-civilization.webp) are a quicker introduction.

The ten packs cover all 294 catalog elements, 1,534 supported levels and four variant slots per level, for 61,360 rendered cells. Brigham authorized all ten packs after the Rome comparison. The Roman production pack uses the brick terracing and water infrastructure of Aqueduct City. The alternative Forum pilot is still accessible for its original comparison.

## How to read the evidence

- Every city comparison records camera settings, clock time, stage, image dimensions and the SHA-256 fingerprint of all parcel IDs, positions, rotations, levels and variants. The 66 views cover the ten production packs and Original. The 27 additional era-specific tours have their own layouts and captures. [View receipts](cities/captures.json) · [Tour receipts](cities/tours.json)
- The 490 contact sheets are generated through the model builder used by the application. The full pass detects empty geometry, repeated variants within a level and identical adjacent levels. The result also records the input source fingerprint. High-resolution roads use the same divided-carriageway drawing as the interactive Atlas. [Coverage](art/coverage-summary.json)
- The automated bridge checks preserve the height of every traveled cell through corners, ramps and crossings. The same 80-second Real-mode replay in Original, ten eras and the alternate Rome pilot produces identical serialized simulation outcomes, including passengers, water, city cash and routes. [Art regression tests](../../../tests/productionEraArt.test.ts) · [Simulation parity test](../../../tests/romeFixtureParity.test.ts)
- Ten illustrated operation strips render the exact measured events in each period. Ten units of grain arrive, fourteen passengers board and the bathhouse loses and regains all thirteen units of potable water during an outlet removal and undo. Switching between idle and active produces different model data in every era. [Measurements](operations/receipts.json) · [Ancient Egypt](operations/ancient-egypt.webp) · [3027](operations/future-3027.webp)
- The two [unlabeled recognition boards](cities/index.md#independent-recognition-exercise) have separate answer keys. Human review, physical-device sign-off and store approval are independent of the geometry coverage check.

## Reproduce the review

With repository dependencies installed, start the game as a compiled local preview. Point `PERIOD_TEST_ORIGIN` to that preview and `CHROME_PATH` to a Chromium executable for the camera scripts. These visual checks use isolated browser sessions.

```sh
node --import tsx scripts/review/production-art.mjs
node --import tsx scripts/review/era-flagships.mjs
node --import tsx scripts/review/rome-events.mjs --all-periods
node --import tsx scripts/review/period-tours.mjs
node --import tsx scripts/review/period-city-matrix.mjs
node --import tsx scripts/review/era-evidence-index.mjs
node --import tsx --test tests/productionEraArt.test.ts tests/romeFixtureParity.test.ts
```

Pass an era ID to the full-catalog renderer to regenerate just that pack. The optional Canvas and Chromium tools are the same ones used by the original illustrated Handbook and Rome pilot.
