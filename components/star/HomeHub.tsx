"use client";

/**
 * THE MIDDLE HOME SCREEN — the best-looking screen in the game.
 *
 * Harry, 28 Sep 2026: "The home screen should look the best, and right now it
 * doesn't." Top to bottom, as he laid it out:
 *   1. the next match — both crests big, a styled "vs", the date and how many
 *      days away — with your last five results underneath it;
 *   2. you, centred and big, in the club kit, under floodlights, with your
 *      name, crest, number, position and three polished pills (rating,
 *      money, age);
 *   3. energy and the KIB cans — the real can pictures, lit in their own
 *      colours, with Use and Buy;
 *   4. your shop items.
 * Every card is themed in your club's colours. Motion (HomeFx.tsx): cards
 * rise in when Home opens, numbers count, a used can shakes and empties into
 * the energy bar, and the avatar breathes and celebrates a win. All of it
 * stops for a phone set to reduce motion.
 *
 * The stats/contract card lives on the screen to the left, the shop on the
 * one to the right (SwipePages, page.tsx).
 */
import { useEffect, useRef, useState } from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, type KibCan } from "@/lib/star/shopData";
import { kitsOf } from "@/lib/star/kits";
import { formatMoney } from "@/lib/star/money";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { divisionOf, leagueNameFor, fixtureTimestamp } from "@/lib/star/calendar";
import { rgba, tint, luminance } from "@/lib/star/heroFigure";
import ClubBadge from "./ClubBadge";
import KibCanIcon from "./KibCanIcon";
import PlayerAvatar, { useAvatarStyle } from "./PlayerAvatar";
import ShopItemsCard from "./ShopItemsCard";
import { useCountUp, prefersReducedMotion } from "./HomeFx";

const ACCENT: Record<KibCan["id"], string> = { basic: "#fb923c", premium: "#60a5fa", elite: "#c084fc" };
const POS_NAME: Record<string, string> = { ST: "Striker", CAM: "Attacking Mid", LW: "Left Wing", RW: "Right Wing", CM: "Central Mid" };

export type HubPhase = "store" | "shop-kib" | "shop-boots" | "shop-lifestyle" | "casino-menu" | "sponsors" | "achievements" | "trophies" | "ownership" | "garden";

interface Props {
  career: CareerState;
  nextFixture: Fixture | null;
  /** "Sat 6 Sep" — see calendar.ts. */
  nextMatchDate?: string;
  /** Your side's name for this fixture — your club, or your country. */
  myTeam: string;
  onUseCan: (id: KibCan["id"]) => void;
  onBuyCan: (can: KibCan) => void;
  onOpen: (phase: HubPhase) => void;
}

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
/** A shirt colour that can light a dark card: very dark kits (black, navy)
 *  are lifted so the glow still shows; white kits fall back to their trim. */
function glowOf(shirt: string, trim: string): string {
  const base = luminance(shirt) > 0.85 ? trim : shirt;
  return luminance(base) < 0.12 ? tint(base, 0.35) : base;
}

interface FormResult { res: "W" | "D" | "L"; us: number; them: number; opp: string; rating?: number; week: number }
export function lastFive(career: CareerState): FormResult[] {
  return career.fixtures
    .filter((f) => f.played && f.homeScore !== undefined && f.awayScore !== undefined)
    .sort((a, b) => a.week - b.week)
    .slice(-5)
    .map((f) => {
      const us = f.home ? f.homeScore! : f.awayScore!, them = f.home ? f.awayScore! : f.homeScore!;
      return { res: us > them ? "W" : us === them ? "D" : "L", us, them, opp: f.opponent, rating: f.userRating, week: f.week };
    });
}

/** Days from "today" to the next match. The game has no clock of its own, so
 *  today is the day after your last match (or five days out before the
 *  first one) — which is what the week in between actually is. */
function daysToNext(career: CareerState, next: Fixture): number {
  const div = divisionOf(career);
  const ts = (f: Fixture) => fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, div);
  const played = career.fixtures.filter((f) => f.played);
  const nextTs = ts(next);
  const lastTs = played.length ? Math.max(...played.map(ts).filter((t) => t <= nextTs)) : nextTs - 5 * 86400000;
  const today = Number.isFinite(lastTs) ? lastTs + 86400000 : nextTs - 5 * 86400000;
  return Math.max(0, Math.round((nextTs - today) / 86400000));
}

