# Codex handoff — illustrated catalog, commercial overhaul, new civic/military, bridges, UI consistency

Written Fri Nov 27, 2026 by Claude for whoever picks this up next (Codex). Owner: Brigham (FuzzyMediaco).
This is the single entry point. Read it top to bottom before touching code.

The goal, in Brigham's words: every building should give a player "a reason to build a whole city in each
style". Nothing should be "just squares". Things should be "visually interesting in tons of ways", in
Original and in all ten eras. The UI should look like one coherent, icon-first game with no odd-looking
pages, especially Sculpt and the paid screens.

---

## 1. Read these first (in this order)

1. `AGENTS.md` (repo root). House rules and the UI style rules. Always applies.
2. This file.
3. `docs/redesign/ART-BRIEF.md`. Brigham's full art brief, verbatim. It is the spec for the catalog art.
4. `docs/redesign/README.md`. Scope: Part A (catalog art), Part B (UI review and style guide),
   Part C (his Nov 27 additions: commercial, government/civic, military, bridges).
5. `docs/redesign/CIVIC-FIVE-SPEC.md`. The massing classes for library, post office, courthouse, city
   offices and bank. It is also the template for every later slice.
6. `docs/handoff/STATE-2026-11-26.md`. The state of the game as of Nov 26.
7. `docs/redesign/PROGRESS.md`. Running log. Append to it when you stop.

---

## 2. Where things stand right now

### Merged to `main`
| PR | What |
|---|---|
| #33 | Seven commercial buildings rebuilt as giant-object landmarks (Original style): Shoe Store, Pixel Arcade Hall, Artisan Bakery, Classic Chrome Diner, Grand Cinema Theater, Late-Night Jazz Club, Boutique Hotel. Board: `docs/review/commercial-overhaul/before-after-lv5.webp` |
| #34 | Five more: Coffee Roastery, Neon Bowling Alley, Florist, Lantern Night Market, Modern Art Gallery. Board: `docs/review/commercial-overhaul/batch2-all-levels.webp` |

Code for both lives in `src/game/designs/commerceKit.ts` (shared sculpting kit) plus
`commerceIcons.ts`, `commerceArcade.ts`, `commerceFood.ts`, `commerceShows.ts`, `commerceHotel.ts` and
`commerceMore.ts`. They are registered at the end of `src/game/designs/index.ts`, so they override the
older builders.

### Pushed but NOT merged (finish these first)
| Branch | What is on it | What to do |
|---|---|---|
| `redesign/slice-1-civic-five` | Full Original **Public Library** redesign, 4 variants × 5 levels (Stacked Hardbacks, Open Folio, Bookend Alley, Pop-up Storybook) in `src/game/designs/publicLibrary.ts` (about 1,600 lines). Also a per-era "signature art" boundary (`src/game/designs/eraArt/<era>.ts`, `src/game/eraNames/`), review scripts (`scripts/review/redesign-board.mjs`, `near-silhouette.mjs`, `silhouette.ts`, `voxel-budget.mjs`), the regenerated library Handbook sheet, and `CIVIC-FIVE-SPEC.md`. | Rebase on `main` (conflicts likely in `designStyles.json`, `src/handbook/catalog.json` and `designs/index.ts`; keep both sides). Render it (section 4), fix anything weak, then run lint, test and build. Open a PR and merge it. |
| `redesign/slice-1b-civic-eras` | Builds on slice-1. The Original civic four (post office, courthouse, city offices, bank) each get their own builder module (`postOffice.ts`, `courthouse.ts`, `cityOffices.ts`, `bank.ts`), plus review boards. **The four modules are 16-line stubs**: the real designs are not written yet. | Merge slice-1 first, then write those four for real, following `CIVIC-FIVE-SPEC.md`. |
| `wip/library-books` | Early `bookKit.ts` parts. Superseded by `publicLibrary.ts` on slice-1. | Reuse anything useful, then delete the branch. |
| `redesign/illustrated-catalog` | Planning docs only. Now copied to `main` under `docs/redesign/`. | Ignore. Use the copies on `main`. |

### Scheduled runs
All Claude scheduled runs for this project are **off**. No other agent is working on it. You own it now.

---

## 3. The work queue (do it in this order)

Ship in coherent slices: one PR per batch of about 4–7 elements, or one system. Every PR includes
before/after images. Merge when green (section 6).

