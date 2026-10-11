import { buildLeagueSquad, growWonderkids, averageStartingXIRating, type RosterRow } from "../../lib/star/leagueSquads";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import {
  ageLeagueSquads, ageOwnSquad, catchUpFetchedSquads, isRegenId, ageFetchedForCareer, ageOwnFetchedForCareer, retirementAgeFor, makeRegen, startingAgeFor,
} from "../../lib/star/worldAgeing";
import { mulberry32 } from "../../lib/star/season";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, CHAMPIONS_LEAGUE_CLUBS, LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS,
} from "../../lib/star/clubs";
import { encodeSquads, decodeSquads, hydrateSquads, rememberFetchedSquads, forgetFetchedSquads } from "../../lib/star/squadSaveCodec";
import type { CareerState, LeagueSquad, SquadPlayer, StarPlayer } from "../../lib/star/types";

/**
 * A WORLD THAT AGES — and stays the same size and strength while it does.
 *
 * The squads here are synthetic (this machine cannot reach the database),
 * built to look like a real one: 26 men a club, ages 17–36 peaking at 24–28,
 * young players rated below the senior ones, the six stats around the
 * overall. The lower leagues use the game's own invented squads (no ages).
 * Twenty rollovers each way:
 *   BEFORE — what advanceSeason did before this: growWonderkids only.
 *   AFTER  — growWonderkids then ageLeagueSquads, as advanceSeason does now.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const POS_MIX = ["GK", "GK", "GK", "CB", "CB", "CB", "CB", "LB", "LB", "RB", "RB", "CDM", "CDM", "CM", "CM", "CM",
  "CAM", "CAM", "LW", "LW", "RW", "RW", "ST", "ST", "ST", "CM"];

function syntheticRoster(club: string, level: number, seed: number): RosterRow[] {
  const rng = mulberry32(seed);
  return POS_MIX.map((pos, i) => {
    // Real senior squads: most men 22–31, a few kids, a few veterans.
    const r = rng();
    const age = r < 0.12 ? 17 + Math.floor(rng() * 4) : r < 0.88 ? 21 + Math.floor(rng() * 11) : 32 + Math.floor(rng() * 5);
    const youthPenalty = age < 23 ? (23 - age) * 2 : 0;
    const vetPenalty = age > 31 ? (age - 31) * 1.5 : 0;
    const overall = Math.round(level - youthPenalty - vetPenalty + (rng() - 0.5) * 10 - (i % 3));
    const st = (b: number) => Math.max(25, Math.min(99, Math.round(overall + b + (rng() - 0.5) * 12)));
    return {
      id: `${club.replace(/\W/g, "").slice(0, 6)}${seed % 1000}_${i}`, name: `${club} ${i}`, positions: pos,
      overall, age, nation: "England", image: `/x/${i}.png`,
      ...(rng() < 0.03 && age < 21 ? { highPotential: true } : {}),
      pace: st(age > 30 ? -6 : 2), shooting: st(0), passing: st(0), dribbling: st(0), defending: st(-4), physical: st(0),
    };
  });
}

function world(): Record<string, LeagueSquad[]> {
  const make = (clubs: readonly string[], lo: number, hi: number, salt: number) =>
    clubs.map((c, i) => buildLeagueSquad(c, syntheticRoster(c, hi - (hi - lo) * (i / Math.max(1, clubs.length - 1)), salt + i * 31), true));
  return {
    premier: make(PREMIER_LEAGUE_CLUBS, 74, 84, 1000),
    championship: make(CHAMPIONSHIP_CLUBS, 66, 73, 2000),
    europe: make(CHAMPIONS_LEAGUE_CLUBS.filter(c => !PREMIER_LEAGUE_CLUBS.includes(c)), 72, 86, 3000),
    // The game's own invented squads, exactly as an empty fetch builds them.
    league_one: LEAGUE_ONE_CLUBS.map(c => buildLeagueSquad(c, [])),
    league_two: LEAGUE_TWO_CLUBS.map(c => buildLeagueSquad(c, [])),
  };
}

const SEASONS = Number(process.env.AGE_SEASONS) || 20;
const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const xiAvg = (sq: LeagueSquad[]) => avg(sq.map(s => averageStartingXIRating(s) ?? 0).filter(Boolean));
const ageAvg = (sq: LeagueSquad[]) => avg(sq.flatMap(s => s.players.map(p => p.age ?? NaN)).filter(n => !Number.isNaN(n)));
const players = (sq: LeagueSquad[]) => sq.reduce((n, s) => n + s.players.length, 0);

type Row = { season: number; xi: Record<string, number>; age: number; original: number; size: number };

function run(ageing: boolean): { rows: Row[]; final: Record<string, LeagueSquad[]>; start: Record<string, LeagueSquad[]> } {
  const start = world();
  let w = start;
  const originalIds = new Set(Object.values(start).flatMap(sq => sq.flatMap(s => s.players.map(p => p.id))));
  const rows: Row[] = [];
  const snap = (season: number) => {
    const all = Object.values(w).flat();
    const ids = all.flatMap(s => s.players.map(p => p.id));
    rows.push({
      season,
      xi: Object.fromEntries(Object.entries(w).map(([k, v]) => [k, xiAvg(v)])),
      age: ageAvg(all),
      original: ids.filter(id => originalIds.has(id)).length / ids.length,
      size: players(all),
    });
  };
  snap(1);
  let levels: Record<string, number> = {};
  for (let season = 1; season <= SEASONS; season++) {
    const next: Record<string, LeagueSquad[]> = {};
    for (const [k, sq] of Object.entries(w)) {
      let s = growWonderkids(sq, mulberry32(season * 71923 + 5));
      if (ageing) { const r = ageLeagueSquads(s, season, undefined, levels); s = r.squads; levels = r.clubLevels; }
      next[k] = s;
    }
    w = next;
    if ((season + 1) % 5 === 1 || season === SEASONS) snap(season + 1);
  }
  return { rows, final: w, start };
}

const before = run(false);
const after = run(true);

const fmt = (n: number) => n.toFixed(1).padStart(5);
console.log("\nAverage starting-XI rating by division, average age (all players), share of day-one players left");
console.log("season | premier champ  europe  L1     L2    | age   | original | players");
for (const [label, r] of [["BEFORE", before], ["AFTER", after]] as const) {
  console.log(label);
  for (const row of r.rows) {
    console.log(`  ${String(row.season).padStart(2)}   | ${fmt(row.xi.premier)} ${fmt(row.xi.championship)} ${fmt(row.xi.europe)} ${fmt(row.xi.league_one)} ${fmt(row.xi.league_two)} | ${fmt(row.age)} | ${(row.original * 100).toFixed(0).padStart(5)}%   | ${row.size}`);
  }
}

// ── The world stays the same size and strength ──
{
  const first = after.rows[0], last = after.rows[after.rows.length - 1];
  for (const k of Object.keys(first.xi)) {
    const drift = Math.max(...after.rows.map(r => Math.abs(r.xi[k] - first.xi[k])));
    check(drift <= 3, `${k}: starting-XI average stays within 3 of day one over 20 seasons (worst drift ${drift.toFixed(1)})`);
  }
  check(first.xi.premier > first.xi.championship + 4 && last.xi.premier > last.xi.championship + 4,
    `the Premier League stays clearly stronger than the Championship (${last.xi.premier.toFixed(1)} v ${last.xi.championship.toFixed(1)})`);
  check(last.xi.league_one > last.xi.league_two, "League One stays stronger than League Two");
  check(last.size === first.size, `squad sizes do not change (${first.size} → ${last.size})`);
  check(last.age >= 23.5 && last.age <= 28, `average age stays football-shaped (${last.age.toFixed(1)})`);
  check(last.original < 0.15, `after 20 seasons most of day one has retired (${(last.original * 100).toFixed(0)}% left)`);
  check(after.rows[1].original > 0.75, `but after 5 most are still there (${(after.rows[1].original * 100).toFixed(0)}%)`);
  // Positions stay covered: every club still has a keeper in its first eleven.
  const noKeeper = Object.values(after.final).flat().filter(s => s.players.length && !s.players.slice(0, 11).some(p => p.position === "GK"));
  check(noKeeper.length === 0, `every club still starts a keeper (${noKeeper.map(s => s.club).join(", ")})`);
  // Same position mix as day one, club by club.
  const mixOf = (s: LeagueSquad) => s.players.map(p => p.position).sort().join(",");
  const startBy = new Map(Object.values(after.start).flat().map(s => [s.club, mixOf(s)]));
  const changed = Object.values(after.final).flat().filter(s => startBy.get(s.club) !== mixOf(s));
  check(changed.length === 0, `every club keeps its position mix (${changed.length} changed)`);
  // Nobody is past 41, nobody under 16.
  const ages = Object.values(after.final).flat().flatMap(s => s.players.map(p => p.age ?? 25));
  check(Math.max(...ages) <= 41 && Math.min(...ages) >= 16, `ages stay 16–41 (${Math.min(...ages)}–${Math.max(...ages)})`);
  // Ids stay unique across the world.
  const ids = Object.values(after.final).flat().flatMap(s => s.players.map(p => p.id));
  check(new Set(ids).size === ids.length, "no player id appears twice in the world");
}

// ── Before: nothing moved but wonderkids ──
{
  const last = before.rows[before.rows.length - 1];
  check(last.original === 1 && Math.abs(last.age - before.rows[0].age) < 0.01, "before: nobody aged or left (the old behaviour)");
}

// ── The age curve, one man at a time ──
{
  const sq = (age: number, overall: number, n: number): LeagueSquad => ({ club: "Test FC", players: Array.from({ length: n }, (_, i) => ({
    id: `t${age}_${i}`, name: `T ${i}`, position: "CM", overall, goals: 0, assists: 0, age,
    pace: overall, shooting: overall, passing: overall, dribbling: overall, defending: overall, physical: overall,
  })) });
  const change = (age: number, overall: number, tier: 1 | 2 | 3 = 2) => {
    const s = sq(age, overall, 400);
    const out = ageLeagueSquads([s], 3, () => tier, { "Test FC": 76 }).squads[0].players.filter(p => !isRegenId(p.id));
    return avg(out.map(p => p.overall - overall));
  };
  check(change(18, 62) > 2.5, `an 18-year-old 62 grows (${change(18, 62).toFixed(2)})`);
  check(change(18, 62, 3) > change(18, 62, 1) + 1, `a better training ground grows him faster (tier 3 ${change(18, 62, 3).toFixed(2)} v tier 1 ${change(18, 62, 1).toFixed(2)})`);
  check(change(19, 84) < change(19, 62), "growth slows near the top");
  check(Math.abs(change(27, 75)) < 0.4, `a 27-year-old holds (${change(27, 75).toFixed(2)})`);
  check(change(31, 75) < -0.8, `a 31-year-old declines (${change(31, 75).toFixed(2)})`);
  check(change(34, 75) < change(31, 75) - 1, `faster after 33 (${change(34, 75).toFixed(2)})`);
  // Pace goes first.
  const old = ageLeagueSquads([sq(31, 75, 200)], 3).squads[0].players.filter(p => !isRegenId(p.id));
  check(avg(old.map(p => p.pace! - p.overall)) < -0.5, "an old man's pace falls faster than his rating");
  check(Math.abs(avg(old.map(p => p.passing! - p.overall))) < 0.01, "his passing moves with his rating");
  // Everyone a year older.
  check(old.every(p => p.age === 32), "everyone is a year older");
}

// ── Retirement: rising from 33, done by 40 (42 for a keeper) ──
{
  const ages = Array.from({ length: 4000 }, (_, i) => retirementAgeFor(`r${i}`, "CM"));
  const share = (a: number) => ages.filter(x => x <= a).length / ages.length;
  check(Math.min(...ages) === 33 && Math.max(...ages) === 40, "outfield players retire at 33–40");
  check(share(34) < 0.3 && share(36) > 0.5 && share(38) > 0.9, `rising chance (≤34 ${share(34).toFixed(2)}, ≤36 ${share(36).toFixed(2)}, ≤38 ${share(38).toFixed(2)})`);
  const gk = Array.from({ length: 1000 }, (_, i) => retirementAgeFor(`r${i}`, "GK"));
  check(avg(gk) > avg(ages.slice(0, 1000)) + 1.5, "keepers go on longer");
  check(retirementAgeFor("x1", "CM") === retirementAgeFor("x1", "CM"), "a man's retirement age is fixed");
}

// ── Regens ──
{
  const r = makeRegen("123", 4, 80);
  check(r.age >= 16 && r.age <= 19, `a regen is 16–19 (${r.age})`);
  check(r.overall < 80 && r.overall > 55, `rated below the club's level (${r.overall} at a club of 80)`);
  check(makeRegen("123", 4, 80).name === r.name && makeRegen("123", 4, 80).id === r.id, "the same boy every time");
  const low = makeRegen("123", 4, 55);
  check(low.overall < r.overall, "a lower club's regen is rated lower");
  check(startingAgeFor("gen:A:1") >= 20 && startingAgeFor("gen:A:1") <= 32, "an invented player gets an age 20–32");
}

// ── Your own team-mates: the same rolls as your club's league copy ──
{
  const roster = syntheticRoster("Own FC", 78, 9);
  const league = buildLeagueSquad("Own FC", roster, true);
  const own: SquadPlayer[] = league.players.map(p => ({
    id: `sf_${p.id}`, sofifaId: p.id, name: p.name, shortName: p.name, position: p.position,
    seasonGoals: 3, seasonAssists: 1, careerGoals: 10, careerAssists: 4, overall: p.overall, age: p.age,
  }));
  let l = [league];
  let o = own;
  let levels: Record<string, number> = {};
  for (let s = 1; s <= 12; s++) {
    const r = ageLeagueSquads(l, s, undefined, levels);
    l = r.squads; levels = r.clubLevels;
    o = ageOwnSquad(o, "Own FC", s, levels["Own FC"]).squad;
  }
  const keyOf = (p: SquadPlayer) => p.sofifaId ?? p.id;
  const leagueIds = new Set(l[0].players.map(p => p.id));
  const ownIds = new Set(o.map(keyOf));
  check(ownIds.size === leagueIds.size && Array.from(ownIds).every(id => leagueIds.has(id)),
    "after 12 seasons your team-mates and your club's league copy are the same men");
  const byId = new Map(l[0].players.map(p => [p.id, p]));
  check(o.every(p => byId.get(keyOf(p))?.age === p.age && byId.get(keyOf(p))?.overall === p.overall),
    "…at the same ages and ratings");
  check(o.length === own.length, "your squad stays the same size");
  check(o.filter(p => isRegenId(p.id)).every(p => !!p.imageUrl && p.careerGoals === 0),
    "a regen in your squad has a (fake) face and no goals yet");
  // Generated team-mates (no overall) still age and retire.
  const gen = ageOwnSquad([{ id: "sp_1", name: "A B", shortName: "B", position: "ST", seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0, age: 40 }], "Gen FC", 1, 60).squad;
  check(gen.length === 1 && isRegenId(gen[0].id) && gen[0].overall === undefined, "an unrated invented squad stays unrated");
  // The son is never aged or retired.
  const son = ageOwnSquad([{ id: "son:Kid:Own FC", name: "Kid", shortName: "Kid", position: "ST", seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0, age: 45, overall: 70 }], "Own FC", 1, 70).squad;
  check(son[0].id === "son:Kid:Own FC" && son[0].age === 45, "your son is left alone");
}

// ── A squad fetched in season 9 matches one that lived through it ──
{
  const fresh = [buildLeagueSquad("Late FC", syntheticRoster("Late FC", 76, 77), true)];
  let lived = fresh;
  let levels: Record<string, number> = {};
  for (let s = 1; s <= 8; s++) { const r = ageLeagueSquads(lived, s, undefined, levels); lived = r.squads; levels = r.clubLevels; }
  const caught = ageFetchedForCareer({ season: 9, worldAgedSince: 1, clubLevels: levels }, fresh);
  check(JSON.stringify(caught) === JSON.stringify(lived), "catch-up gives exactly the squad that lived through the seasons");
  check(ageFetchedForCareer({ season: 1, worldAgedSince: 1 }, fresh) === fresh, "season 1 needs no catch-up");
  check(ageFetchedForCareer({ season: 9 }, fresh) === fresh, "a save whose world never aged gets no catch-up");
  const fromFive = catchUpFetchedSquads(fresh, 5, 8);
  check(fromFive[0].players.every(p => fresh[0].players.find(f => f.id === p.id) ? p.age === (fresh[0].players.find(f => f.id === p.id)!.age! + 4) : true),
    "a save that started ageing in season 5 catches up four seasons, not eight");
  // Your own team-mates, refetched after a transfer, match the club's aged copy.
  const own: SquadPlayer[] = fresh[0].players.map(p => ({
    id: `sf_${p.id}`, sofifaId: p.id, name: p.name, shortName: p.name, position: p.position,
    seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0, overall: p.overall, age: p.age,
  }));
  const ownAged = ageOwnFetchedForCareer({ season: 9, worldAgedSince: 1, clubLevels: levels }, "Late FC", own);
  const livedIds = new Set(lived[0].players.map(p => p.id));
  check(ownAged.every(p => livedIds.has(p.sofifaId ?? p.id)) && ownAged.length === own.length,
    "a refetched dressing room after a transfer has the same men as the club's aged copy");
}

// ── Save size: the thin save codec, 20 seasons on ──
{
  const sizeOf = (w: Record<string, LeagueSquad[]>) => JSON.stringify(encodeSquads(Object.values(w).flat())).length / 1024;
  forgetFetchedSquads();
  // What the database gave, as a real fetch registers it (lower leagues are
  // invented and never registered — they are saved whole either way).
  rememberFetchedSquads([...before.start.premier, ...before.start.championship, ...before.start.europe]);
  const kb0 = sizeOf(before.start), kbBefore = sizeOf(before.final), kbAfter = sizeOf(after.final);
  console.log(`\nSaved squads (thin codec): day one ${kb0.toFixed(0)} KB · season 21 before ${kbBefore.toFixed(0)} KB · after ${kbAfter.toFixed(0)} KB`);
  check(kbAfter < kb0 * 1.6, `the saved squads grow by less than 60% over 20 seasons (${kb0.toFixed(0)} → ${kbAfter.toFixed(0)} KB)`);
  // Five seasons in (the peak: nearly every real man aged, few retired yet)
  // the stat shift keeps it small, and reads back exactly.
  let five = [...before.start.premier, ...before.start.championship, ...before.start.europe];
  let lv: Record<string, number> = {};
  for (let s = 1; s <= 5; s++) { const r = ageLeagueSquads(five, s, undefined, lv); five = r.squads; lv = r.clubLevels; }
  const enc = encodeSquads(five);
  const kb5 = JSON.stringify(enc).length / 1024;
  const kbStart = JSON.stringify(encodeSquads([...before.start.premier, ...before.start.championship, ...before.start.europe])).length / 1024;
  console.log(`Saved real squads at their peak (season 6): ${kbStart.toFixed(0)} → ${kb5.toFixed(0)} KB`);
  check(kb5 < kbStart * 1.6, `at the peak the real squads grow by under 60% (${kbStart.toFixed(0)} → ${kb5.toFixed(0)} KB)`);
  const back = hydrateSquads(decodeSquads(JSON.parse(JSON.stringify(enc))));
  check(JSON.stringify(back) === JSON.stringify(five.map(s => ({ club: s.club, players: s.players.map(p => {
    // decode puts the core fields first; compare field by field instead of order
    return p;
  }) }))) || back.every((s, i) => s.players.every((p, j) => {
    const o = five[i].players[j] as unknown as Record<string, unknown>;
    const q = p as unknown as Record<string, unknown>;
    return Object.keys(o).every(k => JSON.stringify(o[k]) === JSON.stringify(q[k])) && !("sd" in q);
  })), "aged squads come back from the save exactly (stats from the shift)");
  // Read back before any fetch: no stats yet, the shift is kept for later.
  forgetFetchedSquads();
  const offline = decodeSquads(JSON.parse(JSON.stringify(enc)));
  const reenc = JSON.stringify(encodeSquads(offline));
  check(reenc === JSON.stringify(enc), "a save opened offline writes the same squads back");
  forgetFetchedSquads();
}

// ── Through the real rollover (advanceSeason) ──
{
  const playerAt = (club: string): StarPlayer => ({
    firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer);
  const you = PREMIER_LEAGUE_CLUBS[4];
  let career: CareerState = makeInitialCareer(playerAt(you), [...PREMIER_LEAGUE_CLUBS], "premier");
  const w = world();
  const ownLeague = w.premier.find(s => s.club === you)!;
  career = {
    ...career,
    leagueSquads: w.premier,
    externalSquads: [...w.championship, ...w.europe, ...w.league_one],
    squad: ownLeague.players.map(p => ({
      id: `sf_${p.id}`, sofifaId: p.id, name: p.name, shortName: p.name, position: p.position,
      seasonGoals: 2, seasonAssists: 1, careerGoals: 2, careerAssists: 1, overall: p.overall, age: p.age,
    })),
  };
  const day1 = career;
  const t0 = Date.now();
  for (let s = 1; s <= 5; s++) career = advanceSeason(career, false).career;
  const ms = Date.now() - t0;
  check(career.worldAgedSince === 1, `the world starts ageing at the first rollover (${career.worldAgedSince})`);
  check(Object.keys(career.clubLevels ?? {}).length >= 60, `club levels are kept (${Object.keys(career.clubLevels ?? {}).length})`);
  const before = new Map([...(day1.leagueSquads ?? []), ...(day1.externalSquads ?? [])].flatMap(s => s.players.map(p => [p.id, p] as const)));
  const survivors = [...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])].flatMap(s => s.players).filter(p => typeof before.get(p.id)?.age === "number");
  check(survivors.length > 0 && survivors.every(p => p.age === (before.get(p.id)!.age ?? 0) + 5),
    `every survivor is five years older after five rollovers (${survivors.length} survivors)`);
  const worldNow = [...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])];
  check(worldNow.flatMap(s => s.players).some(p => isRegenId(p.id)), "regens have arrived");
  check(players(worldNow) === players([...(day1.leagueSquads ?? []), ...(day1.externalSquads ?? [])]), "the world's head count is unchanged");
  // League strengths are read off the aged squads.
  const byClub = new Map((career.leagueSquads ?? []).map(s => [s.club, averageStartingXIRating(s)]));
  check(career.league.every(t => !byClub.has(t.name) || byClub.get(t.name) === t.strength), "club strengths are re-synced to the aged squads");
  // Your team-mates age with your club's copy, and keep their career tallies.
  const ownNow = [...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])].find(s => s.club === career.player.club);
  if (career.player.club === you && ownNow) {
    const ids = new Set(ownNow.players.map(p => p.id));
    check(career.squad.every(p => ids.has(p.sofifaId ?? p.id)), "your team-mates are the same men as your club's copy");
  }
  check(career.squad.length === day1.squad.length, "your squad is the same size");
  check(career.squad.filter(p => !isRegenId(p.id)).every(p => p.careerGoals === 2 && p.seasonGoals === 0),
    "team-mates keep their career goals; season tallies reset");
  console.log(`\nadvanceSeason ×5 with ${players(worldNow)} players: ${ms} ms`);
}

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("\nworldAgeing: all checks passed");
