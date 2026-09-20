import type { Scenario, ScenarioKind, Defender } from "./canvasEngine";
import { goalInView } from "./canvasEngine";
import { CX, PITCH_W, POST_L, POST_R } from "./pitch";
import { formationForClub } from "./clubFormation";
import type { Formation } from "./formations";
import { playstyleForClub, type PlaystyleProfile } from "./playstyle";

/**
 * THE POSITIONAL LAYER — formation × playstyle × strength gap, ABOVE the engine.
 *
 * The scenario builders (canvasEngine.ts, which this file never touches) decide
 * WHO and HOW MANY defend and roughly where; `castDefence` (lineup.ts) decides
 * WHOSE FACE each defender wears. Neither ever changed WHERE the block stands by
 * formation — so every side, from a possession-hungry front-runner to a side
 * parking the bus, defended with the same shape. This layer, called once in
 * `loadScenario` between `buildScenario`/`castScenario` and `initDefenders`,
 * repositions `sc.defenders` and `sc.keeper` into a real defensive block driven
 * by (a) the opponent's FORMATION, (b) their PLAYSTYLE, and (c) the STRENGTH GAP
 * between the two sides.
 *
 * It writes only public fields (defenders' x/y, keeper x/startX/y) and clamps
 * everything back inside the scenario's own frame, exactly the discipline the
 * five-a-side layer follows. It NEVER adds or removes a defender — the body
 * count per chance is carefully tuned in COVER_RANGE, and changing it would be a
 * silent difficulty change. It only moves the men that are already there.
 *
 * ── What the numbers come from (measured, not guessed) ──
 *
 * StatsBomb-360 open-data tables (scratchpad/research-SB360-measured.md,
 * 653,890 freeze frames):
 *  - Table 1: the back line sits at ≈ 0.66 × the ball's distance from goal (the
 *    single deepest man ≈ 0.6 ×, the highest of the four ≈ 0.7 ×). This is the
 *    baseline `lineY` below — the direct fix for "defenders stand next to their
 *    keeper while you're 30 m out."
 *  - Table 2a/2b: a back four spans ~20 m at 25 m out (adjacent gaps ~6-7 m),
 *    stretching wider the further out the ball is — the `span` below.
 *  - Table C / 2b: the block slides ~40 % of the ball's own lateral offset
 *    toward the ball's side (never a full mirror) — `blockShift` below.
 *  - Q6: a back-three system sits its line ~2 m deeper than a back four, and is
 *    wider across — `formOffset` and the back-5 `span` multiplier below.
 *  - Table 5: the keeper sits ~1.7-3.9 m off his line for a 20-30 m ball, higher
 *    with a high line, shading ~1-2.5 m toward the ball — `keeperDepth` below.
 *
 * Playstyle biases (playstyle.ts) and the strength-gap slide are applied on top,
 * per the research's core finding that a side's line height is a function of its
 * identity AND who it is playing, not a fixed constant.
 */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The situations a defensive BLOCK shape is the thing you're looking at, and
 * where repositioning the line is both meaningful and safe.
 *
 *  - long_range / tight_angle: a shot from distance with a block between you and
 *    goal — the exact "the line should stand where a real line stands" case, and
 *    where the measured tables have the most to say.
 *
 * Deliberately NOT touched, and why:
 *  - one_on_one / volley / header: close-range finishing moments whose defender
 *    counts and positions are individually tuned against measured conversion
 *    bounds; a formation line contradicts what these chances ARE.
 *  - cutback / byline_cross / corner: bespoke box crowds and a rotated frame
 *    with their own keeper-shade logic — repositioning here is the high-risk
 *    "mark the box" work the research flags as a separate job.
 *  - through_ball: its offside line IS the situation; moving defenders would
 *    rewrite the chance.
 *  - penalty / free_kick: dead balls, fixed by the laws.
 *  - midfield_pass / buildup: no goal in the frame to defend.
 */
