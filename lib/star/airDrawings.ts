/**
 * HEADERS AND VOLLEYS FROM THE TEAM'S OWN CROSS DRAWINGS (B10, Harry via
 * Mikey, 20 Oct 2026: "headers AND volleys back on, with the ball-in-the-air
 * + shadow signal and build-ups lofting it to your head").
 *
 * The rule (CLAUDE.md, "Scenario rules come from the drawings"): a chance kind
 * is its drawings plus the rules scanned off them; nothing hand-written places
 * people. On 20 Oct 2026 there were NO header or volley drawings anywhere:
 * 0 of the 194 committed (lib/star/authoredScenarios.json) and 0 of the 192
 * the team has saved (star_scenarios). They were switched off on 24 Sep, so
 * the gallery never offered them to draw.
 *
 * So nobody is placed by hand here either. A header IS the end of a cross: the
 * team has drawn 5 byline crosses and 9 corners, and in each one they marked
 * the man the ball is meant for (the labels TARGET and POACH, the poacher).
 * A header chance is one of those drawings at the moment the ball arrives:
 *
 *   - everyone stands exactly where the team drew them (defenders, keeper,
 *     the other team-mates);
 *   - the drawn TARGET or POACH is YOU;
 *   - the drawn crosser (the drawing's "you", on the ball out wide) is the
 *     team-mate who crossed it;
 *   - the ball is where it meets you: 1 m from you on its way in from the
 *     crosser (1 m is the builder's own header and volley stance,
 *     canvasEngine buildHeader / buildVolley). Goal-side put it on the
 *     drawn marker, who stands there: measured, 3 header pictures pass the
 *     checks below that way against 6 this way.
 *
 * Which one it is follows the engine's own definitions (baseScenario.ts's
 * identity check): the ball within 8 m of goal is a header; 8.5-18 m out is a
 * volley (a cross or a lofted cut-back dropping to the man at the edge of the
 * box: the team's cut-back drawings mark that man TARGET too).
 *
 * Left out, because the picture would show one of Harry's three named faults
 * ("overlapping bodies, stranded players, a man behind the keeper"):
 *   - a drawing with a defender standing behind his own keeper (6 of the 9
 *     corners have a man on the post; fine for a corner, read as "a man behind
 *     the keeper" once the picture is a header);
 *   - a candidate whose ball would sit on a drawn body (within BALL_CLEAR_M);
 *   - a candidate that leaves another drawn attacker offside of the new ball;
 *   - a candidate with the keeper not between the ball and the goal.
 *
 * As soon as the team saves FIVE real drawings of a kind (header or volley),
 * those are served instead and nothing here is read (playPool in
 * authoredChance.ts). Delete AIR_FROM's entries to switch this off.
 *
 * Pure: no React, no canvas. tests/star/airDrawings.mts measures it.
 */
import type { MatchScenario, ScenarioPlayer } from "./scenarios";
import { CX } from "./pitch";

/** Which drawn kinds each air kind is taken from. */
export const AIR_FROM: Readonly<Record<string, readonly string[]>> = {
  header: ["byline_cross", "corner"],
  volley: ["byline_cross", "corner", "cutback"],
};

/** The kinds served this way while they have fewer than 5 drawings of their own. */
export const isAirKind = (k: string): boolean => k === "header" || k === "volley";

/** The drawn men a delivery is meant for, by the team's own labels. */
const RECEIVER_LABELS = new Set(["TARGET", "POACH"]);

/** The ball meets you this far from where you stand, towards the crosser (m):
 *  the builder's own stance for a header and a volley (buildHeader / buildVolley: player = ball + 1.0 m). */
export const AIR_STANCE_M = 1.0;

/** How deep the ball may be for each kind (m from the goal line): baseScenario's identity check. */
export const AIR_DEPTH: Readonly<Record<string, [number, number]>> = {
  header: [2.5, 8],
  volley: [8.5, 18],
};
/** How wide of the middle the ball may be (m). A header from wider than the
 *  six-yard box's edge is a flick on, not a chance at goal. */
