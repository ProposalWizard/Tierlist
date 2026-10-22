/**
 * WIND, RAIN SKID AND THE PITCH (Leo, 22 Oct 2026, chat 4). The new
 * conditions do what Leo asked, on both balls, and nothing when absent.
 * Weather test page only (/star-weather-dev); weatherFingerprint.mts holds
 * the real game's ball to the one from before.
 */
import { buildConditions, CLEAR_DIALS, flyBall, measure, STRIKES, windVector, type WeatherDials } from "../../lib/star/weatherLab";
import { clubPitch, pitchLabel, groundFor } from "../../lib/star/pitchQuality";
import { windAtHeight } from "../../lib/star/pitchWeather";
import { PREMIER_LEAGUE_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS, STEP3_NORTH_CLUBS, LEAGUE_ONE_CLUBS } from "../../lib/star/clubs";

import { integrateBallOld, type Ball } from "../../lib/star/canvasEngine";
import { integrateBallReal } from "../../lib/star/ballPhysics";
import type { Conditions } from "../../lib/star/weather";

/** Share of 300 normal ground passes (8-30 m, struck to arrive at 4 m/s on a clear day, ±15%) that stop 1.5 m+ short. */
function diesShort(mode: "old" | "new", cond: Conditions): number {
  const dt = 1 / 180;
  const roll = (v: number, k: Conditions, target: number) => {
    const ball = { pos: { x: 0, y: 0 }, vel: { x: 0, y: v }, z: 0.11, vz: 0.6, spin: 0, topspin: 0,
      resting: false, loose: false, contactCd: 0, receiverControlT: 0, event: null, inNet: false } as unknown as Ball;
    let at = 0;
    for (let t = 0; t < 15 && !ball.resting; t += dt) {
      if (mode === "new") integrateBallReal(ball, k, dt); else integrateBallOld(ball, k, dt);
      if (!at && ball.pos.y >= target) at = Math.hypot(ball.vel.x, ball.vel.y);
    }
    return { dist: ball.pos.y, at };
  };
  const clear = buildConditions(CLEAR_DIALS);
  let s = 99; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  let short = 0;
  for (let i = 0; i < 300; i++) {
    const d = 8 + rnd() * 22;
    let lo = 1, hi = 40;
    for (let j = 0; j < 30; j++) { const m = (lo + hi) / 2; if (roll(m, clear, d).at >= 4) hi = m; else lo = m; }
    if (roll(hi * (0.85 + rnd() * 0.3), cond, d).dist < d - 1.5) short++;
  }
  return short / 300;
}

const problems: string[] = [];
const check = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) problems.push(what); };
const c = (d: Partial<WeatherDials>) => buildConditions({ ...CLEAR_DIALS, ...d });
const S = Object.fromEntries(STRIKES.map((s) => [s.id, s]));

// Clear dials build exactly the old clear conditions: no new fields at all.
{
  const k = c({});
  check(k.drag === 1 && k.friction === 1 && k.bounce === 1 && k.wind === 0 && !k.windV && !k.skid && !k.deadBelow,
    "clear dials = the old clear day, no new fields");
  const v = windVector(10, 90);
  check(Math.abs(v.x - 10) < 1e-9 && Math.abs(v.y) < 1e-9, "a wind to 90° blows left to right (+x)");
  check(windAtHeight(0.1) < 0.3 && windAtHeight(1) > 0.5 && windAtHeight(10) > 0.99, "the wind is weaker near the grass");
}