/**
 * Every situation where a real defence is on screen defending its own goal.
 *
 * Was long_range + tight_angle only — deliberately conservative while the layer
 * was new. Two real in-game screenshots settled it: "the defending team is far
 * too open and would never leave a gap like that in the box" and "they have 6
 * defenders and non in formation". Both were BOX situations, i.e. the 11 kinds
 * this set used to exclude, which still got the engine's old ad-hoc placement
 * with no formation shaping at all.
 *
 * Still excluded, on purpose: penalty / free_kick / corner (dead balls with
 * their own bespoke wall-and-box setups), and midfield_pass / buildup (no goal
 * in frame, so there is no defensive block to shape).
 */
const APPLY_KINDS = new Set<ScenarioKind>([
  "long_range", "tight_angle", "one_on_one", "cutback",
  "volley", "header", "byline_cross", "through_ball",
]);

export interface DefensiveLine {
  /** How many men make the defensive back line when this side defends. */
  count: number;
  /** A back-five (or a back-three system, whose wing-backs drop to make five). */
  isBack5: boolean;
}

/**
 * How many defenders a formation puts in its defensive back line.
 *
 * A back-three system (three centre-backs — 3-5-2, 3-4-2-1, …) defends as a
 * back FIVE, its wing-backs dropping in: this is stated across the coaching
 * literature and confirmed in the SB360 data, where three-at-the-back sides are
 * never re-labelled but visibly sit five men across when defending deep. So a
 * count of three centre-backs resolves to a five-man defensive line; a back four
 * (two centre-backs plus two full-backs) to four.
 */
export function defensiveLineOf(formation: Formation): DefensiveLine {
  let nCB = 0, nFB = 0;
  for (const s of formation.slots) {
    if (s.role === "CB") nCB++;
    else if (s.role === "LB" || s.role === "RB") nFB++;
  }
  const count = nCB === 3 ? 5 : nCB + nFB;
  return { count: count || 4, isBack5: count >= 5 };
}

export interface ShapeInput {
  /** The DEFENDING (opponent) side's formation. */
  formation: Formation;
  /** The DEFENDING side's playstyle. */
  playstyle: PlaystyleProfile;
  /** Your team's strength (0-100). */
  attackerStrength: number;
  /** The opponent's strength (0-100). */
  defenderStrength: number;
}

/** Resolve everything the layer needs from an opponent club name and the two
 *  team strengths — used by CanvasMatch (the layer) and by the scout report. */
export function formationShapeInput(
  opponentClub: string,
  attackerStrength: number,
  defenderStrength: number,
): ShapeInput {
  return {
    formation: formationForClub(opponentClub),
    playstyle: playstyleForClub(opponentClub),
    attackerStrength,
    defenderStrength,
  };
}

export interface BlockTarget {
  /** Mean depth (metres from the defending goal line) of the back line. */
  lineY: number;
  /** Where the keeper sets up off his line. */
  keeperY: number;
  /** Total width the back line is spread across. */
  span: number;
  /** Metres the whole block is slid toward the ball's side (signed). */
  blockShift: number;
  isBack5: boolean;
}

/**
 * The measured target block for a ball position — pure, so it can be tested and
 * read by the scout report without touching a scenario.
 */
