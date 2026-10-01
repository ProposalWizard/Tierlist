"use client";

/**
 * THE MIDDLE HOME SCREEN — the best-looking screen in the game.
 *
 * Harry, 28 Sep 2026: "The home screen should look the best, and right now it
 * doesn't." Reworked 1 Oct 2026 to fit ONE phone screen with no scrolling
 * (even a 360x640 one). Top to bottom:
 *   1. the next match as ONE thin line, with your form as letters (D D W);
 *   2. you, in a "dressing room" card: your player on the left, reputation,
 *      fame and this season's goals and assists on the right, and at the
 *      bottom your rating, the way to the next level, and your energy with
 *      the small can and its Use button beside it.
 * Money is the chip in the top bar (DashboardShell), the 3D / 2D switch is in
 * Settings, and Sponsors is a tile on the Shop page.
 * Every card is themed in your club's colours. Motion: cards rise in when
 * Home opens, numbers count, a used can shakes and empties into the energy
 * bar, and the avatar breathes and celebrates a win. All of it stops for a
 * phone set to reduce motion.
 *
 * Built from the design kit (components/star/ui) — ClubCard, Pill, StatBar,
 * PressButton, RiseIn, Glow, Stadium and the juice (Burst, Shake, Drips,
 * FloatText) — so any other screen can take the same look in one line.
 *
 * The stats/contract card lives on the screen to the left, the shop on the
 * one to the right (SwipePages, page.tsx).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, type KibCan } from "@/lib/star/shopData";
import { formatMoney } from "@/lib/star/money";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { divisionOf, fixtureTimestamp } from "@/lib/star/calendar";
import KibCanIcon from "./KibCanIcon";
import { setPieceDuties } from "@/lib/star/setPieces";
import { starStatus } from "@/lib/star/starPoints";
import StarRatingSheet from "./StarRatingSheet";
import { fameOf, fameLevel } from "@/lib/star/fame";
import { reputationLabel } from "@/lib/star/reputation";
import PlayerAvatar, { useAvatarStyle } from "./PlayerAvatar";
import { useFigureSkin } from "./FigureSkinToggle";
import {
  ClubCard, StatBar, levelColors, PressButton, RiseIn, Glow, Stadium,
  Burst, Shake, Drips, FloatText, useCountUp, prefersReducedMotion,
  glowOf, rgba, tint, useClubTheme,
} from "./ui";

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

// A phone that is short (a 360x640 one has 368px of room for all of Home)
// still has to show all of it. Home measures the room it was given (the
// swipe page's scroll box) and sizes the player to what is left.
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

/** Everything under the player: the one-line next match (36) + gaps, and the
 *  card's own rating row, energy row and padding. What is left is the player. */
const HOME_FIXED = 36 + 10 + 12 + 88 + 12;
const FIG_MAX_W = 190;
const FIG_ASPECT = 172 / 204;
export function playerSizeFor(room: number | null): { w: number; h: number } {
  if (room === null) return { w: 150, h: 178 };
  const h = Math.max(110, Math.min(226, room - HOME_FIXED));
  const w = Math.min(FIG_MAX_W, Math.round(h * FIG_ASPECT));
  return { w, h: Math.round(w / FIG_ASPECT) };
}

export default function HomeHub(p: Props) {
  const { career } = p;
  const { shirt, trim, glow } = useClubTheme(career);
  const [ref, room] = useRoom();
  const size = playerSizeFor(room);
  // One screen, no scrolling (Harry, 1 Oct 2026: "this having to be a scroll
  // to get to KIB cans and energy right now, don't love it"). Top to bottom:
  // the next match as ONE line, then you, with your energy and a can inside
  // your card. The money is a chip in the top bar (DashboardShell).
  return (
    // The card keeps its natural height: on a tall phone the spare room is
    // left empty rather than stretched into dead sky above the player.
    <div ref={ref} className="space-y-2.5 pb-3">
      <RiseIn onPageActive index={0}><NextMatchLine {...p} glow={glow} /></RiseIn>
      <RiseIn onPageActive index={1}><Hero {...p} glow={glow} kitShirt={shirt} kitTrim={trim} figW={size.w} figH={size.h} /></RiseIn>
    </div>
  );
}

