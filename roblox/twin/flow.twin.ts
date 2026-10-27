// Twin test: careers played through the Roblox flow (roblox/game/flow.ts)
// with "Sim this match" on every fixture, so the hidden match engine and the
// sim's chance rolls run too. A robot takes every decision the same way on
// both sides. The website and Roblox must print the same lines.
//   FLOW_SEASONS=2 FLOW_DIVS=premier npx tsx roblox/twin/flow.twin.ts
import * as F from "../game/flow";
import * as C from "../../lib/star/clubs";
import type { StarPlayer } from "../../lib/star/types";
import type { CareerDivision } from "../../lib/star/calendar";
import { show } from "./_out";
declare const process: { env: Record<string, string | undefined> };

const SEASONS = Number(process.env.TWIN_FLOW_SEASONS ?? 2);
const ONLY = process.env.TWIN_FLOW_DIVS?.split(",");
const DIVS0: [CareerDivision, readonly string[], number][] = [
  ["premier", C.PREMIER_LEAGUE_CLUBS, 3], ["championship", C.CHAMPIONSHIP_CLUBS, 7], ["league_two", C.LEAGUE_TWO_CLUBS, 2],
  ["national_league_north", C.NATIONAL_LEAGUE_NORTH_CLUBS, 20],
];
const DIVS = ONLY ? DIVS0.filter(([d]) => ONLY.includes(d)) : DIVS0;
const r2 = (n: number) => Math.round(n * 100) / 100;

function line(g: F.Game, what: string) {
  const c = g.career;
  const me = c.league.find((t) => t.name === c.player.club);
  const s = g.lastMatchStats;
  console.log([what, g.phase, `s${c.season}w${c.week}`, c.player.club, me ? `${me.played}/${me.points}` : "-",
    s ? `${s.homeScore}-${s.awayScore} g${s.goals} a${s.assists} r${r2(s.rating)}` : "", r2(c.money), r2(c.fame), r2(c.starRating),
    `e${r2(c.energy)}`, c.contract.club, c.contract.wage].join(" | "));
}

for (const [div, clubs, pick] of DIVS) {
  const club = clubs[pick % clubs.length];
  const p = { firstName: "Flow", lastName: "Robot", age: 18, skinTone: "light", club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  let g = F.newGame(p, [...clubs], div);
  line(g, `== ${div} start`);
  let steps = 0;
  let seasonsDone = 0;
  let talked = false;
  while (steps++ < 4000 && seasonsDone < SEASONS) {
    const ph = g.phase;
    switch (ph) {
      case "dashboard": {
        const m = F.matchday(g);
        if (m.seasonOver) { g = F.endSeason(g); line(g, "end season"); break; }
        g = m.canPlay ? F.simMatch(g) : F.watchFromStands(g);
        line(g, m.canPlay ? `sim v ${m.fixture?.opponent}` : `watch v ${m.fixture?.opponent} (${m.status})`);
        break;
      }
      case "youth": {
        const m = F.matchday(g);
        if (m.seasonOver) { g = F.endSeason(g); break; }
        const before = g;
        g = F.youthPromotion(g);
        if (g === before) g = F.youthWeek(g);
        line(g, "youth");
        break;
      }
      case "post-match": g = F.postMatchContinue(g); break;
      case "draw": console.log(`draw ${g.pendingDraw?.competition} ${g.pendingDraw?.round.name} ${show(g.pendingDraw?.round.ties)}`); g = F.drawContinue(g); break;
      case "knockout-roundup": console.log(`ko ${g.pendingKo?.key}`); g = F.knockoutContinue(g); break;
      case "playoff-roundup": g = F.playoffContinue(g); break;
      case "deadline-day": console.log(`deadline ${g.career.lastTransferWindowKey}`); g = F.deadlineDayContinue(g); break;
      case "intl-callup": { const d = F.callUp(g); console.log(`callup ${show(d && { called: d.called, nation: d.nation })}`); g = F.callUpContinue(g); break; }
      case "intl-watched": case "intl-tournament-table": g = F.backToDashboard(g); break;
      case "contract-renewal": {
        const offer = F.renewalOffer(g, 1, false, 1);
        console.log(`renewal ${show(offer)}`);
        g = F.contractComplete(g, offer);
        break;
      }
      case "ballon-dor": {
        const r = F.ballonDor(g);
        console.log(`ballon d'or rank ${r.playerRank} top ${show(r.entries.slice(0, 3).map((e) => e.name))}`);
        g = F.ballonDorContinue(g);
        line(g, "after ballon d'or");
        break;
      }
      case "final-season": g = F.playOn(g); break;
      case "retirement": g = F.retireNow(g); seasonsDone = SEASONS; break;
      case "season-transfer": {
        const interest = F.transferInterest(g);
        const offers = interest.leagues.flatMap((l) => l.clubs.map((c) => c.offer));
        console.log(`window ${offers.length} clubs: ${offers.slice(0, 5).map((o) => `${o.club}@${o.wage}`).join(", ")}`);
        if (!talked && offers.length) {
          talked = true;
          g = F.transferNegotiate(g, offers[0]);
          g = F.transferTalkDone(g, offers[0].wage);
        } else g = F.stayPut(g);
        break;
      }
      case "transfer-request-talk": g = F.transferTalkDone(g, null); break;
      case "transfer-signing": g = F.signingDone(g); line(g, "signed"); break;
      case "relegation-move": g = F.chooseTransfer(g, g.transferOffers![0]); break;
      case "season-awards": g = F.seasonAwardsContinue(g); seasonsDone++; line(g, "== new season"); break;
      case "ladder": g = F.ladderContinue(g); break;
      case "legacy": seasonsDone = SEASONS; break;
    }
  }
  line(g, `== ${div} end`);
}
