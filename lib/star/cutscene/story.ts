/**
 * THE STORY PLANNER — a game event and its context → the beats of a scene.
 *
 * Each kind of event has a STORY: a place, who is in it, and its acts
 * (setup → build → moment → reaction → aftermath). Each act lists the beats
 * that could play it; the planner keeps the ones that suit THIS event (a beat
 * says how much it suits: weight(ev)), then picks by weight with a seeded
 * random stream, so the same event and seed always plan the same scene and
 * a new seed rerolls it. An act can be optional, more likely the higher the
 * stakes. Mood comes from the context (night, rain, a sad story outdoors).
 */
import type { Act, CastMember, EventKind, LocationId, MoodId, PropSpec, Role, StoryEvent } from "./types";
import { BEATS, type BeatDef } from "./beats";
import { LOCATIONS } from "./presets/locations";
import { rng } from "./math";

interface ActSlot { act: Act; beats: string[]; optional?: number }
interface Story {
  loc: (e: StoryEvent) => LocationId;
  /** The other main person (the line of action is you ↔ them). */
  other?: { id: string; role: Role; mark?: string | [number, number, number]; face?: number | string };
  /** Team-mates in it (how many, from the stakes). */
  mates?: (e: StoryEvent) => number;
  acts: ActSlot[];
  you?: { mark?: string | [number, number, number]; face?: number | string };
  props?: PropSpec[];
}

const STORIES: Partial<Record<EventKind, Story>> = {
  signed: {
    loc: () => "office",
    other: { id: "boss", role: "manager", mark: "chair.boss" },
    you: { mark: "chair.you" },
    props: [
      { id: "contract", kind: "contract", at: "contract.start", yaw: 180 },
      { id: "pen", kind: "pen", at: "pen.rest", yaw: 0 },
      { id: "chairY", kind: "chair", at: "chairpos.you", yaw: 180 }, { id: "chairB", kind: "chair", at: "chairpos.boss", yaw: 0 },
      { id: "shirt", kind: "shirt" },
    ],
    acts: [
      { act: "setup", beats: ["office-seated"] },
      { act: "build", beats: ["contract-slide"] },
      { act: "moment", beats: ["sign-contract"] },
      { act: "reaction", beats: ["handshake"] },
      { act: "aftermath", beats: ["shirt-photo"], optional: 0.35 },
    ],
  },
  scored: {
    loc: () => "pitch", mates: (e) => 1 + Math.round(e.stakes * 3),
    you: { mark: "run.start" },
    acts: [{ act: "moment", beats: ["goal-strike"] }, { act: "reaction", beats: ["goal-celebration"] }],
  },
  "record-broken": {
    loc: () => "pitch", mates: () => 3, you: { mark: "run.start" },
    acts: [{ act: "moment", beats: ["goal-strike"] }, { act: "reaction", beats: ["goal-celebration"] }, { act: "aftermath", beats: ["applause"], optional: 0.6 }],
  },
  "won-trophy": {
    loc: (e) => (e.detail?.trophy === "ballon-dor" || e.detail?.trophy === "golden-boot" ? "awards-stage" : "pitch"),
    mates: (e) => 3 + Math.round(e.stakes * 3), you: { mark: "podium" },
    acts: [{ act: "moment", beats: ["trophy-lift", "award-receive"] }],
  },
  promoted: { loc: () => "pitch", mates: () => 4, you: { mark: "podium" }, acts: [{ act: "moment", beats: ["trophy-lift"] }] },
  walkout: { loc: () => "tunnel", acts: [{ act: "setup", beats: ["tunnel-line-up"] }, { act: "build", beats: ["stare-down"], optional: 0 }, { act: "moment", beats: ["walk-out"] }] },
  debut: { loc: () => "tunnel", acts: [{ act: "setup", beats: ["tunnel-line-up"] }, { act: "moment", beats: ["walk-out"] }] },
  rivalry: { loc: () => "tunnel", acts: [{ act: "setup", beats: ["tunnel-line-up"] }, { act: "build", beats: ["stare-down"] }, { act: "moment", beats: ["walk-out"] }] },
  "press-conference": { loc: () => "press-room", you: { mark: "seat.you" }, acts: [{ act: "build", beats: ["press-question"] }, { act: "moment", beats: ["press-answer"] }] },
  arrival: {
    loc: () => "airport", other: { id: "agent", role: "agent", mark: "agent", face: 180 },
    acts: [{ act: "setup", beats: ["walk-in"] }],
  },
  award: {
    loc: () => "awards-stage", other: { id: "presenter", role: "presenter", mark: "stage.presenter" }, mates: () => 0,
    acts: [{ act: "setup", beats: ["walk-in"] }, { act: "moment", beats: ["award-receive"] }, { act: "aftermath", beats: ["applause"], optional: 0.5 }],
  },
  injured: { loc: () => "pitch", you: { mark: [1.0, 0, 15] }, acts: [{ act: "moment", beats: ["injury-down"] }] },
  dropped: { loc: () => "office", other: { id: "boss", role: "manager", mark: "chair.boss" }, you: { mark: "chair.you" }, acts: [{ act: "setup", beats: ["office-seated"] }, { act: "moment", beats: ["bad-news"] }] },
  sacked: { loc: () => "office", other: { id: "boss", role: "manager", mark: "chair.boss" }, you: { mark: "chair.you" }, acts: [{ act: "setup", beats: ["office-seated"] }, { act: "moment", beats: ["bad-news"] }] },
  "transfer-request": { loc: () => "office", other: { id: "boss", role: "manager", mark: "chair.boss" }, you: { mark: "chair.you" }, acts: [{ act: "setup", beats: ["office-seated"] }, { act: "moment", beats: ["bad-news"] }] },
  "mentor-advice": {
    loc: (e) => e.where ?? "training-ground",
    other: { id: "mentor", role: "mentor", mark: [-1.4, 0, -2.2], face: "you" },
    you: { mark: [0.0, 0, 1.2], face: 200 },
    acts: [{ act: "moment", beats: ["mentor-word"] }],
  },
};