// ── 1. Next match, one thin line ────────────────────────────────────────────

const FORM_TONE = { W: "bg-emerald-500", D: "bg-gray-500", L: "bg-red-600" } as const;

function NextMatchLine({ career, nextFixture, nextMatchDate, myTeam, glow }: Props & { glow: string }) {
  const five = lastFive(career);
  // The form as letters, oldest first, ending on your last match (Harry,
  // 1 Oct 2026: "just have D, D, W, not this whole thing").
  const form = five.length > 0 && (
    <span className="ml-auto flex shrink-0 items-center gap-[3px]" aria-label={`Last ${five.length}: ${five.map((f) => f.res).join(" ")}`}>
      {five.map((f, i) => (
        <span key={i} className={`grid h-[16px] w-[16px] place-items-center rounded-[4px] text-[10px] font-black leading-none text-white ${FORM_TONE[f.res]}`}>{f.res}</span>
      ))}
    </span>
  );
  if (!nextFixture) {
    return (
      <ClubCard glow={glow} className="flex h-[36px] items-center gap-2 rounded-xl px-2.5">
        <span className="min-w-0 truncate text-[11px] font-black text-white">Season complete — the awards are next</span>
        {form}
      </ClubCard>
    );
  }
  const home = nextFixture.home ? myTeam : nextFixture.opponent;
  const away = nextFixture.home ? nextFixture.opponent : myTeam;
  const days = daysToNext(career, nextFixture);
  const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`;
  return (
    <ClubCard glow={glow} className="flex h-[36px] items-center gap-1.5 rounded-xl px-2.5">
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-black text-white">
        <span className={home === myTeam ? "text-emerald-300" : ""}>{short(home)}</span>
        <span className="px-1 text-white/50">v</span>
        <span className={away === myTeam ? "text-emerald-300" : ""}>{short(away)}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap text-[10.5px] font-black text-white/80">{nextMatchDate ? nextMatchDate.replace(/^\w+\s/, "") : `Wk ${nextFixture.week}`}</span>
      <span className={`shrink-0 whitespace-nowrap rounded-full px-1.5 text-[10px] font-black leading-[16px] ${days <= 1 ? "bg-amber-400 text-gray-950" : "bg-white/12 text-amber-200"}`}>{when}</span>
      {form}
    </ClubCard>
  );
}

// ── 2. You, in the dressing room ────────────────────────────────────────────

function Hero({ career, glow, kitShirt, kitTrim, figW, figH, onUseCan, onBuyCan }: Props & { glow: string; kitShirt: string; kitTrim: string; figW: number; figH: number }) {
  const style = useAvatarStyle();
  // 2D is A1, the game's own flat figure (drawFigureAt), lit for the hero.
  // The 3D / 2D switch itself lives in Settings now (it was a chip on this
  // card; Harry, 1 Oct 2026: "that's taking up valuable space").
  const [skin] = useFigureSkin();
  const look = skin === "classic" ? "A1" : style;
  // The one rating the player sees: the career star rating, 1-100 (starPoints.ts).
  const star = starStatus(career);
  const rating = useCountUp(star.stars);
  const fame = fameOf(career);
  const ps = career.seasonStats;
  // A win in your last match: a hop, the arms up, confetti — once per match
  // per visit, not every time the page is swiped past.
  const last = lastFive(career).at(-1);
  const [celebrate, setCelebrate] = useState(false);
  const [starPass, setStarPass] = useState(false);
  const duties = setPieceDuties(career);
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
    <ClubCard glow={glow} strength={0.2} className="relative overflow-hidden rounded-2xl">
      <Stadium glow={glow} />
      {starPass && <StarRatingSheet career={career} onClose={() => setStarPass(false)} />}
      {/* The dressing room: you at your locker on the left, what the world
          thinks of you on the right (Harry, 1 Oct 2026). */}
      <div className="relative flex items-center gap-2 px-3 pt-3">
        <div className="relative shrink-0" style={{ width: figW }}>
          <span className="absolute left-0 top-0 z-10 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white ring-1 ring-white/15">Age {career.player.age}</span>
          <div className={celebrate ? "kib-hop" : "kib-breathe"}>
            <PlayerAvatar career={career} width={figW} height={figH} look={look} celebrate={celebrate} />
          </div>
          {celebrate && <Burst colors={[kitShirt, kitTrim, "#fde047", "#ffffff"]} className="left-1/2 top-[38%]" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <StandBox label="Reputation" name={reputationLabel(career.reputation)} value={Math.round(career.reputation)} bar={career.reputation} colors={["#0ea5e9", "#7dd3fc"]} />
          <StandBox label="Fame" name={fameLevel(fame).name} value={fame} bar={Math.min(100, fame)} colors={["#d946ef", "#f0abfc"]} />
          <div className="grid grid-cols-2 gap-1.5">
            <SeasonStat label="Goals" value={ps.goals} />
            <SeasonStat label="Assists" value={ps.assists} />
          </div>
          <div className="-mt-0.5 text-center text-[8.5px] font-black uppercase tracking-[0.18em] text-white/55">this season</div>
        </div>
      </div>
      {/* The bottom of the card: your rating and the way to the next level,
          then energy with the can beside it (Harry: "energy bar at the
          bottom here … a smaller version of this can with a use button next
          to the energy bar"). */}
      <div className="relative mt-1 bg-gradient-to-b from-transparent via-black/45 to-black/70 px-3 pb-2.5 pt-2">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setStarPass(true)} className="kib-press shrink-0" aria-label="Star rating — see how it is made up">
            <span
              className="flex items-center gap-1 rounded-full bg-gradient-to-b from-yellow-300 to-amber-500 px-2.5 py-[3px] text-gray-950"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.55), 0 4px 12px -4px rgba(245,158,11,.7)" }}
            >
              <span className="text-[14px] font-black leading-none tabular-nums">★ {Math.round(rating)}</span>
              <span className="text-[8px] font-black uppercase tracking-[0.16em] text-gray-900/70">Rating ›</span>
            </span>
          </button>
          {/* Set-piece tags you've earned: PK = penalty taker, FK = free-kick
              taker (Mikey, 29 Sep 2026: "like a tag that you've earned"). */}
          {duties.penalties && <DutyTag code="PK" label="Penalty taker" />}
          {duties.freeKicks && <DutyTag code="FK" label="Free-kick taker" />}
          {/* The way to the next level. One rating, 1-100: ability still runs
              the game underneath (rating.ts). */}
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-black/60">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200" style={{ width: `${Math.max(3, star.toNext * 100)}%` }} />
          </div>
          {star.gate && <span className="shrink-0 text-[10px] font-black text-white">🔒 ★{star.gate.cap}</span>}
        </div>
        <EnergyRow career={career} onUseCan={onUseCan} onBuyCan={onBuyCan} />
      </div>
    </ClubCard>
  );
}

/** Reputation or Fame, as it reads on the Relations page (Harry pointed at
 *  both boxes there and said they belong here). */
function StandBox({ label, name, value, bar, colors }: { label: string; name: string; value: number; bar: number; colors: [string, string] }) {
  return (
    <div className="rounded-xl bg-black/40 px-2 py-1.5 ring-1 ring-white/10">
      <div className="text-[8.5px] font-black uppercase tracking-[0.18em] text-white/60">{label}</div>
      <div className="flex items-baseline justify-between gap-1">
        <span className="min-w-0 truncate text-[12.5px] font-black leading-tight text-white">{name}</span>
        <span className="text-[12.5px] font-black tabular-nums leading-tight text-white">{value}</span>
      </div>
      <StatBar value={bar} colors={colors} className="mt-0.5 h-1.5" />
    </div>
  );
}

function SeasonStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-black/40 px-2 py-1 text-center ring-1 ring-white/10">
      <div className="text-[16px] font-black leading-none tabular-nums text-white">{value}</div>
      <div className="mt-0.5 text-[8.5px] font-black uppercase tracking-[0.16em] text-white/60">{label}</div>
    </div>
  );
}

// ── 3. Energy, with the can beside it ───────────────────────────────────────

function EnergyRow({ career, onUseCan, onBuyCan }: { career: CareerState; onUseCan: Props["onUseCan"]; onBuyCan: Props["onBuyCan"] }) {
  const e = Math.max(0, Math.min(100, Math.round(career.energy)));
  const shown = useCountUp(e, 900);
  const fill = levelColors(e);
  // The can that gives energy is the Basic one; Premium and Elite are boot
  // abilities and stay on the Shop's KIB Cans page.
  const can = KIB_CANS.find((c) => !c.effect) ?? KIB_CANS[0];
  const accent = ACCENT[can.id];
  const count = career.kibCans[can.id] ?? 0;
  const price = kibCanPrice(can, career.contract.wage);
  const full = e >= 100;
  const [drinking, setDrinking] = useState(0);
  const use = () => {
    if (count <= 0 || full) return;
    setDrinking((d) => d + 1);
    // Let the can shake and tip before the numbers move.
    setTimeout(() => onUseCan(can.id), prefersReducedMotionSafe() ? 0 : 650);
  };
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="shrink-0 text-[10.5px] font-black uppercase tracking-[0.12em] text-white">⚡ Energy</span>
      {/* A sheen races along the bar the moment energy goes UP (a can was drunk). */}
      <StatBar value={e} colors={fill} className="h-2.5 min-w-0 flex-1" />
      <span className="w-[38px] shrink-0 text-right text-[14px] font-black leading-none tabular-nums text-white" style={{ textShadow: `0 0 12px ${rgba(fill[0], 0.6)}` }}>{Math.round(shown)}%</span>
      <div className="relative mr-1.5 h-[30px] w-[20px] shrink-0">
        <Glow color={accent} alpha={0.5} className="bottom-0 left-1/2 h-5 w-7 -translate-x-1/2 blur-md" />
        <Shake trigger={drinking} className="absolute inset-0 flex items-end justify-center" style={{ filter: `drop-shadow(0 2px 5px ${rgba(accent, 0.65)})` }}>
          <KibCanIcon can={can} className="h-[28px] w-[16px]" />
        </Shake>
        <span className="absolute -bottom-1 -right-2 min-w-[16px] rounded-full px-1 text-center text-[9px] font-black leading-[13px] tabular-nums text-gray-950"
          style={{ background: `linear-gradient(180deg, ${tint(accent, 0.35)}, ${accent})` }}>×{count}</span>
        {drinking > 0 && (
          <div key={`d${drinking}`} className="pointer-events-none absolute inset-0">
            <Drips trigger={drinking} color={accent} />
            <FloatText trigger={drinking} motion="tick" text="−1" className="left-0 top-0 text-[11px] text-white" style={{ textShadow: `0 0 6px ${accent}` }} />
          </div>
        )}
      </div>
      {count > 0 || full ? (
        <PressButton variant="accent" accent={accent} size="none" disabled={count <= 0 || full} onClick={use}
          className="w-[46px] shrink-0 rounded-md py-1 text-[10.5px] font-black uppercase">
          {full ? "Full" : "Use"}
        </PressButton>
      ) : (
        <PressButton size="none" disabled={career.money < price} onClick={() => onBuyCan(can)} aria-label={`Buy a ${can.name} for ${formatMoney(price)}`}
          className="shrink-0 rounded-md bg-black/35 px-1.5 py-1 text-[10px] font-black text-yellow-200 ring-1 ring-yellow-300/30 disabled:opacity-40">
          Buy ★{formatMoney(price)}
        </PressButton>
      )}
    </div>
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

/** Where the Star Pass will live (Mikey, 28 Sep 2026: "your star rating is
 *  clickable… it would take you to that star pass"). Not built yet — this
 *  says what it will be. */
/** A set-piece duty you've earned: just the short code, a small gold tag
 *  (Mikey, 29 Sep 2026: "it should just say PK and it should just say FK"). */
function DutyTag({ code, label }: { code: string; label: string }) {
  return (
    <span className="rounded-md border border-amber-200 bg-amber-400 px-1.5 py-[1px] text-[11px] font-black leading-tight text-gray-950 shadow-[0_0_10px_rgba(251,191,36,.45)]" title={label} aria-label={label}>
      {code}
    </span>
  );
}
