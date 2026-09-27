"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  initDefenders, launch, stepBall, stepKeeper, stepReactions, stepDefenders, settleBall,
  stepBallInNet, stepBallPastBar, setOffsideRuleEnabled, goalInView,
  type Ball, type Outcome, type Scenario, type Viewport, type Vec2,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { loadFaceStyle } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle } from "@/lib/star/fakeFaceStyle";
import { createFaceImageCache } from "@/lib/star/faceImageCache";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { FIVE_A_SIDE, type MatchRules } from "@/lib/star/fiveASide/rules";
import {
  buildPassage, buildTheirAttack, aimTheirShot, worldFromTheirAttack,
  buildMateAttack, worldFromMateAttack,
  type FiveCast, type FiveWorld,
} from "@/lib/star/fiveASide/passage";
import { leftPitch, mirror, FIVE_KEEPER_STRENGTH } from "@/lib/star/fiveASide/geometry";
import { type FlowBeat } from "@/lib/star/fiveASide/flow";
import {
  BRACE_MS, commitAt, commitKeeper, beginBlockRun, stepBlockRun,
  type BlockRun, type FiveCommit,
} from "@/lib/star/fiveASide/defend";
import {
  newFiveMatch, applyOutcome, advanceFlow, applyTheirAttack, applyMateAttack, resumeAction,
  type FiveMatchState,
} from "@/lib/star/fiveASide/match";
import { passageQuality, summarise, type FiveASideSummary } from "@/lib/star/fiveASide/score";
import {
  cameraFor, projectionFor, drawPitch, drawGoal, drawFigure, drawBall, drawAim,
  ROLE_KIT, MATCH_SCALE, poseFor, runPhase, bodyPoseFor,
} from "@/lib/star/fiveASide/render";
import ContactBall from "./ContactBall";
import { aimFromDrag, screenToPitch } from "@/lib/star/kickInput";
import { realMatchHeight } from "@/lib/star/engineProfile";

/**
 * A REAL SMALL-SIDED MATCH, PLAYED ON THE LIVE ENGINE.
 *
 * You and three team-mates plus a keeper, against four and a keeper, on a
 * pitch that fits entirely inside one camera frame. Every kick you take goes
 * through the same `launch` / `stepBall` / `stepKeeper` the Saturday match
 * uses, with the same drag-to-aim — AND SO DOES EVERY KICK THEY TAKE.
 *
 * ── What changed, and why ──
 *
 * The verdict on the first version was "useless", with the diagnosis attached:
 *
 *   "The big issue is that the highlights are essentially you passing and then
 *    respawning wherever the ball ends up. The CPUs have to be able to play
 *    without your input."
 *
 * So there are now three things on this screen instead of one:
 *
 *   1. **The simulation, watched.** Between your touches, `flow.ts` plays the
 *      football you are not in — team-mates move, the ball travels, territory
 *      changes — and this screen animates it beat by beat. You rejoin play
 *      somewhere play took you, with the ball played TO you.
 *   2. **Your touch**, exactly as before: drag to aim, contact screen, engine.
 *      Plus a tap on a team-mate for a simple pass, which should never have
 *      cost the full ceremony.
 *   3. **Their chance, watched.** Handed to the engine mirrored (see
 *      `buildTheirAttack`) and drawn mirrored back, so a goal against you is
 *      one you saw go in past a keeper who genuinely dived.
 *
 * ── What is this component's, and what is not ──
 *
 * Almost nothing here is a decision. The shape of the game is `rules.ts`, the
 * football nobody is playing is `flow.ts`, the picture the engine plays is
 * `passage.ts`, the score and the clock are `match.ts`, and what a touch was
 * worth is `score.ts` — all pure, all tested without a browser. This file is
 * the loop, the thumb, and the paint.
 */

// The aim feel — the dead-zone, the pull, the power, the direction — is the
// real match's own, from lib/star/kickInput.ts. It used to be worked out here
// as `hypot(Δx/W, Δy/H)`: on this 5:6 canvas that bought a sideways drag 20%
// more power per pixel than the match, and drew the arrow ~20% wider than the
// ball actually went. See tests/star/kickInput.mts for the numbers.

/**
 * ── The weird loading time ──
 *
 * There used to be 1.8 seconds of hard-coded `setTimeout` per touch: 900 ms
 * staring at a resolved outcome, then another 900 ms of "They break…" over a
 * dice roll. Nothing else blocked; that was the whole of it.
 *
 * A beat to read what happened is worth having. Nearly two seconds of it,
 * twelve times a match, is not — and the second of the two is gone entirely,
 * because their attack is now something you watch rather than something you
 * wait for.
 */
const READ_OUTCOME_MS = 420;
/** …except a goal, which is worth looking at. */
const READ_GOAL_MS = 900;

/**
 * How long the simulation between touches takes to watch, in total.
 *
 * Long enough to see play move, short enough never to be a wait — and a real
 * CAP, not a target: a long spell can be forty beats of football, and forty
 * beats at even the shortest readable frame is nearly four seconds of watching
 * between two of your own touches. Past `FLOW_MAX_BEATS` the spell is sampled
 * rather than slowed down, which reads as play moving quickly rather than as
 * the game pausing.
 */
const FLOW_PLAYBACK_MS = 1600;
const FLOW_BEAT_MIN_MS = 90;
const FLOW_BEAT_MAX_MS = 260;
const FLOW_MAX_BEATS = Math.floor(FLOW_PLAYBACK_MS / FLOW_BEAT_MIN_MS);   // 17

/**
 * The SCREEN's own random stream, wound forward to where it left off.
 *
 * The same trick `match.ts`'s `rngAt` already plays on the match's own stream,
 * for the other one: everything you can see — the picture each passage is
 * built from, the strike, the physics — comes out of here, and it used to be
 * rebuilt from the bare seed on every mount. Closing the app and re-opening it
 * therefore REPLAYED numbers the match had already spent, which is a re-roll
 * of the passage you did not like.
 *
 * `drawn()` is the ABSOLUTE position in the stream (it starts at `wound`, not
 * at zero), because that is what gets written into the save.
 */
