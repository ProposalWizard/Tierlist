/**
 * THE POINTER TOURS — what each pop-up says and what it points at.
 *
 * Harry, 1 Oct 2026 (P7, P9, P10, P42, P66-P68, P102, P104): small NSS-style
 * pop-ups with a hand that point AT real things, in order — "Home", "your
 * player", "star rating", "energy", then "Go to training" which you must
 * press. "So the tutorial doesn't drag on, drag on, drag on."
 *
 * `target` is a `data-tour` name on a real element (components/star/
 * PointerTour.tsx finds it). `press` = the player has to press the thing
 * itself. Nothing here explains a number: a line is a label, or one short
 * line where Harry asked for it (the star rating).
 */
export interface TourStep { target: string; text: string; press?: boolean }

/** A new career's first screen: Home, your player, rating, energy, then training. */
export const WELCOME_TOUR: TourStep[] = [
  { target: "home", text: "Home" },
  { target: "player", text: "Your player" },
  { target: "rating", text: "Your star rating — a mix of your skills, experience and fame" },
  { target: "energy", text: "Energy" },
  { target: "nav-training", text: "Go to training", press: true },
];

/** The two drills are done: the League opens, and you press it. */
export const LEAGUE_TOUR: TourStep[] = [
  { target: "nav-league", text: "League unlocked", press: true },
];

/** Inside the League, once. */
export const LEAGUE_SCREEN_TOUR: TourStep[] = [
  { target: "screen", text: "Your league" },
];

/** Back home with the League seen: go and play. */
export const FIRST_GAME_TOUR: TourStep[] = [
  { target: "nav-play", text: "To earn coins, play your first game", press: true },
];

/** After the first game the Shop opens; the phone is the first thing to buy. */
export const SHOP_TOUR: TourStep[] = [
  { target: "tab-2", text: "The Shop is open", press: true },
  { target: "shop-style", text: "Buy your first phone", press: true },
];

/** Replayed from the "?" button. Never forced. */
export type HelpScreen = "home" | "stats" | "shop" | "training" | "relations" | "league" | "style" | "settings";

export const HELP_TOURS: Record<HelpScreen, TourStep[]> = {
  home: [
    { target: "home", text: "Home" },
    { target: "player", text: "Your player" },
    { target: "rating", text: "Your star rating — a mix of your skills, experience and fame" },
    { target: "energy", text: "Energy" },
  ],
  stats: [
    { target: "rating", text: "Your star rating — a mix of your skills, experience and fame" },
    { target: "screen", text: "Your stats and records" },
  ],
  shop: [
    { target: "money", text: "Your coins" },
    { target: "energy", text: "Energy" },
    { target: "screen", text: "Cans, boots, style and sponsors" },
  ],
  training: [
    { target: "energy", text: "Drills use energy" },
    { target: "screen", text: "Pick a drill. Stars raise your rating" },
  ],
  relations: [
    { target: "happiness", text: "Your happiness" },
    { target: "screen", text: "Boss, team and fans" },
  ],
  league: [
    { target: "screen", text: "Table, results and fixtures" },
  ],
  // v0.23.1 (P62: "every page should have one of these").
  style: [
    { target: "reputation", text: "Your reputation. What people think of you" },
    { target: "money", text: "Your coins. Buy things, and they raise your fame" },
    { target: "energy", text: "Energy" },
  ],
  settings: [
    { target: "home", text: "Home takes you back to your career" },
    { target: "energy", text: "Energy is always here, on every screen" },
  ],
};
