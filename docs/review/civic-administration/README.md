# Civic Administration Square

[Open the island fixture](island.json) through **More → Saves → Import & export → Import backup** on a game version containing the three civic campuses. The Climbing-Wall City Offices stand to the west, the Levitating Civic Tower occupies the northern block and the Civic Exchange Viaduct sits on the east side. All three connect to local streets.

| Phone comparison | Campus |
|---|---|
| [District](original-district.webp) | All three campuses in a neighborhood of small homes, gardens and shops |
| [Climbing wall](original-climbing-wall.webp) | Level 4 · Switchback Terrace Hall |
| [Levitating tower](original-levitating-tower.webp) | Level 5 · Orbit Council |
| [Viaduct](original-viaduct.webp) | Level 4 · Lantern Truss Hall |

Each panel uses the actual game renderer at 390 × 844 CSS pixels with the HUD hidden and reduced motion enabled. The first column leaves the three construction sites empty. The second adds the three offices. Both sides use the same 79 surrounding parcels, street layout, camera, 14:00 daylight and clear weather. The fixture uses the God-mode island's stage-eight population. The photographed tower includes the final skyline-height revision. The after preview served offline edition `709649d821d2`. [Camera settings and layout fingerprints](original-views.json).

Start a local preview of the game before the new buildings and one with their merged models. Run the capture from the latter checkout with Node 24 and project dependencies installed.

```sh
CHROME_PATH=/usr/bin/chromium node --import tsx scripts/review/civic-neighborhood.mjs \
  http://127.0.0.1:5310 http://127.0.0.1:5311 original \
  docs/review/civic-administration docs/review/civic-administration/views.json
```

The [capture plan](views.json) identifies all three omitted parcel IDs and the four camera positions. The runner checks the transfer file, the settled status of every parcel, the before and after layouts, dimensions, camera, time and weather settings.
