"use client";

/**
 * THE CAREER OVERVIEW — the end of a career, as one screen of seven pages.
 *
 * Leo, 5 Oct 2026: "a very well designed and perfected career overview …
 * shows it in a very well organized and designed way so it doesn't look like
 * just a bunch of text."
 *
 *   Career · Seasons · Who won · Clubs · Trophies · Records · Life
 *
 * One row of edge arrows flips the page (or swipe), the house pattern
 * (ui/Nav.tsx); the dots under it say how many pages there are. Pictures
 * first: crests, trophy art, bars, a legacy ring. Every number comes from
 * lib/star/careerOverview.ts, so the test page (/star-retirement-dev) and a
 * real retirement draw the same thing. Anything a save never recorded is
 * blacked out, never guessed (house rule).
 */
import type React from "react";
import { useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import {
  careerOverview, DIVISION_SHORT, type CareerOverviewData, type OverviewSeason,
} from "@/lib/star/careerOverview";
import { leagueNameFor } from "@/lib/star/calendar";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import { formatMoney } from "@/lib/star/money";
import ClubBadge from "./ClubBadge";
import TrophyImage from "./TrophyImage";
import StylePicture from "./StylePicture";
import {
  ScreenShell, FlatPanel, StatBar, CountUp, RiseIn, EdgeArrows, BottomBar, BarButton, HelpDot, clubTheme, rgba,
} from "./ui";
import { Rays } from "./ui/Screen";
import { ShareCardSheet } from "./ShareCard";

export interface OverviewAction { icon?: React.ReactNode; label: string; onClick: () => void; primary?: boolean }

export const OVERVIEW_PAGES = [
  { id: "career", label: "Career", icon: "🏟️" },
  { id: "seasons", label: "Seasons", icon: "📅" },
  { id: "winners", label: "Who won", icon: "🏆" },
  { id: "clubs", label: "Clubs", icon: "🛡️" },
  { id: "trophies", label: "Trophies", icon: "🥇" },
  { id: "records", label: "Records", icon: "📈" },
  { id: "life", label: "Life", icon: "💰" },
] as const;
export type OverviewPage = (typeof OVERVIEW_PAGES)[number]["id"];

const GOLD = "#fbbf24";
const GOLD_LIGHT = "#fde68a";

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "").replace(/^(FC|AFC)\s+/i, "");
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
/** Trophy names that fit a small tile. */
const TILE_NAME: Record<string, string> = {
  "Champions League": "Champions Lg", "Premier League": "Premier Lg", "Europa League": "Europa Lg",
  "European Championship": "Euros", "Conference League": "Conference", "Community Shield": "Comm. Shield",
  "Player of the Season": "Player of Season", "Player of the Month": "Player of Month",
};
const tileName = (n: string) => TILE_NAME[n] ?? n;
const surname = (name: string) => {
  const parts = name.split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
};
const Badge = ({ club, size }: { club: string; size: number }) => <ClubBadge club={club} kit={kitsOf(club).home} size={size} />;

export default function CareerOverview({ career, actions, startPage = "career", share }: {
  career: CareerState;
  /** The bottom bar: what you can do from here (the parent decides). */
  actions: OverviewAction[];
  startPage?: OverviewPage;
  /**
   * Share buttons on the first page (Leo, 6 Oct 2026): the picture (the share
   * card, ShareCard.tsx) always; a link (an online share code) when the
   * parent can make one.
   */
  share?: { onLink?: () => void };
}) {
  const o = useMemo(() => careerOverview(career), [career]);
  const [page, setPage] = useState<OverviewPage>(startPage);
  const [picture, setPicture] = useState(false);
  const i = OVERVIEW_PAGES.findIndex(p => p.id === page);
  const go = (d: number) => {
    setPage(OVERVIEW_PAGES[(i + d + OVERVIEW_PAGES.length) % OVERVIEW_PAGES.length].id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  const prev = OVERVIEW_PAGES[(i - 1 + OVERVIEW_PAGES.length) % OVERVIEW_PAGES.length];
  const next = OVERVIEW_PAGES[(i + 1) % OVERVIEW_PAGES.length];
  const glow = clubTheme(o.finalClub).glow;

  // Swipe left/right to flip pages; a mostly-vertical drag is a scroll.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current; touch.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
  };

  return (
    <ScreenShell
      glow={glow}
      title=""
      bare
      tone="calm"
      bottomBar={actions.length > 0 ? (
        <BottomBar>
          {actions.map(a => <BarButton key={a.label} icon={a.icon} label={a.label} onClick={a.onClick} primary={a.primary} />)}
        </BottomBar>
      ) : undefined}
    >
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} data-overview-page={page}>
        <div className="sticky top-0 z-20 -mx-3 px-3 pb-1.5 pt-2" style={{ background: "linear-gradient(180deg, rgba(5,8,15,.97) 70%, rgba(5,8,15,0))" }}>
          <EdgeArrows
            prev={{ icon: prev.icon, label: prev.label, onClick: () => go(-1) }}
            next={{ icon: next.icon, label: next.label, onClick: () => go(1) }}
          >
            <span className="mr-1">{OVERVIEW_PAGES[i].icon}</span>{OVERVIEW_PAGES[i].label}
          </EdgeArrows>
          {/* Every page one tap away. Dots alone left no clear way back to
              the first page (Mikey's playtest, 8 Oct 2026: "very unclear how
              I was supposed to get back to that career round up"). */}
          <div className="mt-1.5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Career pages" data-overview-tabs>
            {OVERVIEW_PAGES.map((p, k) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={k === i}
                onClick={() => { setPage(p.id); window.scrollTo({ top: 0 }); }}
                className="flex shrink-0 items-center gap-1 px-2 py-1 text-[10.5px] font-black uppercase tracking-wide transition-colors"
                style={{
                  borderRadius: 4,
                  background: k === i ? GOLD : "rgba(255,255,255,.07)",
                  color: k === i ? "#160f02" : "rgba(255,255,255,.85)",
                }}
              >
                <span aria-hidden>{p.icon}</span>{p.label}
              </button>
            ))}
          </div>
        </div>
        <RiseIn key={page}>
          {page === "career" && <CareerPage o={o} onOpen={setPage} share={share ? { onPicture: () => setPicture(true), onLink: share.onLink } : undefined} />}
          {page === "seasons" && <SeasonsPage o={o} />}
          {page === "winners" && <WinnersPage o={o} />}
          {page === "clubs" && <ClubsPage o={o} />}
          {page === "trophies" && <TrophiesPage o={o} />}
          {page === "records" && <RecordsPage o={o} />}
          {page === "life" && <LifePage o={o} />}
        </RiseIn>
      </div>
      {picture && <ShareCardSheet career={career} onClose={() => setPicture(false)} />}
    </ScreenShell>
  );
}