export function targetBlock(input: ShapeInput, ballX: number, ballY: number): BlockTarget {
  const { formation, playstyle, attackerStrength, defenderStrength } = input;
  const line = defensiveLineOf(formation);
  const ballDist = clamp(ballY, 8, 45);
  const ballLat = ballX - CX;

  // Strength gap slides the WHOLE block. A weaker side vs a stronger opponent
  // drops deeper (a smaller y); a stronger side pushes up. ~0.2 m per point of
  // gap, capped at ±30 points → ±6 m, which sits inside the measured spread.
  const strengthSlide = -clamp(attackerStrength - defenderStrength, -30, 30) * 0.2;
  const formOffset = line.isBack5 ? -2 : 0; // SB360 Q6: back three ~2 m deeper
  const shift = clamp(playstyle.lineBias + formOffset + strengthSlide, -12, 10);

  // Floor the line at a RATIO of the ball's distance, not a flat metre value:
  // SB360 Table 1 puts even the deepest 25% of real defensive lines at ~0.55 ×
  // the ball's distance from goal. A flat 4.5 m floor let playstyle + back-five +
  // a big strength gap stack down to ~5-9 m for a 20-30 m ball — the exact
  // "defenders next to their own keeper" collapse this layer exists to prevent,
  // and it hit precisely the weak, deep sides a strong player faces most. Tying
  // the floor to ballDist caps how shallow the block can get at every distance
  // while still letting a low block / weaker side sit meaningfully deeper than a
  // high line. (Fable design review, 20 Sep 2026.)
  const lineFloor = Math.max(4.5, ballDist * 0.55);
  let lineY = clamp(ballDist * 0.66 + shift, lineFloor, ballDist - 2.2);
  const kSweep = clamp(lineY - 8, 0, 16) * 0.09 * (0.4 + playstyle.keeperSweep);
  const keeperY = clamp(1.6 + kSweep, 1.2, 6.5);
  lineY = clamp(Math.max(lineY, keeperY + 3), keeperY + 3, Math.max(keeperY + 3, ballDist - 2.2));

  // Back-four spans ~20 m at 25 m out, wider the further the ball is (Table 2a).
  // A back five (extra man, wing-backs holding width) is measurably wider.
  const spanBase = clamp(16 + ballDist * 0.22, 16, 25);
  const span = spanBase * (line.isBack5 ? 1.28 : 1.0);
  const blockShift = clamp(ballLat * 0.40, -8, 8);

  return { lineY, keeperY, span, blockShift, isBack5: line.isBack5 };
}

// ── The scout report's plain-English tactical read ──

export interface ScoutTactics {
  /** How the formation reads, e.g. "3-5-2". */
  formationName: string;
  /** The defensive back line when they defend: "back four" or "back five". */
  backLine: "back four" | "back five";
  playstyleName: string;
  /** The playstyle's one-line "how they defend" blurb. */
  blurb: string;
  /** Where their line sits, once playstyle AND the strength gap are folded in. */
  lineHeight: "very high" | "high" | "medium" | "deep" | "very deep";
  /** Who's favourite by strength — frames the whole report. */
  favourite: "you" | "even" | "them";
  /** They spring a counter — hold runners back after you attack. */
  counters: boolean;
  /** One plain-English sentence: how they'll set up, framed by who's favourite. */
  summary: string;
}

/**
 * How the opponent will line up, in words — the tactical half of the pre-match
 * scout report. Reads their formation and playstyle (both deterministic per
 * club) plus the strength gap to your side, exactly the three inputs the block
 * layer itself uses, so the report matches what you'll actually face.
 */
export function scoutTacticsFor(
  opponentClub: string,
  attackerStrength: number,
  defenderStrength: number,
): ScoutTactics {
  const formation = formationForClub(opponentClub);
  const line = defensiveLineOf(formation);
  const playstyle = playstyleForClub(opponentClub);

  const strengthSlide = -clamp(attackerStrength - defenderStrength, -30, 30) * 0.2;
  const heightScore = playstyle.lineBias + strengthSlide;
  const lineHeight: ScoutTactics["lineHeight"] =
    heightScore >= 5 ? "very high"
    : heightScore >= 2 ? "high"
    : heightScore >= -2 ? "medium"
    : heightScore >= -6 ? "deep"
    : "very deep";

  const gap = attackerStrength - defenderStrength;
  const favourite: ScoutTactics["favourite"] = gap >= 8 ? "you" : gap <= -8 ? "them" : "even";
  const backLine: ScoutTactics["backLine"] = line.isBack5 ? "back five" : "back four";

  const frame =
    favourite === "you"
      ? "You're the favourites, so expect them to sit deeper and more compact than usual."
      : favourite === "them"
      ? "They're the stronger side, so expect them to push their line up and come at you."
      : "An even contest — expect them to hold their shape and pick their moments.";

  const summary =
    `${opponentClub} line up ${formation.name} (a ${backLine}), ${playstyle.name.toLowerCase()}: `
    + `${playstyle.blurb}. ${frame}`
    + (playstyle.counters ? " Watch the counter — keep men back when you commit forward." : "");

  return {
    formationName: formation.name,
    backLine,
    playstyleName: playstyle.name,
    blurb: playstyle.blurb,
    lineHeight,
    favourite,
    counters: playstyle.counters,
    summary,
  };
}

