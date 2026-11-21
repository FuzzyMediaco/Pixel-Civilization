// Screenshot the static redesign mockups: node scripts/review/shoot-mocks.mjs <dir>
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const dir = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 430, height: 930 }, deviceScaleFactor: 2 });
for (const f of fs.readdirSync(dir).filter((f) => f.startsWith("mock") && f.endsWith(".html"))) {
  await p.goto(`file://${dir}/${f}`); await p.waitForTimeout(300);
  await p.screenshot({ path: `${dir}/${f.replace(".html", ".png")}` }); console.log("saved", f);
}
await b.close();
