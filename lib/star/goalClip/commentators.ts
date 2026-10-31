/**
 * DIFFERENT COMMENTATORS (Leo, 31 Oct 2026: "VARYING COMMENTATORS").
 *
 * Four commentary teams, each a lead (calls the goal) and a co-commentator
 * (talks over the replay). Every commentator has his or her OWN lines, in
 * his or her own style, and an own voice:
 *
 *   matchday  The Anchor (classic, measured)  + The Old Pro (former player)
 *   bignight  The Poet (lyrical, big nights)  + The Analyst (tactics)
 *   lateshow  The Deadpan (dry, understated)  + The Old Pro
 *   fantv     The Live Wire (excitable)       + The Mate (laid-back, jokey)
 *
 * The voices are ORIGINAL: Chatterbox (MIT) conditioned on reference
 * recordings read by Kokoro's own bundled synthetic voices (Apache-2.0). No
 * real person was recorded, cloned or imitated, and no line quotes a real
 * commentator. Recordings: public/sfx/teams/<id>.mp3, made by
 * scripts/commentary/generate_teams.py (voices and licences in
 * public/sfx/teams/LICENSE.txt).
 *
 * Plays only when Leo's switch and its "Different commentators" part are on
 * (commentaryVoice.ts → "teams"). Off: nothing here is read.
 *
 * Which team: by the MATCH (the same match always gets the same team, so all
 * its goal videos sound like one broadcast), or by the ACCOUNT posting the
 * video when the caller passes it: an official TV account (club, league,
 * competition) gets one of the three TV teams, any other account the fan
 * TV team. No account given: any of the four, by the match.
 *
 * Pure data and pure picking.
 */
import type { CommentaryBank, CommentaryLine } from "./commentary";

export type TeamId = "matchday" | "bignight" | "lateshow" | "fantv";
export type LeadId = "anchor" | "poet" | "deadpan" | "wire";
export type CoId = "pro" | "analyst" | "mate";

export interface Commentator {
  id: LeadId | CoId;
  name: string;
  role: "lead" | "co";
  /** In words, for the A/B page and the report. */
  sounds: string;
}

export const COMMENTATORS: Record<LeadId | CoId, Commentator> = {
  anchor: { id: "anchor", name: "The Anchor", role: "lead", sounds: "Deep, older British man. Measured and authoritative; lifts for the goal but never shrieks." },
  poet: { id: "poet", name: "The Poet", role: "lead", sounds: "British woman, slower and warmer. Lyrical: paints the goal in pictures." },
  deadpan: { id: "deadpan", name: "The Deadpan", role: "lead", sounds: "British woman, level and dry. Understated jokes; barely raises her voice." },
  wire: { id: "wire", name: "The Live Wire", role: "lead", sounds: "Younger British man, fast and loud. Fan-TV energy: shouts, repeats himself." },
  pro: { id: "pro", name: "The Old Pro", role: "co", sounds: "Slow, calm British man. A former player: blunt, warm, the odd story." },
  analyst: { id: "analyst", name: "The Analyst", role: "co", sounds: "Crisp British woman. Tactics: space, runs, the decision." },
  mate: { id: "mate", name: "The Mate", role: "co", sounds: "Relaxed American-accented man. Jokes, slang, loves a banger." },
};

export interface Team { id: TeamId; name: string; lead: LeadId; co: CoId; tv: boolean }

export const TEAMS: Record<TeamId, Team> = {
  matchday: { id: "matchday", name: "Matchday", lead: "anchor", co: "pro", tv: true },
  bignight: { id: "bignight", name: "Big Night", lead: "poet", co: "analyst", tv: true },
  lateshow: { id: "lateshow", name: "Late Show", lead: "deadpan", co: "pro", tv: true },
  fantv: { id: "fantv", name: "Fan TV", lead: "wire", co: "mate", tv: false },
};
export const TEAM_IDS = Object.keys(TEAMS) as TeamId[];

