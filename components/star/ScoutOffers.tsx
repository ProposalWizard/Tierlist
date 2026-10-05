"use client";
import type { ScoutOffer } from "@/lib/star/scoutOffers";
import { offerLeagueName } from "@/lib/star/scoutOffers";
import { formatMoney } from "@/lib/star/money";
import ClubBadge from "./ClubBadge";
import type { TrialProgress } from "@/lib/star/trial";
import { Glow, PressButton, clubTheme } from "./ui";
import { Screen, Kicker } from "./ui/Screen";

const PITCH_GREEN = "#2F6F4E";

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
  /**
   * The club whose youth team will take you if nobody offers terms, or null
   * if even that is not on the table.
   *
   * This screen used to tell every unsigned player the same thing — "no club,
   * no contract, nothing in the bank, just you and a garden" — and that
   * stopped being true when the youth team landed: a trial that falls short
   * now usually means somebody's academy, and only a trial nobody wanted at
   * all means the garden. The same screen saying otherwise would be a lie on
   * the one screen a player reads most carefully.
   *
   * Passed in rather than worked out here: `youthTakerFor` is a pure function
   * of the trial, and page.tsx computes it once so what this screen promises
   * and what the button actually does cannot drift apart.
   */
  youthClub: string | null;
  /** Nobody offered terms. Goes to the youth team, or to the free-agent life
   *  when `youthClub` is null.
   *  REQUIRED, not optional: this button is the only way off this screen for
   *  a player nobody signed, and an optional handler behind an unconditional
   *  button is a dead end waiting to happen. */
  onNoOffers: () => void;
  /** Absent means no button. Reported directly: "not always easy to go to
   *  home screen or back" — this screen had no chrome at all. */
  onSettings?: () => void;
}

export default function ScoutOffers({
  trial, offers, playerName, youthClub, onAccept, onNoOffers, onSettings,
}: ScoutOffersProps) {
  const settingsButton = onSettings && (
    <button
      onClick={onSettings}
      className="absolute right-4 top-4 z-10 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest hover:bg-white/20"
    >
      Settings
    </button>
  );
  // v0.23 (Harry, 1 Oct 2026): "you don't get a trial rating, you just get
  // scouted" and "this whole no contract thing, don't put this in the game".
  // So the trial's score and its per-stage bars are not shown any more (the
  // numbers are still worked out and kept; nothing on screen is built from
  // them), and the no-offer card no longer says "No contract".
  void trial;

  if (!offers.length) {
    return (
      <Screen glow={PITCH_GREEN} className="max-w-md px-4 py-8">
        {settingsButton}
        <div className="kit-card mt-6 p-5">
          <div className="text-sm font-black uppercase tracking-widest text-amber-300">
            Not this time
          </div>
          {youthClub ? (
            <p className="mt-2 text-[12px] font-bold leading-relaxed text-white/70">
              Nobody put professional terms in front of you, {playerName}. But
              somebody watched: {youthClub} will take you into their youth
              team. Scholarship money, and a coach who will look at you every
              week. Play well enough and you go up.
            </p>
          ) : (
            <p className="mt-2 text-[12px] font-bold leading-relaxed text-white/70">
              They thanked you and said they&apos;d be in touch. They won&apos;t be.
              No club, no contract, not even an academy — just you, a garden and
              whatever you can make of the next few months, {playerName}.
            </p>
          )}
        </div>
        <PressButton
          variant="secondary"
          size="lg"
          onClick={onNoOffers}
          className="mt-5 w-full text-sm tracking-widest"
        >
          {youthClub ? `Report to ${youthClub} →` : "Go home →"}
        </PressButton>
      </Screen>
    );
  }

  // ── Somebody did ───────────────────────────────────────────────────────
  return (
    <Screen glow={PITCH_GREEN} className="max-w-md px-4 py-6">
      {settingsButton}
      <div className="text-center">
        <Kicker color="#fcd34d">A scout has spotted you</Kicker>
      </div>

      <div className="mt-6 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
        {offers.length === 1 ? "One club came in" : `${offers.length} clubs came in`}
      </div>

      <div className="mt-2 space-y-3">
        {offers.map((o, i) => (
          <div key={o.club} className="kit-card kit-rise p-4" style={{ ["--kit-glow" as string]: clubTheme(o.club).glow, animationDelay: `${300 + i * 110}ms` } as React.CSSProperties}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Glow color={clubTheme(o.club).glow} alpha={0.5} className="inset-0 blur-md" />
                <div className="relative"><ClubBadge club={o.club} size={40} /></div>
              </div>
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
            <PressButton
              variant="primary"
              onClick={() => onAccept(o)}
              className="mt-3 w-full py-3 text-sm tracking-widest"
            >
              Sign for {o.club}
            </PressButton>
          </div>
        ))}
      </div>
    </Screen>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="kit-row flex-1 rounded-lg px-2 py-2">
      <div className="text-[9px] font-black uppercase tracking-widest text-white/45">{label}</div>
      <div className="text-[12px] font-black tabular-nums">{value}</div>
    </div>
  );
}
