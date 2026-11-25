# Ten-era release review

[Open the playable library](https://pixelcivilization.app/eras.html) or follow the [player guide](../../time-periods.md). Each time period includes three sample islands. Aqueduct City is the Ancient Rome production design. Forum City remains available as the alternate Roman pilot.

| What to inspect | Evidence |
| --- | --- |
| Models and working buildings | [490 contact sheets, flagship models and ten operation strips](art-and-cities.md) |
| The same city across eras | [Matched streets, districts, bridges, skylines, dusk and silhouettes](cities/index.md) |
| Frame times on the matched 156-site city | [Three desktop runs for each of eleven appearances](desktop-performance.md) |
| Dense-island play | [1,490-site timing and simulation comparison](../large-city-performance.md) |
| Personal saves and offline play | [Preview, cancel, save, reload, Atlas, Handbook and slow installation](save-and-offline.md) |
| Purchases and subscriptions | [Product catalog, verification and recovery](../../store-billing.md) |

On the 320-pixel phone layout and 1,180-pixel desktop layout, the release check opened all thirty illustrations, followed a playable 3027 tour and inspected the monthly catalog. The phone layout also opened a level-two house with the third variant in every production-era Atlas. [Reproduce the layout check](../../../scripts/review/period-release.mjs)

The public Rome checkout was opened on November 25, 2026 using a temporary game account. Stripe displayed SLF Media Group, the Ancient Rome product and $0.99. The live merchant configuration confirmed a single USD item, automatic tax and a required billing address. A separate Salt Lake City invoice preview showed $0.07 tax. No payment was submitted and the temporary game account was deleted. Signed fixture events exercised successful purchases, delayed delivery, repeated events, refunds, disputes and restoration. [Commerce tests](../../../tests/storeCommerce.test.ts)

The desktop, simulator and browser checks are available for review. Five independent recognition ratings and the agreed physical Android handset test remain open. The unlabeled boards and separately linked answer keys are included in the [comparison guide](cities/index.md#independent-recognition-exercise).