// ── The lines ───────────────────────────────────────────────────────────────

type LeadBank = Pick<CommentaryBank, "calls" | "scoreLines" | "lateCalls">;
type CoBank = Pick<CommentaryBank, "replayLines" | "reelLines" | "lateReplayLines">;

const lead = (who: LeadId) => (id: string, text: string): CommentaryLine => ({ id: `cl-${who}-${id}`, voice: "lead", text });
const co = (who: CoId) => (id: string, text: string): CommentaryLine => ({ id: `cc-${who}-${id}`, voice: "co", text });

const A = lead("anchor");
const ANCHOR: LeadBank = {
  calls: {
    generic: [
      A("g1", "And he's scored! A fine finish."),
      A("g2", "It's there! Struck with real authority."),
      A("g3", "He scores! And the stadium rises."),
      A("g4", "Into the net it goes! Well taken."),
      A("g5", "That's a goal, and a very good one."),
      A("g6", "He finds the net! Composed, and clinical."),
    ],
    header: [A("h1", "A firm header, and it's in!"), A("h2", "He meets it with his head! Goal!")],
    volley: [A("v1", "Struck on the volley! And it's in!"), A("v2", "A clean volley, straight into the net!")],
    long_range: [
      A("lr1", "From long range! What a strike that is!"),
      A("lr2", "He tries his luck from distance, and scores!"),
      A("lr3", "A thunderous effort! Right into the top corner!"),
    ],
    penalty: [A("p1", "Penalty, converted. Calmly done."), A("p2", "The keeper goes one way, the ball the other. Goal.")],
    free_kick: [A("f1", "A superb free kick! Over the wall, and in!"), A("f2", "Right into the corner from the free kick!")],
    tight_angle: [A("ta1", "From the tightest of angles! Remarkable!")],
    one_on_one: [A("o1", "Clean through, and he finishes well!"), A("o2", "Alone against the keeper, and he wins the duel.")],
    rebound: [A("r1", "Saved, but he follows up! Goal!"), A("r2", "A scramble, and it's bundled in!")],
    chip: [A("c1", "He lifts it over the keeper! Lovely touch.")],
    curl: [A("cu1", "Curled, beautifully, into the far corner!")],
    cutback: [A("cb1", "Pulled back, and side-footed home!")],
    corner: [A("k1", "From the corner, and they've scored!")],
  },
  scoreLines: {
    opener: [A("s-op", "They have the opening goal.")],
    level: [A("s-lv", "And the scores are level.")],
    ahead: [A("s-ah", "They're in front now.")],
    late_winner: [A("s-lw", "That should be the winner.")],
    rout: [A("s-ro", "This is becoming very one-sided.")],
    consolation: [A("s-co", "A goal back. A consolation, perhaps.")],
  },
  lateCalls: {
    winner: [
      A("late1", "In the final minutes, he's won it!"),
      A("late2", "At the very end, the winning goal!"),
      A("late3", "Surely that's the winner! Right at the end!"),
    ],
    level: [A("late4", "Level, right at the death!"), A("late5", "A late equaliser! They're not beaten yet!")],
  },
};

