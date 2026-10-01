"use client";

/**
 * THE UNLOCK CHAIN'S SCREENS — the locked page, the achievement pop-up, the
 * first-steps list and the phone's App Store (lib/star/unlocks.ts).
 *
 * Harry, 1 Oct 2026 (P13-P40): "Locked, locked, locked, training." The
 * tutorial itself is pointers now (PointerTour.tsx), not cards.
 */
import { useEffect } from "react";
import type { CareerState } from "@/lib/star/types";
import { sfx } from "@/lib/star/sfx";
import { APP_STORE, LOCK_HINT, UNLOCK_ACHIEVEMENTS, appInstalled, type Feature } from "@/lib/star/unlocks";
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

export function AchievementPop({ label, unlocked, onClose, phone = false, record = false }: { label: string; unlocked: string; onClose: () => void; /** The phone: a big moment (Harry, P70). */ phone?: boolean; /** A record broken, not an achievement (P36). */ record?: boolean }) {
  useEffect(() => { sfx("achievement-pop"); }, []);
  return (
    <Sheet onClose={onClose} z={95}>
      <style>{`
        @keyframes kib-ach-star { 0% { transform: scale(.2) rotate(-90deg); opacity: 0 } 60% { transform: scale(1.25) rotate(12deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
        @keyframes kib-ach-ring { 0% { transform: scale(.6); opacity: .9 } 100% { transform: scale(1.9); opacity: 0 } }
        .kib-ach-star { animation: kib-ach-star .7s cubic-bezier(.2,1.4,.4,1) both }
        .kib-ach-ring { animation: kib-ach-ring 1.1s ease-out .2s both }
      `}</style>
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
        <div className="relative mx-auto mt-3 grid h-24 w-24 place-items-center">
          <span className="kib-ach-ring absolute inset-0 rounded-full ring-4 ring-amber-300/70" />
          <Burst trigger={1} colors={GOLD} count={24} round />
          <span className="kib-ach-star text-[64px] leading-none" style={{ filter: "drop-shadow(0 0 16px rgba(251,191,36,.85))" }}>{record ? "🏆" : "⭐"}</span>
        </div>
      )}
      <div className="mt-2 text-[18px] font-black">{label}</div>
      <div className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 p-2.5 ring-1 ring-emerald-400/40">
        <span className="text-[13px] font-black text-emerald-200">{unlocked}</span>
      </div>
      <PressButton variant="primary" size="none" pulse onClick={onClose} className="mt-3 w-full rounded-2xl py-2.5 text-[14px] font-black">Continue</PressButton>
    </Sheet>
  );
}

// ── 5. The chain's achievements, at the top of the Achievements screen ──────

export function UnlockChallenges({ career, onBossMeeting }: { career: CareerState; onBossMeeting: () => void }) {
  const done = (id: string) => career.achievements.includes(id);
  return (
    <div className="mb-3 overflow-hidden rounded-2xl ring-1 ring-amber-300/30" style={{ background: "linear-gradient(180deg, rgba(251,191,36,.12), rgba(0,0,0,.25))" }}>
      <div className="px-3 pt-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Your first steps</div>
      {UNLOCK_ACHIEVEMENTS.map((a) => {
        const got = done(a.id);
        const prev = UNLOCK_ACHIEVEMENTS.slice(0, UNLOCK_ACHIEVEMENTS.indexOf(a)).every((p) => done(p.id));
        const next = !got && prev;
        const hidden = !got && !prev;
        return (
          <div key={a.id} className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 last:border-b-0">
            <div className={`text-3xl ${got ? "" : "opacity-25 grayscale"}`}>⭐</div>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-black ${got ? "text-yellow-300" : "text-white"}`}>{hidden ? "Locked" : a.description}</div>
              <div className="text-[10.5px] font-bold text-white/75">
                {got ? "Done" : hidden ? "Find out more in the future" : a.id === "boss-meeting" ? "Unlocks Relations" : "Look around — you'll find it"}
              </div>
            </div>
            {got && <div className="text-lg font-black text-emerald-400">✓</div>}
            {next && a.id === "boss-meeting" && (
              <PressButton variant="primary" size="none" pulse onClick={onBossMeeting} className="rounded-xl px-3 py-1.5 text-[12px] font-black">Go →</PressButton>
            )}
          </div>
        );
      })}
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
