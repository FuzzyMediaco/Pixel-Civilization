// Clean map backdrop (no UI) for mockups: node scripts/review/shoot-clean-bg.mjs out.png
import { launch, open, PHONE } from "./ui-lib.mjs";
const b = await launch();
const { page } = await open(b, PHONE, "#world=switchyard-city");
await page.addStyleTag({ content: "main > :not(canvas){display:none!important}" });
await page.waitForTimeout(500);
await page.screenshot({ path: process.argv[2] });
await b.close();
