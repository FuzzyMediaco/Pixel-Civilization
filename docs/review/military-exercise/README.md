# Lantern Yard

Import [Lantern Yard](lantern-yard.json) into the game to visit the same island. The operating district has a quarter-turned Beacon Carousel with five lantern berths and an Orbital Dial with two hatch leaves.

[Phone phase board](lantern-yard-phases.webp) · [390 × 844 exercise](390-standard/exercise.webp) · [360 × 740 exercise](360-standard/exercise.webp) · [390 × 844 reduced motion](390-reduced/exercise.webp)

The sequences show the same camera during training, landing, an island attack and the return to the docks. Each viewport folder includes the empty parcels and individual full-resolution frames. The [motion checks](motion-check.json) report counts and offsets from the live scene. The capture also checks that pausing holds each moving part in place.

## Reproduce

Start a local production preview on port 5396. With Playwright Chromium and FFmpeg installed, run the following from the repository root.

```sh
node --import tsx scripts/review/swarm-exercise.mjs http://127.0.0.1:5396 /tmp/lantern-yard
```