/** The card look every home card shares: club-tinted glass, layered shadow,
 *  a soft highlight along the top edge. */
function cardStyle(glow: string, strength = 0.28): React.CSSProperties {
  return {
    background: `radial-gradient(120% 140% at 0% 0%, ${rgba(glow, strength)} 0%, transparent 55%), linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,17,28,.96))`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px ${rgba(glow, 0.22)}, 0 10px 24px -12px rgba(0,0,0,.8), 0 2px 6px rgba(0,0,0,.35)`,
  };
}

export default function HomeHub(p: Props) {
  const { career } = p;
  const kit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  const glow = glowOf(kit.shirt, kit.trim);
  const rise = (i: number): React.CSSProperties => ({ animationDelay: `${i * 80}ms` });
  return (
    <div className="space-y-2.5 pb-3">
      <div className="kib-rise" style={rise(0)}><NextMatchCard {...p} glow={glow} /></div>
      <div className="kib-rise" style={rise(1)}><Hero {...p} glow={glow} kitShirt={kit.shirt} kitTrim={kit.trim} /></div>
      <div className="kib-rise" style={rise(2)}><Energy {...p} glow={glow} /></div>
      <div className="kib-rise" style={rise(3)}>
        <ShopItemsCard career={career} onOpenShop={() => p.onOpen("shop-kib")} showCans={false} glow={glow} />
      </div>
    </div>
  );
}

// ── 1. Next match + last five ───────────────────────────────────────────────

function NextMatchCard({ career, nextFixture, nextMatchDate, myTeam, glow }: Props & { glow: string }) {
  const five = lastFive(career);
  if (!nextFixture) {
    return (
      <div className="rounded-2xl p-3 text-center" style={cardStyle(glow)}>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Season complete</div>
        <div className="mt-0.5 text-[12px] font-bold text-white/80">Every fixture is played — the awards are next.</div>
        <LastFive five={five} />
      </div>
    );
  }
  const home = nextFixture.home ? myTeam : nextFixture.opponent;
  const away = nextFixture.home ? nextFixture.opponent : myTeam;
  const homeKit = kitsOf(home, career.clubKits?.[home]).home;
  const awayKit = kitsOf(away, career.clubKits?.[away]).home;
  const comp = nextFixture.competition ?? leagueNameFor(divisionOf(career));
  const days = daysToNext(career, nextFixture);
  const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`;
  const hg = glowOf(homeKit.shirt, homeKit.trim), ag = glowOf(awayKit.shirt, awayKit.trim);
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: `radial-gradient(90% 120% at 0% 50%, ${rgba(hg, 0.42)} 0%, transparent 58%), radial-gradient(90% 120% at 100% 50%, ${rgba(ag, 0.42)} 0%, transparent 58%), linear-gradient(180deg, #172033, #0a0f1a)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.08), 0 12px 26px -14px rgba(0,0,0,.9), 0 2px 6px rgba(0,0,0,.35)`,
      }}
    >
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300 ring-1 ring-emerald-300/30">Next match</span>
        <span className="truncate pl-2 text-[10px] font-black uppercase tracking-wider text-white/60">{comp}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 pb-1.5 pt-1">
        <TeamSide club={home} kitShirt={homeKit.shirt} kitTrim={homeKit.trim} you={home === myTeam} />
        <div className="flex flex-col items-center px-1">
          <span
            className="bg-gradient-to-b from-white to-white/50 bg-clip-text text-[26px] font-black italic leading-none tracking-tighter text-transparent"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.6))" }}
          >VS</span>
          <span className="mt-1 whitespace-nowrap text-[11px] font-black text-white">{nextMatchDate ?? `Week ${nextFixture.week}`}</span>
          <span className={`mt-0.5 whitespace-nowrap rounded-full px-2 py-[1px] text-[10px] font-black ${days <= 1 ? "bg-amber-400 text-gray-950" : "bg-white/12 text-amber-200 ring-1 ring-white/15"}`}>
            ⏱ {when}
          </span>
        </div>
        <TeamSide club={away} kitShirt={awayKit.shirt} kitTrim={awayKit.trim} you={away === myTeam} />
      </div>
      <div className="border-t border-white/10 bg-black/25 px-2.5 pb-2 pt-1.5">
        <LastFive five={five} />
      </div>
    </div>
  );
}

