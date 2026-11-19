/**
 * The game's top bar (ui/look/TopBar) wired to the app's screens, for the
 * world screens the website shows it on: League, Phone, Sponsors, Star Pass's
 * neighbours. Same buttons as Home: ? help, ⚙ settings, the star opens the
 * Star Pass.
 */
import type { CareerState } from "@/lib/star/types";
import { useNav } from "../nav";
import { SCREENS } from "../areas/registry";
import { TopBar } from "../ui/look";

export function GameTop({ career, help = "home" }: { career: CareerState; help?: string }) {
  const nav = useNav();
  return (
    <TopBar career={career}
      onHelp={SCREENS["career-help"] ? () => nav.go("career-help", { topic: help }) : undefined}
      onSettings={() => nav.go("career-settings")}
      onStarPass={SCREENS["star-pass"] ? () => nav.go("star-pass") : undefined} />
  );
}
