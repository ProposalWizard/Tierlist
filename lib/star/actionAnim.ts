/**
 * WHAT A MAN LOOKS LIKE WHILE HE DOES THE THING HE JUST DID.
 *
 * Leo, 6 Oct 2026: "i dont wanna see something happen in game thats not how
 * it looks. goalie dives for top corner? one hand outstretched like a de Gea
 * save. goalie catches it? show it. fumbles/rebounds? animations for every
 * situation. teammate collects a pass: show a touch, not run-then-stand-
 * still. teammate shoots: show it, different shot animations. header
 * animation. pass animation. defender blocking animation."
 *
 * The engine writes down every touch as it makes it (BallAction,
 * canvasEngine.ts). The match screen keeps the latest one per man, with the
 * moment it started, and asks this file for his body at each frame. Pure:
 * no canvas, no React, no random numbers — so a test can pin every shape.
 *
 * Every animation ends inside the time the match already gives it: a touch
 * inside the 0.45 s a team-mate holds the ball (RECEIVER_CONTROL_T), a
 * strike inside ~0.4 s, a header jump inside 0.55 s, a block inside 0.6 s,
 * and the keeper's save inside the ~1.6 s the result is shown. Nothing here
 * makes the match wait.
 *
 * Looks only. Settings → Look → Animations: New | Old (lib/star/animLook.ts).
 * How big each one is, and which families are on: lib/star/animDials.ts
 * (edited on /star-animations-dev).
 */
import type { BallAction, BallActionKind, BallActionMode, SaveResult } from "./canvasEngine";
import type { BodyPose } from "./fiveASide/render";
import { DEFAULT_ANIM_DIALS, type AnimDials } from "./animDials";

/** One man's current animation, as the match screen keeps it. */
export interface ActorAnim {
  kind: BallActionKind;
  mode?: BallActionMode;
  save?: SaveResult;
  firstTime?: boolean;
  at?: { x: number; y: number; z: number };
  /** performance.now() / 1000 when it started. */
  start: number;
  /** The chance it belongs to — an animation never carries into the next. */
  scene: object;
}

export const TOUCH_S = 0.45;   // = RECEIVER_CONTROL_T: he controls it, then he plays it
export const STRIKE_S = 0.42;  // a kick's follow-through
export const HEADER_S = 0.55;  // up, meet it, down
export const BLOCK_S = 0.6;    // leg out, hold, recover

/** How long an outfield animation lasts. */
export function animDuration(a: Pick<ActorAnim, "kind" | "mode">): number {
  if (a.kind === "touch") return TOUCH_S;
  if (a.kind === "block") return BLOCK_S;
  if (a.mode === "header") return HEADER_S;
  return STRIKE_S;
}

/** The engine's record turned into the screen's, started at `start`. */
export function animFromAction(a: BallAction, start: number, scene: object): ActorAnim {
  return { kind: a.kind, mode: a.mode, save: a.save, firstTime: a.firstTime, at: a.at, start, scene };
}

export interface OutfieldAnimFrame {
  /** Limb numbers for paintBody / paintBody3d. Replaces the run/idle pose. */
  pose: BodyPose;
  /** Lifted off the grass, in units of the figure's r (a header jump). */
  liftR: number;
  /** Extra body rotation, radians (a block's lean, a volley's tilt). */
  lean: number;
  /** For the baked 3D figure, which has only a kick clip: how far into it,
   *  0..1 of the way to the moment of the strike and on through it. null =
   *  no kick clip (keep his normal clip). */
  kickClipU: number | null;
  /** 0-1: the contact flash at the ball (1 at the touch, gone in FLASH_S). */
  flash: number;
  /** Its size (× the keeper flash's radius). 0 = none. */
  flashSize: number;
  /** A ground strike also kicks up a little dust. */
  dust: boolean;
}

/** How long a boot's contact flash shows. Inside every strike's window. */
export const FLASH_S = 0.16;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Up fast, down slow — the shape of a follow-through. */
const follow = (u: number, hold: number) => (u < hold ? 1 : 1 - (u - hold) / (1 - hold));
const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

/** How a strike type differs (bigger look; all of it scaled by the dials). */
interface StrikeShape {
  /** The swing dial it follows, and how much of it (a chip is a short stab). */
  amp: number;
  /** 0-1: how far the follow-through carries the boot across his body. */
  cross: number;
  /** × the strike-lean dial. */
  lean: number;
  /** × the balancing-arm dial. */
  arm: number;
  /** × the plant-leg dial. */
  plant: number;
}

