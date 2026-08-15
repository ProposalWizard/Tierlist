import type { Template } from "./index";

/**
 * THE NUMBERS, THE RUMOURS AND THE OPINIONS.
 *
 * Three archetypes that exist to say things nobody else will:
 *
 * The stat page never uses an adjective. That is its entire character, and it is
 * also the account that benefits most from story threads — it is the only one
 * whose natural register is "six goals in his last three", which is a sentence
 * no single match contains.
 *
 * The insider deals only in things that have not happened yet.
 *
 * The pundit is the only account in the world that is allowed to be wrong.
 */

export const DATA_TEMPLATES: Template[] = [
  // ── Statistics ────────────────────────────────────────────────────────────
  {
    id: "st-goals", archetype: "stats", tags: ["goal"], requires: ["goals"], excludes: ["matches"],
    body: "{player} — {goals} today. {seasonTotal} this season.",
    threadBody: "{player}: {thread.goals} goals in his last {thread.matches} matches.",
    graphic: "statLine", weight: 3,
  },
  {
    id: "st-run", archetype: "stats", events: ["scoring-run", "red-hot", "purple-patch"],
    requires: ["matches", "goals"],
    body: "{goalsN} goal{goalsN|plural} in {matches} matches for {player}.",
    threadBody: "{thread.goals} in {thread.matches}. {player} has not stopped.",
    graphic: "statLine", weight: 4,
  },
  {
    id: "st-milestone", archetype: "stats", tags: ["milestone", "record"], requires: ["milestone"],
    body: "{milestone} — {player} reaches the mark in {apps} appearances.",
    graphic: "statLine", weight: 3,
  },
  {
    id: "st-involved", archetype: "stats", events: ["involved-in-all"], requires: ["involved"],
    body: "{player} had a hand in all {us} of {club|possessive} goals: {goals} scored, {assists} created.",
    graphic: "statLine", weight: 3,
  },
  {
    id: "st-ga", archetype: "stats", events: ["goal-and-assist"], requires: ["involved"],
    body: "{player}: {involved} goal involvement{involved|plural} today.",
    graphic: "statLine", weight: 2,
  },
  {
    id: "st-assists", archetype: "stats", tags: ["assist"], requires: ["assists"], excludes: ["matches"],
    body: "{player} — {assists} assist{assists|plural} today.",
    threadBody: "{player} has {thread.assists} assists in his last {thread.matches}.",
    graphic: "statLine",
  },
  {
    id: "st-clean", archetype: "stats", events: ["clean-sheet-run", "clean-sheet"], requires: ["matches"],
    body: "{club} have not conceded in {matches} matches.",
    graphic: "statLine", weight: 2,
  },
  {
    id: "st-unbeaten", archetype: "stats", events: ["unbeaten-run", "winning-run"], requires: ["matches"],
    body: "{club}: {matches} matches unbeaten.",
    graphic: "statLine", weight: 2,
  },
  {
    id: "st-losing", archetype: "stats", events: ["losing-run"], requires: ["matches"],
    body: "{matches} without a win for {club}.",
    graphic: "statLine",
  },
  {
    // A drought is one man not scoring. It used to share the line above, so a
    // striker who had not scored in six was reported as his CLUB not having won
    // in six — a different thing, about different people, and often not true.
    id: "st-drought", archetype: "stats", events: ["drought"], requires: ["matches"],
    body: "{player} — {matches} matches without a goal.",
    graphic: "statLine",
  },
  {
    // ── The month's award, before it is given ──
    //
    // Football talks about this for a fortnight and the game used to say nothing
    // until the moment it landed.
    id: "st-potm-race", archetype: "stats", events: ["potm-race"], requires: ["month", "place"],
    body: "{month} Player of the Month race — {player} sits {place|ordinal}. {goalsN} goal{goalsN|plural}, {assists} assist{assists|plural}.",
    graphic: "statLine", weight: 2,
  },
  {
    // The last round of the month is when the shortlist goes up, so this one
    // carries the eight names rather than your row of it. The race above stays a
    // statLine on purpose — a race is a number and a shortlist is a list of
    // people, and printing the same card for both wastes the distinction.
    id: "st-potm-decides", archetype: "stats", events: ["potm-decides"], requires: ["month", "place"],
    body: "{month} Player of the Month shortlist, one round to play. {player} is {place|ordinal}.",
    graphic: "potmNominees", weight: 3,
  },
  {
    // The same card on the months you are not on the list. It says the same
    // thing the card says — here is the shortlist — without pretending you are
    // on it, which is what `excludes: ["place"]` buys: the line above wins
    // whenever there is a place to print, and this one covers the rest.
    id: "st-potm-shortlist", archetype: "stats", events: ["potm-decides"],
    requires: ["month", "leader"], excludes: ["place"],
    body: "{month} Player of the Month shortlist. {leader} leads it from {contenders} contenders.",
    graphic: "potmNominees", weight: 3,
  },
  {
    // Won it. The loudest line this archetype has, and the only POTM template
    // that is about a result rather than a race.
    id: "st-potm-won", archetype: "stats", events: ["potm-won"], requires: ["month", "goals"],
    body: "{player} is {month} Player of the Month. {goalsN} goal{goalsN|plural}, {assists} assist{assists|plural}.",
    graphic: "potmWinner", weight: 4,
  },
  {
    id: "st-potm-winner", archetype: "stats", events: ["potm-winner"], requires: ["month", "winner"],
    body: "{winner} wins Player of the Month for {month}. {goalsN} goal{goalsN|plural}, {assists} assist{assists|plural}.",
    graphic: "potmWinner", weight: 3,
  },
  {
    id: "st-boot", archetype: "stats", events: ["golden-boot-race"], requires: ["goals"],
    body: "GOLDEN BOOT | {player} — {goals} with {left} to play.",
    graphic: "topScorers", weight: 3,
  },
  {
    id: "st-assist-king", archetype: "stats", events: ["assist-king-race"], requires: ["assists"],
    body: "ASSIST KING | {player} — {assists} with {left} to play.",
    graphic: "topScorers", weight: 3,
  },
  {
    id: "st-table", archetype: "stats", tags: ["table"], requires: ["position"],
    body: "{club} — {position|ordinal}, {points} points, {left} to play.",
    graphic: "tableSnippet",
  },
  {
    id: "st-rating", archetype: "stats", events: ["masterclass", "in-form"], requires: ["average"],
    body: "{player} — average rating {average} across his last {matches}.",
    graphic: "statLine",
  },
  {
    // ── The stats account's fallback, and it is about ONE match ──
    //
    // It writes the scoreline and this afternoon's rating, so it must not be
    // reached for a run: paired with a scoring-run event it produced "Chelsea
    // 3-1 Liverpool. Mikey Vassiliou: 9.6." above a card reading "Goals 7 /
    // Over 3 matches" — a sentence about Saturday over numbers about a
    // fortnight. Reported as the card not being relevant to the line above it.
    //
    // `excludes` exists for exactly this and was not being used by anything.
    id: "st-generic", archetype: "stats", excludes: ["matches"],
    body: "{club} {us}-{them} {opponent}. {player}: {rating}.",
    graphic: "statLine", weight: 0.5,
  },
  {
    // …and the ones it falls through to when there IS a run. Two of them,
    // because a run belongs to somebody: "0 goals in his last 6" is a sentence
    // about a striker and nonsense about a club that has not lost in six. The
    // first version of this was one template for both and said exactly that.
    id: "st-run-player", archetype: "stats",
    events: ["scoring-run", "red-hot", "purple-patch", "drought", "creating"],
    requires: ["matches", "goals"],
    body: "{player} — {goals} in his last {matches}.",
    graphic: "statLine", weight: 0.5,
  },
  {
    id: "st-run-club", archetype: "stats",
    events: ["unbeaten-run", "winning-run", "losing-run", "clean-sheet-run", "run-ended"],
    requires: ["matches"],
    body: "{club} — {matches} matches.",
    graphic: "statLine", weight: 0.4,
  },
  {
    // The terminator. Every archetype needs one that requires nothing, or a
    // combination nobody wrote a line for renders as a blank post — and
    // excluding `matches` from st-generic took the stats account's away.
    id: "st-any", archetype: "stats", requires: ["matches"],
    body: "{player} — the last {matches} matches, in numbers.",
    graphic: "statLine", weight: 0.15,
  },

  // ── The insider ───────────────────────────────────────────────────────────
  {
    id: "in-done", archetype: "insider", events: ["transfer-done"], requires: ["to", "feeText"],
    body: "🚨 DONE DEAL: {player} to {to}. {feeText}. Medical completed, contract signed. Here we go.",
    graphic: "transfer", weight: 4,
  },
  {
    id: "in-contract", archetype: "insider", events: ["contract-signed"], requires: ["seasons"],
    body: "🚨 {player} has signed a new deal at {club}. {seasons} more years. Understand talks were straightforward.",
    weight: 3,
  },
  {
    id: "in-interest", archetype: "insider", tags: ["rumour"], requires: ["short"],
    body: "⚠️ Told there is genuine interest in {player}. Nothing agreed, nothing imminent — but it is being looked at. More to follow.",
    weight: 2,
  },
  {
    id: "in-form-link", archetype: "insider", events: ["red-hot", "scoring-run", "masterclass"],
    requires: ["short"],
    body: "⚠️ Scouts were at {club} again tonight for {player}. That is three matches in a row now.",
    threadBody: "⚠️ {thread.goals} in {thread.matches} — and the phone has started ringing about {player}. Watch this one.",
    weight: 2,
  },
  {
    id: "in-manager", archetype: "insider", tags: ["manager"], requires: ["manager"],
    body: "🚨 {manager} leaves {club}. Decision taken this evening. Successor already identified.",
    weight: 3,
  },
  {
    id: "in-callup", archetype: "insider", tags: ["international"],
    body: "🚨 {player} called up. First time in the squad. Deserved.",
  },
  {
    id: "in-generic", archetype: "insider",
    body: "⚠️ Keeping an eye on the situation at {club}. More when I have it.",
    weight: 0.4,
  },

  // ── The pundit ────────────────────────────────────────────────────────────
  {
    id: "pu-praise", archetype: "pundit", events: ["masterclass", "star-man", "hat-trick", "red-hot"],
    frames: ["analyse"], requires: ["short"],
    body: "I've been saying it for weeks and nobody wanted to hear it. {player} is the best {role} in this division right now. It isn't close.",
    threadBody: "{thread.goals} in {thread.matches}. At some point we have to stop calling it a purple patch and start calling it a level.",
    weight: 3,
  },
  {
    id: "pu-question", archetype: "pundit", frames: ["question"], tags: ["shame", "form"], requires: ["club"],
    body: "Serious question about {club}: is that a bad afternoon or is that who they are? Because I know which way I'd bet.",
    weight: 2,
  },
  {
    id: "pu-lament", archetype: "pundit", frames: ["lament"], tags: ["shame"],
    body: "I played in sides that lost. I never played in one that looked like it didn't mind.",
    weight: 2,
  },
  {
    id: "pu-manager", archetype: "pundit", tags: ["manager"], requires: ["manager"],
    body: "Nobody wants to see a manager lose his job. But {manager} lost that dressing room a long time before he lost his job.",
    weight: 2,
  },
  {
    id: "pu-title", archetype: "pundit", events: ["title-race", "went-top", "lost-top"], requires: ["left"],
    body: "{left} to play and everyone's already writing it off. I've seen bigger gaps closed with less. It's a long way from over.",
  },
  {
    id: "pu-young", archetype: "pundit", events: ["debut", "club-debut", "first-career-goal"],
    body: "Careful with this one. He's got everything — but the making of him will be the first time it goes badly, not today.",
  },
  {
    id: "pu-generic", archetype: "pundit", frames: ["analyse", "question", "lament"],
    body: "For me? {club} got exactly what they deserved out of that. No more, no less.",
    weight: 0.5,
  },

  // ── The aggregator ────────────────────────────────────────────────────────
  {
    id: "ag-goal", archetype: "aggregator", tags: ["goal"], requires: ["short"],
    body: "🎥 WATCH: {player} does it again",
    graphic: "thumbnail", weight: 3,
  },
  {
    id: "ag-screamer", archetype: "aggregator", events: ["screamer", "special-goal"],
    body: "🎥 GOAL OF THE SEASON CONTENDER? You decide 👇",
    graphic: "thumbnail", weight: 4,
  },
  {
    id: "ag-drama", archetype: "aggregator", events: ["late-winner", "comeback", "collapse"],
    body: "🎥 SCENES. Absolute scenes at full time.",
    graphic: "thumbnail", weight: 3,
  },
  {
    id: "ag-derby", archetype: "aggregator", tags: ["derby"],
    body: "🎥 The derby had EVERYTHING. Full highlights up now.",
    graphic: "thumbnail", weight: 2,
  },
  {
    id: "ag-trophy", archetype: "aggregator", tags: ["trophy"],
    body: "🎥 CHAMPIONS. The full celebrations 👑",
    graphic: "thumbnail", weight: 3,
  },
  {
    id: "ag-generic", archetype: "aggregator",
    body: "🎥 HIGHLIGHTS: {club} {us}-{them} {opponent}",
    graphic: "thumbnail", weight: 0.5,
  },
];
