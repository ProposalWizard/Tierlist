/**
 * THE BEAT LIBRARY — common pieces of performance every cut scene is made
 * of: walk in, sit and talk, sign the contract with the pen, stand and shake
 * hands, hold the shirt up for the cameras, the strike, the celebration, the
 * trophy, the tunnel, the walk-out, the press answer, applause, bad news, the
 * mentor's word …
 *
 * A beat is a function: (context, start time) → its tracks (bodies, props,
 * faces, looks, effects, captions, sounds) plus SHOT INTENTS — what the
 * camera should show and why (establish, action, detail, emotion, reaction,
 * hero …). The hand-made scenes (fixtures.ts) call beats and choose their
 * own shots; the generator (generate.ts) calls the same beats and lets the
 * cinema rules (cinema.ts) turn the intents into shots. So a beat is written
 * once and serves every scene and every career.
 */
import type { Act, CastMember, Emotion, EventKind, Expression, LocationId, PoseHold, PropSpec, ShotSpec, StoryEvent, Target, Track, Vec3 } from "./types";
import type { Rng } from "./math";
import { VOICE_LINES } from "./voiceLines";

export type ShotPurpose = "establish" | "action" | "detail" | "emotion" | "reaction" | "hero" | "two" | "pov" | "crowd" | "follow";

export interface ShotIntent {
  at: number; dur: number;
  purpose: ShotPurpose;
  subject: Target;
  subject2?: Target;
  /** Fixed spec bits the beat insists on (a fixed camera for an insert of the pen …). */
  hint?: Partial<ShotSpec>;
  /** How much this intent matters (cinema keeps the heavier when two overlap). */
  weight?: number;
  name?: string;
}

export interface BeatCtx {
  ev: StoryEvent;
  loc: LocationId;
  rng: Rng;
  /** Role → actor id in this scene. */
  ids: { you: string; other?: string; mates: string[]; crowd?: string };
  /** Positive feelings > 0. */
  valence: number;
}

export interface BeatOut {
  name: string;
  act: Act;
  dur: number;
  tracks: Track[];
  shots: ShotIntent[];
  cast?: CastMember[];
  props?: PropSpec[];
}

export interface BeatDef {
  id: string;
  act: Act;
  /** Where it can be played. */
  at: LocationId[];
  /** Which events it suits (empty = any) and how much (0 = never). */
  weight: (ev: StoryEvent) => number;
  build: (c: BeatCtx, t0: number) => BeatOut;
}

const you = (c: BeatCtx): Target => ({ actor: c.ids.you });
const other = (c: BeatCtx): Target => ({ actor: c.ids.other ?? c.ids.you });

/** Emotion → face and a body hold for a reaction. */
export function performFor(em: Emotion, intensity: number, valence: number): { face: Expression; pose: PoseHold | null; clip: string | null } {
  switch (em) {
    case "joy": return { face: intensity > 0.6 ? "elated" : "grin", pose: intensity > 0.7 ? "arms-up" : "fist-pump", clip: "celebrate" };
    case "pride": return { face: "proud", pose: "hands-on-hips", clip: null };
    case "relief": return { face: "eyes-closed", pose: "point-sky", clip: null };
    case "defiance": return { face: "determined", pose: "arms-folded", clip: null };
    case "anger": return { face: "angry", pose: null, clip: "frustrated" };
    case "sadness": return { face: intensity > 0.7 ? "crying" : "sad", pose: "head-down", clip: null };
    case "shock": return { face: "shocked", pose: "hands-on-head", clip: null };
    case "tension": return { face: "tense", pose: null, clip: null };
    case "gratitude": return { face: "smile", pose: "applaud", clip: null };
    case "hunger": return { face: "determined", pose: null, clip: null };
    case "inspired": return { face: "determined", pose: "nod", clip: null };
    default: return { face: valence >= 0 ? "smile" : "neutral", pose: null, clip: null };
  }
}

// ═════════════════════════════ THE OFFICE ═══════════════════════════════

export const officeSeated: BeatDef = {
  id: "office-seated", act: "setup", at: ["office"],
  weight: (e) => (["signed", "transfer-request", "sacked", "dropped"].includes(e.kind) ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you, O = c.ids.other!;
    const d = 2.6;
    return {
      name: "Sat across the desk", act: "setup", dur: d,
      tracks: [
        { type: "clip", actor: Y, at: 0, clip: "sit" },
        { type: "clip", actor: O, at: 0, clip: "sit-boss" },
        { type: "pose", actor: O, at: t, dur: d, pose: "lean-in", amount: 0.35 },
        { type: "look", actor: Y, at: t, dur: d, target: { actor: O, part: "head" }, amount: 0.8 },
        { type: "look", actor: O, at: t, dur: d, target: { actor: Y, part: "head" }, amount: 0.85 },
        { type: "speak", actor: O, at: t + 0.4, dur: 1.8 },
        { type: "face", actor: O, at: t, expression: "smile", amount: 0.6 },
        { type: "face", actor: Y, at: t, expression: "smile", amount: 0.3 },
        { type: "reach", actor: Y, hand: "R", at: t, dur: d + 4, target: { actor: Y, local: [-0.19, 0.795, 0.4] }, along: [0.25, -0.15, 1], palm: [0.15, -1, 0.05], blendIn: 0 },
        { type: "reach", actor: Y, hand: "L", at: t, dur: d + 1.0, target: { actor: Y, local: [0.19, 0.795, 0.4] }, along: [-0.25, -0.15, 1], palm: [-0.15, -1, 0.05], blendIn: 0 },
        { type: "reach", actor: O, hand: "R", at: t, dur: d + 5, target: { actor: O, local: [-0.19, 0.795, 0.4] }, along: [0.25, -0.15, 1], palm: [0.15, -1, 0.05], blendIn: 0 },
        { type: "reach", actor: O, hand: "L", at: t, dur: d + 5, target: { actor: O, local: [0.19, 0.795, 0.4] }, along: [-0.25, -0.15, 1], palm: [-0.15, -1, 0.05], blendIn: 0 },
      ],
      shots: [
        { at: t, dur: d * 0.55, purpose: "establish", subject: you(c), subject2: other(c), weight: 1 },
        { at: t + d * 0.55, dur: d * 0.45, purpose: "two", subject: other(c), subject2: you(c), weight: 0.7, name: "Over your shoulder" },
      ],
    };
  },
};

