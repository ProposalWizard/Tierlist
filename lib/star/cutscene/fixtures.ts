/**
 * THE HAND-MADE SCENES — written on the system the same way any scene is:
 * the shared beats laid out (compose), with every camera shot chosen by hand.
 * They are the benchmark: the generator, given the matching event, must
 * score at least as well (tests/star/cutscene.mts).
 *
 *   signing   sit, the contract slides over, pick up the pen and sign your
 *             real signature, look up and smile, stand, shake hands, hold
 *             your shirt up for the cameras
 *   goal      the run on the ball, the strike into the top corner, the
 *             knee slide at golden hour, team-mates piling in
 *   trophy    the lift on the podium, ticker tape, flashes
 *   walkout   the tunnel, the breath, out into the light
 *   press     a question, your answer
 *   mentor    "The Icon" stops you on the training ground: one line, a nod,
 *             a hand on the shoulder, he walks off
 */
import type { CameraTrack, CutsceneScript, ShotSpec, StoryEvent, Target, Track } from "./types";
import { compose } from "./generate";
import { VOICE_LINES } from "./voiceLines";
import { frameTracks } from "./cinema";
import { goalCelebration, goalStrike, contractSlide, handshake, officeSeated, shirtPhoto, signContract, trophyLift, tunnelLineUp, walkOut, pressQuestion, pressAnswer, mentorWord, farewellWalk, applause } from "./beats";

const Y: Target = { actor: "you" };
const cam = (at: number, dur: number, shot: ShotSpec, name: string, cut: CameraTrack["cut"] = "cut", blend?: number): CameraTrack => ({ type: "camera", at, dur, shot, name, cut, blend });

export const FIXTURE_EVENTS: Record<string, StoryEvent> = {
  signing: { kind: "signed", stakes: 0.7, emotion: "pride", intensity: 0.6 },
  goal: { kind: "scored", stakes: 0.85, emotion: "joy", intensity: 0.9 },
  trophy: { kind: "won-trophy", stakes: 0.95, emotion: "joy", intensity: 1, detail: { trophy: "fa-cup" } },
  walkout: { kind: "walkout", stakes: 0.7, emotion: "tension", intensity: 0.6 },
  press: { kind: "press-conference", stakes: 0.4, emotion: "pride", intensity: 0.5, detail: { question: "Two goals on your debut. What's going through your head?", answer: "Honestly? I've dreamt about this since I was six." } },
  farewell: { kind: "retired", stakes: 0.9, emotion: "gratitude", intensity: 0.8 },
  mentor: { kind: "mentor-advice", stakes: 0.5, emotion: "inspired", intensity: 0.6, where: "training-ground", detail: { answer: "Talent gets you here. Hunger keeps you here." } },
};

