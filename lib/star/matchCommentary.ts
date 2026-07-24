// Templated commentary for the canvas match engine. Pure text tables + pickers —
// no state, no physics. Every line is chosen from a pool via the shot's own rng
// so it stays deterministic per seed like everything else in canvasEngine.ts.

import type { Outcome, ScenarioKind } from "./canvasEngine";

function pick<T>(pool: T[], rng: () => number): T {
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

// --- The situation, narrated as it's presented (aim phase) ---
const BUILDUP: Record<ScenarioKind, string[]> = {
  one_on_one: [
    "Clean through! It's just you and the keeper now.",
    "The last defender's beaten — one on one!",
    "Through on goal — this is a big chance.",
  ],
  tight_angle: [
    "Squeezed to the byline — needs a precise finish here.",
    "Tight angle out on the touchline — can he find the corner?",
    "Not much of an angle to work with.",
  ],
  long_range: [
    "Nobody closing him down — he fancies his chance from distance.",
    "Room to shoot from way out.",
    "Sees the keeper off his line and thinks about it from long range.",
  ],
  volley: [
    "The ball's whipped in — get up and meet it first time!",
    "Here comes a cross — first-time effort on!",
    "Flashed across the box — volley chance!",
  ],
  header: [
    "In the mixer! Rises highest for the header.",
    "The delivery's in — attacks it with his head.",
    "Great ball into the box — header on target?",
  ],
  cutback: [
    "Bursts to the byline — looking to cut it back into the box.",
    "Gets to the line — a team-mate is arriving in the middle.",
    "Byline reached — pulls it back across the six-yard box.",
  ],
  byline_cross: [
    "Out wide by the corner flag — about to whip one in.",
    "Reaches the byline — delivery incoming.",
    "Down the line and to the byline — crossing position.",
  ],
  through_ball: [
    "Spots the run in behind — can he thread it through?",
    "The defense is stepping up — a ball over the top could be lethal.",
    "Eyes are up, looking to split the back line.",
  ],
  midfield_pass: [
    "Keeping it simple, recycling possession.",
    "No rush here — just needs to find a team-mate.",
    "Patient build-up play in midfield.",
  ],
  penalty: [
    "Penalty! Steps up to the spot — everything on this.",
    "It's a penalty kick! The stadium holds its breath.",
    "Points to the spot — a chance to make it count from twelve yards.",
  ],
  free_kick: [
    "Free kick in a dangerous position — the wall is set.",
    "Lines up the free kick — can he bend it over the wall?",
    "A set-piece opportunity — this is in his range.",
  ],
  corner: [
    "Corner kick — the delivery is everything here.",
    "Swinging in a corner — bodies in the box.",
    "Corner from the flag — who wants it most?",
  ],
  buildup: [
    "Deep in midfield — needs to find the right pass here.",
    "On the ball with options ahead — can he pick the right one?",
    "Building from the back — time to play through the lines.",
  ],
};

// --- The moment the ball is struck ---
const STRIKE: Record<ScenarioKind, string[]> = {
  one_on_one: ["He goes for it!", "Strikes it first time!", "Here's the finish..."],
  tight_angle: ["Goes near post!", "Tries to squeeze it in!", "Attempts the finish from the tightest of angles!"],
  long_range: ["He lets fly!", "Unleashes a strike from distance!", "Hits it clean from way out!"],
  volley: ["Connects! What a strike on the volley!", "Meets it flush!", "Gets his whole body into it!"],
  header: ["Powers a header goalward!", "Glances it on!", "Gets up well and heads it!"],
  cutback: ["Slides the ball back across goal!", "Cuts it back into the danger area!", "Squares it into the box!"],
  byline_cross: ["Whips the cross in!", "Delivers it into the box!", "Floats one in from the byline!"],
  through_ball: ["Plays it through!", "Threads the pass into the gap!", "Slips it through the lines!"],
  midfield_pass: ["Rolls it across.", "Finds his team-mate.", "Plays it simple and safe."],
  penalty: ["Steps up and strikes it!", "Hits it hard and low!", "Goes for the corner!"],
  free_kick: ["Bends it over the wall!", "Strikes it with venom!", "Curls one toward the top corner!"],
  corner: ["Whips the corner in!", "Delivers it right into the danger zone!", "A teasing delivery from the flag!"],
  buildup: ["Plays it forward!", "Tries to thread it through!", "Sprays it out wide!"],
};

// --- A teammate controls the pass you've just delivered ---
const RECEIVED = [
  "gets there and takes a touch to set it up...",
  "controls it in one motion...",
  "brings it down under pressure...",
  "takes a touch to shift it onto his favoured foot...",
];

// --- The teammate strikes it themselves ---
const RECEIVER_SHOT = [
  "doesn't need a second invitation!",
  "goes for goal!",
  "takes it on first time!",
  "picks his spot and swings a leg at it!",
];

// --- Final outcome, flavored for whoever took the shot ---
const RESULT_SELF: Partial<Record<Outcome, string[]>> = {
  goal: ["GOAL! What a finish!", "IT'S IN! Brilliant strike!", "GOALLL! He's done it!"],
  rebound: ["He follows it in — GOAL from the rebound!", "Pounces on the loose ball — GOAL!"],
  saved: ["Saved! Big stop from the keeper.", "The keeper says no!", "Denied by a fine save!"],
  caught: ["Comfortable take for the keeper.", "Gathered safely by the keeper."],
  tipped: ["Tipped away! Great reactions from the keeper.", "Pushed clear — not to be beaten there."],
  over: ["Blazes it over the bar!", "Drags it high and wide of the target!"],
  post: ["Off the woodwork! So close!", "Cannons back off the post!"],
  wide: ["Wide of the mark!", "Just can't find the target."],
  blocked: ["Blocked! A defender gets across in time.", "Charged down before it can trouble the keeper."],
  out: ["Runs out of play.", "That one's gone out."],
  short: ["Doesn't have the legs on it.", "Comes up just short."],
};

const RESULT_TEAMMATE_TEMPLATES: Partial<Record<Outcome, string[]>> = {
  goal: [
    "GOAL! {role} makes no mistake — that's an assist for you!",
    "IT'S THERE! {role} finishes it off — quality from you to set that up!",
    "GOALLL! {role} buries it!",
  ],
  rebound: ["{role} follows in the rebound — GOAL! Still your assist in the build-up!"],
  saved: ["Great save! {role}'s effort is kept out.", "The keeper denies {role}!"],
  caught: ["Comfortable take — {role}'s shot was straight at the keeper."],
  tipped: ["Tipped over! {role} almost got the finish he deserved."],
  over: ["{role} blazes it over — that chance has gone begging."],
  post: ["Off the post! {role} will be gutted with that."],
  wide: ["{role} drags it wide — so close to rewarding your pass."],
  blocked: ["Blocked! A defender recovers just in time to deny {role}."],
  out: ["{role}'s effort balloons out of play."],
  short: ["{role} can't quite get enough on it."],
};

const RESULT_PASS_FAIL: Partial<Record<Outcome, string[]>> = {
  wide: ["Overhit — nobody could get on the end of that.", "Runs away from everyone — too much on it."],
  short: ["Under-hit — cut out before it reaches anyone.", "Doesn't have the legs to find him."],
  blocked: ["Cut out! A defender reads it well.", "Intercepted before it can find its man."],
  out: ["Runs out of play — possession lost.", "Overhit and out of play."],
  saved: ["Claimed by the keeper before it can find its man."],
  caught: ["The keeper comes to collect it first."],
  tipped: ["The keeper gets there first and knocks it clear."],
};

const RESULT_PASS_OK: Partial<Record<Outcome, string[]>> = {
  delivered: ["Picks him out perfectly — nice bit of play.", "Finds his team-mate — simple and effective."],
};

export function commentaryBuildup(kind: ScenarioKind, rng: () => number): string {
  return pick(BUILDUP[kind], rng);
}

export function commentaryStrike(kind: ScenarioKind, rng: () => number): string {
  return pick(STRIKE[kind], rng);
}

export function commentaryReceived(roleLabel: string, rng: () => number): string {
  const label = roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1);
  return `${label} ${pick(RECEIVED, rng)}`;
}

