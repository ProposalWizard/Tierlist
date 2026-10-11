"use client";

/**
 * THE BALLON D'OR NIGHT — the ceremony (STAR_ROADMAP.md #7: "A real
 * ceremony: your player walks up, a famous player hosts and calls the winner
 * up, the final three on podiums. Today it is text that pops up.").
 *
 *   New (Settings → Look → "Ballon d'Or night", the default): the stage —
 *     the host at his lectern, the final three walk up onto podiums (one by
 *     one as he calls each name when you are one of them; together, shorter,
 *     when you are not), "And the winner is…", a pause, the name, the golden
 *     ball over him, gold light and confetti, then your place. 3D when the
 *     phone can (lib/star/ballonDor3d.ts), a drawn stage with the same beats
 *     when it can't. Skip any time. Then the result page (BallonDor.tsx's
 *     last page: your season, the top ten, Continue).
 *   Old: components/star/BallonDor.tsx exactly as it was.
 *
 * Timing for both: lib/star/ballonDorNight.ts. The host is nobody real.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { computeBallonDorShortlist, type BallonDorResult } from "@/lib/star/ballonDor";
import { nightPlan, beatAt, callingAt, finalistXAt, podiumHeightAt, podiumX, placeWord, PODIUM, type NightPlan, type Finalist } from "@/lib/star/ballonDorNight";
import { useBallonDorNightLook } from "@/lib/star/ballonDorNightLook";
import type { NightSceneHandle } from "@/lib/star/ballonDor3d";
import { kitsOf, type Kit } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { faceOrFake, DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { playCrowdSwell } from "@/lib/star/matchSound";
import ImageWithFallback from "@/components/ImageWithFallback";
import BallonDor from "./BallonDor";
import ClubBadge from "./ClubBadge";
import TrophyImage from "./TrophyImage";
import { signing3dBlocker } from "./SigningScene3D";
import { useYouLook } from "./Farewell";
import { Burst, KitStyles } from "./ui";

const GOLD = "#fbbf24";
/** The longest the 3D may take to load before the drawn stage takes over. */
const LOAD_LIMIT_MS = 20000;

/** The Ballon d'Or night: the New ceremony then the result page, or the Old screen. */
export default function BallonDorNight({ career, onContinue }: { career: CareerState; onContinue: (userWon: boolean) => void }) {
  const look = useBallonDorNightLook();
  const result = useMemo(() => computeBallonDorShortlist(career), [career]);
  const [stage, setStage] = useState<"ceremony" | "result">("ceremony");
  if (look === "old") return <BallonDor career={career} onContinue={onContinue} />;
  // Fewer than three on the list: no podiums to fill, straight to the result.
  if (stage === "result" || result.entries.length < 3) return <BallonDor career={career} onContinue={onContinue} startAt="result" result={result} />;
  return <BallonDorCeremony career={career} result={result} onDone={() => setStage("result")} />;
}

/**
 * The ceremony on its own (the test page shows it with made-up results).
 * `drawn` forces the drawn stage whatever the phone can do.
 */
