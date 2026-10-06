import { pickFresh, EXTRA_QUIET_USER, EXTRA_QUIET_OPP, EXTRA_MISS_USER, EXTRA_MISS_OPP } from "./commentaryExtra";
import { pickScenarioKindFrom, type ScenarioKind } from "@/lib/star/canvasEngine";
import { getTuning } from "@/lib/star/tuningStore";
import { OFF_PITCH_PEN_CONVERT } from "@/lib/star/penaltyTaking";
import type { Playstyle } from "@/lib/star/types";

const HIGH_MODE_CHANCES = getTuning("energy.highModeChances");
const LOW_MODE_CHANCES = getTuning("energy.lowModeChances");
/** On High, the extra chances your own running makes, on top of your side's
 *  normal rate. Only ever yours: taking a bigger share of your side's
 *  chances tops out once nearly every one already comes to you, so without
 *  this High could never reach its intended +35%. */
const HIGH_MODE_EXTRA = getTuning("energy.highModeExtraChances");
/**
 * THE TALISMAN TACTIC — see clubPowers.ts's `setTalisman` for the gate
 * (majority owner of the club you actually play for). Same multiplier slot
 * as HIGH_MODE_CHANCES above, stacked on top of it rather than replacing it
 * — a talisman on Low energy mode is still trading availability for
 * involvement, exactly like everyone else's Low.
 */
const TALISMAN_CHANCES = 2.2;
/** The farewell match: how often a chance your side works comes to you. */
export const FAREWELL_INVOLVEMENT = 0.97;

// ── LATE SUBS (item 24, v0.15) ──────────────────────────────────────────────
//
// Harry: "if you're coming on at any point after 80, you should be guaranteed
// 1 to 2 highlights, 100% ... the later you come on, the chances per minute
// just go up." And, deciding the plan: guaranteed from 70', and a sub's
// chances are squeezed into the minutes he has left, allowing for his
// fitness — on at 80' he still gets about two.
// Measured before any of this (1,000 cameos per minute, 99-rated Chelsea
// striker): on at 80', 0.75 chances and none at all 46% of the time. The
// numbers after are in tests/star/lateSubs.mts. Everything here acts only
// through HiddenMatchInputs.lateSub, which CanvasMatch and the Sim button set
// once the sub is actually on — absent, nothing changes.

/** A substitute who is on: the minute he came on, how many guaranteed
 *  chances he is still owed, and his energy (0-100) when he came on. */
export interface LateSub { enteredAt: number; owed: number; fitness?: number }

/** From this minute on, a sub is guaranteed a chance. */
export const LATE_SUB_GUARANTEE_FROM = 70;
/** Chances a sub is guaranteed: one, if he is on at 70' or later. (Two made
 *  an 80' cameo worth more than a 75' one, which punished climbing the ladder;
 *  the squeeze below gets 80' to about two on average instead.) */
export function lateSubQuota(enteredAt: number): number {
  return enteredAt >= LATE_SUB_GUARANTEE_FROM ? 1 : 0;
}
/** 0 for a sub on at 55' or earlier, rising to 1 for one on at 80' or later. */
function lateness(enteredAt: number): number {
  return Math.max(0, Math.min(1, (enteredAt - 55) / 25));
}
/** Fresh legs squeeze in more: full effect at 100% energy, 60% of it when empty. */
function fitnessScale(sub: LateSub): number {
  const f = Math.max(0, Math.min(100, sub.fitness ?? 100));
  return 0.6 + 0.4 * (f / 100);
}
/** How much likelier the ball is to find him per move: the old flat ×1.5 on
 *  at 55', rising to ×3.1 for a fresh sub on at 80'+. */
export const LATE_SUB_INVOLVEMENT = 1.6;
/** Extra chances his fresh legs make, as a share of his side's own chance
 *  rate while it has the ball in the final third: +250% for a fresh sub on
 *  at 80'+. */
export const LATE_SUB_EXTRA = 2.5;
export function lateSubInvolvement(sub: LateSub): number {
  return 1.5 + LATE_SUB_INVOLVEMENT * lateness(sub.enteredAt) * fitnessScale(sub);
}
export function lateSubExtra(sub: LateSub): number {
  return LATE_SUB_EXTRA * lateness(sub.enteredAt) * fitnessScale(sub);
}
/** A guaranteed chance is made to happen once fewer than this many minutes
 *  are left per chance still owed (owed 1 → in the last two minutes). */
export const LATE_SUB_FORCE_GAP = 2;

/**
 * HIDDEN MATCH SIMULATION
 *
 * The ninety minutes you are not playing.
 *
 * Chances used to arrive on a timer: a countdown to your next scenario, plus a
 * coin flip for opponent goals, with the scenario kind drawn at random. Nothing
 * connected one moment to the next, so a chance never felt earned — it felt
 * dealt.
 *
 * This models the match instead. Possession moves between the teams, play moves
 * up and down the pitch, and momentum builds when a side sustains pressure.
 * Your team creates chances when it works the ball into a dangerous area; you
 * are pulled in only for the ones that actually find you, and the kind of
 * chance you get is decided by where the ball is. A cutback comes from the
 * byline because the move reached the byline.
 *
 * The pitch axis is symmetric — the same rates that produce your chances at
 * their end produce theirs at yours — so neither side is favoured by the shape
 * of the model, only by how good it is.
 *
 * It is deliberately coarse. It is not trying to simulate football; it is
 * trying to make the football you play feel like the consequence of a match
 * happening around you.
 */

export type Side = "user" | "opponent";

/** Where the ball is, named from the user team's point of view. */
export type Zone = "own_box" | "defensive" | "middle" | "attacking" | "box";

/** Up the pitch, from your goal to theirs. */
const ZONE_ORDER: Zone[] = ["own_box", "defensive", "middle", "attacking", "box"];

/** The two areas from which each team's chances come. Mirrored deliberately. */
const USER_DANGER: Zone[] = ["attacking", "box"];
const OPP_DANGER: Zone[] = ["defensive", "own_box"];

export interface HiddenMatchState {
  /** Commentary lines used lately this match, so they don't repeat. */
  usedLines?: string[];
  minute: number;
  possession: Side;
  zone: Zone;
  /** -1 the opponent is on top, +1 you are. Not the same as possession. */
  momentum: number;
  userScore: number;
  oppScore: number;
  /** Minutes since the player last had a scenario — stops long dead spells. */
  sinceInvolved: number;
  /**
   * Which channel the ball is being worked down — the lateral half of "where
   * is the ball", which this simulation never had. A random walk per tick
   * (stay 0.6, step either way 0.2), reset to the middle when play restarts
   * from the centre. It is why a byline cross stops being a 1% accident: a
   * wide lane in the final third IS that chance, rather than a kind drawn at
   * random from a zone's list. Optional on an old in-flight state; absent
   * reads as "centre".
   */
  lane?: Lane;
  /** Ticks since possession last flipped to you — feeds the transition read. */
  sinceTurnover?: number;
  /** The zone when possession last flipped to you. */
  turnoverZone?: Zone;
  /** Added time, chasing: the "everyone forward" line has been read out. */
  chargeAnnounced?: boolean;
  /**
   * The last few kinds of chance actually served to you, newest last (v0.26).
   * Filled by `noteServedKind`, which the real match calls once it knows the
   * kind. While it is there, the next request leans away from repeating
   * them — see KIND_REPEAT_WEIGHT. Absent (every caller that never notes a
   * kind): no repeat weighting at all.
   */
  recentKinds?: ScenarioKind[];
}

/** The channel the ball is in. See HiddenMatchState.lane. */
export type Lane = "left" | "centre" | "right";
/** How this chance came about. See buildRequest. */
export type ChancePattern = "settled" | "transition" | "set_piece";

