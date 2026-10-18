"use client";
import { useMemo, useState } from "react";
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import type { InterestLevel, InterestedClub, SeasonGrade, WindowInterest } from "@/lib/star/transferInterest";
import { INTEREST_STEPS, keenest, levelOf } from "@/lib/star/transferInterest";
import { leagueNameFor, divisionOf, type CareerDivision } from "@/lib/star/calendar";
import { formatMoney, formatMoneyPrecise } from "@/lib/star/money";
import ClubBadge from "./ClubBadge";
import { BarButton, KitStyles, Shine, useClubTheme, clubTheme, rgba } from "./ui";
import { shortClub } from "@/lib/star/media/grammar";

/**
 * THE TRANSFER WINDOW (18 Oct 2026) — New Star Soccer's screen in the Home
 * screen's own look.
 *
 * From a screenshot of NSS's "Desired Transfer": pick a league with clubs
 * interested in you, pick a club, negotiate. Then, the same day:
 *   - no Nation row (England is the only one);
 *   - League and Club are FULL-SCREEN pages: ✕ goes back with nothing
 *     changed, a pick goes back with the pick shown;
 *   - no wage in the club list (you learn their offer in the talks);
 *   - clubs A to Z;
 *   - your season as a letter, coloured from green (S) to red (D);
 *   - how much a club wants you, in words with a bar ("Desperate" …
 *     "Interested"), instead of a squad role the game never kept;
 *   - the Home screen's tiles, colours and buttons ("it should be more of the
 *     same type of design style as the home page") on Deadline Day's stage:
 *     the gold slab, the edge tab, a gold title, a ticker.
 *
 * The summer window only. Who is in the lists: lib/star/transferInterest.ts.
 */

interface Props {
  career: CareerState;
  interest: WindowInterest;
  onNegotiate: (club: InterestedClub) => void;
  /** Stay at your club; the season rolls on. */
  onStay: () => void;
}

type Page = "hub" | "league" | "club";

const wageText = (w: number) => `★${formatMoneyPrecise(w)}`;
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/** Like NSS's "(CHAMPS)": the club's European competition this season. */
const EURO_TAG: Record<string, string> = { "Champions League": "UCL", "Europa League": "UEL", "Conference League": "UECL" };

/** Green for the best season down to red for the worst. */
export const GRADE_COLOUR: Record<SeasonGrade, string> = {
  S: "#16d466", A: "#8fe33a", B: "#facc15", C: "#f97316", D: "#ef4444",
};

/** How much a club wants you, on the same green-to-orange scale. */
export const INTEREST_COLOUR: Record<InterestLevel, string> = {
  Desperate: "#16d466", "Very keen": "#8fe33a", Keen: "#facc15", Interested: "#f97316",
};

function stepWord(division: CareerDivision, own: CareerDivision): string {
  const d = levelOf(division) - levelOf(own);
  return d > 0 ? `${d} up` : d < 0 ? `${-d} down` : division === own ? "Your league" : "Same level";
}

/** The Home screen's tile: dark glass lit from the top in one colour. Nearly
 *  solid, so it still reads where it crosses the gold slab. */
