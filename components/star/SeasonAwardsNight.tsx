"use client";

/**
 * THE SEASON AWARDS NIGHT (Leo's tonight plan, part 13a: "a smaller hall,
 * the same system" as the Ballon d'Or night).
 *
 * A host calls each award — Golden Boot, Assist King, Golden Glove, Young
 * Player, Player of the Season — the three nominees with their faces, "And
 * the winner is…", the name, and the winner walks up from his table to lift
 * the trophy (you, in your kit and with your face, when it is yours). Tap
 * anywhere (or Skip ›) for the next award; Skip all ends it. Then the season
 * awards page (SeasonAwardsScreen) exactly as before.
 *
 * 3D when the phone can (lib/star/awardsNight3d.ts), a drawn room with the
 * same beats when it can't or the 3D takes too long. Timing for both:
 * lib/star/awardsNight.ts. The host is nobody real.
 */
import { seasonLabelOf } from "@/lib/star/goalClip/reel";
import { useEffect, useMemo, useRef, useState } from "react";
import { setMusicScene, clearMusicScene } from "@/lib/star/gameMusic";
import type { CareerState } from "@/lib/star/types";
import type { AwardWinner } from "@/lib/star/seasonAwards";
import { awardsPlan, awardAt, beatAt, skipTarget, personId, type AwardsPlan, type AwardCall } from "@/lib/star/awardsNight";
import type { AwardsSceneHandle } from "@/lib/star/awardsNight3d";
import { kitsOf, type Kit } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { playCrowdSwell, primeMatchSound } from "@/lib/star/matchSound";
import { PHOTO_FACES } from "@/lib/star/faceStyle";
import { faceOrFake } from "@/lib/star/fakeFaces";
import ImageWithFallback from "@/components/ImageWithFallback";
import SeasonAwardsScreen from "./SeasonAwardsScreen";
import ClubBadge, { drawnBadgeUrl } from "./ClubBadge";
import { getClubLogoMap, lookupClubLogo } from "@/lib/star/clubLogos";
import { useBadgeLook } from "@/lib/star/badgeLook";
import { useBadgeOverrides } from "@/lib/star/badgeOverrides";
import TrophyImage from "./TrophyImage";
import Headshot3D, { HeadshotCareer, useHeadshotId } from "./Headshot3D";
import { signing3dBlocker } from "./SigningScene3D";
import { useYouLook } from "./Farewell";
import { headshotLookFor } from "@/lib/star/headshot3d/look";
import { toonYou } from "@/lib/star/style3d/toon/bodies";
import { Burst, KitStyles } from "./ui";

const GOLD = "#fbbf24";
/** The longest the 3D may take to load before the drawn room takes over. */
const LOAD_LIMIT_MS = 20000;

/** The night, then the season awards page. */
export default function SeasonAwardsNight({ career, onContinue }: { career: CareerState; onContinue: () => void }) {
  const stats = career.lastSeasonAwardStats;
  const plan = useMemo(() => (stats ? awardsPlan(stats, seedOf(career)) : null), [stats, career]);
  const [stage, setStage] = useState<"night" | "result">("night");
  const night = stage === "night" && !!plan && plan.awards.length > 0;
  // Game music: suspense while the awards are read, then a win if any of them was yours.
  const won = (plan?.yourWins ?? 0) > 0;
  useEffect(() => {
    setMusicScene("awards-night", { kind: "ballon-dor", won: night ? null : won }, 10);
  }, [night, won]);
  useEffect(() => () => clearMusicScene("awards-night"), []);
  if (!night || !plan) return <SeasonAwardsScreen career={career} onContinue={onContinue} />;
  return <AwardsCeremony career={career} plan={plan} onDone={() => setStage("result")} />;
}

export const seedOf = (career: CareerState) => (career.player.startYear ?? 0) * 37 + (career.lastSeasonAwardStats?.season ?? career.season);

/**
 * The night on its own (the test page shows it with made-up results).
 * `drawn` forces the drawn room whatever the phone can do.
 */
