import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { generateForCareer } from "../../lib/star/media/feed";
import type { CareerState, StarPlayer } from "../../lib/star/types";
import {
  scandalChance, rollCasinoScandal, stepFor, casinoBanned, casinoBanWeeksLeft,
  noteCasinoBet, takeCasinoVisitBets, SCANDAL_CAP,
} from "../../lib/star/casinoScandal";

/**
 * CASINO SCANDALS (Mikey, 11 Oct 2026; plan: patch-notes/mikey/casino-scandals.html).
 * The chance comes from the number of bets and fame, capped at 25%; money
 * never changes it. The cost climbs with each story in a season; step 4 bans.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

// The chance, bet by bet (fame 40 = National Name, × 1).
check(scandalChance(0, 40) === 0, "no bet, no risk");
check(near(scandalChance(1, 40), 2), `1 bet = 2% (${scandalChance(1, 40)})`);
check(near(scandalChance(25, 40), 11.6), `25 bets = 11.6% (${scandalChance(25, 40)})`);
check(near(scandalChance(60, 40), 25), `60 bets = the 25% cap (${scandalChance(60, 40)})`);
check(near(scandalChance(25, 0), 2.9), `Unknown × 0.25 (${scandalChance(25, 0)})`);
check(near(scandalChance(40, 85), 25), `Icon reaches the cap at 40 bets (${scandalChance(40, 85)})`);
check(scandalChance(10_000, 100) === SCANDAL_CAP, "never above 25%, however many bets");
check(near(scandalChance(25, 40, true), 5.8), "halved for 4 weeks after a story");

const base = (): CareerState => {
  const c = makeInitialCareer({ firstName: "Test", lastName: "Gambler", age: 24, position: "ST", club: "Arsenal", nationality: "England" } as StarPlayer, [...PREMIER_LEAGUE_CLUBS]);
  return { ...c, fame: 40, money: 1_000_000, contract: { ...c.contract, wage: 1000 }, reputation: 60, captain: true,
    relationships: { ...c.relationships, boss: 60, fans: 60, team: 60 } };
};

// Money never changes the chance: the same roll gives the same yes/no.
for (const roll of [0.05, 0.1, 0.115, 0.12, 0.2]) {
  const a = rollCasinoScandal(base(), 25, -500_000, roll).story !== null;
  const b = rollCasinoScandal(base(), 25, +500_000, roll).story !== null;
  const c = rollCasinoScandal(base(), 25, 0, roll).story !== null;
  check(a === b && b === c, `money does not change the chance (roll ${roll})`);
}
check(rollCasinoScandal(base(), 25, 0, 0.115).story !== null && rollCasinoScandal(base(), 25, 0, 0.117).story === null, "the roll matches 11.6%");
check(rollCasinoScandal(base(), 0, -900_000, 0).story === null, "no bets: no story, even after a big loss");

// The ladder: four stories in four different weeks.
let c = base();
const steps: number[] = [];
for (let i = 0; i < 4; i++) {
  c = { ...c, week: 1 + i * 5 };
  const r = rollCasinoScandal(c, 10, 0, 0);
  if (r.story) steps.push(r.story.step);
  c = r.career;
}
check(steps.join() === "1,2,3,4", `steps climb 1-4 (${steps.join()})`);
check(casinoBanned(c) && casinoBanWeeksLeft(c) === 8, `step 4 bans for 8 weeks (${casinoBanWeeksLeft(c)})`);
check(!casinoBanned({ ...c, week: c.week + 8 }), "the ban ends after 8 weeks");
check(!c.captain, "step 3 takes the armband");
check(c.lastScandalSeason === c.season, "step 2+ marks the season as not clean");

// Costs of single steps.
const s1 = rollCasinoScandal(base(), 5, 0, 0);
check(s1.career.reputation === 57 && s1.career.relationships.fans === 58 && s1.career.relationships.boss === 60, "step 1: reputation −3, fans −2");
check(s1.career.fame === 41, "step 1: fame +1");
check(s1.career.captain === true && s1.career.lastScandalSeason === undefined, "step 1 keeps the armband and the clean season");

// Big loss one step worse, big win one step milder.
check(stepFor(1, "lost") === 2 && stepFor(1, "won") === 1 && stepFor(3, "won") === 2 && stepFor(4, "lost") === 4, "big loss +1 step, big win −1 step");
check(rollCasinoScandal(base(), 5, -8000, 0).story?.kind === "lost", "losing 8 weeks' wages is a 'lost' story");
check(rollCasinoScandal(base(), 5, 8000, 0).story?.kind === "won", "winning 8 weeks' wages is a 'won' story");
check(rollCasinoScandal(base(), 5, -7999, 0).story?.kind === "spotted", "under 8 weeks' wages is 'spotted'");

// Step 3: a fine of 2 weeks' wages.
let f = { ...base(), casinoScandal: { season: 1, count: 2, lastSeason: 1, lastWeek: 0 } };
f = { ...f, season: 1, week: 10 };
const s3 = rollCasinoScandal(f, 5, 0, 0);
check(s3.story?.step === 3 && s3.career.money === 1_000_000 - 2000, `step 3 fines 2 weeks' wages (${s3.career.money})`);

// One story a week; the ladder starts again next season.
const once = rollCasinoScandal({ ...base(), week: 7 }, 5, 0, 0).career;
check(rollCasinoScandal(once, 5, 0, 0).story === null, "at most one story a week");
check(rollCasinoScandal({ ...once, season: once.season + 1, week: 1 }, 5, 0, 0).story?.step === 1, "a new season starts at step 1");

// Counting bets in a visit.
takeCasinoVisitBets();
for (let i = 0; i < 7; i++) noteCasinoBet();
check(takeCasinoVisitBets() === 7 && takeCasinoVisitBets() === 0, "bets counted and cleared per visit");

// The story reaches the feed, with the right headline.
for (const [story, step, want] of [["spotted", 1, "CASINO"], ["lost", 2, "FORTUNE"], ["won", 1, "LUCKY"], ["spotted", 3, "EXPOSED"], ["spotted", 4, "BAN"]] as const) {
  const media = generateForCareer(base(), { kind: "casino-scandal", story, step, bets: 20 }, `casino-test-${story}-${step}`);
  const text = media.posts.map((p) => JSON.stringify(p)).join(" ");
  check(media.posts.length > 0, `${story} step ${step}: posts in the feed`);
  check(text.toUpperCase().includes(want), `${story} step ${step}: a post says "${want}"`);
}

// How many stories a season, by habit (38 weeks, a National Name).
function season(visitsPerWeek: number, bets: number, seed: number) {
  let r = seed;
  const rand = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 2 ** 32; };
  let car = base(); let n = 0;
  for (let w = 1; w <= 38; w++) {
    const visits = visitsPerWeek < 1 ? (rand() < visitsPerWeek ? 1 : 0) : visitsPerWeek;
    for (let v = 0; v < visits; v++) {
      if (casinoBanned({ ...car, week: w })) break;
      const res = rollCasinoScandal({ ...car, week: w }, bets, 0, rand());
      if (res.story) n++;
      car = res.career;
    }
  }
  return n;
}
const avg = (v: number, b: number) => { let t = 0; for (let i = 1; i <= 2000; i++) t += season(v, b, i); return t / 2000; };
const casual = avg(0.25, 5), weekly = avg(1, 15);
check(casual > 0.1 && casual < 0.6, `once a month: about 0.3 stories a season (${casual.toFixed(2)})`);
check(weekly > 1.8 && weekly < 3.4, `once a week: about 2.6 stories a season (${weekly.toFixed(2)})`);

if (problems.length) { console.error(`casinoScandal: ${problems.length} problem(s)`); for (const p of problems) console.error("  ✗ " + p); process.exit(1); }
console.log(`casinoScandal: all good (stories a season: monthly ${casual.toFixed(2)}, weekly ${weekly.toFixed(2)})`);
