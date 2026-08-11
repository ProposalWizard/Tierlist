import type { Template } from "./index";

/**
 * THE CLUB, THE LEAGUE AND THE COMPETITION.
 *
 * Official accounts: professional, positive about their own, and constitutionally
 * incapable of criticising anybody. A club account never says a player was poor
 * and never says the result was deserved when it went the other way — the worst
 * it manages is "we go again", which is exactly what real ones manage.
 */

export const CLUB_TEMPLATES: Template[] = [
  // ── Full time ─────────────────────────────────────────────────────────────
  {
    id: "club-ft-win", archetype: "club", events: ["win", "rout"], frames: ["celebrate", "report"],
    body: "FULL TIME | {club} {us}-{them} {opponent}. Three points {venue}.",
    graphic: "scoreline", hashtag: true, weight: 3,
  },
  {
    id: "club-ft-win-alt", archetype: "club", events: ["win"], frames: ["celebrate"],
    body: "That'll do. {us}-{them}. {winVerb|title} {venue}.",
    graphic: "scoreline", hashtag: true,
  },
  {
    id: "club-ft-draw", archetype: "club", events: ["draw", "goalless"], frames: ["report"],
    body: "FULL TIME | {club} {us}-{them} {opponent}. A point {venue}.",
    graphic: "scoreline", hashtag: true,
  },
  {
    id: "club-ft-loss", archetype: "club", events: ["loss", "hammered"], frames: ["report"],
    body: "FULL TIME | {club} {us}-{them} {opponent}. We go again on Saturday.",
    graphic: "scoreline", hashtag: true,
  },

  // ── Goals ─────────────────────────────────────────────────────────────────
  {
    id: "club-hattrick", archetype: "club", events: ["hat-trick", "four-goals", "five-goals"],
    requires: ["goals"],
    body: "{short|caps}. {short|caps}. {short|caps}. {goals|title} for the number {number}. 🔴",
    graphic: "hatTrick", hashtag: true, weight: 3,
  },
  {
    id: "club-goal-tag", archetype: "club", tags: ["goal"], requires: ["minute"],
    body: "{minute}' — {player|caps}!!",
    hashtag: true, weight: 2,
    threadBody: "{minute}' — {player|caps}! {thread.goals} in {thread.matches} now.",
  },
  {
    id: "club-goal-plain", archetype: "club", tags: ["goal"], requires: ["goals"], excludes: ["matches"],
    body: "{player} — {goals}. Take a bow, number {number}.",
    hashtag: true,
  },
  {
    id: "club-goal-assist", archetype: "club", tags: ["assist"], requires: ["assists"], excludes: ["matches"],
    body: "{assists} assist{assists|plural} for {player} today. Everything goes through him.",
    hashtag: true,
  },

  // ── The run, and the table ────────────────────────────────────────────────
  {
    id: "club-run", archetype: "club", tags: ["streak"], requires: ["matches"],
    body: "{matches} unbeaten and counting. Onto the next one.",
    hashtag: true, weight: 2,
  },
  {
    id: "club-table", archetype: "club", tags: ["table"], requires: ["position"],
    body: "{position|ordinal} in the table with {left} to play. Every point from here matters.",
    graphic: "tableSnippet", hashtag: true,
  },
  {
    id: "club-late-winner", archetype: "club", events: ["late-winner"], requires: ["minute"],
    body: "{minute} MINUTES. GET IN. {player|caps} wins it.",
    graphic: "scoreline", hashtag: true, weight: 4,
  },
  {
    id: "club-comeback", archetype: "club", events: ["comeback"], requires: ["deficit"],
    body: "{deficit} down. {us}-{them} up. Never in doubt. Unbelievable from the lads.",
    graphic: "scoreline", hashtag: true,
  },

  // ── Milestones and honours ────────────────────────────────────────────────
  {
    id: "club-milestone", archetype: "club", tags: ["milestone"], requires: ["milestone"],
    body: "{milestone} for {player}. What a story. Congratulations, skipper — the club is proud of you.",
    graphic: "playerCard", hashtag: true,
  },
  {
    id: "club-debut", archetype: "club", events: ["debut", "club-debut"],
    body: "A day he'll never forget. {player} makes his debut. Welcome to it, son. 👏",
    graphic: "playerCard", hashtag: true,
  },
  {
    id: "club-starman", archetype: "club", events: ["star-man", "masterclass"],
    body: "Your Player of the Match: {player}. {rating} out of ten and worth every one of them.",
    graphic: "playerCard", hashtag: true,
  },
  {
    id: "club-trophy", archetype: "club", events: ["trophy", "champions"],
    body: "CHAMPIONS. {club|caps}. Say it out loud. 🏆",
    graphic: "trophy", hashtag: true, weight: 5,
  },
  {
    id: "club-final", archetype: "club", events: ["into-the-final"],
    body: "WE ARE IN THE FINAL. Get the flags out. 🏆",
    graphic: "breaking", hashtag: true,
  },
  {
    id: "club-through", archetype: "club", events: ["through"], requires: ["round"],
    body: "Through to the {round}. One more step.",
    hashtag: true,
  },
  {
    id: "club-out", archetype: "club", events: ["knocked-out", "lost-the-final"],
    body: "Not our night. Thank you to every single one of you who travelled. We'll be back.",
    hashtag: true,
  },
  {
    id: "club-signing", archetype: "club", events: ["unveiling"], requires: ["to"],
    body: "HE'S HERE. ✍️ {player} signs. Welcome to {to}.",
    graphic: "transfer", hashtag: true, weight: 4,
  },
  {
    id: "club-farewell", archetype: "club", events: ["farewell"],
    body: "Thank you, {player}. Nothing but respect and nothing but good wishes. Once one of us, always one of us. 👏",
    hashtag: true,
  },
  {
    id: "club-contract", archetype: "club", events: ["contract-signed"], requires: ["seasons"],
    body: "✍️ HE STAYS. {player} commits for another {seasons} years.",
    graphic: "transfer", hashtag: true,
  },
  {
    id: "club-armband", archetype: "club", events: ["armband"],
    body: "Your captain. {player} takes the armband. Nobody has earned it more.",
    graphic: "playerCard", hashtag: true,
  },
  {
    id: "club-award", archetype: "club", events: ["award-won", "ballon-dor"], requires: ["award"],
    body: "{award|caps}. {player}. One of our own. 🏅",
    graphic: "breaking", hashtag: true,
  },

  {
    id: "club-upset", archetype: "club", events: ["upset", "cup-shock"], requires: ["gap"],
    body: "Nobody gave us a chance. {us}-{them}. That is what this group is made of.",
    graphic: "scoreline", hashtag: true, weight: 2,
  },
  {
    id: "club-drama", archetype: "club", tags: ["drama"], frames: ["celebrate"],
    body: "Days like that are why you support a football club. {us}-{them}.",
    hashtag: true,
  },
  {
    id: "club-europe", archetype: "club", tags: ["europe"],
    body: "European nights are what this club is for. {club} {us}-{them} {opponent}.",
    hashtag: true,
  },
  {
    id: "club-title", archetype: "club", tags: ["title"], requires: ["left"],
    body: "{left} matches left. Every one of them is a cup final now.",
    graphic: "tableSnippet", hashtag: true,
  },
  {
    id: "club-milestone-plain", archetype: "club", tags: ["record", "international"],
    body: "One of our own. {player} — we could not be prouder.",
    hashtag: true,
  },

  // ── The fallback that makes the chain terminate ────────────────────────────
  {
    id: "club-generic", archetype: "club",
    body: "{club} {us}-{them} {opponent}. Thank you for the support today.",
    hashtag: true, weight: 0.5,
  },

  // ── The league ────────────────────────────────────────────────────────────
  {
    id: "league-result", archetype: "league", events: ["win", "draw", "loss", "rout", "hammered"],
    body: "RESULT | {club} {us}-{them} {opponent}",
    graphic: "scoreline", weight: 2,
  },
  {
    id: "league-top", archetype: "league", events: ["went-top"], requires: ["points"],
    body: "NEW LEADERS | {club} go top on {points} points with {left} to play.",
    graphic: "tableSnippet", weight: 3,
  },
  {
    id: "league-drop", archetype: "league", events: ["into-the-drop", "out-of-the-drop"], requires: ["to"],
    body: "{club} move to {to|ordinal} with {left} matches remaining.",
    graphic: "tableSnippet",
  },
  {
    id: "league-champions", archetype: "league", events: ["champions"], requires: ["points"],
    body: "🏆 CHAMPIONS | {club} are the champions on {points} points.",
    graphic: "trophy", weight: 4,
  },
  {
    id: "league-relegated", archetype: "league", events: ["relegated"], requires: ["position"],
    body: "{club} are relegated, finishing {position|ordinal} on {points} points.",
    graphic: "tableSnippet",
  },
  {
    id: "league-record", archetype: "league", tags: ["record", "milestone"], requires: ["milestone"],
    body: "MILESTONE | {player} reaches {milestone} for {club}.",
    graphic: "statLine",
  },
  {
    id: "league-generic", archetype: "league",
    body: "{club} {us}-{them} {opponent} | Matchweek {week}",
    graphic: "scoreline", weight: 0.5,
  },

  // ── Competitions ──────────────────────────────────────────────────────────
  {
    id: "comp-through", archetype: "competition", events: ["through", "into-the-final"], requires: ["round"],
    body: "Into the {round}. {club} march on. 🏆",
    weight: 2,
  },
  {
    id: "comp-out", archetype: "competition", events: ["knocked-out", "lost-the-final"],
    body: "The end of the road for {club}. {opponent} go through.",
  },
  {
    id: "comp-trophy", archetype: "competition", events: ["trophy"],
    body: "🏆 WINNERS | {club}. Champions of the {competition}.",
    graphic: "trophy", weight: 4,
  },
  {
    id: "comp-night", archetype: "competition", events: ["european-night"], requires: ["goals"],
    body: "European nights. {player} with {goals} in the {competition}.",
    graphic: "playerCard",
  },
  {
    id: "comp-generic", archetype: "competition",
    body: "{competition} | {club} {us}-{them} {opponent}",
    graphic: "scoreline", weight: 0.5,
  },
];
