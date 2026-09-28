"use client";
import type { CareerState } from "@/lib/star/types";
import type { TransferOffer } from "@/lib/star/transfers";
import { reputation, MOVE_RESET } from "@/lib/star/transfers";
import { clauseSummary } from "@/lib/star/contracts";
import { divisionOf, divisionRank, leagueNameFor } from "@/lib/star/calendar";
import ClubBadge from "./ClubBadge";
import { Glow, clubTheme } from "./ui";
import { Screen, Kicker } from "./ui/Screen";

/**
 * THE OLD CLUB IS GONE. WHO NEXT?
 *
 * Reached only when relegation out of the National League (into its own
 * four-club pool, which has no fixtures, no table, no season) is certain —
 * every other boundary on the ladder is a real division now, so the
 * ordinary transfer window (TransferWindow.tsx) works fine for it.
 * Otherwise built the same way: real offers, priced off the same reputation
 * and the same move-cost numbers, so a relegation does not feel like a
 * different game from a normal transfer.
 */

interface Props {
  career: CareerState;
  offers: TransferOffer[];
  onAccept: (offer: TransferOffer) => void;
}

export default function RelegationMove({ career, offers, onAccept }: Props) {
  const rep = Math.round(reputation(career));

  return (
    <Screen glow="#dc2626" className="max-w-sm px-3 py-5">
      <div className="w-full">
        <div className="text-center">
          <Kicker color="#fca5a5">Relegated</Kicker>
          <h1 className="kit-shake-x mt-2 text-2xl font-black uppercase leading-tight" style={{ textShadow: "0 2px 8px rgba(0,0,0,.6)" }}>
            {career.player.club} are down. You need a new club.
          </h1>
          <p className="mt-1 text-xs text-gray-200">
            Your reputation is <span className="font-black text-white">{rep}</span> — a season the
            club had, not one you personally have to answer for.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {offers.map((o, i) => {
            const offerDivision = o.division ?? divisionOf(career);
            const stepUp = divisionRank(offerDivision) < divisionRank(divisionOf(career));
            const glow = clubTheme(o.club).glow;
            return (
              <div key={o.club} className="kit-card kit-rise p-4" style={{ ["--kit-glow" as string]: glow, animationDelay: `${300 + i * 110}ms` } as React.CSSProperties}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="relative shrink-0"><Glow color={glow} alpha={0.5} className="inset-0 blur-md" /><span className="relative block"><ClubBadge club={o.club} size={32} /></span></span>
                    <span className="truncate text-lg font-black text-white">{o.club}</span>
                  </span>
                  <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest ${
                    stepUp ? "text-emerald-300" : "text-gray-200"}`}
                  >
                    {leagueNameFor(offerDivision)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-200">{o.pitch}</p>

                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                  <Cell label="Wage" value={`★${o.wage}`} highlight={o.wage > career.contract.wage} />
                  <Cell label="Goal" value={`★${o.goalBonus}`} highlight={o.goalBonus > career.contract.goalBonus} />
                  <Cell label="Signing" value={`★${o.signingFee}`} highlight />
                  <Cell label="Years" value={`${o.seasons}`} />
                </div>

                {(() => {
                  const clauses = clauseSummary({ ...career.contract, ...o.clauses });
                  return clauses.length > 0 ? (
                    <div className="mt-2 space-y-0.5">
                      {clauses.map(c => (
                        <div key={c.label} className="text-[10px] text-gray-200">
                          <span className="font-black text-white">{c.label}</span> — {c.detail}
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                <button
                  onClick={() => onAccept(o)}
                  className="kit-btn kit-btn-green mt-3 w-full rounded-xl py-2.5"
                >
                  Sign for {o.club}
                </button>
              </div>
            );
          })}
        </div>

        <div className="kit-card mt-4 p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-200">What a move costs</div>
          <p className="mt-1 text-[11px] text-gray-200">
            A new dressing room does not know you and a new manager has not picked you before.
            Team-mates start at {MOVE_RESET.team}, the manager at {MOVE_RESET.boss}, and you lose a
            little sharpness settling in. Your place in the side is earned again.
          </p>
        </div>
      </div>
    </Screen>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="kit-row rounded-lg py-1.5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-white/85">{label}</div>
      <div className={`text-sm font-black ${highlight ? "text-emerald-300" : "text-white"}`}>{value}</div>
    </div>
  );
}
