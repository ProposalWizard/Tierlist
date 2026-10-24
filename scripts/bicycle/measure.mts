/**
 * BICYCLE KICKS — how often offered, and what they score (lib/star/bicycle.ts).
 *
 *   npx tsx scripts/bicycle/measure.mts [offers|conversion|all] [--n=600] [--matches=40]
 *
 * offers      the real unseen match and the real chance maker (B10's mix
 *             method, scripts/b10/measure.mts): per 40 matches, how many
 *             header chances, how many fit (above your head, across you),
 *             and how many show the BICYCLE button at Aerial 30/40/60/80/90.
 * conversion  fitting header chances from the real chance maker, struck as a
 *             bicycle by a seeded bot (tests/star/shotLab.ts flight loop):
 *               clean = tapped inside the middle, in the timing band;
 *               poor  = tap sd 0.35 ball radii round the middle, timing sd 0.25;
 *             goals per 100, and the same chances headed (B10's header bot).
 */
import { shoot, type Thumb, type LabOptions } from "../../tests/star/shotLab";
import { applyAirborne } from "../../lib/star/airborneChance";
import { bicycleFits, bicycleOfferChance, bicycleRoll, crossInto, crossAngleDeg, bicycleBand, bicycleContactRead } from "../../lib/star/bicycle";
import { brainReactLater } from "../../lib/star/keeperBrain";
import { bicycleMarkOf } from "../../lib/star/airborneChance";
import type { Scenario } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";
import { makeChance } from "../../lib/star/chanceMaker";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const N = Number(arg("n", "600"));
const MATCHES = Number(arg("matches", "40"));
const mode = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "all";
const AERIALS = [30, 40, 60, 80, 90];

function gauss(r: () => number) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

if (mode === "offers" || mode === "all") {
  const { startRadar, stepRadar, radarOver, resolveHighlight } = await import("../../lib/star/matchRadar");
  const { noteServedKind } = await import("../../lib/star/hiddenMatch");
  const { PictureMemory } = await import("../../lib/star/chanceMaker");
  const { newSelectionMemory } = await import("../../lib/star/scenarioSelect");
  const POS = ["ST", "LW", "RW", "CAM", "ST", "CM", "RW", "LW"];
  let total = 0, head = 0, fit = 0, high = 0, across = 0, chanceNo = 0;
  const offered = new Map<number, number>(AERIALS.map((a) => [a, 0]));
  for (let mi = 0; mi < MATCHES; mi++) {
    const r = mulberry32(0xabc + mi * 31);
    const inputs = {
      teamStrength: 55 + Math.floor(r() * 35), oppStrength: 55 + Math.floor(r() * 35), home: mi % 2 === 0, playerSkill: 60 + Math.floor(r() * 30),
      pace: 70, freeKick: 70, position: POS[mi % POS.length],
      context: { playstyle: "balanced", teamRelationship: 60, fanRelationship: 50, skills: { pace: 70, power: 65, technique: 65, vision: 60 } },
    };
    const radar = startRadar(7000 + mi * 13, inputs as never);
    const rng = mulberry32((0xc4a7ce ^ (mi * 2654435761)) >>> 0);
    const memory = new PictureMemory(`bike-${mi}`, false);
    const selection = newSelectionMemory();
    for (let g = 0; g < 400 && !radarOver(radar); g++) {
      if (!radar.pending) { stepRadar(radar); continue; }
      const req = radar.pending.request!;
      if (!req.dribble) {
        const made = makeChance({ source: { from: "request", request: req, position: inputs.position }, rng, strength: { keeper: 62, team: inputs.teamStrength, vision: 60 }, memory, selection });
        noteServedKind(radar.state, made.sc.kind);
        total++; chanceNo++;
        const c = crossInto(made.sc as never);
        if (c) {
          head++;
          if (c.z >= 1.9) high++;
          const a = crossAngleDeg(c);
          if (a !== null && a >= 45) across++;
          if (bicycleFits(c)) {
            fit++;
            // The match seeds each chance; any whole number per chance does here.
            const seed = (0x5eed + chanceNo * 2654435761) >>> 0;
            for (const ae of AERIALS) if (bicycleRoll(seed) < bicycleOfferChance(ae)) offered.set(ae, offered.get(ae)! + 1);
          }
        }
      }
      resolveHighlight(radar, "bench-rate");
    }
  }
  const per40 = (n: number) => ((n * 40) / MATCHES).toFixed(1);
  console.log(`\nOFFERS — ${MATCHES} matches of the real unseen match, ${total} chances (${(total / MATCHES).toFixed(2)} a match)`);
  console.log(`  header chances ${head} (${per40(head)} per 40 matches) · ball above head ${high} · across you ${across} · both (fits) ${fit} (${per40(fit)} per 40)`);
  console.log(`  BICYCLE button shown, per 40 matches:`);
  for (const ae of AERIALS) console.log(`    Aerial ${String(ae).padStart(2)}: ${per40(offered.get(ae)!).padStart(5)}  (offer chance ${(bicycleOfferChance(ae) * 100).toFixed(0)}% of fits)`);
}