### 3.1 Finish and merge the civic slice
Merge `redesign/slice-1-civic-five`, then write the four civic buildings in `slice-1b`. Library,
post office, courthouse, city offices and bank must be impossible to confuse from above, in grayscale and
as silhouettes. Run `scripts/review/redesign-board.mjs` and `near-silhouette.mjs` to prove it.

### 3.2 The remaining 23 commercial buildings (Original style)
Brigham: "they're literally just all squares... I don't even wanna put them down, they all need a totally
overhaul, all levels and visual variants." Use the same approach as PRs #33/#34: four distinct ideas per
element, and every level reveals a new structural idea. Starting ideas below; improve on them freely.

| Element | Variant ideas |
|---|---|
| `indie_bookstore` | Crooked secondhand shop with bay windows, a street book cart and a reading loft (see the brief; it must read as *selling* books, unlike the lending library) · spiral book-stack tower · treehouse reading nook · a facade that is a giant bookshelf |
| `neighborhood_pharmacy` | Giant capsule-pill building · mortar and pestle · glowing green-cross pylon · apothecary bottle cluster |
| `seafood_pier` | Lobster shack with a giant lobster on the roof · lighthouse diner · fish-market hall with a spinning fish sign · crab-claw canopy. Check the water/coast placement domain first. |
| `auto_dealership` | Glass car-vending tower with stacked cars · showroom with a car on a spinning turntable (`spinner`) · tire-shaped building · car on a pole |
| `furniture_showroom` | Giant armchair · stacked sofas · flat-pack box half unfolded · lamp-shaped tower |
| `coworking_loft` | Brick loft with a rooftop greenhouse · laptop-shaped building with a lit screen · terraced studio boxes · treehouse pods |
| `tech_startup_hub` | Rocket on a launch gantry · lightbulb tower · circuit-board campus with glowing traces · ring campus |
| `department_store` | Grand clock-corner emporium (Selfridges-style) · stacked gift boxes with ribbon · glass atrium with escalators visible · revolving-door rotunda |
| `hardware_store` | Giant toolbox with a hammer · paint-can tower with drips · nut-and-bolt tower · red barn depot |
| `grocery_store` | Giant fruit (apple, watermelon slice) · shopping-cart canopy · produce-crate stack · farmers' market barn |
| `restaurants` | Spaghetti fork twirl · pizza slice · sushi boat · stacked burger |
| `clothing_stores` | Giant hanger / T-shirt · thread spool and sewing machine · runway catwalk · shoebox-style boutique cubes |
| `thrift_stores` | Patchwork quilt facade · giant vintage suitcase / steamer trunk · stacked mismatched furniture · flea-market canopy |
| `bars` | Beer mug with foam · martini glass with a spinning olive · tiki hut · rooftop bar terraces |
| `gas_stations` | Googie canopy · giant oil can · EV plug-and-cable · retro pump tower |
| `atms` (1×1) | Giant coin on edge · piggy bank · vault door · card-slot kiosk |
| `banks` | Follow the civic-five "squat, heavy, closed" class: vault-door facade, gold-bar stack, coin tower, strongroom drum |
| `buildings` (downtown skyscraper) | Distinct skyline silhouettes: twisting tower, stepped Deco spire, split tower with sky bridge, diagrid |
| `businesses` (office park), `shops`, `malls`, `data_centers` (server racks with blinking lights and cooling towers), `blacksmiths` (anvil, forge glow, horseshoe arch) | Same treatment |
| `cheesesteak_restaurants` | Already the benchmark. Leave it. |

### 3.3 Government services and civic administration (Brigham, Nov 27)
* Upgrade the existing government service buildings so they are worth placing.
* **Add new elements**: larger government and civic-administration buildings that add a lot to the
  government-services metric. His examples:
  * Big city offices with a **rock-climbing wall** on the side.
  * A **super-futuristic skyscraper-sized office where the middle of the building is missing and the
    top half levitates** over a glowing energy field (bottom block, then energy field, then floating top).
  * "But also other stuff". Invent more in the same spirit.
* New elements need catalog entries, stats, costs and service radius/metric contributions, plus Atlas and
  Handbook entries, search aliases and tests. Copy the pattern of the existing expansion catalogs
  (`src/game/expansionSafetyMilitaryCommerce.ts`, `skylineCatalog.ts`, `expansionBalancedCatalog.ts`) and
  their tests.

### 3.4 Military (Brigham, Nov 27)
* **Underground missile silos**: the player only sees the top (blast doors, hatch ring, a vent, a small
  guard post). The doors can open in an attack.
