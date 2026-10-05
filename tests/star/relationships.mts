// The relationships revamp (Mikey, 4 Oct 2026): bars that move slowly and
// drift to the middle, happiness that decides how well you recover, one
// game per relationship that pays more when the bar is low.
import { happinessOf, scaledChange, stepBar, drift, happinessEnergyFactor, gameReward, gamePlayedThisWeek, touchingFrame, REL_GAIN_SCALE } from "../../lib/star/relationships.ts";
import { chatFor, topicFor } from "../../lib/star/bossChat.ts";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow.ts";
import { rest } from "../../lib/star/week.ts";
import { NATIONAL_LEAGUE_CLUBS } from "../../lib/star/clubs.ts";
import { POST_L, POST_R, GOAL_H, CX } from "../../lib/star/pitch.ts";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types.ts";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("  ✗ " + msg); } };

// ── The bars ──
{
  check(Math.abs(scaledChange(50, 6) - 6 * REL_GAIN_SCALE * (1 - 50 / 105)) < 1e-9, "a gain is scaled and shrinks with the bar");
  check(scaledChange(95, 6) < scaledChange(50, 6) && scaledChange(50, 6) < scaledChange(10, 6), "the higher the bar, the less a gain adds");
  check(Math.abs(scaledChange(10, -5)) < Math.abs(scaledChange(90, -5)), "the lower the bar, the less a loss takes");
  check(scaledChange(70, 0) === 0, "nothing moves nothing");
  // fractions are kept: three small gains add up to a point
  let v = 50, c = 0;
  for (let i = 0; i < 6; i++) ({ value: v, carry: c } = stepBar(v, c, 1, 1));
  check(v > 50, `six +1 matches still add up (50 → ${v})`);
  check(drift(80, 3) === 79 && drift(80, 4) === 80, "above 60: down 1 every third match");
  check(drift(20, 2) === 21 && drift(20, 3) === 20, "below 40: up 1 every second match");
  check(drift(50, 6) === 50, "in the middle: no drift");
  check(stepBar(100, 0, 8, 1).value === 100 && stepBar(0, 0, -8, 1).value === 0, "never above 100 or below 0");
}