export const contractSlide: BeatDef = {
  id: "contract-slide", act: "build", at: ["office"],
  weight: (e) => (e.kind === "signed" ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you, O = c.ids.other!;
    const d = 2.0;
    return {
      name: "The contract slides across", act: "build", dur: d,
      tracks: [
        { type: "prop", prop: "contract", at: t + 0.15, action: "place", to: "contract", yaw: 0, dur: 1.0 },
        { type: "reach", actor: O, hand: "R", at: t + 0.05, dur: 1.2, target: { prop: "contract", handle: "grip" }, offset: [0.06, 0.02, -0.12], grip: "flat", palm: [0, -1, 0], along: [0, -0.2, 1], blendIn: 0.25, blendOut: 0.35 },
        { type: "look", actor: Y, at: t + 0.3, dur: d, target: { prop: "contract" }, amount: 0.9 },
        { type: "look", actor: O, at: t, dur: d * 0.6, target: { prop: "contract" }, amount: 0.6 },
        { type: "pose", actor: Y, at: t + 0.4, dur: d + 4.5, pose: "lean-in", amount: 0.7, blendIn: 0.6 },
        { type: "face", actor: Y, at: t + 0.4, expression: "focused", amount: 0.6, dur: d + 4.4 },
      ],
      shots: [{ at: t, dur: d, purpose: "detail", subject: { prop: "contract" }, weight: 1, name: "The contract" }],
    };
  },
};

/** Pick up the pen, sign along the real signature, put it down, look up and smile. */
export const signContract: BeatDef = {
  id: "sign-contract", act: "moment", at: ["office"],
  weight: (e) => (e.kind === "signed" ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you, O = c.ids.other!;
    const reach = 0.65, write = 2.6, lead = 0.45, out = 0.5;
    const tg = t + reach, tEnd = tg + lead + write + out;
    const d = tEnd - t + 0.9;
    return {
      name: "Signs the contract", act: "moment", dur: d,
      tracks: [
        { type: "reach", actor: Y, hand: "R", at: t, dur: reach + 0.06, target: { prop: "pen", handle: "tip" }, grip: "pen", toolGrip: true, along: [0.2, -0.7, 0.68], palm: [0.85, -0.5, -0.1], blendIn: 0.55, blendOut: 0.05 },
        { type: "hand", actor: Y, hand: "R", at: t, dur: reach * 0.6, pose: "open" },
        { type: "prop", prop: "pen", at: tg, action: "attach", actor: Y, hand: "R", dur: 0.12 },
        { type: "trace", actor: Y, hand: "R", tool: "pen", along: { prop: "contract", path: "signature" }, at: tg, dur: lead + write + out, leadIn: lead, leadOut: out, lift: 0.012 },
        { type: "prop", prop: "pen", at: tEnd, action: "detach", to: "pen.rest", yaw: 0 },
        { type: "reach", actor: Y, hand: "L", at: t + 0.2, dur: tEnd - t, target: { prop: "contract", handle: "hold" }, grip: "flat", along: [-0.35, -0.15, 1], palm: [-0.1, -1, 0], blendIn: 0.5 },
        { type: "look", actor: Y, at: t, dur: tEnd - t, target: { prop: "contract" }, amount: 1 },
        { type: "look", actor: Y, at: tEnd - 0.1, dur: 1.2, target: { actor: O, part: "head" }, amount: 0.9 },
        { type: "face", actor: Y, at: tEnd - 0.1, expression: "grin", amount: 0.9, dur: 1.2 },
        { type: "look", actor: O, at: t, dur: d, target: { prop: "contract" }, amount: 0.7 },
        { type: "face", actor: O, at: tEnd, expression: "smile", amount: 0.9 },
        { type: "sound", at: tg + lead + 0.05, cue: "pen-scratch" },
      ],
      shots: [
        { at: t, dur: reach + lead, purpose: "action", subject: you(c), subject2: other(c), weight: 0.7, name: "Reaches for the pen" },
        { at: tg + lead, dur: write, purpose: "detail", subject: { prop: "contract" }, weight: 1, name: "The signature", hint: { preset: "insert", lens: 50 } },
        { at: tEnd - out, dur: d - (tEnd - out - t), purpose: "emotion", subject: you(c), subject2: other(c), weight: 1, name: "Looks up" },
      ],
    };
  },
};

/** Both stand and shake hands across the desk (or face to face when standing). */
export const handshake: BeatDef = {
  id: "handshake", act: "reaction", at: ["office", "pitch", "training-ground", "airport", "tunnel", "awards-stage", "press-room"],
  weight: (e) => (["signed", "arrival", "award", "won-trophy"].includes(e.kind) ? 1 : e.kind === "mentor-advice" ? 0.2 : 0.1),
  build: (c, t) => {
    const Y = c.ids.you, O = c.ids.other!;
    const seated = c.loc === "office";
    const rise = seated ? 1.5 : 0;
    const d = rise + 2.6;
    const tr: Track[] = [];
    if (seated) {
      tr.push(
        { type: "clip", actor: Y, at: t, clip: "stand-up", blendIn: 0.3, speed: -1.9 },
        { type: "clip", actor: O, at: t + 0.12, clip: "stand-up", blendIn: 0.3, speed: -1.9 },
        { type: "clip", actor: Y, at: t + rise + 0.35, clip: "idle", blendIn: 0.6 },
        { type: "clip", actor: O, at: t + rise + 0.45, clip: "idle-boss", blendIn: 0.6 },
        { type: "move", actor: Y, at: t + 0.2, dur: rise, path: ["stand.you"], gait: "none", facing: 180, ease: 1 },
        { type: "reach", actor: Y, hand: "L", at: t, dur: rise - 0.1, target: { actor: Y, local: [0.22, 0.79, 0.4] }, along: [-0.2, -0.3, 1], palm: [0, -1, 0], grip: "flat", blendIn: 0.25, blendOut: 0.4 },
        { type: "reach", actor: O, hand: "L", at: t + 0.1, dur: rise - 0.1, target: { actor: O, local: [0.22, 0.79, 0.4] }, along: [-0.2, -0.3, 1], palm: [0, -1, 0], grip: "flat", blendIn: 0.25, blendOut: 0.4 },
        { type: "reach", actor: O, hand: "R", at: t + 0.1, dur: rise - 0.3, target: { actor: O, local: [-0.22, 0.79, 0.4] }, along: [0.2, -0.3, 1], palm: [0, -1, 0], grip: "flat", blendIn: 0.25, blendOut: 0.4 },
        { type: "prop", prop: "chairY", at: t + 0.35, action: "place", to: "chairback.you", dur: rise * 0.8 },
        { type: "prop", prop: "chairB", at: t + 0.45, action: "place", to: "chairback.boss", dur: rise * 0.8 },
        { type: "move", actor: O, at: t + 0.3, dur: rise, path: ["stand.boss"], gait: "none", facing: 0, ease: 1 },
      );
    }
    const meet: Target = { point: seated ? [-0.02, 1.12, 0.0] : [0, 1.08, 0] };
    tr.push(
      { type: "reach", actor: Y, hand: "R", at: t + rise, dur: 2.4, target: seated ? meet : { actor: O, part: "hand.R" }, offset: [0.025, 0, 0.035], grip: "shake", along: [-0.3, -0.2, 1], palm: [1, 0.1, 0], pump: [0.03, 1.6], blendIn: 0.55, blendOut: 0.5 },
      { type: "reach", actor: O, hand: "R", at: t + rise + 0.05, dur: 2.35, target: seated ? meet : { actor: Y, part: "hand.R" }, offset: [-0.025, 0, -0.035], grip: "shake", along: [-0.3, -0.2, 1], palm: [1, 0.1, 0], pump: [0.03, 1.6], blendIn: 0.55, blendOut: 0.5 },
      { type: "pose", actor: Y, at: t + rise, dur: 2.4, pose: "lean-in", amount: 0.45 },
      { type: "pose", actor: O, at: t + rise, dur: 2.4, pose: "lean-in", amount: 0.45 },
      { type: "look", actor: Y, at: t + 0.6, dur: d, target: { actor: O, part: "eyes" }, amount: 0.9 },
      { type: "look", actor: O, at: t + 0.6, dur: d, target: { actor: Y, part: "eyes" }, amount: 0.9 },
      { type: "face", actor: Y, at: t + rise, expression: "grin", amount: 1 },
      { type: "face", actor: O, at: t + rise, expression: "smile", amount: 1 },
    );
    return {
      name: "The handshake", act: "reaction", dur: d, tracks: tr,
      shots: [
        ...(seated ? [{ at: t, dur: rise, purpose: "two" as const, subject: you(c), subject2: other(c), weight: 0.8, name: "Both stand" }] : []),
        { at: t + rise, dur: 1.3, purpose: "detail", subject: { point: [-0.02, 1.08, 0] }, weight: 0.6, name: "The handshake", hint: { preset: "insert", lens: 40, yaw: 70 } },
        { at: t + rise + 1.3, dur: 1.3, purpose: "emotion", subject: you(c), subject2: other(c), weight: 1, name: "Eye to eye" },
      ],
    };
  },
};

