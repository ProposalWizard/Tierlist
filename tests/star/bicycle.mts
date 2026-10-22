/**
 * BICYCLE KICKS (lib/star/bicycle.ts, 22 Oct 2026).
 *   npx tsx tests/star/bicycle.mts
 * The offer rule (above your head, across you, by Aerial), the strict read,
 * the strike from the air (deterministic, so a replay is the same), the keeper
 * reacting later on a clean one, and the media story.
 */
import {
  bicycleFits, bicycleOfferChance, bicycleOffered, bicycleContactRead, bicycleBand, crossAngleDeg, bicycleOfferFor,
  BICYCLE_MIN_Z, BICYCLE_CENTRE_R, BICYCLE_CLEAN_PACE, BICYCLE_KEEPER_LATE_S, isBicycleMode,
} from "../../lib/star/bicycle";
import { applyAirborne, bicycleMarkOf, bicycleGoalOf, airContactRead } from "../../lib/star/airborneChance";
import { buildScenario, launch, logBallAction } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { CX } from "../../lib/star/pitch";
import { outfieldClipFor } from "../../lib/star/sprite3dAnim";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch, mediaOf } from "../../lib/star/media/feed";
import { detectMatch } from "../../lib/star/media/detect";
import { buildMatchRecord } from "../../lib/star/media/record";
import { absorbMatch, emptyMemory } from "../../lib/star/media/memory";
import type { MatchStats, StarPlayer } from "../../lib/star/types";

