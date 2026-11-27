# Illustrated catalog + UI consistency run (started Nov 27, 2026)

Brigham asked on Nov 25, 2026 (9:56 PM MT) for a long, unattended run that keeps going
across usage resets until the work below is finished, verified and great-looking.
Scheduled sessions pick this up every ~5 hours. Read this folder first, every run.

## Files
- `ART-BRIEF.md` — the full art redesign brief (his attachment, verbatim). It is the spec for Part A.
- `../handoff/STATE-2026-11-26.md` — state of the game as of Nov 26 (also on branch `ccr-5480f4a8-nj27ci`).
- `PROGRESS.md` — running log. Every run appends a dated "where I stopped" entry and updates the checklist.
- `STYLE-GUIDE.md` — to be written in Part B (does not exist yet at kickoff).

## Part A — Illustrated catalog redesign (ART-BRIEF.md)
Implement the brief in full on top of the latest `main`: Original and all ten production eras,
all 294 catalog elements, every playable level, all four variants. The walk-in Cheesesteak Spot is
the creative benchmark. Start with the Public Library and the five civic lookalikes
(`public_library`, `post_offices`, `courthouses`, `city_offices`, `banks`), then carry the same
care through the whole catalog. His goals, in his words: find the library from overhead, follow a can
through the recycling plant, recognize an era from an ordinary neighborhood with the HUD hidden.
Deliver: playable redesign, matching Atlas and Handbook artwork, before/after of the same streets at
actual phone play zoom, coverage totals, the verification in steps 7–8 of the brief.

## Part B — Full UI review and style guide (his request, Nov 25)
1. Review the entire user interface: every menu, sheet, panel and page. Especially:
   - the **Sculpt** UI (he thinks it is out of style with the rest);
   - the **paid surfaces**: the Store, era packs, Survival/God mode purchase, Pix plans, checkout and
     restore flows, the Library, and anything else that sells something. He says these "look totally
     different" and need to be brought in line and improved;
   - any page in any menu that doesn't line up with the others.
2. Derive the house style from what the UI predominantly uses today (fonts, colors, spacing, radii,
   icon set, component structures, motion) and write `docs/redesign/STYLE-GUIDE.md` (and link it from
   the repo's top-level docs / CLAUDE.md or AGENTS.md if those exist) so any future AI or person makes
   visually consistent changes. Keep the UI primarily icon-based, same colors and fonts.
   Prefer shared tokens/components in code over prose-only rules.
3. Bring every outlier surface into line with the guide. Before/after screenshots at phone size and
   desktop size for each changed surface.
4. Do not change prices, products, entitlements, billing providers, purchase logic, or store
   compliance text meaning; this is visual/UX consistency only. Restore-purchases and legal links stay
   reachable.

## Part C — Requests added by Brigham on Fri Nov 27 (8:40–8:51 AM MT). Same priority as Part A.
Order agreed in chat: commercial first, then government/civic, military, bridges, then the rest of Part A.

1. **All commercial buildings, total overhaul** (all 36 commerce elements, every level and variant,
   Original style first). He finds them "just squares", "lame", not worth placing. Go big, like the
   Cheesesteak Spot. His specific asks:
   - Shoe Store: one variant is a giant shoe. ✅ shipped in PR #33
   - Boutique Hotel: actually boutique and cool. His reference photos: pink Italian lakeside grand hotel
     with pool and striped umbrellas, Badrutt's-style Alpine palace, Sheraton Huzhou horseshoe ring with
     blue lit bands, curved wave-terrace resort, Victorian red-and-stone London grand hotel, Morpheus-style
     exoskeleton. ✅ first four in PR #33
   - Arcade: giant game controller; a big arcade-cabinet tower with something spinning on top; a
     pixel-creature variant. Use ORIGINAL characters only, no Pac-Man or Space Invaders. ✅ PR #33
   - Artisan Bakery: loaf of bread; spinning sandwich on top; cake. ✅ PR #33
   - Classic Chrome Diner: big neon sign, really reads as a chrome diner. His references: Kroll's Diner
     (red drum "DINER" sign, yellow script sign, clock on top), stainless railcar diners with a
     glass-block vestibule and a vertical fin "DINER" pylon. ✅ PR #33
   - Movie theater: like the Egyptian Theatre in Park City, UT, or other iconic movie houses. ✅ PR #33
   - Jazz club: a giant music note; a spinning trumpet; a tiered variant with a band playing on every
     level's roof (Lv1 small with one band). ✅ PR #33
   - Everything else in commerce still needs the same treatment (29 elements left: businesses,
     grocery_store, shops, blacksmiths, restaurants, clothing_stores, thrift_stores, bars, gas_stations,
     atms, buildings, banks, malls, data_centers, coffee_roastery, hardware_store, indie_bookstore,
     flower_shop, neighborhood_pharmacy, bowling_alley, auto_dealership, furniture_showroom, art_gallery,
     coworking_loft, tech_startup_hub, department_store, night_market, seafood_pier, cheesesteak
     already strong). Use src/game/designs/commerceKit.ts (sculpt, neon, spinner) and the override()
     pattern in commerceIcons.ts.
   - He said: commit these to main.
2. **Government and civic administration.** Upgrade the existing government service buildings, and ADD
   new, larger government/civic-administration elements that add a lot to the government-services
   metric. His ideas: big city offices with a rock-climbing wall on the side; a super-futuristic
   skyscraper-sized office where the middle of the building is missing and the top levitates over a
   glowing energy field. "But also other stuff."
3. **More military.** New elements: missile silos that are underground, so you only see the top hatch;
   drone-swarm bases that release drone swarms when there's an attack and occasionally run training
   exercises, so swarms take off and do cool maneuvers even with no attack. Needs real animated drones
   in the renderer (see the critter/rotor systems) and the attack/defense simulation hook.
4. **Bridges.** At full upgrade they currently stop looking voxel. He wants them to stay voxel and
   become iconic bridges (Golden Gate, Brooklyn and others) when fully upgraded and long. They should
   grow progressively with the run length: 3 joined pieces raises a taller middle tower; 6 pieces gives
   two towers, and so on. A fully upgraded long run should look like a real voxel Golden Gate. Do the
   same for the other bridge types.
5. Keep doing the UI review and style guide (Part B) and the rest of Part A afterwards.

New gameplay elements (2 and 3) need catalog entries, stats, costs, Atlas/Handbook entries and tests,
following the existing expansion catalogs (e.g. expansionSafetyMilitaryCommerce.ts, skylineCatalog.ts).

## Ground rules for every run
- Work on branch(es) off the latest `main`, open PRs, keep `npm run lint`, `npm test`, `npm run build` green.
- Preserve IDs, saves, footprints, costs, progression, simulation behavior (see brief step 6). Keep multiplayer paused.
- Merge to `main` / production deploy: see PROGRESS.md "Deploy policy".
- Never touch Stripe/App Store/Play live settings, real payments, or user data.
