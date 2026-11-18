/**
 * A player's season at every club, played many times (Mikey, 16 Nov 2026: "simulate a player, for example Vinicius Junior,
 * at different clubs ... what the best season would be and at which club").
 *   npx tsx tools/video-render/twin/model/sim_season.mts IN.json OUT.json [runs]
 * IN (from next_club.py): clubs [{id, name, league, s (strength), sWith (strength with him in the eleven)}], cands [ids],
 *   player {goalShare, assistShare, avail}, cl {places: {league: n}}.
 * Each run, for one candidate club: its league's double round-robin, every match scored by the game's own
 * season.ts simulateFixtureScore (the Road to Ballon d'Or league model, its home advantage and tuning); the club uses
 * sWith, every other club its own s. Finish in the top places = a Champions League season (simplified: the same season):
 * 8 league-phase games against clubs from the 36 strongest, 16+ points = last 16, 11-15 = a two-legged play-off, then
 * two-legged ties against the 16 strongest, a one-off final on neutral ground (no home advantage); a level tie = a coin toss.
 * His goals: each team goal is his with chance goalShare (his real share of his club's goals), if he plays (avail);
 * assists the same from the goals left. Writes, per club: title %, top-places %, average finish, Champions League stage %,
 * his average goals and assists, and the best run of all (most trophies, then goals) with every goal he scored in it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { simulateFixtureScore, mulberry32 } from "../../../../lib/star/season";
import { getTuning } from "../../../../lib/star/tuningStore";

type Club = { id: string; name: string; league: number; s: number; sWith?: number };
const IN = JSON.parse(readFileSync(process.argv[2], "utf8"));
const RUNS = Number(process.argv[4] ?? 400);
const clubs: Club[] = IN.clubs;
const byLeague = new Map<number, Club[]>();
for (const c of clubs) byLeague.set(c.league, [...(byLeague.get(c.league) ?? []), c]);
const HOME = getTuning("leagueSim.homeAdvantage");
const top36 = [...clubs].sort((a, b) => b.s - a.s).slice(0, 36);
const top16 = top36.slice(0, 16);
const P = IN.player as { goalShare: number; assistShare: number; avail: number };
type Goal = { comp: string; round: string; opp: string; home: boolean; score: string; minute: number };

function season(cand: Club, rng: () => number) {
  const goals: Goal[] = []; let assists = 0;
  const mine = (comp: string, round: string, opp: Club, home: boolean, us: number, them: number) => {
    if (rng() > P.avail) return;
    let left = us;
    for (let g = 0; g < us; g++) if (rng() < P.goalShare) { goals.push({ comp, round, opp: opp.name, home, score: `${us}-${them}`, minute: 1 + Math.floor(rng() * 90) }); left--; }
    for (let g = 0; g < left; g++) if (rng() < P.assistShare) assists++;
  };
  // the league
  const L = byLeague.get(cand.league)!; const pts = new Map<string, number>(), gd = new Map<string, number>();
  const str = (c: Club) => (c.id === cand.id ? cand.sWith! : c.s);
  for (const h of L) for (const a of L) {
    if (h === a) continue;
    const r = simulateFixtureScore(str(h), str(a), rng);
    const add = (c: Club, f: number, ag: number) => { pts.set(c.id, (pts.get(c.id) ?? 0) + (f > ag ? 3 : f === ag ? 1 : 0)); gd.set(c.id, (gd.get(c.id) ?? 0) + f - ag); };
    add(h, r.home, r.away); add(a, r.away, r.home);
    if (h.id === cand.id) mine("League", "League", a, true, r.home, r.away);
    if (a.id === cand.id) mine("League", "League", h, false, r.away, r.home);
  }
  const table = [...L].sort((x, y) => (pts.get(y.id)! - pts.get(x.id)!) || (gd.get(y.id)! - gd.get(x.id)!) || (rng() - 0.5));
  const pos = table.findIndex(c => c.id === cand.id) + 1;
  // the Champions League
  let cl = "none";
  const places = IN.cl.places[cand.league] ?? 4;
  if (pos <= places) {
    cl = "league phase";
    const s = cand.sWith!; const pool = top36.filter(c => c.id !== cand.id && c.league !== cand.league);   // no club from his own league in the league phase
    const pick = (from: Club[]) => from[Math.floor(rng() * from.length)];
    let p8 = 0;
    for (let i = 0; i < 8; i++) {
      const o = pick(pool), home = i % 2 === 0;
      const r = home ? simulateFixtureScore(s, o.s, rng) : simulateFixtureScore(o.s, s, rng);
      const us = home ? r.home : r.away, them = home ? r.away : r.home;
      p8 += us > them ? 3 : us === them ? 1 : 0; mine("Champions League", "League phase", o, home, us, them);
    }
    const tie = (round: string, o: Club) => {   // two legs; level = a coin toss
      const a = simulateFixtureScore(s, o.s, rng), b = simulateFixtureScore(o.s, s, rng);
      mine("Champions League", round, o, true, a.home, a.away); mine("Champions League", round, o, false, b.away, b.home);
      const us = a.home + b.away, them = a.away + b.home; return us > them || (us === them && rng() < 0.5);
    };
    let alive = p8 >= 16 || (p8 >= 11 && tie("Knockout play-off", pick(pool)));
    if (alive) {
      for (const round of ["Round of 16", "Quarter-final", "Semi-final"]) {
        cl = round; const o = pick(top16.filter(c => c.id !== cand.id));
        if (!tie(round, o)) { alive = false; break; }
      }
      if (alive) {
        cl = "Final"; const o = pick(top16.filter(c => c.id !== cand.id).slice(0, 8));
        const r = simulateFixtureScore(s - HOME, o.s, rng);   // neutral ground: no home advantage
        mine("Champions League", "Final", o, true, r.home, r.away);
        if (r.home > r.away || (r.home === r.away && rng() < 0.5)) cl = "Winners";
      }
    }
  }
  return { pos, n: L.length, pts: pts.get(cand.id)!, cl, goals, assists };
}

const STAGES = ["none", "league phase", "Knockout play-off", "Round of 16", "Quarter-final", "Semi-final", "Final", "Winners"];
const out: Record<string, unknown> = {};
for (const id of IN.cands as string[]) {
  const cand = clubs.find(c => c.id === id)!; const rng = mulberry32(Number(id) * 7919 + 17);
  let title = 0, top = 0, posSum = 0, g = 0, a = 0; const cl: Record<string, number> = {}; let best: ReturnType<typeof season> | null = null, bestKey = -1;
  for (let r = 0; r < RUNS; r++) {
    const x = season(cand, rng);
    if (x.pos === 1) title++; if (x.pos <= (IN.cl.places[cand.league] ?? 4)) top++; posSum += x.pos; g += x.goals.length; a += x.assists; cl[x.cl] = (cl[x.cl] ?? 0) + 1;
    const finalGoal = x.goals.some(q => q.round === "Final");   // a goal in the final makes the best highlights
    const key = (x.pos === 1 ? 1000 : 0) + (x.cl === "Winners" ? 1000 : 0) + (finalGoal ? 500 : 0) + STAGES.indexOf(x.cl) * 10 + x.goals.length;
    if (key > bestKey) { bestKey = key; best = x; }
  }
  out[id] = { name: cand.name, runs: RUNS, title: title / RUNS, top: top / RUNS, avgPos: posSum / RUNS, goals: g / RUNS, assists: a / RUNS,
              clWin: (cl["Winners"] ?? 0) / RUNS, clFinal: ((cl["Final"] ?? 0) + (cl["Winners"] ?? 0)) / RUNS, cl: Object.fromEntries(Object.entries(cl).map(([k, v]) => [k, v / RUNS])), best };
}
writeFileSync(process.argv[3], JSON.stringify(out));
console.log("simulated", (IN.cands as string[]).length, "clubs x", RUNS, "seasons");
