# Civic neighborhood

[Civic neighborhood save](island.json) opens through **More → Saves → Import & export → Import backup**. The five civic buildings occupy the two blocks at the middle crossroads. The public library and courthouse share the western block. The post office and city offices share the eastern block. The bank faces them across the street. The farm, water plant, grocery, railway depot and stops sit among smaller homes and shops.

[District at phone zoom](original-district.webp) · [Closer street view](original-street.webp) · [Grayscale overhead](original-overhead.webp)

Each panel uses the game renderer at 390 × 844 CSS pixels, 1× density, with the HUD hidden. The stage-eight island stays paused at 14:00 in clear weather. The [camera and layout receipt](original-views.json) records the camera position, angle, field of view and a SHA-256 fingerprint covering each parcel’s ID, element, position, footprint, rotation, level and variant. The capture stops if those values differ between builds.

Run two local previews and compare them from the repository root. The capture uses the same optional Playwright and Canvas dependencies as the other game review tools.

```sh
CHROME_PATH=/usr/bin/chromium node --import tsx scripts/review/civic-neighborhood.mjs \
  http://127.0.0.1:5218 http://127.0.0.1:5199 original
```

Replace `original` with a production era such as `ancient-egypt` to capture the same streets, camera and daylight in that appearance. The optional final argument supplies another output directory.