for (const mode of ["old", "new"] as const) {
  const base = (id: string) => measure(S[id], c({}), mode);
  // 1. Wind bends the ball: more the higher and longer it flies.
  const cross = (id: string) => measure(S[id], c({ weather: "wind", windSpeed: 10, windTo: 90 }), mode).drift - base(id).drift;
  check(cross("long") > 2 && cross("chip") > 1, `${mode}: a 10 m/s side wind bends a long ball right (${cross("long").toFixed(1)} m) and a lofted pass (${cross("chip").toFixed(1)} m)`);
  check(cross("long") > cross("driven") && cross("driven") >= 0 && Math.abs(cross("ground")) < 0.2,
    `${mode}: higher and longer bends more: long ${cross("long").toFixed(1)} > driven ${cross("driven").toFixed(1)}; a ground pass ${cross("ground").toFixed(2)}`);
  const left = measure(S.long, c({ weather: "wind", windSpeed: 10, windTo: 270 }), mode).drift - base("long").drift;
  check(left < -2, `${mode}: and the other way when it blows right to left (${left.toFixed(1)} m)`);
  const head = measure(S.long, c({ weather: "wind", windSpeed: 10, windTo: 180 }), mode).carry - base("long").carry;
  const tail = measure(S.long, c({ weather: "wind", windSpeed: 10, windTo: 0 }), mode).carry - base("long").carry;
  check(head < -3 && tail > 3, `${mode}: a head wind cuts the carry (${head.toFixed(1)} m), a tail wind adds to it (+${tail.toFixed(1)} m)`);

  // 2. Rain: skids on, rolls further.
  const rainRoll = measure(S.driven, c({ weather: "rain" }), mode).roll, dryRoll = base("driven").roll;
  check(rainRoll > dryRoll * 1.2, `${mode}: rain — a driven ball runs on further (${dryRoll.toFixed(0)} → ${rainRoll.toFixed(0)} m)`);
  const heavy = measure(S.driven, c({ weather: "heavy" }), mode).roll;
  check(heavy < dryRoll, `${mode}: heavy rain — a slow, wet pitch (${heavy.toFixed(0)} m)`);

  // 3. A bad dry pitch: less bounce, slows fast, at worst stops dead.
  const bad = c({ pitch: 0.25, ground: "dry" });
  const b1 = measure(S.chip, bad, mode).bounce, b0 = base("chip").bounce;
  check(b1 < b0 * 0.6, `${mode}: worst dry pitch — the bounce after a lofted pass ${b0.toFixed(1)} → ${b1.toFixed(1)} m`);
  const r1 = measure(S.ground, bad, mode).roll, r0 = base("ground").roll;
  check(r1 < r0 * 0.97, `${mode}: a ground pass runs a bit less (${r0.toFixed(1)} → ${r1.toFixed(1)} m)`);
  const rh = measure(S.ground, { ...bad, ...c({ pitch: 0.25, ground: "dry", worst: "harsh" }) }, mode).roll;
  check(rh < r0 * 0.75, `${mode}: the harsh first build kills it (${r0.toFixed(1)} → ${rh.toFixed(1)} m)`);
  // Feel check (scripts/weather/feelCheck.mts): on the worst dry pitch at most
  // about 1 normal pass in 10 more dies short than on a clear day.
  const extra = diesShort(mode, bad) - diesShort(mode, c({}));
  check(extra < 0.11, `${mode}: worst dry pitch — ${Math.round(extra * 100)} more normal passes in 100 die short than on a clear day`);
  // Stops dead: a 2 m/s ball on the worst dry pitch stops within a metre.
  const slow = flyBall(2, 0, bad, mode), slowClear = flyBall(2, 0, c({}), mode);
  check(slow.total < 1 && slowClear.total > slow.total * 1.5, `${mode}: a slow ball stops dead (${slowClear.total.toFixed(2)} → ${slow.total.toFixed(2)} m)`);
  // A perfect pitch in a dry spell is still perfect.
  check(Math.abs(measure(S.ground, c({ ground: "dry" }), mode).roll - r0) < 1e-9, `${mode}: a dry spell does nothing to a perfect pitch`);
}

// Each club's pitch.
{
  check(PREMIER_LEAGUE_CLUBS.every((k) => clubPitch(k).quality === 1), "every Premier League pitch is perfect");
  const avg = (l: readonly string[]) => l.reduce((a, k) => a + clubPitch(k).quality, 0) / l.length;
  const l1 = avg(LEAGUE_ONE_CLUBS), nln = avg(NATIONAL_LEAGUE_NORTH_CLUBS), s3 = avg(STEP3_NORTH_CLUBS);
  check(l1 > nln && nln > s3, `quality falls down the pyramid: League One ${l1.toFixed(2)}, NL North ${nln.toFixed(2)}, Step 3 ${s3.toFixed(2)}`);
  check(NATIONAL_LEAGUE_NORTH_CLUBS.some((k) => ["poor", "very poor"].includes(clubPitch(k).word)), "some National League North grounds are poor");
  check(pitchLabel(0.4, "dry") === "Pitch: very poor, dry" && pitchLabel(1, "normal") === "Pitch: perfect", "the pre-match line reads \"Pitch: poor, dry\"");
  const weeks = Array.from({ length: 38 }, (_, i) => groundFor(1, i + 1, false));
  check(weeks.slice(8, 30).every((g) => g === "normal") && weeks.some((g) => g === "dry"), "dry spells only at the ends of the season");
}

if (problems.length) { console.error(`\n${problems.length} problem(s)`); process.exit(1); }
console.log("\nweatherPitch: all good");
