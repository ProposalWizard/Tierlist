/**
 * A ready-made signed-out save for the speed measurements (scripts/perf2d/measure.mjs).
 * Prints the localStorage keys and values as JSON: a fresh Premier League
 * career at Arsenal, landing on Home.
 *
 *   npx tsx scripts/perf2d/make-save.mts > /tmp/save.json
 */
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { saveCareer, ANON_SCOPE } from "../../lib/star/storage";
import type { StarPlayer } from "../../lib/star/types";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const player = {
  firstName: "Speed", lastName: "Test", age: 18, skinTone: "light",
  club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
} as StarPlayer;
// No unlock chain: an old-style save where every screen is open and no tour plays.
const career = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]), unlocks: undefined };
saveCareer(career, ANON_SCOPE);
console.log(JSON.stringify(Object.fromEntries(store)));