export function AwardsCeremony({ career, plan, onDone, drawn = false }: {
  career: CareerState; plan: AwardsPlan; onDone: () => void; drawn?: boolean;
}) {
  const [mode, setMode] = useState<"3d" | "drawn">(() => (drawn || (typeof window !== "undefined" && signing3dBlocker()) ? "drawn" : "3d"));
  // The night's clock: starts when the room is ready (the drawn one at once). A skip moves the start back.
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
  useEffect(() => {
    if (frozenRef.current === null && t >= plan.end + 1.0) finish();
  }, [t, plan.end]);
  /** On to the next award (or the end). */
  const skip = () => {
    if (!ready) return;
    const now = clock();
    const to = skipTarget(plan, now);
    if (to >= plan.end) { finish(); return; }
    if (frozenRef.current !== null) frozenRef.current = to;
    else if (startRef.current !== null) startRef.current -= (to - now) * 1000;
    setT(to);
  };
  // A cheer each time a name is read out.
  const a = awardAt(plan, t);
  const revealed = !!a && t >= a.revealAt;
  const revealKey = revealed ? a!.key : "";
  // The cheer plays on the match's sound, which only a match switched on until
  // now: opening the app straight at the season end gave a silent night. Switch
  // it on here (the earlier taps have already unlocked sound) and on every tap.
  useEffect(() => { primeMatchSound(); }, []);
  useEffect(() => { if (revealKey && frozenRef.current === null) playCrowdSwell("cheer"); }, [revealKey]);

  // Stills for checking: window.__awardsNight.seek(t) holds the night at t.
  const handleRef = useRef<AwardsSceneHandle | null>(null);
  useEffect(() => {
    const w = window as unknown as { __awardsNight?: { seek(t: number): void; plan: AwardsPlan; mode: string } };
    w.__awardsNight = {
      plan, mode,
      seek(at: number) { frozenRef.current = at; setT(at); handleRef.current?.debugSeek(at); },
    };
    return () => { delete w.__awardsNight; };
  }, [plan, mode]);

  const ownKit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  const youWonThis = revealed && a!.winner.isYou;
  return (
    <HeadshotCareer career={career}>
      <div className="relative h-[100dvh] w-full select-none overflow-hidden bg-[#120a07] text-white" data-awards-night={mode} onPointerDown={() => primeMatchSound()} onClick={skip}>
        <KitStyles />
        {mode === "3d" && <PreloadFaces plan={plan} />}
        {mode === "3d"
          ? <Room3D career={career} plan={plan} kit={ownKit} clock={clock} handleRef={handleRef} onReady={() => setReady(true)} onFail={() => setMode("drawn")} />
          : <RoomDrawn career={career} plan={plan} t={t} />}
        <Captions career={career} plan={plan} t={t} loading={!ready} />
        {youWonThis && (
          <div key={a!.key} className="pointer-events-none absolute inset-0 z-20">
            <Burst trigger={1} colors={["#fde047", "#fbbf24", "#ffffff", ownKit.shirt, ownKit.trim]} count={36} spread={2} className="left-1/2 top-[38%]" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-[calc(18px+env(safe-area-inset-bottom))] z-30 flex items-center justify-between px-4">
          <button
            onClick={(e) => { e.stopPropagation(); finish(); }}
            className="kib-press px-3 py-2 text-[12px] font-black uppercase tracking-wide text-white"
            style={{ background: "rgba(0,0,0,.55)", borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.3)" }}
            data-awards-skip-all
          >
            Skip all
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); skip(); }}
            className="kib-press px-4 py-2.5 text-[13px] font-black uppercase tracking-wide text-gray-950"
            style={{ background: "linear-gradient(180deg, #fde047, #f59e0b)", borderRadius: 2 }}
            data-awards-skip
          >
            {t >= plan.end ? "Continue ›" : !a || a === plan.awards[plan.awards.length - 1] ? "Skip ›" : "Next award ›"}
          </button>
        </div>
      </div>
    </HeadshotCareer>
  );
}

/**
 * Every nominee's headshot made while the room loads (one at a time, kept on
 * the device), so the nominee cards open with their faces already there
 * rather than the drawn heads swapping over mid-beat.
 */
function PreloadFaces({ plan }: { plan: AwardsPlan }) {
  const idOf = useHeadshotId();
  useEffect(() => {
    if (PHOTO_FACES) return;
    let dead = false;
    const seen = new Set<string>();
    const men = plan.awards.flatMap((a) => a.nominees).filter((n) => { const k = personId(n); if (seen.has(k)) return false; seen.add(k); return true; });
    void import("@/lib/star/headshot3d/maker").then(async ({ makeHeadshot }) => {
      // In the order the cards come up: the first award's three first.
      for (const n of men) {
        if (dead) return;
        const id = idOf(n.name, n.club, n.isYou);
        await makeHeadshot(id, headshotLookFor({ id, you: n.isYou, kit: kitsOf(n.club).home }, toonYou())).catch(() => null);
      }
    });
    return () => { dead = true; };
  }, [plan, idOf]);
  return null;
}

// ── The words over the room ────────────────────────────────────────────────

