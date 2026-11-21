# Balance round 2 (level_scaling agent)

This round implements the top-15 list in `docs/review/systems-review.md`. Item 11 (level scaling) was finished
earlier, see `level-scaling.md`. The UI agent owns the tax slider, the auto-maintain toggle and the HUD readout for the
population limiter. This round adds only the state fields, the logic and one advisor line.

## Before / after (reviewer probes, real mode)

"Before" is HEAD 6845fb9, which already includes level scaling. "After" is HEAD plus this round's
`cityEconomy.ts` and `simulation.ts`.

| Probe | Before | After |
|---|---|---|
| Starter town (`probe-early`) | pop swings 203–246, stalled by waste; treasury +$1.0/s; households hoard $15k | pop 259–269; treasury +$9/s; households $9k. Still a small night dip on 2 solar panels, from utility strain. Advisor says "Growth limited by Power" |
| Early variants (`probe-variants`) treasury/s | grocers 2.00, farms 2.88, solar 0.28, upgraded 6.18 | grocers 12.2, farms 6.5, solar 7.3, upgraded 19.6. Population is the same or higher in every variant: more_waste 308, upgraded 672 |
| Mid town (`probe-mid`) | pop 5,443, stalled by waste (−3 forever); treasury −$10/s; households +$170/s, reaching $213k | pop **6,683**, limited by jobs; treasury **+$97/s**; households about +$90/s |
| Mid ledger | trade tax $0; treasury pays all imports ($41.8/s credit) | trade tax $24/s, sales tax $20/s, household spending $224/s, grocer credit about $0 |
| Late city (`probe-late`) | pop swings 46k ↔ 86k; treasury **−$350/s**; defense 36% (needs 22.6k) | pop **118k, stable at stage 5**; treasury **+$150–200/s**; defense 100% (needs 2.5k) |
| Pelican Reach, 600 s | 2,408, net −$16/s | **3,244**, net +$10/s |
| Copper Gorge, 600 s | 2,000, stalled by waste | **3,320** (jobs), net +$23/s |
| Switchyard City, 600 s | 3,775 | **6,811**, net +$171/s |
| Traffic vs population (`probe-traffic`) | 69% at 4.9k, 9.9k and 54.9k alike | 84% / 84% / **149%**, so traffic now grows with residents |
| Safety at 500k (forced population) | crime 31/61% day/night, defense 6%, happiness 0 | crime 24/39%, defense 100%. Happiness is still 0 because the probe forces population without building the services |
| Stage 20 (`stage-feasibility`, Lv.5, cheapest by cost) | $32.8M, 41,700 tiles | $8.3M, 6,815 tiles. Densest layout: $18.9M, 1,628 tiles. The island has about 10k land tiles |

The example islands grow 35–80% but stay at stage 2, because stage 3 needs 15k residents. Their limiter is jobs or
food, and it shows in the advisor. The treasury now funds expansion: Switchyard earns +$171/s.

Probe outputs are in the scratchpad (`level_scaling/before`, `level_scaling/after`). `stage-feasibility-v2.ts` in the
same folder is a copy of the reviewer's script with the new per-capita rules.

## What changed, by review item

1. **Money loop** (`cityEconomy.advanceEconomy`)
   - Trade tax is collected as exports arrive.
   - Households spend `min(savings, 1.2%·savings·t + 25% of last period's wages)` at staffed commerce, capped by each
     store's `income × level` capacity. Businesses pay 8% sales tax on it.
   - Grocers import with their own cash. Treasury credit is capped at 25% of payroll tax.
   - A meal costs 0.95 (was 0.65), so imports at 0.8 break even.
   - Wages are paid after spending and restocking, and firms keep 10% of their cash as working capital.
2. **Income**
   - Commerce earns from household spending (`SiteAccount.spending`).
   - Other sites with `income` (landmarks, docks, depots, post offices…) earn tourism exports of `income × M × 0.24`.
   - Sites with `income` now pay upkeep.
   - The `bakeries` id in the exporter list is fixed to `bakery_coop`.
3. **Population limiter**
   - `metrics.populationLimiter = { cap, limitingNeed }`, where the need is one of housing, jobs, food, waste, water or
     power. The formula is `populationLimiterFor`. `metrics.housingBase` is also exposed.
   - The growth step uses the same base and cap, which fixes the old mismatch where growth ignored land value.
   - The food cap also counts what each district's shops and farm gates can actually serve
     (`report.foodResidents`).
   - Residents drift away at 0.2%/s when population is above 102% of a jobs, food, housing or waste cap.
   - Advisor line "Growth limited by X" when population ≥ 97% of the cap.
