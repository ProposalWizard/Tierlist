/**
 * A FULL NINETY MINUTES YOU CAN WATCH — a test-page replay (/star-sim90-dev).
 *
 * Harry, 13 Oct 2026: "I want to see a full simulated 90 mins in test area."
 *
 * The unseen match (hiddenMatch.ts, run through matchRadar.ts exactly as the
 * Match Radar runs it) decides the football: who has the ball each minute,
 * which fifth of the pitch and which channel it is in, every shot, corner and
 * goal, and the score. This file decides nothing about that. It only stages
 * it: twenty-two men stood where the 11-a-side positional layer puts them
 * (formationShape.ts's measured back line, playstyle.ts, the club's own
 * formation), the ball passed between team-mates toward the area the minute
 * is in, turned over when possession flips, and struck at goal when the
 * unseen match has a shot.
 *
 * It is a REPLAY. `simulate90` builds the whole match up front — a pure
 * function of the setup and the seed — as a goal-video recording
 * (goalClip/track.ts), so the goal-video renderer (goalClip/render.ts) draws
 * it with the game's own figures. Nothing here touches the match engine
 * (canvasEngine.ts): the ball here is never "played", only placed along the
 * passes and shots the unseen match already decided. No canvas, no React.
 *
 * Simplifications, on purpose:
 *  - Home is always "your side" in the unseen match. The teams swap ends at
 *    half-time: the second half is staged exactly like the first and the
 *    picture is turned round (x and y both mirrored), so home attacks the far
 *    goal after the break. The radar strip still draws home one way.
 *  - Half-time is a cut: everyone is stood back in kick-off positions.
 *  - Keepers dive on a save (and on a goal that beats them) toward where the
 *    ball is going; the goal-video renderer draws the dive.
 *  - No cards, fouls or offside calls: the unseen match has none.
 */
import { startRadar, stepRadar, resolveHighlight, radarOver, type RadarMatch } from "./matchRadar";
import type { HiddenMatchInputs, RadarTick, Zone, Lane } from "./hiddenMatch";
import { mulberry32 } from "./season";
import { PITCH_W, CX, HALF_LEN, POST_L, POST_R } from "./pitch";
import { formationForClub } from "./clubFormation";
import { playstyleForClub, type PlaystyleProfile } from "./playstyle";
import { targetBlock } from "./formationShape";
import { autoPick, type Formation } from "./formations";
import { generateSquad, clubNameSeed } from "./squadData";
import { kitsFor, keeperKit, type Kit } from "./kits";
import { CLUB_SHORT_NAMES } from "./clubs";
import { TRACK_VERSION, frameStride, packFrame, type GoalTrack, type ClipBody, type ClipEvent, type FrameState } from "./goalClip/track";

/** Frames a second in the replay. The renderer reads in-between moments as
 *  straight lines, so 10 is smooth at any speed and keeps the whole match to
 *  about 8 MB. */
export const SIM_FPS = 10;
const DT = 1 / SIM_FPS;
const LEN = 105;
export const HALF_T = 45 * 60;
export const FULL_T = 90 * 60;

type Team = 0 | 1;          // 0 home (your side in the unseen match), 1 away
interface V { x: number; y: number }
interface V3 { x: number; y: number; z: number }

export interface Sim90Setup {
  home: string;
  away: string;
  homeStrength: number;
  awayStrength: number;
  seed: number;
  /** The unseen match's "Match flow: New" (more shots and corners). */
  matchFlow?: boolean;
  /** Real squads, if the page has them: names in slot order (GK first) per side. */
  names?: { home?: string[]; away?: string[] };
}

/** One of YOUR chances: the unseen match handed you a scenario to play
 *  (its highlight / scenario request). The page can open it in the real match. */
export interface Sim90Chance {
  kinds: string[];
  dribble: boolean;
  reason: string;
  /** What the unseen match decided at the bench rate. */
  result: "goal" | "missed";
}

export type Sim90EventKind = "goal" | "shot" | "save" | "miss" | "corner" | "kickoff" | "half" | "full";

export interface Sim90Event {
  /** Replay seconds. */
  t: number;
  /** The match minute it happened in (1-90). */
  minute: number;
  kind: Sim90EventKind;
  side: Team | -1;
  text: string;
  /** Set on the shot of one of your own chances. */
  chance?: Sim90Chance;
}

export interface Sim90 {
  setup: Sim90Setup;
  track: GoalTrack;
  radar: RadarMatch;
  /** The radar's minutes, for the live radar strip. */
  ticks: Map<number, RadarTick>;
  events: Sim90Event[];
  /** Per frame: 0 nobody (dead ball), 1 home has it, 2 away has it. */
  control: Uint8Array;
  score: [number, number];
  /** Short names, body order (home 0-10, away 11-21; GK first). */
  names: string[];
  /** Passes played, passes played to a man in an offside position, and the
   *  times a shot was due with the other side on the ball so the ball had to
   *  jump to the shooter (should be very rare). */
  stats: { passes: number; offsidePasses: number; snaps: number };
}

// ── Where the unseen match's areas are, in metres (the radar's own numbers) ──

/** Distance from HOME's goal (home attacks toward y = 0, so y = 105 − this). */
const ZONE_D: Record<Zone, [number, number]> = {
  own_box: [5, 16.5], defensive: [16.5, 35], middle: [35, 70], attacking: [70, 88.5], box: [88.5, 100],
};
const LANE_X: Record<Lane, [number, number]> = { left: [6, 21], centre: [21, 47], right: [47, 62] };

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const dist = (a: V, b: V) => Math.hypot(a.x - b.x, a.y - b.y);
const teamOf = (i: number): Team => (i < 11 ? 0 : 1);
/** Metres from team T's own goal. */
const depthOf = (T: Team, y: number) => (T === 0 ? LEN - y : y);
const yAt = (T: Team, d: number) => (T === 0 ? LEN - d : d);
/** The y of the goal team T attacks. */
const goalY = (T: Team) => (T === 0 ? 0 : LEN);

