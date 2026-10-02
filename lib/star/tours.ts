/**
 * THE POINTER TOURS — what each pop-up says and what it points at.
 *
 * Harry, 1 Oct 2026 (P7, P9, P10, P42, P66-P68, P102, P104): small NSS-style
 * pop-ups with a hand that point AT real things, in order — "Home", "your
 * player", "star rating", "energy", then "Go to training" which you must
 * press. "So the tutorial doesn't drag on, drag on, drag on."
 *
 * v0.24 (Harry, 2 Oct 2026): every screen's tour opens BY ITSELF the first
 * time you visit it and explains that screen's top bar (P1-22, P1-33, P1-42);
 * the "?" replays it. Training gets its own tutorial (P2-56 to P2-65), the
 * first match explains energy (P2-81) and Post Match Reactions are explained
 * (P2-85). Plain English, short lines.
 *
 * `target` is a `data-tour` name on a real element (components/star/
 * PointerTour.tsx finds it). `press` = the player has to press the thing
 * itself.
 */
export interface TourStep {
  /** A `data-tour` name, "screen" (the whole page), or "css:<selector>" for a
   *  thing that carries no tour name (the match's energy strip). */
  target: string;
  text: string;
  press?: boolean;
}

// The lines that explain the top bar. Every screen's tour starts with the bars
// it shows (Harry, 2 Oct 2026, P1-22, P1-33: "the first time they go to that
// page, it needs to tell them … this is what this bar is").
const BAR = {
  rating: { target: "rating", text: "Your star rating. Training, matches and fame make it go up" },
  energy: { target: "energy", text: "Your energy. Drills and matches use it. Rest days give it back, and a can tops it up" },
  money: { target: "money", text: "Your money. Matches pay you" },
  happiness: { target: "happiness", text: "Your happiness. It goes up when you rest and take a break" },
  reputation: { target: "reputation", text: "Your reputation. It is how people in football see you" },
  help: { target: "css:[data-help-button]", text: "Tap ? on any screen to see this again" },
} satisfies Record<string, TourStep>;

/** A new career's first screen: Home, your player, the bars, then training.
 *  "Go to training" has no Skip (P2-55: "You shouldn't have a skip option
 *  on that one"). */
export const WELCOME_TOUR: TourStep[] = [
  { target: "home", text: "This is Home" },
  { target: "player", text: "This is you" },
  BAR.rating,
  BAR.energy,
  BAR.money,
  BAR.help,
  { target: "nav-training", text: "Go to training", press: true },
];

/** The first time on the Training page (P2-56): what training is, why it
 *  matters, each drill, then you must start Power. */
export const TRAINING_TOUR: TourStep[] = [
  { target: "screen", text: "This is Training. Drills make your skills better, and better skills win matches" },
  { target: "sessions", text: "You get two drills each week. They come back after the match" },
  BAR.energy,
  { target: "skill-pace", text: "Pace: faster dribbles and more runs into space" },
  { target: "skill-power", text: "Power: long shots and stronger crosses" },
  { target: "skill-technique", text: "Technique: ball control, curl and accurate shots" },
  { target: "skill-vision", text: "Vision: more team-mates to pass to" },
  { target: "skill-freeKick", text: "Free Kick: free kicks, corners and penalties" },
  { target: "skill-power", text: "Start with Power. Tap it", press: true },
];

/** The level list, the first time: start at level 1. */
export const LEVEL_TOUR: TourStep[] = [
  { target: "level-1", text: "Each level gives you three tries. Score on the first try for three stars. Tap level 1", press: true },
];

/** Back on Training after the first drill (P2-63). */
export const ONE_MORE_DRILL_TOUR: TourStep[] = [
  { target: "sessions", text: "One drill done. You get two drills a session. Do one more" },
];

/** Both drills done: training is over for the week, and the League opens (P2-65, P2-66). */
export const LEAGUE_TOUR: TourStep[] = [
  { target: "sessions", text: "Training done for this week. Next: the match" },
  { target: "nav-league", text: "League unlocked", press: true },
];

/** Inside the League, once. */
export const LEAGUE_SCREEN_TOUR: TourStep[] = [
  { target: "screen", text: "Your league. Win matches to go up the table. The top teams go up a division" },
  BAR.help,
];

/** Back home before the first game: where the first steps live, then Play (P2-68, P2-69). */
export const FIRST_GAME_TOUR: TourStep[] = [
  { target: "nav-league", text: "Achievements. Your first steps are here" },
  { target: "nav-play", text: "To earn coins, play your first game", press: true },
];

/** After the first game: go and meet the boss (P2-86, P2-87). */
export const BOSS_TOUR: TourStep[] = [
  { target: "nav-life", text: "Time to meet your boss. Tap Relations", press: true },
];