if (mode === "conversion" || mode === "all") {
  // Fitting header chances, from the real chance maker.
  const chances: Scenario[] = [];
  for (let i = 1; chances.length < N && i < N * 60; i++) {
    const sc = makeChance({ source: { from: "kind", kind: "header" }, rng: mulberry32(i * 7919), strength: { keeper: 62, team: 60, vision: 55 }, memory: null }).sc;
    const c = crossInto(sc as never);
    if (c && bicycleFits(c)) chances.push(sc);
  }
  const aimAt = (sc: Scenario, r: () => number) => {
    const farSide = sc.keeper.x < CX ? 1 : -1;
    const side = r() < 0.75 ? farSide : -farSide;
    const inset = 0.35 + r() * 0.6;
    return side > 0 ? POST_R - inset : POST_L + inset;
  };
  type Hand = "clean" | "poor";
  const tapFor = (hand: Hand, r: () => number, aerial: number) => {
    const [lo, hi] = bicycleBand(aerial);
    if (hand === "clean") {
      const a = r() * Math.PI * 2, d = r() * 0.09;
      return { cx: Math.cos(a) * d, cy: Math.sin(a) * d * 0.8 - 0.05, lift: lo + 0.05 + r() * (hi - lo - 0.1) };
    }
    let cx = gauss(r) * 0.35, cy = -0.05 + gauss(r) * 0.35;
    const dd = Math.hypot(cx, cy); if (dd > 1) { cx /= dd; cy /= dd; }
    return { cx, cy, lift: Math.max(0, Math.min(1, (lo + hi) / 2 + gauss(r) * 0.25)) };
  };
  const run = (hand: Hand | "header", aerial: number) => {
    let goals = 0, clean = 0, onT = 0;
    chances.forEach((sc0, i) => {
      const seed = (i * 104729 + 17) >>> 0;
      const r = mulberry32((seed ^ 0xb1c) >>> 0);
      const tap = hand === "header" ? null : tapFor(hand, r, aerial);
      const o: LabOptions = {
        scenario: sc0, skills: { power: 65, technique: 65 },
        thumbFor: (sc, rr): Thumb => {
          const targetX = aimAt(sc, rr);
          const contact = tap ? { cx: tap.cx, cy: tap.cy } : (() => { let cx = gauss(rr) * 0.3, cy = (rr() < 0.6 ? -0.35 : 0) + gauss(rr) * 0.3; const d = Math.hypot(cx, cy); if (d > 1) { cx /= d; cy /= d; } return { cx, cy }; })();
          return { aimErrDeg: gauss(rr) * 2.5, power: 0.75 + rr() * 0.25, contact, intent: "placed", targetX, aimX: targetX };
        },
        afterLaunch: (ball, sc, thumb) => {
          if (tap) applyAirborne(ball, sc, { kind: "header", style: "bicycle", lift: tap.lift, cx: thumb.contact.cx, cy: thumb.contact.cy, tech: 65, aerial });
          else applyAirborne(ball, sc, { kind: "header", lift: 0.84 + 0.16 * r(), cx: thumb.contact.cx, cy: thumb.contact.cy, tech: 65, aerial });
        },
        afterStrike: (ball, sc) => brainReactLater(sc, bicycleMarkOf(ball)?.keeperLateS ?? 0),
      };
      if (tap && bicycleContactRead({ ...tap, aerial }).good) clean++;
      const res = shoot("header", seed, o);
      if (res.goal) goals++;
      if ((res as { onTarget?: boolean }).onTarget) onT++;
    });
    return { goals: (100 * goals) / chances.length, clean: (100 * clean) / chances.length };
  };
  console.log(`\nCONVERSION — ${chances.length} fitting header chances (real chance maker), goals per 100`);
  console.log(`                      Aerial 40   60   90   (share met clean)`);
  for (const hand of ["clean", "poor", "header"] as const) {
    const rows = [40, 60, 90].map((a) => run(hand, a));
    const label = hand === "header" ? "headed instead" : hand === "clean" ? "bicycle, clean hand" : "bicycle, poor hand";
    console.log(`  ${label.padEnd(20)} ${rows.map((x) => x.goals.toFixed(1).padStart(5)).join(" ")}` + (hand === "header" ? "" : `   (${rows.map((x) => x.clean.toFixed(0)).join(" / ")}%)`));
  }
}
