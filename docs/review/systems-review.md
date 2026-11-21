# Pixel Civilization — Systems Review (review_systems)

**Scope:** every simulation system in the current game (`main` @ `68542f5`). Line references are to that baseline
(`git show 68542f5:src/game/<file>`); `level_scaling` is already refactoring several of these files, so working-tree lines drift.
**Companion doc:** [`level-scaling-audit.md`](./level-scaling-audit.md) (per-metric level formulas + gap table).

**Method.** I read the code paths and ran tsx probes in `scripts/review/` against an untouched copy of the baseline:

| Script | What it shows |
|---|---|
| `cityKit.ts` | builds a grid city (streets every 9 rows, buildings fronting both sides, optional industrial street), switches it to real/survival, steps the sim |
| `probe-worlds.ts [mode] [sec]` | the three example islands run in real mode |
| `probe-early.ts`, `probe-mid.ts`, `probe-late.ts [mode] [sec]` | starter town (≈250 pop), stage 2–3 town (≈5k), dense L4–L5 city (≈74k) over time |
| `probe-variants.ts` | early-town variants (grocers vs farms, solar vs wind, extra waste, upgraded) |
| `probe-ledger.ts [early\|mid]` | money flow per ledger label |
| `probe-safety.ts` | crime / defense / fire / faith at forced stage 5–16 populations |
| `probe-traffic.ts` | congestion vs population and over a day |
| `stage-feasibility.ts [L] [cost\|tiles]` | analytic cost/tiles to satisfy each stage's per-capita demand |
| `dump-elements.ts`, `density.ts`, `dead-stats.ts`, `passive-check.ts`, `probe-wtp.ts`, `probe-save.ts` | catalog tables, per-tile outliers, unused stats, free nature services, hidden water switch, save robustness |

Run with `npx tsx scripts/review/<name>.ts`.

---

## 0. The five things that matter most

1. **The money loop is broken.** Trade tax is charged after wages have drained business cash, so it is always $0. Households
   collect every wage and have nothing to spend it on except groceries, so they pile up savings: $250k in the mid town after 25 min, $430k in the late city.
   The treasury pays for every imported grocery. Result: the mid town loses −$9.5/s and the late city −$370/s, and the city goes bankrupt while its residents are rich.
2. **The population cap is invisible.** Population settles at `min(jobs/0.5, food/0.28, waste/0.28, …)`, a value computed only
   inside the growth step. The HUD shows a different "capacity" (21× housing) and the advisor says "thriving". In every probe
   one metric sat exactly at its cap (usually **waste**) while happiness was 75–99.
3. **Late game is impossible as tuned.** Defense needs 130k power at 500k pop (≈105 Lv.5 military bases). Crime needs 160k
   police points. Stage 20 needs about $33M–68M of buildings and 8k–42k tiles, which is more than the island holds.
   Meanwhile the treasury earns about 15% of exports.
4. **Day/night makes happiness swing.** Solar drops to 18% at night, traffic peaks at rush hour (11% → 69% in the mid town), and crime is ×1.45 + 10 at night.
   Each of these cuts happiness on the spot, so population rises and falls every 120 s day. In real mode the player can also
   **freeze the clock at noon and the weather at clear**, which removes all of it (an exploit).
5. **About 46 elements' `income` does nothing** and also exempts them from upkeep. Passive nature hands out free water and
   recreation with no road and no upkeep. Food runs on 2.35^(L-1)/2.25^(L-1) curves while everything else uses 2^(L-1).

---

## 1. Population

**How it works**
* Base housing: `Σ popBase × 2^(min(L,5)-1) × LVpop × synergy × (1+walking)` over connected, unburnt homes
  (simulation.ts:1258). `LVpop = 0.75 + 0.4·clamp(LV,0,2)` (cityDynamics.ts:356), so 0.75–1.55. Synergy is `1+0.12·min(4,n)` (cityDynamics.ts:351).
* `population = base + growthPool`, with `growthPool ∈ [−0.8·base, 20·base]` (30× in god) (simulation.ts:1305-1307). Sanctuary
  shelter can floor it (faith.ts `sanctuaryPopulation`).
* Growth step (simulation.ts:2680-2717), each second:
  * `supplied = max(baseRaw, min(reachableJobs/0.50, food/0.28, waste/0.28, pop+(water−waterDemand)·35, pop+(power−powerDemand)·45))`
    (survival: food/0.32). Note `baseRaw` here is `popBase·2^(L-1)` **without** the land-value, synergy and walking factors (BUG, :2685).
  * If `happiness ≥ 68` and `deficit ≤ 0.35` and nothing is burning, the pool grows by
    `max(1.2, 0.36·base)·max(.15,(H−58)/42)·(0.18+0.82·employed)·(1−0.8·shortage)` per second, up to `supplied`.
  * If `happiness < 65` or `deficit > 0.35`, residents leave at `max(1.5, 0.025·pop+4)·(65−H)/65` per second, ×3.4 in survival when H<50 or something is burning.
  * Between 65 and 68 nothing happens (dead band).

