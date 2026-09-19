"use client";
import { useState } from "react";
import type { ScoutOffer } from "@/lib/star/scoutOffers";
import { offerLeagueName } from "@/lib/star/scoutOffers";
import { formatMoney } from "@/lib/star/money";
import ClubBadge from "./ClubBadge";
import type { TrialProgress } from "@/lib/star/trial";
import { TRIAL_STAGES, STAGE_LABEL, trialScore, adversityFor } from "@/lib/star/trial";

/**
 * WHAT THE TRIAL WAS FOR.
 *
 * The afternoon's number, what each stage of it was worth, and the clubs that
 * were watching. Until this screen existed the score was computed, shown for a
 * beat and thrown away.
 *
 * ── Why the breakdown is on the same screen as the offers ──
 *
 * A number out of a hundred means nothing on its own, and a player who is
 * about to choose a club deserves to see WHY those clubs and not others. Every
 * stage's score and how hard it was are already on the career; showing them
 * here costs nothing and turns "62" into "you were good at the things they
 * watch and poor at the ones they don't".
 */

export interface ScoutOffersProps {
  trial: TrialProgress;
  offers: ScoutOffer[];
  playerName: string;
  onAccept: (offer: ScoutOffer) => void;
  /** Nobody came in. The only way on is the free-agent life.
   *  REQUIRED, not optional: the "Go home" button is the only way off this
   *  screen for a player nobody signed, and an optional handler behind an
   *  unconditional button is a dead end waiting to happen. */
  onNoOffers: () => void;
}

export default function ScoutOffers({
  trial, offers, playerName, onAccept, onNoOffers,
}: ScoutOffersProps) {
  const [open, setOpen] = useState(false);
  const score = trialScore(trial);

  const breakdown = (
    <div className="mt-3 space-y-1.5">
      {TRIAL_STAGES.map(s => {
        const r = trial.results[s];
        return (
          <div key={s} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-[10px] font-black uppercase tracking-widest text-white/50">
              {STAGE_LABEL[s]}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${r?.score ?? 0}%` }}
              />
            </div>
            <span className="w-7 shrink-0 text-right text-[11px] font-black tabular-nums">
              {r?.score ?? 0}
            </span>
          </div>
        );
      })}
      {/* ── Whatever went on that day, not just the one event ──
          This used to read `trial.adversity === "sharp-keeper"` with the
          label hardcoded beside it, which was fine while a sharp keeper was
          the only event there was. There are eleven now, so a hardcoded
          check would have silently hidden ten of them — the whole catalogue
          drawn, rolled onto a stage, genuinely changing the football, and
          never once mentioned. The event carries its own label; the pill
          just prints it.

          The two flavour events show here too, on purpose. Somebody famous
          on the touchline changed no football at all and is worth exactly
          nothing (`weight: 0`, so `scoringDifficultyFor` ignores it) — but it
          is still a true thing about the afternoon, and this pill is a
          description of the day rather than a claim about the score. */}
      {(() => {
        const ev = adversityFor(trial);
        if (!ev || !trial.adversityStage) return null;
        return (
          <div
            className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
              ev.flavour ? "bg-white/10 text-white/70" : "bg-amber-500/20 text-amber-200"
            }`}
          >
            {ev.label}{ev.flavour ? "" : ` · ${STAGE_LABEL[trial.adversityStage]}`}
          </div>
        );
      })()}
    </div>
  );

  // ── Nobody came ────────────────────────────────────────────────────────
  if (!offers.length) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8 text-white">
        <div className="text-center">
          <div className="text-[11px] font-black uppercase tracking-widest text-white/50">
            Your trial
          </div>
          <div className="mt-1 text-6xl font-black tabular-nums">{score}</div>
        </div>
        {breakdown}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-black uppercase tracking-widest text-amber-300">
            Nobody came in
          </div>
          <p className="mt-2 text-[12px] font-bold leading-relaxed text-white/70">
            They thanked you and said they&apos;d be in touch. They won&apos;t be.
            No club, no contract, nothing in the bank — just you, a garden and
            whatever you can make of the next few months, {playerName}.
          </p>
        </div>
        <button
          onClick={onNoOffers}
          className="mt-5 w-full rounded-xl bg-white/10 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-white/20"
        >
          Go home →
        </button>
      </div>
    );
  }

  // ── Somebody did ───────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 text-white">
      <div className="text-center">
        <div className="text-[11px] font-black uppercase tracking-widest text-white/50">
          Your trial
        </div>
        <div className="mt-1 text-6xl font-black tabular-nums">{score}</div>
        <button
          onClick={() => setOpen(o => !o)}
          className="mt-1 text-[11px] font-bold text-white/50 underline"
        >
          {open ? "Hide the breakdown" : "How did they work that out?"}
        </button>
      </div>
      {open && breakdown}

      <div className="mt-6 text-[11px] font-black uppercase tracking-widest text-white/60">
        {offers.length === 1 ? "One club came in" : `${offers.length} clubs came in`}
      </div>

      <div className="mt-2 space-y-3">
        {offers.map(o => (
          <div key={o.club} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <ClubBadge club={o.club} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black">{o.club}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  {offerLeagueName(o)}
                </div>
              </div>
            </div>
            <p className="mt-2 text-[12px] font-bold italic text-white/70">&ldquo;{o.pitch}&rdquo;</p>
            <div className="mt-3 flex gap-2 text-center">
              <Term label="Wage" value={`${formatMoney(o.wage)}/wk`} />
              <Term label="Per goal" value={formatMoney(o.goalBonus)} />
              <Term label="Years" value={`${o.seasons}`} />
            </div>
            <button
              onClick={() => onAccept(o)}
              className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-400"
            >
              Sign for {o.club}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg bg-black/30 px-2 py-2">
      <div className="text-[9px] font-black uppercase tracking-widest text-white/45">{label}</div>
      <div className="text-[12px] font-black tabular-nums">{value}</div>
    </div>
  );
}
