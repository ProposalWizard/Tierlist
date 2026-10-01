"use client";
import type { CareerState, Fixture } from "@/lib/star/types";
import type { Selection } from "@/lib/star/selection";
import { setPieceDuties } from "@/lib/star/setPieces";
import { startingTeammateRoles, onPitchToday, fillMissingFromFullRoster } from "@/lib/star/teamsheet";
import { takerRating, designatedTaker } from "@/lib/star/penaltyTaking";

/**
 * WHO IS ON PENALTIES TODAY — and what earns you them (v0.15 item 6).
 *
 * One line on the match-day screen. Harry: "A line tells you who's on
 * penalties and what earns you the duty." The duty is today's rule with each
 * star counting double (free kick + 8 × stars ≥ club strength − 20); the
 * team's taker is the best penalty-taker in the eleven actually starting.
 */
export default function PenaltyDutyLine({ career, fixture, status }: {
  career: CareerState; fixture: Fixture; status: Selection;
}) {
  if (fixture.kind === "international") return null;
  const duties = setPieceDuties(career, status);
  const roles = startingTeammateRoles(career, fixture);
  const squad = onPitchToday(fillMissingFromFullRoster(career.squad ?? [], roles, career), roles);
  const taker = designatedTaker(squad.map((p) => ({
    id: p.id, name: p.name, shortName: p.shortName, rating: takerRating(p), isGK: p.position === "GK",
  })));
  const mate = taker?.shortName ?? "A team-mate";
  // The standing is free kick + ability (career.starRating) × a weight
  // (setPieces.ts). Only the one total is shown: the player sees one rating,
  // the 1-100 star rating, and no Overall (Harry, 1 Oct 2026).
  const sum = `penalty score ${Math.round(duties.penaltyStanding)}`;
  const onPitch = status !== "Squad" && status !== "Injured";
  return (
    <div className="mt-2.5 rounded-lg bg-black/25 px-2.5 py-2 text-left">
      <div className="text-[11px] font-black text-white">
        🎯 Penalties: <span className={duties.penalties ? "text-emerald-300" : "text-amber-200"}>
          {duties.penalties ? "you" : mate}
        </span>
      </div>
      <div className="mt-0.5 text-[10px] font-bold leading-snug text-white/85">
        {!onPitch
          ? `You're not playing — ${mate} takes them.`
          : duties.penalties
            ? `You're on them: ${sum} (needs ${duties.penaltyNeeded}).`
            : `You take over at ${duties.penaltyNeeded}: ${sum} now. Free kick training raises it.`}
      </div>
    </div>
  );
}
