/**
 * scripts/star-sandbox/play.mjs
 *
 * Plays Road to Ballon d'Or for real: takes the trial penalty until it goes in,
 * then drives the career loop (matches, training, shop, life) and reports what
 * it saw at each step plus the live CareerState.
 *
 * Canvas-aware, unlike drive.mjs which only handles DOM buttons. See README.md.
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (f) => argv.includes(f);

const BASE = val("--url", "http://localhost:3000");
const SHOTS = val("--shots", "/tmp/star-play");
mkdirSync(SHOTS, { recursive: true });

const ctx = await chromium.launchPersistentContext(val("--profile", "/tmp/star-profile"), {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium",
  ...devices["iPhone 13"],
});
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
pg.on("console", (m) => {
  const t = m.text();
  // flagcdn / gtag / sentry failures are sandbox proxy artifacts, not app bugs
  if (m.type() === "error" && !/flagcdn|googletagmanager|ERR_CERT|sentry/i.test(t)) {
    errors.push(`CONSOLE: ${t.slice(0, 250)}`);
  }
});

let n = 0;
const snap = async (label) => {
  const p = `${SHOTS}/${String(++n).padStart(2, "0")}-${label.replace(/\W+/g, "-").slice(0, 44)}.png`;
  await pg.screenshot({ path: p });
  return p;
};

const lines = async () => {
  const t = await pg.locator("body").innerText();
  const all = t.split("\n").map((s) => s.trim()).filter(Boolean);
  const a = all.findIndex((l) => l === "BETA");
  const b = all.findIndex((l) => /Any Feedback Good or Bad/.test(l));
  return all.slice(a >= 0 ? a + 1 : 0, b > 0 ? b : undefined);
};
const screenName = async () => (await lines())[0] || "(blank)";
const btns = async () =>
  (await pg.locator("button:visible").allInnerTexts()).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);

const say = async (label) => {
  const l = await lines();
  console.log(`\n───── ${label} ─────`);
  console.log(l.slice(0, 22).join("\n"));
  const b = await btns();
  if (b.length) console.log(`[buttons] ${b.slice(0, 18).join(" | ")}`);
  await snap(label);
};

const click = async (re, ms = 3000) => {
  const b = pg.locator("button:visible").filter({ hasText: re }).first();
  try {
    await b.waitFor({ state: "visible", timeout: ms });
    const t = (await b.innerText()).replace(/\s+/g, " ").trim();
    await b.click({ timeout: 4000 });
    await pg.waitForTimeout(1500);
    return t;
  } catch { return null; }
};

const state = async () => {
  return pg.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!/star-career/.test(k)) continue;
      try {
        const c = JSON.parse(localStorage.getItem(k));
        if (c && c.player) return c;
      } catch {}
    }
    return null;
  });
};

const brief = (c) => c && ({
  club: c.player?.club, pos: c.player?.position, season: c.season, week: c.week,
  money: c.money, star: +(c.starRating ?? 0).toFixed(2), fame: c.fame, energy: c.energy,
  happy: c.happiness, fitness: c.matchFitness, status: c.status, boot: c.currentBoot?.name,
  apps: c.seasonStats?.appearances, goals: c.seasonStats?.goals, assists: c.seasonStats?.assists,
  skills: c.skills, trophies: (c.trophies || []).length,
});

/** One shot at the canvas: drag back to aim, then tap a spot on the ball. */
async function takeAShot({ aimDx = 0, pull = 90, strikeCy = 0.15 } = {}) {
  const cv = pg.locator("canvas").first();
  const box = await cv.boundingBox();
  if (!box) return "no-canvas";
  // Ball sits low-centre in the framed view; drag BACK (downwards) to aim+power.
  const bx = box.x + box.width / 2;
  const by = box.y + box.height * 0.74;
  await pg.mouse.move(bx, by);
  await pg.mouse.down();
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    await pg.mouse.move(bx - (aimDx * i) / steps, by + (pull * i) / steps);
    await pg.waitForTimeout(18);
  }
  await pg.mouse.up();
  await pg.waitForTimeout(900);

  // Contact screen: the ball is a div with onPointerDown (ContactBall.tsx).
  const ball = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  if (await ball.count()) {
    const bb = await ball.boundingBox();
    if (bb) {
      const r = bb.width / 2;
      await pg.mouse.click(bb.x + r, bb.y + r + strikeCy * r);
      await pg.waitForTimeout(3500);
      return "struck";
    }
  }
  return "no-contact-screen";
}

await pg.goto(`${BASE}/star-dev`, { waitUntil: "networkidle", timeout: 120000 });
await pg.waitForTimeout(3500);

// ── create a career ─────────────────────────────────────────────────────────
if (await pg.locator("input").count()) {
  await pg.locator("input").first().fill(val("--first", "Leo"));
  await pg.locator("input").nth(1).fill(val("--last", "Vance"));
  await say("01 profile");
  await click(/Next|Continue/i);
  await click(new RegExp(val("--club", "Arsenal"), "i"));
  await say("02 club choice");
  await click(/Start Career/i);
  await pg.waitForTimeout(3000);
}
await say("03 trial");

// ── the trial: take it until it goes in ─────────────────────────────────────
const aims = [
  { aimDx: 55, pull: 95, strikeCy: 0.1 }, { aimDx: -55, pull: 95, strikeCy: 0.1 },
  { aimDx: 40, pull: 110, strikeCy: 0.3 }, { aimDx: -40, pull: 110, strikeCy: 0.3 },
  { aimDx: 20, pull: 80, strikeCy: 0.0 }, { aimDx: -20, pull: 130, strikeCy: 0.25 },
  { aimDx: 70, pull: 100, strikeCy: 0.2 }, { aimDx: -70, pull: 100, strikeCy: 0.2 },
];
let trialShots = 0;
for (let i = 0; i < 14; i++) {
  const nm = await screenName();
  if (!/THE TRIAL/i.test(nm)) break;
  const r = await takeAShot(aims[i % aims.length]);
  trialShots++;
  console.log(`  trial shot ${trialShots}: ${r} → now "${await screenName()}"`);
  if (r === "no-canvas") break;
  // any continue/next button between attempts
  await click(/^(Continue|Next|Again|Retake|Shoot)$/i, 1500);
}
await say(`04 after trial (${trialShots} shots)`);
console.log("STATE:", JSON.stringify(brief(await state())));

// ── whatever the trial leads into (reward, contract) ────────────────────────
for (let i = 0; i < 8; i++) {
  const done = await click(/^(Continue|Next|Accept|Sign it|Claim|Done|Confirm|Start)$/i, 2000);
  if (!done) break;
  await say(`05.${i + 1} ${done}`);
  if (/DASHBOARD|HOME/i.test(await screenName())) break;
}

console.log("\n══════ REACHED ══════", await screenName());
console.log("STATE:", JSON.stringify(brief(await state()), null, 1));
console.log("\n───── ERRORS ─────");
console.log(errors.length ? [...new Set(errors)].slice(0, 12).join("\n") : "(none)");
await ctx.close();
