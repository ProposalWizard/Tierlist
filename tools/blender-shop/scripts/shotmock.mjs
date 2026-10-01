import { chromium } from "/home/user/Tierlist/node_modules/playwright/index.mjs";
const [, , inp, out] = process.argv;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage", "--disable-gpu", "--allow-file-access-from-files"] });
const pg = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await pg.goto("file://" + inp); await pg.waitForTimeout(400);
await pg.screenshot({ path: out });
await browser.close();
