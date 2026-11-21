// node scripts/review/ui-explore.mjs  -> idle screenshots + control inventory JSON
import fs from "node:fs";
import { launch, open, inventory, panels, PHONE, DESK, OUT } from "./ui-lib.mjs";
const b = await launch();
const res = {};
for (const [name, opts] of [["phone", PHONE], ["desk", DESK]]) {
  for (const [w, hash] of [["home", ""], ["switchyard", "#world=switchyard-city"]]) {
    const { ctx, page } = await open(b, opts, hash);
    await page.screenshot({ path: `${OUT}/${name}-${w}-idle.png` });
    res[`${name}-${w}`] = { inv: await inventory(page), panels: await panels(page) };
    await ctx.close();
  }
}
fs.writeFileSync(`${OUT}/explore.json`, JSON.stringify(res, null, 1));
await b.close();
