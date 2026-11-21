# Level-Scaling Audit (review_systems)

Line references are to the **baseline** commit `68542f5` (`git show 68542f5:<file>`). The working tree is already being
refactored by `level_scaling` (new `levelScaling.ts` / `elementLevelStats`), so current line numbers will drift.

**Canonical curve today:** `M(L) = 2^(L-1)` → 1, 2, 4, 8, 16. Everything below is compared against M(5) = 16×.
Max level is 5 for buildings, 3 for `bus_stops`, 11 for vehicle roads (`catalog.ts:2574`). Upgrade cost is
`cost × 2.1^L` (`catalog.ts:2591`, roads 1.55^L), so a Lv.5 site costs **36.2× its Lv.1 price** for 16× output
(0.44× output-per-dollar, but 2–16× output-per-tile and 0.23× upkeep-per-output, see §C).

Legend — **OK** consistent with M(L) · **UNDER** grows far slower than output · **OVER** grows faster than M(L) ·
**FLAT** ignores level · **DEAD** formula/stat never used · **BUG** inconsistent between code paths.

## A. Gap table (every benefit / cost metric)

| # | Metric | Baseline location | Current level formula | L5 factor | Verdict | Proposed (for level_scaling) |
|---|---|---|---|---|---|---|
| 1 | Housing population (base) | simulation.ts:1237,1258 | `popBase × 2^(min(L,5)-1) × LVpop × syn × (1+walk)` | 16× | OK | keep |
| 2 | Housing pop used by **growth step** | simulation.ts:2685 | `popBase × 2^(L-1)` (no land value, synergy, walking) | 16× | **BUG** (differs from #1 by up to ×2.3) | expose `m.baseHousingPop` from recompute and reuse it |
| 3 | Housing weight for district/economy shares | cityEconomy.ts:403,409,665,682; faith.ts:171 | `popBase × 2^(L-1)` | 16× | OK (but ignores LV/syn like #2) | reuse #1 per-home value |
| 4 | Power generation | simulation.ts:1270 | `power × M` | 16× | OK | keep |
| 5 | Power **draw** (consumers) | simulation.ts:1274 | `|power| × max(1, round(0.75M))` → 1,2,3,6,12 | 12× | quirk: L2 draws 2.0× (100%) but L3 3×/4×; rounding step | `|power| × max(1, 0.75M)` without round (1, 1.5, 3, 6, 12) |
| 6 | Water supply | simulation.ts:1277 | `water × M × freshWaterFactor` | 16× | OK | keep |
| 7 | Water **draw** | simulation.ts:1278 | same as #5 | 12× | quirk as #5 | as #5 |
| 8 | Waste capacity | simulation.ts:1281 | `waste × M (+ edge waste flat)` | 16× | OK | keep |
| 9 | Jobs (catalog metric) | simulation.ts:1284 | `jobs × M` | 16× | OK, but **overwritten** by economy (cityEconomy.ts:593 `m.jobsAvailable = r.reachable`) | delete the dead write or keep only for UI |
| 10 | Jobs (economy, real metric) | cityEconomy.ts:469,483-490 | `jobs × 2^(L-1) × skill × training` | 16× | OK | keep |
| 11 | Education supply | simulation.ts:1287 | `education × M (+ edge education flat)` | 16× | OK | keep |
| 12 | Recreation supply | simulation.ts:1290 | `recreation × M` | 16× | OK | keep (but see #33 nature) |
| 13 | Government supply | simulation.ts:1293 | `government × M` | 16× | OK | keep |
| 14 | Police points | simulation.ts:1406-1408 | `police × 2^(L-1)` (uncapped exponent) | 16× | OK | use the capped helper |
| 15 | Military points | simulation.ts:1411 | `military × 2^(L-1)`; then ×0.15 in defensePower (:1451) | 16× (×0.15) | OK | keep |
| 16 | **Police radius** | simulation.ts:1385 (+heatmap :2860) | `policeRadius × (1+0.18(L-1))` | 1.72× r (2.96× area) | **UNDER** | `× (1+0.25(L-1))` → 2.0× r, 4× area |
| 17 | **Fire radius** | simulation.ts:1396 (+heatmap :2867) | `fireRadius × (1+0.18(L-1))` | 1.72× | **UNDER** | as #16 |
| 18 | Fire crews per station | projectOperations.ts:265-266 | `min(L, floor(staff))` | 5× | UNDER-ish (crew demand = pop/50,000, :282) | `min(ceil(M/2)+1, staff)` → 1,2,3,5,9 crews |
| 19 | Defense roster (soldiers/tanks/boats/cops/SWAT) | simulation.ts:1753 | `lvScale = 1+0.55(L-1)` | 3.2× | **UNDER** vs 16× military stat; requirement grows with pop (see systems review) | `lvScale = M^0.75` → 1, 1.7, 2.8, 4.8, 8 |
| 20 | **Pollution emitted / absorbed** | cityDynamics.ts:267-271 | `strength = p × (1+0.3(L-1))`, radius `2.5+1.6√strength` | 2.2× | **UNDER** — a Lv.5 coal plant makes 16× power for 2.2× smog; trees absorb only 2.2× | emitters `p × M^0.5` (4× at L5); absorbers `p × M^0.5` too |
| 21 | Nuisance radius (catalog `nuisanceRadius`) | cityDynamics.ts:268 (fallback `×0.6`), projectOperations fire targeting | not level-scaled | 1× | **FLAT** | fold into #20 (`scaledRadius`) |
| 22 | Nuisance happiness penalty | simulation.ts:1184-1186, 1575-1576 | per-home count, 5 pts each, cap 22 — a Lv.5 tower counts like a Lv.1 hut | 1× | **FLAT** | weight by residents: `min(22, round(30 × affectedBasePop / totalBasePop))` |
| 23 | Land value (desirability splat) | cityDynamics.ts:275 | strength `×(1+0.2(L-1))`, radius `+0.5(L-1)` | 1.8× / +2 tiles | UNDER (mild) | strength `×(1+0.25(L-1))`, radius `+0.75(L-1)` |
| 24 | Synergy multiplier | cityDynamics.ts:351 | count-based, `1+0.12·min(4,n)` | 1× | FLAT (by design) | keep |
| 25 | Parcel-edge effects (cloister/ceremonial rec +5/+3, garden food +3, service waste +2, heat −2 power, ceremonial edu +2, transfer walk +4%) | parcelEdges.ts:240-253; used simulation.ts:1249,1274,1281,1287 | flat constants | 1× | **FLAT** — irrelevant above Lv.2 | multiply the absolute ones by the element's `M` (keep `walking`/`agriculture`/`commerce` as %) |
| 26 | Waterfront home recreation | simulation.ts:1255 | `min(8, 2L)` | 5× capped 8 | **FLAT/UNDER** | `2 × M` (or `0.1 × popBase × M`) |
| 27 | **Crop yield** (farms, fields, modules, orchards, glasshouses…) | cityEconomy.ts:505-507 | `food × 2.35^(L-1) × 0.10 × water × complex` | **30.5×** | **OVER** | `food × M × 0.10 × …` — if farms should "sprawl", make yield ∝ footprint tiles instead (`× tiles(L)/tiles(1)`) |
| 28 | farm_houses yield | cityEconomy.ts:514 | `0.55 × 2.35^(L-1)` | 30.5× | **OVER** | `0.55 × M` |
| 29 | **Retail food throughput** (grocer, restaurants, bars, exchange, bakery) | cityEconomy.ts:542 | `food × 1.45 × 2.25^(L-1)` | **25.6×** | **OVER** | `food × 1.45 × M` |
| 30 | Food stat on non-crop, non-retail sites (malls 90, windmills 15, monasteries 25, docks 30, boats 18, machu_picchu 40) | — | never read | — | **DEAD** | either remove or route through `foodCap` as `food × M` retail |
| 31 | Export income (`income` stat) | cityEconomy.ts:551-563 | `income × 2^(L-1) × 0.24` **only for a whitelist** (industry ids, farm anchors with income, university, research_*, community_college, businesses, shops, plantations, orchards, growers_exchange, "bakeries" [id does not exist]) | 16× | **DEAD for 46 elements** (all restaurants/shops other than `shops`, banks 115, malls 145, skyscrapers 160, condos, villas, mansions, tax office 75, docks, transit, all landmarks 90–380…) — they also get **zero upkeep** because `income>0` (cityDynamics.ts:438) | every `income>0` site earns `income × M × 0.24` (trade or household spending), and drop the upkeep exemption for sites that don't earn |
| 32 | Upkeep | cityDynamics.ts:434-440 | `cost × 0.008 × L^0.8`; roads `0.04 × L` | 3.6× | **UNDER** (upkeep-per-output falls to 0.23× at L5) | `cost × 0.008 × M^0.6` → 1, 1.5, 2.3, 3.5, 5.3× |
| 33 | Passive-nature service stats (lakes water 26, mountains water 15 + rec 38, ponds, swamps; trees/bushes/beaches/alligators/deserts recreation) | simulation.ts:1142,1277,1290 | full `× M`, **no upkeep, no road, always connected** | 16× | **OVER / dominant** (e.g. 10 bushes = 60 rec for $100, lakes Lv.5 = 384 water for $2.4k, zero upkeep) | nature stats `× (1+0.25(L-1))`, count recreation only within N tiles of homes, or give nature L1-only service value |
| 34 | Water underlay features (river/canal tiles) | simulation.ts:1194 | `× 2^(L-1)` | 16× | OK | keep |
| 35 | Hydraulic facility channel output | terrain.ts:1573, 1705-1707 | `12 × L` (linear) | 5× | **UNDER** vs catalog water 16× | `12 × M` |
| 36 | Reservoir/tower storage | terrain.ts:172,175,1780 | `100 × L` | 5× | UNDER | `100 × M^0.75` |
| 37 | Irrigation pond outflow cap / cistern | cityEconomy.ts:427, 684 | `0.8 × L`, cistern `36 × L` | 5× | **UNDER**; and demand `wanted = dry.length × 0.18` (:431) ignores grower level | `capacity = 0.8 × M`, cistern `36 × M`, `wanted = Σ 0.18 × M(grower)` |
| 38 | Rainwater cathedral cistern / potable | cityEconomy.ts:529, 690 | cistern `180 × L`, potable cap `36 × M` | 5× / 16× | inconsistent (cap binds at L≥4 only if full) | cistern `180 × M^0.75` |
| 39 | District heat works power saving | cityEconomy.ts:532 | `homes × L × 2` | 5× | UNDER | `homes × 2 × M` |
| 40 | Floodplain park rain waste | cityEconomy.ts:522 | `+2L` | 5× | UNDER | `+2 × M` (or its catalog waste 26 × M already applies; consider removing) |
| 41 | Pumped-storage capacity | cityEconomy.ts:836 | `65 × L` | 5× | UNDER | `65 × M` |
| 42 | Student/visitor attendance (upgrade activity) | cityEconomy.ts:585-588 | `(education ?? recreation) × L` | 5× | UNDER (only drives upgrade progress) | `× M` |
| 43 | University/trade-school training share | cityEconomy.ts:457 | `education × 2^(L-1)` | 16× | OK | keep |
| 44 | Preschool seats | simulation.ts:1669 | `30 × 2^(L-1)` | 16× | OK | keep |
| 45 | Upgrade activity goal | cityEconomy.ts:613-621 | `goal × L` | 5× | by design (time gate grows linearly) | fine; consider `goal × M^0.5` |
| 46 | **Traffic trips generated** | streetDemand.ts:23 | `max(1, tripsFor) × 1.7^(L-1)` | 8.4× | **UNDER**, and growth-pool residents (up to 20× housing) generate **no trips at all** | homes: `residentsAllocated/6`; workplaces: `workers/10`; else `tripsFor × M^0.75` |
| 47 | Road capacity | cityDynamics.ts:360-362 | `base × lanes(L)/lanes(1) × (1+0.17(L-1))` (L up to 11) | road-specific | OK | keep |
| 48 | Transit relief table | cityDynamics.ts:143-150, 365-368 | `base × 2^(L-1) × 0.6` | — | **DEAD** (never called; relief is `reliefAtStops`) | delete or wire into streetDemand |
| 49 | Transit stop demand / coverage weight | mobility.ts:262-270, 806 | `× √L` / `× L` | 2.2× / 5× | UNDER | `× M^0.5` / `× M` (weight by base pop) |
| 50 | Rail car limit / depot capacity | railOperations.ts:233-242 | `[3,4,5,6,8]`, `L + siding` | 2.7× / 5× | deliberate (rail agent owns) | — |
| 51 | Aviation capacity per flight | projectOperations.ts:242-248 | fixed 24/4/6/12 (×workers) | 1× | **FLAT** | `× L` (plane 24L, taxi 4L, rocket 6L) |
| 52 | Faith reach (happiness/crime/civic relief/volunteers) | faith.ts:64 | `32 (19 graveyard) × (1+0.45(L-1))` | 2.8× | UNDER vs recreation stat 16× | `× M^0.75` (8×) |
| 53 | Sanctuary beds | faith.ts:52 | `[8,15,25,40,60]` | 7.5× | OK-ish | keep |
| 54 | Blessing duration / ward chance | faith.ts:98,150 | `36+4L` s / `0.04+0.008L` | ~1.3× | FLAT-ish (fine) | keep |
| 55 | Vessel hull size | travelNetwork.ts:48-60 | grows `(L-1)/4` | — | **side-effect**: upgrading a vessel can make it too big for its harbor ⇒ `connected=false` (simulation.ts:1146) | warn in upgrade UI or exclude hull growth from harbor test |
| 56 | Footprint at level | levelSpans / catalog.ts:2578 | per-element table, capped 4×4 | — | output independent of footprint: wind_turbines Lv.5 = 1,040 power on **1 tile**; wells 224 water on 1 tile; micro_reactor 3,400/tile | either scale wind/well footprints, or cap per-tile density (e.g. wind output × tiles(L)/tiles(5)) |
| 57 | Attack damage downgrade | simulation.ts:2415-2416 | 38% chance to drop one level | — | fine | — |
| 58 | Housing loss when destroyed | simulation.ts:2424 | `popBase × 2^(L-1)` | 16× | OK | — |
| 59 | Heatmap provider radii | simulation.ts:2832-2874 | `r0 + k·L` | cosmetic | cosmetic mismatch with real coverage (#16/#17 use ×0.18) | derive from the same helper |
| 60 | Grocer import cap | cityEconomy.ts:746 | `retail × t × 0.36` (retail is 2.25^(L-1)) | 25.6× | follows #29 | follows #29 |

## B. Elements whose stats never scale or never apply
* `income` is read only for the export whitelist (row 31). Dead for: grocery_store, villas, condos, mansions, skyscrapers,
  restaurants, clothing/thrift/shoe stores, cheesesteak, bars, gas stations, atms, buildings, banks, malls, train/bus/taxi
  stops & depots, post_offices, tax_collecting_office, docks, speed_boats, ship_building_areas, all landmarks
  (large_landmarks … the_great_pyramids, stonehenge, moai, parthenon, colosseum, chichen_itza, great_wall, angkor_wat,
  machu_picchu), bakery_coop, ferry_exchange, canal_boat_lift, flying_car_depot, teleportation_depot. The build dock still
  advertises `+$income` (`BottomDock.tsx:82`).
* `food` dead on malls, windmills, monasteries, docks, boats, machu_picchu (row 30).
* `nuisanceRadius` not level-scaled (row 21).
* `transitRelief()` / `TRANSIT_RELIEF` dead (row 48).

## C. Upgrade economics (why the gaps matter)
For a typical element (house, $60):

| Level | Cost to reach (cum.) | Output | Output / $ (vs L1) | Footprint | Output / tile (vs L1) | Upkeep L^0.8 | Upkeep / output |
|---|---|---|---|---|---|---|---|
| 1 | 60 | 1× | 1.00 | 1×1 | 1.00 | 1.00 | 1.00 |
| 2 | 186 | 2× | 0.65 | ~2×1 | ~1.0 | 1.74 | 0.87 |
| 3 | 451 | 4× | 0.53 | ~2×2 | ~1.0 | 2.41 | 0.60 |
| 4 | 1,007 | 8× | 0.48 | ~3×2 | ~1.3 | 3.03 | 0.38 |
| 5 | 2,174 | 16× | 0.44 | 3×2–3×3 | 1.8–2.7 | 3.62 | 0.23 |

Upgrades are a land/upkeep optimisation, not a money one — fine. The problems are the side-channels above that do NOT
follow the 16× (pollution, nuisance, traffic, radii, edges, defense, faith) which make high-level sites strictly
cleaner, quieter and lighter on roads per resident, and the two curves (crops 2.35, retail 2.25) that run ahead of it.

## D. Suggested single helper (what level_scaling is building)
```ts
export const LEVEL_CURVES = {
  output: (L) => 2 ** (Math.min(5, L) - 1),          // 1,2,4,8,16   (pop, jobs, power, water, waste, edu, rec, gov, police, military, income, crop, retail)
  draw:   (L) => Math.max(1, 0.75 * 2 ** (Math.min(5, L) - 1)), // 1,1.5,3,6,12
  side:   (L) => 2 ** ((Math.min(5, L) - 1) / 2),    // 1,1.41,2,2.83,4 (pollution, absorbers, edge amenities)
  reach:  (L) => 2 ** (0.75 * (Math.min(5, L) - 1)), // 1,1.68,2.83,4.76,8 (faith, defense roster, trips for non-homes)
  radius: (L) => 1 + 0.25 * (Math.min(5, L) - 1),    // 1..2 (police, fire, nuisance)
  upkeep: (L) => 2 ** (0.6 * (Math.min(5, L) - 1)),  // 1,1.52,2.30,3.48,5.28
};
```
