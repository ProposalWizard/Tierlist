"use client";

/**
 * THE MIDDLE HOME SCREEN — the best-looking screen in the game.
 *
 * Harry, 28 Sep 2026: "The home screen should look the best, and right now it
 * doesn't." Top to bottom (28 Sep, later: "put [the next match] under the
 * avatar right before cans"):
 *   1. you, centred and big, in the club kit, under floodlights, with your
 *      name, crest, number, position and three polished pills (rating,
 *      money, age);
 *   2. the next match — both crests big, a styled "vs", the date and how many
 *      days away — with your last five results underneath it;
 *   3. energy and the KIB cans — the real can pictures, lit in their own
 *      colours, with Use and Buy;
 *   4. sponsors — offers waiting, your deals, or how near the first slot is.
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
import { useEffect, useState } from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, type KibCan } from "@/lib/star/shopData";
import { kitsOf } from "@/lib/star/kits";
import { formatMoney } from "@/lib/star/money";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { divisionOf, leagueNameFor, fixtureTimestamp } from "@/lib/star/calendar";
import ClubBadge from "./ClubBadge";
import KibCanIcon from "./KibCanIcon";
import { setPieceDuties } from "@/lib/star/setPieces";
import { starStatus } from "@/lib/star/starPoints";
import { attributeOverall } from "@/lib/star/rating";
import StarRatingSheet from "./StarRatingSheet";
import { brandsOf } from "@/lib/star/sponsorDeals";
import PlayerAvatar, { useAvatarStyle } from "./PlayerAvatar";
import FigureSkinToggle from "./FigureSkinToggle";
import {
  ClubCard, Pill, StatBar, levelColors, PressButton, RiseIn, Glow, Stadium,
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

export default function HomeHub(p: Props) {
  const { career } = p;
  const { shirt, trim, glow } = useClubTheme(career);
  return (
    <div className="space-y-2.5 pb-3">
      <RiseIn onPageActive index={0}><Hero {...p} glow={glow} kitShirt={shirt} kitTrim={trim} /></RiseIn>
      <RiseIn onPageActive index={1}><NextMatchCard {...p} glow={glow} /></RiseIn>
      {/* KIB cans, then energy. "Your shop items" moved back to the Shop
          page (Mikey, 28 Sep 2026: "get rid of the shop thing at the bottom
          of like what you currently own"). */}
      {/* Energy and the cans in ONE short card (Harry, 30 Sep 2026: "the
          energy cans, they're being off the screen, it's kind of jarring").
          Was a 225px cans card plus a 68px energy card. */}
      <RiseIn onPageActive index={2}><Cans {...p} glow={glow} /></RiseIn>
    </div>
  );
}

// ── 2. Next match + last five ───────────────────────────────────────────────

function NextMatchCard({ career, nextFixture, nextMatchDate, myTeam, glow }: Props & { glow: string }) {
  const five = lastFive(career);
  if (!nextFixture) {
    return (
      <ClubCard glow={glow} className="rounded-2xl p-3 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Season complete</div>
        <div className="mt-0.5 text-[12px] font-bold text-white/80">Every fixture is played — the awards are next.</div>
        <LastFive five={five} />
      </ClubCard>
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
    <ClubCard duel={[hg, ag]} className="relative overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300 ring-1 ring-emerald-300/30">Next match</span>
        <span className="truncate pl-2 text-[10px] font-black uppercase tracking-wider text-white/60">{comp}</span>
      </div>
      {/* Two equal columns either side of a fixed-width middle, crests on one
          line and VS dead centre between them (Mikey, 28 Sep 2026: "the VS
          doesn't look centered… they're on different levels"). Your club is
          outlined instead of a "YOU" label under it. */}
      <div className="grid grid-cols-[1fr_64px_1fr] items-start gap-1 px-2 pt-1">
        <TeamSide club={home} kitShirt={homeKit.shirt} kitTrim={homeKit.trim} you={home === myTeam} />
        <div className="flex h-[50px] items-center justify-center">
          <span
            className="bg-gradient-to-b from-white to-white/50 bg-clip-text text-[26px] font-black italic leading-none tracking-tighter text-transparent"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.6))" }}
          >VS</span>
        </div>
        <TeamSide club={away} kitShirt={awayKit.shirt} kitTrim={awayKit.trim} you={away === myTeam} />
      </div>
      <div className="flex items-center justify-center gap-2 pb-1.5 pt-0.5">
        <span className="whitespace-nowrap text-[11px] font-black text-white">{nextMatchDate ?? `Week ${nextFixture.week}`}</span>
        <span className={`whitespace-nowrap rounded-full px-2 py-[1px] text-[10px] font-black ${days <= 1 ? "bg-amber-400 text-gray-950" : "bg-white/12 text-amber-200 ring-1 ring-white/15"}`}>
          ⏱ {when}
        </span>
      </div>
      <div className="border-t border-white/10 bg-black/25 px-2.5 pb-2 pt-1.5">
        <LastFive five={five} />
      </div>
    </ClubCard>
  );
}