/**
 * Reposition the scenario's defenders and keeper into the formation's block.
 *
 * A strict NO-OP when `input` is absent (so an ordinary sandbox/test scenario is
 * byte-identical), and when the scenario kind isn't one a block shape applies to.
 */
export function applyFormationShape(sc: Scenario, input: ShapeInput | null | undefined): void {
  if (!input) return;
  if (!APPLY_KINDS.has(sc.kind)) return;
  const n = sc.defenders.length;
  if (n === 0) {
    positionKeeper(sc, input);
    return;
  }

  const line = defensiveLineOf(input.formation);
  const t = targetBlock(input, sc.ball.x, sc.ball.y);
  const ballDist = clamp(sc.ball.y, 8, 45);

  // How many of the men present make the back line, and how many screen ahead of
  // it. Never invents a body — a scenario with fewer defenders than the
  // formation's back line simply spreads those it has across the (formation's)
  // width, which is why a back five still reads wider than a back four even when
  // only three men are on screen.
  const backN = Math.min(n, line.count);
  const half = t.span / 2;

  for (let i = 0; i < n; i++) {
    const d = sc.defenders[i];
    if (i < backN) {
      const frac = backN <= 1 ? 0.5 : i / (backN - 1); // 0..1 across the line
      // A gentle stagger so the line isn't robotically flat: the wider men sit a
      // touch deeper, the central men a touch higher (Table 1's ~3 m spread).
      const fromCentre = Math.abs(frac - 0.5) * 2; // 0 centre .. 1 wide
      d.x = CX + t.blockShift + (frac - 0.5) * t.span;
      d.y = t.lineY - 1.2 + fromCentre * 2.4;
    } else {
      // A screening man ahead of the back line, toward the ball/midfield.
      const j = i - backN;
      const screenN = n - backN;
      const frac = screenN <= 1 ? 0.5 : j / (screenN - 1);
      d.x = CX + t.blockShift * 0.6 + (frac - 0.5) * (t.span * 0.55);
      d.y = t.lineY + Math.min(input.playstyle.compactness * 0.4, 10);
    }
  }

  positionKeeper(sc, input, t);
  enforce(sc, ballDist);
  coverCentre(sc, ballDist);
  // LAST, always: the line has just finished moving, so anyone it has left
  // beyond it is offside. See enforceOnside.
  enforceOnside(sc);
}

function positionKeeper(sc: Scenario, input: ShapeInput, t?: BlockTarget): void {
  const target = t ?? targetBlock(input, sc.ball.x, sc.ball.y);
  const ballLat = sc.ball.x - CX;
  // Shade toward the ball's side, but stay fundamentally central (Table 5).
  const kx = clamp(CX + clamp(ballLat * 0.28, -2.6, 2.6), POST_L - 1.5, POST_R + 1.5);
  sc.keeper.x = kx;
  sc.keeper.startX = kx;
  sc.keeper.y = target.keeperY;
}

/**
 * Restate the engine's own private placement rules in this file and enforce them
 * — the same thing the five-a-side layer does. Never behind the keeper, never on
 * top of the ball or the shooter, at least ~3 m apart, and inside the frame.
 */