export interface HiddenMatchInputs {
  /** 0-100. Your team versus theirs decides who tends to control play. */
  teamStrength: number;
  oppStrength: number;
  /** 0-100 average of the player's own skills. Better players see more ball. */
  playerSkill: number;
  /** 0-100. A quicker player is handed the ball to run at them more often. */
  pace?: number;
  /** Your free-kick rating (0-100). A better dead-ball striker is handed more
   *  free kicks and corners — see takesIt in buildRequest. */
  freeKick?: number;
  /**
   * The position you are playing, e.g. "ST"/"CM" — the same string
   * `pickScenarioKindFrom` weights by. Used ONLY to stop set pieces
   * bypassing position weighting (see buildRequest's dead-ball block).
   * Optional: absent, every set-piece rate is exactly what it always was.
   */
  position?: string;
  /**
   * 0-100, the live in-match energy value. No longer read by the chance
   * formula (22 Sep 2026) — the energy MODE is, see `energyMode`. Kept so
   * existing callers still type-check.
   */
  energy?: number;
  /**
   * True for the whole time you are on the pitch having come on as a
   * substitute this match — not just the moment of the substitution. See
   * the `involvement` calc below. Optional; a caller that omits it (the
   * star-match-dev fork, older tests, and every minute before you're
   * actually subbed on) behaves exactly as it always has.
   */
  impactSub?: boolean;
  /**
   * The energy mode you are playing on (energy.ts). High gets the ball to you
   * more often, Low less often; Medium, or absent, is exactly the old game.
   * Owners, 22 Sep 2026: this — not how tired you are — is what changes how
   * many chances come to you.
   */
  energyMode?: "low" | "medium" | "high";
  /**
   * Mode switches made part-way through a stretch that has already been
   * simulated ahead. Each one takes over from its own minute onwards, so the
   * same stretch can be re-run with minutes before the switch identical and
   * everything after it at the new mode — which is what makes switching
   * instant rather than waiting for your next chance. Absent: `energyMode`
   * for the whole run, exactly as before.
   */
  energyModeChanges?: { minute: number; mode: "low" | "medium" | "high" }[];
  /**
   * Majority owner of the club you actually play for, tactic switched on —
   * see clubPowers.ts's `setTalisman`. Stacks with `energyMode` rather than
   * replacing it. Optional; absent (every existing save, every save that
   * doesn't own its own club) is exactly today's game.
   */
  talisman?: boolean;
  /**
   * THE FAREWELL MATCH (Leo, 6 Oct 2026: "every chance is yours"). Nearly
   * every chance your side works comes to you — FAREWELL_INVOLVEMENT, not
   * every one, so a team-mate still scores now and then and it reads as a
   * match. Only the farewell match passes it; absent is exactly today's game.
   */
  farewell?: boolean;
  /**
   * PENALTIES WON IN ANY MOVE (v0.15 plan, item 6).
   *
   * Harry: "A top team should get one every 6–7 games", won "whether or not
   * you're in the move". Today a penalty only exists inside a move that has
   * already come to you (buildRequest's 8.5 %), and for a striker 1 in 3 of
   * those quietly turn into an ordinary team-mate chance. With this on, every
   * chance your side works in the box has its own `PENALTY_WON_IN_BOX` roll,
   * BEFORE anyone asks whether it is yours, and the request carries
   * `penaltyWon` — CanvasMatch decides who takes it (you, if you are on the
   * pitch and on penalties; otherwise the team's taker, live). The real
   * match (CanvasMatch) always sets it. Absent — the unit tests and the
   * gallery's simulations — every roll is exactly as before.
   */
  livePenalties?: boolean;
  /**
   * Item 24 (v0.15, Harry): a substitute who has come on. The later he came
   * on, the more often the ball finds him per minute (lateSubInvolvement /
   * lateSubExtra, scaled by his fitness), and from 70' he is owed a chance:
   * `owed` is how many guaranteed chances (lateSubQuota) he has not had yet —
   * advanceUntilInvolved makes sure they arrive before the whistle. Absent:
   * exactly the old game.
   */
  lateSub?: LateSub;
  /**
   * MATCH CONTEXT (specification §2.9).
   *
   * "The Hidden Match Simulation must also understand the broader match
   * situation: current score, remaining time, competition type, knockout or
   * league fixture, home or away. These variables influence football behaviour
   * without directly controlling gameplay. For example, a team trailing late in
   * a match may naturally generate more attacking pressure."
   *
   * The score and the clock were already here and read by nothing: a cup final
   * away from home, 1-0 down with fifteen minutes left, played exactly like a
   * goalless friendly.
   */
  home?: boolean;
  /**
   * ADDED TIME (v0.15 plan item 30). Minutes after `from` up to and including
   * `to` are the added time the fourth official's board showed (see
   * addedTime.ts). Your side throws men forward in them when it is chasing —
   * "Fergie time", see the FERGIE_* constants below. Absent: no added time,
   * and the match is exactly what it always was.
   */
  fergie?: { from: number; to: number };
  /**
   * WHO YOU ARE AND HOW YOU ARE PLAYING (v0.26, Harry: "scenarios and
   * gameplay needs to take into account" your team-mates, the fans, the gap
   * to the opposition, your stats, and a playstyle toggle). See MatchContext.
   * Absent — every test screen, the /star-match-dev fork, the unit tests —
   * the match is exactly what it was.
   */
  context?: MatchContext;
}

/**
 * MATCH CONTEXT (v0.26).
 *
 * Passing a context at all (even `{}`) switches on what needs only the
 * strengths already in the inputs: the gap to the opposition decides how
 * often your side wins the ball back (GAP_REGAIN) and leans the kind of
 * chance (gapKindWeight). Each field below adds its own effect when present.
 */
export interface MatchContext {
  /** Drop deep / balanced / stay up top. Absent or "balanced": no effect. */
  playstyle?: Playstyle;
  /** Switches made part-way through a stretch already simulated ahead —
   *  the same idea as `energyModeChanges`. */
  playstyleChanges?: { minute: number; playstyle: Playstyle }[];
  /** 0-100, how your team-mates rate you. 60 (a new career) is neutral. */
  teamRelationship?: number;
  /** 0-100, how the fans rate you. 50 is neutral. A small effect. */
  fanRelationship?: number;
  /** Your own stats, 0-100. Each leans the kind of chance gently. */
  skills?: { pace?: number; power?: number; technique?: number; vision?: number };
}

/** The playstyle in force at this minute (the latest switch at or before it). */
export function playstyleAt(ctx: MatchContext | undefined, minute: number): Playstyle {
  let ps: Playstyle = ctx?.playstyle ?? "balanced";
  let at = -Infinity;
  for (const c of ctx?.playstyleChanges ?? []) {
    if (c.minute <= minute && c.minute >= at) { ps = c.playstyle; at = c.minute; }
  }
  return ps;
}

// ── Context constants (v0.26). Set by measuring whole matches —
// tests/star/matchContext.mts holds the before/after bounds. ──

/** How much harder the ball is to win BACK per unit of strength gap
 *  (quality, -1..1). On top of TURNOVER_EDGE, which already tilts it. */
export const GAP_REGAIN = getTuning("context.gapRegain");
/** The same, for keeping it once you have it — smaller on purpose. */
const GAP_KEEP = 0.04;
/** Team-mates: share of the ball per relationship point away from 60. */
export const TEAM_REL_INVOLVE = getTuning("context.teamRelInvolve");
/** Fans: the most a full (or empty) fan relationship moves involvement,
 *  at home. Away it is a third of this. */
export const FAN_INVOLVE = 0.06;
/** Fans at home: the most they move winning the ball back. */
const FAN_REGAIN = 0.02;
/** Playstyle: the team concedes a little less / more. Scales the
 *  opponent's chance rate. */
export const PLAYSTYLE_CONCEDE: Record<Playstyle, number> = {
  defensive: getTuning("context.defensiveConcede"),
  balanced: 1,
  attacking: getTuning("context.attackingConcede"),
};
/** Playstyle: dropping deep helps win the ball back; staying up doesn't. */
const PLAYSTYLE_REGAIN: Record<Playstyle, number> = { defensive: 0.03, balanced: 0, attacking: -0.02 };
/**
 * Playstyle: how likely a move in each area finds YOU. Defensive's deep
 * numbers also grow with how much stronger the opposition is (the reason
 * to pick it): × (1 + DEF_UNDERDOG × how far below them you are).
 */
const PLAYSTYLE_PULL: Record<Playstyle, Record<Zone, number>> = {
  defensive: { own_box: 1.3, defensive: 1.3, middle: 1.3, attacking: 0.95, box: 0.72 },
  balanced: { own_box: 1, defensive: 1, middle: 1, attacking: 1, box: 1 },
  attacking: { own_box: 0.5, defensive: 0.5, middle: 0.7, attacking: 1.08, box: 1.3 },
};
const DEF_UNDERDOG = 0.8;
/**
 * Defensive: per minute your side has the ball in midfield or its own half,
 * the chance you drop in and are the one on it. This is where Defensive's
 * build-up chances come from — the match otherwise only makes chances in the
 * final third.
 */
