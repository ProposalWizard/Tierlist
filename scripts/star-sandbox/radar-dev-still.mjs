/** A still of the live radar on /star-radar-dev mid-match (phone size). */
import { chromium, devices } from "playwright";
const out = process.argv[2] ?? "/tmp/radar-dev.png";
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const pg = await (await b.newContext({ ...devices["iPhone 13"] })).newPage();
await pg.goto("http://localhost:3105/star-radar-dev", { waitUntil: "networkidle", timeout: 300000 });
await pg.waitForTimeout(2000);
const play = pg.locator("button:visible").filter({ hasText: /Play|Start|▶/i }).first();
await play.click();
await pg.waitForTimeout(Number(process.argv[3] ?? 6000));
await pg.screenshot({ path: out });
console.log("still:", out);
await b.close();
