# Large-island gameplay performance

Measured on Windows with Chrome, Intel Iris Xe graphics, a 1050 × 690 viewport and device pixel ratio 1. The large test uses an authorized local copy of a 1,490-site city with about 280,000 residents. The small test uses a 15-site settlement. Each run opens a fresh browser profile, frames the same location, warms it for four seconds, then measures sixteen seconds with the Chrome sampling profiler active. The city continues to simulate and autosave. Each version runs through the ordinary game renderer and simulation.

## Results

The three-run median frame interval for the large island fell from 133.4 to 33.3 ms. Median scene synchronization fell from 82.2 to 12.5 ms, an 85% reduction. The 95th-percentile frame still took 83.4 ms in two optimized runs. One optimized run was slower than every baseline run during substantial host contention. Large-city performance on this machine varied throughout testing.

| 1,490-site run | Rendered frames | Median frame | P95 frame | Median scene sync | P95 scene sync |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original 1 | 141 | 133.3 ms | 199.9 ms | 75.9 ms | 93.2 ms |
| Original 2 | 101 | 166.6 ms | 233.4 ms | 86.7 ms | 110.0 ms |
| Original 3 | 131 | 133.4 ms | 233.3 ms | 82.2 ms | 98.0 ms |
| Optimized 1 | 60 | 249.9 ms | 450.1 ms | 29.9 ms | 200.9 ms |
| Optimized 2 | 415 | 33.3 ms | 83.4 ms | 12.5 ms | 17.6 ms |
| Optimized 3 | 421 | 33.3 ms | 83.4 ms | 12.4 ms | 18.1 ms |

The 15-site settlement held a 16.7 ms median frame interval in both versions. Its P95 was 16.8 ms originally and 17.0 ms after optimization. Its median scene sync took 0.8 ms originally and 0.3 ms after optimization.

The baseline used revision `9d5ab66`. The upgrade used the performance changes integrated in `380b0cf`. All six large-island runs rendered approximately 1.29 million triangles from the same camera. The initial CPU trace attributed about 2.3 seconds of its 16-second sample to walking through building lists and about 1.4 seconds to computing parcel edges. The optimized traces placed other work at the top, including Three.js scene traversal, drawing, and simulation. Browser windows and the local machine's other workloads can affect these timings.

## What changed

- Walkers, emergency crews and the ground-level camera query nearby building footprints from a grid. When a corner pushes someone into the next grid cell, collision resolution continues there in the original building order.
- The renderer and simulation recognize unchanged lots across quarter-second simulation updates. They reuse frontage, road connections and terrain-dependent model information until a relevant building, grade, street or terrain input changes. Live staffing, utility and service calculations still use the current buildings.
- Placed scenery reuses static transforms and materials. Vehicles, walkers, rotating parts and building animations keep advancing. Smoke particle transforms and colors reuse their existing buffers.
- Routine device checkpoints queue serialization for an idle browser callback with a 750 ms deadline. Navigating away or switching worlds flushes the current save immediately.

## Gameplay comparison

A fixed-clock replay ran the same private save on both revisions for 80 quarter-second ticks. Snapshots at tick 0 and every tenth tick through tick 80 produced identical state digests. The comparison excludes the process-local transit-line route cache version. Population, resources, individual buildings, positions, paths, service state and save contents otherwise participate in the comparison. The replay script prints digests and the site count only.

The 31 targeted tests covered dense and sparse collisions, overlap and corner resolution, lot edits and rotations, road and bridge approaches, driveways, freight entrances, farm performance and ordinary play. The indexed resolver was also compared with a full ordered building scan across thousands of positions.

## Repeating the review

Use a private JSON file containing the decoded game-state object and two separate checkouts of the game. Install the project dependencies and start each ordinary development server on a different localhost port. Run the following against each checkout using the same browser, camera, save and viewport. Keep the private input and raw output outside the repository.

```powershell
$env:PROFILE_FIXTURE = 'C:\path\to\local-world.json'
$env:PROFILE_ORIGIN = 'http://127.0.0.1:5394'
$env:PROFILE_REPORT = 'C:\path\to\baseline-profile.json'
$env:PROFILE_WARMUP_MS = '4000'
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node scripts/review/city-performance.mjs

$env:PROFILE_SOURCE = 'C:\path\to\baseline-checkout'
node --import tsx scripts/review/city-replay.mjs
```

Point the same driver at the other localhost port, report path and checkout for the comparison. The frame interval counts rendered frames. Renderer synchronization measures elapsed time for applying the current game state to the scene. Input latency requires a separate test. A physical mobile device or a different graphics processor needs its own measurement.
