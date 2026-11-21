# UI round 2: unified phone UI (Phases 0–4)

This implements the plan in `docs/review/ui-review.md`. The design target is a phone at 430×930. The layout is a 4-chip HUD, an alert pill, one bottom-sheet component and 5 bottom tabs. There are no simulation changes: the only new game file is `src/game/cityIssues.ts`, which is pure and read-only.

## Where everything lives now (one home each)

| Home | Contents | Replaced |
|---|---|---|
| **HUD** (`Hud.tsx`) | Four chips:<br>• people: shows `max · <need>` when `metrics.populationLimiter` caps growth<br>• happy<br>• treasury (or wealth in God mode)<br>• power net<br>Plus a speed button that cycles Pause / 1× / 2× / 4×. Each chip opens its explanation: people → City/People, happy → City/Issues, money → City/Money, power → Layers/Power. | `CityBar`, the `TopHud` status drawer, the hamburger stats and speed |
| **Alert pill** | The top critical or warning issue, plus a count. Tapping it opens City → Issues. Shown only when idle. | — |
| **Build** (`BuildSheet.tsx`) | • Search<br>• Chip row: Suggested (picked from current shortages) · Homes · Roads & transit · … · **Land & water** (the former `InfrastructurePanel`) · All<br>• Cards show thumb, name, effect, **cost** and the lock reason | `BottomDock` palette, "Starter 10", the "Terrain & transport" button, desk "Land & water" |
| **PlacementBar** | Shown while placing:<br>• thumb, name, cost per item or tile, running count and total<br>• Rotate, Lv stepper (God mode only), ✓<br>• first-use hint and the invalid-spot reason<br>The same bar is used for moving, land & water drawing, works confirm (Apply/Cancel) and vessel dispatch. | `.works-confirm`, the cursor popover, the duplicate "Select" button |
| **Inspector** (`InspectorSheet.tsx`) | • Header: level name → next level name and size<br>• Status tags<br>• **Upgrade · $X**, with the disabled reason shown inline<br>• Move and Rotate (God mode)<br>• ⋯ menu: Next style, Level down, Field guide, **Demolish…** (asks to confirm)<br>• Tabs: Needs (upgrade requirement, road, fire and police cover, city shortages with Fix →), Links (the former Connections), Info (the Selected-site economy), Trains (rail sites → Rail Operations) | `.selection-inspector`, desk "Connections" |
| **Layers** (`LayersSheet.tsx`) | • One chip row (Power, Water, Traffic, Land value, Pollution, then Services ▾ and Networks ▾)<br>• Readout with units ("170 / 240 · short by 70")<br>• Legend<br>• Cause list with Fix/Show | `HeatmapPanel`, the heat-map pill (an active layer now stays as a small chip above the nav) |
| **City** (`CitySheet.tsx`) | Tabs:<br>• **Issues**: growth limiter, ranked issues with Fix/Show, survival repair-all and **auto-maintain** toggle, supply-vs-demand, fire & safety<br>• **People**<br>• **Money**: **tax slider** for `state.taxRate`, 5–25%, real and survival modes; God-mode value controls<br>• **Goals**: stage progress, stages, trends, rules | `AdvisorModal` (now `CityReport.tsx` sections), desk "City accounts", "City issues", "Repairs" |
| **Transit** (`TransitSheet.tsx`) | Rail Operations rows for depots and terminals, then `MobilityPanel`. Rail Operations itself is unchanged (trains agent). | desk "Transit & harbor" |
| **More** (`MoreSheet.tsx`) | • View: weather and time are hidden outside God mode; camera / 360° / defense<br>• Saves<br>• Game mode (+ God copy)<br>• Example islands<br>• Handbook<br>• Field guide<br>• God tools (God mode only; trimmed to step, demand, experiments, snapshots, canal district)<br>• Settings: placement behaviour, tap filter, keyboard shortcuts<br>• Reset (asks to confirm) | `HamburgerMenuModal`, `ViewEnvPanel` drawer, `CursorControlButton`, desk "God controls" |

