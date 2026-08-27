"use client";
import { useEffect, useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { computeBallonDorShortlist, type BallonDorEntry } from "@/lib/star/ballonDor";
import { shortClub } from "@/lib/star/media/grammar";

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
  `}</style>
);

type Phase =
  | "intro"
  | "nominated_check"
  | "countdown"       // ranks 10 down to 3, one at a time
  | "break_top2"
  | "finalists"        // both mystery cards, ranks hidden
  | "finalist_reveal"  // runner-up, then winner
  | "result";

function keyStat(e: BallonDorEntry): string {
  return `${e.goals}G ${e.assists}A`;
}

export default function BallonDor({ career, onContinue }: Props) {
  const { entries, playerRank, playerNominated } = useMemo(() => computeBallonDorShortlist(career), [career]);
  const winner = entries[0];
  const runnerUp = entries[1];
  const playerWon = playerRank === 1;

  const [phase, setPhase] = useState<Phase>("intro");
  // Countdown goes 10 -> 3, i.e. entries[9] first, entries[2] last.
  const [countRevealed, setCountRevealed] = useState(0);
  const [revealStep, setRevealStep] = useState(0); // 0 envelope, 1 runner-up, 2 winner
  const [showFinalistButton, setShowFinalistButton] = useState(false);
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
    const delay = isPlayerEntry ? 2000 : 1100;
    const t = setTimeout(() => setCountRevealed(r => r + 1), delay);
    return () => clearTimeout(t);
  }, [phase, countRevealed, entries]);

  useEffect(() => {
    if (phase !== "break_top2") return;
    const t = setTimeout(() => setPhase("finalists"), 2600);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "finalists") return;
    const t = setTimeout(() => setShowFinalistButton(true), 3000);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "finalist_reveal") return;
    setRevealStep(0);
    const t1 = setTimeout(() => setRevealStep(1), 2000);
    const t2 = setTimeout(() => { setRevealStep(2); if (playerWon) setConfetti(true); }, 4500);
    const t3 = setTimeout(() => setShowResultButton(true), 7500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase, playerWon]);

  // ── intro ──
  if (phase === "intro") {
    return (
      <Backdrop>
        <div className="text-center" style={{ animation: "bdFadeIn 1s ease-out" }}>
          <div className="mb-6 text-7xl" style={{ filter: "drop-shadow(0 0 40px rgba(251,191,36,0.5))" }}>🏅</div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-400/60">Ceremony</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Ballon d&apos;Or</h1>
          <p className="mt-2 text-sm font-bold text-amber-400/70">Season {career.season}</p>
        </div>
      </Backdrop>
    );
  }

  // ── nominated check ──
  if (phase === "nominated_check") {
    return (
      <Backdrop>
        <div className="w-full max-w-sm text-center" style={{ animation: "bdFadeIn 0.7s ease-out" }}>
          <p className="mb-6 text-[10px] font-black uppercase tracking-[0.4em] text-amber-400/50">The Nominations</p>
          {playerNominated ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] px-6 py-8">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/70">Nominated</p>
              <p className="mt-2 text-2xl font-black text-white">{career.player.firstName} {career.player.lastName}</p>
              <p className="mt-1 text-xs font-bold text-amber-400/70">Ballon d&apos;Or Season {career.season}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-8">
              <p className="text-2xl">😔</p>
              <p className="mt-2 text-xl font-black text-white">{career.player.firstName} {career.player.lastName}</p>
              <p className="mt-1 text-xs font-bold text-white/50">was not nominated this year.</p>
            </div>
          )}
          <p className="mt-6 text-[11px] leading-relaxed text-white/40">
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
      <div className="min-h-screen bg-black pb-10">
        <Header season={career.season} title="Positions 10 – 3" />
        <div className="mx-auto max-w-sm space-y-2.5 px-3 pt-5">
          {shown.map(e => <CountdownCard key={e.rank} entry={e} />)}
          {countRevealed < 8 && <Dots />}
        </div>
        {BD_KEYFRAMES}
      </div>
    );
  }

  // ── break before the top two ──
  if (phase === "break_top2") {
    return (
      <Backdrop>
        <div className="max-w-xs text-center" style={{ animation: "bdFadeIn 0.7s ease-out" }}>
          <Rule />
          <h2 className="text-3xl font-black text-white">The Final Two.</h2>
          <p className="mt-3 text-sm text-white/50">One will be crowned champion of the world.</p>
          <Rule />
        </div>
      </Backdrop>
    );
  }

  // ── finalists: both mystery cards ──
  if (phase === "finalists" && winner && runnerUp) {
    return (
      <div className="flex min-h-screen flex-col bg-black px-3">
        <Header season={career.season} title="The Final Two" />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
          <p className="max-w-xs text-center text-sm text-white/50" style={{ animation: "bdFadeIn 0.8s ease-out" }}>
            Two players remain. Only one can win.
          </p>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3" style={{ animation: "bdFadeIn 0.6s ease-out 0.3s both" }}>
            <MysteryCard entry={runnerUp} />
            <MysteryCard entry={winner} />
          </div>
          <Dots big />
          {showFinalistButton && (
            <button
              onClick={() => { setShowFinalistButton(false); setPhase("finalist_reveal"); }}
              className="mt-2 w-full max-w-sm rounded-xl bg-amber-400 py-3.5 text-sm font-black text-black transition hover:bg-amber-300"
              style={{ animation: "bdFadeIn 0.4s ease-out" }}
            >
              Reveal the Winner →
            </button>
          )}
        </div>
        {BD_KEYFRAMES}
      </div>
    );
  }

  // ── the reveal itself ──
  if (phase === "finalist_reveal" && winner && runnerUp) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-3">
        {revealStep >= 2 && winner.isPlayer && <Confetti />}
        <div className="relative z-10 w-full max-w-sm space-y-4">
          <div className="mb-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-400/40">Ballon d&apos;Or {career.season}</p>
            <h2 className="mt-1 text-lg font-black text-white">
              {revealStep === 0 ? "The envelope is opened…" : revealStep === 1 ? "Runner-up…" : "🏅 Winner!"}
            </h2>
          </div>

          <RevealCard rank={2} entry={runnerUp} shown={revealStep >= 1} tone="silver" />
          <RevealCard rank={1} entry={winner} shown={revealStep >= 2} tone="gold" />

          {showResultButton && (
            <button
              onClick={() => setPhase("result")}
              className="w-full rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-black text-white transition hover:bg-white/10"
              style={{ animation: "bdFadeIn 0.5s ease-out" }}
            >
              Continue →
            </button>
          )}
        </div>
        {BD_KEYFRAMES}
      </div>
    );
  }

  // ── result ──
  const playerEntry = entries.find(e => e.isPlayer);
  return (
    <div className="min-h-screen bg-black pb-10">
      <div className="mx-auto max-w-sm space-y-4 px-3 pt-8">
        <div className={`rounded-2xl border p-6 text-center ${
          playerWon ? "border-amber-400/60 bg-amber-400/[0.08]"
            : playerNominated ? "border-white/15 bg-white/[0.04]"
              : "border-white/10 bg-white/[0.02]"}`}
        >
          {playerWon ? (
            <>
              <div className="text-5xl">🏅</div>
              <h2 className="mt-2 text-xl font-black text-amber-300">Ballon d&apos;Or Winner</h2>
              <p className="mt-2 text-xs text-white/50">History will remember this season.</p>
            </>
          ) : playerNominated ? (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Your Finish</p>
              <p className="mt-1 text-4xl font-black text-white">
                {playerRank === 2 ? "🥈" : playerRank === 3 ? "🥉" : `#${playerRank}`}
              </p>
              <p className="mt-2 text-xs text-white/50">
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
              <p className="mt-2 text-xs text-white/50">Trophies, goals and a big season next time.</p>
            </>
          )}
        </div>

        {playerEntry && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Your Season</p>
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
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">Winner</p>
            <div className="flex items-center gap-3">
              <span className="text-xl">🏅</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{winner.name}</p>
                <p className="text-xs text-white/40">{shortClub(winner.club)}</p>
              </div>
              <p className="shrink-0 text-xs text-white/50">{keyStat(winner)}</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest text-white/40">Final Top 10</p>
          <div className="space-y-1.5">
            {entries.map(e => (
              <div key={e.rank} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${e.isPlayer ? "bg-amber-400/10" : ""}`}>
                <span className={`w-5 shrink-0 text-center text-[11px] font-black ${e.rank <= 3 ? "text-amber-400" : "text-white/40"}`}>{e.rank}</span>
                <span className={`min-w-0 flex-1 truncate text-[12px] font-bold ${e.isPlayer ? "text-amber-300" : "text-white/85"}`}>{e.name}</span>
                <span className="shrink-0 text-[10px] text-white/40">{keyStat(e)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-sm px-3">
        <button
          onClick={() => onContinue(playerWon)}
          className="w-full rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 py-3.5 text-sm font-black uppercase tracking-wide text-black transition hover:brightness-105"
        >
          Continue to Next Season →
        </button>
      </div>

      {BD_KEYFRAMES}
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-3">
      {children}
      {BD_KEYFRAMES}
    </div>
  );
}

function Header({ season, title }: { season: number; title: string }) {
  return (
    <div className="sticky top-0 z-10 border-b border-white/10 bg-black/95 px-3 py-3.5 text-center backdrop-blur">
      <p className="text-[9px] font-black uppercase tracking-[0.4em] text-amber-400/50">Ballon d&apos;Or Season {season}</p>
      <h2 className="mt-0.5 text-sm font-black text-white">{title}</h2>
    </div>
  );
}

function Rule() {
  return <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />;
}

function Dots({ big = false }: { big?: boolean }) {
  const size = big ? "h-2 w-2" : "h-1 w-1";
  return (
    <div className="mt-4 flex justify-center gap-1.5">
      {[0, 160, 320].map(d => (
        <div key={d} className={`${size} animate-bounce rounded-full bg-amber-400/60`} style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[9px] font-bold text-white/40">{label}</p>
      <p className={`text-lg font-black ${accent ? "text-amber-400" : "text-white"}`}>{value}</p>
    </div>
  );
}

function CountdownCard({ entry }: { entry: BallonDorEntry }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${
        entry.isPlayer ? "border-amber-400/50 bg-amber-400/[0.08]" : "border-white/10 bg-white/[0.03]"}`}
      style={{ animation: "bdSlideUp 0.45s ease-out" }}
    >
      <span className={`w-7 shrink-0 text-center text-sm font-black ${entry.rank <= 3 ? "text-amber-400" : "text-white/40"}`}>#{entry.rank}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-sm font-black ${entry.isPlayer ? "text-amber-300" : "text-white"}`}>{entry.name}</p>
          {entry.isPlayer && <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-px text-[9px] font-black text-black">YOU</span>}
        </div>
        <p className="text-[11px] text-white/40">{shortClub(entry.club)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-bold text-white/60">{keyStat(entry)}</p>
        {entry.trophies.length > 0 && <p className="mt-0.5 text-[9px] text-amber-400/60">🏆 ×{entry.trophies.length}</p>}
      </div>
    </div>
  );
}

function MysteryCard({ entry }: { entry: BallonDorEntry }) {
  return (
    <div className={`rounded-2xl border p-4 text-center ${entry.isPlayer ? "border-amber-400/50 bg-amber-400/[0.08]" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-amber-400/30 bg-white/5">
        <span className="text-base text-amber-400/50">?</span>
      </div>
      <p className={`text-sm font-black leading-tight ${entry.isPlayer ? "text-amber-300" : "text-white"}`}>{entry.name}</p>
      <p className="mt-0.5 text-[10px] text-white/40">{shortClub(entry.club)}</p>
      <p className="mt-2 text-[10px] text-white/50">{keyStat(entry)}</p>
      {entry.isPlayer && <span className="mt-2 inline-block rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-black">YOU</span>}
    </div>
  );
}

function RevealCard({ rank, entry, shown, tone }: { rank: 1 | 2; entry: BallonDorEntry; shown: boolean; tone: "gold" | "silver" }) {
  const goldShown = tone === "gold" && shown;
  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-700 ${
        shown
          ? goldShown
            ? entry.isPlayer ? "border-amber-400 bg-amber-400/[0.1]" : "border-amber-500/50 bg-amber-500/[0.06]"
            : entry.isPlayer ? "border-white/40 bg-white/[0.08]" : "border-white/15 bg-white/[0.03]"
          : "border-white/5 bg-white/[0.015]"
      }`}
      style={{
        animation: shown ? "bdDropIn 0.6s ease-out" : undefined,
        boxShadow: goldShown ? "0 0 40px rgba(251,191,36,0.25)" : undefined,
      }}
    >
      {shown ? (
        <>
          <div className="mb-2.5 flex items-start justify-between">
            <span className="text-2xl">{rank === 1 ? "🏅" : "🥈"}</span>
            {entry.isPlayer && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${rank === 1 ? "bg-amber-400 text-black" : "bg-white/80 text-black"}`}>YOU</span>
            )}
          </div>
          <p className={`font-black leading-tight ${rank === 1 ? "text-2xl" : "text-lg"} ${
            rank === 1 ? (entry.isPlayer ? "text-amber-300" : "text-amber-200") : (entry.isPlayer ? "text-white" : "text-white/90")}`}>
            {entry.name}
          </p>
          <p className="mt-1 text-xs text-white/40">{shortClub(entry.club)}</p>
          <div className={`mt-3 h-px ${rank === 1 ? "bg-amber-400/20" : "bg-white/10"}`} />
          <p className="mt-2 text-sm font-bold text-white/70">{keyStat(entry)} · {entry.ratingIsReal ? "" : "~"}{entry.rating.toFixed(1)} rtg</p>
          {entry.trophies.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {entry.trophies.map((t, i) => (
                <span key={`${t}-${i}`} className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-white/60">🏆 {t}</span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="py-3 text-center">
          <p className="animate-pulse text-3xl">❓</p>
        </div>
      )}
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    left: `${(i * 13.7 + 4) % 100}%`,
    color: ["#F0C040", "#FF6B35", "#4ADE80", "#60A5FA", "#F472B6", "#A78BFA", "#FBBF24"][i % 7],
    width: `${6 + (i % 4) * 2}px`,
    height: `${10 + (i % 5) * 3}px`,
    delay: `${((i * 0.11) % 2.2).toFixed(2)}s`,
    duration: `${(2 + (i % 6) * 0.3).toFixed(2)}s`,
    rotate: `${(i * 47) % 360}deg`,
  }));
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="absolute animate-bounce rounded-sm"
          style={{
            left: p.left, top: `${-5 - (i * 6) % 15}%`,
            width: p.width, height: p.height, background: p.color,
            animationDelay: p.delay, animationDuration: p.duration,
            transform: `rotate(${p.rotate})`, opacity: 0.88,
          }}
        />
      ))}
    </div>
  );
}
