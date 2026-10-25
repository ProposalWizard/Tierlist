/**
 * FILM: big-moment banner options for Leo to pick (chat 1, 24 Oct 2026). Not game code.
 *
 *   node scripts/film/scenes/banner-options.mjs scripts/film/scenes/banner-options <outDir>
 *
 * banner.html (scripts/film/scenes/banner-options/) draws each option over the same real
 * big-moment frame at 390×844: ?v=A|B|C|none, &mode=hold (a still) or play (the animation).
 * Writes <outDir>/<v>.jpg for each and <v>.webm (3.2 s of it appearing) for A, B, C.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [DIR, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const exe = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--allow-file-access-from-files"] });
const url = (v, mode) => "file://" + path.resolve(DIR, "banner.html") + `?v=${v}&mode=${mode}`;
for (const v of ["A", "B", "C", "none"]) {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto(url(v, "hold")); await pg.waitForTimeout(600);
  await pg.screenshot({ path: path.join(OUT, `${v}.jpg`), type: "jpeg", quality: 82 });
  await pg.close();
  if (v === "none") continue;
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: path.join(OUT, "vid-" + v), size: { width: 390, height: 844 } } });
  const p2 = await ctx.newPage();
  await p2.goto(url(v, "play")); await p2.waitForTimeout(3400);
  await ctx.close();
  const f = fs.readdirSync(path.join(OUT, "vid-" + v)).map((x) => path.join(OUT, "vid-" + v, x)).sort((a, z) => fs.statSync(z).size - fs.statSync(a).size)[0];
  fs.renameSync(f, path.join(OUT, `${v}.webm`));
  fs.rmSync(path.join(OUT, "vid-" + v), { recursive: true, force: true });
}
await b.close();
console.log("done");
