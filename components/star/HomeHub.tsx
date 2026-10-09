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
 *   3. you, standing on a football pitch with the goal behind you, its goal
 *      line at your boots (v0.24) — drag to turn him, tap for a celebration
 *      — and reputation, fame, goals and assists beside you;
 *   4. the energy cans under you: Basic / Premium / Elite, each with Use and
 *      a price (v0.24, Harry's picture "A on a small phone").
 * Achievements and Sponsors are small links at the bottom. The 3D / 2D
 * switch is in Settings.
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
import { KIB_CANS, kibCanPrice, type KibCan } from "@/lib/star/shopData";
import { formatMoney } from "@/lib/star/money";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { divisionOf, fixtureTimestamp, leagueNameFor } from "@/lib/star/calendar";
import { kitsOf } from "@/lib/star/kits";
import KibCanIcon from "./KibCanIcon";
import { brandsOf } from "@/lib/star/sponsorDeals";
import { isOpen } from "@/lib/star/unlocks";
import { fameOf } from "@/lib/star/fame";
import { useAvatarStyle } from "./PlayerAvatar";
import { useFigureSkin } from "./FigureSkinToggle";
import ClubBadge from "./ClubBadge";
import SpinPlayer from "./SpinPlayer";
import HomePlayer from "./HomePlayer";
import { useHomeLook } from "@/lib/star/homeLook";
import { LeagueDropdown, LEAGUE_DROPDOWN_H } from "./MiniLeague";
import { homeSkyFor, type HomeSky } from "@/lib/star/kickoff";
import {
  FlatPanel, SquareBar, PressButton, RiseIn, Glow,
  Shake, Drips, FloatText, useCountUp, prefersReducedMotion,
  glowOf, rgba, tint, useClubTheme,
} from "./ui";

const ACCENT: Record<KibCan["id"], string> = { basic: "#fb923c", premium: "#60a5fa", elite: "#c084fc" };

export type HubPhase = "store" | "shop-kib" | "shop-boots" | "shop-lifestyle" | "shop-3d" | "casino-menu" | "sponsors" | "achievements" | "trophies" | "ownership" | "garden";

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
  /** "3 goals off Calloway's record": the closest Hall of Fame record within
   *  reach (lib/star/hallRecords.ts), or null. */
  hallChase?: string | null;
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
const FIG_MAX_W = 228;
/** The bottom strip that carries the edge arrows and Sponsors. */
export const ARROW_STRIP = 34;
/** The energy cans row under the player (Basic / Premium / Elite). */
export const CANS_H = 76;
const FIG_ASPECT = 172 / 204;
/** How many league rows there is room for. */
export function leagueRowsFor(room: number | null): number {
  return room !== null && room >= 440 ? 5 : 3;
}
/** The player's box: what is left after the next match and the league table. */
export function playerSizeFor(room: number | null, rows = 3, extra = 0, maxH = 290): { w: number; h: number } {
  if (room === null) return { w: 130, h: 154 };
  // + ARROW_STRIP: the bottom-edge arrows (Stats ‹ › Shop) sit under him (v0.23).
  // The league is a one-row dropdown now (Harry, 1 Oct 2026), so `rows` no
  // longer costs height; it is kept for callers that still pass it.
  void rows;
  // + CANS_H: the energy cans row under him (v0.24). He is bigger too: up
  // to 270 tall (was 226), so on a tall phone he fills the space the old
  // goal-and-sky gap used.
  // + extra: the New look's stat tiles (STATS_H) under the next match.
  const fixed = NEXT_H + 4 + LEAGUE_DROPDOWN_H + 4 + 4 + CANS_H + 6 + ARROW_STRIP + 4 + extra;
  const h = Math.max(104, Math.min(maxH, room - fixed));
  const w = Math.min(maxH > 290 ? Math.round(maxH * FIG_ASPECT) : FIG_MAX_W, Math.round(h * FIG_ASPECT));
  return { w, h: Math.round(w / FIG_ASPECT) };
}

export default function HomeHub(p: Props) {
  const { career } = p;
  const { shirt, trim, glow } = useClubTheme(career);
  const [ref, room] = useRoom();
  const rows = leagueRowsFor(room);
  const lookHome = useHomeLook();
  if (lookHome === "new") {
    // Settings → Look → "Home screen: New" (Harry, 9 Oct 2026): the stat
    // tiles go up top, the goal goes, he stands centre stage.
    // No goal to share the row with: he may stand taller (up to 360).
    const size = playerSizeFor(room, rows, STATS_H + 4, 360);
    return (
      <div ref={ref} data-home-look="new" className="relative -mx-3 flex min-h-full flex-col overflow-hidden">
        <HomeScene sky={homeSkyFor(career, p.nextFixture)} />
        <RiseIn onPageActive index={0} className="relative z-10"><NextMatch {...p} glow={glow} /></RiseIn>
        <RiseIn onPageActive index={1} className="relative z-10 mt-1 px-3"><StatTiles career={career} /></RiseIn>
        <div data-home-league className="relative z-20 mt-1"><LeagueDropdown career={career} glow={glow} onOpen={p.onLeague} /></div>
        <HeroNew {...p} glow={glow} kitShirt={shirt} kitTrim={trim} figW={size.w} figH={size.h} />
        <MiddleLinks career={career} onOpen={p.onOpen} />
      </div>
    );
  }
  const size = playerSizeFor(room, rows);
  return (
    // Full width: the page's own side padding is cancelled (-mx-3) so the
    // pitch and the panels touch both edges, and the page is at least as tall
    // as its box so the pitch reaches the bottom bar.
    <div ref={ref} className="relative -mx-3 flex min-h-full flex-col overflow-hidden">
      <HomeScene sky={homeSkyFor(career, p.nextFixture)} />
      <RiseIn onPageActive index={0} className="relative z-10"><NextMatch {...p} glow={glow} /></RiseIn>
      <div data-home-league className="relative z-20 mt-1"><LeagueDropdown career={career} glow={glow} onOpen={p.onLeague} /></div>
      <Hero {...p} glow={glow} kitShirt={shirt} kitTrim={trim} figW={size.w} figH={size.h} />
      <MiddleLinks career={career} onOpen={p.onOpen} />
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
    // Faint, so the sky shows through (Harry, 1 Oct 2026: "make the next match
    // super low opacity"); the text keeps a shadow to stay readable.
    <FlatPanel fade="top" className="relative px-3" style={{ height: NEXT_H, ["--sk-flat-alpha" as string]: 0.14, textShadow: "0 1px 3px rgba(0,0,0,.85)" } as React.CSSProperties}>
      {/* the two clubs, each lighting its own side */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 130% at 0% 55%, ${rgba(hg, 0.16)}, transparent 70%), radial-gradient(60% 130% at 100% 55%, ${rgba(ag, 0.16)}, transparent 70%)` }} />
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

// ── The stadium behind everything ──────────────────────────────────────────

/** Where the grass meets the hoardings in each picture (0-1 down it),
 *  measured off the files in public/home/. */
const SCENE_LINE: Record<HomeSky, number> = { day: 0.516, sunset: 0.49, night: 0.487 };
const SCENE_ASPECT = 1344 / 752;

/**
 * ONE PICTURE BEHIND ALL OF HOME — sky, stand, hoardings and a real mown pitch
 * (Harry, 1 Oct 2026: the drawn grass "is letting it down"). Picked by the next
 * match's kick-off (lib/star/kickoff.ts) and lined up so its hoardings sit on
 * the goal line Hero marks, whatever the phone's size.
 */
function HomeScene({ sky }: { sky: HomeSky }) {
  // Its own box is measured, and Home's root is its parent. (It used to be
  // handed Home's root ref, but a child's layout effect runs before its
  // parent's ref is attached, so on a live build — no Strict Mode second
  // pass — that ref was still empty and the picture never drew.)
  const own = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number; goal: number } | null>(null);
  useLayoutEffect(() => {
    const root = own.current?.parentElement;
    if (!root) return;
    const read = () => {
      const r = root.getBoundingClientRect();
      const m = root.querySelector("[data-goal-line]")?.getBoundingClientRect();
      setBox({ w: r.width, h: r.height, goal: m ? m.top - r.top : r.height * 0.55 });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);
  const f = SCENE_LINE[sky];
  // As small as it can be while covering the screen, with its line on the goal line.
  const imgH = box ? Math.max(box.w * SCENE_ASPECT, box.goal / f, (box.h - box.goal) / (1 - f)) : 0;
  const imgW = imgH / SCENE_ASPECT;
  return (
    <div ref={own} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {box && box.w > 0 && (
        <div
          className="absolute"
          style={{
            width: imgW, height: imgH, left: (box.w - imgW) / 2, top: box.goal - f * imgH,
            backgroundImage: `url(/home/scene-${sky}.webp)`, backgroundSize: "100% 100%",
          }}
        />
      )}
    </div>
  );
}

// ── 2. You, on the pitch, the goal at your feet, the cans under you ────────

/** The goal: a generated, transparent, front-on goal cropped tight to its
 *  frame, so the picture's bottom edge IS the goal line. v0.25 (Harry and
 *  Mikey, 2 Oct 2026, P28: "needs to be a full-size goal"): the old picture
 *  (/home/goal.webp, 928x496) had a small goal's shape, under 2 to 1. This
 *  one (1483x496) is the same goal with its back net widened to a real
 *  goal's 3 to 1 (7.32 m by 2.44 m), made by repeating a strip of the net. */
const GOAL_SRC = "/home/goal-full.webp";
const GOAL_ASPECT = 1483 / 496;
/** The goal's height for the player's box height, at most. Harry (2 Oct
 *  2026, with picture "A on a small phone": "move the goal back and have it
 *  exactly like image 2") — the goal stands well behind him, about half his
 *  height. As a full-size goal it is as wide as the screen allows. */
const GOAL_TO_PLAYER = 0.5;
/** How far up the screen the goal line sits behind his boots, as a share of
 *  his box height (image 2: the goal line is at his thighs). */
const GOAL_BACK = 0.36;
/** How far above the bottom of the player's box his boots meet the grass. */
const FEET_LIFT = 0.035;
/** The stadium picture's hoardings, as a share of the goal's height above
 *  the goal line. Above the foot of the back net (12% up the picture), so
 *  the floor inside the goal is the picture's grass, not the hoardings
 *  (v0.25, P28: "it needs the grass texture in a box"). */
const HOARDING_IN_GOAL = 0.17;
/** Room kept between each post and the screen edge (the row has 12px of
 *  page padding either side, so this can be negative). */
const GOAL_EDGE = 2;

/**
 * Where Home's goal goes, in the player row's own pixels (x from the row's
 * left, bottom up from the row's floor). The goal line sits at his boots
 * (Harry, 2 Oct 2026, v0.24 P1-13/15/17: "the goal has been risen up too
 * much … bring the goal down"; before, it stood on the hoardings, level with
 * his chest). The goal is a little shorter than him and never wider than the
 * screen, so both posts always show; he stands left of centre in the mouth.
 */
export function goalBoxFor(figW: number, figH: number, rowW: number) {
  const bottom = Math.round(figH * (FEET_LIFT + GOAL_BACK));
  const maxW = rowW > 0 ? rowW - 2 * GOAL_EDGE : Infinity;
  const width = Math.round(Math.min(figH * GOAL_TO_PLAYER * GOAL_ASPECT, maxW));
  const height = Math.round(width / GOAL_ASPECT);
  // Image 2: the left post near the screen's left edge, him in front of it.
  const want = GOAL_EDGE;
  const left = Math.round(rowW > 0 ? Math.max(GOAL_EDGE, Math.min(want, rowW - GOAL_EDGE - width)) : want);
  return { left, bottom, width, height, hoardings: bottom + Math.round(height * HOARDING_IN_GOAL) };
}

function Hero({ career, kitShirt, kitTrim, figW, figH, onUseCan, onBuyCan, hallChase }: Props & { glow: string; kitShirt: string; kitTrim: string; figW: number; figH: number }) {
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

  // The goal stands on the grass at his feet (Harry, 2 Oct 2026, v0.24
  // P1-13/15/17: "the goal has been risen up too much … bring the goal
  // down"). Before, its line sat on the hoardings, level with his chest.
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowW, setRowW] = useState(0);
  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const read = () => setRowW(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const g = goalBoxFor(figW, figH, rowW);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col justify-end px-3" style={{ paddingBottom: ARROW_STRIP + 4 }}>
      <div ref={rowRef} className="relative flex w-full min-h-0 flex-1 items-end gap-2 pt-1">
        {/* HomeScene lines the stadium picture's hoardings up with this
            marker: just behind the goal, seen through the net. */}
        <div data-goal-line aria-hidden className="pointer-events-none absolute -inset-x-3 h-0" style={{ bottom: g.hoardings }} />
        {/* the goal, set back behind him where the pitch meets the stands */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={GOAL_SRC} alt="" aria-hidden draggable={false} data-home-goal
          className="pointer-events-none absolute max-w-none select-none"
          style={{ left: g.left, bottom: g.bottom, width: g.width, height: g.height, filter: "drop-shadow(0 5px 5px rgba(0,0,0,.35))" }}
        />
        <div data-tour="player" className="relative z-10 shrink-0" style={{ width: figW }}>
          <SpinPlayer career={career} width={figW} height={figH} look={look} kitShirt={kitShirt} kitTrim={kitTrim} autoCelebrate={celebrate} />
        </div>
        <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-1 self-center">
          {/* No title words ("Trusted", "Rising Star", "Unknown"): the bar and
              the number only (v0.25, P27: "the names are just meaningless"). */}
          <StandBox label="Reputation" value={Math.round(career.reputation)} bar={career.reputation} colors={["#0ea5e9", "#7dd3fc"]} />
          <StandBox label="Fame" value={fame} bar={Math.min(100, fame)} colors={["#d946ef", "#f0abfc"]} />
          <div className="grid grid-cols-2 gap-1.5">
            <SeasonStat label="Goals" value={ps.goals} />
            <SeasonStat label="Assists" value={ps.assists} />
          </div>
          <div className="-mt-0.5 text-center text-[8.5px] font-black uppercase tracking-[0.18em] text-white/70" style={{ textShadow: "0 1px 2px rgba(0,0,0,.8)" }}>this season</div>
          {/* Your legend lives on: a record from one of your own retired
              careers, within reach (Leo, 6 Oct 2026). */}
          {hallChase && (
            <div data-hall-chase className="mt-0.5 flex items-start justify-center gap-1 px-1 py-1 text-center text-[10px] font-black leading-tight text-amber-200" style={{ background: "rgba(5,8,15,.55)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.45)", borderRadius: 2, textShadow: "0 1px 2px rgba(0,0,0,.8)" }}>
              <span aria-hidden>🏛️</span><span>{hallChase}</span>
            </div>
          )}
        </div>
      </div>
      {/* The energy cans, under him (Harry, 2 Oct 2026, P1-14/P1-19: "the
          one with the cans, I think that's amazing"). Use and Buy are the
          same handlers the top bar's can and the shop use. */}
      <div data-home-cans className="relative z-10 mt-1.5 grid shrink-0 grid-cols-3 gap-1.5" style={{ height: CANS_H }}>
        {KIB_CANS.map((c) => <CanTile key={c.id} can={c} career={career} e={career.energy ?? 100} onUse={onUseCan} onBuy={onBuyCan} mini />)}
      </div>
    </div>
  );
}

/** Reputation or Fame: a flat block with a square bar — no rounded card. */
function StandBox({ label, value, bar, colors }: { label: string; value: number; bar: number; colors: [string, string] }) {
  return (
    <div className="bg-black/55 px-2 py-[4px]" style={{ borderLeft: `3px solid ${colors[0]}` }}>
      <div className="flex items-baseline justify-between gap-1">
        <span className="min-w-0 truncate text-[9px] font-black uppercase leading-none tracking-[0.16em] text-white/80">{label}</span>
        <span className="text-[14px] font-black tabular-nums leading-none text-white">{value}</span>
      </div>
      <SquareBar value={bar} colors={colors} className="mt-1 h-[7px]" ticks={false} />
    </div>
  );
}

function SeasonStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-black/55 px-2 py-[3px] text-center">
      <div className="text-[16px] font-black leading-none tabular-nums text-white">{value}</div>
      <div className="mt-0.5 text-[8.5px] font-black uppercase leading-none tracking-[0.16em] text-white/75">{label}</div>
    </div>
  );
}

// ── 2b. The New Home look (Settings → Look → "Home screen: New") ──────────
//
// Harry, 9 Oct 2026: "make the rep/fame + goals and assists and the cans more
// prominent", "remove the goal", "the players to look really fun and good".
// Four big tiles near the top, the goal gone, you centre stage through the
// one hook (HomePlayer.tsx), the cans with big counts under you.

/** The stat tiles' height (New look). */
export const STATS_H = 66;

interface Tile { key: string; label: string; value: number; icon: string; color: string; bar?: number }

/** Reputation, Fame, Goals and Assists: one big number each, a 3D icon and a
 *  short label. Goals and assists are this season's. */
export function StatTiles({ career }: { career: CareerState }) {
  const fame = fameOf(career);
  const ps = career.seasonStats;
  const tiles: Tile[] = [
    { key: "rep", label: "Rep", value: Math.round(career.reputation), icon: "/icons3d/world.png", color: "#0ea5e9", bar: career.reputation },
    { key: "fame", label: "Fame", value: fame, icon: "/icons3d/fame.png", color: "#d946ef", bar: Math.min(100, fame) },
    { key: "goals", label: "Goals", value: ps.goals, icon: "/star/ball.png", color: "#22c55e" },
    { key: "assists", label: "Assists", value: ps.assists, icon: "/shop/boot-control-L1.webp", color: "#f59e0b" },
  ];
  return (
    <div data-home-stats className="grid grid-cols-4 gap-1.5" style={{ height: STATS_H }}>
      {tiles.map((t) => <StatTile key={t.key} t={t} />)}
    </div>
  );
}

function StatTile({ t }: { t: Tile }) {
  const shown = useCountUp(t.value, 600);
  return (
    <div data-stat={t.key} className="relative flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl px-1"
      style={{
        background: `radial-gradient(90% 80% at 50% 0%, ${rgba(t.color, 0.38)} 0%, transparent 75%), rgba(5,8,15,.72)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1.5px ${rgba(t.color, 0.6)}, 0 6px 14px -8px ${rgba(t.color, 0.8)}`,
      }}>
      <div className="flex items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t.icon} alt="" aria-hidden draggable={false} className="h-[22px] w-[22px] shrink-0 select-none object-contain" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }} />
        <span className="text-[23px] font-black leading-none tabular-nums text-white" style={{ textShadow: `0 0 10px ${rgba(t.color, 0.7)}, 0 1px 2px rgba(0,0,0,.8)` }}>{Math.round(shown)}</span>
      </div>
      <div className="mt-1 text-[10px] font-black uppercase leading-none tracking-[0.14em] text-white">{t.label}</div>
      {t.bar !== undefined && (
        <div className="absolute inset-x-1.5 bottom-1 h-[4px] overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, t.bar))}%`, background: t.color }} />
        </div>
      )}
    </div>
  );
}

