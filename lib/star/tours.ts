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

/**
 * v0.25 (Harry and Mikey, live on their phones, 2 Oct 2026): "it doesn't have
 * to tell you about every single aspect on every page, maybe it should just be
 * the key things." Every tour is at most 3 short steps. Steps that only named
 * an obvious button are gone. The steps an unlock flow needs (a "press" step)
 * stay.
 */

/** Energy, at the very start (v0.25, point 37: "this should probably just be
 *  the start of the game"). It used to be explained at the first full time. */
const ENERGY_MODES: TourStep = { target: "energy", text: "In a match you pick Low, Medium or High. High: the ball comes to you more, but energy drops fast" };

/** A new career's first screen. v0.25 (game first): energy, then "You've got
 *  a game today". No Skip on the last step (P2-55). */
export function welcomeTour(gameFirst: boolean): TourStep[] {
  return [
    BAR.energy,
    ENERGY_MODES,
    gameFirst
      ? { target: "nav-play", text: "You've got a game today. Tap Play", press: true }
      : { target: "nav-training", text: "Go to training", press: true },
  ];
}
/** The v0.24 order's welcome (kept for a save part-way through it). */
export const WELCOME_TOUR: TourStep[] = welcomeTour(false);

/** The first time on the Training page: what it is, then you must start Power. */
export const TRAINING_TOUR: TourStep[] = [
  { target: "sessions", text: "Drills make your skills better. You get two each week" },
  { target: "skill-power", text: "Start with Power. Tap it", press: true },
];

/** The level list, the first time: start at level 1. */
export const LEVEL_TOUR: TourStep[] = [
  { target: "level-1", text: "Each level gives you three tries. Score on the first try for three stars. Tap level 1", press: true },
];

/** Back on Training after the first drill (P2-63). */
export const ONE_MORE_DRILL_TOUR: TourStep[] = [
  { target: "sessions", text: "One drill done. Do one more" },
];

/** Both drills done (v0.24 order): the League opens (P2-65, P2-66). */
export const LEAGUE_TOUR: TourStep[] = [
  { target: "sessions", text: "Training done for this week. Next: the match" },
  { target: "nav-league", text: "League unlocked", press: true },
];

/** Inside the League, once. */
export const LEAGUE_SCREEN_TOUR: TourStep[] = [
  { target: "screen", text: "Your league. Win matches to go up the table. The top teams go up a division" },
];

/** Back home before the first game (v0.24 order). */
export const FIRST_GAME_TOUR: TourStep[] = [
  { target: "nav-play", text: "To earn coins, play your first game", press: true },
];

/** After the first game: go and meet the boss (P2-86, P2-87). v0.25: the
 *  manager's talk is what opens Relations. */
export function bossTour(gameFirst: boolean): TourStep[] {
  return [{ target: "nav-life", text: gameFirst ? "Your manager wants a word. Tap Relations" : "Time to meet your boss. Tap Relations", press: true }];
}
export const BOSS_TOUR: TourStep[] = bossTour(false);

/** On Relations, while the boss meeting is the next first step. */
export const BOSS_MEETING_TOUR: TourStep[] = [
  { target: "css:button[aria-label^='Boss meeting']", text: "Tap here to meet your boss", press: true },
];

/** The phone step: the Shop, and the phone in it. v0.25: when you cannot pay
 *  for it yet, the tour says so (price, how much more) and asks for no tap. */
export function shopTour(line: string, canBuy: boolean): TourStep[] {
  return canBuy
    ? [{ target: "tab-2", text: "The Shop", press: true }, { target: "shop-style", text: `${line}. Buy it in Style`, press: true }]
    : [{ target: "tab-2", text: `Your next step is a phone. ${line}` }];
}
export const SHOP_TOUR: TourStep[] = shopTour("Your first phone", true);

/** The phone was bought: open it. */
export const PHONE_TOUR: TourStep[] = [
  { target: "nav-phone", text: "Your phone is open. Tap it", press: true },
];

/** Achievements: the next first step's Go button, with that step's prompt. */
export const stepTour = (prompt: string): TourStep[] => [
  { target: "step-go", text: `${prompt}. Tap Go`, press: true },
];

/** Post Match Reactions, the first time (P2-85). */
export const REACTIONS_TOUR: TourStep[] = [
  { target: "reactions-feed", text: "After every match, fans, the press and clubs react. Good games make you more famous" },
];

/** Replayed from the "?" button, and shown by itself the first time you open
 *  each screen (P1-42: "you shouldn't have to tap the question mark,
 *  especially the first time"). Each one starts with that screen's top bar. */
export type HelpScreen = "home" | "stats" | "shop" | "training" | "relations" | "league" | "style" | "settings" | "achievements" | "phone" | "sponsors" | "cans" | "boots";

export const HELP_TOURS: Record<HelpScreen, TourStep[]> = {
  home: [BAR.rating, BAR.energy, BAR.money],
  stats: [{ target: "screen", text: "Your stats, your form and your records" }],
  shop: [{ target: "screen", text: "Cans give energy. Boots make your shots better. Style raises your fame" }],
  cans: [{ target: "screen", text: "A can gives you energy. Keep some for weeks with two matches" }],
  boots: [{ target: "screen", text: "Boots add power and technique for a number of matches" }],
  training: [
    { target: "sessions", text: "You get two drills each week" },
    { target: "screen", text: "Pick a drill. Stars on each level make the skill better" },
  ],
  relations: [
    { target: "screen", text: "Your boss, your team-mates and the fans. Each one changes your career" },
    { target: "css:button[aria-label^='Boss meeting']", text: "A meeting with your boss. He picks you more when he likes you" },
  ],
  league: [{ target: "screen", text: "Your league. Win matches to go up the table. The top teams go up a division" }],
  style: [{ target: "screen", text: "Buy things to raise your fame. More open as your star rating goes up" }],
  settings: [{ target: "screen", text: "Sound, the look of the game and your saves" }],
  achievements: [{ target: "screen", text: "Your first steps are at the top. Each one opens something new" }],
  phone: [{ target: "screen", text: "Your phone. Messages, social media and an App Store for more apps" }],
  sponsors: [{ target: "screen", text: "Sponsors pay you every week. Hit a deal's target and keep the brand happy" }],
};