export const DEF_DROP_RATE = getTuning("context.defensiveDropRate");
/** Attacking: how much less often you come short for the ball when starved. */
const ATT_STARVE = 0.6;

/** Playstyle: the kind mix. 1 for anything unlisted. */
export const PLAYSTYLE_KIND: Record<Playstyle, Partial<Record<ScenarioKind, number>>> = {
  defensive: {
    buildup: 1.6, midfield_pass: 1.8, through_ball: 1.5, long_range: 1.5,
    one_on_one: 0.6, tight_angle: 0.55, cutback: 0.8, byline_cross: 0.8,
  },
  balanced: {},
  attacking: {
    one_on_one: 1.7, cutback: 1.5, byline_cross: 1.4, tight_angle: 1.1,
    buildup: 0.45, midfield_pass: 0.45, long_range: 0.7, through_ball: 0.75,
  },
};

/** Kinds that are the ball being played INTO you to finish (a team-mate
 *  finding you). A good relationship leans toward them. In this game a
 *  through ball, a cutback and a cross are passes YOU play. */
const RECEIVED_KINDS: ScenarioKind[] = ["one_on_one", "tight_angle"];

/** The served-kind memory: how many to remember, and how much less likely
 *  each is to come straight back (newest first). */
export const RECENT_KINDS = 2;
export const KIND_REPEAT_WEIGHT = [0.3, 0.7];
/** Weights are turned into whole copies of each kind, this many per 1.0. */
const KIND_RES = 8;

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** -1..1 around 50, for a 0-100 stat. */
const lean = (v: number | undefined) => (v === undefined ? 0 : clampN((v - 50) / 50, -1, 1));

/** Remember a kind the match actually served you (see recentKinds). */
export function noteServedKind(state: HiddenMatchState, kind: ScenarioKind): void {
  state.recentKinds = [...(state.recentKinds ?? []), kind].slice(-RECENT_KINDS);
}

/** Team-mates and fans: how much more (or less) the ball finds you. */
export function relationshipInvolvement(ctx: MatchContext | undefined, home?: boolean): number {
  if (!ctx) return 1;
  let m = 1;
  if (ctx.teamRelationship !== undefined) m *= clampN(1 + (ctx.teamRelationship - 60) * TEAM_REL_INVOLVE, 0.6, 1.3);
  if (ctx.fanRelationship !== undefined) {
    m *= 1 + lean(ctx.fanRelationship) * (home === true ? FAN_INVOLVE : home === false ? FAN_INVOLVE / 3 : FAN_INVOLVE / 2);
  }
  return m;
}

/** Playstyle: how likely a move in this area finds you. */
export function playstylePull(ps: Playstyle, zone: Zone, quality: number): number {
  const base = PLAYSTYLE_PULL[ps][zone];
  if (ps === "defensive" && (zone === "own_box" || zone === "defensive" || zone === "middle")) {
    return base * (1 + DEF_UNDERDOG * Math.max(0, -quality));
  }
  return base;
}

/** The gap leans the kind: against a much better side you get it on the
 *  break (balls in behind, long shots); against a much worse one they sit
 *  deep and you work it wide (cutbacks, crosses, long shots). */
export function gapKindWeight(kind: ScenarioKind, quality: number): number {
  const u = Math.max(0, -quality), f = Math.max(0, quality);
  switch (kind) {
    case "one_on_one": return (1 + 0.5 * u) * (1 - 0.3 * f);
    case "through_ball": return (1 + 0.4 * u) * (1 - 0.3 * f);
    case "long_range": return (1 + 0.3 * u) * (1 + 0.15 * f);
    case "cutback": return (1 - 0.3 * u) * (1 + 0.4 * f);
    case "byline_cross": return (1 - 0.3 * u) * (1 + 0.4 * f);
    case "tight_angle": return 1 - 0.2 * u;
    default: return 1;
  }
}

/** Your stats lean the kind — gently, at most about ±45% on one kind. */
export function skillKindWeight(kind: ScenarioKind, sk: MatchContext["skills"]): number {
  if (!sk) return 1;
  const shooting = sk.power === undefined && sk.technique === undefined
    ? undefined : ((sk.power ?? 50) + (sk.technique ?? 50)) / 2;
  switch (kind) {
    case "one_on_one": return 1 + 0.45 * lean(sk.pace);            // quick: in behind
    case "long_range": return 1 + 0.45 * lean(shooting);           // strikes it: from range
    case "tight_angle": return 1 + 0.12 * lean(sk.technique);
    case "through_ball": return 1 + 0.4 * lean(sk.vision);         // sees it: the pass
    case "midfield_pass": return 1 + 0.25 * lean(sk.vision);
    case "cutback": return 1 + 0.2 * lean(sk.vision);
    case "byline_cross": return 1 + 0.15 * lean(sk.vision);
    default: return 1;
  }
}

/**
 * The kinds a request offers, re-weighted for the context and for what you
 * have just been served. Turned into whole copies (pickScenarioKindFrom and
 * the chance maker both count copies), so the list stays plain kinds.
 * Unchanged — the very same array — when there is nothing to weigh, and a
 * single-kind list (a set piece) is never touched.
 */
export function weightKinds(kinds: ScenarioKind[], state: HiddenMatchState, inputs: HiddenMatchInputs): ScenarioKind[] {
  const ctx = inputs.context;
  const recent = state.recentKinds;
  if (!ctx && !(recent && recent.length)) return kinds;
  const counts = new Map<ScenarioKind, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  if (counts.size <= 1) return kinds;
  const quality = clamp1((inputs.teamStrength - inputs.oppStrength) / 40);
  const ps = playstyleAt(ctx, state.minute);
  const rel = ctx?.teamRelationship;
  const out: ScenarioKind[] = [];
  counts.forEach((c, k) => {
    let w = 1;
    if (ctx) {
      w *= PLAYSTYLE_KIND[ps][k] ?? 1;
      w *= gapKindWeight(k, quality);
      w *= skillKindWeight(k, ctx.skills);
      if (rel !== undefined && RECEIVED_KINDS.includes(k)) w *= clampN(1 + (rel - 60) * 0.008, 0.7, 1.32);
    }
    if (recent) {
      for (let i = 0; i < recent.length && i < KIND_REPEAT_WEIGHT.length; i++) {
        if (recent[recent.length - 1 - i] === k) { w *= KIND_REPEAT_WEIGHT[i]; break; }
      }
    }
    const n = Math.max(1, Math.round(c * w * KIND_RES));
    for (let i = 0; i < n; i++) out.push(k);
  });
  return out;
}

export interface HiddenMatchEvent {
  minute: number;
  text: string;
  isGoal?: boolean;
  /** Set when a squad member, rather than the player, scored it. */
  teammateGoal?: boolean;
  /**
   * Whose chance this line is reporting on, when the text is specifically
   * about one side's play — a near-miss, a blocked shot. Absent for text with
   * no team of its own (a quiet spell). Read by the commentary screen to tint
   * a line by that team's kit colour instead of leaving every line the same
   * shade regardless of who it is actually about.
   */
  isOpponent?: boolean;
}

export interface ScenarioRequest {
  zone: Zone;
  /** Which scenarios make football sense from here. */
  kinds: ScenarioKind[];
  /** Shown to the player so a chance never appears from nowhere. */
  reason: string;
  /**
   * Carry it yourself instead. A run at the defence rather than a ball to
   * strike — see lib/star/dribble.ts. Kept off ScenarioKind deliberately: none
   * of the thirteen scenario builders can produce one, and putting it in that
   * union would mean every one of them had to pretend it could.
   */
  dribble?: boolean;
  /** Which channel the ball was worked down. Absent reads as "centre". */
  lane?: Lane;
  /** How the chance came about. Absent reads as "settled". */
  pattern?: ChancePattern;
  /**
   * A penalty your SIDE has won — not necessarily in a move that involved you
   * (see HiddenMatchInputs.livePenalties). Who takes it is the match's call.
   */
  penaltyWon?: boolean;
  /** Added time, you're behind, everyone's forward — see FERGIE_*. */
  lateCharge?: boolean;
}

/**
 * How often a chance your side works in the penalty area is a penalty, when
 * penalties are won in any move (`livePenalties`). Set so a top side (85
 * against a league spread) wins one about every 6–7 games — measured with the
 * unseen match itself, `teamStrength` = the club's league strength
 * (tests/star/penaltyTaking.mts).
 */
