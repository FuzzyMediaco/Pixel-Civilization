# Pixel Civilization: UI/UX review and unified phone-first redesign

Reviewer: review_ui (read-only). Scope: `src/App.tsx`, all `src/components/*`, `index.css`, `src/styles/interface.css`, `src/islandDesk.css`, `src/components/*.css`, `public/styles.css`, and the handbook and field-guide entry points.
Method: Playwright with software GL against a snapshot of `HEAD` (b109be7). I took screenshots at **phone 430x930 @2x** and **desktop 1400x900**, and dumped every visible control with its size for each state.

Scripts (all new, all read-only tooling):

| Script | What it does |
|---|---|
| `scripts/review/ui-lib.mjs` | Launches Chromium, opens the game, and builds an inventory of controls and panels |
| `scripts/review/ui-tour.mjs [phone\|desk] [regex]` | Runs about 37 UI states: screenshots plus `tour-<device>.json` with control sizes |
| `scripts/review/print-inv.cjs` | Prints an inventory JSON |
| `scripts/review/shoot-clean-bg.mjs` | Captures the map with no UI, as a backdrop for the mockups |
| `scripts/review/shoot-mocks.mjs <dir>` | Screenshots the static HTML mockups |

All screenshots are in `SHOTS = /tmp/claude-0/-home-user-Pixel-Civilization/82636313-3a2d-5962-b203-fb2d54579198/scratchpad/review_ui/`. File names follow `phone-<state>.png` / `desk-<state>.png`. That folder is scratch space; re-run `ui-tour.mjs` to regenerate it.

> Headless-capture caveat: in a few captures a pale-blue rectangle appears in the WebGL canvas (for example `phone-connections-desk.png`). It looks like a software-GL artefact, not a UI problem, and it is ignored below.

---

## TL;DR

The game has **about six separate navigation systems** that grew on top of each other:

- the hamburger full-screen menu
- the Build / Layers / View / Status rail
- the "Island tools" desk with 5 tabs
- the shortcuts in the City pulse bar
- the cursor-control popover
- inspector buttons that jump into other panels

The same destination often has **3 to 5 entry points with 3 different names**. Containers use **at least 6 different panel styles**. **173 distinct controls are under 40 px** on phone. The things a mayor most needs (power shortage, why people are unhappy, upgrade cost) are hidden behind drawers, tooltips (which never appear on touch) or unlabeled icons.

The fix is not more polish on each panel. It is **one information architecture and one component kit**:

- **Top HUD**: one row of 4 status chips plus speed. An alert pill appears only when something is wrong.
- **Bottom nav**: five tabs (**Build · Layers · City · Transit · More**).
- **One bottom-sheet component** for everything, with three snap heights.
- **An inspector sheet** with labeled actions.
- **A placement bar** that replaces the palette while you build.
- **A cause list with "Fix" deep links** that answers "why?".

Rail Operations already uses a bottom sheet and is the best-designed panel in the game, so the redesign generalises its pattern.

Proposed phone layout (mockups, real map backdrop):

| Idle with alert | Build sheet | Placing | Inspector | Why unhappy |
|---|---|---|---|---|
| `SHOTS/mock1-idle.png` | `SHOTS/mock2-build.png` | `SHOTS/mock3-placing.png` | `SHOTS/mock4-inspector.png` | `SHOTS/mock5-why.png` |

The mockup sources are `SHOTS/mock*.html`, styled by `SHOTS/kit.css`. `kit.css` doubles as a prototype of the token and component kit.

---

## 1. Current-state map

### 1.1 Always-on chrome (idle)

| Element | Component / file | Phone position and size | Notes |
|---|---|---|---|
| Hamburger | `App.tsx` `.game-menu-trigger` | top-left, 39x39 | Opens the full-screen main menu |
| City pulse bar (Population / Happiness / City wealth) | `IslandControls.tsx` `CityBar`, `islandDesk.css .city-pulse` | top, 3 buttons of 71x39 | Each tap opens the **City accounts** desk at a sub-tab. Hidden whenever Status is open. |
| "Island tools" launcher | `App.tsx .island-launch` | below the hamburger, 95x39 | Opens the left "desk" (Land & water / Transit & harbor / City accounts / God controls / Connections) |
| Rail (Build / Layers / View / Status) | `RightIconRail.tsx`, `.island-rail` | **phone**: horizontal bar at the bottom, 317x53. **desktop**: vertical on the right edge. | The keys B / H / V / T are not discoverable on touch |
| Cursor control | `CursorControlButton.tsx` | bottom-right, 44x44 | Popover with "Smart placement / Place once / Keep placing" and the "Layer Click Filter" |
| World guide pill (example islands only) | `ExampleIslands.tsx WorldGuide` | bottom-centre, 227x36 | **Sits under the rail on phone, so it cannot be tapped** |
| Toasts | `App.tsx .event-toasts` | top-right, 320 px wide | Can cover the desk header (`phone-desk-works.png`) |
| Heat-map pill, invasion banner | `App.tsx` | top | Shown only in some states |

Screens: `phone-idle-home.png`, `phone-idle-switchyard.png`, `desk-idle-home.png`, `desk-idle-switchyard.png`.

### 1.2 Panels and states captured