const P = lead("poet");
const POET: LeadBank = {
  calls: {
    generic: [
      P("g1", "Oh, and it sings into the net!"),
      P("g2", "It rises like a hymn, and it's in!"),
      P("g3", "The net ripples, and the night is his!"),
      P("g4", "Oh, that is poetry, in a pair of boots!"),
      P("g5", "Written in the stars, and now in the net!"),
      P("g6", "And the whole stadium breathes out, as one!"),
    ],
    header: [P("h1", "He climbs into the sky, and heads it home!"), P("h2", "Up he soars, like a gull on the wind, and it's in!")],
    volley: [P("v1", "He meets it in mid air! Oh, the beauty of it!"), P("v2", "A volley, as sweet as a summer morning!")],
    long_range: [
      P("lr1", "From so far away, and it flies like an arrow!"),
      P("lr2", "Oh, it travels, and travels, and it's in!"),
      P("lr3", "A shooting star, into the top corner!"),
    ],
    penalty: [P("p1", "From the spot, as calm as still water."), P("p2", "The keeper guesses, and the ball whispers past him.")],
    free_kick: [P("f1", "Over the wall, like a falling leaf, and in!"), P("f2", "Oh, he has painted that one into the corner!")],
    tight_angle: [P("ta1", "There was no door, so he made one!")],
    one_on_one: [P("o1", "Alone with his thoughts, and he's done it!"), P("o2", "The keeper waits, and he slips it past, so softly.")],
    rebound: [P("r1", "Saved, but fate gives him a second chance!"), P("r2", "Out of the chaos, a goal!")],
    chip: [P("c1", "Oh, he floats it like a feather over the keeper!")],
    curl: [P("cu1", "It bends like a rainbow into the far corner!")],
    cutback: [P("cb1", "Rolled back, and stroked home like a brushstroke!")],
    corner: [P("k1", "From the corner, a storm in the box, and a goal!")],
  },
  scoreLines: {
    opener: [P("s-op", "And so the story begins!")],
    level: [P("s-lv", "And the balance is restored!")],
    ahead: [P("s-ah", "And now, they lead!")],
    late_winner: [P("s-lw", "This could be the final chapter!")],
    rout: [P("s-ro", "This has become a procession!")],
    consolation: [P("s-co", "A small light, on a dark evening.")],
  },
  lateCalls: {
    winner: [
      P("late1", "At the very last breath, he's won it!"),
      P("late2", "In the final heartbeat, the winner!"),
      P("late3", "Out of nowhere, the dream comes true!"),
    ],
    level: [P("late4", "At the death, hope returns! They're level!"), P("late5", "They refused to fall! Level, at the end!")],
  },
};

const D = lead("deadpan");
const DEADPAN: LeadBank = {
  calls: {
    generic: [
      D("g1", "And that's a goal. Rather a good one."),
      D("g2", "In it goes. No fuss."),
      D("g3", "Well. That's in."),
      D("g4", "Goal. The keeper won't enjoy the replay."),
      D("g5", "That'll do nicely."),
      D("g6", "He scores. Someone check on the defence."),
    ],
    header: [D("h1", "A header. Quite a good one, actually."), D("h2", "Nodded in. Nobody bothered to jump with him.")],
    volley: [D("v1", "Volleyed in. Show off."), D("v2", "First time, and in. Tidy.")],
    long_range: [
      D("lr1", "From there. Well, why not."),
      D("lr2", "That was a long way out. It's in all the same."),
      D("lr3", "Top corner, from distance. I suppose that's allowed."),
    ],
    penalty: [D("p1", "Penalty. Scored. As planned."), D("p2", "The keeper went one way. The ball didn't.")],
    free_kick: [D("f1", "Over the wall, and in. The wall looks embarrassed."), D("f2", "A free kick, put away rather neatly.")],
    tight_angle: [D("ta1", "From that angle. Geometry is overrated.")],
    one_on_one: [D("o1", "Through, alone, and finished. Simple, really."), D("o2", "One on one. He made it look easy.")],
    rebound: [D("r1", "Saved. Then not saved. Goal."), D("r2", "Scrambled in. It won't win prizes. Still counts.")],
    chip: [D("c1", "Chipped. The keeper may need a moment.")],
    curl: [D("cu1", "Curled in. Very nice. Very nice indeed.")],
    cutback: [D("cb1", "Cut back, swept in. Textbook.")],
    corner: [D("k1", "From a corner. Defending was optional.")],
  },
  scoreLines: {
    opener: [D("s-op", "One nil, then.")],
    level: [D("s-lv", "Level. As you were.")],
    ahead: [D("s-ah", "They're ahead. For now.")],
    late_winner: [D("s-lw", "That's probably the winner.")],
    rout: [D("s-ro", "This has got rather out of hand.")],
    consolation: [D("s-co", "A goal back. Small comfort.")],
  },
  lateCalls: {
    winner: [
      D("late1", "Oh. He's won it. At the death."),
      D("late2", "Well. That's the game, I'd say."),
      D("late3", "Last minute. Winner. Remarkable, actually."),
    ],
    level: [D("late4", "Level, at the very end. How annoying for them."), D("late5", "A late equaliser. Nobody saw that coming.")],
  },
};