function countingRng(seed: number, wound: number): { next: () => number; drawn: () => number } {
  // A save could carry anything; a number that is not a sane count must not be
  // able to hang the app in a loop or poison the stream with NaN.
  const from = Math.max(0, Math.min(2_000_000, Math.floor(wound) || 0));
  const base = mulberry32(seed);
  for (let i = 0; i < from; i++) base();
  let n = from;
  return { next: () => { n++; return base(); }, drawn: () => n };
}

type Phase = "flow" | "aim" | "brace" | "contact" | "flight" | "result" | "watch" | "done";

export interface FiveASideProps {
  /** 0-1. Sets how good the opposition are — see rules/score. */
  difficulty: number;
  /** 0-100, YOUR OWN keeper. Only used for how well he stops THEIR attacks. */
  keeperStrength?: number;
  /**
   * 0-100, THEIR keeper — the one standing between you and the goal.
   *
   * Separate from `keeperStrength` because they are opposite forces and
   * conflating them inverts the adversity: the trial's "sharp keeper" event
   * was being passed as `keeperStrength`, which made a player who drew the
   * bad break HARDER TO SCORE AGAINST rather than harder to score past.
   * Caught in review. Defaults to the difficulty curve, which is what every
   * caller without an opinion wants.
   */
  oppKeeperStrength?: number;
  /** Your power and technique, fed straight to the engine's striking model. */
  skills?: { power: number; technique: number };
  seed: number;
  cast?: FiveCast;
  yourKit?: { shirt: string; trim: string };
  theirKit?: { shirt: string; trim: string };
  rules?: MatchRules;
  /** Mounted inside something else (the trial) rather than as its own page. */
  embedded?: boolean;
  onComplete: (summary: FiveASideSummary, state: FiveMatchState) => void;
  /** Called at every passage end so the trial can save mid-match — see the
   *  resume rules in trial.ts. */
  onProgress?: (state: FiveMatchState) => void;
  /** Resume rather than kick off. */
  resumeFrom?: FiveMatchState | null;
}

