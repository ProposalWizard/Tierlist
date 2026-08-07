"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  buildWeightedScenario, buildAttackingScenario, buildScenario, pickScenarioKindFrom,
  launch, stepBall, stepBallInNet,
  stepKeeper, stepFollower, stepRunner, stepDefenders, stepSupport, initDefenders,
  chainKindFor, chainReturnChance, CHAIN_MAX, applyFirstTouch, visibleOptions,
  OUTCOME_TEXT, clamp,
  type Scenario, type Ball, type Outcome, type KickSkills, type ScenarioKind, type Viewport,
} from "@/lib/star/canvasEngine";
import {
  newMatch, advanceUntilInvolved, resolveScenario,
  type HiddenMatchState, type HiddenMatchInputs, type ScenarioRequest, type ScenarioResult,
} from "@/lib/star/hiddenMatch";
import {
  PITCH_W, HALF_LEN, CX, POST_L, POST_R, NET_DEPTH,
  SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH,
  PEN_SPOT_Y, ARC_R, CENTRE_R, CORNER_R,
} from "@/lib/star/pitch";
import { mulberry32 } from "@/lib/star/season";
import {
  commentaryBuildup, commentaryStrike, commentaryReceived, commentaryReceiverShot, commentaryResult,
} from "@/lib/star/matchCommentary";
import {
  primeMatchSound, setMatchSoundMuted, playKick, playNet, playPost, playSave, playWhistle, playCrowdSwell,
} from "@/lib/star/matchSound";
import { finaliseMatch } from "@/lib/star/matchStats";
import { pickSquadScorer, pickSquadAssist } from "@/lib/star/squadData";
import type { CareerState, MatchStats, Fixture, GoalEvent } from "@/lib/star/types";
import ContactBall from "./ContactBall";
import PostMatch from "./PostMatch";

type Phase = "aim" | "contact" | "flight" | "result" | "sim" | "postmatch";

// Match runs from minute 0 to 90. Chances are distributed organically — no
// fixed session length. The number of chances depends on player/team quality.
const MATCH_DURATION = 90;

interface Props {
  skills?: KickSkills;
  keeperStrength?: number;
  position?: string;
  teamRelationship?: number;
  career?: CareerState | null;
  seed?: number;
  // Career-match mode: when a fixture + onComplete are supplied, this runs a real
  // match — it tallies the scoreline, simulates the opponent between chances, and
  // hands finaliseMatch()'s MatchStats back to the career flow instead of showing
  // its own post-match summary. Without them it's the standalone sandbox.
  fixture?: Fixture;
  oppStrength?: number;
  onComplete?: (stats: MatchStats) => void;
}

// Only the fields finaliseMatch reads — lets the standalone sandbox produce a
// summary via the same canonical scorer without a real career loaded (all cash
// figures come out 0 rather than fabricated).
const FALLBACK_CAREER = {
  contract: { wage: 0, goalBonus: 0, assistBonus: 0 },
  relationships: { sponsors: 0 },
} as unknown as CareerState;

interface CreditDelta {
  shots: number; goals: number; passes: number; passesCompleted: number; chances: number; assists: number;
}
const NO_CREDIT: CreditDelta = { shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 };

// Credit a resolved chance from WHAT ACTUALLY HAPPENED — who struck the resolving
// shot and whether it scored — never from the scenario's shape. Keying off "is this
// a passing scenario" was the root of the miscredit bug: the physics lets you shoot
// straight at goal in a cutback/cross/through-ball without ever finding your man, so
// a scenario-shape branch dropped those goals on the floor (ball in the net, zero
// credit). Every crediting decision must flow through here so that split can't
// reappear. Exactly one of shots/passes/chances is incremented per call, which the
// "Chance N/N" progress counter relies on.
function creditChance(res: Outcome, ctx: { isChain: boolean; isSimplePass: boolean; receiverReached: boolean }): CreditDelta {
  const isGoal = OUTCOME_TEXT[res].kind === "goal";
  // A plain pass that reached its man.
  if (res === "delivered") return { ...NO_CREDIT, passes: 1, passesCompleted: 1 };
  // The team-mate you picked out took the resolving shot.
  if (ctx.isChain && ctx.receiverReached) return { ...NO_CREDIT, chances: 1, assists: isGoal ? 1 : 0 };
  // You went for goal yourself and scored — credit it even in a passing scenario.
  if (isGoal) return { ...NO_CREDIT, shots: 1, goals: 1 };
  // A passing move that broke down without a goal stays an attempted ball, not a shot.
  if (ctx.isChain) return { ...NO_CREDIT, chances: 1 };
  if (ctx.isSimplePass) return { ...NO_CREDIT, passes: 1 };
  // A shooting scenario you didn't convert.
  return { ...NO_CREDIT, shots: 1 };
}

// --- Knowitball match identity: "night match under floodlights" ---
// Deep cool pitch greens + floodlight wash, near-black glass chrome, gold accent.
const C = {
  pitchA: "#149046",
  pitchB: "#0e763a",
  line: "rgba(255,253,245,0.55)",
  lineFaint: "rgba(255,253,245,0.22)",
  you: "#10b981",
  youRim: "#065f46",
  mate: "#3b82f6",
  mateRim: "#1e3a5f",
  opp: "#dc2626",
  oppRim: "#7f1d1d",
  gk: "#fbbf24",
  gkRim: "#92400e",
  gold: "#fbbf24",
  goldSoft: "#fde68a",
};

// What the situation is, shown to the player so it reads clearly before they aim.
const SCENARIO_LABEL: Record<ScenarioKind, { verb: string; hint: string }> = {
  one_on_one: { verb: "1-ON-1!", hint: "Clean through on goal — pick your finish." },
  tight_angle: { verb: "TIGHT ANGLE!", hint: "Acute angle — the keeper's covering the near post." },
  long_range: { verb: "SHOOT!", hint: "Long way out — give it some pace." },
  volley: { verb: "VOLLEY!", hint: "Meet it first time — drag back to strike." },
  header: { verb: "HEADER!", hint: "Get up and meet the cross." },
  cutback: { verb: "CUTBACK!", hint: "Square it back — weight it into your team-mate's run." },
  byline_cross: { verb: "CROSS IT!", hint: "Whip it in — pick out the run attacking the box." },
  through_ball: { verb: "THROUGH BALL!", hint: "Split the line — play it into the space he's running into." },
  midfield_pass: { verb: "PASS!", hint: "Keep it simple — find your teammate." },
  penalty: { verb: "PENALTY!", hint: "12 yards out — pick your spot." },
  free_kick: { verb: "FREE KICK!", hint: "Bend it over the wall." },
  corner: { verb: "CORNER!", hint: "Deliver it into the box for the header." },
  buildup: { verb: "BUILD UP!", hint: "Find a teammate — forward passes may win you the ball back." },
};

interface Particle {
  x: number; y: number;       // pitch units
  vx: number; vy: number;     // pitch units/sec
  rot: number; vrot: number;
  life: number; maxLife: number;
  size: number;               // pitch units
  color: string;
}

// Draws the pitch, entities and ball to a canvas. Physics runs in an rAF loop.
/** How far ahead of the ball the camera looks, in seconds of its travel. */
const CAM_LEAD_S = 0.35;
/** How much of the way from the scenario framing to the ball the camera pans. */
const CAM_PULL = 0.55;
/** Easing per 60th of a second — lower is lazier. Never a cut. */
const CAM_EASE = 0.055;

/** How long "PASS" / "GOAL" stays on screen after the action. */
const ACTION_BANNER_MS = 1000;
/** Seconds the kicking pose is held so the swing is actually visible. */
const KICK_POSE_S = 0.28;

