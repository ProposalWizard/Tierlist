// Plays whole matches through the phone's match driver with a simple bot, headless.
// Run from the worktree root:
//   npx esbuild phone/tools/match-run.ts --bundle --platform=neutral --main-fields=module,main --format=esm --alias:@=. --external:three --outfile=/tmp/match-run.mjs && node /tmp/match-run.mjs [matches]
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { NATIONAL_LEAGUE_SOUTH_CLUBS } from "@/lib/star/clubs";
import type { CareerState, StarPlayer, Fixture } from "@/lib/star/types";
import { setVisitSalt } from "@/lib/star/chanceMaker";
import { MatchDriver } from "../src/match/driver";
import { matchSetupFor } from "../src/match/setup";
import { playWithBot } from "./match-bot";

// A phone has a `window` but no localStorage: the lib's settings read their defaults, as on the phone.
(globalThis as Record<string, unknown>).window ??= {};
setVisitSalt(0);

export function testCareer(): CareerState {
  const clubs = [...NATIONAL_LEAGUE_SOUTH_CLUBS];
  const player = { firstName: "Test", lastName: "Player", age: 16, skinTone: "light", club: clubs[0], clubBadge: null, position: "ST", nationality: "England", startYear: 2026 } as StarPlayer;
  return makeInitialCareer(player, clubs, "national_league_south");
}

const n = Number((globalThis as { process?: { argv: string[] } }).process?.argv[2] ?? 3);
const career = testCareer();
const fixtures = career.fixtures.filter((f: Fixture) => !f.played).slice(0, n);
for (const [i, fx] of fixtures.entries()) {
  const c = { ...career, week: fx.week };
  const d = new MatchDriver(matchSetupFor(c, fx), { hw: 2.0 });
  const t0 = Date.now();
  const res = playWithBot(d, 1000 + i);
  const s = d.finalStats!;
  console.log(`${fx.home ? "H" : "A"} v ${fx.opponent.padEnd(26)} ${d.userScore}-${d.oppScore}  chances ${res.chances}  goals ${s.goals} assists ${s.assists} rating ${s.rating}  ticks ${res.ticks}  ${Date.now() - t0} ms  kinds ${JSON.stringify(res.kinds)}`);
}
