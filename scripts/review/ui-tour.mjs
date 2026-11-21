// UI review tour: screenshots every panel/state at phone + desktop and dumps control inventories.
// Usage: GALLERY_PORT=5311 node scripts/review/ui-tour.mjs [phone|desk] [filter]
import fs from "node:fs";
import { launch, open, inventory, panels, PHONE, DESK, OUT } from "./ui-lib.mjs";
const device = process.argv[2] ?? "phone";
const filter = process.argv[3];
const opts = device === "phone" ? PHONE : DESK;
const SW = "#world=switchyard-city";
// DOM-level click by selector + text (Playwright actionability checks time out under software GL).
const clickText = async (page, sel, text) => {
  const ok = await page.evaluate(([sel, src, flags]) => {
    const re = new RegExp(src, flags);
    const el = [...document.querySelectorAll(sel)].find((e) => re.test(e.textContent ?? ""));
    if (el) el.click(); return !!el;
  }, [sel, text instanceof RegExp ? text.source : text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), text instanceof RegExp ? text.flags : ""]);
  if (!ok) throw new Error(`no ${sel} matching ${text}`);
  await page.waitForTimeout(700);
};
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
  "status-quick": [SW, async (p) => { await rail(p, "status"); await p.click('[aria-label="Show Quick Controls"]'); await p.waitForTimeout(500); }],
  "advisor-stages": [SW, async (p) => { await rail(p, "status"); await p.click('[title="City Advisor & 20 Stages"]'); await p.waitForTimeout(500); await clickText(p, "button", /All 20 Stages/); }],
  "desk-city-scrolled": [SW, async (p) => { await clickText(p, ".city-pulse button", "Happiness"); await p.evaluate(() => { const d = document.querySelector(".island-desk"); if (d) d.scrollTop = 600; }); await p.waitForTimeout(400); }],
  "toast-upgrade-fail": [SW, async (p) => { await selectDef(p, "house"); await p.click('[aria-label="Level Up"]', { force: true }).catch(() => {}); await p.waitForTimeout(700); }],
  "stacked": [SW, async (p) => { await selectDef(p, "house"); await rail(p, "build"); }],
};
const b = await launch();
const f = `${OUT}/tour-${device}.json`;
const report = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
// Reuse one page per hash; reset with Escape between states, reload after states that leave modals or edits behind.
const DIRTY = /build-placed|rail-ops|examples|saves|hamburger|advisor|world-guide|full/;
let cur = null, curHash = null, dirty = false;
for (const [name, [hash, fn]] of Object.entries(states).sort((a, b) => a[1][0].localeCompare(b[1][0]))) {
  if (filter && !new RegExp(filter).test(name)) continue;
  if (!cur || hash !== curHash || dirty) {
    if (cur) await cur.ctx.close();
    cur = await open(b, opts, hash); curHash = hash;
  } else {
    for (let i = 0; i < 4; i++) { await cur.page.keyboard.press("Escape"); await cur.page.waitForTimeout(150); }
    await cur.page.waitForTimeout(300);
  }
  const page = cur.page;
  dirty = DIRTY.test(name);
  let extra = {};
  try { extra = (await fn(page)) ?? {}; } catch (e) { console.log(`[${name}] step failed: ${e.message.split("\n")[0]}`); dirty = true; }
  const file = `${OUT}/${device}-${name}.png`;
  if (extra.full) {
    const h = await page.evaluate(() => document.querySelector(".main-menu")?.scrollHeight ?? innerHeight);
    await page.setViewportSize({ width: opts.viewport.width, height: Math.min(h, 6000) }); await page.waitForTimeout(400);
  }
  await page.screenshot({ path: file });
  report[name] = { inv: await inventory(page), panels: await panels(page) };
  fs.writeFileSync(f, JSON.stringify(report, null, 1));
  console.log("saved", file, "controls", report[name].inv.count, "tiny", report[name].inv.tiny);
}
await b.close();
