/**
 * FIVE-A-SIDE NUMBERS — what hundreds of simulated five-a-side matches add up to.
 *
 * Harry, 19 Oct 2026: "Five-a-side: it has scenarios, it has its data…" The
 * matches are played by scripts/fiveaside-data/ with the real five-a-side code
 * (the same flow, chance builders and match bookkeeping as FiveASide.tsx, and
 * the engine's own launch/stepBall for every kick). A bot stands in for your
 * thumb. That script writes simData.json; the Data tab of /star-fiveaside-dev
 * reads it.
 *
 * This file is pure: the record of one match, and the sum of many. No physics.
 */

export type FiveSimWho = "you" | "mate" | "them";

/** One engine chance in a simulated match. */
export interface FiveSimChance {
  who: FiveSimWho;
  /** The engine's chance kind: one_on_one, tight_angle, midfield_pass… */
  kind: string;
  outcome: string;
  /** Your touch only: did the bot shoot or pass? */
  how?: "shot" | "pass";
  /** Your touch only: a team-mate finished your pass. */
  assist?: boolean;
}

/** One simulated match. */
export interface FiveSimMatch {
  seed: number;
  difficulty: number;
  score: [number, number];
  goals: {
    /** Your own shot went in. */
    you: number;
    /** A team-mate finished your pass (an engine goal off your touch). */
    assist: number;
    /** A team-mate's chance you watched, through the engine. */
    mateWatched: number;
    /** A team-mate's goal the match rolled (a caption, no engine). */
    mateRolled: number;
    /** Their chance, played out through the engine. */
    themWatched: number;
  };
  /** Chances the match rolled as captions (misses and team-mate goals). */
  rolled: { mate: number; them: number };
  chances: FiveSimChance[];
  /** Beats of the match each side had the ball (a beat is half a minute). */
  beats: { you: number; them: number };
  /** Longest unbroken spell on the ball, in beats. */
  longestSpell: { you: number; them: number };
  /** Kicks the engine never finished (the ball still live after 20 s). A freeze on screen. */
  stuck: number;
  /** Reached full time. */
  finished: boolean;
  /** Any player off the pitch or NaN at any point. */
  badPositions: number;
}

/** One fixed scenario, played many times. */
export interface FiveSimScenarioRun {
  kind: "yours" | "mate" | "them";
  seed: number;
  name: string;
  plays: number;
  goals: number;
  /** Outcome → count. */
  outcomes: Record<string, number>;
}

export interface FiveSimSettings {
  matches: number;
  difficulty: number;
  skill: number;
  yourKeeper: number;
  theirKeeper: number;
  /** How the bot plays your touches, in plain words. */
  bot: string[];
}

export interface Spread { median: number; p90: number; max: number }

export interface FiveSimSummary {
  version: 1;
  /** When the numbers were made (yyyy-mm-dd). */
  made: string;
  settings: FiveSimSettings;
  results: { win: number; draw: number; loss: number };
  /** Average goals a match. */
  goalsPerMatch: { us: number; them: number; total: number };
  /** Matches with 0, 1, 2 … total goals; the last bucket is "that many or more". */
  goalsHistogram: number[];
  /** The commonest scorelines, ours first. */
  scorelines: { score: string; n: number }[];
  /** Average shots a match. Rolled = the match's captions, no engine. */
  shotsPerMatch: { you: number; mate: number; them: number; rolledMate: number; rolledThem: number };
  /** Your touches a match, and how many were passes. */
  touchesPerMatch: number;
  passesPerMatch: number;
  /** Share of your passes that reached a team-mate. */
  passCompletion: number;
  /** Goals over every match, by who scored them. */
  goalsBy: FiveSimMatch["goals"];
  /** Every chance kind: how many each side had and how many went in. */
  kinds: { kind: string; you: { n: number; goals: number }; mate: { n: number; goals: number }; them: { n: number; goals: number } }[];
  /** How each side's engine chances ended. */
  outcomes: Record<FiveSimWho, Record<string, number>>;
  /** Your side's share of the ball, 0-1. */
  possessionYou: number;
  /** Longest spell on the ball a match, in minutes. */
  longestSpell: { you: Spread; them: Spread };
  scenarios: FiveSimScenarioRun[];
  /** The same matches at other difficulties, for comparison. */
  byDifficulty: { label: string; difficulty: number; matches: number; us: number; them: number; winShare: number }[];
  /** A pass to the man nearest their goal, in the last third, from every chance picture. */
  lastThirdPass?: { passes: number; delivered: number; lost: number; mateShot: number };
  health: { label: string; ok: boolean; detail: string }[];
}

