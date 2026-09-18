/**
 * scripts/star-sandbox/drive.mjs
 *
 * Drives Road to Ballon d'Or in a real headless browser so a change can be
 * SEEN, not just type-checked. See README.md in this folder for why.
 *
 * Reports console/page errors on every run — the failure class the unit suite
 * structurally cannot reach.
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

if (has("--help")) {
  console.log(`
Usage: node scripts/star-sandbox/drive.mjs [options]

  --url <u>        base url            (default http://localhost:3000)
  --club <name>    club to sign for    (default Arsenal)
  --first <name>   first name          (default Test)
  --last <name>    last name           (default Striker)
  --resume         don't create a career, use the existing localStorage one
  --shots <dir>    screenshot every step into <dir>
  --shot <file>    single screenshot at the end
  --dump-state     print the live CareerState from localStorage
  --steps <n>      how many generic "advance" clicks to attempt (default 0)
  --click <text>   click a visible button matching this text, repeatable
  --desktop        desktop viewport instead of iPhone-sized
  --keep           leave the browser open (headed) for manual poking
`);
  process.exit(0);
}

const BASE = val("--url", "http://localhost:3000");
const SHOTS = val("--shots", null);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium",
  headless: !has("--keep"),
});
// iPhone-ish by default: this game is played on a phone, and several bugs in
// its history were layout/touch issues that simply don't appear at desktop size.
const ctx = await browser.newContext(
  has("--desktop")
    ? { viewport: { width: 1280, height: 900 } }
    : { ...devices["iPhone 13"] }
);
const pg = await ctx.newPage();

const errors = [];
pg.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
pg.on("console", (m) => { if (m.type() === "error") errors.push(`CONSOLE: ${m.text().slice(0, 300)}`); });
pg.on("requestfailed", (r) => {
  const f = r.failure()?.errorText || "";
  if (!/ERR_ABORTED/.test(f)) errors.push(`REQFAIL: ${r.url().slice(0, 120)} ${f}`);
});

let shotN = 0;
const snap = async (label) => {
  if (SHOTS) {
    const p = `${SHOTS}/${String(++shotN).padStart(2, "0")}-${label.replace(/\W+/g, "-").slice(0, 40)}.png`;
    await pg.screenshot({ path: p });
  }
};

/** Visible text, trimmed of the site chrome that wraps every screen. */
const screenText = async () => {
  const t = await pg.locator("body").innerText();
  const lines = t.split("\n").map((s) => s.trim()).filter(Boolean);
  const start = lines.findIndex((l) => /BETA/.test(l));
  const cut = lines.findIndex((l) => /Any Feedback Good or Bad/.test(l));
  return lines.slice(start >= 0 ? start + 1 : 0, cut > 0 ? cut : undefined);
};

const buttons = async () =>
  (await pg.locator("button:visible").allInnerTexts())
    .map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);

const report = async (label) => {
  const txt = await screenText();
  console.log(`\n───── ${label} ─────`);
  console.log(txt.slice(0, 30).join("\n") || "(no text)");
  const b = await buttons();
  if (b.length) console.log(`BUTTONS: ${b.slice(0, 16).join(" | ")}`);
  await snap(label);
};

const clickText = async (re, timeout = 4000) => {
  const btn = pg.locator("button:visible").filter({ hasText: re }).first();
  try {
    await btn.waitFor({ state: "visible", timeout });
    const label = (await btn.innerText()).replace(/\s+/g, " ").trim();
    await btn.click();
    await pg.waitForTimeout(1800);
    return label;
  } catch { return null; }
};

await pg.goto(`${BASE}/star-dev`, { waitUntil: "networkidle", timeout: 120000 });
await pg.waitForTimeout(3500);

if ((await screenText()).some((l) => /^Sign in$/i.test(l))) {
  console.log("\n!! Sign-in wall still showing. Is the server in dev mode (NODE_ENV=development)?");
  console.log("   See lib/star/devMode.ts — offline play is gated on it.");
}

if (!has("--resume")) {
  const inputs = pg.locator("input");
  if (await inputs.count()) {
    await inputs.first().fill(val("--first", "Test"));
    await inputs.nth(1).fill(val("--last", "Striker"));
    await report("step-1-profile");
    await clickText(/Next|Continue/i);
    const club = val("--club", "Arsenal");
    await clickText(new RegExp(club, "i"));
    await report("step-2-club");
    await clickText(/Start Career/i);
    await pg.waitForTimeout(3000);
    await report("after-start");
  } else {
    console.log("(no profile inputs — a career already exists; use --resume)");
  }
}

for (const flag of argv.reduce((a, v, i) => (v === "--click" ? [...a, argv[i + 1]] : a), [])) {
  const done = await clickText(new RegExp(flag, "i"));
  await report(`click:${flag}${done ? "" : " (NOT FOUND)"}`);
}

const steps = parseInt(val("--steps", "0"), 10);
for (let i = 0; i < steps; i++) {
  const done = await clickText(/Continue|Next|Play|Start|Confirm|Accept|Done|Sign|Begin/i, 2500);
  if (!done) break;
  await report(`step-${i + 1}:${done}`);
}

if (has("--dump-state")) {
  const state = await pg.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!/star|career|anon/i.test(k)) continue;
      const v = localStorage.getItem(k);
      try { out[k] = JSON.parse(v); } catch { out[k] = v; }
    }
    return out;
  });
  const career = Object.entries(state).find(([, v]) => v && typeof v === "object" && v.player);
  console.log("\n───── CAREER STATE ─────");
  if (career) {
    const c = career[1];
    console.log(JSON.stringify({
      key: career[0], name: c.player?.name, club: c.player?.club, position: c.player?.position,
      season: c.season, week: c.week, money: c.money, starRating: c.starRating, fame: c.fame,
      energy: c.energy, happiness: c.happiness, matchFitness: c.matchFitness, status: c.status,
      skills: c.skills, seasonStats: c.seasonStats, boot: c.currentBoot?.name,
      trophies: (c.trophies || []).length, injury: c.injury,
    }, null, 2));
  } else {
    console.log("(no career found in localStorage) keys:", Object.keys(state));
  }
}

const shot = val("--shot", null);
if (shot) { mkdirSync(dirname(shot), { recursive: true }); await pg.screenshot({ path: shot }); }

console.log("\n───── ERRORS ─────");
console.log(errors.length ? [...new Set(errors)].slice(0, 15).join("\n") : "(none)");

if (has("--keep")) { console.log("\n--keep: browser left open, ctrl-c to exit"); await new Promise(() => {}); }
await browser.close();