// ── Shapes ──────────────────────────────────────────────────────────────────

interface Side {
  formation: Formation;
  style: PlaystyleProfile;
  strength: number;
  /** Per slot (GK first): 0 back line … 1 front line. */
  u: number[];
}

function sideOf(club: string, strength: number): Side {
  const formation = formationForClub(club);
  const out = formation.slots.slice(1);
  const back = Math.max(...out.map((s) => s.y)), front = Math.min(...out.map((s) => s.y));
  const u = formation.slots.map((s, i) => (i === 0 ? 0 : (back - s.y) / Math.max(0.01, back - front)));
  return { formation, style: playstyleForClub(club), strength, u };
}

/**
 * Where each of team T's eleven wants to stand, with the ball at `ball`.
 * Out of possession: the measured block (formationShape's targetBlock) — the
 * back line between the ball and goal, slid toward the ball's side, the
 * keeper off his line. In possession: stretched long and wide, the front line
 * held level with the other side's last man so nobody stands offside.
 */
function shapeOf(T: Team, side: Side, other: Side, inPoss: boolean, ball: V, offsideD: number): V[] {
  const ballD = depthOf(T, ball.y);
  const mirror = (sx: number) => (T === 0 ? sx : 1 - sx);
  let back: number, front: number, keeperD: number, widthM: number, slide: number;
  if (!inPoss) {
    const input = { formation: side.formation, playstyle: side.style, attackerStrength: other.strength, defenderStrength: side.strength };
    const near = Math.min(ballD, 45);
    const blk = targetBlock(input, ball.x, near);
    back = blk.lineY + Math.max(0, ballD - 45) * 0.6;
    back = clamp(Math.min(back, ballD - 2.5), 4, 50);
    keeperD = clamp(blk.keeperY + Math.max(0, ballD - 45) * 0.14, 1, 14);
    front = Math.max(back + 14, Math.min(back + side.style.compactness, ballD + 3));
    widthM = clamp(blk.span * 1.9, 34, 48);
    slide = blk.blockShift;
  } else {
    front = Math.min(ballD + 16, offsideD - 0.8, 98);
    back = clamp(ballD - 30, 9, Math.max(9, front - 22));
    if (front - back > 46) back = front - 46;
    keeperD = clamp(back - 24, 3, 22);
    widthM = 60;
    slide = clamp((ball.x - CX) * 0.22, -6, 6);
  }
  return side.formation.slots.map((s, i) => {
    if (i === 0) {
      const kx = inPoss ? CX : CX + clamp((ball.x - CX) * 0.12, -2.5, 2.5);
      return { x: kx, y: yAt(T, keeperD) };
    }
    const d = back + side.u[i] * (front - back);
    const x = clamp(CX + slide + (mirror(s.x) - 0.5) * widthM, 2, PITCH_W - 2);
    return { x, y: yAt(T, clamp(d, 1, LEN - 1)) };
  });
}

// ── The plan: what the unseen match says each minute holds ─────────────────

interface Attempt {
  t: number;
  side: Team;
  outcome: "goal" | "saved" | "wide" | "corner" | "cornerOnly";
  text: string;
  minute: number;
  done: boolean;
  /** Where the shot is struck from: an x and a distance from goal. */
  spot: V;
  chance?: Sim90Chance;
}

interface MinutePlan { poss: Team; anchor: V }

/** The unseen match's minutes as the live radar draws them. */
export function radarTicks(m: RadarMatch): Map<number, RadarTick> {
  const out = new Map<number, RadarTick>();
  for (const f of m.frames.slice(1)) {
    const t: RadarTick = { minute: f.minute, possession: f.possession, zone: f.zone, lane: f.lane, momentum: f.momentum };
    for (const e of f.events) {
      if (e.kind === "goal-us" || e.kind === "highlight-goal") { t.goal = "user"; t.shot = "user"; }
      else if (e.kind === "goal-them") { t.goal = "opponent"; t.shot = "opponent"; }
      else if ((e.kind === "chance-us" || e.kind === "highlight-miss") && !t.shot) t.shot = "user";
      else if (e.kind === "chance-them" && !t.shot) t.shot = "opponent";
      else if (e.kind === "corner-us") t.corner = "user";
      else if (e.kind === "corner-them") t.corner = "opponent";
    }
    if (f.highlight) t.yours = true;
    out.set(f.minute, t);
  }
  return out;
}

function runRadar(setup: Sim90Setup): RadarMatch {
  const inputs: HiddenMatchInputs = {
    teamStrength: setup.homeStrength, oppStrength: setup.awayStrength, home: true,
    playerSkill: 70, pace: 70, freeKick: 70, position: "ST", matchFlow: !!setup.matchFlow,
  };
  const m = startRadar(setup.seed, inputs, 90, 100);
  for (let guard = 0; guard < 400 && !radarOver(m); guard++) {
    if (m.pending) resolveHighlight(m, "bench-rate");
    else stepRadar(m);
  }
  return m;
}

