import { previewCareer } from "../../lib/star/retirementPreview";
import { hallEntryFor, type HallEntry } from "../../lib/star/hallOfFame";
import {
  hallRecordBook, hallChases, hallChaseLine, freshHallRecords, amount, surnameOf, HALL_RECORDS,
} from "../../lib/star/hallRecords";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { generateForCareer } from "../../lib/star/media/feed";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * YOUR RECORDS LIVE ON (Leo, 6 Oct 2026): your retired careers' bests become
 * records your later careers chase. See lib/star/hallRecords.ts.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

/** A retired career with these bests, as a Hall entry added at `at`. */
function entry(name: string, at: number, bests: { goalsSeason?: number; goals?: number; ballonDors?: number }, seed = 1): HallEntry {
  const c = previewCareer("journeyman", seed);
  const [first, ...rest] = name.split(" ");
  const career: CareerState = {
    ...c,
    player: { ...c.player, firstName: first, lastName: rest.join(" ") },
    careerBests: { ...c.careerBests, mostGoalsSeason: { goals: bests.goalsSeason ?? 10, season: 7 } },
    careerStats: { ...c.careerStats, goals: bests.goals ?? 100 },
    ballonDorWins: bests.ballonDors ?? 0,
  };
  const e = hallEntryFor(career, at);
  return { ...e, card: { ...e.card, name } };
}

// ── 1. Who holds a record ───────────────────────────────────────────────────
{
  const a = entry("Jamie Calloway", 1000, { goalsSeason: 51, goals: 400 });
  const b = entry("Tom Ashworth", 2000, { goalsSeason: 51, goals: 450 }, 2);
  const c = entry("Rhys Doherty", 3000, { goalsSeason: 55, goals: 300 }, 3);
  const book = hallRecordBook([c, b, a]);
  const season = book.find(r => r.def.id === "goals-season")!;
  check(season.holder.name === "Rhys Doherty" && season.holder.value === 55, `the best holds it (${season.holder.name} ${season.holder.value})`);
  check(season.history.map(h => h.name).join(",") === "Jamie Calloway", `equalling it never takes it: Ashworth's 51 is not in the history (${season.history.map(h => h.name).join(",")})`);
  check(season.history[0]?.value === 51, "the old holder keeps his number in the history");
  const career = book.find(r => r.def.id === "goals-career")!;
  check(career.holder.name === "Tom Ashworth" && career.history[0]?.name === "Jamie Calloway", "career goals: Ashworth took it from Calloway");
  check(season.holder.seasonLabel === "2032/33", `a season record says which season (${season.holder.seasonLabel})`);
  check(hallRecordBook([]).length === 0, "an empty Hall holds no records");
  check(!book.some(r => r.def.id === "ballon-dors"), "nobody won a Ballon d'Or: no record for it");
}

// ── 2. The chase on Home ────────────────────────────────────────────────────
{
  const book = hallRecordBook([entry("Jamie Calloway", 1000, { goalsSeason: 50, goals: 5000 })]);
  const now = makeInitialCareer({ firstName: "New", lastName: "Kid", age: 18, position: "ST", club: "Arsenal", nationality: "England" } as StarPlayer, [...PREMIER_LEAGUE_CLUBS]);
  const at = (goals: number): CareerState => ({ ...now, seasonStats: { ...now.seasonStats, goals } });
  check(hallChaseLine(at(0), book) === null, "nothing this season: no line");
  check(hallChaseLine(at(20), book) === null, "far off (20 of 50): no line yet");
  check(hallChaseLine(at(47), book)?.text === "3 goals off Calloway's record", `close: "${hallChaseLine(at(47), book)?.text}"`);
  check(hallChaseLine(at(49), book)?.text === "1 goal off Calloway's record", "one goal: singular");
  check(hallChaseLine(at(50), book)?.text === "Level with Calloway's record — one more beats it", "level");
  const beaten = { ...at(51), careerBests: { mostGoalsSeason: { goals: 51, season: 1 } } };
  check(hallChaseLine(beaten, book) === null, "beaten: no chase line");
  const chases = hallChases(beaten, book);
  check(chases.find(c => c.record.def.id === "goals-season")?.beaten === true, "and the chase says beaten");
}

// ── 3. A record broken once is celebrated once ──────────────────────────────
{
  const book = hallRecordBook([entry("Jamie Calloway", 1000, { goalsSeason: 30 })]);
  const now = makeInitialCareer({ firstName: "New", lastName: "Kid", age: 18, position: "ST", club: "Arsenal", nationality: "England" } as StarPlayer, [...PREMIER_LEAGUE_CLUBS]);
  const beat: CareerState = { ...now, careerBests: { mostGoalsSeason: { goals: 31, season: 1 } } };
  const fresh = freshHallRecords(beat, book);
  check(fresh.some(f => f.record.def.id === "goals-season"), "beating it makes it fresh");
  const done: CareerState = { ...beat, hallRecordsBroken: ["goals-season"] };
  check(!freshHallRecords(done, book).some(f => f.record.def.id === "goals-season"), "once celebrated, never again");
  // The news: a real post, with the old holder named.
  const media = generateForCareer(beat, { kind: "hall-record", record: "Most goals in a season", holder: "Jamie Calloway", was: 30, now: 31, unit: "goals" }, "hall-goals-season");
  const posts = media.posts ?? [];
  check(posts.length > 0, `a broken record makes news posts (${posts.length})`);
  check(posts.some(p => /Calloway|30/.test(JSON.stringify(p))), "and they name the old holder or his number");
}

// ── 4. Words ────────────────────────────────────────────────────────────────
{
  const goals = HALL_RECORDS.find(d => d.id === "goals-season")!;
  const bd = HALL_RECORDS.find(d => d.id === "ballon-dors")!;
  const far = HALL_RECORDS.find(d => d.id === "furthest-goal")!;
  check(amount(goals, 1) === "1 goal" && amount(goals, 52) === "52 goals", "goals: one and many");
  check(amount(bd, 1) === "1 Ballon d'Or" && amount(bd, 2) === "2 Ballons d'Or", "Ballons d'Or");
  check(amount(far, 38) === "38 m", "metres");
  check(surnameOf("Jamie Calloway") === "Calloway" && surnameOf("Pedri") === "Pedri" && surnameOf("Kevin De Bruyne") === "De Bruyne", "surnames");
}

if (problems.length) { console.error("hallRecords FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("hallRecords: all checks passed");