| # | State | How to reach it (taps) | Container style | Screenshot |
|---|---|---|---|---|
| 1 | Build palette (strip) | Build | Tailwind card above the rail | `phone-build-open.png`, `desk-build-open.png` |
| 2 | Build expanded grid | Build → ⌃ | same | `phone-build-expanded.png` |
| 3 | Category picker (15 buttons) | Build → "Starter 10 ▾" | grid replaces the items | `phone-build-categories.png` |
| 4 | Search | Build → 🔍 | inline input (22 px tall) | `phone-build-search.png` |
| 5 | Brush active (Roads) | Build → Roads | palette stays open; level stepper "L1"; cursor button turns orange | `phone-build-brush-road.png` |
| 6 | After placing a house | Build → House → map | palette stays open; no cost or confirmation feedback | `phone-build-placed.png` |
| 7 | Inspector (house) | tap a building | one-row card, 7 unlabeled 35 px icons | `phone-inspector-house.png`, `desk-inspector-house.png` |
| 8 | Inspector (depot) | tap a depot | adds "Rail Operations" | `phone-inspector-depot.png`, `desk-inspector-depot.png` |
| 9 | Connections | inspector → Connections | **left desk** (a different style), 5 tabs over 2 rows, edge `<select>`s | `phone-connections-desk.png` |
| 10 | Rail Operations | depot → Rail Operations | modal bottom sheet with a dimmed backdrop, 6 tabs over 2 rows | `phone-rail-ops.png` |
| 11 | Layers (18 heat maps) | Layers | Tailwind drawer, 2-column grid of raw ratios | `phone-layers-open.png`, `phone-layers-happiness.png` |
| 12 | View → Weather / 360° / Defense | View (+ tab) | Tailwind drawer, segmented control | `phone-view-weather.png`, `phone-view-camera.png`, `phone-view-defense.png` |
| 13 | Status ("Island status") | Status | Tailwind drawer, **at the bottom on phone even though it is named "Top Menu"** | `phone-status-open.png` |
| 14 | City report (Advisor) | Status → City issues | full-height modal, 4 tabs | `phone-advisor.png` |
| 15 | Island tools → Land & water | Island tools | left desk with a dark header; `<select>` of 20 tools; X/Z number inputs | `phone-desk-works.png` |
| 16 | Island tools → Transit & harbor | Island tools → tab | left desk | `phone-desk-transit.png` |
| 17 | City accounts → Wellbeing | tap Happiness in the pulse bar | left desk **plus** 6 sub-tabs over 2 rows | `phone-citybar-happiness.png`, `phone-desk-city.png`, `phone-desk-city-scrolled.png` |
| 18 | God controls | Island tools → God controls | left desk, numeric "Island travel demand ×" | `phone-desk-god.png` |
| 19 | Cursor popover | cursor button | floating card | `phone-cursor-menu.png` |
| 20 | Main menu (hamburger) | ☰ | full-screen page | `phone-menu-hamburger.png`, `phone-menu-hamburger-full.png` |
| 21 | Saves | ☰ → Saves | GameDialog modal | `phone-saves.png` |
| 22 | Example islands | ☰ → Example islands | GameDialog sheet | `phone-examples.png` |
| 23 | World-guide tap | tap the pill | **opens View instead (the rail is on top)** | `phone-world-guide.png` |
| 24 | Inspector + Build open | select, then Build | stacked cards | `phone-stacked.png` |
| — | Desktop equivalents | | | `desk-*.png` |

Not present: there is **no merge flow** in the current UI. Upgrading grows the footprint into adjacent free land (`upgradeElementDirect` → `resizeElementForLevel`). "Merge" survives only as a toast kind and an animation kind (`simulation.ts:112,300`), and is used as a generic success colour.

### 1.2b Desktop observations (1400x900)

- The rail is vertical on the right (48x49 buttons) and the Build palette is a centred strip. When an element is selected, the inspector stacks on top of the palette, and **two "Select" buttons are visible at once** (palette and cursor control): `desk-build-open.png`, `desk-stacked.png`.
- The Status drawer opens **top-right** on desktop but at the **bottom** on phone. The same panel moves between form factors, and the City pulse bar disappears while it is open (`desk-status-open.png`, `phone-status-open.png`).
- Rail Operations is a centred modal on desktop and a bottom sheet on phone. Connections uses the left desk, with 5 edge `<select>`s and a field-guide link (`desk-connections-desk.png`, `desk-rail-ops.png`).
- All Tailwind panels keep their phone-sized 9–11 px text on a 1400 px screen. Only the left desk uses 14 px, so the two styles look like two different apps side by side (`desk-connections-desk.png` vs `desk-layers-open.png`).
- The inspector covers the World guide pill (`desk-inspector-depot.png`).

### 1.3 Inventory of entry points (duplicated functions)

