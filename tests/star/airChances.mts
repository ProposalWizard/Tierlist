/**
 * HEADERS AND VOLLEYS BACK ON (B10, 20 Oct 2026).
 *
 *  1. Played off the team's own cross drawings while a kind has fewer than 5
 *     drawings of its own (lib/star/airDrawings.ts): you are the drawn TARGET
 *     or POACH, the crosser is the drawn man on the ball, nobody stands on the
 *     ball; five real drawings take over.
 *  2. Served the way the match serves them: no fault, the crosser on his spot.
 *  3. Full highlights rebuild On: the build-up's last pass is the crosser's
 *     ball in the air, arriving at your head (a header) or your knee (a volley).
 *  4. Where you met it counts (airContactRead): the middle is clean; off the
 *     middle it goes off line; a volley met near the grass is mistimed;
 *     technique softens it. Pure: the same tap is the same strike.
 *  5. The ball while you aim (airWaitZ): a header hangs at your head, a
 *     volley bounces from the grass to the top of its bounce.
 *  6. A better finisher scores more of both.
 */
import { playPool, authoredPool, setLiveScenarioPool, ruleSetFor } from "../../lib/star/authoredChance";
import { derivedAirDrawings, airWaitZ, arriveZ, AIR_DEPTH, BALL_CLEAR_M, HEADER_Z, VOLLEY_MAX_Z, CROSSER_IN_M } from "../../lib/star/airDrawings";
import { airContactRead, applyAirborne, VOLLEY_SWEET } from "../../lib/star/airborneChance";
import { makeChance } from "../../lib/star/chanceMaker";
import { fhrBuildUpFor, fhrWantsBuildUp } from "../../lib/star/fhr/buildUp";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { AUTHORED_SCENARIOS } from "../../lib/star/authoredScenarios";
import { mulberry32 } from "../../lib/star/season";
import { PITCH_W } from "../../lib/star/pitch";
import { shoot } from "./shotLab";
import type { ScenarioKind } from "../../lib/star/canvasEngine";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const hyp = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const AIR: ("header" | "volley")[] = ["header", "volley"];

console.log("\n1. PLAYED OFF THE TEAM'S CROSS DRAWINGS");
for (const kind of AIR) {
  const own = authoredPool(kind).length;
  const pool = playPool(kind);
  const derived = derivedAirDrawings(kind, authoredPool);
  ok(own === 0 && pool.length === derived.length && pool.length >= 5, `${kind}: no drawings of its own, ${pool.length} from the cross drawings (5 needed)`);
  ok((ruleSetFor(kind)?.n ?? 0) === pool.length, `${kind}: its rules are scanned off those ${pool.length}`);
  let good = 0;
  for (const ms of derived) {
    const srcId = ms.id.replace(/^air-\w+-/, "").replace(/-[^-]+$/, "");
    const src = Object.values(AUTHORED_SCENARIOS).find((s) => s.id === srcId);
    const you = ms.players.find((p) => p.side === "you")!;
    const crosser = ms.players.find((p) => p.label === "CROSSER")!;
    const srcMan = src?.players.find((p) => Math.abs(p.x - you.x) < 1e-9 && Math.abs(p.y - you.y) < 1e-9);
    const srcYou = src?.players.find((p) => p.side === "you");
    const [lo, hi] = AIR_DEPTH[kind];
    const fine = !!src && !!srcMan && /^(TARGET|POACH)$/i.test(srcMan.label ?? "")
      // (moved onto the pitch if the drawing has him on the flag, at most CROSSER_IN_M)
      && !!srcYou && crosser.x === Math.min(Math.max(srcYou.x, CROSSER_IN_M), PITCH_W - CROSSER_IN_M) && crosser.y === Math.max(srcYou.y, CROSSER_IN_M)
      && ms.ball.y >= lo && ms.ball.y <= hi
      && ms.players.filter((p) => p.side !== "you").every((p) => hyp(p, ms.ball) >= BALL_CLEAR_M)
      // Everyone else exactly where the drawing has them.
      && ms.players.filter((p) => p.side !== "you" && p.label !== "CROSSER").every((p) => src!.players.some((q) => q.x === p.x && q.y === p.y));
    if (fine) good++;
  }
  ok(good === derived.length, `${kind}: every picture is a drawing with its TARGET/POACH as you, its man on the ball crossing, nobody on the ball (${good}/${derived.length})`);
}
{
  // Five real drawings of a kind: those, and only those.
  const donor = derivedAirDrawings("header", authoredPool)[0];
  setLiveScenarioPool([0, 1, 2, 3, 4].map((i) => ({ ...donor, id: `real-header-${i}`, source: { tool: "gallery" as const, kind: "header", seed: null } })));
  ok(playPool("header").every((s) => s.id.startsWith("real-header-")) && playPool("header").length === 5, "five real header drawings take over from the cross drawings");
  setLiveScenarioPool(null);
}