**Problems (evidence)**
* **The binding cap is never shown.** In the starter town pop stalls at 246 = 72 waste / 0.28. The mid town stalls at 5,443 = 1,524/0.28.
  Copper Gorge (real mode) stops at 2,000 = 560/0.28, and Switchyard at 3,775 = 1,057/0.28. Happiness reads 81–99 and the
  advisor reports nothing wrong, while `CityEconomyPanel.tsx:229` shows "Occupied / capacity 5,443 / 21,317".
* **Waste costs 8–10× more per resident than water or power.** Waste allows 3.6 residents per unit. Water allows 35 per unit
  of surplus, power 45. Waste is the binding cap in nearly every city (all 3 example worlds, mid town). Food (0.28/pop) is second.
* **Housing barely matters.** With a 20× pool, 4 Lv.5 skyscrapers cover the base housing for 3.8M people (`stage-feasibility.ts`).
  One Lv.1 house "contains" up to 105 people, so population is decoupled from the skyline the owner wants players to build.
* At the cap the city shows a permanent −3 "shortage" (`max(3,…)` minimum penalty, simulation.ts:1551) because demand
  uses `ceil`. The mid town shows a −3 waste shortage forever at its cap.

**Proposals (ranked)**
1. Compute `supplied` and its limiting factor once, in `recomputeConnectivityAndMetrics`, as `m.growthCap` and `m.growthLimiter`.
   Show "Population 5,443 / 5,443, limited by **Garbage**" in the HUD and add an advisor line when `pop ≥ 0.97·cap`.
   Replace the 21× "capacity" readout.
2. Rebalance the per-resident caps so all utilities are comparable: `waste/0.16` (demand `citizenUnits·0.8`), food unchanged,
   water `·20`, power `·25` per surplus unit. With these numbers waste stops being the only wall.
3. Cut the pool to `10·base` (real) and raise `popBase` by 1.6× across housing, so buildings carry a visible share of residents.
   Optionally let the pool ceiling grow with land value (`(6 + 6·LV)·base`).
4. Use the same base-housing value in the growth step as in recompute (store `m.baseHousingPop`).
5. Apply the minimum −3 penalty only when `demand − supply > 1% of demand`.

---

## 2. Happiness

**Formula** (simulation.ts:1517-1680). Starts at 100, then:

| Term | Formula | Max |
|---|---|---|
| Power / water / waste / jobs / food / education / recreation / government shortage | `max(3, round(deficitRatio × cap))`, caps 22/24/16/18/18/13/12/6; gov only at stage ≥ 3 | −129 total |
| Nuisance | `min(22, 5 × homesWithPollution>1.2)` | −22 |
| Traffic | if trips > 20 and congestion > 100%: `min(16, 0.12(c−100)+3)` | −16 |
| Crime | if crime > 12: `0.28 × crime` | −28 |
| Defense | stage ≥ 10, rating < 75: `0.25(75−rating)` | −19 |
| Disrepair (survival) | `clamp(4n + 30·n/total, 4, 35)` | −35 |
| Fire | `min(35, 9 × burning)` | −35 |
| Administration | `clamp(ceil(gov/pop),1,3)` whenever a staffed government exists | −3 (always ≥ 1) |
| Parks abundance | rec > 1.6 × demand | +5 |
| Land value | avg LV ≥ 1.0: `min(6, round((LV−0.9)·10))` | +6 |
| Local harvest | `min(3, 3·harvest/required)` | +3 |
| Faith | `round(8 × reach)` (+6 while the "joy" blessing is active) | +8 (+14) |
| Preschool | `4 × min(1, seats/(0.16·pop))` | +4 |

**Problems**
* **Values that swing within a day drive population up and down.** Starter town on solar: P46/37 by day, 8/37 at night. Happiness goes
  62↔80 every 120 s and population 199↔246. Late city: congestion 55%↔328% (rush hour), happiness 60↔75, population
  65.6k↔74k (`probe-late.ts`). The player can't fix this with layout. Only overbuilding (5.5× solar) helps.
* **Nuisance is all-or-nothing.** 5 polluted homes already cost −22, the same as 500. One landfill near one block caps the penalty
  (starter town −22; mid town −15).
* **Administration −1 is a pure tax** that also blocks the `happy_place` achievement once a government exists.
* **Requirements that can't be met** (defense, crime at scale, section 9/11) give a permanent −19/−28 floor at stage 10+.
  The forced-pop probe reaches happiness 0 at 500k.

