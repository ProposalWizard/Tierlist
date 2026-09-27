/**
 * MORE COMMENTARY, AND NO REPEATS (Mikey, 27 Sep 2026: "I am still seeing a
 * lot of the same commentary… it shouldn't do that").
 *
 * Measured before: 25.7 lines a match, 8.9 of them repeats (35%) — the quiet
 * and missed-chance banks had 8 lines each, picked at random with no memory.
 * This file adds lines to every bank, and `pickFresh` stops a line coming
 * back while unused ones are left.
 *
 * `{club}` is your club's short name, `{role}` the team-mate who has it.
 */

/**
 * Pick a line that hasn't been used recently. Draws exactly ONE random
 * number, the same as a plain pick, so nothing else in a seeded match moves:
 * if that line was used recently it steps on to the next unused one.
 */
export function pickFresh(pool: string[], rng: () => number, recent: string[], keep = 40): string {
  const n = pool.length;
  const start = Math.min(n - 1, Math.floor(rng() * n));
  let chosen = pool[start];
  for (let k = 0; k < n; k++) {
    const cand = pool[(start + k) % n];
    if (!recent.includes(cand)) { chosen = cand; break; }
  }
  recent.push(chosen);
  if (recent.length > Math.min(keep, Math.max(1, n - 1))) recent.splice(0, recent.length - Math.min(keep, Math.max(1, n - 1)));
  return chosen;
}

export const EXTRA_QUIET_USER = [
  "{club} knock it about in midfield, probing.",
  "{club} keep the ball well without really threatening.",
  "A neat one-two for {club} on the edge of the area, but it's crowded out.",
  "{club} win a throw-in deep in the opposition half.",
  "{club} build again from the back.",
  "{club} look to go down the left.",
  "{club} try it down the right this time.",
  "A loose pass from {club} and they have to scramble back.",
  "{club} win the second ball and go again.",
  "{club} earn a free kick in the middle of the park.",
  "The {club} full-back overlaps, but the cross is cut out.",
  "{club} are camped in the opposition half.",
  "{club} slow things right down.",
  "A clever flick from a {club} forward almost opens it up.",
  "{club} recycle it back to the keeper.",
  "{club} press high and win it back.",
  "{club} knock it long, looking for the runner.",
  "Plenty of the ball for {club}, not much to show for it yet.",
  "{club} ask questions down the flank.",
  "{club} fans roar as their side wins a tackle.",
  "{club} work a short corner routine that comes to nothing.",
  "A measured spell from {club}.",
];
export const EXTRA_QUIET_OPP = [
  "They knock it about in midfield, probing.",
  "They keep the ball well without really threatening.",
  "A neat one-two on the edge of your area is crowded out.",
  "They win a throw-in deep in your half.",
  "They build again from the back.",
  "They look to go down their left.",
  "They try it down the right this time.",
  "A loose pass from them, and your side nearly pounce.",
  "They win the second ball and go again.",
  "They earn a free kick in the middle of the park.",
  "Their full-back overlaps, but the cross is cut out.",
  "They pin your side back for a spell.",
  "They slow things right down.",
  "A clever flick from their forward almost opens you up.",
  "They recycle it back to their keeper.",
  "They press high and win it back.",
  "They go long, looking for their striker.",
  "Plenty of the ball for them, not much to show for it yet.",
  "They ask questions down the flank.",
  "Their fans roar as a tackle goes in.",
  "A short corner routine from them comes to nothing.",
  "A spell of pressure from them.",
];

export const EXTRA_MISS_USER = [
  "{club} curl one just past the post.",
  "A {club} header thuds against the bar.",
  "{club} get in behind but the shot is straight at the keeper.",
  "{club} scuff a good chance from twelve yards.",
  "A fierce drive from {club} is beaten away.",
  "{club} have a penalty shout waved away.",
  "{club} work the keeper with a low shot.",
  "A {club} volley flies into the stand.",
  "{club} can't turn the loose ball home in a goalmouth scramble.",
  "{club} see a shot deflected just wide for a corner.",
  "The keeper spreads himself to stop {club} at close range.",
  "{club} lift a chip over the keeper and the bar.",
  "{club} hit the side netting.",
  "A {club} free kick is tipped over.",
];
export const EXTRA_MISS_OPP = [
  "They curl one just past your post.",
  "A header from them thuds against the bar.",
  "They get in behind but shoot straight at your keeper.",
  "They scuff a good chance from twelve yards.",
  "A fierce drive from them is beaten away.",
  "They have a penalty shout waved away.",
  "They work your keeper with a low shot.",
  "A volley from them flies into the stand.",
  "A goalmouth scramble — your side clear it.",
  "Their shot deflects just wide for a corner.",
  "Your keeper spreads himself to stop them at close range.",
  "They try a chip that drifts over the bar.",
  "They hit the side netting.",
  "Their free kick is tipped over.",
];

