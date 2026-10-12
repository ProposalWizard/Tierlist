import type { Template } from "./index";

/**
 * RETIREMENTS AND REGENS (detect/retirements.ts).
 *
 * Every archetype that is interested in these events' tags has its own
 * exact lines here — several each, because a cycle never says the same line
 * twice and up to five supporters' accounts can pick one event. Without
 * enough exact lines the chooser would fall back to a generic, which for
 * these events would be a sentence about nothing.
 *
 * A number is only ever named by a line that needs it; an event without
 * it (no goals this season) simply cannot pick that line.
 */

const TR = ["teammate-retires"];
const LR = ["legend-retires"];
const RW = ["regen-watch"];

export const RETIREMENT_TEMPLATES: Template[] = [
  // ── Your own team-mate hangs them up ──────────────────────────────────────
  { id: "tr-club-thanks", archetype: "club", events: TR,
    body: "Thank you, {player}. 💙 After a wonderful career, our {role} retires at {age}. You will always be one of us." , weight: 3 },
  { id: "tr-club-thanks-goals", archetype: "club", events: TR,
    body: "{goalsWithUs} goal{goalsWithUs|plural} in our colours, and memories for a lifetime. Enjoy retirement, {player}. 👏", weight: 3 },
  { id: "tr-club-plain", archetype: "club", events: TR,
    body: "{player} has announced his retirement from professional football at {age}. Everyone at {club} wishes him the very best.", weight: 2 },
  { id: "tr-club-short", archetype: "club", events: TR,
    body: "One last applause for {short}. 👏 Thank you for everything.", weight: 1 },

  { id: "tr-league", archetype: "league", events: TR,
    body: "{club}'s {player} retires at {age}. Thanks for the memories. 👏", weight: 2 },
  { id: "tr-league-2", archetype: "league", events: TR,
    body: "End of an era at {club}: {player} calls time on his career.", weight: 2 },

  { id: "tr-stats-goals", archetype: "stats", events: TR,
    body: "{player} retires at {age}. With {club} in this spell: {goalsWithUs} goal{goalsWithUs|plural}, {assistsWithUs} assist{assistsWithUs|plural}.", weight: 3 },
  { id: "tr-stats-rating", archetype: "stats", events: TR,
    body: "{player} ({club}) retires at {age}. Rated {overall} in his final season.", weight: 2 },
  { id: "tr-stats-plain", archetype: "stats", events: TR,
    body: "Retired: {player}, {club}, aged {age}.", weight: 1 },
  { id: "tr-stats-role", archetype: "stats", events: TR,
    body: "{player} hangs up his boots. {club}'s {role}, {age} years old.", weight: 1 },

  { id: "tr-fan-legend", archetype: "fan", events: TR,
    body: "{short} retiring?? gonna miss that man. legend of this club 💙", weight: 2 },
  { id: "tr-fan-thanks", archetype: "fan", events: TR,
    body: "thank you {player} for everything. what a servant", weight: 2 },
  { id: "tr-fan-goals", archetype: "fan", events: TR,
    body: "{goalsWithUs} goal{goalsWithUs|plural} for us. not bad for a {role} 😂 enjoy retirement {short}", weight: 2 },
  { id: "tr-fan-sad", archetype: "fan", events: TR,
    body: "not ready for a season without {short} tbh", weight: 2 },
  { id: "tr-fan-end", archetype: "fan", events: TR,
    body: "end of an era. {player} done at {age} 🥲", weight: 2 },
  { id: "tr-fan-shirt", archetype: "fan", events: TR,
    body: "still got my {short} shirt. never taking it off 🫡", weight: 1 },
  { id: "tr-fan-name", archetype: "fan", events: TR,
    body: "they'll sing {short}'s name here for years. happy retirement", weight: 1 },

  { id: "tr-self", archetype: "teammate", events: TR,
    body: "gonna miss sharing a dressing room with {short}. enjoy retirement, legend 🫡", weight: 2 },
  { id: "tr-self-2", archetype: "teammate", events: TR,
    body: "taught me so much. thank you {short}, the game will miss you 🙏", weight: 2 },
  { id: "tr-self-3", archetype: "teammate", events: TR,
    body: "{age} and still the first one in at training. respect {short} 👏", weight: 1 },

  // ── A famous name elsewhere ──────────────────────────────────────────────
  { id: "lr-club", archetype: "club", events: LR,
    body: "Thank you, {player}. 👏 One of the best to wear our shirt retires at {age}.", weight: 3 },
  { id: "lr-club-2", archetype: "club", events: LR,
    body: "{player} has announced his retirement. Everyone at {club} thanks him for an outstanding career.", weight: 2 },
  { id: "lr-club-3", archetype: "club", events: LR,
    body: "A true great of {club}. Enjoy retirement, {short}. 💫", weight: 1 },

  { id: "lr-league", archetype: "league", events: LR,
    body: "{player} retires at {age}. A career to remember. 👏", weight: 2 },
  { id: "lr-league-2", archetype: "league", events: LR,
    body: "The end of the road for {club}'s {player}. Thank you for the memories.", weight: 2 },

  { id: "lr-stats-season", archetype: "stats", events: LR,
    body: "{player} retires at {age}. His final season for {club}: {lastGoals} goal{lastGoals|plural}, rated {overall}.", weight: 3 },
  { id: "lr-stats-assists", archetype: "stats", events: LR,
    body: "{player} ({club}) bows out at {age}: {lastGoals} goal{lastGoals|plural} and {lastAssists} assist{lastAssists|plural} in his final season.", weight: 3 },
  { id: "lr-stats-rating", archetype: "stats", events: LR,
    body: "Retired: {player}, {age}, {club}. Still rated {overall} in his last season.", weight: 2 },
  { id: "lr-stats-role", archetype: "stats", events: LR,
    body: "{player} calls time at {age}. {club}'s {role}, rated {overall} to the end.", weight: 1 },

  { id: "lr-fan", archetype: "fan", events: LR,
    body: "{player} retiring is the end of an era fr", weight: 2 },
  { id: "lr-fan-2", archetype: "fan", events: LR,
    body: "respect to {short}. proper player, {club} will miss him", weight: 2 },
  { id: "lr-fan-3", archetype: "fan", events: LR,
    body: "{short} retired at {age}?? where did the years go 😭", weight: 2 },
  { id: "lr-fan-4", archetype: "fan", events: LR,
    body: "hated playing against {short}. that's the biggest compliment i can give. happy retirement", weight: 2 },
  { id: "lr-fan-5", archetype: "fan", events: LR,
    body: "one of the best {role}s of his generation. {player} 🫡", weight: 1 },
  { id: "lr-fan-6", archetype: "fan", events: LR,
    body: "{player} done. football feels older today", weight: 1 },

  { id: "lr-self", archetype: "teammate", events: LR,
    body: "respect to {short}. one of the toughest i've come up against 🫡", weight: 2 },
  { id: "lr-self-2", archetype: "teammate", events: LR,
    body: "grew up watching {short}. enjoy retirement 🙏", weight: 1 },

  // ── One to watch: a regen with real potential ───────────────────────────
  { id: "rw-club", archetype: "club", events: RW,
    body: "Welcome to the first team, {player}! 🌟 Our {age}-year-old {role} is one for the future.", weight: 3 },
  { id: "rw-club-2", archetype: "club", events: RW,
    body: "From the academy to the first-team squad: {player}, {age}. Remember the name. ✨", weight: 2 },
  { id: "rw-club-3", archetype: "club", events: RW,
    body: "A new face in the squad at {club}: {player} ({age}). 👋", weight: 1 },

  { id: "rw-league", archetype: "league", events: RW,
    body: "One to watch this season: {club}'s {age}-year-old {role} {player}. 👀", weight: 2 },
  { id: "rw-league-2", archetype: "league", events: RW,
    body: "{player} ({club}, {age}) — a name you'll hear a lot of. 👀", weight: 2 },

  { id: "rw-stats", archetype: "stats", events: RW,
    body: "One to watch: {player}, {age}, {club}. {tier} potential, says every scout who has seen him.", weight: 3 },
  { id: "rw-stats-2", archetype: "stats", events: RW,
    body: "Youngest names to know this season: {player} ({club}), {age}, {role}.", weight: 2 },
  { id: "rw-stats-3", archetype: "stats", events: RW,
    body: "{player}: {age} years old, rated {overall}. {club} have a good one.", weight: 1 },

  { id: "rw-tabloid", archetype: "tabloid", events: RW,
    body: "WONDERKID ALERT: {club} kid {player}, {age}, is the talk of the scouts. 🔥", weight: 2 },
  { id: "rw-tabloid-2", archetype: "tabloid", events: RW,
    body: "The {age}-year-old {club} sensation the big clubs are already watching: {player}.", weight: 2 },
  { id: "rw-tabloid-3", archetype: "tabloid", events: RW,
    body: "Who is {player}? Meet {club}'s teenage {role}.", weight: 1 },

  { id: "rw-insider", archetype: "insider", events: RW,
    body: "⚠️ Scouts from several clubs have already asked about {player} ({club}, {age}). {tier} potential, they say.", weight: 2 },
  { id: "rw-insider-2", archetype: "insider", events: RW,
    body: "⚠️ {club} are confident {player} ({age}) is a special talent. More to follow.", weight: 2 },
  { id: "rw-insider-3", archetype: "insider", events: RW,
    body: "⚠️ Keep {player} on your radar. {club}'s {role}, {age}.", weight: 1 },

  { id: "rw-fan", archetype: "fan", events: RW,
    body: "{short} is going to be special. {age} years old 👀", weight: 2 },
  { id: "rw-fan-2", archetype: "fan", events: RW,
    body: "who's seen this {player} kid?? {age} and already in the squad", weight: 2 },
  { id: "rw-fan-3", archetype: "fan", events: RW,
    body: "if {short} isn't starting by christmas i'm writing to the club", weight: 2 },
  { id: "rw-fan-4", archetype: "fan", events: RW,
    body: "{player}. remember the name 🌟", weight: 2 },
  { id: "rw-fan-5", archetype: "fan", events: RW,
    body: "new {role} {short} looks the real deal", weight: 1 },
  { id: "rw-fan-6", archetype: "fan", events: RW,
    body: "{age}?? {short} looks older than me", weight: 1 },

  { id: "rw-self", archetype: "teammate", events: RW,
    body: "welcome to the first team {short} 👊 big future", weight: 2 },
  { id: "rw-self-2", archetype: "teammate", events: RW,
    body: "{age} and fearless. the kid {short} is going places 🙌", weight: 1 },
];
