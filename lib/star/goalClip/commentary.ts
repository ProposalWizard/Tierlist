/**
 * THE COMMENTARY BOX for goal videos (Leo, 8 Oct 2026: "the commentator
 * needs BIG improvement … better voice, tone, lines, more realistic, more
 * unique voicelines, more fun, funny … even just like fifa goal lines").
 *
 * Two voices, like a real broadcast:
 *  - the LEAD calls the goal as it goes in, in the style of a TV
 *    play-by-play man ("Oh, he's buried it!"), picked to fit HOW it went in
 *    (a header, a volley, from distance, a penalty, a rebound …), then a
 *    short second line for WHAT it means (level, in front, a rout);
 *  - the CO-COMMENTATOR talks over the slow-motion replay, the way a former
 *    player does: the technique, the defending, the odd dry joke.
 *
 * Every line is a recording in public/sfx/<id>.mp3, made by
 * scripts/commentary/generate.py (a free offline neural voice) and
 * replaceable one by one on the Sound Board. No names: a recording made in
 * advance cannot know the scorer.
 *
 * Pure data and pure picking (planAudio in audio.ts uses it). The same goal
 * always gets the same lines.
 */

export type CommentaryVoice = "lead" | "co";

export interface CommentaryLine {
  id: string;
  voice: CommentaryVoice;
  text: string;
}

/** What kind of finish it was, as far as the commentary is concerned. */
export type FinishTag =
  | "header" | "volley" | "long_range" | "penalty" | "free_kick" | "tight_angle"
  | "one_on_one" | "rebound" | "chip" | "curl" | "cutback" | "corner" | "generic";

/** What the goal did to the score. */
export type ScoreTag = "opener" | "level" | "ahead" | "late_winner" | "rout" | "consolation" | "none";

const L = (id: string, text: string): CommentaryLine => ({ id: `cl-${id}`, voice: "lead", text });
const C = (id: string, text: string): CommentaryLine => ({ id: `cc-${id}`, voice: "co", text });

/** The lead's goal calls, by finish. "generic" fits anything. */
export const CALLS: Record<FinishTag, CommentaryLine[]> = {
  generic: [
    L("g1", "And it's in! What a finish!"),
    L("g2", "Oh, he's buried it!"),
    L("g3", "Back of the net!"),
    L("g4", "He scores! Get in there!"),
    L("g5", "Oh, that is a goal! Superb!"),
    L("g6", "In it goes! Absolutely brilliant!"),
    L("g7", "Oh, yes! He's done it!"),
    L("g8", "Bang! Into the net!"),
    L("g9", "That's in! The crowd are on their feet!"),
    L("g10", "Goal! What a moment!"),
  ],
  header: [
    L("h1", "Up he goes! And he's headed it in!"),
    L("h2", "What a header! Powered past the keeper!"),
    L("h3", "Rises highest, and nods it home!"),
  ],
  volley: [
    L("v1", "Oh, on the volley! What a strike!"),
    L("v2", "He hits it first time, and it flies in!"),
    L("v3", "Sweet as you like, on the volley!"),
  ],
  long_range: [
    L("lr1", "Oh, from all of thirty yards! Unbelievable!"),
    L("lr2", "He's let fly, and it's in! What a hit!"),
    L("lr3", "From distance! The keeper never moved!"),
    L("lr4", "Oh, that is a rocket! Top bins!"),
  ],
  penalty: [
    L("p1", "Sends the keeper the wrong way! Penalty scored!"),
    L("p2", "Cool as you like from the spot!"),
    L("p3", "He's tucked it away! No problem at all."),
  ],
  free_kick: [
    L("f1", "Over the wall, and in! What a free kick!"),
    L("f2", "Oh, he's curled it in! Stunning set piece!"),
    L("f3", "The keeper's left rooted! Free kick, goal!"),
  ],
  tight_angle: [
    L("ta1", "From that angle?! Oh, that's ridiculous!"),
    L("ta2", "There was no room, and he's found it!"),
  ],
  one_on_one: [
    L("o1", "Through on goal, keeps his cool, and slots it home!"),
    L("o2", "One on one, and he makes no mistake!"),
    L("o3", "Just him and the keeper, and he's done him!"),
  ],
  rebound: [
    L("r1", "Saved, but it falls kindly, and he pokes it in!"),
    L("r2", "Scrambled in! They all count!"),
    L("r3", "Follows it up, and it's in at the second time of asking!"),
  ],
  chip: [
    L("c1", "Oh, the cheek of it! He's chipped the keeper!"),
    L("c2", "A delicate little dink, and it drops in!"),
  ],
  curl: [
    L("cu1", "Oh, he's bent that one in! Beautiful!"),
    L("cu2", "Curled into the far corner! What a finish!"),
  ],
  cutback: [
    L("cb1", "Pulled back, and swept home!"),
    L("cb2", "The cut-back, the finish, the goal!"),
  ],
  corner: [
    L("k1", "From the corner, and it's in!"),
    L("k2", "Chaos in the box, and they've scored from the corner!"),
  ],
};

