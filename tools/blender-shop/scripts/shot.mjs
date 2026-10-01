import { chromium } from "/home/user/Tierlist/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage", "--disable-gpu"] });
const pg = await browser.newPage({ viewport: { width: 600, height: 450 } });
await pg.goto("file:///dev/shm/blender-shop/svg/cur.html");
const ids = await pg.$$eval("body > div", (d) => d.map((x) => x.id));
for (const id of ids) await (await pg.$("#" + id)).screenshot({ path: `cur/${id}.png` });
await browser.close();
console.log(ids.length);