export function BallonDorCeremony({ career, result, onDone, drawn = false }: {
  career: CareerState; result: BallonDorResult; onDone: () => void; drawn?: boolean;
}) {
  const yourRank = result.playerNominated ? result.playerRank : 0;
  const plan = useMemo(
    () => nightPlan(result.entries, yourRank, (career.player.startYear ?? 0) * 31 + career.season),
    [result, yourRank, career.player.startYear, career.season],
  );
  const [mode, setMode] = useState<"3d" | "drawn">(() => (drawn || (typeof window !== "undefined" && signing3dBlocker()) ? "drawn" : "3d"));
  // The night's clock: starts when the stage is ready (the drawn one at once).
  const startRef = useRef<number | null>(null);
  const frozenRef = useRef<number | null>(null);
  const clock = useRef(() => (frozenRef.current ?? (startRef.current === null ? 0 : (performance.now() - startRef.current) / 1000))).current;
  const [t, setT] = useState(0);
  const [ready, setReady] = useState(mode === "drawn");
  useEffect(() => { if (mode === "drawn") setReady(true); }, [mode]);
  useEffect(() => {
    if (!ready) return;
    if (startRef.current === null) startRef.current = performance.now();
    const id = window.setInterval(() => setT(clock()), 100);
    return () => window.clearInterval(id);
  }, [ready, clock]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);
  const finish = () => { if (!finished.current) { finished.current = true; doneRef.current(); } };
  // On to the result page a moment after the end.
  useEffect(() => {
    if (frozenRef.current === null && t >= plan.end + 1.5) finish();
  }, [t, plan.end]);
  // The room: a swell as the winner is named.
  const revealed = t >= plan.revealAt;
  useEffect(() => { if (revealed && frozenRef.current === null) playCrowdSwell("cheer"); }, [revealed]);

  // Stills for checking: window.__bdorNight.seek(t) holds the night at t.
  const handleRef = useRef<NightSceneHandle | null>(null);
  useEffect(() => {
    const w = window as unknown as { __bdorNight?: { seek(t: number): void; plan: NightPlan; mode: string } };
    w.__bdorNight = {
      plan, mode,
      seek(at: number) { frozenRef.current = at; setT(at); handleRef.current?.debugSeek(at); },
    };
    return () => { delete w.__bdorNight; };
  }, [plan, mode]);

  const ownKit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#070912] text-white" data-bdor-night={mode}>
      <KitStyles />
      {mode === "3d"
        ? <Stage3D career={career} plan={plan} kit={ownKit} clock={clock} handleRef={handleRef} onReady={() => setReady(true)} onFail={() => setMode("drawn")} />
        : <StageDrawn career={career} plan={plan} t={t} />}
      <Captions career={career} plan={plan} t={t} loading={!ready} />
      {revealed && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <Burst trigger={1} colors={["#fde047", "#fbbf24", "#ffffff", "#f59e0b", "#fef3c7"]} count={44} spread={2.3} className="left-1/2 top-[34%]" />
          <Burst trigger={1} colors={["#fde047", "#fbbf24", "#ffffff"]} count={28} spread={1.5} round className="left-1/2 top-[26%]" />
        </div>
      )}
      <button
        onClick={finish}
        className="kib-press absolute bottom-[calc(18px+env(safe-area-inset-bottom))] right-4 z-30 px-4 py-2.5 text-[13px] font-black uppercase tracking-wide text-gray-950"
        style={{ background: "linear-gradient(180deg, #fde047, #f59e0b)", borderRadius: 2 }}
        data-bdor-skip
      >
        {t >= plan.end ? "Continue ›" : "Skip ›"}
      </button>
    </div>
  );
}

// ── The words over the stage ───────────────────────────────────────────────

