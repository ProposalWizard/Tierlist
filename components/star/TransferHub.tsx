"use client";
import { useMemo, useState } from "react";
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import type { InterestedClub, SeasonGrade, WindowInterest } from "@/lib/star/transferInterest";
import { levelOf } from "@/lib/star/transferInterest";
import { leagueNameFor, divisionOf, type CareerDivision } from "@/lib/star/calendar";
import { formatMoney, formatMoneyPrecise } from "@/lib/star/money";
import ClubBadge from "./ClubBadge";
import { KitStyles, Shine, clubTheme, rgba } from "./ui";

/**
 * THE TRANSFER WINDOW (18 Oct 2026) — New Star Soccer's screen, in the
 * colours of the game's Deadline Day screen.
 *
 * Asked for directly, from a screenshot of NSS's "Desired Transfer": pick a
 * league that has clubs interested in you, pick a club, negotiate. Second
 * pass, same day: no Nation row (England is the only one), the League and
 * Club lists are FULL-SCREEN pages (✕ goes back with nothing changed; a pick
 * goes back with the pick shown), no wage in the club list (you learn their
 * offer in the talks), the season shown as a letter (S, A, B, C, D), and
 * "a bit more colour … something with the vibe of the deadline day screen".
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

/** Each letter's colour: gold S down to red D. */
export const GRADE_COLOUR: Record<SeasonGrade, string> = {
  S: "#ffd23f", A: "#34d399", B: "#38bdf8", C: "#e5e7eb", D: "#fb7185",
};

/** The same black outline the Deadline Day title uses. */
const TITLE_OUTLINE = "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 6px rgba(0,0,0,0.5)";
const NAME_OUTLINE = "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 3px rgba(0,0,0,0.6)";

function stepWord(division: CareerDivision, own: CareerDivision): string {
  const d = levelOf(division) - levelOf(own);
  return d > 0 ? `${d} up` : d < 0 ? `${-d} down` : division === own ? "Your league" : "Same level";
}