function TeamSide({ club, kitShirt, kitTrim, you }: { club: string; kitShirt: string; kitTrim: string; you: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className={`relative grid h-[50px] w-[50px] place-items-center rounded-full ${you ? "ring-2 ring-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.7)]" : ""}`}>
        <Glow color={glowOf(kitShirt, kitTrim)} alpha={0.55} className="inset-1 blur-md" />
        <div className="relative" style={{ filter: "drop-shadow(0 3px 5px rgba(0,0,0,.55))" }}>
          <ClubBadge club={club} kit={{ shirt: kitShirt, trim: kitTrim }} size={44} />
        </div>
      </div>
      <div className={`mt-0.5 w-full truncate text-center text-[12px] font-black ${you ? "text-emerald-300" : "text-white"}`}>{short(club)}</div>
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
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Last 5</span>
        {five.some((f) => f.rating !== undefined) && (
          <span className="text-[9px] font-black text-white/45">
            avg rating <span className="text-amber-300">{(five.filter((f) => f.rating !== undefined).reduce((s, f) => s + (f.rating ?? 0), 0) / five.filter((f) => f.rating !== undefined).length).toFixed(1)}</span>
          </span>
        )}
      </div>
      {five.length === 0 ? (
        <div className="text-[11px] font-bold text-white">No matches yet — your first is up next.</div>
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

// ── 1. You ──────────────────────────────────────────────────────────────────

function Hero({ career, glow, kitShirt, kitTrim, onOpen }: Props & { glow: string; kitShirt: string; kitTrim: string }) {
  const look = useAvatarStyle();
  // The star rating is the CAREER one (starPoints.ts); ability shows as Overall.
  const star = starStatus(career);
  const rating = useCountUp(star.stars);
  const money = useCountUp(career.money, 900);
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
      {/* Age top-left, money top-right (Mikey, 28 Sep 2026). */}
      <div className="absolute left-3 top-[46px] z-10"><Pill label="Age" value={String(career.player.age)} /></div>
      <div className="absolute right-3 top-[46px] z-10"><Pill label="Money" value={`★ ${formatMoney(Math.round(money))}`} valueClass="text-yellow-200" /></div>
      {starPass && <StarRatingSheet career={career} onClose={() => setStarPass(false)} />}
      {/* Players' look, 3D (the default) or Classic — Harry, 28 Sep 2026.
          Under Mikey's money pill (it covered the right floodlight at top-2),
          and 32px tall so a thumb can hit it. */}
      <FigureSkinToggle className="absolute right-3 top-[90px] z-10 min-h-[32px]" />
      {/* Sponsors, one tap from Home and on the FIRST screen. Harry: "how do
          I even get there? … That feels quite hidden away". 1 Oct 2026: as a
          strip under the cans it sat below the first screen of a 390x844
          phone, and under the next-match card it was 6px short of clearing
          the Play button — so it is a pill here, opposite 3D / 2D. */}
      <SponsorsPill career={career} onOpen={onOpen} className="absolute left-3 top-[90px] z-10 min-h-[32px]" />
      <div className="relative flex justify-center pt-1.5">
        {/* 184 tall (was 204, 236 before that), halfway to the 164 tried on
            28 Sep 2026 (Mikey: "go in between those two figures"). 204 tall (was 236) so that on an iPhone 13 the next-match card
            under this hero shows its crests above the bottom bar, not just
            its label. The figure crops its empty top strip to stay big. */}
        <div className={celebrate ? "kib-hop" : "kib-breathe"}>
          <PlayerAvatar career={career} width={172} height={204} look={look} celebrate={celebrate} />
        </div>
        {celebrate && <Burst colors={[kitShirt, kitTrim, "#fde047", "#ffffff"]} className="left-1/2 top-[38%]" />}
      </div>
      <div className="relative -mt-4 bg-gradient-to-b from-transparent via-black/45 to-black/70 px-3 pb-2.5 pt-3 text-center">
        {/* The NAME is centred; the badge hangs off its left (Mikey, 28 Sep
            2026: "the name should be centered and then the club badge should
            just be on the left of the name"). */}
        <div className="relative mx-auto w-fit max-w-[80%]">
          <div className="absolute right-full top-1/2 mr-2 -translate-y-1/2" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.6))" }}>
            <ClubBadge club={career.player.club} kit={{ shirt: kitShirt, trim: kitTrim }} size={28} />
          </div>
          {/* A dark plate behind the name: on the club-colour glow a bare
              white name washed out (Harry's Plymouth screenshot, 28 Sep). */}
          {/* No dark box behind the name (Mikey: "why does it have a black
              translucent colour behind it"); a heavier shadow keeps it
              readable on any club's glow. */}
          <div className="min-w-0 truncate px-1 text-[21px] font-black leading-tight text-white" style={{ textShadow: "0 1px 0 rgba(0,0,0,1), 0 2px 10px rgba(0,0,0,.95), 0 0 2px rgba(0,0,0,.9)" }}>
            {career.player.firstName} {career.player.lastName}
          </div>
        </div>
        {/* The club · number · position line is gone (Mikey: the badge, the
            shirt number and the club are already on screen). Rating sits
            under the name and opens the Star Pass. */}
        {/* Set-piece tags you've earned: PK = penalty taker, FK = free-kick
            taker (Mikey, 29 Sep 2026: "like a tag that you've earned"). */}
        {(duties.penalties || duties.freeKicks) && (
          <div className="mt-1 flex justify-center gap-1.5">
            {duties.penalties && <DutyTag code="PK" label="Penalty taker" />}
            {duties.freeKicks && <DutyTag code="FK" label="Free-kick taker" />}
          </div>
        )}
        <button
          onClick={() => setStarPass(true)}
          className="kib-press mt-1.5 inline-flex"
          aria-label="Star rating — see how it is made up"
        >
          <Pill gold label="Rating ›" value={`★ ${rating.toFixed(1)}`} />
        </button>
        {/* The way to the next 0.1★, and your overall (how good you are now). */}
        <div className="mx-auto mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-black/60">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200" style={{ width: `${Math.max(3, star.toNext * 100)}%` }} />
        </div>
        <div className="mt-1 text-[10.5px] font-black uppercase tracking-wider text-white">
          {star.gate ? `🔒 ★${star.gate.cap.toFixed(1)} gate · ` : ""}Overall {Math.round(attributeOverall(career.skills))}
        </div>
      </div>
    </ClubCard>
  );
}

// ── 3. Energy and the cans ──────────────────────────────────────────────────

function Cans({ career, onUseCan, onBuyCan, glow }: Props & { glow: string }) {
  const e = Math.max(0, Math.min(100, Math.round(career.energy)));
  const shown = useCountUp(e, 900);
  const fill = levelColors(e);
  return (
    <ClubCard glow={glow} className="rounded-2xl p-2.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.14em] text-white">⚡ Energy</span>
        {/* A sheen races along the bar the moment energy goes UP (a can was drunk). */}
        <StatBar value={e} colors={fill} className="h-3 min-w-0 flex-1" />
        <span className="w-[44px] shrink-0 text-right text-[16px] font-black leading-none tabular-nums text-white" style={{ textShadow: `0 0 12px ${rgba(fill[0], 0.6)}` }}>{Math.round(shown)}%</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {KIB_CANS.map((c) => <CanTile key={c.id} can={c} career={career} e={e} onUse={onUseCan} onBuy={onBuyCan} mini />)}
      </div>
    </ClubCard>
  );
}

/** Your sponsors, one tap from Home: offers waiting, or your deals and what
 *  they pay, or how close the first slot is (a bar, never a number). */
function SponsorsPill({ career, onOpen, className = "" }: { career: CareerState; onOpen: Props["onOpen"]; className?: string }) {
  const b = brandsOf(career);
  const offers = b.offers.length;
  const deals = b.deals.length;
  const label = offers ? `Sponsors: ${offers} offer${offers === 1 ? "" : "s"} waiting`
    : deals ? `Sponsors: ${deals} deal${deals === 1 ? "" : "s"}` : "Sponsors";
  return (
    <button type="button" onClick={() => onOpen("sponsors")} aria-label={`Open ${label}`} title={label}
      className={`kib-press flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white transition active:scale-95 ${className}`}
      style={{ background: "rgba(0,0,0,.55)", boxShadow: "inset 0 0 0 1px rgba(52,211,153,.55), 0 0 10px rgba(52,211,153,.3)" }}>
      <span className="text-[13px] leading-none">🤝</span>
      <span>Sponsors</span>
      {offers > 0 && <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[10px] leading-none text-white">{offers}</span>}
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
  const effect = c.effect === "curve" ? "Curve shots" : c.effect === "extraTouch" ? "Extra touch" : `+${c.restore} energy`;
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