// ── Shared pieces ────────────────────────────────────────────────────────────

export function Heading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-1.5 mt-4 flex items-center justify-between gap-2">
      <div className="text-[10.5px] font-black uppercase tracking-[0.22em] text-amber-300">{children}</div>
      {right}
    </div>
  );
}

export function BigNumber({ value, label, gold = false }: { value: number | string; label: string; gold?: boolean }) {
  return (
    <div className="px-1 py-2 text-center" style={{ background: gold ? "linear-gradient(180deg, rgba(251,191,36,.22), rgba(251,191,36,.05))" : "rgba(255,255,255,.05)", boxShadow: `inset 0 0 0 1px ${gold ? "rgba(251,191,36,.45)" : "rgba(255,255,255,.08)"}` }}>
      <div className={`sk-num text-[26px] leading-none tabular-nums ${gold ? "text-amber-200" : "text-white"}`}>
        {typeof value === "number" ? <CountUp value={value} ms={1100} /> : value}
      </div>
      <div className="mt-1 text-[9.5px] font-black uppercase tracking-wider text-white/70">{label}</div>
    </div>
  );
}

/** A slot a save never recorded: blacked out, no explanation (house rule). */
function Blank({ w = "100%", h = 14 }: { w?: number | string; h?: number }) {
  return <span className="inline-block align-middle" style={{ width: w, height: h, background: "rgba(0,0,0,.6)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }} />;
}

// ── 1. Career ────────────────────────────────────────────────────────────────

function LegacyRing({ score }: { score: number }) {
  const r = 58, c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, score));
  return (
    <div className="relative mx-auto grid h-[150px] w-[150px] place-items-center">
      <Rays color={GOLD_LIGHT} size={230} />
      <svg width={150} height={150} viewBox="0 0 150 150" className="absolute inset-0" aria-hidden>
        <defs>
          <linearGradient id="ov-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="55%" stopColor={GOLD} />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
        <circle cx={75} cy={75} r={r} fill="rgba(5,8,15,.82)" stroke="rgba(255,255,255,.1)" strokeWidth={11} />
        <circle
          cx={75} cy={75} r={r} fill="none" stroke="url(#ov-gold)" strokeWidth={11} strokeLinecap="round"
          strokeDasharray={`${(shown / 100) * c} ${c}`} transform="rotate(-90 75 75)"
          style={{ filter: "drop-shadow(0 0 6px rgba(251,191,36,.55))" }}
        />
      </svg>
      <div className="relative text-center">
        <div className="sk-num text-[44px] leading-none text-white"><CountUp value={Math.round(shown)} ms={1400} /></div>
        <div className="mt-0.5 text-[9.5px] font-black uppercase tracking-[0.3em] text-amber-200">Legacy</div>
      </div>
    </div>
  );
}