**Proposals**
1. Feed happiness from **smoothed** values. Use an EMA of each deficit over about one in-game day (τ≈60 s, like `utilityStrain` at
   cityEconomy.ts:785) for power, traffic and crime. Keep instantaneous values in the UI with a "today" sparkline.
2. Nuisance: `pen = min(22, round(30 × affectedBasePop / totalBasePop))`, so it is weighted by residents and by level.
3. Drop the administration penalty, or make it +1..+3 when `gov ≥ demand` (civic pride).
4. Defense and crime rebalancing below. Also cap the sum of "security" penalties (crime + defense) at −20.

---

## 3. Supply & demand

Demand is based on `citizenUnits = ceil(pop/5)` (simulation.ts:1340).

| Need | Demand | Supply (L-scaled ×2^(L-1) unless noted) | Effect | Problem |
|---|---|---|---|---|
| Power | per-building draw `|p|·max(1,round(0.75M))` + `(pop−base)/45` | generators × weather × exposure × rail fuel; pumped storage reserve | −22; growth cap | solar 0.18 floor at night (cityDynamics.ts:421); `windSpeed` is a player slider in all modes |
| Water | per-building draw + `(pop−base)/35` | plants, towers, wells, nature, channel delivery, cathedral | −24; growth cap | **any terrain edit creates `state.infrastructure`, after which `water_treatment_plant` needs a river** (`probe-wtp.ts`: water 32 → 0 after a 1-tile raise 70 tiles away) — terrain.ts:1858-1865 |
| Waste | `1.4·units` = 0.28/pop | landfill/compactor/burner + edge "service" +2 | −16; **binding growth cap** | see section 1 |
| Jobs | `0.54·pop` workers (cityEconomy.ts:431, overrides the 2.2·units value at simulation.ts:1347 which is dead) | reachable jobs in road groups that contain residents | −18; cap `jobs/0.5` | fine. The dead write should go |
| Food | `1.4·units` (1.6 survival) | `shopping + harvest·0.52·(demand/required)` (cityEconomy.ts:584) | −18; cap `food/0.28` | over-scaled (2.35/2.25 curves); grocer imports drain the treasury (section 4) |
| Education | `1.3·units` | schools × district multipliers + ceremonial +2 | −13 | OK |
| Recreation | `1.2·units` | parks, faith, landmarks, **nature (free)**, waterfront homes `min(8,2L)` | −12 / +5 | bushes $10 for 5 rec, no road, no upkeep, so dominant (`passive-check.ts`) |
| Government | stage ≥ 3: `1.5·units·(1−civicRelief)` | offices/courts | −6 | 6 points is too small to matter. Gov matters mainly as the authority gate for police/fire/defense, which is good design but hidden |
| Police / crime | `capRatio = points / max(12, 1.6·units)` | police × 2^(L-1) | −28 | needs 0.32 points per resident (section 11) |
| Fire | crews `ceil(pop/50k)`; coverage = covered sites / all sites | stations: `min(L, staff)` crews; radius `r·(1+0.18(L-1))` | chance per roll | burned sites stay at 25% output **forever in real mode** with no advisor line (section 11) |
| Defense | `max(180, 140·sev + 1.3·units)` | roster + 0.15·military | −19 | 130k at 500k pop (section 11) |

**Per-dollar winners** (`stage-feasibility.ts`, Lv.5): landfill (waste), grocery/cheesesteak (food), businesses/factories (jobs),
country_schoolhouse/university (education), **bushes/beach_umbrellas (recreation)**, city_offices/government_buildings (gov).
Per tile: trash_burning_plants, cheesesteak, skyscrapers (jobs too), research_university, large_landmarks.

**Proposals**
1. Waste demand 0.16/pop (above). Water and power growth factors 20/25.
2. Water treatment: when `infrastructure` exists but the plant has no river, give it 50% output from groundwater instead of 0,
   and show "No river — groundwater only" in the inspector.
3. Nature services: count passive-nature recreation at 25%, and nature water only for ponds/lakes that touch fresh water.
   Keep the land-value and pollution benefits (that is where nature should shine).
4. Remove the dead `m.jobsNeeded = 2.2·units` write.

---

## 4. Economy

**How money moves** (cityEconomy.ts:640-860, every 0.75 s of play):
1. `outside → businesses`: exports `Σ income × 2^(L-1) × 0.24 × cooling(0.42 if industry not cooled) × bank × training × traffic(0.75 if congested) × (0.8+0.3·LV) × staffing`,
   × `(0.75+0.25·H)` × `(1−0.2·crime)` (:708). **Only a whitelist of ids exports** (:551-556).