export default function FiveASide({
  difficulty, keeperStrength = 60, oppKeeperStrength, skills = { power: 55, technique: 55 },
  seed, cast, yourKit, theirKit, rules = FIVE_A_SIDE, embedded,
  onComplete, onProgress, resumeFrom,
}: FiveASideProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const matchRef = useRef<FiveMatchState>(resumeFrom ?? newFiveMatch(seed, rules));
  const scRef = useRef<Scenario | null>(null);
  const ballRef = useRef<Ball | null>(null);
  // Lazily, exactly once — `useState`'s initialiser is the only hook that
  // guarantees that, and winding a stream forward on every render would be
  // thousands of wasted draws a frame.
  const [rng] = useState(() => countingRng(seed, resumeFrom?.passageDraws ?? 0));
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const aimRef = useRef<{ dir: Vec2; power: number } | null>(null);
  const phaseRef = useRef<Phase>("flow");
  const rafRef = useRef<number | null>(null);
  const camRef = useRef<Viewport | null>(null);
  const doneRef = useRef(false);

  /** THEIR move, while it is being watched: the mirrored picture the engine is
   *  playing, plus the world it started from so it can be read back, and the
   *  shot they are about to take — struck once the brace window runs out. */
  const theirRef = useRef<{
    sc: Scenario; from: FiveWorld;
    shot: ReturnType<typeof aimTheirShot>;
  } | null>(null);
  /** A TEAM-MATE's move, while it is being watched. Native (not mirrored) —
   *  your side attacks the engine's own goal — so it needs no `mirror` and no
   *  brace window: you watch him take it, you do not defend it. */
  const mateRef = useRef<{ sc: Scenario; from: FiveWorld } | null>(null);
  /** The brace window: milliseconds left. A ref, not state — the ring is
   *  drawn on the canvas every frame anyway, and re-rendering React sixty
   *  times a second to move an arc would be sixty renders for nothing. */
  const braceRef = useRef(0);
  const committedRef = useRef<FiveCommit | null>(null);
  const [committed, setCommitted] = useState<FiveCommit | null>(null);
  /** The man you sent, while he is running. */
  const blockRef = useRef<BlockRun | null>(null);
  /** The simulation being animated: the beats, where we are in them, and the
   *  world to draw right now. */
  const flowRef = useRef<{ beats: FlowBeat[]; at: number; t: number; perBeat: number } | null>(null);
  const shownRef = useRef<FiveWorld>(matchRef.current.world);
  const [banner, setBanner] = useState<string | null>(null);
  /** See `obey`. Assigned below, once it exists. */
  const obeyRef = useRef<() => void>(() => {});

  const faces = useRef(createFaceImageCache());
  const faceStyle = useRef(loadFaceStyle());
  const fakeFaceStyle = useRef(loadFakeFaceStyle());
  // Real running/kicking pose, the same shared math the match and both
  // striking trials use — see `poseFor`'s own doc on why this Map is a ref
  // one screen owns rather than shared state.
  const motionRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const [, forceRender] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("flow");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  // A kit is a shirt and a trim; the shorts take the trim, which is what
  // `kitsOf` already means by the pair and keeps a look one object. Default
  // colours are ROLE_KIT's own you/opp — the same green/red every other
  // screen in the game (match, both trials, training) uses for "you" and
  // "them" — not this screen's own drifted near-white/navy, which never
  // matched anywhere else and read as "a different game".
  const kit = (k: { shirt: string; trim: string }) => ({ shirt: k.shirt, trim: k.trim, shorts: k.trim });
  const mine = kit(yourKit ?? { shirt: ROLE_KIT.you, trim: ROLE_KIT.youRim });
  const theirs = kit(theirKit ?? { shirt: ROLE_KIT.opp, trim: ROLE_KIT.oppRim });

  /**
   * A five-a-side has no offside, and the engine's law is ON by default — a
   * test proved it genuinely returns "offside" on these passages otherwise.
   * Restored on unmount because it is module-level state shared with every
   * real match; `CanvasMatch` re-sets it from the rule book on its own mount
   * anyway, so this is belt and braces rather than the only guard.
   */
  useEffect(() => {
    if (!rules.offside) setOffsideRuleEnabled(false);
    return () => { setOffsideRuleEnabled(true); };
  }, [rules.offside]);

  const finish = useCallback((m: FiveMatchState) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase("done");
    onComplete(summarise(m, difficulty), m);
  }, [difficulty, onComplete]);

  /** The engine's picture of YOUR touch, as the world stands. */
  const loadPassage = useCallback(() => {
    const sc = buildPassage(matchRef.current.world, {
      cast,
      // ── Floored, whatever the caller asked for ──
      //
      // The trial hands this stage a keeper scaled by difficulty and by its
      // own "sharp keeper" event, which is right for a full-size goal and
      // impossible on this one: the engine's save radius was tuned against a
      // 7.32 m mouth and on a small-sided goal it covers the lot. A clean
      // one-on-one measured 0.0% before this. See FIVE_KEEPER_STRENGTH — and
      // its note on where difficulty has to come from instead.
      keeperStrength: Math.min(FIVE_KEEPER_STRENGTH, oppKeeperStrength ?? FIVE_KEEPER_STRENGTH),
      teamRelationship: 55,
      rng: rng.next,
    });
    sc.goal = { ...rules.goal };
    sc.crossbar = rules.crossbar;
    sc.viewport = { ...rules.view };
    initDefenders(sc, rng.next);
    scRef.current = sc;
    ballRef.current = null;
    aimRef.current = null;
    theirRef.current = null;
    mateRef.current = null;
    blockRef.current = null;
    committedRef.current = null;
    shownRef.current = matchRef.current.world;
    setBanner(null);
    setPhase("aim");
  }, [cast, difficulty, oppKeeperStrength, rng, rules]);

  /**
   * THEIR CHANCE, PLAYED OUT.
   *
   * Built mirrored, struck by them, stepped by the real physics. Everything
   * about it is the engine's, including your keeper's dive — the only thing
   * this screen does is turn the picture back round before it draws it.
   */
  const startTheirAttack = useCallback(() => {
    const from = matchRef.current.world;
    const sc = buildTheirAttack(from, {
      cast,
      keeperStrength: Math.max(1, Math.min(99, keeperStrength)),
      teamRelationship: 55,
      rng: rng.next,
    });
    sc.goal = { ...rules.goal };
    sc.crossbar = rules.crossbar;
    sc.viewport = { ...rules.view };
    initDefenders(sc, rng.next);
    // Rolled NOW, before the window, so nothing about the window can change
    // what they were always going to do with it. You are reading the picture,
    // not the dice.
    const shot = aimTheirShot(sc, difficulty, rng.next);
    scRef.current = sc;
    theirRef.current = { sc, from, shot };
    mateRef.current = null;
    ballRef.current = null;
    aimRef.current = null;
    blockRef.current = null;
    committedRef.current = null;
    setCommitted(null);
    braceRef.current = BRACE_MS;
    setBanner("They break…");
    setPhase("brace");
  }, [cast, difficulty, keeperStrength, rng, rules]);

  /** The window has run out — they hit it. */
  const strikeTheirs = useCallback(() => {
    const their = theirRef.current;
    if (!their) return;
    const { sc, shot } = their;
    ballRef.current = launch(sc, shot.dir, shot.power, shot.contact, shot.skills, rng.next);
    setBanner(null);
    setPhase("watch");
  }, [rng]);

  /**
   * A TEAM-MATE'S CHANCE, PLAYED OUT AND WATCHED.
   *
   * Your side attacking their goal, so — unlike their attack — no mirror and no
   * brace window: the engine strikes it straight away and you watch him take
   * it. Everything about the shot is the engine's, including their keeper's
   * dive. This is the other half of "the CPUs play without your input".
   */
  const startMateAttack = useCallback(() => {
    const from = matchRef.current.world;
    const sc = buildMateAttack(from, {
      cast,
      keeperStrength: Math.min(FIVE_KEEPER_STRENGTH, oppKeeperStrength ?? FIVE_KEEPER_STRENGTH),
      teamRelationship: 55,
      rng: rng.next,
    });
    sc.goal = { ...rules.goal };
    sc.crossbar = rules.crossbar;
    sc.viewport = { ...rules.view };
    initDefenders(sc, rng.next);
    const shot = aimTheirShot(sc, difficulty, rng.next);
    scRef.current = sc;
    // Set, and left set. A second `mateRef.current = null` a line below used
    // to wipe it straight away, so the finished chance was filed as THEIRS:
    // resolveTheirs found no attack of theirs, fell back to `obey()`, the
    // match had not moved on, and the same team-mate chance replayed forever —
    // clock frozen, banner stuck on "They keep it." / "Blocked!". Seen live
    // 24 Sep 2026 (3 of 3 phone runs), and the real cause of the 23 Sep
    // "freezes when the other team gets the ball" report.
    mateRef.current = { sc, from };
    theirRef.current = null;
    aimRef.current = null;
    blockRef.current = null;
    committedRef.current = null;
    setCommitted(null);
    ballRef.current = launch(sc, shot.dir, shot.power, shot.contact, shot.skills, rng.next);
    setBanner("A team-mate's in…");
    setPhase("watch");
  }, [cast, difficulty, oppKeeperStrength, rng, rules]);

  /**
   * PLAY ON — the simulation between your touches, animated.
   *
   * The beats are never stored: they come back from `advanceFlow`, get played
   * through here, and are thrown away. What IS stored is the state at the end
   * of them, which is what a resume picks up.
   */
  const runFlow = useCallback(() => {
    const r = advanceFlow(matchRef.current, {
      difficulty,
      playerSkill: (skills.power + skills.technique) / 2,
    }, { passageDraws: rng.drawn() });
    matchRef.current = r.state;
    onProgress?.(r.state);

    scRef.current = null;
    ballRef.current = null;
    theirRef.current = null;
    mateRef.current = null;

    // ── Nothing to watch ──
    //
    // `advanceFlow` returns no beats when there is no clock left to play them
    // in, and it runs the match out when that happens. Without this the screen
    // sat in the flow phase forever with nothing animating and nothing to
    // finish it: the loop only calls `obey` again when a playback ENDS, and a
    // playback that never started never ends.
    if (r.state.over) { finish(r.state); return; }
    if (!r.beats.length) {
      shownRef.current = r.state.world;
      flowRef.current = null;
      // Handed back on the next tick rather than called straight through:
      // `obey` can call `runFlow` again, and a mutual recursion inside one
      // frame is a stack overflow where a deferred one is at worst a busy
      // frame. (It should not be reachable at all — `advanceFlow` only returns
      // no beats when it has also run the clock out, which the line above
      // catches — so this is the belt to that braces.)
      window.setTimeout(() => obeyRef.current(), 0);
      return;
    }
    {
      // Sampled evenly, ALWAYS keeping the last one — that is the beat the
      // next thing happens from, and arriving anywhere else would put the
      // players somewhere the match state does not agree with.
      const beats = r.beats.length <= FLOW_MAX_BEATS
        ? r.beats
        : Array.from({ length: FLOW_MAX_BEATS }, (_, i) =>
          r.beats[Math.round((i * (r.beats.length - 1)) / (FLOW_MAX_BEATS - 1))]);
      const per = Math.max(FLOW_BEAT_MIN_MS,
        Math.min(FLOW_BEAT_MAX_MS, FLOW_PLAYBACK_MS / beats.length));
      flowRef.current = { beats, at: 0, t: 0, perBeat: per };
      shownRef.current = beats[0].world;
    }
    setBanner(r.state.possession === "you" ? "Your side have it" : "They have it");
    setPhase("flow");
  }, [difficulty, finish, onProgress, rng, skills.power, skills.technique]);

  /**
   * What the match is waiting for, obeyed. The one entry point that decides
   * what happens next, so a resume and an ordinary continuation cannot
   * disagree — see `resumeAction`'s own note on the exploit that caused.
   *
   * Held in a ref as well, because `runFlow` needs to hand straight back to it
   * when there is nothing to animate and the two are mutually recursive.
   */
  const obey = useCallback(() => {
    const m = matchRef.current;
    const action = resumeAction(m);
    if (action === "done") { finish(m); return; }
    if (action === "opp") { startTheirAttack(); return; }
    if (action === "mate") { startMateAttack(); return; }
    if (action === "passage") { loadPassage(); return; }
    runFlow();
  }, [finish, loadPassage, runFlow, startTheirAttack, startMateAttack]);
  obeyRef.current = obey;

  useEffect(() => {
    obey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── The thumb ──────────────────────────────────────────────────────────

  /** Where on the pitch, in metres, a pointer event landed. */
  const pitchAt = (e: React.PointerEvent): Vec2 | null => {
    const wrap = wrapRef.current, cam = camRef.current;
    if (!wrap || !cam) return null;
    const r = wrap.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    return { x: cam.x1 + fx * (cam.x2 - cam.x1), y: cam.y1 + fy * (cam.y2 - cam.y1) };
  };

  /**
   * TAP TO PASS.
   *
   * Asked for directly: "let's try tap to pass for a new sequence section."
   * A simple ball to a man in space should not cost a drag, a power gauge and
   * a contact screen — that ceremony is for a shot, or for a pass you want to
   * weight yourself, and both are still there.
   *
   * The hit-testing is `CanvasMatch`'s own captain's-orders mechanism rather
   * than a second opinion: nearest man inside a generous radius, so two
   * players close together resolve to one of them rather than to neither. Its
   * own note explains the generosity — "a footballer is a centimetre wide on a
   * phone and the whole ability is worthless if picking him out is fiddly".
   */
  const passTargetAt = (p: Vec2): Vec2 | null => {
    const sc = scRef.current;
    if (!sc) return null;
    const vp = camRef.current ?? sc.viewport;
    const grab = Math.max(2.2, (vp.y2 - vp.y1) * 0.09);
    let best: Vec2 | null = null;
    let bestD = grab;
    for (const r of sc.secondaryRunners) {
      const d = Math.hypot(p.x - r.pos.x, p.y - r.pos.y);
      if (d < bestD) { bestD = d; best = { x: r.pos.x, y: r.pos.y }; }
    }
    // The poacher is only a real man when the goal is in view — see
    // passage.ts. Offering him as a pass target otherwise would be offering a
    // ball to somebody the engine is going to ignore.
    if (goalInView(sc.kind)) {
      const d = Math.hypot(p.x - sc.follower.x, p.y - sc.follower.y);
      if (d < bestD) { bestD = d; best = { x: sc.follower.x, y: sc.follower.y }; }
    }
    return best;
  };

  /**
   * THROW A BODY AT IT — the one tap you get while they are lining it up.
   *
   * Handled on pointer DOWN rather than up: this is a tap, not a drag, and
   * every millisecond of the window left is real ground the man covers.
   *
   * The tap arrives in OUR coordinates, and their move is played mirrored, so
   * it is turned round before it is hit-tested — see geometry.ts's `mirror`.
   */
  const braceTap = (e: React.PointerEvent) => {
    const sc = scRef.current, their = theirRef.current;
    if (!sc || !their || committedRef.current) return;   // one tap, and one only
    const p = pitchAt(e);
    if (!p) return;
    const vp = camRef.current ?? sc.viewport;
    const grab = Math.max(2.2, (vp.y2 - vp.y1) * 0.09);
    const c = commitAt(sc, mirror(p), grab);
    if (!c) return;                                       // a mis-tap costs nothing
    committedRef.current = c;
    setCommitted(c);
    if (c.kind === "keeper") commitKeeper(sc, c.side);
    else {
      const d = sc.defenders[c.defender];
      if (d) blockRef.current = beginBlockRun(sc, sc.ball, d);
    }
  };

  const pointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current === "brace") { braceTap(e); return; }
    if (phaseRef.current !== "aim") return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    dragRef.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const pointerMove = (e: React.PointerEvent) => {
    if (phaseRef.current !== "aim" || !dragRef.current) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const now = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    // The match's own drag maths (kickInput.ts): both ends turned into pitch
    // metres through the camera on screen, the pull measured on the glass as a
    // fraction of the canvas HEIGHT (so a pixel is worth the same sideways as
    // up the screen), and the direction kept in METRES — the exact vector
    // `launch` gets, so the arrow drawn from it points where the ball goes.
    // The anchor is where the thumb went down (this screen's gesture; the
    // match anchors on the ball) — only the maths is shared, not the grab.
    const vp = camRef.current ?? scRef.current?.viewport;
    if (!vp || r.height <= 0) return;
    const anchor = screenToPitch(dragRef.current.x, dragRef.current.y, vp);
    const finger = screenToPitch(now.x, now.y, vp);
    // Read against the real match's pitch height, not this shorter one (468px
    // against 624px on a phone), so the same finger movement is the same kick.
    // Harry, 24 Sep 2026, question 11: "A".
    const refH = realMatchHeight(window.innerWidth);
    aimRef.current = aimFromDrag(finger, anchor, vp, skills.power, "up", r.width / r.height, refH > 0 ? r.height / refH : 1);
    forceRender(n => n + 1);
  };

  /** Strike it, and start the flight. Shared by the contact screen and by a
   *  tap-to-pass, which skips the contact screen on purpose. */
  const fire = useCallback((dir: Vec2, power: number, contact: { cx: number; cy: number }) => {
    const sc = scRef.current;
    if (!sc) return;
    ballRef.current = launch(sc, dir, power, contact, skills, rng.next);
    setBanner(null);
    setPhase("flight");
  }, [rng, skills]);

  /** A pointer that went away rather than being lifted — a notification, a
   *  palm on the screen. It must not fire a pass: a tap is a decision and a
   *  cancel is not one. */
  const pointerCancel = () => {
    dragRef.current = null;
    aimRef.current = null;
    forceRender(n => n + 1);
  };

  const pointerUp = (e: React.PointerEvent) => {
    if (phaseRef.current !== "aim") return;
    const aim = aimRef.current;
    const had = dragRef.current;
    dragRef.current = null;

    if (!aim) {
      // No real drag — so it was a tap. If it landed on a team-mate, play him
      // the ball; otherwise it was a mis-tap and nothing happens, which is
      // better than a badly-aimed shot going off.
      const sc = scRef.current;
      const p = had ? pitchAt(e) : null;
      const t = p ? passTargetAt(p) : null;
      if (sc && t) {
        const dir = { x: t.x - sc.ball.x, y: t.y - sc.ball.y };
        // Weighted for the distance, the way the measurement harnesses weight
        // an ordinary pass — a tap should not be a hospital ball.
        const power = Math.min(0.95, 0.2 + Math.hypot(dir.x, dir.y) / 32);
        fire(dir, power, { cx: 0, cy: -0.2 });
        return;
      }
      forceRender(n => n + 1);
      return;
    }
    // You have chosen a direction and a weight; the contact screen decides
    // WHERE on the ball you hit it, exactly as a real match does.
    setPhase("contact");
  };

  /** The contact screen has closed — strike it. */
  const strike = useCallback((contact: { cx: number; cy: number }) => {
    const sc = scRef.current, aim = aimRef.current;
    if (!sc || !aim) { setPhase("aim"); return; }
    // Already pitch metres, through the camera that was on screen when you
    // dragged — the same vector the arrow was drawn along.
    fire(aim.dir, aim.power, contact);
  }, [fire]);

  /**
   * Fold YOUR finished touch into the match, then play on.
   *
   * ── Never leave the match with nothing pending ──
   *
   * Reported directly: "when the other team gets the ball it just like
   * freezes and essentially is stuck, i have to use dev tools to skip to get
   * past." Every physics/state-machine path this screen drives was fuzzed
   * directly (2,000 isolated their-attacks, 300 full simulated matches end to
   * end) and none hung or threw — so the stuck state has to be a React-level
   * ref falling out of sync with `phase` (a re-render tearing down and
   * rebuilding the animation-frame effect mid-sequence is the one candidate
   * that can't be reproduced outside a real browser). Whatever the exact
   * trigger, the failure mode was always the same: `sc`/`ball` missing here
   * used to just `return` and do nothing, forever — `pendingRef` was already
   * cleared by the caller, so nothing would ever call this again. `obey()`
   * re-reads what the match is actually waiting for and re-dispatches it —
   * worst case a chance replays from scratch, which is a far better failure
   * than a screen that needs a dev-only skip to escape.
   */
  const resolveMine = useCallback((outcome: Outcome | "out") => {
    const sc = scRef.current, ball = ballRef.current;
    if (!sc || !ball) { obey(); return; }

    const crossX = outcome === "goal" || outcome === "wide" || outcome === "over" || outcome === "post"
      ? ball.pos.x : null;
    const quality = passageQuality(outcome, sc, crossX, rules);
    // A goal a team-mate scored off your pass is an assist, and the engine's
    // own `receiverShot` is the only reliable signal for "somebody else put
    // this away" — a clean team-mate finish reports as "goal" just like yours.
    const assist = (outcome === "goal" || outcome === "rebound") && !!sc.receiverShot;

    const next = applyOutcome(matchRef.current, outcome, sc, ball, quality, {
      assist, passageDraws: rng.drawn(),
    });
    matchRef.current = next;
    // Saved at every passage end, which is what makes closing the app safe.
    onProgress?.(next);
    if (next.over) { finish(next); return; }
    obey();
  }, [finish, obey, onProgress, rng, rules]);

  /** Fold THEIR finished chance into the match, then play on. See
   *  `resolveMine`'s own doc for why a missing ref recovers via `obey()`
   *  rather than silently doing nothing. */
  const resolveTheirs = useCallback((outcome: Outcome | "out") => {
    const their = theirRef.current, ball = ballRef.current;
    if (!their || !ball) { obey(); return; }
    const world = worldFromTheirAttack(their.sc, ball.pos, their.from);
    const next = applyTheirAttack(matchRef.current, outcome, world, { passageDraws: rng.drawn() });
    matchRef.current = next;
    onProgress?.(next);
    if (next.over) { finish(next); return; }
    obey();
  }, [finish, obey, onProgress, rng]);

  /** Fold a TEAM-MATE's finished chance into the match, then play on. Native —
   *  the ball is in ordinary coordinates, so no mirror on the way back. See
   *  `resolveMine`'s own doc for why a missing ref recovers via `obey()`
   *  rather than silently doing nothing. */
  const resolveMate = useCallback((outcome: Outcome | "out") => {
    const mate = mateRef.current, ball = ballRef.current;
    if (!mate || !ball) { obey(); return; }
    const world = worldFromMateAttack(mate.sc, ball.pos, mate.from);
    const next = applyMateAttack(matchRef.current, outcome, world, { passageDraws: rng.drawn() });
    matchRef.current = next;
    onProgress?.(next);
    if (next.over) { finish(next); return; }
    obey();
  }, [finish, obey, onProgress, rng]);

  // ── The loop ───────────────────────────────────────────────────────────
  //
  // One place decides when a struck ball has finished, whoever struck it: the
  // physics are identical, and the only difference is which reducer the
  // outcome goes to.
  const settleAtRef = useRef(0);
  const pendingRef = useRef<{ outcome: Outcome | "out"; kind: "mine" | "theirs" | "mate"; until: number } | null>(null);

  useEffect(() => {
    let last = performance.now();
    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const ph = phaseRef.current;

      if (ph === "flow") {
        const f = flowRef.current;
        if (f) {
          f.t += dt * 1000;
          while (f.t >= f.perBeat && f.at < f.beats.length - 1) { f.t -= f.perBeat; f.at += 1; }
          const a = f.beats[f.at].world;
          const b = f.beats[Math.min(f.beats.length - 1, f.at + 1)].world;
          const k = f.at >= f.beats.length - 1 ? 1 : Math.min(1, f.t / f.perBeat);
          shownRef.current = lerpWorld(a, b, k);
          if (f.at >= f.beats.length - 1 && f.t >= f.perBeat) {
            flowRef.current = null;
            shownRef.current = matchRef.current.world;
            obey();
          }
        }
      } else if (ph === "brace") {
        // The window. Nobody moves but the man you sent and the keeper you
        // committed — everyone else is waiting for the ball to be struck,
        // exactly as they are in an ordinary aim phase.
        const sc = scRef.current;
        if (sc) {
          stepKeeper(sc, dt);
          if (blockRef.current) stepBlockRun(sc, blockRef.current, dt);
        }
        braceRef.current -= dt * 1000;
        if (braceRef.current <= 0) strikeTheirs();
      } else if (ph === "flight" || ph === "watch") {
        const sc = scRef.current, ball = ballRef.current;
        if (sc && ball && !pendingRef.current) {
          // Three substeps, the same split a real match uses — one coarse step
          // per frame is measurably worse right at the boundary checks (over
          // the bar, in the net, off the post) that decide outcomes.
          let res: Outcome | null = null;
          for (let i = 0; i < 3 && !res; i++) {
            const h = dt / 3;
            // The real match's substep, in the real match's order:
            // stepDefenders -> stepKeeper -> stepReactions -> stepBall.
            // (stepDefenders only ever moves a free-kick wall, which five-a-
            // side never builds; it is here so the loop is the match's loop,
            // not so something changes today. Defenders chasing the ball in
            // flight is stepReactions, which was already here.)
            stepDefenders(sc, h, ball.pos, false, ball);
            stepKeeper(sc, h);
            stepReactions(sc, ball, h, rng.next);
            // After the reactions and before the ball, the same slot
            // `stepTouchChase` occupies in a real match.
            if (blockRef.current) stepBlockRun(sc, blockRef.current, h);
            res = stepBall(ball, sc, rng.next, h);
          }
          // Our own touchline, which is inside the engine's frame — the engine
          // only calls "out" at the frame edge, a metre further on. Only THEIR
          // move is mirrored; your own and a team-mate's are in ordinary coords.
          const theirs_ = ph === "watch" && !!theirRef.current;
          if (!res && leftPitch(theirs_ ? mirror(ball.pos) : ball.pos)) res = "out" as Outcome;
          if (res) {
            const isGoal = res === "goal" || res === "rebound";
            const kind: "mine" | "theirs" | "mate" =
              ph === "flight" ? "mine" : mateRef.current ? "mate" : "theirs";
            pendingRef.current = {
              outcome: res, kind,
              until: now + (isGoal ? READ_GOAL_MS : READ_OUTCOME_MS),
            };
            settleAtRef.current = 0;
            // Your side (your touch OR a team-mate's) gets the friendly caption.
            setBanner(captionFor(res, kind !== "theirs"));
            setPhase("result");
          }
        }
      } else if (ph === "result") {
        // Keep the ball moving after the outcome is decided, so a goal is SEEN
        // going in rather than announced and frozen.
        const sc = scRef.current, ball = ballRef.current;
        if (sc && ball) {
          if (ball.inNet) stepBallInNet(ball, dt);
          else if (ball.overBar) stepBallPastBar(ball, dt);
          else settleBall(ball, dt, sc);   // the match passes the scenario (its weather) too
          if (!sc.keeper.done) stepKeeper(sc, dt);
        }
        const p = pendingRef.current;
        if (p && now >= p.until) {
          pendingRef.current = null;
          if (p.kind === "mine") resolveMine(p.outcome);
          else if (p.kind === "mate") resolveMate(p.outcome);
          else resolveTheirs(p.outcome);
        }
      } else if (ph === "aim") {
        const sc = scRef.current;
        if (sc) stepKeeper(sc, dt);
      }
      draw();
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveMine, resolveTheirs, resolveMate, obey, strikeTheirs]);

  // ── The picture ────────────────────────────────────────────────────────
  const draw = () => {
    const c = canvasRef.current, wrap = wrapRef.current;
    if (!c || !wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = wrap.clientWidth, cssH = wrap.clientHeight;
    if (c.width !== Math.round(cssW * dpr) || c.height !== Math.round(cssH * dpr)) {
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sc = scRef.current;
    const ball = ballRef.current;
    // "watching" here means the MIRRORED picture — their move. A team-mate's
    // move is watched too, but it is your side attacking the engine's own goal,
    // so it is drawn natively (the ordinary passage branch below), never
    // mirrored — gated on `theirRef` rather than the phase for exactly that.
    const watching = (phaseRef.current === "watch" && !!theirRef.current)
      || phaseRef.current === "brace"
      || (phaseRef.current === "result" && !!theirRef.current);

    // ── Everything in OUR coordinates, whoever is attacking ──
    //
    // Their move is played in the mirrored picture (see `buildTheirAttack`),
    // so it is turned back round here — once, at the point of drawing, which
    // is the only place that has ever needed to know.
    const un = (p: Vec2) => (watching ? mirror(p) : p);
    const ballAt = ball ? un(ball.pos) : sc ? un(sc.ball) : shownRef.current.ball;

    // ── The camera follows the ball ──
    //
    // The frame is taller than a phone, so something has to give: either the
    // pitch shrinks until the whole thing fits (and everyone on it is a
    // thumbnail), or the screen scrolls. Decided directly — it scrolls.
    camRef.current = cameraFor(rules, ballAt, cssW, cssH, camRef.current ?? undefined);
    const p = projectionFor(rules, cssW, cssH, camRef.current);
    drawPitch(ctx, rules, p);
    drawGoal(ctx, rules, p, rules.pitch.y1);
    drawGoal(ctx, rules, p, rules.pitch.y2);

    // Real running/kicking pose and a real match-sized scale — reported
    // directly: this screen was "a clear giveaway that its not the same
    // game", drawn at its own smaller size and never animated at all.
    const nowS = performance.now() / 1000;
    const fig = (id: string, at: Vec2, look: Parameters<typeof drawFigure>[3]) => {
      const ps = poseFor(motionRef.current, id, at.x, at.y);
      drawFigure(ctx, p, at, look, faceStyle.current, fakeFaceStyle.current, {
        pose: bodyPoseFor(ps, runPhase(nowS, at.x)), scale: MATCH_SCALE,
      });
    };
    // No `cast` reaches this screen from the trial (`FiveASideProps.cast` is
    // never passed — see TrialSequence.tsx), so every figure here always
    // fell through to no face at all: the blank backing circle. Reported
    // directly: "i dont EVER wanna see a blank circle face, ALWAYS a fake
    // face at least." A stable fake face per role, keyed by this match's own
    // seed so a retried trial can show different faces without ever needing
    // real identity data.
    const face = (fallbackKey: string, id?: string) =>
      faces.current.get(id ?? fakeFaceFor(`${seed}:${fallbackKey}`));
    // Both keepers are on screen at once here, unlike every other screen in
    // the game (always exactly one) — ROLE_KIT.gk for your own, so it at
    // least matches the match/trial/training convention when it's genuinely
    // yours, and a distinct away-keeper purple for theirs rather than the
    // identical gold, which would make the two indistinguishable.
    const keeperLook = (theirs_: boolean) => theirs_
      ? { shirt: "#7c3aed", shorts: "#4c1d95", trim: "#4c1d95" }
      : { shirt: ROLE_KIT.gk, shorts: ROLE_KIT.gkRim, trim: ROLE_KIT.gkRim };

    if (!sc) {
      // Between touches: no engine picture at all, just the world as the
      // simulation has it. This is the half the stage never had.
      //
      // Cast by index, which is safe because the simulation only ever MOVES
      // men — `assign` eases man i toward a slot, it never swaps two of them —
      // so the fourth man in blue is the same fourth man he was last touch.
      const w = shownRef.current;
      w.opps.forEach((o, i) => fig(`opp-${i}`, o, {
        ...theirs, label: cast?.opps?.[i]?.shortName, face: face(`opp-${i}`, cast?.opps?.[i]?.face),
      }));
      fig("their-keeper", w.theirKeeper, {
        ...keeperLook(true), label: cast?.theirKeeper?.shortName, face: face("their-keeper", cast?.theirKeeper?.face),
      });
      fig("your-keeper", w.yourKeeper, {
        ...keeperLook(false), label: cast?.yourKeeper?.shortName, face: face("your-keeper", cast?.yourKeeper?.face),
      });
      w.mates.forEach((m, i) => fig(`mate-${i}`, m, {
        ...mine, label: cast?.mates?.[i]?.shortName, face: face(`mate-${i}`, cast?.mates?.[i]?.face),
      }));
      fig("you", w.you, { ...mine, star: true, face: face("you", cast?.you?.face) });
      drawBall(ctx, p, w.ball, 0, MATCH_SCALE);
      return;
    }

    // Them first, then you — so your own figures draw over theirs where they
    // overlap, and you can always see yourself.
    if (watching) {
      // In their move the engine's `defenders` are YOUR men and its runners
      // are theirs; `sc.player` is the man on the ball, in their shirt.
      sc.secondaryRunners.forEach((r, i) => fig(`runner-${i}`, un(r.pos), {
        ...theirs, label: r.who?.shortName, face: face(`runner-${i}`, r.who?.face),
      }));
      if (goalInView(sc.kind)) {
        fig("follower", un({ x: sc.follower.x, y: sc.follower.y }), { ...theirs, face: face("follower") });
      }
      fig("player", un(sc.player), { ...theirs, face: face("player") });
      fig("your-keeper", un({ x: sc.keeper.x, y: sc.keeper.y }), { ...keeperLook(false), face: face("your-keeper") });
      fig("their-keeper", shownRef.current.theirKeeper, { ...keeperLook(true), face: face("their-keeper") });
      sc.defenders.forEach((d, i) => fig(`defender-${i}`, un({ x: d.x, y: d.y }), { ...mine, face: face(`defender-${i}`) }));
    } else {
      sc.defenders.forEach((d, i) => {
        fig(`defender-${i}`, { x: d.x, y: d.y }, {
          ...theirs, label: d.who?.shortName, face: face(`defender-${i}`, d.who?.face),
        });
      });
      fig("their-keeper", { x: sc.keeper.x, y: sc.keeper.y }, {
        ...keeperLook(true), label: sc.keeper.who?.shortName, face: face("their-keeper", sc.keeper.who?.face),
      });
      fig("your-keeper", matchRef.current.world.yourKeeper, { ...keeperLook(false), face: face("your-keeper") });
      sc.secondaryRunners.forEach((r, i) => {
        fig(`runner-${i}`, r.pos, { ...mine, label: r.who?.shortName, face: face(`runner-${i}`, r.who?.face) });
      });
      // ── Only where he is a real man ──
      //
      // In a midfield passage the engine ignores the follower entirely and all
      // three of your outfielders are runners instead (see passage.ts).
      // Drawing him anyway put a STATIC DUPLICATE on the pitch.
      if (goalInView(sc.kind)) {
        fig("follower", { x: sc.follower.x, y: sc.follower.y }, {
          ...mine, label: sc.follower.who?.shortName, face: face("follower", sc.follower.who?.face),
        });
      }
      // The star marks YOU. On a team-mate's watched chance the man on the ball
      // is a team-mate, not you, so it is drawn without the star.
      fig("player", sc.player, { ...mine, star: !mateRef.current, face: face("player") });
    }

    drawBall(ctx, p, ballAt, ball ? ball.z : 0, MATCH_SCALE);

    // ── The window, drawn where the eye already is ──
    //
    // Around the ball at their man's feet, because that is the thing you are
    // looking at and a timer anywhere else is a timer you find out about
    // afterwards. It empties anticlockwise from the top, and the man you have
    // already sent gets a ring of his own so a tap is never silent.
    if (phaseRef.current === "brace") {
      const left = Math.max(0, Math.min(1, braceRef.current / BRACE_MS));
      const r = p.unit * 1.7;
      ctx.save();
      ctx.lineWidth = Math.max(2.5, p.unit * 0.16);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.arc(p.px(ballAt.x), p.py(ballAt.y), r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = left > 0.35 ? "#fbbf24" : "#f87171";
      ctx.beginPath();
      ctx.arc(p.px(ballAt.x), p.py(ballAt.y), r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      ctx.stroke();
      const c = committedRef.current;
      if (c) {
        const at = c.kind === "keeper"
          ? un({ x: sc.keeper.x, y: sc.keeper.y })
          : un({ x: sc.defenders[c.defender].x, y: sc.defenders[c.defender].y });
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = Math.max(2, p.unit * 0.13);
        ctx.beginPath();
        ctx.arc(p.px(at.x), p.py(at.y), p.unit * 1.0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (phaseRef.current === "aim" && aimRef.current) {
      drawAim(ctx, p, sc.ball, aimRef.current.dir, aimRef.current.power);
    }
  };

  const m = matchRef.current;
  const shell = (
    <div className="relative w-full">
      {/* Scoreboard and clock */}
      <div className="mb-1 flex items-center justify-between rounded-lg bg-black/60 px-3 py-1.5 text-white">
        <span className="text-[11px] font-black uppercase tracking-widest">You</span>
        <span className="text-base font-black tabular-nums">{m.score[0]} – {m.score[1]}</span>
        <span className="text-[11px] font-black uppercase tracking-widest">Them</span>
        <span className="ml-3 text-[11px] font-bold tabular-nums text-white/70">
          {Math.floor(m.minute)}&apos;
        </span>
      </div>

      <div
        ref={wrapRef}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        /* ── A phone-shaped box, not a frame-shaped one ──
           The engine's frame is 5:8, which at full phone width is ~600px tall,
           and with the site nav, the stage bar and the scoreboard above it my
           own keeper and my own goal were off the bottom of the display —
           seen in a screenshot, not guessed. The first fix shrank the whole
           thing until it fitted, which made everyone on it a thumbnail. This
           one keeps the box a comfortable shape and lets the camera scroll,
           which is also the thing eleven-a-side will need. */
        className="relative mx-auto aspect-[5/6] max-h-[62vh] w-full touch-none overflow-hidden rounded-xl bg-black"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {banner && phase !== "aim" && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center">
            <span className="inline-block max-w-[92%] rounded-2xl bg-black/70 px-4 py-2 text-sm font-black leading-snug text-white">
              {banner}
            </span>
          </div>
        )}
        {phase === "brace" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
            <span className="inline-block max-w-[92%] rounded-2xl bg-black/55 px-3 py-1 text-[11px] font-bold leading-snug text-white/85">
              {committed
                ? committed.kind === "keeper" ? "Keeper committed" : "Body on the line"
                : "Tap a man to throw a body at it · tap the goal to send your keeper"}
            </span>
          </div>
        )}
        {phase === "aim" && !aimRef.current && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
            <span className="inline-block max-w-[92%] rounded-2xl bg-black/55 px-3 py-1 text-[11px] font-bold leading-snug text-white/85">
              Tap a team-mate to pass · drag back from the ball to shoot
            </span>
          </div>
        )}
      </div>

      {/* The last few things that happened. */}
      <div className="mt-1 min-h-[2.2rem] rounded-lg bg-black/40 px-3 py-1 text-[11px] font-bold text-white/85">
        {m.log.slice(-2).map((l, i) => <div key={i}>{l}</div>)}
      </div>

      {phase === "contact" && (
        <ContactBall power={aimRef.current?.power ?? 0.5} onContact={strike} />
      )}
    </div>
  );

  if (embedded) return shell;
  return (
    <div className="mx-auto w-full max-w-md px-3 py-4">
      <h2 className="mb-2 text-center text-lg font-black uppercase tracking-widest text-white">
        Five-a-side
      </h2>
      {shell}
    </div>
  );
}

/** What to say about an outcome, from the side that produced it. */
function captionFor(res: Outcome, mine: boolean): string {
  if (res === "goal" || res === "rebound") return mine ? "GOAL!" : "They score.";
  if (res === "saved" || res === "caught" || res === "tipped") return mine ? "Saved." : "Your keeper!";
  if (res === "post") return "Off the woodwork!";
  if (res === "over" || res === "wide") return mine ? "Off target." : "They miss.";
  if (res === "delivered") return mine ? "Found him." : "They keep it.";
  if (res === "blocked" || res === "tackled") return mine ? "Lost it." : "Blocked!";
  return "";
}

/** One position between two beats, so the simulation slides rather than
 *  flickering between arrangements. */
function lerpWorld(a: FiveWorld, b: FiveWorld, k: number): FiveWorld {
  const L = (p: Vec2, q: Vec2): Vec2 => ({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k });
  return {
    ball: L(a.ball, b.ball),
    you: L(a.you, b.you),
    mates: [L(a.mates[0], b.mates[0]), L(a.mates[1], b.mates[1]), L(a.mates[2], b.mates[2])],
    yourKeeper: L(a.yourKeeper, b.yourKeeper),
    opps: [L(a.opps[0], b.opps[0]), L(a.opps[1], b.opps[1]), L(a.opps[2], b.opps[2]), L(a.opps[3], b.opps[3])],
    theirKeeper: L(a.theirKeeper, b.theirKeeper),
  };
}