/** The photo: you hold the shirt up (your name and number to the cameras), the manager beside you, flashes. */
export const shirtPhoto: BeatDef = {
  id: "shirt-photo", act: "aftermath", at: ["office"],
  weight: (e) => (e.kind === "signed" ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you, O = c.ids.other!;
    const d = 3.4;
    return {
      name: "Holds the shirt up for the cameras", act: "aftermath", dur: d,
      tracks: [
        { type: "place", actor: Y, at: t, to: "photo.you", yaw: 0 },
        { type: "place", actor: O, at: t, to: "photo.boss", yaw: 0 },
        { type: "clip", actor: Y, at: t, clip: "idle" },
        { type: "clip", actor: O, at: t, clip: "idle-boss" },
        { type: "prop", prop: "shirt", at: t, action: "show" },
        { type: "pose", actor: Y, at: t, dur: d, pose: "hold-shirt-up", prop: "shirt", blendIn: 0 },
        { type: "reach", actor: O, hand: "R", at: t, dur: d, target: { actor: Y, part: "shoulder.L" }, offset: [0.02, 0.04, -0.05], grip: "flat", along: [-1, 0, 0.1], palm: [0, -1, 0], blendIn: 0 },
        { type: "look", actor: Y, at: t, dur: d, target: { mark: "photo.cam" }, amount: 0.9, blendIn: 0 },
        { type: "look", actor: O, at: t, dur: d, target: { mark: "photo.cam" }, amount: 0.9, blendIn: 0 },
        { type: "face", actor: Y, at: t, expression: "grin", amount: 1 },
        { type: "face", actor: O, at: t, expression: "proud", amount: 1 },
        { type: "fx", fx: "camera-flashes", at: t + 0.3, dur: d - 0.3, around: { mark: "photo.cam" }, amount: 1 },
        { type: "sound", at: t + 0.35, cue: "camera-shutters" },
      ],
      shots: [
        { at: t, dur: d * 0.6, purpose: "hero", subject: you(c), subject2: other(c), weight: 1, name: "The photo", hint: { preset: "medium-wide", yaw: -18 } },
        { at: t + d * 0.6, dur: d * 0.4, purpose: "emotion", subject: you(c), weight: 0.8, name: "Your new number" },
      ],
    };
  },
};

// ═════════════════════════════ THE PITCH ════════════════════════════════

const SHOT_SPOT: Vec3 = [-2.6, 0, 14.2];
const SLIDE_START: Vec3 = [-6.0, 0, 18.4], SLIDE_END: Vec3 = [-7.4, 0, 22.1];

export const goalStrike: BeatDef = {
  id: "goal-strike", act: "moment", at: ["pitch"],
  weight: (e) => (e.kind === "scored" || e.kind === "record-broken" ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you;
    const K = "keeper";
    const run = 2.4, contact = t + run + 0.31;
    const d = run + 0.95;
    // the ball runs ahead of him, then flies into the top corner and drops in the net
    const pts: Vec3[] = [[-5.0, 0.12, 22.6], [-4.3, 0.12, 20.3], [-3.6, 0.12, 18.1], [-2.95, 0.12, 15.9], [-2.6, 0.12, 13.7]];
    const ball: Track[] = pts.map((p, i) => ({ type: "prop", prop: "ball", at: t + (i * run) / pts.length, action: "place", to: p, dur: run / pts.length } as Track));
    ball.push(
      { type: "prop", prop: "ball", at: contact, action: "place", to: [2.95, 1.95, -0.1], dur: 0.48, arc: 0.4 },
      { type: "prop", prop: "ball", at: contact + 0.48, action: "place", to: [3.1, 0.12, -1.3], dur: 0.45 },
    );
    return {
      name: "The strike", act: "moment", dur: d,
      cast: [{ id: K, role: "keeper", mark: "goal.line", face: 0 }, { id: "def4", role: "rival", mark: [-9.5, 0, 25], face: "shot.spot" }],
      props: [{ id: "ball", kind: "ball", at: [-5.3, 0.12, 23.2], scale: 1.6 }],
      tracks: [
        { type: "place", actor: Y, at: t, to: "run.start", yaw: 160 },
        { type: "move", actor: Y, at: t, dur: run, path: [SHOT_SPOT], gait: "dribble", ease: 0 },
        { type: "clip", actor: Y, at: t + run, clip: "shot", blendIn: 0.12 },
        ...ball,
        { type: "clip", actor: K, at: 0, clip: "keeper-ready", loop: true },
        { type: "clip", actor: K, at: contact - 0.07, clip: "dive-left", from: 0.05, blendIn: 0.08 },
        { type: "move", actor: K, at: contact + 0.02, dur: 0.5, path: [[1.7, 0, 0.6]], gait: "none", ease: 0.2 },
        { type: "move", actor: "def4", at: t, dur: run + 0.4, path: [[-5.2, 0, 16.6]], gait: "sprint" },
        { type: "clip", actor: "def4", at: t + run + 0.5, clip: "frustrated", blendIn: 0.2 },
        { type: "look", actor: Y, at: t + run - 0.6, dur: 1.4, target: { mark: "goal", y: 1.5 }, amount: 0.7 },
        { type: "face", actor: Y, at: t + run - 0.8, expression: "focused", dur: 1.4 },
        { type: "fx", fx: "speed-lines", at: contact - 0.05, dur: 0.5, amount: 0.6 },
        { type: "sound", at: contact, cue: "kick" },
        { type: "sound", at: contact + 0.48, cue: "net" },
        { type: "sound", at: contact + 0.5, cue: "crowd-roar" },
      ],
      shots: [
        { at: t, dur: run * 0.55, purpose: "follow", subject: you(c), weight: 0.6, name: "On the ball" },
        { at: t + run * 0.55, dur: run * 0.45 + 0.35, purpose: "action", subject: you(c), subject2: { mark: "goal", y: 1 }, weight: 1, name: "Behind the shooter", hint: { preset: "ots", side: 1 } },
        { at: contact + 0.05, dur: 0.75, purpose: "action", subject: { prop: "ball" }, weight: 0.8, name: "Top corner", hint: { fixed: { pos: [6.5, 1.3, 7.5], look: [1.2, 1.4, 0], lens: 28 } } },

      ],
    };
  },
};