export const AIR_LATERAL: Readonly<Record<string, number>> = { header: 10, volley: 15 };

/** Nobody drawn stands on the ball (m). */
export const BALL_CLEAR_M = 1.0;
/** Two drawn men closer than this are the same man drawn twice (m): corner 8107 has two defenders 0.1 m apart. */
export const SAME_SPOT_M = 0.3;

const hyp = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Every header (or volley) picture the team's cross drawings hold, as
 * ready-to-serve drawings. `source(kind)` is the drawn pool for a kind
 * (authoredPool), passed in so this file has no store of its own.
 */
export function derivedAirDrawings(kind: string, source: (kind: string) => MatchScenario[]): MatchScenario[] {
  const from = AIR_FROM[kind];
  if (!from) return [];
  const [dMin, dMax] = AIR_DEPTH[kind];
  const latMax = AIR_LATERAL[kind];
  const out: MatchScenario[] = [];
  for (const srcKind of from) {
    for (const ms of source(srcKind)) {
      const gk = ms.players.find((p) => p.label === "GK");
      const crosser = ms.players.find((p) => p.side === "you");
      if (!gk || !crosser) continue;
      const defs = ms.players.filter((p) => p.side === "opponent" && p.label !== "GK");
      // A defender behind his own keeper: left out (see the file's note).
      if (defs.some((d) => d.y < gk.y)) continue;
      const mates = ms.players.filter((p) => p.side === "teammate");
      // The offside line (second-last defender, keeper included).
      const ys = [...defs.map((d) => d.y), gk.y].sort((a, b) => a - b);
      const line = ys.length >= 2 ? ys[1] : -Infinity;
      for (const man of mates) {
        if (!RECEIVER_LABELS.has((man.label ?? "").toUpperCase())) continue;
        // The ball meets him on its way in from the crosser.
        const toC = { x: crosser.x - man.x, y: crosser.y - man.y };
        const nC = Math.hypot(toC.x, toC.y) || 1;
        const ball = { x: man.x + (toC.x / nC) * AIR_STANCE_M, y: man.y + (toC.y / nC) * AIR_STANCE_M };
        if (ball.y < dMin || ball.y > dMax) continue;
        if (Math.abs(ball.x - CX) > latMax) continue;
        if (!(gk.y < ball.y)) continue;
        if ([...defs, gk, crosser, ...mates.filter((m) => m !== man)].some((p) => hyp(p, ball) < BALL_CLEAR_M)) continue;
        // Nobody left offside of the new ball (the crosser played it: he is not).
        const others = mates.filter((m) => m !== man);
        if (others.some((m) => m.y < line - 0.01 && m.y < ball.y - 0.01)) continue;
        // You first, the crosser second (chanceMaker puts the builder's own
        // crosser there), then everyone else as drawn.
        const listed: ScenarioPlayer[] = [
          { id: "you", side: "you", x: man.x, y: man.y, label: "YOU" },
          { id: "crosser", side: "teammate", x: Math.min(Math.max(crosser.x, CROSSER_IN_M), 68 - CROSSER_IN_M), y: Math.max(crosser.y, CROSSER_IN_M), label: "CROSSER" },
          ...others.map((m) => ({ ...m })),
          ...defs.map((d) => ({ ...d })),
          { ...gk },
        ];
        // Two men drawn on the very same spot are one man (a slip in the
        // drawing: byline cross 7605 has SUP at (45.6, 6.5) twice). Kept once,
        // so the picture never shows two bodies on top of each other.
        const players = listed.filter((p, i) => !listed.slice(0, i).some((q) => hyp(p, q) < SAME_SPOT_M));
        out.push({
          id: `air-${kind}-${ms.id}-${man.id}`,
          name: `${kind} off ${ms.name || ms.id}`,
          kind: ms.kind,
          camera: { ...ms.camera, centerX: Math.min(Math.max(ball.x, 14), 54) },
          ball,
          players,
          updatedAt: ms.updatedAt,
          source: { tool: "gallery", kind, seed: null, derivedFrom: ms.id } as MatchScenario["source"],
        });
      }
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** The crosser's spot in a derived drawing's shape: mates[0] (see the order above). */
export const CROSSER_MATE_INDEX = 0;
/** In open play the crosser stands at least this far inside the lines (m): a
 *  corner drawing's taker is drawn on the flag, and a nudge can take him off it. */
export const CROSSER_IN_M = 0.6;

// ─────────────────────────────────────────────────────────────────────────
//  HOW HIGH THE BALL IS WHEN IT REACHES YOU
// ─────────────────────────────────────────────────────────────────────────

/** m, a forehead on a jump (the strike starts here: airborneChance.ts). */
export const HEADER_Z = 1.85;
/** m, the top of a volley's bounce. */
export const VOLLEY_MAX_Z = 0.95;

/** The height the cross arrives at (the build-up's last pass, and the ball you
 *  line up while you aim): a header at your head, a volley at the top of its bounce.
 *  The kind's usual height; one chance's own height is airZOf. */
export function arriveZ(kind: string): number {
  return kind === "header" ? HEADER_Z : kind === "volley" ? VOLLEY_MAX_Z : 0;
}

// ─────────────────────────────────────────────────────────────────────────
//  EACH CHANCE'S OWN HEIGHT (headers piece 4, 21 Oct 2026)
//
//  Research (docs/research/2026-10-21-headers-volleys-acrobatics.md §5.4):
//  "every header arrives at 1.85 m and every volley bounces to 0.95 m. Real
//  headers are struck between 1.5 and 2.6 m." So a header chance carries its
//  own height (`airZ` on the scenario: a plain number, so it survives the
//  goal replay's JSON copy of the scenario):
//   - a real header or volley (real moments): the height it was really struck at;
//   - a header off a cross drawing: one height from the real spread
//     (REAL_HEADER_Z_DECILES), picked from the picture itself (no random number).
//  Nobody is placed by it: it is only how high the ball is.
//
//  AIR_HEIGHT_VARIES switches all of it. It stays false until CanvasMatch.tsx
//  passes the chance to airWaitZ (the ball while you aim: one line there,
//  `airWaitZ(sc.kind, t, sc)`). Without that line the ball would arrive at its
//  own height, hang at 1.85 m while you aim, then be struck from its own height.
// ─────────────────────────────────────────────────────────────────────────

/** The engine's own air heights (canvasEngine.ts HEADER_MIN_Z, HEADER_MAX_REACH_Z,
 *  VOLLEY_MIN_Z, in m; not exported there, so repeated here with the same numbers). */
export const AIR_HEADER_MIN_Z = 1.3;
export const AIR_HEADER_MAX_Z = 2.6;
export const AIR_VOLLEY_MIN_Z = 0.35;

/** On: each header/volley chance has its own height (airZOf). Off: the kind's usual height. */
export const AIR_HEIGHT_VARIES = false;

/** A header is met between these (m): research §5.4, real headers 1.5 to 2.6 m. */
export const HEADER_Z_RANGE: readonly [number, number] = [1.5, AIR_HEADER_MAX_Z];
/** The top of a volley's bounce stays between these (m): a real volley struck at
 *  0.4 m still bounces high enough to read; 1.3 m is where a header starts. */
export const VOLLEY_TOP_RANGE: readonly [number, number] = [0.6, AIR_HEADER_MIN_Z];

/**
 * The real spread of header heights (m), 0th to 100th percentile in tenths:
 * 52 real open-play headers in data/realmoments/tracked.json (DFL headers,
 * and SkillCorner balls struck between 1.3 and 2.6 m), measured 21 Oct 2026
 * (z at the strike), held inside HEADER_Z_RANGE. Median 2.1 m.
 */
export const REAL_HEADER_Z_DECILES: readonly number[] = [1.5, 1.5, 1.7, 1.9, 2.0, 2.1, 2.1, 2.2, 2.4, 2.5, 2.6];

const clampZ = (z: number, r: readonly [number, number]) => Math.min(r[1], Math.max(r[0], z));

/** A chance that may carry its own air height. */
export interface AirHeighted { kind: string; airZ?: number }

/** How high this chance's ball is when it reaches you (m). */
export function airZOf(sc: AirHeighted): number {
  const base = arriveZ(sc.kind);
  if (!AIR_HEIGHT_VARIES || !isAirKind(sc.kind)) return base;
  const z = sc.airZ;
  if (typeof z !== "number" || !Number.isFinite(z)) return base;
  return clampZ(z, sc.kind === "header" ? HEADER_Z_RANGE : VOLLEY_TOP_RANGE);
}

/** Give a header/volley chance its own height (held inside its kind's range). Other kinds: nothing. */
export function setAirZ(sc: AirHeighted, z: number): void {
  if (!isAirKind(sc.kind) || !Number.isFinite(z)) return;
  sc.airZ = Math.round(clampZ(z, sc.kind === "header" ? HEADER_Z_RANGE : VOLLEY_TOP_RANGE) * 100) / 100;
}

/** One height from the real header spread for `key` (any whole number; the same key, the same height). */
export function headerZFromSpread(key: number): number {
  const u = ((Math.imul((key ^ 0x9e3779b9) >>> 0, 2654435761) >>> 0) % 10000) / 10000;
  const d = REAL_HEADER_Z_DECILES, f = u * (d.length - 1), i = Math.min(d.length - 2, Math.floor(f));
  return Math.round((d[i] + (d[i + 1] - d[i]) * (f - i)) * 100) / 100;
}

/** The key a drawn header picture's height is picked from: where the ball and everyone stand (cm). */
export function pictureKey(sc: { ball: { x: number; y: number }; player: { x: number; y: number }; defenders: { x: number; y: number }[] }): number {
  let h = 17;
  for (const p of [sc.ball, sc.player, ...sc.defenders]) h = (Math.imul(h, 31) + Math.round(p.x * 100) * 7 + Math.round(p.y * 100)) | 0;
  return h >>> 0;
}

/**
 * The ball while you line it up (the aim): a header hangs at your head,
 * bobbing a few centimetres; a volley bounces, from the top of a bounce down to
 * the grass and back, every VOLLEY_BOUNCE_S. `t` is seconds since the chance
 * was yours. Drawing only: the strike's height is the contact screen's.
 */
export const VOLLEY_BOUNCE_S = 0.9;
export function airWaitZ(kind: string, t: number, sc?: AirHeighted): number {
  const top = sc ? airZOf(sc) : arriveZ(kind);
  if (kind === "header") return top + 0.05 * Math.sin(t * 2.6);
  if (kind === "volley") return top * Math.abs(Math.cos((Math.PI * Math.max(0, t)) / VOLLEY_BOUNCE_S));
  return 0;
}

/**
 * Where the ball comes from for a header or a volley, for a build-up's last
 * pass: the crosser (teammates[0], the team-mate the drawing has on the ball
 * out wide), how high it goes (a cross, 3-4.6 m at its top) and how high it
 * arrives. Null for any other kind, or a crosser off the pitch.
 */
export function airArrival(sc: AirHeighted & { ball: { x: number; y: number }; teammates: { x: number; y: number }[] }):
  { from: { x: number; y: number }; apex: number; endZ: number } | null {
  if (!isAirKind(sc.kind)) return null;
  const c = sc.teammates[0];
  if (!c || c.x < -1 || c.x > 69 || c.y < -1 || c.y > 104) return null;
  const L = hyp(c, sc.ball);
  if (L < 6) return null;
  return { from: { x: c.x, y: c.y }, apex: Math.min(4.6, Math.max(3, 2.6 + L * 0.06)), endZ: airZOf(sc) };
}