function Captions({ career, plan, t, loading }: { career: CareerState; plan: AwardsPlan; t: number; loading: boolean }) {
  const a = awardAt(plan, t);
  const beat = beatAt(plan, t);
  const idx = a ? plan.awards.indexOf(a) : -1;
  let line: React.ReactNode = null;
  if (loading) {
    line = <Lower small="The doors open">Finding your table…</Lower>;
  } else if (!a || beat === "intro") {
    line = <Lower small={seasonLabelOf(career.player.startYear ?? 0, plan.season)}>The Season Awards</Lower>;
  } else if (beat === "call") {
    line = (
      <div className="flex flex-col items-center">
        <TrophyImage name={a.label} height={44} fallback={a.icon} />
        <Lower small="The next award">{a.label}</Lower>
      </div>
    );
  } else if (beat === "nominees") {
    line = <Nominees award={a} />;
  } else if (beat === "envelope") {
    line = <Lower small={a.label}>And the winner is…</Lower>;
  } else {
    line = <WinnerLine career={career} award={a} />;
  }
  return (
    <>
      <style>{`
        @keyframes kibAnIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes kibAnName { 0% { opacity: 0; transform: scale(.7); } 60% { opacity: 1; transform: scale(1.06); } 100% { transform: scale(1); } }
        .kib-an-in { animation: kibAnIn .4s ease-out both; }
        .kib-an-name { animation: kibAnName .7s cubic-bezier(.2,.9,.3,1.2) both; }
        @media (prefers-reduced-motion: reduce) { .kib-an-in, .kib-an-name { animation: none !important; } }
      `}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-5 text-center" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.65), transparent)" }}>
        <div className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-200">{seasonLabelOf(career.player.startYear ?? 0, plan.season)}</div>
        <h1 className="text-[26px] font-black uppercase leading-none text-white" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}>Season Awards</h1>
        {/* One dot an award: gold once it is given, a ring for the one on now. */}
        <div className="mt-2 flex justify-center gap-1.5" data-awards-dots>
          {plan.awards.map((x, i) => (
            <span key={x.key} className="h-2 w-2 rounded-full" style={{ background: i < idx || (i === idx && t >= x.revealAt) ? GOLD : "rgba(255,255,255,.25)", boxShadow: i === idx ? "0 0 0 2px rgba(251,191,36,.6)" : undefined }} />
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 flex flex-col items-center px-3">
        <div key={`${beat}-${a?.key ?? ""}`} className="kib-an-in w-full">{line}</div>
      </div>
    </>
  );
}

function Lower({ small, children }: { small: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-[12px] font-black uppercase tracking-[0.2em] text-amber-200" style={{ textShadow: "0 1px 3px #000" }}>{small}</div>
      <div className="text-[28px] font-black uppercase leading-none text-white" style={{ textShadow: "0 2px 8px rgba(0,0,0,.9)" }}>{children}</div>
    </div>
  );
}

/** His face: the 3D headshot (photo faces off), else his photo or fake face. */
function Face({ w, size, ring }: { w: AwardWinner; size: number; ring: string }) {
  const idOf = useHeadshotId();
  if (!PHOTO_FACES) {
    const kit = kitsOf(w.club).home;
    return <Headshot3D id={idOf(w.name, w.club, w.isYou)} you={w.isYou} kit={kit} size={size} zoom={1.4} className="rounded-full" style={{ backgroundColor: kit.shirt, boxShadow: `0 0 0 3px ${ring}` }} />;
  }
  return (
    <ImageWithFallback src={faceOrFake(w.image, w.name)} fallbackSrc={faceOrFake(null, w.name)} alt=""
      className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, boxShadow: `0 0 0 3px ${ring}` }} />
  );
}

