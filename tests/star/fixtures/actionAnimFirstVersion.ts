/**
 * FROZEN: the first version of the New animations' pose functions (Leo,
 * 6 Oct 2026, before "make the strikes bigger"), copied verbatim. The test
 * tests/star/animDials.mts checks that the live functions, given
 * FIRST_VERSION_DIALS, still draw exactly these numbers. Never edit it.
 */
import type { ActorAnim, OutfieldAnimFrame as LiveFrame } from "../../../lib/star/actionAnim";
import { animDuration } from "../../../lib/star/actionAnim";
import type { BodyPose } from "../../../lib/star/fiveASide/render";

type OutfieldAnimFrame = Pick<LiveFrame, "pose" | "liftR" | "lean" | "kickClipU">;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Up fast, down slow — the shape of a follow-through. */
const follow = (u: number, hold: number) => (u < hold ? 1 : 1 - (u - hold) / (1 - hold));
const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

/**
 * One outfield man's body `elapsed` seconds into his animation, or null once
 * it has finished (back to running/standing). `foot` is the side the ball is
 * on as he plays it (+1 right, −1 left).
 */
export function firstOutfieldAnimFrame(a: ActorAnim, elapsed: number, foot: number): OutfieldAnimFrame | null {
  const dur = animDuration(a);
  if (!(elapsed >= 0) || elapsed > dur) return null;
  const u = elapsed / dur;
  const f = foot >= 0 ? 1 : -1;

  if (a.kind === "touch") {
    if (a.mode === "header") {
      // Chest-high: arms out, he takes it on the chest and lets it drop.
      const k = Math.sin(Math.PI * Math.min(1, u * 1.4));
      return { pose: { armSpread: 0.75 * k, armLift: -0.55 + 0.45 * k, crouch: 0.12 * k }, liftR: 0, lean: 0, kickClipU: null };
    }
    if (a.mode === "volley") {
      // Thigh-high: a knee comes up to kill it.
      const k = u < 0.45 ? Math.sin((Math.PI / 2) * (u / 0.45)) : 1 - (u - 0.45) / 0.55;
      return { pose: { kick: 0.42 * k, kickFoot: f, armSpread: 0.35 * k, armLift: -0.45 }, liftR: 0.04 * k, lean: 0, kickClipU: 0.35 * k };
    }
    // On the ground: the trap (a foot out to cushion it), then he sets
    // himself over the ball. Never the old frozen arms-open stand.
    const trap = u < 0.4 ? Math.sin(Math.PI * (u / 0.4)) : 0;
    const set = u < 0.4 ? 0 : Math.sin(Math.PI * ((u - 0.4) / 0.6));
    return {
      pose: { kick: 0.55 * trap, kickFoot: f, armSpread: 0.35 * trap + 0.15 * set, armLift: -0.45, crouch: 0.18 * set + 0.08 * trap, legSwing: 0.18 * set * f },
      liftR: 0, lean: 0, kickClipU: u < 0.4 ? 0.45 * trap : null,
    };
  }

  if (a.kind === "block") {
    // He throws a leg (and his body) across the ball's path and holds it.
    const k = u < 0.15 ? easeOut(u / 0.15) : u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    return {
      pose: { kick: 0.8 * k, kickFoot: f, armSpread: 0.15 * k, armLift: -0.55 - 0.4 * k, crouch: 0.28 * k },
      liftR: 0, lean: f * 0.34 * k, kickClipU: null,
    };
  }

  // A strike: shot, pass or clearance.
  if (a.mode === "header") {
    // A real jump: squat, up to meet it, back down. The head snaps through.
    const up = Math.sin(Math.PI * u);
    const squat = u < 0.12 ? Math.sin(Math.PI * (u / 0.12)) : 0;
    return {
      pose: { armSpread: 0.55 * up, armLift: -0.2 + 0.45 * up, crouch: 0.3 * squat - 0.1 * up, legSwing: 0.22 * up * f },
      liftR: (a.kind === "clearance" ? 0.5 : 0.62) * up, lean: 0, kickClipU: null,
    };
  }
  const k = follow(u, 0.22);
  const ku = clamp01(0.55 + u * 0.9); // the 3D kick clip: just before the strike, on through it
  switch (a.mode) {
    case "volley":
      // Off the ground, body thrown sideways, the leg whipped through.
      return { pose: { kick: k, kickFoot: f, armSpread: 0.7 * k, armLift: -0.2 }, liftR: 0.12 * Math.sin(Math.PI * u), lean: -f * 0.42 * k, kickClipU: ku };
    case "chip":
      // A short stab under it: a small swing, body up.
      return { pose: { kick: 0.55 * k, kickFoot: f, armSpread: 0.35 * k, armLift: -0.3, crouch: -0.06 * k }, liftR: 0, lean: 0, kickClipU: ku };
    case "curl":
      // Wrapped round it: the body leans across the ball as the foot goes through.
      return { pose: { kick: 0.95 * k, kickFoot: f, armSpread: 0.5 * k, armLift: -0.35 }, liftR: 0, lean: -f * 0.2 * k, kickClipU: ku };
    default:
      if (a.kind === "pass") {
        // A side-foot: shorter swing, arms quiet.
        return { pose: { kick: 0.62 * k, kickFoot: f, armSpread: 0.22 * k, armLift: -0.5 }, liftR: 0, lean: 0, kickClipU: ku };
      }
      if (a.kind === "clearance") {
        // A big hoof: everything through it, arms flung.
        return { pose: { kick: k, kickFoot: f, armSpread: 0.8 * k, armLift: -0.1 * k - 0.4 }, liftR: 0.05 * Math.sin(Math.PI * u), lean: 0, kickClipU: ku };
      }
      // A driven shot.
      return { pose: { kick: k, kickFoot: f, armSpread: 0.38 * k, armLift: -0.4 }, liftR: 0, lean: 0, kickClipU: ku };
  }
}
/** What the keeper does with his hands and his body, on top of the dive the
 *  match already draws (KIND table, CanvasMatch). */
