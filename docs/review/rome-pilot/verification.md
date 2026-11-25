# Reproducing the Rome pilot checks

## Fixtures and comparisons

| View | Sites | God-mode stage | What is held equal |
| --- | ---: | ---: | --- |
| Via delle Vigne street | 15 | 1 | Farm lane, shops, two house levels and camera |
| Porta Fluminis district and crossing | 93 | 8 | Spring, flow path, bridge, railway, route centerlines and market block |
| Colonia Alta skyline | 156 | 20 | Four adjacent residential variants, hillside, observatory, services and mature plantings |

The comparison renders one frozen copy of the actual game fixture in all three appearances. The capture process rejects a set if its canonical parcel IDs, levels, variants, spans, poses, stage, daylight, viewport or camera differ. The primary camera set uses 14:00 daylight. Separate district images show dusk. God-mode stages are held with an ordinary God control. Real-mode tours derive their stages from their population. [Capture manifest](captures.json)

An 80-second seeded Real-mode replay compares the complete serialized simulation across Original, Forum City and Aqueduct City, including route positions, hydraulic flow, operating accounts and progress. The comparison excludes the chosen appearance and a per-process terrain cache number. The companion test checks that passengers actually arrive, the waterworks receives potable water from the spring, the road bridge spans the river, and each tour has its own save key. [Tests](../../../tests/romeFixtureParity.test.ts)

The [machine-readable worklist](coverage.json) lists all 294 canonical elements and their supported levels and footprint dimensions. Each preview direction supplies 644 level/variant cells over 25 IDs. All 1,288 authored cells were rendered from the shared design recipe. Every other base element is recorded as an Original fallback. Custom designs are excluded from the base counts. The separate [activity filmstrip](events.webp) uses real freight, passenger and water service changes. [Activity receipts](events.json)

## Visual review

The [initial plate](pass-0.webp) showed how heavily the two settings relied on color. [Revision 1](pass-1.webp) changed the massing of the domus, insula, market, cistern and observatory. [Revision 2](pass-2.webp) clarified freight and platform cues, side and rear facades, inactive channels, roof details, and vehicle approaches. Full-world review also led to denser housing, street planting, and matching bridge approaches.

Distribute the [unlabeled recognition board](review-board.webp) separately from its [answer key](review-key.json). The board is a review instrument. Five human reviewers have yet to score it, and Brigham's direction approval is pending.

## Commands

### Desktop performance

The production build ran on Intel Iris Xe graphics with Direct3D 11 in headless Chrome 157 on Windows. Each direction ran three times on the same 156-site island at 886 × 306 pixels and 1× pixel density. Each run timed 60 moving-camera frames and checked the renderer’s frame counter before recording a sample. The Atlas test opened Apartments at level 4, variant 3, and waited for its model to render. Values below are medians of three runs. [Raw measurements and build fingerprint](performance-desktop.json)

| Appearance | Frame | 95th-percentile frame | First Atlas model |
| --- | ---: | ---: | ---: |
| Original | 16.7 ms | 33.3 ms | 719 ms |
| Forum City | 16.7 ms | 17.1 ms | 894 ms |
| Aqueduct City | 16.7 ms | 17.8 ms | 766 ms |

All three measured about 60 fps at this viewport. In this sample, the Rome frame medians met the proposed 15% limit relative to Original. Decoded script bytes rose from 3,343,976 to 3,361,166 when Rome loaded. Warm browser cache affected transferred-byte counts. The 50 optional illustrated sheets occupy 1,833,042 bytes in total. Browser heap snapshots ranged from 118 to 527 MiB across runs and varied with garbage collection. Physical Android performance still requires a handset measurement.

### Reproduction

From the repository root, with its locked dependencies installed, the following commands reconstruct the evidence. The illustration tools use the same optional `@napi-rs/canvas` encoder documented in `scripts/render-handbook.mjs`. Browser checks use Playwright or Playwright Core; set `CHROME_PATH` to a local Chromium executable and `ROME_ORIGIN` to the preview under test.

```sh
node --import tsx --test tests/romeFixtureParity.test.ts tests/eraArt.test.ts tests/romeHandbook.test.ts
node --import tsx scripts/review/rome-inventory.mjs
node --import tsx scripts/review/rome-plates.mjs full
node scripts/review/rome-worlds.mjs images
node scripts/review/rome-review-board.mjs
node --import tsx scripts/review/rome-events.mjs
node scripts/review/rome-worlds.mjs performance
```

Use the [device check on the preview](https://pixel-civilization-rome-preview.fuzzymedia.workers.dev/handbook/era-pilot/benchmark.html) for a phone or desktop. Run it in a private tab while the page is visible and save the resulting JSON. The test records rendered frames on a repeatable orbit, first successful Atlas model time, graphics renderer, framebuffer dimensions, script transfer sizes and browser-reported memory where available. Budgets for a physical mid-range Android handset, memory, transfer size and first model time await review.
