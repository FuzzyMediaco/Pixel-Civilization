# Civic Service Quarter

Seven government services share a 240-parcel island with homes, shops, roads and a working railway. Each panel captures the game at 390 × 844 CSS pixels and 1× device scale with the HUD hidden. The stage-16 island stays paused at 14:00 in clear weather. The comparison uses the same importable save, camera and lighting on both sides.

[District at phone zoom](original-district.webp) · [Closer street view](original-street.webp) · [Grayscale overhead](original-overhead.webp)

| Building | Level | Variant | Grid position |
| --- | ---: | --- | --- |
| Government Building | 4 | B | (1, 1) |
| Tax Collecting Office | 4 | A | (1, −2) |
| Borough Assembly | 3 | D | (−3, −2) |
| Civic Records Archive | 3 | C | (1, −4) |
| City Planning Bureau | 3 | D | (−4, −4) |
| Public Works Directorate | 3 | C | (−4, 1) |
| National Parliament | 4 | A | (1, −8) |

Open the island in the game through **More → Saves → Import & export → Import backup**. The receipt records each camera and a fingerprint of every parcel's position, identity, level, variant, rotation and footprint. [Island save](island.json) · [Camera and layout receipt](original-views.json)

## Reproduce the boards

The before build uses `7033c7c09d466877ca64b4fa0a11cec85e6fe15c`. The after build uses `f3ec616a2aafb00c48e367b1825e3a5e4141ead9`. Check out each revision separately, install the game dependencies in each checkout and run a local preview from each directory. The two previews must use different ports.

```sh
# Before checkout
npm ci
npm run build
npx vite preview --host 127.0.0.1 --port 5352 --strictPort
```

```sh
# After checkout
npm ci
npm run build
npx vite preview --host 127.0.0.1 --port 5353 --strictPort
```

Run the capture from the checkout containing this document. The review tools use Playwright and `@napi-rs/canvas`. Supply the installed Chromium path through `CHROME_PATH`, or omit it to use Playwright's installed browser.

```sh
CHROME_PATH=/usr/bin/chromium node docs/review/government-services/capture.mjs \
  http://127.0.0.1:5352 http://127.0.0.1:5353 original
```

The capture checks the stage, time, appearance, layout and camera before writing each image pair. Use a production era such as `ancient-egypt` in the final argument to revisit the same quarter in another appearance. [Capture entry point](capture.mjs) · [Shared game camera](../../../scripts/review/civic-neighborhood.mjs)