let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "  ✓" : "  ✗"} ${m}`); if (!c) fails++; };

console.log("1. WHEN IT IS OFFERED");
{
  const ball = { x: 30, y: 7 };
  const side = { x: 62, y: 3 };          // a byline cross from wide right: across you
  const front = { x: 31, y: 1 };         // from the goal line, straight at you
  const behind = { x: 29, y: 25 };       // from straight behind you
  ok(bicycleFits({ ball, from: side, z: 2.2 }), "a cross above your head from the side fits");
  ok(bicycleFits({ ball, from: { x: 4, y: 3 }, z: 2.2 }), "…from the other side too (Leo 3a: either side)");
  ok(!bicycleFits({ ball, from: side, z: 1.7 }), `a cross below the top of your head does not (needs ${BICYCLE_MIN_Z.toFixed(2)} m)`);
  ok(!bicycleFits({ ball, from: front, z: 2.3 }), `a ball coming straight at you does not (${crossAngleDeg({ ball, from: front })!.toFixed(0)}° off the line to goal)`);
  ok(!bicycleFits({ ball, from: behind, z: 2.3 }), "a ball from straight behind does not");
  ok(!bicycleFits({ ball, from: null, z: 2.3 }), "no crosser: not offered");
  ok(Math.abs(bicycleOfferChance(40) - 0.25) < 1e-9, "Aerial 40: 1 in 4 (Leo 3b)");
  ok(bicycleOfferChance(80) === 1 && bicycleOfferChance(95) === 1, "Aerial 80 and over: every time");
  ok(bicycleOfferChance(60) > 0.25 && bicycleOfferChance(60) < 1, "in between: in between");
  let on40 = 0, on80 = 0;
  for (let s = 1; s <= 4000; s++) { if (bicycleOffered({ ball, from: side, z: 2.2 }, 40, s)) on40++; if (bicycleOffered({ ball, from: side, z: 2.2 }, 80, s)) on80++; }
  ok(Math.abs(on40 / 4000 - 0.25) < 0.03, `4,000 seeds at Aerial 40: ${(on40 / 40).toFixed(1)}% shown`);
  ok(on80 === 4000, "4,000 seeds at Aerial 80: all shown");
  ok(bicycleOffered({ ball, from: side, z: 2.2 }, 50, 77) === bicycleOffered({ ball, from: side, z: 2.2 }, 50, 77), "the same chance always gets the same answer (seeded, no random draw)");
  const hdr = { kind: "header", ball, teammates: [side], airZ: 2.3 };
  ok(!!bicycleOfferFor(hdr, 90, 5), "a header chance that fits, at Aerial 90: the button is on");
  ok(!bicycleOfferFor({ ...hdr, kind: "volley" }, 90, 5), "a volley chance: never (the ball is not above your head)");
  ok(!bicycleOfferFor({ ...hdr, kind: "one_on_one" }, 90, 5), "a ground chance: never");
  ok(!!bicycleOfferFor({ ...hdr, teammates: [front], overhead: true }, 0, 5), "a real overhead moment: always, whatever the angle or Aerial");
}

console.log("\n2. HOW IT IS JUDGED — stricter than a volley");
{
  const clean = bicycleContactRead({ cx: 0.05, cy: 0, lift: 0.6, aerial: 40 });
  ok(clean.good && clean.pace === BICYCLE_CLEAN_PACE && clean.keeperLateS === BICYCLE_KEEPER_LATE_S && clean.turnDeg === 0, "dead centre in the band: clean, ×1.2, keeper late, on line");
  const offMid = bicycleContactRead({ cx: 0.15, cy: 0, lift: 0.6, aerial: 40 });
  ok(!offMid.good && Math.abs(offMid.turnDeg) > 5, `0.15 ball radii off the middle: not clean, ${offMid.turnDeg.toFixed(1)}° off line`);
  const vol = airContactRead({ kind: "volley", lift: 0.6, cx: 0.15, cy: 0, aerial: 40 });
  ok(vol.good, "…where the same tap on a volley is still sweet (volley middle 0.2)");
  ok(BICYCLE_CENTRE_R === 0.1, "clean within 0.1 ball radii");
  const edge = bicycleContactRead({ cx: 1, cy: 0, lift: 0.6, aerial: 40 });
  ok(Math.abs(edge.turnDeg) <= 40 && Math.abs(edge.turnDeg) > 30, `the very edge: ${edge.turnDeg.toFixed(0)}° off (worst 40°)`);
  ok(!bicycleContactRead({ cx: 0, cy: 0, lift: 0.9, aerial: 40 }).good, "too early (0.9 of the drop) at Aerial 40: not clean");
  ok(!bicycleContactRead({ cx: 0, cy: 0, lift: 0.3, aerial: 40 }).good, "too late (0.3): not clean");
  const [lo40, hi40] = bicycleBand(40), [lo90, hi90] = bicycleBand(90);
  ok(lo40 === 0.4 && hi40 === 0.8, "the band at Aerial 40 is 0.4-0.8");
  ok(lo90 < lo40 && hi90 > hi40, `Aerial 90 widens it (${lo90.toFixed(2)}-${hi90.toFixed(2)})`);
  ok(bicycleContactRead({ cx: 0, cy: 0, lift: 0.85, aerial: 90 }).good, "0.85 is clean at Aerial 90");
  const miss40 = bicycleContactRead({ cx: 0.5, cy: 0, lift: 0.6, aerial: 40 });
  const miss90 = bicycleContactRead({ cx: 0.5, cy: 0, lift: 0.6, aerial: 90 });
  ok(Math.abs(miss90.turnDeg) < Math.abs(miss40.turnDeg), `Aerial forgives a miss (${miss40.turnDeg.toFixed(0)}° at 40, ${miss90.turnDeg.toFixed(0)}° at 90)`);
}

console.log("\n3. THE STRIKE FROM THE AIR");
{
  const mk = () => {
    const sc = buildScenario("header", mulberry32(11));
    (sc as typeof sc & { airZ?: number }).airZ = 2.3;
    const ball = launch(sc, { x: (CX - sc.ball.x) * 0.1, y: -1 }, 0.85, { cx: 0, cy: 0 }, { power: 65, technique: 65 }, mulberry32(3));
    return { sc, ball };
  };
  const a = mk(), b = mk();
  const air = { kind: "header" as const, style: "bicycle" as const, lift: 0.6, cx: 0, cy: 0, aerial: 60 };
  applyAirborne(a.ball, a.sc, air); applyAirborne(b.ball, b.sc, air);
  ok(JSON.stringify(a.ball) === JSON.stringify(b.ball), "the same tap strikes the same ball (a replay is the same)");
  ok(a.ball.z > 1.5, `struck from up in the air (${a.ball.z.toFixed(2)} m)`);
  ok(a.ball.vz < 2, `driven down, not skied (vz ${a.ball.vz.toFixed(2)})`);
  ok(bicycleMarkOf(a.ball)?.clean === true, "the ball carries its clean mark (keeper, media)");
  const mine = a.ball.actionLog?.filter((x) => x.actor === "you").pop();
  ok(isBicycleMode(mine?.mode), "the strike is written down as a bicycle (for the 2D and 3D clips)");
  ok(outfieldClipFor({ kind: "shot", mode: mine!.mode }) === "bicycle", "…and the 2D figure plays the bicycle clip");
  ok(!!bicycleGoalOf(a.ball), "a ball whose last touch was your bicycle is a bicycle goal if it goes in");
  logBallAction(a.ball, { kind: "save", actor: "keeper", save: "beaten" });
  ok(!!bicycleGoalOf(a.ball), "…a keeper beaten on the way does not change that");
  logBallAction(a.ball, { kind: "shot", actor: "run0", mode: "ground" });
  ok(!bicycleGoalOf(a.ball), "…but a team-mate's touch after it does");
  const h = mk();
  applyAirborne(h.ball, h.sc, { kind: "header", lift: 0.9, cx: 0, cy: 0, aerial: 60 });
  ok(!bicycleMarkOf(h.ball), "a plain header is not marked (nothing changes for headers)");
}

console.log("\n4. THE MEDIA TREAT IT LIKE A HAT-TRICK (the real pipeline)");
{
  const player: StarPlayer = { firstName: "Michael", lastName: "Sancho", age: 18, skinTone: "light", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2026 };
  const before = makeInitialCareer(player, ["Arsenal", "Chelsea", "Everton", "Fulham"]);
  const fixture = before.fixtures.find((f) => !f.played)!;
  const stats: MatchStats = {
    chances: 4, goals: 1, assists: 0, passes: 22, rating: 8.4, starMan: true, bossChange: 1, teamChange: 1, fansChange: 2,
    wage: 1, goalBonus: 1, sponsorPay: 0, totalCash: 2, homeScore: 1, awayScore: 0, minutes: 90,
    goalEvents: [{ minute: 63, scorer: "Michael Sancho", isUserGoal: true, how: "bicycle", distance: 9 }],
  };
  const { career: after } = creditMatchResult(before, fixture, stats);
  const rec = buildMatchRecord(before, after, fixture, stats);
  const events = detectMatch(rec, absorbMatch(mediaOf(before).memory, rec));
  const bike = events.find((e) => e.id === "bicycle-kick");
  ok(!!bike, "a bicycle goal fires the bicycle-kick story");
  ok(bike?.baseImportance === 76, `at a hat-trick's importance (${bike?.baseImportance})`);
  const ht = { ...stats, goals: 3, homeScore: 3, goalEvents: [] };
  const htEv = detectMatch(buildMatchRecord(before, creditMatchResult(before, fixture, ht).career, fixture, ht), emptyMemory()).find((e) => e.id === "hat-trick");
  ok(htEv?.baseImportance === bike?.baseImportance, `the same as a hat-trick (${htEv?.baseImportance})`);
  // Over many seeds, the feed writes the bicycle's own posts.
  let bikePosts = 0;
  for (let k = 0; k < 12; k++) {
    const media = generateForMatch(before, { ...after, week: after.week + k }, fixture, stats);
    bikePosts += JSON.stringify(media).match(/BICYCLE|bicycle kick|OVERHEAD|overhead kick|upside down/gi)?.length ?? 0;
  }
  ok(bikePosts > 0, `the feed writes about it (${bikePosts} bicycle lines over 12 runs)`);
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
if (fails) process.exit(1);
