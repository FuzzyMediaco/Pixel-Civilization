# Physical device review

Open [Device performance review](https://pixel-civilization-device-review.fuzzymedia.workers.dev/device-review) in the browser on the phone or tablet being tested. Choose one or three runs per appearance and tap **Start review**. Keep the tab in the foreground, in one orientation, until the results appear. Record the device and browser in your own test notes. The page does not infer whether a handset, simulator or desktop performed the run.

Read the on-screen table or download the JSON. Each complete pass has 11 samples and 660 rendered frames. Three repeats produce 33 samples and 1,980 frames. An interrupted pass retains completed samples locally with its actual count. Results include the game release digest, canonical city hash, viewport, drawing buffer and device pixel ratio; the page does not upload them.

The desktop and device runners share the camera path, daylight, clear weather, eight warm-up animation frames and 60 distinct renderer-frame measurements. Both open the level-four apartments model in variant three in the Atlas and wait for its first painted selection. The review records each iframe navigation’s elapsed time. The device uses its normal browser cache across appearances, whereas the automated desktop benchmark opens a new browser context per sample. Compare frame times on like hardware and treat the load timings with those cache differences in mind.

## Stage the separate host

From the repository, run `node scripts/review/stage-device-review.mjs PATH_TO_FINISHED_DIST FULL_GAME_COMMIT`. It verifies every existing game asset against its offline index and copies the build into a new ignored staging directory. The printed configuration points to the dedicated `pixel-civilization-device-review` Worker with the account-free era-preview handler.

Use `wrangler dev --local --config STAGED_CONFIG` for local testing or `wrangler deploy --config STAGED_CONFIG` to update just that review host. The four review files live outside the offline index. Compare the release digest shown on the page with the intended game build before recording a hardware result.
