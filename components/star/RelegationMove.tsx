"use client";
import type { CareerState } from "@/lib/star/types";
import type { TransferOffer } from "@/lib/star/transfers";
import { reputation, MOVE_RESET } from "@/lib/star/transfers";
import { clauseSummary } from "@/lib/star/contracts";

/**
 * THE OLD CLUB IS GONE. WHO NEXT?
 *
 * Reached only when relegation from the Championship is certain and the
 * ordinary transfer window (TransferWindow.tsx) would not make sense — there
 * is no "stay", because the pool your old club drops into has no season to
 * stay for. Otherwise built the same way: real offers, priced off the same
 * reputation and the same move-cost numbers, so a relegation does not feel
 * like a different game from a normal transfer.
 */

interface Props {
  career: CareerState;
  offers: TransferOffer[];
  onAccept: (offer: TransferOffer) => void;
}

export default function RelegationMove({ career, offers, onAccept }: Props) {
  const rep = Math.round(reputation(career));

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-950 to-gray-950 px-3 py-5 text-white">
      <div className="mx-auto w-full max-w-sm">
        <div className="text-center">
          <div className="inline-block rounded-full border border-red-400/40 bg-red-500/20 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-200">
            Relegated
          </div>
          <h1 className="mt-2 text-2xl font-black leading-tight">
            {career.player.club} are down. You need a new club.
          </h1>
          <p className="mt-1 text-xs text-gray-200">
            Your reputation is <span className="font-black text-white">{rep}</span> — a season the
            club had, not one you personally have to answer for.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {offers.map((o) => {
            const premier = o.division === "premier";
            return (
              <div key={o.club} className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-lg font-black text-white">{o.club}</span>
                  <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest ${
                    premier ? "text-emerald-300" : "text-gray-200"}`}
                  >
                    {premier ? "Premier League" : "Championship"}
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
                  className="mt-3 w-full rounded-lg bg-red-500 py-2.5 font-black text-white transition hover:bg-red-400 active:scale-[0.98]"
                >
                  Sign for {o.club}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-200">What a move costs</div>
          <p className="mt-1 text-[11px] text-gray-200">
            A new dressing room does not know you and a new manager has not picked you before.
            Team-mates start at {MOVE_RESET.team}, the manager at {MOVE_RESET.boss}, and you lose a
            little sharpness settling in. Your place in the side is earned again.
          </p>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-700 py-1.5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-white/85">{label}</div>
      <div className={`text-sm font-black ${highlight ? "text-emerald-300" : "text-white"}`}>{value}</div>
    </div>
  );
}