function tile(color: string, strength = 0.38): React.CSSProperties {
  return {
    background: `radial-gradient(90% 80% at 50% 0%, ${rgba(color, strength)} 0%, transparent 75%), rgba(9,13,26,.95)`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1.5px ${rgba(color, 0.6)}, 0 8px 18px -8px rgba(0,0,0,.9)`,
  };
}

/** A black outline so gold and white text read over the slab and the dark. */
const OUTLINE = "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 6px rgba(0,0,0,.5)";
const SMALL_OUTLINE = "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 3px rgba(0,0,0,.6)";

/**
 * Deadline Day's stage (DeadlineDayRoundup.tsx) with the Home screen's lights:
 * the night stadium lit in your club's colour, the diagonal gold slab, the
 * "TRANSFERS" edge tab, a gold title and a ticker over the buttons. Harry,
 * 18 Oct 2026: "like a deadline day screen, but in the design style of the
 * home screen". Opens at once: no entrance animation, only the idle shine.
 */
function WindowFrame({ glow, kicker, title, sub, right, ticker, bottom, children, page }: {
  glow: string; kicker: string; title: string; sub?: React.ReactNode; right?: React.ReactNode;
  ticker: string; bottom?: React.ReactNode; children: React.ReactNode; page: string;
}) {
  return (
    <div data-transfer-page={page} className="fixed inset-0 z-50 overflow-hidden bg-[#070b16] text-white">
      <KitStyles />
      <div className="relative mx-auto flex h-full w-full max-w-md flex-col overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0" style={{ background: `radial-gradient(95% 42% at 35% -6%, ${rgba(glow, 0.55)} 0%, transparent 72%), radial-gradient(70% 40% at 80% 105%, rgba(245,197,24,.18), transparent 70%), linear-gradient(180deg,#0a1120,#070b16 55%,#05070d)` }} />
          <div className="absolute inset-x-0 top-0 h-[32%]" style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,.26) 0.9px, transparent 1.4px), radial-gradient(circle, ${rgba(glow, 0.6)} 0.9px, transparent 1.4px)`,
            backgroundSize: "7px 6px, 11px 9px", backgroundPosition: "0 0, 3px 2px", opacity: 0.4,
            maskImage: "linear-gradient(180deg, #000, transparent)", WebkitMaskImage: "linear-gradient(180deg, #000, transparent)",
          }} />
          {/* Floodlights. */}
          {[12, 88].map(x => (
            <div key={x} className="absolute top-[2%] h-24 w-24 -translate-x-1/2 rounded-full" style={{ left: `${x}%`, background: "radial-gradient(circle, rgba(255,255,255,.55) 0%, rgba(255,255,255,.12) 25%, transparent 65%)" }} />
          ))}
          <div className="absolute inset-y-0 right-0 w-[46%] overflow-hidden" style={{ background: "linear-gradient(115deg,#d99a00 0%,#f5c518 38%,#ffe066 62%,#f0b400 100%)", clipPath: "polygon(30% 0,100% 0,100% 100%,0% 100%)" }}>
            <Shine loop every={6} className="w-1/2" />
          </div>
          <div className="absolute inset-y-0 right-0 w-[46%]" style={{ background: "linear-gradient(115deg, transparent 55%, rgba(0,0,0,.4) 100%)", clipPath: "polygon(30% 0,100% 0,100% 100%,0% 100%)" }} />
          {[0, 1, 2].map(i => (
            <div key={i} className="absolute top-1/2 h-[70vh] w-[70vh] border-r-[3px] border-amber-400/25" style={{ right: `${-34 + i * 16}%`, transform: "translateY(-50%) rotate(18deg)" }} />
          ))}
        </div>

        <div aria-hidden className="pointer-events-none absolute left-0 top-0 z-20 flex h-full w-7 flex-col items-center bg-black/75 pt-4">
          <span className="rotate-180 text-[9px] font-black uppercase tracking-[0.3em] text-amber-300" style={{ writingMode: "vertical-rl" }}>Transfers</span>
        </div>

        <div className="relative z-10 flex items-start gap-2 pb-2 pl-10 pr-3 pt-5">
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded-full border border-amber-400/60 bg-black/60 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">{kicker}</span>
            <h1 className="mt-2 truncate text-[2.1rem] font-black italic uppercase leading-[0.9] tracking-tight text-[#ffd23f]" style={{ textShadow: OUTLINE }}>{title}</h1>
            {sub && <div className="mt-1.5 text-[12px] font-black text-white" style={{ textShadow: SMALL_OUTLINE }}>{sub}</div>}
          </div>
          {right}
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto pb-4 pl-10 pr-3 pt-1">{children}</div>

        <div className="relative z-30 border-t border-amber-400/30 bg-black/90">
          <div className="overflow-hidden whitespace-nowrap py-1.5 pl-10 text-[9px] font-black uppercase tracking-widest text-amber-300/90">
            <div className="kit-marquee inline-block">
              {[0, 1].map(k => <span key={k} className="pr-6">{ticker}</span>)}
            </div>
          </div>
          {bottom && <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>{bottom}</div>}
        </div>
      </div>
    </div>
  );
}

export default function TransferHub({ career, interest, onNegotiate, onStay }: Props) {
  const theme = useClubTheme(career);
  const own = divisionOf(career);
  const leagues = interest.leagues;
  const [division, setDivision] = useState<CareerDivision | null>(leagues[0]?.division ?? null);
  const league = leagues.find(l => l.division === division) ?? leagues[0];
  const [clubName, setClubName] = useState<string | null>(() => (leagues[0] ? keenest(leagues[0].clubs)?.club ?? null : null));
  const club = league?.clubs.find(c => c.club === clubName) ?? (league ? keenest(league.clubs) : undefined);
  const [page, setPage] = useState<Page>("hub");
  const [browsing, setBrowsing] = useState<CareerDivision | null>(null);
  const browseLeague = leagues.find(l => l.division === browsing) ?? league;
  const total = useMemo(() => leagues.reduce((n, l) => n + l.clubs.length, 0), [leagues]);
  const r = interest.report;
  const kicker = `Season ${career.season} · Summer window`;
  const wantText = total === 0 ? "No club has come in for you" : `${total} ${total === 1 ? "club wants" : "clubs want"} you`;
  const ticker = `Transfer Centre · ${wantText} · Season grade ${r.grade} · ${leagues.length} ${leagues.length === 1 ? "league" : "leagues"} · `;

  const close = () => { setBrowsing(null); setPage("hub"); };
  const closeBtn = (
    <button onClick={close} aria-label="Close" data-close
      className="kib-press flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px] font-black text-white"
      style={tile("#ffffff", 0.12)}>✕</button>
  );

  // ── Full-screen: the leagues with clubs interested in you ──
  if (page === "league") {
    return (
      <WindowFrame page="league" glow={theme.glow} kicker={kicker} title="Pick a league" sub={wantText} right={closeBtn} ticker={ticker}>
        <div className="space-y-2">
          {leagues.map(l => {
            const on = l.division === league?.division;
            const up = levelOf(l.division) - levelOf(own);
            const accent = up > 0 ? "#34d399" : up < 0 ? "#f97316" : theme.glow;
            return (
              <button key={l.division} data-league={l.division}
                onClick={() => { setBrowsing(l.division); setPage("club"); }}
                className="kib-press flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left"
                style={tile(accent, on ? 0.55 : 0.38)}>
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-[20px] font-black leading-none text-black"
                  style={{ background: "linear-gradient(180deg,#ffe066,#f0b400)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.6)" }}>
                  {l.clubs.length}
                  <span className="text-[7px] font-black uppercase tracking-wide">{l.clubs.length === 1 ? "club" : "clubs"}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-black uppercase tracking-wide text-white">{leagueNameFor(l.division)}</span>
                  <span className="block text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: accent === theme.glow ? "#ffffff" : accent }}>{stepWord(l.division, own)}</span>
                </span>
                {on && <span className="shrink-0 text-[18px] font-black text-emerald-300">✓</span>}
                <span aria-hidden className="shrink-0 text-[20px] font-black text-white/80">›</span>
              </button>
            );
          })}
        </div>
      </WindowFrame>
    );
  }

  // ── Full-screen: every interested club in one league, A to Z ──
  if (page === "club" && browseLeague) {
    const ownLeague = browseLeague.division === own;
    return (
      <WindowFrame page="club" glow={theme.glow} kicker={kicker} title={leagueNameFor(browseLeague.division)} right={closeBtn} ticker={ticker}
        sub={`${browseLeague.clubs.length} ${browseLeague.clubs.length === 1 ? "club is" : "clubs are"} interested · A to Z`}>
        <div className="space-y-2">
          {browseLeague.clubs.map(c => {
            const picked = c.club === club?.club && browseLeague.division === league?.division;
            return (
              <button key={c.club} data-club={c.club}
                onClick={() => { setDivision(browseLeague.division); setClubName(c.club); close(); }}
                className="kib-press flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                style={tile(clubTheme(c.club, career).glow, picked ? 0.6 : 0.45)}>
                <ClubBadge club={c.club} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[16px] font-black text-white">{c.club}</span>
                    {c.europe && <EuroTag comp={c.europe} />}
                  </span>
                  <InterestBar level={c.interest} />
                  {ownLeague && <span className="block text-[11px] font-bold text-white/85">Finished {ordinal(c.position)}</span>}
                </span>
                {picked && <span className="shrink-0 text-[18px] font-black text-emerald-300">✓</span>}
              </button>
            );
          })}
        </div>
      </WindowFrame>
    );
  }

  // ── The window ──
  const clubGlow = club ? clubTheme(club.club, career).glow : theme.glow;
  const grade = GRADE_COLOUR[r.grade];
  return (
    <WindowFrame page="hub" glow={theme.glow} kicker={kicker} title="Transfer window" sub={wantText} ticker={ticker}
      bottom={
        <div className="grid gap-px" style={{ gridTemplateColumns: "1fr 1.6fr" }}>
          <BarButton icon={<span className="text-red-400">✕</span>} label="Stay" onClick={onStay} />
          <div className="relative grid overflow-hidden">
            <BarButton primary icon="✓" label={club ? `Negotiate · ${shortClub(club.club)}` : "Negotiate"} onClick={() => club && onNegotiate(club)} disabled={!club} />
            {club && <Shine loop every={4} />}
          </div>
        </div>
      }
    >
      <div data-transfer-hub="summer">
        {/* Your season, as a letter. */}
        <div data-season-grade={r.grade} className="flex items-center gap-3 rounded-xl px-3 py-3" style={tile(grade, 0.5)}>
          <span className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-xl text-[44px] font-black italic leading-none text-white"
            style={{ background: `linear-gradient(180deg, ${grade}, ${rgba(grade, 0.7)})`, boxShadow: `0 0 22px ${rgba(grade, 0.7)}, inset 0 1px 0 rgba(255,255,255,.45)`, textShadow: OUTLINE }}>
            {r.grade}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: grade }}>Your season</span>
            <span className="mt-1 grid grid-cols-4 gap-1 text-center">
              <MiniStat v={r.goals} k="Goals" />
              <MiniStat v={r.assists} k="Assists" />
              <MiniStat v={r.rating !== null ? r.rating.toFixed(1) : "–"} k="Avg" />
              <MiniStat v={r.apps} k="Games" />
            </span>
          </span>
        </div>

        {league && club ? (
          <>
            <div className="mt-3 space-y-2">
              <Chooser label="League" glow="#f5c518" onClick={() => setPage("league")} data-chooser="league">
                <span className="truncate">{leagueNameFor(league.division)}</span>
                <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-black">{league.clubs.length}</span>
              </Chooser>
              <Chooser label="Club" glow={clubGlow} onClick={() => { setBrowsing(league.division); setPage("club"); }} data-chooser="club">
                <ClubBadge club={club.club} size={30} />
                <span className="min-w-0 flex-1 truncate">{club.club}</span>
                {club.europe && <EuroTag comp={club.europe} />}
              </Chooser>
            </div>

            {/* The club you picked, lit in its own colours. */}
            <div data-picked-club className="relative mt-3 overflow-hidden rounded-xl px-3 pb-3 pt-3" style={tile(clubGlow, 0.6)}>
              <div className="flex items-center gap-3">
                <ClubBadge club={club.club} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[19px] font-black uppercase leading-tight text-white" style={{ textShadow: SMALL_OUTLINE }}>{club.club}</div>
                  <div className="mt-1"><InterestBar level={club.interest} wide /></div>
                </div>
              </div>
              <p className="mt-2.5 rounded-lg bg-black/40 px-2.5 py-2 text-[14px] font-bold italic text-white">“{club.why}”</p>
              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                <Fact k="Contract" v={`${club.offer.seasons} seasons`} />
                <Fact k="Your club gets" v={`★${formatMoney(club.fee)}`} gold />
                <Fact k="Your wage now" v={`${wageText(career.contract.wage)}/wk`} />
                {club.division === own
                  ? <Fact k="Finished" v={`${ordinal(club.position)} of ${club.of}`} />
                  : <Fact k="League" v={stepWord(club.division, own)} />}
              </div>
            </div>
          </>
        ) : (
          <p className="mt-6 text-[14px] font-bold text-white">Have a better season and the clubs will come.</p>
        )}
      </div>
    </WindowFrame>
  );
}

function MiniStat({ v, k }: { v: React.ReactNode; k: string }) {
  return (
    <span className="rounded-md bg-black/40 px-1 py-1">
      <span className="block text-[16px] font-black leading-none text-white">{v}</span>
      <span className="block text-[8px] font-black uppercase tracking-wide text-white/80">{k}</span>
    </span>
  );
}

function Fact({ k, v, gold = false }: { k: string; v: string; gold?: boolean }) {
  return (
    <div className="rounded-lg bg-black/40 px-2.5 py-1.5">
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/80">{k}</div>
      <div className={`truncate text-[14px] font-black ${gold ? "text-[#ffd23f]" : "text-white"}`}>{v}</div>
    </div>
  );
}

/** "Very keen" and four little bars, three of them lit. */
function InterestBar({ level, wide = false }: { level: InterestLevel; wide?: boolean }) {
  const on = INTEREST_STEPS[level];
  const color = INTEREST_COLOUR[level];
  return (
    <span data-interest={level} className={`flex items-center gap-1.5 ${wide ? "" : "mt-0.5"}`}>
      <span className="flex gap-[3px]">
        {[1, 2, 3, 4].map(i => (
          <span key={i} className="h-[9px] w-[12px] rounded-[2px]" style={{ background: i <= on ? color : "rgba(255,255,255,.18)", boxShadow: i <= on ? `0 0 6px ${rgba(color, 0.6)}` : undefined }} />
        ))}
      </span>
      <span className="text-[12px] font-black" style={{ color }}>{level}</span>
    </span>
  );
}

function Chooser({ label, glow, onClick, children, ...rest }: { label: string; glow: string; onClick: () => void; children: React.ReactNode } & Record<`data-${string}`, string>) {
  return (
    <button onClick={onClick} {...rest}
      className="kib-press flex h-[60px] w-full items-center gap-3 rounded-xl px-3 text-left text-white"
      style={tile(glow, 0.32)}>
      <span className="w-[50px] shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-white/85">{label}</span>
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-[17px] font-black uppercase tracking-wide">{children}</span>
      <span aria-hidden className="shrink-0 text-[20px] font-black text-white/80">›</span>
    </button>
  );
}

function EuroTag({ comp }: { comp: string }) {
  return <span className="shrink-0 rounded bg-sky-500 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">{EURO_TAG[comp] ?? comp}</span>;
}