2. `businesses → households`: wages `workers × 0.34` (:715), capped by business cash.
3. `households → treasury`: payroll tax 15% of wages. `businesses → treasury`: trade tax 15% of exports, but **charged after wages, so ≈0** (:719).
4. Grocers import when stock is low. `treasury → businesses` "working capital" covers the full import bill (0.8/meal), because businesses are always at ~$0 after wages (:745-756).
5. `households → businesses`: groceries 0.65/meal, plus 4% sales tax.
6. `treasury → outside`: upkeep `Σ cost·0.008·L^0.8 × 0.06` per second (:795-800). Housing, nature and **any element with `income>0`** are exempt (cityDynamics.ts:434-440).
7. Others: flight fares, rocket/plane visitor income, crime ±$25/35, fire recovery grant $120 once, 4 one-time city grants ($2.2k total, cityGrants.ts), construction `cost`, upgrades `cost·2.1^L`.

**Evidence** (`probe-ledger.ts`, per second, mid town ≈6.5k pop):
```
244.9  businesses->households Local wages
212.3  outside->businesses    Local exports
 45.2  businesses->outside    Imported groceries
 41.8  treasury->businesses   Grocer working capital   <- the treasury pays for every import
 36.7  households->treasury   Payroll tax
 36.6  households->businesses Household groceries
  8.9  treasury->outside      Imported upkeep supplies
  1.5  businesses->treasury   Sales tax
   0   businesses->treasury   Trade tax                <- ordering bug
```
Treasury net −9.5 to −12.5/s while households gain about $170/s (100k after 10 min). Late city: treasury −$370/s, households
+$500/s. Pelican Reach in real mode turns negative after 100 s (−$16.7/s). Starter town: treasury +$0.25/s with 2 grocers,
+$2.9/s with 3 farms instead (`probe-variants.ts`).

**Other problems**
* **Treasury income ≈ 15% of exports and has nothing to do with population.** Homes create no revenue, so the money strategy is to
  spam whitelisted businesses/factories and build the minimum housing (the 20× pool supplies the workers).
* **46 elements have a dead `income`** (`dead-stats.ts`): every store except `shops`, banks (115), malls (145), skyscrapers (160),
  condos, villas, mansions, tax office (75), docks, transit, all landmarks (90–380). Because `income>0`, they also pay no upkeep.
  The build dock still shows "+$income" (BottomDock.tsx:82). The whitelist also names a non-existent id `bakeries`.
* **Wealth thresholds count household savings.** In the starter town (248 pop) household savings pass $5k in ~4 min and $20k in ~20 min,
  so stage-1 "wealth projects" unlock almost at once, while the treasury (+$0.25/s) can't pay for them.
* Tax is fixed at 15% outside god mode (`effective` returns raw), so the player has no economic lever.
* `tycoon` ($1M treasury) can't be reached in practice.

