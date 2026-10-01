"use client";

/**
 * THE UNLOCK CHAIN'S SCREENS — every overlay, locked page and list the chain
 * (lib/star/unlocks.ts) needs, in one file so page.tsx only places them.
 *
 * Harry, 1 Oct 2026 (P13-P40): "As soon as you come in, maybe you get like a
 * little tutorial thing, like this is home, this is your player, it's how
 * star ratings work, click, click, click. Locked, locked, locked, training."
 */
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { APP_STORE, LOCK_HINT, UNLOCK_ACHIEVEMENTS, appInstalled, type Feature } from "@/lib/star/unlocks";
import { Burst, PressButton } from "./ui";

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

// ── 1. Home tutorial ─────────────────────────────────────────────────────────

const TUTORIAL = [
  { icon: "🏠", title: "This is Home", body: "Everything about your career starts here. Your next match and your energy are on this screen." },
  { icon: "🧍", title: "This is your player", body: "That's you, in your club's kit — your age, energy and next match sit around him." },
  { icon: "⭐", title: "Your star rating", body: "Your whole career, out of 100. Training, matches and achievements push it up — it never goes down." },
  { icon: "⚽", title: "Start with training", body: "Most of the game is locked for now. Do two training drills to open the League." },
];

export function HomeTutorial({ onDone }: { onDone: (toTraining: boolean) => void }) {
  const [i, setI] = useState(0);
  const step = TUTORIAL[i];
  const last = i === TUTORIAL.length - 1;
  return (
    <Sheet z={90}>
      <div className="mb-1 flex justify-center gap-1.5">
        {TUTORIAL.map((_, k) => <span key={k} className={`h-1.5 rounded-full ${k === i ? "w-5 bg-amber-300" : "w-1.5 bg-white/25"}`} />)}
      </div>
      <div key={i} className="kit-rise">
        <div className="mt-2 text-[44px] leading-none">{step.icon}</div>
        <div className="mt-2 text-[20px] font-black">{step.title}</div>
        <div className="mt-1 text-[13px] font-bold text-white/90">{step.body}</div>
      </div>
      <div className="mt-4 flex gap-2">
        {!last && <button onClick={() => onDone(false)} className="kib-press flex-1 rounded-2xl bg-white/10 py-2.5 text-[13px] font-black text-white/85">Skip</button>}
        <PressButton variant="primary" size="none" onClick={() => (last ? onDone(true) : setI(i + 1))} className="flex-[2] rounded-2xl py-2.5 text-[14px] font-black">
          {last ? "Go to Training" : "Next"}
        </PressButton>
      </div>
    </Sheet>
  );
}

// ── 2. After two drills ──────────────────────────────────────────────────────

/** `levels`: star rating levels gained since the chain began; `points`: star points. */
export function DrillsMessage({ levels, points, from, to, onClose }: { levels: number; points: number; from: number; to: number; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="relative">
        <Burst trigger={1} colors={GOLD} count={20} className="left-1/2 top-6" round />
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">Training done</div>
        <div className="mt-2 text-[44px] font-black italic leading-none" style={{ textShadow: "0 0 22px rgba(251,191,36,.6)" }}>★ {to}</div>
        <div className="mt-2 text-[15px] font-black">
          {levels > 0
            ? `Your star rating went up by ${levels} from training`
            : points > 0
              ? `Training earned you ${points.toLocaleString("en-GB")} star points`
              : "Two sessions done"}
        </div>
        <div className="mt-0.5 text-[12px] font-bold text-white/80">
          {levels > 0 ? `★ ${from} → ★ ${to}` : points > 0 ? "They add up — every star in every drill counts." : "No stars this time — every star you win in a drill raises your rating."}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 p-2.5 ring-1 ring-emerald-400/40">
          <span className="text-[20px]">🏆</span>
          <span className="text-[13px] font-black text-emerald-200">League unlocked — and Play</span>
        </div>
        <PressButton variant="primary" size="none" pulse onClick={onClose} className="mt-3 w-full rounded-2xl py-2.5 text-[14px] font-black">Continue</PressButton>
      </div>
    </Sheet>
  );
}