function signing(): CutsceneScript {
  const ev = FIXTURE_EVENTS.signing;
  const ids = { you: "you", other: "boss", mates: [] };
  const c = compose([officeSeated, contractSlide, signContract, handshake, shirtPhoto], ev, ids, "office", 4, 0.4, {
    cast: [{ id: "you", role: "you", mark: "chair.you" }, { id: "boss", role: "manager", mark: "chair.boss" }],
    props: [{ id: "contract", kind: "contract", at: "contract.start", yaw: 180 }, { id: "pen", kind: "pen", at: "pen.rest", yaw: 0 },
      { id: "chairY", kind: "chair", at: "chairpos.you", yaw: 180 }, { id: "chairB", kind: "chair", at: "chairpos.boss", yaw: 0 }, { id: "shirt", kind: "shirt" }],
  });
  const [b0, b1, b2, b3, b4] = c.beats;
  const B: Target = { actor: "boss" };
  const writeAt = b2.at + 0.65 + 0.45;
  const cams: CameraTrack[] = [
    cam(0, b0.at + 1.5, { preset: "establishing", subject: Y, fixed: { pos: [1.95, 1.62, 2.15], look: [-0.2, 1.05, -0.6], lens: 22 }, move: "dolly-in", moveAmount: 0.12 }, "The office"),
    cam(b0.at + 1.5, b0.dur - 1.5, { preset: "ots", subject: B, subject2: Y, side: -1 }, "Over your shoulder"),
    cam(b1.at, b1.dur, { preset: "insert", subject: { prop: "contract" }, side: 1, yaw: 25, lens: 40, move: "push" }, "The contract"),
    cam(b2.at, writeAt - b2.at, { preset: "medium-close", subject: Y, subject2: B, side: 1, yaw: 8 }, "Reaches for the pen"),
    cam(writeAt, 2.6, { preset: "insert", subject: { prop: "contract" }, side: 1, yaw: 40, lens: 45, rise: 0.05, move: "dolly-in", moveAmount: 0.15 }, "The signature"),
    cam(writeAt + 2.6, b3.at - writeAt - 2.6, { preset: "close", subject: Y, subject2: B, side: 1, yaw: 4, lens: 65, move: "push" }, "Looks up"),
    cam(b3.at, 1.5, { preset: "two-shot", subject: Y, subject2: B, side: 1 }, "Both stand"),
    cam(b3.at + 1.5, 1.2, { preset: "insert", subject: { point: [-0.02, 1.08, 0] }, side: 1, yaw: 75, lens: 42 }, "The handshake"),
    cam(b3.at + 2.7, b3.dur - 2.7, { preset: "ots", subject: Y, subject2: B, side: 1, lens: 50 }, "Eye to eye"),
    cam(b4.at, b4.dur * 0.6, { preset: "full", subject: Y, fixed: { pos: [0.0, 1.4, 2.4], look: [0.0, 1.2, 1.2], lens: 18 } }, "The photo"),
    cam(b4.at + b4.dur * 0.6, c.duration - b4.at - b4.dur * 0.6, { preset: "medium-close", subject: Y, side: 1, yaw: -10, move: "push" }, "Your new number"),
  ];
  return {
    id: "fixture-signing", title: "Contract signing (hand-made)", duration: c.duration,
    set: { location: "office", mood: "golden-hour" }, cast: c.cast, props: c.props, beats: c.beats,
    tracks: [...c.tracks, ...cams, ...frameTracks(c.duration, ev.stakes), { type: "caption", at: b4.at + 0.4, dur: 2.6, text: "{player} · {club}", style: "lower-third" }],
    seed: 4, text: { seasons: "3", wage: "★2,500" }, source: { kind: "fixture", event: ev },
  };
}

function goal(): CutsceneScript {
  const ev = FIXTURE_EVENTS.goal;
  const ids = { you: "you", mates: ["mate0", "mate1", "mate2"] };
  const c = compose([goalStrike, goalCelebration], ev, ids, "pitch", 2, 0.3, { cast: [{ id: "you", role: "you", mark: "run.start" }], props: [] });
  const [b0, b1] = c.beats;
  const contact = b0.at + 2.4 + 0.31;
  const cams: CameraTrack[] = [
    // open close and moving (a broadcast cuts in within a second)
    cam(0, b0.at + 0.9, { preset: "medium-wide", subject: Y, side: -1, yaw: 25, move: "follow", lens: 35 }, "On the ball"),
    cam(b0.at + 0.9, contact - b0.at - 0.9 + 0.05, { preset: "ots", subject: { mark: "goal", y: 1.2 }, subject2: Y, side: 1, lens: 32, move: "follow" }, "Behind the shooter"),
    cam(contact + 0.05, 0.8, { preset: "wide", subject: { prop: "ball" }, fixed: { pos: [6.8, 1.2, 7.8], look: [1.4, 1.5, 0], lens: 26 } }, "Top corner"),
    cam(contact + 0.85, b1.at - contact - 0.85 + 1.5, { preset: "medium-wide", subject: Y, side: -1, yaw: 10, move: "follow" }, "Wheels away"),
    cam(b1.at + 1.5, 2.0, { preset: "low-hero", subject: Y, side: 1, yaw: 4, lens: 26, move: "dolly-in", moveAmount: 0.25 }, "The slide · low"),
    cam(b1.at + 3.5, 1.3, { preset: "close", subject: Y, side: 1, yaw: -12, lens: 60, move: "push", shake: 0.15 }, "The roar"),
    cam(b1.at + 4.8, c.duration - b1.at - 4.8, { preset: "medium-wide", subject: Y, side: 1, yaw: 35, lens: 30, move: "orbit-left", moveAmount: 28 }, "The pile-on"),
  ];

  return {
    id: "fixture-goal", title: "Goal celebration (hand-made)", duration: c.duration,
    set: { location: "pitch", mood: "golden-hour" }, cast: c.cast, props: c.props, beats: c.beats,
    tracks: [...c.tracks, ...cams, ...frameTracks(c.duration, ev.stakes)], seed: 2, source: { kind: "fixture", event: ev },
  };
}

