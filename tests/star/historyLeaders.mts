/**
 * HISTORY LEADERS (Mikey, 2 Nov 2026): each finished season's History row
 * carries its top scorer, top assister and player of the season, and the
 * real history files join under the career with no overlap.
 *   npx tsx tests/star/historyLeaders.mts
 */
import { makeInitialCareer, creditMatchResult, advanceSeason, simulateMissedFixture } from "../../lib/star/careerFlow";
import { computeSeasonAwardStats } from "../../lib/star/seasonAwards";
import * as C from "../../lib/star/clubs";
import { nextFixtureFor } from "../../lib/star/competitions";
import { compHistoryFor } from "../../lib/star/world/history";
import { loadRealHistory, joinHistory, careerFirstYear, type HistoryLine } from "../../lib/star/world/realHistory";
import type { CareerState, LeagueSquad, MatchStats, StarPlayer } from "../../lib/star/types";

let fails = 0;
const ok = (cond: boolean, what: string) => { console.log(`${cond ? "✓" : "✗"} ${what}`); if (!cond) fails++; };

// ── The real files ──────────────────────────────────────────────────────────
const pl = await loadRealHistory("Premier League");
ok(pl.length > 100 && pl[0].label === "2025-26", `Premier League real history loads, newest 2025-26 (${pl.length} rows, top ${pl[0]?.label})`);
ok(!!pl[0].scorers?.length && !!pl[0].assisters?.length && !!pl[0].best, "2025-26 has scorer, assister and player of the season");
const wc = await loadRealHistory("World Cup");
ok(wc[0]?.label === "2026" && wc[0].winner === "Spain", "World Cup newest real final: 2026, Spain");
ok(wc.some(r => r.notHeld), "World Cup keeps the war years as Not played");
ok((await loadRealHistory("Copa América")).length === 0, "a competition with no file gives an empty list");
const names = ["Premier League", "Championship", "League One", "League Two", "National League", "National League North", "National League South",
  "FA Cup", "League Cup", "Lower League Trophy", "Community Shield", "Champions League", "Europa League", "Super Cup",
  "World Cup", "European Championship", "Nations League", "Africa Cup of Nations", "Asian Cup", "Gold Cup", "CONCACAF Nations League", "OFC Nations Cup"];
for (const n of names) ok((await loadRealHistory(n)).length > 0, `${n}: file found`);

// ── Joining: career on top, real underneath, never the same year twice ─────
const first = careerFirstYear(2027);
ok(first === 2026, "a 2026/27 start begins in 2026");
const mine: HistoryLine[] = [{ label: "2026-27", year: 2026, real: false, winner: "X" }];
const realRows: HistoryLine[] = [{ label: "2026-27", year: 2026, real: true, winner: "Y" }, { label: "2025-26", year: 2025, real: true, winner: "Z" }];
const joined = joinHistory(mine, realRows, first);
ok(joined.map(r => r.winner).join() === "X,Z", "a career season replaces the real one for the same year");

// ── A season played: every History row gets its leaders ────────────────────
function stats(us: number, them: number, home: boolean): MatchStats {
  return { chances: 5, goals: Math.min(us, 2), assists: 1, passes: 28, rating: 7.4, starMan: us >= 2, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 1, goalBonus: 1, sponsorPay: 0, totalCash: 2, homeScore: home ? us : them, awayScore: home ? them : us, minutes: 90 } as MatchStats;
}
const p = { firstName: "Hist", lastName: "Test", age: 17, skinTone: "light", club: C.PREMIER_LEAGUE_CLUBS[0], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
let c: CareerState = makeInitialCareer(p, [...C.PREMIER_LEAGUE_CLUBS], "premier");
// No database here, so every club gets a made-up eleven (the game loads real ones).
const POS = ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CAM", "LW", "RW", "ST", "ST", "CM", "CB", "GK"] as const;
const squadOf = (club: string): LeagueSquad => ({ club, players: POS.map((pos, i) => ({ id: `${club}#${i}`, name: `${club.split(" ")[0]} ${pos}${i}`, position: pos, overall: 70, goals: 0, assists: 0 })) as LeagueSquad["players"] });
function fill(x: CareerState): CareerState {
  const clubs = new Set<string>([...C.PREMIER_LEAGUE_CLUBS, ...C.CHAMPIONSHIP_CLUBS, ...C.LEAGUE_ONE_CLUBS, ...C.LEAGUE_TWO_CLUBS, ...C.NATIONAL_LEAGUE_CLUBS,
    ...C.NATIONAL_LEAGUE_NORTH_CLUBS, ...C.NATIONAL_LEAGUE_SOUTH_CLUBS]);
  for (const e of x.world?.europe ?? []) for (const k of e.clubs) clubs.add(typeof k === "string" ? k : (k as { name: string }).name);
  for (const k of x.euroState?.clubs ?? []) clubs.add((k as { name: string }).name);
  const own = new Set(x.league.map(t => t.name));
  const have = new Set([...(x.leagueSquads ?? []), ...(x.externalSquads ?? [])].map(q => q.club));
  const add = [...clubs].filter(k => !have.has(k) && k !== x.player.club);
  return { ...x,
    leagueSquads: [...(x.leagueSquads ?? []), ...add.filter(k => own.has(k)).map(squadOf)],
    externalSquads: [...(x.externalSquads ?? []), ...add.filter(k => !own.has(k)).map(squadOf)] };
}
for (let season = 1; season <= 2; season++) {
  c = fill(c);
  for (let g = 0; g < 250; g++) {
    if (g === 1) c = fill(c);
    const next = nextFixtureFor(c);
    if (!next) break;
    c = (g % 9 === 0 ? simulateMissedFixture(c, next) : creditMatchResult(c, next, stats((g * 7) % 4, (g * 5) % 3, next.home))).career;
  }
  c = { ...c, lastSeasonAwardStats: computeSeasonAwardStats(c) };
  c = advanceSeason(c, false).career;
}
const comps = ["Premier League", "Championship", "League One", "League Two", "National League", "FA Cup", "League Cup"];
for (const comp of comps) {
  const rows = compHistoryFor(c, comp);
  const r = rows[0];
  ok(rows.length === 2 && !!r?.scorers?.length && !!r?.assisters?.length && !!r?.best,
    `${comp}: ${rows.length} seasons; latest ⚽ ${r?.scorers?.map(x => `${x.name} ${x.n}`).join(", ")} · 🅰️ ${r?.assisters?.map(x => `${x.name} ${x.n}`).join(", ")} · ⭐ ${r?.best?.name}`);
}
for (const comp of ["Champions League", "Europa League"]) {
  const r = compHistoryFor(c, comp)[0];
  ok(!!r?.winner, `${comp}: ${r?.winner} won; ⚽ ${r?.scorers?.map(x => `${x.name} ${x.n}`).join(", ") ?? "—"} · ⭐ ${r?.best?.name ?? "—"}`);
}
const aw = c.lastSeasonAwardStats;
const own = compHistoryFor(c, "Premier League")[0];
ok(!aw?.playerOfSeason || own?.best?.name === aw.playerOfSeason.name, `your league's player of the season is the Season Awards' (${aw?.playerOfSeason?.name})`);
console.log(`international editions kept: ${(c.intlHistory ?? []).map(e => `${e.comp} ${e.year} ⚽ ${e.scorers.map(x => x.name).join(", ")} ⭐ ${e.best?.name ?? "—"}`).join(" | ") || "none yet"}`);

console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