/** The celebration: off on a run, then (by emotion and stakes) a knee slide, badge kiss, point to the sky … team-mates pile in. */
export const goalCelebration: BeatDef = {
  id: "goal-celebration", act: "reaction", at: ["pitch"],
  weight: (e) => (e.kind === "scored" || e.kind === "record-broken" ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you, e = c.ev;
    const run = 1.5, slide = 1.0;
    const style: PoseHold = e.emotion === "relief" ? "point-sky" : e.emotion === "defiance" ? "arms-folded" : e.stakes > 0.55 ? "knee-slide" : c.rng.pick(["fist-pump", "badge-kiss", "arms-wide"] as PoseHold[]);
    const kneels = style === "knee-slide";
    const hold = 3.2;
    const d = run + slide + hold;
    const tr: Track[] = [
      { type: "move", actor: Y, at: t, dur: run, path: [SLIDE_START], gait: "sprint", ease: 0.15 },
      { type: "clip", actor: Y, at: t + run, clip: kneels ? "knee-slide" : "celebrate-fist", blendIn: 0.2 },
      { type: "move", actor: Y, at: t + run, dur: slide, path: [SLIDE_END], gait: "none", facing: -22, ease: 0.6 },
      { type: "pose", actor: Y, at: t + run, dur: slide + hold, pose: style, blendIn: 0.25 },
      { type: "face", actor: Y, at: t + run - 0.2, expression: e.emotion === "defiance" ? "determined" : e.intensity && e.intensity > 0.5 ? "shout" : "elated", amount: 1 },
      { type: "look", actor: Y, at: t + run + slide, dur: hold, target: { point: [-12, 6, 40] }, amount: 0.55 },
      { type: "fx", fx: "confetti", at: t + run + 0.3, dur: hold + 0.5, around: { point: [-7.4, 0, 23.5] }, amount: e.stakes > 0.6 ? 1 : 0.4, when: { minStakes: 0.4 } },
      { type: "fx", fx: "flare", at: t + run, dur: slide + hold, amount: 0.8 },
      { type: "sound", at: t + run + 0.1, cue: "crowd-roar" },
    ];
    const mates = c.ids.mates;
    mates.forEach((m, i) => {
      const s = i % 2 ? 1 : -1;
      const end: Vec3 = [SLIDE_END[0] + s * (0.75 + i * 0.25), 0, SLIDE_END[2] - 0.55 - i * 0.35];
      tr.push(
        { type: "move", actor: m, at: t + run * 0.6 + i * 0.2, dur: run + slide + 0.6, path: [end], gait: "sprint", ease: 0.4 },
        { type: "clip", actor: m, at: t + run * 1.6 + slide + i * 0.2, clip: i % 2 ? "celebrate" : "celebrate-fist", blendIn: 0.25, loop: true },
        { type: "face", actor: m, at: t + run, expression: "elated" },
        { type: "turn", actor: m, at: t + run * 1.6 + slide + i * 0.2, dur: 0.4, to: { actor: Y } },
        // the pile-on: a hand on his head / shoulder, leaning in
        { type: "reach", actor: m, hand: i % 2 ? "L" : "R", at: t + run + slide + 1.5 + i * 0.25, dur: hold - 1.5, target: { actor: Y, part: i === 0 ? "head" : i % 2 ? "shoulder.R" : "shoulder.L" }, offset: [0, 0.04, 0], grip: "flat", blendIn: 0.35 },
        { type: "pose", actor: m, at: t + run + slide + 1.5 + i * 0.25, dur: hold - 1.5, pose: "lean-in", amount: 0.6 },
      );
    });
    return {
      name: `Celebrates (${style})`, act: "reaction", dur: d, tracks: tr,
      cast: mates.map((m, i) => ({ id: m, role: "teammate", mark: [3 + i * 1.2, 0, 9 + i * 0.8] as Vec3, face: 180 })),
      shots: [
        { at: t, dur: run, purpose: "follow", subject: you(c), weight: 0.7, name: "Wheels away" },
        { at: t + run, dur: slide + 1.0, purpose: "hero", subject: you(c), weight: 1, name: "The slide · low", hint: { preset: "low-hero", yaw: 6, lens: 26 } },
        { at: t + run + slide + 1.0, dur: 1.3, purpose: "emotion", subject: you(c), weight: 0.9, name: "The roar", hint: { preset: "close" } },
        { at: t + run + slide + 2.3, dur: hold - 2.3, purpose: "crowd", subject: you(c), weight: 0.8, name: "The pile-on", hint: { preset: "medium-wide", yaw: 150, move: "orbit-left", moveAmount: 25 } },
      ],
    };
  },
};

