// Turn each card in pictures/cards.html into a JPEG (Playwright, the sandbox's Chromium).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("../../docs/handoffs/2026-10-22-leo-tonight/chat4/pictures/", import.meta.url));
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const p = await b.newPage({ viewport: { width: 800, height: 900 }, deviceScaleFactor: 1.5 });
await p.goto("file://" + dir + "cards.html");
for (const id of await p.$$eval(".card", (els) => els.map((e) => e.id))) {
  await p.locator("#" + id).screenshot({ path: dir + id + ".jpg", type: "jpeg", quality: 78 });
  console.log(id);
}
await b.close();
