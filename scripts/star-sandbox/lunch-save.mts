/**
 * A signed-out save for the Lunch card stills (scripts/star-sandbox/lunch-stills.mjs): a fresh career with every
 * screen open, the career clock set to a given minute of day 0 (before the first match).
 *
 *   npx tsx scripts/star-sandbox/lunch-save.mts <minute> [club] [division] > save.json
 */
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { saveCareer, ANON_SCOPE } from "../../lib/star/storage";
import { clockOf } from "../../lib/star/life/clock";
import type { CareerDivision, StarPlayer } from "../../lib/star/types";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const minute = Number(process.argv[2] ?? 540);
const club = process.argv[3] ?? "Arsenal";
const division = (process.argv[4] ?? "premier") as CareerDivision;
const player = {
  firstName: "Lunch", lastName: "Test", age: 20, skinTone: "light",
  club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
} as StarPlayer;
const made = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], division);
const career = { ...made, energy: 60, unlocks: undefined, clock: { ...clockOf(made), d: 0, m: minute } };
saveCareer(career, ANON_SCOPE);
store.set("kib-cookie-consent", "no");
console.log(JSON.stringify(Object.fromEntries(store)));