function HeroNew({ career, kitShirt, kitTrim, glow, figW, figH, onUseCan, onBuyCan, hallChase }: Props & { glow: string; kitShirt: string; kitTrim: string; figW: number; figH: number }) {
  const [skin] = useFigureSkin();
  const style = useAvatarStyle();
  const look = skin === "classic" ? "A1" : style;
  // A win in your last match: celebrate once per match per visit (as Old).
  const last = lastFive(career).at(-1);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (!last || last.res !== "W") return;
    const key = `kib-celebrated-${career.season}-${last.week}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* ignore */ }
    const on = setTimeout(() => {
      try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
      setCelebrate(true);
    }, 450);
    const off = setTimeout(() => setCelebrate(false), 2100);
    return () => { clearTimeout(on); clearTimeout(off); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [career.season, last?.week, last?.res]);
  // No goal. The stadium picture still lines its hoardings up with the same
  // marker the Old look used, so the set behind him does not move.
  const marker = goalBoxFor(figW, figH, 0).hoardings;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col justify-end px-3" style={{ paddingBottom: ARROW_STRIP + 4 }}>
      <div className="relative flex w-full min-h-0 flex-1 items-end justify-center pt-1">
        <div data-goal-line aria-hidden className="pointer-events-none absolute -inset-x-3 h-0" style={{ bottom: marker }} />
        <div data-tour="player" data-home-player className="relative z-10 shrink-0" style={{ width: figW }}>
          <HomePlayer career={career} width={figW} height={figH} where="home" look={look} kitShirt={kitShirt} kitTrim={kitTrim} glow={glow} celebrate={celebrate} />
        </div>
        {hallChase && (
          <div data-hall-chase className="absolute right-0 top-1 z-10 flex max-w-[44%] items-start gap-1 px-1.5 py-1 text-[10px] font-black leading-tight text-amber-200" style={{ background: "rgba(5,8,15,.6)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.45)", borderRadius: 4, textShadow: "0 1px 2px rgba(0,0,0,.8)" }}>
            <span aria-hidden>🏛️</span><span>{hallChase}</span>
          </div>
        )}
      </div>
      <div data-home-cans className="relative z-10 mt-1.5 grid shrink-0 grid-cols-3 gap-1.5" style={{ height: CANS_H }}>
        {KIB_CANS.map((c) => <CanTile key={c.id} can={c} career={career} e={career.energy ?? 100} onUse={onUseCan} onBuy={onBuyCan} mini bold />)}
      </div>
    </div>
  );
}

// ── 3. Achievements and Sponsors, two small links in the middle ────────────

/** The two small links in the middle of Home's bottom strip: Achievements
 *  (v0.23.1, P26/P60: the bottom-left button is Home now, "it could just be on
 *  the homepage") and Sponsors (Harry, 1 Oct 2026, P66: "like being a little
 *  arrow in the bottom right instead"). Plain text, not pills, with a red
 *  count when sponsor offers are waiting. */
function MiddleLinks({ career, onOpen }: { career: CareerState; onOpen: Props["onOpen"] }) {
  const offers = brandsOf(career).offers.length;
  const showAch = isOpen(career, "achievements");
  const showSp = isOpen(career, "sponsors");
  if (!showAch && !showSp) return null;
  const text = "kib-press flex items-center gap-1 px-1 py-1 text-[11px] font-black uppercase leading-none tracking-wide text-white";
  const shadow = { textShadow: "0 1px 3px rgba(0,0,0,.95), 0 0 6px rgba(0,0,0,.8)" };
  return (
    <div className="absolute bottom-1 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
      {showAch && (
        <button type="button" data-tour="achievements" onClick={() => onOpen("achievements")} aria-label="Achievements" className={text} style={shadow}>
          <span className="text-[14px] leading-none">⭐</span>
          <span className="max-[379px]:hidden">Achievements</span>
        </button>
      )}
      {showSp && (
        <button type="button" onClick={() => onOpen("sponsors")} aria-label={offers ? `Sponsors: ${offers} offer${offers === 1 ? "" : "s"} waiting` : "Sponsors"} className={text} style={shadow}>
          Sponsors
          {offers > 0 && <span className="grid h-[15px] min-w-[15px] place-items-center bg-red-500 px-1 text-[10px] leading-none text-white">{offers}</span>}
          <span className="text-[17px] leading-none text-emerald-300">›</span>
        </button>
      )}
    </div>
  );
}

function prefersReducedMotionSafe(): boolean {
  return typeof window !== "undefined" && prefersReducedMotion();
}

/** `compact`: a shorter can picture, for the match-day screen (MatchdayScreen.tsx). */
export function CanTile({ can: c, career, e, onUse, onBuy, compact = false, mini = false, bold = false }: { can: KibCan; career: CareerState; e: number; onUse: (id: KibCan["id"]) => void; onBuy: (can: KibCan) => void; compact?: boolean; mini?: boolean; bold?: boolean }) {
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
          <span className={`absolute rounded-full text-center font-black tabular-nums text-gray-950 ${bold ? "-bottom-1.5 -right-3 min-w-[24px] px-1.5 text-[13px] leading-[18px]" : "-bottom-1 -right-1.5 min-w-[18px] px-1 text-[9.5px] leading-[14px]"}`}
            style={{ background: `linear-gradient(180deg, ${tint(accent, 0.35)}, ${accent})`, boxShadow: `0 1px 4px ${rgba(accent, 0.6)}` }}>×{Math.round(shownCount)}</span>
          {drinking > 0 && (
            <div key={`d${drinking}`} className="pointer-events-none absolute inset-0">
              <Drips trigger={drinking} color={accent} />
              <FloatText trigger={drinking} motion="tick" text="−1" className="left-0 top-0 text-[11px] text-white" style={{ textShadow: `0 0 6px ${accent}` }} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate font-black leading-tight text-white ${bold ? "text-[12.5px]" : "text-[11px]"}`}>{c.name.replace(" KIB Can", "")}</div>
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

