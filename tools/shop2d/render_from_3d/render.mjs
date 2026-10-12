// node render.mjs jobs.json outDir  — each job { name, ...spec } → outDir/name.png
import fs from "node:fs";
import { chromium } from "playwright";
const [jobsFile, out] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsFile, "utf8"));
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
page.on("console", (m) => { if (m.type() === "error") console.log("PAGE", m.text()); });
page.on("pageerror", (e) => console.log("PAGEERR", e.message));
await page.goto(`http://localhost:${process.env.PORT || 8765}/index.html`);
await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
for (const j of jobs) {
  const t = Date.now();
  try {
    const url = await page.evaluate((s) => window.render(s), j);
    fs.writeFileSync(`${out}/${j.name}.png`, Buffer.from(url.split(",")[1], "base64"));
    console.log(j.name, ((Date.now() - t) / 1000).toFixed(1) + "s");
  } catch (e) { console.log("FAIL", j.name, e.message); }
}
await browser.close();
