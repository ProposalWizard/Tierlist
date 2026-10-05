"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  newRun, applySteer, applyBurst, stepRun, BURST_T, CALM_CAMERA, LIVELY_CAMERA, stepCameraLean,
  CARRY, carryLead, applyPass, wavesBeaten,
  type FpRunState, type RunPhase, type FpIdentity,
} from "@/lib/star/firstPersonDribble";
import { cameraFor, project, type FpCamera } from "@/lib/star/firstPersonView";
import { poseFor, closeness, type DribbleCamera } from "@/lib/star/dribbleCamera";
import { renderFirstPerson, type DuelPip, type FpKits } from "@/lib/star/firstPersonRender";
import { mulberry32 } from "@/lib/star/season";
import { createFaceImageCache } from "@/lib/star/faceImageCache";
import { revealOnScreen } from "@/lib/revealOnScreen";
import { loadFaceStyle } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle } from "@/lib/star/fakeFaceStyle";

/**
 * THE ONE-ON-ONE DUEL — THE COMPONENT.
 *
 * Beat everyone you're given, wave by wave; that's it. Told directly after
 * the first version of this shipped with a shot at the end: "you just need
 * to beat the men that you are given, and you're not even running towards a
 * goal... it should just be to more space." So there is no shot here, no
 * goal anywhere in the drawing (see firstPersonRender.ts's own header) —
 * clearing the last wave IS the win. Originally exactly three men, engaged
 * strictly one at a time; changed directly to three WAVES of one to four
 * men each, randomly, placed across the corridor rather than spawned on
 * your lane — see firstPersonDribble.ts's own header for the full reasoning
 * and the fairness math that changed with it.
 *
 * Structural template: `TrialPenalty.tsx` — a canvas ref, a single rAF
 * loop, pointer capture, the same "reset() called at start and after
 * every attempt" shape.
 *
 * ── Third person, playtested and revised from a true first-person build ──
 *
 * Reported directly, after actually playing the eyes-level version: "I'm
 * thinking maybe it's too difficult from that point of view... maybe we
 * could... have it as like a third person camera angle just behind their
 * head so you can see what's in front of you still." True first-person
 * has a real, structural problem for THIS mechanic specifically (it's
 * fine for the open-run mode, which only ever asks "which general
 * direction"): the whole duel is decided on one exact number — how far
 * left or right he's committed versus you, at the moment he reaches you —
 * and a flat, ground-level, dead-ahead view genuinely cannot show that
 * distance with any precision. There's no depth cue for it. A camera
 * sitting a few metres behind and above you, tilted down, can — you see
 * your own lane and his as two actual lanes with a gap between them, not
 * an inferred one.
 *
 * This costs almost nothing to build: `firstPersonView.ts`'s camera
 * already supports an arbitrary elevated, tilted position (that's exactly
 * what the establishing-shot swoop already used) — a chase-cam is just
 * "sit the camera a bit behind and above your ACTUAL position" instead of
 * "sit it exactly at your eyes," via `CHASE_OFFSET`/`CHASE_EYE`/
 * `CHASE_PITCH` below. It deliberately still doesn't rotate to face
 * anything — same reasoning as the open-run mode's own camera fix, and
 * doubly true for a trailing chase-cam, which is the standard way this
 * kind of camera behaves in every genre that uses one.
 *
 * The one thing a first-person view got for free that a third-person one
 * doesn't: your own body was never drawn, because there was no world
 * position for it — just decorative forearms at the screen edge. Now
 * there is a real body to draw, in "you" green, using the exact same
 * `drawFigure()` every defender already renders with (see
 * `firstPersonRender.ts`'s `own` option).
 *
 * ── Touches, not just a drag — the feint the defender AI already reads ──
 *
 * Reported alongside the camera: "instead of actually moving left and
 * right, it's more like you're touching the ball left and right... push
 * it right a bit, and then straight away go left... which would bait the
 * defender." The duel's own AI already reads your lateral drift the
 * instant his telegraph starts (`pickSide` in firstPersonDribble.ts) —
 * drift right and he commits right, whatever caused that drift. So this
 * needed no new simulation, only an input that makes the bait a
 * deliberate, felt choice instead of an invisible side effect of a drag:
 * a quick, small tap on either side of the screen now nudges your lane
 * that way by a fixed amount (`TAP_NUDGE`) — "touch the ball right," then
 * a second quick tap left immediately after genuinely sells one way and
 * cuts the other, because each tap sets an absolute lane target and the
 * SECOND one is measured from wherever the first has actually gotten you
 * to, not from your original spot. A real drag (more movement, or held
 * longer) still steers continuously exactly as before, and a flick still
 * bursts — taps are additive on top of both, not a replacement mode you
 * have to switch into.
 *
 * ── The ball is touched, not glued to your feet — and the camera lags
 * behind you instead of locking to your lane ──
 *
 * Two things reported directly after actually playing this: (1) "instead
 * of actually moving left and right, it's more like the SCREEN is moving
 * left and right" — because the chase-cam used to sit at EXACTLY your own
 * x every frame, so your own figure always rendered dead-centre and only
 * the world around you ever appeared to move; (2) the ball was invisible
 * except during a swipe, then "moves forward a bit, and then it just
 * disappears again" — it sat close enough to your own feet (the old
 * BALL_LEAD, tuned for the original eyes-level camera, never retuned after
 * the chase-cam pivot) that your own figure, correctly depth-sorted in
 * front of it, hid it almost the whole time.
 *
 * Fixed with two independent per-frame refs, neither touching the sim
 * (firstPersonDribble.ts's fairness math is untouched — this is rendering
 * only): `camXRef` eases toward your real lane rather than snapping to it,
 * so a steer or a burst now visibly moves YOU across the frame first, with
 * the camera catching up a beat behind (`cameraFollowRate`, tunable). Every
 * defender already reads your ball being "touched" by watching your
 * lateral drift once his telegraph starts (`pickSide` in
 * firstPersonDribble.ts); `ballXRef`/`ballVXRef` make that touch visible —
 * a damped spring pulling the ball toward whichever side you're currently
 * steering (or bursting) toward, so pushing right then immediately left
 * shows the ball ease out right, overshoot, and get caught up into the new
 * line, the way an actual touch looks, rather than teleporting. A small
 * forward push-glide wave (keyed to `stride`, never wall-clock, same
 * discipline the ground stripes use) rides on top so the ball visibly gets
 * touched forward each stride instead of gliding at one fixed distance.
 */