/**
 * The bigger strike on top of the first version's pose. Every addition is
 * exactly zero with the first version's dials (FIRST_VERSION_DIALS), so the
 * test can prove the old shapes survive.
 */
function bigStrike(fr: OutfieldAnimFrame, sh: StrikeShape, D: AnimDials, f: number, k: number, u: number): OutfieldAnimFrame {
  // The follow-through after contact: the boot carries on out, up and across.
  const rise = easeOut(clamp01(u / 0.18)) * k;
  const p = { ...fr.pose };
  if (sh.amp !== 1) {
    p.swingAmp = 1 + (sh.amp - 1) * rise;
    const cross = sh.cross * clamp01((sh.amp - 1) / 0.6) * rise;
    if (cross > 0) p.swingCross = cross;
  }
  const plant = D.plantBend * sh.plant * k;
  if (plant > 0) {
    p.plantBend = plant;
    p.crouch = (p.crouch ?? 0) + 0.12 * plant;
  }
  const arm = D.armBalance * sh.arm * k;
  if (arm > 0) {
    p.armSpread = (p.armSpread ?? 0) + 0.3 * arm;
    p.armLift = (p.armLift ?? -0.55) + 0.35 * arm;
  }
  const lean = D.strikeLean * sh.lean * k;
  return { ...fr, pose: p, lean: lean > 0 ? fr.lean - f * lean : fr.lean };
}

/** The contact flash: 1 at the strike, gone FLASH_S later. */
function withFlash(fr: OutfieldAnimFrame, D: AnimDials, elapsed: number, dust: boolean): OutfieldAnimFrame {
  if (!(D.contactFlash > 0)) return fr;
  return { ...fr, flash: clamp01(1 - elapsed / FLASH_S), flashSize: D.contactFlash, dust };
}

/** Exaggeration: every movement away from standing still, scaled. 1 = as is. */
function exaggerate(fr: OutfieldAnimFrame, ex: number): OutfieldAnimFrame {
  if (ex === 1) return fr;
  const p = fr.pose;
  const sc = (v: number | undefined) => (v === undefined ? undefined : v * ex);
  const pose: BodyPose = {
    ...p,
    kick: p.kick === undefined ? undefined : Math.min(1.5, p.kick * ex),
    armSpread: sc(p.armSpread),
    armLift: p.armLift === undefined ? undefined : -0.55 + (p.armLift + 0.55) * ex,
    crouch: sc(p.crouch),
    legSwing: sc(p.legSwing),
    swingAmp: p.swingAmp === undefined ? undefined : Math.max(0, 1 + (p.swingAmp - 1) * ex),
    swingCross: sc(p.swingCross),
    plantBend: sc(p.plantBend),
  };
  return { ...fr, pose, liftR: fr.liftR * ex, lean: fr.lean * ex, flashSize: fr.flashSize * ex };
}

/**
 * One outfield man's body `elapsed` seconds into his animation, or null once
 * it has finished (back to running/standing). `foot` is the side the ball is
 * on as he plays it (+1 right, −1 left). `D`: the dials (animDials.ts).
 */
export function outfieldAnimFrame(a: ActorAnim, elapsed: number, foot: number, D: AnimDials = DEFAULT_ANIM_DIALS): OutfieldAnimFrame | null {
  const fr = outfieldBase(a, elapsed, foot, D);
  return fr ? exaggerate(fr, D.exaggeration) : null;
}

