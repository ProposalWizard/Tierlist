/**
 * FORM BITES FASTER, AND A SUBSTITUTE COMES ON WHEN THE GAME NEEDS HIM
 * (Mikey, 25 Sep 2026).
 *
 * Run: npx tsx tests/star/selectionForm.mts
 */
import { selectionFor, subComesOnNow, shirtWon } from "../../lib/star/selection";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const base = makeInitialCareer({
  firstName: "Test", lastName: "Player", age: 18, skinTone: "light",
  club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
} as never, ["Arsenal", "Chelsea"]);
const neutral: CareerState = { ...base, manager: undefined, energy: 100 };

// Boss moves the way matchStats.ts moves it: under 5.0 is -5, under 6 is -2, 7+ is +3.
const bossFor = (r: number) => (r >= 8 ? 6 : r >= 7 ? 3 : r >= 6 ? 1 : r >= 5 ? -2 : -5);
const after = (c: CareerState, ratings: number[]) => {
  let x = c;
  for (const r of ratings) {
    x = { ...x, form: [r, ...x.form], relationships: { ...x.relationships, boss: Math.max(0, Math.min(100, x.relationships.boss + bossFor(r))) } };
  }
  return x;
};

check(selectionFor(neutral).status === "1st Team", "a new player starts");
const threeBad = after(neutral, [5.5, 5.5, 5.5]);
check(selectionFor(threeBad).status === "Substitute", `three poor games (5.5) and you're on the bench (standing ${selectionFor(threeBad).standing.toFixed(1)})`);
const twoBad = after(neutral, [5.5, 5.5]);
check(selectionFor(twoBad).status === "1st Team", "two poor games alone don't cost you your place");
const backAgain = after(threeBad, [7.2, 7.2, 7.2]);
check(selectionFor(backAgain).status === "1st Team", `three good games off the bench (7.2) win it back (standing ${selectionFor(backAgain).standing.toFixed(1)})`);

// When a substitute comes on.
const firstMinute = (diff: number) => { for (let m = 50; m <= 90; m++) if (subComesOnNow(m, diff)) return m; return 99; };
check(firstMinute(-2) === 50 && firstMinute(-1) === 56 && firstMinute(0) === 64 && firstMinute(1) === 72 && firstMinute(3) === 80,
  "two down: on at 50; one down: 56; level: 64; one up: 72; well ahead: 80");
check(firstMinute(-1) < firstMinute(0) && firstMinute(0) < firstMinute(1), "losing brings you on sooner than level, level sooner than winning");

// ── Winning your shirt ──
{
  const rival = { id: "r9", name: "Rival Striker", shortName: "Rival", position: "ST" as const, overall: 80,
    seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0 };
  const arrived: CareerState = { ...neutral, squad: [rival], form: [], shirt: undefined };
  const v = selectionFor(arrived);
  check(v.status === "Substitute" && /Rival/.test(v.reason), `new here and rated below him: you start on the bench (${v.status}: ${v.reason})`);
  const better: CareerState = { ...arrived, skills: { pace: 90, power: 90, technique: 90, vision: 90, freeKick: 90 } };
  check(selectionFor(better).status === "1st Team", "rated above him (signed as the main man): you start");
  const earned: CareerState = { ...arrived, form: [7.4, 7.0, 6.2], shirt: { club: arrived.player.club, won: false, apps: 3 } };
  check(shirtWon(earned) && selectionFor(earned).status === "1st Team", "a goal and an assist across three cameos wins you the shirt");
  const kept: CareerState = { ...arrived, form: [6.4, 6.5, 6.3], shirt: { club: arrived.player.club, won: true, apps: 12 } };
  check(selectionFor(kept).status === "1st Team", "once won, you keep it on form however much higher rated he is");
  const moved: CareerState = { ...kept, shirt: { club: "Somewhere Else", won: true, apps: 30 } };
  check(!shirtWon({ ...moved, form: [] }), "a new club means winning it again");
  const oldSave: CareerState = { ...arrived, form: [6.5, 6.4], shirt: undefined };
  check(selectionFor(oldSave).status === "1st Team", "an old save where you've already been playing keeps your place");
  const generated: CareerState = { ...arrived, squad: [{ ...rival, overall: undefined }] };
  check(selectionFor(generated).status === "1st Team", "a made-up squad with no ratings has no rival");
}

// ── Cup rotation: a player who isn't a regular sometimes starts an early round ──
{
  const rival = { id: "r9", name: "Rival Striker", shortName: "Rival", position: "ST" as const, overall: 80,
    seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0 };
  const cup = (week: number, round: string) => ({ week, opponent: "Chelsea", home: true, played: false, kind: "cup" as const, round });
  let early = 0, late = 0;
  for (let w = 1; w <= 30; w++) {
    const c: CareerState = { ...neutral, week: w, squad: [rival], form: [], shirt: undefined, fixtures: [cup(w, "Round of 32")] };
    if (selectionFor(c).status === "1st Team") early++;
    const q: CareerState = { ...c, fixtures: [cup(w, "Quarter-Final")] };
    if (selectionFor(q).status === "1st Team") late++;
  }
  check(early > 8 && early < 26, `a fringe player starts some early cup rounds (${early}/30)`);
  check(late === 0, "…but not a quarter-final or later");
  const regular: CareerState = { ...neutral, fixtures: [cup(5, "Round of 32")], week: 5 };
  check(selectionFor(regular).status === "1st Team", "a regular still starts his cup games");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — three bad games bench you, three good win it back, and subs come on when the score says");