console.log("\n2. SERVED");
for (const kind of AIR) {
  let n = 0, faulty = 0, crosserOn = 0, offPitch = 0;
  for (let s = 1; s <= 300; s++) {
    const m = makeChance({ source: { from: "kind", kind }, rng: mulberry32(s * 977), memory: null });
    n++;
    if (m.faults.length) faulty++;
    const c = m.sc.teammates[0], spot = m.shape?.mates[0];
    if (c && spot && Math.abs(c.x - Math.min(Math.max(spot.x, CROSSER_IN_M), PITCH_W - CROSSER_IN_M)) < 1e-9) crosserOn++;
    if (!c || c.x < 0 || c.x > PITCH_W || c.y < 0) offPitch++;
  }
  ok(faulty === 0, `${kind}: ${n} served, ${faulty} with a fault`);
  ok(crosserOn === n && offPitch === 0, `${kind}: the crosser stands on his drawn spot, on the pitch (${crosserOn}/${n})`);
}

console.log("\n3. THE BUILD-UP LOFTS IT TO YOU (Full highlights rebuild On)");
{
  const pool = servedChances({ count: 400, seed: 202 }).filter((c) => AIR.includes(c.sc.kind as "header") && fhrWantsBuildUp(c.sc.kind, c.moment)).slice(0, 40);
  let lofted = 0, byCrosser = 0, arrives = 0, clean = 0;
  for (const c of pool) {
    const b = fhrBuildUpFor(c.sc, c.moment);
    const last = b.acts[b.acts.length - 1];
    if (last.type === "pass" && last.h >= 3 && last.endZ === arriveZ(c.sc.kind)) lofted++;
    if (b.actOwners[b.acts.length - 1] === "mate0") byCrosser++;
    if (b.ballAt(b.durS).z === arriveZ(c.sc.kind) && b.ballAt(last.t0 + (last.t1 - last.t0) / 2).z > 2) arrives++;
    if (!b.problems.length) clean++;
  }
  const n = pool.length;
  ok(n >= 30, `${n} header and volley build-ups`);
  ok(lofted === n, `the last pass is a ball in the air (top ≥ 3 m) that arrives at your head / knee (${lofted}/${n})`);
  ok(byCrosser === n, `the crosser plays it (${byCrosser}/${n})`);
  ok(arrives === n, `the ball is up in the air mid-cross and still in the air when the chance is yours (${arrives}/${n})`);
  ok(clean >= n - 2, `the build-ups pass their own checks (${clean}/${n})`);
}

console.log("\n4. WHERE YOU MET IT");
{
  const h0 = airContactRead({ kind: "header", lift: 0.9, cx: 0, cy: -0.3, tech: 60 });
  ok(h0.good && h0.turnDeg === 0 && h0.pace === 1 && h0.vzAdd === 0, `a header met on top, in the middle: ${h0.label}, straight on`);
  const hR = airContactRead({ kind: "header", lift: 0.9, cx: 0.8, cy: 0, tech: 60 });
  ok(!hR.good && hR.turnDeg < -10 && hR.pace < 0.8, `met on the right of the ball it glances left (${hR.label}, ${hR.turnDeg.toFixed(1)}°, pace ×${hR.pace.toFixed(2)})`);
  const hU = airContactRead({ kind: "header", lift: 0.9, cx: 0, cy: 0.9, tech: 60 });
  ok(!hU.good && hU.vzAdd > 1, `met underneath it loops up (${hU.label}, +${hU.vzAdd.toFixed(1)} m/s up)`);
  const vMid = (VOLLEY_SWEET[0] + VOLLEY_SWEET[1]) / 2;
  const v0 = airContactRead({ kind: "volley", lift: vMid, cx: 0, cy: -0.1, tech: 60 });
  ok(v0.good && v0.turnDeg === 0 && v0.pace === 1 && v0.vzAdd === 0, `a volley through the middle as it drops: ${v0.label}`);
  const vLow = airContactRead({ kind: "volley", lift: 0.03, cx: 0, cy: -0.1, tech: 60 });
  ok(!vLow.good && vLow.pace < 0.8 && Math.abs(vLow.turnDeg) > 5, `met almost on the grass: ${vLow.label} (pace ×${vLow.pace.toFixed(2)}, ${vLow.turnDeg.toFixed(1)}°)`);
  const vEdge = airContactRead({ kind: "volley", lift: vMid, cx: -0.85, cy: 0, tech: 60 });
  const gEdge = airContactRead({ kind: "header", lift: 0.9, cx: -0.85, cy: 0, tech: 60 });
  ok(!vEdge.good && vEdge.turnDeg > gEdge.turnDeg, `the same mis-hit costs a volley more than a header (${vEdge.turnDeg.toFixed(1)}° vs ${gEdge.turnDeg.toFixed(1)}°)`);
  const lo = airContactRead({ kind: "volley", lift: vMid, cx: 0.7, cy: 0, tech: 30 }), hi = airContactRead({ kind: "volley", lift: vMid, cx: 0.7, cy: 0, tech: 90 });
  ok(Math.abs(hi.turnDeg) < Math.abs(lo.turnDeg), `technique softens a mis-hit (${lo.turnDeg.toFixed(1)}° at 30, ${hi.turnDeg.toFixed(1)}° at 90)`);
  const a = airContactRead({ kind: "volley", lift: 0.6, cx: 0.33, cy: 0.2, tech: 70 }), b = airContactRead({ kind: "volley", lift: 0.6, cx: 0.33, cy: 0.2, tech: 70 });
  ok(JSON.stringify(a) === JSON.stringify(b), "the same tap is the same strike");
  // Old callers (no cx/cy) strike exactly as before: the middle of the ball.
  const sc = makeChance({ source: { from: "kind", kind: "header" }, rng: mulberry32(5), memory: null }).sc;
  const mk = () => ({ pos: { x: sc.ball.x, y: sc.ball.y }, vel: { x: 2, y: -20 }, z: 0.08, vz: 3, spin: 1, topspin: 0, resting: false, loose: false, contactCd: 0, lastTouch: "attack", receiverControlT: 0, event: null, inNet: false }) as never;
  const b1 = applyAirborne(mk(), sc, { kind: "header", lift: 0.9 }), b2 = applyAirborne(mk(), sc, { kind: "header", lift: 0.9, cx: 0, cy: 0 });
  ok(JSON.stringify(b1) === JSON.stringify(b2), "a strike with no tap point is struck through the middle");
}