// ── 3. League and Shop, explained once ──────────────────────────────────────

const LEAGUE_TABS = [
  { icon: "📊", name: "Table", line: "How your club is faring." },
  { icon: "📋", name: "Results", line: "Every score so far." },
  { icon: "📅", name: "Fixtures", line: "Who's next, and when." },
  { icon: "🏅", name: "Awards", line: "Player of the Month and the season's honours." },
  { icon: "👕", name: "Squad", line: "Your team-mates and their numbers this season." },
];

const SHOP_TILES = [
  { icon: "🥤", name: "KIB Cans", line: "Energy back when you're tired; Premium and Elite add a boot trick." },
  { icon: "👟", name: "Boots", line: "Better boots add to your stats for a set number of matches." },
  { icon: "💎", name: "Style", line: "Watches, cars, homes — they bring fame." },
  { icon: "🤝", name: "Sponsors", line: "Brands that pay you to wear and post their stuff." },
  { icon: "🛒", name: "Store", line: "Daily specials and Coins." },
  { icon: "🎰", name: "Casino", line: "Risk your money. It can go badly." },
];

function Explainer({ kicker, title, rows, onClose }: { kicker: string; title: string; rows: { icon: string; name: string; line: string }[]; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">{kicker}</div>
      <div className="mt-1 text-[20px] font-black">{title}</div>
      <div className="mt-3 space-y-1.5 text-left">
        {rows.map((r, k) => (
          <div key={r.name} className="kit-rise flex items-center gap-2.5 rounded-xl bg-white/[0.06] px-2.5 py-2 ring-1 ring-white/10" style={{ animationDelay: `${k * 60}ms` }}>
            <span className="text-[20px]">{r.icon}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-black text-white">{r.name}</div>
              <div className="text-[11.5px] font-bold text-white/85">{r.line}</div>
            </div>
          </div>
        ))}
      </div>
      <PressButton variant="primary" size="none" onClick={onClose} className="mt-3 w-full rounded-2xl py-2.5 text-[14px] font-black">Got it</PressButton>
    </Sheet>
  );
}

export function LeagueIntro({ onClose }: { onClose: () => void }) {
  return <Explainer kicker="Unlocked" title="The League" rows={LEAGUE_TABS} onClose={onClose} />;
}

export function ShopIntro({ onClose }: { onClose: () => void }) {
  return <Explainer kicker="Unlocked" title="The Shop" rows={SHOP_TILES} onClose={onClose} />;
}

// ── 4. The achievement pop-up ───────────────────────────────────────────────

export function AchievementPop({ label, unlocked, onClose }: { label: string; unlocked: string; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} z={95}>
      <style>{`
        @keyframes kib-ach-star { 0% { transform: scale(.2) rotate(-90deg); opacity: 0 } 60% { transform: scale(1.25) rotate(12deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
        @keyframes kib-ach-ring { 0% { transform: scale(.6); opacity: .9 } 100% { transform: scale(1.9); opacity: 0 } }
        .kib-ach-star { animation: kib-ach-star .7s cubic-bezier(.2,1.4,.4,1) both }
        .kib-ach-ring { animation: kib-ach-ring 1.1s ease-out .2s both }
      `}</style>
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">Achievement unlocked</div>
      <div className="relative mx-auto mt-3 grid h-24 w-24 place-items-center">
        <span className="kib-ach-ring absolute inset-0 rounded-full ring-4 ring-amber-300/70" />
        <Burst trigger={1} colors={GOLD} count={24} round />
        <span className="kib-ach-star text-[64px] leading-none" style={{ filter: "drop-shadow(0 0 16px rgba(251,191,36,.85))" }}>⭐</span>
      </div>
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
      <div className="text-[18px] font-black text-white">App Store</div>
      <div className="mb-2 text-[11px] font-bold text-white/75">Add apps to your phone.</div>
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
                <PressButton variant="primary" size="none" onClick={() => onInstall(a.id)} className="rounded-full px-3.5 py-1 text-[11px] font-black">GET</PressButton>
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
