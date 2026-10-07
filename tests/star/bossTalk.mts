import {
  buildTalk, managerTalkStyle, talkGain, talkHits, gradeOf, formTopic,
  STYLE_VALUE, STYLE_CLASH, TALK_ROUNDS,
  type Grade, type TalkStyle, type BossValue,
} from "../../lib/star/bossTalk";
import { bossGain, BOSS_KICKS } from "../../lib/star/bossPenalties";

/**
 * OFFICE TALK (MANAGER_PLAN.md): the manager's chat must not be readable by
 * "pick the nice one". The right reply depends on HIS style.
 *
 *  1. Deterministic per seed.
 *  2. The best reply every round always scores the top of the penalties' scale.
 *  3. A random clicker averages clearly below that.
 *  4. Every style wants a different thing, and every value is the clash for
 *     some style — so no reply wording is always right.
 *  5. A bad last game takes over a round (accountability); a good one too.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const NAMES = ["Jürgen Klopp", "Pep Guardiola", "José Mourinho", "Alex Ferguson",
  "Alan Whitfield", "Roberto Marchetti", "Klaus Voss", "Diego Almeida", "Sean Doherty",
  "Marcelo Ferreira", "Henrik Lindberg", "Paul Ashcroft", "Gianluca Bianchi", "Owen Pryce"];

// 1. Deterministic.
for (const n of NAMES) for (let s = 0; s < 20; s++) {
  const a = JSON.stringify(buildTalk({ managerName: n, seed: s, lastRating: 6.8 }));
  const b = JSON.stringify(buildTalk({ managerName: n, seed: s, lastRating: 6.8 }));
  check(a === b, `talk not deterministic for ${n} seed ${s}`);
}

// Known names map to their real styles.
check(managerTalkStyle("Jürgen Klopp") === "press", "Klopp should be press");
check(managerTalkStyle("Pep Guardiola") === "possession", "Guardiola should be possession");
check(managerTalkStyle("José Mourinho") === "low", "Mourinho should be low");
check(managerTalkStyle("Alex Ferguson") === "mid", "Ferguson should be mid");
// A made-up name is stable.
check(managerTalkStyle("Owen Pryce") === managerTalkStyle("Owen Pryce"), "hashed style not stable");

// Shape: 3 rounds, 3 replies, one of each grade, distinct texts.
let shapeBad = 0;
for (const n of NAMES) for (let s = 0; s < 50; s++) {
  const t = buildTalk({ managerName: n, seed: s });
  if (t.rounds.length !== TALK_ROUNDS) shapeBad++;
  for (const r of t.rounds) {
    const grades = r.replies.map((x) => x.grade).sort().join(",");
    if (grades !== "best,clash,neutral") shapeBad++;
    if (new Set(r.replies.map((x) => x.text)).size !== 3) shapeBad++;
    if (!r.line) shapeBad++;
  }
}
check(shapeBad === 0, `bad round shape ${shapeBad} times`);
check(TALK_ROUNDS === BOSS_KICKS, "talk rounds should match the penalties' kicks");

// 2. Best answers always score the top of the scale; 3. random clicker below.
const top = bossGain(BOSS_KICKS);
let bestOk = true;
let randomSum = 0, randomN = 0;
let seedR = 12345;
const rand = () => { seedR = (seedR * 1103515245 + 12345) & 0x7fffffff; return seedR / 0x7fffffff; };
for (const n of NAMES) for (let s = 0; s < 200; s++) {
  const t = buildTalk({ managerName: n, seed: s, lastRating: s % 3 === 0 ? 5.2 : s % 3 === 1 ? 8.1 : 6.8 });
  const best: Grade[] = t.rounds.map((r) => r.replies.find((x) => x.grade === "best")!.grade);
  if (talkGain(best) !== top) bestOk = false;
  const picked: Grade[] = t.rounds.map((r) => r.replies[Math.floor(rand() * 3)].grade);
  randomSum += talkGain(picked); randomN++;
}
const randomAvg = randomSum / randomN;
check(bestOk, "best replies did not always score the top");
check(top === 6, `top of the scale should be +6, got ${top}`);
check(randomAvg < top - 4, `random clicker averages ${randomAvg.toFixed(2)}, too close to the best ${top}`);
console.log(`best = +${top}, random clicker average = ${randomAvg.toFixed(2)}`);

// Scale is the penalties' own.
check(talkHits(["best", "best", "best"]) === 3 && talkGain(["best", "best", "best"]) === 6, "3 best → +6");
check(talkGain(["best", "neutral", "neutral"]) === 2, "1 best + 2 neutral → +2");
check(talkGain(["neutral", "neutral", "neutral"]) === -2, "all neutral → -2");
check(talkGain(["best", "best", "clash"]) === 2, "2 best + 1 clash → +2");
check(talkGain(["clash", "clash", "clash"]) === -2, "all clash → -2 (floor)");

// 4. Every style has a different best value; every value is a clash for some style.
const styles: TalkStyle[] = ["press", "possession", "low", "mid"];
const bests = new Set(styles.map((s) => STYLE_VALUE[s]));
check(bests.size === 4, "every style should want a different value");
for (const s of styles) check(STYLE_VALUE[s] !== STYLE_CLASH[s], `${s}: best and clash are the same`);
const values: BossValue[] = ["effort", "ideas", "discipline", "professional"];
for (const v of values) {
  const grades = styles.map((s) => gradeOf(s, v));
  check(grades.includes("best"), `${v} is never best`);
  check(grades.includes("neutral") || grades.includes("clash"), `${v} is always best`);
}
// The same reply wording is best for one manager and not for another.
for (const v of values) {
  const notBest = styles.filter((s) => gradeOf(s, v) !== "best");
  check(notBest.length === 3, `${v} should be best for exactly one style`);
}
// Across real talks, the best answer's value differs between managers on the same topic.
const bestByTopic = new Map<string, Set<BossValue>>();
for (const n of NAMES) for (let s = 0; s < 40; s++) {
  for (const r of buildTalk({ managerName: n, seed: s }).rounds) {
    const set = bestByTopic.get(r.topic) ?? new Set<BossValue>();
    set.add(r.replies.find((x) => x.grade === "best")!.value);
    bestByTopic.set(r.topic, set);
  }
}
for (const [topic, set] of bestByTopic) check(set.size >= 3, `topic ${topic}: the best reply is the same wording for too many managers (${set.size} values)`);
// And the best reply isn't always in the same slot.
const slots = new Set<number>();
for (let s = 0; s < 100; s++) for (const r of buildTalk({ managerName: "Klaus Voss", seed: s }).rounds) slots.add(r.replies.findIndex((x) => x.grade === "best"));
check(slots.size === 3, "best reply always lands in the same slot");

// 5. Form shifts a round.
check(formTopic(5.2) === "bad-game", "5.2 should be a bad game");
check(formTopic(8.0) === "good-game", "8.0 should be a good game");
check(formTopic(6.8) === null, "6.8 is neither");
check(formTopic(undefined) === null, "no rating, no form round");
let badSeen = 0, goodSeen = 0, normalHas = 0;
for (let s = 0; s < 50; s++) {
  if (buildTalk({ managerName: "Klaus Voss", seed: s, lastRating: 5 }).rounds.some((r) => r.topic === "bad-game")) badSeen++;
  if (buildTalk({ managerName: "Klaus Voss", seed: s, lastRating: 8.5 }).rounds.some((r) => r.topic === "good-game")) goodSeen++;
  if (buildTalk({ managerName: "Klaus Voss", seed: s, lastRating: 6.8 }).rounds.some((r) => r.topic === "bad-game" || r.topic === "good-game")) normalHas++;
}
check(badSeen === 50, `bad game round shown ${badSeen}/50`);
check(goodSeen === 50, `good game round shown ${goodSeen}/50`);
check(normalHas === 0, `form round shown after an ordinary game ${normalHas}/50`);

if (problems.length) {
  console.error(`bossTalk: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("bossTalk: all checks passed");
