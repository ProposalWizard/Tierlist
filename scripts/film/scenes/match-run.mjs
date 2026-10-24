/**
 * Play one real career match to Post Match Reactions and screenshot it.
 *
 *   node scripts/film/scenes/match-run.mjs <baseUrl> <shot.jpg|png> [--save seed.json] [--rate 4]
 *
 * --rate N slows the CPU N times from full time on (CDP), like a filmer would.
 * Prints the result JSON ({ goalsByYou, score, ms, chances, shots }).
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { loadSave, playToReactions } from "./match-lib.mjs";

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const [baseUrl = "http://localhost:3000", shotPath = "/tmp/reactions.jpg"] = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const savePath = val("--save", "/tmp/claude-0/-home-user-Tierlist/15d4b7b5-92a8-51b4-9c56-57239ead124f/scratchpad/seedMatch.json");
const rate = Number(val("--rate", "1"));

const exe = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined, args: ["--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
const t0 = Date.now();
const log = (m) => console.error(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s] ${m}`);
try {
  await loadSave(page, baseUrl, savePath);
  log("save loaded");
  const cdp = await ctx.newCDPSession(page);
  const res = await playToReactions(page, {
    log,
    onFullTime: rate > 1 ? async () => { await cdp.send("Emulation.setCPUThrottlingRate", { rate }); log(`CPU slowed ${rate}x`); } : undefined,
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shotPath, ...(shotPath.endsWith(".jpg") ? { type: "jpeg", quality: 80 } : {}) });
  console.log(JSON.stringify({ ...res, totalMs: Date.now() - t0, pageErrors: [...new Set(errors)].slice(0, 5) }));
} finally {
  await browser.close();
}