* **Drone-swarm bases** that release drone swarms when there is an attack, and **occasionally run
  training exercises** so swarms take off and fly cool formations even with no attack. Use real animated
  drones (see the existing critter and rotor systems via `c.critters` and `c.addRotor` in `designs/kit.ts`,
  and how vehicles and boats animate). Hook into the existing attack/defense simulation. Keep
  reduced-motion readable (fewer, slower drones).
* Existing military code: `src/game/designs/safetyMilitaryExpansion.ts`, `security.ts`.

### 3.5 Bridges (Brigham, Nov 27)
* At full upgrade, bridges currently "stop being voxel" and "don't look like they're in the right game".
  Keep them voxel at every level.
* **Progressive by run length.** A run of 3 joined pieces automatically raises a taller middle tower.
  6 pieces gives two towers, and so on. A long, fully upgraded run should look like a real **voxel Golden
  Gate**. Other bridge types grow into other icons: **Brooklyn Bridge** (stone Gothic towers with cable
  web), Tower Bridge, a steel arch like Sydney Harbour, a cable-stayed fan.
* Code: `src/game/bridgeWorks.ts`, `src/game/catalogBridge.ts`, `src/game/designs/networks.ts`,
  `carriageways.ts`, `roadStages.ts`. The join logic must stay correct: traveled surface, sightlines,
  network joins, picking, saves. Put the visual distinction in towers, cables, supports, railings and
  lighting.

### 3.6 Bring the eras along
After Original reads well, give each redesigned element a deliberate design in each of the ten eras
(`ancient-china`, `ancient-egypt`, `rome-aqueduct`, `ancient-greece`, `medieval-europe`,
`renaissance-italy`, `world-war-ii`, `art-deco`, `future-3027`, `post-apocalyptic`). Use the
`eraArt/<era>.ts` boundary from slice-1, and follow `ART-BRIEF.md`'s per-era directions: the governing
idea, not just the materials.

### 3.7 The rest of the catalog
Housing, farms, nature, transit (Train Stop vs Train Depot), recycling (follow a can through it), water
works and so on, per `ART-BRIEF.md` steps 1–8. Coverage target: every playable element × level × variant ×
style (about 67k combinations; recompute with `ELEMENT_BY_ID` and `getMaxElementLevel`).

### 3.8 UI review and style guide (Part B). See section 7.

---

## 4. How the art pipeline works (exact commands)

```bash
npm install                               # bun.lock is canonical in CI; npm works locally
npm install --no-save --package-lock=false @napi-rs/canvas@1.1.1   # only for render-handbook
bash scripts/gallery-server.sh            # vite on :5199 serving gallery.html
node scripts/shoot-gallery.mjs "cat=all&ids=<id,id>&mode=full&cell=200" /tmp/out.png      # every level and variant
node scripts/shoot-gallery.mjs "cat=all&ids=<ids>&mode=variants&lv=5&cell=200" /tmp/out.png  # one level, all variants
ATLAS_IDS=<id,id> node --import tsx scripts/render-handbook.mjs   # regenerate Handbook sheets, thumbnails and catalog.json
npm run lint && npm test && npm run build
```
In the gallery, the **+z face is the street front** (lower-left in the shot) and +x is the lower-right face.
**Look at every render yourself** before you call something done.

### Override pattern (how a new design replaces an old one)
```ts
import { override } from "./commerceIcons";
override("element_id", build, ["Lv1 name", "Lv2", "Lv3", "Lv4", "Lv5"], "Growth sentence.");
```
Then add `import "./yourFile";` at the end of `src/game/designs/index.ts`. Footprints come from the existing
entry; never change them. Variant names live in **`src/game/designStyles.json`**. For expansion elements,
also update `styleNames` in `src/game/expansionSafetyMilitaryCommerce.ts`. Then run `render-handbook` for
those IDs. The Handbook test fails until you do, which is how you know.

### `commerceKit.ts` toolbox
* `sculpt(v, x0,y0,z0,x1,y1,z1, (u,h,w,x,y,z) => color | [color, emit] | null)` rasterizes any shape into
  a box, writing only the shell, so giant sculptures stay cheap. u/h/w are 0..1 within the box.
* `neon(v, "TEXT", x, y, z, color, { scale, vertical, along, emit })` draws 3×5 pixel-font signs.
  Keep the width inside the lot; check with `neonWidth`.