function outfieldBase(a: ActorAnim, elapsed: number, foot: number, D: AnimDials): OutfieldAnimFrame | null {
  const dur = animDuration(a);
  if (!(elapsed >= 0) || elapsed > dur) return null;
  const u = elapsed / dur;
  const f = foot >= 0 ? 1 : -1;
  const none = { flash: 0, flashSize: 0, dust: false };
  const grounded = (a.at?.z ?? 0) < 0.35;

  if (a.kind === "touch") {
    const tc = D.touchCushion;
    if (a.mode === "header") {
      // Chest-high: arms out, he takes it on the chest and lets it drop.
      const k = Math.sin(Math.PI * Math.min(1, u * 1.4)) * tc;
      return { pose: { armSpread: 0.75 * k, armLift: -0.55 + 0.45 * k, crouch: 0.12 * k }, liftR: 0, lean: 0, kickClipU: null, ...none };
    }
    if (a.mode === "volley") {
      // Thigh-high: a knee comes up to kill it.
      const k0 = u < 0.45 ? Math.sin((Math.PI / 2) * (u / 0.45)) : 1 - (u - 0.45) / 0.55;
      const k = k0 * tc;
      return { pose: { kick: 0.42 * k, kickFoot: f, armSpread: 0.35 * k, armLift: -0.45 }, liftR: 0.04 * k, lean: 0, kickClipU: 0.35 * k0, ...none };
    }
    // On the ground: the trap (a foot out to cushion it), then he sets
    // himself over the ball. Never the old frozen arms-open stand.
    const trap0 = u < 0.4 ? Math.sin(Math.PI * (u / 0.4)) : 0;
    const trap = trap0 * tc;
    const set = (u < 0.4 ? 0 : Math.sin(Math.PI * ((u - 0.4) / 0.6))) * tc;
    return {
      pose: { kick: 0.55 * trap, kickFoot: f, armSpread: 0.35 * trap + 0.15 * set, armLift: -0.45, crouch: 0.18 * set + 0.08 * trap, legSwing: 0.18 * set * f },
      liftR: 0, lean: 0, kickClipU: u < 0.4 ? 0.45 * trap0 : null, ...none,
    };
  }

  if (a.kind === "block") {
    // He throws a leg (and his body) across the ball's path and holds it.
    const k = u < 0.15 ? easeOut(u / 0.15) : u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    const br = D.blockReach;
    return withFlash({
      pose: { kick: Math.min(1.2, 0.8 * k * br), kickFoot: f, armSpread: 0.15 * k, armLift: -0.55 - 0.4 * k, crouch: 0.28 * k * br },
      liftR: 0, lean: f * 0.34 * k * br, kickClipU: null, ...none,
    }, D, elapsed, grounded);
  }

  // A strike: shot, pass or clearance.
  if (a.mode === "header") {
    // A real jump: squat, up to meet it, back down. The head snaps through.
    const up = Math.sin(Math.PI * u);
    const squat = u < 0.12 ? Math.sin(Math.PI * (u / 0.12)) : 0;
    const hj = D.headerJump;
    return withFlash({
      pose: { armSpread: 0.55 * up * hj, armLift: -0.2 + 0.45 * up * hj, crouch: 0.3 * squat - 0.1 * up, legSwing: 0.22 * up * f },
      liftR: (a.kind === "clearance" ? 0.5 : 0.62) * up * hj, lean: 0, kickClipU: null, ...none,
    }, D, elapsed, false);
  }
  const k = follow(u, 0.22);
  const ku = clamp01(0.55 + u * 0.9); // the 3D kick clip: just before the strike, on through it
  const S = D.strikeSwing;
  let fr: OutfieldAnimFrame;
  switch (a.mode) {
    case "volley":
      // Off the ground, body thrown sideways, the leg whipped through.
      fr = bigStrike({ pose: { kick: k, kickFoot: f, armSpread: 0.7 * k, armLift: -0.2 }, liftR: 0.12 * Math.sin(Math.PI * u), lean: -f * 0.42 * k, kickClipU: ku, ...none },
        { amp: S, cross: 0, lean: 1, arm: 0.8, plant: 0.6 }, D, f, k, u);
      break;
    case "chip":
      // A short stab under it: a small swing, body up, arms lifting.
      fr = bigStrike({ pose: { kick: 0.55 * k, kickFoot: f, armSpread: 0.35 * k, armLift: -0.3, crouch: -0.06 * k }, liftR: 0, lean: 0, kickClipU: ku, ...none },
        { amp: 1 + (S - 1) * 0.5, cross: 0, lean: 0.35, arm: 1.2, plant: 0.5 }, D, f, k, u);
      break;
    case "curl":
      // Wrapped round it: the boot carries right across his body and he leans away.
      fr = bigStrike({ pose: { kick: 0.95 * k, kickFoot: f, armSpread: 0.5 * k, armLift: -0.35 }, liftR: 0, lean: -f * 0.2 * k, kickClipU: ku, ...none },
        { amp: S, cross: 0.4, lean: 1.3, arm: 1, plant: 1 }, D, f, k, u);
      break;
    default:
      if (a.kind === "pass") {
        // A side-foot: a firm, straight swing through the line, arms quieter.
        fr = bigStrike({ pose: { kick: 0.62 * k, kickFoot: f, armSpread: 0.22 * k, armLift: -0.5 }, liftR: 0, lean: 0, kickClipU: ku, ...none },
          { amp: D.passSwing, cross: 0.05, lean: 0.45, arm: 0.5, plant: 0.7 }, D, f, k, u);
      } else if (a.kind === "clearance") {
        // A big hoof: everything through it, arms flung.
        fr = bigStrike({ pose: { kick: k, kickFoot: f, armSpread: 0.8 * k, armLift: -0.1 * k - 0.4 }, liftR: 0.05 * Math.sin(Math.PI * u), lean: 0, kickClipU: ku, ...none },
          { amp: D.clearanceSwing, cross: 0.1, lean: 1.2, arm: 1, plant: 1 }, D, f, k, u);
      } else {
        // A driven shot: laces through it, the boot finishing high.
        fr = bigStrike({ pose: { kick: k, kickFoot: f, armSpread: 0.38 * k, armLift: -0.4 }, liftR: 0, lean: 0, kickClipU: ku, ...none },
          { amp: S, cross: 0.12, lean: 1, arm: 1, plant: 1 }, D, f, k, u);
      }
  }
  return withFlash(fr, D, elapsed, grounded);
}