export const PENALTY_WON_IN_BOX = 0.029;

/**
 * What the player did with the chance, fed back so the match reacts to it.
 *
 * "delivered" is a pass that found its man — the only outcome that keeps the
 * ball, which is why a build-up pass can start a spell of pressure instead of
 * ending the move like a shot does.
 */
export type ScenarioResult = "goal" | "saved" | "delivered" | "lost";

// ── Tuned constants ─────────────────────────────────────────────────────────
// Every one of these was set by running whole seasons of matches and reading
// the distributions out, not by eye. tests/star/hiddenMatch.mts holds the
// bounds they were tuned to.

/**
 * Playing at home.
 *
 * Every other fixture in the division has had a home advantage since the league
 * was written — `simulateOtherFixtures` gives the home side +3, and so does a
 * match you are dropped for. The one match you actually PLAY was the only one
 * in the game where it did not exist.
 */
const HOME_EDGE = 0.16;

/**
 * Chasing the game, and seeing it out.
 *
 * The specification's worked example for match context. A side behind late
 * throws bodies forward — more of the ball, further up, more chances, and more
 * of them falling to you. A side in front does the opposite. Both are capped
 * well short of deciding anything.
 */
const LATE_FROM = 62;
const CHASE_EDGE = 0.3;

/**
 * FERGIE TIME (v0.15 plan item 30).
 *
 * Harry: "crazy late moments: more attacking highlights" — and, this review,
 * "if for Fergie time, you're also probably more vulnerable in those
 * moments." In added time, your side commits men forward when it is chasing:
 * one or two goals down, or level at home when you are the bigger side
 * (Harry's call: a big side at home goes for the win).
 *
 *   FERGIE_EDGE      more of the ball;
 *   FERGIE_PUSH      and with it, the whole side pushes up — forward faster,
 *                    hardly ever back;
 *   FERGIE_CHANCES   more of your side's moves become chances;
 *   FERGIE_BOX       and more of those are balls into the box rather than a
 *                    pass from midfield (the chance you get is a box chance);
 *   FERGIE_COUNTER   but lose it and they break into the space you left —
 *                    the ball goes two zones towards your goal, not one;
 *   FERGIE_EXPOSED   and a break against a stretched side is likelier to
 *                    end in a chance for them.
 *
 * Only in the added minutes, only when chasing (three down is over), and
 * only through rolls that never happen outside those minutes — so every
 * minute up to 90' plays exactly as it did before.
 */
const FERGIE_EDGE = 0.25;
const FERGIE_PUSH = 1.6;
const FERGIE_CHANCES = 1.7;
const FERGIE_BOX = 0.6;
const FERGIE_COUNTER = 0.6;
const FERGIE_EXPOSED = 1.8;

/** Commentary when a late charge is caught out. */
const COUNTER_OPP = [
  "They break — too many men caught up the pitch!",
  "A counter! Three on two, and nobody back.",
  "Caught with everyone forward — they're away.",
];

/** Chance per minute that the ball changes hands. */
const TURNOVER = 0.55;
/** How much team quality tilts who wins it. This is what buys possession. */
const TURNOVER_EDGE = 0.3;
/** Base chance the team in possession moves a zone up the pitch. */
const DRIVE = 0.46;
/** ...and the chance they are pushed a zone back instead. */
const RETREAT = 0.28;
/**
 * How much harder each zone is to get into. Without this the pitch behaved like
 * an unweighted random walk and play spent as long in the six-yard box as in
 * midfield; football is mostly played in the middle and the last twenty yards
 * are the hardest to reach.
 */
const ENTRY: Record<Zone, number> = {
  own_box: 0.35, defensive: 0.75, middle: 1, attacking: 0.75, box: 0.35,
};
/** Per-minute chance the team in possession works a real chance, by area. */
const CHANCE_DEEP = 0.26;   // in the final third
const CHANCE_BOX = 0.55;    // in the penalty area
/** Minutes ignored by the match before you go looking for the ball yourself. */
const STARVED_MIN = 20;
/** How often a chance in open play is a run rather than a ball to strike. */
const DRIBBLE_CHANCE = 0.26;

/* ── WHERE EACH POSITION IS USED ──────────────────────────────────────────
 *
 * Until this, `position` only decided who took a free kick. Everything else —
 * which part of the pitch a chance found you in, which lane it came down —
 * was identical whether you were a striker or a number ten. Measured over 500
 * matches that put a STRIKER's third most common highlight at build-up play
 * (10.6%), with build-up + a midfield pass + a long shot together making up a
 * quarter of everything he did.
 *
 * So each position now has its own profile:
 *
 *   PULL   how likely a move in that area of the pitch finds YOU. A striker
 *          in the box, almost always; a striker in his own half, rarely.
 *   LANE   how likely you are in the middle rather than out wide. A winger
 *          lives on his touchline; a striker does not.
 *
 * These are MULTIPLIERS on the existing rolls, not replacements, so the
 * momentum, energy, skill and impact-sub terms all still apply on top. A
 * caller with no position (the star-match-dev fork, older tests) gets 1
 * everywhere and is byte-identical to before.
 */
export const POSITION_PULL: Record<string, Partial<Record<Zone, number>>> = {
  // A striker is a penalty-box player. He is in the game less often overall,
  // and far more of what he does is in the last twenty yards.
  ST:  { own_box: 0.15, defensive: 0.25, middle: 0.45, attacking: 1.05, box: 1.35 },
  // A ten links it. Involved almost everywhere from the middle forward.
  CAM: { own_box: 0.35, defensive: 0.6,  middle: 1.0,  attacking: 1.15, box: 1.0 },
  // A winger gets it early and runs. Strong in the final third, real presence
  // in midfield, and he tracks back more than a striker does.
  LW:  { own_box: 0.3,  defensive: 0.55, middle: 0.85, attacking: 1.2,  box: 1.0 },
  RW:  { own_box: 0.3,  defensive: 0.55, middle: 0.85, attacking: 1.2,  box: 1.0 },
};

/**
 * How likely a move down a given lane finds you.
 *
 * Also the only thing that has ever told LW and RW apart. Measured before
 * this, the two positions produced byte-identical spreads — a left winger and
 * a right winger got the same chances in the same proportions, because
 * nothing anywhere read which side of the pitch they play on.
 */
export const POSITION_LANE: Record<string, Record<Lane, number>> = {
  ST:  { left: 0.7,  centre: 1.5, right: 0.7 },
  CAM: { left: 0.8,  centre: 1.4, right: 0.8 },
  LW:  { left: 1.65, centre: 0.8, right: 0.35 },
  RW:  { left: 0.35, centre: 0.8, right: 1.65 },
};

/** The pull for a position in a zone; 1 for anything unlisted. */
export function positionPull(position: string | undefined, zone: Zone): number {
  if (!position) return 1;
  return POSITION_PULL[position]?.[zone] ?? 1;
}

/**
 * How much this position runs at people. A winger takes a man on; a striker
 * mostly does not. This was flat for every position before — measured, all
 * four dribbled within half a percent of each other.
 */
export const POSITION_DRIBBLE: Record<string, number> = {
  ST: 0.6, CAM: 0.95, LW: 1.5, RW: 1.5,
};

/** The pull for a position down a lane; 1 for anything unlisted. */
export function lanePull(position: string | undefined, lane: Lane): number {
  if (!position) return 1;
  return POSITION_LANE[position]?.[lane] ?? 1;
}
/** How often a chance ends in the net when the player is not the one taking it. */
const CONVERT_DEEP = 0.09;
const CONVERT_BOX = 0.16;
/**
 * A flat conversion rate meant nobody but you ever had a moment of real
 * quality: every teammate-fallback goal and every opponent goal landed at the
 * same routine rate forever, match after match, however good the side taking
 * it was. Reported directly — a match felt safe to control after one or two
 * of your own goals, because nothing on the other flat-rate paths could ever
 * punish you the way your own skill-driven finishing already can. This gives
 * both of those paths an occasional clinical finish instead — the same shape
 * of upside your own play already gets through the aim/contact minigame when
 * you are the one on the end of the chance.
 */
const QUALITY_CHANCE = 0.16;
const QUALITY_CONVERT = 0.36;
const convertRate = (base: number, rng: () => number) => (rng() < QUALITY_CHANCE ? QUALITY_CONVERT : base);