/**
 * "ready" — the picture is drawn, nobody moves, and it waits for a tap.
 *
 * Found by a phone audit (26 Sep 2026): the run used to start the moment it
 * mounted. In the trial the How-to-Play card covered the bottom third and the
 * whole stage was lost ~1.2 s after tapping NEXT, before the card was even
 * read; training's Pace lost its first try in ~1.6 s; the dev sandbox showed
 * "Beaten in wave 1" on load. Nobody moves until you tap now — in a real
 * match too, where the tap is the moment you have seen the screen.
 */
type Phase = "ready" | "run" | "result";

const DT_CAP = 0.05;
const FLICK_MIN_PX_FRAC = 0.06;   // of canvas width
const FLICK_MIN_SPEED_FRAC = 1.6; // canvas-widths per second

// ── The chase-cam — see the file header on why this replaced eyes-level.
// Defaults chosen to see both lanes and the gap between them clearly
// without floating so far back the duel stops feeling close; exposed as
// props so the dev sandbox can tune them live.
//
// eye/pitch retuned from 4.5m/22° to 3.2m/15° — reported directly: "the
// ball still reads as behind/attached to the player's body... in front
// from the chase-cam", with the leg/reach motion looking unnatural on top
// of that. Verified with the real project() formula (firstPersonView.ts),
// not guessed: at 4.5m/22°, a ball sitting BALL_BASE_LEAD (0.95m) ahead of
// your feet projects to 0.303·focal below the horizon — almost exactly
// your own HIP's 0.296·focal, and nowhere near your ankle's 0.395 or your
// feet's 0.425. The ball being farther from the camera than your feet (it
// has to be, to stay ahead of you) pushes it UP-screen at this pitch/
// height enough to land in the hip band regardless of how much lead it's
// given — more lead makes this WORSE (farther still), not better. A
// lower, less-tilted camera changes that trade-off: at 3.2m/15° the same
// 0.95m-lead ball projects to 0.277·focal, clearly below the hip (0.210)
// and much closer to the ankle (0.335) than before — reads as grounded,
// not worn. Still an elevated, tilted-down chase-cam (not a reversion to
// eyes-level, which was reported as too hard to read the gap with) — just
// not tilted/elevated enough to fight the ball's own depth against it.
const DEFAULT_CHASE_EYE = 3.2;      // metres — how high the camera sits
const DEFAULT_CHASE_PITCH_DEG = 15; // degrees — how far down it tilts
const DEFAULT_CHASE_OFFSET = 4.5;   // metres BEHIND your actual position

// ── Camera lag — see the file header. Higher = snappier (closer to the
// old exact-lock behaviour); lower = more visible lateral slide before the
// camera catches up. /s, exponential-smoothing rate.
const DEFAULT_CAMERA_FOLLOW_RATE = 5.5;

// The calm camera (`calmCamera`) — see CALM_CAMERA in lib/star/firstPersonDribble.ts.

// ── The ball's touch spring — see the file header. ──
const DEFAULT_BALL_TOUCH_REACH = 0.9; // metres it eases toward, to the touched side
const BALL_SPRING_K = 90;             // stiffness
const BALL_SPRING_C = 17;             // damping — under-damped on purpose, for a slight overshoot
// Reported directly after playing this: at rest the ball reads fine, but
// steering (or bursting) leaves it looking "stuck behind/on your leg" — a
// real visual collision, not a depth-order bug. Verified against an actual
// render (a standalone harness driving the real project()/drawFigure()/
// drawBall() through Playwright, since this canvas can't be screenshotted
// any other way): with the OLD 0.6/1.5m leads, the touch spring's lateral
// swing (up to ballTouchReach*1.4 ≈ 1.26m) puts the ball's screen position
// squarely inside the swinging leg's silhouette, because 0.6-1.5m of extra
// depth barely separates it from your own feet at this camera's distance.
// Genuinely re-enabling depth-sorted occlusion (ball drawn behind your own
// figure when it's actually farther away, which it always is) was tried and
// measured worse, not better: at this chase-cam distance your own torso and
// legs are close enough to the lens that they cover almost the ball's ENTIRE
// screen footprint at ANY reasonable lead distance, even mid-steer — the
// ball nearly vanished the whole run, reproducing the exact "invisible
// ball" bug this file's BALL_BASE_LEAD/BALL_BURST_LEAD were introduced to
// fix in the first place. So the ball still draws last (always visible,
// unchanged) — the fix is giving it enough extra clearance ahead of your
// feet that the touch spring's lateral swing lands it clearly beside your
// leg in open grass instead of overlapping it.
// Left at their original 0.95/1.8m values — the chase-cam retune above
// (see DEFAULT_CHASE_EYE/PITCH_DEG's own note) fixes the "reads as
// attached to your body" complaint by changing how a given lead PROJECTS
// vertically, not by changing the lead itself. Shrinking lead instead
// would reopen the older, already-fixed bug this constant exists for: the
// touch spring's lateral swing colliding with your own swinging leg.
const BALL_BASE_LEAD = 0.95;          // metres in front of your feet at rest
const BALL_BURST_LEAD = 1.8;          // metres in front during/just after a burst
const TOUCH_WAVE_LEN = 1.3;           // metres of stride per forward push-glide cycle
const TOUCH_WAVE_AMP = 0.18;          // metres the lead distance ripples by