function planOf(radar: RadarMatch, rng: () => number): { plans: MinutePlan[]; attempts: Attempt[] } {
  const plans: MinutePlan[] = [];
  const attempts: Attempt[] = [];
  for (let i = 1; i <= 90; i++) {
    const f = radar.frames[i] ?? radar.frames[radar.frames.length - 1];
    const [d0, d1] = ZONE_D[f.zone], [x0, x1] = LANE_X[f.lane];
    const d = d0 + (d1 - d0) * (0.3 + 0.4 * rng());
    plans.push({ poss: f.possession === "user" ? 0 : 1, anchor: { x: x0 + (x1 - x0) * (0.25 + 0.5 * rng()), y: LEN - d } });
    const here: Omit<Attempt, "t" | "done" | "spot" | "minute">[] = [];
    let cornersUs = 0, cornersThem = 0;
    const hl = f.highlight;
    const chanceOf = (result: "goal" | "missed"): Sim90Chance | undefined =>
      hl ? { kinds: [...hl.kinds], dribble: hl.dribble, reason: hl.reason, result } : undefined;
    for (const e of f.events) {
      if (e.kind === "highlight-goal") here.push({ side: 0, outcome: "goal", text: e.text, chance: chanceOf("goal") });
      else if (e.kind === "highlight-miss") here.push({ side: 0, outcome: rng() < 0.5 ? "saved" : "wide", text: e.text, chance: chanceOf("missed") });
      else if (e.kind === "goal-us") here.push({ side: 0, outcome: "goal", text: e.text });
      else if (e.kind === "goal-them") here.push({ side: 1, outcome: "goal", text: e.text });
      else if (e.kind === "chance-us") here.push({ side: 0, outcome: rng() < 0.5 ? "saved" : "wide", text: e.text });
      else if (e.kind === "chance-them") here.push({ side: 1, outcome: rng() < 0.5 ? "saved" : "wide", text: e.text });
      else if (e.kind === "corner-us") cornersUs++;
      else if (e.kind === "corner-them") cornersThem++;
    }
    // A corner goes with a shot of that side when there is one (parried
    // behind); otherwise it comes from a cross knocked behind.
    for (const [side, n] of [[0, cornersUs], [1, cornersThem]] as [Team, number][]) {
      for (let k = 0; k < n; k++) {
        const shot = here.find((a) => a.side === side && a.outcome !== "goal" && a.outcome !== "corner");
        if (shot) shot.outcome = "corner";
        else here.push({ side, outcome: "cornerOnly", text: side === 0 ? "Corner." : "Corner to them." });
      }
    }
    // Goals first: they can never be dropped.
    const rank = (a: { outcome: string; chance?: Sim90Chance }) => (a.outcome === "goal" || a.chance ? 0 : 1);
    here.sort((a, b) => rank(a) - rank(b));
    const kept = here.slice(0, 3).sort(() => rng() - 0.5);
    // Goals must stay; if the shuffle pushed one out of the first three, it was kept above anyway.
    const offs = kept.length === 1 ? [40] : kept.length === 2 ? [18, 48] : [12, 32, 52];
    kept.forEach((a, k) => {
      const lane = f.lane;
      const sx = lane === "left" ? 22 + rng() * 6 : lane === "right" ? 40 + rng() * 6 : 28 + rng() * 12;
      attempts.push({
        ...a, minute: i, done: false,
        t: (i - 1) * 60 + offs[k] + (rng() - 0.5) * 6,
        spot: { x: sx, y: 11 + rng() * 9 },
      });
    });
  }
  return { plans, attempts };
}

// ── The replay ──────────────────────────────────────────────────────────────

interface Flight {
  kind: "pass" | "shot" | "cross" | "out" | "corner-cross" | "clear";
  from: V3; to: V3; t0: number; T: number; peak: number;
  receiver: number;            // -1 for none
  kicker: number;
  side: Team;
  attempt?: Attempt;
}

type Dead =
  | { sub: "goal"; t0: number; restart: Team }
  | { sub: "out"; t0: number; restart: Team }
  | { sub: "corner"; t0: number; restart: Team; flag: V; taker: number };