/** Your side's goal, named: `{name}` is the scorer. */
export const GOAL_LINES = [
  "⚽ {name} scores!",
  "⚽ GOAL — {name}!",
  "⚽ {name} finds the net!",
  "⚽ {name} puts it away!",
  "⚽ {name} makes no mistake!",
  "⚽ {name} with the finish!",
  "⚽ It's {name}!",
  "⚽ {name} slots it home!",
];
export const ASSIST_LINES = [
  "🎯 {name} assists!",
  "🎯 Set up by {name}.",
  "🎯 {name} with the assist.",
  "🎯 {name} laid it on.",
  "🎯 Great ball from {name}.",
];

/** Extra lines for the per-chance commentary pools, keyed like the pools. */
export const EXTRA_BUILDUP: Record<string, string[]> = {
  one_on_one: [
    "Nobody near him — the keeper has to come.",
    "He's away! Only the goalkeeper to beat.",
    "Bursts clear, the whole ground on its feet.",
    "Through, and the defenders are chasing shadows.",
    "The offside trap fails — he's in!",
  ],
  tight_angle: [
    "Driven wide by the defender — the angle is closing.",
    "Out by the post — shot or cross?",
    "Only a sliver of the goal to aim at.",
    "Right on the edge of the six-yard box, wide of goal.",
  ],
  long_range: [
    "Space opens up thirty yards out.",
    "Nobody steps out to him — he could let one go.",
    "Time and room outside the box.",
    "The defence sits deep and invites the shot.",
  ],
  volley: [
    "It drops out of the sky at the edge of the box!",
    "A cleared corner falls invitingly!",
    "The ball's bouncing up nicely — hit it!",
    "Knocked down into his path — on the volley?",
  ],
  header: [
    "A looping cross towards the far post!",
    "He's timed his run into the box perfectly!",
    "It's a great delivery — who gets there first?",
    "Arriving at pace to meet the cross!",
  ],
  cutback: [
    "Round the full-back and into the box!",
    "Has the byline — and bodies arriving!",
    "Drives to the edge of the six-yard box — cutback on.",
    "Gets outside his man — a pull-back looks on.",
  ],
  byline_cross: [
    "Skips past his man down the wing.",
    "Plenty of space out wide to pick a cross.",
    "The winger has time — who's in the box?",
    "Gets to the corner of the area — cross coming.",
  ],
  through_ball: [
    "A runner peels off the shoulder of the last man.",
    "There's a gap between centre-back and full-back.",
    "Head up — there's a pass on here.",
    "The striker is making the run — does he see it?",
  ],
  midfield_pass: [
    "Picks it up in the centre circle.",
    "A moment to get the team moving forward.",
    "Takes it on the half-turn in midfield.",
    "Looks for a way to keep the move going.",
  ],
  penalty: [
    "Places the ball on the spot. The keeper bounces on his line.",
    "A penalty — the biggest moment of the match.",
    "Everyone else back outside the area. Just him and the keeper.",
    "Long run-up or short? He takes his time.",
  ],
  free_kick: [
    "A free kick just outside the box — the wall edges forward.",
    "Stands over it. The keeper lines up his wall.",
    "Prime territory for a free kick.",
    "The referee paces out the ten yards.",
  ],
  corner: [
    "Arm up at the corner flag — a routine coming?",
    "Big men up for this one.",
    "The keeper's crowded as the corner's swung in.",
    "Jostling in the six-yard box before the corner.",
  ],
  buildup: [
    "Collects it from the centre-back and turns.",
    "The press is on — find a way out.",
    "Time on the ball in his own half.",
    "Starts the attack from deep.",
  ],
};