**Proposals (ranked)**
1. **Fix the loop.** (a) Collect trade tax right after exports, before wages. (b) Add household consumption: every tick households spend
   `min(households, 0.012·households·t + 0.25·wages)` at commerce sites (split by each site's `income×M`), and businesses pay 8%
   sales tax on it. That turns the dead `income` stat into domestic revenue. (c) Grocers buy imports from their own cash. The treasury credit is limited to
   `0.25 × payroll tax` per tick, and the retail price becomes 0.95/meal so imports break even.
   Expected result (rough): mid town treasury from −$10/s to about +$45/s, with household savings levelling off around 80× wages/s instead of growing forever.
2. **Every `income>0` element earns.** Commerce earns from household spending (above). Landmarks, docks and airports earn tourism from outside: `income × M × 0.24 × (0.75+0.25H)`.
   Remove the upkeep exemption from any element that does not export.
3. Wealth thresholds use `treasury + businesses` (or peak treasury), not households.
4. Unlock a tax slider in real mode (5–25%). Each +1% over 15 costs 0.6 happiness and +1% emigration pressure. Under 15 gives +0.4 happiness per point.
5. Fill the gap in the grant ladder: about 12 grants tied to stages and achievements ($1k → $250k), so stages give a money boost.

---

## 5. Stages & progression

**How:** `stage = max s with pop ≥ minPop(s)` (simulation.ts:1313-1334). Thresholds go from 1k to 3.8M (catalog.ts:116-137). Unlocks are by
`highestStageReached`; wealth projects are gated by `peak wealth`. Survival is game over after 360 s below the highest stage's
`minPop` (cityEconomy.ts:845-858).

**Evidence** (`stage-feasibility.ts`, cheapest buildings per dollar that meet the per-capita demand):

| Stage | Pop | All Lv.5: cost / tiles | All Lv.1: cost / tiles |
|---|---|---|---|
| 3 | 15k | $0.22M / 514 | $0.09M / 1,441 |
| 5 | 85k | $1.1M / 2,598 | $0.49M / 7,812 |
| 10 | 500k | $4.4M / 5,525 | $2.0M / 16,386 |
| 13 | 1.02M | $8.9M / 11,218 | $4.1M / 33,388 |
| 20 | 3.8M | $32.8M / 41,700 (densest: $68M / 8,172) | $15M / 124k |

The main island has about 10k land tiles (all islands maybe 15–20k), and every building also needs road frontage. With the
treasury at about 15% of exports (late city about $190/s gross before the grocer drain), stage 13+ takes tens of hours, and
stage 16+ doesn't fit on the map unless everything is Lv.5 and the densest type.

**Proposals**
1. Compress the upper thresholds and add **per-capita economies of scale** at higher stages:
   `serviceDemandPerCapita × max(0.5, 1 − 0.03·(stage−1))`.
   Suggested `minPop`: 0, 1k, 10k, 25k, 50k, 80k, 120k, 170k, 230k, 300k, 380k, 470k, 570k, 680k, 800k, 930k, 1.07M, 1.22M, 1.38M, 1.55M.
2. Survival recovery: base the benchmark on the **current** stage minus one, and use a smoothed population (EMA), so a rush-hour dip doesn't start the clock.
3. Show "next stage needs X more residents; your current limiter is Y" (ties into section 1).

---

## 6. Land value, pollution, synergies, districts, farms, campuses

**How**
* Pollution field: emitters `p × (1+0.3(L-1))`, radius `2.5+1.6√strength`. Absorbers are negative, ×0.6, clamped to [−2, 12]
  (cityDynamics.ts:265-290). Homes with pollution > 1.2 get `nuisancePenalty` (simulation.ts:1184-1186).
* Land value: base 0.5, plus coast 0.25, plus desirability splats, minus 0.11·pollution, plus 0.05·cleanliness, clamped to [0, 2]. It feeds `LVpop`
  (0.75–1.55), exports `(0.8+0.3·LV)` and the happiness bonus at an average of ≥ 1.0.
* Proximity synergies: 17 rules (cityDynamics.ts:187-205), +12% each to **all** outputs, up to +48%.
* District synergies (districtSynergies.ts): 4 edge-pair types (athletic campus, feed production, innovation district,
  orchard pollination). +12–24% to one output, capped at ×1.6, and only through farm/orchard/ceremonial edges.
* Farm complexes (farmNetworks.ts): modules connected through farm edges to a road-facing anchor. `complexBoost = 1+1.6(1−e^{−n/38})`
  (up to ×2.6). Ponds irrigate dry growers. Silos reduce spoilage.
* Campus training (cityEconomy.ts:451-458): schools in a road group train `education×M / (0.35·groupPop)`, which raises jobs by up to 12–16%,
  exports by up to 14–18%, and skilled share.

**Problems**
* Pollution scales 2.2× at Lv.5 against 16× output (audit #20), so polluters get cleaner per unit as they upgrade. Absorbers (trees) scale the same way.
* Nature is the strongest tool on every axis at once: free recreation and water, pollution absorption and land value, with no road and no upkeep.
* The `irrigated` proximity rule is removed and re-added through bank/irrigation (simulation.ts:1181-1184). Fine.
* District synergies are small and hard to discover (they need the exact edge kind). That's fine for flavour, but the UI must show them.

**Proposals**
1. Emitters `p × 2^((L-1)/2)` (4× at Lv.5). Absorbers the same.
2. Synergy multiplier applies to **pop and income only**, not utilities. Doubling waste/power through adjacency is confusing.
3. Make farm complexes the showcase: keep `complexBoost`, and switch the crop curve to `food × M × tiles(L)/tiles(1)^0.5` so that farms that spread out are rewarded.

---

## 7. Roads, traffic, street demand, entrances

**How**
* Routes (roadTraffic.ts:57-200): road tiles become nodes, and building gates attach through `roadSiteAccess`. Each site BFS-searches to its
  first 5 reachable gates, plus one full survey per district, and keeps **3 destinations** (first, middle, last).
* Demand (streetDemand.ts:15-92): `trips(site) = max(1, tripsFor(def)) × 1.7^(L-1) × rushHour(t)`, where tripsFor = `popBase/6 + jobs/10 + 2 (commerce) + 6 (landmark)`.
  Transit riders remove up to 70% of a site's trips. The "roads" blessing gives −18%. Volume is spread along each route path.
  `congestion = Σtraversals / Σcapacity(used tiles)`. Capacity: `ROAD_CAPACITY × lanes(L)/lanes(1) × (1+0.17(L-1)) × 4`.
* Effects: −25% exports for congested sites (load > 1.15) and the happiness penalty above.

**Problems**
* **Traffic ignores population.** Mid town at 4.9k, 9.9k and 54.9k residents: 1,327 trips and 69% congestion in all three
  (`probe-traffic.ts`). The 20× growth pool adds people who never drive.
* **Swing over a day:** 11% at night → 69% at 8:00 → 42% midday → 68% at 18:00. Combined with the instant happiness penalty, this causes the late-city oscillation.
* `transitRelief()` and `TRANSIT_RELIEF` are dead code (cityDynamics.ts:143-150, 365-368).
* Only 3 routes per site, so a building's real street load depends on which three gates happened to be chosen. Results are hard to predict for the player.

**Proposals**
1. Homes: `trips = residentsAllocatedToHome / 6` (population share, as in cityEconomy.ts:403-410). Workplaces: `workers/10`. Others keep `tripsFor × M^0.75`.
2. Happiness uses the **daily average** congestion. The instant value is still used for car rendering and the −25% export hit.
3. Delete the dead transit relief code, or use it as a cap per stop.

## 8. Rail & transit (summary only — the trains agent reviews this in depth)
Lines run between depots and stops (mobility.ts). Riders come from catchment demand `(0.6·popBase + 0.14·jobs + …)·√L`
(mobility.ts:262-271). Completed trips relieve nearby road demand, up to 70% per site. `transitReadout` also **links road components** for jobs and
connectivity (simulation.ts:1160). Freight boosts power, waste and farm output through `railFreightBonus`. Car limits [3,4,5,6,8] by depot level.
Issues seen from the systems side: transit demand ignores the growth-pool population (same as traffic). There is only one transit grant ($750 for 35% share).
Being "served" doesn't feed happiness except through less congestion.

## 9. Maritime / docks
Vessels count only when a ferry path leads to a harbor (`hasNavigableHarbor`, mobility.ts:570-582). Otherwise they are disconnected
and flagged "no home port". Docks/shipyards give jobs, food (dead stat) and income (dead for docks). Naval units feed the defense roster.
**Upgrading a vessel grows its hull** (travelNetwork.ts:48-60) and can make it unable to reach its own harbor (audit #55).
Proposal: docks export `income × M` as "fishing & cargo". Check harbor reachability with the Lv.1 hull, or warn before upgrading.

## 10. Faith
`strength = Σ 32 (graveyard 19) × (1+0.45(L-1))`; `reach = strength/(strength + 35 + 1.45√pop)`. This gives happiness +8·reach,
crime −12·reach, government demand −15%·reach, and fire-fighting speed +22%·reach (faith.ts:58-75). LDS temples shelter residents during fires and
invasions, roll blessings every 55–135 s (55% chance, 36–66 s), and have a 4–8% chance to ward off an invasion.
**Probe:** 3 Lv.4 churches give +3 happiness at 90k, +2 at 210k and +1 at 500k+. Faith fades to nothing in big cities because only 2.8× level scaling meets √pop.
Proposal: strength × `M^0.75`, and reach uses residents **within the faith building's catchment** (local parish) instead of the whole city.
Blessings are a fun random-event system. Show the next roll and let any faith building (not just LDS temples) host weaker ones.

## 11. Disasters: fire, crime, invasions

**Fire** (projectOperations.ts:256-575). From stage 4, a roll every 90–220 s with
`chance = base(4% real / 12% survival) × (0.6 + 3.4·(1−readiness))`, where readiness = `min(1, crews/ceil(pop/50k), coverage)`.
Targets prefer uncovered, disrepaired and nuisance sites. Crews drive by road (boats by canal) and need water within 3 tiles or a fresh-water connection.
Putting out the fire takes 8 s (20 s for volunteers). After the fire, **`disrepair = true`**, which runs the site at 25% output.
* In real mode nothing clears disrepair except a manual click, and there is no advisor diagnostic outside survival (simulation.ts:1631). Burned
  buildings stay degraded without the player noticing.
* Coverage counts every site, houses included. 3 Lv.4 stations in the late grid reached only 55% coverage, so the risk was 8.5% per roll.

**Crime** (simulation.ts:1418-1475, 2610-2650). Unlocks at stage 5 and 85k. Raw =
`42·uncovered + 20·(1−capRatio) + 17·unemployment + 18·foodShortage + stress − amenities`, then ×1.45+10 at night, minus faith.
`capRatio = points / max(12, 1.6·citizenUnits)`, which is 0.32 points per resident.
Probe (4 Lv.5 police departments = 9,600 points): crime 2%/15% (day/night) at 90k, 20%/49% at 210k, 36%/67% at 500k,
for −4…−19 happiness. Incidents move only $25–35 and 3 residents, so they don't matter beyond flavour.

**Invasions** (simulation.ts:1950-2460). Survival at stage 10+ gets a raid every 85 s after the previous one ends. Attacking forces scale with **stage severity only**:
3–8 ships, 4–11 tanks, 6–20 soldiers. A shield chance of `min(0.65, defensePower/300)` is reached with about 300 power.
* **The defense rating and actual combat don't line up.** The rating needs `1.3·citizenUnits`, which is 130k power at 500k pop, while one Lv.5 military base
  (about 1,200 power) already maxes the combat shield. In real mode there are no raids at all, yet the rating still costs up to −19 happiness forever.
  Probe: 3 Lv.5 bases = 3% rating at 500k, 1% at 1M.

**Proposals**
1. Defense: `required = 200 + 220·severity + 6·√pop` (500k → 4.7k, about 4 Lv.5 bases; 3.8M at sev 5 → 13k, about 11 bases). In real mode
   the penalty is capped at −8, and the rating is phrased as "deterrence".
2. Crime: `capRatio = points / max(12, 0.06·pop)` (500k → 30k, about 12 Lv.5 departments). Night `×1.25 + 4`. Scale incident loot to
   `0.5% of business cash` so incidents become noticeable.
3. Fire aftermath: in real mode disrepair from fire clears itself after 60 s (or costs `0.1·cost` to repair), with an advisor line `"N burned buildings at 25%"`.
   Coverage should count only non-housing sites plus homes weighted by residents.

## 12. Weather & day/night
A day lasts 120 s (`timeOfDay += 0.2/s`, simulation.ts:2583). Night is 19:30–05:30. Weather rolls every 42–70 s (45% clear, 27% cloudy,
18% rain, 10% storm). Effects: solar ×(cloud), wind ×1.1/1.35 in rain/storm, hydro ×1.25, dry farms 0.62→1.05 in rain, fire-fighting ×1.35 in rain,
cisterns fill, floodplain park adds waste capacity. Storms do no damage.
**Problems:** the time, weather and wind sliders are **not gated by mode** (ViewEnvPanel.tsx + App.tsx:689-729). A real or survival player can freeze noon
and clear skies and set wind to 2.5 (wind output ×1.7). Day length (120 s) drives every swing in section 2.
**Proposals:** in real and survival, the sliders only change the *rendered* lighting (a preview), or they are hidden. Smooth the simulation effects (section 2).
Give storms a small chance of flooding low cells or knocking down power lines, so weather becomes something to plan around.

## 13. Survival & maintenance
39 element types need maintenance every 300 s of connected play (simulation.ts:2652-2660). Disrepair cuts output to 25% and adds the
survival penalty (up to −35). Maintenance is **free** and has a "Maintain All" button.
Probe (`probe-early.ts survival`): every timer starts together, so at t=300 s the whole town fails at once. Happiness drops 80 → 0 and
population 246 → 16 in under 60 s (×3.4 emigration), and the town stays stuck at about 16 until the player clicks.
This is a chore that offers no decision, plus a cliff.
**Proposals:** stagger the first timer (random 180–360 s). Maintenance costs `0.02 × cost × L`. Add an "auto-maintain" toggle that spends
from the treasury at 1.25× that price. Disrepair penalty `min(20, 2n)`.

## 14. Achievements & grants
18 achievements (cityDynamics.ts:453-472, checks at simulation.ts:1698-1747). `tycoon` ($1M treasury) and `happy_place`
(100% with authority, since administration is always −1) are effectively locked in real mode. `pop_1m` needs stage 13 (see section 5).
4 grants pay a one-time total of $2.2k. **Proposals:** after fixing section 4, extend grants into a stage/achievement ladder with real money, and
re-check `tycoon` at $250k.

## 15. Save migration
Saves are plain JSON in localStorage (3 slots, saveSlots.ts) with **no schema version**. `cloneGameStateSnapshot` fills a few missing fields.
Economy, mobility and faith are created lazily. `probe-save.ts`: unknown element ids, missing economy and level 9 all load without
crashing (an unknown id becomes a disconnected element; level 9 counts as 5 for population but 2^8 in economy weights).
**Proposals:** add `state.schema = N` and a `migrate(state)` chain. Clamp `level` to `getMaxElementLevel`. Drop unknown defIds with a toast.
Once section 4 lands, migrate old saves' oversized household savings, e.g. move 50% into the treasury once as a "back taxes" event.

## 16. Level scaling
See [`level-scaling-audit.md`](./level-scaling-audit.md): 60 metrics. Main gaps: pollution (2.2×), radii (1.72×), defense roster (3.2×),
faith (2.8×), traffic trips (8.4×), upkeep (3.6×), flat parcel-edge bonuses, linear hydraulics/ponds/storage. Over-scaled: crops (30.5×) and
retail (25.6×). Dead: `income` on 46 elements, `food` on 6, `transitRelief`.

---

## Top-15 prioritized changes

| # | Change | Where | Why (evidence) |
|---|---|---|---|
| 1 | **Fix the money loop**: trade tax before wages; household consumption spend at commerce (`0.012·savings·t + 0.25·wages`, 8% sales tax); grocers pay imports themselves (treasury credit ≤ 25% of payroll tax; retail 0.95/meal) | cityEconomy.ts:708-770 | trade tax $0; treasury −$9.5/s (mid town), −$370/s (late) while households hoard $100k–430k |
| 2 | **Every `income>0` element earns** (domestic spending for commerce, tourism for landmarks/docks); remove the upkeep exemption for non-earners; drop the `bakeries` typo | cityEconomy.ts:551-563, cityDynamics.ts:438 | 46 elements' income is dead, including skyscrapers 160, banks 115, every landmark |
| 3 | **Expose the population limiter** (`m.growthCap`, `m.growthLimiter`) in HUD and advisor; replace the 21× "capacity" | simulation.ts:2691, CityEconomyPanel.tsx:229 | every probe stalls at an unseen cap (waste) while happiness is 75–99 |
| 4 | **Rebalance per-capita caps**: waste 0.16/pop; water ×20, power ×25 per surplus unit; minimum −3 penalty only above a 1% deficit | simulation.ts:1346, 2691, 1551 | waste allows 3.6 residents per unit vs 35/45 for water/power, and is binding in all 3 example worlds |
| 5 | **Smooth day-cycle effects** in happiness (EMA τ≈60 s for power, traffic, crime); happiness uses daily-average congestion | simulation.ts:1563-1615 | population swings 199↔246 (solar), 65.6k↔74k (rush hour) |
| 6 | **Gate time/weather/wind controls to god mode** (render-only in real and survival) | App.tsx:689-729, ViewEnvPanel.tsx | freezing noon or clear skies and wind 2.5 removes night crime, solar dips and rush hour |
| 7 | **Defense requirement** `200 + 220·sev + 6·√pop`; real-mode penalty cap −8 | simulation.ts:1476-1480 | 130k power needed at 500k (≈105 Lv.5 bases); combat shield maxes at ~300 |
| 8 | **Crime capacity** `max(12, 0.06·pop)`; night `×1.25 + 4` | simulation.ts:1458, 1468 | 4 Lv.5 departments → 67% night crime at 500k |
| 9 | **Traffic from residents and workers**, not building count | streetDemand.ts:23 | congestion 69% at 4.9k, 9.9k and 54.9k residents alike |
| 10 | **Compress stage thresholds 13–20** (to 1.55M) and per-capita demand × `max(0.5, 1−0.03(stage−1))` | catalog.ts:116-137, simulation.ts:1340 | stage 20 costs $33–68M and 8k–42k tiles on a ~10k-tile island |
| 11 | **Level-scaling consistency**: crops and retail to 2^(L-1); pollution `2^((L-1)/2)`; radii `1+0.25(L-1)`; upkeep `2^(0.6(L-1))`; defense roster and faith `M^0.75`; flat edge bonuses × M; ponds/storage/heat works × M | see audit | polluters 7× cleaner per unit at Lv.5; crops 30.5×; edge bonuses vanish |
| 12 | **Nature services nerf**: passive-nature recreation 25%, water only when touching fresh water | simulation.ts:1142, 1277, 1290 | 10 bushes = 60 rec for $100, no road, no upkeep; Lv.5 lake 384 water free |
| 13 | **Water-plant cliff**: groundwater 50% output when there is no river, plus an inspector message | terrain.ts:1858-1865 | water 32 → 0 after an unrelated 1-tile terrain edit |
| 14 | **Survival maintenance**: staggered timers, paid upkeep, auto-maintain, penalty `min(20, 2n)`; real mode auto-clears fire disrepair after 60 s with an advisor line | simulation.ts:2652-2660, projectOperations.ts:571 | survival town crashes 246→16 at t=300 s; burned real-mode sites stay at 25% unseen |
| 15 | **Wealth thresholds exclude household savings**; real-mode tax slider 5–25%; grant ladder | simulation.ts:504-506, cityEconomy.ts | stage-1 village unlocks $20k projects through household hoarding, but can't pay for them |

**Key numbers to re-check after changes** (all from the baseline probes):
* starter town: pop 246 (waste-capped), treasury +$0.25/s (grocers) or +$2.9/s (farms)
* mid town: pop 5,443 (waste-capped), treasury −$9.5…−12.5/s, households +$170/s
* late city: pop 74,000 (food-capped), treasury −$370/s, congestion 55–328%, defense 19% (forced stage 10)
* example worlds in real mode: Pelican 2,392, Copper Gorge 2,000, Switchyard 3,775, all stuck at stage 2
