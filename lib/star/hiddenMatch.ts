import { pickScenarioKindFrom, type ScenarioKind } from "@/lib/star/canvasEngine";
import { getTuning } from "@/lib/star/tuningStore";

const HIGH_MODE_CHANCES = getTuning("energy.highModeChances");
const LOW_MODE_CHANCES = getTuning("energy.lowModeChances");

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
}

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

  const edge = clamp1(quality + home + chase);

  // ── Possession ──
  if (rng() < TURNOVER) {
    const userWins = rng() < 0.5 + edge * TURNOVER_EDGE + state.momentum * 0.1;
    const next: Side = userWins ? "user" : "opponent";
    if (next !== state.possession) {
      state.possession = next;
      if (next === "user") { state.sinceTurnover = 0; state.turnoverZone = state.zone; }
      // Half of turnovers are a clearance or a counter, which moves the ball;
      // the rest are won on the spot and leave it where it was.
      if (rng() < 0.5) state.zone = shift(state.zone, next === "user" ? 1 : -1);
    }
  }

  // ── Territory ──
  // The side in possession tries to advance. Progress is likelier for the
  // better team and for whoever has momentum.
  const userHasIt = state.possession === "user";
  const dir = userHasIt ? 1 : -1;
  const drive = (DRIVE + (userHasIt ? edge : -edge) * 0.03
    + (userHasIt ? state.momentum : -state.momentum) * 0.06) * ENTRY[shift(state.zone, dir)];

  if (rng() < drive) state.zone = shift(state.zone, dir);
  else if (rng() < RETREAT) state.zone = shift(state.zone, -dir);

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
      * (1 + Math.max(0, userHasIt ? state.momentum : -state.momentum) * 0.2);

    if (rng() < rate) {
      if (userHasIt) {
        // Your team has worked one. Are you the one on the end of it?
        // Skill raises how often the move finds you.
        // Energy no longer changes this (22 Sep 2026: "it should not affect
        // the chances coming to you"). The +0.08 is the fixed amount a fresh
        // player always had, so Medium plays exactly as before; the energy
        // MODE scales the whole thing below.
        const modeScale = inputs.energyMode === "high" ? HIGH_MODE_CHANCES
          : inputs.energyMode === "low" ? LOW_MODE_CHANCES : 1;
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
        const involvement = inputs.impactSub ? Math.min(0.92, baseInvolvement * 1.5) : baseInvolvement;

        if (rng() < involvement) {
          const req = buildRequest(state, rng, inputs);
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
          events.push({ minute: state.minute, text: MISS_USER[Math.floor(rng() * MISS_USER.length)], isOpponent: false });
        }
        endOfMove(state, scored, "user");
      } else {
        const scored = rng() < convertRate(inBox ? CONVERT_BOX : CONVERT_DEEP, rng);
        if (scored) {
          state.oppScore += 1;
          state.momentum = clamp1(state.momentum - 0.3);
          events.push({ minute: state.minute, text: "⚽ They score!", isGoal: true });
        } else {
          events.push({ minute: state.minute, text: MISS_OPP[Math.floor(rng() * MISS_OPP.length)], isOpponent: true });
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
  if (userHasIt && state.sinceInvolved >= STARVED_MIN && state.zone !== "own_box" && rng() < 0.45) {
    state.sinceInvolved = 0;
    return {
      events,
      request: {
        zone: state.zone,
        kinds: kindsForZone(state.zone),
        reason: "You drop in and demand the ball",
      },
    };
  }

  // Quiet minute. Reported sparingly — a line every minute would be noise.
  // Attributed to whoever actually has the ball right now, not to nobody.
  if (rng() < 0.22) {
    const bank = userHasIt ? QUIET_USER : QUIET_OPP;
    events.push({ minute: state.minute, text: bank[Math.floor(rng() * bank.length)], isOpponent: !userHasIt });
  }

  return { events, request: null };
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
function buildRequest(state: HiddenMatchState, rng: () => number, inputs: HiddenMatchInputs): ScenarioRequest | null {
  // Sometimes the ball simply arrives at your feet with grass in front of you.
  // Only from the middle and the final third, because a run at goal has to have
  // somewhere to run TO, and likelier for a quick player — the space is the
  // reason the chance exists.
  if (state.zone === "middle" || state.zone === "attacking") {
    const quick = Math.max(0, Math.min(1, (inputs.pace ?? 50) / 100));
    if (rng() < DRIBBLE_CHANCE * (0.7 + quick * 0.6)) {
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
    return rng() < Math.max(0.15, Math.min(0.9, w / 8));
  };
  const lane = state.lane ?? "centre";
  // A penalty keeps its own rate and its own gate (the duty is the taker's).
  if (state.zone === "box" && rng() < 0.085) {
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

  return {
    zone: state.zone,
    kinds: kindsForZone(state.zone, lane),
    lane,
    pattern,
    reason: pattern === "transition"
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
  }
  return { events, request: null, fullTime: true };
}