export default function CanvasMatch({ skills = { power: 55, technique: 55 }, keeperStrength = 62, position = "ST", teamRelationship = 60, career = null, seed = 12345, fixture, oppStrength, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const careerRef = useRef(career);
  careerRef.current = career;

  // Career-match mode is active when the career flow passes a fixture + callback.
  const matchMode = !!(fixture && onComplete);
  const matchModeRef = useRef(matchMode);
  matchModeRef.current = matchMode;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const oppStrengthRef = useRef(oppStrength ?? 65);
  oppStrengthRef.current = oppStrength ?? 65;
  const fixtureOpponent = fixture?.opponent ?? "The opposition";
  const fixtureOpponentRef = useRef(fixtureOpponent);
  fixtureOpponentRef.current = fixtureOpponent;

  // --- Session / scoreline tracking ---
  const attemptsRef = useRef(0);
  const tallyRef = useRef({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 });
  const userScoreRef = useRef(0);
  const oppScoreRef = useRef(0);
  const goalEventsRef = useRef<GoalEvent[]>([]);
  const [score, setScore] = useState({ user: 0, opp: 0 });
  const [finalStats, setFinalStats] = useState<MatchStats | null>(null);

  // --- Simulation between chances ---
  const matchMinuteRef = useRef(0);
  const [matchMinute, setMatchMinute] = useState(0);
  // Where a completed pass left the move, and how many passes deep it is. The
  // next scenario is built from this rather than drawn at random, so a move can
  // actually be built instead of every chance starting from nothing.
  const chainRef = useRef<{ pos: { x: number; y: number }; depth: number } | null>(null);

  interface SimEvent { minute: number; text: string; isGoal?: boolean; }
  const [simEvents, setSimEvents] = useState<SimEvent[]>([]);
  const [simVisible, setSimVisible] = useState(false);

  // The match going on around you. It owns possession, territory and momentum;
  // your chances are what it hands you, and their kind is decided by where the
  // ball actually was when it found you.
  const matchStateRef = useRef<HiddenMatchState>(newMatch(mulberry32(seed)));
  // The situation the simulation has just produced, consumed by the next
  // loadScenario() so the scenario matches the football that led to it.
  const pendingRequestRef = useRef<ScenarioRequest | null>(null);

  // ── Legs ──
  // Energy was a pre-match number that never moved: you finished the ninetieth
  // minute exactly as fresh as you started the first. It now drains with the
  // clock and with every chance you actually take, and it costs you power and
  // touch — never accuracy of intent, only execution. Match fitness decides how
  // fast it goes, which is what training it is for.
  const energyRef = useRef(career?.energy ?? 85);
  const [energy, setEnergyState] = useState(energyRef.current);
  const setEnergy = (v: number) => { energyRef.current = clamp(v, 0, 100); setEnergyState(energyRef.current); };
  const fitness = career?.matchFitness ?? 80;
  const drainPerMinute = 0.10 * (1.5 - clamp(fitness, 0, 100) / 100);
  const DRAIN_PER_CHANCE = 1.6;

  // What your legs are actually capable of right now. A tired player strikes the
  // ball less cleanly; he does not aim somewhere else.
  const tiredSkills = (): KickSkills => {
    const e = clamp(energyRef.current, 0, 100) / 100;
    return {
      power: skills.power * (0.82 + 0.18 * e),
      technique: skills.technique * (0.80 + 0.20 * e),
    };
  };

  const hiddenInputs = (): HiddenMatchInputs => {
    const car = careerRef.current;
    return {
      teamStrength: teamRef.current,
      oppStrength: oppStrengthRef.current,
      energy: energyRef.current,
      playerSkill: car ? (car.skills.power + car.skills.technique + car.skills.vision) / 3 : 55,
    };
  };

  // Translate what the physics produced into what the match needs to know.
  // Only a completed pass keeps the ball; everything else ends the move.
  const matchResultFor = (res: Outcome): ScenarioResult => {
    if (OUTCOME_TEXT[res].kind === "goal") return "goal";
    if (res === "delivered") return "delivered";
    if (res === "tackled") return "lost";
    return "saved";
  };

  const SIM_COMMENTARY = [
    "Possession is being shared evenly in midfield.",
    "The defense holds firm under pressure.",
    "A counter-attack breaks down in the final third.",
    "A tidy passing move comes to nothing.",
    "The ball is being recycled patiently at the back.",
    "A promising run down the wing is halted by a strong tackle.",
    "The keeper comes out to claim a hopeful cross.",
    "A long ball finds nobody — easily dealt with.",
    "Neat footwork in the middle of the park creates some space.",
    "The crowd are starting to get restless.",
    "A crunching challenge in midfield draws a free kick — nothing comes of it.",
    "The tempo drops as both sides look to regroup.",
    "A lovely piece of skill on the touchline, but the final ball lets them down.",
    "Chances have been at a premium here.",
  ];

  // --- Sound: muted by default until primed by the first user gesture ---
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("star-match-muted");
      if (saved === "1") { setMuted(true); setMatchSoundMuted(true); }
    } catch { /* ignore */ }
  }, []);
  const toggleMuted = () => {
    setMuted((m) => {
      const next = !m;
      setMatchSoundMuted(next);
      try { localStorage.setItem("star-match-muted", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const strengthRef = useRef(keeperStrength);
  strengthRef.current = keeperStrength;
  const positionRef = useRef(position);
  positionRef.current = position;
  const teamRef = useRef(teamRelationship);
  teamRef.current = teamRelationship;
  // Vision decides how much of the pitch you are told about — see visibleOptions.
  const visionRef = useRef(career?.skills.vision ?? 55);
  visionRef.current = career?.skills.vision ?? 55;

  const scenarioRef = useRef<Scenario>(buildWeightedScenario(mulberry32(seed), position, keeperStrength, teamRelationship));
  const ballRef = useRef<Ball | null>(null);
  const rngRef = useRef<() => number>(mulberry32(seed));
  const seedRef = useRef(seed);

  const phaseRef = useRef<Phase>("aim");
  const [phase, setPhaseState] = useState<Phase>("aim");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const [aim, setAim] = useState<{ dir: { x: number; y: number }; power: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [stats, setStats] = useState({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 });
  const [feed, setFeed] = useState<string[]>([]);
  const pushLine = useCallback((line: string) => {
    setFeed((f) => [...f, line].slice(-4));
  }, []);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  // Last-seen position per figure, so the renderer can tell who is moving and
  // put them in a running pose. Purely cosmetic — nothing reads it back.
  const motionRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Seconds remaining on the player's kicking pose. A strike takes one frame,
  // so without a hold the swing would never actually be seen.
  const kickPoseRef = useRef(0);
  // Action banner ("PASS" / "GOAL") and how long it stays up.
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const showAction = useCallback((text: string) => {
    setActionBanner(text);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setActionBanner(null), ACTION_BANNER_MS);
  }, []);

  // --- Cosmetic FX state (never touches physics) ---
  const reducedMotionRef = useRef(false);
  const trailRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef({ t: 0, dur: 1, mag: 0 });   // camera nudge
  const flashRef = useRef({ t: 0, dur: 1 });            // goal flash
  const seamRef = useRef(0);                            // ball roll angle

  // Respect prefers-reduced-motion: no shake, no confetti, only a faint brief flash.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const on = (e: MediaQueryListEvent) => { reducedMotionRef.current = e.matches; };
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  // --- Canvas sizing (device-pixel-ratio aware) ---
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // --- Announce the very first scenario + set its viewport ---
  useEffect(() => {
    // The opening scenario is built before this component mounts, so it needs
    // its defensive shape assigning here too.
    initDefenders(scenarioRef.current, rngRef.current);
    viewportRef.current = { ...scenarioRef.current.viewport };
    baseViewportRef.current = { ...scenarioRef.current.viewport };
    // In a real match, kick-off belongs to the match, not to you: it plays until
    // the ball finds you rather than dropping you into a chance in the first
    // minute. The sandbox still opens on a scenario, which is its whole point.
    if (matchModeRef.current) {
      startSimulation();
      return;
    }
    pushLine(commentaryBuildup(scenarioRef.current.kind, rngRef.current));
    playWhistle(); // no-op until the first user gesture primes audio — harmless
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Coordinate helpers (pitch <-> canvas pixels, viewport-aware) ---
  //
  // The camera used to be a flat orthographic map: pitch metres scaled straight
  // onto pixels, so the far end of the pitch was exactly as wide as the near
  // end and the goal read as a flat bar. There was no depth to judge a chip or
  // a bouncing ball against.
  //
  // It is now a shallow pinhole perspective, looking down the pitch from behind
  // the player. `d` is depth from the camera: 1 at the near edge, 1 + PERSPECTIVE
  // at the far edge (the goal). Screen position divides by depth, exactly as a
  // real camera does, so the pitch narrows toward the goal and the goal sits
  // higher and smaller.
  //
  // Two properties make this safe to drop under the existing drawing code:
  //  · straight lines stay straight, because screen y is an affine function of
  //    1/d and screen x is linear in it — so every pLine, pRect and marking
  //    still draws correctly, and now converges the way it should;
  //  · it is exactly invertible, which pitchFromPointer needs for aiming.
  const viewportRef = useRef<Viewport>({ x1: -5, x2: 105, y1: -5, y2: 100 });
  /** The scenario's framing. The live viewport eases around this, never jumps. */
  const baseViewportRef = useRef<Viewport>({ x1: -5, x2: 105, y1: -5, y2: 100 });

  /** Depth strength. 0 is the old flat camera; higher tilts it further over. */
  const PERSPECTIVE = 0.55;

  /** Normalised depth 0..1 (0 = far end / goal, 1 = near edge) -> screen 0..1. */
  const depthToScreen = useCallback((t: number) => {
    const dFar = 1 + PERSPECTIVE;
    const inv = 1 / (1 + PERSPECTIVE * (1 - t));
    const invFar = 1 / dFar;
    return (inv - invFar) / (1 - invFar);
  }, []);

  /** Inverse of depthToScreen. */
  const screenToDepth = useCallback((sy: number) => {
    const dFar = 1 + PERSPECTIVE;
    const invFar = 1 / dFar;
    const inv = invFar + sy * (1 - invFar);
    return 1 - (1 / inv - 1) / PERSPECTIVE;
  }, []);

  /** How much a metre at this depth is squeezed horizontally. */
  const depthScale = useCallback((t: number) => 1 / (1 + PERSPECTIVE * (1 - t)), []);

  const toPx = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current!;
    const vp = viewportRef.current;
    const nx = (x - vp.x1) / (vp.x2 - vp.x1);
    // t = 0 at the goal (far from the camera), 1 at the near edge behind the
    // player. The camera looks DOWN the pitch, so the goal end is the distant one.
    const t = (y - vp.y1) / (vp.y2 - vp.y1);
    const k = depthScale(t);
    return {
      px: (0.5 + (nx - 0.5) * k) * canvas.width,
      py: depthToScreen(t) * canvas.height,
      // Exposed so height, player size and the ball all shrink with distance.
      scale: k,
    };
  }, [depthScale, depthToScreen]);

  const pitchFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const vp = viewportRef.current;
    const sx = (clientX - rect.left) / rect.width;
    const sy = (clientY - rect.top) / rect.height;
    const t = clamp(screenToDepth(clamp(sy, 0, 1)), 0, 1);
    const k = depthScale(t);
    const nx = 0.5 + (sx - 0.5) / k;
    return {
      x: nx * (vp.x2 - vp.x1) + vp.x1,
      y: t * (vp.y2 - vp.y1) + vp.y1,
    };
  };

  // How hard the drag pulled, as a fraction of a full-power strike. Measured
  // against the VISIBLE height of the pitch rather than a fixed number of metres,
  // so a full-length drag means full power at every zoom level. Keying it to a
  // fixed metre count meant that on a tightly-framed chance the longest drag the
  // screen allowed was only a fraction of full power — which is why shots
  // sometimes travelled a fifth of the way and rolled to a stop.
  const powerFromDrag = useCallback((drag: { x: number; y: number }, ball: { x: number; y: number }) => {
    const vp = viewportRef.current;
    const full = (vp.y2 - vp.y1) * 0.30;
    return clamp(Math.hypot(drag.x - ball.x, drag.y - ball.y) / full, 0, 1);
  }, []);

  // --- Render one frame ---
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const sc = scenarioRef.current;
    const vp = viewportRef.current;
    // Pixels per metre. The viewport holds the canvas aspect exactly, so these two
    // agree — a metre is a metre whichever way it points, and circles stay circles.
    const unit = W / (vp.x2 - vp.x1);
    const uy = H / (vp.y2 - vp.y1);
    // Ball height, slightly foreshortened as befits the near-overhead camera.
    const heightScale = uy * 0.75;
    // A real ball is only 22 cm across — drawn true to scale it disappears, so it
    // is exaggerated a little and floored at a readable pixel size.
    const BALL_PX = Math.max(3, unit * 0.42);

    // Pitch-space drawing helpers — everything below goes through these so the
    // markings sit exactly where the physics thinks they are.
    const P = (x: number, y: number) => toPx(x, y);
    const pLine = (x1: number, y1: number, x2: number, y2: number) => {
      const a = P(x1, y1), b = P(x2, y2);
      ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
    };
    const pRect = (x1: number, y1: number, x2: number, y2: number) => {
      const a = P(x1, y1), b = P(x2, y2);
      ctx.strokeRect(a.px, a.py, b.px - a.px, b.py - a.py);
    };

    // Camera nudge — a decaying oscillation, big events only. Never under reduced motion.
    let ox = 0, oy = 0;
    const sh = shakeRef.current;
    if (sh.t > 0 && !reducedMotionRef.current) {
      const k = sh.t / sh.dur;
      const m = sh.mag * unit * k;
      ox = Math.sin(sh.t * 73) * m;
      oy = Math.cos(sh.t * 57) * m * 0.7;
    }
    ctx.save();
    ctx.translate(ox, oy);

    // --- Pitch: mowing stripes, 5 m bands laid out in PITCH space so they stay
    // pinned to the grass as the camera reframes between chances. ---
    ctx.fillStyle = C.pitchA;
    ctx.fillRect(0, 0, W, H);
    const BAND = 5;
    const firstBand = Math.floor((vp.y1 - NET_DEPTH) / BAND) * BAND;
    for (let by = firstBand; by < vp.y2 + BAND; by += BAND * 2) {
      const top = P(0, by).py, bot = P(0, by + BAND).py;
      ctx.fillStyle = C.pitchB;
      ctx.fillRect(0, top, W, bot - top + 1);
    }
    // PLUG-IN (optional asset): a subtle 256px grass-noise tile can be drawn here at ~8% alpha
    // via ctx.createPattern(img, "repeat") for extra texture. See notes in the PR/commit.

    // Floodlight wash from the goal end...
    const flood = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    flood.addColorStop(0, "rgba(255,255,235,0.10)");
    flood.addColorStop(1, "rgba(255,255,235,0)");
    ctx.fillStyle = flood;
    ctx.fillRect(-unit * 2, 0, W + unit * 4, H * 0.5);
    // ...and a vignette so the edges fall away.
    const vig = ctx.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.3, W / 2, H * 0.42, Math.max(W, H) * 0.78);
    vig.addColorStop(0, "rgba(1,14,8,0)");
    vig.addColorStop(1, "rgba(1,14,8,0.34)");
    ctx.fillStyle = vig;
    ctx.fillRect(-unit * 2, -unit * 2, W + unit * 4, H + unit * 4);

    // --- Markings: every line at its real IFAB distance, drawn in pitch space ---
    const lw = Math.max(1, unit * 0.12); // ~12 cm painted line
    ctx.lineWidth = lw;
    ctx.strokeStyle = C.line;

    // Touchlines + goal line
    pLine(0, 0, PITCH_W, 0);
    pLine(0, 0, 0, HALF_LEN);
    pLine(PITCH_W, 0, PITCH_W, HALF_LEN);
    // Penalty area (40.32 x 16.5) and six-yard box (18.32 x 5.5)
    pRect(BOX_L, 0, BOX_R, BOX_DEPTH);
    pRect(SIX_L, 0, SIX_R, SIX_DEPTH);
    // Penalty spot + the D (an arc of radius 9.15 m clipped to outside the box)
    {
      const spot = P(CX, PEN_SPOT_Y);
      ctx.beginPath();
      ctx.arc(spot.px, spot.py, Math.max(1.5, unit * 0.11), 0, Math.PI * 2);
      ctx.fillStyle = C.line;
      ctx.fill();
      // Only the portion beyond the 16.5 m line is painted.
      const half = Math.acos(clamp((BOX_DEPTH - PEN_SPOT_Y) / ARC_R, -1, 1));
      ctx.beginPath();
      ctx.arc(spot.px, spot.py, unit * ARC_R, Math.PI / 2 - half, Math.PI / 2 + half);
      ctx.stroke();
    }
    // Corner arcs (1 m quarter circles at each corner flag)
    {
      const c1 = P(0, 0), c2 = P(PITCH_W, 0);
      ctx.beginPath(); ctx.arc(c1.px, c1.py, unit * CORNER_R, 0, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(c2.px, c2.py, unit * CORNER_R, Math.PI / 2, Math.PI); ctx.stroke();
    }
    // Halfway line + centre circle
    ctx.strokeStyle = C.lineFaint;
    pLine(0, HALF_LEN, PITCH_W, HALF_LEN);
    {
      const cc = P(CX, HALF_LEN);
      ctx.beginPath();
      ctx.arc(cc.px, cc.py, unit * CENTRE_R, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- Goal: the net sits BEHIND the goal line (negative y), so a ball that
    // scores is visibly in the netting. Previously this was pinned to the top of
    // the canvas while the physics line stayed at pitch y=0 — which is why a goal
    // could register with the ball still apparently short of the net. ---
    {
      const back = P(POST_L, -NET_DEPTH);
      const front = P(POST_R, 0);
      const nx = back.px, ny = back.py;
      const nw = front.px - back.px, nh = front.py - back.py;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(nx, ny, nw, nh);
      // Net mesh, roughly 0.6 m squares
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1;
      for (let x = POST_L; x <= POST_R + 0.01; x += 0.6) pLine(x, -NET_DEPTH, x, 0);
      for (let y = -NET_DEPTH; y <= 0.01; y += 0.6) pLine(POST_L, y, POST_R, y);
      // Posts + crossbar line
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, unit * 0.24);
      pLine(POST_L, 0, POST_L, -NET_DEPTH);
      pLine(POST_R, 0, POST_R, -NET_DEPTH);
      pLine(POST_L, -NET_DEPTH, POST_R, -NET_DEPTH);
      // The goal line between the posts, drawn brightest — this is the line the
      // ball must fully cross.
      ctx.lineWidth = Math.max(2, unit * 0.2);
      pLine(POST_L, 0, POST_R, 0);
    }

    // ── What you can SEE ──
    // Vision buys information, not accuracy. Everyone is drawn either way —
    // hiding players would read as a bug — but only the options a player of this
    // vision could actually pick out are marked, and only the ones inside the
    // range he is scanning. At 30 vision you get the obvious man; at 90 you get
    // three, and the best of them is called out.
    if (phaseRef.current === "aim" && !sc.receiverDone) {
      const seen = visibleOptions(sc, sc.player, visionRef.current);
      seen.forEach((o, i) => {
        const m = P(o.runner.pos.x, o.runner.pos.y);
        const best = i === 0 && seen.length > 1;
        ctx.lineWidth = Math.max(1.2, unit * (best ? 0.15 : 0.1));
        ctx.strokeStyle = best ? "rgba(52,211,153,0.85)" : "rgba(147,197,253,0.5)";
        ctx.beginPath();
        ctx.arc(m.px, m.py - unit * 1.9, unit * (best ? 0.72 : 0.55), 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // Pass aim marker — where the run is heading. Drawn small and on the grass so
    // it reads as a destination, not as a ring around a player.
    if (sc.runner && !sc.receiverDone) {
      const t = P(sc.runner.to.x, sc.runner.to.y);
      ctx.setLineDash([unit * 0.5, unit * 0.45]);
      ctx.lineWidth = Math.max(1.5, unit * 0.14);
      ctx.strokeStyle = "rgba(167,139,250,0.8)";
      ctx.beginPath();
      ctx.arc(t.px, t.py, unit * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // --- Footballers ---
    //
    // Drawn as actual figures rather than discs: shadow, legs, shorts, shirt,
    // arms and head, with the limbs posed by what the player is doing. The
    // camera looks down the pitch from behind and slightly above, so the head
    // sits high on the body and the limbs splay out below it.
    //
    // Poses are cosmetic only. Every position, collision and reception test
    // still uses the single point the figure is centred on, exactly as the
    // discs did — so nothing about the physics changed with the artwork.
    const SKIN = "#c68642";
    type Pose = "idle" | "run" | "kick" | "receive";

    const footballer = (
      x: number, y: number, rBase: number,
      shirt: string, rim: string,
      opts: { pose?: Pose; phase?: number; facing?: number; label?: string; labelColor?: string; shorts?: string } = {},
    ) => {
      const { px, py, scale } = toPx(x, y);
      // Further up the pitch is further from the camera, so figures there are
      // drawn smaller. This is most of what sells the depth.
      const r = rBase * scale;
      const pose = opts.pose ?? "idle";
      const phase = opts.phase ?? 0;
      const shorts = opts.shorts ?? "#111827";
      const lw = Math.max(1.4, r * 0.30);

      // Ground shadow stays put while the figure above it moves.
      ctx.beginPath();
      ctx.ellipse(px, py + r * 0.72, r * 0.78, r * 0.30, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.34)";
      ctx.fill();

      ctx.save();
      ctx.translate(px, py);
      if (opts.facing) ctx.rotate(opts.facing);

      // Limb swing. Running scissors the legs and counter-swings the arms;
      // a kick throws one leg through and the arms wide for balance.
      const swing = pose === "run" ? Math.sin(phase) : 0;
      const kick = pose === "kick" ? 1 : 0;
      const open = pose === "receive" ? 1 : 0;

      ctx.lineCap = "round";
      ctx.lineWidth = lw;

      // ── Legs ──
      ctx.strokeStyle = SKIN;
      const hipY = r * 0.18;
      const legL = r * 0.62;
      const legSwing = swing * r * 0.42 + kick * r * 0.55;
      ctx.beginPath();
      ctx.moveTo(-r * 0.24, hipY);
      ctx.lineTo(-r * 0.24 - legSwing * 0.35, hipY + legL - Math.abs(legSwing) * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.24, hipY);
      ctx.lineTo(r * 0.24 + legSwing * 0.35, hipY + legL - Math.abs(legSwing) * 0.15);
      ctx.stroke();

      // ── Shorts ──
      ctx.fillStyle = shorts;
      ctx.beginPath();
      ctx.roundRect?.(-r * 0.42, -r * 0.02, r * 0.84, r * 0.34, r * 0.12);
      if (!ctx.roundRect) ctx.rect(-r * 0.42, -r * 0.02, r * 0.84, r * 0.34);
      ctx.fill();

      // ── Arms ── (counter-swing to the legs, thrown wide to receive)
      ctx.strokeStyle = SKIN;
      ctx.lineWidth = lw * 0.85;
      const armOut = r * (0.52 + open * 0.34 + kick * 0.26);
      const armDrop = r * (0.24 - open * 0.18);
      ctx.beginPath();
      ctx.moveTo(-r * 0.34, -r * 0.30);
      ctx.lineTo(-armOut, armDrop + swing * r * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.34, -r * 0.30);
      ctx.lineTo(armOut, armDrop - swing * r * 0.22);
      ctx.stroke();

      // ── Shirt ──
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.roundRect?.(-r * 0.46, -r * 0.52, r * 0.92, r * 0.62, r * 0.16);
      if (!ctx.roundRect) ctx.rect(-r * 0.46, -r * 0.52, r * 0.92, r * 0.62);
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.strokeStyle = rim;
      ctx.stroke();

      // ── Head ──
      ctx.beginPath();
      ctx.arc(0, -r * 0.72, r * 0.30, 0, Math.PI * 2);
      ctx.fillStyle = SKIN;
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.10);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.stroke();

      ctx.restore();

      if (opts.label) {
        ctx.fillStyle = opts.labelColor ?? "#fff";
        ctx.font = `bold ${Math.round(r * 0.52)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(opts.label, px, py - r * 0.22);
      }
    };

    // A player occupies roughly a metre across the shoulders — sized in real
    // metres now, so players no longer dwarf or vanish against the markings.
    const R = unit * 1.25;

    // Running phase, shared by everyone so the crowd of figures does not march
    // in lockstep — each is offset by its own position.
    const now = performance.now() / 1000;
    const runPhase = (seedX: number) => now * 9 + seedX * 1.7;

    // Whether a figure is moving, from how far it travelled since last frame.
    // Cheaper and more reliable than threading velocity out of every entity,
    // and it works for the ones that only expose a position.
    const motion = motionRef.current;
    const poseFor = (id: string, x: number, y: number): Pose => {
      const prev = motion.get(id);
      motion.set(id, { x, y });
      if (!prev) return "idle";
      return Math.hypot(x - prev.x, y - prev.y) > 0.02 ? "run" : "idle";
    };

    // Highlight the runner while they control a pass they've just won
    const rb = ballRef.current;
    if (rb && rb.receiverControlT > 0 && sc.runner) {
      const { px, py } = toPx(sc.runner.pos.x, sc.runner.pos.y);
      ctx.beginPath();
      ctx.arc(px, py, R * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(167,139,250,0.4)";
      ctx.fill();
    }

    // Rebound poacher — only worth drawing once he's actually chasing something
    if (sc.follower.active) {
      footballer(sc.follower.x, sc.follower.y, R, C.mate, C.mateRim, {
        pose: poseFor("follower", sc.follower.x, sc.follower.y),
        phase: runPhase(sc.follower.x),
      });
    }

    // Decorative team-mates (the crosser on a volley/header)
    sc.teammates.forEach((t, i) => {
      footballer(t.x, t.y, R, C.mate, C.mateRim, {
        pose: poseFor(`mate${i}`, t.x, t.y),
        phase: runPhase(t.x),
      });
    });

    // The runner a pass is aimed at — drawn at their LIVE position, which is the
    // exact point reception is tested against, so the ball can never appear to
    // pass through them without being controlled.
    [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners].forEach((r, i) => {
      // Arms out the moment they take the ball down, so a completed pass reads
      // on the pitch and not only in the commentary.
      const receiving = i === 0 && !!rb && rb.receiverControlT > 0;
      footballer(r.pos.x, r.pos.y, R, C.mate, C.mateRim, {
        pose: receiving ? "receive" : poseFor(`run${i}`, r.pos.x, r.pos.y),
        phase: runPhase(r.pos.x),
      });
    });

    // Defenders + you
    sc.defenders.forEach((d, i) => {
      footballer(d.x, d.y, R, C.opp, C.oppRim, {
        pose: poseFor(`def${i}`, d.x, d.y),
        phase: runPhase(d.x),
      });
    });
    footballer(sc.player.x, sc.player.y, R, C.you, C.youRim, {
      // Held briefly after a strike so the swing is visible rather than
      // happening entirely between two frames.
      pose: kickPoseRef.current > 0 ? "kick" : poseFor("you", sc.player.x, sc.player.y),
      phase: runPhase(sc.player.x),
      label: "YOU",
      labelColor: "#fff",
    });

    // ── Keeper ──
    // Drawn DELIBERATELY SMALL and at reduced opacity while the ball is live.
    // He stands right in the mouth of the goal from this camera, so a keeper
    // drawn at full size hid the very thing you are trying to watch: whether
    // your shot went in. He is still exactly where the save maths says he is —
    // only the artwork is restrained.
    {
      const kk = sc.keeper;
      const { px, py, scale: kScale } = toPx(kk.x, kk.y);
      // `dive` is a lean while patrolling and a committed lunge once a save has
      // been decided; saveLunge eases the second one in after the fact.
      const lunge = kk.saveLunge > 0 ? kk.saveLunge : 0;

      // ── Which save is being played ──
      // Set by the engine only after the outcome was decided, so the pose always
      // matches what actually happened rather than predicting it.
      // lean   : how far the body pitches over
      // armUp  : -1 arms driven down, +1 thrown up
      // spread : how wide the arms go
      // reachK : how far the leading glove extends
      // crouch : vertical drop of the whole body
      const KIND = {
        catch:     { lean: 0.15, armUp:  0.25, spread: 0.45, reachK: 0.55, crouch: 0.10 },
        central:   { lean: 0.05, armUp: -0.10, spread: 1.05, reachK: 0.80, crouch: 0.22 },
        low:       { lean: 1.15, armUp: -0.85, spread: 0.95, reachK: 1.35, crouch: 0.30 },
        high:      { lean: 0.55, armUp:  1.00, spread: 0.80, reachK: 1.30, crouch: -0.35 },
        fingertip: { lean: 1.30, armUp:  0.35, spread: 0.70, reachK: 1.70, crouch: 0.05 },
      } as const;
      const kind = kk.saveKind ?? null;
      const K = kind ? KIND[kind] : null;

      // ── Idle life ──
      // Breathing and a slow weight shift, so a keeper waiting on his line never
      // looks frozen. Tiny on purpose — it should read as alive, not as fidgeting.
      const breathe = Math.sin(kk.idleT * 2.1) * 0.02;
      const weight = Math.sin(kk.idleT * 0.9) * 0.05;

      // How far the body is committed: a lean while patrolling, a full lunge once
      // a save is being played.
      const diveN = clamp(Math.abs(kk.dive) / 1.6, 0, 1) * 0.45 + lunge * (K ? K.reachK : 0.55);
      const sign = kk.saveLunge > 0 ? (kk.saveDir || 1) : (kk.dive === 0 ? 0 : Math.sign(kk.dive));
      const KR = R * 0.82 * kScale;   // smaller than an outfielder, smaller again far away
      const lean = sign * diveN * (K ? K.lean : 0.9);
      const cx = px + sign * KR * lunge * (K ? K.reachK : 1.0) * 1.2;
      const cyOff = KR * ((K ? K.crouch : 0) * lunge + breathe);
      const gloveR = KR * 0.24;

      ctx.save();
      ctx.globalAlpha = 0.92;

      ctx.beginPath();
      ctx.ellipse(cx, py + KR * 0.72, KR * (0.7 + diveN * 0.5), KR * 0.26, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();

      if (kk.flash > 0) {
        ctx.beginPath();
        ctx.arc(cx, py, KR * 1.3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(250,204,21,0.35)";
        ctx.fill();
      }

      ctx.translate(cx + KR * weight * (1 - lunge), py + cyOff);
      ctx.rotate(lean);
      ctx.lineCap = "round";

      // Legs
      ctx.strokeStyle = SKIN;
      ctx.lineWidth = Math.max(1.2, KR * 0.28);
      ctx.beginPath();
      ctx.moveTo(-KR * 0.22, KR * 0.16);
      ctx.lineTo(-KR * 0.30 - diveN * KR * 0.3, KR * 0.76);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(KR * 0.22, KR * 0.16);
      ctx.lineTo(KR * 0.30 + diveN * KR * 0.3, KR * 0.76);
      ctx.stroke();

      // Shorts
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect?.(-KR * 0.40, -KR * 0.02, KR * 0.80, KR * 0.32, KR * 0.12);
      if (!ctx.roundRect) ctx.rect(-KR * 0.40, -KR * 0.02, KR * 0.80, KR * 0.32);
      ctx.fill();

      // Arms — direction and spread come from the save being played. A high save
      // drives them up, a low save down, a catch brings them together in front.
      const spread = K ? K.spread : 1;
      const armUp = K ? K.armUp : 0;
      const reach = KR * (0.62 + diveN * 0.85) * (0.55 + spread * 0.45);
      const armY = -KR * 0.28 - armUp * diveN * KR * 0.85;
      ctx.strokeStyle = SKIN;
      ctx.lineWidth = Math.max(1.1, KR * 0.24);
      const gloves: { x: number; y: number }[] = [];
      for (const s2 of [-1, 1]) {
        // The leading glove goes furthest; the trailing one stays tucked.
        const leading = sign === 0 || Math.sign(s2) === sign;
        const ex = s2 * reach * (leading ? 1 : 0.62);
        const ey = armY - (leading ? diveN * KR * 0.2 : 0);
        ctx.beginPath();
        ctx.moveTo(s2 * KR * 0.32, -KR * 0.28);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        gloves.push({ x: ex, y: ey });
      }

      // Shirt
      ctx.fillStyle = C.gk;
      ctx.beginPath();
      ctx.roundRect?.(-KR * 0.44, -KR * 0.50, KR * 0.88, KR * 0.58, KR * 0.15);
      if (!ctx.roundRect) ctx.rect(-KR * 0.44, -KR * 0.50, KR * 0.88, KR * 0.58);
      ctx.fill();
      ctx.lineWidth = Math.max(1, KR * 0.11);
      ctx.strokeStyle = C.gkRim;
      ctx.stroke();

      // Gloves — what actually makes him read as a keeper
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = C.gkRim;
      ctx.lineWidth = Math.max(1, KR * 0.09);
      for (const g of gloves) {
        ctx.beginPath();
        ctx.arc(g.x, g.y, gloveR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Head
      ctx.beginPath();
      ctx.arc(0, -KR * 0.70, KR * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = SKIN;
      ctx.fill();
      ctx.lineWidth = Math.max(1, KR * 0.09);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.stroke();

      ctx.restore();
    }

    // --- Ball trail (fades along the flight; curl makes it sing) ---
    const trail = trailRef.current;
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const k = (i + 1) / trail.length;
      const { px, py, scale } = toPx(t.x, t.y);
      ctx.beginPath();
      ctx.arc(px, py - t.z * heightScale * scale, BALL_PX * scale * (0.3 + 0.5 * k), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.06 + 0.24 * k})`;
      ctx.fill();
    }

    // --- Ball ---
    // Three cues tell you how high it is, because one is never enough:
    //   1. it lifts off its own shadow, and the gap grows with height;
    //   2. the shadow shrinks and fades as it climbs away from the grass;
    //   3. the ball itself grows as it rises toward the camera.
    // The old version had the first of these and almost none of the other two,
    // which is why a chip and a driven shot looked much the same.
    const drawBall = (x: number, y: number, z: number) => {
      const { px, py, scale } = toPx(x, y);
      const bScale = BALL_PX * scale;
      const h = Math.max(0, z);

      // Ground shadow — stays ON the pitch, directly under the ball.
      const shadowShrink = 1 / (1 + h * 0.16);
      ctx.beginPath();
      ctx.ellipse(px, py, bScale * 1.05 * shadowShrink, bScale * 0.5 * shadowShrink, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.34 * shadowShrink})`;
      ctx.fill();

      // The ball, lifted off the shadow and grown a little with height.
      const by = py - h * heightScale * scale;
      const br = bScale * (1 + Math.min(h, 8) * 0.055);
      ctx.beginPath();
      ctx.arc(px, by, br, 0, Math.PI * 2);
      ctx.fillStyle = "#fefefe";
      ctx.fill();
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.strokeStyle = "#0f172a";
      ctx.stroke();
      // rolling seam patches
      const a = seamRef.current;

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, by, br * 0.92, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * br * 0.45, by + Math.sin(a) * br * 0.45, br * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(15,23,42,0.16)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px - Math.cos(a) * br * 0.5, by - Math.sin(a) * br * 0.5, br * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(15,23,42,0.12)";
      ctx.fill();
      ctx.restore();
    };

    const ball = ballRef.current;
    if (ball) drawBall(ball.pos.x, ball.pos.y, ball.z);
    else if (phaseRef.current === "aim") drawBall(sc.ball.x, sc.ball.y, 0);

    // --- Aim slingshot overlay (brand gold) ---
    if (phaseRef.current === "aim" && draggingRef.current && dragRef.current) {
      const d = dragRef.current;
      const power = powerFromDrag(d, sc.ball);
      const dx = sc.ball.x - d.x, dy = sc.ball.y - d.y;
      const len = Math.hypot(dx, dy) || 1;
      const lineLen = power * (vp.y2 - vp.y1) * 0.22;
      const ex = sc.ball.x + (dx / len) * lineLen;
      const ey = sc.ball.y + (dy / len) * lineLen;
      const a = toPx(sc.ball.x, sc.ball.y);
      const b = toPx(ex, ey);
      // Solid, tapered orange arrow: a round-capped shaft into a clean triangular
      // head. Same length as before (tip stays at b) — only the styling changed.
      const ang = Math.atan2(b.py - a.py, b.px - a.px);
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const nx = -uy, ny = ux; // perpendicular
      const arrowLen = Math.hypot(b.px - a.px, b.py - a.py) || 1;
      const headLen = clamp(W * 0.075, W * 0.03, arrowLen * 0.55);
      const headHalf = W * 0.05;
      const shaftW = W * 0.03;
      const bx = b.px - ux * headLen, by = b.py - uy * headLen; // head base

      // shaft
      const shaftGrad = ctx.createLinearGradient(a.px, a.py, b.px, b.py);
      shaftGrad.addColorStop(0, "#fb923c");
      shaftGrad.addColorStop(1, "#ea580c");
      ctx.strokeStyle = shaftGrad;
      ctx.lineWidth = shaftW;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.lineCap = "butt";

      // head
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(bx + nx * headHalf, by + ny * headHalf);
      ctx.lineTo(bx - nx * headHalf, by - ny * headHalf);
      ctx.closePath();
      ctx.fillStyle = "#f97316";
      ctx.fill();
      // subtle darker edge for definition
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1, unit * 0.22);
      ctx.strokeStyle = "rgba(124,45,18,0.6)";
      ctx.stroke();

      // power meter (left) — sized off the canvas so it holds still as the camera zooms
      const meterX = W * 0.045, meterTop = H * 0.15, meterH = H * 0.7, meterW = W * 0.055;
      ctx.fillStyle = "rgba(2,6,23,0.55)";
      ctx.fillRect(meterX, meterTop, meterW, meterH);
      const fillH = meterH * power;
      const grad = ctx.createLinearGradient(0, meterTop + meterH, 0, meterTop);
      grad.addColorStop(0, "#22c55e"); grad.addColorStop(0.6, "#eab308"); grad.addColorStop(1, "#ef4444");
      ctx.fillStyle = grad;
      ctx.fillRect(meterX, meterTop + meterH - fillH, meterW, fillH);
      ctx.strokeStyle = "rgba(251,191,36,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(meterX, meterTop, meterW, meterH);
      ctx.fillStyle = C.goldSoft;
      ctx.font = `bold ${Math.round(W * 0.05)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(power * 100)}%`, meterX + meterW / 2, meterTop - W * 0.022);
    }

    // --- Confetti (brand colours, goal only) ---
    for (const p of particlesRef.current) {
      const { px, py } = toPx(p.x, p.y);
      const s = p.size * unit;
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-s / 2, -s / 4, s, s / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // end camera nudge

    // --- Goal flash (screen-space, not shaken; faint + brief under reduced motion) ---
    const fl = flashRef.current;
    if (fl.t > 0) {
      const k = fl.t / fl.dur;
      const maxA = reducedMotionRef.current ? 0.14 : 0.32;
      const gm = toPx(CX, 0);
      const fg = ctx.createRadialGradient(gm.px, gm.py, 0, gm.px, gm.py, W * 0.75);
      fg.addColorStop(0, `rgba(253,230,138,${maxA * k})`);
      fg.addColorStop(1, "rgba(253,230,138,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
    }
  }, [toPx]);

  // --- Cosmetic FX helpers ---
  const nudge = (dur: number, mag: number) => {
    if (reducedMotionRef.current) return;
    shakeRef.current = { t: dur, dur, mag };
  };

  const spawnGoalFx = () => {
    if (reducedMotionRef.current) {
      flashRef.current = { t: 0.25, dur: 0.25 };
      return;
    }
    flashRef.current = { t: 0.55, dur: 0.55 };
    nudge(0.4, 0.35); // metres of camera travel — the shake is in pitch units now
    const b = ballRef.current;
    const origin = b ? { x: b.pos.x, y: Math.max(b.pos.y, 0.5) } : { x: CX, y: 0.5 };
    const rng = rngRef.current;
    const colors = [C.gold, C.goldSoft, "#34d399", "#ffffff", C.you];
    for (let i = 0; i < 46; i++) {
      const life = 0.8 + rng() * 0.6;
      particlesRef.current.push({
        x: origin.x + (rng() - 0.5) * 5,
        y: origin.y + (rng() - 0.5) * 2,
        vx: (rng() - 0.5) * 14,
        vy: -(3 + rng() * 11),
        rot: rng() * Math.PI * 2,
        vrot: (rng() - 0.5) * 10,
        life, maxLife: life,
        size: 0.5 + rng() * 0.7,
        color: colors[Math.floor(rng() * colors.length)],
      });
    }
  };

  // --- Main animation loop ---
  useEffect(() => {
    const loop = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      let dt = (ts - last) / 1000;
      lastTsRef.current = ts;
      dt = Math.min(dt, 0.05); // clamp big frame gaps

      // ── The world runs while you AIM ──
      // It used to be frozen until you struck the ball, so a scenario had no
      // time pressure at all: defenders were static dots and you could
      // deliberate forever. Running the defence here is what creates the
      // decision window — the nearest defender closes you down and the others
      // shut your passing lanes, so every option quietly gets worse the longer
      // you hold it. No timer, no countdown; just football closing in.
      if (phaseRef.current === "aim") {
        const sc = scenarioRef.current;
        const lost = stepDefenders(sc, dt, sc.player, true);
        stepKeeper(sc, dt);
        // …and your team-mates work against that. While the cover slides onto
        // your lane, the man they are covering moves somewhere they are not, so
        // your options shift rather than only decaying.
        stepSupport(sc, ballRef.current, sc.player, dt);
        stepRunner(sc, dt);
        if (lost) resolveOutcome(lost);
      }

      if (phaseRef.current === "flight" && ballRef.current) {
        // Substep for stable physics
        const steps = 3;
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          // Defenders keep working during the flight too, so a slow pass can
          // still be cut out by the man who was already sliding across.
          // Defenders read the flight: they go for a ball they can reach and
          // sprint back goal-side once it is past them.
          stepDefenders(scenarioRef.current, h, ballRef.current.pos, false, ballRef.current);
          stepKeeper(scenarioRef.current, h);
          // Everyone goes for a ball that was not played straight at them.
          stepSupport(scenarioRef.current, ballRef.current, ballRef.current.pos, h);
          stepRunner(scenarioRef.current, h);
          stepFollower(scenarioRef.current, ballRef.current, rngRef.current, h);
          const res = stepBall(ballRef.current, scenarioRef.current, rngRef.current, h);
          if (res) { resolveOutcome(res); break; }
        }
        // Surface mid-flight moments (pass reception / the teammate's own shot) once.
        const ev = ballRef.current?.event;
        const receiver = scenarioRef.current.receiver;
        if (ev && receiver) {
          if (ev === "received") { pushLine(commentaryReceived(receiver.roleLabel, rngRef.current)); showAction("PASS"); }
          else if (ev === "receiverShot") { pushLine(commentaryReceiverShot(receiver.roleLabel, rngRef.current)); playKick(); kickPoseRef.current = KICK_POSE_S; }
        }
        if (ballRef.current) ballRef.current.event = null;
      }

      // A scored ball keeps travelling into the netting after the outcome has
      // resolved, so the goal is seen rather than announced.
      if (phaseRef.current === "result" && ballRef.current?.inNet) {
        stepBallInNet(ballRef.current, dt);
      }

      // Cosmetic FX advance (pausing the rAF pauses everything together)
      if (kickPoseRef.current > 0) kickPoseRef.current = Math.max(0, kickPoseRef.current - dt);

      // ── Camera follow ──
      // Eases toward the ball rather than cutting to it, and only ever pans —
      // the zoom stays as the scenario framed it, so the pitch never lurches.
      // Deliberately leads the ball a little so there is room ahead to read the
      // trajectory, which is the whole reason to follow it at all.
      {
        const base = baseViewportRef.current;
        const vpNow = viewportRef.current;
        const b = ballRef.current;
        const w = base.x2 - base.x1, hgt = base.y2 - base.y1;
        let wantCx = (base.x1 + base.x2) / 2;
        let wantCy = (base.y1 + base.y2) / 2;

        if (b && !b.resting) {
          // Lead the ball by a fraction of a second of its own travel.
          const leadX = b.vel.x * CAM_LEAD_S;
          const leadY = b.vel.y * CAM_LEAD_S;
          // Pan only part of the way, so the goal stays in frame rather than the
          // camera chasing the ball out of context.
          wantCx += ((b.pos.x + leadX) - wantCx) * CAM_PULL;
          wantCy += ((b.pos.y + leadY) - wantCy) * CAM_PULL;
        }

        const curCx = (vpNow.x1 + vpNow.x2) / 2;
        const curCy = (vpNow.y1 + vpNow.y2) / 2;
        // Frame-rate independent easing — the same feel at 30 fps and 144.
        const ease = 1 - Math.pow(1 - CAM_EASE, dt * 60);
        const cx = curCx + (wantCx - curCx) * ease;
        const cy = curCy + (wantCy - curCy) * ease;
        viewportRef.current = {
          x1: cx - w / 2, x2: cx + w / 2,
          y1: cy - hgt / 2, y2: cy + hgt / 2,
        };
      }

      if (shakeRef.current.t > 0) shakeRef.current.t = Math.max(0, shakeRef.current.t - dt);
      if (flashRef.current.t > 0) flashRef.current.t = Math.max(0, flashRef.current.t - dt);
      for (const p of particlesRef.current) {
        p.vy += 22 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        p.life -= dt;
      }
      if (particlesRef.current.length) particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      const b = ballRef.current;
      if (phaseRef.current === "flight" && b && !b.resting) {
        seamRef.current += (b.spin * 0.3 + Math.hypot(b.vel.x, b.vel.y) * 0.06) * dt;
        trailRef.current.push({ x: b.pos.x, y: b.pos.y, z: b.z });
        if (trailRef.current.length > 16) trailRef.current.shift();
      } else if (trailRef.current.length) {
        trailRef.current.shift(); // let it dissolve after the play resolves
      }

      render();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveOutcome = (res: Outcome) => {
    setOutcome(res);
    setPhase("result");
    const sc = scenarioRef.current;
    const isChain = sc.receiver != null;
    const isSimplePass = sc.passTarget != null && !isChain;
    const receiverReached = sc.receiverDone;
    const kind = OUTCOME_TEXT[res].kind;

    // The tally lives in a ref so it's authoritative the instant this chance
    // resolves — the rAF loop calls a stale resolveOutcome closure, so reading it
    // back off React state would risk under-counting the final chance. State is
    // just a mirror for the HUD.
    const d = creditChance(res, { isChain, isSimplePass, receiverReached });
    const t = tallyRef.current;
    t.shots += d.shots;
    t.goals += d.goals;
    t.passes += d.passes;
    t.passesCompleted += d.passesCompleted;
    t.chances += d.chances;
    t.assists += d.assists;
    setStats({ ...t });

    // Your team scores whenever the ball ends up in the net — your own finish or a
    // teammate you set up (same rule the old DOM match used: goal || assist).
    if (kind === "goal") {
      userScoreRef.current += 1;
      setScore({ user: userScoreRef.current, opp: oppScoreRef.current });
    }

    // Hand the outcome back to the match. Without this it would carry on as
    // though your moment never happened — you would score and the ball would
    // still be in their box.
    if (matchModeRef.current) resolveScenario(matchStateRef.current, matchResultFor(res));

    // Celebration / impact FX + sound, matched to what the physics produced.
    if (kind === "goal") {
      showAction("GOAL");
      spawnGoalFx();
      playNet();
      playCrowdSwell("cheer");
    } else if (res === "post") {
      nudge(0.28, 0.25);
      playPost();
      playCrowdSwell("groan");
    } else if (res === "saved" || res === "tipped") {
      nudge(0.18, 0.14);
      playSave();
      playCrowdSwell("groan");
    } else if (res === "caught" || res === "blocked") {
      nudge(0.18, 0.14);
      playSave();
    } else if (res === "offside") {
      playWhistle();
    }

    // Assign named squad players to goals and update the goal events log.
    // Chain goals → a named attacker from the squad scores; user assisted.
    // Direct user goals → optionally pick a named squad member as assister.
    let commentaryRoleLabel = sc.receiver?.roleLabel;
    if (kind === "goal" && careerRef.current) {
      const squad = careerRef.current.squad ?? [];
      const pFirst = careerRef.current.player.firstName;
      const pLast = careerRef.current.player.lastName;
      const playerName = `${pFirst} ${pLast}`;
      const rng = rngRef.current;

      if (d.assists === 1 && sc.receiver) {
        // Teammate scored (chain scenario) — replace role label with a real player name
        const scorer = pickSquadScorer(squad.filter(p => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position)).length > 0
          ? squad.filter(p => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position))
          : squad, rng);
        if (scorer) {
          commentaryRoleLabel = scorer.shortName;
          goalEventsRef.current.push({ minute: matchMinuteRef.current, scorer: scorer.name, assist: playerName, isUserGoal: false });
        }
      } else if (d.goals === 1) {
        // User scored directly — optionally pick a squad assister
        const assister = squad.length > 0 ? pickSquadAssist(squad, "", rng) : null;
        goalEventsRef.current.push({ minute: matchMinuteRef.current, scorer: playerName, assist: assister?.name, isUserGoal: true });
        if (assister) pushLine(`Assist: ${assister.shortName}`);
      }
    }

    pushLine(commentaryResult(res, rngRef.current, { chain: isChain, receiverReached, roleLabel: commentaryRoleLabel, isPass: isSimplePass }));

    // A pass that found its man can keep the move going. This used to apply to
    // build-up only, and jumped to a random attacking situation; now any
    // completed pass can come back, and what you get next is read off where the
    // ball actually arrived.
    if (res === "delivered") {
      const depth = sc.chainDepth ?? 0;
      const at = sc.receivedAt ?? sc.runner?.pos ?? sc.passTarget;
      if (at && depth < CHAIN_MAX && rngRef.current() < chainReturnChance(sc)) {
        chainRef.current = { pos: { x: at.x, y: at.y }, depth: depth + 1 };
        pushLine(at.y < 25 ? "It comes straight back to you, higher up…" : "He lays it off — the move keeps going…");
      }
    }

    attemptsRef.current += 1;

    // The move continues: no simulation, straight into the next link.
    if (chainRef.current) {
      window.setTimeout(() => loadScenario(true), 1600);
      return;
    }

    // In career/match mode, enter simulation phase. In sandbox, go directly.
    if (matchModeRef.current) {
      window.setTimeout(() => startSimulation(), 1800);
    } else {
      // Sandbox mode: after 6 chances, show post-match
      if (attemptsRef.current >= 6) {
        const careerForStats = careerRef.current ?? FALLBACK_CAREER;
        const t = tallyRef.current;
        const stats = finaliseMatch(
          attemptsRef.current, t.goals, t.assists, t.passesCompleted,
          90, userScoreRef.current, oppScoreRef.current, careerForStats,
          goalEventsRef.current,
        );
        window.setTimeout(() => { setFinalStats(stats); setPhase("postmatch"); }, 1800);
      } else {
        window.setTimeout(() => loadScenario(false), 1800);
      }
    }
  };

  // Run the match on around you until it needs you again.
  //
  // This used to be a countdown: an interval computed from your skill decided
  // when the next chance arrived, and the opponent scored on an independent
  // coin flip. Nothing linked one moment to the next, so a chance never felt
  // earned. The clock is now driven by the simulation — you are pulled in when
  // your side works the ball into a dangerous area, and the situation you get
  // is whatever that area justifies.
  const startSimulation = () => {
    seedRef.current += 1;
    const rng = mulberry32(seedRef.current);
    rngRef.current = rng;

    // The refs are the authority on the scoreline (the HUD reads them, and your
    // own goals are credited in resolveOutcome), so the match is synced to them
    // before it runs rather than keeping a second, divergent count.
    const st = matchStateRef.current;
    st.userScore = userScoreRef.current;
    st.oppScore = oppScoreRef.current;

    const step = advanceUntilInvolved(st, hiddenInputs(), rng, MATCH_DURATION);

    const events: SimEvent[] = step.events.map((e) => ({
      minute: e.minute,
      // The opponent is named here rather than in the simulation, which has no
      // business knowing who you are playing.
      text: e.isGoal && !e.teammateGoal ? `⚽ ${fixtureOpponentRef.current} score!` : e.text,
      isGoal: e.isGoal,
    }));

    // A teammate's goal gets a real name off the squad sheet, the same as one
    // you set up yourself, so the scoresheet reads like a team's.
    const squad = careerRef.current?.squad ?? [];
    for (const e of step.events) {
      if (!e.isGoal || !e.teammateGoal) continue;
      const attackers = squad.filter(p => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
      const scorer = pickSquadScorer(attackers.length > 0 ? attackers : squad, rng);
      if (!scorer) continue;
      const assister = pickSquadAssist(squad, scorer.id, rng);
      goalEventsRef.current.push({ minute: e.minute, scorer: scorer.name, assist: assister?.name, isUserGoal: false });
      const ev = events.find(x => x.minute === e.minute && x.isGoal);
      if (ev) ev.text = `⚽ ${scorer.shortName} scores!`;
    }

    if (st.oppScore > oppScoreRef.current) playCrowdSwell("groan");
    else if (st.userScore > userScoreRef.current) playCrowdSwell("cheer");
    userScoreRef.current = st.userScore;
    oppScoreRef.current = st.oppScore;
    setScore({ user: userScoreRef.current, opp: oppScoreRef.current });

    // Nothing at all happened in the skipped minutes — say so rather than
    // showing an empty panel.
    if (events.length === 0) {
      events.push({ minute: st.minute, text: SIM_COMMENTARY[Math.floor(rng() * SIM_COMMENTARY.length)] });
    }

    // The minutes you were not playing still cost you.
    setEnergy(energyRef.current - (st.minute - matchMinuteRef.current) * drainPerMinute);

    pendingRequestRef.current = step.request;
    matchMinuteRef.current = st.minute;
    setMatchMinute(st.minute);
    setSimEvents(events);
    setSimVisible(true);
    setPhase("sim");

    // Show simulation for a few seconds, then transition
    const simDuration = Math.min(events.length * 800 + 1200, 5000);
    window.setTimeout(() => {
      setSimVisible(false);
      if (step.fullTime) {
        // Full time
        const careerForStats = careerRef.current ?? FALLBACK_CAREER;
        const t = tallyRef.current;
        const stats = finaliseMatch(
          attemptsRef.current, t.goals, t.assists, t.passesCompleted,
          90, userScoreRef.current, oppScoreRef.current, careerForStats,
          goalEventsRef.current,
        );
        if (matchModeRef.current && onCompleteRef.current) {
          onCompleteRef.current(stats);
        } else {
          setFinalStats(stats);
          setPhase("postmatch");
        }
      } else {
        loadScenario(false);
      }
    }, simDuration);
  };

  // Load a new scenario onto the canvas and enter aim phase.
  const loadScenario = (attacking: boolean) => {
    seedRef.current += 1;
    rngRef.current = mulberry32(seedRef.current);
    const rng = rngRef.current;

    // What the match has just handed you, if anything. Its zone narrows the
    // scenario to what makes football sense from there; your position still
    // decides which of those you are likeliest to be the one taking.
    const request = attacking ? null : pendingRequestRef.current;
    pendingRequestRef.current = null;

    const chain = chainRef.current;
    chainRef.current = null;

    if (chain) {
      // Built from where the pass actually arrived, so playing it into the
      // corner gives you a cutback and finding someone central gives you a shot.
      const kind = chainKindFor(chain.pos, rng);
      scenarioRef.current = buildScenario(kind, rng, strengthRef.current, teamRef.current);
      scenarioRef.current.chainDepth = chain.depth;
    } else if (attacking) {
      scenarioRef.current = buildAttackingScenario(rng, strengthRef.current, teamRef.current);
    } else if (request) {
      const kind = pickScenarioKindFrom(positionRef.current, rng, request.kinds);
      scenarioRef.current = buildScenario(kind, rng, strengthRef.current, teamRef.current);
    } else {
      scenarioRef.current = buildWeightedScenario(rng, positionRef.current, strengthRef.current, teamRef.current);
    }

    // Give the defence its shape: who presses, who covers a lane, who holds.
    initDefenders(scenarioRef.current, rng);

    // You are RECEIVING this one, not starting with it at your feet, so the
    // defence gets the time your first touch cost them. A heavy touch and they
    // are on you before you look up; a good one and you have a moment.
    let heavyTouch = 0;
    if (chain) heavyTouch = applyFirstTouch(scenarioRef.current, tiredSkills().technique, rng);

    viewportRef.current = { ...scenarioRef.current.viewport };
    baseViewportRef.current = { ...scenarioRef.current.viewport };
    ballRef.current = null;
    setAim(null);
    setOutcome(null);
    dragRef.current = null;
    draggingRef.current = false;
    trailRef.current = [];
    particlesRef.current = [];
    shakeRef.current.t = 0;
    flashRef.current.t = 0;
    setPhase("aim");
    // Say where the chance came from before describing it, so it reads as the
    // end of a move rather than as a situation that appeared from nowhere.
    if (request) pushLine(request.reason);
    if (heavyTouch > 0.55) pushLine("Heavy touch — they are on you.");
    pushLine(commentaryBuildup(scenarioRef.current.kind, rngRef.current));
    playWhistle();
  };

  const restartSession = () => {
    attemptsRef.current = 0;
    tallyRef.current = { shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 };
    userScoreRef.current = 0;
    oppScoreRef.current = 0;
    goalEventsRef.current = [];
    matchMinuteRef.current = 0;
    setMatchMinute(0);
    setEnergy(career?.energy ?? 85);
    matchStateRef.current = newMatch(mulberry32(seedRef.current));
    pendingRequestRef.current = null;
    chainRef.current = null;
    setScore({ user: 0, opp: 0 });
    setStats({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 });
    setFinalStats(null);
    setFeed([]);
    setSimEvents([]);
    setSimVisible(false);
    loadScenario(false);
  };

  // --- Pointer (slingshot) ---
  const onPointerDown = (e: React.PointerEvent) => {
    primeMatchSound();
    if (phaseRef.current !== "aim") return;
    const p = pitchFromPointer(e.clientX, e.clientY);
    const b = scenarioRef.current.ball;
    // Grab radius scales with the camera so the ball is equally easy to pick up
    // whether the chance is framed tight or wide.
    const vp = viewportRef.current;
    if (Math.hypot(p.x - b.x, p.y - b.y) > (vp.y2 - vp.y1) * 0.28) return;
    draggingRef.current = true;
    dragRef.current = p;
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    dragRef.current = pitchFromPointer(e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const b = scenarioRef.current.ball;
    const power = powerFromDrag(d, b);
    if (power < 0.12) return; // too weak — stay in aim
    const dir = { x: b.x - d.x, y: b.y - d.y };
    setAim({ dir, power });
    setPhase("contact");
  };

  // --- Contact chosen -> launch ---
  const handleContact = (contact: { cx: number; cy: number }) => {
    if (!aim) return;
    ballRef.current = launch(scenarioRef.current, aim.dir, aim.power, contact, tiredSkills(), rngRef.current);
    setEnergy(energyRef.current - DRAIN_PER_CHANCE);
    setPhase("flight");
    pushLine(commentaryStrike(scenarioRef.current.kind, rngRef.current));
    playKick();
    kickPoseRef.current = KICK_POSE_S;
  };

  const scenarioLabel = SCENARIO_LABEL[scenarioRef.current.kind];

  // Match-mode scoreboard (user's club vs opponent, mapped to home/away)
  const homeTeam = matchMode ? (fixture!.home ? career?.player.club ?? "You" : fixture!.opponent) : "";
  const awayTeam = matchMode ? (fixture!.home ? fixture!.opponent : career?.player.club ?? "You") : "";
  const homeScore = matchMode ? (fixture!.home ? score.user : score.opp) : 0;
  const awayScore = matchMode ? (fixture!.home ? score.opp : score.user) : 0;

  const statCell = (label: string, value: string, valueClass: string) => (
    <div className="px-1.5 py-1 text-center">
      <div className="text-[8px] uppercase tracking-widest text-gray-500 font-bold leading-none">{label}</div>
      <div className={`text-xs font-black tabular-nums leading-tight ${valueClass}`}>{value}</div>
    </div>
  );

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Local keyframes; disabled wholesale under prefers-reduced-motion */}
      <style>{`
        @keyframes kibPop { 0% { transform: scale(0.55); opacity: 0; } 60% { transform: scale(1.07); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes kibLive { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .kib-pop { animation: kibPop 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.35) both; }
        .kib-live { animation: kibLive 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .kib-pop, .kib-live { animation: none; }
        }
      `}</style>

      {/* Live match scoreboard (career mode only) */}
      {matchMode && (
        <div className="mb-2 flex items-center justify-between gap-1">
          <div className="flex-1 bg-red-600 border border-red-500 rounded-l-lg px-2 py-1.5 text-white font-black text-xs truncate">
            {homeTeam.toUpperCase()}
          </div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow tabular-nums">{homeScore}</div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow tabular-nums">{awayScore}</div>
          <div className="flex-1 bg-amber-500 border border-amber-400 rounded-r-lg px-2 py-1.5 text-white font-black text-xs truncate text-right">
            {awayTeam.toUpperCase()}
          </div>
        </div>
      )}

      {/* Scoreboard plate */}
      <div className="mb-2 rounded-lg overflow-hidden border border-emerald-800/70 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 shadow-lg">
        <div className="flex items-stretch">
          {/* PLUG-IN (optional asset): swap this monogram for /public/star/knowitball-badge.png */}
          <div className="px-2.5 flex items-center bg-gradient-to-b from-amber-400 to-amber-500 text-gray-950 text-[11px] font-black tracking-tight">
            KB
          </div>
          <div className="px-2.5 flex items-center border-r border-white/5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300/90">
            {matchMode ? `Wk ${fixture!.week}` : "Match Lab"}
          </div>
          <div className="flex-1 grid grid-cols-4 divide-x divide-white/5">
            {statCell("Shots", `${stats.shots}`, "text-white")}
            {statCell("Goals", `${stats.goals}`, "text-amber-300")}
            {statCell("Passes", `${stats.passesCompleted}/${stats.passes}`, "text-violet-300")}
            {statCell("Assists", `${stats.assists}/${stats.chances}`, "text-emerald-300")}
          </div>
          <button
            onClick={toggleMuted}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            className="px-2.5 flex items-center border-l border-white/5 text-gray-400 hover:text-amber-300 transition"
          >
            {muted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
                <path d="m17 9 6 6M23 9l-6 6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-800/80 shadow-2xl shadow-emerald-950/60"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`absolute inset-0 w-full h-full ${phase === "aim" ? "cursor-grab" : "cursor-default"}`}
        />


        {/* Contact overlay */}
        {phase === "contact" && aim && (
          <ContactBall
            power={aim.power}
            onContact={handleContact}
            onCancel={() => { setAim(null); setPhase("aim"); }}
          />
        )}

        {/* Action banner — the moment an action actually completes. "PASS" when
            a team-mate brings your ball under control, "GOAL" when it goes in.
            Sits high so it never covers the strike itself. */}
        {actionBanner && (
          <div className="absolute inset-x-0 top-[18%] flex items-center justify-center pointer-events-none z-20">
            <div
              className={`kib-pop text-5xl font-black italic tracking-wider drop-shadow-[0_3px_10px_rgba(0,0,0,0.95)] ${
                actionBanner === "GOAL" ? "text-emerald-300" : "text-cyan-200"
              }`}
            >
              {actionBanner}
            </div>
          </div>
        )}

        {/* Outcome. Deliberately NOT announced for anything the pitch already
            shows you — the ball in the net, off the post, wide, in the keeper's
            hands. The only banner is the referee's call, which has no visual. */}
        {phase === "result" && outcome === "offside" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="kib-pop text-4xl font-black tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] px-6 py-3 rounded-xl text-yellow-200 bg-gray-950/70 ring-1 ring-yellow-400/50">
              OFFSIDE
            </div>
          </div>
        )}

        {/* Simulation overlay — match clock ticking between player chances */}
        {phase === "sim" && simVisible && (
          <div className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center pointer-events-none z-10">
            {/* Match clock */}
            <div className="text-5xl font-black text-white tabular-nums mb-1">{matchMinute}&#39;</div>
            {/* Scoreline */}
            {matchMode && (
              <div className="text-sm font-bold text-gray-300 mb-4">
                <span className="truncate">{homeTeam}</span> <span className="text-white text-lg tabular-nums mx-1">{homeScore}</span>
                <span className="text-gray-500 mx-1">-</span>
                <span className="text-white text-lg tabular-nums mx-1">{awayScore}</span> <span className="truncate">{awayTeam}</span>
              </div>
            )}
            {/* Scrolling events */}
            <div className="w-full max-w-[85%] space-y-1.5 overflow-hidden max-h-[55%]">
              {simEvents.map((ev, i) => (
                <div
                  key={i}
                  className={`text-xs leading-snug px-3 py-1 rounded ${
                    ev.isGoal
                      ? "text-amber-300 font-black bg-amber-900/30 border border-amber-500/40"
                      : "text-gray-400 bg-gray-800/40"
                  }`}
                  style={{ animationDelay: `${i * 0.4}s` }}
                >
                  <span className="text-gray-500 tabular-nums mr-1.5 font-bold">{ev.minute}&#39;</span>
                  {ev.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Live commentary ticker */}
      <div className="mt-2 rounded-lg border border-gray-800 bg-gray-950/85 px-3 py-2 min-h-[3.8rem]">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="kib-live inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="text-[8px] font-black tracking-[0.22em] text-gray-500 uppercase">Live Commentary</span>
        </div>
        <div className="space-y-0.5">
          {feed.length === 0 && <div className="text-[11px] text-gray-600 italic">Kick-off…</div>}
          {feed.map((line, i) => (
            <div
              key={i}
              className={`text-[11px] leading-snug pl-2 border-l-2 ${
                i === feed.length - 1 ? "text-white font-bold border-emerald-500/80" : "text-gray-600 border-transparent"
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div className="mt-2 bg-gray-900/70 border border-gray-800 rounded-lg px-3 py-2 text-[10px] text-gray-400 text-center">
        {matchMode && (
          <span className="text-emerald-300 font-black mr-1">
            {matchMinute}&#39; ·
          </span>
        )}
        <span className="text-amber-300">💡</span> {scenarioLabel.hint}
      </div>

      {/* Session complete — reuse the real post-match screen for the summary */}
      {phase === "postmatch" && finalStats && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <PostMatch
            stats={finalStats}
            homeTeam={careerRef.current?.player.club ?? "You"}
            awayTeam="Training Session"
            onContinue={restartSession}
          />
        </div>
      )}
    </div>
  );
}
