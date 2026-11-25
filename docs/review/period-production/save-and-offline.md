# Saved islands and offline first visits

The production web build ran in new Chrome profiles. A local HTTPS server used the designated review hostname, resolved only to loopback, for personal-island access. No public account or island was touched.

| Check | Result |
| --- | --- |
| Preview without applying | Opening Forum City temporarily changed the drawn island and left its saved appearance Original. Cancel restored Original. |
| Apply and restore | Aqueduct City survived a reload with the same site count. Applying Original and reloading restored the starting state. |
| Personal island | A newly created island named Praeneste retained Forum City after reopening. |
| First optional art request | Before selection, the Original island downloaded zero optional packs. Applying Ancient Egypt downloaded its pack once together with the shared geometry module. |
| Offline island | With the network disabled, all 15 sites in the test island reopened in Ancient Egypt. |
| Offline Atlas | The house at level 2, variant 3 rendered. Keyboard rotation and touch reset worked. |
| Independent first entry | Opening a shared Atlas or Handbook link in a fresh profile, going offline and reloading reopened the selected house in both Ancient Egypt and Forum City. |
| Offline type | The island, Atlas and Handbook displayed DM Sans on a visible control. Fetching the font offline produced the 36,932-byte WOFF2. |

The first-download test delayed the worker's shell installation by 8.5 seconds, long enough for the game to begin loading art independently. Before the fix, both Egyptian art files were absent after the worker became ready, and the Handbook model failed offline. With the fix, the selected pack and shared geometry were available on reload. The game also caches the shared stylesheet, font and browser icons.

The checks use [the save flow](../../../scripts/review/period-save-flow.mjs) and [the offline flow](../../../scripts/review/rome-offline.mjs). Set `OFFLINE_TEST_ERA` to a production era such as `ancient-egypt` to repeat the second test. Leaving it unset exercises Forum City.