/** On Relations, while the boss meeting is the next first step. */
export const BOSS_MEETING_TOUR: TourStep[] = [
  { target: "css:button[aria-label^='Boss meeting']", text: "Tap here to meet your boss", press: true },
];

/** After the boss meeting the Shop is next; the phone is the first thing to buy. */
export const SHOP_TOUR: TourStep[] = [
  { target: "tab-2", text: "The Shop", press: true },
  { target: "shop-style", text: "Buy your first phone in Style", press: true },
];

/** The phone was bought: open it. */
export const PHONE_TOUR: TourStep[] = [
  { target: "nav-phone", text: "Your phone is open. Tap it", press: true },
];

/** Achievements: the next first step's Go button, with that step's prompt. */
export const stepTour = (prompt: string): TourStep[] => [
  { target: "step-go", text: `${prompt}. Tap Go`, press: true },
];

/** The first match, at full time (P2-81, P2-82). `back` = energy the rest
 *  days give back before the next match. */
export function energyTour(back: number | null): TourStep[] {
  return [
    { target: "css:[role=meter][aria-label=Energy]", text: "Your energy goes down while you play" },
    { target: "css:[aria-label='low energy']", text: "Low: you save energy, but the ball comes to you less" },
    { target: "css:[aria-label='medium energy']", text: "Medium: the normal amount" },
    { target: "css:[aria-label='high energy']", text: "High: the ball comes to you more, but your energy goes down fast" },
    {
      target: "css:[role=meter][aria-label=Energy]",
      text: back && back > 0
        ? `Rest days before your next match give you ${back} energy back`
        : "Rest days before your next match give energy back",
    },
  ];
}

/** Post Match Reactions, the first time (P2-85). */
export const REACTIONS_TOUR: TourStep[] = [
  { target: "reactions-feed", text: "After every match, fans, the press and clubs react to how you played" },
  { target: "reactions-feed", text: "Good games make your fans happy and make you more famous" },
  { target: "reactions-continue", text: "Tap Continue when you are done" },
];

/** Replayed from the "?" button, and shown by itself the first time you open
 *  each screen (P1-42: "you shouldn't have to tap the question mark,
 *  especially the first time"). Each one starts with that screen's top bar. */
export type HelpScreen = "home" | "stats" | "shop" | "training" | "relations" | "league" | "style" | "settings" | "achievements" | "phone" | "sponsors" | "cans" | "boots";

export const HELP_TOURS: Record<HelpScreen, TourStep[]> = {
  home: [
    { target: "home", text: "This is Home" },
    { target: "player", text: "This is you" },
    BAR.rating,
    BAR.energy,
    BAR.money,
  ],
  stats: [
    BAR.rating,
    BAR.energy,
    { target: "screen", text: "Your stats, your form and your records" },
  ],
  shop: [
    BAR.rating,
    BAR.energy,
    BAR.money,
    { target: "screen", text: "Cans give energy. Boots make your shots better. Style raises your fame" },
  ],
  cans: [
    BAR.energy,
    BAR.money,
    { target: "screen", text: "A can gives you energy. Keep some for weeks with two matches" },
  ],
  boots: [
    BAR.rating,
    BAR.money,
    { target: "screen", text: "Boots add power and technique for a number of matches" },
  ],
  training: [
    BAR.rating,
    BAR.energy,
    { target: "sessions", text: "You get two drills each week" },
    { target: "screen", text: "Pick a drill. Stars on each level make the skill better" },
  ],
  relations: [
    BAR.happiness,
    BAR.energy,
    { target: "screen", text: "Your boss, your team-mates and the fans. Each one changes your career" },
    { target: "css:button[aria-label^='Boss meeting']", text: "A meeting with your boss. He picks you more when he likes you" },
  ],
  league: [
    BAR.rating,
    BAR.energy,
    { target: "screen", text: "Your league. Win matches to go up the table. The top teams go up a division" },
  ],
  // v0.23.1 (P62: "every page should have one of these").
  style: [
    BAR.reputation,
    BAR.energy,
    BAR.money,
    { target: "screen", text: "Buy things to raise your fame. More open as your star rating goes up" },
  ],
  settings: [
    BAR.rating,
    BAR.energy,
    { target: "home", text: "Home takes you back to your career" },
    { target: "screen", text: "Sound, the look of the game and your saves" },
  ],
  achievements: [
    { target: "screen", text: "Your first steps are at the top. Each one opens something new" },
  ],
  phone: [
    { target: "screen", text: "Your phone. Messages, social media and an App Store for more apps" },
  ],
  sponsors: [
    { target: "screen", text: "Sponsors pay you every week. Each deal has a target to hit" },
    { target: "screen", text: "Sign a deal, then play well to keep the sponsor happy" },
  ],
};
