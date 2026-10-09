/**
 * THE GENERATOR — a game event → a whole cut scene, nothing pre-built:
 *
 *   planStory (story.ts)        the event → a place, a mood, a cast, beats
 *   compose (here)              the beats laid end to end → performance tracks
 *   cinematograph (cinema.ts)   the beats' shot intents → camera shots
 *   frameTracks                 fades and letterbox
 *
 * Same event + seed = the same scene (seek(t) and stills stay exact).
 */
import type { BeatMark, CareerContext, CastMember, CutsceneScript, PropSpec, StoryEvent, Track } from "./types";
import type { BeatCtx, BeatDef, ShotIntent } from "./beats";
import { planStory, valenceOf } from "./story";
import { cinematograph, frameTracks, shotQuality } from "./cinema";
import { rng } from "./math";

export interface Composed { tracks: Track[]; shots: ShotIntent[]; cast: CastMember[]; props: PropSpec[]; beats: BeatMark[]; duration: number }

/** Lay beats end to end from `start`. Each beat adds its tracks, people, props and shot intents. */
export function compose(beats: BeatDef[], ev: StoryEvent, ids: BeatCtx["ids"], loc: BeatCtx["loc"], seed: number, start = 0.4, base: { cast: CastMember[]; props: PropSpec[] } = { cast: [], props: [] }): Composed {
  const R = rng(seed);
  const ctx: BeatCtx = { ev, loc, rng: R, ids, valence: valenceOf(ev) };
  const tracks: Track[] = [], shots: ShotIntent[] = [], marks: BeatMark[] = [];
  const cast = [...base.cast], props = [...base.props];
  let t = start;
  for (const b of beats) {
    const o = b.build(ctx, t);
    tracks.push(...o.tracks);
    shots.push(...o.shots);
    for (const m of o.cast ?? []) if (!cast.some((c) => c.id === m.id)) cast.push(m);
    for (const p of o.props ?? []) if (!props.some((x) => x.id === p.id)) props.push(p);
    marks.push({ name: o.name, at: t, dur: o.dur, act: o.act });
    t += o.dur;
  }
  return { tracks, shots, cast, props, beats: marks, duration: t + 0.7 };
}

export function generateScript(ev: StoryEvent, seed = 1, career?: CareerContext): CutsceneScript {
  const plan = planStory(ev, seed);
  const c = compose(plan.beats, ev, plan.ids, plan.loc, seed, 0.4, { cast: plan.cast, props: plan.props });
  const other = plan.ids.other ?? (ev.kind === "rivalry" ? "away1" : c.cast.find((m) => m.id !== "you" && OTHER_ROLES.includes(m.role))?.id);
  const cams = cinematograph(c.shots, { ev, seed, duration: c.duration, loc: plan.loc, mainPair: ["you", other] });
  const tracks = [...c.tracks, ...cams, ...frameTracks(c.duration, ev.stakes)];
  return {
    id: `gen-${ev.kind}-${seed}`,
    title: `${ev.kind.replace(/-/g, " ")} · generated`,
    duration: c.duration,
    set: { location: plan.loc, mood: plan.mood },
    cast: c.cast, props: c.props, tracks, beats: c.beats,
    seed,
    text: { notes: plan.notes.join(" · ") },
    source: { kind: "generated", event: { ...ev, career: career ?? ev.career }, seed },
  };
}

const OTHER_ROLES = ["manager", "mentor", "presenter", "agent", "journalist"];

export function scoreScript(s: CutsceneScript) {
  const other = s.source?.event?.kind === "rivalry" ? "away1" : s.cast.find((m) => m.id !== "you" && OTHER_ROLES.includes(m.role))?.id;
  return shotQuality(s.tracks, s.duration, ["you", other]);
}