function Captions({ career, plan, t, loading }: { career: CareerState; plan: NightPlan; t: number; loading: boolean }) {
  const beat = beatAt(plan, t);
  const winner = plan.finalists[0];
  const calling = callingAt(plan, t);
  const youWon = plan.yourRank === 1;
  const top = (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-5 text-center" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.6), transparent)" }}>
      <div className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-200">Season {career.season}</div>
      <h1 className="text-[30px] uppercase leading-none text-white" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}>Ballon d&apos;Or</h1>
    </div>
  );
  let line: React.ReactNode = null;
  if (loading) {
    line = <Lower small="The doors open">Taking your seats…</Lower>;
  } else if (beat === "host") {
    line = <Lower small="Your host tonight">A legend of the game</Lower>;
  } else if (beat === "walk") {
    line = calling
      ? <Lower small={`From ${shortClub(calling.entry.club)}…`}>{calling.entry.name}!</Lower>
      : <Lower small="Please welcome">The final three</Lower>;
  } else if (beat === "call") {
    line = <Lower small="The host opens the envelope">And the winner is…</Lower>;
  } else if (beat === "pause") {
    line = <div className="kib-bd-dots text-[44px] font-black leading-none text-amber-200">…</div>;
  } else if (beat === "reveal" || beat === "yours" || beat === "done") {
    line = (
      <div className="kib-bd-name text-center" data-bdor-winner>
        <div className="flex items-center justify-center gap-1.5">
          <ClubBadge club={winner.entry.club} size={18} />
          <span className="text-[12px] font-black uppercase tracking-widest text-amber-200">{shortClub(winner.entry.club)}</span>
        </div>
        <div className={`${beat === "yours" ? "text-[30px]" : "text-[42px]"} font-black uppercase leading-none`} style={{ color: GOLD, textShadow: "0 0 22px rgba(251,191,36,.6), 0 2px 4px #000" }}>
          {youWon ? "You!" : winner.entry.name}
        </div>
        <div className="mt-1 text-[13px] font-black uppercase tracking-wide text-white">
          {youWon ? `${winner.entry.name} wins the Ballon d'Or` : "wins the Ballon d'Or"}
        </div>
      </div>
    );
  }
  const yours = beat === "yours" || (beat === "done" && plan.yourRank !== 1);
  return (
    <>
      {top}
      <style>{`
        @keyframes kibBdIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes kibBdName { 0% { opacity: 0; transform: scale(.7); letter-spacing: .3em; } 60% { opacity: 1; transform: scale(1.06); } 100% { transform: scale(1); } }
        @keyframes kibBdDots { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
        .kib-bd-in { animation: kibBdIn .45s ease-out both; }
        .kib-bd-name { animation: kibBdName .8s cubic-bezier(.2,.9,.3,1.2) both; }
        .kib-bd-dots { animation: kibBdDots .9s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .kib-bd-in, .kib-bd-name, .kib-bd-dots { animation: none; } }
      `}</style>
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 flex flex-col items-center gap-3 px-4">
        <div key={`${beat}-${calling?.rank ?? 0}`} className="kib-bd-in">{line}</div>
        {yours && (
          <div className="kib-bd-in px-3 py-1.5 text-[15px] font-black uppercase tracking-wide" style={{ background: "rgba(0,0,0,.65)", borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(251,191,36,.5)" }} data-bdor-yours>
            {plan.yourRank > 0 ? <>You finished <span style={{ color: GOLD }}>{placeWord(plan.yourRank)}</span></> : "You were not on the list this year"}
          </div>
        )}
      </div>
    </>
  );
}

function Lower({ small, children }: { small: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-[12px] font-black uppercase tracking-[0.2em] text-amber-200" style={{ textShadow: "0 1px 3px #000" }}>{small}</div>
      <div className="text-[30px] font-black uppercase leading-none text-white" style={{ textShadow: "0 2px 8px rgba(0,0,0,.9)" }}>{children}</div>
    </div>
  );
}

// ── The 3D stage ───────────────────────────────────────────────────────────

function Stage3D({ career, plan, kit, clock, handleRef, onReady, onFail }: {
  career: CareerState; plan: NightPlan; kit: Kit; clock: () => number;
  handleRef: React.MutableRefObject<NightSceneHandle | null>; onReady: () => void; onFail: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const you = useYouLook(career, kit);
  const cb = useRef({ onReady, onFail });
  cb.current = { onReady, onFail };
  useEffect(() => {
    const el = wrap.current;
    if (!el || !you) return;
    let disposed = false;
    let handle: NightSceneHandle | null = null;
    const limit = window.setTimeout(() => { if (!handle && !disposed) { console.warn("[ballon d'or night] 3D took too long; drawn instead"); cb.current.onFail(); } }, LOAD_LIMIT_MS);
    (async () => {
      try {
        const { createNightScene } = await import("@/lib/star/ballonDor3d");
        const kits: Record<number, { shirt: string; trim: string }> = {};
        for (const f of plan.finalists) {
          const k = f.entry.isPlayer ? kit : kitsOf(f.entry.club, career.clubKits?.[f.entry.club]).home;
          kits[f.rank] = { shirt: k.shirt, trim: k.trim };
        }
        const h = await createNightScene(el, { plan, you, kits, seed: (career.player.startYear ?? 0) * 31 + career.season, clock });
        if (disposed) { h.dispose(); return; }
        handle = h;
        handleRef.current = h;
        window.clearTimeout(limit);
        (window as unknown as { __bdorNight3dReady?: boolean }).__bdorNight3dReady = true;
        cb.current.onReady();
      } catch (e) {
        console.warn("[ballon d'or night] 3D failed; drawn instead:", e);
        if (!disposed) cb.current.onFail();
      }
    })();
    return () => {
      disposed = true;
      window.clearTimeout(limit);
      handle?.dispose();
      handleRef.current = null;
      (window as unknown as { __bdorNight3dReady?: boolean }).__bdorNight3dReady = false;
    };
    // built once, when your look is known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [you]);
  return <div ref={wrap} className="absolute inset-0" />;
}

// ── The drawn stage (a phone that can't run 3D): the same night, no canvas ──

/** Stage metres across → % of the screen. */
const xPct = (x: number) => 50 + x * 14;

function StageDrawn({ career, plan, t }: { career: CareerState; plan: NightPlan; t: number }) {
  const revealed = t >= plan.revealAt;
  const winner = plan.finalists[0];
  const beat = beatAt(plan, t);
  const hostTalking = beat === "host" || beat === "call" || (plan.kind === "full" && beat === "walk");
  // The golden ball: from the host's plinth to over the winner.
  const lift = Math.max(0, Math.min(1, (t - plan.revealAt - 0.2) / 1.6));
  const e = lift * lift * (3 - 2 * lift);
  const ballX = xPct(PODIUM.hostX - 1.05) + (xPct(podiumX(winner.slot)) - xPct(PODIUM.hostX - 1.05)) * e;
  // From the stage floor by the lectern to just over the winner's head.
  const overHead = 30 + podiumHeightAt(plan, 1, t) * 90 + 112;
  const ballUp = overHead * e + Math.sin(e * Math.PI) * 60;
  return (
    <div className="absolute inset-0" style={{ background: "radial-gradient(60% 40% at 50% 34%, rgba(246,196,69,.16), transparent 70%), linear-gradient(180deg, #05060c 0%, #10121c 60%, #07080d 100%)" }} data-bdor-drawn>
      {/* The wall: light strips and the gold ring. */}
      <div className="absolute inset-x-0 top-[12%] h-[48%]" style={{ background: "repeating-linear-gradient(90deg, transparent 0 34px, rgba(109,134,255,.25) 34px 36px)" }} />
      <div className="absolute left-1/2 top-[19%] h-[150px] w-[150px] -translate-x-1/2 rounded-full" style={{ border: "5px solid #f6c445", boxShadow: `0 0 ${revealed ? 50 : 24}px rgba(246,196,69,.6), inset 0 0 24px rgba(246,196,69,.35)` }} />
      {/* The stage floor and its gold edge. */}
      <div className="absolute inset-x-0 bottom-0 h-[34%]" style={{ background: "linear-gradient(180deg, #0c0d12, #050507)" }} />
      <div className="absolute inset-x-0 bottom-[34%] h-[3px]" style={{ background: "#f6c445", boxShadow: "0 0 12px #f6c445" }} />
      {/* Podiums, beams and the three. */}
      {plan.finalists.map((f) => <DrawnFinalist key={f.rank} career={career} plan={plan} f={f} t={t} />)}
      {/* The host at his lectern. */}
      <div className="absolute bottom-[34%] w-[64px] -translate-x-1/2" style={{ left: `${Math.min(90, xPct(PODIUM.hostX))}%` }} data-bdor-host>
        <HostFigure talking={hostTalking} waving={revealed && t < plan.revealAt + 2.2} />
      </div>
      {/* The golden ball. */}
      <div className="absolute -translate-x-1/2" style={{ left: `${ballX}%`, bottom: `calc(34% + ${ballUp}px)`, zIndex: 6,filter: `drop-shadow(0 0 ${8 + 22 * e}px rgba(253,224,71,${0.4 + 0.5 * e}))` }} data-bdor-ball>
        <TrophyImage name="Ballon d'Or" height={34 + 16 * e} fallback="🏅" />
      </div>
    </div>
  );
}

function DrawnFinalist({ career, plan, f, t }: { career: CareerState; plan: NightPlan; f: Finalist; t: number }) {
  const revealed = t >= plan.revealAt;
  const at = finalistXAt(f, t);
  const h = podiumHeightAt(plan, f.rank, t);
  const podiumPx = 30 + h * 90;
  const left = xPct(podiumX(f.slot));
  const k = Math.max(0, Math.min(1, (t - (f.walkTo - 0.45)) / 0.45));
  const standPx = at.on ? podiumPx : podiumPx * k * k;
  const kit = kitsOf(f.entry.club, career.clubKits?.[f.entry.club]).home;
  const face = f.entry.isPlayer ? (career.player.portrait ?? DEFAULT_FAKE_FACE) : faceOrFake(f.entry.image, f.entry.name);
  const win = revealed && f.rank === 1;
  const beam = at.on ? (revealed ? (win ? 0.34 : 0.08) : 0.16) : 0;
  return (
    <>
      <div className="absolute top-0 w-[120px] -translate-x-1/2" style={{ left: `${left}%`, bottom: "34%", opacity: beam, background: `linear-gradient(180deg, transparent, ${win ? "rgba(255,211,107,.9)" : "rgba(191,210,255,.8)"})`, clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)", transition: "opacity .4s" }} />
      <div className="absolute w-[84px] -translate-x-1/2" style={{ left: `${left}%`, bottom: "34%", height: podiumPx, zIndex: 1,background: "linear-gradient(90deg, #0d0e14, #23252f 50%, #0d0e14)", borderTop: "3px solid #f6c445", boxShadow: "0 -2px 10px rgba(246,196,69,.35)" }}>
        {revealed && <div className="kib-bd-in mt-1 text-center text-[20px] font-black text-amber-300">{f.rank}</div>}
      </div>
      {at.seen && (
        <div className="absolute w-[76px] -translate-x-1/2 text-center" style={{ left: `${xPct(at.x)}%`, bottom: `calc(34% + ${standPx}px)`, zIndex: at.walking ? 5 : 3 }} data-bdor-finalist={f.rank}>
          <div className={win ? "kib-bd-name" : ""}>
            <ImageWithFallback src={face} fallbackSrc={faceOrFake(null, f.entry.name)} alt="" className="mx-auto rounded-full object-cover" style={{ width: 54, height: 54, border: `3px solid ${win ? GOLD : kit.trim}`, background: kit.shirt, boxShadow: win ? "0 0 22px rgba(251,191,36,.8)" : "0 2px 6px rgba(0,0,0,.6)" }} />
            <div className="mx-auto -mt-1 h-[34px] w-[46px]" style={{ background: kit.shirt, borderTop: `4px solid ${kit.trim}`, borderRadius: "10px 10px 2px 2px" }} />
          </div>
          <div className="mt-0.5 truncate text-[11px] font-black uppercase leading-tight" style={{ color: f.entry.isPlayer ? GOLD : "#fff", textShadow: "0 1px 2px #000" }}>
            {f.entry.isPlayer ? "You" : f.entry.name.split(" ").slice(-1)[0]}
          </div>
        </div>
      )}
    </>
  );
}

/** The host: a man in a dinner suit with a microphone — nobody real. */
function HostFigure({ talking, waving }: { talking: boolean; waving: boolean }) {
  return (
    <svg viewBox="0 0 64 120" className="w-full" aria-hidden>
      <rect x="6" y="70" width="52" height="50" fill="#101119" stroke="#f6c445" strokeWidth="2" />
      <circle cx="32" cy="16" r="10" fill="#c8946b" />
      <path d="M22 12 Q32 2 42 12 L42 9 Q32 -1 22 9 Z" fill="#9ca3af" />
      <path d="M16 30 Q32 24 48 30 L50 72 L14 72 Z" fill="#111827" />
      <path d="M28 28 L32 44 L36 28 Z" fill="#f8fafc" />
      <path d="M30 29 L32 33 L34 29 Z" fill="#111" />
      <g style={{ transformOrigin: "46px 32px", transform: waving ? "rotate(-120deg)" : talking ? "rotate(-35deg)" : "rotate(-10deg)", transition: "transform .4s" }}>
        <rect x="44" y="30" width="6" height="26" rx="3" fill="#111827" />
        <rect x="45" y="54" width="4" height="9" fill="#374151" />
        <circle cx="47" cy="65" r="3.5" fill="#6b7280" />
      </g>
    </svg>
  );
}