export default function TransferHub({ career, interest, onNegotiate, onStay }: Props) {
  const own = divisionOf(career);
  const leagues = interest.leagues;
  const [division, setDivision] = useState<CareerDivision | null>(leagues[0]?.division ?? null);
  const league = leagues.find(l => l.division === division) ?? leagues[0];
  const [clubName, setClubName] = useState<string | null>(league?.clubs[0]?.club ?? null);
  const club = league?.clubs.find(c => c.club === clubName) ?? league?.clubs[0];
  const [page, setPage] = useState<Page>("hub");
  const total = useMemo(() => leagues.reduce((n, l) => n + l.clubs.length, 0), [leagues]);
  const r = interest.report;

  // League page → pick a league → its clubs (still full screen). A club
  // pick goes back to the hub with it shown; ✕ anywhere goes back unchanged.
  const [browsing, setBrowsing] = useState<CareerDivision | null>(null);
  const browseLeague = leagues.find(l => l.division === browsing) ?? league;

  if (page === "league") {
    return (
      <FullPage title="Pick a league" sub={`${total} ${total === 1 ? "club wants" : "clubs want"} you`} onClose={() => setPage("hub")}>
        {leagues.map(l => (
          <Row key={l.division} picked={l.division === league?.division} data-league={l.division}
            onClick={() => { setBrowsing(l.division); setPage("club"); }}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-black uppercase tracking-wide text-white" style={{ textShadow: NAME_OUTLINE }}>{leagueNameFor(l.division)}</span>
              <span className="block text-[11px] font-black uppercase tracking-widest text-amber-300">{stepWord(l.division, own)}</span>
            </span>
            <span className="shrink-0 rounded-full bg-amber-400 px-2.5 py-1 text-[12px] font-black text-gray-950">{l.clubs.length} {l.clubs.length === 1 ? "club" : "clubs"}</span>
            <span aria-hidden className="shrink-0 text-[18px] font-black text-amber-300">›</span>
          </Row>
        ))}
      </FullPage>
    );
  }

  if (page === "club" && browseLeague) {
    const ownLeague = browseLeague.division === own;
    return (
      <FullPage title={leagueNameFor(browseLeague.division)} sub={`${browseLeague.clubs.length} interested ${browseLeague.clubs.length === 1 ? "club" : "clubs"}`} onClose={() => { setBrowsing(null); setPage("hub"); }}>
        {browseLeague.clubs.map(c => {
          const glow = clubTheme(c.club, career).glow;
          return (
            <Row key={c.club} picked={c.club === club?.club && browseLeague.division === league?.division} glow={glow} data-club={c.club}
              onClick={() => { setDivision(browseLeague.division); setClubName(c.club); setBrowsing(null); setPage("hub"); }}>
              <ClubBadge club={c.club} size={34} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[16px] font-black text-white" style={{ textShadow: NAME_OUTLINE }}>{c.club}</span>
                  {c.europe && <EuroTag comp={c.europe} />}
                </span>
                <span className="block text-[11px] font-bold text-white">
                  {c.role}{ownLeague ? ` · finished ${ordinal(c.position)}` : ""}
                </span>
              </span>
            </Row>
          );
        })}
      </FullPage>
    );
  }

  const clubGlow = club ? clubTheme(club.club, career).glow : "#f5c518";
  return (
    <Backdrop>
      <div data-transfer-hub="summer" className="relative z-10 flex h-full flex-col">
        {/* ── Header ── */}
        <div className="px-3 pl-9 pt-6">
          <span className="rounded-full border border-amber-400/50 bg-black/50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">
            Season {career.season} · Summer window
          </span>
          <h1 className="mt-2 whitespace-nowrap text-[2.15rem] font-black italic leading-[0.85] tracking-tight text-[#ffd23f]" style={{ textShadow: TITLE_OUTLINE }}>
            TRANSFER WINDOW
          </h1>
        </div>

        {/* ── Your season, as a letter ── */}
        <div data-season-grade={r.grade} className="mx-3 ml-9 mt-3 flex items-center gap-3 px-3 py-2" style={{ background: "#0b1020", boxShadow: `inset 0 0 0 1px ${rgba(GRADE_COLOUR[r.grade], 0.55)}`, borderRadius: 4 }}>
          <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center text-[38px] font-black italic leading-none text-gray-950"
            style={{ background: `linear-gradient(160deg, ${GRADE_COLOUR[r.grade]}, ${rgba(GRADE_COLOUR[r.grade], 0.75)})`, borderRadius: 4, boxShadow: `0 0 18px ${rgba(GRADE_COLOUR[r.grade], 0.55)}` }}>
            {r.grade}
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">Your season</span>
            <span className="block text-[13px] font-bold text-white" style={{ textShadow: NAME_OUTLINE }}>
              {r.goals} goals · {r.assists} assists{r.rating !== null ? ` · ${r.rating.toFixed(1)} avg` : ""} · {r.apps} games
            </span>
          </span>
        </div>

        <p className="mx-3 ml-9 mt-3 text-[12px] font-black uppercase tracking-wide text-white" style={{ textShadow: NAME_OUTLINE }}>
          {total === 0 ? "No club has come in for you" : <><span className="text-amber-300">{total}</span> {total === 1 ? "club wants" : "clubs want"} you</>}
        </p>

        {league && club ? (
          <>
            <div className="mx-3 ml-9 mt-2 space-y-2">
              <Chooser label="League" onClick={() => setPage("league")} data-chooser="league">
                <span className="truncate">{leagueNameFor(league.division)}</span>
                <span className="shrink-0 text-[11px] font-black uppercase tracking-wide text-amber-300">{league.clubs.length} {league.clubs.length === 1 ? "club" : "clubs"}</span>
              </Chooser>
              <Chooser label="Club" onClick={() => { setBrowsing(league.division); setPage("club"); }} data-chooser="club">
                <ClubBadge club={club.club} size={30} />
                <span className="min-w-0 flex-1 truncate">{club.club}</span>
                {club.europe && <EuroTag comp={club.europe} />}
              </Chooser>
            </div>

            {/* ── The club you picked, in its own colours ── */}
            <div data-picked-club className="mx-3 ml-9 mt-3 px-3 py-2.5"
              style={{ background: `linear-gradient(135deg, ${rgba(clubGlow, 0.5)}, transparent 75%), #0b1020`, boxShadow: `inset 0 0 0 1px ${rgba(clubGlow, 0.6)}`, borderRadius: 4 }}>
              <p className="text-[13px] font-bold italic text-white" style={{ textShadow: NAME_OUTLINE }}>“{club.why}”</p>
              <div className="mt-2 space-y-1 text-[13px]">
                <Stat k="Role" v={club.role} />
                <Stat k="Contract" v={`${club.offer.seasons} seasons`} />
                <Stat k="Your wage now" v={`${wageText(career.contract.wage)} a week`} />
                <Stat k="Your club gets" v={`★${formatMoney(club.fee)}`} gold />
                {club.division === own && <Stat k="Finished" v={`${ordinal(club.position)} of ${club.of}`} />}
              </div>
            </div>
          </>
        ) : (
          <p className="mx-3 ml-9 mt-6 text-[14px] font-bold text-white">Have a better season and the clubs will come.</p>
        )}

        <div className="flex-1" />

        {/* ── Ticker + buttons ── */}
        <div className="border-t border-white/10 bg-black/75 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pl-9 pt-2">
          <div className="mb-2 overflow-hidden whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-amber-300/80">
            <div className="kit-marquee inline-block">
              {[0, 1].map(k => (
                <span key={k} className="pr-6">
                  Transfer Centre · {total} {total === 1 ? "club" : "clubs"} in for you · Season {career.season} ·
                  Transfer Centre · {total} {total === 1 ? "club" : "clubs"} in for you ·{" "}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1.6fr] gap-2">
            <button onClick={onStay} className="kib-press h-[50px] text-[14px] font-black uppercase tracking-wide text-white"
              style={{ background: "rgba(255,255,255,.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.25)", borderRadius: 4 }}>
              <span className="text-rose-400">✕</span> Stay
            </button>
            <button onClick={() => club && onNegotiate(club)} disabled={!club} data-negotiate
              className="kib-press relative h-[50px] overflow-hidden text-[14px] font-black uppercase tracking-wide text-gray-950 disabled:opacity-40"
              style={{ background: "linear-gradient(180deg, #ffe066, #f5c518 55%, #d99a00)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.6)", borderRadius: 4 }}>
              <Shine loop every={4} />
              ✓ Negotiate{club ? ` with ${club.club}` : ""}
            </button>
          </div>
        </div>
      </div>
    </Backdrop>
  );
}

/** The Deadline Day ground: dark, a diagonal gold slab, a rotated edge tab. */
function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[#070b16] text-white">
      <KitStyles />
      <div className="relative mx-auto h-full w-full max-w-md overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0" style={{ background: "radial-gradient(90% 50% at 30% -5%, rgba(245,197,24,.22), transparent 70%), linear-gradient(180deg,#070b16,#0a1020 60%,#05070d)" }} />
          <div className="absolute inset-x-0 top-[4%] h-[30%] opacity-30" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,.3) 0.9px, transparent 1.4px)", backgroundSize: "7px 6px", maskImage: "linear-gradient(180deg, transparent, #000 30%, #000 50%, transparent)", WebkitMaskImage: "linear-gradient(180deg, transparent, #000 30%, #000 50%, transparent)" }} />
          <div className="absolute inset-y-0 right-0 w-[38%]" style={{ background: "linear-gradient(115deg, #d99a00 0%, #f5c518 38%, #ffe066 62%, #f0b400 100%)", clipPath: "polygon(30% 0, 100% 0, 100% 100%, 0% 100%)", opacity: 0.9 }} />
          <div className="absolute inset-y-0 right-0 w-[38%]" style={{ background: "linear-gradient(115deg, transparent 50%, rgba(0,0,0,0.4) 100%)", clipPath: "polygon(30% 0, 100% 0, 100% 100%, 0% 100%)" }} />
        </div>
        <div className="pointer-events-none absolute left-0 top-0 z-20 flex h-full w-7 flex-col items-center justify-start bg-black/70 pt-4">
          <span className="rotate-180 text-[9px] font-black uppercase tracking-[0.3em] text-amber-300" style={{ writingMode: "vertical-rl" }}>Transfers</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A list that covers the whole screen; ✕ closes it with nothing changed. */
function FullPage({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Backdrop>
      <div data-transfer-page={title} className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-2 px-3 pl-9 pt-6">
          <div className="min-w-0">
            <h2 className="truncate text-[1.7rem] font-black italic uppercase leading-[0.9] tracking-tight text-[#ffd23f]" style={{ textShadow: TITLE_OUTLINE }}>{title}</h2>
            <p className="mt-1 text-[12px] font-black uppercase tracking-wide text-white" style={{ textShadow: NAME_OUTLINE }}>{sub}</p>
          </div>
          <button onClick={onClose} aria-label="Close" data-close
            className="kib-press flex h-10 w-10 shrink-0 items-center justify-center text-[20px] font-black text-white"
            style={{ background: "rgba(0,0,0,.75)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)", borderRadius: 4 }}>✕</button>
        </div>
        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto px-3 pb-6 pl-9">{children}</div>
      </div>
    </Backdrop>
  );
}

function Row({ picked, glow, onClick, children, ...rest }: { picked: boolean; glow?: string; onClick: () => void; children: React.ReactNode } & Record<`data-${string}`, string>) {
  return (
    <button onClick={onClick} {...rest}
      className="kib-press flex w-full items-center gap-3 px-3 py-2.5 text-left"
      style={{
        background: glow ? `linear-gradient(90deg, ${rgba(glow, 0.45)}, transparent 65%), #0b1020` : "#0b1020",
        boxShadow: `inset 0 0 0 ${picked ? 2 : 1}px ${picked ? "#ffd23f" : "rgba(255,255,255,.18)"}`,
        borderRadius: 4,
      }}>
      {children}
      {picked && <span className="shrink-0 text-[16px] font-black text-amber-300">✓</span>}
    </button>
  );
}

function Chooser({ label, onClick, children, ...rest }: { label: string; onClick: () => void; children: React.ReactNode } & Record<`data-${string}`, string>) {
  return (
    <button onClick={onClick} {...rest}
      className="kib-press flex h-[60px] w-full items-center gap-3 px-3 text-left text-white"
      style={{ background: "#0b1020", boxShadow: "inset 3px 0 0 #f5c518, inset 0 0 0 1px rgba(255,255,255,.18)", borderRadius: 4 }}>
      <span className="w-[50px] shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">{label}</span>
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-[17px] font-black uppercase tracking-wide" style={{ textShadow: NAME_OUTLINE }}>{children}</span>
      <span aria-hidden className="shrink-0 text-[18px] font-black text-amber-300">›</span>
    </button>
  );
}

function Stat({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-bold text-white/85">{k}</span>
      <span className={`truncate font-black ${gold ? "text-amber-300" : "text-white"}`} style={{ textShadow: NAME_OUTLINE }}>{v}</span>
    </div>
  );
}

function EuroTag({ comp }: { comp: string }) {
  return <span className="shrink-0 bg-sky-500 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-white" style={{ borderRadius: 2 }}>{EURO_TAG[comp] ?? comp}</span>;
}