function TeamSide({ club, kitShirt, kitTrim, you }: { club: string; kitShirt: string; kitTrim: string; you: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="relative grid h-[50px] w-[50px] place-items-center">
        <div className="absolute inset-1 rounded-full blur-md" style={{ background: rgba(glowOf(kitShirt, kitTrim), 0.55) }} />
        <div className="relative" style={{ filter: "drop-shadow(0 3px 5px rgba(0,0,0,.55))" }}>
          <ClubBadge club={club} kit={{ shirt: kitShirt, trim: kitTrim }} size={44} />
        </div>
      </div>
      <div className="mt-0.5 w-full truncate text-center text-[12px] font-black text-white">{short(club)}</div>
      {you && <div className="text-[8.5px] font-black uppercase tracking-widest text-emerald-300">You</div>}
    </div>
  );
}

function LastFive({ five }: { five: FormResult[] }) {
  const tone = {
    W: "from-emerald-400 to-emerald-600 shadow-emerald-900/60",
    D: "from-gray-400 to-gray-600 shadow-black/40",
    L: "from-red-500 to-red-700 shadow-red-950/60",
  } as const;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/55">Last 5</span>
        {five.some((f) => f.rating !== undefined) && (
          <span className="text-[9px] font-black text-white/45">
            avg rating <span className="text-amber-300">{(five.filter((f) => f.rating !== undefined).reduce((s, f) => s + (f.rating ?? 0), 0) / five.filter((f) => f.rating !== undefined).length).toFixed(1)}</span>
          </span>
        )}
      </div>
      {five.length === 0 ? (
        <div className="text-[11px] font-bold text-white/50">No matches yet — your first is up next.</div>
      ) : (
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 5 }, (_, i) => five[i - (5 - five.length)]).map((f, i) => f ? (
            <div key={i} className="flex min-w-0 flex-col items-center rounded-lg bg-white/[0.06] px-0.5 pb-1 pt-1 ring-1 ring-white/5" title={`v ${short(f.opp)}`}>
              <div className="flex items-center gap-1">
                <span className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-md bg-gradient-to-b text-[10px] font-black text-white shadow ${tone[f.res]}`}>{f.res}</span>
                <span className="text-[12px] font-black leading-none tabular-nums text-white">{f.us}-{f.them}</span>
              </div>
              {/* Who it was against, as their crest — a name does not fit
                  five across on a phone ("Liver…"). */}
              <div className="mt-0.5 flex items-center gap-0.5">
                <span className="text-[8px] font-black text-white/40">v</span>
                <ClubBadge club={f.opp} kit={kitsOf(f.opp).home} size={14} />
              </div>
            </div>
          ) : (
            <div key={i} className="rounded-lg border border-dashed border-white/10" />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 2. You ──────────────────────────────────────────────────────────────────

function Hero({ career, glow, kitShirt, kitTrim }: Props & { glow: string; kitShirt: string; kitTrim: string }) {
  const look = useAvatarStyle();
  const rating = useCountUp(career.starRating);
  const money = useCountUp(career.money, 900);
  // A win in your last match: a hop, the arms up, confetti — once per match
  // per visit, not every time the page is swiped past.
  const last = lastFive(career).at(-1);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (!last || last.res !== "W") return;
    const key = `kib-celebrated-${career.season}-${last.week}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* ignore */ }
    // Marked as seen only once it actually starts: a mount that is torn
    // down straight away (React's dev double-mount, a phase change) must not
    // use it up.
    const on = setTimeout(() => {
      try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
      setCelebrate(true);
    }, 450);
    const off = setTimeout(() => setCelebrate(false), 2100);
    return () => { clearTimeout(on); clearTimeout(off); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [career.season, last?.week, last?.res]);

  return (
    <div className="relative overflow-hidden rounded-2xl" style={cardStyle(glow, 0.2)}>
      <Stadium glow={glow} />
      <div className="relative flex justify-center pt-3">
        <div className={celebrate ? "kib-hop" : "kib-breathe"}>
          <PlayerAvatar career={career} width={172} height={236} look={look} celebrate={celebrate} />
        </div>
        {celebrate && <Confetti colors={[kitShirt, kitTrim, "#fde047", "#ffffff"]} />}
      </div>
      <div className="relative -mt-4 bg-gradient-to-b from-transparent via-black/45 to-black/70 px-3 pb-3 pt-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <div style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.6))" }}>
            <ClubBadge club={career.player.club} kit={{ shirt: kitShirt, trim: kitTrim }} size={28} />
          </div>
          <div className="min-w-0 truncate text-[21px] font-black leading-tight text-white" style={{ textShadow: "0 2px 8px rgba(0,0,0,.6)" }}>
            {career.player.firstName} {career.player.lastName}
          </div>
        </div>
        <div className="mt-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-white/65">
          {short(career.player.club)} · #{career.squadNumber ?? "—"} · {POS_NAME[career.player.position] ?? career.player.position}{career.captain ? " · 🅲 Captain" : ""}
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          <Pill gold label="Rating" value={`★ ${rating.toFixed(1)}`} />
          <Pill label="Money" value={`★ ${formatMoney(Math.round(money))}`} valueClass="text-yellow-200" />
          <Pill label="Age" value={String(career.player.age)} />
        </div>
      </div>
    </div>
  );
}