function Nominees({ award }: { award: AwardCall }) {
  return (
    <div className="text-center" data-awards-nominees>
      <div className="mb-2 text-[12px] font-black uppercase tracking-[0.2em] text-amber-200" style={{ textShadow: "0 1px 3px #000" }}>
        {award.label} · the nominees
      </div>
      <div className="flex justify-center gap-2">
        {award.nominees.map((n, i) => (
          <div key={personId(n)} className="kib-an-in flex w-[31%] max-w-[120px] flex-col items-center px-1 py-2"
            style={{ animationDelay: `${i * 0.35}s`, background: "rgba(10,6,4,.78)", borderRadius: 4, boxShadow: n.isYou ? "inset 0 0 0 1px rgba(251,191,36,.7)" : "inset 0 0 0 1px rgba(255,255,255,.15)" }}>
            <Face w={n} size={58} ring={n.isYou ? GOLD : kitsOf(n.club).home.trim} />
            <div className="mt-1.5 w-full truncate text-[12px] font-black leading-tight" style={{ color: n.isYou ? GOLD : "#fff" }}>{n.isYou ? "You" : n.name}</div>
            <div className="flex max-w-full items-center gap-1">
              <ClubBadge club={n.club} size={12} />
              <span className="truncate text-[10px] font-bold text-white/80">{shortClub(n.club)}</span>
            </div>
            <div className="text-[11px] font-black tabular-nums text-amber-300">{n.value} <span className="text-[9px] uppercase text-white/70">{award.unit}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WinnerLine({ career, award }: { career: CareerState; award: AwardCall }) {
  const w = award.winner;
  return (
    <div className="kib-an-name text-center" data-awards-winner={w.isYou ? "you" : "other"}>
      <div className="flex items-center justify-center gap-1.5">
        <ClubBadge club={w.isYou ? career.player.club : w.club} size={18} />
        <span className="text-[12px] font-black uppercase tracking-widest text-amber-200">{shortClub(w.club)}</span>
      </div>
      <div className="text-[36px] font-black uppercase leading-none" style={{ color: GOLD, textShadow: "0 0 22px rgba(251,191,36,.6), 0 2px 4px #000" }}>
        {w.isYou ? "You!" : w.name}
      </div>
      <div className="mt-1 text-[13px] font-black uppercase tracking-wide text-white" style={{ textShadow: "0 1px 3px #000" }}>
        {w.isYou ? `${w.name} · ` : ""}{award.label} · {w.value} {award.unit}
      </div>
    </div>
  );
}

// ── The 3D room ─────────────────────────────────────────────────────────────

function Room3D({ career, plan, kit, clock, handleRef, onReady, onFail }: {
  career: CareerState; plan: AwardsPlan; kit: Kit; clock: () => number;
  handleRef: React.MutableRefObject<AwardsSceneHandle | null>; onReady: () => void; onFail: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const you = useYouLook(career, kit);
  const badgeLook = useBadgeLook();
  const badgeOverrides = useBadgeOverrides();
  const cb = useRef({ onReady, onFail });
  cb.current = { onReady, onFail };
  useEffect(() => {
    const el = wrap.current;
    if (!el || !you) return;
    let disposed = false;
    let handle: AwardsSceneHandle | null = null;
    const limit = window.setTimeout(() => { if (!handle && !disposed) { console.warn("[awards night] 3D took too long; drawn instead"); cb.current.onFail(); } }, LOAD_LIMIT_MS);
    (async () => {
      try {
        const { createAwardsScene } = await import("@/lib/star/awardsNight3d");
        // Each winner in his club's kit (you in yours), with his club's crest on the chest.
        const kits: Record<string, { shirt: string; trim: string }> = {};
        const clubs: Record<string, string> = {};
        for (const a of plan.awards) {
          const w = a.winner;
          const club = w.isYou ? career.player.club : w.club;
          const k = w.isYou ? kit : kitsOf(club, career.clubKits?.[club]).home;
          kits[a.winnerId] = { shirt: k.shirt, trim: k.trim };
          if (club) clubs[a.winnerId] = club;
        }
        let logos: Map<string, string> | null = null;
        if (badgeLook !== "new") {
          logos = await Promise.race([
            getClubLogoMap().catch(() => null),
            new Promise<null>((r) => window.setTimeout(() => r(null), 2500)),
          ]);
        }
        const crests: Record<string, string> = {};
        for (const [id, club] of Object.entries(clubs)) crests[id] = (logos && lookupClubLogo(logos, club)) || drawnBadgeUrl(club, badgeOverrides[club]);
        const h = await createAwardsScene(el, { plan, you, kits, crests, seed: seedOf(career), seasonLabel: seasonLabelOf(career.player.startYear ?? 0, plan.season), clock });
        if (disposed) { h.dispose(); return; }
        handle = h;
        handleRef.current = h;
        window.clearTimeout(limit);
        (window as unknown as { __awardsNight3dReady?: boolean }).__awardsNight3dReady = true;
        cb.current.onReady();
      } catch (e) {
        console.warn("[awards night] 3D failed; drawn instead:", e);
        if (!disposed) cb.current.onFail();
      }
    })();
    return () => {
      disposed = true;
      window.clearTimeout(limit);
      handle?.dispose();
      handleRef.current = null;
      (window as unknown as { __awardsNight3dReady?: boolean }).__awardsNight3dReady = false;
    };
    // built once, when your look is known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [you]);
  return <div ref={wrap} className="absolute inset-0" />;
}

// ── The drawn room (a phone that can't run 3D): the same night, no canvas ──

function RoomDrawn({ career, plan, t }: { career: CareerState; plan: AwardsPlan; t: number }) {
  const a = awardAt(plan, t);
  const beat = beatAt(plan, t);
  const up = a && (beat === "walk" || beat === "moment");
  // The winner comes up from the tables to the stage over his walk.
  const k = a ? Math.max(0, Math.min(1, (t - a.walkFrom) / (a.walkTo - a.walkFrom))) : 0;
  const e = k * k * (3 - 2 * k);
  const screenTitle = !a ? "The Season Awards" : beat === "call" || beat === "nominees" || beat === "envelope" ? a.label : a.winner.name;
  const kit = a ? (a.winner.isYou ? kitsOf(career.player.club, career.clubKits?.[career.player.club]).home : kitsOf(a.winner.club).home) : null;
  return (
    <div className="absolute inset-0" data-awards-drawn style={{ background: "radial-gradient(70% 40% at 50% 30%, rgba(255,170,80,.18), transparent 70%), linear-gradient(180deg, #1a0f0a 0%, #2a1810 55%, #120a07 100%)" }}>
      {/* The bulbs overhead. */}
      <div className="absolute inset-x-0 top-[13%] h-3" style={{ background: "radial-gradient(circle, #ffd28a 0 2px, transparent 3px) 0 0 / 26px 12px repeat-x", opacity: 0.8 }} />
      {/* The screen with the award. */}
      <div className="absolute left-1/2 top-[20%] flex h-[17%] w-[74%] -translate-x-1/2 flex-col items-center justify-center px-2 text-center"
        style={{ background: "radial-gradient(circle at 50% 45%, #3a1e10, #0b0606)", boxShadow: "0 0 0 3px #0b0806, 0 0 30px rgba(255,170,80,.25)", border: "1px solid rgba(246,196,69,.5)" }}>
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">{seasonLabelOf(career.player.startYear ?? 0, plan.season)}</div>
        <div className="text-[20px] font-black uppercase leading-tight text-white">{screenTitle}</div>
      </div>
      {/* Curtains, the stage and its glowing edge. */}
      <div className="absolute left-0 top-[8%] h-[52%] w-[9%]" style={{ background: "repeating-linear-gradient(90deg, #4a0e12 0 8px, #2d070a 8px 14px)" }} />
      <div className="absolute right-0 top-[8%] h-[52%] w-[9%]" style={{ background: "repeating-linear-gradient(90deg, #4a0e12 0 8px, #2d070a 8px 14px)" }} />
      <div className="absolute inset-x-[6%] top-[52%] h-[8%]" style={{ background: "linear-gradient(180deg, #5a1418, #2a0a0c)" }} />
      <div className="absolute inset-x-[6%] top-[60%] h-[3px]" style={{ background: "#ffc46b", boxShadow: "0 0 10px #ffc46b" }} />
      {/* The lectern. */}
      <div className="absolute right-[16%] top-[42%] h-[18%] w-[13%]" style={{ background: "linear-gradient(90deg, #3a2214, #5a3820)", borderTop: "3px solid #f6c445" }} />
      {/* Round tables with lamps in the dark in front. */}
      {[[14, 74], [50, 78], [86, 74], [30, 90], [70, 90]].map(([x, y], i) => (
        <div key={i} className="absolute -translate-x-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
          <div className="mx-auto h-3 w-3 rounded-full" style={{ background: "#ffcf7a", boxShadow: "0 0 18px 6px rgba(255,160,64,.45)" }} />
          <div className="h-[22px] w-[110px] rounded-[50%]" style={{ background: "#e8dfcf", opacity: 0.85 }} />
        </div>
      ))}
      {/* The winner: up from the tables to the stage, then the trophy over his head. */}
      {up && kit && (
        <div className="absolute -translate-x-1/2 text-center" style={{ left: "42%", top: `${62 - 24 * e}%`, zIndex: 3, opacity: Math.min(1, k * 4) }} data-awards-drawn-winner>
          <div style={{ fontSize: 30, opacity: beat === "moment" ? 1 : 0, transition: "opacity .3s" }}>🏆</div>
          <Face w={a!.winner} size={64} ring={a!.winner.isYou ? GOLD : kit.trim} />
          <div className="mx-auto -mt-1 h-[38px] w-[54px]" style={{ background: kit.shirt, borderTop: `4px solid ${kit.trim}`, borderRadius: "12px 12px 2px 2px" }} />
        </div>
      )}
    </div>
  );
}