export const trophyLift: BeatDef = {
  id: "trophy-lift", act: "moment", at: ["pitch", "awards-stage"],
  weight: (e) => (e.kind === "won-trophy" || e.kind === "promoted" ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you;
    const d = 6.4;
    const cup = c.ev.detail?.trophy === "league" ? "trophy-league" : "trophy-cup";
    const mates = c.ids.mates;
    const tr: Track[] = [
      { type: "place", actor: Y, at: t, to: "podium", yaw: 180 },
      { type: "clip", actor: Y, at: t, clip: "idle" },
      { type: "pose", actor: Y, at: t, dur: 1.6, pose: "trophy-chest", prop: "trophy", blendIn: 0.1 },
      { type: "pose", actor: Y, at: t + 1.4, dur: d - 1.4, pose: "trophy-overhead", prop: "trophy", blendIn: 0.35 },
      { type: "look", actor: Y, at: t, dur: 1.6, target: { prop: "trophy" }, amount: 0.8 },
      { type: "look", actor: Y, at: t + 1.6, dur: d, target: { point: [0, 9, 20] }, amount: 0.5 },
      { type: "face", actor: Y, at: t, expression: "proud", dur: 1.5 },
      { type: "face", actor: Y, at: t + 1.5, expression: "shout", amount: 1 },
      { type: "fx", fx: "ticker-tape", at: t + 1.6, dur: d - 1.6, around: { mark: "podium" }, amount: 1 },
      { type: "fx", fx: "camera-flashes", at: t + 0.6, dur: d - 0.6, around: { point: [0, 1.2, 33] }, amount: 0.8 },
      { type: "fx", fx: "fireworks", at: t + 1.8, dur: d - 1.8, around: { mark: "podium" }, when: { flag: "night" } },
      { type: "sound", at: t + 1.6, cue: "crowd-roar" },
    ];
    mates.forEach((m, i) => {
      // round him and behind (he faces −z, the cameras are in front): never between him and the lens
      const a = ((i + 0.5) / Math.max(1, mates.length) - 0.5) * 3.4;
      tr.push(
        { type: "place", actor: m, at: t, to: [Math.sin(a) * 1.9, 0, 40 + Math.cos(a) * 1.3 + 0.3], yaw: { actor: Y } },
        { type: "pose", actor: m, at: t, dur: 1.5, pose: "applaud" },
        { type: "clip", actor: m, at: t + 1.5 + i * 0.07, clip: i % 2 ? "cheer" : "celebrate", loop: true, blendIn: 0.3 },
        { type: "face", actor: m, at: t + 1.5, expression: "elated" },
      );
    });
    return {
      name: "Lifts the trophy", act: "moment", dur: d, tracks: tr,
      props: [{ id: "trophy", kind: cup as PropSpec["kind"], at: undefined }],
      cast: mates.map((m) => ({ id: m, role: "teammate" as const, mark: "podium" })),
      shots: [
        { at: t, dur: 1.5, purpose: "emotion", subject: you(c), weight: 0.8, name: "Looks at it" },
        { at: t + 1.5, dur: 2.6, purpose: "hero", subject: you(c), weight: 1, name: "Up it goes", hint: { preset: "low-hero", lens: 24, move: "crane-up", moveAmount: 0.6 } },
        { at: t + 4.1, dur: d - 4.1, purpose: "crowd", subject: you(c), weight: 0.7, name: "The champions", hint: { preset: "wide", move: "orbit-left", moveAmount: 30 } },
      ],
    };
  },
};

// ═════════════════════════════ THE TUNNEL ═══════════════════════════════

export const tunnelLineUp: BeatDef = {
  id: "tunnel-line-up", act: "setup", at: ["tunnel"],
  weight: (e) => (["walkout", "debut", "rivalry"].includes(e.kind) ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you;
    const d = 3.4;
    const tr: Track[] = [
      { type: "place", actor: Y, at: t, to: "you.start", yaw: 0 },
      { type: "clip", actor: Y, at: t, clip: "idle" },
      { type: "look", actor: Y, at: t, dur: 1.8, target: { mark: "mouth", y: 1.6 }, amount: 0.8 },
      { type: "face", actor: Y, at: t, expression: c.ev.emotion === "tension" ? "tense" : "focused", amount: 1 },
      { type: "pose", actor: Y, at: t + 1.6, dur: 1.4, pose: "lean-back", amount: 0.5 },
      { type: "sound", at: t, cue: "crowd-murmur" },
    ];
    const casts: CastMember[] = [];
    for (let i = 0; i < 5; i++) {
      const h = `home${i}`, a = `away${i}`;
      if (i !== 1) casts.push({ id: h, role: i === 0 ? "captain" : "teammate", mark: `home.${i}`, face: 0 });
      casts.push({ id: a, role: "rival", mark: `away.${i}`, face: 0 });
      if (i !== 1) tr.push({ type: "clip", actor: h, at: 0, clip: "idle", from: i * 0.7 });
      tr.push({ type: "clip", actor: a, at: 0, clip: "idle", from: i * 0.9 + 0.3 });
    }
    if (c.ev.rivalPresent) tr.push({ type: "look", actor: "away1", at: t + 0.8, dur: 2, target: { actor: Y, part: "eyes" }, amount: 0.9 }, { type: "look", actor: Y, at: t + 1.9, dur: 1.4, target: { actor: "away1", part: "eyes" }, amount: 0.8 }, { type: "face", actor: "away1", at: t, expression: "smirk" });
    return {
      name: "In the tunnel", act: "setup", dur: d, tracks: tr, cast: casts,
      shots: [
        { at: t, dur: 1.6, purpose: "establish", subject: you(c), weight: 1, name: "The tunnel", hint: { preset: "wide", lens: 24, yaw: 160 } },
        { at: t + 1.6, dur: d - 1.6, purpose: "emotion", subject: you(c), subject2: c.ev.rivalPresent ? { actor: "away1" } : undefined, weight: 1, name: "The breath" },
      ],
    };
  },
};

export const walkOut: BeatDef = {
  id: "walk-out", act: "moment", at: ["tunnel"],
  weight: (e) => (["walkout", "debut", "rivalry"].includes(e.kind) ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you;
    const d = 6.2;
    const tr: Track[] = [];
    const walkers: [string, string][] = [["home0", "home.0"], [Y, "you.start"], ["home2", "home.2"], ["home3", "home.3"], ["home4", "home.4"], ["away0", "away.0"], ["away1", "away.1"], ["away2", "away.2"], ["away3", "away.3"], ["away4", "away.4"]];
    walkers.forEach(([id, mk], i) => {
      const home = id === Y || id.startsWith("home");
      const row = home ? ["home0", Y, "home2", "home3", "home4"].indexOf(id) : Number(id.slice(4));
      const delay = row * 0.35 + (home ? 0 : 0.1);
      const x = home ? -0.55 : 0.55;
      void mk; void i;
      tr.push({ type: "move", actor: id, at: t + delay, dur: d - delay, path: [[x, 0, 15.5 - row * 1.0], [x * 1.4, 0, 24 - row * 1.0]], gait: "walk", ease: 0.25 });
    });
    tr.push(
      { type: "light", at: t + 2.5, dur: d - 2.5, exposure: 1.25 },
      { type: "fx", fx: "flare", at: t + 2.2, dur: d - 2.2, amount: 1 },
      { type: "look", actor: Y, at: t + 3.4, dur: d - 3.4, target: { point: [-6, 12, 40] }, amount: 0.6 },
      { type: "face", actor: Y, at: t + 3.6, expression: c.valence < 0 ? "determined" : "smile", amount: 0.8 },
      { type: "sound", at: t + 2.4, cue: "crowd-roar" },
    );
    return {
      name: "Out into the light", act: "moment", dur: d, tracks: tr,
      shots: [
        { at: t, dur: 2.4, purpose: "follow", subject: you(c), weight: 0.8, name: "Down the tunnel", hint: { preset: "medium", yaw: 165, move: "follow" } },
        { at: t + 2.4, dur: 2.0, purpose: "hero", subject: you(c), weight: 1, name: "The light", hint: { preset: "low-hero", yaw: 0, lens: 22, move: "follow" } },
        { at: t + 4.4, dur: d - 4.4, purpose: "establish", subject: you(c), weight: 0.8, name: "The stadium", hint: { preset: "wide", yaw: 200, move: "crane-up", moveAmount: 2 } },
      ],
    };
  },
};

