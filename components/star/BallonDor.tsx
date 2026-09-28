"use client";
import { useEffect, useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { computeBallonDorShortlist, type BallonDorEntry } from "@/lib/star/ballonDor";
import { shortClub } from "@/lib/star/media/grammar";
import { faceOrFake } from "@/lib/star/fakeFaces";
import ImageWithFallback from "@/components/ImageWithFallback";
import ClubBadge from "@/components/star/ClubBadge";
import TrophyImage from "./TrophyImage";
import { Burst, PressButton, Shine, KitStyles } from "./ui";
import { Screen, Rays, Dots as KitDots } from "./ui/Screen";

/** The ceremony's light: gold, whatever club you play for. */
const GOLD = "#d4a017";

/**
 * THE CEREMONY.
 *
 * Rebuilt on request to match this game's OWN separate Ballon d'Or mode
 * (components/ballon-dor/BDCeremony.tsx) — a nomination first, then a
 * countdown down to third, then the top two held back for a real reveal —
 * scaled from that mode's top 25 down to a top 10, since this is a season
 * inside a club career, not a whole standalone Ballon d'Or game.
 *
 * The shortlist itself (lib/star/ballonDor.ts) is computed once, straight
 * off the `career` prop this already has — no fetch, no async loading
 * screen, because every number it needs (your season, the rest of your
 * division's real goals and assists, the trophies everyone actually won)
 * already lives on the career by the time this renders.
 *
 * ── The final-two reveal ──
 *
 * Reported directly, after the first version: pressing a button to trigger
 * the reveal broke the suspense of a real ceremony, and showing the
 * runner-up FIRST buried the actual news. A real Ballon d'Or reveal opens
 * on the winner — the whole room is there for that one name — and the
 * runner-up is acknowledged afterward, smaller, secondary. So the envelope
 * opens on its own (no button), the WINNER is announced first, big,
 * exactly the way the real ceremony leads with it, and the runner-up
 * follows underneath, once the winner has had his moment.
 */

interface Props {
  career: CareerState;
  onContinue: (userWon: boolean) => void;
}

// One shared style tag, rendered into every phase's own tree below —
// each phase is a separate early `return`, so a keyframe defined only in
// ONE phase's markup is gone the moment React unmounts that tree for the
// next phase, and an animation referencing it by name would silently just
// not play. Defining all three once, reused everywhere, avoids that.
const BD_KEYFRAMES = (
  <style>{`
    @keyframes bdFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes bdSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes bdDropIn { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes bdPulse { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
    @media (prefers-reduced-motion: reduce) {
      [style*="bdFadeIn"], [style*="bdSlideUp"], [style*="bdDropIn"], [style*="bdPulse"] { animation: none !important; }
    }
  `}</style>
);

type Phase =
  | "intro"
  | "nominated_check"
  | "countdown"       // ranks 10 down to 3, one at a time
  | "break_top2"
  | "finalists"        // both mystery cards, ranks hidden
  | "finalist_reveal"  // winner, then runner-up
  | "result";

function keyStat(e: BallonDorEntry): string {
  return `${e.goals}G ${e.assists}A`;
}

/** A real face when the database has one, otherwise that player's own fake
 *  face — never a silhouette (Harry, v0.15 item 37). */
function Face({ image, name, size, ring }: { image?: string; name: string; size: number; ring: string }) {
  return (
    <ImageWithFallback
      src={faceOrFake(image, name)}
      fallbackSrc={faceOrFake(null, name)}
      alt=""
      className={`shrink-0 rounded-full border bg-white/10 object-cover ${ring}`}
      style={{ width: size, height: size }}
    />
  );
}

export default function BallonDor({ career, onContinue }: Props) {
  const { entries, playerRank, playerNominated } = useMemo(() => computeBallonDorShortlist(career), [career]);
  const winner = entries[0];
  const runnerUp = entries[1];
  const playerWon = playerRank === 1;

  const [phase, setPhase] = useState<Phase>("intro");
  // Countdown goes 10 -> 3, i.e. entries[9] first, entries[2] last.
  const [countRevealed, setCountRevealed] = useState(0);
  const [revealStep, setRevealStep] = useState(0); // 0 envelope, 1 winner, 2 runner-up
  const [showResultButton, setShowResultButton] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("nominated_check"), 2600);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "nominated_check") return;
    const t = setTimeout(() => setPhase("countdown"), 3200);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "countdown") return;
    const COUNT = 8; // ranks 10..3
    if (countRevealed >= COUNT) {
      const t = setTimeout(() => setPhase("break_top2"), 900);
      return () => clearTimeout(t);
    }
    const idx = 9 - countRevealed; // entries index for the rank about to show
    const isPlayerEntry = entries[idx]?.isPlayer;
    // ~10% slower than the original pace, so each name gets a beat longer to
    // actually be read before the next one lands — reported directly.
    const delay = Math.round((isPlayerEntry ? 2000 : 1100) * 1.1);
    const t = setTimeout(() => setCountRevealed(r => r + 1), delay);
    return () => clearTimeout(t);
  }, [phase, countRevealed, entries]);

  useEffect(() => {
    if (phase !== "break_top2") return;
    const t = setTimeout(() => setPhase("finalists"), 2600);
    return () => clearTimeout(t);
  }, [phase]);

  // No button here any more — the two mystery cards sit for a real beat of
  // suspense, on their own, then the ceremony moves itself into the reveal.
  useEffect(() => {
    if (phase !== "finalists") return;
    const t = setTimeout(() => setPhase("finalist_reveal"), 3400);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "finalist_reveal") return;
    setRevealStep(0);
    // The winner is the news — he comes first, and confetti (when it's you)
    // fires the moment HE is revealed, not the runner-up.
    const t1 = setTimeout(() => { setRevealStep(1); if (playerWon) setConfetti(true); }, 2400);
    const t2 = setTimeout(() => setRevealStep(2), 5200);
    const t3 = setTimeout(() => setShowResultButton(true), 7600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase, playerWon]);

  // ── intro ──
  if (phase === "intro") {
    return (
      <Backdrop>
        <div className="text-center" style={{ animation: "bdFadeIn 1s ease-out" }}>
          <div className="relative mx-auto mb-5 grid h-40 w-40 place-items-center">
            <Rays color="#fde68a" size={300} />
            <div className="kit-trophy-in relative" style={{ filter: "drop-shadow(0 0 30px rgba(251,191,36,0.55))" }}>
              <TrophyImage name="Ballon d'Or" height={130} fallback="🏅" />
            </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-400/80">Ceremony</p>
          <h1 className="kit-text-shine mt-2 pr-1 text-[42px] font-black italic tracking-tight" style={{ backgroundImage: "linear-gradient(100deg,#fde68a 20%,#ffffff 45%,#fbbf24 60%,#fde68a 80%)", filter: "drop-shadow(0 3px 0 rgba(0,0,0,.5))" }}>Ballon d&apos;Or</h1>
          <p className="mt-2 text-sm font-bold text-amber-300">Season {career.season}</p>
        </div>
      </Backdrop>
    );
  }

  // ── nominated check ──
  if (phase === "nominated_check") {
    return (
      <Backdrop>
        <div className="w-full max-w-sm text-center" style={{ animation: "bdFadeIn 0.7s ease-out" }}>
          <p className="mb-6 text-[10px] font-black uppercase tracking-[0.4em] text-amber-400/70">The Nominations</p>
          {playerNominated ? (
            <div className="kit-card kit-slam relative overflow-hidden px-6 py-8" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,.45), 0 0 34px rgba(251,191,36,.25)" }}>
              <Shine trigger={1} />
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Nominated</p>
              <p className="mt-2 text-2xl font-black text-white">{career.player.firstName} {career.player.lastName}</p>
              <p className="mt-1 text-xs font-bold text-amber-300">Ballon d&apos;Or Season {career.season}</p>
            </div>
          ) : (
            <div className="kit-card kit-slam px-6 py-8">
              <p className="text-2xl">😔</p>
              <p className="mt-2 text-xl font-black text-white">{career.player.firstName} {career.player.lastName}</p>
              <p className="mt-1 text-xs font-bold text-white">was not nominated this year.</p>
            </div>
          )}
          <p className="mt-6 text-[11px] leading-relaxed text-white/70">
            Ten names, from tenth to first.<br />The world is watching.
          </p>
        </div>
      </Backdrop>
    );
  }

  // ── countdown: 10 -> 3 ──
  if (phase === "countdown") {
    const shown = entries.slice(10 - countRevealed, 10).slice().reverse(); // rank 10 first
    return (
      <Screen glow={GOLD} className="max-w-sm px-3 pb-10">
        <Header season={career.season} title="Positions 10 – 3" />
        <div className="space-y-2.5 pt-5">
          {shown.map(e => <CountdownCard key={e.rank} entry={e} />)}
          {countRevealed < 8 && <Dots />}
        </div>
        {BD_KEYFRAMES}
      </Screen>
    );
  }

  // ── break before the top two ──
  if (phase === "break_top2") {
    return (
      <Backdrop>
        <div className="max-w-xs text-center" style={{ animation: "bdFadeIn 0.7s ease-out" }}>
          <Rule />
          <h2 className="text-3xl font-black text-white">The Final Two.</h2>
          <p className="mt-3 text-sm text-white/80">One will be crowned champion of the world.</p>
          <Rule />
        </div>
      </Backdrop>
    );
  }

  // ── finalists: both mystery cards ──
  if (phase === "finalists" && winner && runnerUp) {
    return (
      <Screen glow={GOLD} className="flex min-h-screen max-w-sm flex-col px-3">
        <Header season={career.season} title="The Final Two" />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
          <p className="max-w-xs text-center text-sm text-white/80" style={{ animation: "bdFadeIn 0.8s ease-out" }}>
            Two players remain. Only one can win.
          </p>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3" style={{ animation: "bdFadeIn 0.6s ease-out 0.3s both" }}>
            <MysteryCard entry={runnerUp} />
            <MysteryCard entry={winner} />
          </div>
          <Dots big />
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400/70" style={{ animation: "bdPulse 1.8s ease-in-out infinite" }}>
            Sealing the envelope…
          </p>
        </div>
        {BD_KEYFRAMES}
      </Screen>
    );
  }

  // ── the reveal itself: winner first, then the runner-up underneath ──
  if (phase === "finalist_reveal" && winner && runnerUp) {
    return (
      <Screen glow={GOLD} center className="max-w-sm px-3">
        {revealStep >= 1 && winner.isPlayer && <Confetti />}
        <div className="relative z-10 w-full space-y-5">
          <div className="mb-1 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-400/70">Ballon d&apos;Or {career.season}</p>
            <h2 className="mt-1 text-lg font-black text-white">
              {revealStep === 0 ? "The envelope is opened…" : "🏅 The Winner Is…"}
            </h2>
          </div>

          {revealStep === 0 && <EnvelopeSuspense />}
          {revealStep >= 1 && <WinnerCard entry={winner} />}
          {revealStep >= 2 && <RunnerUpCard entry={runnerUp} />}

          {showResultButton && (
            <PressButton
              variant="secondary"
              size="md"
              onClick={() => setPhase("result")}
              className="kit-rise w-full"
            >
              Continue →
            </PressButton>
          )}
        </div>
        {BD_KEYFRAMES}
      </Screen>
    );
  }

  // ── result ──
  const playerEntry = entries.find(e => e.isPlayer);
  return (
    <Screen glow={GOLD} className="max-w-sm px-3 pb-10 pt-6">
      <div className="space-y-4">
        <div className="kit-card kit-rise relative overflow-hidden p-6 text-center" style={playerWon ? { boxShadow: "inset 0 0 0 1px rgba(251,191,36,.6), 0 0 40px rgba(251,191,36,.25)" } : undefined}>
          {playerWon ? (
            <>
              <Rays color="#fde68a" size={280} className="top-[38%]" />
              <Burst colors={["#fde047", "#fbbf24", "#ffffff", "#f59e0b"]} count={26} className="left-1/2 top-[35%]" />
              <div className="kit-trophy-in relative mx-auto w-fit"><TrophyImage name="Ballon d'Or" height={96} fallback="🏅" /></div>
              <h2 className="relative mt-2 text-xl font-black text-amber-300">Ballon d&apos;Or Winner</h2>
              <p className="relative mt-2 text-xs text-white/80">History will remember this season.</p>
            </>
          ) : playerNominated ? (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Your Finish</p>
              <p className="kit-slam mt-1 text-5xl font-black text-white" style={{ textShadow: "0 0 20px rgba(255,255,255,.3)" }}>
                {playerRank === 2 ? "🥈" : playerRank === 3 ? "🥉" : `#${playerRank}`}
              </p>
              <p className="mt-2 text-xs text-white/80">
                {playerRank === 2 ? "Runner-up. One of the greatest seasons in the world."
                  : playerRank === 3 ? "On the podium. A season to remember."
                    : playerRank <= 5 ? "Top five in the world."
                      : "Top ten in the world. Elite company."}
              </p>
            </>
          ) : (
            <>
              <div className="text-3xl">💪</div>
              <h2 className="mt-2 text-base font-black text-white">Not Nominated</h2>
              <p className="mt-2 text-xs text-white/80">Trophies, goals and a big season next time.</p>
            </>
          )}
        </div>

        {playerEntry && (
          <div className="kit-card kit-rise p-4" style={{ animationDelay: "120ms" }}>
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/70">Your Season</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Goals" value={playerEntry.goals} />
              <Stat label="Assists" value={playerEntry.assists} />
              <Stat label="Rating" value={playerEntry.rating.toFixed(1)} accent />
            </div>
            {playerEntry.trophies.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                {playerEntry.trophies.map((t, i) => (
                  <span key={`${t}-${i}`} className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">🏆 {t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {!playerWon && winner && (
          <div className="kit-card kit-rise p-4" style={{ animationDelay: "200ms" }}>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/70">Winner</p>
            <div className="flex items-center gap-3">
              <Face image={winner.image} name={winner.name} size={36} ring="border-amber-400/40" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{winner.name}</p>
                <div className="mt-0.5 flex items-center gap-1">
                  <ClubBadge club={winner.club} size={13} />
                  <p className="truncate text-xs text-white/70">{shortClub(winner.club)}</p>
                </div>
              </div>
              <p className="shrink-0 text-xs text-white/80">{keyStat(winner)}</p>
            </div>
          </div>
        )}

        <div className="kit-card kit-rise p-4" style={{ animationDelay: "280ms" }}>
          <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest text-white/70">Final Top 10</p>
          <div className="space-y-1.5">
            {entries.map(e => (
              <div key={e.rank} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${e.isPlayer ? "bg-amber-400/10" : ""}`}>
                <span className={`w-5 shrink-0 text-center text-[11px] font-black ${e.rank <= 3 ? "text-amber-400" : "text-white/70"}`}>{e.rank}</span>
                <Face image={e.image} name={e.name} size={22} ring="border-white/15" />
                <span className={`min-w-0 flex-1 truncate text-[12px] font-bold ${e.isPlayer ? "text-amber-300" : "text-white"}`}>{e.name}</span>
                <span className="shrink-0 text-[10px] text-white/70">{keyStat(e)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <PressButton
          variant="gold"
          size="lg"
          pulse
          onClick={() => onContinue(playerWon)}
          className="relative w-full overflow-hidden text-[14px]"
        >
          <Shine loop every={5} />
          Continue to Next Season →
        </PressButton>
      </div>

      {BD_KEYFRAMES}
    </Screen>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <Screen glow={GOLD} center className="flex max-w-sm flex-col items-center px-3">
      {children}
      {BD_KEYFRAMES}
    </Screen>
  );
}

function Header({ season, title }: { season: number; title: string }) {
  return (
    <div className="sticky top-0 z-10 -mx-3 border-b border-amber-300/15 bg-[#070b16]/85 px-3 py-3.5 text-center backdrop-blur">
      <p className="text-[9px] font-black uppercase tracking-[0.4em] text-amber-400/70">Ballon d&apos;Or Season {season}</p>
      <h2 className="mt-0.5 text-[15px] font-black uppercase tracking-wide text-white">{title}</h2>
    </div>
  );
}

function Rule() {
  return <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />;
}

function Dots({ big = false }: { big?: boolean }) {
  return (
    <div className={`mt-4 flex justify-center text-amber-300/80 ${big ? "text-2xl" : "text-lg"}`}>
      <KitDots />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[9px] font-bold text-white/70">{label}</p>
      <p className={`text-lg font-black ${accent ? "text-amber-400" : "text-white"}`}>{value}</p>
    </div>
  );
}

function CountdownCard({ entry }: { entry: BallonDorEntry }) {
  return (
    <div
      className="kit-card flex items-center gap-3 px-3.5 py-3"
      style={{ animation: "bdSlideUp 0.45s ease-out", ...(entry.isPlayer ? { boxShadow: "inset 0 0 0 1px rgba(251,191,36,.55), 0 0 22px rgba(251,191,36,.22)" } : {}) }}
    >
      <span className={`w-7 shrink-0 text-center text-sm font-black ${entry.rank <= 3 ? "text-amber-400" : "text-white/70"}`}>#{entry.rank}</span>
      <Face image={entry.image} name={entry.name} size={34} ring={entry.isPlayer ? "border-amber-400/50" : "border-white/15"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-sm font-black ${entry.isPlayer ? "text-amber-300" : "text-white"}`}>{entry.name}</p>
          {entry.isPlayer && <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-px text-[9px] font-black text-black">YOU</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          <ClubBadge club={entry.club} size={12} />
          <p className="truncate text-[11px] text-white/70">{shortClub(entry.club)}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-bold text-white/85">{keyStat(entry)}</p>
        {entry.trophies.length > 0 && <p className="mt-0.5 text-[9px] text-amber-400/80">🏆 ×{entry.trophies.length}</p>}
      </div>
    </div>
  );
}

function MysteryCard({ entry }: { entry: BallonDorEntry }) {
  return (
    <div className="kit-card relative overflow-hidden p-4 text-center" style={entry.isPlayer ? { boxShadow: "inset 0 0 0 1px rgba(251,191,36,.55)" } : undefined}>
      <Shine loop every={3.5} />
      <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-amber-400/40 bg-white/5">
        <span className="kib-glow-pulse text-base text-amber-400/80">?</span>
      </div>
      <p className={`text-sm font-black leading-tight ${entry.isPlayer ? "text-amber-300" : "text-white"}`}>{entry.name}</p>
      <div className="mt-0.5 flex items-center justify-center gap-1">
        <ClubBadge club={entry.club} size={12} />
        <p className="text-[10px] text-white/70">{shortClub(entry.club)}</p>
      </div>
      <p className="mt-2 text-[10px] text-white/80">{keyStat(entry)}</p>
      {entry.isPlayer && <span className="mt-2 inline-block rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-black">YOU</span>}
    </div>
  );
}

/** The suspense beat before either name shows — no card, no player, just
 *  the wait. */
function EnvelopeSuspense() {
  return (
    <div className="kit-card flex flex-col items-center justify-center py-10">
      <p className="text-4xl" style={{ animation: "bdPulse 1.4s ease-in-out infinite" }}>✉️</p>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/70">The room falls silent…</p>
    </div>
  );
}

/** The headline itself — big, gold, and the first thing shown. */
function WinnerCard({ entry }: { entry: BallonDorEntry }) {
  return (
    <div
      className="kit-card kit-trophy-in relative overflow-hidden p-6 text-center"
      style={{ boxShadow: `inset 0 0 0 2px ${entry.isPlayer ? "rgba(251,191,36,.9)" : "rgba(245,158,11,.55)"}, 0 0 50px rgba(251,191,36,0.3)` }}
    >
      <Rays color="#fde68a" size={320} className="top-[30%]" />
      <Shine trigger={1} />
      <div className="relative mx-auto w-fit"><Face image={entry.image} name={entry.name} size={84} ring={entry.isPlayer ? "border-amber-300" : "border-amber-400/60"} /></div>
      <div className="relative mx-auto mt-3 w-fit">
        <TrophyImage name="Ballon d'Or" height={46} fallback="🏅" />
      </div>
      <p className="relative mt-1 text-2xl font-black leading-tight text-amber-300" style={{ textShadow: "0 0 16px rgba(251,191,36,.45)" }}>{entry.name}</p>
      <p className="mt-1 text-sm font-bold text-white/90">has won the Ballon d&apos;Or</p>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        <ClubBadge club={entry.club} size={16} />
        <p className="text-xs font-bold text-white/80">{shortClub(entry.club)}</p>
      </div>
      {entry.isPlayer && (
        <span className="mt-3 inline-block rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black text-black">YOU</span>
      )}
      <div className="mx-auto mt-4 h-px w-2/3 bg-amber-400/25" />
      <p className="mt-3 text-sm font-bold text-white/85">{keyStat(entry)} · {entry.ratingIsReal ? "" : "~"}{entry.rating.toFixed(1)} rtg</p>
      {entry.trophies.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {entry.trophies.map((t, i) => (
            <span key={`${t}-${i}`} className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/85">🏆 {t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Acknowledged afterward — real, but visibly secondary to the winner above. */
function RunnerUpCard({ entry }: { entry: BallonDorEntry }) {
  return (
    <div
      className="kit-card flex items-center gap-3 p-3"
      style={{ animation: "bdSlideUp 0.5s ease-out" }}
    >
      <span className="shrink-0 text-lg">🥈</span>
      <Face image={entry.image} name={entry.name} size={38} ring="border-white/25" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">
          {entry.name}{entry.isPlayer ? " (You)" : ""} <span className="font-bold text-white/70">has come second</span>
        </p>
        <div className="mt-0.5 flex items-center gap-1">
          <ClubBadge club={entry.club} size={13} />
          <p className="truncate text-xs text-white/70">{shortClub(entry.club)}</p>
        </div>
      </div>
      <p className="shrink-0 text-xs font-bold text-white/80">{keyStat(entry)}</p>
    </div>
  );
}

/** Your win: two bursts of gold and confetti from the middle of the screen
 *  (the kit's Burst — CSS, still for reduced motion). */
function Confetti() {
  const colors = ["#F0C040", "#FF6B35", "#4ADE80", "#60A5FA", "#F472B6", "#A78BFA", "#FBBF24"];
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <KitStyles />
      <Burst colors={colors} count={40} spread={2.2} className="left-1/2 top-[38%]" />
      <Burst colors={colors} count={30} spread={1.5} round className="left-1/2 top-[30%]" />
    </div>
  );
}