const W = lead("wire");
const WIRE: LeadBank = {
  calls: {
    generic: [
      W("g1", "No way! No way! He's scored!"),
      W("g2", "Get in! Get in! What a goal!"),
      W("g3", "Oh my days! That is in!"),
      W("g4", "Are you serious? What a finish!"),
      W("g5", "Yes! Yes! Yes! Goal!"),
      W("g6", "Oh, he's done it! I'm losing my voice here!"),
    ],
    header: [W("h1", "Header! Goal! Unreal!"), W("h2", "What a leap! He's nodded it in!")],
    volley: [W("v1", "Volley! Oh my word, what a hit!"), W("v2", "First time! Smashed it! Goal!")],
    long_range: [
      W("lr1", "From there? Are you kidding me?"),
      W("lr2", "Absolute rocket! Top corner!"),
      W("lr3", "He's hit that from miles out! Unbelievable!"),
    ],
    penalty: [W("p1", "Penalty scored! Ice cold!"), W("p2", "Keeper's gone the wrong way! Easy!")],
    free_kick: [W("f1", "Free kick! Over the wall! Get in!"), W("f2", "He's whipped it in! What a free kick!")],
    tight_angle: [W("ta1", "No angle! No problem! Goal!")],
    one_on_one: [W("o1", "He's through! He's through! Goal!"), W("o2", "One on one, and he's buried it!")],
    rebound: [W("r1", "Saved! Rebound! Goal! Chaos!"), W("r2", "Scrappy! Don't care! Goal!")],
    chip: [W("c1", "He's chipped him! The cheek of it!")],
    curl: [W("cu1", "Bent it in! Oh, that's filthy!")],
    cutback: [W("cb1", "Cut it back! Smashed home!")],
    corner: [W("k1", "Corner! Chaos! Goal!")],
  },
  scoreLines: {
    opener: [W("s-op", "Off the mark! First goal!")],
    level: [W("s-lv", "All square! Game on!")],
    ahead: [W("s-ah", "In front! Come on!")],
    late_winner: [W("s-lw", "That's the winner! Got to be!")],
    rout: [W("s-ro", "This is a battering!")],
    consolation: [W("s-co", "One back! Too late, though?")],
  },
  lateCalls: {
    winner: [
      W("late1", "Last minute! Last minute! He's won it!"),
      W("late2", "I can't breathe! He's won it at the death!"),
      W("late3", "Are you joking? Right at the end! Winner!"),
    ],
    level: [W("late4", "Late equaliser! Get in!"), W("late5", "At the death! Level! Unreal!")],
  },
};