// A quiet minute used to read as pure narration — nobody's, about nothing —
// which was reported directly as "we don't want any text here that's
// general, all of it should be about one team or the other." Two banks, kept
// in the same order so each line has a real opposite number, chosen by who
// actually has the ball rather than left unattributed.
const QUIET_USER = [
  "{club} work it patiently across the back.",
  "A good spell of possession for {club}.",
  "Play is switched to {club}'s far side, still looking for the gap.",
  "The tempo drops, but {club} keep the ball moving.",
  "A long ball forward for {club} is headed clear.",
  "{club} have the better of this spell.",
  "A promising move for {club} breaks down in the middle.",
  "{club}'s fans try to lift the team.",
];
const QUIET_OPP = [
  "They work it patiently across the back.",
  "A good spell of possession for them.",
  "Play is switched to their far side, still looking for the gap.",
  "The tempo drops, but they keep the ball moving.",
  "A long ball forward for them is headed clear.",
  "They have the better of this spell.",
  "A promising move for them breaks down in the middle.",
  "Their fans try to lift the team.",
];

// A chance that fell to a team-mate and did not go in — two lines each was
// thin enough to repeat inside a single match. Same pairing as the QUIET
// banks above: kept in the same order so each line has a real opposite
// number, one bank per side rather than one shared neutral set.
const MISS_USER = [
  "A chance at the far post for {club} — headed over.",
  "A shot from the edge for {club} is blocked.",
  "{club} force a smart save from the keeper.",
  "An effort from {club} flies wide of the far post.",
  "{club} crash a shot back off the crossbar.",
  "A goal-bound effort from {club} is cleared off the line.",
  "{club} can't quite direct a header on target.",
  "The keeper gets down well to smother {club}'s effort.",
];
const MISS_OPP = [
  "They work a chance — the keeper holds it.",
  "A shot from distance flies wide.",
  "They force a good save from your keeper.",
  "An effort from the edge of the box drifts just wide.",
  "They crash a shot back off the crossbar.",
  "A goal-bound effort is cleared off the line.",
  "They can't quite direct a header on target.",
  "Your keeper gets down well to smother their effort.",
];

// Lines added 27 Sep 2026 and picked without repeats — see commentaryExtra.ts.
const QUIET_USER_ALL = [...QUIET_USER, ...EXTRA_QUIET_USER];
const QUIET_OPP_ALL = [...QUIET_OPP, ...EXTRA_QUIET_OPP];
const MISS_USER_ALL = [...MISS_USER, ...EXTRA_MISS_USER];
const MISS_OPP_ALL = [...MISS_OPP, ...EXTRA_MISS_OPP];
/** A line from a bank that this match hasn't used lately. One random draw,
 *  the same as before, so a seeded match plays out identically otherwise. */
function freshLine(state: HiddenMatchState, bank: string[], rng: () => number): string {
  if (!state.usedLines) state.usedLines = [];
  return pickFresh(bank, rng, state.usedLines);
}
/**
 * Read-only views for the Match Radar (/star-radar-dev), which draws this
 * simulation minute by minute. Additive: nothing in the match reads these.
 *
 * CHANCE_LINES tells a near-miss line from a quiet-minute line in `tick`'s
 * events (both carry `isOpponent`). `benchConversion` is the rate `advanceTo`
 * uses for a chance that came to you while you weren't on the pitch.
 */
export const CHANCE_LINES: ReadonlySet<string> = new Set([...MISS_USER_ALL, ...MISS_OPP_ALL]);
export function benchConversion(zone: Zone): number {
  return zone === "box" ? CONVERT_BOX : CONVERT_DEEP;
}

export function newMatch(rng: () => number = Math.random): HiddenMatchState {
  return {
    minute: 0,
    possession: rng() < 0.5 ? "user" : "opponent",
    zone: "middle",
    momentum: 0,
    userScore: 0,
    oppScore: 0,
    // Kick-off is treated as though you had already been waiting a while, so the
    // first thing you do in a match happens in the opening minutes. Starting at
    // zero meant the starve bonus only began at minute ten, and matches were
    // routinely twenty minutes old — and sometimes two goals down — before you
    // had touched the ball once.
    sinceInvolved: 14,
    lane: "centre",
    sinceTurnover: 99,
    turnoverZone: "middle",
  };
}

/** The lane's random walk: mostly holds, sometimes shifts a channel. */
export function stepLane(lane: Lane, rng: () => number): Lane {
  const r = rng();
  if (r < 0.6) return lane;
  const order: Lane[] = ["left", "centre", "right"];
  const i = order.indexOf(lane);
  const to = r < 0.8 ? i - 1 : i + 1;
  return order[Math.max(0, Math.min(2, to))];
}

/**
 * Which chances make sense from a given area of the pitch.
 *
 * This is the join between simulation and gameplay. A one-on-one cannot happen
 * from your own half, and a midfield pass in the six-yard box would be absurd —
 * so the zone the move reached decides what you are asked to solve.
 */
export function kindsForZone(zone: Zone, lane: Lane = "centre"): ScenarioKind[] {
  const wide = lane !== "centre";
  switch (zone) {
    case "box":
      // A wide lane in the box is a byline, a cutback and a tight angle; the
      // middle of it is a one-on-one and a finish. Splitting these was the
      // fix for byline_cross being a 1% accident despite being one of the
      // most common real chances a wide player gets.
      return wide
        ? ["cutback", "byline_cross", "tight_angle", "header", "volley"]
        : ["one_on_one", "volley", "header", "tight_angle"];
    case "attacking":
      return wide
        ? ["byline_cross", "cutback", "through_ball", "long_range"]
        : ["through_ball", "long_range", "one_on_one", "cutback"];
    case "middle":
      return ["through_ball", "midfield_pass", "buildup", "long_range"];
    case "defensive":
      return ["midfield_pass", "buildup"];
    case "own_box":
      return ["buildup"];
  }
}

const shift = (zone: Zone, by: number): Zone => {
  const i = ZONE_ORDER.indexOf(zone);
  return ZONE_ORDER[Math.max(0, Math.min(ZONE_ORDER.length - 1, i + by))];
};

const clamp1 = (n: number) => Math.max(-1, Math.min(1, n));

/**
 * Advance one minute.
 *
 * Returns the events that minute produced and, when the football justifies it,
 * a request for the player to take over.
 */
/** The energy mode in force at this minute — the latest switch at or before
 *  it, otherwise the mode the run started on. */
export function modeAt(inputs: HiddenMatchInputs, minute: number): "low" | "medium" | "high" | undefined {
  let mode = inputs.energyMode;
  let at = -Infinity;
  for (const c of inputs.energyModeChanges ?? []) {
    if (c.minute <= minute && c.minute >= at) { mode = c.mode; at = c.minute; }
  }
  return mode;
}

