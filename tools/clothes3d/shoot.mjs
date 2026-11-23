import fs from "node:fs";
import { chromium } from "playwright";
const [out, ...shots] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3640";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const s0 of shots) {
  const [s, extra = ""] = s0.split("?");
  const p = await b.newPage({ viewport: { width: 1700, height: 1900 } });
  p.on("pageerror", (e) => console.log("PAGEERR", e.message.slice(0, 400)));
  p.on("console", (m) => { const t = m.text(); if (m.type() === "error" || t.startsWith("CLOTHDBG")) console.log(t.slice(0, 1500)); });
  const t0 = Date.now();
  await p.goto(`${BASE}/star-3d-bench-dev/clothes?shot=${s}&${extra}`, { timeout: 300000 });
  await p.waitForFunction("window.__sheetDone === true", null, { timeout: 600000, polling: 1000 });
  const data = await p.evaluate(() => document.querySelector("#sheet")?.toDataURL("image/png"));
  if (data) { const f = `${out}/${s}${extra ? "-" + extra.replace(/[&=]/g, "_") : ""}.png`; fs.writeFileSync(f, Buffer.from(data.split(",")[1], "base64")); console.log(f, (Date.now() - t0) / 1000, "s"); }
  console.log(await p.evaluate(() => document.querySelector("#sheet-status")?.textContent));
  await p.close();
}
await b.close();