// ── A credited match moves the boss by the scaled table (6.0-6.6 is 0 in matchStats.ts) ──
{
  const P: StarPlayer = { firstName: "T", lastName: "P", age: 16, skinTone: "light", club: NATIONAL_LEAGUE_CLUBS[3], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const c = makeInitialCareer(P, [...NATIONAL_LEAGUE_CLUBS], "national_league");
  const f = c.fixtures.find((x) => !x.played)!;
  // the table lives in finaliseMatch; check through a real credited match instead
  const stats = (rating: number): MatchStats => ({ chances: 3, goals: 0, assists: 0, passes: 10, rating, starMan: false, bossChange: rating >= 8 ? 6 : rating >= 7 ? 3 : rating >= 6.7 ? 1 : rating >= 6 ? 0 : -2, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0, homeScore: 1, awayScore: 1, minutes: 90 } as MatchStats);
  const after = (rating: number) => creditMatchResult({ ...c, week: 1 }, f, stats(rating)).career.relationships.boss;
  check(after(6.5) === 50, `an ordinary 6.5 game leaves the boss where he was (${after(6.5)})`);
  check(after(8.2) > 50, `a great game raises him (${after(8.2)})`);
}

// ── Happiness decides recovery ──
{
  check(happinessEnergyFactor(50) === 1 && happinessEnergyFactor(0) < 1 && happinessEnergyFactor(100) > 1, "happiness 0 / 50 / 100 → less / normal / more energy back");
  const P = { firstName: "T", lastName: "P", age: 16, skinTone: "light", club: NATIONAL_LEAGUE_CLUBS[3], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const base: CareerState = { ...makeInitialCareer(P, [...NATIONAL_LEAGUE_CLUBS], "national_league"), energy: 40 };
  // Happiness is the average of boss, team and fans (happinessOf), not its own number.
  const at = (v: number) => ({ ...base, relationships: { ...base.relationships, boss: v, team: v, fans: v } });
  const sad = rest(at(0)).energy - 40, happy = rest(at(100)).energy - 40;
  check(happinessOf(at(30)) === 30 && happinessOf({ relationships: { boss: 90, team: 60, fans: 30 } }) === 60, "happiness is the average of boss, team and fans");
  check(rest({ ...base, happiness: 10 }).happiness === 10, "Rest no longer lifts happiness on its own");
  check(happy > sad, `Rest gives a happy player more energy (${sad} vs ${happy})`);
}

// ── The games ──
{
  check(gameReward(true, 30, 0) === 6 && gameReward(true, 55, 0) === 4 && gameReward(true, 80, 0) === 2, "a win pays more when the bar is low");
  check(gameReward(true, 90, 0.2) === 1 && gameReward(true, 90, 0.8) === 0, "above 85 a win counts half the time");
  check(gameReward(false, 50, 0) === -1 && gameReward(false, 50, 0, "boss") === -2, "a loss costs 1 (the boss chat 2)");
  const played = { season: 1, week: 5, kinds: ["boss"] };
  check(gamePlayedThisWeek(played, 1, 5, "boss") && !gamePlayedThisWeek(played, 1, 6, "boss") && !gamePlayedThisWeek(played, 1, 5, "fans"), "each game once a week");
  check(touchingFrame({ x: POST_L, y: 0.3, z: 1 }) && touchingFrame({ x: CX, y: 0.2, z: GOAL_H }), "a ball on a post or the bar is on the woodwork");
  check(!touchingFrame({ x: CX, y: 0.2, z: 1 }) && !touchingFrame({ x: POST_R, y: 5, z: 1 }), "the middle of the goal, or far out, is not");
}

// ── The boss chat ──
{
  const base = { player: { firstName: "Sam" }, form: [6.5, 6.5, 6.5], status: "1st Team", manager: { name: "X", style: "trusting" } } as unknown as CareerState;
  check(topicFor({ ...base, status: "Substitute" }) === "benched", "on the bench: he talks about the bench");
  check(topicFor({ ...base, form: [8, 8, 8] }) === "flying", "in form: he talks about your spell");
  check(topicFor({ ...base, form: [5, 5, 5] }) === "slump", "out of form: he talks about your form");
  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const moods = new Set<string>();
  const firstText = new Set<string>();
  let bestLanded = 0, bestTotal = 0, wrongLanded = 0, wrongTotal = 0;
  for (const style of ["trusting", "demanding", "rotational"] as const) {
    for (const form of [[5, 5, 5], [6.5, 6.5, 6.5], [8.5, 8.5, 8.5]]) {
      for (const status of ["1st Team", "Substitute"] as const) {
        for (let t = 0; t < 200; t++) {
          const chat = chatFor({ ...base, form, status, manager: { name: "X", style } } as unknown as CareerState, rng);
          check(chat.replies.length === 3, "always three replies");
          check(new Set(chat.replies.map((r) => r.trait)).size === 3, "one hungry, one humble, one bold reply");
          check(chat.replies.some((r) => r.chance >= 0.8), "there is always a right read");
          check(chat.replies.every((r) => r.chance < 1), "nothing is certain");
          moods.add(`${style}:${chat.mood}`);
          firstText.add(chat.replies[0].text);
          for (const r of chat.replies) {
            if (r.chance >= 0.8) { bestTotal++; if (r.lands) bestLanded++; }
            if (r.chance <= 0.1) { wrongTotal++; if (r.lands) wrongLanded++; }
          }
        }
      }
    }
  }
  check(moods.size === 9, `every style shows every mood (${moods.size}/9)`);
  check(firstText.size >= 9, "the replies come in different orders");
  check(bestLanded / bestTotal > 0.78 && bestLanded / bestTotal < 0.92, `the right read usually lands (${(100 * bestLanded / bestTotal).toFixed(1)}%)`);
  check(wrongLanded / wrongTotal > 0.04 && wrongLanded / wrongTotal < 0.17, `the wrong read rarely lands (${(100 * wrongLanded / wrongTotal).toFixed(1)}%)`);
  // The bug Mikey saw: an agreeing answer with the bar going down.
  const c = chatFor({ ...base, form: [8, 8, 8], status: "Substitute" } as unknown as CareerState, () => 0.99);
  const bold = c.replies.find((r) => r.trait === "bold")!;
  check(!bold.lands && bold.answer === "Deserve it? Prove it first.", "a reply that misses gets a missing answer");
}

console.log(fail ? `FAIL (${fail})` : "PASS — relationships move slowly and drift to the middle, happiness decides recovery, one game each that pays more when the bar is low");
if (fail) process.exit(1);