function Pill({ label, value, gold = false, valueClass = "text-white" }: { label: string; value: string; gold?: boolean; valueClass?: string }) {
  return (
    <div
      className={`min-w-0 flex-1 rounded-full px-2.5 py-1 ${gold ? "bg-gradient-to-b from-yellow-300 to-amber-500" : "bg-gradient-to-b from-white/[0.16] to-white/[0.05]"}`}
      style={{ boxShadow: gold ? "inset 0 1px 0 rgba(255,255,255,.55), 0 4px 12px -4px rgba(245,158,11,.7)" : "inset 0 1px 0 rgba(255,255,255,.18), inset 0 0 0 1px rgba(255,255,255,.10), 0 4px 10px -6px rgba(0,0,0,.8)" }}
    >
      <div className={`truncate text-[15px] font-black leading-tight tabular-nums ${gold ? "text-gray-950" : valueClass}`}>{value}</div>
      <div className={`text-[8px] font-black uppercase tracking-[0.2em] ${gold ? "text-gray-900/70" : "text-white/50"}`}>{label}</div>
    </div>
  );
}

/** Floodlights, the stand and the pitch, in the club's colour. */
function Stadium({ glow }: { glow: string }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Night sky warming into the club colour at the bottom. */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(80% 60% at 50% 78%, ${rgba(glow, 0.55)} 0%, transparent 70%), linear-gradient(180deg, #060a14 0%, #0b1322 55%, #0b1322 100%)` }} />
      {/* The stand: a crowd of tiny lit faces, fading into the dark. */}
      <div
        className="absolute inset-x-0 top-[9%] h-[48%]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,.28) 0.9px, transparent 1.4px), radial-gradient(circle, ${rgba(glow, 0.6)} 0.9px, transparent 1.4px)`,
          backgroundSize: "7px 6px, 11px 9px",
          backgroundPosition: "0 0, 3px 2px",
          maskImage: "linear-gradient(180deg, transparent, #000 25%, #000 55%, transparent)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, #000 25%, #000 55%, transparent)",
          opacity: 0.5,
        }}
      />
      {/* The stand's roof line. */}
      <div className="absolute inset-x-0 top-[8%] h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {/* Two floodlight banks: a grid of lamps, a soft halo, and a faint
          blurred beam falling towards him. */}
      {[{ side: "left", x: "10%", rot: -26 }, { side: "right", x: "90%", rot: 26 }].map((f) => (
        <div key={f.side} className="kib-flood absolute top-[3%]" style={{ left: f.x }}>
          <div className="absolute -left-16 -top-14 h-32 w-32 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(220,235,255,.40), rgba(220,235,255,0))" }} />
          <div
            className="absolute -left-[60px] top-1 h-[230px] w-[120px] origin-top"
            style={{
              transform: `rotate(${f.rot}deg)`,
              background: "linear-gradient(180deg, rgba(220,235,255,.15), rgba(220,235,255,0) 80%)",
              clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)",
              filter: "blur(6px)",
            }}
          />
          <div className="relative -left-[14px] h-[12px] w-[28px] rounded-[3px] bg-slate-800 p-[2px]" style={{ boxShadow: "0 0 10px 3px rgba(235,245,255,.55)" }}>
            <div className="h-full w-full rounded-[2px]" style={{ backgroundImage: "radial-gradient(circle, #fff 1.2px, rgba(255,255,255,.35) 1.7px, transparent 2.2px)", backgroundSize: "6px 4px" }} />
          </div>
        </div>
      ))}
      {/* Spotlight on him. */}
      <div className="kib-glow-pulse absolute left-1/2 top-[8%] h-[70%] w-[70%] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,.16), transparent)" }} />
      {/* The pitch he stands on, with mowing stripes. */}
      <div
        className="absolute inset-x-[-10%] bottom-[22%] h-[24%] rounded-[50%]"
        style={{
          background: "repeating-linear-gradient(90deg, #1f7a3a 0 22px, #1a6d33 22px 44px)",
          boxShadow: "inset 0 10px 24px rgba(0,0,0,.55), inset 0 -2px 12px rgba(0,0,0,.4)",
          maskImage: "radial-gradient(closest-side, #000 55%, transparent)",
          WebkitMaskImage: "radial-gradient(closest-side, #000 55%, transparent)",
          opacity: 0.85,
        }}
      />
    </div>
  );
}