function trophy(): CutsceneScript {
  const ev = FIXTURE_EVENTS.trophy;
  const ids = { you: "you", mates: ["mate0", "mate1", "mate2", "mate3", "mate4"] };
  const c = compose([trophyLift], ev, ids, "pitch", 5, 0.3, { cast: [{ id: "you", role: "captain", mark: "podium" }], props: [] });
  const [b0] = c.beats;
  const cams: CameraTrack[] = [
    cam(0, b0.at + 1.5, { preset: "medium", subject: Y, side: 1, yaw: 15, move: "push" }, "The cup"),
    cam(b0.at + 1.5, 2.6, { preset: "low-hero", subject: Y, side: 1, lens: 22, move: "crane-up", moveAmount: 0.5 }, "Up it goes"),
    cam(b0.at + 4.1, 1.2, { preset: "close", subject: Y, side: -1, lens: 70 }, "The roar"),
    cam(b0.at + 5.3, c.duration - b0.at - 5.3, { preset: "wide", subject: Y, side: 1, move: "orbit-left", moveAmount: 30 }, "Champions"),
  ];
  return {
    id: "fixture-trophy", title: "Trophy lift (hand-made)", duration: c.duration,
    set: { location: "pitch", mood: "golden-hour" }, cast: c.cast, props: c.props, beats: c.beats,
    tracks: [...c.tracks, ...cams, ...frameTracks(c.duration, ev.stakes)], seed: 5, source: { kind: "fixture", event: ev },
  };
}

function walkout(): CutsceneScript {
  const ev = FIXTURE_EVENTS.walkout;
  const ids = { you: "you", mates: [] };
  const c = compose([tunnelLineUp, walkOut], ev, ids, "tunnel", 3, 0.3, { cast: [{ id: "you", role: "you", mark: "you.start" }], props: [] });
  const [b0, b1] = c.beats;
  const cams: CameraTrack[] = [
    cam(0, b0.at + 1.6, { preset: "wide", subject: Y, fixed: { pos: [0.9, 1.9, 14.5], look: [-0.3, 1.3, 6], lens: 24 }, move: "dolly-in", moveAmount: 0.1 }, "The tunnel"),
    cam(b0.at + 1.6, b0.dur - 1.6, { preset: "close", subject: Y, side: 1, yaw: 10, lens: 60, move: "push" }, "The breath"),
    cam(b1.at, 2.4, { preset: "medium", subject: Y, side: 1, yaw: 160, move: "follow" }, "Down the tunnel"),
    cam(b1.at + 2.4, 2.0, { preset: "low-hero", subject: Y, side: 1, lens: 22, move: "follow" }, "The light"),
    cam(b1.at + 4.4, c.duration - b1.at - 4.4, { preset: "wide", subject: Y, side: -1, yaw: 190, move: "crane-up", moveAmount: 1.5 }, "The stadium"),
  ];
  return {
    id: "fixture-walkout", title: "Walk-out (hand-made)", duration: c.duration,
    set: { location: "tunnel", mood: "golden-hour" }, cast: c.cast, props: c.props, beats: c.beats,
    tracks: [...c.tracks, ...cams, ...frameTracks(c.duration, ev.stakes)], seed: 3, source: { kind: "fixture", event: ev },
  };
}

function press(): CutsceneScript {
  const ev = FIXTURE_EVENTS.press;
  const ids = { you: "you", mates: [] };
  const c = compose([pressQuestion, pressAnswer], ev, ids, "press-room", 6, 0.3, { cast: [{ id: "you", role: "you", mark: "seat.you", look: { outfit: "tracksuit" } }], props: [{ id: "mic", kind: "mic-stand", at: "mic.you", yaw: 180 }] });
  const [b0, b1] = c.beats;
  const J: Target = { actor: "jour" };
  const cams: CameraTrack[] = [
    cam(0, b0.at + 1.2, { preset: "establishing", subject: Y, fixed: { pos: [2.4, 1.8, 5.2], look: [0, 1.0, -0.4], lens: 24 }, move: "dolly-in", moveAmount: 0.12 }, "The press room"),
    cam(b0.at + 1.2, b0.dur - 1.2, { preset: "medium", subject: J, subject2: Y, side: -1 }, "The question"),
    cam(b1.at, b1.dur * 0.5, { preset: "medium", subject: Y, subject2: J, side: 1 }, "The answer"),
    cam(b1.at + b1.dur * 0.5, c.duration - b1.at - b1.dur * 0.5, { preset: "close", subject: Y, subject2: J, side: 1, lens: 70, move: "push" }, "Close"),
  ];
  return {
    id: "fixture-press", title: "Press conference (hand-made)", duration: c.duration,
    set: { location: "press-room", mood: "interior-cool" }, cast: c.cast, props: c.props, beats: c.beats,
    tracks: [...c.tracks, ...cams, ...frameTracks(c.duration, ev.stakes)], seed: 6, source: { kind: "fixture", event: ev },
  };
}

