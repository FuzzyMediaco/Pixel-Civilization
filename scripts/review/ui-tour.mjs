// Capture current menu states at phone or desktop size. Run the game first.
import fs from "node:fs";
import path from "node:path";
import { launch, open, inventory, panels, PHONE, DESK, OUT } from "./ui-lib.mjs";

const device = process.argv[2] ?? "phone";
const filter = process.argv[3] ?? "";
const browser = await launch();
const results = {};
try {
  const { page, ctx } = await open(browser, device === "phone" ? PHONE : DESK, "#world=switchyard-city&mode=real");
  for (const section of ["idle", "build", "layers", "city", "transit", "more"]) {
    if (!section.includes(filter)) continue;
    if (section !== "idle") {
      await page.locator(`button[data-panel-toggle="${section}"]`).click();
      await page.locator("#sheet-" + section).waitFor();
    }
    await page.screenshot({path: path.join(OUT, device + "-" + section + ".png")});
    results[section] = {controls: await inventory(page), panels: await panels(page)};
  }
  await ctx.close();
  fs.writeFileSync(path.join(OUT, "tour-" + device + ".json"), JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
