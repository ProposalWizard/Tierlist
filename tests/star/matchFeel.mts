import {
  strikeFeel, squashAt, streakMetres, speedStretch, punchOffset, keeperSetHop, keeperDiveArc,
  sanitizeFeelDials, DEFAULT_FEEL_DIALS, FEEL_DIAL_KEYS, FEEL_DIAL_INFO, MATCH_FEEL_DEFAULT, matchFeelLook,
  contactQuality, feelNoise,
} from "../../lib/star/matchFeel";

/**
 * MATCH FEEL (Settings → Match → Match feel: New | Old). Looks and sound only.
 *
 * What is pinned: Old is the default; every effect SCALES with how hard and
 * how cleanly the ball was hit (a soft touch gets a whisper, never the lot);
 * a scuff is a dull, short thing; every shape ends and comes to rest; zero
 * dials switch an effect off; stored junk is made safe.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

check(MATCH_FEEL_DEFAULT === "old", "Match feel starts on Old");
check(matchFeelLook() === "old", "a phone with nothing stored reads Old (no localStorage here)");

// Scales with speed.
const soft = strikeFeel(6, "clean"), mid = strikeFeel(17, "clean"), full = strikeFeel(30, "clean");
check(soft.power < 0.05 && full.power > 0.95, `power runs soft→full (${soft.power.toFixed(2)} → ${full.power.toFixed(2)})`);
for (const k of ["hitStopS", "windUpS", "shakePx", "flash", "squash", "gain", "hapticMs"] as const) {
  check(soft[k] < mid[k] && mid[k] < full[k], `${k} grows with power: ${soft[k]} < ${mid[k]} < ${full[k]}`);
}
check(soft.hapticMs === 0, "a soft touch does not buzz the phone");
check(soft.hitStopS < full.hitStopS * 0.2, "a soft touch barely freezes");
check(Math.abs(full.hitStopS - DEFAULT_FEEL_DIALS.hitStopMs / 1000) < 1e-9, "a full clean strike freezes for the dial's whole value");
check(full.shakePx <= DEFAULT_FEEL_DIALS.shakePx + 1e-9, "the punch never passes its dial");

// Clean hits harder than a scuff at the same speed; a scuff is dull.
const scuff = strikeFeel(30, "scuffed");
check(scuff.scuff && !full.scuff, "a scuffed contact is a scuff");
check(scuff.hitStopS < full.hitStopS && scuff.shakePx < full.shakePx, "a scuff lands softer than a clean strike");
check(scuff.bass < full.bass, "a scuff is less bassy");
check(contactQuality("clean") > contactQuality("plain") && contactQuality("plain") > contactQuality("scuffed"), "quality order");

// Zero dials switch things off.
const zero = sanitizeFeelDials(Object.fromEntries(FEEL_DIAL_KEYS.map((k) => [k, 0])));
const z = strikeFeel(30, "clean", zero);
check(z.hitStopS === 0 && z.windUpS === 0 && z.shakePx === 0 && z.hapticMs === 0 && z.gain === 0, "every strike effect off at 0");
check(streakMetres(30, zero) === 0 && keeperSetHop(0.1, zero) === 0 && keeperDiveArc(0.5, false, zero) === 0, "streak and keeper motion off at 0");

// Shapes come to rest.
check(squashAt(0, 1) === 1, "squash is full at the hit");
check(squashAt(0.23, 1) === 0 && squashAt(-0.01, 1) === 0, "squash is over after 0.22 s");
check(Math.abs(squashAt(0.219, 1)) < 0.01, "squash eases to rest");
check(keeperSetHop(0.25) === 0 && keeperSetHop(0.12) > 0, "the set hop goes up and comes down");
check(keeperDiveArc(1, false) < 1e-9 && keeperDiveArc(0.5, false) > keeperDiveArc(0.5, true), "a dive lands, and a low one skims");
const p0 = punchOffset(0, 0.3, 7, 0, -1), pe = punchOffset(0.31, 0.3, 7, 0, -1);
check(Math.abs(p0.y + 7) < 1e-9 && pe.x === 0 && pe.y === 0, "the punch starts at its size along the hit and stops");
check(streakMetres(8) === 0 && streakMetres(30) > streakMetres(20), "no streak on a slow ball; longer when faster");
check(speedStretch(10) === 1 && speedStretch(34) > 1.3, "stretch only when fast");

// Junk stored is made safe.
const junk = sanitizeFeelDials({ hitStopMs: 9999, shakePx: -5, soundGain: "loud", flashSize: NaN });
check(junk.hitStopMs === FEEL_DIAL_INFO.hitStopMs.max && junk.shakePx === 0 && junk.soundGain === 1 && junk.flashSize === 1, "stored values clamped or reset");

// The "random" dust is fixed: a still is the same every time.
check(feelNoise(3, 7) === feelNoise(3, 7) && feelNoise(3, 7) >= 0 && feelNoise(3, 7) < 1, "fixed noise");

// A header or volley (headers piece 5): a longer beat, a bigger freeze and
// punch, the freeze never past 150 ms; a header plays the header thump; a
// plain strike is exactly as before.
{
  const head = strikeFeel(12, "clean", undefined, "header"), plain12 = strikeFeel(12, "clean");
  const vol = strikeFeel(24, "clean", undefined, "volley"), plain24 = strikeFeel(24, "clean");
  check(head.header && !plain12.header && !vol.header, "only a header plays the header sound");
  check(head.hitStopS > plain12.hitStopS && head.hitStopS <= 0.15 + 1e-9, `a header freezes longer, at most 150 ms (${(head.hitStopS * 1000).toFixed(0)} ms)`);
  check(head.windUpS > plain12.windUpS && head.shakePx > plain12.shakePx, "a header: a longer beat before contact and a bigger punch");
  check(vol.hitStopS > plain24.hitStopS && vol.hitStopS <= 0.15 + 1e-9 && vol.shakePx > plain24.shakePx, "a volley: a bigger freeze (≤ 150 ms) and punch");
  check(JSON.stringify(strikeFeel(24, "clean", undefined, undefined)) === JSON.stringify(plain24), "no air flag: the strike's feel as before");
  const big = { ...DEFAULT_FEEL_DIALS, hitStopMs: 200 };
  check(strikeFeel(30, "clean", big, "header").hitStopS <= strikeFeel(30, "clean", big).hitStopS + 1e-9, "a dial set past 150 ms is never made longer by a header");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — match feel scales with the hit, stays soft for a touch, and every shape comes to rest");
