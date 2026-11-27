# Civic five: shared spec for every style

The first slice of the illustrated-catalog redesign (see `ART-BRIEF.md`). It gives `public_library`,
`post_offices`, `courthouses`, `city_offices` and `banks` their own forms in Original and in each of the ten
production eras. It is also the template for later slices, so the mechanics below apply to the whole catalog.

## Read the job from the roof

Each service gets a **massing class** that holds in every era, so a player who learns it once can find it
anywhere. The era supplies the vocabulary (materials, roof forms, ornament, technology). The class supplies
the outline seen from the game camera, in grayscale and as a flat silhouette.

| Element | Massing class (what reads from above) | Street relationship | Signature you can find up close |
| --- | --- | --- | --- |
| `public_library` | **Low and open.** Reading rooms wrap or overlook an open reading court, terrace, steps or garden. Horizontal, generous daylight openings, warm lit niches. Never the tallest of the five. | A welcoming, obvious public door; outdoor reading space (benches, steps, garden) faces the street. | The era's book form (stacked books, slips, scrolls, codices, printed sheets, data) used structurally, not as a sign. Use the era concept in `ART-BRIEF.md`. |
| `post_offices` | **Long shed plus working yard.** A long low hall with a loading side, a yard of carts/vans/animals/drones, and a visible path of mail: counter → sorting (belt, racks, pigeon loft, chute) → dispatch. | Customer door on the street, dispatch gate to the side or back, vehicles in the yard. | Something moving mail: belt, bags, parcel stacks, letter box, pigeons, pneumatic tubes, messenger post. |
| `courthouses` | **Tall, symmetric, stepped.** The most formal outline: centred axis, deep ceremonial stair or ramp, one dominant gable/pediment/tower over a high judgment hall. Pyramidal or terraced massing. | Raised entrance far above the street, long approach. | Scales, a judgment seat, a bar/rail, an enclosed hearing court, a single strong axis. |
| `city_offices` | **Tower plus square.** An asymmetric office block with a clock, bell or signal tower, fronting an open public square, forum, plaza or green with a flag, fountain, notice board or speaking platform. The tower is the tallest element of the five at the same level. | The square sits between street and building; people gather. | Clock/bell/signal, notice board, flag, assembly balcony. |
| `banks` | **Squat, heavy and closed.** Compact block with thick walls, few small openings, a strongroom drum/vault/silo, a guarded door. Smallest window-to-wall ratio of the five. | A single narrow guarded entrance; little open ground; maybe a counting yard behind a wall. | Vault door, coins/ingots/grain tallies, strongbox, guards, counting tables. |

## Real variants and real upgrades

* **Fixed level, four variants:** four architectural choices someone might pick for different neighbourhoods.
  Change at least one of roof outline, plan shape (L, U, ring, bar, cluster…), wing orientation, open space,
  equipment arrangement, or street relationship. Colour and signs only reinforce a choice whose geometry reads.
  Name each variant for its idea (for example *Stacked Hardbacks*, not *Blue*).
* **Fixed variant, five levels:** each level reveals a new structural or operational idea, while staying
  recognisably the same building. Level 5 is the legendary version.
* **Keep the massing class at every level and variant.** A courthouse variant is still the tall symmetric one.

## Mechanics

* Footprints (tiles; 16 voxels per tile; do not change):

  | id | L1 | L2 | L3 | L4 | L5 |
  | --- | --- | --- | --- | --- | --- |
  | public_library | 1×1 | 2×1 | 2×2 | 3×2 | 3×3 |
  | post_offices | 1×1 | 2×1 | 2×2 | 3×2 | 3×2 |
  | courthouses | 1×1 | 2×1 | 2×2 | 2×3 | 3×3 |
  | city_offices | 1×1 | 1×2 | 2×2 | 2×2 | 2×3 |
  | banks | 1×1 | 2×1 | 2×2 | 2×2 | 2×2 |

* Coordinates: x ∈ [-c.hx, c.hx), z ∈ [-c.hz, c.hz), y = 0 is the lot layer, structures start at y = 1,
  **+z is the street/front**. Build relative to `c.hx/c.hz`. Anything outside the parcel is clipped.
  Leave a 1–2 voxel margin so neighbours stay separate. Don't pave the whole parcel with a flat slab.
* Toy scale: person 3 voxels tall, door 2×3, storey ≈ 4 voxels, car 5 long, tree 6–12 tall.
* Budget: under ~15k voxels typical, 40k max at level 5. Hollow big volumes (`v.hollowBox` or `box`+`clear`).
* Deterministic: use `c.rand`, `c.ri`, `c.vpick` or `hashStr`, never `Math.random`.
* Animated/live parts: `c.addRotor`, `c.smoke`, `c.blink`, `emit` glow on voxels (night windows, lamps).
* Era builders receive `(c, p, active)`. `p` is the era ink (`wall shade roof rim frame sign floor leaf glass
  lamp cloth`, plus `bay` and `storey`). Any palette name from `src/game/voxelCore.ts` or `#rrggbb` also works.
  `active` is true when the building is staffed and supplied: show it busier (lamps lit, people, carts), but
  idle must still look complete.
* Reuse `src/game/designs/kit.ts` (read it first), `periodMasonry.ts` (`wing`, `canopy`, `frontage`) and small
  helpers. Keep useful era parts. Put a short comment above each builder describing its four variants.

## Where the code goes

* **Original:** `src/game/designs/publicLibrary.ts` (new), `civic.ts` (post office, courthouse, city offices),
  `commerce.ts` (bank). Names: `expansionBalancedCatalog.ts` (library), the `design(...)` level-name arrays,
  and `designStyles.json` (variant names).
* **Eras:** `src/game/designs/eraArt/<era>.ts` exports `signatures: Record<id, (c, p, active) => void>`. A
  listed element bypasses the shared family builders in that era. Names go in `src/game/eraNames/<era>.ts`
  (`name`, five `levels`, four `variants`, `description`, optional `aliases`). These are what the Build menu,
  Details, Atlas and Handbook show.

## Look at it

```sh
# 5 levels × 4 variants for one element in one style
node --import tsx scripts/review/redesign-board.mjs matrix out.png id=public_library era=ancient-egypt
# the five side by side, one row per style (limit rows with eras=…; look=gray|silhouette)
node --import tsx scripts/review/redesign-board.mjs civic out.png eras=original,ancient-egypt lv=3 variant=0
# every style, one id, four variants at one level
node --import tsx scripts/review/redesign-board.mjs eras out.png id=banks lv=4
# look-alike candidates (pairs of the five, close variants, flat upgrades)
node --import tsx scripts/review/near-silhouette.mjs eras=ancient-egypt
```

Targets for the near-silhouette report: **0 look-alike pairs** among the five at every level and variant,
**0 flat upgrades**, and close variants only where a 1×1 parcel truly leaves no room (keep those rare). The
numbers only flag candidates: judge the rendered boards yourself at small size, in grayscale and in silhouette.
