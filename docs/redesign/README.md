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

## Ground rules for every run
- Work on branch(es) off the latest `main`, open PRs, keep `npm run lint`, `npm test`, `npm run build` green.
- Preserve IDs, saves, footprints, costs, progression, simulation behavior (see brief step 6). Keep multiplayer paused.
- Merge to `main` / production deploy: see PROGRESS.md "Deploy policy".
- Never touch Stripe/App Store/Play live settings, real payments, or user data.
