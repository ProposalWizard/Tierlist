// Rebuild the test page's fake seasons in node and report, per goal, the
// on-screen goal moment vs the crowd/net/commentary cues in the reel's sound plan.
import { makeInitialCareer } from "../../../../../../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../../../../../../lib/star/clubs";
import { synthTrack, type SynthKind } from "../../../../../../../lib/star/goalClip/synth";
import { planReelFor, type ClipTiming } from "../../../../../../../lib/star/goalClip/reel";
import { reelCrowdPlan, timingOf } from "../../../../../../../lib/star/goalClip/reelAudio";
import { frameAt, type GoalTrack } from "../../../../../../../lib/star/goalClip/track";
import { COMMENTARY_SECONDS } from "../../../../../../../lib/star/goalClip/commentaryDurations";
import type { CareerGoal } from "../../../../../../../lib/star/goalLog";
import type { CareerState, StarPlayer } from "../../../../../../../lib/star/types";
import { writeFileSync } from "node:fs";

const COMPS = ["Premier League", "Premier League", "Premier League", "FA Cup", "Champions League", "League Cup"];
const HOWS: { how?: string; kind: SynthKind; distance: number; finish?: "chip" | "curl" }[] = [
  { kind: "run_in", how: "one_on_one", distance: 11 },
  { kind: "tap_in", how: "cutback", distance: 7 },
  { kind: "long_range", how: "long_range", distance: 27, finish: "curl" },
  { kind: "header", how: "header", distance: 9 },
  { kind: "penalty", how: "penalty", distance: 11 },
  { kind: "run_in", how: "one_on_one", distance: 13, finish: "chip" },
];
const MATES = ["Saka", "Ødegaard", "Rice", "Martinelli", undefined];

export function fakeSeason(club: string, n: number, trophies: number) {
  const player = { firstName: "Leo", lastName: "Vale", age: 22, skinTone: "light", club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
  const base = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
  const opps = PREMIER_LEAGUE_CLUBS.filter((c) => c !== club);
  const goals: CareerGoal[] = [];
  const tracks = new Map<string, GoalTrack>();
  for (let i = 0; i < n; i++) {
    const h = HOWS[(i * 7 + 3) % HOWS.length];
    const opponent = opps[(i * 5) % opps.length];
    const home = i % 2 === 0;
    const minute = 6 + ((i * 37) % 86);
    const us = 1 + (i % 3), them = i % 2;
    const competition = COMPS[i % COMPS.length];
    const g: CareerGoal = {
      id: `1:${i + 1}:league:${opponent}:${minute}:0`, season: 1, week: i + 1, minute, opponent, club, home, competition,
      score: `${us}-${them}`, how: h.how, distance: h.distance + (i % 4),
      ...(h.finish ? { finish: h.finish } : {}), ...(MATES[i % MATES.length] ? { assist: MATES[i % MATES.length] } : {}),
    };
    const tr = synthTrack({ home: home ? club : opponent, away: home ? opponent : club, scorer: "Leo Vale", scorerShort: "Vale", scorerHome: home, minute, scoreAfter: home ? [us, them] : [them, us], competition, season: 1, week: i + 1, seed: `reel-dev:${club}:${i}`, kind: h.kind });
    if (tr) { tr.meta.isYou = true; tracks.set(tr.meta.id, tr); g.clipId = tr.meta.id; }
    goals.push(g);
  }
  const wonList = ["Premier League", "FA Cup", "Champions League"].slice(0, trophies);
  const career: CareerState = { ...base, season: 1, goalLog: goals,
    seasonStats: { appearances: 38 + Math.min(12, n), goals: n, hatTricks: 1, passes: 900, assists: Math.round(n * 0.45), starMan: 6, totalRating: (38 + Math.min(12, n)) * 7.4, ratingCount: 38 + Math.min(12, n) },
    trophies: wonList.map((competition) => ({ season: 1, competition, club })) } as CareerState;
  return { career, tracks };
}

/** Clip seconds the ball is across the goal line (y <= 0), from the frames. */
function lineCross(tr: GoalTrack): number {
  for (let t = 0; t < tr.n / tr.fps; t += 1 / 240) { if (frameAt(tr, t).ball.y <= 0) return t; }
  return NaN;
}

const out: Record<string, unknown> = {};
for (const n of [20, 40]) {
  const { career, tracks } = fakeSeason("Arsenal", n, 1);
  const timings: Record<string, ClipTiming> = {};
  tracks.forEach((t, id) => { timings[id] = timingOf(t); });
  const plan = planReelFor(career, timings, "Leo Vale");
  const ap = reelCrowdPlan(plan, tracks);
  const rows: unknown[] = [];
  for (const s of plan.segs) {
    if (s.kind !== "goal" && s.kind !== "best") continue;
    const tr = s.goal.clipId ? tracks.get(s.goal.clipId) : undefined;
    if (!tr) continue;
    let acc = 0;
    for (const sh of s.shots) {
      const len = (sh.to - sh.from) / sh.rate;
      if (tr.goalT >= sh.from && tr.goalT <= sh.to) {
        const screen = s.at + acc + (tr.goalT - sh.from) / sh.rate;
        const cross = s.at + acc + (lineCross(tr) - sh.from) / sh.rate;
        const near = (name: string) => ap.cues.filter((c) => c.sound === name && Math.abs(c.at - screen) < 0.6).map((c) => +(1000 * (c.at - screen)).toFixed(0));
        rows.push({ kind: s.kind, n: s.n, quick: s.kind === "goal" && !!s.quick, replay: sh.replay, rate: sh.rate, screen: +screen.toFixed(3), lineCrossMs: +(1000 * (cross - screen)).toFixed(0), roar: near("crowd-cheer-stadium"), net: near("goal-net") });
      }
      acc += len;
    }
  }
  const comm = ap.cues.filter((c) => c.sound.startsWith("cl-") || c.sound.startsWith("cc-")).map((c) => ({ at: +c.at.toFixed(3), id: c.sound, end: +(c.at + (COMMENTARY_SECONDS[c.sound] ?? 1.8)).toFixed(3) }));
  const segs = plan.segs.map((s) => ({ kind: s.kind, at: +s.at.toFixed(3), dur: +s.dur.toFixed(3), quick: s.kind === "goal" && !!s.quick, shots: "shots" in s ? s.shots.length : 0 }));
  out[n] = { duration: plan.duration, rows, comm, segs, music: plan.stats };
  console.log(`== ${n} goals, ${plan.duration.toFixed(2)} s`);
  for (const r of rows) console.log(JSON.stringify(r));
  console.log("commentary", JSON.stringify(comm));
  const best = plan.segs.find((s) => s.kind === "best")!;
  console.log("best seg", best.at.toFixed(2), (best.at + best.dur).toFixed(2), JSON.stringify((best as { shots: unknown }).shots));
}
writeFileSync(new URL("./plan.json", import.meta.url), JSON.stringify(out, null, 1));
