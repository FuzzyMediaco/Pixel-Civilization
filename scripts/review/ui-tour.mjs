// UI review tour: screenshots every panel/state at phone + desktop and dumps control inventories.
// Usage: GALLERY_PORT=5311 node scripts/review/ui-tour.mjs [phone|desk] [filter]
import fs from "node:fs";
import { launch, open, inventory, panels, PHONE, DESK, OUT } from "./ui-lib.mjs";
const device = process.argv[2] ?? "phone";
const filter = process.argv[3];
const opts = device === "phone" ? PHONE : DESK;
const SW = "#world=switchyard-city";
const clickText = async (page, sel, text) => { await page.locator(sel, { hasText: text }).first().click({ timeout: 4000 }); await page.waitForTimeout(600); };
const rail = (page, id) => page.click(`[data-panel-toggle="${id}"]`).then(() => page.waitForTimeout(700));
const selectDef = async (page, defId) => page.evaluate((defId) => {
  const w = window.__pixelWorld; const el = w.gameState.elements.find((e) => e.defId === defId) ?? w.gameState.elements.find((e) => e.defId.includes(defId));
  if (!el) return "none"; w.focusElement(el.id); w.callbacks.onSelectElement(el.id); return el.id;
}, defId).then(async (r) => { await page.waitForTimeout(900); return r; });
const tapCenter = async (page, dx = 0, dy = 0) => { const v = page.viewportSize(); await page.mouse.click(v.width / 2 + dx, v.height / 2 + dy); await page.waitForTimeout(900); };

const states = {
  "idle-home": ["", async () => {}],
  "idle-switchyard": [SW, async () => {}],
  "menu-hamburger": [SW, async (p) => { await p.click('[aria-label="Open Game Menu"]'); await p.waitForTimeout(700); }],
  "menu-hamburger-full": [SW, async (p) => { await p.click('[aria-label="Open Game Menu"]'); await p.waitForTimeout(700); return { full: true }; }],
  "build-open": ["", async (p) => { await rail(p, "build"); }],
  "build-expanded": ["", async (p) => { await rail(p, "build"); await p.click('[aria-label="Expand Multi-Row Grid"]'); await p.waitForTimeout(500); }],
  "build-categories": ["", async (p) => { await rail(p, "build"); await p.click('[aria-label^="Choose building category"]'); await p.waitForTimeout(500); }],
  "build-search": ["", async (p) => { await rail(p, "build"); await p.click('[aria-label="Search elements"]'); await p.fill('input[type=search]', 'house'); await p.waitForTimeout(500); }],
  "build-brush-road": ["", async (p) => { await rail(p, "build"); await p.locator(".build-element").first().click(); await p.waitForTimeout(600); }],
  "build-placed": ["", async (p) => { await rail(p, "build"); await p.locator(".build-element").nth(1).click(); await p.waitForTimeout(500); await tapCenter(p, 0, -60); }],
  "inspector-house": [SW, async (p) => { await selectDef(p, "house"); }],
  "inspector-depot": [SW, async (p) => { await selectDef(p, "train_depots"); }],
  "connections-desk": [SW, async (p) => { await selectDef(p, "house"); await clickText(p, "button", "Connections"); }],
  "rail-ops": [SW, async (p) => { await selectDef(p, "train_depots"); await clickText(p, "button", "Rail Operations"); }],
  "layers-open": [SW, async (p) => { await rail(p, "layers"); }],
  "layers-happiness": [SW, async (p) => { await rail(p, "layers"); await p.locator("#island-panel-layers button", { hasText: /Happ|Power/ }).first().click(); await p.waitForTimeout(800); }],
  "layers-pill": [SW, async (p) => { await rail(p, "layers"); await p.locator("#island-panel-layers button", { hasText: /Power/ }).first().click(); await p.waitForTimeout(500); await rail(p, "layers"); }],
  "view-weather": [SW, async (p) => { await rail(p, "view"); }],
  "view-camera": [SW, async (p) => { await rail(p, "view"); await p.locator("#island-panel-view button", { hasText: /360|Camera/ }).first().click(); await p.waitForTimeout(500); }],
  "view-defense": [SW, async (p) => { await rail(p, "view"); await p.locator("#island-panel-view button", { hasText: /Defen/ }).first().click(); await p.waitForTimeout(500); }],
  "status-open": [SW, async (p) => { await rail(p, "status"); }],
  "advisor": [SW, async (p) => { await rail(p, "status"); await p.click('[title="City Advisor & 20 Stages"]'); await p.waitForTimeout(800); }],
  "desk-works": [SW, async (p) => { await clickText(p, "button.island-launch", "Island tools"); }],
  "desk-transit": [SW, async (p) => { await clickText(p, "button.island-launch", "Island tools"); await clickText(p, ".island-desk nav button", "Transit"); }],
  "desk-city": [SW, async (p) => { await clickText(p, "button.island-launch", "Island tools"); await clickText(p, ".island-desk nav button", "City accounts"); }],
  "desk-god": [SW, async (p) => { await clickText(p, "button.island-launch", "Island tools"); await clickText(p, ".island-desk nav button", "God"); }],
  "citybar-happiness": [SW, async (p) => { await clickText(p, ".city-pulse button", "Happiness"); }],
  "cursor-menu": [SW, async (p) => { await p.click('[aria-label="Cursor Tool Control"]'); await p.waitForTimeout(600); }],
  "saves": [SW, async (p) => { await p.click('[aria-label="Open Game Menu"]'); await p.waitForTimeout(500); await clickText(p, ".main-menu button", /Save|Load/); }],
  "examples": [SW, async (p) => { await p.click('[aria-label="Open Game Menu"]'); await p.waitForTimeout(500); await clickText(p, ".main-menu button", "Example islands"); }],
  "world-guide": [SW, async (p) => { await p.click(".world-guide-toggle", { force: true }); await p.waitForTimeout(600); }],
  "stacked": [SW, async (p) => { await selectDef(p, "house"); await rail(p, "build"); }],
};
const b = await launch();
const report = {};
for (const [name, [hash, fn]] of Object.entries(states)) {
  if (filter && !name.includes(filter)) continue;
  const { ctx, page } = await open(b, opts, hash);
  let extra = {};
  try { extra = (await fn(page)) ?? {}; } catch (e) { console.log(`[${name}] step failed: ${e.message.split("\n")[0]}`); }
  const file = `${OUT}/${device}-${name}.png`;
  if (extra.full) {
    const h = await page.evaluate(() => document.querySelector(".main-menu")?.scrollHeight ?? innerHeight);
    await page.setViewportSize({ width: opts.viewport.width, height: Math.min(h, 6000) }); await page.waitForTimeout(400);
  }
  await page.screenshot({ path: file });
  report[name] = { inv: await inventory(page), panels: await panels(page) };
  console.log("saved", file, "controls", report[name].inv.count, "tiny", report[name].inv.tiny);
  await ctx.close();
}
const f = `${OUT}/tour-${device}.json`;
const prev = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
fs.writeFileSync(f, JSON.stringify({ ...prev, ...report }, null, 1));
await b.close();
