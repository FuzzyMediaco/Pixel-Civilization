# Pixel Civilization: rules for AI agents and contributors

**Current work:** start at `docs/handoff/CODEX-HANDOFF-2026-11-27.md`. It holds the queue, the art
pipeline, the quality bar and the UI rules.

## Commands
- `npm run lint` (tsc), `npm test`, `npm run build`. All three must pass before any merge, and so must the
  GitHub "Game checks" run.
- Art: `bash scripts/gallery-server.sh`, then `node scripts/shoot-gallery.mjs "<query>" out.png`.
  Handbook: `ATLAS_IDS=<ids> node --import tsx scripts/render-handbook.mjs`.

## Never
- Change element IDs, footprints, costs, progression, saved variant selections or simulation behavior
  as part of an art change.
- Change prices, products, entitlements or billing; touch live Stripe, App Store or Play settings; cut
  native releases; edit store listings.
- Use licensed characters or brands in art (original designs only).
- Merge on red.

## UI style (summary; the full guide is `docs/STYLE-GUIDE.md`)
- Tokens only, from `src/styles/interface.css`: font `--ui-font` (DM Sans); colors `--ui-ink`,
  `--ui-muted`, `--ui-green` (primary), `--ui-leaf`, `--ui-paper`, `--ui-card`, `--ui-line`, plus status
  colors. Type sizes are 11/13/15/19 only. Radii are 14/10/999. Tap targets are 44–48px.
- Components come from `src/components/ui/` (`.ui-btn`, `.ui-chip`, `.ui-tabs`, `.ui-row`, `BottomSheet`,
  `InspectorCard`). Don't add one-off button, card or tab styles, raw hex colors, or inline `style={{}}`
  for visual styling.
- Icon-first: lucide-react icons (16–20px, `--ui-green`), with 1–2 word labels.
- Every sheet uses the same anatomy: header (icon, title, close), then tabs or chips, then a list or
  cards, then a sticky primary action.
- Phone first: check at 390×844 and 360×740, then desktop. Respect `prefers-reduced-motion`.
