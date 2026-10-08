/**
 * GOALS FROM MATCHES YOU DID NOT PLAY (Leo, 8 Oct 2026: "videos for other
 * games on social media would make it feel more real and fun and
 * interesting than just a score for a fake simulated match").
 *
 * The other matches are simulated as a score and a list of scorers, so there
 * is no recording of how their goals went in. This makes one: a short,
 * believable move for the goal (a run in on goal, a header from a cross, a
 * long-range strike, a cut-back tapped in, a penalty), seeded from the goal
 * itself so the same goal always looks the same, and fed through the real
 * GoalRecorder — so it is drawn, cut, voiced and saved exactly like a goal
 * you played. It moves men and a ball along simple paths; it never touches
 * the match engine (lib/star/canvasEngine.ts), and nothing in it is a game.
 */
import { CX } from "../pitch";
import { kitsOf, keeperKit } from "../kits";
import { GoalRecorder } from "./recorder";
import { CLIP_FPS, type ClipBody, type FrameState, type GoalTrack, type Pt3 } from "./track";
import type { SaveKind } from "../canvasEngine";

export type SynthKind = "run_in" | "header" | "long_range" | "tap_in" | "penalty";

export interface SynthGoal {
  /** The match. */
  home: string;
  away: string;
  /** Who scored, and for which side. */
  scorer: string;
  scorerShort: string;
  scorerHome: boolean;
  minute: number;
  /** The score once it went in, [home, away], when known. */
  scoreAfter?: [number, number];
  competition?: string;
  season?: number;
  week?: number;
  /** Fixes the move: the same seed is the same goal. */
  seed: string;
  kind?: SynthKind;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function rngOf(seed: string): () => number {
  let a = hashStr(seed) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KINDS: SynthKind[] = ["run_in", "run_in", "header", "long_range", "tap_in", "tap_in", "penalty"];

const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.max(0, Math.min(1, k));
const ease = (k: number) => { const c = Math.max(0, Math.min(1, k)); return c * c * (3 - 2 * c); };
const at = (p: Pt3): Pt3 => ({ x: p.x, y: p.y, z: p.z });
const P = (x: number, y: number, z = 0): Pt3 => ({ x, y, z });
const along = (a: Pt3, b: Pt3, k: number): Pt3 => P(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k));

/** A path through timed points, eased between them. */
function path(points: [number, Pt3][]): (t: number) => Pt3 {
  return (t: number) => {
    if (t <= points[0][0]) return at(points[0][1]);
    for (let i = 1; i < points.length; i++) {
      const [t1, p1] = points[i];
      const [t0, p0] = points[i - 1];
      if (t <= t1) return along(p0, p1, ease((t - t0) / Math.max(1e-6, t1 - t0)));
    }
    return at(points[points.length - 1][1]);
  };
}

/** A ball struck at `t0` from `a` arriving at `b` at `t1`, peaking `lift` metres above the straight line. */
function flight(a: Pt3, b: Pt3, t0: number, t1: number, lift: number): (t: number) => Pt3 {
  return (t: number) => {
    const k = Math.max(0, Math.min(1, (t - t0) / Math.max(1e-6, t1 - t0)));
    const p = along(a, b, k);
    p.z += lift * 4 * k * (1 - k);
    return p;
  };
}

interface Plan {
  kind: SynthKind;
  /** Body ids, in order: run0 (scorer), mate0, def0..def2, keeper. */
  bodies: ((t: number) => Pt3)[];
  ball: (t: number) => Pt3;
  goalT: number;
  strikeT: number;
  /** Ball events: [time, kind, who, mode]. */
  events: [number, "pass" | "shot" | "touch", string, string?][];
  /** Where the shot ends up in the goal, and when the keeper goes. */
  target: Pt3;
  keeperGo: number;
  keeperFrom: Pt3;
}

/** Where a shot finishes: inside the posts, away from the keeper. */
function aimFor(rng: () => number, keeperX: number, high: boolean): Pt3 {
  const side = keeperX <= CX ? 1 : -1;
  const x = CX + side * (1.6 + rng() * 1.8);
  const z = high ? 1.4 + rng() * 0.8 : 0.15 + rng() * 0.6;
  return P(x, -0.2, z);
}

function planFor(kind: SynthKind, rng: () => number): Plan {
  const flip = rng() < 0.5 ? -1 : 1;
  const side = (dx: number) => CX + flip * dx;
  const keeperHome = P(CX + flip * (rng() * 0.6 - 0.3), 1.2);

  if (kind === "penalty") {
    const strikeT = 1.5, goalT = 1.95;
    const spot = P(CX, 11);
    const target = aimFor(rng, CX + (rng() < 0.5 ? 0.5 : -0.5), rng() < 0.4);
    // He goes the wrong way: towards the other side from the ball.
    const keeperGoTo = P(CX - Math.sign(target.x - CX) * 0.6, 0.6);
    return {
      kind, strikeT, goalT, target, keeperGo: strikeT - 0.05, keeperFrom: P(CX, 0.6),
      bodies: [
        path([[0, P(CX - 2.4 * flip, 14.2)], [0.9, P(CX - 2.4 * flip, 14.2)], [strikeT, P(CX - 0.4 * flip, 11.6)], [goalT + 1.5, P(CX - 5 * flip, 15)]]),
        path([[0, P(side(8), 19.5)], [3.5, P(side(6), 19)]]),
        path([[0, P(side(-6), 19.2)], [goalT, P(side(-6), 18.6)], [3.5, P(side(-7), 18)]]),
        path([[0, P(CX + 3, 20)], [goalT, P(CX + 3, 19.5)]]),
        path([[0, P(CX - 4, 20.5)], [goalT, P(CX - 3.5, 20)]]),
        path([[0, P(CX, 0.6)], [strikeT - 0.05, P(CX, 0.6)], [goalT, keeperGoTo]]),
      ],
      ball: (t) => t < strikeT ? at(spot) : t < goalT ? flight(spot, target, strikeT, goalT, 0.3)(t) : P(target.x, Math.max(-1.4, -0.2 - (t - goalT) * 3), Math.max(0.11, target.z - (t - goalT) * 2)),
      events: [[strikeT, "shot", "run0"]],
    };
  }

  if (kind === "header") {
    const crossT = 1.25, strikeT = 2.25, goalT = 2.62;
    const winger = P(side(24), 7);
    const meet = P(side(-1 - rng() * 2), 7.5 + rng() * 2, 2.1);
    // Away from where the keeper has got to when it is headed.
    const target = aimFor(rng, side(0.8), rng() < 0.5);
    return {
      kind, strikeT, goalT, target, keeperGo: strikeT + 0.05, keeperFrom: keeperHome,
      bodies: [
        path([[0, P(side(-6), 17)], [crossT, P(side(-4), 13)], [strikeT, P(meet.x, meet.y + 0.3)], [goalT + 1.6, P(side(-14), 10)]]),
        path([[0, P(side(28), 14)], [crossT, at(winger)], [3.5, P(side(22), 6)]]),
        path([[0, P(side(-3), 15)], [strikeT, P(meet.x + 1.1 * flip, meet.y + 1.2)], [3.5, P(meet.x + 1.5, meet.y + 1)]]),
        path([[0, P(side(3), 12)], [strikeT, P(side(1.5), 8)], [3.5, P(side(1), 7)]]),
        path([[0, P(side(18), 12)], [crossT, P(side(21), 9)], [3.5, P(side(20), 8)]]),
        path([[0, keeperHome], [crossT, P(side(2), 1)], [strikeT, P(side(0.8), 1.4)]]),
      ],
      ball: (t) => t < crossT ? along(P(side(28), 14.3), winger, ease(t / crossT))
        : t < strikeT ? flight(winger, meet, crossT, strikeT, 3.2)(t)
          : t < goalT ? flight(meet, target, strikeT, goalT, 0)(t)
            : P(target.x, Math.max(-1.4, -0.2 - (t - goalT) * 3), Math.max(0.11, target.z - (t - goalT) * 2)),
      events: [[crossT, "pass", "mate0"], [strikeT, "shot", "run0", "header"]],
    };
  }

  if (kind === "long_range") {
    const passT = 0.75, strikeT = 1.95, goalT = 2.85;
    const recv = P(side(-6 - rng() * 4), 26 + rng() * 3);
    const shotFrom = P(recv.x + flip * 1.5, recv.y - 2);
    const target = aimFor(rng, keeperHome.x, true);
    return {
      kind, strikeT, goalT, target, keeperGo: strikeT + 0.35, keeperFrom: keeperHome,
      bodies: [
        path([[0, P(recv.x - flip, recv.y + 3)], [passT + 0.4, at(recv)], [strikeT, P(shotFrom.x, shotFrom.y + 0.6)], [goalT + 1.6, P(shotFrom.x - 6 * flip, shotFrom.y + 2)]]),
        path([[0, P(side(14), 34)], [passT, P(side(13), 33)], [3.5, P(side(10), 30)]]),
        path([[0, P(side(-4), 19)], [strikeT, P(shotFrom.x, shotFrom.y - 4)], [3.5, P(shotFrom.x, shotFrom.y - 3.5)]]),
        path([[0, P(CX + 1, 16)], [strikeT, P(CX + 1.5 * flip, 17)], [3.5, P(CX + 2 * flip, 17.5)]]),
        path([[0, P(side(8), 17)], [strikeT, P(side(6), 18)], [3.5, P(side(5), 18)]]),
        path([[0, keeperHome], [strikeT, P(keeperHome.x, 2.2)]]),
      ],
      ball: (t) => t < passT ? P(side(13), 33)
        : t < passT + 0.5 ? flight(P(side(13), 33), recv, passT, passT + 0.5, 0.2)(t)
          : t < strikeT ? along(recv, shotFrom, (t - passT - 0.5) / (strikeT - passT - 0.5))
            : t < goalT ? flight(shotFrom, target, strikeT, goalT, 2.4)(t)
              : P(target.x, Math.max(-1.4, -0.2 - (t - goalT) * 3), Math.max(0.11, target.z - (t - goalT) * 2.5)),
      events: [[passT, "pass", "mate0"], [passT + 0.5, "touch", "run0"], [strikeT, "shot", "run0", rng() < 0.5 ? "curl" : "ground"]],
    };
  }

  if (kind === "tap_in") {
    const passT = 1.35, strikeT = 1.92, goalT = 2.15;
    const byline = P(side(14), 2.5);
    const meet = P(side(-1 - rng() * 1.5), 5.5 + rng() * 2);
    // The keeper has come across to the near post: it goes in the far side.
    const target = aimFor(rng, side(2), false);
    return {
      kind, strikeT, goalT, target, keeperGo: passT + 0.1, keeperFrom: keeperHome,
      bodies: [
        path([[0, P(meet.x - flip * 2, meet.y + 9)], [strikeT, P(meet.x, meet.y + 0.6)], [goalT + 1.7, P(meet.x - 8 * flip, meet.y + 5)]]),
        path([[0, P(side(18), 12)], [passT, P(byline.x, byline.y + 0.5)], [3.5, P(byline.x - flip, byline.y + 2)]]),
        path([[0, P(side(13), 8)], [passT, P(side(12), 3.8)], [3.5, P(side(11.5), 3.5)]]),
        path([[0, P(meet.x + flip * 1.5, meet.y + 6)], [strikeT, P(meet.x + flip * 1.4, meet.y + 1.8)], [3.5, P(meet.x + flip, meet.y + 1.5)]]),
        path([[0, P(side(-4), 9)], [strikeT, P(side(-3), 6)], [3.5, P(side(-3), 6)]]),
        path([[0, keeperHome], [passT, P(side(2.6), 0.9)], [strikeT, P(side(2), 1.6)]]),
      ],
      ball: (t) => t < passT ? along(P(side(17.5), 11), byline, t / passT)
        : t < strikeT ? flight(byline, meet, passT, strikeT, 0)(t)
          : t < goalT ? flight(meet, target, strikeT, goalT, 0.1)(t)
            : P(target.x, Math.max(-1.4, -0.2 - (t - goalT) * 3), Math.max(0.11, target.z - (t - goalT) * 2)),
      events: [[passT, "pass", "mate0"], [strikeT, "shot", "run0", "ground"]],
    };
  }

  // A run in on goal: one-on-one.
  const startT = 0, strikeT = 2.55, goalT = 3.0;
  const x0 = side(-3 - rng() * 6);
  const runTo = P(lerp(x0, CX, 0.55), 11.5 + rng() * 2.5);
  const target = aimFor(rng, keeperHome.x, rng() < 0.35);
  const scorer = path([[startT, P(x0, 30)], [strikeT, runTo], [goalT + 1.6, P(runTo.x - 9 * flip, runTo.y + 1)]]);
  return {
    kind, strikeT, goalT, target, keeperGo: strikeT + 0.1, keeperFrom: P(keeperHome.x, 4),
    bodies: [
      scorer,
      path([[0, P(side(10), 34)], [3.5, P(side(8), 22)]]),
      path([[0, P(x0 + flip * 1.5, 32.5)], [strikeT, P(runTo.x + flip * 1.4, runTo.y + 2.2)], [3.5, P(runTo.x + flip, runTo.y + 1.5)]]),
      path([[0, P(side(5), 22)], [strikeT, P(runTo.x + flip * 3, runTo.y + 1)], [3.5, P(runTo.x + flip * 3, runTo.y)]]),
      path([[0, P(side(-12), 24)], [strikeT, P(side(-9), 16)], [3.5, P(side(-8), 14)]]),
      path([[0, keeperHome], [strikeT - 0.4, P(lerp(keeperHome.x, runTo.x, 0.3), 4.2)], [strikeT, P(lerp(keeperHome.x, runTo.x, 0.3), 4.3)]]),
    ],
    ball: (t) => {
      if (t < strikeT) {
        const s = scorer(t);
        const ahead = 0.55 + 0.25 * Math.abs(Math.sin(t * 6));
        return P(s.x + (runTo.x - x0) / 30 * ahead, s.y - ahead, 0);
      }
      const from = P(runTo.x, runTo.y - 0.6);
      if (t < goalT) return flight(from, target, strikeT, goalT, target.z > 1.2 ? 0.8 : 0.2)(t);
      return P(target.x, Math.max(-1.4, -0.2 - (t - goalT) * 3), Math.max(0.11, target.z - (t - goalT) * 2));
    },
    events: [[0.6, "touch", "run0"], [1.4, "touch", "run0"], [strikeT, "shot", "run0", "ground"]],
  };
}

/**
 * The recording of a goal from a match you did not play. Same input, same
 * goal. Returns null if anything about it cannot be made (it never throws).
 */
export function synthTrack(g: SynthGoal): GoalTrack | null {
  try {
    const rng = rngOf(g.seed);
    const kind = g.kind ?? KINDS[Math.floor(rng() * KINDS.length)];
    const plan = planFor(kind, rng);
    const scoring = g.scorerHome ? g.home : g.away;
    const defending = g.scorerHome ? g.away : g.home;
    const atk = kitsOf(scoring).home;
    const defAll = kitsOf(defending);
    // The defending side changes if both home kits clash; simply use their away kit then.
    const clash = defAll.home.shirt.toLowerCase() === atk.shirt.toLowerCase();
    const def = clash ? defAll.away : defAll.home;
    const gk = keeperKit(atk.shirt, def.shirt);
    // The match draws shorts in the kit's trim colour, socks in the shirt's.
    const kit = (k: { shirt: string; trim: string }) => ({ shirt: k.shirt, shorts: k.trim, socks: k.shirt });
    const bodies: ClipBody[] = [
      { id: "run0", role: "mate", side: "us", name: g.scorerShort, kit: kit(atk) },
      { id: "mate0", role: "mate", side: "us", kit: kit(atk) },
      { id: "def0", role: "opp", side: "them", kit: kit(def) },
      { id: "def1", role: "opp", side: "them", kit: kit(def) },
      { id: "def2", role: "opp", side: "them", kit: kit(def) },
      { id: "keeper", role: "keeper", side: "them", kit: kit(gk) },
    ];
    const rec = new GoalRecorder();
    rec.begin(bodies);
    const dt = 1 / CLIP_FPS;
    const end = plan.goalT + 2.25;
    const reach = Math.max(0.6, Math.abs(plan.target.x - (plan.keeperFrom.x)) - 0.7);
    const dir = Math.sign(plan.target.x - plan.keeperFrom.x) || 1;
    const kindOf: SaveKind = plan.target.z > 1.1 ? "high" : "low";
    const pending = [...plan.events].sort((a, b) => a[0] - b[0]);
    let scored = false;
    for (let f = 0; f * dt <= end + 1e-9; f++) {
      const t = f * dt;
      const into = t - plan.keeperGo;
      const lunge = into <= 0 ? 0 : Math.min(1, into / 0.35);
      const frame: FrameState = {
        ball: plan.ball(t),
        bodies: plan.bodies.map((b, i) => {
          const p = b(t);
          // The scorer leaps for a header.
          if (i === 0 && plan.kind === "header") p.z = Math.max(0, 0.55 * (1 - Math.abs(t - plan.strikeT) / 0.3));
          return p;
        }),
        keeper: { dive: dir * reach * ease(lunge), lunge, dir: lunge > 0 ? dir : 0, kind: lunge > 0 ? kindOf : null },
      };
      rec.frame(f === 0 ? 0 : dt, frame);
      while (pending.length && pending[0][0] <= t + 1e-9) {
        const [, k, who, mode] = pending.shift()!;
        rec.event(k, who, mode ? { mode } : undefined);
      }
      if (!scored && t >= plan.goalT) {
        scored = true;
        rec.event("save", "keeper", { save: "beaten" });
        rec.markGoal({
          id: `synth-${hashStr(g.seed).toString(36)}`,
          minute: g.minute,
          minuteLabel: g.minute > 90 ? `90+${g.minute - 90}` : String(g.minute),
          scorer: g.scorer,
          scorerShort: g.scorerShort,
          scorerBody: "run0",
          isYou: false,
          how: kind === "run_in" ? "one_on_one" : kind === "tap_in" ? "cutback" : kind,
          home: g.home,
          away: g.away,
          youAreHome: g.scorerHome,
          ...(g.scoreAfter ? { scoreAfter: g.scoreAfter } : {}),
          ...(g.competition ? { competition: g.competition } : {}),
          ...(g.season !== undefined ? { season: g.season } : {}),
          ...(g.week !== undefined ? { week: g.week } : {}),
        });
      }
    }
    rec.finishNow();
    const out = rec.take()[0] ?? null;
    if (out) out.meta.createdAt = "";
    return out;
  } catch {
    return null;
  }
}