**Toasts** (`ui/Toast.tsx`) form one stack under the HUD, with at most 2 visible. Interface toasts are actionable, for example "Placed 6 × Roads −$72 · **Undo**", "Demolished House · Undo" and "Apartments is now Lv 2 · Undo". Game toasts appear in the same stack, with a gold style for stage events.

**Keys:**
- B / L / C / T / M open the homes. H still opens Layers, and V opens More → View.
- R rotates.
- Del demolishes, after a confirm.
- Ctrl+Z undoes.
- Esc steps back: placement → More sub-page → sheet → selection.

**Desktop (≥900 px):** sheets dock as a 400 px left panel and the nav centres at the bottom. It is the same components with a different layout.

## Kit (`src/components/ui/`)

- **Components:**
  - `BottomSheet`: peek / half / full; drag or tap the handle to resize, and drag down from peek to close.
  - `Button` and `IconButton`.
  - `Chip`, `ChipRow` and `Tag`.
  - `Tabs`: at most 4.
  - `ListRow`.
  - `InspectorCard`.
  - `Toasts`.
  - `ConfirmDialog`.
- **Styles:** `ui.css`.
- **Tokens:** in `src/styles/interface.css`:
  - colours: ink / muted / green / paper / card / line / bad / warn / good
  - radius
  - type scale 11 / 13 / 15 / 19
  - tap sizes 44 / 48
  - `@theme` in `index.css` maps them to Tailwind.
- **Global rule:** every button, select, summary and input is at least 44 px. Rail Operations is excluded and keeps its own styles. Legacy `text-[8–10.5px]` inside sheets is normalised to the scale.

## Balance hand-offs addressed

- The `populationLimiter` readout is now in the HUD, City → Issues and People. It replaced the "Occupied / capacity" row.
- The tax slider and auto-maintain toggle are in place.
- Weather and time controls are hidden outside God mode.
- `unlockSky()` clears `timeLocked` and `weatherLocked` for non-God saves. It runs at startup, on mode switch and on slot load.

## Removed

- `RightIconRail`
- `HamburgerMenuModal`
- `CursorControlButton`
- `TopHud`
- `BottomDock`
- `HeatmapPanel`
- the dead `public/styles.css`. Only the unbuilt `client/` mentioned it.
- about 280 lines of dead desk and drawer CSS in `src/islandDesk.css`

## Verification

- `npx tsc --noEmit` is clean.
- `npm test` passes: 365 of 365.
- Tour: `node scripts/review/ui-round2-tour.mjs <outDir> <save.json> phone|desk`. Seed the save with `npx tsx scripts/review/ui-seed-real.ts <save.json>`, which writes a real-mode Copper Gorge city with power removed. The tour injects saves through `addInitScript`.
- Result across 17 states, on both the phone run (430×930 @2x) and the desktop run (1400×900): **0 controls under 44 px, 0 panel overlaps, no horizontal scroll, no page errors.**

Screenshots are in `/tmp/claude-0/-home-user-Pixel-Civilization/82636313-3a2d-5962-b203-fb2d54579198/scratchpad/ui_impl/shots/`. Each state has `phone-*.png` and `desk-*.png`:
- `idle`
- `build`
- `build-homes`
- `placing`
- `inspector`
- `inspector-menu`
- `why-unhappy`
- `layers`
- `city-money`
- `more`
- `more-settings`
- `guide`
- `guide-open`
- `transit`
- `more-view`
- `build-works`
- `placing-road`

The audits are in `phone-audit.txt` and `desk-audit.txt`.

## Not done / next

- **Happiness heat-map layer.** It needs a `HeatmapKind` and renderer colours, which would be a sim/renderer change. For now the ♥ chip opens City → Issues.
- **Upgrade "Show space" ghost.** It needs `worldRenderer.setUpgradePreview`.
- **Inline cause lists for Links.** The Links tab is still the old Connections markup, with the edge `<select>`s shown in God mode.
- **Land & water still uses the tool `<select>`.** Visual tool cards are a Phase 3 follow-up.
- **No 5-second floating Undo button.** Undo is on every edit toast and on Ctrl+Z.
- **Rail Operations still has 6 tabs.** That file belongs to the trains agent.
