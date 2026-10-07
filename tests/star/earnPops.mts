const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
};
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { earnedBetween, addSeasonRecords } from "../../lib/star/earnPops";
import { managerLook } from "../../lib/star/managerFace";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/** v0.23.1: achievements and records pop up by themselves (P36); manager faces are varied and stable (P72, P90). */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const player = { firstName: "Harry", lastName: "Vale", age: 18, skinTone: "light", club: "Liverpool", clubBadge: null,
  position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
const fresh = (): CareerState => makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");

{
  const a = fresh();
  check(earnedBetween(a, a).length === 0, "nothing changed, nothing pops");
  const b = { ...a, achievements: [...a.achievements, "first-goal"] };
  const e = earnedBetween(a, b);
  check(e.length === 1 && e[0].kind === "achievement" && e[0].label === "Score a Goal", "a new achievement pops once");
  check(earnedBetween(b, a).length === 0, "a different (older) save loading is not a moment");
  const other = { ...b, player: { ...b.player, firstName: "Someone" } } as CareerState;
  check(earnedBetween(a, other).length === 0, "a different player's save never pops");
}
{
  const a = { ...fresh(), careerBests: { furthestGoal: { metres: 20, season: 1, opponent: "X" }, mostGoalsMatch: { goals: 1, season: 1, opponent: "X" } } } as CareerState;
  const first = fresh();
  const firstGoal = { ...first, careerBests: { furthestGoal: { metres: 12, season: 1, opponent: "X" } } } as CareerState;
  check(earnedBetween(first, firstGoal).length === 0, "your first goal's distance is not a record");
  const b = { ...a, careerBests: { ...a.careerBests, furthestGoal: { metres: 31, season: 1, opponent: "Y" }, mostGoalsMatch: { goals: 2, season: 1, opponent: "Y" } } } as CareerState;
  const e = earnedBetween(a, b);
  check(e.length === 2 && e.every((x) => x.kind === "record"), "beating your own marks pops a record each");
  check(e.some((x) => x.unlocked.includes("31m")) && e.some((x) => x.unlocked.includes("2 goals")), "and says the new best");
  const same = { ...a, careerBests: { ...a.careerBests, furthestGoal: { metres: 20, season: 2, opponent: "Z" } } } as CareerState;
  check(earnedBetween(a, same).length === 0, "equalling a mark is not breaking it");
}
{
  check(JSON.stringify(managerLook("Keith Andrews")) === JSON.stringify(managerLook("Keith Andrews")), "a manager's face is the same every time");
  const names = ["Dave Carter", "Tom Brook", "Ian Hughes", "Paul Reeve", "Sam Okoro", "Luis Prado", "Mark Dunn", "Ed Fisher", "Joe Lane", "Ray Hale", "Nick Cole", "Bill Pryce"];
  const looks = new Set(names.map((n) => { const l = managerLook(n); return `${l.skin}|${l.hair}|${l.hairColour}|${l.beard}|${l.glasses}`; }));
  check(looks.size >= 9, `made-up managers look different from each other (${looks.size} of ${names.length})`);
  check(managerLook("Pep Guardiola").hair === "bald" && managerLook("Patrick Vieira").skin !== managerLook("Pep Guardiola").skin, "known managers follow broad strokes (bald, skin tone)");
  check(managerLook("Jürgen Klopp").glasses && managerLook("Sir Alex Ferguson").grey > 0.9, "accents and titles still find the man");
}
// Records go to the season round-up, one line per record, the latest mark (Mikey, 6 Oct 2026).
{
  const rec = (label: string, unlocked: string) => ({ id: label + unlocked, kind: "record" as const, label, unlocked });
  let list = addSeasonRecords(undefined, [rec("Most assists in a season", "A new best: 2 assists")]);
  for (let n = 3; n <= 17; n++) list = addSeasonRecords(list, [rec("Most assists in a season", `A new best: ${n} assists`)]);
  check(list.length === 1 && list[0].unlocked.endsWith("17 assists"), "17 assist records in a season become one line with the latest mark");
  list = addSeasonRecords(list, [rec("Premier League record broken", "Most goals — beating A"), rec("Premier League record broken", "Most assists — beating B"),
    { id: "x", kind: "achievement", label: "Not a record", unlocked: "" }]);
  check(list.length === 3, "each Premier League record keeps its own line; achievements are not added");
}
if (problems.length) { console.log("FAIL"); problems.forEach((p) => console.log("  ✗ " + p)); process.exit(1); }
console.log("PASS — earned pop-ups and manager faces");
