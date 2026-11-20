/**
 * A CAREER ONE MATCH FROM THE END OF ITS FIRST SEASON, for both apps (the playtest).
 * Like ../look/make-save.mts (Arsenal, every screen open, no tour), but every fixture
 * except the last `--left N` (default 1) is credited with mixed results, the way
 * scripts/soak/careerSoak.mts plays a season. Prints { packed: {...}, next: {...} }.
 *
 *   npx tsx phone/tools/playtest/make-season-end.mts [--left 1] > save.json
 */
import { makeInitialCareer, creditMatchResult, simulateMissedFixture } from "../../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../../lib/star/clubs";
import { nextFixtureFor } from "../../../lib/star/competitions";
import { saveCareer, ANON_SCOPE } from "../../../lib/star/storage";
import type { CareerState, MatchStats, StarPlayer } from "../../../lib/star/types";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const i = process.argv.indexOf("--left");
const LEFT = i >= 0 ? Number(process.argv[i + 1]) : 1;

function stats(us: number, them: number, home: boolean, goals: number): MatchStats {
  return { chances: 5, goals, assists: 1, passes: 28, rating: 7.2, starMan: goals >= 2, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 1, goalBonus: goals, sponsorPay: 0, totalCash: 2, homeScore: home ? us : them, awayScore: home ? them : us, minutes: 90 } as MatchStats;
}

const player = { firstName: "Look", lastName: "Check", age: 18, skinTone: "light", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
let c: CareerState = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]), unlocks: undefined };
const remaining = () => c.fixtures.filter((f) => !f.played).length;
let g = 0;
while (g++ < 300) {
  const next = nextFixtureFor(c);
  if (!next || remaining() <= LEFT) break;
  const us = (g * 7) % 4, them = (g * 5) % 3;
  c = (g % 9 === 0 ? simulateMissedFixture(c, next) : creditMatchResult(c, next, stats(us, them, next.home, Math.min(us, 2)))).career;
}
c = { ...c, money: Math.max(c.money, 500000) };
saveCareer(c, ANON_SCOPE);
const packed = Object.fromEntries(store);
const next = { "knowitball-career\\career-v2": JSON.stringify(c) };
console.error(`played ${g - 1}, left ${remaining()}, season ${c.season}`);
console.log(JSON.stringify({ packed, next }));
