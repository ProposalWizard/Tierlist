import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { syncIntl, intlOf, worldOf, periodsFrom } from "../../lib/star/intl/career";
import { intlSeason, topIntlScorers, tallyKey } from "../../lib/star/intl/scorers";
import { computeBallonDorShortlist } from "../../lib/star/ballonDor";
import type { CareerState, LeaguePlayer, StarPlayer } from "../../lib/star/types";

/**
 * EVERY INTERNATIONAL GOAL HAS A NAME (Mikey, 12 Oct 2026). The world's
 * matches are scores; intl/scorers.ts names the goals from each nation's
 * squad, and the Ballon d'Or counts them for everyone, you included.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// A Premier League save whose clubs have real English, French and Brazilian
// players, so those three nations field real names.
function lp(id: string, name: string, nation: string, position: LeaguePlayer["position"], overall: number): LeaguePlayer {
  return { id, name, nation, position, overall, goals: 0, assists: 0 } as LeaguePlayer;
}
const POS: LeaguePlayer["position"][] = ["GK", "GK", "CB", "CB", "CB", "LB", "RB", "CDM", "CM", "CM", "CAM", "LW", "RW", "ST", "ST", "ST"];
function nationPlayers(nation: string, top: number): LeaguePlayer[] {
  return POS.map((pos, i) => lp(`${nation}-${i}`, `${nation} ${pos} ${i}`, nation, pos, top - (i % 5)));
}
function career(): CareerState {
  const p = { firstName: "Test", lastName: "Player", age: 24, position: "ST", club: "Arsenal", nationality: "Japan", startYear: 2027 } as StarPlayer;
  let c = syncIntl(makeInitialCareer(p, PREMIER_LEAGUE_CLUBS, "premier"));
  const squads = [
    { club: "Chelsea", players: [...nationPlayers("England", 90)] },
    { club: "Liverpool", players: [...nationPlayers("France", 91)] },
    { club: "Manchester City", players: [...nationPlayers("Brazil", 88)] },
  ];
  // The whole club season played, and every Japan call-up answered "not
  // picked", so the world runs to the summer.
  c = { ...c, leagueSquads: squads, externalSquads: [], fixtures: (c.fixtures ?? []).map((f) => ({ ...f, played: true })) };
  for (let i = 0; i < 6; i++) {
    const s = intlOf(c);
    const w = worldOf(c);
    const periods = { ...s.periods };
    for (const per of periodsFrom(w, s.nation, 0)) periods[per.key] ??= { called: false, chance: 0, starter: false };
    c = { ...c, intl: { ...s, periods } };
  }
  return c;
}

const c = career();
const t0 = Date.now();
const season = intlSeason(c);
const ms = Date.now() - t0;
const w = worldOf(c);

// Every goal is named, on both sides, and only goals that were scored.
let scored = 0, named = 0, keeperGoals = 0, assisted = 0;
for (const m of w.matches) {
  const g = season.goals.get(m.id);
  if (!g) continue;
  scored += (m.hs ?? 0) + (m.as ?? 0);
  named += g.home.length + g.away.length;
  assisted += [...g.home, ...g.away].filter((x) => x.a).length;
  keeperGoals += [...g.home, ...g.away].filter((x) => x.role === "GK").length;
}
check(season.goals.size > 300, `a season of world matches has scorers (${season.goals.size} matches)`);
check(named === scored, `every goal has a scorer (${named} named of ${scored})`);
check(keeperGoals === 0, `no keeper scores (${keeperGoals})`);
const share = assisted / Math.max(1, named);
check(share > 0.65 && share < 0.82, `about three goals in four have an assist (${(share * 100).toFixed(0)}%)`);
const totalTally = Array.from(season.players.values()).reduce((s, p) => s + p.goals, 0);
check(totalTally === named, `the season totals add up to the goals (${totalTally} v ${named})`);

// Same save, same scorers.
const again = intlSeason({ ...c });
const a1 = JSON.stringify(Array.from(season.goals.entries()).slice(0, 50));
const a2 = JSON.stringify(Array.from(again.goals.entries()).slice(0, 50));
check(a1 === a2, "the same save names the same scorers");

// Real players score for their country; the best striker leads his nation.
const eng = Array.from(season.players.values()).filter((p) => p.nation === "England").sort((a, b) => b.goals - a.goals);
check(eng[0]?.real === true, `England's top scorer is a real player (${eng[0]?.name}, ${eng[0]?.goals})`);
check(["ST", "LW", "RW", "CAM"].includes(eng[0]?.position ?? ""), `…and a forward (${eng[0]?.position})`);

// The Ballon d'Or counts them: a rival's goals are club + country.
const sl = computeBallonDorShortlist(c);
const rival = sl.entries.find((e) => !e.isPlayer && (e.intlGoals ?? 0) > 0);
check(!!rival, "a shortlisted rival carries international goals");
const sq = c.leagueSquads!.flatMap((x) => x.players.map((p) => ({ ...p, club: x.club })));
if (rival) {
  const club = sq.find((p) => p.name === rival.name)!;
  check(rival.goals === club.goals + (rival.intlGoals ?? 0), `his goals are club ${club.goals} + country ${rival.intlGoals} = ${rival.goals}`);
}

// Your own goals for your country count for you.
{
  const s = intlOf(c);
  const japan = w.matches.find((m) => (m.home === "Japan" || m.away === "Japan") && m.hs != null && season.goals.has(m.id));
  if (!japan) check(false, "Japan played this season");
  else {
    const mine = japan.home === "Japan" ? Math.min(2, japan.hs!) : Math.min(2, japan.as!);
    const c2: CareerState = { ...c, intl: { ...s, played: { ...s.played, [japan.id]: { hs: japan.hs!, as: japan.as!, mine: { g: mine, a: 1 } } } } };
    const s2 = intlSeason(c2);
    check(s2.you.goals === mine && s2.you.assists === 1, `your goals for your country count (${s2.you.goals}/${s2.you.assists})`);
    const g = s2.goals.get(japan.id)!;
    const side = japan.home === "Japan" ? g.home : g.away;
    check(side.length === (japan.home === "Japan" ? japan.hs! : japan.as!) - mine, "…and the rest of Japan's goals are named from the squad");
    const you = computeBallonDorShortlist({ ...c2, seasonStats: { ...c2.seasonStats, goals: 10, assists: 0 } }).entries.find((e) => e.isPlayer);
    if (you) check(you.goals === 10 + mine && you.intlGoals === mine, `your Ballon d'Or goals are club + country (${you.goals})`);
  }
}

// A night counts from the night before: season 2 only sees matches after
// season 1's night, so a summer tournament is never counted twice or lost.
{
  const s = intlOf(c);
  const cut = w.matches.filter((m) => m.hs != null).map((m) => m.date).sort((a, b) => a - b)[400];
  const c2: CareerState = { ...c, season: 2, intl: { ...s, nights: { 1: cut } } };
  const s2 = intlSeason(c2);
  const w2 = worldOf(c2);
  const dates = Array.from(s2.goals.keys()).map((id) => w2.byId.get(id)!.date);
  check(dates.length > 0 && dates.every((d) => d >= cut), `season 2 counts only what came after season 1's night (${dates.length} matches)`);
  const s1 = intlSeason(c2, 1);
  const overlap = Array.from(s1.goals.keys()).filter((id) => s2.goals.has(id));
  check(overlap.length === 0, `no match counts for two nights (${overlap.length})`);
}

// Star Man no longer scores.
{
  const a = computeBallonDorShortlist({ ...c, seasonStats: { ...c.seasonStats, goals: 20, starMan: 0, appearances: 30 } });
  const b = computeBallonDorShortlist({ ...c, seasonStats: { ...c.seasonStats, goals: 20, starMan: 15, appearances: 30 } });
  const sa = a.entries.find((e) => e.isPlayer)?.score, sb = b.entries.find((e) => e.isPlayer)?.score;
  check(sa === sb, `Star Man awards add nothing to your Ballon d'Or score (${sa} v ${sb})`);
}

const top = topIntlScorers(season, 5);
console.log(`Season 1: ${season.goals.size} matches, ${named} goals named in ${ms} ms; top scorers: ${top.map((p) => `${p.name} (${p.nation}${p.real ? "" : ", made up"}) ${p.goals}`).join(", ")}`);
console.log(`Real-player leaders: ${Array.from(season.players.values()).filter((p) => p.real).sort((a, b) => b.goals - a.goals).slice(0, 5).map((p) => `${p.name} ${p.goals}g ${p.assists}a`).join(", ")}`);
void tallyKey;

if (problems.length) { console.error("FAIL\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("PASS — every international goal has a scorer, the same every time, and the Ballon d'Or counts club and country for everyone (no Star Man)");