/** The lead's second line: what it means. */
export const SCORE_LINES: Record<Exclude<ScoreTag, "none">, CommentaryLine[]> = {
  opener: [L("s-op1", "And the deadlock is broken!"), L("s-op2", "First blood!")],
  level: [L("s-lv1", "And we're all square!"), L("s-lv2", "They're level! Game on!")],
  ahead: [L("s-ah1", "And they're in front!"), L("s-ah2", "They lead!")],
  late_winner: [L("s-lw1", "Surely, that's the winner!"), L("s-lw2", "Late, late drama!")],
  rout: [L("s-ro1", "This is turning into a rout!"), L("s-ro2", "It's raining goals here!")],
  consolation: [L("s-co1", "A goal back, but is it too little, too late?")],
};

/** The co-commentator over the replay. */
export const REPLAY_LINES: Record<"generic" | "header" | "long_range" | "penalty" | "free_kick" | "rebound" | "one_on_one" | "saves", CommentaryLine[]> = {
  generic: [
    C("g1", "Look at the technique there. Really, really good."),
    C("g2", "He's picked his spot. The keeper's got no chance."),
    C("g3", "Watch the movement. He's lost his man completely."),
    C("g4", "You won't see many better than that this season."),
    C("g5", "The defending's poor, mind. Nobody tracks him."),
    C("g6", "That's a proper striker's finish, that."),
    C("g7", "I'd have scored that. In my dreams, anyway."),
    C("g8", "He'll be buying the drinks tonight, I'll tell you."),
    C("g9", "Composure. That's what you want in the box."),
  ],
  header: [
    C("h1", "Look at the leap. He's hung in the air there."),
    C("h2", "Brave, that. He's put his head where it hurts."),
  ],
  long_range: [
    C("lr1", "Why not, from there? Sometimes you've just got to hit it."),
    C("lr2", "Look at the dip on it. The keeper's beaten all ends up."),
  ],
  penalty: [
    C("p1", "Never in doubt. Picked his side, and stuck to it."),
    C("p2", "Calm as you like. Ice in the veins."),
  ],
  free_kick: [
    C("f1", "Over the wall, and down again. You can't coach that."),
    C("f2", "The keeper's taken a step the wrong way, and it's over."),
  ],
  rebound: [
    C("r1", "Not the prettiest, but they all count."),
    C("r2", "That's just being in the right place. Striker's instinct."),
  ],
  one_on_one: [
    C("o1", "He waits, and waits, and the keeper goes down first."),
    C("o2", "Calm finish. Didn't panic for a second."),
  ],
  saves: [
    C("s1", "The keeper made some great stops, but you can't stop that one."),
    C("s2", "Credit to the goalkeeper, he kept them out for so long."),
  ],
};

/** Over a highlights reel, before the replay. */
export const REEL_LINES: CommentaryLine[] = [
  C("reel1", "What a game this has been."),
  C("reel2", "Goals, goals, goals. Brilliant entertainment."),
];

/** Every line, for the generator and the Sound Board. */
export function allCommentaryLines(): CommentaryLine[] {
  return [
    ...Object.values(CALLS).flat(),
    ...Object.values(SCORE_LINES).flat(),
    ...Object.values(REPLAY_LINES).flat(),
    ...REEL_LINES,
  ];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** One line from a list, picked by a key: the same key always the same line. */
export function pickLine(list: CommentaryLine[], key: string, avoid: string[] = []): CommentaryLine {
  const pool = list.filter(l => !avoid.includes(l.id));
  const from = pool.length ? pool : list;
  return from[hash(key) % from.length];
}

/** The goal call: a line for this finish two times in three, else a general one. */
export function pickCall(finish: FinishTag, key: string, avoid: string[] = []): CommentaryLine {
  const own = CALLS[finish];
  const useOwn = finish !== "generic" && own.length > 0 && hash(`${key}:own`) % 3 !== 0;
  return pickLine(useOwn ? own : CALLS.generic, key, avoid);
}

export function pickReplayLine(finish: FinishTag, saves: number, key: string, avoid: string[] = []): CommentaryLine {
  if (saves >= 2 && hash(`${key}:saves`) % 2 === 0) return pickLine(REPLAY_LINES.saves, key, avoid);
  const own = (REPLAY_LINES as Record<string, CommentaryLine[]>)[finish];
  const useOwn = !!own && hash(`${key}:rown`) % 2 === 0;
  return pickLine(useOwn ? own : REPLAY_LINES.generic, key, avoid);
}

/** Seconds each line lasts (filled in by the generator; a guess if missing). */
export function lineSeconds(id: string, table: Record<string, number>): number {
  return table[id] ?? 1.8;
}