* `spinner(c, x, y, z, axis, speed)` returns a PixelVox that rotates (tokens, reels, trumpets, spurs,
  sandwiches). Build it relative to the pivot.
* `disc`, `crowd`, `bulbs`, `bulbFrame`, `glassFront`, `cafeTable`, `umbrella`, `band`, `classicCar`,
  `palm`. `kit.ts` has `person`, `tree`, `lamp`, `awning`, `bench`, `fence`, `flowerBed` and
  `c.smoke`/`c.critters`.
* Lot ladders: 1×1 = 16×16 voxels, 2×1 = 32×16, 2×2 = 32×32, 3×2 = 48×32, 3×3 = 48×48. Coordinates are
  centered on 0. Anything outside the lot is clipped, so check big signs.

---

## 5. Art quality bar (how to make it "look cool")

* **One readable idea per variant**, recognizable from the game camera, in grayscale and as a silhouette.
  If two variants or two elements look alike, redo one of them.
* **Upgrades tell a story.** Level 1 is a small honest version (cart, kiosk, sign on a small shop). Each
  level adds a new structural idea. Level 5 is the legendary landmark. Don't just scale up.
* **Giant-object architecture** (the Cheesesteak Spot benchmark) is great for shops and entertainment.
  Civic buildings get dignified, legible massing instead (`CIVIC-FIVE-SPEC.md`). Don't make every roof
  shout: save the biggest jokes and spinners for places that deserve attention.
* **Life and detail up close**: people, lit windows (emit 0.5–0.9), signs, steam/smoke, string lights,
  outdoor seating, cars. The front door must be obvious.
* **Use only original characters.** No licensed mascots (no Pac-Man or Space Invaders sprites, no
  Nike swoosh, no Louboutin red sole, no Disney etc.). Real places such as the Golden Gate or the Egyptian
  Theatre are fine as architectural inspiration.
* **Performance:** keep L5 under roughly 20k voxels where possible (shell-only `sculpt` helps). Check the
  "vox" figure in the gallery labels.

---

## 6. Shipping rules

* Branch from fresh `main` → PR with before/after images (save boards under `docs/review/...`) →
  `npm run lint`, `npm test` and `npm run build` green, and the GitHub "Game checks" run green →
  squash-merge. Never merge on red.
* Never break IDs, saved variant selections, footprints, costs, progression, placement/picking, network
  joins, or simulation behavior. Keep multiplayer paused.
* Do not change prices, products, entitlements or billing logic. Do not touch live Stripe, App Store or
  Play settings. Do not cut native app releases or change store listings. Those are Brigham's.
* After each merge, append a dated line to `docs/redesign/PROGRESS.md`.

---

## 7. UI/UX: make every screen match (Part B)

Brigham's request: review the entire UI and make everything match: every menu, and especially **Sculpt**,
the **Store and every paid surface**, and the **Library**. Keep it **primarily icon-based, with the same
colors and fonts**. Then write a style guide so any future AI or person stays consistent. He said Sculpt
looks "out of style", some menu pages "don't line up", and the store "looks totally different".

### 7.1 The house style (derived from the existing UI)
Tokens live in **`src/styles/interface.css`**. The shared kit is **`src/components/ui/`** (`ui.css`,
`Button`, `Chip`, `Tabs`, `ListRow`, `BottomSheet`, `InspectorCard`, `ConfirmDialog`, `Toast`).

| Token | Value | Use |
|---|---|---|
| `--ui-font` | "DM Sans", system-ui | All UI text. No other families. |
| `--ui-ink` / `--ui-muted` | #19392f / #52665b | Body text / secondary text |
| `--ui-green` | #235944 | Primary action, selected state, links, icons |
| `--ui-leaf` | #dce9d8 | Soft green fill: tags, info panels |
| `--ui-paper` / `--ui-card` | #faf9f1 / #fffef9 | Sheet background / card background |
| `--ui-line` | #cfd8c9 | All borders and dividers |
| `--ui-bad`, `--ui-warn`, `--ui-good` (+ `-bg`) | | Status only, never decoration |
| `--ui-focus` | #a45312 | Focus outline (3px) |
| Type scale | 11 / 13 / 15 / 19 px (`--ui-t-xs/sm/md/lg`) | No other sizes. Headings 19, body 13–15, captions 11. Weights 700/800 for labels. |
| Radius | 14 (`--ui-radius`), 10 (`--ui-radius-sm`), 999 for chips | |
| Tap targets | 44px (`--ui-tap`), 48px (`--ui-tap-lg`) | Every control |
| Shadow | `--ui-shadow`, or the soft `0 3px 10px rgba(17,42,35,.12)` used on rows | |
| Glass surfaces | `rgba(255,255,255,.92)` + `backdrop-filter: blur(10px)` + `--ui-line` border | Floating rows, tabs and HUD over the map |
| Icons | **lucide-react** only, 16–20px, stroke icons, colored `--ui-green` (or `--ui-muted`) | Icon first, short label second |

