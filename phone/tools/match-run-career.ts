// The test career the headless match tools play with (the same one tools/match-run.ts builds).
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { NATIONAL_LEAGUE_SOUTH_CLUBS } from "@/lib/star/clubs";
import type { CareerState, StarPlayer } from "@/lib/star/types";

export function testCareer(): CareerState {
  const clubs = [...NATIONAL_LEAGUE_SOUTH_CLUBS];
  const player = { firstName: "Test", lastName: "Player", age: 16, skinTone: "light", club: clubs[0], clubBadge: null, position: "ST", nationality: "England", startYear: 2026 } as StarPlayer;
  return makeInitialCareer(player, clubs, "national_league_south");
}
