"use client";

/**
 * YOUR CONTRACT, ON PAPER (Mikey, 22 Oct 2026: "the paper version, approved").
 * The Stats page's Contract tab: the same cream sheet you signed at the desk
 * (SigningScene.tsx), with the club's crest, every term, the clauses, and both
 * signatures. Same numbers and the same "Propose renewal" button as before.
 */
import type { CareerState } from "@/lib/star/types";
import { clauseSummary } from "@/lib/star/contracts";
import { divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { kitsOf } from "@/lib/star/kits";
import { formatMoney } from "@/lib/star/money";
import ClubBadge from "./ClubBadge";
import { PressButton } from "./ui";
import { SIGNATURE_D } from "./TrialReward";

const INK = "#1b140a";
const SOFT = "#6b5630";
const RULE = "rgba(59,47,28,.2)";

export default function ContractPaper({ career, onRenew }: { career: CareerState; onRenew: () => void }) {
  const c = career.contract;
  const kit = kitsOf(c.club).home;
  const clauses = clauseSummary(c);
  const playerName = `${career.player.firstName} ${career.player.lastName}`.trim();
  const terms: [string, string][] = [
    ["League", leagueNameFor(divisionOf(career))],
    ["Position", career.player.position],
    ["Shirt", career.squadNumber ? `No. ${career.squadNumber}` : "—"],
    ["Seasons left", String(c.seasonsRemaining)],
    ["Wage", `★${formatMoney(c.wage)} / week`],
    ["Goal bonus", `★${formatMoney(c.goalBonus)}`],
    ["Assist bonus", `★${formatMoney(c.assistBonus)}`],
  ];
  return (
    <div data-contract-paper>
      <div
        className="relative mx-auto mt-1 px-4 pb-4 pt-3 font-serif"
        style={{ color: INK, background: "linear-gradient(180deg,#fbf8f0,#efe9da)", borderRadius: 4, boxShadow: "0 14px 26px -12px rgba(0,0,0,.8), inset 0 0 0 1px rgba(160,120,40,.35)" }}
      >
        <div className="text-center text-[9px] font-bold uppercase tracking-[0.3em] text-[#8a6a23]">Professional contract</div>
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <ClubBadge club={c.club} kit={kit} size={30} />
          <span className="truncate text-[22px] font-black leading-none">{c.club}</span>
        </div>
        <div className="mt-1 text-center text-[11px] italic" style={{ color: SOFT }}>between the club and {playerName}</div>

        <div className="mt-3 space-y-1">
          {terms.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-2 pb-0.5" style={{ borderBottom: `1px solid ${RULE}` }}>
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: SOFT }}>{label}</span>
              <span className="truncate text-[14px] font-black tabular-nums">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[#8a6a23]">Clauses</div>
        {clauses.length > 0 ? (
          <ol className="mt-1 space-y-1">
            {clauses.map((cl, i) => (
              <li key={cl.label} className="text-[12px] leading-snug">
                <span className="font-black">{i + 1}. {cl.label}.</span> {cl.detail}
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-1 text-[12px] italic" style={{ color: SOFT }}>No clauses in this one. Ask for some at the next renewal.</div>
        )}

        {/* Both signatures: the club's in blue ink, yours in black. */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <svg viewBox="0 0 300 60" className="h-[24px] w-full" aria-hidden>
              <path d="M10 40 C 30 10, 50 50, 70 26 S 110 18, 130 36 S 170 44, 200 22 S 250 30, 290 26" fill="none" stroke="#1e3a8a" strokeWidth="5" strokeLinecap="round" />
            </svg>
            <div className="truncate border-t pt-0.5 text-[8.5px] font-bold uppercase tracking-wide" style={{ borderColor: "rgba(59,47,28,.7)", color: SOFT }}>For {c.club}</div>
          </div>
          <div>
            <svg viewBox="0 0 300 60" className="h-[24px] w-full" aria-hidden>
              <path d={SIGNATURE_D} fill="none" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="truncate border-t pt-0.5 text-[8.5px] font-bold uppercase tracking-wide" style={{ borderColor: "rgba(59,47,28,.7)", color: SOFT }}>{playerName}</div>
          </div>
        </div>
      </div>
      <PressButton variant="primary" onClick={onRenew} className="mt-3 w-full">Propose renewal</PressButton>
    </div>
  );
}