function CareerPage({ o, onOpen, share }: {
  o: CareerOverviewData; onOpen: (p: OverviewPage) => void;
  share?: { onPicture: () => void; onLink?: () => void };
}) {
  const t = o.totals;
  const fw = o.farewell;
  return (
    <>
      {/* The name, the years, the verdict. */}
      <div className="pt-2 text-center">
        <span className="inline-block px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-amber-200" style={{ background: "rgba(251,191,36,.14)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.4)", borderRadius: 2 }}>
          {o.retired ? "Career over" : "If you retired now"} · {o.seasonsPlayed} seasons
        </span>
        <h1 className="mt-2 bg-gradient-to-b from-white to-white/70 bg-clip-text text-[34px] uppercase leading-[1.02] tracking-tight text-transparent" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,.7))" }}>
          {o.name}
        </h1>
        <div className="mt-1 text-[12px] font-bold text-white/85">
          {o.position} · {o.nation} · {o.years} · {o.retired ? `retired at ${o.ageAtEnd}` : `age ${o.ageAtEnd}`}
        </div>
      </div>

      <div className="mt-3">
        <LegacyRing score={o.verdict.score} />
        <div className="mt-2 text-center">
          <div className="kit-text-shine text-[28px] font-black uppercase leading-none" style={{ backgroundImage: "linear-gradient(100deg,#fde68a 20%,#ffffff 45%,#fbbf24 60%,#fde68a 80%)" }}>
            {o.verdict.title}
          </div>
          <p className="mx-auto mt-1.5 max-w-[300px] text-[12px] font-semibold leading-snug text-white/85">{o.verdict.summary}</p>
        </div>
      </div>

      {/* Share it: a picture for WhatsApp or Instagram, or a link. */}
      {share && (
        <div className={`mt-3 grid gap-1.5 ${share.onLink ? "grid-cols-2" : "grid-cols-1"}`}>
          <button onClick={share.onPicture} data-share-picture className="kib-press flex items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-black uppercase tracking-wide text-gray-950" style={{ background: GOLD, borderRadius: 2 }}>
            <span aria-hidden>📸</span> Share picture
          </button>
          {share.onLink && (
            <button onClick={share.onLink} data-share-link className="kib-press flex items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-black uppercase tracking-wide text-white" style={{ background: "rgba(255,255,255,.08)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.55)", borderRadius: 2 }}>
              <span aria-hidden>🔗</span> Share link
            </button>
          )}
        </div>
      )}

      {/* The farewell match, its own line: it counts in nothing else. */}
      {fw && fw.yourScore !== undefined && fw.theirScore !== undefined && (
        <div data-overview-farewell className="mt-3 flex items-center gap-2.5 px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(251,191,36,.2), rgba(255,255,255,.03))", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.4)" }}>
          <span className="text-[22px]" aria-hidden>👏</span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Farewell match</div>
            <div className="truncate text-[13px] font-bold text-white">{fw.team ?? short(fw.club)} v {fw.opponent}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="sk-num text-[22px] leading-none text-white">{fw.yourScore}–{fw.theirScore}</div>
            <div className="text-[10px] font-black uppercase tracking-wider text-white/70">{fw.goals ?? 0} goal{fw.goals === 1 ? "" : "s"}</div>
          </div>
        </div>
      )}

      {/* Six numbers that tell it. */}
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        <BigNumber value={t.apps} label="Apps" />
        <BigNumber value={t.goals} label="Goals" />
        <BigNumber value={t.assists} label="Assists" />
        <BigNumber value={t.trophies} label="Trophies" gold={t.trophies > 0} />
        <BigNumber value={t.ballonDors} label="Ballon d'Or" gold={t.ballonDors > 0} />
        <BigNumber value={t.caps} label="Caps" />
      </div>

      {/* The journey: every spell, in order. */}
      <Heading right={<button onClick={() => onOpen("clubs")} className="text-[10.5px] font-black uppercase tracking-wider text-white/70">Clubs ›</button>}>The journey</Heading>
      <Journey o={o} />

      {/* Goals, season by season, coloured by the club you were at. */}
      <Heading right={<span className="text-[10.5px] font-bold text-white/60">age {o.seasons[0]?.age}–{o.ageAtEnd}</span>}>Goals by season</Heading>
      <FlatPanel bleed fade="none" edge className="px-3 py-2.5">
        <ArcChart o={o} />
      </FlatPanel>

      {o.peak && (
        <div className="mt-2 flex items-center gap-2.5 px-2.5 py-2" style={{ background: `linear-gradient(90deg, ${rgba(clubTheme(o.peak.club).glow, 0.35)}, rgba(255,255,255,.03))`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}>
          <span className="text-[22px]">👑</span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Best season · {o.peak.label}</div>
            <div className="truncate text-[13px] font-bold text-white">{short(o.peak.club)}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="sk-num text-[20px] leading-none text-white">{o.peak.goals}<span className="ml-0.5 text-[11px] text-white/60">G</span> {o.peak.assists}<span className="ml-0.5 text-[11px] text-white/60">A</span></div>
          </div>
        </div>
      )}

      {/* The cabinet, in short. */}
      <Heading right={<button onClick={() => onOpen("trophies")} className="text-[10.5px] font-black uppercase tracking-wider text-white/70">Trophies ›</button>}>The cabinet</Heading>
      {o.honours.length === 0 ? (
        <div className="py-3 text-center text-[12px] font-bold text-white/60">No trophies</div>
      ) : (
        <CabinetGrid items={o.honours.slice(0, 8)} onOpen={() => onOpen("trophies")} />
      )}
      <div className="h-3" />
    </>
  );
}

/** The cabinet: one tile per trophy, the count on it. Four to a row. */
export function CabinetGrid({ items, onOpen }: { items: { competition: string; count: number }[]; onOpen?: () => void }) {
  const tiles = items.map(h => (
    <div key={h.competition} className="relative flex flex-col items-center px-1 pb-1.5 pt-2" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.3))", boxShadow: "inset 0 -3px 0 rgba(120,72,24,.85), inset 0 0 0 1px rgba(255,255,255,.07)" }}>
      <TrophyImage name={h.competition} height={40} />
      <span className="absolute right-1 top-1 px-1 text-[11px] font-black leading-[15px] text-gray-950" style={{ background: GOLD, borderRadius: 2 }}>×{h.count}</span>
      <span className="mt-1 w-full truncate text-center text-[9px] font-black uppercase tracking-wide text-white/80">{tileName(h.competition)}</span>
    </div>
  ));
  return onOpen
    ? <button onClick={onOpen} className="kib-press grid w-full grid-cols-4 gap-1.5 text-left">{tiles}</button>
    : <div className="grid w-full grid-cols-4 gap-1.5">{tiles}</div>;
}