export function tick(
  state: HiddenMatchState,
  inputs: HiddenMatchInputs,
  rng: () => number,
): { events: HiddenMatchEvent[]; request: ScenarioRequest | null } {
  const events: HiddenMatchEvent[] = [];
  state.minute += 1;
  state.sinceInvolved += 1;
  // The lane walks every tick; the transition read needs to know how long ago
  // the ball changed hands and how far it has travelled since.
  state.lane = stepLane(state.lane ?? "centre", rng);
  state.sinceTurnover = (state.sinceTurnover ?? 99) + 1;

  // Relative quality, -1..1. Drives who tends to hold the ball and move it
  // forward WITHOUT deciding anything outright — upsets stay possible.
  const quality = clamp1((inputs.teamStrength - inputs.oppStrength) / 40);
  const home = inputs.home === false ? -HOME_EDGE : inputs.home === true ? HOME_EDGE : 0;

  // Who needs a goal. Ramps in over the closing half hour rather than switching
  // on, so the match tilts gradually the way a real one does.
  const urgency = state.minute < LATE_FROM
    ? 0
    : Math.min(1, (state.minute - LATE_FROM) / (90 - LATE_FROM));
  const behindBy = state.oppScore - state.userScore;
  const chase = urgency * clamp1(behindBy / 2) * CHASE_EDGE;
  // Added time and chasing: everyone forward. See FERGIE_*.
  const lateCharge = !!inputs.fergie && state.minute > inputs.fergie.from && state.minute <= inputs.fergie.to
    && ((behindBy >= 1 && behindBy <= 2)
      || (behindBy === 0 && !!inputs.home && inputs.teamStrength > inputs.oppStrength));

  const edge = clamp1(quality + home + chase + (lateCharge ? FERGIE_EDGE : 0));
  if (lateCharge && !state.chargeAnnounced) {
    state.chargeAnnounced = true;
    events.push({ minute: state.minute, text: "{club} throw everyone forward — even the keeper wants to go up.", isOpponent: false });
  }

  // ── Possession ──
  if (rng() < TURNOVER) {
    const userWins = rng() < 0.5 + edge * TURNOVER_EDGE + state.momentum * 0.1 + contextRegain(state, inputs, quality);
    const next: Side = userWins ? "user" : "opponent";
    if (next !== state.possession) {
      state.possession = next;
      if (next === "user") { state.sinceTurnover = 0; state.turnoverZone = state.zone; }
      if (lateCharge && next === "opponent" && rng() < FERGIE_COUNTER) {
        // Caught with men forward: they break into the space you left.
        state.zone = shift(state.zone, -2);
        if (rng() < 0.5) events.push({ minute: state.minute, text: COUNTER_OPP[Math.floor(rng() * COUNTER_OPP.length)], isOpponent: true });
      } else if (rng() < 0.5) {
        // Half of turnovers are a clearance or a counter, which moves the ball;
        // the rest are won on the spot and leave it where it was.
        state.zone = shift(state.zone, next === "user" ? 1 : -1);
      }
    }
  }

  // ── Territory ──
  // The side in possession tries to advance. Progress is likelier for the
  // better team and for whoever has momentum.
  const userHasIt = state.possession === "user";
  const dir = userHasIt ? 1 : -1;
  const drive = (DRIVE + (userHasIt ? edge : -edge) * 0.03
    + (userHasIt ? state.momentum : -state.momentum) * 0.06) * ENTRY[shift(state.zone, dir)];

  const pushing = lateCharge && userHasIt;
  if (rng() < drive * (pushing ? FERGIE_PUSH : 1)) state.zone = shift(state.zone, dir);
  else if (rng() < RETREAT * (pushing ? 0.35 : 1)) state.zone = shift(state.zone, -dir);

  // ── Momentum ──
  // Builds for whoever is camped in a dangerous area, and always decays toward
  // level, so no side stays on top forever without earning it.
  const attackerDanger = userHasIt ? USER_DANGER : OPP_DANGER;
  if (attackerDanger.includes(state.zone)) {
    state.momentum += (state.zone === "box" || state.zone === "own_box" ? 0.08 : 0.05) * dir;
  }
  state.momentum = clamp1(state.momentum * 0.94);

  // ── Does this minute produce a chance? ──
  const inBox = state.zone === "box" || state.zone === "own_box";
  const danger = attackerDanger.includes(state.zone);
  if (danger) {
    const rate = (inBox ? CHANCE_BOX : CHANCE_DEEP)
      * (1 + (userHasIt ? edge : -edge) * 0.1)
      * (1 + Math.max(0, userHasIt ? state.momentum : -state.momentum) * 0.2)
      * (lateCharge ? (userHasIt ? FERGIE_CHANCES : FERGIE_EXPOSED) : 1)
      // Playstyle: dropping deep, your side concedes a little less; staying
      // up, a little more (v0.26). Balanced or no context: × 1.
      * (!userHasIt && inputs.context ? PLAYSTYLE_CONCEDE[playstyleAt(inputs.context, state.minute)] : 1);

    // One roll decides both, so Medium and Low use the random stream exactly
    // as before; only High has the extra slice above the normal rate.
    const chanceRoll = rng();
    const highExtra = userHasIt && modeAt(inputs, state.minute) === "high"
      ? rate * (HIGH_MODE_EXTRA - 1) : 0;
    // A late sub's fresh legs make extra chances of their own (item 24).
    const subExtra = userHasIt && inputs.lateSub ? rate * lateSubExtra(inputs.lateSub) : 0;
    if (chanceRoll >= rate && chanceRoll < rate + highExtra + subExtra) {
      const req = buildRequest(state, rng, inputs, lateCharge);
      if (req) {
        state.sinceInvolved = 0;
        return { events, request: req };
      }
    }
    if (chanceRoll < rate) {
      // ── A penalty, won in the move itself (v0.15 item 6) ──
      // Before anyone asks whether the chance is yours: a foul in the box is a
      // foul in the box, whoever was on the ball. Only with `livePenalties`,
      // so the roll — and every roll after it — is exactly as before without.
      if (userHasIt && inputs.livePenalties && state.zone === "box" && rng() < PENALTY_WON_IN_BOX) {
        return {
          events,
          request: {
            zone: "box", kinds: ["penalty"], lane: "centre", pattern: "set_piece",
            reason: "Penalty! Brought down in the box", penaltyWon: true,
          },
        };
      }
      if (userHasIt) {
        // Your team has worked one. Are you the one on the end of it?
        // Skill raises how often the move finds you.
        // Energy no longer changes this (22 Sep 2026: "it should not affect
        // the chances coming to you"). The +0.08 is the fixed amount a fresh
        // player always had, so Medium plays exactly as before; the energy
        // MODE scales the whole thing below.
        const mode = modeAt(inputs, state.minute);
        const modeScale = (mode === "high" ? HIGH_MODE_CHANCES
          : mode === "low" ? LOW_MODE_CHANCES : 1)
          * (inputs.talisman ? TALISMAN_CHANCES : 1);
        const baseInvolvement = (0.36
          + (inputs.playerSkill / 100) * 0.26
          + 0.08
          // A long spell without the ball nudges it up, so you are never
          // stranded watching for a quarter of an hour.
          + Math.min(0.3, Math.max(0, state.sinceInvolved - 10) * 0.025)) * modeScale;
        // Coming off the bench: fresh legs against tired opponents, and a
        // real impact sub gets on the ball MORE than his share in the time
        // he's got, not less. Reported directly — one chance in nineteen
        // minutes on as a substitute read as nothing to show for coming on
        // at all. Capped so it stays a real edge and not a guarantee.
        // Two separate multipliers on top of the existing roll: where on the
        // pitch this position is used, and which lane it lives in.
        const pulled = baseInvolvement
          * positionPull(inputs.position, state.zone)
          * lanePull(inputs.position, state.lane)
          // v0.26: team-mates, fans and playstyle (1 with no context).
          * (inputs.context
            ? relationshipInvolvement(inputs.context, inputs.home)
              * playstylePull(playstyleAt(inputs.context, state.minute), state.zone, quality)
            : 1);
        // Item 24: once a sub is actually on, the later he came on, the likelier
        // the ball finds him (his chances squeezed into the minutes left).
        const involvement = inputs.farewell ? FAREWELL_INVOLVEMENT
          : inputs.lateSub ? Math.min(0.95, pulled * lateSubInvolvement(inputs.lateSub))
          : inputs.impactSub ? Math.min(0.92, pulled * 1.5) : Math.min(0.95, pulled);

        if (rng() < involvement) {
          const req = buildRequest(state, rng, inputs, lateCharge);
          if (req) {
            state.sinceInvolved = 0;
            return { events, request: req };
          }
          // A set piece you don't take. buildRequest returned nothing, so it
          // falls to a team-mate exactly like any other chance that isn't
          // yours — see the participation gate. Deliberately NOT re-rolled
          // into a different kind of chance for you: a corner is a corner
          // whether or not you're the one on it.
        }

        // It fell to someone else. Reported either way, so the match reads as a
        // match rather than as a highlight reel of your own touches.
        const scored = rng() < convertRate(inBox ? CONVERT_BOX : CONVERT_DEEP, rng);
        if (scored) {
          state.userScore += 1;
          state.momentum = clamp1(state.momentum + 0.3);
          events.push({ minute: state.minute, text: "⚽ Your side score!", isGoal: true, teammateGoal: true });
        } else {
          events.push({ minute: state.minute, text: freshLine(state, MISS_USER_ALL, rng), isOpponent: false });
        }
        endOfMove(state, scored, "user");
      } else {
        const scored = rng() < convertRate(inBox ? CONVERT_BOX : CONVERT_DEEP, rng);
        if (scored) {
          state.oppScore += 1;
          state.momentum = clamp1(state.momentum - 0.3);
          events.push({ minute: state.minute, text: "⚽ They score!", isGoal: true });
        } else {
          events.push({ minute: state.minute, text: freshLine(state, MISS_OPP_ALL, rng), isOpponent: true });
        }
        endOfMove(state, scored, "opponent");
      }
      return { events, request: null };
    }
  }

  // ── Coming to get it ──
  // If the match has ignored you for a long time, you go and find the ball
  // yourself rather than waiting for a chance that may never arrive. What you
  // get is whatever the zone justifies, so from your own half this is a
  // build-up pass, not a one-on-one — which is also how a defender or a holding
  // midfielder gets a game at all.
  // Gated by the same position pull as everything else. Without it, making a
  // striker less involved in midfield made things WORSE, not better: he
  // starved more often, and every starved minute came back as a build-up pass
  // from his own half. Measured, that pushed a striker's build-up share UP
  // from 10.6% to 11.0% while the change was supposed to cut it. A striker
  // drops in to get the ball in the final third, not on his own 18-yard line.
  // Playstyle Defensive (v0.26): you drop into midfield and are on the ball
  // in the build-up — more often the stronger they are. Only rolled on
  // Defensive, so every other game uses the random stream exactly as before.
  const style = inputs.context ? playstyleAt(inputs.context, state.minute) : "balanced";
  if (style === "defensive" && userHasIt && (state.zone === "middle" || state.zone === "defensive")
      && rng() < DEF_DROP_RATE * (1 + DEF_UNDERDOG * Math.max(0, -quality))
        * relationshipInvolvement(inputs.context, inputs.home)) {
    state.sinceInvolved = 0;
    const lane = state.lane ?? "centre";
    return {
      events,
      request: {
        zone: state.zone,
        kinds: weightKinds(kindsForZone(state.zone, lane), state, inputs),
        lane,
        pattern: "settled",
        reason: "You drop deep and get on the ball",
      },
    };
  }
  if (userHasIt && state.sinceInvolved >= STARVED_MIN && state.zone !== "own_box"
      && rng() < 0.45 * positionPull(inputs.position, state.zone) * (style === "attacking" ? ATT_STARVE : 1)) {
    state.sinceInvolved = 0;
    return {
      events,
      request: {
        zone: state.zone,
        kinds: weightKinds(kindsForZone(state.zone), state, inputs),
        reason: "You drop in and demand the ball",
      },
    };
  }

  // Quiet minute. Reported sparingly — a line every minute would be noise.
  // Attributed to whoever actually has the ball right now, not to nobody.
  if (rng() < 0.22) {
    const bank = userHasIt ? QUIET_USER_ALL : QUIET_OPP_ALL;
    events.push({ minute: state.minute, text: freshLine(state, bank, rng), isOpponent: !userHasIt });
  }

  return { events, request: null };
}

