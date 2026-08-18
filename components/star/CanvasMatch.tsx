"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  buildWeightedScenario, buildAttackingScenario, buildScenario, pickScenarioKindFrom,
  launch, stepBall, stepBallInNet, settleBall,
  stepKeeper, stepDefenders, stepReactions, initDefenders,
  chainKindFor, chainReturnChance, CHAIN_MAX, applyFirstTouch, goalInView,
  OUTCOME_TEXT, clamp, dragForFullPower, VIEW_ASPECT,
  orderableRunners, acceptsCaptainOrders,
  type Scenario, type Ball, type Outcome, type KickSkills, type ScenarioKind, type Viewport,
  type Facing, type Runner,
} from "@/lib/star/canvasEngine";
import {
  newMatch, advanceUntilInvolved, advanceTo, resolveScenario,
  type HiddenMatchState, type HiddenMatchInputs, type ScenarioRequest, type ScenarioResult, type HiddenMatchEvent,
} from "@/lib/star/hiddenMatch";
import { setPieceSkills, type SetPieceDuties } from "@/lib/star/setPieces";
import { conditionsFor, conditionsLine, type Conditions } from "@/lib/star/weather";
import {
  newDribble, stepDribble, flick, dribbleProgress, dribbleViewport, type DribbleState,
} from "@/lib/star/dribble";
import {
  PITCH_W, HALF_LEN, CX, POST_L, POST_R, NET_DEPTH, GOAL_H,
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
import { finaliseMatch, liveRating } from "@/lib/star/matchStats";
import { hookCheck, type HookReason } from "@/lib/star/selection";
import { pickSquadScorer, pickSquadAssist } from "@/lib/star/squadData";
import { castScenario, creatorOf } from "@/lib/star/lineup";
import { startingTeammateIds, onPitchToday } from "@/lib/star/teamsheet";
import { creditChance, type CreditDelta } from "@/lib/star/credit";
import { kitsFor, labelInk, type MatchKits } from "@/lib/star/kits";
import type { CareerState, MatchStats, Fixture, GoalEvent, SquadPlayer } from "@/lib/star/types";
import ContactBall from "./ContactBall";
import PostMatch from "./PostMatch";
import MatchCommentary from "./MatchCommentary";
import {
  line as logLine, linesFrom, halfTimeSplit, dwellFor, HALF_TIME_MINUTE,
  type LogLine,
} from "@/lib/star/matchLog";

/**
 * `feed` is the commentary screen, and it is where a match LIVES — see
 * lib/star/matchLog. The pitch phases are what it cuts away to. It used to be
 * called `sim` and was a panel that appeared over the pitch to report minutes
 * you had already skipped past.
 */
type Phase = "aim" | "contact" | "flight" | "result" | "feed" | "postmatch" | "dribble";

// Match runs from minute 0 to 90. Chances are distributed organically — no
// fixed session length. The number of chances depends on player/team quality.
const MATCH_DURATION = 90;

interface Props {
  skills?: KickSkills;
  /**
   * The minute you come on. 0 when you start. Anything else means the match has
   * already been going on without you, and the score you inherit is one your
   * team-mates earned.
   */
  startMinute?: number;
  /** Which dead balls are yours to take. Ones that are not go to someone else. */
  duties?: SetPieceDuties;
  /** The surface and the air. Absent is a perfect pitch in still air. */
  conditions?: Conditions;
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

/**
 * The shortest drag that counts as aiming at all, as a fraction of the canvas
 * height. About a thumb's width of slop — below it, you pressed the ball and
 * your finger moved, which is not a shot.
 */
const MIN_PULL = 0.04;

/**
 * The shortest pull off a team-mate that counts as pointing him somewhere,
 * in METRES on the pitch rather than as a fraction of the screen.
 *
 * Metres because this gesture means a distance on the grass — three metres is
 * a step, and sending a man three metres is not a run. Below it the touch is
 * read as a tap, which is the other order entirely.
 */
const CAPTAIN_DRAG_MIN = 3.0;

// --- Knowitball match identity: "night match under floodlights" ---
// Deep cool pitch greens + floodlight wash, near-black glass chrome, gold accent.
const C = {
  // Sampled off the reference: rgb(31,144,6). See the pitch block in render().
  pitch: "#1f9006",
  // Sampled off the reference too: its markings come back at rgb(224,255,217)
  // at their brightest — near enough solid white, with a green cast that is the
  // grass bleeding through the compression. Ours were at 0.55 alpha, which lands
  // at rgb(154,204,137): a pale grey-green, and the reason the pitch read as a
  // diagram rather than as a painted field.
  line: "rgba(255,255,250,0.85)",
  lineFaint: "rgba(255,255,250,0.5)",
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
  cutback: { verb: "CUTBACK!", hint: "Square it back — find the man arriving." },
  byline_cross: { verb: "CROSS IT!", hint: "Whip it in — pick out a man in the middle." },
  through_ball: { verb: "THROUGH BALL!", hint: "Split the line — find the man on the last shoulder." },
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
// The frame never moves — see "There is no camera" in the loop below.

/**
 * A tile of grass grain.
 *
 * Deliberately almost invisible: the reference's grass spans about eight
 * luminance levels from p5 to p95, so this is ±4 either side of nothing. It is
 * there to stop the pitch reading as flat paint, not to be seen.
 */
const GRASS_TILE = 96;

function makeGrassTile(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = GRASS_TILE; c.height = GRASS_TILE;
  const g = c.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(GRASS_TILE, GRASS_TILE);
  // A fixed pattern rather than Math.random, so the grain is the same every
  // session and never shimmers between one frame and the next.
  let seed = 0x2f6f2b;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = ((seed >>> 16) & 0xff) / 255;          // 0..1
    const light = n > 0.5;
    img.data[i] = light ? 255 : 0;
    img.data[i + 1] = light ? 255 : 0;
    img.data[i + 2] = light ? 255 : 0;
    img.data[i + 3] = Math.round(Math.abs(n - 0.5) * 2 * 16);   // ≤ 16/255
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** How long "PASS" / "GOAL" stays on screen after the action. */
const ACTION_BANNER_MS = 1000;
/** Seconds the kicking pose is held so the swing is actually visible. */
const KICK_POSE_S = 0.28;

export default function CanvasMatch({ skills = { power: 55, technique: 55 }, keeperStrength = 62, position = "ST", teamRelationship = 60, career = null, seed = 12345, fixture, oppStrength, onComplete, startMinute = 0, duties, conditions }: Props) {

  // ── Who else is actually out there ──
  //
  // A goal your side scores while you are not on the ball has always needed a
  // name — see the note above `goalEventsRef.current.push` for the version of
  // this bug that meant nobody had one. The version that replaced it was worse
  // in a quieter way: the name it gave was drawn from the WHOLE squad, so a
  // sub who was an unused substitute — or never made the eighteen at all —
  // could be credited with a goal in a match he did not play in. See
  // lib/star/teamsheet.ts — this is the same eleven the pre-match team sheet
  // showed, and every place that puts a name to a team-mate's goal reads from
  // it instead of from the full squad list.
  const startingXI = career && fixture ? startingTeammateIds(career, fixture) : null;
  const onPitch = (squad: SquadPlayer[]): SquadPlayer[] => onPitchToday(squad, startingXI);

  /**
   * Put a name to every goal in a run of hidden-match events, and record it.
   *
   * The one function both the normal in-match flow and the "coming on as a
   * substitute" replay use, which is the point of it existing: the replay used
   * to show the hour before you arrived as TEXT only, with no call to
   * `goalEventsRef.current.push` anywhere in that branch — so a goal scored
   * before you came on counted on the scoreboard and nowhere else. It was
   * missing from the scorer's season tally and missing from the scoreline
   * graphic the game posts about the result, both of which read `goalEvents`,
   * not the score.
   *
   * The other half of the same guarantee: `pickSquadScorer` returning null used
   * to mean the goal was reported as text and then simply not recorded — one
   * fewer name than the scoreline had goals, which is the "5-0 with four
   * scorers" report. It cannot return null against a starting XI (ten
   * outfielders, always), but a career saved before squads existed, or a
   * fixture with no restriction to compute, still can — so the fallback now
   * credits an unnamed team-mate rather than dropping the goal from the count.
   * An unnamed scorer in the graphic is honest; a goal with no line in it at
   * all reads as a mistake in the goal difference.
   */
  const nameTeamGoals = (
    raw: { minute: number; text: string; isGoal?: boolean; teammateGoal?: boolean }[],
    squad: SquadPlayer[],
    rng: () => number,
    announce: boolean,
  ): SimEvent[] => {
    const attackers = squad.filter(p => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
    return raw.flatMap((e): SimEvent[] => {
      if (!e.isGoal) return [{ minute: e.minute, text: e.text }];

      if (!e.teammateGoal) {
        return [{ minute: e.minute, text: `⚽ ${fixtureOpponentRef.current} score!`, isGoal: true, isOpponent: true }];
      }

      const scorer = pickSquadScorer(attackers.length > 0 ? attackers : squad, rng)
        // No name reachable at all — still a goal, still recorded, under an
        // identity that names what it is rather than inventing who.
        ?? { id: "unnamed", name: "Team-mate", shortName: "Team-mate" } as SquadPlayer;
      const assister = scorer.id !== "unnamed" ? pickSquadAssist(squad, scorer.id, rng) : null;
      goalEventsRef.current.push({
        minute: e.minute, scorer: scorer.name, assist: assister?.name, isUserGoal: false,
      });

      const goalLine = `⚽ ${scorer.shortName} scores!`;
      if (announce) pushLine(`${e.minute}' ${goalLine}${assister ? ` (${assister.shortName})` : ""}`);
      // The assist is its own line, not a parenthetical on the goal's — "A:
      // Cucurella" reads as a fact about the goal rather than as trivia tucked
      // onto the end of the sentence.
      return assister
        ? [
            { minute: e.minute, text: goalLine, isGoal: true },
            { minute: e.minute, text: `A: ${assister.shortName}`, tone: "assist" },
          ]
        : [{ minute: e.minute, text: goalLine, isGoal: true }];
    });
  };
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
  const fixtureHomeRef = useRef(fixture?.home !== false);
  fixtureHomeRef.current = fixture?.home !== false;

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
  // `ambition` is how brave the ball that got you here was — see passAmbition.
  // The next situation is read off it as well as off where the ball arrived.
  const chainRef = useRef<{ pos: { x: number; y: number }; depth: number; ambition: number } | null>(null);

  interface SimEvent {
    minute: number; text: string; isGoal?: boolean; isOpponent?: boolean;
    /** Overrides the isGoal-derived tone — an assist line is not itself a goal. */
    tone?: LogLine["tone"];
  }

  // ── The running commentary ──
  //
  // `log` is everything that has happened, kept for the whole match. `queue` is
  // what has happened but has not been read out yet — the streaming screen
  // moves one line at a time from the second into the first. Splitting them is
  // what makes the match play out rather than arrive: the simulation still
  // computes a whole passage at once, but you watch it.
  const [log, setLog] = useState<LogLine[]>([]);
  const [queue, setQueue] = useState<LogLine[]>([]);
  const [speed, setSpeed] = useState(1);
  const [pause, setPause] = useState<{ label: string; cta: string; onContinue: () => void } | null>(null);
  const halfTimeShownRef = useRef(false);
  /** What to do once the queue has emptied. */
  const simContinueRef = useRef<(() => void) | null>(null);

  // The match going on around you. It owns possession, territory and momentum;
  // your chances are what it hands you, and their kind is decided by where the
  // ball actually was when it found you.
  const matchStateRef = useRef<HiddenMatchState>(newMatch(mulberry32(seed)));
  const startMinuteRef = useRef(startMinute);
  startMinuteRef.current = startMinute;
  /** Set once the manager has taken you off, so nothing after it can play. */
  const hookedRef = useRef<HookReason | null>(null);
  /** The minute you came off. The rest of the match is played without you, so
   *  the clock runs on to ninety and this is what you were actually on for. */
  const hookedAtRef = useRef<number | null>(null);
  const dutiesRef = useRef(duties);
  dutiesRef.current = duties;
  // Fixed for the whole match: every scenario is played in the same conditions,
  // because the weather does not change between one chance and the next.
  const conditionsRef = useRef<Conditions>(conditions ?? conditionsFor(0, 0));
  conditionsRef.current = conditions ?? conditionsRef.current;

  // ── The run ──
  // A scenario where you carry it rather than strike it. Lives outside the
  // Scenario machinery entirely: no ball flight, no keeper, no builders.
  const dribbleRef = useRef<DribbleState | null>(null);
  const flickStartRef = useRef<{ x: number; y: number } | null>(null);

  /** Is this dead ball yours? With no duties supplied (the sandbox), everything is. */
  const mayTake = (kind: ScenarioKind) => {
    const d = dutiesRef.current;
    if (!d) return true;
    if (kind === "free_kick") return d.freeKicks;
    if (kind === "penalty") return d.penalties;
    return true;
  };
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
      home: fixture?.home,
      pace: careerRef.current?.skills.pace,
    };
  };

  // Translate what the physics produced into what the match needs to know.
  // Only a completed pass keeps the ball; everything else ends the move.
  const matchResultFor = (res: Outcome): ScenarioResult => {
    if (OUTCOME_TEXT[res].kind === "goal") return "goal";
    if (res === "delivered") return "delivered";
    if (res === "tackled" || res === "blocked") return "lost";
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

  /**
   * What the two sides are wearing.
   *
   * Resolved once per match from who is at home — see lib/star/kits. Everybody
   * used to be in the same two colours whoever was playing: you green, your
   * team-mates blue, the opposition red, at Manchester City, for fifteen
   * seasons. The sandbox has no fixture and no clubs, so it keeps a neutral
   * pair rather than pretending to be a game between two teams.
   */
  const kitsRef = useRef<MatchKits>(
    fixture && career
      ? (fixture.home
        ? kitsFor(career.player.club, fixture.opponent)
        : kitsFor(fixture.opponent, career.player.club))
      : { home: { shirt: C.mate, trim: C.mateRim }, away: { shirt: C.opp, trim: C.oppRim },
          keeper: { shirt: C.gk, trim: C.gkRim } },
  );
  /** Yours and theirs, whichever end of the fixture you are. */
  const ourKit = () => (fixtureHomeRef.current ? kitsRef.current.home : kitsRef.current.away);
  const theirKit = () => (fixtureHomeRef.current ? kitsRef.current.away : kitsRef.current.home);

  const scenarioRef = useRef<Scenario>(buildWeightedScenario(mulberry32(seed), position, keeperStrength, teamRelationship, career?.skills.vision ?? 55));
  const ballRef = useRef<Ball | null>(null);
  const rngRef = useRef<() => number>(mulberry32(seed));
  const seedRef = useRef(seed);

  const phaseRef = useRef<Phase>("aim");
  const [phase, setPhaseState] = useState<Phase>("aim");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const [aim, setAim] = useState<{ dir: { x: number; y: number }; power: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);

  // ── THE ARMBAND ────────────────────────────────────────────────────────────
  //
  // Two things a captain can do that nobody else on the pitch can, both of them
  // decided before the ball is struck and neither of them costing you the
  // unlimited time to decide that every situation gives you.
  //
  //   TAP a team-mate   — the man you want it laid off to. Whoever receives your
  //                       pass plays it to him instead of shooting, and HE
  //                       shoots. Tap again to take the order back.
  //   DRAG from one     — where you want him to run. He goes when you play it.
  //
  // Both live on the scenario itself (`relayTo`, `Runner.commandedTo`), because
  // the engine is what has to read them. These refs are the gesture in progress
  // and a version counter to get the overlay redrawn.
  const isCaptain = !!career?.captain;
  const isCaptainRef = useRef(isCaptain);
  isCaptainRef.current = isCaptain;
  const captainDragRef = useRef<{ runner: Runner; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  /** Bumped whenever an order changes, purely so the React overlay re-renders. */
  const [orderTick, setOrderTick] = useState(0);
  const bumpOrders = () => setOrderTick(t => t + 1);

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [stats, setStats] = useState({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 });
  const [feed, setFeed] = useState<string[]>([]);
  /**
   * The four-line ticker under the canvas, and ONLY the ticker.
   *
   * Every beat of a scenario building up gets one of these — the cross being
   * swung in, the knock-down, the shot going in off the woodwork — and that is
   * right for a strip that lives beside the pitch and only has to say what is
   * happening right now. It is wrong for the permanent record: piping every one
   * of these into the match log put a whole buildup's worth of flavour text
   * into the highlighted list meant for the moments that actually matter, and
   * a five-line scramble in the six-yard box read as five separate highlights.
   * See `logMoment` for what is actually worth keeping.
   */
  const pushLine = useCallback((line: string) => {
    setFeed((f) => [...f, line].slice(-4));
  }, []);

  /**
   * The permanent record — a chance opening up, a goal, who made it.
   *
   * Three things only. Not "everything said while the ball was near your
   * player": one line when a chance becomes yours to play, one when it ends in
   * a goal, one more when that goal had a name behind it.
   */
  const logMoment = useCallback((text: string, tone: LogLine["tone"], minute?: number) => {
    // An assist follows straight under its goal, which has already printed the
    // minute — repeating it a line down says the same minute twice for what
    // reads as one moment. See the matching rule in linesFrom.
    const shown = tone === "assist" ? undefined : (minute ?? matchMinuteRef.current);
    setLog(l => [...l, logLine(text, tone, shown)]);
  }, []);

  /** Your own name, the way the commentary says everybody else's — a surname,
   *  never the second person. The sandbox has no career and so no name; "you"
   *  is right there, since there is nobody else it could mean. */
  const playerLabel = () => careerRef.current?.player.lastName || "you";

  /**
   * Read out the next line, and stop when the queue is empty.
   *
   * A timer rather than a Continue button, because a match is a thing that
   * happens to you at its own pace. The pace is `dwellFor`, which holds a goal
   * longer than a throw-in, divided by whatever speed you have chosen — and
   * `pause` freezes it entirely at the interval and at full time, which are the
   * only two moments the game genuinely needs an answer from you.
   */
  useEffect(() => {
    if (pause || queue.length === 0) return;
    const next = queue[0];
    const t = setTimeout(() => {
      setLog(l => [...l, next]);
      setQueue(q => q.slice(1));
      if (next.minute !== undefined) {
        matchMinuteRef.current = next.minute;
        setMatchMinute(next.minute);
      }
      // Half time is inserted by the streamer rather than by the simulation,
      // which runs 1 to 90 and has never had an interval. See matchLog.
      if (!halfTimeShownRef.current && next.minute !== undefined && next.minute > HALF_TIME_MINUTE) {
        halfTimeShownRef.current = true;
        setLog(l => [...l, logLine(
          `Half Time  ${userScoreRef.current} - ${oppScoreRef.current}`, "period", HALF_TIME_MINUTE)]);
        setPause({
          label: "The half is over",
          cta: "Second half →",
          onContinue: () => setPause(null),
        });
      }
    }, dwellFor(next.tone, speed));
    return () => clearTimeout(t);
  }, [queue, pause, speed]);

  /** The queue has run dry: go wherever the passage was heading. */
  useEffect(() => {
    if (pause || queue.length > 0 || phase !== "feed") return;
    const go = simContinueRef.current;
    if (!go) return;
    simContinueRef.current = null;
    // A beat on the last line before the pitch takes the screen, so a chance
    // does not arrive on top of the sentence that set it up.
    const t = setTimeout(go, Math.round(700 / Math.max(1, speed)));
    return () => clearTimeout(t);
  }, [queue, pause, phase, speed]);

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
    scenarioRef.current.conditions = conditionsRef.current;
    initDefenders(scenarioRef.current, rngRef.current);
    facingRef.current = scenarioRef.current.facing ?? "up";
    viewportRef.current = { ...scenarioRef.current.viewport };
    baseViewportRef.current = { ...scenarioRef.current.viewport };
    // In a real match, kick-off belongs to the match, not to you: it plays until
    // the ball finds you rather than dropping you into a chance in the first
    // minute. The sandbox still opens on a scenario, which is its whole point.
    if (matchModeRef.current) {
      // Coming on as a substitute: the match has already been played without
      // you, so play it — team-mate chances, opponent goals and all — and take
      // the scoreline you inherit rather than starting a fresh 0-0 at the hour.
      if (startMinuteRef.current > 0) {
        seedRef.current += 1;
        const rng = mulberry32(seedRef.current);
        rngRef.current = rng;
        const st = matchStateRef.current;
        const before = advanceTo(st, hiddenInputs(), rng, startMinuteRef.current);
        userScoreRef.current = st.userScore;
        oppScoreRef.current = st.oppScore;
        setScore({ user: st.userScore, opp: st.oppScore });
        matchMinuteRef.current = st.minute;
        setMatchMinute(st.minute);
        // The hour you were not on for, read out rather than summarised — the
        // whole point of the commentary screen is that the match you are
        // walking into is one you watched.
        halfTimeShownRef.current = st.minute > HALF_TIME_MINUTE;
        // `announce: false` — nothing here goes into the four-line ticker,
        // which does not exist yet at this point in the match; it all goes
        // straight into the permanent log below instead.
        const named = nameTeamGoals(before, onPitch(careerRef.current?.squad ?? []), rng, false);
        setLog([
          logLine("Kick Off", "period", 0),
          ...linesFrom(named.slice(-14)),
          logLine("You are coming on.", "you", st.minute),
        ]);
        setPhase("feed");
        setPause({
          label: "You are going on",
          cta: "Get out there →",
          onContinue: () => { setPause(null); startSimulation(); },
        });
        return;
      }
      // Starting: the match opens on the commentary, at nil-nil, with a
      // whistle — not on a pitch waiting for a chance that has not arrived.
      setLog([logLine("Kick Off", "period", 0)]);
      startSimulation();
      return;
    }
    pushLine(commentaryBuildup(scenarioRef.current.kind, rngRef.current, targetName(scenarioRef.current)));
    playWhistle(); // no-op until the first user gesture primes audio — harmless
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Coordinate helpers (pitch <-> canvas pixels, viewport-aware) ---
  //
  // FLAT. A metre is the same number of pixels everywhere on the frame, in both
  // directions: the pitch is a grid seen from directly above, lines stay
  // parallel, the centre circle is a circle, and a player at the goal is exactly
  // the size of a player at your feet.
  //
  // There used to be a shallow pinhole perspective here, and it was the single
  // biggest reason the game looked wrong. Everything at the goal end was drawn
  // at 64% scale — and in a shooting situation the goal end is where all of it
  // happens, so the goal, the keeper and every defender were a third smaller
  // than they should have been while the empty grass in front of you was full
  // size. It read as "zoomed out" no matter how tight the framing got, because
  // the tightening was being spent on the part of the frame with nothing in it.
  //
  // The game this is modelled on is flat, and looking at the two side by side
  // that is the whole difference.
  const viewportRef = useRef<Viewport>({ x1: -5, x2: 105, y1: -5, y2: 100 });
  /** The situation's framing. It is set once and never moves — see the loop. */
  const baseViewportRef = useRef<Viewport>({ x1: -5, x2: 105, y1: -5, y2: 100 });

  /**
   * Which way the frame is turned. "up" is the ordinary view; a crossing
   * situation is watched from the side until the ball reaches the box.
   */
  const facingRef = useRef<Facing>("up");
  /** The grass grain, built once on first paint. */
  const grassRef = useRef<HTMLCanvasElement | null>(null);

  const toPx = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current!;
    const vp = viewportRef.current;
    const W = canvas.width, H = canvas.height;
    const fx = (x - vp.x1) / (vp.x2 - vp.x1);      // 0..1 across the pitch
    const fy = (y - vp.y1) / (vp.y2 - vp.y1);      // 0..1 up the pitch, 0 = goal
    // A quarter turn, not a mirror: "right" is the ordinary view rotated
    // clockwise, so the goal ends up on the right and pitch x runs down the
    // screen; "left" is the same turn the other way.
    if (facingRef.current === "right") return { px: (1 - fy) * W, py: fx * H, scale: 1 };
    if (facingRef.current === "left") return { px: fy * W, py: (1 - fx) * H, scale: 1 };
    // Kept so every call site still reads the same; nothing shrinks with
    // distance any more, so it is always 1.
    return { px: fx * W, py: fy * H, scale: 1 };
  }, []);

  const pitchFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const vp = viewportRef.current;
    // NOT clamped to the canvas. You aim by dragging back from the ball, and a
    // chance near the bottom of the frame needs to be dragged back past the
    // bottom of it — clamping turned that into an arrow that stuck and a shot
    // you could not take.
    const sx = (clientX - rect.left) / rect.width;
    const sy = (clientY - rect.top) / rect.height;
    // The exact inverse of toPx, turn and all.
    const f = facingRef.current;
    const fx = f === "right" ? sy : f === "left" ? 1 - sy : sx;
    const fy = f === "right" ? 1 - sx : f === "left" ? sx : sy;
    return {
      x: fx * (vp.x2 - vp.x1) + vp.x1,
      y: fy * (vp.y2 - vp.y1) + vp.y1,
    };
  };

  // How hard the drag pulled, as a fraction of a full-power strike. Measured
  // against the VISIBLE height of the pitch rather than a fixed number of metres,
  // so a full-length drag means full power at every zoom level. Keying it to a
  // fixed metre count meant that on a tightly-framed chance the longest drag the
  // screen allowed was only a fraction of full power — which is why shots
  // sometimes travelled a fifth of the way and rolled to a stop.
  // Power now also shortens the pull: a stronger player reaches everything he
  // has with less drag, so the same flick is worth more of a shot. See
  // dragForFullPower — the attribute expands what a gesture buys rather than
  // silently multiplying the result.
  /**
   * How far the thumb travelled, as a fraction of the canvas height.
   *
   * Measured on the SCREEN, not on the pitch, and that is a fix rather than a
   * detail. A crossing situation is watched from the side, so the frame is
   * turned a quarter turn and the screen's vertical axis is pitch X — and the
   * frame is 5:8, so the same physical drag bought 1.6× fewer metres there than
   * it did anywhere else. Full power in a byline cross needed a pull 60% of the
   * screen long. The thumb does not know which way the pitch is facing; it only
   * knows how far it moved.
   */
  const screenPull = useCallback((drag: { x: number; y: number }, ball: { x: number; y: number }) => {
    const vp = viewportRef.current;
    const W = vp.x2 - vp.x1, H = vp.y2 - vp.y1;
    // The exact inverse of pitchFromPointer, turn and all.
    const f = facingRef.current;
    const toScreen = (p: { x: number; y: number }) => {
      const fx = (p.x - vp.x1) / W, fy = (p.y - vp.y1) / H;
      if (f === "right") return { sx: 1 - fy, sy: fx };
      if (f === "left") return { sx: fy, sy: 1 - fx };
      return { sx: fx, sy: fy };
    };
    const a = toScreen(drag), b = toScreen(ball);
    // sx is a fraction of the canvas WIDTH and sy of its HEIGHT, so put them in
    // the same units before measuring.
    return Math.hypot((a.sx - b.sx) * VIEW_ASPECT, a.sy - b.sy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const powerFromDrag = useCallback((drag: { x: number; y: number }, ball: { x: number; y: number }) => {
    return clamp(screenPull(drag, ball) / dragForFullPower(tiredSkills().power), 0, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The team-mate under the thumb, if the man with the armband is asking.
   *
   * Generous on purpose — a footballer is a centimetre wide on a phone and the
   * whole ability is worthless if picking him out is fiddly. Nearest man inside
   * the radius wins, so two players standing close together still resolve to
   * one of them rather than to neither.
   */
  const captainPickAt = (p: { x: number; y: number }): Runner | null => {
    if (!isCaptainRef.current) return null;
    const sc = scenarioRef.current;
    if (!acceptsCaptainOrders(sc.kind)) return null;
    const vp = viewportRef.current;
    const grab = Math.max(2.2, (vp.y2 - vp.y1) * 0.09);
    let best: Runner | null = null;
    let bestD = grab;
    for (const r of orderableRunners(sc)) {
      const d = Math.hypot(p.x - r.pos.x, p.y - r.pos.y);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  };

  // --- Render one frame ---
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const sc = scenarioRef.current;
    const vp = viewportRef.current;
    // Pixels per metre. The viewport holds the canvas aspect exactly, so these
    // two agree — a metre is a metre whichever way it points, and circles stay
    // circles. In a turned frame the pitch axes have swapped places on the
    // screen, so the spans swap with them.
    const turned = facingRef.current !== "up";
    const unit = turned ? H / (vp.x2 - vp.x1) : W / (vp.x2 - vp.x1);
    const uy = turned ? W / (vp.y2 - vp.y1) : H / (vp.y2 - vp.y1);
    // ── Height ──
    //
    // One metre up is drawn as one metre across. TRUE scale, not foreshortened:
    // the goal is drawn standing on its line at this same scale, so a ball that
    // clears the crossbar visibly clears it and one that hits the bar hits the
    // bar you can see. Foreshortening height to 0.75 broke that agreement — and
    // the agreement is the only reason drawing height at all is honest on a
    // camera that is otherwise a flat plan.
    const heightScale = uy;
    // A real ball is only 22 cm across — drawn true to scale it disappears, so it
    // is exaggerated a little and floored at a readable pixel size.
    const BALL_PX = Math.max(4.5, unit * 0.5);

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

    // --- Pitch ---
    //
    // Sampled off the reference rather than chosen: its grass is rgb(31,144,6),
    // a saturated yellow-green with almost no blue in it. Ours was rgb(20,144,70)
    // — the same green with seventy points of blue, which is why it read as
    // emerald or teal beside it.
    //
    // And it has NO MOWING STRIPES. Six patches sampled at six different heights
    // came back within two units of each other; if there were five-metre bands
    // they would differ by far more than that. Ours differed by twenty-six, and
    // that banding was the loudest thing on the screen.
    //
    // What it does have is a very fine grain: luminance p5 to p95 spans about
    // eight levels, so the noise below is deliberately almost invisible. It stops
    // the pitch reading as flat paint without ever becoming a texture you notice.
    ctx.fillStyle = C.pitch;
    ctx.fillRect(0, 0, W, H);

    // The grain, built once and tiled. Pinned to PITCH space, so it sits still
    // on the grass rather than crawling when the frame changes between chances.
    if (!grassRef.current) grassRef.current = makeGrassTile();
    if (grassRef.current) {
      const pat = ctx.createPattern(grassRef.current, "repeat");
      if (pat) {
        const o = P(0, 0);
        ctx.save();
        ctx.translate(o.px % GRASS_TILE, o.py % GRASS_TILE);
        ctx.fillStyle = pat;
        ctx.fillRect(-GRASS_TILE, -GRASS_TILE, W + GRASS_TILE * 2, H + GRASS_TILE * 2);
        ctx.restore();
      }
    }

    // Worn grass where a season's football happens: the goalmouth, the penalty
    // spot, the centre. The reference has these and they are most of what stops
    // a pitch looking printed — measured at rgb(78,134,16), which is the same
    // green with the red pushed up.
    {
      const wear = (x: number, y: number, rx: number, ry: number, alpha: number) => {
        const c = P(x, y);
        const g = ctx.createRadialGradient(c.px, c.py, 0, c.px, c.py, Math.max(rx, ry) * unit);
        g.addColorStop(0, `rgba(120,132,26,${alpha})`);
        g.addColorStop(1, "rgba(120,132,26,0)");
        ctx.save();
        ctx.translate(c.px, c.py);
        ctx.scale(1, ry / rx);
        ctx.translate(-c.px, -c.py);
        ctx.fillStyle = g;
        ctx.fillRect(c.px - rx * unit * 1.2, c.py - rx * unit * 1.2, rx * unit * 2.4, rx * unit * 2.4);
        ctx.restore();
      };
      wear(CX, 1.9, 6.2, 2.4, 0.22);      // the goalmouth
      wear(CX, PEN_SPOT_Y, 3.2, 2.2, 0.16); // the penalty spot
      wear(CX, HALF_LEN, 3.4, 2.4, 0.14);   // the centre
    }

    // There is nothing behind the goal, and nothing needs to be. A terrace was
    // drawn back there so the camera could sit further back and still frame a
    // corner — a black band of speckles that read, correctly, as nonsense. The
    // camera does not sit back any more; a wide delivery has its own rectangle.
    //
    // The floodlight wash and the vignette went with the same reasoning. The
    // reference is evenly lit from end to end: a gradient across the pitch is a
    // television idea, and it fought the flat overhead camera every time.

    // --- Markings: every line at its real IFAB distance, drawn in pitch space ---
    //
    // Straight lines go through P and rotate with everything else. ARCS do not:
    // ctx.arc takes screen-space angles, and those were written for the ordinary
    // view — so in a turned frame the D detached itself from the front of the
    // penalty area and floated out into the middle of the pitch, which is
    // exactly what it looked like. A pitch-space angle turns with the frame.
    const facing = facingRef.current;
    const arcAngle = (pitchAngle: number) =>
      pitchAngle + (facing === "right" ? Math.PI / 2 : facing === "left" ? -Math.PI / 2 : 0);
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
      ctx.arc(spot.px, spot.py, unit * ARC_R, arcAngle(Math.PI / 2 - half), arcAngle(Math.PI / 2 + half));
      ctx.stroke();
    }
    // Corner arcs (1 m quarter circles at each corner flag)
    {
      const c1 = P(0, 0), c2 = P(PITCH_W, 0);
      ctx.beginPath(); ctx.arc(c1.px, c1.py, unit * CORNER_R, arcAngle(0), arcAngle(Math.PI / 2)); ctx.stroke();
      ctx.beginPath(); ctx.arc(c2.px, c2.py, unit * CORNER_R, arcAngle(Math.PI / 2), arcAngle(Math.PI)); ctx.stroke();
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

    // --- The goal ---
    //
    // The pitch is a flat plan and the goal is the one thing on it drawn with
    // HEIGHT: posts standing on the goal line, a crossbar across their tops, the
    // netting stretched back behind them and a second frame at the back. That is
    // not a departure from the overhead camera — it is the same trick the ball
    // already uses, being lifted off its own shadow — and it is drawn at exactly
    // that scale, so a ball over the bar is visibly over the bar.
    //
    // Built as five surfaces, drawn back to front, because that is what a goal
    // is. What it replaced was a single flat panel with an even mesh over it,
    // and rendering the two side by side at matched width said why that read as
    // a window rather than a goal: **no tonal separation**. A goal's roof
    // catches the light and its mouth is in shadow, and with both the same
    // brightness there is nothing to tell you which way is in.
    {
      const hpx = GOAL_H * heightScale;
      const bl = P(POST_L, 0), br = P(POST_R, 0);                 // feet of the posts
      const tl = { px: bl.px, py: bl.py - hpx };                  // top of the near post
      const tr = { px: br.px, py: br.py - hpx };
      const rl = P(POST_L, -NET_DEPTH), rr = P(POST_R, -NET_DEPTH); // feet at the back
      const ul = { px: rl.px, py: rl.py - hpx };                  // and the back frame
      const ur = { px: rr.px, py: rr.py - hpx };

      type Pt = { px: number; py: number };
      const path = (q: Pt[]) => {
        ctx.beginPath();
        ctx.moveTo(q[0].px, q[0].py);
        for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].px, q[i].py);
        ctx.closePath();
      };
      const quad = (q: Pt[], fill: string) => { path(q); ctx.fillStyle = fill; ctx.fill(); };
      const seg = (a2: Pt, b2: Pt) => { ctx.beginPath(); ctx.moveTo(a2.px, a2.py); ctx.lineTo(b2.px, b2.py); ctx.stroke(); };
      const lerp = (a2: Pt, b2: Pt, f: number) => ({ px: a2.px + (b2.px - a2.px) * f, py: a2.py + (b2.py - a2.py) * f });
      // Netting over a surface: strands both ways, clipped to it.
      const netting = (q: Pt[], cols: number, rows: number, alpha: number) => {
        ctx.save();
        path(q); ctx.clip();
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = Math.max(0.7, unit * 0.028);
        for (let i = 0; i <= cols; i++) { const f = i / cols; seg(lerp(q[0], q[1], f), lerp(q[3], q[2], f)); }
        for (let j = 0; j <= rows; j++) { const f = j / rows; seg(lerp(q[0], q[3], f), lerp(q[1], q[2], f)); }
        ctx.restore();
      };

      // Its shadow on the grass.
      const sh = unit * 0.5;
      quad([rl, rr, br, bl].map(q => ({ px: q.px + sh, py: q.py + sh * 0.3 })), "rgba(0,0,0,0.09)");
      // The floor inside — barely shaded, because it is grass and you are
      // looking straight at it through an open mouth.
      quad([bl, br, rr, rl], "rgba(20,50,32,0.05)");
      // The back of the net: the deepest surface, and the one you see through
      // the mouth. Dimmer than the roof, which is what separates the two — in a
      // straight-down view a horizontal roof and a vertical back wall both come
      // out as flat bands, so shading is the only thing that can tell them apart.
      quad([rl, rr, ur, ul], "rgba(22,52,34,0.16)");
      netting([rl, rr, ur, ul], 34, 10, 0.42);
      ctx.strokeStyle = "#0f1a14";
      ctx.lineWidth = Math.max(1.8, unit * 0.15);
      seg(rl, ul); seg(rr, ur); seg(ul, ur);
      // The roof, catching the light — brighter than the back, deliberately.
      quad([tl, tr, ur, ul], "rgba(236,245,239,0.30)");
      netting([tl, tr, ur, ul], 34, 5, 0.8);
      // ── Nothing is drawn across the mouth ──
      //
      // The mouth is a hole. The net hangs BEHIND the posts and across the back,
      // and what you see through the opening is that back net in the upper part
      // and plain grass below it — which is exactly what the geometry gives you
      // once you stop drawing a second net across the front. Meshing the front
      // face too put netting on both sides of the frame: "it's everywhere, it's
      // at the front of the goal as well."

      // The frame at the front. The two objects a shot can actually hit.
      ctx.lineCap = "round";
      ctx.strokeStyle = "#f6faf7";
      ctx.lineWidth = Math.max(1.8, unit * 0.12);
      seg(bl, tl); seg(br, tr);
      ctx.lineWidth = Math.max(2, unit * 0.16);
      seg(tl, tr);
      ctx.lineCap = "butt";

      // The goal line on the ground, thin — the frame above it is the loud part.
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1.5, unit * 0.11);
      pLine(POST_L, 0, POST_R, 0);
    }

    // ── What you can SEE ──
    //
    // Vision buys information, and for a while that information was drawn as a
    // ring floating over the men you could pick out. It was the last of the
    // rings on the pitch and it went the same way as the others: two of your
    // three team-mates wearing a marker and one not is not a hint, it is a
    // puzzle about the UI. Vision still decides what the commentary tells you
    // and what the engine considers an option — it just does not draw on the
    // grass any more.

    // There is no pass marker, and there was one for far too long: a ring on the
    // grass showing exactly where to put the ball. Finding the man is the game.
    // If you need to be told where he wants it, you are not playing it.

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
      // Shorts default to the shirt's rim rather than a near-black everybody
      // shares. Two blocks of team colour instead of one is most of what makes
      // a figure readable when it is the size of a thumbnail: on the old
      // proportions the shirt was a small patch and the skin-coloured head,
      // arms and legs dominated, so at any distance both sides were the same
      // tan smudge and a crowd in the box was unreadable.
      const shorts = opts.shorts ?? rim;
      const lw = Math.max(1.3, r * 0.24);

      // ── Anchored at the FEET ──
      //
      // (px, py) is where this man is standing, and it is now where his boots
      // are: the shadow goes there and the body is drawn upward from it. The
      // figure used to hang off its own middle, so every player was drawn half a
      // body ahead of the spot he actually occupied — a keeper on his line had
      // his head on the line and his feet two metres in front of it, and looked
      // like he had come out. It also put the ball, which IS drawn at its ground
      // point, level with a player's waist rather than his boots.
      ctx.beginPath();
      ctx.ellipse(px, py, r * 0.78, r * 0.30, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.34)";
      ctx.fill();

      ctx.save();
      ctx.translate(px, py - r * 0.8);
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
      ctx.roundRect?.(-r * 0.46, -r * 0.02, r * 0.92, r * 0.36, r * 0.12);
      if (!ctx.roundRect) ctx.rect(-r * 0.46, -r * 0.02, r * 0.92, r * 0.36);
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

      // ── Shirt ── (deliberately the biggest thing on the figure)
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.roundRect?.(-r * 0.52, -r * 0.56, r * 1.04, r * 0.72, r * 0.17);
      if (!ctx.roundRect) ctx.rect(-r * 0.52, -r * 0.56, r * 1.04, r * 0.72);
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.strokeStyle = rim;
      ctx.stroke();

      // ── Head ──
      ctx.beginPath();
      ctx.arc(0, -r * 0.76, r * 0.26, 0, Math.PI * 2);
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
        ctx.fillText(opts.label, px, py - r * 1.02);
      }
    };

    // Sized against the reference rather than against the laws of the game: a
    // sprite there stands about 7% of the frame's width tall, which works out
    // near enough to two and a half metres. Footballers are not two and a half
    // metres tall, and it does not matter — at a true 1.8 m they are specks.
    //
    // Now that the projection is flat this holds everywhere on the frame, which
    // it never could before: a man at the goal used to be drawn at 64% of a man
    // at your feet.
    const R = unit * 1.15;

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

    // The man in the box. Always drawn — he used to appear only once he had
    // started chasing something, so a team-mate materialised next to the keeper
    // out of thin air halfway through a highlight. He is standing there the
    // whole time; you should be able to see him and aim for him. There is no
    // box to lurk in when the goal is not part of the situation.
    // ── The run ──
    //
    // Drawn instead of the scenario: you, the men in your way, and the line you
    // are trying to reach. What this replaced was a dashed yellow line across
    // the pitch and two thin white verticals — a diagram, and one nobody could
    // read as football. The line to reach is now a band of turf, and the sides
    // of the corridor are just the edges of the frame.
    const dr = dribbleRef.current;
    if (phaseRef.current === "dribble" && dr) {
      // The line. A lit band of grass rather than a rule drawn over the top.
      {
        const a1 = P(dr.minX - 6, dr.targetY), a2 = P(dr.maxX + 6, dr.targetY);
        const b1 = P(dr.minX - 6, dr.targetY - 2.2), b2 = P(dr.maxX + 6, dr.targetY - 2.2);
        ctx.beginPath();
        ctx.moveTo(a1.px, a1.py); ctx.lineTo(a2.px, a2.py);
        ctx.lineTo(b2.px, b2.py); ctx.lineTo(b1.px, b1.py);
        ctx.closePath();
        ctx.fillStyle = "rgba(52,211,153,0.18)";
        ctx.fill();
        ctx.lineWidth = Math.max(2, unit * 0.16);
        ctx.strokeStyle = "rgba(52,211,153,0.75)";
        ctx.beginPath(); ctx.moveTo(a1.px, a1.py); ctx.lineTo(a2.px, a2.py); ctx.stroke();
      }

      // The men in your way. One who has not seen you yet is drawn dimmer, so
      // "he is coming now" is information you get before it costs you the ball.
      dr.chasers.forEach((c, i) => {
        ctx.globalAlpha = c.awake ? 1 : 0.62;
        footballer(c.x, c.y, R, theirKit().shirt, theirKit().trim, {
          pose: c.awake ? poseFor(`chase${i}`, c.x, c.y) : "idle",
          phase: runPhase(c.x),
        });
        ctx.globalAlpha = 1;
      });

      // You, with the ball just ahead of your feet, and the line you are on.
      const bx = dr.pos.x + dr.heading.x * 1.1;
      const by = dr.pos.y + dr.heading.y * 1.1;
      const tip = P(dr.pos.x + dr.heading.x * 4.5, dr.pos.y + dr.heading.y * 4.5);
      const base = P(dr.pos.x, dr.pos.y);
      ctx.strokeStyle = "rgba(52,211,153,0.5)";
      ctx.lineWidth = Math.max(2, unit * 0.14);
      ctx.beginPath(); ctx.moveTo(base.px, base.py); ctx.lineTo(tip.px, tip.py); ctx.stroke();

      footballer(dr.pos.x, dr.pos.y, R, ourKit().shirt, ourKit().trim, {
        pose: "run",
        phase: runPhase(dr.pos.x),
        label: "YOU",
        labelColor: labelInk(ourKit().shirt),
      });
      const bp = toPx(bx, by);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(bp.px, bp.py, Math.max(2.5, unit * 0.34 * bp.scale), 0, Math.PI * 2);
      ctx.fill();

      // How far through the run you are.
      const prog = dribbleProgress(dr);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(W * 0.08, H * 0.045, W * 0.84, H * 0.014);
      ctx.fillStyle = prog > 0.75 ? "#fbbf24" : "#34d399";
      ctx.fillRect(W * 0.08, H * 0.045, W * 0.84 * prog, H * 0.014);
      return;
    }

    // ── Nobody is on the pitch while the match is somewhere else ──
    //
    // The simulation panel sits over the canvas between chances, and the canvas
    // was still drawing a scenario underneath it — at kick-off the throwaway one
    // `scenarioRef` was initialised with, and later the frozen aftermath of the
    // chance you had just taken. Neither is what happens next: press Continue
    // and a completely different situation is built. So the first thing every
    // match showed you was a fully drawn chance that was never played, and every
    // panel after it showed one that already had been.
    //
    // Reported as "why does it always start off previewing something that
    // doesn't ever show". It was visible at all because the panel's own backdrop
    // was `bg-gray-950/92`, and 92 is not on Tailwind's opacity scale — the class
    // was silently dropped and the overlay had no background whatsoever.
    if (phaseRef.current === "feed") return;

    // The poacher. He used to be drawn ABOVE the run, which meant a dribble —
    // built with no team-mates in it on purpose, because the question it asks is
    // whether YOU can beat these men — had one lone blue shirt standing in it,
    // left over from the scenario before. Same leak as the panel above: a figure
    // from a situation that is not the one on screen.
    if (goalInView(sc.kind)) {
      footballer(sc.follower.x, sc.follower.y, R, ourKit().shirt, ourKit().trim, {
        pose: poseFor("follower", sc.follower.x, sc.follower.y),
        phase: runPhase(sc.follower.x),
      });
    }

    /**
     * The armband's two orders, drawn on the grass.
     *
     * Gold, because that is what the armband is, and because nothing else on
     * this pitch is — a defender is never gold and neither is the ball, so an
     * order can never be mistaken for a thing that is about to happen to you.
     */
    const drawCaptainOrders = (s: Scenario) => {
      const GOLD = "#fbbf24";

      const arrow = (from: { x: number; y: number }, to: { x: number; y: number }, alpha: number, dashed: boolean) => {
        const a = toPx(from.x, from.y), b = toPx(to.x, to.y);
        const dx = b.px - a.px, dy = b.py - a.py;
        const len = Math.hypot(dx, dy);
        if (len < 6) return;
        const ux = dx / len, uy = dy / len;
        // Starts clear of the man's feet so the shaft does not grow out of his
        // shins, and stops short of the head so the head is the point of it.
        const HEAD = Math.min(16, len * 0.34);
        const sx = a.px + ux * 10, sy = a.py + uy * 10;
        const ex = b.px - ux * HEAD * 0.6, ey = b.py - uy * HEAD * 0.6;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        if (dashed) ctx.setLineDash([7, 6]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        // The head, as a filled triangle rather than two more strokes — a
        // stroked chevron reads as a bend in the line at this size.
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.moveTo(b.px, b.py);
        ctx.lineTo(b.px - ux * HEAD - uy * HEAD * 0.42, b.py - uy * HEAD + ux * HEAD * 0.42);
        ctx.lineTo(b.px - ux * HEAD + uy * HEAD * 0.42, b.py - uy * HEAD - ux * HEAD * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      // Runs already given: where each man has been sent, and where he is going
      // to be standing when the ball gets there.
      for (const r of orderableRunners(s)) {
        if (!r.commandedTo) continue;
        arrow(r.pos, r.commandedTo, 0.75, true);
      }

      // The man it gets laid off to. A ring around him rather than a marker
      // beside him: the order is about HIM, and a ring is the only shape that
      // says "this one" without pointing anywhere.
      if (s.relayTo) {
        const { px, py } = toPx(s.relayTo.pos.x, s.relayTo.pos.y);
        ctx.save();
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(px, py, 15, 0, Math.PI * 2);
        ctx.stroke();
        // …and a second, fainter ring, so it reads as deliberate rather than as
        // a selection halo that might be the game highlighting something.
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(px, py, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // The gesture in the thumb right now, drawn solid so it is plainly the
      // live one and the committed orders behind it are plainly not.
      const drag = captainDragRef.current;
      if (drag && Math.hypot(drag.to.x - drag.from.x, drag.to.y - drag.from.y) >= CAPTAIN_DRAG_MIN) {
        arrow(drag.runner.pos, drag.to, 1, false);
      }
    };

    // Decorative team-mates (the crosser on a volley/header)
    sc.teammates.forEach((t, i) => {
      footballer(t.x, t.y, R, ourKit().shirt, ourKit().trim, {
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
      footballer(r.pos.x, r.pos.y, R, ourKit().shirt, ourKit().trim, {
        pose: receiving ? "receive" : poseFor(`run${i}`, r.pos.x, r.pos.y),
        phase: runPhase(r.pos.x),
      });
    });

    // ── The captain's orders, drawn over his players ──
    //
    // Deliberately drawn AFTER the men and BEFORE the defenders and you, so an
    // order is never hidden behind a shirt and never hides the thing you are
    // aiming at. Only while you still have the ball: once it is struck the
    // orders are being carried out, and a pitch covered in arrows during the
    // flight is noise.
    if (isCaptainRef.current && phaseRef.current === "aim" && acceptsCaptainOrders(sc.kind)) {
      drawCaptainOrders(sc);
    }

    // Defenders + you. A wall man in the air is drawn where he actually is —
    // the same height the block test uses, so what you see is what resolves.
    sc.defenders.forEach((d, i) => {
      const lift = (d.z ?? 0) * 0.42;
      footballer(d.x, d.y - lift, R, theirKit().shirt, theirKit().trim, {
        pose: (d.z ?? 0) > 0.15 ? "kick" : poseFor(`def${i}`, d.x, d.y),
        phase: runPhase(d.x),
      });
    });
    // You wear the same shirt as everybody else on your side — you are one of
    // eleven, not a differently-coloured avatar. The armband of a name label is
    // what picks you out, which is how you pick a player out watching football.
    footballer(sc.player.x, sc.player.y, R, ourKit().shirt, ourKit().trim, {
      // Held briefly after a strike so the swing is visible rather than
      // happening entirely between two frames.
      pose: kickPoseRef.current > 0 ? "kick" : poseFor("you", sc.player.x, sc.player.y),
      phase: runPhase(sc.player.x),
      label: "YOU",
      labelColor: labelInk(ourKit().shirt),
    });

    // ── Keeper ──
    // Only where there is a goal to keep. A midfield situation has no goal in
    // the rectangle, so it has no keeper in it either.
    if (goalInView(sc.kind))
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
      // He is already standing at the ball by the time a save is drawn (the
      // engine puts him there), so the lunge is a pose rather than a journey —
      // a big horizontal offset here would throw the figure straight past the
      // thing he just saved.
      const cx = px + sign * KR * lunge * (K ? K.reachK : 1.0) * 0.3;
      const cyOff = KR * ((K ? K.crouch : 0) * lunge + breathe);
      const gloveR = KR * 0.24;

      ctx.save();
      ctx.globalAlpha = 0.92;

      ctx.beginPath();
      ctx.ellipse(cx, py, KR * (0.7 + diveN * 0.5), KR * 0.26, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();

      // No highlight ring on a save. The dive is the thing you are watching;
      // a yellow disc drawn over it only told you what you had already seen.

      ctx.translate(cx + KR * weight * (1 - lunge), py - KR * 0.8 + cyOff);
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

      // Shorts — the keeper's own kit, like everybody else, so he reads as the
      // keeper rather than as another outfield player who happens to be near
      // the goal. Wider than an outfielder's: he is stood square and low.
      ctx.fillStyle = kitsRef.current.keeper.trim;
      ctx.beginPath();
      ctx.roundRect?.(-KR * 0.52, -KR * 0.02, KR * 1.04, KR * 0.34, KR * 0.12);
      if (!ctx.roundRect) ctx.rect(-KR * 0.52, -KR * 0.02, KR * 1.04, KR * 0.34);
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
      ctx.fillStyle = kitsRef.current.keeper.shirt;
      ctx.beginPath();
      ctx.roundRect?.(-KR * 0.56, -KR * 0.50, KR * 1.12, KR * 0.58, KR * 0.15);
      if (!ctx.roundRect) ctx.rect(-KR * 0.56, -KR * 0.50, KR * 1.12, KR * 0.58);
      ctx.fill();
      ctx.lineWidth = Math.max(1, KR * 0.11);
      ctx.strokeStyle = kitsRef.current.keeper.trim;
      ctx.stroke();

      // Gloves — what actually makes him read as a keeper
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = kitsRef.current.keeper.trim;
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

    // ── Where it will land ──
    //
    // A ball in the air gets a mark on the grass at the spot it will first
    // bounce, and only the first: once it is down you can see perfectly well
    // where a rolling ball is going. It is the one thing drawn on the pitch that
    // is not part of the pitch, and it earns that because judging the flight of
    // a lofted ball from directly above is otherwise guesswork — height is the
    // one thing this camera cannot show you.
    // Worked out once, at the kick, and pinned — see markLanding. Recomputing it
    // each frame made it crawl across the grass after a curling ball.
    if (ballRef.current && phaseRef.current === "flight" && !ballRef.current.inNet
        && ballRef.current.z > 0.15) {
      const land = ballRef.current.landAt;
      if (land) {
        const m = P(land.x, land.y);
        const r = Math.max(3.5, unit * 0.5);
        ctx.strokeStyle = "rgba(250,214,74,0.95)";
        ctx.lineWidth = Math.max(2.5, unit * 0.19);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(m.px - r, m.py - r); ctx.lineTo(m.px + r, m.py + r);
        ctx.moveTo(m.px + r, m.py - r); ctx.lineTo(m.px - r, m.py + r);
        ctx.stroke();
        ctx.lineCap = "butt";
      }
    }

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

      if (phaseRef.current === "dribble" && dribbleRef.current) {
        // No React state per frame: the render loop already runs every frame and
        // reads the ref directly, so a state update here would re-render the
        // whole component sixty times a second for nothing.
        const out = stepDribble(dribbleRef.current, dt);
        if (out !== "running") finishDribble(out);
      }

      // ── Nothing moves until you kick it ──
      //
      // You have unlimited time to decide. The defence does not close you down,
      // your team-mates do not drift, and no option gets quietly worse while you
      // are looking at it — the only thing you do in a scenario is strike the
      // ball, and everything else is a consequence of that.
      //
      // The keeper is no exception either: he stands on his line, and where he
      // is standing is the thing you are reading. He only breathes.
      if (phaseRef.current === "aim") {
        stepKeeper(scenarioRef.current, dt);
      }

      // ── The cut, on a cross ──
      //
      // A wide ball is watched from the side while it is in the air, because
      // that is the only view from which the box is a box rather than a line.
      // Once it has reached the area it cuts to the ordinary view — and it is a
      // CUT, not a pan: the camera does not move, it is replaced. The thing you
      // care about from here is who gets on the end of it.
      if (ballRef.current && facingRef.current !== "up") {
        const sc = scenarioRef.current;
        const at = sc.crossSwitchY ?? 0;
        if (sc.crossSwitchView && ballRef.current.pos.y < at) {
          facingRef.current = "up";
          viewportRef.current = { ...sc.crossSwitchView };
          baseViewportRef.current = { ...sc.crossSwitchView };
          // The engine reads the frame too — out of it is out of the game — so
          // the situation moves with the picture.
          sc.viewport = { ...sc.crossSwitchView };
        }
      }

      if (phaseRef.current === "flight" && ballRef.current) {
        // Substep for stable physics
        const steps = 3;
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          // Everyone reacts to the ball, and only to the ball: a player moves
          // when it comes inside his radius and not before, slowly, and both
          // sides at the same pace. See stepReactions.
          stepDefenders(scenarioRef.current, h, ballRef.current.pos, false, ballRef.current);
          stepKeeper(scenarioRef.current, h);
          stepReactions(scenarioRef.current, ballRef.current, h, rngRef.current);
          const res = stepBall(ballRef.current, scenarioRef.current, rngRef.current, h);
          if (res) { resolveOutcome(res); break; }
        }
        // Surface mid-flight moments (pass reception / the teammate's own shot /
        // the woodwork) once.
        const ev = ballRef.current?.event;
        const receiver = scenarioRef.current.receiver;
        // The frame no longer ends the move — the ball cannons back out and is
        // live — so it is narrated here rather than in resolveOutcome.
        if (ev === "post") {
          pushLine("Off the woodwork — and it's still live!");
          showAction("POST");
          nudge(0.28, 0.25);
          playPost();
          playCrowdSwell("groan");
        }
        if (ev && receiver) {
          // His name, if we know it — and by now we do, because the identity is
          // taken off whoever the ball actually reached. See lib/star/lineup.ts.
          const label = receiver.who?.shortName ?? receiver.roleLabel;
          if (ev === "received") { pushLine(commentaryReceived(label, rngRef.current)); showAction("PASS"); }
          else if (ev === "receiverShot") { pushLine(commentaryReceiverShot(label, rngRef.current)); playKick(); kickPoseRef.current = KICK_POSE_S; }
          // He was told to leave it, and he has left it. Named, because the
          // whole point of the order is that the move went through somebody
          // rather than ending at the first man who could see the goal.
          else if (ev === "relay") {
            pushLine(`${label} leaves it — the captain wanted it moved on.`);
            showAction("PASS");
            playKick();
            kickPoseRef.current = KICK_POSE_S;
          }
        }
        if (ballRef.current) ballRef.current.event = null;
      }

      // A scored ball keeps travelling into the netting after the outcome has
      // resolved, so the goal is seen rather than announced.
      if (phaseRef.current === "result" && ballRef.current?.inNet) {
        stepBallInNet(ballRef.current, dt);
      }
      // …and a ball the keeper has pushed clear keeps going, so you watch it go
      // rather than finding it already there.
      if (phaseRef.current === "result" && ballRef.current?.settling) {
        settleBall(ballRef.current, dt, scenarioRef.current);
      }

      // Cosmetic FX advance (pausing the rAF pauses everything together)
      if (kickPoseRef.current > 0) kickPoseRef.current = Math.max(0, kickPoseRef.current - dt);

      // ── There is no camera ──
      //
      // The rectangle IS the situation. It is set when the scenario loads and it
      // does not move again — not to follow the ball, not to lead it, not to
      // follow you on a run.
      //
      // This replaced a camera that panned toward the ball, and the panning was
      // the single most disorientating thing in the game. It is built on a
      // misreading: that there is a whole pitch and each situation is a snapshot
      // of some part of it that the camera visits. There is not. A situation is
      // the frame you are looking at, entire. A run is getting from the bottom
      // of this rectangle to the top of it; a pass is finding a man inside it.
      // Nothing outside the frame is part of the game, so there is nothing out
      // there to pan to — and when the camera went looking anyway, you lost your
      // bearings and, twice, the thing you were aiming at.
      viewportRef.current = baseViewportRef.current;

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

  /**
   * The man this situation is about.
   *
   * The target of the pass on the situations that are a pass, and the man who
   * put it into you on the two that arrive from somebody. Undefined on a
   * one-on-one or a shot from distance, which are about you and the keeper — and
   * on any career whose squad has not loaded, where the commentary falls back to
   * the shapes it always described.
   */
  const targetName = (sc: Scenario | null): string | undefined => {
    if (!sc) return undefined;
    if (sc.kind === "volley" || sc.kind === "header") return sc.crosser?.shortName;
    return sc.runner?.who?.shortName
      ?? sc.secondaryRunners.find(r => r.role === "target")?.who?.shortName;
  };

  const resolveOutcome = (res: Outcome) => {
    setOutcome(res);
    setPhase("result");
    const sc = scenarioRef.current;
    // Read off the ball and off what the team-mate actually did, never off the
    // scenario's shape. See creditChance.
    // ── What YOU did, not what the ball is doing ──
    //
    // `ball.shot` is true after a team-mate strikes it too — `launchReceiverShot`
    // sets it so your own players step out of HIS shot as well as yours. Reading
    // it here meant that the moment somebody you found pulled the trigger, the
    // chance was filed as your shot: you were credited with his goal, he got
    // nothing, and the assist you had just played was never recorded. That is
    // the whole of "it counted as a team goal", and of ASSISTS reading 0/0 on a
    // goal the commentary had just described you setting up.
    const youShot = ballRef.current?.youStruckAtGoal === true;
    const receiverShot = sc.receiverShot === true;
    const isSimplePass = !youShot && !receiverShot && sc.passTarget != null;
    const kind = OUTCOME_TEXT[res].kind;

    // The tally lives in a ref so it's authoritative the instant this chance
    // resolves — the rAF loop calls a stale resolveOutcome closure, so reading it
    // back off React state would risk under-counting the final chance. State is
    // just a mirror for the HUD.
    const d = creditChance(res, { youShot, receiverShot, isSimplePass });
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
    } else if (res === "tackled" || res === "blocked") {
      // It says what happened, like a goal or a pass does. Losing the ball used
      // to resolve into a beat of nothing and then the next highlight, so you
      // were left working out from the replay what had gone wrong.
      //
      // …and it says WHICH thing happened. Both used to read BLOCKED, including
      // the one the outcome text called DISPOSSESSED, so the banner and the line
      // under it disagreed about your own move.
      showAction(res === "blocked" ? "BLOCKED" : "INTERCEPTED");
      nudge(0.18, 0.14);
      playSave();
    } else if (res === "offside") {
      showAction("OFFSIDE");
      playWhistle();
    } else if (res === "delivered") {
      // A pass that found its man is a thing you DID, and in a situation with no
      // goal in it, it is the only thing you can do — so it says so, the same
      // way a goal does. It only said PASS when the move carried on into a
      // finish, so the safe ball in midfield resolved in silence and read as
      // nothing having happened.
      showAction("PASS");
    } else if (res === "post") {
      nudge(0.28, 0.25);
      playPost();
      playCrowdSwell("groan");
    } else if (res === "saved" || res === "tipped") {
      nudge(0.18, 0.14);
      playSave();
      playCrowdSwell("groan");
    } else if (res === "caught") {
      nudge(0.18, 0.14);
      playSave();
    }

    // Assign named squad players to goals and update the goal events log.
    // Chain goals → a named attacker from the squad scores; user assisted.
    // Direct user goals → optionally pick a named squad member as assister.
    let commentaryRoleLabel = sc.receiver?.roleLabel;
    if (kind === "goal" && careerRef.current) {
      const squad = onPitch(careerRef.current.squad ?? []);
      const pFirst = careerRef.current.player.firstName;
      const pLast = careerRef.current.player.lastName;
      const playerName = `${pFirst} ${pLast}`;
      const rng = rngRef.current;

      // ── How it was scored ──
      //
      // The scenario the chance was built from and how far out the ball was
      // struck. Both are sitting right here and were thrown away, which meant a
      // goal was a number: nothing downstream could tell a tap-in from a
      // thirty-yard volley, so nothing downstream could say so. `res` is a
      // rebound outcome when it came off a second phase, which is a different
      // kind of goal again.
      const how = res === "rebound" ? "rebound" : sc.kind;
      const distance = Math.hypot(sc.ball.x - (sc.goal.x1 + sc.goal.x2) / 2, sc.ball.y);

      if (d.assists === 1 && sc.receiver) {
        // ── The man who scored it is the man who scored it ──
        //
        // He is decided on the pitch, at the moment the ball reaches him, and
        // carried on the receiver — not drawn from the squad list here. Drawing
        // him here was the bug: the game picked a plausible forward at the
        // whistle, which is a different question from "who was standing there",
        // and when there was no squad to draw from it picked nobody and the goal
        // went down as a team goal with the commentary saying "the attacking
        // midfielder". Now the commentary, the goal and the squad row all read
        // off one identity.
        //
        // The fallback still picks a forward, for the sandbox and for careers
        // whose squad has not loaded — and the goal is recorded either way,
        // because a goal that has been scored is a fact about the match whether
        // or not we can put a name to it.
        const scorer = sc.receiver.who
          ?? (() => {
            const forwards = squad.filter(p => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
            return pickSquadScorer(forwards.length > 0 ? forwards : squad, rng) ?? undefined;
          })();
        if (scorer) commentaryRoleLabel = scorer.shortName;
        const scorerLabel = scorer?.shortName ?? sc.receiver.roleLabel ?? "Team-mate";
        goalEventsRef.current.push({
          minute: matchMinuteRef.current,
          scorer: scorer?.name ?? sc.receiver.roleLabel ?? "Team-mate",
          assist: playerName,
          isUserGoal: false, how, distance: Math.round(distance),
        });
        logMoment(`⚽ ${scorerLabel} scores!`, "goal");
        logMoment(`A: ${playerLabel()}`, "assist");
      } else if (d.goals === 1) {
        // ── And an assist is somebody who was actually in the move ──
        //
        // The man who crossed it, on the situations that arrive from somebody;
        // nobody at all otherwise, which is the honest answer for a goal you cut
        // in and curled home on your own. It used to pull a random creator out
        // of the squad 65% of the time — so assists appeared against players who
        // had not been on the screen, which is exactly the kind of thing that
        // makes the whole stats column untrustworthy.
        // A rebound you followed in was created by whoever's shot came back,
        // which was yours.
        const assister = res === "rebound" ? undefined : creatorOf(sc, squad, rng);
        goalEventsRef.current.push({
          minute: matchMinuteRef.current, scorer: playerName, assist: assister?.name,
          isUserGoal: true, how, distance: Math.round(distance),
        });
        logMoment(`⚽ ${playerLabel()} scores!`, "goal");
        if (assister) logMoment(`A: ${assister.shortName}`, "assist");
      } else {
        // The scoreline has gone up and neither branch claimed it. It is still a
        // goal, and a goal with nobody's name on it is a goal missing from the
        // match report, the scoresheet and the squad stats. Yours: nobody else
        // was involved, or one of the branches above would have fired.
        goalEventsRef.current.push({
          minute: matchMinuteRef.current, scorer: playerName,
          isUserGoal: true, how, distance: Math.round(distance),
        });
        logMoment(`⚽ ${playerLabel()} scores!`, "goal");
      }
    }

    // ── The two questions the commentary is asking ──
    //
    // "Was there a man to find?" and "did the ball get to him?" — and both were
    // being answered with the wrong flag, which inverted the line on every
    // chained chance in the game.
    //
    // `chain` was `receiverShot`, so a pass that never reached anybody was not
    // a chain at all and could never be described as a failed pass.
    // `receiverReached` was `receiverDone`, which is cleared the instant he
    // strikes it — so it was false for every chance where the pass had WORKED.
    // Between them: you picked out a team-mate, he shot, the keeper saved it,
    // and the game said "Cut out! A defender reads it well."
    pushLine(commentaryResult(res, rngRef.current, {
      chain: sc.receiver != null,
      receiverReached: sc.receiverReached === true,
      roleLabel: commentaryRoleLabel,
      isPass: isSimplePass,
    }));

    // A pass that found its man can keep the move going. This used to apply to
    // build-up only, and jumped to a random attacking situation; now any
    // completed pass can come back, and what you get next is read off where the
    // ball actually arrived.
    if (res === "delivered") {
      const depth = sc.chainDepth ?? 0;
      const at = sc.receivedAt ?? sc.runner?.pos ?? sc.passTarget;
      if (at && depth < CHAIN_MAX && rngRef.current() < chainReturnChance(sc)) {
        const ambition = Math.max(sc.passDifficulty, sc.passAmbition ?? 0);
        chainRef.current = { pos: { x: at.x, y: at.y }, depth: depth + 1, ambition };
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

  /**
   * The run is over.
   *
   * Getting through is NOT the end of the move — §6.1: "dribbling is rewarded
   * when it creates a better football decision". So it chains straight into a
   * chance built from where you got to, using the same machinery a completed
   * pass uses. Losing it is a turnover like any other.
   */
  const finishDribble = (out: "through" | "lost" | "out") => {
    const s = dribbleRef.current;
    dribbleRef.current = null;
    attemptsRef.current += 1;

    if (out === "through" && s) {
      pushLine("You are through — and the chance is on.");
      showAction("BEAT HIM");
      // Beating your man is the bravest thing available, so what follows is read
      // the same way the ambitious pass is.
      chainRef.current = { pos: { x: s.pos.x, y: s.pos.y }, depth: 0, ambition: 1 };
      if (matchModeRef.current) resolveScenario(matchStateRef.current, "delivered");
      window.setTimeout(() => loadScenario(true), 1200);
      return;
    }

    pushLine(out === "lost" ? "Taken off you." : "You run it out of play.");
    setOutcome("tackled");
    setPhase("result");
    if (matchModeRef.current) resolveScenario(matchStateRef.current, "lost");
    const t = tallyRef.current;
    t.chances += 1;
    setStats({ ...t });
    if (matchModeRef.current) {
      window.setTimeout(() => startSimulation(), 1600);
    } else {
      window.setTimeout(() => loadScenario(false), 1600);
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

    // Dead balls you are not the taker for go to whoever is. Keep advancing
    // until the match hands you something that is actually yours — bounded,
    // because every pass moves the clock and the clock ends the match.
    let step = advanceUntilInvolved(st, hiddenInputs(), rng, MATCH_DURATION);
    const handedOver: HiddenMatchEvent[] = [];
    for (let guard = 0; guard < 20; guard++) {
      const kind = step.request?.kinds.length === 1 ? step.request.kinds[0] : null;
      if (!kind || mayTake(kind) || (kind !== "free_kick" && kind !== "penalty")) break;

      const label = kind === "penalty" ? "penalty" : "free kick";
      const scored = rng() < (kind === "penalty" ? 0.76 : 0.09);
      if (scored) {
        st.userScore += 1;
        handedOver.push({ minute: st.minute, text: `⚽ Your side score the ${label}!`, isGoal: true, teammateGoal: true });
      } else {
        handedOver.push({ minute: st.minute, text: `A ${label} — someone else steps up, and it comes to nothing.` });
      }
      resolveScenario(st, scored ? "goal" : "saved");
      step = advanceUntilInvolved(st, hiddenInputs(), rng, MATCH_DURATION);
    }

    const raw = [...handedOver, ...step.events];

    // ── WHO SCORED ──
    //
    // A goal your side scores while you are not on the ball used to be reported
    // as "Your side score" and then vanish: no name on the sim screen, no line
    // in the running commentary, and nothing in the scoresheet. Half your team's
    // goals across a whole career belonged to nobody.
    //
    // Done in ONE pass now, mapping each raw event to its own SimEvent. The
    // previous version named the goal and then went looking for the line to
    // rename with `events.find(minute === e.minute && isGoal)`, which is not an
    // identity — two goals in the same minute renamed the same line twice and
    // left the other anonymous, and a minute where BOTH sides scored could put
    // your striker's name on the opposition's goal.
    const squad = onPitch(careerRef.current?.squad ?? []);
    // `announce: true` — these are happening now, live, so they belong in the
    // four-line ticker as well as in the permanent log.
    const events: SimEvent[] = nameTeamGoals(raw, squad, rng, true);

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

    // ── Being taken off ──
    // Checked here, between chances, because that is where the clock actually
    // moves. Your legs and your afternoon decide it; the game being won decides
    // the flattering version of it.
    if (!hookedRef.current && !step.fullTime) {
      const t = tallyRef.current;
      const decision = hookCheck({
        minute: st.minute,
        startMinute: startMinuteRef.current,
        liveRating: liveRating(t.goals, t.assists, t.passesCompleted, st.userScore, st.oppScore),
        energy: energyRef.current,
        scoreDiff: st.userScore - st.oppScore,
        rng,
      });
      if (decision.hooked) {
        hookedRef.current = decision.reason;
        hookedAtRef.current = st.minute;
        events.push({ minute: st.minute, text: decision.message });
        // The rest of the match is played without you, exactly as the hour
        // before kick-off is when you come off the bench.
        const after = advanceTo(st, hiddenInputs(), rng, MATCH_DURATION);
        for (const e of after) {
          events.push({
            minute: e.minute,
            text: e.isGoal && !e.teammateGoal ? `⚽ ${fixtureOpponentRef.current} score!` : e.text,
            isGoal: e.isGoal,
          });
        }
        userScoreRef.current = st.userScore;
        oppScoreRef.current = st.oppScore;
        setScore({ user: st.userScore, opp: st.oppScore });
        step = { ...step, request: null, fullTime: true };
      }
    }

    pendingRequestRef.current = step.request;

    // ── Into the commentary, a line at a time ──
    //
    // The minute is NOT jumped to here: it is advanced by the streamer as each
    // line is read out, which is the difference between watching the clock run
    // and being told where it got to. See the queue effect.
    setQueue(linesFrom(events, matchMinuteRef.current));
    setPhase("feed");

    simContinueRef.current = () => {
      if (step.fullTime) {
        // Full time stops the match rather than sliding into the summary: a
        // final whistle you did not notice is a result you find out about on a
        // stats screen.
        setLog(l => [...l, logLine(
          `Full Time  ${userScoreRef.current} - ${oppScoreRef.current}`, "period", MATCH_DURATION)]);
        setMatchMinute(MATCH_DURATION);
        setPause({
          label: "That's the whistle",
          cta: "Full time →",
          onContinue: () => {
            setPause(null);
            const careerForStats = careerRef.current ?? FALLBACK_CAREER;
            const t = tallyRef.current;
            const stats = finaliseMatch(
              attemptsRef.current, t.goals, t.assists, t.passesCompleted,
              Math.max(1, (hookedAtRef.current ?? matchMinuteRef.current) - startMinuteRef.current),
              userScoreRef.current, oppScoreRef.current, careerForStats,
              goalEventsRef.current, hookedRef.current,
            );
            if (matchModeRef.current && onCompleteRef.current) {
              onCompleteRef.current(stats);
            } else {
              setFinalStats(stats);
              setPhase("postmatch");
            }
          },
        });
      } else {
        loadScenario(false);
      }
    };
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

    // A run at the defence rather than a ball to strike.
    if (!attacking && request?.dribble) {
      dribbleRef.current = newDribble({
        pace: careerRef.current?.skills.pace ?? 50,
        oppStrength: oppStrengthRef.current,
        chasers: 3 + (rng() < 0.35 ? 1 : 0),
        rng,
      });
      setAim(null);
      setOutcome(null);
      dragRef.current = null;
      draggingRef.current = false;
      // Its own camera, snapped into place rather than eased, so the run does
      // not begin on the frame the last chance was using.
      facingRef.current = "up";
      viewportRef.current = dribbleViewport(dribbleRef.current);
      baseViewportRef.current = { ...viewportRef.current };
      setPhase("dribble");
      logMoment(`The move works its way to ${playerLabel()}.`, "you");
      pushLine(request.reason);
      pushLine("Swipe the way you want to run. Get past them to the line.");
      playWhistle();
      return;
    }

    if (chain) {
      // Built from where the pass actually arrived, so playing it into the
      // corner gives you a cutback and finding someone central gives you a shot.
      const kind = chainKindFor(chain.pos, rng, chain.ambition);
      scenarioRef.current = buildScenario(kind, rng, strengthRef.current, teamRef.current, visionRef.current);
      scenarioRef.current.chainDepth = chain.depth;
    } else if (attacking) {
      scenarioRef.current = buildAttackingScenario(rng, strengthRef.current, teamRef.current, visionRef.current);
    } else if (request) {
      const kind = pickScenarioKindFrom(positionRef.current, rng, request.kinds);
      scenarioRef.current = buildScenario(kind, rng, strengthRef.current, teamRef.current, visionRef.current);
    } else {
      scenarioRef.current = buildWeightedScenario(rng, positionRef.current, strengthRef.current, teamRef.current, visionRef.current);
    }

    scenarioRef.current.conditions = conditionsRef.current;

    // ── Put your actual team-mates in the shirts ──
    //
    // Every blue figure on the pitch becomes a man from your squad, chosen for
    // where he is standing. Whoever the ball reaches is who shoots, is who the
    // commentary names, and is who the goal goes to. See lib/star/lineup.ts.
    castScenario(scenarioRef.current, onPitch(careerRef.current?.squad ?? []));

    // Give the defence its shape: who presses, who covers a lane, who holds.
    initDefenders(scenarioRef.current, rng);

    // You are RECEIVING this one, not starting with it at your feet, so the
    // defence gets the time your first touch cost them. A heavy touch and they
    // are on you before you look up; a good one and you have a moment.
    let heavyTouch = 0;
    if (chain) heavyTouch = applyFirstTouch(scenarioRef.current, tiredSkills().technique, rng);

    facingRef.current = scenarioRef.current.facing ?? "up";
    viewportRef.current = { ...scenarioRef.current.viewport };
    baseViewportRef.current = { ...scenarioRef.current.viewport };
    ballRef.current = null;
    setAim(null);
    setOutcome(null);
    dragRef.current = null;
    draggingRef.current = false;
    // Orders belong to the situation they were given in. A fresh scenario is a
    // fresh set of team-mates in fresh positions, so anything the captain said
    // about the last one is meaningless — and carrying a stale Runner reference
    // across would point at a man who is no longer on the pitch.
    captainDragRef.current = null;
    bumpOrders();
    trailRef.current = [];
    particlesRef.current = [];
    shakeRef.current.t = 0;
    flashRef.current.t = 0;
    setPhase("aim");
    // One line, once per chance — see logMoment. This is the single thing kept
    // from what used to be an unbroken flood of buildup commentary: the moment
    // the ball actually reaches a player of yours to do something with.
    logMoment(`The move works its way to ${playerLabel()}.`, "you");
    // Say where the chance came from before describing it, so it reads as the
    // end of a move rather than as a situation that appeared from nowhere.
    if (request) pushLine(request.reason);
    // Nobody is "on you" any more — the pitch is frozen until you strike it. A
    // heavy touch costs you the POSITION you strike from, so that is what it
    // says.
    if (heavyTouch > 0.55) pushLine("Heavy touch — it has got away from you.");
    pushLine(commentaryBuildup(scenarioRef.current.kind, rngRef.current, targetName(scenarioRef.current)));
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
    simContinueRef.current = null;
    pendingRequestRef.current = null;
    dribbleRef.current = null;
    flickStartRef.current = null;
    hookedRef.current = null;
    hookedAtRef.current = null;
    chainRef.current = null;
    setScore({ user: 0, opp: 0 });
    setStats({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 });
    setFinalStats(null);
    setFeed([]);
    setLog([]);
    setQueue([]);
    setPause(null);
    halfTimeShownRef.current = false;
    loadScenario(false);
  };

  // --- Pointer (slingshot) ---
  const onPointerDown = (e: React.PointerEvent) => {
    primeMatchSound();
    if (phaseRef.current === "dribble") {
      flickStartRef.current = pitchFromPointer(e.clientX, e.clientY);
      try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    if (phaseRef.current !== "aim") return;
    const p = pitchFromPointer(e.clientX, e.clientY);
    const b = scenarioRef.current.ball;
    // Grab radius scales with the camera so the ball is equally easy to pick up
    // whether the chance is framed tight or wide.
    const vp = viewportRef.current;
    if (Math.hypot(p.x - b.x, p.y - b.y) > (vp.y2 - vp.y1) * 0.28) {
      // Not the ball. A captain touching one of his own players is giving him an
      // order; anybody else has simply missed, and nothing happens — which is
      // exactly what happened before the armband existed.
      const r = captainPickAt(p);
      if (r) {
        captainDragRef.current = { runner: r, from: p, to: p };
        try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      return;
    }
    draggingRef.current = true;
    dragRef.current = p;
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (phaseRef.current === "dribble") return;
    if (captainDragRef.current) {
      captainDragRef.current.to = pitchFromPointer(e.clientX, e.clientY);
      return;
    }
    if (!draggingRef.current) return;
    dragRef.current = pitchFromPointer(e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    // A flick is a direction and nothing else. Short taps are ignored so a
    // mis-touch cannot send the run sideways.
    if (phaseRef.current === "dribble") {
      const from = flickStartRef.current;
      flickStartRef.current = null;
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      const d = dribbleRef.current;
      if (!from || !d) return;
      const to = pitchFromPointer(e.clientX, e.clientY);
      const dx = to.x - from.x, dy = to.y - from.y;
      if (Math.hypot(dx, dy) < 1.2) return;
      flick(d, dx, dy);
      return;
    }
    // ── The captain's gesture, settled ──
    //
    // One touch, two orders, told apart by how far it travelled. A tap is a
    // choice ("him") and a drag is a direction ("there") — the same distinction
    // a manager's hand makes on a touchline, and it means neither ability needs
    // a mode button taking up room on a phone screen.
    if (captainDragRef.current) {
      const { runner, from, to } = captainDragRef.current;
      captainDragRef.current = null;
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      const sc = scenarioRef.current;
      if (Math.hypot(to.x - from.x, to.y - from.y) < CAPTAIN_DRAG_MIN) {
        // A tap: he is the man it gets laid off to, or he no longer is.
        sc.relayTo = sc.relayTo === runner ? null : runner;
      } else {
        // A drag: he runs that way, as far as you pulled, starting the moment
        // you play the ball. Dragging from a man you had picked out for the
        // lay-off does not take that order away — the two compose, and a man
        // running onto it is played in front of. See launchReceiverPass.
        runner.commandedTo = { x: to.x, y: to.y };
      }
      bumpOrders();
      return;
    }
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const b = scenarioRef.current.ball;
    const power = powerFromDrag(d, b);
    // ── Two floors, and the second one is not redundant ──
    //
    // A shot has to be worth taking, AND the gesture has to have been a gesture.
    // Shortening the full-power pull shortened everything proportionally, so
    // 12% power went from a 26-pixel drag to a 13-pixel one — inside the slop of
    // a thumb pressing the ball and slipping. The absolute floor keeps the
    // dead zone the size it has always been on the glass.
    if (screenPull(d, b) < MIN_PULL) return;
    if (power < 0.12) return; // too weak — stay in aim
    const dir = { x: b.x - d.x, y: b.y - d.y };
    setAim({ dir, power });
    setPhase("contact");
  };

  // --- Contact chosen -> launch ---
  const handleContact = (contact: { cx: number; cy: number }) => {
    if (!aim) return;
    // A dead ball is struck with your free-kick rating, not your general
    // technique — the one strike in football that is purely placement and curl.
    const strikeWith = setPieceSkills(
      tiredSkills(),
      careerRef.current?.skills.freeKick ?? skills.technique,
      scenarioRef.current.kind,
    );
    ballRef.current = launch(scenarioRef.current, aim.dir, aim.power, contact, strikeWith, rngRef.current);
    setEnergy(energyRef.current - DRAIN_PER_CHANCE);
    setPhase("flight");
    pushLine(commentaryStrike(scenarioRef.current.kind, rngRef.current, targetName(scenarioRef.current)));
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
      <div className="text-[8px] uppercase tracking-widest text-white/70 font-bold leading-none">{label}</div>
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
            {statCell("Goals", `${stats.goals}`, "text-amber-300")}
            {statCell("Assists", `${stats.assists}`, "text-emerald-300")}
            {statCell("Passes", `${stats.passesCompleted}/${stats.passes}`, "text-violet-300")}
            {statCell("Avg Rat", liveRating(stats.goals, stats.assists, stats.passesCompleted, score.user, score.opp).toFixed(1), "text-sky-300")}
          </div>
          <button
            onClick={toggleMuted}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            className="px-2.5 flex items-center border-l border-white/10 text-white/80 hover:text-amber-300 transition"
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
        className="relative w-full aspect-[5/8] rounded-xl overflow-hidden border-2 border-emerald-800/80 shadow-2xl shadow-emerald-950/60"
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
          <ContactBall power={aim.power} onContact={handleContact} />
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

        {/* ── The match itself ──
            Not an overlay over the pitch: the commentary IS the match, and the
            canvas above is what it cuts away to. See lib/star/matchLog. */}
        {phase === "feed" && (
          <MatchCommentary
            lines={log}
            minute={matchMinute}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeScore={homeScore}
            awayScore={awayScore}
            energy={energy}
            stats={stats}
            speed={speed}
            onSpeed={() => setSpeed(sp => (sp === 1 ? 2 : sp === 2 ? 4 : 1))}
            pause={pause}
            // Tapping the commentary empties the queue in one go. Nobody wants
            // to sit through four minutes of build-up twice, and the alternative
            // to letting them skip it is that they turn the speed up and leave
            // it there.
            onSkip={queue.length > 0 && !pause ? () => {
              setLog(l => [...l, ...queue]);
              const last = queue[queue.length - 1];
              if (last?.minute !== undefined) {
                matchMinuteRef.current = last.minute;
                setMatchMinute(last.minute);
              }
              setQueue([]);
            } : undefined}
          />
        )}
      </div>

      {/* Live commentary ticker — only while the pitch has the screen. The
          commentary phase shows every line of this and more, and running both
          is the same four lines twice. */}
      <div className={`mt-2 rounded-lg border border-gray-800 bg-gray-950/85 px-3 py-2 min-h-[3.8rem] ${phase === "feed" ? "hidden" : ""}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="kib-live inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="text-[8px] font-black tracking-[0.22em] text-white/70 uppercase">Live Commentary</span>
        </div>
        <div className="space-y-0.5">
          {feed.length === 0 && <div className="text-[11px] text-white/65 italic">Kick-off…</div>}
          {feed.map((line, i) => (
            <div
              key={i}
              className={`text-[11px] leading-snug pl-2 border-l-2 ${
                i === feed.length - 1 ? "text-white font-bold border-emerald-500/80" : "text-white/70 border-transparent"
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div className="mt-2 bg-gray-900/70 border border-gray-800 rounded-lg px-3 py-2 text-[10px] text-white/85 text-center">
        {matchMode && (
          <span className="text-emerald-300 font-black mr-1">
            {matchMinute}&#39; ·
          </span>
        )}
        <span className="text-amber-300">💡</span> {scenarioLabel.hint}
      </div>

      {/* ── The armband ──
          Only for the captain, only while the ball is still at your feet, and
          only in a situation orders mean anything in. It reports what has
          actually been given rather than repeating the instructions forever —
          a line you have already acted on is clutter. */}
      {isCaptain && phase === "aim" && acceptsCaptainOrders(scenarioRef.current.kind) && (
        <div className="mt-1.5 bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-1.5 text-[10px] text-amber-200/90 text-center">
          <span className="font-black text-amber-300">© CAPTAIN</span>
          {(() => {
            // Orders live on the scenario (a ref), so this line is re-read when
            // orderTick moves and at no other time. See bumpOrders.
            void orderTick;
            const sc = scenarioRef.current;
            const runs = orderableRunners(sc).filter(r => r.commandedTo).length;
            const relay = !!sc.relayTo;
            if (!runs && !relay) return <> · tap a team-mate to have it laid off to him, drag to send him on a run</>;
            return (
              <>
                {relay && <> · lay-off to <span className="font-black">{sc.relayTo?.who?.shortName ?? "your man"}</span></>}
                {!!runs && <> · {runs} run{runs > 1 ? "s" : ""} called</>}
              </>
            );
          })()}
        </div>
      )}

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