### 7.2 Rules
1. **Icon-first.** Every action, tab and row leads with a lucide icon. Labels are 1–2 words. Use long text
   only in Handbook-style reading views.
2. **Use the kit; don't restyle.** Use `.ui-btn` (`is-primary`, `is-quiet`, `is-small`, `is-danger`),
   `.ui-chip`, `.ui-tabs`, `.ui-row`, `BottomSheet` and `InspectorCard`. Don't create new one-off button,
   card or tab styles. If the kit lacks something, add it to `ui.css` with tokens, then use it everywhere.
3. **No raw hex colors or pixel font sizes in component CSS or inline `style={{}}`.** Use tokens.
   Known offenders to fix: `saveSlots.css` (hard-coded #cfdcd2/#224637), `exampleIslands.css`,
   `railOperations.css` (own system, 366 lines), `islandShop.css` (`.pc-shop`), and inline styles in
   `SettingsSheet.tsx`, `QuickBuildRing.tsx`, `CityEconomyPanel.tsx`, `RailOperations.tsx`,
   `FaithDetails.tsx`, `PixBuilderModal.tsx`.
4. **One sheet anatomy everywhere.** Header row: icon, title (19/800) and close icon button. Then
   `.ui-tabs` or a chip row if needed, then content in `.ui-list` / cards, then a sticky primary action at
   the bottom. Sculpt, Store, Save Slots, Settings and Rail Operations all follow it.
5. **Sculpt** (`BottomNav` "sculpt" opens the works/sculpt tools in `src/components/InfrastructurePanel.tsx`):
   rebuild the tool picker as a grid of icon tiles (lucide icon + 1-word label, selected = `--ui-green`
   fill), brush size and strength as kit sliders with `accent-color: var(--ui-green)`, and the same sheet
   anatomy. Match the Build sheet's look exactly.
6. **Store and paid surfaces** (`src/components/IslandShop.tsx` + `islandShop.css`, era/pack purchase,
   Pix plans, checkout and restore flows, the Library): restyle them with the kit. Product cards use
   `--ui-card`, `--ui-line` and `--ui-radius` with a hero image (era art or a rendered model), an icon row of
   what you get, the price as the one bold element, and one primary button. Featured = `--ui-green` border.
   Use the same header and close button as every other sheet. **Visual only**: keep every price, product,
   entitlement, consent checkbox, terms text, legal link and the Restore Purchases control exactly as they
   are and still reachable.
7. **Motion:** short (150–200ms) ease-out transitions on sheets and selection only. Respect
   `prefers-reduced-motion` (already global in `interface.css`).
8. **Accessibility:** 44px targets, visible 3px focus ring, `aria-pressed`/`aria-selected` on toggles and
   tabs, text contrast ≥ 4.5:1 (ink on paper passes; check white text on `--ui-green`).
9. **Phone first.** Check at 390×844 and 360×740, then desktop at 1440×900. Nothing overflows, every
   sheet scrolls, and the bottom nav never covers a primary button (use `--above-nav`).

### 7.3 Deliverables for Part B
* `docs/STYLE-GUIDE.md`: tokens, type scale, icon rules, the sheet anatomy with screenshots, each kit
  component with do/don't examples, and a "how to add a new screen" checklist. Link it from `AGENTS.md`.
* A screenshot inventory of every surface before and after (phone and desktop) under
  `docs/review/ui-consistency/`. Use `scripts/shoot-game.mjs`, or Playwright on `npm run dev`.
* PRs, one per area: Sculpt, Store/paid, Save Slots/Settings, Rail Operations, then any remaining outliers.
  Each PR shows before/after.

---

## 8. Definition of done and reporting
* Everything in section 3 is merged, rendered and reviewed. `PROGRESS.md`'s checklists are ticked.
* `docs/STYLE-GUIDE.md` exists and every surface follows it.
* Final report to Brigham: what shipped (PR links), before/after boards, coverage totals, and anything that
  needs him (native releases, store listings, real-device checks, human review panels).