// ═════════════════════════════ THE PRESS ROOM ═══════════════════════════

export const pressQuestion: BeatDef = {
  id: "press-question", act: "build", at: ["press-room"],
  weight: (e) => (e.kind === "press-conference" || e.kind === "transfer-request" || e.kind === "rivalry" ? 1 : 0.3),
  build: (c, t) => {
    const Y = c.ids.you;
    const d = 3.0;
    const q = c.ev.detail?.question ?? "How does it feel?";
    return {
      name: "The question", act: "build", dur: d,
      cast: [{ id: "jour", role: "journalist", mark: "journalist", face: 180 }],
      tracks: [
        { type: "clip", actor: Y, at: 0, clip: "sit" },
        { type: "pose", actor: Y, at: 0, dur: 20, pose: "lean-in", amount: 0.25, blendIn: 0 },
        { type: "reach", actor: Y, hand: "R", at: 0, dur: 30, target: { actor: Y, local: [-0.2, 0.775, 0.42] }, along: [0.25, -0.15, 1], palm: [0.15, -1, 0.05], blendIn: 0 },
        { type: "reach", actor: Y, hand: "L", at: 0, dur: 30, target: { actor: Y, local: [0.2, 0.775, 0.42] }, along: [-0.25, -0.15, 1], palm: [-0.15, -1, 0.05], blendIn: 0 },
        { type: "clip", actor: "jour", at: 0, clip: "talk-boss", loop: true },
        { type: "speak", actor: "jour", at: t + 0.3, dur: 2.2, line: q },
        { type: "caption", at: t + 0.3, dur: 2.4, text: q, style: "subtitle", speaker: "Journalist" },
        { type: "look", actor: Y, at: t, dur: d, target: { actor: "jour", part: "head" }, amount: 0.8 },
        { type: "fx", fx: "camera-flashes", at: t, dur: d, around: { point: [0, 1.4, 3.6] }, amount: 0.5 },
      ],
      shots: [
        { at: t, dur: 1.2, purpose: "establish", subject: you(c), weight: 1, name: "The press room" },
        { at: t + 1.2, dur: d - 1.2, purpose: "two", subject: { actor: "jour" }, subject2: you(c), weight: 0.9, name: "The question" },
      ],
    };
  },
};

export const pressAnswer: BeatDef = {
  id: "press-answer", act: "moment", at: ["press-room"],
  weight: (e) => (e.kind === "press-conference" ? 1 : 0.5),
  build: (c, t) => {
    const Y = c.ids.you;
    const a = c.ev.detail?.answer ?? (c.valence >= 0 ? "We go again. This is only the start." : "I'll let my football do the talking.");
    const d = Math.max(3.2, 1.2 + a.length * 0.055);
    const perf = performFor(c.ev.emotion, c.ev.intensity ?? 0.5, c.valence);
    return {
      name: "The answer", act: "moment", dur: d,
      tracks: [
        { type: "speak", actor: Y, at: t + 0.3, dur: d - 0.6, line: a },
        { type: "caption", at: t + 0.3, dur: d - 0.4, text: a, style: "subtitle", speaker: "{player}" },
        { type: "look", actor: Y, at: t, dur: d, target: { mark: "journalist", y: 1.2 }, amount: 0.75 },
        { type: "face", actor: Y, at: t, expression: perf.face === "elated" ? "smile" : perf.face, amount: 0.9 },
        { type: "pose", actor: Y, at: t + 0.2, dur: d, pose: "lean-in", amount: 0.4 },
        { type: "fx", fx: "camera-flashes", at: t, dur: d, around: { point: [0, 1.4, 3.6] }, amount: 0.7 },
        { type: "sound", at: t + 0.1, cue: "camera-shutters" },
      ],
      shots: [
        { at: t, dur: d * 0.5, purpose: "emotion", subject: you(c), weight: 1, name: "The answer" },
        { at: t + d * 0.5, dur: d * 0.5, purpose: "emotion", subject: you(c), weight: 0.9, name: "Close", hint: { move: "push" } },
      ],
    };
  },
};

// ═════════════════════════════ PEOPLE BEATS (anywhere) ══════════════════

export const walkIn: BeatDef = {
  id: "walk-in", act: "setup", at: ["airport", "training-ground", "garden", "dressing-room", "awards-stage"],
  weight: (e) => (["arrival", "award", "mentor-advice", "sacked", "dropped"].includes(e.kind) ? 0.9 : 0.3),
  build: (c, t) => {
    const Y = c.ids.you;
    const route: Record<string, [string | Vec3, string | Vec3]> = {
      airport: ["doors", "walk.end"], "training-ground": [[2.5, 0, -6], "you"], garden: ["door", "lawn"],
      "dressing-room": ["door", "centre"], "awards-stage": ["steps", "stage.centre"],
    };
    const [a, b] = route[c.loc] ?? [[0, 0, -4], [0, 0, 0]];
    const d = 3.6;
    const arrival = c.ev.kind === "arrival";
    return {
      name: "Walks in", act: "setup", dur: d,
      tracks: [
        { type: "place", actor: Y, at: t, to: a },
        { type: "move", actor: Y, at: t, dur: d, path: c.loc === "awards-stage" ? ["steps.top", b] : [b], gait: c.valence < 0 ? "walk-sad" : "walk" },
        ...(arrival ? [
          { type: "pose", actor: Y, at: t + 1.0, dur: d - 1.0, pose: "salute-crowd", amount: 0.9 } as Track,
          { type: "fx", fx: "camera-flashes", at: t, dur: d, around: { mark: "fans.L" }, amount: 1 } as Track,
          { type: "sound", at: t + 0.2, cue: "fans-chant" } as Track,
        ] : []),
        { type: "face", actor: Y, at: t, expression: c.valence < 0 ? "disappointed" : arrival ? "grin" : "focused", amount: 0.8 },
      ],
      shots: [
        { at: t, dur: d * 0.45, purpose: "establish", subject: you(c), weight: 1, name: "Arrives" },
        { at: t + d * 0.45, dur: d * 0.55, purpose: "follow", subject: you(c), weight: 0.8, name: "Walks in", hint: { move: "follow" } },
      ],
    };
  },
};

