// SEED SCAN (playtest round 2, 21 Nov 2026): which week of the playtest career serves which situation.
// Builds the career exactly as make-season-end.mts does (Arsenal, mixed results credited fixture by
// fixture) and, BEFORE crediting each fixture, plays that fixture headless through the phone's driver
// with the deterministic bot (tools/match-bot.ts). Prints one line per fixture: left-count (use it as
// make-season-end.mts --left N, N = left), week, competition, seed, score, the chance kinds in order with
// the bot-chance index and minute, and the period/extra-time/shootout lines.
// The website and the phone make the same calls in the same order (tools/match-parity.ts), so a kind
// served BEFORE your first chance is served in both apps whatever you press.
// Caveat: headless has no real squads (the apps fill them from the packed files on load), so check live.
//
//   npx esbuild phone/tools/playtest/seed-scan.ts --bundle --platform=neutral --main-fields=module,main \
//     --format=esm --alias:@=. --external:three --outfile=/tmp/seed-scan.mjs && node /tmp/seed-scan.mjs [maxFixtures]
import { makeInitialCareer, creditMatchResult, simulateMissedFixture } from "@/lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { nextFixtureFor } from "@/lib/star/competitions";
import type { CareerState, MatchStats, StarPlayer } from "@/lib/star/types";
import { setVisitSalt } from "@/lib/star/chanceMaker";
import { MatchDriver } from "../../src/match/driver";
import { matchSetupFor } from "../../src/match/setup";

(globalThis as Record<string, unknown>).window ??= {};
setVisitSalt(0);

function stats(us: number, them: number, home: boolean, goals: number): MatchStats {
  return { chances: 5, goals, assists: 1, passes: 28, rating: 7.2, starMan: goals >= 2, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 1, goalBonus: goals, sponsorPay: 0, totalCash: 2, homeScore: home ? us : them, awayScore: home ? them : us, minutes: 90 } as MatchStats;
}

const MAX = Number((globalThis as { process?: { argv: string[] } }).process?.argv[2] ?? 80);
const player = { firstName: "Look", lastName: "Check", age: 18, skinTone: "light", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
let c: CareerState = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]), unlocks: undefined };
const remaining = () => c.fixtures.filter((f) => !f.played).length;
let g = 0;
while (g++ < Math.min(300, MAX)) {
  const next = nextFixtureFor(c);
  if (!next) break;
  const left = remaining();
  const cc = { ...c, week: next.week, money: Math.max(c.money, 500000) };
  try {
    const d = new MatchDriver(matchSetupFor(cc, next), { hw: 2.0 });
    const seen: string[] = [];
    let chances = 0, last = "";
    d.start();
    const entry = `${d.userScore}-${d.oppScore}@${d.matchMinute}`;
    let n = 0, aim = 0, con = 0;
    for (; n < 3_000_000 && !d.done; n++) {
      if (d.pause) { const l = d.pause.label; if (!seen.includes("P:" + l)) seen.push(`P:${l}@${d.matchMinute}`); d.continuePause(); continue; }
      if ((d.phase === "aim" || d.phase === "tdDribble") && last !== d.phase && last !== "aim") {
        chances++; aim = 0;
        seen.push(`${chances}:${d.phase === "tdDribble" ? "DRIBBLE" : d.sc.kind}@${d.matchMinute}`);
      }
      if (d.phase === "contact" && last !== "contact") con = 0;
      last = d.phase;
      if (d.phase === "tdDribble" && (d as unknown as { tdReady: boolean }).tdReady) d.tdTap({ x: 0, y: 0 });
      if (d.phase === "aim" && !d.lead) {
        aim++;
        if (aim === 30) { const b = d.sc.ball; d.pointerDown({ x: b.x, y: b.y }, 99, 0); d.pointerMove({ x: b.x, y: b.y + 3 }, () => 0.5); d.pointerUp(() => 0.5); }
      }
      if (d.phase === "contact" && !d.contactLocked) { con++; if (con === 6) d.tapContact(0, 0.15); }
      d.tick();
    }
    const periods = d.log.filter((l) => /half time|full time|extra|added|penalt|shoot|coming on|coming off|replac|captain/i.test(l.text)).map((l) => `${l.minute}' ${l.text}`);
    console.log(`left=${left} wk=${next.week} ${next.kind ?? "league"}/${next.competition ?? ""} v ${next.opponent} seed=${cc.season * 1000 + cc.week} entry=${entry} ft=${d.userScore}-${d.oppScore} | ${seen.join(" ")} | ${periods.join(" ; ")}`);
  } catch (e) { console.log(`left=${left} wk=${next.week} ERROR ${(e as Error).message}`); }
  const us = (g * 7) % 4, them = (g * 5) % 3;
  c = (g % 9 === 0 ? simulateMissedFixture(c, next) : creditMatchResult(c, next, stats(us, them, next.home, Math.min(us, 2)))).career;
}