| Function | Entry points today | Names used |
|---|---|---|
| Simulation speed | TopHud quick controls · Hamburger "Simulation speed" · God controls Pause/Step | "Cycle Speed", "Simulation Speed", "Pause clock" |
| Weather / time | View rail · TopHud quick controls · Hamburger · God controls "Weather, camera & clock" | "View", "Weather Studio", "Studio Drawer", "Weather, camera & clock" |
| Camera zoom / spin / recentre | TopHud quick controls · View → 360° | "Quick controls", "360°" |
| Heat maps | Layers rail · Hamburger "Heat Maps" · Advisor "Inspect on island" · heat-map pill "Switch" | "Layers", "Map layers", "Civilization Heat Maps", "Heat Maps" |
| City report / advisor | TopHud "City issues" · Hamburger "City Report & Stages" | "City issues", "Island Civilization Report", "City Advisor & 20 Stages", "City Report & Stages" |
| Population / happiness / wealth | City pulse bar · TopHud status drawer · Hamburger stats · Advisor · City accounts | "City wealth" vs "Treasury" (two different numbers) |
| Land & water tools | Island tools tab · Hamburger · Build palette "Terrain & transport" · God controls "Terrain, water & crossings" | 4 different labels |
| Transit | Island tools tab · Hamburger · Rail Operations · tapping a vehicle | "Transit & harbor", "Dispatch & routes", "Rail Operations" (two separate train UIs: `MobilityPanel` and `RailOperations`) |
| City economy | Island tools tab · Hamburger "City ledger & services" · pulse-bar taps · Advisor links | "City accounts", "City ledger & services" |
| Crime toggle | TopHud · Hamburger · View → Defense · God controls | "Crime", "God Mode Crime Simulation", "Crime: OFF" |
| Maintain / repair | Inspector wrench · TopHud "Repairs" | |
| Back to Select | Build palette "Select" · cursor popover "Return to Select Tool" · Esc | **Two "Select" buttons on screen at once on desktop** (`desk-build-open.png`) |
| Rotate | Palette rotate (brush) · inspector rotate · key R | |
| Undo | **Only** in the Build palette, as "Undo building edit". Separately, "Undo last works" in Land & water. | |
| Field guide | Inspector name link (71x14, opens a new tab) · Connections link · Hamburger | |

---

## 2. Problems ranked by severity

Severity: **S1** blocks or confuses core play on phone · **S2** costs taps or comprehension every session · **S3** polish.

### S1: critical

**P1. No single information architecture: about six overlapping navigation systems.**
Evidence: see table 1.3. Opening Build closes the desk (`revealOverlay` calls `setDesk(null)`). Opening the desk does not close the inspector, and the inspector's "Connections" button opens the desk. The pulse bar opens the desk. The Advisor opens either the desk or Layers. The left desk, the bottom drawers, the full-screen menu and the modal sheets all compete for the same screen. A phone player cannot form a mental model of "where things live".

**P2. One concept, many names.** The same destination appears under different labels:

- Land tools: "Land & water" (desk tab), "Land & public works" (menu and panel h2), "Terrain & transport" (palette), "Terrain, water & crossings" (God controls).
- Economy: "City accounts" vs "City ledger & services".
- Status: "Status" (rail), "Top Menu" (aria label and key T, although on phone it opens at the **bottom**), "Island status" (h2).
- Heat maps: "Layers", "Map layers", "Civilization Heat Maps", "Heat Maps".
- Advisor: "City issues", "Island Civilization Report", "City Advisor & 20 Stages", "City Report & Stages".

Sources: `IslandControls.tsx:13-19`, `HamburgerMenuModal.tsx:260-301`, `BottomDock.tsx:225`, `RightIconRail.tsx:5-10`, `TopHud.tsx`.

**P3. Critical status is hidden while idle.**

- The idle HUD shows only population, happiness and wealth. Power, traffic, crime and issue count appear only inside the Status drawer (`phone-status-open.png`), and that drawer **hides** the pulse bar while open.
- There is no alert surface for "power short" or "school shortage". The Advisor (`phone-advisor.png`) already computes per-cause happiness penalties ("Schools & Education Shortage −6%"), but you reach it with Status → City issues.
- The Status drawer shows "City issues: 1" while the Advisor lists 2.

**P4. The inspector is a row of mystery icons, with a destructive action next to dismiss.**
Evidence: `phone-inspector-house.png`.

- Seven unlabeled 35x35 icons: ✕ Clear, 🗑 Demolish, ⟳ Rotate, ⤨ Variant, ✥ Move, ⊖ Level down, ⊕ Level up.
- Demolish sits **directly beside** dismiss, and nothing asks for confirmation (undo exists, but only inside the Build palette).
- Upgrade cost and requirements live only in `title=` tooltips, which never show on touch.
- Status is encoded as glyphs: "V2 · 1×1 · 💎1.31 · 🌳🚉".
- The biggest, most button-like control is "Connections", a deep-dive panel, while Upgrade is the smallest icon.

**P5. Things overlap or cannot be reached on phone.**

- The World guide pill (`.world-guide`, x100–329, y878) is drawn **under** the bottom rail (y871–924). Tapping it opens View (`phone-world-guide.png`).
- On desktop the inspector covers the guide pill (`desk-inspector-depot.png`: "Switch…").
- The achievement toast lands on top of the desk header (`phone-desk-works.png`).
- The Build palette uses `pr-13` and the rail is 317 px wide, so a dead strip appears beside the cursor button.

### S2: major

**P6. At least six container styles, each with its own close affordance.**

| Style | Used by | Close affordance |
|---|---|---|
| Left desk with a dark-green header | `islandDesk.css .island-desk` | "View map" and "×" (26x37) |
| Paper drawers | Tailwind `.map-drawer`, `.status-drawer` | ⌄ / ✕ at 24x37 |
| Modal bottom sheet | `railOperations.css` | "Close" |
| Full-screen page | `.main-menu` | "Resume Island" |
| GameDialog cards | Saves, Reset, Examples | ✕ |
| Fixed panel nested inside the desk | `InfrastructurePanel` section `fixed z-40` | "Close" and "Put tool away" |
| Floating confirm bar | `.works-confirm` | |

**P7. The Build flow fights the map.**

