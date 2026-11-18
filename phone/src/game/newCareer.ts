// A new career, made by the game's own rules (lib/star/careerFlow.ts), the same as the website.
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { NATIONAL_LEAGUE_SOUTH_CLUBS } from "@/lib/star/clubs";
import type { CareerState, StarPlayer } from "@/lib/star/types";

export function startCareer(firstName: string, lastName: string): CareerState {
  const clubs = [...NATIONAL_LEAGUE_SOUTH_CLUBS];
  const club = clubs.includes("Hampton & Richmond Borough") ? "Hampton & Richmond Borough" : clubs[0];
  const player = {
    firstName, lastName, age: 16, skinTone: "light", club, clubBadge: null,
    position: "ST", nationality: "England", startYear: new Date().getFullYear(),
  } as StarPlayer;
  return makeInitialCareer(player, clubs, "national_league_south");
}
