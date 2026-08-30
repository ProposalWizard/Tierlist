import type { CareerState } from "./types";

export interface DilemmaEffect {
  money?: number;
  happiness?: number;
  matchFitness?: number;
  boss?: number;
  team?: number;
  fans?: number;
  sponsors?: number;
  fame?: number;
  pace?: number;
  power?: number;
  technique?: number;
  vision?: number;
  freeKick?: number;
}

export interface DilemmaChoice {
  label: string;
  effects: DilemmaEffect;
  narrative?: string;
}

export interface Dilemma {
  id: string;
  category: "team" | "manager" | "media" | "sponsor" | "partner" | "financial" | "training" | "fan" | "agent" | "lifestyle" | "charity";
  title: string;
  text: string;
  once?: boolean;
  when?: (c: CareerState) => boolean;
  choices: DilemmaChoice[];
}

export const DILEMMAS: Dilemma[] = [
  {
    id: "night-out",
    category: "team",
    title: "Team Night Out",
    text: "The lads are heading out tonight. It'll be a late one but the team bonding could pay off.",
    choices: [
      { label: "Go out with the team", effects: { team: 8, boss: -3 }, narrative: "Great night — team bond stronger." },
      { label: "Stay in and rest", effects: { team: -3, boss: 2 }, narrative: "Fully rested for the weekend." },
    ],
  },
  {
    id: "media-interview",
    category: "media",
    title: "Media Interview",
    text: "A local reporter wants a quick interview about your progress.",
    choices: [
      { label: "Be humble", effects: { fans: 4, sponsors: 3, boss: 2 }, narrative: "The manager likes your grounded attitude." },
      { label: "Talk yourself up", effects: { fans: 6, sponsors: 5, team: -4, boss: -2 }, narrative: "Some teammates roll their eyes at the quotes." },
      { label: "Decline politely", effects: { fans: -2 }, narrative: "Missed exposure." },
    ],
  },
  {
    id: "charity-appearance",
    category: "charity",
    title: "Charity Appearance",
    text: "A youth football charity has invited you to run a coaching session.",
    choices: [
      { label: "Attend", effects: { fans: 10, fame: 4, sponsors: 3 }, narrative: "Coverage everywhere. Kids loved it." },
      { label: "Send a signed shirt", effects: { money: -3, fans: 3 }, narrative: "Nice gesture — modest coverage." },
      { label: "Politely decline", effects: { fans: -3, sponsors: -2 } },
    ],
  },
  {
    id: "manager-criticism",
    category: "manager",
    title: "Gaffer Wants a Word",
    text: "The manager pulls you aside. He wants more tracking back in games.",
    choices: [
      { label: "Agree — I'll work harder", effects: { boss: 8 }, narrative: "He nods. Good response." },
      { label: "Push back — I'm doing my job", effects: { boss: -8, team: 3 }, narrative: "A tense chat." },
    ],
  },
  {
    id: "sponsor-photoshoot",
    category: "sponsor",
    title: "Sponsor Photoshoot",
    text: "Your boot sponsor wants you for a half-day shoot mid-week.",
    when: (c) => c.relationships.sponsors > 20,
    choices: [
      { label: "Do the shoot", effects: { money: 5, sponsors: 6, fame: 3 }, narrative: "Long day but the paycheque's decent." },
      { label: "Cancel", effects: { sponsors: -10, money: -2 }, narrative: "The sponsor is not pleased." },
    ],
  },
  {
    id: "bribe-offer",
    category: "financial",
    title: "Suspicious Offer",
    text: "A shady contact offers you money to underperform in next week's match.",
    choices: [
      { label: "Refuse and report it", effects: { boss: 8, fans: 6, fame: 3 }, narrative: "The club appreciates the honesty. Word gets out." },
      { label: "Ignore it", effects: {} },
      { label: "Take the money", effects: { money: 40, boss: -20, team: -15, fans: -25, fame: -10 }, narrative: "You take it. If this ever comes out..." },
    ],
  },
  {
    id: "extra-training",
    category: "training",
    title: "Extra Training",
    text: "The technique coach offers an extra one-on-one session this week.",
    choices: [
      { label: "Attend", effects: { technique: 2 }, narrative: "Solid session — you feel sharper." },
      { label: "Skip", effects: {} },
    ],
  },
  {
    id: "fan-selfie",
    category: "fan",
    title: "Fan Meet",
    text: "A group of young fans catch you outside training asking for autographs.",
    choices: [
      { label: "Stop and sign", effects: { fans: 8 }, narrative: "You made their day." },
      { label: "Wave and keep walking", effects: { fans: -3 } },
    ],
  },
  {
    id: "agent-transfer-talk",
    category: "agent",
    title: "Your Agent Rings",
    text: "Your agent has a rival club sniffing around. Want him to open talks?",
    when: (c) => c.starRating >= 3,
    choices: [
      { label: "Yes — see what they offer", effects: { boss: -5, fame: 3 }, narrative: "The gaffer heard about it. Not happy." },
      { label: "Not now, I'm settled", effects: { boss: 4, team: 2 } },
    ],
  },
  {
    id: "partner-dinner",
    category: "partner",
    title: "Dinner Plans",
    text: "Your partner wants a proper date night — you've been distant lately.",
    when: (c) => c.girlfriend !== null,
    choices: [
      { label: "Take them out", effects: { money: -4, happiness: 10 }, narrative: "Great evening." },
      { label: "Postpone", effects: { happiness: -8 }, narrative: "They're not impressed." },
    ],
  },
  {
    id: "financial-advisor",
    category: "financial",
    title: "Financial Advisor",
    text: "A trusted advisor suggests putting some money aside for a long-term investment.",
    when: (c) => c.money >= 30,
    choices: [
      { label: "Invest ★20", effects: { money: -20, happiness: 3, fame: 2 }, narrative: "You'll thank yourself later." },
      { label: "Keep it liquid", effects: {} },
    ],
  },
  {
    id: "young-fan-hospital",
    category: "charity",
    title: "Hospital Visit Request",
    text: "A young fan in hospital wants to meet their idol — you.",
    choices: [
      { label: "Visit them", effects: { fans: 15, fame: 6, happiness: 8 }, narrative: "Beautiful moment. Cameras were there too." },
      { label: "Send a signed jersey", effects: { money: -2, fans: 5 } },
    ],
  },
  {
    id: "training-injury",
    category: "training",
    title: "Rough Training Session",
    text: "You've taken a knock in training. Do you push through or ease off?",
    choices: [
      { label: "Push through", effects: { matchFitness: 4, technique: 1 } },
      { label: "Ease off, ice it", effects: { matchFitness: -8, boss: -2 } },
    ],
  },
  {
    id: "captain-argument",
    category: "team",
    title: "Captain's Frustration",
    text: "The captain thinks you're not covering enough ground. He's unhappy.",
    when: (c) => c.relationships.team < 60,
    choices: [
      { label: "Apologise — I'll do better", effects: { team: 10 }, narrative: "He respects the humility." },
      { label: "Stand your ground", effects: { team: -8, boss: -2 } },
    ],
  },
  {
    id: "gambling-invite",
    category: "lifestyle",
    title: "Card Night",
    text: "A senior player invites you to a private card game after training.",
    choices: [
      { label: "Play a few hands", effects: { money: -5, team: 4 }, narrative: "Small loss but you fit in." },
      { label: "Decline", effects: { team: -2 } },
    ],
  },
  {
    id: "sponsor-launch",
    category: "sponsor",
    title: "New Boot Launch",
    text: "Your sponsor is launching a new boot and wants you as the face.",
    when: (c) => c.relationships.sponsors > 40,
    choices: [
      { label: "Do the campaign", effects: { money: 20, sponsors: 10, fame: 8 }, narrative: "Big paycheque and coverage." },
      { label: "Decline this one", effects: { sponsors: -8 } },
    ],
  },
  {
    id: "manager-praise",
    category: "manager",
    title: "Gaffer's Praise",
    text: "The manager singles you out in the team meeting — great attitude in training.",
    choices: [
      { label: "Thank him", effects: { boss: 6, happiness: 4 } },
    ],
  },
  {
    id: "media-controversy",
    category: "media",
    title: "Comment Taken Out of Context",
    text: "A tabloid runs a story claiming you criticised a teammate. You never said it.",
    choices: [
      { label: "Address it publicly", effects: { fame: 4, team: 3, sponsors: -2 }, narrative: "Clean-cut clarification." },
      { label: "Ignore it — it'll blow over", effects: { team: -6, fans: -3 } },
      { label: "Sue the paper", effects: { money: -8, fame: 6, sponsors: -4 } },
    ],
  },
  {
    id: "fan-abuse",
    category: "fan",
    title: "Abusive Fan",
    text: "A supporter shouted abuse at you in the tunnel. Cameras caught your reaction.",
    choices: [
      { label: "Ignore and walk on", effects: { fame: 2, fans: 3 } },
      { label: "React angrily", effects: { boss: -6, fans: -8, fame: 3, sponsors: -3 } },
    ],
  },
  {
    id: "video-game-launch",
    category: "sponsor",
    title: "Video Game Cover",
    text: "A football game wants your face on the cover for a regional edition.",
    when: (c) => c.starRating >= 3.5,
    choices: [
      { label: "Accept", effects: { money: 25, fame: 15, sponsors: 8 }, narrative: "You're on billboards now." },
      { label: "Turn it down", effects: {} },
    ],
  },
  {
    id: "sleep-issue",
    category: "lifestyle",
    title: "Rough Night",
    text: "You couldn't sleep last night. Manager notices you're groggy in training.",
    choices: [
      { label: "Coffee and power through", effects: { boss: -1 } },
      { label: "Ask to skip the session", effects: { boss: -6 } },
    ],
  },
  {
    id: "youth-team-visit",
    category: "team",
    title: "Youth Team Visit",
    text: "The academy asks you to speak with the youth players.",
    choices: [
      { label: "Do it happily", effects: { boss: 5, fans: 4 } },
      { label: "Send a message", effects: { boss: -1 } },
    ],
  },
];