- Cards show **no cost** (`formatElementStatSummary` prints "+5 Pop", never "$").
- Only "Starter 10" is shown by default. Finding anything else needs the category dropdown (a 15-button grid that pushes the items down: `phone-build-categories.png`) or search.
- The palette header holds 6 controls. One of them ("Terrain & transport") is not a building at all and jumps to another panel.
- **Undo** is hidden here as "Undo building edit".
- While a brush is active the palette stays open and can cover up to half the screen (`phone-build-brush-road.png`).
- The God-mode level stepper is shown as "L1" with two arrow-circle icons.
- After placing, there is no feedback toast with the cost and no undo (`phone-build-placed.png`).

**P8. Tabs inside tabs.**

- Desk tabs (4–5, wrapping to 2 rows) **plus** City sub-tabs (6, 2 rows): `phone-citybar-happiness.png`.
- Rail Operations: 6 tabs over 2 rows.
- Advisor: 4 tabs. View: 3 tabs.
- On a 430 px screen that means 3–4 rows of navigation before any content.

**P9. Desktop-style inputs on a phone game.**

- Construction tool is a native `<select>` holding 20 tools.
- Grid **X/Z coordinate number inputs** ("Coordinates & inspection").
- "Island travel demand ×" free number field; "Scope" / "Action" selects in God controls.
- Edge-behaviour `<select>`s in Connections.
- The station `<select>` in Rail Operations.

**P10. Jargon and developer vocabulary.** Examples:

- "Shared edges", "Ferry clearance", "Aqueduct flow", "Layer Click Filter", "Smart placement", "Cursor Behavior", "Starter 10"
- "V2", "Lv.1 ↗", "Linked / No Road", "· Held", "Experiments", "Allocate total city wealth"
- "S10+", "Sev 2.0", "Potable from local works"
- Raw ratios such as "1260/527" in Layers

The Wellbeing tab (the target when you tap Happiness) opens with "Local food stock 2591.5 meals" and "Spoilage per second" rather than with the reasons people are unhappy.

**P11. Tap targets.** Across the phone states, **173 distinct controls are under 40 px** in at least one dimension (`tour-phone.json`). Most are 33–37 px tall. The worst:

- Layers / View close and collapse: **24x37**
- Desk close "×": **26x37**
- Field-guide name link: **71x14**
- Time-of-day slider track: **6 px** tall
- Search input: **22 px** tall
- Inspector icons: 35x35
- Hamburger: 39x39

Rail Operations tabs are 33 px tall.

**P12. Typography and tokens are fragmented.**

- 11 font sizes in components, including `text-[8px]`, `[9px]`, `[9.5px]`, `[10px]` (51 uses), `[10.5px]` and `[11px]` (44 uses). The desk uses a 14 px base, so the drawers read about 30% smaller than the desk.
- Two token systems: `--ui-*` in `src/styles/interface.css`, versus hard-coded Tailwind stone/emerald/rose and `bg-[#fcfaf5]` (15 uses). `islandDesk.css` and the component CSS contain 55 distinct hex colours.
- `public/styles.css` (1,250 lines, its own `:root` tokens) is **not referenced** by `index.html` or `main.tsx`, so it is dead weight that misleads contributors.
- Icon language is mixed: lucide icons, emoji (💎 ☁ 🌳 🚉) and text arrows (↗ →).

**P13. Weak feedback.**

- Placement charges money silently.
- When an upgrade fails, the reason arrives only as a toast ("Clear a 2×1 site touching this…"). No ghost shows which tiles are needed.
- Toasts are top-right, 320 px wide, and cannot be acted on (no Undo, no "Show").

**P14. "Why?" questions take a scavenger hunt.**

- Layers has 18 equal-weight layers but **no Happiness layer**. Its legend says Good / Edge / Missing for every layer.
- The best explanation (Advisor diagnostics with % penalties) is 2 taps deep, behind a "City issues" label.
- The pulse bar's Happiness tap leads to a different, weaker explanation (City accounts → Wellbeing, plain-text causes, no "Fix" links).

**P15. The hamburger page mixes five unrelated jobs.** Modes, stats (duplicated), speed (duplicated), destinations (duplicated) and destructive reset all sit on one long scrolling page, about 2.5 screens tall (`phone-menu-hamburger-full.png`).

### S3: minor

- Keyboard shortcuts (B / H / V / T / R / Del / Esc) exist but are discoverable only through `title` tooltips. There is no shortcut sheet.
- After Escape, the build palette keeps its expanded state and category open (state leaks between sessions).
- The Status drawer is called "Top Menu" in its aria label and shortcut. It renders top-right on desktop and at the bottom on phone.
- "Resume Island" is the close button of the main menu (odd verb for a close).
- Rail Operations is shown by a separate state (`railSite`) that bypasses `overlay`. Esc ordering and focus restore differ from the other panels.
- The field guide opens in a new tab (`target=_blank`) from a 14 px link. On a phone that leaves the game.
- Mode labels: "God Mode · All 20 Stages Open", "S10+" and "∞ treasury" are inconsistent with "City wealth $1.3M" in the HUD.

---

## 3. Unified redesign proposal

### 3.1 Principles

1. **The map is the screen.** At most one sheet is open at a time. While you place or move something, every sheet collapses into a slim placement bar.
2. **Everything has one home and one name.** No destination has more than one primary entry point. Contextual shortcuts deep-link into that home and use the same name.
3. **Status that matters is always visible, and an explanation is one tap away.** Each stat chip opens its own cause list. Every cause has **Show** (fly to it on the map) and **Fix** (open Build, pre-filtered).
4. **Thumb-first.** Primary actions sit in the bottom 40% of the screen. Every target is at least 44 px (48 px for primary actions). Labels go next to icons for anything you cannot undo.
5. **One kit.** One sheet, one tab control, one chip, one card, one list row, one toast, built on one token set.

