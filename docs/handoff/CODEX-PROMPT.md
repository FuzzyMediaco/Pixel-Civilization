# Prompt to give Codex

You're taking over the visual overhaul of Pixel Civilization in the GitHub repo `FuzzyMediaco/Pixel-Civilization` (default branch `main`). Claude started it. You'll finish all of it.

**Start here, in this order:**
1. Read `AGENTS.md` at the repo root.
2. Read `docs/handoff/CODEX-HANDOFF-2026-11-27.md` completely. It's the single source of truth: what's already merged, which unmerged branches to finish first, the full work queue, the exact art pipeline commands, the quality bar, and the UI/UX rules.
3. Then read `docs/redesign/ART-BRIEF.md`, `docs/redesign/README.md`, `docs/redesign/CIVIC-FIVE-SPEC.md` and `docs/redesign/PROGRESS.md`.

**Then do the whole queue in section 3 of the handoff, in order:**
1. Finish and merge the civic slice (`redesign/slice-1-civic-five`, then the real post office, courthouse, city offices and bank).
2. Overhaul the remaining 23 commercial buildings.
3. Upgrade government services and add new big civic-administration buildings: the climbing-wall city offices, and the levitating split skyscraper office over an energy field.
4. Add the new military pieces: underground missile silos, and drone-swarm bases that launch during attacks and fly training exercises.
5. Make bridges stay voxel and grow towers with run length until a long, fully upgraded run is a voxel Golden Gate or Brooklyn Bridge.
6. Bring every redesigned element into all ten eras.
7. Do the rest of the catalog.
8. Do the full UI review and write `docs/STYLE-GUIDE.md`.

**How to work:**
- Ship in small PRs. Each PR includes before/after renders.
- Merge only when `npm run lint`, `npm test` and `npm run build` pass and the GitHub "Game checks" run is green.
- Render and look at every model yourself with `scripts/shoot-gallery.mjs`. If something reads as a box, or looks like its neighbor, redo it.
- Make it fun and visually rich, like the Cheesesteak Spot and the already-merged commercial buildings (PRs #33 and #34).
- Never change IDs, footprints, costs, saves, simulation, prices, billing or store listings.
- Use only original characters.

**UI/UX bar:**
- Every screen must look like the same game: the same DM Sans font, the same token colors (`--ui-green` primary on warm paper and cream cards), the same 11/13/15/19 type scale, the same 14/10 radii and 44px tap targets, the same lucide icon-first controls, and the same sheet anatomy (header with icon, title and close; then tabs or chips; then cards or rows; then a sticky primary action).
- Rebuild **Sculpt** and the **Store and every paid screen** with the shared `src/components/ui` kit so they match the Build sheet exactly.
- Only change visuals on the paid screens: keep every price, product, consent, terms text, legal link and Restore Purchases control.
- Check phone sizes first (390×844 and 360×740), then desktop. Make it polished and cool, not just consistent.

After each merge, append a dated line to `docs/redesign/PROGRESS.md`. When everything is done, write a final report: PR links, before/after boards, coverage totals, and anything that needs Brigham.