/**
 * v0.26: the extra tilt on who wins a turnover. The gap counts most when the
 * opponent has the ball — the bigger it is against you, the less often you
 * get it back. Plus the playstyle and, at home, the crowd. 0 with no context.
 */
function contextRegain(state: HiddenMatchState, inputs: HiddenMatchInputs, quality: number): number {
  const ctx = inputs.context;
  if (!ctx) return 0;
  const regaining = state.possession === "opponent";
  let t = quality * (regaining ? GAP_REGAIN : GAP_KEEP);
  if (regaining) {
    t += PLAYSTYLE_REGAIN[playstyleAt(ctx, state.minute)];
    if (inputs.home === true && ctx.fanRelationship !== undefined) t += lean(ctx.fanRelationship) * FAN_REGAIN;
  }
  return t;
}

/**
 * A move has finished. A goal restarts from the centre circle; anything else
 * leaves the defending side to build from their own goal, which is why the
 * ball changes hands but stays where it was.
 */
function endOfMove(state: HiddenMatchState, scored: boolean, attacker: Side) {
  state.possession = attacker === "user" ? "opponent" : "user";
  if (scored) state.zone = "middle";
}

/**
 * What chance the match is handing you — or null when the moment happened but
 * it wasn't yours (a corner you don't take; see the participation gate). The
 * caller resolves a null through the ordinary team-mate path.
 */
function buildRequest(state: HiddenMatchState, rng: () => number, inputs: HiddenMatchInputs, lateCharge = false): ScenarioRequest | null {
  // Sometimes the ball simply arrives at your feet with grass in front of you.
  // Only from the middle and the final third, because a run at goal has to have
  // somewhere to run TO, and likelier for a quick player — the space is the
  // reason the chance exists.
  if (state.zone === "middle" || state.zone === "attacking") {
    const quick = Math.max(0, Math.min(1, (inputs.pace ?? 50) / 100));
    const dribbleBias = inputs.position ? (POSITION_DRIBBLE[inputs.position] ?? 1) : 1;
    if (rng() < DRIBBLE_CHANCE * (0.7 + quick * 0.6) * dribbleBias) {
      return {
        zone: state.zone,
        kinds: ["one_on_one"],
        dribble: true,
        reason: "You pick it up with space to run into",
      };
    }
  }

  // ── Dead balls ──
  //
  // They used to be a weight in a table, so a corner could arrive out of open
  // play with nothing behind it; the move has to reach a dangerous area first
  // and then break down. That part was right and is kept.
  //
  // What was wrong was how rarely it happened, and it took measuring to see.
  // Over three hundred simulated matches the old numbers produced 0.14 penalties
  // and 0.15 free kicks PER MATCH — one of each every seven games — and on top
  // of that a player without the duty has his handed to somebody else, so a
  // career could genuinely run for a season without the player ever taking one.
  // Reported as exactly that: "penalties don't really seem to exist".
  //
  // Three independent rolls now rather than one shared one. The single `dead`
  // roll meant the three were competing for the same slice of probability — a
  // penalty could only ever come out of the bottom 5% that a corner was also
  // trying to claim, so raising one silently lowered another.
  //
  // Corners are also no longer allowed to arrive from your own defensive third,
  // which the old unzoned `dead < 0.18` permitted: the ball was in your own box
  // and the game gave you a corner to attack.
  //
  // ── …and why the three of them used to swamp the highlight mix ──
  //
  // Each branch returned a SINGLE-kind request, which `pickScenarioKindFrom`
  // can only ever resolve one way — so a set piece was the one chance in the
  // game that bypassed position weighting entirely. Measured over 400
  // simulated matches for a striker, corners were 15.2% of every highlight he
  // saw: the single most common thing in the game, for a man whose own corner
  // weight is 2 against a box's 69.
  //
  // THE PARTICIPATION GATE (spec §4.1). Winning a corner is not the same
  // question as being the one who takes it. The rate at which a dead ball is
  // WON drops only slightly (corner 0.24 → 0.16); on top of it, whether it
  // becomes YOUR chance is a separate roll against the position's own duty
  // share. A failed gate does NOT fall through to a different kind of chance:
  // the corner still happens, it is just taken by somebody else, and resolves
  // through tick()'s ordinary team-mate path.
  //
  // SET_PIECE_DUTY mirrors POSITION_WEIGHTS' penalty/free_kick/corner columns
  // (canvasEngine.ts). It is duplicated rather than imported because that
  // table is not exported and canvasEngine.ts is not to be modified; if one
  // ever changes, change both.
  const SET_PIECE_DUTY: Record<string, { penalty: number; free_kick: number; corner: number }> = {
    ST: { penalty: 5, free_kick: 3, corner: 2 }, CAM: { penalty: 3, free_kick: 5, corner: 2 },
    LW: { penalty: 2, free_kick: 3, corner: 6 }, RW: { penalty: 2, free_kick: 3, corner: 6 },
    CM: { penalty: 2, free_kick: 6, corner: 4 }, LM: { penalty: 2, free_kick: 4, corner: 6 },
    RM: { penalty: 2, free_kick: 4, corner: 6 }, CDM: { penalty: 2, free_kick: 6, corner: 3 },
    CB: { penalty: 1, free_kick: 3, corner: 8 }, LB: { penalty: 1, free_kick: 3, corner: 8 },
    RB: { penalty: 1, free_kick: 3, corner: 8 }, GK: { penalty: 0, free_kick: 0, corner: 1 },
  };
  const DEFAULT_DUTY = { penalty: 3, free_kick: 5, corner: 6 };
  const takesIt = (kind: "penalty" | "free_kick" | "corner"): boolean => {
    if (!inputs.position) return true;   // an old caller is byte-identical
    const w = (SET_PIECE_DUTY[inputs.position] ?? DEFAULT_DUTY)[kind];
    // The better your free-kick rating, the more often the free kicks and
    // corners are yours (Mikey, 25 Sep 2026). 40, where a career starts, is
    // exactly the old share; 100 is half as many again; below 40 a little
    // less. Penalties keep their own duty rule (setPieces.ts).
    const fk = inputs.freeKick;
    const taker = kind === "penalty" || fk === undefined
      ? 1
      : Math.max(0.7, 1 + (Math.min(100, Math.max(0, fk)) - 40) / 60 * 0.5);
    return rng() < Math.max(0.15, Math.min(0.9, (w / 8) * taker));
  };
  const lane = state.lane ?? "centre";
  // A penalty keeps its own rate and its own gate (the duty is the taker's).
  // With `livePenalties` they are won in tick() instead, in any move, and
  // this roll is not made at all (so they are never counted twice).
  if (!inputs.livePenalties && state.zone === "box" && rng() < 0.085) {
    return takesIt("penalty")
      ? { zone: state.zone, kinds: ["penalty"], lane: "centre", pattern: "set_piece", reason: "You are brought down in the box — penalty" }
      : null;
  }
  if (state.zone === "attacking" && rng() < 0.215) {
    return takesIt("free_kick")
      ? { zone: state.zone, kinds: ["free_kick"], lane, pattern: "set_piece", reason: "Fouled on the edge of the area" }
      : null;
  }
  if ((state.zone === "attacking" || state.zone === "box") && rng() < 0.16) {
    return takesIt("corner")
      ? { zone: state.zone, kinds: ["corner"], lane, pattern: "set_piece", reason: "The cross is turned behind — corner" }
      : null;
  }

  // ── Settled, or a break? ──
  //
  // A transition is the ball having just changed hands and the move having
  // genuinely travelled since — never a roll inside the formula (spec H11).
  // Capped so it stays the ~10% of shots Opta measures rather than becoming
  // the default state of the match.
  const advanced = ZONE_ORDER.indexOf(state.zone) - ZONE_ORDER.indexOf(state.turnoverZone ?? state.zone);
  const pattern: ChancePattern =
    (state.sinceTurnover ?? 99) <= 2 && advanced >= 1 && rng() < 0.55 ? "transition" : "settled";

  // ── More long shots when the game asks for them (Harry's long-range
  // rules, 26 Sep 2026) ── chasing the game, or a side far better than the
  // one parked in front of it, shoots from range more. Measured on the
  // instrumented match: game state had no effect at all, and a much stronger
  // side got FEWER long shots (ST 4.7% at 85 v 60 against 7.1% at 60 v 85),
  // backwards from real football. Doubling its weight where the zone already
  // offers it takes a CAM chasing from 60' from 11.9% to 18.0% of his
  // chances, and adds only 0.5-1 point overall.
  // Added time and chasing: more often than not it's launched into the box —
  // the chance is the one a zone further up would give. See FERGIE_BOX.
  const launched = lateCharge && state.zone !== "box" && rng() < FERGIE_BOX;
  const kinds = kindsForZone(launched ? shift(state.zone, 1) : state.zone, lane);
  const chasing = state.minute >= 60 && state.userScore < state.oppScore;
  const lowBlock = inputs.teamStrength - inputs.oppStrength >= 15;
  if ((chasing || lowBlock) && kinds.includes("long_range")) kinds.push("long_range");

  return {
    zone: state.zone,
    // v0.26: leaned by playstyle, the gap, your stats, team-mates, and away
    // from what you were just served. The same list with no context.
    kinds: weightKinds(kinds, state, inputs),
    lane,
    pattern,
    ...(lateCharge ? { lateCharge: true } : {}),
    reason: lateCharge
      ? "Everyone forward — it's launched into the box"
      : pattern === "transition"
      ? "They lose it — you break on them"
      : state.momentum > 0.35
      ? "Sustained pressure — you find space"
      : state.zone === "box"
        ? "The ball breaks to you in the area"
        : "The move works its way to you",
  };
}