// ── A tap, not a drag — see the file header. Small movement, short
// duration, released without ever crossing the flick thresholds above.
const TAP_MAX_MOVE_FRAC = 0.035; // of canvas width — below this, it's a tap
const TAP_MAX_MS = 280;
const TAP_NUDGE = 1.8; // metres your lane target jumps per tap

/** How the run ended. `cleared`/`beaten` are as they always were; the rest
 *  is new and optional, so a caller that ignores it (training) is unchanged. */
export interface FpDribbleResult {
  cleared: boolean;
  beaten: number;
  /** Waves fully beaten, and how many there were. */
  wavesBeaten?: number;
  totalWaves?: number;
  /** Set when a pass ARRIVED: waves beaten before it was played, and where
   *  the team-mate received it (pitch metres). */
  passedAfterWaves?: number;
  passTo?: { x: number; y: number };
  /** True when a pass was played and cut out (the run is lost). */
  passFailed?: boolean;
}

export interface FirstPersonDribbleProps {
  pace?: number;
  oppStrength?: number;
  /** How many waves — each one to four men, randomly, placed across the
   *  corridor rather than sprung on your lane. See firstPersonDribble.ts's
   *  own header on why: "instead of three opponents... you actually have
   *  three rounds... each wave has one to three players." Ignored when
   *  `waveSizes` is given. */
  rounds?: number;
  /** Precomputed wave sizes (see firstPersonDribble.ts's `pickWaveSizes`) —
   *  takes priority over `rounds` when given. Real gameplay's own call site
   *  uses this to enforce a hard cap on the run's total defender count;
   *  the dev sandbox keeps using `rounds` and lets each wave roll freely. */
  waveSizes?: number[];
  /** Real opposing outfielders to cast this run's men from — see
   *  firstPersonDribble.ts's `newRun` own doc. Real gameplay's own call
   *  site passes the actual opposing starting XI (same sheet castDefence
   *  already draws real match defenders from); the dev sandbox omits this
   *  and every man stays anonymous, exactly as before. */
  roster?: FpIdentity[];
  /** Chase-cam tuning — see DEFAULT_CHASE_* above for the reasoning behind
   *  the defaults. */
  chaseEye?: number;
  chasePitchDeg?: number;
  chaseOffset?: number;
  /** Dribble-feel tuning — see the file header and DEFAULT_CAMERA_FOLLOW_RATE/
   *  DEFAULT_BALL_TOUCH_REACH above. */
  cameraFollowRate?: number;
  ballTouchReach?: number;
  /** A fixed seed replays the exact same run every time (for tuning);
   *  omit it for a fresh random run on every attempt. */
  seed?: number;
  /** The open-side glow during a telegraph — literally shows which way to
   *  go, not just a hint. Off by default: reported directly that reading
   *  the telegraph yourself, not being told the answer, is the actual
   *  skill this mode is meant to test. An accessibility aid to turn back
   *  on, not the intended default difficulty. */
  assist?: boolean;
  /** How many individual defenders you actually beat before the run ended
   *  — every defender across every fully-resolved wave, cleared or not.
   *  Real gameplay's own call site reads this to decide whether a clear
   *  run earned a routine follow-up chance or, having beaten enough men to
   *  have genuinely broken forward, a real attacking scenario near the
   *  box — see CanvasMatch.tsx's own handler for the exact threshold. */
  onComplete?: (result: FpDribbleResult) => void;
  /**
   * Team-mates in the background you can pass to at any moment (0 = none,
   * the default — the trial and training never set it). Each carries a ring
   * on the grass: green an easy ball, amber a risk, red likely cut out. Tap
   * him to play it. Leo, 5 Oct 2026: "passing options in background that
   * will be difficult (varying difficulty) to pass to at any moment".
   */
  passOptions?: number;
  /** Your vision (0-100), which nudges whether a pass arrives. */
  vision?: number;
  /** Real team-mates to put in those shirts (names/faces only). */
  mateRoster?: FpIdentity[];
  /** Drop the full-page wrapper (heading, page background, `min-h-screen`)
   *  and just fill whatever box the caller already sized — for mounting
   *  this inside a real match's own overlay rather than as its own page.
   *  The dev sandbox never sets this. */
  embedded?: boolean;
  /**
   * Hide the standing one-line hint along the bottom.
   *
   * For a caller that is already showing the real teaching card in that same
   * strip — the trial's dribbling stage does, until it is dismissed — where
   * the two would sit on top of each other and say the same thing twice.
   */
  hideHint?: boolean;
  /**
   * Keep the run waiting while the caller shows its own card over it (the
   * trial's How-to-Play). Nothing moves and no "Tap to start" is drawn until
   * this goes false; then a tap starts it — never the card's own dismissal.
   */
  hold?: boolean;
  /**
   * Which camera (lib/star/dribbleCamera.ts): "C1" (the default since Harry
   * picked it, 28 Sep 2026: low over the shoulder, the ball never drawn over
   * your body), "today" (the chase* props above, the old view) or C2/C3.
   * A picture choice only: the run itself never reads it.
   */
  camera?: DribbleCamera;
  /**
   * Leave your own figure out of the picture; the ball, the men and the camera
   * are unchanged. The v0.23 trial sets it (Harry, 1 Oct 2026: "outside of
   * penalties and free kicks we just don't have him"); the real match never
   * does. Off by default.
   */
  hideYou?: boolean;
  /**
   * A steadier camera: smaller, slower shoulder swaps (see CALM_CAMERA). The
   * trial's Take Him On sets it (Harry, 2 Oct 2026: "the changing of the
   * camera angle is a bit crazy"); the real match does not, so its dribble
   * looks exactly as it did. A picture only.
   */
  calmCamera?: boolean;
  /**
   * Shirt and shorts for you and for the men you take on. Omit for the
   * game's role colours (you green, them red). A picture only.
   */
  kits?: FpKits;
}

