/**
 * BREAKING NEWS — a short pop-up, a headline and one line (Harry, 1 Oct 2026,
 * P28, P50). New Star Soccer shows "a little football news" after something
 * happens; Harry: "we can have that breaking news article of 'youngster signs
 * for Brentford' or whatever, and he's looking to take charge of the league …
 * not spoon-fed too much". Instead of the old full newspaper page.
 *
 * Used after signing for a club, and after the big events: a first goal, a
 * trophy. Nothing else.
 */
import type { CareerState, Fixture } from "./types";
import { divisionOf, leagueNameFor } from "./calendar";
import { shortClub } from "./media/grammar";
import { faceOrFake } from "./fakeFaces";

/**
 * `club` and `face` are the picture on the full-screen page: the club's crest
 * and the player's face (his own photo, else his stable fake face). Both are
 * optional — a news item with neither still shows.
 */
export interface BreakingNews { headline: string; line: string; club?: string; face?: string }

const faceOf = (career: CareerState) =>
  faceOrFake(career.player.portrait, `${career.player.firstName} ${career.player.lastName}`);

const upper = (s: string) => s.toUpperCase();

/** "Youngster signs for Brentford" — a player under 21 is a youngster. */
export function signingNews(career: CareerState, club: string): BreakingNews {
  const p = career.player;
  const who = p.age <= 20 ? "Youngster" : "Player";
  const league = leagueNameFor(divisionOf(career));
  return {
    headline: upper(`${who} signs for ${shortClub(club)}`),
    line: `${p.firstName} ${p.lastName}, ${p.age}, has joined ${shortClub(club)} and wants to take charge of the ${league}.`,
    club, face: faceOf(career),
  };
}

/** The first goal of a career. */
export function firstGoalNews(career: CareerState): BreakingNews {
  return {
    headline: upper(`${career.player.lastName} opens his account`),
    line: `A first senior goal for ${shortClub(career.player.club)}.`,
    club: career.player.club, face: faceOf(career),
  };
}

/** A cup won. `competition` is the fixture's label ("FA Cup"). */
export function trophyNews(career: CareerState, competition: string): BreakingNews {
  return {
    headline: upper(`${shortClub(career.player.club)} win the ${competition}`),
    line: `${career.player.firstName} ${career.player.lastName} lifts the trophy.`,
    club: career.player.club, face: faceOf(career),
  };
}

/** Which news a played match earned: a first goal, a cup. Pure — the page queues what it returns. */
export function newsForMatch(before: CareerState, after: CareerState, fixture: Fixture, competition: string | null): BreakingNews[] {
  const out: BreakingNews[] = [];
  if ((before.careerStats?.goals ?? 0) === 0 && (after.careerStats?.goals ?? 0) > 0) out.push(firstGoalNews(after));
  if (competition && after.knockoutMessage?.startsWith("🏆")) out.push(trophyNews(after, competition));
  return out;
}