export const EXTRA_STRIKE: Record<string, string[]> = {
  one_on_one: ["Picks his spot…", "Keeps his cool and shoots!", "Tries to round the keeper… no, he shoots!", "Low and hard!"],
  tight_angle: ["Hammers it at the near post!", "Tries to beat the keeper at his near post!", "Goes for goal from nowhere!"],
  long_range: ["Rifles one towards goal!", "Catches it sweetly from range!", "Tries his luck from distance!"],
  volley: ["Hits it on the full!", "Swings a leg and catches it!", "Leans back and volleys!"],
  header: ["Thumps a header towards goal!", "Nods it down towards the corner!", "Meets it with his forehead!"],
  cutback: ["Pulls it back!", "Rolls it into the path of the runner!", "Picks out the man arriving!"],
  byline_cross: ["Hangs it up at the far post!", "Drills it across the box!", "Curls it in towards the penalty spot!"],
  through_ball: ["Slides it in behind!", "Weights it perfectly for the run!", "Clips it over the top!"],
  midfield_pass: ["Moves it on.", "Keeps it ticking over.", "Knocks it sideways."],
  penalty: ["Sends it to the keeper's left!", "Goes down the middle!", "Blasts it!"],
  free_kick: ["Whips it over the wall!", "Goes for power!", "Tries to go round the wall!"],
  corner: ["Swings in an outswinger!", "Drives it to the near post!", "Floats it to the back stick!"],
  buildup: ["Spreads it wide!", "Breaks the lines with a pass!", "Plays it into midfield!"],
};

export const EXTRA_RECEIVED = [
  "kills it dead with his first touch...",
  "cushions it down...",
  "takes it in his stride...",
  "gets it under control on the turn...",
  "lets it run across his body...",
  "chests it down...",
];

export const EXTRA_RECEIVER_SHOT = [
  "lets fly!",
  "tries his luck!",
  "hits it without hesitation!",
  "swings a boot at it!",
  "shapes to shoot — and does!",
  "goes for the corner!",
];

export const EXTRA_RESULT_SELF: Record<string, string[]> = {
  goal: ["GOAL! Right in the corner!", "GOAL! The keeper had no chance!", "What a strike — it's in!", "Back of the net!"],
  rebound: ["First to the rebound — GOAL!", "Keeps his head in the scramble — GOAL!"],
  saved: ["What a stop!", "Kept out by the keeper's legs!", "The keeper gets a strong hand to it!"],
  caught: ["Straight into the keeper's arms.", "Easy for the keeper."],
  tipped: ["Fingertips! Turned round the post.", "Clawed away at full stretch!"],
  over: ["Sails over the crossbar.", "Too much on it — over the top.", "Into row Z!"],
  post: ["Rattles the post!", "Clips the frame of the goal!"],
  wide: ["Just past the post!", "Pulled wide.", "Flashes across goal and wide."],
  blocked: ["Straight into a defender.", "Deflected away!"],
  tackled: ["Nicked away just in time.", "A superb tackle stops him."],
  out: ["Out for a goal kick.", "Straight out of play."],
  short: ["Not enough on it.", "Rolls tamely into nothing."],
  offside: ["Flagged offside.", "The assistant's flag goes up."],
};

export const EXTRA_RESULT_TEAMMATE: Record<string, string[]> = {
  goal: ["GOAL! {role} finishes your pass!", "{role} scores — and you made it!", "GOAL! Brilliant ball, and {role} does the rest!"],
  rebound: ["{role} tucks away the rebound — GOAL, from your ball!"],
  saved: ["{role} is denied by the keeper.", "A fine save stops {role}."],
  caught: ["{role}'s effort is gathered.", "Easy take from {role}'s shot."],
  tipped: ["{role} forces the keeper to tip it away."],
  over: ["{role} skies it.", "{role} leans back and it's over."],
  post: ["{role} hits the woodwork!", "{role} rattles the post!"],
  wide: ["{role} pulls it wide.", "{role} can't keep it on target."],
  blocked: ["{role}'s shot is charged down.", "A defender blocks {role}'s effort."],
  tackled: ["{role} is dispossessed before he can shoot."],
  offside: ["{role} strayed offside."],
  out: ["{role}'s shot goes out of play."],
  short: ["{role} doesn't get enough on it."],
};