/** The New UI's top-bar edge (components/star/ui/TopHud.tsx): a dark glass
 *  fill, square corners, a crisp white edge. The wave counter and the hint
 *  strip wear it so this screen matches the rest of the game. */
const HUD_BOX: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(12,16,24,.9), rgba(12,16,24,.78))",
  boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.92), 0 2px 6px rgba(0,0,0,.45)",
};

const PIP_FILL: Record<DuelPip, string> = {
  pending: "rgba(255,255,255,0.18)",
  active: "#fbbf24",
  beaten: "#34d399",
  won: "#ef4444",
};

export default function FirstPersonDribble({
  pace = 60, oppStrength = 55, rounds = 3, waveSizes, roster, seed, assist = false, onComplete, embedded = false,
  hideHint = false, hold = false, camera = "C1", hideYou = false, calmCamera = false, kits,
  passOptions = 0, vision = 55, mateRoster,
  chaseEye = DEFAULT_CHASE_EYE, chasePitchDeg = DEFAULT_CHASE_PITCH_DEG, chaseOffset = DEFAULT_CHASE_OFFSET,
  cameraFollowRate = DEFAULT_CAMERA_FOLLOW_RATE, ballTouchReach = DEFAULT_BALL_TOUCH_REACH,
}: FirstPersonDribbleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<FpRunState | null>(null);
  const ballImgRef = useRef<HTMLImageElement | null>(null);
  /** The painted stadium behind the far end — the home screen's sunset. */
  const backdropRef = useRef<HTMLImageElement | null>(null);
  const kitsRef = useRef(kits);
  kitsRef.current = kits;
  // Same cache shape CanvasMatch.tsx uses for real match figures — see
  // lib/star/faceImageCache.ts — and the same shared FaceStyle, loaded once,
  // so a defender here is tuned exactly as consistently as one in a real
  // match. Reading `roster` is enough to know faces might be wanted at all;
  // when it's empty (the dev sandbox) this still costs nothing per frame,
  // only the one-time localStorage read.
  const faceImageCacheRef = useRef(createFaceImageCache());
  const faceStyleRef = useRef(loadFaceStyle());
  // Same idea, for the seven fake headshots specifically — see
  // lib/star/fakeFaceStyle.ts and drawPlayerHead.ts's own doc on how the two
  // styles combine. A defender here can carry a fake face exactly as often
  // as one in a real match (both draw from the same castDefence-derived
  // roster), so it needs the same fallback tuning to look right.
  const fakeFaceStyleRef = useRef(loadFakeFaceStyle());
  const rngRef = useRef<() => number>(() => Math.random());
  const hideYouRef = useRef(hideYou);
  hideYouRef.current = hideYou;
  const camFeelRef = useRef(calmCamera ? CALM_CAMERA : LIVELY_CAMERA);
  camFeelRef.current = calmCamera ? CALM_CAMERA : LIVELY_CAMERA;
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const reducedMotionRef = useRef(false);
  // Camera-lag and ball-touch-spring state — see the file header. Reset
  // alongside the run itself so a fresh attempt doesn't inherit the last
  // one's drift.
  const camXRef = useRef(0);
  const ballXRef = useRef(0);
  const ballVXRef = useRef(0);
  // The camera options (C1-C3): read live, so switching needs no restart.
  const cameraRef = useRef<DribbleCamera>(camera);
  cameraRef.current = camera;
  /** Which side the camera leans to (+1 right, -1 left) and how far it is
   *  now, eased; and C3's closeness (1 = in close, 0 = pulled back). */
  const sideDirRef = useRef(1);
  const sideRef = useRef(0);
  const closeRef = useRef(0);
  /** A fresh run starts with the camera already over its shoulder, rather
   *  than easing across from dead behind during the first second. */
  const snapCamRef = useRef(true);
  /** The camera this frame was drawn with — a tap on a team-mate is tested
   *  against where he actually is on screen. */
  const lastCamRef = useRef<FpCamera | null>(null);
  const visionRef = useRef(vision);
  visionRef.current = vision;

  // The wave counter, drawn as a page element now (not painted into the
  // canvas), updated only when it changes.
  const [hud, setHud] = useState<{ cleared: number; total: number; pips: DuelPip[] }>({ cleared: 0, total: 0, pips: [] });
  const hudKeyRef = useRef("");

  const phaseRef = useRef<Phase>("ready");
  const [phase, setPhaseState] = useState<Phase>("ready");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const [resultText, setResultText] = useState("");

  // Gesture bookkeeping — steer via relative drag, burst via a flick
  // detected mid-drag (velocity, not release), and a tap-nudge decided on
  // release once we know the whole gesture never grew into either — see
  // the file header on why taps are additive, not a separate mode.
  const draggingRef = useRef(false);
  const anchorPxRef = useRef(0);
  const anchorLaneRef = useRef(0);
  const sampleRef = useRef<{ x: number; t: number }[]>([]);
  const gestureStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = "/star/ball.png";
    ballImgRef.current = img;
    const bg = new Image();
    bg.src = "/home/scene-sunset.webp";
    backdropRef.current = bg;
  }, []);

  useEffect(() => {
    try {
      reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch { /* ignore */ }
  }, []);

  const newRng = useCallback(() => (
    seed !== undefined ? mulberry32(seed) : mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0)
  ), [seed]);

  const reset = useCallback((startNow = false) => {
    const rng = newRng();
    rngRef.current = rng;
    const run = newRun({ pace, oppStrength, rounds, waveSizes, roster, rng, mates: passOptions, mateRoster });
    runRef.current = run;
    camXRef.current = run.x;
    ballXRef.current = run.x + sideDirRef.current * CARRY.restFootX;
    ballVXRef.current = 0;
    snapCamRef.current = true;
    draggingRef.current = false;
    gestureStartRef.current = null;
    setResultText("");
    // A fresh run waits for its tap; "Go Again" IS a tap, so it goes straight in.
    setPhase(startNow ? "run" : "ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pace, oppStrength, rounds, newRng, JSON.stringify(waveSizes), passOptions]);

  useEffect(() => { reset(); }, [reset]);

  /** The tap that starts the run — only from "ready", and only once not held. */
  const start = useCallback(() => {
    if (phaseRef.current !== "ready" || holdRef.current) return;
    setPhase("run");
  }, []);

  // Waiting for that tap: make sure the whole pitch is on screen to tap on.
  // Does nothing when it already is (the real match's own overlay always is).
  useEffect(() => {
    if (phase !== "ready" || hold) return;
    const id = requestAnimationFrame(() => revealOnScreen(wrapRef.current));
    return () => cancelAnimationFrame(id);
  }, [phase, hold]);

  // ── Canvas sizing — raw backing-store pixels, no separate DPR transform:
  // firstPersonView's project() already produces true pixel coordinates,
  // so canvas.width/height ARE the camera's W/H directly. ──
  useEffect(() => {
    const c = canvasRef.current, wrap = wrapRef.current;
    if (!c || !wrap) return;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(wrap.clientWidth * dpr));
      const h = Math.max(1, Math.round(wrap.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Pointer input ──────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c || phaseRef.current !== "run") return;
    try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    draggingRef.current = true;
    anchorPxRef.current = e.clientX;
    anchorLaneRef.current = runRef.current?.laneTarget ?? runRef.current?.x ?? 0;
    sampleRef.current = [{ x: e.clientX, t: performance.now() }];
    gestureStartRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    const run = runRef.current;
    if (!c || !run || phaseRef.current !== "run" || !draggingRef.current) return;
    const r = c.getBoundingClientRect();
    const perPx = (run.maxX - run.minX) / Math.max(1, r.width * 0.8);
    applySteer(run, anchorLaneRef.current + (e.clientX - anchorPxRef.current) * perPx);

    const now = performance.now();
    const samples = sampleRef.current;
    samples.push({ x: e.clientX, t: now });
    while (samples.length > 1 && now - samples[0].t > 150) samples.shift();
    const oldest = samples[0];
    const dtMs = now - oldest.t;
    if (dtMs > 20) {
      const vx = (e.clientX - oldest.x) / (dtMs / 1000); // px/s
      const dxPx = Math.abs(e.clientX - oldest.x);
      if (Math.abs(vx) >= FLICK_MIN_SPEED_FRAC * r.width && dxPx >= FLICK_MIN_PX_FRAC * r.width) {
        const fired = applyBurst(run, vx > 0 ? 1 : -1);
        if (fired) {
          anchorPxRef.current = e.clientX;
          anchorLaneRef.current = run.laneTarget;
          sampleRef.current = [{ x: e.clientX, t: now }];
        }
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    const run = runRef.current;
    try { c?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    draggingRef.current = false;

    // ── Tap-nudge: touch the ball left or right ──
    //
    // Decided here, on release, once we know the gesture never grew into a
    // drag or a flick — see the file header. A tap on the left half of the
    // screen nudges your lane target left by TAP_NUDGE, right nudges right;
    // additive on top of whatever the continuous drag-steer above already
    // did during the same brief hold (negligible for a real tap, since it
    // barely moved).
    const start = gestureStartRef.current;
    gestureStartRef.current = null;
    if (!c || !run || !start || phaseRef.current !== "run") return;
    const r = c.getBoundingClientRect();
    if (r.width <= 0) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    const heldMs = performance.now() - start.t;
    if (moved > TAP_MAX_MOVE_FRAC * r.width || heldMs > TAP_MAX_MS) return;
    // A tap on a team-mate plays the pass instead of touching the ball.
    const mate = mateAt(start.x - r.left, start.y - r.top, r.width / Math.max(1, c.width));
    if (mate >= 0) {
      applyPass(run, mate, visionRef.current);
      return;
    }
    const dir = (start.x - r.left) < r.width / 2 ? -1 : 1;
    applySteer(run, run.laneTarget + TAP_NUDGE * dir);
  };

  /** Which team-mate (index) a tap at css (x, y) lands on, or -1. Tested
   *  against his body from boots to head, with a generous finger margin. */
  const mateAt = (cssX: number, cssY: number, cssPerPx: number): number => {
    const run = runRef.current, cam = lastCamRef.current;
    if (!run || !cam || run.mates.length === 0) return -1;
    let best = -1, bestD = Infinity;
    run.mates.forEach((m, i) => {
      const feet = project(cam, m.x, m.y, 0);
      const head = project(cam, m.x, m.y, 1.8);
      if (!feet || !head) return;
      const fx = feet.px * cssPerPx, fy = feet.py * cssPerPx, hy = head.py * cssPerPx;
      const halfW = Math.max(30, 0.9 * feet.scale * cssPerPx);
      const dx = Math.abs(cssX - fx);
      const dy = cssY < hy ? hy - cssY : cssY > fy + 16 ? cssY - (fy + 16) : 0;
      if (dx > halfW || dy > 18) return;
      const d = dx + dy;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };

  // ── Keyboard fallback ────────────────────────────────────────────────────
  useEffect(() => {
    const held = new Set<string>();
    const KEY_STEER = 6; // m/s while held
    const onDown = (e: KeyboardEvent) => {
      // The keyboard's own "tap to start" — an arrow, Space or Enter.
      if (phaseRef.current === "ready" && !holdRef.current
        && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " " || e.key === "Enter")) {
        setPhase("run");
        return;
      }
      if (phaseRef.current !== "run") return;
      const run = runRef.current;
      if (!run) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") held.add(e.key);
      if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        applyBurst(run, e.key === "ArrowLeft" ? -1 : 1);
      }
    };
    const onUp = (e: KeyboardEvent) => held.delete(e.key);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    const id = window.setInterval(() => {
      const run = runRef.current;
      if (!run || phaseRef.current !== "run") return;
      if (held.has("ArrowLeft")) applySteer(run, run.laneTarget - KEY_STEER * 0.05);
      if (held.has("ArrowRight")) applySteer(run, run.laneTarget + KEY_STEER * 0.05);
    }, 50);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.clearInterval(id);
    };
  }, []);

  // ── The loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    let raf: number;
    let last = performance.now();

    const finishRun = (finalPhase: RunPhase) => {
      const run = runRef.current;
      const pass = run?.pass ?? null;
      const passName = pass ? (run?.mates[pass.to]?.who?.shortName ?? run?.mates[pass.to]?.who?.name) : undefined;
      if (pass && pass.success) {
        setResultText(passName ? `Played in ${passName}!` : "Pass on!");
      } else if (pass) {
        setResultText("Pass cut out");
      } else if (finalPhase === "clear") {
        setResultText(`Clear! Beat everyone across all ${run?.roundSizes.length ?? 3} waves.`);
      } else {
        const lost = run?.lostTo != null ? run.defenders[run.lostTo] : undefined;
        const label = lost ? `Beaten in wave ${lost.round + 1}` : "Ran out of time";
        setResultText(label);
      }
      setPhase("result");
      // Every defender individually marked "beaten" — correct whether the
      // run cleared (every wave, by definition) or ended partway through
      // (only the waves you'd actually got past), unlike summing
      // `roundSizes` which would count men in a wave you never reached.
      const beaten = run?.defenders.filter(d => d.phase === "beaten").length ?? 0;
      onComplete?.({
        cleared: finalPhase === "clear", beaten,
        wavesBeaten: run ? wavesBeaten(run) : 0,
        totalWaves: run?.roundSizes.length ?? 0,
        ...(pass && pass.success ? { passedAfterWaves: pass.afterWaves, passTo: pass.at } : {}),
        ...(pass && !pass.success ? { passFailed: true } : {}),
      });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(DT_CAP, (now - last) / 1000);
      last = now;
      const run = runRef.current;

      if (phaseRef.current === "run" && run) {
        const result = stepRun(run, dt);
        if (result !== "running") finishRun(result);
      }

      draw(dt);
    };

    const draw = (dt: number) => {
      const c = canvasRef.current, run = runRef.current;
      if (!c || !run) return;

      // Camera lag — see the file header: ease toward your lane instead of
      // snapping to it, so a steer or a burst displaces YOU across the
      // frame before the camera catches up.
      const feel = camFeelRef.current;
      const followRate = feel === CALM_CAMERA ? Math.min(cameraFollowRate, feel.followRate) : cameraFollowRate;
      camXRef.current += (run.x - camXRef.current) * (1 - Math.exp(-followRate * dt));

      // The ball's touch spring — see the file header. Pushed toward
      // whichever side you're currently steering (or bursting) toward;
      // under-damped so a change of direction overshoots slightly, the way
      // a real touch does, instead of snapping straight to the new line.
      let touchDir = 0;
      if (run.burst) touchDir = run.burst.dir;
      else {
        const diff = run.laneTarget - run.x;
        if (Math.abs(diff) > 0.15) touchDir = Math.sign(diff);
      }
      // At rest it sits just outside the boot on the camera's side (CARRY in
      // firstPersonDribble.ts) — on the old "today" camera, dead ahead as before.
      const chaseCam = cameraRef.current !== "today";
      const restX = run.x + (chaseCam ? sideDirRef.current * CARRY.restFootX : 0);
      const desiredBallX = touchDir === 0 ? restX : run.x + touchDir * ballTouchReach * (run.burst ? 1.4 : 1);
      const accel = BALL_SPRING_K * (desiredBallX - ballXRef.current) - BALL_SPRING_C * ballVXRef.current;
      ballVXRef.current += accel * dt;
      ballXRef.current += ballVXRef.current * dt;
      ballXRef.current = Math.max(run.minX - 0.5, Math.min(run.maxX + 0.5, ballXRef.current));

      // Forward push-glide — a small ripple on the lead distance keyed to
      // stride (never wall-clock), plus the existing burst lunge further
      // out ahead.
      // ── The camera options (lib/star/dribbleCamera.ts) — a picture only. ──
      let camEye = chaseEye, camPitchDeg = chasePitchDeg, camOffset = chaseOffset, restLead = BALL_BASE_LEAD, camLook = 0;
      if (cameraRef.current !== "today") {
        // C3 closes in on the nearest defender still to beat, ahead of you.
        let near = Infinity;
        for (const d of run.defenders) {
          if (d.phase === "beaten" || d.phase === "won") continue;
          if (d.y < run.y + 0.5) near = Math.min(near, run.y - d.y);
        }
        closeRef.current += (closeness(near) - closeRef.current) * (1 - Math.exp(-2.5 * dt));
        if (snapCamRef.current) closeRef.current = closeness(near);
        const pose = poseFor(cameraRef.current, closeRef.current);
        // Lean towards the side the ball is on, so it is never behind your legs.
        const off = ballXRef.current - run.x;
        const lean = stepCameraLean({ dir: sideDirRef.current >= 0 ? 1 : -1, side: sideRef.current }, off, pose.side, feel, dt);
        sideDirRef.current = lean.dir;
        sideRef.current = snapCamRef.current ? lean.dir * pose.side * feel.sideScale : lean.side;
        snapCamRef.current = false;
        camEye = pose.eye; camPitchDeg = pose.pitchDeg; camOffset = pose.offset; restLead = pose.lead; camLook = pose.look;
      } else {
        sideRef.current = 0;
      }

      const burstLead = run.burst ? Math.min(1, run.burst.t / BURST_T) : 0;
      let leadDepth: number;
      if (cameraRef.current !== "today") {
        // Touched forward once a stride by the foot on its side (CARRY).
        leadDepth = carryLead(run.stride, sideDirRef.current >= 0 ? 1 : -1, burstLead);
      } else {
        const baseLead = restLead + (BALL_BURST_LEAD - BALL_BASE_LEAD) * burstLead;
        const wave = Math.sin((run.stride / TOUCH_WAVE_LEN) * Math.PI * 2) * TOUCH_WAVE_AMP;
        leadDepth = Math.max(0.3, baseLead + wave);
      }

      // Chase-cam: sits CHASE_OFFSET metres behind your (lagged) camera
      // position (larger y — the corridor runs toward y=0), elevated and
      // tilted down. See the file header on why this replaced a camera
      // sitting exactly at your own eyes, and why it no longer locks
      // exactly to your x either.
      const cam = cameraFor(
        { x: camXRef.current + sideRef.current, y: run.y + camOffset }, c.width, c.height,
        {
          eye: camEye, pitch: (camPitchDeg * Math.PI) / 180,
          // Aim at a point `look` m ahead of you (a leaning camera keeps you
          // in frame); 0 = straight down the pitch, as today.
          forward: camLook > 0 ? (() => {
            const fx = -sideRef.current, fy = -(camLook + camOffset), L = Math.hypot(fx, fy) || 1;
            return { x: fx / L, y: fy / L };
          })() : undefined,
        },
      );
      lastCamRef.current = cam;
      // One pip per WAVE, not per man — a wave is "beaten" only once every
      // man in it is, "won" if it beat you, "active" if it's the one
      // currently engaging (which can mean several men at once now).
      const pips: DuelPip[] = run.roundSizes.map((_, r) => {
        const wave = run.defenders.filter(d => d.round === r);
        if (wave.some(d => d.phase === "won")) return "won";
        if (wave.every(d => d.phase === "beaten")) return "beaten";
        return r === run.activeRound ? "active" : "pending";
      });
      const wavesCleared = run.roundSizes.filter((_, r) =>
        run.defenders.filter(d => d.round === r).every(d => d.phase === "beaten"),
      ).length;
      // The body leans toward whichever side the ball is currently being
      // touched (reuses the same lateral shear a defender's telegraph
      // already draws with — see firstPersonRender.ts).
      // Measured from where the ball rests, so a ball carried by the boot
      // does not lean him over all the time.
      const lean = Math.max(-0.35, Math.min(0.35, (ballXRef.current - restX) * 0.55));
      const hudKey = `${wavesCleared}/${run.roundSizes.length}/${pips.join(",")}`;
      if (hudKey !== hudKeyRef.current) {
        hudKeyRef.current = hudKey;
        setHud({ cleared: wavesCleared, total: run.roundSizes.length, pips });
      }

      renderFirstPerson(c, {
        cam, defenders: run.defenders, stride: run.stride,
        minX: run.minX, maxX: run.maxX,
        ball: { x: ballXRef.current, y: run.y - leadDepth, z: 0 },
        ballImage: ballImgRef.current,
        assist, reducedMotion: reducedMotionRef.current,
        own: { x: run.x, y: run.y },
        backdrop: backdropRef.current,
        ballBehindYou: chaseCam,
        kits: kitsRef.current,
        hideYou: hideYouRef.current,
        ownLean: lean,
        getFace: faceImageCacheRef.current.get,
        faceStyle: faceStyleRef.current,
        fakeFaceStyle: fakeFaceStyleRef.current,
        mates: run.mates,
      });
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assist, onComplete, chaseEye, chasePitchDeg, chaseOffset, cameraFollowRate, ballTouchReach]);

  const pitch = (
    <div
      ref={wrapRef}
      className={
        embedded
          // Fills whatever box the caller already sized (CanvasMatch's own
          // wrapRef is already aspect-[5/8]) rather than imposing a second,
          // possibly-conflicting aspect ratio of its own.
          ? "absolute inset-0 h-full w-full overflow-hidden touch-none select-none"
          : "relative w-full overflow-hidden rounded-xl border border-white/15 touch-none select-none"
      }
      style={embedded ? undefined : { aspectRatio: "5 / 8" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* The wave counter: how many waves you have got past, and one square
          per wave (amber = the one on you now, green = beaten, red = it beat you). */}
      {hud.total > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5" style={HUD_BOX} aria-label={`${hud.cleared} of ${hud.total} waves beaten`}>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">Waves</span>
            <span className="text-lg font-black leading-none tabular-nums text-white">{hud.cleared}/{hud.total}</span>
            <span className="flex items-center gap-1">
              {hud.pips.map((p, i) => (
                <span key={i} className="block h-2.5 w-2.5" style={{ background: PIP_FILL[p], boxShadow: "inset 0 0 0 1px rgba(255,255,255,.85)" }} />
              ))}
            </span>
          </div>
        </div>
      )}

      {phase === "run" && !hideHint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-2 pb-2">
          <p className="px-3 py-2 text-center text-[12px] font-bold leading-snug text-white" style={HUD_BOX}>
            {passOptions > 0
              ? "Tap left or right to touch it. Flick to burst. Tap a team-mate to pass."
              : "Tap left or right to touch the ball that way. Flick to burst past him."}
          </p>
        </div>
      )}

      {/* Waiting for you. The whole pitch is the button, so the tap can land
          anywhere; nothing moves underneath it until it does. */}
      {phase === "ready" && !hold && (
        <button
          type="button"
          onClick={start}
          aria-label="Tap to start the run"
          className="absolute inset-0 z-30 bg-black/25"
        >
          {/* Over the stand, not the men: the first wave is the thing to read.
              Just under the wave counter. */}
          <span className="absolute inset-x-0 top-[8%] flex flex-col items-center gap-1.5 px-6 text-center">
            <span className="bg-emerald-500 px-6 py-3 text-base font-black uppercase tracking-widest text-emerald-950 motion-safe:animate-pulse" style={{ boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.92), 0 2px 8px rgba(0,0,0,.5)" }}>
              Tap to start
            </span>
            <span className="px-3 py-1.5 text-[12px] font-bold leading-snug text-white" style={HUD_BOX}>
              {passOptions > 0
                ? "Flick to burst past him. Tap a team-mate to pass: green is on, red is risky."
                : "Tap left or right to touch the ball. Flick to burst past him."}
            </span>
          </span>
        </button>
      )}

      {phase === "result" && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/60">
          <div className="text-center px-4">
            <div className="text-2xl font-black text-amber-300">{resultText}</div>
            {/* Embedded in a real match, the parent reacts to `onComplete`
                and moves the match on itself (same beat the old dribble
                scenario used — see CanvasMatch.tsx) — there is no "again"
                to offer mid-match. Only the standalone sandbox gets the
                retry button. */}
            {!embedded && (
              <button
                onClick={() => reset(true)}
                className="mt-4 min-h-[44px] rounded-lg bg-emerald-500 px-5 py-2 text-sm font-black text-emerald-950 active:scale-95"
              >
                Go Again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return pitch;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-3 py-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-3">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-black tracking-widest uppercase">
            First-Person Dribble
          </div>
          <h1 className="mt-2 text-xl font-black tracking-tight">Beat your man</h1>
        </div>
        {pitch}
      </div>
    </div>
  );
}