interface KeeperAnimFrame {
  /** 0-1, one-handed: the trailing arm drops (BodyPose.trailDrop). */
  trailDrop: number;
  /** 0-1, ball held in to his chest (BodyPose.handsIn). */
  handsIn: number;
  /** Added to his arm lift (a punch goes up, a fumble falls). */
  armLiftAdd: number;
  /** Added to his arm spread (a spill flings the hands apart). */
  armSpreadAdd: number;
  /** 0-1: how far he has got back up off the grass (multiplies his lean). */
  getUp: number;
  /** 0-1: the contact flash at the ball (strongest at the touch). */
  flash: number;
  /** He has the ball in his hands: draw it there. */
  holding: boolean;
}

const KEEPER_FLASH_S = 0.22;
/** Radians: how far over a one-handed stretch leans (full stretch, still
 *  reaching UP into the corner — a flat dive tops out at MAX_KEEPER_LEAN). */
const ONE_HAND_LEAN = 1.15;
/** A ball higher than this beaten or pushed away is a one-handed stretch. */
const ONE_HAND_Z = 1.55;

/**
 * The keeper `elapsed` seconds after his save (or after being beaten).
 * `high` says the save was played as high/fingertip (Keeper.saveKind).
 */
export function firstKeeperAnimFrame(a: ActorAnim, elapsed: number, high: boolean): KeeperAnimFrame {
  const e = Math.max(0, elapsed);
  const z = a.at?.z ?? 0;
  const out: KeeperAnimFrame = { trailDrop: 0, handsIn: 0, armLiftAdd: 0, armSpreadAdd: 0, getUp: 0, flash: 0, holding: false };
  const touched = a.save !== "beaten";
  if (touched) out.flash = clamp01(1 - e / KEEPER_FLASH_S);
  const upper = high || z > ONE_HAND_Z;
  switch (a.save) {
    case "catch":
      // Gathered in, and held to his chest for as long as it is shown.
      out.handsIn = clamp01((e - 0.05) / 0.16);
      out.holding = e >= 0.12;
      break;
    case "push":
    case "parry":
      if (upper) out.trailDrop = clamp01(e / 0.1); // the de Gea: one glove at full stretch
      else out.armLiftAdd = 0.25 * clamp01(e / 0.1); // a firm palm up and away
      // He hits the grass, then gets up after the loose ball.
      out.getUp = clamp01((e - 0.75) / 0.6);
      break;
    case "fumble": {
      // Goes to gather it (hands in), it squirms out (hands fly apart), he
      // ends up on the floor, then pushes himself up.
      const gather = clamp01(e / 0.1) * (1 - clamp01((e - 0.16) / 0.1));
      out.handsIn = gather;
      out.armSpreadAdd = 0.35 * clamp01((e - 0.18) / 0.12);
      out.armLiftAdd = -0.55 * clamp01((e - 0.18) / 0.2);
      out.getUp = 0.6 * clamp01((e - 0.95) / 0.5);
      break;
    }
    case "beaten":
      // A ball into the top corner beats him at full stretch, one hand up.
      if (upper) out.trailDrop = clamp01(e / 0.12);
      break;
  }
  return out;
}

/** The first version's keeper lean (was inline in CanvasMatch). */
export function firstKeeperLean(leanRaw: number, kAnim: KeeperAnimFrame | null): number {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const lean0 = leanRaw * (kAnim ? 1 - kAnim.getUp * 0.85 : 1);
  return kAnim && kAnim.trailDrop > 0 ? lean0 + (clamp(lean0, -ONE_HAND_LEAN, ONE_HAND_LEAN) - lean0) * kAnim.trailDrop : lean0;
}