function Confetti({ colors }: { colors: string[] }) {
  const bits = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.3;
    const d = 70 + (i * 37) % 60;
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8 + 40, c: colors[i % colors.length], w: 4 + (i % 3) * 2, delay: (i % 5) * 40 };
  });
  return (
    <div className="pointer-events-none absolute left-1/2 top-[38%]">
      {bits.map((b, i) => (
        <span
          key={i}
          className="kib-confetti absolute block rounded-[1px]"
          style={{ width: b.w, height: b.w * 0.5, background: b.c, animationDelay: `${b.delay}ms`, ["--dx" as string]: `${b.dx}px`, ["--dy" as string]: `${b.dy}px` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ── 3. Energy and the cans ──────────────────────────────────────────────────

function Energy({ career, onUseCan, onBuyCan, glow }: Props & { glow: string }) {
  const e = Math.max(0, Math.min(100, Math.round(career.energy)));
  const shown = useCountUp(e, 900);
  // A sheen races along the bar the moment energy goes UP (a can was drunk).
  const prev = useRef(e);
  const [boost, setBoost] = useState(0);
  useEffect(() => {
    if (e > prev.current) setBoost((b) => b + 1);
    prev.current = e;
  }, [e]);
  const fill = e >= 60 ? ["#34d399", "#a3e635"] : e >= 35 ? ["#f59e0b", "#fde047"] : ["#dc2626", "#fb7185"];
  return (
    <div className="rounded-2xl p-3" style={cardStyle(glow)}>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">⚡ Energy</span>
        <span className="text-[20px] font-black leading-none tabular-nums text-white" style={{ textShadow: `0 0 12px ${rgba(fill[0], 0.6)}` }}>{Math.round(shown)}%</span>
      </div>
      <div className="relative mt-1.5 h-4 overflow-hidden rounded-full bg-black/55" style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.06)" }}>
        <div
          className="relative h-full overflow-hidden rounded-full"
          style={{ width: `${e}%`, background: `linear-gradient(90deg, ${fill[0]}, ${fill[1]})`, boxShadow: `0 0 14px ${rgba(fill[0], 0.7)}`, transition: prefersReducedMotionSafe() ? "none" : "width 900ms cubic-bezier(.2,.8,.2,1)" }}
        >
          <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/35" />
          <div key={boost} className={`absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent ${boost ? "kib-sheen-fast" : "kib-sheen"}`} />
        </div>
      </div>
      <div className="mt-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/55">KIB cans</div>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {KIB_CANS.map((c) => <CanTile key={c.id} can={c} career={career} e={e} onUse={onUseCan} onBuy={onBuyCan} />)}
      </div>
    </div>
  );
}

function prefersReducedMotionSafe(): boolean {
  return typeof window !== "undefined" && prefersReducedMotion();
}

function CanTile({ can: c, career, e, onUse, onBuy }: { can: KibCan; career: CareerState; e: number; onUse: (id: KibCan["id"]) => void; onBuy: (can: KibCan) => void }) {
  const accent = ACCENT[c.id];
  const count = career.kibCans[c.id];
  const shownCount = useCountUp(count, 500);
  const price = kibCanPrice(c, career.contract.wage);
  const ready = !!(c.effect && career.kibAbility?.[c.effect]);
  const full = !c.effect && e >= 100;
  const canUse = count > 0 && !ready && !full;
  const canBuy = career.money >= price;
  const [drinking, setDrinking] = useState(0);
  const effect = c.effect === "curve" ? "Curve shots" : c.effect === "extraTouch" ? "Extra touch" : `+${c.restore} energy`;
  const use = () => {
    if (!canUse) return;
    setDrinking((d) => d + 1);
    // Let the can shake and tip before the numbers move.
    setTimeout(() => onUse(c.id), prefersReducedMotionSafe() ? 0 : 650);
  };
  return (
    <div
      className="relative flex flex-col items-center overflow-hidden rounded-xl px-1.5 pb-1.5 pt-2"
      style={{
        background: `radial-gradient(90% 70% at 50% 30%, ${rgba(accent, 0.34)} 0%, transparent 70%), linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.25))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px ${rgba(accent, 0.35)}, 0 6px 14px -8px ${rgba(accent, 0.6)}`,
      }}
    >
      <span
        className="absolute right-1 top-1 min-w-[22px] rounded-full px-1.5 py-[1px] text-center text-[11px] font-black tabular-nums text-gray-950"
        style={{ background: `linear-gradient(180deg, ${tint(accent, 0.35)}, ${accent})`, boxShadow: `0 2px 6px ${rgba(accent, 0.6)}` }}
      >
        ×{Math.round(shownCount)}
      </span>
      <div className="relative h-[68px] w-full">
        <div className="absolute bottom-0 left-1/2 h-2 w-12 -translate-x-1/2 rounded-[50%] bg-black/60 blur-[3px]" />
        <div className="absolute bottom-0 left-1/2 h-10 w-12 -translate-x-1/2 rounded-full blur-lg" style={{ background: rgba(accent, 0.55) }} />
        <div key={drinking} className={`absolute inset-x-0 bottom-1 flex justify-center ${drinking ? "kib-shake" : ""}`} style={{ filter: `drop-shadow(0 4px 8px ${rgba(accent, 0.65)}) drop-shadow(0 1px 1px rgba(0,0,0,.6))` }}>
          <KibCanIcon can={c} className="h-[64px] w-[38px]" />
        </div>
        {drinking > 0 && (
          <div key={`d${drinking}`} className="pointer-events-none absolute inset-0">
            {[-10, -3, 4].map((dx, i) => (
              <span key={i} className="kib-drop absolute left-[38%] top-[10%] block h-2 w-1.5 rounded-full" style={{ background: accent, animationDelay: `${250 + i * 90}ms`, ["--dx" as string]: `${dx}px` } as React.CSSProperties} />
            ))}
            <span className="kib-minus absolute left-1 top-0 text-[12px] font-black text-white" style={{ textShadow: `0 0 6px ${accent}` }}>−1</span>
          </div>
        )}
      </div>
      <div className="mt-1 text-[12px] font-black leading-tight text-white">{c.name.replace(" KIB Can", "")}</div>
      <div className="h-3.5 truncate text-[9.5px] font-bold text-white/65">{effect}</div>
      <button
        disabled={!canUse}
        onClick={use}
        className="kib-press mt-1.5 w-full rounded-lg py-1.5 text-[11px] font-black uppercase tracking-wide text-gray-950 disabled:text-white/45"
        style={canUse
          ? { background: `linear-gradient(180deg, ${tint(accent, 0.3)}, ${accent} 55%, ${tint(accent, -0.15)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.5), 0 4px 10px -3px ${rgba(accent, 0.8)}` }
          : { background: "rgba(55,65,81,.8)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)" }}
      >
        {ready ? "Ready ✓" : full ? "Full" : "Use"}
      </button>
      <button
        disabled={!canBuy}
        onClick={() => onBuy(c)}
        aria-label={`Buy a ${c.name} for ${formatMoney(price)}`}
        className="kib-press mt-1 w-full rounded-lg bg-black/35 py-1 text-[10.5px] font-black text-yellow-200 ring-1 ring-yellow-300/30 disabled:opacity-40"
      >
        Buy ★{formatMoney(price)}
      </button>
    </div>
  );
}
