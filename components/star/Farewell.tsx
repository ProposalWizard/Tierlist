"use client";

/**
 * THE FAREWELL MATCH — the screens around it (Leo, 6 Oct 2026, the plans
 * page: "Your farewell match. [Club] want to say goodbye." Play it or skip it).
 *
 *   FarewellInvite   after the final whistle: the two sides, Play or Skip.
 *   GuardOfHonour    the walk-out: both teams in two lines clapping, you
 *                    walking out between them (3D: lib/star/farewell3d.ts; a
 *                    drawn version for a phone that can't run 3D).
 *   FarewellResult   full time: the score, your goals, the ovation, the
 *                    testimonial; "Hang them up" opens the career overview.
 *
 * The team sheets are the real VersusScreen and the match is the real
 * CanvasMatch (app/star-dev/page.tsx). Who plays: lib/star/farewell.ts.
 * New UI only.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState, MatchStats } from "@/lib/star/types";
import type { FarewellSides } from "@/lib/star/farewell";
import { FAREWELL_OFF_AT, RIVALS_KITS, YOU_ID } from "@/lib/star/farewell";
import { testimonialFor } from "@/lib/star/retirement";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf, type Kit } from "@/lib/star/kits";
import { formatMoney } from "@/lib/star/money";
import { fakeFaceFor, DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { shortNameOf } from "@/lib/star/realSquad";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { fitImage, getFittedHead, type FittedHead } from "@/lib/star/faceFit";
import { wornAccessories } from "@/lib/star/signing3d";
import type { SigningYou } from "@/lib/star/signing3dScene";
import type { GuardSceneHandle } from "@/lib/star/farewell3d";
import type { OvationSceneHandle } from "@/lib/star/ovation3d";
import { ovationPlan, greetingCaption, type OvationPlan, type OvationPerson, type OvationStop } from "@/lib/star/ovation";
import { GUARD } from "@/lib/star/guardOfHonour";
import { playCrowdSwell } from "@/lib/star/matchSound";
import ClubBadge from "./ClubBadge";
import { signing3dBlocker } from "./SigningScene3D";
import { ScreenShell, FlatPanel, CountUp, RiseIn, BottomBar, BarButton, clubTheme, rgba } from "./ui";
import { Rays } from "./ui/Screen";

const GOLD = "#fbbf24";
const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

/** The host club's kit: your side wears it. */
function hostKit(career: CareerState, host: string): Kit {
  return kitsOf(host, career.clubKits?.[host]).home;
}

interface Chip { id: string; name: string; face?: string; badge?: string; you?: boolean }

/** The eleven of a side, as faces. */
function oursChips(career: CareerState, sides: FarewellSides): Chip[] {
  return sides.ours.lineup.xi.filter((id): id is string => !!id).map(id => {
    if (id === YOU_ID) return { id, name: "You", face: career.player.portrait ?? DEFAULT_FAKE_FACE, you: true };
    const p = sides.ours.players.find(x => x.id === id);
    return { id, name: p ? (p.shortName || shortNameOf(p.name)) : "—", face: p?.imageUrl };
  });
}
function rivalChips(sides: FarewellSides): Chip[] {
  return sides.rivals.lineup.xi.filter((id): id is string => !!id).map(id => {
    const r = sides.rivals.who.find(x => x.id === id);
    return { id, name: r ? shortNameOf(r.name) : "—", face: r?.face, badge: r?.ballonDor ? "🏅" : undefined };
  });
}