const MINUTES_PER_BEAT = 0.5;
const GOAL_OUTCOMES = new Set(["goal", "rebound"]);
export const isGoal = (outcome: string) => GOAL_OUTCOMES.has(outcome);

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
function spread(xs: number[]): Spread {
  if (!xs.length) return { median: 0, p90: 0, max: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))];
  return { median: at(0.5), p90: at(0.9), max: s[s.length - 1] };
}
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The longest run of one side in a possession sequence. */
export function longestRuns(seq: ("you" | "them")[]): { you: number; them: number } {
  const best = { you: 0, them: 0 };
  let run = 0;
  let prev: "you" | "them" | null = null;
  for (const s of seq) {
    run = s === prev ? run + 1 : 1;
    prev = s;
    if (run > best[s]) best[s] = run;
  }
  return best;
}

/** Add up a set of matches (and, optionally, the scenario runs and other difficulties). */
export function summariseFiveSim(
  matches: FiveSimMatch[],
  opts: {
    settings: FiveSimSettings;
    made: string;
    scenarios?: FiveSimScenarioRun[];
    byDifficulty?: { label: string; difficulty: number; matches: FiveSimMatch[] }[];
    lastThirdPass?: FiveSimSummary["lastThirdPass"];
  },
): FiveSimSummary {
  const n = Math.max(1, matches.length);
  const results = { win: 0, draw: 0, loss: 0 };
  const hist = new Array(9).fill(0) as number[];
  const lines = new Map<string, number>();
  const goalsBy = { you: 0, assist: 0, mateWatched: 0, mateRolled: 0, themWatched: 0 };
  const shots = { you: 0, mate: 0, them: 0, rolledMate: 0, rolledThem: 0 };
  let touches = 0, passes = 0, passesDone = 0;
  const kinds = new Map<string, FiveSimSummary["kinds"][number]>();
  const outcomes: FiveSimSummary["outcomes"] = { you: {}, mate: {}, them: {} };
  let beatsYou = 0, beatsAll = 0;
  const spellsYou: number[] = [], spellsThem: number[] = [];
  let stuck = 0, unfinished = 0, bad = 0, usBlank = 0, themBlank = 0;

  for (const m of matches) {
    const [us, them] = m.score;
    if (us > them) results.win++; else if (us < them) results.loss++; else results.draw++;
    hist[Math.min(hist.length - 1, us + them)]++;
    lines.set(`${us}–${them}`, (lines.get(`${us}–${them}`) ?? 0) + 1);
    for (const k of Object.keys(goalsBy) as (keyof typeof goalsBy)[]) goalsBy[k] += m.goals[k];
    shots.rolledMate += m.rolled.mate;
    shots.rolledThem += m.rolled.them;
    for (const c of m.chances) {
      if (c.who === "you") {
        touches++;
        if (c.how === "pass") {
          passes++;
          if (c.outcome === "delivered" || c.assist) passesDone++;
        } else shots.you++;
      } else if (c.who === "mate") shots.mate++;
      else shots.them++;
      const row = kinds.get(c.kind) ?? { kind: c.kind, you: { n: 0, goals: 0 }, mate: { n: 0, goals: 0 }, them: { n: 0, goals: 0 } };
      row[c.who].n++;
      if (isGoal(c.outcome)) row[c.who].goals++;
      kinds.set(c.kind, row);
      outcomes[c.who][c.outcome] = (outcomes[c.who][c.outcome] ?? 0) + 1;
    }
    beatsYou += m.beats.you;
    beatsAll += m.beats.you + m.beats.them;
    spellsYou.push(m.longestSpell.you * MINUTES_PER_BEAT);
    spellsThem.push(m.longestSpell.them * MINUTES_PER_BEAT);
    stuck += m.stuck;
    if (!m.finished) unfinished++;
    bad += m.badPositions;
    if (us === 0) usBlank++;
    if (them === 0) themBlank++;
  }

  const totalUs = matches.reduce((a, m) => a + m.score[0], 0);
  const totalThem = matches.reduce((a, m) => a + m.score[1], 0);
  const scorers = goalsBy.you + goalsBy.assist + goalsBy.mateWatched + goalsBy.mateRolled;

  const health: FiveSimSummary["health"] = [
    { label: "Every match reached full time", ok: unfinished === 0, detail: `${unfinished} of ${matches.length} did not` },
    { label: "No kick froze", ok: stuck === 0, detail: `${stuck} kicks still live after 20 seconds` },
    { label: "Nobody left the pitch or vanished", ok: bad === 0, detail: `${bad} bad positions` },
    { label: "Your side scores", ok: totalUs > 0, detail: `${totalUs} goals; blank in ${usBlank} of ${matches.length} matches` },
    { label: "They score", ok: totalThem > 0, detail: `${totalThem} goals; blank in ${themBlank} of ${matches.length} matches` },
    { label: "The goals add up", ok: scorers === totalUs && goalsBy.themWatched === totalThem, detail: `${scorers} of ours counted by scorer, ${totalUs} on the scoreboard` },
  ];
  const lp = opts.lastThirdPass;
  if (lp) {
    health.push({
      label: "A pass in the last third can become a team-mate's shot",
      ok: lp.mateShot > 0,
      detail: `${lp.mateShot} shots from ${lp.passes} passes (${lp.delivered} reached him, ${lp.lost} were cut out)`,
    });
  }
  const dead = (opts.scenarios ?? []).filter((s) => s.kind === "yours" && s.plays > 0 && s.goals === 0);
  if (opts.scenarios?.length) {
    health.push({
      label: "Every chance picture can be scored",
      ok: dead.length === 0,
      detail: dead.length ? `${dead.map((d) => d.name).join(", ")}: no goals in ${dead[0].plays} tries` : "every picture went in at least once",
    });
  }

  return {
    version: 1,
    made: opts.made,
    settings: opts.settings,
    results,
    goalsPerMatch: { us: r2(totalUs / n), them: r2(totalThem / n), total: r2((totalUs + totalThem) / n) },
    goalsHistogram: hist,
    scorelines: Array.from(lines.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([score, k]) => ({ score, n: k })),
    shotsPerMatch: {
      you: r2(shots.you / n), mate: r2(shots.mate / n), them: r2(shots.them / n),
      rolledMate: r2(shots.rolledMate / n), rolledThem: r2(shots.rolledThem / n),
    },
    touchesPerMatch: r2(touches / n),
    passesPerMatch: r2(passes / n),
    passCompletion: r3(passes ? passesDone / passes : 0),
    goalsBy,
    kinds: Array.from(kinds.values()).sort((a, b) => (b.you.n + b.mate.n + b.them.n) - (a.you.n + a.mate.n + a.them.n)),
    outcomes,
    possessionYou: r3(beatsAll ? beatsYou / beatsAll : 0),
    longestSpell: { you: spread(spellsYou), them: spread(spellsThem) },
    scenarios: opts.scenarios ?? [],
    byDifficulty: (opts.byDifficulty ?? []).map((d) => {
      const k = Math.max(1, d.matches.length);
      return {
        label: d.label, difficulty: d.difficulty, matches: d.matches.length,
        us: r2(d.matches.reduce((a, m) => a + m.score[0], 0) / k),
        them: r2(d.matches.reduce((a, m) => a + m.score[1], 0) / k),
        winShare: r3(d.matches.filter((m) => m.score[0] > m.score[1]).length / k),
      };
    }),
    ...(lp ? { lastThirdPass: lp } : {}),
    health,
  };
}
