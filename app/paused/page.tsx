import type { Metadata } from "next";
import { AllGames } from "@/components/home/PublicHome";

/**
 * The "not running right now" page for Rankings (Mikey, 17 Nov 2026).
 * middleware.ts shows this in place of every Rankings page while
 * RANKINGS_PAUSED is true (lib/rankingsPaused.ts); the address bar keeps the
 * old link. Back to home, then the other games.
 */
export const metadata: Metadata = {
  title: "Not running right now",
  robots: { index: false, follow: true },
};

export default function PausedPage() {
  return <AllGames paused />;
}
