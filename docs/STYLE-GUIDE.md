# Pixel Civilization UI style guide

Every screen in Pixel Civilization should feel like one game: warm paper, deep green, DM Sans,
icon-first controls and the same sheet and popup anatomy everywhere. Follow this guide for any new
screen or change. If it doesn't cover your case, extend the shared kit (`src/components/ui/`) first,
then use what you added. Don't style one screen by hand.

Reference screen: **Build** (`src/components/BuildSheet.tsx`). When in doubt, match it.

---

## 1. Tokens (`src/styles/interface.css`)

| Token | Value | Use it for |
|---|---|---|
| `--ui-font` | DM Sans → Segoe UI → system-ui | All text. No other families. |
| `--ui-ink` | #19392f | Body text, titles |
| `--ui-muted` | #52665b | Secondary text, captions, unselected tabs |
| `--ui-green` | #235944 | Primary buttons, the selected state, links, icons, focus of attention |
| `--ui-leaf` | #dce9d8 | Soft fills: tags, icon tiles, info panels, progress tracks |
| `--ui-paper` | #faf9f1 | Sheet and popup backgrounds |
| `--ui-card` | #fffef9 | Cards, rows, inputs, secondary buttons |
| `--ui-line` | #cfd8c9 | Every border and divider |
| `--ui-good` / `--ui-warn` / `--ui-bad` (+ `-bg`) | | Status only: never decoration |
| `--ui-focus` | #a45312 | 3px keyboard focus ring (global) |
| `--ui-t-xs / sm / md / lg` | 11 / 13 / 15 / 19 px | The only four text sizes |
| `--ui-radius / --ui-radius-sm` | 14 / 10 px | Containers / cards and inputs. Chips and pills use 999px. |
| `--ui-tap / --ui-tap-lg` | 44 / 48 px | Minimum control height |
| `--ui-shadow` | `0 6px 22px #142f2930` | Floating sheets and popups. Rows use `0 3px 10px rgba(17,42,35,.12)`. |

**Never** write a raw hex color, a pixel font size outside the scale, or a new font family in
component CSS or inline `style={{}}`. Inline style is fine only for truly dynamic values, such as a
progress width or a model's own accent color.

**Weights:** 700 for labels and buttons, 800 for titles and numbers, 400 for body copy.

## 2. Icons
- **lucide-react only.** Stroke icons at 15–20px (16 in rows, 18–20 in tiles and headers).
- Icons are `--ui-green` on paper, or white on a green selected state.
- **Icon first:** every button, tab, tile and row leads with an icon. Labels are 1–2 words.
  Longer explanations go in subtitles or reading views (Handbook, Store descriptions).

## 3. Components (`src/components/ui/`)

| Need | Use | Notes |
|---|---|---|
| Action | `Button` / `.ui-btn` | Variants: `is-primary` (one per view), default secondary, `is-quiet`, `is-danger`. Add `is-small` or `is-block` as needed. Icon before the label. |
| Icon-only action | `IconButton` / `.ui-iconbtn` | Always has an `aria-label`. Reversible actions only. |
| Switch between views | `Tabs` / `.ui-tabs` | Segmented control on a frosted track. Selected = green. Use `role="tablist"` plus `aria-selected`. |
| Filters and toggles | `Chip` / `.ui-chip`, `ChipRow` | 44px pills; selected uses `aria-pressed` + green. |
| Status label | `Tag` / `.ui-tag` (`is-bad`, `is-warn`, `is-info`) | 28px pill. |
| List item | `ListRow` / `.ui-row` | Icon, title and subtitle, then trailing value or action. |
| Bottom sheet | `BottomSheet` | Build, Layers, City, Sculpt, More, Settings, Account and View all use it. |
| Popup | `GameDialog` + `className="ui-dialog"` + `DialogHeader` | Store, Saves, Example islands, PixBuilder, Rail, Atlas. |
| Confirm | `ConfirmDialog` | Destructive confirmations. |
| Toast | `Toasts` | Tones `normal`, `alert`, `gold`. |
| Select | native `<select>` (styled globally) | Wrap with `<label className="ui-field">` for an inline label. |

## 4. Anatomy

**Bottom sheet:** grab handle and title line (title + muted subtitle) → `.ui-tabs` or a chip row → a
scrolling list of `.ui-row`s or a tile grid → (optional) a sticky primary action. The sheet keeps
`--above-nav` clearance, so the bottom nav never covers a button.

**Popup** (`GameDialog`):
```tsx
<GameDialog label="Island Store" className="pc-shop ui-dialog" onDismiss={onClose}>
  <DialogHeader icon={<Store size={20}/>} title="Island Store" subtitle="…" onClose={onClose} closeLabel="Close store"/>
  <div className="ui-dialog-body"> …tabs, cards, rows… </div>
  <footer className="ui-dialog-foot"> …secondary actions and links… </footer>
</GameDialog>
```
On phones (≤560px) popups become bottom-anchored full-width sheets automatically.

**Tiles** (Build items, Sculpt tools, More grid): cream card, `--ui-line` border, 10px radius, icon or
thumbnail over a 1–2 word label (11–13px/700). Selected = solid green with white icon and label.

**Cards** (Store products, Example islands): cream card, 14px radius, image on top, 15px/800 title,
price or status as a pill, muted description, one primary button at the bottom.

## 5. Paid surfaces
Paid screens follow exactly the same rules as everything else. Change their visuals only: prices,
product lists, entitlements, consent and terms text, legal links (Privacy, Support, platform terms)
and **Restore purchases** must stay exactly as they are and reachable.

## 6. Tutorial and progressive reveal
- New players start in the tutorial (`src/game/tutorialFlows.ts`, `tutorialProgress.ts`).
- Each step lists `visibleNav`. Menus, Pix and the quick menu stay hidden until they're taught.
- A step finishes when the player does the thing (`completeOn` events), never by reading alone,
  except the welcome step.
- × pauses the tutorial (all menus unlock). More → Tutorial resumes at the saved step.
- When you add a new top-level menu or tool, add a tutorial step that teaches it, or explain why it doesn't need one.

## 7. Motion and accessibility
- Transitions are 150–200ms ease-out, on sheets, selection and progress only. Global
  `prefers-reduced-motion` turns them off.
- 44px targets, a visible 3px focus ring, `aria-pressed` on toggles and `aria-selected` on tabs, and
  ≥4.5:1 text contrast.
- Check every change at **390×844 and 360×740 first**, then desktop at 1440×900. Nothing may overflow
  sideways, every sheet scrolls, and no primary button sits under the bottom nav.

## 8. Checklist for a new or changed screen
1. Built from kit components; no new one-off button, card or tab styles.
2. Tokens only: no raw hex colors, sizes outside 11/13/15/19, or new fonts.
3. Icon-first, with 1–2 word labels.
4. Sheet or popup anatomy as in section 4; `DialogHeader` on popups.
5. Phone checks at 390×844 and 360×740, then desktop; reduced motion; keyboard focus.
6. If it's a new feature, the tutorial teaches it.
7. Before/after screenshots in the PR (`docs/review/ui-consistency/` shows the format).
