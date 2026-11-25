// SEED SCAN FOR A LEVEL MATCH (playtest round 3): which SEASON NUMBER makes a chosen fixture end level at 90'
// when you never score (every strike is pulled the wrong way). seed = season*1000 + week, so changing
// `career.season` in the save changes only the hidden match. Prints ft score, kinds served, periods.
//   npx esbuild phone/tools/playtest/seed-scan-level.ts --bundle --platform=neutral --main-fields=module,main \
//     --format=esm --alias:@=. --external:three --outfile=/tmp/ssl.mjs && node /tmp/ssl.mjs <left> [from] [to]
import { makeInitialCareer, creditMatchResult, simulateMissedFixture } from "@/lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { nextFixtureFor } from "@/lib/star/competitions";
import type { CareerState, MatchStats, StarPlayer } from "@/lib/star/types";
import { setVisitSalt } from "@/lib/star/chanceMaker";
import { MatchDriver } from "../../src/match/driver";
import { matchSetupFor } from "../../src/match/setup";

(globalThis as Record<string, unknown>).window ??= {};
setVisitSalt(0);
const arg = (i: number, d: number) => Number((globalThis as { process?: { argv: string[] } }).process?.argv[i] ?? d);
const LEFT = arg(2, 22), FROM = arg(3, 1), TO = arg(4, 40);
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
const next = nextFixtureFor(c)!;
for (let s = FROM; s <= TO; s++) {
  const cc = { ...c, season: s, week: next.week, money: Math.max(c.money, 500000) };
  try {
    const d = new MatchDriver(matchSetupFor(cc, next), { hw: 2.0 });
    d.start();
    const entry = `${d.userScore}-${d.oppScore}@${d.matchMinute}`;
    const seen: string[] = []; let chances = 0, last = "", aim = 0, con = 0, n = 0;
    for (; n < 3_000_000 && !d.done; n++) {
      if (d.pause) { d.continuePause(); continue; }
      if ((d.phase === "aim" || d.phase === "tdDribble") && last !== d.phase && last !== "aim") { chances++; aim = 0; seen.push(`${d.phase === "tdDribble" ? "DRIBBLE" : d.sc.kind}@${d.matchMinute}`); }
      if (d.phase === "contact" && last !== "contact") con = 0;
      last = d.phase;
      if (d.phase === "tdDribble" && (d as unknown as { tdReady: boolean }).tdReady) d.tdTap({ x: 0, y: 0 });
      if (d.phase === "aim" && !d.lead) {
        aim++;
        // the wrong way: pulled TOWARD the goal, so the ball goes back
        if (aim === 30) { const b = d.sc.ball; d.pointerDown({ x: b.x, y: b.y }, 99, 0); d.pointerMove({ x: b.x, y: b.y - 6 }, () => 0.5); d.pointerUp(() => 0.5); }
      }
      if (d.phase === "contact" && !d.contactLocked) { con++; if (con === 6) d.tapContact(0, 0.15); }
      d.tick();
    }
    const periods = d.log.filter((l) => /extra|penalt|shoot|full time|half time/i.test(l.text)).map((l) => `${l.minute}' ${l.text}`);
    console.log(`season=${s} seed=${s * 1000 + next.week} ${next.competition ?? next.kind} v ${next.opponent} entry=${entry} ft=${d.userScore}-${d.oppScore} | ${seen.join(" ")} | ${periods.join(" ; ")}`);
  } catch (e) { console.log(`season=${s} ERROR ${(e as Error).message}`); }
}