export function commentaryReceiverShot(roleLabel: string, rng: () => number): string {
  const label = roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1);
  return `...${label} ${pick(RECEIVER_SHOT, rng)}`;
}

// chain: this scenario has a receiver who could take a follow-up shot.
// receiverReached: the ball actually got to them (false = the pass itself failed).
// isPass: a plain pass scenario with no shot chain (e.g. midfield_pass).
export function commentaryResult(
  outcome: Outcome,
  rng: () => number,
  opts: { chain: boolean; receiverReached: boolean; roleLabel?: string; isPass?: boolean },
): string {
  if (opts.chain && !opts.receiverReached) {
    const pool = RESULT_PASS_FAIL[outcome] ?? RESULT_SELF[outcome] ?? ["The move breaks down."];
    return pick(pool, rng);
  }
  if (opts.chain && opts.receiverReached) {
    const template = pick(RESULT_TEAMMATE_TEMPLATES[outcome] ?? ["The chance goes begging for {role}."], rng);
    return template.replace(/\{role\}/g, opts.roleLabel ?? "your team-mate");
  }
  if (outcome === "delivered") {
    return pick(RESULT_PASS_OK.delivered!, rng);
  }
  if (opts.isPass) {
    return pick(RESULT_PASS_FAIL[outcome] ?? RESULT_SELF[outcome] ?? ["The move breaks down."], rng);
  }
  return pick(RESULT_SELF[outcome] ?? ["Play continues."], rng);
}