function FaceChip({ chip, kit, size = 42 }: { chip: Chip; kit: Kit; size?: number }) {
  const fallback = fakeFaceFor(chip.id);
  return (
    <div className="flex min-w-0 flex-col items-center" data-farewell-chip={chip.you ? "you" : chip.id}>
      <div
        className="relative overflow-hidden rounded-full"
        style={{ width: size, height: size, background: kit.shirt, boxShadow: chip.you ? `0 0 0 2px ${GOLD}, 0 0 12px ${rgba(GOLD, 0.7)}` : `inset 0 0 0 2px ${kit.trim}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={chip.face || fallback}
          alt=""
          className="h-full w-full object-cover object-top"
          onError={e => { if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback; }}
        />
        {chip.badge && <span className="absolute bottom-0 right-0 text-[13px] leading-none" style={{ filter: "drop-shadow(0 1px 1px #000)" }} aria-hidden>{chip.badge}</span>}
      </div>
      <div className={`mt-0.5 w-full truncate text-center text-[9.5px] font-black uppercase leading-tight ${chip.you ? "text-amber-200" : "text-white/90"}`}>{chip.name}</div>
    </div>
  );
}

function SideRow({ title, kit, chips, badgeClub }: { title: string; kit: Kit; chips: Chip[]; badgeClub?: string }) {
  return (
    <FlatPanel bleed fade="none" edge className="mt-2 px-2.5 py-2.5 text-left">
      <div className="mb-2 flex items-center gap-2">
        {badgeClub
          ? <ClubBadge club={badgeClub} kit={kit} size={22} />
          : <span className="grid h-[22px] w-[22px] place-items-center text-[10px] font-black" style={{ background: kit.shirt, color: kit.trim, boxShadow: `inset 0 0 0 2px ${kit.trim}`, borderRadius: 2 }}>XI</span>}
        <div className="text-[14px] font-black uppercase tracking-wide text-white">{title}</div>
      </div>
      <div className="grid grid-cols-6 gap-x-1 gap-y-1.5">
        {chips.map(c => <FaceChip key={c.id} chip={c} kit={kit} />)}
      </div>
    </FlatPanel>
  );
}

/** After the final whistle: your farewell match. Play it or skip it. */
export function FarewellInvite({ career, sides, onPlay, onSkip }: {
  career: CareerState; sides: FarewellSides; onPlay: () => void; onSkip: () => void;
}) {
  const host = sides.host;
  const glow = clubTheme(host).glow;
  const ours = hostKit(career, host);
  // Why the rivals are here: who beat you to a Ballon d'Or, and which clubs
  // beat you to titles — only men in the eleven, two of each at most.
  const why = useMemo(() => {
    const xi = new Set(sides.rivals.lineup.xi.filter((id): id is string => !!id));
    const starters = sides.rivals.who.filter(r => xi.has(r.id));
    const golden = starters.filter(r => r.ballonDor).slice(0, 2).map(r => `🏅 ${shortNameOf(r.name)} · ${r.why}`);
    const clubs: string[] = [];
    const seen = new Set<string>();
    for (const r of starters) {
      if (r.ballonDor || seen.has(r.club) || r.why === "One of the best around" || r.why === "A rival") continue;
      seen.add(r.club);
      clubs.push(`🏆 ${short(r.club)} · ${r.why}`);
    }
    return [...golden, ...clubs.slice(0, 2)];
  }, [sides]);
  return (
    <ScreenShell
      glow={glow}
      title=""
      bare
      tone="calm"
      bottomBar={(
        <BottomBar cols="1fr 1.6fr">
          <BarButton icon="⏭" label="Skip" onClick={onSkip} />
          <BarButton icon="▶" label="Play it" onClick={onPlay} primary />
        </BottomBar>
      )}
    >
      <div className="px-1 pb-6 pt-4 text-center" data-farewell-invite>
        <RiseIn>
          <span className="inline-block px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-amber-200" style={{ background: "rgba(251,191,36,.14)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.4)", borderRadius: 2 }}>
            One last game
          </span>
        </RiseIn>
        <RiseIn index={1}>
          <div className="relative mx-auto mt-3 grid h-[104px] place-items-center">
            <Rays color="#fde68a" size={240} />
            <h1 className="relative text-[40px] uppercase leading-[0.95] text-white" style={{ filter: "drop-shadow(0 3px 10px rgba(0,0,0,.7))" }}>
              Your farewell<br /><span className="text-amber-300">match</span>
            </h1>
          </div>
        </RiseIn>
        <RiseIn index={2}>
          <div className="mt-2 flex items-center justify-center gap-2 text-[15px] font-bold text-white">
            <ClubBadge club={host} kit={ours} size={24} />
            <span>{short(host)} want to say goodbye.</span>
          </div>
        </RiseIn>
        <RiseIn index={3}>
          <SideRow title={sides.ours.name} kit={ours} chips={oursChips(career, sides)} badgeClub={host} />
        </RiseIn>
        <RiseIn index={4}>
          <SideRow title={sides.rivals.name} kit={RIVALS_KITS.home} chips={rivalChips(sides)} />
          {why.length > 0 && (
            <div className="mt-1.5 space-y-1 text-left" data-farewell-why>
              {why.map(w => <div key={w} className="truncate px-1 text-[11.5px] font-bold text-white/90">{w}</div>)}
            </div>
          )}
        </RiseIn>
        <RiseIn index={5}>
          <div className="mt-3 grid grid-cols-3 gap-1.5" data-farewell-rules>
            {[
              { icon: "⚽", text: "Every chance is yours" },
              { icon: "⚡", text: "No energy" },
              { icon: "👏", text: `Off at ${FAREWELL_OFF_AT}'` },
            ].map(r => (
              <div key={r.text} className="px-1 py-2" style={{ background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}>
                <div className="text-[18px] leading-none">{r.icon}</div>
                <div className="mt-1 text-[10px] font-black uppercase leading-tight tracking-wide text-white/90">{r.text}</div>
              </div>
            ))}
          </div>
        </RiseIn>
      </div>
    </ScreenShell>
  );
}

/** Full time: the score, your afternoon, the testimonial. */
export function FarewellResult({ career, sides, stats, onDone }: {
  career: CareerState; sides: FarewellSides; stats: MatchStats; onDone: () => void;
}) {
  const host = sides.host;
  const glow = clubTheme(host).glow;
  const ours = hostKit(career, host);
  const t = testimonialFor(career);
  const us = stats.homeScore, them = stats.awayScore;
  const verdict = us > them ? "A win to finish" : us === them ? "All square" : "The rivals spoil it";
  // Who scored, by the minute: yours on the left, theirs on the right.
  const oursGoals = [...(stats.goalEvents ?? [])].sort((a, b) => a.minute - b.minute)
    .map(g => ({ you: g.isUserGoal, text: `${g.minute}' ${g.isUserGoal ? "You" : shortNameOf(g.scorer)}` }));
  const theirGoals = [...(stats.oppGoalEvents ?? [])].sort((a, b) => a.minute - b.minute)
    .map(g => `${g.minute}' ${shortNameOf(g.scorer)}`);
  useEffect(() => { playCrowdSwell("cheer"); }, []);
  return (
    <ScreenShell
      glow={glow}
      title=""
      bare
      tone="calm"
      bottomBar={(
        <BottomBar>
          <BarButton icon="🥾" label="Hang them up" onClick={onDone} primary />
        </BottomBar>
      )}
    >
      <div className="flex min-h-[calc(100dvh-120px)] flex-col justify-center px-1 py-6 text-center" data-farewell-result>
        <RiseIn>
          <span className="inline-block px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-amber-200" style={{ background: "rgba(251,191,36,.14)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.4)", borderRadius: 2 }}>
            Full time · Farewell
          </span>
        </RiseIn>
        <RiseIn index={1}>
          <FlatPanel bleed fade="none" edge className="mt-4 px-3 py-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex min-w-0 flex-col items-center gap-1">
                <ClubBadge club={host} kit={ours} size={40} />
                <div className="w-full truncate text-[12px] font-black uppercase text-white">{sides.ours.name}</div>
              </div>
              <div className="sk-num text-[44px] leading-none tabular-nums text-white" data-farewell-score>
                {us}<span className="mx-1.5 text-white/50">–</span>{them}
              </div>
              <div className="flex min-w-0 flex-col items-center gap-1">
                <span className="grid h-[40px] w-[40px] place-items-center text-[13px] font-black" style={{ background: RIVALS_KITS.home.shirt, color: RIVALS_KITS.home.trim, boxShadow: `inset 0 0 0 2px ${RIVALS_KITS.home.trim}`, borderRadius: 3 }}>XI</span>
                <div className="w-full truncate text-[12px] font-black uppercase text-white">{sides.rivals.name}</div>
              </div>
            </div>
            {(oursGoals.length > 0 || theirGoals.length > 0) && (
              <div className="mt-3 grid grid-cols-2 gap-4 text-[11.5px] font-bold leading-snug" data-farewell-scorers>
                <div className="space-y-0.5 text-right">
                  {oursGoals.map((g, i) => <div key={i} className={g.you ? "text-amber-200" : "text-white/90"}>{g.text} ⚽</div>)}
                </div>
                <div className="space-y-0.5 text-left text-white/90">
                  {theirGoals.map((g, i) => <div key={i}>⚽ {g}</div>)}
                </div>
              </div>
            )}
            <div className="mt-3 text-[13px] font-black uppercase tracking-wide text-amber-200">{verdict}</div>
          </FlatPanel>
        </RiseIn>
        <RiseIn index={2}>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {[
              { label: "Goals", value: stats.goals },
              { label: "Assists", value: stats.assists },
              { label: "Rating", value: Math.round((stats.rating ?? 0) * 10) / 10, decimals: 1 },
            ].map(n => (
              <div key={n.label} className="px-1 py-2" style={{ background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
                <div className="sk-num text-[26px] leading-none tabular-nums text-white">
                  {n.decimals ? n.value.toFixed(1) : <CountUp value={n.value} ms={900} />}
                </div>
                <div className="mt-1 text-[9.5px] font-black uppercase tracking-wider text-white/70">{n.label}</div>
              </div>
            ))}
          </div>
        </RiseIn>
        <RiseIn index={3}>
          <div className="mt-2 flex items-center gap-2.5 px-2.5 py-2 text-left" style={{ background: `linear-gradient(90deg, ${rgba(GOLD, 0.22)}, rgba(255,255,255,.03))`, boxShadow: "inset 0 0 0 1px rgba(251,191,36,.4)" }} data-farewell-ovation-line>
            <span className="text-[22px] leading-none">👏</span>
            <div className="min-w-0 flex-1 text-[12.5px] font-bold text-white">Off at {FAREWELL_OFF_AT}&apos; to a standing ovation</div>
          </div>
        </RiseIn>
        {t && (
          <RiseIn index={4}>
            <div className="mt-2 flex items-center gap-2.5 px-2.5 py-2 text-left" style={{ background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }} data-farewell-testimonial>
              <ClubBadge club={t.club} kit={kitsOf(t.club).home} size={26} />
              <div className="min-w-0 flex-1 text-[12.5px] font-bold text-white">{short(t.club)} pay your testimonial</div>
              <div className="sk-num shrink-0 text-[18px] leading-none text-amber-200">★{formatMoney(t.payout)}</div>
            </div>
          </RiseIn>
        )}
      </div>
    </ScreenShell>
  );
}

// ── The walk-out ───────────────────────────────────────────────────────────

/** Your look for the 3D people (the 3D office does the same). */
function useYouLook(career: CareerState, kit: Kit): SigningYou | null {
  const faceUrl = career.player.portrait ?? DEFAULT_FAKE_FACE;
  const [fitted, setFitted] = useState<FittedHead | null | undefined>(undefined);
  useEffect(() => {
    const img = fitImage(faceUrl);
    const done = () => setFitted(getFittedHead(faceUrl));
    if (img.complete && img.naturalWidth) { done(); return; }
    if (img.complete) { setFitted(null); return; }
    const slow = window.setTimeout(() => setFitted(f => (f === undefined ? null : f)), 4000);
    const bad = () => setFitted(null);
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", bad, { once: true });
    return () => { window.clearTimeout(slow); img.removeEventListener("load", done); img.removeEventListener("error", bad); };
  }, [faceUrl]);
  return useMemo(() => (fitted === undefined ? null : {
    skin: skinToneHex(career.player.skinTone),
    face: fitted ?? null,
    accessories: wornAccessories(career.equippedAccessories),
    kit,
    number: career.squadNumber ?? null,
    hairStyle: resolveHairStyle(career.player.hairStyle),
    hair: hairColourHex(career.player.hairColour),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [fitted, kit.shirt, kit.trim]);
}

/** The longest the 3D may take to load before the drawn walk-out takes over. */
const LOAD_LIMIT_MS = 20000;

/**
 * Both teams in two lines, clapping; you walk out between them. 3D when the
 * phone can run it, the drawn version when it can't. Tap Skip any time.
 */
export function GuardOfHonour({ career, sides, onDone, drawn = false }: {
  career: CareerState; sides: FarewellSides; onDone: () => void;
  /** The test page: show the drawn version whatever the phone can do. */
  drawn?: boolean;
}) {
  const [mode, setMode] = useState<"3d" | "drawn">(() => (drawn || (typeof window !== "undefined" && signing3dBlocker()) ? "drawn" : "3d"));
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);
  const finish = () => { if (!finished.current) { finished.current = true; doneRef.current(); } };
  useEffect(() => { playCrowdSwell("cheer"); }, []);
  const kit = hostKit(career, sides.host);
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#0a1426] text-white" data-guard-of-honour={mode}>
      {mode === "3d"
        ? <Guard3D career={career} sides={sides} kit={kit} onDone={finish} onFail={() => setMode("drawn")} />
        : <GuardDrawn career={career} sides={sides} kit={kit} onDone={finish} />}
      {/* The words over it, either way. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-5 text-center" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.55), transparent)" }}>
        <div className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-200">The farewell</div>
        <h1 className="text-[30px] uppercase leading-none text-white" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}>Guard of honour</h1>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[86px] z-10 flex justify-between px-3 text-[11px] font-black uppercase tracking-wide">
        <span className="px-1.5 py-0.5" style={{ background: "rgba(17,24,39,.8)", color: RIVALS_KITS.home.trim, borderRadius: 2 }}>{sides.rivals.name}</span>
        <span className="px-1.5 py-0.5" style={{ background: rgba(kit.shirt, 0.85), color: "#fff", textShadow: "0 1px 2px #000", borderRadius: 2 }}>{sides.ours.name}</span>
      </div>
      <button
        onClick={finish}
        className="kib-press absolute bottom-[calc(18px+env(safe-area-inset-bottom))] right-4 z-20 px-4 py-2.5 text-[13px] font-black uppercase tracking-wide text-gray-950"
        style={{ background: "linear-gradient(180deg, #fde047, #f59e0b)", borderRadius: 2 }}
        data-guard-skip
      >
        Kick off ›
      </button>
    </div>
  );
}

function Guard3D({ career, sides, kit, onDone, onFail }: { career: CareerState; sides: FarewellSides; kit: Kit; onDone: () => void; onFail: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const you = useYouLook(career, kit);
  const [ready, setReady] = useState(false);
  const cb = useRef({ onDone, onFail });
  cb.current = { onDone, onFail };
  useEffect(() => {
    const el = wrap.current;
    if (!el || !you) return;
    let disposed = false;
    let handle: GuardSceneHandle | null = null;
    const limit = window.setTimeout(() => { if (!handle && !disposed) { console.warn("[guard of honour] 3D took too long; drawn instead"); cb.current.onFail(); } }, LOAD_LIMIT_MS);
    (async () => {
      try {
        const { createGuardScene } = await import("@/lib/star/farewell3d");
        const h = await createGuardScene(el, {
          you, ours: kit, rivals: RIVALS_KITS.home,
          seed: (career.player.startYear ?? 0) * 31 + career.season,
          onDone: () => cb.current.onDone(),
        });
        if (disposed) { h.dispose(); return; }
        handle = h;
        window.clearTimeout(limit);
        (window as unknown as { __guard3d?: GuardSceneHandle; __guard3dReady?: boolean }).__guard3d = h;
        (window as unknown as { __guard3dReady?: boolean }).__guard3dReady = true;
        setReady(true);
      } catch (e) {
        console.warn("[guard of honour] 3D failed; drawn instead:", e);
        if (!disposed) cb.current.onFail();
      }
    })();
    return () => {
      disposed = true;
      window.clearTimeout(limit);
      handle?.dispose();
      (window as unknown as { __guard3dReady?: boolean }).__guard3dReady = false;
    };
    // built once, when your look is known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [you]);
  return (
    <>
      <div ref={wrap} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-[12px] font-black uppercase tracking-wider text-white/70">Walking out…</div>
      )}
    </>
  );
}

/** The drawn walk-out: two lines of faces clapping, you coming down the middle. No canvas. */
function GuardDrawn({ career, sides, kit, onDone }: { career: CareerState; sides: FarewellSides; kit: Kit; onDone: () => void }) {
  const ours = oursChips(career, sides).filter(c => !c.you).slice(0, 6);
  const rivals = rivalChips(sides).slice(0, 6);
  const me: Chip = { id: YOU_ID, name: career.player.lastName, face: career.player.portrait ?? DEFAULT_FAKE_FACE, you: true };
  useEffect(() => {
    const t = window.setTimeout(onDone, 6500);
    return () => window.clearTimeout(t);
  }, [onDone]);
  const line = (chips: Chip[], k: Kit, side: "l" | "r") => (
    <div className="flex flex-col justify-center gap-3">
      {chips.map((c, i) => (
        <div key={c.id} className={`flex items-center gap-1 ${side === "r" ? "flex-row-reverse" : ""}`}>
          <div className="w-[52px]"><FaceChip chip={c} kit={k} size={40} /></div>
          <span className="kib-clap text-[20px] leading-none" style={{ animationDelay: `${(i * 0.13) % 0.5}s` }} aria-hidden>👏</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="absolute inset-0" style={{ background: "radial-gradient(70% 50% at 50% 30%, rgba(255,250,230,.16), transparent 70%), linear-gradient(180deg, #0a1426 0%, #12391f 55%, #1d5c2f 100%)" }} data-guard-drawn>
      <style>{`
        @keyframes kibClap { 0%, 100% { transform: scale(1) rotate(-6deg); } 50% { transform: scale(1.3) rotate(8deg); } }
        @keyframes kibWalkOut { from { transform: translate(-50%, -30vh) scale(.7); opacity: .2; } 15% { opacity: 1; } to { transform: translate(-50%, 18vh) scale(1.15); opacity: 1; } }
        .kib-clap { display: inline-block; animation: kibClap .45s ease-in-out infinite; }
        .kib-walkout { animation: kibWalkOut ${Math.round((GUARD.walkTo - GUARD.walkFrom) * 700)}ms ease-in-out .3s both; }
        @media (prefers-reduced-motion: reduce) { .kib-clap, .kib-walkout { animation: none; } }
      `}</style>
      <div className="absolute inset-x-0 top-[120px] bottom-[90px] flex justify-between px-3">
        {line(rivals, RIVALS_KITS.home, "l")}
        {line(ours, kit, "r")}
      </div>
      <div className="kib-walkout absolute left-1/2 top-1/2 w-[64px]">
        <FaceChip chip={me} kit={kit} size={56} />
      </div>
    </div>
  );
}

// ── The standing ovation (Mikey, 8 Oct 2026) ────────────────────────────────

/** Who stops you on the way off: two team-mates, two rivals, the substitute. */
export function ovationPlanFor(career: CareerState, sides: FarewellSides): OvationPlan {
  const name = (n: string) => shortNameOf(n);
  const xi = new Set(sides.ours.lineup.xi.filter((id): id is string => !!id && id !== YOU_ID));
  const mates: OvationPerson[] = sides.ours.players
    .filter(p => xi.has(p.id))
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, 2)
    .map(p => ({ id: p.id, name: p.shortName || name(p.name), team: "ours" }));
  const rivalXI = new Set(sides.rivals.lineup.xi.filter((id): id is string => !!id));
  const rivals: OvationPerson[] = sides.rivals.who
    .filter(r => rivalXI.has(r.id))
    .sort((a, b) => Number(!!b.ballonDor) - Number(!!a.ballonDor) || (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, 2)
    .map(r => ({ id: r.id, name: name(r.name), team: "rivals" }));
  const subId = (sides.ours.lineup.bench ?? []).find(id => id && id !== YOU_ID && !mates.some(m => m.id === id));
  const subP = subId ? sides.ours.players.find(p => p.id === subId) : undefined;
  const sub: OvationPerson | null = subP ? { id: subP.id, name: subP.shortName || name(subP.name), team: "ours" } : null;
  return ovationPlan(mates, rivals, sub);
}

/**
 * Off at 85': the camera circles you, the ground stands, team-mates and
 * rivals stop you for a hug or a dap-up, the substitute hugs you on the line.
 * 3D when the phone can run it, a drawn version when it can't. Skip any time.
 */
export function StandingOvation({ career, sides, minute, onDone, drawn = false }: {
  career: CareerState; sides: FarewellSides; minute: number; onDone: () => void;
  /** The test page: the drawn version whatever the phone can do. */
  drawn?: boolean;
}) {
  const [mode, setMode] = useState<"3d" | "drawn">(() => (drawn || (typeof window !== "undefined" && signing3dBlocker()) ? "drawn" : "3d"));
  const plan = useMemo(() => ovationPlanFor(career, sides), [career, sides]);
  const [caption, setCaption] = useState<string | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);
  const finish = () => { if (!finished.current) { finished.current = true; doneRef.current(); } };
  useEffect(() => { playCrowdSwell("cheer"); }, []);
  const kit = hostKit(career, sides.host);
  const onStop = (s: OvationStop | null) => setCaption(s ? greetingCaption(s) : null);
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#0a1426] text-white" data-standing-ovation={mode}>
      {mode === "3d"
        ? <Ovation3D career={career} kit={kit} plan={plan} onStop={onStop} onDone={finish} onFail={() => setMode("drawn")} />
        : <OvationDrawn career={career} sides={sides} kit={kit} plan={plan} onStop={onStop} onDone={finish} />}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-5 text-center" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.55), transparent)" }}>
        <div className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-200">{minute}&apos; · You come off</div>
        <h1 className="text-[30px] uppercase leading-none text-white" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}>Standing ovation</h1>
        <div className="mt-1 text-[12px] font-bold text-white/90">{career.player.firstName} {career.player.lastName}</div>
      </div>
      {caption && (
        <div className="pointer-events-none absolute inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 text-center" data-ovation-caption>
          <span className="inline-block px-3 py-1.5 text-[13px] font-black text-white" style={{ background: "rgba(10,20,38,.82)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.55)", borderRadius: 2 }}>{caption}</span>
        </div>
      )}
      <button
        onClick={finish}
        className="kib-press absolute bottom-[calc(18px+env(safe-area-inset-bottom))] right-4 z-20 px-4 py-2.5 text-[13px] font-black uppercase tracking-wide text-gray-950"
        style={{ background: "linear-gradient(180deg, #fde047, #f59e0b)", borderRadius: 2 }}
        data-ovation-skip
      >
        Skip ›
      </button>
    </div>
  );
}

function Ovation3D({ career, kit, plan, onStop, onDone, onFail }: {
  career: CareerState; kit: Kit; plan: OvationPlan; onStop: (s: OvationStop | null) => void; onDone: () => void; onFail: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const you = useYouLook(career, kit);
  const [ready, setReady] = useState(false);
  const cb = useRef({ onDone, onFail, onStop });
  cb.current = { onDone, onFail, onStop };
  useEffect(() => {
    const el = wrap.current;
    if (!el || !you) return;
    let disposed = false;
    let handle: OvationSceneHandle | null = null;
    const limit = window.setTimeout(() => { if (!handle && !disposed) { console.warn("[ovation] 3D took too long; drawn instead"); cb.current.onFail(); } }, LOAD_LIMIT_MS);
    (async () => {
      try {
        const { createOvationScene } = await import("@/lib/star/ovation3d");
        const h = await createOvationScene(el, {
          you, ours: kit, rivals: RIVALS_KITS.home, plan,
          seed: (career.player.startYear ?? 0) * 37 + career.season,
          onDone: () => cb.current.onDone(),
          onStop: (s) => cb.current.onStop(s),
        });
        if (disposed) { h.dispose(); return; }
        handle = h;
        window.clearTimeout(limit);
        (window as unknown as { __ovation3d?: OvationSceneHandle; __ovation3dReady?: boolean }).__ovation3d = h;
        (window as unknown as { __ovation3dReady?: boolean }).__ovation3dReady = true;
        setReady(true);
      } catch (e) {
        console.warn("[ovation] 3D failed; drawn instead:", e);
        if (!disposed) cb.current.onFail();
      }
    })();
    return () => {
      disposed = true;
      window.clearTimeout(limit);
      handle?.dispose();
      (window as unknown as { __ovation3dReady?: boolean }).__ovation3dReady = false;
    };
    // built once, when your look is known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [you]);
  return (
    <>
      <div ref={wrap} className="absolute inset-0" />
      {!ready && <div className="absolute inset-0 grid place-items-center text-[12px] font-black uppercase tracking-wider text-white/70">The ground rises…</div>}
    </>
  );
}

/** The drawn ovation: you in the middle, each well-wisher in turn, the stands clapping. No canvas. */
function OvationDrawn({ career, sides, kit, plan, onStop, onDone }: {
  career: CareerState; sides: FarewellSides; kit: Kit; plan: OvationPlan; onStop: (s: OvationStop | null) => void; onDone: () => void;
}) {
  const [i, setI] = useState(-1);
  const stops = plan.stops;
  const cb = useRef({ onStop, onDone });
  cb.current = { onStop, onDone };
  useEffect(() => {
    // Each greeting about 1.5 s, then off.
    const timers = stops.map((_, k) => window.setTimeout(() => { setI(k); cb.current.onStop(stops[k]); }, 900 + k * 1500));
    timers.push(window.setTimeout(() => cb.current.onDone(), 900 + stops.length * 1500 + 1300));
    return () => timers.forEach(t => window.clearTimeout(t));
  }, [stops]);
  const me: Chip = { id: YOU_ID, name: career.player.lastName, face: career.player.portrait ?? DEFAULT_FAKE_FACE, you: true };
  const s = i >= 0 ? stops[i] : null;
  const other: Chip | null = s ? {
    id: s.who.id, name: s.who.name,
    face: s.who.team === "rivals" ? sides.rivals.who.find(r => r.id === s.who.id)?.face : sides.ours.players.find(p => p.id === s.who.id)?.imageUrl,
  } : null;
  const icon = s ? (s.kind === "hug" ? "🫂" : s.kind === "dap" ? "🤜🤛" : "🤝") : "👏";
  return (
    <div className="absolute inset-0" style={{ background: "radial-gradient(70% 50% at 50% 30%, rgba(255,250,230,.16), transparent 70%), linear-gradient(180deg, #0a1426 0%, #12391f 55%, #1d5c2f 100%)" }} data-ovation-drawn>
      <style>{`
        @keyframes kibCrowd { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .kib-crowd span { display: inline-block; animation: kibCrowd .4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .kib-crowd span { animation: none; } }
      `}</style>
      <div className="kib-crowd absolute inset-x-0 top-[118px] text-center text-[18px] leading-tight" aria-hidden>
        {Array.from({ length: 3 }).map((_, r) => (
          <div key={r}>{Array.from({ length: 9 }).map((__, c) => <span key={c} style={{ animationDelay: `${((r * 9 + c) * 0.07) % 0.4}s` }}>👏</span>)}</div>
        ))}
      </div>
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-4">
        <div className="w-[72px]"><FaceChip chip={me} kit={kit} size={64} /></div>
        <div className="text-[34px]" aria-hidden>{icon}</div>
        <div className="w-[72px]">{other && <FaceChip key={other.id} chip={other} kit={s?.who.team === "rivals" ? RIVALS_KITS.home : kit} size={64} />}</div>
      </div>
    </div>
  );
}
