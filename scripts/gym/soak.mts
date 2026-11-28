/**
 * THE GYM'S CAREER EFFECT, ON vs OFF (gym phase 2). The same careers played twice, every match settled by
 * "Sim this match" (simMatch.ts: your chances rolled against your skills, so Power and Pace count), with a
 * gym visit before most matches (three exercises, one of them Resilience work, a decent grade). Once with the
 * flag as it is (OFF), once as "mix" (option C). Prints what changes: goals, assists, ratings, energy at
 * kick-off and at the whistle, how often you were picked, the bonus it gave. Run:
 *   npx tsx scripts/gym/soak.mts [seasons=3] [divisions=premier,championship,league_two]
 */
import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import * as C from "../../lib/star/clubs";
import { nextFixtureFor } from "../../lib/star/competitions";
import { simulateOwnMatch } from "../../lib/star/simMatch";
import { selectionFor } from "../../lib/star/selection";
import { setPieceDuties } from "../../lib/star/setPieces";
import { projectedEnergy } from "../../lib/star/week";
import { gymExercise, gymOf, levelOf } from "../../lib/star/gym/progress";
import { setGymEffectForTest, gymSkillBonus } from "../../lib/star/gym/effect";
import type { CareerState, StarPlayer, CareerDivision } from "../../lib/star/types";
import type { GymGameKind } from "../../lib/star/gym/games";

const SEASONS = Number(process.argv[2] ?? 3);
const DIVS = (process.argv[3] ?? "premier,championship,league_two").split(",") as CareerDivision[];
const CLUBS: Record<string, readonly string[]> = { premier: C.PREMIER_LEAGUE_CLUBS, championship: C.CHAMPIONSHIP_CLUBS, league_one: C.LEAGUE_ONE_CLUBS, league_two: C.LEAGUE_TWO_CLUBS };
/** The week's three, round and round (two kinds of training each time, so the ring closes). */
const ROUTINE: GymGameKind[][] = [["pullup", "treadmill", "nordic"], ["squat", "ladder", "copenhagen"], ["bench", "boxjump", "mobility"], ["pushup", "treadmill", "landing"]];

interface Tally { matches: number; played: number; goals: number; assists: number; rating: number; kickoff: number; whistle: number; injuries: number; power: number; pace: number; resil: number; problems: number }

function run(mode: "off" | "mix"): Tally {
  setGymEffectForTest(mode === "off" ? null : "mix");
  const t: Tally = { matches: 0, played: 0, goals: 0, assists: 0, rating: 0, kickoff: 0, whistle: 0, injuries: 0, power: 0, pace: 0, resil: 0, problems: 0 };
  for (const div of DIVS) {
    for (const pick of [0, 7, 15]) {
      const clubs = CLUBS[div];
      const p = { firstName: "Gym", lastName: "Soak", age: 19, skinTone: "light", club: clubs[pick % clubs.length], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
      let c: CareerState = makeInitialCareer(p, [...clubs], div);
      // a grown player, so he plays
      c = { ...c, skills: { ...c.skills, pace: 72, power: 72, technique: 72, vision: 70 } };
      let gap = 0;
      for (let s = 1; s <= SEASONS; s++) {
        let g = 0;
        while (g++ < 250) {
          const next = nextFixtureFor(c);
          if (!next) break;
          // the gym, before most matches (not one in five: a real player misses some)
          if (++gap % 5 !== 0) {
            const day = ROUTINE[gap % ROUTINE.length];
            for (const kind of day) c = gymExercise(c, { kind, quality: 0.72 + 0.2 * (((gap * 7 + kind.length) % 5) / 5) }).career;
          }
          const readied: CareerState = { ...c, weekActions: 0, energy: projectedEnergy(c) };
          const sel = selectionFor(readied);
          const bonus = gymSkillBonus(readied);
          const bootOn = readied.currentBoot.matches > 0;
          let stats;
          try {
            stats = simulateOwnMatch(readied, next, { selection: sel, duties: setPieceDuties(readied, sel.status), skills: { power: Math.min(100, readied.skills.power + (bootOn ? readied.currentBoot.power : 0)), technique: Math.min(100, readied.skills.technique + (bootOn ? readied.currentBoot.technique : 0)) } });
          } catch { t.problems++; break; }
          t.matches++;
          if ((stats.minutes ?? 0) > 0) {
            t.played++; t.goals += stats.goals; t.assists += stats.assists; t.rating += stats.rating;
            t.kickoff += readied.energy; t.whistle += stats.endEnergy ?? readied.energy;
            t.power += bonus.power; t.pace += bonus.pace;
          }
          const had = !!readied.injury;
          try { c = creditMatchResult(readied, next, stats).career; } catch { t.problems++; break; }
          if (!had && c.injury) t.injuries++;
          if (!Number.isFinite(c.energy) || c.energy < 0 || c.energy > 100) t.problems++;
        }
        try { c = advanceSeason(c, false).career; } catch { t.problems++; break; }
      }
      t.resil += levelOf(gymOf(c).points.resilience);
    }
  }
  setGymEffectForTest(null);
  return t;
}

const t0 = Date.now();
const off = run("off"), on = run("mix");
const per = (t: Tally, k: keyof Tally, by: "played" | "matches" = "played") => (t[k] as number) / Math.max(1, t[by]);
const row = (name: string, a: number, b: number, d = 2) => console.log(`${name.padEnd(28)} ${a.toFixed(d).padStart(8)} ${b.toFixed(d).padStart(8)}   ${(b - a >= 0 ? "+" : "") + (b - a).toFixed(d)}`);
console.log(`${DIVS.length * 3} careers x ${SEASONS} seasons, ${off.matches} matches each way, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(`${"".padEnd(28)} ${"OFF".padStart(8)} ${"ON".padStart(8)}   change`);
row("matches played (share)", per(off, "played", "matches"), per(on, "played", "matches"), 3);
row("goals per match played", per(off, "goals"), per(on, "goals"), 3);
row("assists per match played", per(off, "assists"), per(on, "assists"), 3);
row("rating per match played", per(off, "rating"), per(on, "rating"), 3);
row("energy at kick-off", per(off, "kickoff"), per(on, "kickoff"), 1);
row("energy at the whistle", per(off, "whistle"), per(on, "whistle"), 1);
row("gym Power bonus (average)", per(off, "power"), per(on, "power"), 2);
row("gym Pace bonus (average)", per(off, "pace"), per(on, "pace"), 2);
row("Resilience level at the end", off.resil / (DIVS.length * 3), on.resil / (DIVS.length * 3), 2);
console.log(`problems: off ${off.problems}, on ${on.problems} (injuries are switched off in the game: ${off.injuries}/${on.injuries})`);
