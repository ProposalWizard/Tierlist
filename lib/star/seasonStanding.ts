import type { CareerState } from "./types";
import type { CareerDivision } from "./calendar";
import type { LadderOutcome } from "./promotion";
import {
  FAME_FOR_TROPHY, FAME_FOR_PROMOTION_TO, FAME_EVENTS, addFame, fadedFame,
} from "./fame";
import { REPUTATION_EVENTS, clampReputation } from "./reputation";
import { computeSeasonAwardStats } from "./seasonAwards";
import { computeBallonDorShortlist } from "./ballonDor";
import { MAJORITY_THRESHOLD } from "./investments";
import { sortLeague } from "./season";

/**
 * WHAT A SEASON DID TO YOUR FAME AND YOUR REPUTATION.
 *
 * Run once, at season rollover (careerFlow.ts's advanceSeason), off the
 * season that has just finished. Pure, and returns its reasons as lines so
 * the dashboard can say WHY a number moved rather than just that it did.
 *
 * Fame here is EARNED fame only — see fame.ts. Nothing in this file pays
 * fame for merely playing; that was removed on purpose.
 */
export interface SeasonStanding {
  fame: number;
  reputation: number;
  news: string[];
}

export function seasonStanding(
  career: CareerState,
  ladder: Pick<LadderOutcome, "yourMove" | "promotedToPremier" | "promotedToChampionship"
    | "promotedToLeagueOne" | "promotedToLeagueTwo" | "relegatedFromPremier"
    | "relegatedFromChampionship" | "relegatedFromLeagueOne" | "relegatedFromLeagueTwo"
    | "relegatedFromNationalLeague">,
  nextDivision: CareerDivision,
  userWonBallonDor: boolean,
  qualifiedForEurope: boolean,
  winners: CareerState["lastSeasonWinners"],
): SeasonStanding {
  const news: string[] = [];
  let fame = career.fame ?? 0;
  let rep = career.reputation;
  const gain = (n: number, why: string) => {
    if (!n) return;
    fame = addFame(fame, n);
    news.push(`${n > 0 ? "+" : ""}${n} fame — ${why}`);
  };
  const trust = (n: number, why: string) => {
    if (!n) return;
    rep = clampReputation(rep + n);
    news.push(`${n > 0 ? "+" : ""}${n} reputation — ${why}`);
  };

  // ── Trophies you won ──
  const won = career.trophies.filter(t => t.season === career.season);
  for (const t of won) {
    gain(FAME_FOR_TROPHY[t.competition] ?? 2, `won the ${t.competition}`);
    trust(REPUTATION_EVENTS.personalTrophy, `won the ${t.competition}`);
  }

  // ── Promotion / relegation ──
  if (ladder.yourMove === "promoted") {
    gain(FAME_FOR_PROMOTION_TO[nextDivision] ?? 0, "promoted");
  } else if (ladder.yourMove === "relegated") {
    gain(FAME_EVENTS.relegated, "relegated");
  }

  if (qualifiedForEurope) gain(FAME_EVENTS.qualifiedForEurope, "qualified for Europe");

  // ── Individual awards ──
  const awards = computeSeasonAwardStats(career);
  if (awards.playerOfSeason?.isYou) gain(FAME_EVENTS.playerOfSeason, "Player of the Season");
  if (awards.youngPlayerOfSeason?.isYou) gain(FAME_EVENTS.youngPlayerOfSeason, "Young Player of the Season");
  if (awards.goldenBoot?.isYou) gain(FAME_EVENTS.goldenBoot, "Golden Boot");
  if (awards.teamOfSeason.some(m => m.isYou)) gain(FAME_EVENTS.teamOfSeason, "Team of the Season");

  // ── The Ballon d'Or ──
  if (userWonBallonDor) {
    gain(FAME_EVENTS.ballonDorWin, "won the Ballon d'Or");
  } else {
    const rank = computeBallonDorShortlist(career).playerRank;
    if (rank === 2 || rank === 3) gain(FAME_EVENTS.ballonDorTopThree, `finished ${rank === 2 ? "2nd" : "3rd"} in the Ballon d'Or`);
  }

  // ── A season mostly on the bench ──
  const leagueGames = Math.max(1, (career.league.length - 1) * 2);
  if (career.seasonStats.appearances < leagueGames / 2) gain(FAME_EVENTS.benchedSeason, "a season mostly out of the side");

  // ── The fade: drop toward your NEXT division's natural level ──
  const before = fame;
  fame = fadedFame(fame, nextDivision);
  const faded = Math.round((before - fame) * 10) / 10;
  if (faded >= 0.5) news.push(`−${Math.round(faded)} fame — fading at this level`);

  // ── Reputation: a clean season ──
  if (career.lastScandalSeason !== career.season) trust(REPUTATION_EVENTS.cleanSeason, "a season without scandal");

  // ── Reputation: clubs you own ──
  const owned = (career.investments ?? []).filter(s => s.percent >= MAJORITY_THRESHOLD).map(s => s.club);
  const promotedLists = [ladder.promotedToPremier, ladder.promotedToChampionship, ladder.promotedToLeagueOne, ladder.promotedToLeagueTwo];
  const relegatedLists = [ladder.relegatedFromPremier, ladder.relegatedFromChampionship, ladder.relegatedFromLeagueOne,
    ladder.relegatedFromLeagueTwo, ladder.relegatedFromNationalLeague];
  const winnerClubs = Object.entries(winners ?? {})
    .filter(([k]) => k !== "leagueRunnerUp").map(([, v]) => v).filter(Boolean) as string[];
  const table = sortLeague(career.league);
  const byStrength = [...career.league].sort((a, b) => b.strength - a.strength);
  for (const club of owned) {
    if (winnerClubs.includes(club) || promotedLists.some(l => l?.includes(club))) {
      trust(REPUTATION_EVENTS.ownedClubTrophyOrPromotion, `${club} (your club) won something or went up`);
    } else if (relegatedLists.some(l => l?.includes(club))) {
      trust(REPUTATION_EVENTS.ownedClubRelegated, `${club} (your club) went down`);
    } else {
      const pos = table.findIndex(t => t.name === club);
      const expected = byStrength.findIndex(t => t.name === club);
      if (pos >= 0 && expected >= 0 && expected - pos >= 3) {
        trust(REPUTATION_EVENTS.ownedClubBeatExpectations, `${club} (your club) beat expectations`);
      }
    }
  }

  return { fame, reputation: rep, news };
}
