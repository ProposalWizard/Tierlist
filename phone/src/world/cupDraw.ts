/**
 * WHICH DRAW TO SHOW after a match — the phone's port of the draw step in
 * page.tsx continueAfterMatch: a domestic cup round freshly drawn that you
 * are in (until the bracket shows the draw, from the quarter-finals), or a
 * Champions/Europa League knockout tie freshly drawn. The draw itself is the
 * game's own (lib/star/cups.ts, lib/star/euro.ts); this only decides whether
 * the reveal screen ("cup-draw") should play.
 *
 * For the CAREER area: after full time, `const d = drawToShow(career, fixture)`
 * and, when it is not null, `nav.go("cup-draw", { ...d, onContinue })`.
 */
import type { CareerState, Fixture } from "@/lib/star/types";
import { currentRound, lastSixteenIndex } from "@/lib/star/cups";
import { currentTie } from "@/lib/star/euro";

export interface DrawTie { home: string; away: string }
export interface DrawRound { name: string; ties: DrawTie[] }
export interface PendingDraw { competition: string; round: DrawRound }

export function drawToShow(from: CareerState, playedFixture: Fixture | null | undefined): PendingDraw | null {
  if (!playedFixture) return null;
  const cupCompetition = playedFixture.competition === "FA Cup" || playedFixture.competition === "League Cup"
    || playedFixture.competition === "Lower League Trophy" ? playedFixture.competition : null;
  if (cupCompetition) {
    const state = from.cupState?.find((s) => s.competition === cupCompetition);
    const round = state ? currentRound(state) : null;
    const freshlyDrawn = round && round.ties.length >= 2 && round.ties.every((t) => t.hs === undefined && !t.legs?.length);
    const youreIn = !!round && round.ties.some((t) => t.home === from.player.club || t.away === from.player.club);
    const r16 = state ? lastSixteenIndex(state) : -1;
    const shownInBracket = !!state && state.rounds.length - 1 > r16;
    if (freshlyDrawn && round && youreIn && !shownInBracket) {
      return { competition: cupCompetition, round: { name: round.name, ties: round.ties.map((t) => ({ home: t.home, away: t.away })) } };
    }
  }
  const isEuroKnockout = playedFixture.kind === "europe"
    && (playedFixture.competition === "Champions League" || playedFixture.competition === "Europa League");
  if (isEuroKnockout && from.euroState && !from.euroState.bracket) {
    const tie = currentTie(from.euroState);
    if (tie && tie.legs.every((l) => l.us === undefined)) {
      return { competition: from.euroState.competition, round: { name: tie.round, ties: [{ home: from.player.club, away: tie.opponent }] } };
    }
  }
  return null;
}