console.log("\n5. THE BALL WHILE YOU AIM");
{
  let hMin = Infinity, hMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (let t = 0; t < 3; t += 0.01) {
    const h = airWaitZ("header", t), v = airWaitZ("volley", t);
    hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); vMin = Math.min(vMin, v); vMax = Math.max(vMax, v);
  }
  ok(hMin > HEADER_Z - 0.1 && hMax < HEADER_Z + 0.1, `a header hangs at your head (${hMin.toFixed(2)}–${hMax.toFixed(2)} m)`);
  ok(vMin < 0.02 && vMax > VOLLEY_MAX_Z - 0.02, `a volley bounces from the grass to the top of its bounce (${vMin.toFixed(2)}–${vMax.toFixed(2)} m)`);
  ok(airWaitZ("volley", 0) === VOLLEY_MAX_Z && airWaitZ("one_on_one", 1) === 0, "a volley starts at the top of the bounce (where the cross arrives); other kinds stay on the grass");
}

console.log("\n6. A BETTER FINISHER SCORES MORE");
for (const kind of AIR) {
  // The thumb meets it (a header on top or through the middle, a volley through
  // the middle) and lands round that spot: tapSd ball radii, worse for a poorer finisher.
  const meet = (tapSd: number) => (sc: Parameters<NonNullable<Parameters<typeof shoot>[2]>["thumbFor"]>[0], r: () => number) => {
    const g = () => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const far = sc.keeper.x < 34 ? 1 : -1, side = r() < 0.75 ? far : -far;
    const targetX = side > 0 ? 37.66 - 0.35 - r() * 0.6 : 30.34 + 0.35 + r() * 0.6;
    const meant = kind === "header" && r() < 0.6 ? { cx: 0, cy: -0.35 } : { cx: 0, cy: -0.1 };
    let cx = meant.cx + g() * tapSd, cy = meant.cy + g() * tapSd;
    const d = Math.hypot(cx, cy); if (d > 1) { cx /= d; cy /= d; }
    return { aimErrDeg: g() * 2.5, power: 0.75 + r() * 0.25, contact: { cx, cy }, intent: "placed" as const, targetX, aimX: targetX };
  };
  const rate = (skill: number, sd: number) => {
    let g = 0;
    for (let i = 1; i <= 150; i++) {
      const seed = i * 7919 + kind.length;
      const r = shoot(kind as ScenarioKind, seed, {
        thumbFor: meet(skill > 70 ? 0.18 : 0.42),
        skills: { power: skill, technique: skill },
        afterLaunch: (ball, s, thumb) => {
          const rr = mulberry32(seed ^ 0x77);
          const lift = kind === "header" ? 0.84 + 0.16 * rr() : Math.min(1, Math.max(0, 0.57 + (rr() - 0.5) * 2 * sd));
          applyAirborne(ball, s, { kind, lift, cx: thumb.contact.cx, cy: thumb.contact.cy, tech: skill });
        },
      });
      if (r.goal) g++;
    }
    return g / 150;
  };
  const poor = rate(45, 0.45), elite = rate(88, 0.15);
  ok(elite > poor + 0.04, `${kind}: elite ${(elite * 100).toFixed(1)}% against poor ${(poor * 100).toFixed(1)}%`);
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nPASS");