export function simulate90(setup: Sim90Setup): Sim90 {
  const rng = mulberry32((setup.seed ^ 0x9e3779b1) >>> 0);
  const radar = runRadar(setup);
  const { plans, attempts } = planOf(radar, rng);
  const sides: [Side, Side] = [sideOf(setup.home, setup.homeStrength), sideOf(setup.away, setup.awayStrength)];

  // Who plays: the club's formation filled from a squad (made-up names
  // unless the page passes real ones).
  const names: string[] = [];
  ([0, 1] as Team[]).forEach((T) => {
    const club = T === 0 ? setup.home : setup.away;
    const given = T === 0 ? setup.names?.home : setup.names?.away;
    const squad = generateSquad(clubNameSeed(club));
    const ids = autoPick(squad, sides[T].formation);
    for (let s = 0; s < 11; s++) {
      const p = squad.find((q) => q.id === ids[s]);
      names.push(given?.[s] ?? p?.shortName ?? `${s + 1}`);
    }
  });
  const kits = kitsFor(setup.home, setup.away);
  const gkH = keeperKit(kits.home.shirt, kits.away.shirt);
  const gkA = keeperKit(gkH.shirt, kits.away.shirt);
  const clipKit = (k: Kit) => ({ shirt: k.shirt, shorts: k.trim, socks: k.shirt });
  const bodies: ClipBody[] = names.map((n, i) => {
    const T = teamOf(i), gk = i % 11 === 0;
    return {
      id: `${T === 0 ? "h" : "a"}${i % 11}`,
      role: gk ? "keeper" : T === 0 ? "mate" : "opp",
      side: T === 0 ? "us" : "them",
      name: n,
      kit: clipKit(gk ? (T === 0 ? gkH : gkA) : T === 0 ? kits.home : kits.away),
    };
  });

  const N = FULL_T * SIM_FPS + 1;
  const stride = frameStride(22);
  const data = new Int16Array(N * stride);
  const control = new Uint8Array(N);
  const clipEvents: ClipEvent[] = [];
  const events: Sim90Event[] = [];
  const score: [number, number] = [0, 0];
  const stats = { passes: 0, offsidePasses: 0, snaps: 0 };

  const P: V[] = [], Vel: V[] = [];
  for (let i = 0; i < 22; i++) { P.push({ x: CX, y: HALF_LEN }); Vel.push({ x: 0, y: 0 }); }
  const ball: V3 = { x: CX, y: HALF_LEN, z: 0 };
  let carrier = -1;
  let holdUntil = 0;
  let flight = null as Flight | null;
  let dead = null as Dead | null;
  let receiverLock = -1, receiverAt: V = { x: 0, y: 0 };
  const facing: V[] = P.map((_, i) => ({ x: 0, y: teamOf(i) === 0 ? -1 : 1 }));
  let cornerTargets: V[] | null = null;
  /** The keeper's dive in progress, if any. */
  let diveNow = null as { k: number; x0: number; tx: number; start: number; end: number; dir: number; high: boolean } | null;

  const offsideLineD = (A: Team): number => {
    // In A's depth: the second-last defender of the other side, never inside
    // A's own half, never behind the ball.
    const D: Team = A === 0 ? 1 : 0;
    const ds: number[] = [];
    for (let k = 0; k < 11; k++) ds.push(depthOf(D, P[D * 11 + k].y));
    ds.sort((a, b) => a - b);
    const second = LEN - ds[1];
    return Math.max(second, HALF_LEN, depthOf(A, ball.y));
  };

  const kickoffShape = (K: Team): V[] => {
    const out: V[] = [];
    ([0, 1] as Team[]).forEach((T) => {
      const s = shapeOf(T, sides[T], sides[T === 0 ? 1 : 0], T === K, { x: CX, y: HALF_LEN }, HALF_LEN);
      s.forEach((p) => {
        let d = Math.min(depthOf(T, p.y), HALF_LEN - 1.2);
        let x = p.x;
        if (T !== K) {
          const r = Math.hypot(x - CX, yAt(T, d) - HALF_LEN);
          if (r < 9.6) { d = Math.min(d, HALF_LEN - Math.sqrt(Math.max(0, 9.6 ** 2 - (x - CX) ** 2)) - 0.3); }
        }
        out.push({ x, y: yAt(T, d) });
      });
      if (T === K) {
        // The two up front stand on the ball.
        const fw = Array.from({ length: 11 }, (_, k) => k).slice(1).sort((a, b) => sides[T].u[b] - sides[T].u[a]);
        out[T * 11 + fw[0]] = { x: CX, y: yAt(T, HALF_LEN - 0.4) };
        out[T * 11 + fw[1]] = { x: CX + (T === 0 ? 3 : -3), y: yAt(T, HALF_LEN - 1.5) };
      }
    });
    return out;
  };
  const kickerOf = (K: Team) => {
    const fw = Array.from({ length: 11 }, (_, k) => k).slice(1).sort((a, b) => sides[K].u[b] - sides[K].u[a]);
    return K * 11 + fw[0];
  };
  const kickoff = (K: Team, t: number, cut: boolean) => {
    const shape = kickoffShape(K);
    if (cut) for (let i = 0; i < 22; i++) { P[i] = { ...shape[i] }; Vel[i] = { x: 0, y: 0 }; }
    ball.x = CX; ball.y = HALF_LEN; ball.z = 0;
    flight = null; dead = null; cornerTargets = null; diveNow = null;
    carrier = kickerOf(K);
    if (cut) { P[carrier] = { x: CX, y: HALF_LEN + (K === 0 ? 0.6 : -0.6) }; }
    holdUntil = t + 1.0;
    receiverLock = -1;
    events.push({ t, minute: Math.min(90, Math.floor(t / 60) + 1), kind: t >= HALF_T - 1 && t < HALF_T + 1 ? "half" : "kickoff", side: K, text: t >= HALF_T - 1 && t < HALF_T + 1 ? "Second half under way." : t < 1 ? "Kick-off." : "Back under way." });
  };
  kickoff(0, 0, true);

  const nearestOf = (T: Team, at: V, outfieldOnly = true, skip = -1): number => {
    let best = -1, bd = Infinity;
    for (let k = outfieldOnly ? 1 : 0; k < 11; k++) {
      const i = T * 11 + k;
      if (i === skip) continue;
      const d = dist(P[i], at);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  const startFlight = (f: Flight) => {
    flight = f;
    carrier = -1;
  };

  const kickEvent = (t: number, who: number, kind: ClipEvent["kind"], mode?: string) => {
    clipEvents.push({ t, kind, who: bodies[who].id, mode });
  };

  /** Pass from the carrier. `wanted` is the side that should end up with it. */
  const pass = (t: number, anchor: V, wanted: Team) => {
    const c = carrier;
    const T = teamOf(c);
    const O: Team = T === 0 ? 1 : 0;
    const offD = offsideLineD(T);
    let best = -1, bestS = -Infinity;
    for (let k = 0; k < 11; k++) {
      const j = T * 11 + k;
      if (j === c) continue;
      if (k === 0 && (depthOf(T, ball.y) > 30 || rng() > 0.25)) continue;
      const len = dist(P[c], P[j]);
      if (len < 5 || len > 42) continue;
      const jd = depthOf(T, P[j].y);
      if (jd > offD - 0.3 && jd > depthOf(T, ball.y)) continue;           // offside
      let open = Infinity, lane = Infinity;
      for (let o = 0; o < 11; o++) {
        const q = P[O * 11 + o];
        open = Math.min(open, dist(q, P[j]));
        // Distance from the pass line.
        const ax = P[j].x - ball.x, ay = P[j].y - ball.y;
        const u = clamp(((q.x - ball.x) * ax + (q.y - ball.y) * ay) / (ax * ax + ay * ay), 0, 1);
        if (u > 0.08 && u < 0.92) lane = Math.min(lane, Math.hypot(ball.x + ax * u - q.x, ball.y + ay * u - q.y));
      }
      const progress = dist(P[c], anchor) - dist(P[j], anchor);
      let s = progress * 0.5 + Math.min(open, 9) * 0.7 - Math.abs(len - 16) * 0.12 + rng() * 5;
      if (lane < 1.6) s -= 12;
      if (s > bestS) { bestS = s; best = j; }
    }
    if (best < 0) best = nearestOf(T, ball, true, c);
    // Lead the runner a little, never into an offside position.
    let to: V = { x: P[best].x + Vel[best].x * 0.6, y: P[best].y + Vel[best].y * 0.6 };
    const toD = Math.min(depthOf(T, to.y), Math.max(offD - 0.5, depthOf(T, P[best].y)));
    to = { x: clamp(to.x, 1.5, PITCH_W - 1.5), y: yAt(T, clamp(toD, 1, LEN - 1)) };
    let receiver = best;
    // A pass to the wrong side: the nearest of `wanted` to the line steps in.
    if (wanted !== T) {
      const mid = { x: (ball.x + to.x) / 2, y: (ball.y + to.y) / 2 };
      const cut = nearestOf(wanted, mid);
      receiver = cut;
      to = { x: (P[cut].x * 2 + mid.x) / 3, y: (P[cut].y * 2 + mid.y) / 3 };
    } else {
      stats.passes++;
      const rd = depthOf(T, P[best].y);
      if (rd > offsideLineD(T) + 0.3 && rd > depthOf(T, ball.y) && rd > HALF_LEN) stats.offsidePasses++;
    }
    const len = dist(ball, to);
    const speed = 12 + len * 0.18;
    startFlight({
      kind: "pass", from: { ...ball }, to: { x: to.x, y: to.y, z: 0 }, t0: t, T: Math.max(0.35, len / speed),
      peak: len > 28 ? len * 0.12 : 0, receiver, kicker: c, side: T,
    });
    receiverLock = receiver;
    receiverAt = to;
    kickEvent(t, c, "pass");
  };

  const shoot = (t: number, a: Attempt) => {
    const c = carrier;
    const T = teamOf(c);
    const D: Team = T === 0 ? 1 : 0;
    const gy = goalY(T);
    const keeper = P[D * 11];
    const pastLine = (m: number) => (T === 0 ? -m : LEN + m);
    let to: V3;
    let T_ = 0;
    const fromGoal = Math.hypot(ball.x - CX, ball.y - gy);
    const speed = 22 + rng() * 6;
    if (a.outcome === "goal") {
      const x = rng() < 0.5 ? POST_L + 0.35 + rng() * 1.6 : POST_R - 0.35 - rng() * 1.6;
      to = { x, y: pastLine(1.0), z: 0.25 + rng() * 1.7 };
    } else if (a.outcome === "wide") {
      const left = rng() < 0.5;
      const over = rng() < 0.35;
      to = over ? { x: CX + (rng() - 0.5) * 5, y: pastLine(4), z: 3.2 + rng() } : { x: left ? POST_L - 1 - rng() * 3 : POST_R + 1 + rng() * 3, y: pastLine(4), z: 0.3 + rng() };
    } else if (a.outcome === "cornerOnly") {
      // A ball into the box, knocked behind.
      const nearSide = ball.x < CX ? -1 : 1;
      to = { x: CX + nearSide * (8 + rng() * 6), y: pastLine(1.5), z: 0.4 };
      const len = Math.hypot(to.x - ball.x, to.y - ball.y);
      startFlight({ kind: "cross", from: { ...ball }, to, t0: t, T: len / 18, peak: 2.5, receiver: -1, kicker: c, side: T, attempt: a });
      kickEvent(t, c, "pass");
      a.done = true;
      receiverLock = -1;
      return;
    } else {
      // Saved (and maybe parried behind): into the keeper's hands.
      const off = rng() < 0.3 ? (rng() - 0.5) * 1.0 : (rng() < 0.5 ? -1 : 1) * (1.3 + rng() * 1.7);
      to = { x: clamp(keeper.x + off, POST_L + 0.4, POST_R - 0.4), y: keeper.y, z: 0.3 + rng() * 1.3 };
    }
    T_ = Math.max(0.35, Math.hypot(to.x - ball.x, to.y - ball.y) / speed);
    // The keeper goes for it: a dive toward where it is going, starting just
    // before it gets to him. Beaten by a goal, he gets most of the way.
    {
      const k = D * 11;
      const reach = a.outcome === "goal" ? 0.75 : 1;
      const tx = clamp(P[k].x + (to.x - P[k].x) * reach, POST_L - 0.8, POST_R + 0.8);
      if (Math.abs(to.x - P[k].x) > 0.9 && a.outcome !== "wide") {
        diveNow = { k, x0: P[k].x, tx, start: t + Math.max(0, T_ - 0.45), end: t + T_ + 0.8, dir: Math.sign(to.x - P[k].x), high: to.z > 1.6 };
      }
    }
    startFlight({ kind: "shot", from: { ...ball }, to, t0: t, T: T_, peak: Math.min(1.2, fromGoal * 0.03), receiver: -1, kicker: c, side: T, attempt: a });
    kickEvent(t, c, "shot");
    receiverLock = a.outcome === "saved" || a.outcome === "corner" ? D * 11 : -1;
    receiverAt = { x: to.x, y: to.y };
    a.done = true;
    events.push({ t, minute: a.minute, kind: "shot", side: T, text: `${names[c]} shoots${fromGoal > 22 ? " from range" : ""}${a.chance ? " — your chance" : ""}.`, chance: a.chance });
  };

  const goCorner = (t: number, A: Team, x: number) => {
    const flag: V = { x: x < CX ? 0.4 : PITCH_W - 0.4, y: T0goal(A) };
    const taker = nearestOf(A, flag);
    dead = { sub: "corner", t0: t, restart: A, flag, taker };
    events.push({ t, minute: Math.min(90, Math.floor(t / 60) + 1), kind: "corner", side: A, text: `Corner to ${A === 0 ? short(setup.home) : short(setup.away)}.` });
    cornerTargets = null;
  };
  function T0goal(A: Team) { return A === 0 ? 0.4 : LEN - 0.4; }

  const arrive = (t: number, f: Flight) => {
    flight = null;
    ball.x = f.to.x; ball.y = f.to.y; ball.z = 0;
    const D: Team = f.side === 0 ? 1 : 0;
    if (f.kind === "pass" || f.kind === "clear") {
      carrier = f.receiver;
      holdUntil = t + 1.5 + rng() * 2.8;
      receiverLock = -1;
      return;
    }
    if (f.kind === "shot") {
      const a = f.attempt!;
      receiverLock = -1;
      if (a.outcome === "goal") {
        score[f.side]++;
        dead = { sub: "goal", t0: t, restart: D };
        events.push({ t, minute: a.minute, kind: "goal", side: f.side, text: `GOAL! ${names[f.kicker]} — ${score[0]}-${score[1]}.` });
        kickEvent(t, f.kicker, "goal");
        return;
      }
      if (a.outcome === "wide") {
        dead = { sub: "out", t0: t, restart: D };
        events.push({ t, minute: a.minute, kind: "miss", side: f.side, text: a.text });
        return;
      }
      // Into the keeper's hands, or pushed behind for a corner.
      events.push({ t, minute: a.minute, kind: "save", side: f.side, text: a.text });
      clipEvents.push({ t, kind: "save", who: bodies[D * 11].id, save: a.outcome === "corner" ? "push" : "catch" });
      if (a.outcome === "corner") {
        const side = f.to.x < CX ? -1 : 1;
        const to = { x: CX + side * (5 + rng() * 4), y: f.side === 0 ? -2.5 : LEN + 2.5, z: 0.3 };
        startFlight({ kind: "out", from: { ...ball, z: f.to.z }, to, t0: t, T: 0.5, peak: 0.6, receiver: -1, kicker: D * 11, side: f.side });
        return;
      }
      carrier = D * 11;
      holdUntil = t + 2.5 + rng() * 1.5;
      return;
    }
    if (f.kind === "cross" || f.kind === "out") { goCorner(t, f.side, f.to.x); return; }
    if (f.kind === "corner-cross") {
      // Headed away by the nearest defender.
      const hd = nearestOf(D, ball);
      const wide = ball.x < CX ? -1 : 1;
      const to = { x: clamp(CX + wide * (10 + rng() * 14), 3, PITCH_W - 3), y: yAt(D, 24 + rng() * 14), z: 0 };
      kickEvent(t, hd, "clearance", "header");
      const wanted = wantedAt(t);
      const r = nearestOf(wanted, to);
      startFlight({ kind: "clear", from: { x: ball.x, y: ball.y, z: 2.2 }, to, t0: t, T: 1.3, peak: 6, receiver: r, kicker: hd, side: D });
      receiverLock = r; receiverAt = to;
    }
  };

  const nextAttempt = (t: number) => attempts.find((a) => !a.done && t >= a.t - 20);
  const wantedAt = (t: number): Team => {
    const a = nextAttempt(t);
    if (a) return a.side;
    return plans[Math.min(89, Math.floor(t / 60))].poss;
  };
  const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club;

  // ── Frame by frame ──────────────────────────────────────────────────────
  for (let f = 0; f < N; f++) {
    const t = f * DT;
    if (f === HALF_T * SIM_FPS) kickoff(1, t, true);
    const mi = Math.min(89, Math.floor(t / 60));
    const due = nextAttempt(t);
    const wanted = wantedAt(t);
    const anchor: V = due ? { x: due.spot.x, y: yAt(due.side, LEN - due.spot.y) } : plans[mi].anchor;

    // ── The ball ──
    if (dead) {
      const dd: Dead = dead;
      const age = t - dd.t0;
      if (flight) {
        // The ball finishing its run into the net.
      } else if (dd.sub === "goal") {
        if (age >= 4.5) { ball.x = CX; ball.y = HALF_LEN; ball.z = 0; }
        if (age >= 13) kickoff(dd.restart, t, false);
      } else if (dd.sub === "out") {
        const R = dd.restart;
        const spot = { x: CX + (ball.x < CX ? -5 : 5), y: yAt(R, 5.5) };
        if (age >= 2.5) { ball.x = spot.x; ball.y = spot.y; ball.z = 0; }
        if (age >= 7) { dead = null; carrier = R * 11; holdUntil = t + 0.6; P[carrier] = { ...spot }; }
      } else if (dd.sub === "corner") {
        if (age >= 2.5) { ball.x = dd.flag.x; ball.y = dd.flag.y; ball.z = 0; }
        if (age >= 11) {
          // Swung in to an attacker in the box.
          const A = dd.restart;
          const D: Team = A === 0 ? 1 : 0;
          let r = -1, rd = Infinity;
          for (let k = 1; k < 11; k++) {
            const i = A * 11 + k;
            if (i === dd.taker) continue;
            const g = depthOf(D, P[i].y);
            if (g < 14 && Math.abs(P[i].x - CX) < 12 && g < rd) { rd = g; r = i; }
          }
          const to: V3 = r >= 0 ? { x: P[r].x, y: P[r].y, z: 2.2 } : { x: CX, y: yAt(D, 8), z: 2.2 };
          dead = null;
          kickEvent(t, dd.taker, "pass", "curl");
          startFlight({ kind: "corner-cross", from: { ...ball }, to, t0: t, T: 1.5, peak: 5, receiver: -1, kicker: dd.taker, side: A });
          receiverLock = r; receiverAt = { x: to.x, y: to.y };
          cornerTargets = null;
        }
      }
    }
    if (flight) {
      const fl: Flight = flight;
      const u = (t - fl.t0) / fl.T;
      if (u >= 1) arrive(t, fl);
      else {
        const s = fl.kind === "pass" ? u * (1.35 - 0.35 * u) : u;
        ball.x = fl.from.x + (fl.to.x - fl.from.x) * s;
        ball.y = fl.from.y + (fl.to.y - fl.from.y) * s;
        ball.z = Math.max(0, fl.from.z + (fl.to.z - fl.from.z) * u + 4 * fl.peak * u * (1 - u));
      }
    } else if (!dead && carrier >= 0) {
      const T = teamOf(carrier);
      // A shot that is due, for the side on the ball.
      const shotNow = due && due.side === T && t >= due.t;
      if (shotNow && (Math.hypot(ball.x - CX, ball.y - goalY(T)) <= 30 || t >= due.t + 6 || due.outcome === "cornerOnly")) {
        shoot(t, due);
      } else if (T !== wanted) {
        // Pressed: the nearest of the other side wins it on reaching him.
        const pr = nearestOf(wanted, ball);
        if (dist(P[pr], ball) < 1.3) { carrier = pr; holdUntil = t + 0.7 + rng() * 0.8; }
        else if (t >= holdUntil) pass(t, anchor, wanted);
        else if (due && t >= due.t + 10) {
          // Badly late: the shooter takes it (counted — should be rare).
          carrier = nearestOf(due.side, ball); stats.snaps++; holdUntil = t;
        }
      } else if (t >= holdUntil) {
        pass(t, anchor, wanted);
        if (shotNow) holdUntil = t;  // keep it moving toward the shot
      }
    } else if (!dead && !flight && carrier < 0) {
      carrier = nearestOf(wanted, ball, false);
      holdUntil = t + 0.5;
    }

    // ── The men ──
    const inPossTeam: Team = dead ? dead.restart : flight ? (flight as Flight).side : carrier >= 0 ? teamOf(carrier) : wanted;
    const focus: V = { x: ball.x, y: ball.y };
    let targets: V[];
    if (dead && (dead.sub === "goal")) targets = kickoffShape(dead.restart);
    else if (dead && dead.sub === "corner") {
      if (!cornerTargets) cornerTargets = cornerShape(dead.restart, dead.taker, dead.flag);
      targets = cornerTargets;
    } else {
      const O: Team = inPossTeam === 0 ? 1 : 0;
      const defShape = shapeOf(O, sides[O], sides[inPossTeam], false, focus, HALF_LEN);
      const attShape = shapeOf(inPossTeam, sides[inPossTeam], sides[O], true, focus, offsideLineD(inPossTeam));
      targets = inPossTeam === 0 ? [...attShape, ...defShape] : [...defShape, ...attShape];
      if (!dead) {
        // The nearest defender presses the ball, from the goal side.
        const pr = nearestOf(O, focus);
        const og = goalY(inPossTeam === 0 ? 1 : 0) === 0 ? LEN : 0; // O's own goal y
        const dir = Math.sign(og - focus.y) || 1;
        targets[pr] = { x: focus.x, y: focus.y + dir * 1.1 };
        if (carrier >= 0 && !flight) {
          // The man on the ball carries it toward where the play is going.
          const c = carrier;
          const dx = anchor.x - P[c].x, dy = anchor.y - P[c].y, dl = Math.hypot(dx, dy) || 1;
          const step = Math.min(dl, 3.2);
          targets[c] = { x: P[c].x + (dx / dl) * step, y: P[c].y + (dy / dl) * step };
        }
      }
      if (dead && dead.sub === "out") targets[dead.restart * 11] = { x: ball.x, y: ball.y };
    }
    if (receiverLock >= 0 && flight) targets[receiverLock] = receiverAt;
    if (dead && dead.sub === "corner") targets[dead.taker] = dead.flag;

    for (let i = 0; i < 22; i++) {
      const tg = targets[i];
      const dx = tg.x - P[i].x, dy = tg.y - P[i].y, d = Math.hypot(dx, dy);
      const keeper = i % 11 === 0;
      const urgent = i === receiverLock || (i === carrier) || d > 12;
      const vmax = keeper ? 5 : urgent ? 7.6 : 5.6;
      const sp = Math.min(vmax, d * 1.4);
      const wx = d > 1e-6 ? (dx / d) * sp : 0, wy = d > 1e-6 ? (dy / d) * sp : 0;
      let ax = wx - Vel[i].x, ay = wy - Vel[i].y;
      const al = Math.hypot(ax, ay), amax = 6 * DT;
      if (al > amax) { ax *= amax / al; ay *= amax / al; }
      Vel[i].x += ax; Vel[i].y += ay;
      if (i === carrier) { const sl = Math.hypot(Vel[i].x, Vel[i].y); if (sl > 4.2) { Vel[i].x *= 4.2 / sl; Vel[i].y *= 4.2 / sl; } }
      P[i].x += Vel[i].x * DT; P[i].y += Vel[i].y * DT;
    }
    // Nobody stood on a team-mate.
    for (let i = 0; i < 22; i++) {
      for (let j = i + 1; j < 22; j++) {
        if (teamOf(i) !== teamOf(j)) continue;
        const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y, d = Math.hypot(dx, dy);
        if (d < 2.2) {
          const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
          const push = (2.2 - d) * 0.3;
          const wi = i === carrier ? 0.1 : 1, wj = j === carrier ? 0.1 : 1;
          P[i].x -= nx * push * wi; P[i].y -= ny * push * wi;
          P[j].x += nx * push * wj; P[j].y += ny * push * wj;
        }
      }
    }
    for (let i = 0; i < 22; i++) { P[i].x = clamp(P[i].x, 0.6, PITCH_W - 0.6); P[i].y = clamp(P[i].y, 0.4, LEN - 0.4); }

    // The dive: he is thrown across toward the ball, and stays down a moment.
    let keeperState: FrameState["keeper"] = { dive: 0, lunge: 0, dir: 0, kind: null };
    if (diveNow && t >= diveNow.end) diveNow = null;
    if (diveNow && t >= diveNow.start) {
      const dn = diveNow;
      const lunge = clamp((t - dn.start) / 0.35, 0, 1);
      const ease = 1 - (1 - lunge) * (1 - lunge);
      P[dn.k].x = dn.x0 + (dn.tx - dn.x0) * ease;
      Vel[dn.k].x = 0; Vel[dn.k].y = 0;
      keeperState = { dive: (dn.tx - dn.x0) * ease, lunge: Math.max(0.05, lunge), dir: dn.dir, kind: dn.high ? "high" : "low" };
    }

    // The ball at the carrier's feet.
    if (!flight && !dead && carrier >= 0) {
      const v = Vel[carrier], sp = Math.hypot(v.x, v.y);
      if (sp > 0.4) facing[carrier] = { x: v.x / sp, y: v.y / sp };
      ball.x = clamp(P[carrier].x + facing[carrier].x * 0.55, 0.2, PITCH_W - 0.2);
      ball.y = clamp(P[carrier].y + facing[carrier].y * 0.55, 0.2, LEN - 0.2);
      ball.z = 0;
    }

    control[f] = dead ? 0 : flight ? ((flight as Flight).kind === "pass" || (flight as Flight).kind === "clear" ? ((flight as Flight).receiver >= 0 ? teamOf((flight as Flight).receiver) + 1 : 0) : (flight as Flight).side + 1) : carrier >= 0 ? teamOf(carrier) + 1 : 0;

    // Second half: the teams have swapped ends — the same staging, turned round.
    const swap = t >= HALF_T;
    const fs: FrameState = swap ? {
      ball: { x: PITCH_W - ball.x, y: LEN - ball.y, z: ball.z },
      bodies: P.map((p) => ({ x: PITCH_W - p.x, y: LEN - p.y, z: 0 })),
      keeper: { ...keeperState, dive: -keeperState.dive, dir: -keeperState.dir },
    } : {
      ball: { ...ball },
      bodies: P.map((p) => ({ x: p.x, y: p.y, z: 0 })),
      keeper: keeperState,
    };
    packFrame(fs, data, f * stride);
  }
  events.push({ t: FULL_T, minute: 90, kind: "full", side: -1, text: `Full time: ${short(setup.home)} ${score[0]}-${score[1]} ${short(setup.away)}.` });

  function cornerShape(A: Team, taker: number, flag: V): V[] {
    const D: Team = A === 0 ? 1 : 0;
    const out: V[] = P.map((p) => ({ ...p }));
    const g = (d: number) => yAt(D, d);   // d metres out from the defended goal
    // Attackers: the five furthest forward into the box, two on the edge.
    const att = Array.from({ length: 11 }, (_, k) => k).slice(1).map((k) => A * 11 + k).filter((i) => i !== taker)
      .sort((a, b) => depthOf(A, P[b].y) - depthOf(A, P[a].y));
    const aSpots: V[] = [
      { x: CX - 3, y: g(6) }, { x: CX + 3, y: g(7) }, { x: CX - 7, y: g(10) }, { x: CX + 7, y: g(11) },
      { x: CX, y: g(12.5) }, { x: CX - 10, y: g(19) }, { x: CX + 10, y: g(19) },
    ];
    att.forEach((i, k) => { out[i] = k < aSpots.length ? aSpots[k] : { x: CX + (k % 2 ? 12 : -12), y: g(48 + k) }; });
    // Defenders: keeper on his line, six in the box, the rest on the edge, one up.
    out[D * 11] = { x: CX + (flag.x < CX ? -1 : 1), y: g(0.8) };
    const def = Array.from({ length: 11 }, (_, k) => k).slice(1).map((k) => D * 11 + k).sort((a, b) => sides[D].u[a] - sides[D].u[b]);
    const dSpots: V[] = [
      { x: CX - 2.5, y: g(3.5) }, { x: CX + 2.5, y: g(3.5) }, { x: CX - 6, y: g(5.5) }, { x: CX + 6, y: g(5.5) },
      { x: CX - 2, y: g(8.5) }, { x: CX + 2, y: g(9) }, { x: CX - 9, y: g(13) }, { x: CX + 9, y: g(13) },
      { x: CX, y: g(17.5) }, { x: CX, y: g(40) },
    ];
    def.forEach((i, k) => { out[i] = dSpots[k]; });
    out[taker] = flag;
    return out;
  }

  const track: GoalTrack = {
    v: TRACK_VERSION,
    meta: {
      id: `sim90-${setup.seed}`, createdAt: "", minute: 0, minuteLabel: "0", scorer: "", scorerShort: "",
      isYou: false, home: setup.home, away: setup.away, youAreHome: true, scoreAfter: [score[0], score[1]],
    },
    fps: SIM_FPS, bodies, data, n: N, goalT: -100, strikeT: 0, firstKickT: 0,
    events: clipEvents,
  };
  events.sort((a, b) => a.t - b.t);
  return { setup, track, radar, ticks: radarTicks(radar), events, control, score, names, stats };
}

/** Replay seconds → the match clock, "37:12". */
export function clockOf(t: number): string {
  const s = Math.max(0, Math.min(FULL_T, Math.floor(t)));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