/**
 * Hand the outcome of your chance back to the match.
 *
 * Without this the simulation would carry on as though your moment never
 * happened — you would score and the ball would still be in their box. It is
 * also what keeps the two teams symmetric: your move ends exactly the way one
 * of theirs does.
 */
export function resolveScenario(state: HiddenMatchState, result: ScenarioResult) {
  if (result === "goal") {
    state.userScore += 1;
    state.momentum = clamp1(state.momentum + 0.3);
    endOfMove(state, true, "user");
    return;
  }
  if (result === "delivered") {
    // You kept the move alive and moved it forward. The ball stays yours.
    state.momentum = clamp1(state.momentum + 0.08);
    state.zone = shift(state.zone, 1);
    return;
  }
  state.momentum = clamp1(state.momentum - (result === "lost" ? 0.1 : 0.05));
  endOfMove(state, false, "user");
}

/**
 * Run the match forward to a given minute with the player NOT on the pitch.
 *
 * Chances that would have come to you fall to whoever is playing instead, so the
 * first hour of a match you came on in the sixtieth minute of actually happened
 * — the score you inherit is a score your team-mates earned or conceded.
 */
export function advanceTo(
  state: HiddenMatchState,
  inputs: HiddenMatchInputs,
  rng: () => number,
  minute: number,
): HiddenMatchEvent[] {
  const events: HiddenMatchEvent[] = [];
  while (state.minute < minute) {
    const step = tick(state, inputs, rng);
    events.push(...step.events);
    if (step.request) {
      // A penalty won while you are off the pitch (v0.15 item 6): taken
      // by the team's taker, at the rate his live kick converts at.
      if (step.request.penaltyWon) {
        const scored = rng() < OFF_PITCH_PEN_CONVERT;
        events.push(scored
          ? { minute: state.minute, text: "⚽ Your side score the penalty!", isGoal: true, teammateGoal: true }
          : { minute: state.minute, text: "A penalty for your side — saved!", isOpponent: false });
        resolveScenario(state, scored ? "goal" : "saved");
        continue;
      }
      // It went to somebody else. Resolved at the rate a team-mate converts,
      // and reported, so watching from the bench is still watching a match.
      const inBox = step.request.zone === "box";
      const scored = rng() < (inBox ? CONVERT_BOX : CONVERT_DEEP);
      if (scored) {
        // resolveScenario (below) is the one place that increments the
        // score for a "goal" result — this used to also do it here, so a
        // handed-over chance counted twice on the board but only ever
        // pushed the one event, leaving the scoreline a goal ahead of the
        // commentary and the results page for good.
        events.push({ minute: state.minute, text: "⚽ Your side score!", isGoal: true, teammateGoal: true });
      }
      resolveScenario(state, scored ? "goal" : "saved");
    }
  }
  return events;
}

/**
 * Run the match forward until the player is needed or the whistle goes.
 *
 * Time compression: uneventful football costs nothing, and only the minutes
 * that produced something are reported.
 */
export function advanceUntilInvolved(
  state: HiddenMatchState,
  inputs: HiddenMatchInputs,
  rng: () => number,
  fullTime: number,
): { events: HiddenMatchEvent[]; request: ScenarioRequest | null; fullTime: boolean } {
  const events: HiddenMatchEvent[] = [];
  while (state.minute < fullTime) {
    const step = tick(state, inputs, rng);
    events.push(...step.events);
    if (step.request) return { events, request: step.request, fullTime: false };
    // Item 24: a late sub's guaranteed chances arrive before the whistle.
    const owed = inputs.lateSub?.owed ?? 0;
    if (owed > 0 && fullTime - state.minute < owed * LATE_SUB_FORCE_GAP) {
      return { events, request: lateSubChance(state, rng), fullTime: false };
    }
  }
  return { events, request: null, fullTime: true };
}

/**
 * Item 24: the chance a late sub is owed. Always open play in the final third
 * (never a set piece somebody else might take, so it can't fall through), and
 * the ball genuinely is yours — the match carries on from it like any other.
 */
function lateSubChance(state: HiddenMatchState, rng: () => number): ScenarioRequest {
  state.possession = "user";
  const zone: Zone = rng() < 0.6 ? "box" : "attacking";
  state.zone = zone;
  state.sinceInvolved = 0;
  const lane = state.lane ?? "centre";
  return {
    zone, kinds: kindsForZone(zone, lane), lane, pattern: "transition",
    reason: "Fresh legs — the sub finds space late on",
  };
}