/** What the keeper does with his hands and his body, on top of the dive the
 *  match already draws (KEEPER_SAVE_KIND, keeperSaveKinds.ts). */
export interface KeeperAnimFrame {
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
  /** Its size (× the first version's). */
  flashSize: number;
  /** He has the ball in his hands: draw it there. */
  holding: boolean;
}

export const KEEPER_FLASH_S = 0.22;
/** Radians: how far over a one-handed stretch leans (full stretch, still
 *  reaching UP into the corner — a flat dive tops out at MAX_KEEPER_LEAN).
 *  The default of the "Keeper one-hand lean" dial. */
export const ONE_HAND_LEAN = 1.15;
/** A ball higher than this beaten or pushed away is a one-handed stretch. */
export const ONE_HAND_Z = 1.55;

/**
 * The keeper `elapsed` seconds after his save (or after being beaten).
 * `high` says the save was played as high/fingertip (Keeper.saveKind).
 */
export function keeperAnimFrame(a: ActorAnim, elapsed: number, high: boolean, D: AnimDials = DEFAULT_ANIM_DIALS): KeeperAnimFrame {
  const e = Math.max(0, elapsed);
  const z = a.at?.z ?? 0;
  const out: KeeperAnimFrame = { trailDrop: 0, handsIn: 0, armLiftAdd: 0, armSpreadAdd: 0, getUp: 0, flash: 0, flashSize: D.keeperFlash * D.exaggeration, holding: false };
  const touched = a.save !== "beaten";
  if (touched) out.flash = clamp01(1 - e / KEEPER_FLASH_S);
  const upper = high || z > ONE_HAND_Z;
  const ex = D.exaggeration;
  switch (a.save) {
    case "catch":
      // Gathered in, and held to his chest for as long as it is shown.
      out.handsIn = clamp01((e - 0.05) / 0.16) * D.catchHold;
      out.holding = e >= 0.12;
      break;
    case "push":
    case "parry":
      if (upper) out.trailDrop = clamp01(e / 0.1); // the de Gea: one glove at full stretch
      else out.armLiftAdd = 0.25 * clamp01(e / 0.1) * D.parry * ex; // a firm palm up and away
      // He hits the grass, then gets up after the loose ball.
      out.getUp = clamp01((e - 0.75) / 0.6);
      break;
    case "fumble": {
      // Goes to gather it (hands in), it squirms out (hands fly apart), he
      // ends up on the floor, then pushes himself up.
      const gather = clamp01(e / 0.1) * (1 - clamp01((e - 0.16) / 0.1));
      out.handsIn = gather;
      out.armSpreadAdd = 0.35 * clamp01((e - 0.18) / 0.12) * D.fumbleSpill * ex;
      out.armLiftAdd = -0.55 * clamp01((e - 0.18) / 0.2) * D.fumbleSpill * ex;
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

/** His lean with the animation on top: getting up, and a one-handed stretch
 *  held at `oneHandLean` instead of flat. No animation: unchanged. */
export function keeperLeanWithAnim(leanRaw: number, kAnim: KeeperAnimFrame | null, oneHandLean: number): number {
  if (!kAnim) return leanRaw;
  const lean0 = leanRaw * (1 - kAnim.getUp * 0.85);
  if (!(kAnim.trailDrop > 0)) return lean0;
  const capped = Math.max(-oneHandLean, Math.min(oneHandLean, lean0));
  return lean0 + (capped - lean0) * kAnim.trailDrop;
}

/** Outfield animations are keyed by the figure's screen id. */
export function isOutfieldActor(actor: string): boolean {
  return actor === "follower" || actor.startsWith("run") || actor.startsWith("def");
}