/**
 * A defending side never leaves the middle of its own box empty.
 *
 * Reported from a real screenshot: "the defending team is far too open and
 * would never leave a gap like that in the box." With the ball in or near the
 * box, at least one defender has to be in the central channel in front of goal
 * — no real side leaves the space in front of its own keeper unoccupied.
 */
function coverCentre(sc: Scenario, ballDist: number): void {
  if (ballDist > 24 || sc.defenders.length === 0) return;
  const CENTRE_HALF = 6.5;
  if (sc.defenders.some(d => Math.abs(d.x - CX) <= CENTRE_HALF)) return;
  // Nobody home: pull the nearest man into the channel rather than inventing a
  // body (the engine owns how many defenders there are).
  let best = sc.defenders[0];
  for (const d of sc.defenders) {
    if (Math.abs(d.x - CX) < Math.abs(best.x - CX)) best = d;
  }
  best.x = CX + (best.x >= CX ? 1 : -1) * CENTRE_HALF * 0.55;
}

/**
 * Nobody attacking is left standing offside once the line has finished moving.
 *
 * Reported from a real screenshot: "my attackers are ALL offside." Attackers
 * are placed by the scenario builder BEFORE this layer repositions the
 * defensive line, so pushing a line up (a high press, or a stronger side) can
 * leave every one of them beyond it — a chance that can never legally be
 * played. Same rule the engine judges by: the second-last opponent, keeper
 * included. Runs last, after every defender move above.
 */
function enforceOnside(sc: Scenario): void {
  if (!goalInView(sc.kind) || sc.kind === "corner") return;
  const ys = sc.defenders.map(d => d.y);
  ys.push(sc.keeper.y);
  if (ys.length < 2) return;
  ys.sort((a, b) => a - b);
  const line = ys[1];
  const onside = (p: { y: number }) => { if (p.y < line + 0.3) p.y = line + 0.3; };
  if (sc.runner) onside(sc.runner.pos);
  for (const r of sc.secondaryRunners) onside(r.pos);
  onside(sc.follower);
}

function enforce(sc: Scenario, ballDist: number): void {
  const vp = sc.viewport;
  const inset = 1.4;
  const xLo = vp ? vp.x1 + inset : 8;
  const xHi = vp ? vp.x2 - inset : PITCH_W - 8;
  const yLo = sc.keeper.y + 2.2;          // never behind (goal-side of) the keeper
  const yHi = Math.max(yLo, ballDist - 1.3); // always goal-side of the ball

  for (const d of sc.defenders) {
    d.x = clamp(d.x, xLo, xHi);
    d.y = clamp(d.y, yLo, yHi);
    // Not on top of the ball, and not on top of you.
    if (Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 2.2) d.y = clamp(d.y - 2.2, yLo, yHi);
    if (Math.hypot(d.x - sc.player.x, d.y - sc.player.y) < 4) {
      d.x = clamp(d.x + (d.x >= sc.player.x ? 4 : -4), xLo, xHi);
    }
  }

  // Spread any pair that ended up on top of each other (a few passes settle it).
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (let a = 0; a < sc.defenders.length; a++) {
      for (let b = a + 1; b < sc.defenders.length; b++) {
        const da = sc.defenders[a], db = sc.defenders[b];
        const dx = db.x - da.x, dy = db.y - da.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= 3 || dist === 0) continue;
        const push = (3 - dist) / 2 + 0.05;
        const ux = dx / (dist || 1), uy = dy / (dist || 1);
        da.x = clamp(da.x - ux * push, xLo, xHi);
        db.x = clamp(db.x + ux * push, xLo, xHi);
        da.y = clamp(da.y - uy * push, yLo, yHi);
        db.y = clamp(db.y + uy * push, yLo, yHi);
        moved = true;
      }
    }
    if (!moved) break;
  }
}