/** The mentor's word: he stops you, eye contact, one line, you nod, a hand on your shoulder, he walks off; you watch him go. */
export const mentorWord: BeatDef = {
  id: "mentor-word", act: "moment", at: ["training-ground", "tunnel", "dressing-room", "pitch"],
  weight: (e) => (e.kind === "mentor-advice" ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you, M = c.ids.other ?? "mentor";
    const line = c.ev.detail?.answer ?? VOICE_LINES["mentor-line"].text;
    const rec = Object.entries(VOICE_LINES).find(([, v]) => v.text === line);
    const talk = rec ? rec[1].duration + 0.3 : Math.max(2.4, 0.8 + line.length * 0.06);
    const d = 1.6 + talk + 1.4 + 2.6;
    const tS = t + 1.6, tN = tS + talk, tH = tN + 0.2, tW = tN + 1.4;
    return {
      name: "The word", act: "moment", dur: d,
      tracks: [
        { type: "move", actor: M, at: t, dur: 1.6, path: [[0.0, 0, 0.55]], gait: "walk", ease: 0.6, facing: { actor: Y } },
        { type: "turn", actor: Y, at: t + 0.6, dur: 0.8, to: { actor: M } },
        { type: "look", actor: Y, at: t + 0.4, dur: d - 0.4, target: { actor: M, part: "eyes" }, amount: 0.95 },
        { type: "look", actor: M, at: t + 0.8, dur: tW - t, target: { actor: Y, part: "eyes" }, amount: 1 },
        { type: "speak", actor: M, at: tS, dur: talk, line, cue: rec?.[0] },
        { type: "caption", at: tS, dur: talk + 0.3, text: line, style: "subtitle", speaker: "The Icon" },
        ...(rec ? [{ type: "sound", at: tS, cue: rec[0] } as Track] : []),
        { type: "face", actor: M, at: t, expression: "focused", amount: 0.8 },
        { type: "face", actor: Y, at: tS, expression: "focused", amount: 0.9 },
        { type: "pose", actor: Y, at: tN - 0.1, dur: 1.6, pose: "nod", blendIn: 0.1 },
        { type: "reach", actor: M, hand: "R", at: tH, dur: 1.4, target: { actor: Y, part: "shoulder.L" }, offset: [0, 0.05, 0], grip: "flat", palm: [0, -1, 0.2], along: [-1, 0, 0.3], blendIn: 0.4, blendOut: 0.4 },
        { type: "face", actor: M, at: tH, expression: "smile", amount: 0.6 },
        { type: "move", actor: M, at: tW, dur: d - (tW - t), path: [[1.6, 0, -1.5], [3.2, 0, -5]], gait: "walk", ease: 0.3 },
        { type: "face", actor: Y, at: tW, expression: "determined", amount: 1 },
      ],
      shots: [
        { at: t, dur: 1.6, purpose: "two", subject: { actor: M }, subject2: you(c), weight: 0.8, name: "He stops you" },
        { at: tS, dur: talk * 0.55, purpose: "emotion", subject: { actor: M }, subject2: you(c), weight: 1, name: "His word", hint: { preset: "close" } },
        { at: tS + talk * 0.55, dur: talk * 0.45, purpose: "reaction", subject: you(c), subject2: { actor: M }, weight: 0.9, name: "You listen" },
        { at: tN, dur: 1.4, purpose: "detail", subject: you(c), subject2: { actor: M }, weight: 0.7, name: "Hand on the shoulder", hint: { preset: "ots" } },
        { at: tW, dur: d - (tW - t), purpose: "emotion", subject: you(c), subject2: { actor: M }, weight: 1, name: "Watches him go", hint: { preset: "medium-close", move: "push" } },
      ],
    };
  },
};

/** The manager breaks bad news: he talks, you take it, you leave. */
export const badNews: BeatDef = {
  id: "bad-news", act: "moment", at: ["office", "dressing-room"],
  weight: (e) => (e.kind === "dropped" || e.kind === "sacked" || e.kind === "transfer-request" ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you, O = c.ids.other!;
    const line = c.ev.detail?.answer ?? (c.ev.kind === "transfer-request" ? "If that's what you want, I won't stand in your way." : "You're not in the side on Saturday.");
    const d = 2 + line.length * 0.055 + 2.2;
    const perf = performFor(c.ev.emotion, c.ev.intensity ?? 0.6, c.valence);
    return {
      name: "The news", act: "moment", dur: d,
      tracks: [
        { type: "speak", actor: O, at: t + 0.3, dur: d - 2.5, line },
        { type: "caption", at: t + 0.3, dur: d - 2.4, text: line, style: "subtitle", speaker: "{manager}" },
        { type: "face", actor: O, at: t, expression: c.ev.kind === "transfer-request" ? "disappointed" : "tense", amount: 0.9 },
        { type: "face", actor: Y, at: t + 0.5, expression: perf.face, amount: 1 },
        ...(perf.pose ? [{ type: "pose", actor: Y, at: t + d - 2.2, dur: 2.2, pose: perf.pose, amount: 0.8 } as Track] : []),
        { type: "look", actor: Y, at: t, dur: d - 2.2, target: { actor: O, part: "eyes" }, amount: 0.9 },
        { type: "look", actor: O, at: t, dur: d, target: { actor: Y, part: "eyes" }, amount: 0.9 },
      ],
      shots: [
        { at: t, dur: (d - 2.2) * 0.55, purpose: "emotion", subject: other(c), subject2: you(c), weight: 1, name: "He tells you" },
        { at: t + (d - 2.2) * 0.55, dur: (d - 2.2) * 0.45, purpose: "reaction", subject: you(c), subject2: other(c), weight: 1, name: "You take it" },
        { at: t + d - 2.2, dur: 2.2, purpose: "hero", subject: you(c), weight: 0.8, name: "Alone with it" },
      ],
    };
  },
};

/** Applause for you (an award, a farewell, a record): the room claps, you salute them. */
export const applause: BeatDef = {
  id: "applause", act: "aftermath", at: ["awards-stage", "dressing-room", "press-room", "pitch"],
  weight: (e) => (["award", "record-broken", "retired", "won-trophy"].includes(e.kind) ? 0.9 : 0.15),
  build: (c, t) => {
    const Y = c.ids.you;
    const d = 3.2;
    return {
      name: "The applause", act: "aftermath", dur: d,
      tracks: [
        { type: "pose", actor: Y, at: t, dur: d, pose: c.valence >= 0 ? "salute-crowd" : "applaud", amount: 0.9 },
        { type: "face", actor: Y, at: t, expression: "smile", amount: 1 },
        ...c.ids.mates.map((m) => ({ type: "pose", actor: m, at: t, dur: d, pose: "applaud" } as Track)),
        { type: "fx", fx: "camera-flashes", at: t, dur: d, around: { actor: Y }, amount: 0.6 },
        { type: "sound", at: t, cue: "applause" },
      ],
      shots: [
        { at: t, dur: d * 0.5, purpose: "crowd", subject: you(c), weight: 0.7, name: "They stand for you" },
        { at: t + d * 0.5, dur: d * 0.5, purpose: "emotion", subject: you(c), weight: 1, name: "Takes it in" },
      ],
    };
  },
};

