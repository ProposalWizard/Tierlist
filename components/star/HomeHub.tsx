"use client";

/**
 * THE MIDDLE HOME SCREEN — the best-looking screen in the game.
 *
 * Harry, 28 Sep 2026: "The home screen should look the best, and right now it
 * doesn't." Reworked 1 Oct 2026 to fit ONE phone screen with no scrolling
 * (even a 360x640 one), and again after his review (v0.23, P72-P82, P96).
 * Top to bottom:
 *   0. the HUD (ui/TopHud.tsx, in the shell above this page): star rating
 *      with its progress bar, energy with the can beside it (USE, or BUY
 *      when you have none), money and age;
 *   1. Next match, as it was: both crests, VS, the date and your form;
 *   2. the mini league table: you and the clubs either side;
 *   3. you, standing on a football pitch with the goal behind you — drag to
 *      turn him, tap for a celebration — and reputation, fame, goals and
 *      assists beside you. No card: the pitch fades up into the stand.
 * Sponsors is a small arrow at the bottom right. The 3D / 2D switch is in
 * Settings.
 *
 * Built from the design kit (components/star/ui). Motion: panels rise in when
 * Home opens, numbers count, the avatar breathes and celebrates a win. All of
 * it stops for a phone set to reduce motion.
 *
 * The stats/contract card lives on the screen to the left, the shop on the
 * one to the right (SwipePages, page.tsx).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import { kibCanPrice, type KibCan } from "@/lib/star/shopData";
import { formatMoney } from "@/lib/star/money";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { divisionOf, fixtureTimestamp, leagueNameFor } from "@/lib/star/calendar";
import { kitsOf } from "@/lib/star/kits";
import KibCanIcon from "./KibCanIcon";
import { brandsOf } from "@/lib/star/sponsorDeals";
import { isOpen } from "@/lib/star/unlocks";
import { fameOf, fameLevel } from "@/lib/star/fame";
import { reputationLabel } from "@/lib/star/reputation";
import { useAvatarStyle } from "./PlayerAvatar";
import { useFigureSkin } from "./FigureSkinToggle";
import ClubBadge from "./ClubBadge";
import SpinPlayer from "./SpinPlayer";
import MiniLeague, { miniLeagueHeight } from "./MiniLeague";
import HomeBackdrop from "./HomeBackdrop";
import {
  FlatPanel, SquareBar, PressButton, RiseIn, Glow, Stadium,
  Shake, Drips, FloatText, useCountUp, prefersReducedMotion,
  glowOf, rgba, tint, useClubTheme,
} from "./ui";

const ACCENT: Record<KibCan["id"], string> = { basic: "#fb923c", premium: "#60a5fa", elite: "#c084fc" };

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
  /** The League screen (the mini table opens it). */
  onLeague?: () => void;
}

export const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
/** Re-exported for the match-day screen, which imports them from here. */
export { glowOf, cardStyle } from "./ui";

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
export function daysToNext(career: CareerState, next: Fixture): number {
  const div = divisionOf(career);
  const ts = (f: Fixture) => fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, div);
  const played = career.fixtures.filter((f) => f.played);
  const nextTs = ts(next);
  const lastTs = played.length ? Math.max(...played.map(ts).filter((t) => t <= nextTs)) : nextTs - 5 * 86400000;
  const today = Number.isFinite(lastTs) ? lastTs + 86400000 : nextTs - 5 * 86400000;
  return Math.max(0, Math.round((nextTs - today) / 86400000));
}