4. **Per-capita caps**
   - Waste demand is 0.16 per resident.
   - Each surplus unit of water supports 30 residents, power 35, and each extra resident draws the same amount. The
     review proposed 20/25; with those, water or power became the new wall in starter towns.
   - Workforce is 50% of residents, so jobs no longer show a permanent −3.
   - A shortage of 1% or less gives no penalty.
5. **Day-cycle smoothing**
   - Happiness and the growth cap read `powerSupplySteady`: solar uses a day-average factor of 0.84 when clear
     (battery buffer), against a noon peak of 1.13.
   - They also read `congestionDaily` (rush hour averaged) and `crimeDaily` (14 h day, 10 h night). Incidents still
     use the current hour.
6. **Environment controls**
   - The App.tsx handlers for time, time lock, weather, weather lock and wind do nothing outside god mode.
   - Outside god mode, wind follows the weather.
   - Saves that already have locks are left as they are, because tests set locks on purpose.
7. **Defense**: required power is `200 + 220·severity + 6·√pop`. Outside survival the penalty is capped at −8.
8. **Crime**: police capacity is `max(12, 0.06·pop)`. Night crime is `×1.25 + 4` (was ×1.45 + 10).
9. **Traffic** (`streetDemand`): a home generates residents/6 trips, using its share of the whole population. A
   workplace generates staff/10, plus commerce and landmark visitors. A site with no economy record falls back to the
   old nominal rate.
10. **Stages**
    - Thresholds for stages 13–20 now run from 900k to 1.55M.
    - Per-capita service demand is multiplied by `max(0.5, 1 − 0.03·(stage − 1))`, using the highest stage reached.
      Jobs are not scaled.
12. **Nature**
    - Wild nature (passive, nature_terrain, not a water feature) counts at 25% for recreation.
    - Its water counts only where it touches fresh water.
13. **Water plants**: without a river they pump groundwater at 50% instead of 0 (`terrain.freshWaterFactor`). Advisor
    line "on Groundwater".
14. **Maintenance**
    - Survival: the first deadline is staggered over 180–360 s.
    - Maintenance costs `2% × cost × level` (`maintenancePrice`).
    - `state.autoMaintain` pays 1.25× that price automatically.
    - The disrepair penalty is `min(20, 2n)`.
    - Real and god mode: fire damage repairs itself after 60 s, with the advisor line "Burned buildings at 25%".
15. **Wealth, tax and grants**
    - Wealth-project unlocks use `unlockWealth` (treasury + businesses, so household savings no longer count).
    - `state.taxRate` defaults to 12% and is clamped to 5–25% (`taxRateOf`). Happiness is +0.4 per point under 15%
      and −0.6 per point over it, and higher tax adds emigration pressure. God-mode economic controls still override
      it.
    - 12 new stage development grants, from $1k at stage 2 to $250k at stage 20 (`metrics.stageReached`).

Other fixes:
- Vessels are judged against their home port with their Lv.1 hull, so upgrading a boat no longer strands it.
- Dead code is gone: `transitRelief` and the `m.jobsNeeded = 2.2·units` line.

## Tests

- New `tests/balanceRound2.test.ts` (8 tests): limiter, money loop, upkeep, tax, unlock wealth, stages, defense,
  maintenance stagger and price, fire repair, stage grants, night smoothing.
- Expectations changed on purpose:
  - `grants.test.ts` compares against the service grants only. The new stage grants pay on stage milestones, and that
    test town is at stage 1.
  - `levelScaling.test.ts` reads mall and bank earnings from `spending` and landmark-type earnings (post office) from
    `exportRate`.
  - `citySystems.test.ts` drops the dead `transitRelief` assertion.
- `"the canal district opens supplied and remains solvent"` was failing because the larger waste cap let the district
  outgrow its single small shop. It now passes unchanged: the food cap counts district distribution (5,400 residents,
  98% fed).

## Follow-ups (not mine)

- UI:
  - Tax slider (`state.taxRate`).
  - Auto-maintain toggle (`state.autoMaintain`).
  - HUD "Population X / cap · limited by Y" (`metrics.populationLimiter`) to replace the 21× capacity readout in
    `CityEconomyPanel`.
  - `ExpansionDetails` pond cistern (see `level-scaling.md`).
- Households still save in towns with little commerce. That is intended (build commerce), but it can be tuned with
  the spending capacity factor (0.24).
- Real-mode saves made with the time or weather locked stay locked until loaded in god mode. A one-line migration in
  the load path would clear them.