export const valenceOf = (e: StoryEvent) => {
  const pos = ["joy", "pride", "relief", "gratitude", "inspired", "hunger", "calm"];
  const neg = ["sadness", "anger", "shock"];
  return pos.includes(e.emotion) ? 1 : neg.includes(e.emotion) ? -1 : 0;
};

export function moodFor(e: StoryEvent, loc: LocationId): MoodId {
  const L = LOCATIONS[loc];
  if (L.indoor && loc !== "tunnel" && loc !== "office") return L.mood;
  if (e.night) return e.emotion === "sadness" ? "rain-night" : "floodlit-night";
  if (!L.indoor && valenceOf(e) < 0) return "overcast";
  return L.mood;
}

export interface Plan {
  loc: LocationId; mood: MoodId;
  beats: BeatDef[];
  cast: CastMember[];
  props: PropSpec[];
  ids: { you: string; other?: string; mates: string[] };
  /** Why each beat was chosen (the dev page shows it). */
  notes: string[];
}

export function planStory(e: StoryEvent, seed: number): Plan {
  const R = rng(seed * 7919 + 13);
  const story = STORIES[e.kind] ?? STORIES["press-conference"]!;
  const loc = story.loc(e);
  const notes: string[] = [];
  const beats: BeatDef[] = [];
  for (const slot of story.acts) {
    const cands = slot.beats.map((id) => BEATS.find((b) => b.id === id)!).filter((b) => b && b.at.includes(loc) && b.weight(e) > 0);
    if (!cands.length) { notes.push(`${slot.act}: nothing suits`); continue; }
    if (slot.optional !== undefined) {
      const p = slot.optional + e.stakes * 0.6;
      if (!R.chance(p)) { notes.push(`${slot.act}: left out (chance ${(Math.min(1, p) * 100).toFixed(0)}%)`); continue; }
    }
    const b = R.weighted(cands.map((v) => ({ w: v.weight(e), v })));
    beats.push(b);
    notes.push(`${slot.act}: ${b.id}${cands.length > 1 ? ` (of ${cands.map((x) => x.id).join(", ")})` : ""}`);
  }
  const ids = { you: "you", other: story.other?.id, mates: Array.from({ length: story.mates?.(e) ?? 0 }, (_, i) => `mate${i}`) };
  const cast: CastMember[] = [{ id: "you", role: "you", mark: story.you?.mark, face: story.you?.face }];
  if (story.other) cast.push({ id: story.other.id, role: story.other.role, mark: story.other.mark, face: story.other.face });
  return { loc, mood: moodFor(e, loc), beats, cast, props: story.props ?? [], ids, notes };
}