export function pickDilemma(career: CareerState, rng: () => number): Dilemma | null {
  const eligible = DILEMMAS.filter((d) => {
    if (d.once && career.seenDilemmas.includes(d.id)) return false;
    if (d.when && !d.when(career)) return false;
    return true;
  });
  if (eligible.length === 0) return null;
  return eligible[Math.floor(rng() * eligible.length)];
}

export function applyEffects(career: CareerState, effects: DilemmaEffect): CareerState {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const next: CareerState = { ...career };
  if (effects.money !== undefined) next.money = Math.max(0, next.money + effects.money);
  if (effects.happiness !== undefined) next.happiness = clamp(next.happiness + effects.happiness);
  if (effects.matchFitness !== undefined) next.matchFitness = clamp(next.matchFitness + effects.matchFitness);
  if (effects.fame !== undefined) next.fame = Math.max(0, next.fame + effects.fame);
  next.relationships = { ...next.relationships };
  if (effects.boss !== undefined) next.relationships.boss = clamp(next.relationships.boss + effects.boss);
  if (effects.team !== undefined) next.relationships.team = clamp(next.relationships.team + effects.team);
  if (effects.fans !== undefined) next.relationships.fans = clamp(next.relationships.fans + effects.fans);
  if (effects.sponsors !== undefined) next.relationships.sponsors = clamp(next.relationships.sponsors + effects.sponsors);
  next.skills = { ...next.skills };
  if (effects.pace !== undefined) next.skills.pace = clamp(next.skills.pace + effects.pace);
  if (effects.power !== undefined) next.skills.power = clamp(next.skills.power + effects.power);
  if (effects.technique !== undefined) next.skills.technique = clamp(next.skills.technique + effects.technique);
  if (effects.vision !== undefined) next.skills.vision = clamp(next.skills.vision + effects.vision);
  if (effects.freeKick !== undefined) next.skills.freeKick = clamp(next.skills.freeKick + effects.freeKick);
  return next;
}
