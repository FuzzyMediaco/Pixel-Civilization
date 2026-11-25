# All-era desktop performance

Each appearance ran three times on the same 156-site Colonia Alta layout in headless Chrome 157.0.8103.79 on Windows. Chrome rendered directly on Intel Iris Xe graphics through Direct3D 11. The viewport and drawing buffer were both 1,000 × 700 at 1× density. This is a physical desktop GPU measurement. A phone has different graphics, memory and power constraints.

Each run opened a fresh browser profile, set the camera to the same midday clear-weather view and timed 60 actually rendered frames on the same orbit. Each run then opened the Apartments model at level 4, variant 3 and timed the first successful draw from navigation. All 33 parcel-layout fingerprints matched.

The table gives the median of three runs. Heap is the browser’s live JavaScript allocation at the end of the orbit and varies with garbage collection. The last column counts the downloaded response bodies of optional art modules on a cold local connection. Hosting/CDN compression can change wire sizes. The shared optional geometry engine is counted for every new profile.

| Appearance | Median frame, ms | 95th percentile frame, ms | Heap, MiB | First Atlas model, ms | Optional art, bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original | 16.7 | 33.7 | 272 | 1,137 | 0 |
| Ancient Egypt | 16.7 | 33.6 | 332 | 1,085 | 12,032 |
| Ancient China | 16.7 | 33.7 | 338 | 1,232 | 12,032 |
| Ancient Rome · Aqueduct City | 16.7 | 33.6 | 334 | 1,090 | 29,228 |
| Ancient Greece | 16.8 | 33.6 | 335 | 1,185 | 12,033 |
| Medieval Europe | 16.8 | 33.6 | 349 | 1,821 | 12,034 |
| Renaissance Italy | 16.8 | 33.6 | 342 | 1,534 | 12,036 |
| World War II | 16.8 | 33.5 | 323 | 1,319 | 12,031 |
| Art Deco | 16.8 | 33.6 | 324 | 961 | 12,027 |
| Future 3027 | 16.7 | 33.6 | 335 | 1,020 | 12,030 |
| Post-apocalyptic | 16.8 | 33.5 | 331 | 899 | 12,035 |

[Raw measurements](desktop-performance.json) · [Repeat the benchmark](../../../scripts/review/production-performance.mjs)