const O = co("pro");
const PRO: CoBank = {
  replayLines: {
    generic: [
      O("g1", "Look at that first touch. Sets it up lovely."),
      O("g2", "He's gone across the keeper. Textbook."),
      O("g3", "The defenders will be watching that back on Monday."),
      O("g4", "That's the kind you practise all week."),
      O("g5", "He wanted it more. Simple as that."),
      O("g6", "Watch his eyes. He knew where it was going."),
      O("g7", "The centre half's ball watching there."),
      O("g8", "Great movement. He's peeled off the shoulder."),
      O("g9", "When I played, I'd have given anything for that finish."),
      O("g10", "No backlift. The keeper can't read it."),
    ],
    header: [O("h1", "He's attacked that ball. Real desire."), O("h2", "Timing the run. That's half of heading.")],
    long_range: [O("lr1", "He's caught that sweet as a nut."), O("lr2", "When it sits up like that, you hit it.")],
    penalty: [O("p1", "Picks his corner, doesn't change his mind."), O("p2", "Short run up, cool head. Lovely.")],
    free_kick: [O("f1", "Up and down. The keeper's a spectator."), O("f2", "He's practised that a thousand times.")],
    rebound: [O("r1", "Strikers follow in. That's the job."), O("r2", "The keeper should push that wide, mind.")],
    one_on_one: [O("o1", "He's opened his body. Keeper's beaten."), O("o2", "Never rushed it. Proper composure.")],
    saves: [O("s1", "The keeper's been brilliant, but not this time."), O("s2", "He kept them in it, until now.")],
  },
  reelLines: [O("reel1", "Some game, this. What a watch."), O("reel2", "End to end, and I've loved every minute."), O("reel3", "You don't get many like this one.")],
  lateReplayLines: [
    O("late1", "You never stop running. That's the lesson."),
    O("late2", "Heartbreak for one lot, heaven for the other."),
    O("late3", "I've got goosebumps, honestly."),
  ],
};

const N = co("analyst");
const ANALYST: CoBank = {
  replayLines: {
    generic: [
      N("g1", "Look at the space between the lines. He's found it."),
      N("g2", "Two touches. One to set, one to score."),
      N("g3", "The full back is too narrow, and they punish it."),
      N("g4", "The pass splits two defenders. That's the key."),
      N("g5", "Watch the third man run. Nobody picks him up."),
      N("g6", "He shifts it onto his stronger foot, and that's it."),
      N("g7", "Quick feet, quick head. Decision made early."),
      N("g8", "They overload one side, then switch it."),
      N("g9", "He checks his shoulder twice before it arrives."),
      N("g10", "Low and hard across the keeper. The right choice."),
    ],
    header: [N("h1", "Look at the run. Near post, across his marker."), N("h2", "He gets his neck into it. Real power.")],
    long_range: [N("lr1", "Nobody closes him down. You can't give him that time."), N("lr2", "Look at the dip. It drops late, under the bar.")],
    penalty: [N("p1", "He watches the keeper, then rolls it the other way."), N("p2", "High and hard. Unsaveable.")],
    free_kick: [N("f1", "Over the wall, then down. That's the technique."), N("f2", "The wall jumps, and it goes underneath. Smart.")],
    rebound: [N("r1", "First to react. That's anticipation."), N("r2", "The keeper parries it into the middle. A mistake.")],
    one_on_one: [N("o1", "He waits for the keeper to commit. Patience."), N("o2", "A little drop of the shoulder, and the keeper's gone.")],
    saves: [N("s1", "The keeper had kept them out all game."), N("s2", "Several saves before that. This one, unstoppable.")],
  },
  reelLines: [N("reel1", "Plenty to talk about in this one."), N("reel2", "Both sides attacking. Great to watch."), N("reel3", "A tactical battle, with goals. Wonderful.")],
  lateReplayLines: [
    N("late1", "The fitness shows, late on. That's preparation."),
    N("late2", "They kept believing, and it's paid off."),
    N("late3", "A pressure moment, and he handled it perfectly."),
  ],
};

