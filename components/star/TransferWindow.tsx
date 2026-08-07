"use client";
import type { CareerState } from "@/lib/star/types";
import type { TransferOffer } from "@/lib/star/transfers";
import { reputation, MOVE_RESET } from "@/lib/star/transfers";

interface Props {
  career: CareerState;
  offers: TransferOffer[];
  onAccept: (offer: TransferOffer) => void;
  onStay: () => void;
}

export default function TransferWindow({ career, offers, onAccept, onStay }: Props) {
  const rep = Math.round(reputation(career));
  const mine = career.league.find((t) => t.name === career.player.club)?.strength ?? 65;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white px-3 py-5">
      <div className="mx-auto w-full max-w-sm">
        <div className="text-center">
          <div className="inline-block rounded-full border border-violet-400/40 bg-violet-500/20 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">
            Transfer window
          </div>
          <h1 className="mt-2 text-2xl font-black">
            {offers.length === 1 ? "There is an offer on the table" : `${offers.length} clubs have come in`}
          </h1>
          <p className="mt-1 text-xs text-gray-200">
            Your reputation is <span className="font-black text-white">{rep}</span>. It is what decides who asks.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {offers.map((o) => {
            const step = o.strength - mine;
            return (
              <div key={o.club} className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-lg font-black text-white">{o.club}</span>
                  <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest ${
                    step > 6 ? "text-emerald-300" : step < -6 ? "text-amber-300" : "text-gray-200"}`}
                  >
                    {step > 6 ? "Step up" : step < -6 ? "Step down" : "Sideways"} · {o.position}
                    {o.position === 1 ? "st" : o.position === 2 ? "nd" : o.position === 3 ? "rd" : "th"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-200">{o.pitch}</p>

                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                  <Cell label="Wage" value={`★${o.wage}`} highlight={o.wage > career.contract.wage} />
                  <Cell label="Goal" value={`★${o.goalBonus}`} highlight={o.goalBonus > career.contract.goalBonus} />
                  <Cell label="Signing" value={`★${o.signingFee}`} highlight />
                  <Cell label="Years" value={`${o.seasons}`} />
                </div>

                <button
                  onClick={() => onAccept(o)}
                  className="mt-3 w-full rounded-lg bg-violet-500 py-2.5 font-black text-white transition hover:bg-violet-400 active:scale-[0.98]"
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

        <button
          onClick={onStay}
          className="mt-3 w-full rounded-xl bg-gray-700 py-3 font-black text-white transition hover:bg-gray-600"
        >
          Stay at {career.player.club}
        </button>
      </div>
    </div>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-700 py-1.5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-gray-300">{label}</div>
      <div className={`text-sm font-black ${highlight ? "text-emerald-300" : "text-white"}`}>{value}</div>
    </div>
  );
}
