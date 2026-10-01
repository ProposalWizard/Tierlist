"use client";
import type { CareerState } from "@/lib/star/types";
import type { TransferOffer } from "@/lib/star/transfers";
import { reputation, MOVE_RESET } from "@/lib/star/transfers";
import { clauseSummary } from "@/lib/star/contracts";
import { leagueNameFor } from "@/lib/star/calendar";
import ClubBadge from "@/components/star/ClubBadge";
import { Glow, PressButton, clubTheme } from "@/components/star/legacy/ui";
import { Screen, Kicker } from "@/components/star/legacy/ui/Screen";

interface Props {
  career: CareerState;
  offers: TransferOffer[];
  onAccept: (offer: TransferOffer) => void;
  onStay: () => void;
}

export default function TransferWindow({ career, offers, onAccept, onStay }: Props) {
  const rep = Math.round(reputation(career));
  const mine = career.league.find((t) => t.name === career.player.club)?.strength ?? 65;
  const theme = clubTheme(career.player.club, career);

  return (
    <Screen glow="#8b5cf6" tone={theme.glow} className="max-w-sm px-3 py-5">
      <div className="w-full">
        <div className="text-center">
          <Kicker color="#c4b5fd">Transfer window</Kicker>
          <h1 className="kit-drop-in mt-2 text-2xl font-black uppercase leading-tight" style={{ textShadow: "0 2px 8px rgba(0,0,0,.6)" }}>
            {offers.length === 1 ? "There is an offer on the table" : `${offers.length} clubs have come in`}
          </h1>
          <p className="mt-1 text-xs text-gray-200">
            Your reputation is <span className="font-black text-white">{rep}</span>. It is what decides who asks.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {offers.map((o, i) => {
            const step = o.strength - mine;
            const glow = clubTheme(o.club).glow;
            return (
              <div key={o.club} className="kit-card kit-rise p-4" style={{ ["--kit-glow" as string]: glow, animationDelay: `${250 + i * 110}ms` } as React.CSSProperties}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="relative shrink-0"><Glow color={glow} alpha={0.5} className="inset-0 blur-md" /><span className="relative block"><ClubBadge club={o.club} size={32} /></span></span>
                    <span className="truncate text-lg font-black text-white">{o.club}</span>
                  </span>
                  <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest ${
                    step > 6 ? "text-emerald-300" : step < -6 ? "text-amber-300" : "text-gray-200"}`}
                  >
                    {step > 6 ? "Step up" : step < -6 ? "Step down" : "Sideways"} · {o.position}
                    {o.position === 1 ? "st" : o.position === 2 ? "nd" : o.position === 3 ? "rd" : "th"}
                    {o.division ? ` in the ${leagueNameFor(o.division)}` : ""}
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
                {o.viaClause && (
                  <div className="mt-2 rounded-lg bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-100">
                    They have met your release clause. Your club cannot say no.
                  </div>
                )}

                <button
                  onClick={() => onAccept(o)}
                  className="kit-btn kit-btn-violet mt-3 w-full rounded-xl py-2.5"
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

        <PressButton
          variant="secondary"
          onClick={onStay}
          className="mt-3 w-full py-3 normal-case"
        >
          Stay at {career.player.club}
        </PressButton>
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
