"use client";

/**
 * THE UNLOCK CHAIN'S SCREENS — the locked page, the achievement pop-up, the
 * first-steps list and the phone's App Store (lib/star/unlocks.ts).
 *
 * Harry, 1 Oct 2026 (P13-P40): "Locked, locked, locked, training." The
 * tutorial itself is pointers now (PointerTour.tsx), not cards.
 */
import { useEffect, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { sfx } from "@/lib/star/sfx";
import { APP_STORE, LOCK_HINT, FEATURE_INFO, stepsFor, phoneStepLine, phoneShortfall, appInstalled, hasSeen, isOpen, nextStep, stepDone, type Feature, type StepId } from "@/lib/star/unlocks";
import { formatMoney } from "@/lib/star/money";
import { Burst, PressButton } from "./ui";
import StylePicture from "./StylePicture";

const GOLD = ["#fde047", "#fbbf24", "#ffffff"];

function Sheet({ children, onClose, z = 85 }: { children: React.ReactNode; onClose?: () => void; z?: number }) {
  return (
    <div className="fixed inset-0 grid place-items-center bg-black/80 p-5" style={{ zIndex: z }} onClick={onClose}>
      <div
        className="kit-rise w-full max-w-[340px] rounded-3xl p-4 text-center text-white"
        style={{ background: "var(--sk-card, linear-gradient(180deg, #1f2937, #0b1220))", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12), 0 20px 50px -10px rgba(0,0,0,.9)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" fill="currentColor" fillOpacity=".25" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** A swipe page (Stats, Shop) that is not open yet. */
export function LockedPage({ title, feature }: { title: string; feature: Feature }) {
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 px-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/[0.07] text-white/80 ring-1 ring-white/15"><LockIcon size={30} /></div>
      <div className="text-[18px] font-black text-white">{title} is locked</div>
      <div className="text-[13px] font-bold text-amber-300">{LOCK_HINT[feature]}</div>
    </div>
  );
}

// The first-run cards that used to sit here — "This is Home", "Start with
// training", "Training done", "The League", "The Shop" — are gone (Harry, 1 Oct
// 2026, P67-P69: "instead of saying 'this is home' as a pop-up, just pop it up
// how it does here"). The same walk is now hands pointing at the real screen:
// components/star/PointerTour.tsx, steps in lib/star/tours.ts.

// ── 4. The achievement pop-up ───────────────────────────────────────────────
//
// v0.24 (Harry, 2 Oct 2026, P2-67): "instead of continue it should say see all
// achievements. So then that will take you to achievements." The main button
// goes there (`onSeeAll`); a tap outside, or Close, just shuts it.

export function AchievementPop({ label, unlocked, onClose, onSeeAll, phone = false, record = false }: { label: string; unlocked: string; onClose: () => void; /** "See all achievements" — opens the Achievements screen. */ onSeeAll?: () => void; /** The phone: a big moment (Harry, P70). */ phone?: boolean; /** A record broken, not an achievement (P36). */ record?: boolean }) {
  useEffect(() => { sfx("achievement-pop"); }, []);
  return (
    <Sheet onClose={onClose} z={95}>
      <AchStyles />
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">{phone ? "New phone" : record ? "Record broken" : "Achievement unlocked"}</div>
      {phone ? (
        <div className="relative mx-auto mt-2 h-[150px] w-[190px]">
          <span className="kib-ach-ring absolute inset-6 rounded-full ring-4 ring-amber-300/70" />
          <Burst trigger={1} colors={["#60a5fa", "#a78bfa", "#fde047", "#ffffff"]} count={44} round />
          <div className="kib-ach-star absolute inset-0" style={{ filter: "drop-shadow(0 0 18px rgba(96,165,250,.8))" }}>
            <StylePicture base="phone" level={1} className="h-full w-full" />
          </div>
        </div>
      ) : (
        <BigStar icon={record ? "🏆" : "⭐"} />
      )}
      <div className="mt-2 text-[18px] font-black">{label}</div>
      <div className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 p-2.5 ring-1 ring-emerald-400/40">
        <span className="text-[13px] font-black text-emerald-200">{unlocked}</span>
      </div>
      <PressButton variant="primary" size="none" pulse onClick={onSeeAll ?? onClose} data-tour="see-all" className="mt-3 w-full rounded-2xl py-2.5 text-[14px] font-black">
        {onSeeAll ? "See all achievements" : "Continue"}
      </PressButton>
      {onSeeAll && (
        <button onClick={onClose} className="kib-press mt-2 w-full py-1 text-[12px] font-black uppercase tracking-widest text-white/60">Close</button>
      )}
    </Sheet>
  );
}

function AchStyles() {
  return (
    <style>{`
      @keyframes kib-ach-star { 0% { transform: scale(.2) rotate(-90deg); opacity: 0 } 60% { transform: scale(1.25) rotate(12deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
      @keyframes kib-ach-ring { 0% { transform: scale(.6); opacity: .9 } 100% { transform: scale(1.9); opacity: 0 } }
      @keyframes kib-ach-bar { from { transform: scaleX(1) } to { transform: scaleX(0) } }
      .kib-ach-star { animation: kib-ach-star .7s cubic-bezier(.2,1.4,.4,1) both }
      .kib-ach-ring { animation: kib-ach-ring 1.1s ease-out .2s both }
    `}</style>
  );
}

function BigStar({ icon }: { icon: string }) {
  return (
    <div className="relative mx-auto mt-3 grid h-24 w-24 place-items-center">
      <span className="kib-ach-ring absolute inset-0 rounded-full ring-4 ring-amber-300/70" />
      <Burst trigger={1} colors={GOLD} count={24} round />
      <span className="kib-ach-star text-[64px] leading-none" style={{ filter: "drop-shadow(0 0 16px rgba(251,191,36,.85))" }}>{icon}</span>
    </div>
  );
}

/**
 * SOMETHING NEW IS OPEN (v0.24, Harry: "the moment ANY feature unlocks (even
 * if it takes 25 games), it is announced, the player is led to it through
 * Achievements, and that feature's tutorial runs. Very clear.").
 * One pop-up for everything that opened at once, then "See all achievements".
 */
export function UnlockPop({ features, onSeeAll, onClose }: { features: Feature[]; onSeeAll: () => void; onClose: () => void }) {
  useEffect(() => { sfx("achievement-pop"); }, []);
  const names = features.map((f) => FEATURE_INFO[f].name);
  const title = names.length <= 1 ? names[0] ?? "" : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return (
    <Sheet onClose={onClose} z={95}>
      <AchStyles />
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">Unlocked</div>
      <BigStar icon={FEATURE_INFO[features[0]]?.icon ?? "🔓"} />
      <div className="mt-2 text-[22px] font-black leading-tight">{title}</div>
      <div className="mt-2 space-y-1.5">
        {features.map((f) => (
          <div key={f} className="flex items-center gap-2.5 rounded-2xl bg-emerald-500/15 px-3 py-2 text-left ring-1 ring-emerald-400/40">
            <span className="text-[20px] leading-none">{FEATURE_INFO[f].icon}</span>
            <span className="min-w-0">
              <span className="block text-[13px] font-black text-white">{FEATURE_INFO[f].name}</span>
              <span className="block text-[11.5px] font-bold text-emerald-100">{FEATURE_INFO[f].line}</span>
            </span>
          </div>
        ))}
      </div>
      <PressButton variant="primary" size="none" pulse onClick={onSeeAll} data-tour="see-all" className="mt-3 w-full rounded-2xl py-2.5 text-[14px] font-black">See all achievements</PressButton>
      <button onClick={onClose} className="kib-press mt-2 w-full py-1 text-[12px] font-black uppercase tracking-widest text-white/60">Close</button>
    </Sheet>
  );
}

/**
 * ACHIEVEMENTS AFTER A MATCH, WITH NO BUTTON (v0.24, P2-84: "your achievements,
 * which should pop up without the next button"). Each one slams in, holds for
 * a moment and makes way for the next; a tap moves it on sooner.
 */
export function AchievementToasts({ items, onDone, hold = 2400, delay = 0 }: { items: { label: string; description: string }[]; onDone: () => void; hold?: number; /** Wait this long first (the post-match screen's own beats come first). */ delay?: number }) {
  const [k, setK] = useState(delay > 0 ? -1 : 0);
  const a = items[k];
  useEffect(() => {
    if (k < 0) { const t = setTimeout(() => setK(0), delay); return () => clearTimeout(t); }
    if (!a) { onDone(); return; }
    sfx("achievement-pop");
    const t = setTimeout(() => setK((n) => n + 1), hold);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  if (k < 0 || !a) return null;
  return (
    <div className="fixed inset-x-0 top-24 z-[95] flex justify-center px-6" onClick={() => setK((n) => n + 1)} role="status" aria-live="polite">
      <AchStyles />
      <div key={k} className="kit-slam relative w-full max-w-[320px] overflow-hidden rounded-2xl px-4 pb-3 pt-2.5 text-center text-white" style={{ background: "linear-gradient(180deg, #3b2a06, #0b1220)", boxShadow: "inset 0 0 0 2px rgba(251,191,36,.85), 0 0 30px rgba(251,191,36,.35), 0 18px 40px -10px rgba(0,0,0,.9)" }}>
        <Burst trigger={k + 1} colors={GOLD} count={20} round />
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Achievement{items.length > 1 ? ` ${k + 1} of ${items.length}` : ""}</div>
        <div className="kib-ach-star mt-1 text-[40px] leading-none" style={{ filter: "drop-shadow(0 0 14px rgba(251,191,36,.8))" }}>⭐</div>
        <div className="mt-1 text-[18px] font-black leading-tight">{a.label}</div>
        <div className="text-[12px] font-bold text-white/85">{a.description}</div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full origin-left bg-amber-300" style={{ animation: `kib-ach-bar ${hold}ms linear both` }} />
        </div>
      </div>
    </div>
  );
}

/** "Do you want to switch this to League as a shortcut?" (P2-89). */
export function SlotQuestion({ onLeague, onKeep }: { onLeague: () => void; onKeep: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-[78px] z-[95] flex justify-center px-4" role="dialog" aria-label="Switch this button to League?">
      <div className="kit-rise w-full max-w-[360px] rounded-2xl p-3.5 text-white" style={{ background: "linear-gradient(180deg,#1f2937,#0b1220)", boxShadow: "inset 0 0 0 2px #fde047, 0 16px 40px -10px rgba(0,0,0,.95)" }}>
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">First steps done</div>
        <div className="mt-1 text-[16px] font-black leading-snug">Do you want to switch this to League as a shortcut?</div>
        <div className="mt-0.5 text-[12px] font-bold text-white/75">Achievements stays on Home either way.</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <PressButton variant="primary" size="none" onClick={onLeague} className="rounded-xl py-2.5 text-[13px] font-black">Yes, League</PressButton>
          <PressButton variant="plain" size="none" onClick={onKeep} className="rounded-xl py-2.5 text-[13px] font-black">Keep it</PressButton>
        </div>
        <div className="mt-2 flex justify-start pl-3 text-[22px] leading-none text-amber-300" aria-hidden>▼</div>
      </div>
    </div>
  );
}

// ── 5. The first steps, at the top of the Achievements screen ───────────────
//
// v0.24 (Harry, P2-69): "almost like a story mode of achievements. And then
// there's the achievements that just happen naturally." The story is
// lib/star/unlocks.ts's FIRST_STEPS, in order; the next one has a Go button
// that takes you there. Below them, what opens later (Sponsors) and how far
// away it is.

export type StepGo = StepId | "sponsors";

export function UnlockChallenges({ career, onGo }: { career: CareerState; onGo: (step: StepGo) => void }) {
  const next = nextStep(career);
  const STEPS = stepsFor(career);
  const sponsorsOpen = isOpen(career, "sponsors");
  const sponsorsNew = sponsorsOpen && !hasSeen(career, "help-sponsors");
  return (
    <div className="mb-3 overflow-hidden rounded-2xl ring-1 ring-amber-300/30" style={{ background: "linear-gradient(180deg, rgba(251,191,36,.12), rgba(0,0,0,.25))" }}>
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Your first steps</span>
        <span className="text-[10px] font-black tabular-nums text-white/75">{STEPS.filter((s) => stepDone(career, s.id)).length} / {STEPS.length}</span>
      </div>
      {STEPS.map((s, i) => {
        const got = stepDone(career, s.id);
        const isNext = next?.id === s.id;
        const later = !got && !isNext;
        return (
          <div key={s.id} className={`flex items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 ${isNext ? "bg-amber-300/[0.08]" : ""}`}>
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-black ${got ? "bg-amber-400 text-gray-950" : isNext ? "bg-white/15 text-amber-300 ring-2 ring-amber-300" : "bg-white/[0.06] text-white/40"}`}>
              {got ? "★" : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-black ${got ? "text-yellow-300" : later ? "text-white/55" : "text-white"}`}>{s.todo}</div>
              <div className="text-[10.5px] font-bold text-white/75">{got ? "Done" : s.opens}</div>
              {/* v0.25: the phone step says what it costs and what is still
                  needed, so it never silently does not work. */}
              {isNext && s.id === "buy-phone" && (
                <div className={`text-[10.5px] font-black ${phoneShortfall(career) > 0 ? "text-amber-300" : "text-emerald-300"}`}>{phoneStepLine(career)}</div>
              )}
            </div>
            {got && <div className="text-lg font-black text-emerald-400">✓</div>}
            {isNext && (
              <PressButton variant="primary" size="none" pulse onClick={() => onGo(s.id)} data-tour="step-go" className="rounded-xl px-3 py-1.5 text-[12px] font-black">Go →</PressButton>
            )}
          </div>
        );
      })}
      {/* What opens later — so a locked Sponsors is never a mystery. */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[17px] ${sponsorsOpen ? "bg-emerald-400/25" : "bg-white/[0.06]"}`}>{sponsorsOpen ? "🤝" : <LockIcon size={16} />}</div>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-black ${sponsorsOpen ? "text-white" : "text-white/70"}`}>{sponsorsOpen ? "Sponsors are open" : "Sponsors"}</div>
          <div className="text-[10.5px] font-bold text-white/75">
            {sponsorsOpen ? FEATURE_INFO.sponsors.line : `Opens with your first offer · ${LOCK_HINT.sponsors}`}
          </div>
        </div>
        {sponsorsOpen && (
          <PressButton variant={sponsorsNew ? "primary" : "plain"} size="none" pulse={sponsorsNew && !next} onClick={() => onGo("sponsors")} data-tour={sponsorsNew && !next ? "step-go" : undefined} className="rounded-xl px-3 py-1.5 text-[12px] font-black">Go →</PressButton>
        )}
      </div>
    </div>
  );
}

// ── 6. The phone's App Store ────────────────────────────────────────────────

export function AppStore({ career, onInstall }: { career: CareerState; onInstall: (id: string) => void }) {
  return (
    <div className="kib-noscroll min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-2">
      <div className="mb-2 text-[18px] font-black text-white">App Store</div>
      <div className="space-y-1.5">
        {APP_STORE.map((a) => {
          const have = appInstalled(career, a.id);
          return (
            <div key={a.id} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.07] p-2 ring-1 ring-white/10">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[28%] bg-white/10 text-[22px]">{a.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-black text-white">{a.label}</div>
                <div className="truncate text-[10.5px] font-bold text-white/70">{a.note}</div>
              </div>
              {have ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-white/70">Added</span>
              ) : (
                <PressButton variant={career.money >= a.price ? "primary" : "plain"} size="none" disabled={career.money < a.price} onClick={() => onInstall(a.id)} className="rounded-full px-3 py-1 text-[11px] font-black tabular-nums">★{formatMoney(a.price)}</PressButton>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[28%] bg-white/10 text-[22px]">🖼️</span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-black text-white">Backgrounds</div>
            <div className="text-[10.5px] font-bold text-white/70">Wallpapers for your phone</div>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-white/70">Coming soon</span>
        </div>
      </div>
    </div>
  );
}
