import { GAME_PATH } from "@/lib/star/gamePath";

/**
 * THE GAMES ON THE PUBLIC HOME (Harry, 12 Nov 2026).
 * The same public games as the site menu (components/GameSidebar.tsx). A game
 * goes here only when anyone can open its page. Squad Builder is not here: it
 * is testers only.
 */
export const MAIN_GAME = {
  name: "Road to the Golden Ball",
  href: GAME_PATH,
  line: "A football career game. Start as a kid at a trial, play your matches and work your way to the top.",
} as const;

export type TileId = "draft" | "ttt" | "tenable" | "rankings" | "blind";

export interface HomeGame {
  id: TileId;
  name: string;
  /** 3 to 5 words. */
  line: string;
  href: string;
}

export const MORE_GAMES: HomeGame[] = [
  { id: "draft", name: "Draft", line: "Pick your dream eleven", href: "/draft" },
  { id: "ttt", name: "Tic Tac Toe", line: "Name players, win squares", href: "/tic-tac-toe" },
  { id: "tenable", name: "Ten-A-Ball", line: "Ten answers to find", href: "/tenable" },
  { id: "rankings", name: "Rankings", line: "Sort players into tiers", href: "/tierlists" },
  { id: "blind", name: "Blind Rankings", line: "Rank them one by one", href: "/blind-rankings" },
];

export type HomeLook = "a" | "b" | "c" | "d";
export const HOME_LOOKS: { id: HomeLook; name: string }[] = [
  { id: "a", name: "Stadium night" },
  { id: "b", name: "Friv Classic" },
  { id: "c", name: "Clean arcade" },
  { id: "d", name: "Cream phone" },
];
export function pickLook(v: string | string[] | undefined): HomeLook {
  const s = (Array.isArray(v) ? v[0] : v ?? "").toLowerCase();
  return s === "b" || s === "c" || s === "d" ? s : "a";
}
