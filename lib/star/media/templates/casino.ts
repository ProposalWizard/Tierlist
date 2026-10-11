import type { Template } from "./index";

/**
 * CASINO STORIES (lib/star/casinoScandal.ts). Ids: casino-spotted,
 * casino-lost, casino-won (steps 1-2), casino-expose (step 3), casino-ban
 * (step 4). Every one is about YOU, so every template says subject "you".
 */
export const CASINO_TEMPLATES: Template[] = [
  // ── Tabloid ──
  { id: "tb-casino-spotted", archetype: "tabloid", events: ["casino-spotted"], subject: "you", requires: ["short"],
    body: "SPOTTED! {short|caps} AT THE CASINO TABLES", graphic: "breaking", weight: 3 },
  { id: "tb-casino-lost", archetype: "tabloid", events: ["casino-lost"], subject: "you", requires: ["short"],
    body: "{short|caps} BLOWS A FORTUNE AT THE CASINO", graphic: "breaking", weight: 3 },
  { id: "tb-casino-won", archetype: "tabloid", events: ["casino-won"], subject: "you", requires: ["short"],
    body: "JACKPOT! {short|caps}'S LUCKY NIGHT AT THE TABLES", graphic: "breaking", weight: 3 },
  { id: "tb-casino-expose", archetype: "tabloid", events: ["casino-expose", "casino-ban"], subject: "you", requires: ["short"],
    body: "EXPOSED: {short|caps}'S SECRET GAMBLING HABIT", graphic: "breaking", weight: 3 },
  { id: "tb-casino-ban", archetype: "tabloid", events: ["casino-ban"], subject: "you", requires: ["short"],
    body: "{club|caps} BAN {short|caps} FROM THE CASINO", graphic: "breaking", weight: 3 },
  // ── Broadsheet ──
  { id: "bs-casino-spotted", archetype: "broadsheet", events: ["casino-spotted", "casino-won"], subject: "you",
    body: "{player} was seen at a casino this week. {club} declined to comment, which is a comment of its own.", weight: 2 },
  { id: "bs-casino-lost", archetype: "broadsheet", events: ["casino-lost"], subject: "you",
    body: "{player} lost heavily at a casino this week, according to people who were there. {club} will want a word.", weight: 2 },
  { id: "bs-casino-expose", archetype: "broadsheet", events: ["casino-expose"], subject: "you",
    body: "This is no longer one night out. {player}'s visits to the casino have become a pattern, and {club} have fined him.", weight: 3 },
  { id: "bs-casino-ban", archetype: "broadsheet", events: ["casino-ban"], subject: "you",
    body: "{club} have banned {player} from the casino for eight weeks. A club does not step in like this lightly.", weight: 3 },
  // ── Fans ──
  { id: "fan-casino-spotted", archetype: "fan", events: ["casino-spotted", "casino-won"], subject: "you", requires: ["short"],
    body: "{short} at the casino again? just focus on saturday mate", weight: 2 },
  { id: "fan-casino-lost", archetype: "fan", events: ["casino-lost", "casino-expose"], subject: "you", requires: ["short"],
    body: "not a good look {short}. sort it out", weight: 2 },
  { id: "fan-casino-ban", archetype: "fan", events: ["casino-ban"], subject: "you", requires: ["short"],
    body: "the club had to ban him. embarrassing. hope {short} gets help", weight: 2 },
  { id: "rival-casino", archetype: "rivalFan", events: ["casino-spotted", "casino-lost", "casino-won", "casino-expose", "casino-ban"], subject: "you", requires: ["short"],
    body: "{short} betting on red while {club} are in the red 😂", weight: 2 },
];