### 3.2 Information architecture

```
TOP HUD (always)      [☰]  [👥 3.6k][♥ 72%•][$ 1.3M][⚡ −40•]  [▶ 1×]
ALERT PILL (if any)        ⚠ Power short by 40 · 2 more  (3)      → City ▸ Issues
MAP                    tap = select · long-press = quick info · drag = pan
CONTEXT LAYER          Inspector sheet (selection) | Placement bar (brush) | Works confirm
BOTTOM NAV (always)   [🔨 Build] [🗺 Layers] [🏛 City] [🚆 Transit] [⋯ More]
```

| Home | Contents (replaces) |
|---|---|
| **Build** (sheet) | Search; chips: ★Suggested · Homes · Roads · Work · Food · Power · Water · Parks & Civic · Safety · Faith · Harbor · Land & water · Landmarks · Wealth. Cards: thumb, name, effect, **cost**, lock reason. The "Land & water" chip shows terrain tools as visual cards (replaces InfrastructurePanel's `<select>`). Replaces: `BottomDock` palette, `InfrastructurePanel`, the "Terrain & transport" button, God "Terrain, water & crossings". |
| **Layers** (sheet, peek height) | One row of chips: Happiness · Power · Water · Traffic · Land value · Pollution · Services ▸ (Food / School / Parks / Police / Fire / Waste / Jobs) · Networks ▸ (Lanes / Aqueduct / Ferry / Shared edges). Below: legend with real units, then a **cause list for the active layer** ("North End has no park · Show"). Replaces: `HeatmapPanel`, the heat-map pill, the Hamburger "Heat Maps" entry. |
| **City** (sheet, tabs) | **Issues** (Advisor diagnostics, ranked, Show/Fix) · **People** (population, jobs, wellbeing) · **Money** (treasury, ledger, holds) · **Services** (fire, safety, maintain-all) · **Goals** (20 stages, trends, trophies). Replaces: `TopHud` status drawer, `AdvisorModal`, `CityEconomyPanel`, City pulse-bar targets, "City issues", "Repairs". |
| **Transit** (sheet) | Lines, with their vehicles listed under each · Harbor · Rail yards. Tap a depot or train to open **Rail Operations** as the sheet's full height. Replaces: desk "Transit & harbor", `MobilityPanel`, the separate Rail Operations entry and its `railSite` state. |
| **More** (sheet) | **View** (weather, time, camera, 360°) · **Saves** · **Mode** (God / Real / Survival, plus "Experiment in a God copy") · **Example islands** · **Handbook & Field guide** · **God tools** (God mode only: sandbox values, experiments, disasters/defense, crime) · **Settings** (placement behaviour, tap filter, shortcuts) · Reset (last, red, confirm). Replaces: the full-screen `HamburgerMenuModal`, `ViewEnvPanel`, `CursorControlButton`, desk "God controls", the Hamburger stats and speed blocks. |
| **Inspector** (contextual sheet) | Header: thumb, name, level, the level name and what the next level becomes. Status tags (Road ✓, ⚡ No power, 🌳 no park). Actions: **Upgrade · $cost** (primary; when disabled it shows the reason inline with a "Show space" ghost), Move, Rotate, ⋯ (Variant, Demolish with confirm, Field guide). Tabs: **Needs** · **Output** · **Links** (former Connections: edges, car route, neighbours) · **Trains** (depots and stations only). Replaces: `.selection-inspector`, desk "Connections", the "Rail Operations" button. |
| **Placement bar** (contextual) | Thumb, name, cost per tile and running total; Rotate; Level (God mode); **✓ Done**. An **Undo** floating button appears above the nav for 5 s after any edit. Replaces: the palette-while-placing state, cursor-popover "Keep placing", the second "Select" button. |
| **Toasts** | One stack under the HUD, at most 2 visible, 3 s. Actionable ("Placed House −$120 · Undo"; "Upgrade blocked · Show space"). Achievements show as a gold variant. |

Keyboard shortcuts on desktop map 1:1: B, L, C, T, M, plus R (rotate), Del (demolish, with confirm), Ctrl+Z (undo), Esc (collapse the sheet, then clear the selection). On desktop the same sheets dock as a **380 px left side panel** and the nav becomes a vertical rail. Each component therefore has two layouts and one implementation.

### 3.3 Component system (single kit)

Tokens live in `src/styles/interface.css`, and Tailwind's theme maps to them. Drop the arbitrary `text-[9px]`-style sizes and hex classes.

| Token | Value |
|---|---|
| `--ui-ink #19392f` | primary text |
| `--ui-muted #5a6d62` | secondary text |
| `--ui-paper #faf9f1` | surface |
| `--ui-card #fffef9` | raised surface |
| `--ui-line #d5dccf` | borders |
| `--ui-green #235944` | primary action |
| `--ui-bad #b3362d` | errors and destructive actions |
| `--ui-warn #b5651d` | warnings |
| `--ui-good #2f7d4f` | success |
| `--ui-radius 14px` | corner radius |
| `--ui-shadow` | elevation |
| Type scale | 11 / 13 / 15 / 19 px only. Numbers use `tabular-nums`. |
| Target sizes | 44 px minimum; 48 px for primary actions and nav; 40 px chips |

| Component | Spec | Used by |
|---|---|---|
| `Sheet` | Bottom sheet with snap heights peek (~35%) / half (~60%) / full (92%); drag handle; title row with 44 px ✕; optional `Tabs`; `role="dialog"` when modal, `region` when peek; Esc collapses one level; focus returns to the opener. On desktop it becomes a left side panel. | Build, Layers, City, Transit, More, Inspector, Rail Ops |
| `Tabs` | Segmented control, **at most 4, one row**. For more options, use a `ChipRow`. | City, Inspector, Rail Ops (Overview · Lines · Trains · Cars; Cargo and Upgrades become sections) |
| `ChipRow` / `Chip` | Horizontally scrolling 40 px pills, icon plus label; selected = filled green | Build categories, Layers, filters |
| `ItemCard` | 3-column grid card: 58 px thumb, name (2 lines), effect, **cost**, lock reason | Build |
| `ListRow` | 52 px: icon · title / subtitle · trailing action ("Fix →", "Show", toggle) | Issues, causes, lines, saves, settings |
| `StatChip` | HUD chip: value plus 10.5 px label; red dot and red value when bad; tap opens its cause list | HUD |
| `Tag` | 26 px status pill: good / warn / bad | Inspector, rows |
| `Button` | 48 px; primary / secondary / danger; a label is always required (icon optional) | everywhere |
| `IconButton` | 44 px square, `aria-label` required; only for reversible actions | ✕, rotate, ⋯ |
| `PlacementBar` | Floating 64 px bar above the nav | Build, move, works preview (replaces `.works-confirm`) |
| `Toast` | Dark or gold pill under the HUD, optional action | events |
| `ConfirmDialog` | GameDialog card, two 48 px buttons | Demolish, Reset, overwrite save |

### 3.4 Flow-by-flow tap counts (phone)

Taps counted from idle. A tap on the map counts as one.

| Task | Today | Today's pain | Proposed | New taps |
|---|---|---|---|---|
| Place a road | Build → Roads → drag → Select/Esc → ✕ close palette | **5**; palette covers the map; no cost shown | Build → Roads (sheet collapses to placement bar showing $/tile) → drag → ✓ | **4** |
| Place a house (starter) | Build → House → tap map → ✕ | **4**; no feedback | Build → House → tap map (toast "−$120 · Undo") | **3** |
| Place Apartments (non-starter) | Build → Starter ▾ → Housing → (scroll) Apartments → map → ✕ | **6** | Build → Homes chip → Apartments → map | **4** |
| Upgrade a building | tap building → ⊕ (35 px icon, cost in an invisible tooltip) | **2**, but blind; failure only as a toast | tap building → "Upgrade · $1,800" (when blocked: reason plus "Show space" ghost) | **2**, informed |
| Merge / expand into a neighbour lot | no flow; upgrade silently needs free adjacent tiles | undiscoverable | Upgrade previews the absorbed tiles as a ghost; "Show space" highlights blockers | **2** |
| Why is happiness low? | Status → City issues → read (or Happiness chip → City accounts/Wellbeing → scroll past food stats) | **2–3**; the two paths give different answers | tap ♥ chip → ranked causes with % and Show/Fix | **1** |
| Fix a power shortage | (notice: only in the Status drawer) Status → Build → Starter ▾ → Power & Waste → plant → map → ✕ | **7**, and you must notice it first | ⚡ chip is red and the alert pill shows → tap pill → "Build power" (Build pre-filtered to affordable power) → plant → map | **4**; noticing takes 0 taps |
| Manage a train | find the depot on the map (pan/zoom) → tap → Rail Operations → Trains tab; or Island tools → Transit & harbor → expand Train #1 (a different UI) | **3–4**; two inconsistent UIs | Transit → tap train (opens Rail Ops at the train) | **2** |
| Change weather / time | View (+ tab) | 1–2 (duplicated in 3 places) | More → View | 2 (single home) |
| Undo the last edit | Build → "Undo building edit" | **2**, hidden | Undo button (visible for 5 s after an edit) or toast "Undo" | **1** |
| Save the game | ☰ → scroll → Saves → slot | 3 | More → Saves → slot | 3 |

### 3.5 Phone wireframes

**A. Idle** (see `SHOTS/mock1-idle.png`)
```
┌──────────────────────────────────────────┐
│[☰] │3.6k │72%• │$1.3M │⚡−40• │ [▶1×]    │ 48px HUD, 4 StatChips
│    ⚠ Power short by 40 · 2 more  (3)     │ alert pill (only if issues)
│                                          │
│                 M A P                    │
│                                          │
│                                   [↶]    │ Undo (5 s after edit)
│┌────────────────────────────────────────┐│
││ 🔨Build  🗺Layers  🏛City  🚆Transit  ⋯More ││ 64px nav, 5 x ~80px targets
│└────────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

**B. Build sheet, half height** (`SHOTS/mock2-build.png`)
```
│                 M A P (visible)          │
╞════════════════ ▬▬▬ ═════════════════════╡ drag handle
│ Build                              [✕]   │
│ [🔍 Search 200+ buildings…            ]  │
│ (★Suggested)(●Homes)(Roads)(Power)(Parks→│ ChipRow, scrolls
│ ┌──────┐ ┌──────┐ ┌──────┐               │
│ │ img  │ │ img  │ │ img  │  ItemCard x3  │
│ │House │ │Apts  │ │Block │               │
│ │+5 ppl│ │+40   │ │+90   │               │
│ │ $120 │ │ $900 │ │$2,400│               │
│ └──────┘ └──────┘ └──────┘               │
│ ┌──────┐ ┌──────┐ ┌──────┐ 🔒 Stage 4    │
├──────────────────────────────────────────┤
│ [🔨Build] Layers  City  Transit  More    │
```

**C. Placing** (`SHOTS/mock3-placing.png`)
```
│[☰] │stats…                     │ [▶1×]   │
│ Tap or drag to place · Roads keep going  │ hint toast (first 3 times)
│              ┌ ─ ─ ┐ ghost               │
│                 M A P                    │
│┌────────────────────────────────────────┐│
││[img] Roads  $10/tile · 6 = $60 [⟳][Lv1][✓]││ PlacementBar
│└────────────────────────────────────────┘│
│ [🔨Build] Layers  City  Transit  More    │
```

**D. Inspector, peek to half** (`SHOTS/mock4-inspector.png`)
```
╞════════════════ ▬▬▬ ═════════════════════╡
│ [img] Apartments · Lv 2            [✕]   │
│       "Walk-up" → Lv 3 "Mid-rise" (3×2)  │
│ (🛣 Road ✓)(⚡ No power)(🌳 No park)(💧✓) │ Tags
│ [⬆ Upgrade · $1,800 ][✥ Move][⟳][⋯]      │ 48px, labeled; Demolish in ⋯
│ [ Needs | Output | Links | Info ]        │ Tabs ≤4
│ ⚡ No power — island 40 short     Fix →   │ ListRow
│ 🌳 No park within 4 tiles −8%     Fix →   │
│ 🚌 Transit 6 tiles away           Show    │
```

**E. Why unhappy** (tap ♥ chip, or Layers → Happiness) (`SHOTS/mock5-why.png`)
```
│ map tinted by happiness, labels on worst blocks │
╞════════════════ ▬▬▬ ═════════════════════╡
│ Happiness 72%                      [✕]   │
│ (●♥ Happiness)(⚡Power)(💧Water)(🚗Traffic→│
│ ▕red━━━━━━yellow━━━━━━green▏  unhappy…happy│
│ ⚡ Power short by 40  −14% · 220 ppl  Build power → │
│ 🌳 Few parks in North End −8%       Show →  │
│ 🚗 Traffic on Main St. −4%          Show →  │
```

**F. More sheet**
```
│ More                               [✕]   │
│ View        Weather · time · camera   ›  │
│ Saves       2 of 3 used               ›  │
│ Mode        God · switch / copy        › │
│ Example islands                        › │
│ Handbook · Field guide                 › │
│ God tools   values · disasters · crime ›  │ (God mode only)
│ Settings    placement · tap filter     › │
│ ─────────                                │
│ Reset island                    (red)    │
```

**G. City sheet**
```
│ City                               [✕]   │
│ [ Issues 3 | People | Money | Goals ]    │
│ ⚠ Schools short 540/953   −6%   Fix →    │
│ ⓘ Admin upkeep             −1%   Show    │
│ ── Supply vs demand ──                    │
│ ⚡ Power   1260 / 527   ██████████ ok     │
│ 🎓 Schools  540 / 953   █████░░░░░ short  │
```

### 3.6 What goes away

- The "Island tools" launcher and the left desk (all 5 tabs are redistributed).
- The Status drawer: its stats move to the HUD chips and the City sheet.
- The Advisor modal: it becomes City → Issues and Goals.
- The full-screen hamburger page: it becomes the More sheet.
- The cursor popover: it moves to More → Settings, plus "Keep placing" on the placement bar via long-press on ✓.
- The duplicate "Select" button.
- The heat-map pill: an active layer stays as a chip on the collapsed Layers sheet.
- `public/styles.css` (dead).

---

## 4. Phased implementation plan

Each phase ships independently and keeps `npx tsc --noEmit` and `npm test` green.

### Phase 0: quick wins (about 1–2 days, low risk)

| Change | Files |
|---|---|
| Lift `.world-guide` above the rail on phone (`bottom: calc(64px + 20px + env(safe-area-inset-bottom))`). Hide it while the inspector or a sheet is open. | `src/components/exampleIslands.css`, `src/components/ExampleIslands.tsx` |
| 44 px minimum for every button in the app (`.island-app :is(button,[role=button],summary){min-height:44px;min-width:44px}`). Fix the 24/26 px ✕ buttons, the 22 px search input and the 6 px slider (taller hit area). | `src/islandDesk.css`, `HeatmapPanel.tsx`, `ViewEnvPanel.tsx`, `BottomDock.tsx`, `App.tsx` (desk ×) |
| Show **cost** on build cards; replace "Starter 10" with "Suggested" | `src/components/BottomDock.tsx`, `src/game/catalog.ts` (`CATEGORY_META` label only) |
| Inspector: a labeled "Upgrade · $X" primary button with the disabled reason inline; move Demolish into a ⋯ menu with confirm; remove the emoji codes in favour of `Tag`s | `src/components/BottomDock.tsx` (inspector block), `src/App.tsx` (`handleDeleteSelected` confirm) |
| Add a ⚡ power chip and an issue-count dot to the pulse bar; tapping opens the Advisor Needs tab | `src/components/IslandControls.tsx` (`CityBar`), `src/App.tsx`, `src/islandDesk.css` |
| One name per concept (table 1.3): Build / Layers / City / Transit / More / View / Land & water | `IslandControls.tsx` (`tabs`), `HamburgerMenuModal.tsx`, `RightIconRail.tsx`, `HeatmapPanel.tsx`, `TopHud.tsx`, `AdvisorModal.tsx`, `BottomDock.tsx` |
| Placement toast "Placed X −$cost · Undo"; give toasts an optional action | `src/App.tsx` (`handleTilePlace`), `src/game/simulation.ts` (`pushToast` gains an optional action id) |
| Delete the unused `public/styles.css` (confirm no HTML references it first) | `public/styles.css` |

### Phase 1: kit and tokens (2–3 days)

- Create `src/components/ui/`: `Sheet.tsx`, `Tabs.tsx`, `Chip.tsx` (`ChipRow`), `Button.tsx` (`IconButton`), `ListRow.tsx`, `Tag.tsx`, `StatChip.tsx`, `Toasts.tsx`, `ConfirmDialog.tsx` (wraps `GameDialog.tsx`), plus `ui.css`.
- Consolidate tokens in `src/styles/interface.css`. Map the Tailwind theme in `index.css` (`@theme` colours and font sizes 11/13/15/19). Remove `text-[8–10.5px]`.
- Prototype reference: `SHOTS/kit.css`.
- Migrate `HeatmapPanel.tsx`, `ViewEnvPanel.tsx` and `TopHud.tsx` onto `Sheet` first. They are self-contained, which proves the component.

### Phase 2: navigation shell (3–4 days)

- Add `src/components/BottomNav.tsx`, replacing `RightIconRail.tsx`. `IslandPanel` becomes `"build"|"layers"|"city"|"transit"|"more"`.
- Add `src/components/Hud.tsx`, replacing `CityBar` and the `TopHud` status drawer: 4 StatChips, the speed button and the alert pill. The pill uses Advisor diagnostics, extracted into `src/game/cityIssues.ts` as a pure function shared with `AdvisorModal`.
- In `App.tsx`, remove the `desk`, `folded`, `hamburgerOpen` and `advisorOpen` states. There is one `sheet` state plus `selection` / `brush`, and a single Esc ladder: placement → sheet → selection.
- `CitySheet.tsx` composes `CityEconomyPanel` sections and the `AdvisorModal` tabs (Issues / People / Money / Goals).
- `TransitSheet.tsx` composes `MobilityPanel`. Rail Operations opens inside it, which retires the `railSite` side-state.
- `MoreSheet.tsx` absorbs `HamburgerMenuModal`, `ViewEnvPanel`, `GodControls`, the `CursorControlButton` settings and the SaveSlots entry. `HamburgerMenuModal.tsx` and `CursorControlButton.tsx` are then deleted.
- Desktop: `Sheet` renders as a 380 px left panel at ≥ 900 px; `BottomNav` becomes a vertical rail.

### Phase 3: build, placement, inspector (3–4 days)

- Split `BottomDock.tsx` (622 lines) into `BuildSheet.tsx` (ChipRow, search, ItemCard grid, Suggested logic based on current shortages), `PlacementBar.tsx` (brush, rotate, level, running cost, ✓) and `InspectorSheet.tsx` (header, tags, actions, tabs Needs / Output / Links / Trains).
- Move the `Connections` content from `IslandControls.tsx` into the Inspector "Links" tab. Hide the edge `<select>`s behind "Advanced".
- Turn `InfrastructurePanel.tsx` into the "Land & water" category of BuildSheet: visual tool cards in place of the `<select>`, sliders for width and height, X/Z inputs behind an "Advanced" disclosure. `.works-confirm` moves into `PlacementBar`.
- Add an upgrade preview ghost. The renderer needs `setUpgradePreview(el, tiles)` in `src/game/worldRenderer.ts`; the "Show space" action uses it.

### Phase 4: "Why?" everywhere (2–3 days)

- `src/game/cityIssues.ts`: ranked causes, each with a happiness or penalty share, affected count, `focus` (grid point or element ids) and `fix` (a Build filter such as `{category:"power_waste", affordable:true}`).
- Consumed by: the alert pill, City → Issues, the Happiness layer cause list (add a `"happiness"` `HeatmapKind` in `simulation.ts` and colour it in `worldRenderer.ts`), and the Inspector Needs tab (per building).
- Replace raw ratios in Layers with units and status words ("Power 1,260 / 527 MW · surplus").

### Phase 5: polish

- Rail Operations: cut to 4 tabs (Overview · Lines · Trains · Cars); Cargo and Upgrades become sections. Replace the station `<select>` with a chip row. File: `RailOperations.tsx` / `railOperations.css`.
- First-run hints: three toasts that teach Build, tap-to-inspect and the ♥ chip. A shortcut sheet in More → Settings on desktop.
- Field guide: open in an in-game sheet (iframe or route) rather than a new tab. Handbook stays in More.
- Accessibility pass: focus order per sheet, `aria-live` for toasts, reduced motion for sheet snaps.

### Verification checklist per phase

- Re-run `GALLERY_PORT=<port> node scripts/review/ui-tour.mjs phone` and `… desk`.
- In `tour-phone.json`, the target is **0 interactive controls under 44 px** (except inline text links).
- The visible fixed panels per state should be **at most 3**: HUD, nav, plus one sheet or bar.
- Re-measure section 3.4's tap counts by hand on a real phone.