const M = co("mate");
const MATE: CoBank = {
  replayLines: {
    generic: [
      M("g1", "That is so clean. I'm watching it again."),
      M("g2", "The defender's gone for a sandwich there."),
      M("g3", "Honestly, I'd frame that and put it on my wall."),
      M("g4", "He's cooking. He's absolutely cooking."),
      M("g5", "Did you see that? Unreal."),
      M("g6", "The keeper's had a shocker, let's be honest."),
      M("g7", "That's going straight in the highlights."),
      M("g8", "I'm not even mad. That's just good."),
      M("g9", "Somebody give him a pay rise."),
      M("g10", "Clip it. Post it. That's a banger."),
    ],
    header: [M("h1", "Jumped like he had springs in his boots."), M("h2", "Bullet header. Proper old school.")],
    long_range: [M("lr1", "He's hit that with his whole life."), M("lr2", "He thought he was in a video game.")],
    penalty: [M("p1", "Ice cold. Didn't even blink."), M("p2", "The keeper dived for a different ball, I think.")],
    free_kick: [M("f1", "That free kick needs its own song."), M("f2", "The wall did nothing. Absolutely nothing.")],
    rebound: [M("r1", "Ugly goal. Still counts. Love it."), M("r2", "Right place, right time. That's a poacher.")],
    one_on_one: [M("o1", "Calm as you like. Made it look easy."), M("o2", "The keeper came out and just gave up.")],
    saves: [M("s1", "The keeper's been a wall all game. Not this time."), M("s2", "Fair play to the keeper, but no chance there.")],
  },
  reelLines: [M("reel1", "What a game. My heart can't take this."), M("reel2", "Goals everywhere. I love it."), M("reel3", "Best game I've watched all year, easily.")],
  lateReplayLines: [
    M("late1", "I'm shaking. Actually shaking."),
    M("late2", "Never leave early. Never."),
    M("late3", "That's going to be on loop all week."),
  ],
};

const LEADS: Record<LeadId, LeadBank> = { anchor: ANCHOR, poet: POET, deadpan: DEADPAN, wire: WIRE };
const COS: Record<CoId, CoBank> = { pro: PRO, analyst: ANALYST, mate: MATE };

/** One team's lines, in the shape planAudio reads. */
export function teamBank(team: TeamId): CommentaryBank {
  const t = TEAMS[team] ?? TEAMS.matchday;
  return { ...LEADS[t.lead], ...COS[t.co] };
}

/** Every line one commentator says. */
export function commentatorLines(who: LeadId | CoId): CommentaryLine[] {
  if (who in LEADS) {
    const b = LEADS[who as LeadId];
    return [...Object.values(b.calls).flat(), ...Object.values(b.scoreLines).flat(), ...Object.values(b.lateCalls).flat()];
  }
  const b = COS[who as CoId];
  return [...Object.values(b.replayLines).flat(), ...b.reelLines, ...b.lateReplayLines];
}

/** Every team line, for the generator (scripts/commentary/generate_teams.py). */
export function allTeamLines(): (CommentaryLine & { who: LeadId | CoId })[] {
  return (Object.keys(COMMENTATORS) as (LeadId | CoId)[]).flatMap(who => commentatorLines(who).map(l => ({ ...l, who })));
}

// ── Who commentates ─────────────────────────────────────────────────────────

/** The account posting the video (a feed post's author), when the caller knows it. */
export interface CommentaryPoster { archetype?: string; platform?: string; handle?: string }

/** The match a goal belongs to. */
export interface MatchOf { home?: string; away?: string; season?: number; week?: number }

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The key one match is known by: every goal of it gets the same team. */
export function matchKeyOf(m: MatchOf): string {
  return `${m.home ?? ""}|${m.away ?? ""}|${m.season ?? ""}|${m.week ?? ""}`;
}

/** Official TV accounts: the club, the league, the competition. */
const TV_ARCHETYPES = new Set(["club", "league", "competition"]);

/**
 * Which team commentates. The same match (and account) always gets the same
 * team. An official TV account: one of the three TV teams. Any other account
 * that posts a video with commentary: Fan TV. No account: any of the four.
 */
export function teamFor(matchKey: string, poster?: CommentaryPoster): TeamId {
  const tvTeams = TEAM_IDS.filter(t => TEAMS[t].tv);
  if (poster && (poster.archetype || poster.platform)) {
    if (poster.archetype && TV_ARCHETYPES.has(poster.archetype)) return tvTeams[hash(`tv:${matchKey}`) % tvTeams.length];
    return "fantv";
  }
  return TEAM_IDS[hash(`team:${matchKey}`) % TEAM_IDS.length];
}
