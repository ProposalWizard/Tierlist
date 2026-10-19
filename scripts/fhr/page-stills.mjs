// Stills of /star-fhr-dev (phone and desktop) once the ruler has measured.
//   node scripts/fhr/page-stills.mjs [port=3051] [outDir]
import { chromium, devices } from "playwright";
const port = Number(process.argv[2] ?? 3051);
const out = process.argv[3] ?? "docs/handoffs/2026-10-19-ui-lookover/built-pages";
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
for (const [name, opts] of [["phone", { ...devices["iPhone 13"] }], ["desktop", { viewport: { width: 1440, height: 900 } }]]) {
  const pg = await (await b.newContext(opts)).newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(String(e)));
  await pg.goto(`http://localhost:${port}/star-fhr-dev`, { waitUntil: "domcontentloaded", timeout: 600000 });
  await pg.waitForSelector("[data-fhr-kinds]", { timeout: 600000 });
  await pg.waitForTimeout(800);
  await pg.screenshot({ path: `${out}/fhr-page-${name}.jpg`, type: "jpeg", quality: 80, fullPage: true });
  const ruler = await pg.locator("[data-fhr-ruler]").innerText();
  console.log(`${name}: saved fhr-page-${name}.jpg; errors ${errs.length}\n${ruler}`);
}
await b.close();