// A phone that is short (a 360x640 one has ~315px of room for all of Home)
// still has to show all of it. Home measures the room it was given (the
// swipe page's scroll box) and sizes the league table and the player to
// what is left.
function useRoom() {
  const ref = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<number | null>(null);
  useLayoutEffect(() => {
    const root = ref.current?.closest("[data-scroll-root]") as HTMLElement | null;
    if (!root) return;
    const read = () => setRoom(root.clientHeight);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);
  return [ref, room] as const;
}

/** The Next match panel's height, and the gap under it. */
const NEXT_H = 86;
const FIG_MAX_W = 190;
/** The bottom strip that carries the edge arrows and Sponsors. */
export const ARROW_STRIP = 34;
const FIG_ASPECT = 172 / 204;
/** How many league rows there is room for. */
export function leagueRowsFor(room: number | null): number {
  return room !== null && room >= 440 ? 5 : 3;
}
/** The player's box: what is left after the next match and the league table. */
export function playerSizeFor(room: number | null, rows = 3): { w: number; h: number } {
  if (room === null) return { w: 130, h: 154 };
  // + ARROW_STRIP: the bottom-edge arrows (Stats ‹ › Shop) sit under him (v0.23).
  const fixed = NEXT_H + 4 + miniLeagueHeight(rows) + 4 + 14 + ARROW_STRIP;
  const h = Math.max(104, Math.min(226, room - fixed));
  const w = Math.min(FIG_MAX_W, Math.round(h * FIG_ASPECT));
  return { w, h: Math.round(w / FIG_ASPECT) };
}

export default function HomeHub(p: Props) {
  const { career } = p;
  const { shirt, trim, glow } = useClubTheme(career);
  const [ref, room] = useRoom();
  const rows = leagueRowsFor(room);
  const size = playerSizeFor(room, rows);
  return (
    // Full width: the page's own side padding is cancelled (-mx-3) so the
    // pitch and the panels touch both edges, and the page is at least as tall
    // as its box so the pitch reaches the bottom bar.
    <div ref={ref} className="relative -mx-3 flex min-h-full flex-col overflow-hidden">
      <div className="home-sky"><Stadium glow={glow} pitch={false} floods={false} /></div>
      <RiseIn onPageActive index={0} className="relative z-10"><NextMatch {...p} glow={glow} /></RiseIn>
      <div className="relative z-10 mt-1"><MiniLeague career={career} glow={glow} rows={rows} onOpen={p.onLeague} /></div>
      <Hero {...p} glow={glow} kitShirt={shirt} kitTrim={trim} figW={size.w} figH={size.h} />
      {isOpen(career, "shop") && <SponsorsArrow career={career} onOpen={p.onOpen} />}
    </div>
  );
}

// ── 1. Next match, as it was: both crests, VS, the date and your form ──────

const FORM_TONE = { W: "bg-emerald-500", D: "bg-gray-500", L: "bg-red-600" } as const;

function NextMatch({ career, nextFixture, nextMatchDate, myTeam, glow }: Props & { glow: string }) {
  const five = lastFive(career);
  const form = five.length > 0 && (
    <span className="flex shrink-0 items-center gap-[3px]" aria-label={`Last ${five.length}: ${five.map((f) => f.res).join(" ")}`}>
      {five.map((f, i) => (
        <span key={i} className={`grid h-[15px] w-[15px] place-items-center text-[10px] font-black leading-none text-white ${FORM_TONE[f.res]}`}>{f.res}</span>
      ))}
    </span>
  );
  if (!nextFixture) {
    return (
      <FlatPanel fade="top" glow={glow} className="flex h-[40px] items-center gap-2 px-3">
        <span className="min-w-0 truncate text-[12px] font-black text-white">Season complete — the awards are next</span>
        <span className="ml-auto">{form}</span>
      </FlatPanel>
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
    <FlatPanel fade="top" className="relative px-3" style={{ height: NEXT_H }}>
      {/* the two clubs, each lighting its own side */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 130% at 0% 55%, ${rgba(hg, 0.38)}, transparent 70%), radial-gradient(60% 130% at 100% 55%, ${rgba(ag, 0.38)}, transparent 70%)` }} />
      <div className="relative flex h-[15px] items-center justify-between pt-1">
        <span className="text-[10px] font-black uppercase leading-none tracking-[0.18em] text-emerald-300">Next match</span>
        <span className="truncate pl-2 text-[10px] font-black uppercase leading-none tracking-wider text-white/75">{comp}</span>
      </div>
      <div className="relative mt-1 grid grid-cols-[1fr_44px_1fr] items-start">
        <TeamSide club={home} kit={homeKit} you={home === myTeam} />
        <div className="flex h-[34px] items-center justify-center text-[22px] font-black italic leading-none text-white/90" style={{ textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>VS</div>
        <TeamSide club={away} kit={awayKit} you={away === myTeam} />
      </div>
      <div className="relative mt-0.5 flex h-[16px] items-center gap-2">
        <span className="whitespace-nowrap text-[11px] font-black leading-none text-white">{nextMatchDate ?? `Week ${nextFixture.week}`}</span>
        <span className={`whitespace-nowrap px-1.5 text-[10px] font-black leading-[15px] ${days <= 1 ? "bg-amber-400 text-gray-950" : "bg-white/12 text-amber-200"}`}>⏱ {when}</span>
        <span className="ml-auto">{form}</span>
      </div>
    </FlatPanel>
  );
}

function TeamSide({ club, kit, you }: { club: string; kit: { shirt: string; trim: string }; you: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className={`relative grid h-[34px] w-[34px] place-items-center ${you ? "shadow-[0_0_12px_rgba(110,231,183,.6)]" : ""}`} style={{ filter: "drop-shadow(0 3px 4px rgba(0,0,0,.55))" }}>
        <ClubBadge club={club} kit={kit} size={32} />
      </div>
      <div className={`w-full truncate text-center text-[11.5px] font-black leading-tight ${you ? "text-emerald-300" : "text-white"}`}>{short(club)}</div>
    </div>
  );
}

// ── 2. You, on the pitch ────────────────────────────────────────────────────

function Hero({ career, glow, kitShirt, kitTrim, figW, figH }: Props & { glow: string; kitShirt: string; kitTrim: string; figW: number; figH: number }) {
  // 2D is A1, the game's own flat figure (drawFigureAt), lit for the hero.
  // The 3D / 2D switch itself lives in Settings (Harry, 1 Oct 2026).
  const [skin] = useFigureSkin();
  const style = useAvatarStyle();
  const look = skin === "classic" ? "A1" : style;
  const fame = fameOf(career);
  const ps = career.seasonStats;
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
    <div className="relative flex min-h-0 flex-1 items-end">
      {/* the pitch is sized to him (the goal line sits just above his head)
          and fades out upwards into the stand, under the league table */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: Math.round(figH * 1.32 + 30), maxHeight: "100%" }}><HomeBackdrop glow={glow} /></div>
      <div className="relative flex w-full items-end gap-2 px-3 pt-1" style={{ paddingBottom: ARROW_STRIP + 8 }}>
        <div className="relative shrink-0" style={{ width: figW }}>
          <SpinPlayer career={career} width={figW} height={figH} look={look} kitShirt={kitShirt} kitTrim={kitTrim} autoCelebrate={celebrate} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 self-center">
          <StandBox label="Reputation" name={reputationLabel(career.reputation)} value={Math.round(career.reputation)} bar={career.reputation} colors={["#0ea5e9", "#7dd3fc"]} />
          <StandBox label="Fame" name={fameLevel(fame).name} value={fame} bar={Math.min(100, fame)} colors={["#d946ef", "#f0abfc"]} />
          <div className="grid grid-cols-2 gap-1.5">
            <SeasonStat label="Goals" value={ps.goals} />
            <SeasonStat label="Assists" value={ps.assists} />
          </div>
          <div className="-mt-0.5 text-center text-[8.5px] font-black uppercase tracking-[0.18em] text-white/70" style={{ textShadow: "0 1px 2px rgba(0,0,0,.8)" }}>this season</div>
        </div>
      </div>
    </div>
  );
}

/** Reputation or Fame: a flat block with a square bar — no rounded card. */
function StandBox({ label, name, value, bar, colors }: { label: string; name: string; value: number; bar: number; colors: [string, string] }) {
  return (
    <div className="bg-black/45 px-2 py-[3px]" style={{ borderLeft: `3px solid ${colors[0]}` }}>
      <div className="text-[8.5px] font-black uppercase leading-none tracking-[0.18em] text-white/75">{label}</div>
      <div className="mt-0.5 flex items-baseline justify-between gap-1">
        <span className="min-w-0 truncate text-[12.5px] font-black leading-tight text-white">{name}</span>
        <span className="text-[12.5px] font-black tabular-nums leading-tight text-white">{value}</span>
      </div>
      <SquareBar value={bar} colors={colors} className="mt-0.5 h-[7px]" ticks={false} />
    </div>
  );
}

function SeasonStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-black/45 px-2 py-[3px] text-center">
      <div className="text-[16px] font-black leading-none tabular-nums text-white">{value}</div>
      <div className="mt-0.5 text-[8.5px] font-black uppercase leading-none tracking-[0.16em] text-white/75">{label}</div>
    </div>
  );
}

// ── 3. Sponsors, a small arrow at the bottom right ──────────────────────────

/** Your sponsors, one tap from Home (Harry, 1 Oct 2026, P66: "like being a
 *  little arrow in the bottom right instead"). Not a pill: plain text and an
 *  arrow, with a red count when offers are waiting. */
function SponsorsArrow({ career, onOpen }: { career: CareerState; onOpen: Props["onOpen"] }) {
  const offers = brandsOf(career).offers.length;
  return (
    <button type="button" onClick={() => onOpen("sponsors")} aria-label={offers ? `Sponsors: ${offers} offer${offers === 1 ? "" : "s"} waiting` : "Sponsors"}
      className="kib-press absolute bottom-1 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 px-1 py-1 text-[11px] font-black uppercase leading-none tracking-wide text-white"
      style={{ textShadow: "0 1px 3px rgba(0,0,0,.95), 0 0 6px rgba(0,0,0,.8)" }}>
      Sponsors
      {offers > 0 && <span className="grid h-[15px] min-w-[15px] place-items-center bg-red-500 px-1 text-[10px] leading-none text-white">{offers}</span>}
      <span className="text-[17px] leading-none text-emerald-300">›</span>
    </button>
  );
}

function prefersReducedMotionSafe(): boolean {
  return typeof window !== "undefined" && prefersReducedMotion();
}

/** `compact`: a shorter can picture, for the match-day screen (MatchdayScreen.tsx). */
export function CanTile({ can: c, career, e, onUse, onBuy, compact = false, mini = false }: { can: KibCan; career: CareerState; e: number; onUse: (id: KibCan["id"]) => void; onBuy: (can: KibCan) => void; compact?: boolean; mini?: boolean }) {
  const accent = ACCENT[c.id];
  const count = career.kibCans[c.id];
  const shownCount = useCountUp(count, 500);
  const price = kibCanPrice(c, career.contract.wage);
  const ready = !!(c.effect && career.kibAbility?.[c.effect]);
  const full = !c.effect && e >= 100;
  const canUse = count > 0 && !ready && !full;
  const canBuy = career.money >= price;
  const [drinking, setDrinking] = useState(0);
  const effect = c.effect === "curve" ? `Curve shots${c.restore ? ` +${c.restore}` : ""}` : c.effect === "extraTouch" ? `Extra touch${c.restore ? ` +${c.restore}` : ""}` : `+${c.restore} energy`;
  const use = () => {
    if (!canUse) return;
    setDrinking((d) => d + 1);
    // Let the can shake and tip before the numbers move.
    setTimeout(() => onUse(c.id), prefersReducedMotionSafe() ? 0 : 650);
  };
  // Home's short tile (`mini`): can and name side by side, Use and Buy side by side.
  if (mini) return (
    <div
      className="relative overflow-hidden rounded-xl p-1.5"
      style={{
        background: `radial-gradient(90% 70% at 30% 30%, ${rgba(accent, 0.34)} 0%, transparent 70%), linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.25))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px ${rgba(accent, 0.35)}, 0 6px 14px -8px ${rgba(accent, 0.6)}`,
      }}
    >
      <div className="flex items-center gap-2">
        <div className="relative h-[40px] w-[22px] shrink-0">
          <Glow color={accent} alpha={0.5} className="bottom-0 left-1/2 h-6 w-8 -translate-x-1/2 blur-md" />
          <Shake trigger={drinking} className="absolute inset-0 flex items-end justify-center" style={{ filter: `drop-shadow(0 3px 6px ${rgba(accent, 0.65)}) drop-shadow(0 1px 1px rgba(0,0,0,.6))` }}>
            <KibCanIcon can={c} className="h-[38px] w-[22px]" />
          </Shake>
          <span className="absolute -bottom-1 -right-1.5 min-w-[18px] rounded-full px-1 text-center text-[9.5px] font-black leading-[14px] tabular-nums text-gray-950"
            style={{ background: `linear-gradient(180deg, ${tint(accent, 0.35)}, ${accent})`, boxShadow: `0 1px 4px ${rgba(accent, 0.6)}` }}>×{Math.round(shownCount)}</span>
          {drinking > 0 && (
            <div key={`d${drinking}`} className="pointer-events-none absolute inset-0">
              <Drips trigger={drinking} color={accent} />
              <FloatText trigger={drinking} motion="tick" text="−1" className="left-0 top-0 text-[11px] text-white" style={{ textShadow: `0 0 6px ${accent}` }} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-black leading-tight text-white">{c.name.replace(" KIB Can", "")}</div>
          <div className="line-clamp-2 text-[9.5px] font-bold leading-[11px] text-white/80">{effect}</div>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <PressButton variant="accent" accent={accent} size="none" disabled={!canUse} onClick={use}
          className="rounded-md py-1 text-[10.5px] font-black uppercase">
          {ready ? "✓" : full ? "Full" : "Use"}
        </PressButton>
        <PressButton size="none" disabled={!canBuy} onClick={() => onBuy(c)} aria-label={`Buy a ${c.name} for ${formatMoney(price)}`}
          className="rounded-md bg-black/35 py-1 text-[10px] font-black text-yellow-200 ring-1 ring-yellow-300/30 disabled:opacity-40">
          ★{formatMoney(price)}
        </PressButton>
      </div>
    </div>
  );
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
      <div className={`relative w-full ${compact ? "h-[44px]" : "h-[68px]"}`}>
        <div className="absolute bottom-0 left-1/2 h-2 w-12 -translate-x-1/2 rounded-[50%] bg-black/60 blur-[3px]" />
        <Glow color={accent} alpha={0.55} className="bottom-0 left-1/2 h-10 w-12 -translate-x-1/2 blur-lg" />
        <Shake trigger={drinking} className="absolute inset-x-0 bottom-1 flex justify-center" style={{ filter: `drop-shadow(0 4px 8px ${rgba(accent, 0.65)}) drop-shadow(0 1px 1px rgba(0,0,0,.6))` }}>
          <KibCanIcon can={c} className={compact ? "h-[42px] w-[25px]" : "h-[64px] w-[38px]"} />
        </Shake>
        {drinking > 0 && (
          <div key={`d${drinking}`} className="pointer-events-none absolute inset-0">
            <Drips trigger={drinking} color={accent} />
            <FloatText trigger={drinking} motion="tick" text="−1" className="left-1 top-0 text-[12px] text-white" style={{ textShadow: `0 0 6px ${accent}` }} />
          </div>
        )}
      </div>
      <div className="mt-1 text-[12px] font-black leading-tight text-white">{c.name.replace(" KIB Can", "")}</div>
      <div className="h-3.5 truncate text-[9.5px] font-bold text-white/65">{effect}</div>
      <PressButton
        variant="accent"
        accent={accent}
        disabled={!canUse}
        onClick={use}
        className="mt-1.5 w-full rounded-lg py-1.5 text-[11px] font-black uppercase tracking-wide"
      >
        {ready ? "Ready ✓" : full ? "Full" : "Use"}
      </PressButton>
      <PressButton
        disabled={!canBuy}
        onClick={() => onBuy(c)}
        aria-label={`Buy a ${c.name} for ${formatMoney(price)}`}
        className="mt-1 w-full rounded-lg bg-black/35 py-1 text-[10.5px] font-black text-yellow-200 ring-1 ring-yellow-300/30 disabled:opacity-40"
      >
        Buy ★{formatMoney(price)}
      </PressButton>
    </div>
  );
}

