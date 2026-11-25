# Ancient Rome pilot review

[Compare the two playable directions](https://pixel-civilization-rome-preview.fuzzymedia.workers.dev/rome-review). The public game remains at [pixelcivilization.app](https://pixelcivilization.app/).

## Where the earlier work stopped

The public game reported commit `15e3db5`. The GitHub branch `feature/rome-era-pilot` pointed at the same commit. Its tree contained the shared Atlas and Handbook, but no time-period resolver or Roman model pack. A separate multiplayer branch carried the earlier design outline. The Rome Cloudflare Worker existed with an assets-only handler, but its game, Handbook and field-guide addresses all returned HTTP 404. This pilot starts from `d8da1b4`, which also includes the newer City Issues navigation fix. The preview has its own hostname and browser saves.

## What to try

| Stop | Action |
| --- | --- |
| [Starter street](https://pixel-civilization-rome-preview.fuzzymedia.workers.dev/#world=rome-starter&era=rome-forum&view=0) | Open More → View → Time period. Preview Aqueduct City, cancel, then apply it. Reload and switch back. The same parcels and progress should still be there. |
| [Working district](https://pixel-civilization-rome-preview.fuzzymedia.workers.dev/#world=rome-district&era=rome-aqueduct&view=0) | Inspect the market, board the passenger line and follow the water into the baths. Look down the ramp to the bridge. |
| [Mature city](https://pixel-civilization-rome-preview.fuzzymedia.workers.dev/#world=rome-skyline&era=rome-aqueduct&view=0) | Orbit the observatory, terraced homes and public district. Open Details → Field guide on a building and compare its exact level and variant. |
| [Handbook practice](https://pixel-civilization-rome-preview.fuzzymedia.workers.dev/handbook#course=rome-flow&era=rome-aqueduct) | Repair a water connection, read the measured change, open the model and return to the lesson. The exercises have their own reset. |
| [Atlas](https://pixel-civilization-rome-preview.fuzzymedia.workers.dev/field-guide?id=grocery_store&era=rome-forum&level=4&variant=3) | Orbit the Forum Market, change the level and switch directions. Compare its original identity, function, parcel and benefit. |
| New island | More → Saves → New island lets you choose the mode and time period together. Existing and unknown appearance keys open as Original. |

## Coverage

The current catalog has **294 base elements, 1,534 levels and 6,136 level/variant selections per era**. The Rome pilot authors **25 types, 161 levels and all four variant slots**, yielding **644 selections per direction**. The other 269 catalog types and player-designed elements use their original designs. Both Rome directions share 20 stage treatments, interpreted in their respective materials. The [catalog and stage inventory](coverage.json) distinguishes authored entries, custom work, fallbacks and review status.

The original appearance remains the default. A shared recipe supplies the map, placement previews, Atlas meshes and illustrated model cells. The period describes appearances and aliases. Gameplay continues to use canonical IDs, route and parcel geometry, costs, benefits and unlock requirements. A temple-like solar court still supplies power. The armillary observatory still functions as a spaceport. These, the guided passenger carriages and the Roman transit depots are invented gameplay equivalents.

## Art review

Compare the [initial models](pass-0.webp), [first revision](pass-1.webp) and [second revision](pass-2.webp). The first critique exposed overly similar silhouettes. Forum City gained open civic courts and market pavilions. Aqueduct City gained stepped brick residences, raised grain stores and tower cisterns. The second pass improved service indications, rear façades, bridge approaches and the changing details on the passenger vehicles. The linked [Atlas and practice guide](handbook.md) includes phone and desktop screenshots and the exercise results.

**Proposed art direction.** Aqueduct City gives the working water and terraced districts the strongest identity. Forum City gives the market and civic square clearer open space. Use the comparison on the same street and skyline to decide which should lead the full Roman pack.

## Tested in play

The [nine-frame sequence](events.webp) shows ten units of grain arriving at the grocery, fourteen passengers boarding at Porta Fluminis, and the bathhouse going from 13 potable water to zero and back to 13 after an aqueduct repair. The [simulation receipts](events.json) name the train, station or water connection that triggered each change.

Compare the [matched world captures](captures.json), [desktop measurements](performance-desktop.json) and [verification notes](verification.md). The three islands contain 15, 93 and 156 sites. Each view uses one saved layout, a fixed camera and the same time of day in each direction.

## Sign-off and production waves

The ten briefs and proposed waves are in the [attached design plan](../../design/time-period-design-plan.md). This preview covers the foundation and Rome comparison. Full Rome, the other nine era packs, and any public release are separate approval decisions.

For the recognition review, have five people independently open the [six-picture recognition exercise](https://pixel-civilization-rome-preview.fuzzymedia.workers.dev/rome-review?study=1) and record their answers before revealing its key. For a blind session without the pilot hostname, display the [lettered board](review-board.webp) full-screen. Record the build, viewport and direction guess separately for each view. At normal zoom, record which of home, market, utility, depot and landmark they can point to. The proposed targets are four of five correct era matches per view and at least four of those five functions recognized. A two-direction Roman comparison tests the Roman art choice. Cross-era recognition needs the actual neighboring approved packs in a later wave.

| Reviewer | Street guess | Skyline guess | Recognized functions | Confusing silhouette or obscured entrance |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

Run the [device benchmark](https://pixel-civilization-rome-preview.fuzzymedia.workers.dev/handbook/era-pilot/benchmark.html) on the agreed mid-range Android phone. It collects three traces per appearance. Record the device, browser, refresh rate, memory, first Atlas model time, downloads and median frame time. The proposed gates are at least 30 fps on that phone and median frame time within 15% of Original. A desktop phone-sized viewport establishes layout behavior only.

**Decisions for Brigham.** Choose the lead direction, identify any silhouettes that need another pass, and set the device and download budgets after reviewing measured evidence. The remaining 269 Rome types amount to about eleven batches of the pilot's 25-type size. That is a coverage estimate. Flagships, unique game-state reactions, cross-era comparisons and device reviews need individual scheduling after the pilot.
