import type { ScenarioKind } from "@/lib/star/canvasEngine";

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
}

export interface HiddenMatchInputs {
  /** 0-100. Your team versus theirs decides who tends to control play. */
  teamStrength: number;
  oppStrength: number;
  /** 0-100. Tired legs get you involved less — the doc's effort relationship. */
  energy: number;
  /** 0-100 average of the player's own skills. Better players see more ball. */
  playerSkill: number;
  /** 0-100. A quicker player is handed the ball to run at them more often. */
  pace?: number;
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

const QUIET = [
  "The ball is worked patiently across the back.",
  "A spell of midfield football.",
  "Play switches to the far side.",
  "The tempo drops for a moment.",
  "A long ball is headed clear.",
  "Both sides feeling each other out.",
  "A promising move breaks down in the middle.",
  "The crowd try to lift them.",
];

export function newMatch(rng: () => number = Math.random): HiddenMatchState {
  return {
    minute: 0,
    possession: rng() < 0.5 ? "user" : "opponent",
    zone: "middle",
    momentum: 0,
    userScore: 0,
    oppScore: 0,
    sinceInvolved: 0,
  };
}

/**
 * Which chances make sense from a given area of the pitch.
 *
 * This is the join between simulation and gameplay. A one-on-one cannot happen
 * from your own half, and a midfield pass in the six-yard box would be absurd —
 * so the zone the move reached decides what you are asked to solve.
 */
export function kindsForZone(zone: Zone): ScenarioKind[] {
  switch (zone) {
    case "box":
      return ["one_on_one", "tight_angle", "volley", "header", "cutback"];
    case "attacking":
      return ["cutback", "byline_cross", "through_ball", "long_range", "tight_angle"];
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
        // Energy and skill raise how often the move finds you, which is the
        // doc's effort relationship: effort buys involvement, not better
        // football — a tired player gets fewer chances, not worse ones.
        const involvement = 0.34
          + (inputs.playerSkill / 100) * 0.26
          + (inputs.energy / 100) * 0.16
          // A long spell without the ball nudges it up, so you are never
          // stranded watching for a quarter of an hour.
          + Math.min(0.3, Math.max(0, state.sinceInvolved - 10) * 0.025);

        if (rng() < involvement) {
          state.sinceInvolved = 0;
          return { events, request: buildRequest(state, rng, inputs) };
        }

        // It fell to someone else. Reported either way, so the match reads as a
        // match rather than as a highlight reel of your own touches.
        const scored = rng() < (inBox ? CONVERT_BOX : CONVERT_DEEP);
        if (scored) {
          state.userScore += 1;
          state.momentum = clamp1(state.momentum + 0.3);
          events.push({ minute: state.minute, text: "⚽ Your side score!", isGoal: true, teammateGoal: true });
        } else {
          events.push({ minute: state.minute, text: rng() < 0.5 ? "A chance at the far post — headed over." : "A shot from the edge is blocked." });
        }
        endOfMove(state, scored, "user");
      } else {
        const scored = rng() < (inBox ? CONVERT_BOX : CONVERT_DEEP);
        if (scored) {
          state.oppScore += 1;
          state.momentum = clamp1(state.momentum - 0.3);
          events.push({ minute: state.minute, text: "⚽ They score!", isGoal: true });
        } else {
          events.push({ minute: state.minute, text: rng() < 0.5 ? "They work a chance — the keeper holds it." : "A shot from distance flies wide." });
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
  if (rng() < 0.22) {
    events.push({ minute: state.minute, text: QUIET[Math.floor(rng() * QUIET.length)] });
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

function buildRequest(state: HiddenMatchState, rng: () => number, inputs: HiddenMatchInputs): ScenarioRequest {
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

  // Dead balls come from the match too. They used to be a weight in a table, so
  // a corner could arrive out of open play with nothing behind it; now the move
  // has to reach a dangerous area first and then break down.
  const dead = rng();
  if (state.zone === "box" && dead < 0.05) {
    return { zone: state.zone, kinds: ["penalty"], reason: "You are brought down in the box — penalty" };
  }
  if (state.zone === "attacking" && dead < 0.1) {
    return { zone: state.zone, kinds: ["free_kick"], reason: "Fouled on the edge of the area" };
  }
  if (dead < 0.18) {
    return { zone: state.zone, kinds: ["corner"], reason: "The cross is turned behind — corner" };
  }

  return {
    zone: state.zone,
    kinds: kindsForZone(state.zone),
    reason: state.momentum > 0.35
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
        state.userScore += 1;
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
