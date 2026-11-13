import type { Metadata } from "next";
import { AllGames } from "@/components/home/PublicHome";

/** The home's "All games" tab (Harry, 12 Nov 2026): the games, no other words. */
export const metadata: Metadata = {
  title: "All games",
  description: "Every Knowitball game: Road to the Golden Ball, Draft, Tic Tac Toe, Ten-A-Ball, Rankings and Blind Rankings.",
  alternates: { canonical: "/games" },
};

export default function GamesPage() {
  return <AllGames />;
}