export const awardReceive: BeatDef = {
  id: "award-receive", act: "moment", at: ["awards-stage"],
  weight: (e) => (e.kind === "award" || e.kind === "record-broken" ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you, P = c.ids.other ?? "presenter";
    const d = 5.2;
    return {
      name: "Takes the award", act: "moment", dur: d,
      props: [{ id: "award", kind: "award-statue", at: [1.32, 1.98, -0.25] }],
      tracks: [
        { type: "place", actor: P, at: 0, to: "stage.presenter" },
        { type: "turn", actor: Y, at: t, dur: 0.6, to: { actor: P } },
        { type: "reach", actor: P, hand: "R", at: t, dur: 1.4, target: { prop: "award" }, grip: "grip", blendIn: 0.4 },
        { type: "prop", prop: "award", at: t + 1.0, action: "attach", actor: P, hand: "R", dur: 0.2 },
        { type: "prop", prop: "award", at: t + 2.2, action: "attach", actor: Y, hand: "R", dur: 0.3 },
        { type: "reach", actor: Y, hand: "R", at: t + 1.8, dur: 1.2, target: { prop: "award" }, grip: "grip", blendIn: 0.4 },
        { type: "pose", actor: Y, at: t + 2.8, dur: d - 2.8, pose: "fist-pump", amount: 0.6 },
        { type: "face", actor: Y, at: t, expression: "grin", amount: 1 },
        { type: "face", actor: P, at: t, expression: "smile", amount: 1 },
        { type: "look", actor: Y, at: t + 2.8, dur: d, target: { point: [0, 2, 8] }, amount: 0.7 },
        { type: "light", at: t, dur: d, spot: { target: { actor: Y }, intensity: 1.2 } },
        { type: "fx", fx: "camera-flashes", at: t + 2.4, dur: d - 2.4, around: { point: [0, 1.2, 4] }, amount: 1 },
        { type: "sound", at: t + 2.3, cue: "applause" },
      ],
      shots: [
        { at: t, dur: 2.2, purpose: "two", subject: you(c), subject2: { actor: P }, weight: 0.9, name: "The handover" },
        { at: t + 2.2, dur: d - 2.2, purpose: "hero", subject: you(c), weight: 1, name: "Holds it up" },
      ],
    };
  },
};

/** You down on the grass, the physio comes, you limp away. */
export const injuryBeat: BeatDef = {
  id: "injury-down", act: "moment", at: ["pitch", "training-ground"],
  weight: (e) => (e.kind === "injured" ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you;
    const d = 5.4;
    return {
      name: "Goes down", act: "moment", dur: d,
      cast: [{ id: "physio", role: "physio", mark: [8, 0, 26], face: -90 }],
      tracks: [
        { type: "pose", actor: Y, at: t, dur: d, pose: "kneel", blendIn: 0.4 },
        { type: "pose", actor: Y, at: t + 0.2, dur: d, pose: "head-down", amount: 0.8 },
        { type: "reach", actor: Y, hand: "R", at: t + 0.3, dur: d, target: { actor: Y, part: "knee.R" }, grip: "flat", blendIn: 0.5 },
        { type: "face", actor: Y, at: t, expression: "tense", amount: 1 },
        { type: "move", actor: "physio", at: t + 0.5, dur: 2.6, path: [[1.0, 0, 16.2]], gait: "jog" },
        { type: "pose", actor: "physio", at: t + 3.2, dur: d - 3.2, pose: "kneel" },
        { type: "reach", actor: "physio", hand: "L", at: t + 3.3, dur: d - 3.3, target: { actor: Y, part: "shoulder.R" }, grip: "flat" },
        { type: "sound", at: t, cue: "crowd-gasp" },
      ],
      shots: [
        { at: t, dur: 2.2, purpose: "hero", subject: you(c), weight: 1, name: "Down", hint: { preset: "high-angle" } },
        { at: t + 2.2, dur: d - 2.2, purpose: "emotion", subject: you(c), weight: 1, name: "The pain" },
      ],
    };
  },
};

/** Two men face to face, nothing said. */
export const stareDown: BeatDef = {
  id: "stare-down", act: "build", at: ["tunnel", "pitch"],
  weight: (e) => (e.kind === "rivalry" || (e.rivalPresent && e.emotion === "defiance") ? 1 : 0),
  build: (c, t) => {
    const Y = c.ids.you, R = "away1";
    const d = 3.6;
    return {
      name: "Eye to eye", act: "build", dur: d,
      tracks: [
        { type: "turn", actor: Y, at: t, dur: 0.6, to: { actor: R } },
        { type: "turn", actor: R, at: t + 0.1, dur: 0.6, to: { actor: Y } },
        { type: "look", actor: Y, at: t, dur: d, target: { actor: R, part: "eyes" }, amount: 1 },
        { type: "look", actor: R, at: t, dur: d, target: { actor: Y, part: "eyes" }, amount: 1 },
        { type: "face", actor: Y, at: t, expression: "determined", amount: 1 },
        { type: "face", actor: R, at: t, expression: "smirk", amount: 1 },
      ],
      shots: [
        { at: t, dur: 1.2, purpose: "two", subject: you(c), subject2: { actor: R }, weight: 0.9, name: "Face to face" },
        { at: t + 1.2, dur: 1.2, purpose: "emotion", subject: { actor: R }, subject2: you(c), weight: 1, name: "Him", hint: { preset: "close", shake: 0.2 } },
        { at: t + 2.4, dur: 1.2, purpose: "emotion", subject: you(c), subject2: { actor: R }, weight: 1, name: "You", hint: { preset: "close", shake: 0.2 } },
      ],
    };
  },
};

export const BEATS: BeatDef[] = [
  officeSeated, contractSlide, signContract, handshake, shirtPhoto,
  goalStrike, goalCelebration, trophyLift, tunnelLineUp, walkOut,
  pressQuestion, pressAnswer, walkIn, mentorWord, badNews, applause, awardReceive, injuryBeat, stareDown,
];

/** Which events have a story (the planner's starting set). */
export const EVENT_KINDS_COVERED: EventKind[] = ["signed", "scored", "won-trophy", "promoted", "walkout", "debut", "rivalry", "press-conference", "arrival", "award", "record-broken", "injured", "dropped", "sacked", "transfer-request", "mentor-advice"];