function mentor(): CutsceneScript {
  const ev = FIXTURE_EVENTS.mentor;
  const ids = { you: "you", other: "mentor", mates: [] };
  const c = compose([mentorWord], ev, ids, "training-ground", 7, 0.5, {
    cast: [{ id: "you", role: "you", mark: [0, 0, 1.2], face: 200, look: { outfit: "tracksuit" } }, { id: "mentor", role: "mentor", mark: [-1.4, 0, -2.2], face: "you" }], props: [],
  });
  const [b0] = c.beats;
  const M: Target = { actor: "mentor" };
  const tS = b0.at + 1.6, talk = VOICE_LINES["mentor-line"].duration + 0.3, tN = tS + talk, tW = tN + 1.4;
  const cams: CameraTrack[] = [
    cam(0, tS, { preset: "two-shot", subject: Y, subject2: M, side: 1, move: "push" }, "He stops you"),
    cam(tS, talk * 0.6, { preset: "close", subject: M, subject2: Y, side: -1, lens: 70, move: "push" }, "His word"),
    cam(tS + talk * 0.6, talk * 0.4, { preset: "close", subject: Y, subject2: M, side: 1, lens: 70 }, "You listen"),
    cam(tN, 1.4, { preset: "ots", subject: Y, subject2: M, side: 1, lens: 45 }, "Hand on the shoulder"),
    cam(tW, c.duration - tW, { preset: "medium-close", subject: Y, subject2: M, side: 1, yaw: -20, move: "push" }, "Watches him go"),
  ];
  return {
    id: "fixture-mentor", title: "The Icon (hand-made)", duration: c.duration,
    set: { location: "training-ground", mood: "golden-hour" }, cast: c.cast, props: c.props, beats: c.beats,
    tracks: [...c.tracks, ...cams, ...frameTracks(c.duration, ev.stakes)] as Track[], seed: 7, source: { kind: "fixture", event: ev },
  };
}

/** The farewell: the last walk down a guard of honour, then the stadium stands for you. */
function farewell(): CutsceneScript {
  const ev = FIXTURE_EVENTS.farewell;
  const mates = ["mate0", "mate1", "mate2", "mate3", "mate4", "mate5"];
  const c = compose([farewellWalk, applause], ev, { you: "you", mates }, "pitch", 8, 0.3, { cast: [{ id: "you", role: "you", mark: [0, 0, 47] }], props: [] });
  const [b0, b1] = c.beats;
  const cams: CameraTrack[] = [
    cam(0, b0.at + 1.8, { preset: "wide", subject: Y, side: 1, yaw: 160, lens: 24, rise: 1.2, move: "dolly-in", moveAmount: 0.3 }, "The stadium"),
    cam(b0.at + 1.8, 2.0, { preset: "medium", subject: Y, side: 1, yaw: 10, move: "follow" }, "Down the guard"),
    cam(b0.at + 3.8, 1.6, { preset: "low-hero", subject: Y, side: 1, lens: 24, move: "crane-up", moveAmount: 0.4 }, "One last look"),
    cam(b0.at + 5.4, b1.at - b0.at - 5.4 + 1.6, { preset: "wide", subject: Y, side: -1, yaw: 190, move: "orbit-left", moveAmount: 20 }, "They stand for you"),
    cam(b1.at + 1.6, c.duration - b1.at - 1.6, { preset: "close", subject: Y, side: 1, lens: 68, move: "push" }, "Goodbye"),
  ];
  return {
    id: "fixture-farewell", title: "Farewell (hand-made)", duration: c.duration,
    set: { location: "pitch", mood: "golden-hour" }, cast: c.cast, props: c.props, beats: c.beats,
    tracks: [...c.tracks, ...cams, ...frameTracks(c.duration, ev.stakes)], seed: 8, source: { kind: "fixture", event: ev },
  };
}

export const FIXTURES: Record<string, () => CutsceneScript> = { signing, goal, trophy, walkout, press, mentor, farewell };
export const FIXTURE_LIST: { id: string; name: string }[] = [
  { id: "signing", name: "Contract signing" }, { id: "goal", name: "Goal celebration" }, { id: "trophy", name: "Trophy lift" },
  { id: "walkout", name: "Walk-out" }, { id: "press", name: "Press conference" }, { id: "mentor", name: "The Icon" }, { id: "farewell", name: "Farewell" },
];