function Journey({ o }: { o: CareerOverviewData }) {
  return (
    <div className="-mx-3 overflow-x-auto px-3 pb-1" style={{ scrollbarWidth: "none" }}>
      <div className="flex min-w-max items-start">
        {o.spells.map((sp, k) => (
          <div key={`${sp.club}-${sp.from}`} className="flex items-start">
            <div className="flex w-[68px] flex-col items-center text-center">
              <div className="grid h-[54px] w-[54px] place-items-center" style={{ background: `radial-gradient(closest-side, ${rgba(clubTheme(sp.club).glow, 0.55)}, transparent)` }}>
                <Badge club={sp.club} size={42} />
              </div>
              <div className="mt-0.5 w-full truncate text-[11px] font-black text-white">{short(sp.club)}</div>
              <div className="text-[10px] font-bold tabular-nums text-white/65">{sp.years}</div>
            </div>
            {k < o.spells.length - 1 && (
              <div className="flex w-[28px] flex-col items-center pt-[18px]">
                <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden><path d="M0 5h17M13 1l5 4-5 4" stroke="rgba(255,255,255,.55)" strokeWidth="1.6" fill="none" /></svg>
                {sp.feeOut !== undefined && sp.feeOut > 0 && <span className="mt-0.5 text-[9.5px] font-black tabular-nums text-amber-200">★{formatMoney(sp.feeOut)}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Goals each season as bars in the club's colour; the star rating as a line. */
export function ArcChart({ o }: { o: CareerOverviewData }) {
  const W = 340, H = 118, top = 16, bottom = 18;
  const n = Math.max(1, o.arc.length);
  const max = Math.max(1, ...o.arc.map(a => a.goals ?? 0));
  const bw = W / n;
  const y = (g: number) => top + (H - top - bottom) * (1 - g / max);
  const peak = o.peak?.season;
  const stars = o.arc.filter(a => typeof a.stars === "number");
  const sy = (s: number) => top + (H - top - bottom) * (1 - s / 100);
  const ages = o.arc.map((a, k) => ({ k, age: a.age })).filter(({ age, k }) => k === 0 || k === n - 1 || age % 5 === 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Goals by season">
      {[0.5, 1].map(f => <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,.08)" strokeDasharray="3 4" />)}
      {/* The scale on the left: the best season (the crown) is often the
          last bar, and a number on the right sat on top of it. */}
      <text x={1} y={y(max) - 3} textAnchor="start" fontSize="9" fontWeight="800" fill="rgba(255,255,255,.55)">{max}</text>
      {o.arc.map((a, k) => {
        const x = k * bw + bw * 0.14;
        const w = bw * 0.72;
        if (a.goals === undefined) {
          return <rect key={a.season} x={x} y={H - bottom - 6} width={w} height={6} fill="rgba(0,0,0,.6)" />;
        }
        const h = Math.max(2, H - bottom - y(a.goals));
        const club = o.seasons[k]?.club ?? o.finalClub;
        const colour = a.season === peak ? GOLD : clubTheme(club).glow;
        return (
          <g key={a.season}>
            <rect x={x} y={H - bottom - h} width={w} height={h} rx={1} fill={colour} opacity={a.live ? 0.55 : 0.92} />
            {a.season === peak && <text x={x + w / 2} y={H - bottom - h - 3} textAnchor="middle" fontSize="11">👑</text>}
          </g>
        );
      })}
      {stars.length > 1 && (
        <polyline
          fill="none" stroke="rgba(255,255,255,.85)" strokeWidth={1.4} strokeDasharray="2 2"
          points={stars.map(a => `${(a.season - 1) * bw + bw / 2},${sy(a.stars!)}`).join(" ")}
        />
      )}
      {ages.map(({ k, age }) => (
        <text key={k} x={k * bw + bw / 2} y={H - 4} textAnchor="middle" fontSize="9" fontWeight="800" fill="rgba(255,255,255,.6)">{age}</text>
      ))}
    </svg>
  );
}

// ── 2. Seasons ───────────────────────────────────────────────────────────────

function PositionTag({ s }: { s: OverviewSeason }) {
  const w = s.world;
  if (!w || w.position <= 0) return <Blank w={46} h={13} />;
  const champ = w.position === 1;
  const up = w.move === "promoted", down = w.move === "relegated";
  const colour = champ ? GOLD : up ? "#34d399" : down ? "#f87171" : "rgba(255,255,255,.75)";
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-black tabular-nums" style={{ color: colour }}>
      <span className="px-1 text-[9px] text-white/90" style={{ background: "rgba(255,255,255,.12)", borderRadius: 2 }}>{DIVISION_SHORT[w.division]}</span>
      {ordinal(w.position)}{up ? " ↑" : down ? " ↓" : ""}
    </span>
  );
}

const AWARD_ICON: Record<string, string> = { "Golden Boot": "👟", "Player of the Season": "⭐", "Player of the Month": "📅" };

function SeasonsPage({ o }: { o: CareerOverviewData }) {
  const titles = o.totals.leagueTitles;
  const ups = o.seasons.filter(s => s.world?.move === "promoted").length;
  const downs = o.seasons.filter(s => s.world?.move === "relegated").length;
  return (
    <>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        <BigNumber value={o.seasonsPlayed} label="Seasons" />
        <BigNumber value={titles} label="Titles" gold={titles > 0} />
        <BigNumber value={ups} label="Up ↑" />
        <BigNumber value={downs} label="Down ↓" />
      </div>
      <SeasonList o={o} />
      <div className="h-3" />
    </>
  );
}

/** Every season, one row each: club, finish, trophies, goals, assists,
 *  rating. Tap a row for who won what that season. `newestFirst` for a
 *  career still being played (the in-game All seasons page). */
export function SeasonList({ o, newestFirst = false }: { o: CareerOverviewData; newestFirst?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const rows = newestFirst ? [...o.seasons].reverse() : o.seasons;
  return (
    <>
      <div className="mt-3 grid grid-cols-[50px_1fr_26px_26px_34px] items-end gap-1 px-2 text-[9.5px] font-black uppercase tracking-wider text-white/55">
        <span>Season</span><span>Club</span><span className="text-center">G</span><span className="text-center">A</span><span className="text-center">Avg</span>
      </div>
      <div className="mt-1 space-y-1">
        {rows.map(s => {
          const isOpen = open === s.season;
          const glow = clubTheme(s.club).glow;
          return (
            <div key={s.season} style={{ background: `linear-gradient(90deg, ${rgba(glow, 0.22)}, rgba(255,255,255,.03) 60%)`, boxShadow: `inset 3px 0 0 ${glow}, inset 0 0 0 1px rgba(255,255,255,.06)` }}>
              <button onClick={() => setOpen(isOpen ? null : s.season)} className="grid w-full grid-cols-[50px_1fr_26px_26px_34px] items-center gap-1 px-2 py-1.5 text-left">
                <span>
                  <span className="block text-[12.5px] font-black tabular-nums text-white">{s.label}</span>
                  <span className="block text-[9.5px] font-bold text-white/60">age {s.age}{s.live ? " · now" : ""}</span>
                </span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Badge club={s.club} size={20} />
                    <span className="truncate text-[12px] font-black text-white">{short(s.club)}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1">
                    <PositionTag s={s} />
                    {s.trophies.map((t, k) => <span key={k} title={t}><TrophyImage name={t} height={15} /></span>)}
                    {s.ballonDorRank === 1 && <span title="Ballon d'Or"><TrophyImage name="Ballon d'Or" height={15} /></span>}
                    {s.awards.map(a => <span key={a} className="text-[11px]" title={a}>{AWARD_ICON[a.replace(/ ×\d+$/, "")] ?? "🏅"}{/×(\d+)/.test(a) ? <span className="text-[9px] font-black text-white/70">{a.match(/×\d+/)![0]}</span> : null}</span>)}
                    {s.ballonDorRank !== undefined && s.ballonDorRank > 1 && <span className="px-1 text-[9px] font-black text-amber-200" style={{ background: "rgba(251,191,36,.15)", borderRadius: 2 }}>BdO #{s.ballonDorRank}</span>}
                  </span>
                </span>
                {s.stats ? (
                  <>
                    <span className="sk-num text-center text-[16px] tabular-nums text-white">{s.stats.goals}</span>
                    <span className="sk-num text-center text-[16px] tabular-nums text-white/85">{s.stats.assists}</span>
                    <span className="text-center text-[11.5px] font-black tabular-nums text-amber-200">{s.stats.avgRating ? s.stats.avgRating.toFixed(1) : "—"}</span>
              </>
              ) : (
                <><Blank w={22} /><Blank w={22} /><Blank w={28} /></>
              )}
            </button>
            {isOpen && <SeasonDetail s={s} o={o} />}
          </div>
        );
      })}
    </div>
    </>
  );
}

function SeasonDetail({ s, o }: { s: OverviewSeason; o: CareerOverviewData }) {
  const w = s.world;
  const rows: { label: string; club?: string; person?: string }[] = w ? [
    { label: leagueNameFor(w.division), club: w.winners.league },
    { label: "FA Cup", club: w.winners.faCup },
    { label: "League Cup", club: w.winners.leagueCup },
    ...(w.winners.championsLeague ? [{ label: "Champions League", club: w.winners.championsLeague }] : []),
    ...(w.winners.europaLeague ? [{ label: "Europa League", club: w.winners.europaLeague }] : []),
    ...(w.ballonDor ? [{ label: "Ballon d'Or", club: w.ballonDor.club, person: w.ballonDor.winner }] : []),
  ] : [];
  return (
    <div className="px-2 pb-2">
      {s.stats && (
        <div className="mb-1.5 flex gap-3 text-[10.5px] font-bold text-white/75">
          <span><b className="text-white">{s.stats.apps}</b> apps</span>
          <span><b className="text-white">{s.stats.motm}</b> Star Man</span>
          {s.arrivedFrom && <span>from <b className="text-white">{short(s.arrivedFrom.club)}</b>{s.arrivedFrom.fee > 0 ? ` · ★${formatMoney(s.arrivedFrom.fee)}` : ""}</span>}
        </div>
      )}
      <div className="text-[9.5px] font-black uppercase tracking-[0.18em] text-amber-300">Who won {s.label}</div>
      {w ? (
        <div className="mt-1 space-y-0.5">
          {rows.map(r => {
            const you = r.person ? r.person === o.name : r.club === s.club;
            return (
              <div key={r.label} className="flex items-center gap-2 px-1.5 py-1" style={{ background: you ? "rgba(251,191,36,.16)" : "rgba(0,0,0,.25)", boxShadow: you ? "inset 0 0 0 1px rgba(251,191,36,.5)" : undefined }}>
                <span className="w-[104px] shrink-0 truncate text-[10.5px] font-bold text-white/70">{r.label}</span>
                {r.club && <Badge club={r.club} size={16} />}
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-black text-white">{r.person ?? (r.club ? short(r.club) : "—")}</span>
                {you && <span className="text-[10px] font-black text-amber-200">YOU</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-1 space-y-1">{[0, 1, 2].map(k => <Blank key={k} h={18} />)}</div>
      )}
    </div>
  );
}

// ── 3. Who won ───────────────────────────────────────────────────────────────

function WinnersPage({ o }: { o: CareerOverviewData }) {
  const [open, setOpen] = useState<number | null>(null);
  const cols: { key: "league" | "faCup" | "leagueCup" | "championsLeague"; label: string }[] = [
    { key: "league", label: "League" }, { key: "faCup", label: "FA Cup" },
    { key: "leagueCup", label: "Lg Cup" }, { key: "championsLeague", label: "UCL" },
  ];
  const Cell = ({ club, you }: { club?: string; you: boolean }) => (
    <span className="grid place-items-center">
      {club ? (
        <span className="grid h-[30px] w-[30px] place-items-center" style={you ? { background: "radial-gradient(closest-side, rgba(251,191,36,.55), transparent)", boxShadow: "0 0 0 2px #fbbf24", borderRadius: 999 } : undefined}>
          <Badge club={club} size={24} />
        </span>
      ) : <Blank w={24} h={24} />}
    </span>
  );
  return (
    <>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-[11px] font-bold text-white/75">Gold ring: you won it.</div>
        <HelpDot text="Tap a season for the names. The league is the division you played in that season." />
      </div>
      <div className="mt-2 grid grid-cols-[46px_repeat(4,1fr)_minmax(0,1.5fr)] items-end gap-1 px-1.5 text-[9px] font-black uppercase tracking-wider text-white/60">
        <span>Season</span>
        {cols.map(c => <span key={c.key} className="text-center">{c.label}</span>)}
        <span className="text-center">Ballon d&apos;Or</span>
      </div>
      <div className="mt-1 space-y-1">
        {o.seasons.map(s => {
          const w = s.world;
          const isOpen = open === s.season;
          return (
            <div key={s.season} style={{ background: "rgba(255,255,255,.04)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
              <button onClick={() => setOpen(isOpen ? null : s.season)} className="grid w-full grid-cols-[46px_repeat(4,1fr)_minmax(0,1.5fr)] items-center gap-1 px-1.5 py-1 text-left">
                <span>
                  <span className="block text-[12px] font-black tabular-nums text-white">{s.label}</span>
                  <span className="block text-[9px] font-bold text-white/55">{w ? DIVISION_SHORT[w.division] : ""}</span>
                </span>
                {cols.map(c => {
                  const club = w?.winners[c.key];
                  return <Cell key={c.key} club={w ? club : undefined} you={!!w && club === s.club} />;
                })}
                <span className="min-w-0 text-center">
                  {w?.ballonDor ? (
                    w.ballonDor.yourRank === 1 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10.5px] font-black text-gray-950" style={{ background: GOLD, borderRadius: 2 }}>★ YOU</span>
                    ) : (
                      <span className="flex min-w-0 items-center justify-center gap-1">
                        <Badge club={w.ballonDor.club} size={14} />
                        <span className="truncate text-[10.5px] font-bold text-white/85">{surname(w.ballonDor.winner)}</span>
                      </span>
                    )
                  ) : <Blank w={56} h={14} />}
                </span>
              </button>
              {isOpen && <SeasonDetail s={s} o={o} />}
            </div>
          );
        })}
      </div>
      <div className="h-3" />
    </>
  );
}

// ── 4. Clubs ─────────────────────────────────────────────────────────────────

function ClubsPage({ o }: { o: CareerOverviewData }) {
  return (
    <>
      <div className="mt-2"><Journey o={o} /></div>
      <div className="mt-2 space-y-2.5">
        {o.clubs.map((cl, k) => {
          const th = clubTheme(cl.club);
          return (
            <RiseIn key={cl.club} index={k}>
              <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${rgba(th.glow, 0.5)}, ${rgba(th.glow, 0.12)} 45%, rgba(5,8,15,.92))`, boxShadow: `inset 0 0 0 1px ${rgba(th.glow, 0.55)}, inset 0 1px 0 rgba(255,255,255,.18)` }}>
                <div className="flex items-center gap-3 px-3 pb-2 pt-3">
                  <div className="grid h-[60px] w-[60px] shrink-0 place-items-center" style={{ background: `radial-gradient(closest-side, ${rgba(th.glow, 0.6)}, transparent)` }}>
                    <Badge club={cl.club} size={52} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[21px] uppercase leading-tight text-white sk-display">{short(cl.club)}</div>
                    <div className="text-[11.5px] font-bold text-white/80">{cl.years} · {cl.seasons} season{cl.seasons === 1 ? "" : "s"}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {cl.feeIn !== undefined && <Chip>Signed ★{formatMoney(cl.feeIn)}</Chip>}
                      {cl.feeOut !== undefined && <Chip>Sold ★{formatMoney(cl.feeOut)}</Chip>}
                      {cl.feeIn === undefined && k === 0 && <Chip>Academy</Chip>}
                      {cl.last && <Chip gold>Finished here</Chip>}
                      {cl.testimonial !== undefined && <Chip gold>Testimonial ★{formatMoney(cl.testimonial)}</Chip>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-px" style={{ background: "rgba(255,255,255,.06)" }}>
                  {[["Apps", cl.apps], ["Goals", cl.goals], ["Assists", cl.assists], ["Avg", cl.avgRating ? cl.avgRating.toFixed(2) : "—"]].map(([l, v]) => (
                    <div key={l as string} className="py-1.5 text-center" style={{ background: "rgba(5,8,15,.55)" }}>
                      <div className="sk-num text-[19px] leading-none tabular-nums text-white">{cl.recordedSeasons === 0 ? <Blank w={30} h={16} /> : v}</div>
                      <div className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-white/60">{l}</div>
                    </div>
                  ))}
                </div>
                {(cl.trophies.length > 0 || cl.best) && (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                      {cl.trophies.map(tr => (
                        <span key={tr.competition} className="flex items-end gap-0.5" title={tr.competition}>
                          <TrophyImage name={tr.competition} height={26} />
                          {tr.count > 1 && <span className="text-[11px] font-black text-amber-200">×{tr.count}</span>}
                        </span>
                      ))}
                    </div>
                    {cl.best && (
                      <div className="shrink-0 text-right">
                        <div className="text-[9px] font-black uppercase tracking-wider text-white/60">Best · {cl.best.label}</div>
                        <div className="text-[12px] font-black text-white">{cl.best.goals} G · {cl.best.assists} A</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </RiseIn>
          );
        })}
      </div>
      <div className="h-3" />
    </>
  );
}

function Chip({ children, gold = false }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <span className="px-1.5 py-[1px] text-[9.5px] font-black uppercase tracking-wide" style={{ background: gold ? "rgba(251,191,36,.2)" : "rgba(0,0,0,.35)", color: gold ? "#fde68a" : "rgba(255,255,255,.85)", boxShadow: `inset 0 0 0 1px ${gold ? "rgba(251,191,36,.5)" : "rgba(255,255,255,.12)"}`, borderRadius: 2 }}>
      {children}
    </span>
  );
}

// ── 5. Trophies ──────────────────────────────────────────────────────────────

function Shelf({ items, empty }: { items: { competition: string; count: number; seasons: string[] }[]; empty: string }) {
  if (items.length === 0) return <div className="py-4 text-center text-[12px] font-bold text-white/60">{empty}</div>;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map((h, k) => (
        <RiseIn key={h.competition} index={k}>
          <div className="relative flex h-full flex-col items-center px-1.5 pb-2 pt-3" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.35))", boxShadow: "inset 0 -4px 0 rgba(120,72,24,.9), inset 0 0 0 1px rgba(255,255,255,.07)" }}>
            {h.competition === "Ballon d'Or" && <Rays color={GOLD_LIGHT} size={120} className="top-[38%]" />}
            <div className="relative"><TrophyImage name={h.competition} height={58} /></div>
            <span className="absolute right-1 top-1 px-1 text-[12px] font-black leading-[16px] text-gray-950" style={{ background: GOLD, borderRadius: 2 }}>×{h.count}</span>
            <span className="relative mt-1 w-full text-center text-[10px] font-black uppercase leading-tight tracking-wide text-white">{h.competition}</span>
            <span className="relative mt-0.5 w-full text-center text-[9.5px] font-bold leading-tight tabular-nums text-white/60">{h.seasons.join(" · ")}</span>
          </div>
        </RiseIn>
      ))}
    </div>
  );
}

function TrophiesPage({ o }: { o: CareerOverviewData }) {
  const unlocked = o.achievements.filter(a => a.unlocked).length;
  // The Ballon d'Or is yours, not the team's: it heads the awards shelf.
  const team = o.honours.filter(h => h.competition !== "Ballon d'Or");
  const awards = [...o.honours.filter(h => h.competition === "Ballon d'Or"), ...o.individual];
  const awardCount = awards.reduce((n, a) => n + a.count, 0);
  return (
    <>
      <Heading right={<span className="text-[11px] font-black text-amber-200">{o.totals.trophies}</span>}>Team trophies</Heading>
      <Shelf items={team} empty="No trophies" />
      <Heading right={<span className="text-[11px] font-black text-amber-200">{awardCount}</span>}>Your awards</Heading>
      <Shelf items={awards} empty="No individual awards" />
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <BigNumber value={o.totals.motm} label="Star Man" />
        <BigNumber value={o.totals.hatTricks} label="Hat-tricks" />
        <BigNumber value={o.totals.intlGoals} label="Intl goals" />
      </div>
      <Heading right={<span className="text-[11px] font-black text-white/80">{unlocked} / {o.achievements.length}</span>}>Achievements</Heading>
      <div className="mb-1"><StatBar value={(unlocked / Math.max(1, o.achievements.length)) * 100} colors={["#d97706", "#fde68a"]} className="h-2.5" sheen={false} /></div>
      <div className="grid grid-cols-2 gap-1">
        {o.achievements.map(a => (
          <div key={a.id} className="flex items-center gap-1.5 px-1.5 py-1" style={{ background: "rgba(255,255,255,.05)", filter: a.unlocked ? undefined : "brightness(.3)" }} title={a.description}>
            <span className="text-[14px]">{a.unlocked ? "⭐" : "🔒"}</span>
            <span className="truncate text-[10.5px] font-black text-white">{a.label}</span>
          </div>
        ))}
      </div>
      <div className="h-3" />
    </>
  );
}

// ── 6. Records ───────────────────────────────────────────────────────────────

function RecordsPage({ o }: { o: CareerOverviewData }) {
  return (
    <>
      <Heading>Your records</Heading>
      <div className="space-y-1">
        {o.records.map(r => (
          <div key={r.label} className="flex items-center gap-2.5 px-2 py-1.5" style={{ background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
            <span className="grid h-8 w-8 shrink-0 place-items-center text-[17px]" style={{ background: "rgba(0,0,0,.35)" }}>{r.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-black text-white">{r.label}</div>
              {r.sub ? <div className="truncate text-[10.5px] font-bold text-white/60">{r.sub}</div> : null}
            </div>
            <div className="sk-num shrink-0 text-[20px] leading-none tabular-nums text-amber-200">{r.value === "—" ? <Blank w={30} h={18} /> : r.value}</div>
          </div>
        ))}
      </div>
      <Heading>You v the real records</Heading>
      <div className="space-y-1.5">
        {o.realRecords.map(r => {
          const pct = Math.min(100, Math.round((r.you / Math.max(1, r.record)) * 100));
          return (
            <div key={r.label} className="px-2 py-1.5" style={{ background: r.beaten ? "rgba(52,211,153,.12)" : "rgba(255,255,255,.05)", boxShadow: `inset 0 0 0 1px ${r.beaten ? "rgba(52,211,153,.45)" : "rgba(255,255,255,.06)"}` }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[11.5px] font-black text-white">{r.label.replace("Premier League", "PL")}</span>
                {r.beaten && <span className="kit-stamp shrink-0 px-1 text-[9.5px] font-black uppercase tracking-wider text-gray-950" style={{ background: "#34d399", borderRadius: 2 }}>Beaten</span>}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="min-w-0 flex-1"><StatBar value={Math.max(3, pct)} colors={r.beaten ? ["#059669", "#6ee7b7"] : ["#d97706", "#fde68a"]} className="h-2.5" sheen={false} /></div>
                <span className="shrink-0 text-[11px] font-black tabular-nums text-white">{r.you} <span className="text-white/50">/ {r.record}</span></span>
              </div>
              <div className="mt-0.5 truncate text-[9.5px] font-bold text-white/55">Record: {r.holder}</div>
            </div>
          );
        })}
      </div>
      <Heading>For your country</Heading>
      <div className="grid grid-cols-3 gap-1.5">
        <BigNumber value={o.totals.caps} label="Caps" />
        <BigNumber value={o.totals.intlGoals} label="Goals" />
        <BigNumber value={o.totals.caps > 0 ? (o.totals.intlGoals / o.totals.caps).toFixed(2) : "—"} label="Goals / cap" />
      </div>
      <div className="h-3" />
    </>
  );
}

// ── 7. Life ──────────────────────────────────────────────────────────────────

function Meter({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-center text-[15px]">{icon}</span>
      <span className="w-[74px] shrink-0 truncate text-[11px] font-black text-white/85">{label}</span>
      <div className="min-w-0 flex-1"><StatBar value={value} className="h-3" sheen={false} /></div>
      <span className="w-8 shrink-0 text-right text-[12px] font-black tabular-nums text-white">{Math.round(value)}</span>
    </div>
  );
}

function LifePage({ o }: { o: CareerOverviewData }) {
  const l = o.life;
  const rel = l.relationships;
  return (
    <>
      <div className="mt-2 px-3 py-3 text-center" style={{ background: "linear-gradient(180deg, rgba(251,191,36,.18), rgba(251,191,36,.04))", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.35)" }}>
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">In the bank</div>
        <div className="sk-num mt-0.5 text-[36px] leading-none text-white">★<CountUp value={l.money} ms={1200} format={(n) => formatMoney(Math.round(n))} /></div>
        {l.testimonial && <div className="mt-1 text-[11px] font-bold text-white/80">incl. a testimonial at {short(l.testimonial.club)}: ★{formatMoney(l.testimonial.payout)}</div>}
      </div>

      <Heading>Standing</Heading>
      <div className="space-y-2 px-1">
        {l.stars !== undefined && <Meter icon="⭐" label="Star rating" value={l.stars} />}
        <Meter icon="📣" label="Fame" value={l.fame} />
        <Meter icon="🏛️" label="Reputation" value={l.reputation} />
        <Meter icon="😊" label="Happiness" value={l.happiness} />
      </div>

      <Heading>The people</Heading>
      <div className="space-y-2 px-1">
        <Meter icon="👔" label="Manager" value={rel.boss} />
        <Meter icon="🤝" label="Team" value={rel.team} />
        <Meter icon="🏟️" label="Fans" value={rel.fans} />
        {rel.girlfriend !== undefined && <Meter icon="❤️" label={l.girlfriend ?? "Partner"} value={rel.girlfriend} />}
      </div>

      <Heading right={<span className="text-[11px] font-black text-white/70">{l.items.length}</span>}>What you owned</Heading>
      {l.items.length === 0 ? (
        <div className="py-3 text-center text-[12px] font-bold text-white/60">Nothing bought</div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {l.items.map(it => (
            <div key={it.base} className="flex flex-col items-center px-1 pb-1.5 pt-1" style={{ background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
              <StylePicture base={it.base} level={it.level} className="h-[58px] w-full" />
              <span className="mt-0.5 w-full truncate text-center text-[10px] font-black text-white">{it.name}</span>
              <span className="text-[9.5px] font-black tracking-widest text-amber-300">{"★".repeat(it.level)}<span className="text-white/20">{"★".repeat(Math.max(0, 5 - it.level))}</span></span>
            </div>
          ))}
        </div>
      )}

      {(l.horse || l.sponsors.length > 0 || l.clubsOwned.length > 0 || l.presidencies.length > 0 || l.son) && <Heading>Everything else</Heading>}
      <div className="space-y-1">
        {l.horse && (
          <LifeRow icon="🐎" title={l.horse.name} sub={`${l.horse.won} wins from ${l.horse.run} races`} value={`★${formatMoney(l.horse.earnings)}`} />
        )}
        {l.sponsors.length > 0 && (
          <LifeRow icon="🤝" title="Sponsors" sub={l.sponsors.map(s => s.brand).join(" · ")} value={String(l.sponsors.length)} dots={l.sponsors.map(s => s.color)} />
        )}
        {l.clubsOwned.map(c => (
          <LifeRow key={c.club} icon={<Badge club={c.club} size={22} />} title={`Owner: ${short(c.club)}`} sub={c.percent > 50 ? "Majority owner" : "Shareholder"} value={`${c.percent}%`} />
        ))}
        {l.presidencies.map(p => <LifeRow key={p} icon="🏛️" title={`President of the ${p}`} sub="Elected" value="" />)}
        {l.son && <LifeRow icon="👦" title={l.son.name} sub={`Age ${l.son.age} · ${l.son.club ? short(l.son.club) : "no club yet"}`} value={`${l.son.overall}`} />}
      </div>
      <div className="h-3" />
    </>
  );
}

function LifeRow({ icon, title, sub, value, dots }: { icon: React.ReactNode; title: string; sub: string; value: string; dots?: string[] }) {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5" style={{ background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
      <span className="grid h-8 w-8 shrink-0 place-items-center text-[17px]" style={{ background: "rgba(0,0,0,.35)" }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-black text-white">{title}</div>
        <div className="flex min-w-0 items-center gap-1">
          {dots?.map((c, k) => <span key={k} className="h-2 w-2 shrink-0" style={{ background: c, borderRadius: 1 }} />)}
          <span className="truncate text-[10.5px] font-bold text-white/60">{sub}</span>
        </div>
      </div>
      {value && <div className="sk-num shrink-0 text-[17px] leading-none tabular-nums text-amber-200">{value}</div>}
    </div>
  );
}
