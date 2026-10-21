#!/usr/bin/env node
/**
 * Measure the Style A heads' faces (the bench's Faces page) and write
 * lib/star/style3d/toon/faceLandmarks.ts. Also saves each head's picture
 * with what was found drawn over it.
 *
 *   node scripts/bench3d/faces.mjs [--base=http://localhost:3027] [--pics=DIR] [--write]
 *   node scripts/bench3d/faces.mjs --files=/star/people3d/toon-q1.glb,… [--write]
 *     body files being judged (bodies.ts TOON_BODY_SETS): --write adds them to
 *     lib/star/style3d/toon/faceFileLandmarks.ts (keyed by model name), keeping the others.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? "1"]; }));
const BASE = flags.base ?? "http://localhost:3027";
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`${BASE}/star-3d-bench-dev/faces${flags.files ? `?files=${flags.files}` : ""}`, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__toonFaces, null, { timeout: 600000 });
const faces = await page.evaluate(() => window.__toonFaces);
if (flags.pics) {
  fs.mkdirSync(flags.pics, { recursive: true });
  const pics = await page.evaluate(() => Array.from(document.querySelectorAll("img")).map((i) => i.src).filter((s) => s.startsWith("data:image/jpeg")));
  Object.keys(faces).forEach((h, i) => { if (pics[i]) fs.writeFileSync(path.join(flags.pics, `face-${h}.jpg`), Buffer.from(pics[i].split(",")[1], "base64")); });
}
for (const [h, m] of Object.entries(faces)) console.log(h, JSON.stringify(m));
if (flags.write && flags.files) {
  const file = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../lib/star/style3d/toon/faceFileLandmarks.ts");
  const src = fs.readFileSync(file, "utf8");
  const have = Object.fromEntries([...src.matchAll(/^  "([^"]+)": (\{.*\}),$/gm)].map((m) => [m[1], m[2]]));
  for (const [h, m] of Object.entries(faces)) { const { px, ...rest } = m; void px; have[h] = JSON.stringify(rest); }
  const body = Object.entries(have).map(([h, j]) => `  "${h}": ${j},`).join("\n");
  fs.writeFileSync(file, src.replace(/export const TOON_FACE_FILE_LANDMARKS[\s\S]*$/, `export const TOON_FACE_FILE_LANDMARKS: Record<string, ToonFaceLandmarks> = {\n${body}\n};\n`));
  console.log("wrote", file);
} else if (flags.write) {
  const file = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../lib/star/style3d/toon/faceLandmarks.ts");
  const src = fs.readFileSync(file, "utf8");
  const body = Object.entries(faces).map(([h, m]) => { const { px, ...rest } = m; void px; return `  ${h}: ${JSON.stringify(rest)},`; }).join("\n");
  const out = src.replace(/export const TOON_FACE_LANDMARKS[\s\S]*$/, `export const TOON_FACE_LANDMARKS: Partial<Record<ToonHead, ToonFaceLandmarks>> = {\n${body}\n};\n`);
  fs.writeFileSync(file, out);
  console.log("wrote", file);
}
await browser.close();
