const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
};
import { makeInitialCareer, creditMatchResult, simulateMissedFixture } from "../../lib/star/careerFlow";
import { nextFixtureFor } from "../../lib/star/competitions";
import { KIB_CANS, kibCanEffectLabel } from "../../lib/star/shopData";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * KIB CANS (owners, 23 Sep 2026): Basic gives +65 energy; Premium gives the
 * Swerve boots' curve and Elite the Touch boots' extra touch, for the next
 * match you actually play.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const can = (id: string) => KIB_CANS.find(c => c.id === id)!;
check(can("basic").restore === 65 && !can("basic").effect, "Basic is +65 energy");
check(can("premium").effect === "curve", "Premium gives the curve");
check(can("elite").effect === "extraTouch", "Elite gives the extra touch");
check(kibCanEffectLabel(can("basic")) === "+65 energy", "Basic is labelled +65 energy");
check(/Swerve/.test(kibCanEffectLabel(can("premium"))) && /Touch/.test(kibCanEffectLabel(can("elite"))), "the boot cans say which boots");

const player = { firstName: "T", lastName: "P", age: 22, skinTone: "light", club: "Liverpool", clubBadge: null,
  position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
const c: CareerState = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier"), kibAbility: { curve: true, extraTouch: true } };
const f = nextFixtureFor(c)!;

const missed = simulateMissedFixture(c, f).career;
check(!!missed.kibAbility?.curve && !!missed.kibAbility?.extraTouch, "a week in the stands keeps the ability for when you do play");

const stats = { chances: 3, goals: 0, assists: 0, passes: 8, rating: 7, starMan: false, bossChange: 0, teamChange: 0,
  fansChange: 0, wage: 1, goalBonus: 0, sponsorPay: 0, totalCash: 1, homeScore: 1, awayScore: 0, minutes: 90 };
const played = creditMatchResult(c, f, stats).career;
check(!played.kibAbility, "the match you play uses it up");

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — Basic is +65 energy, Premium/Elite lend the Swerve/Touch ability for exactly the next match you play");
