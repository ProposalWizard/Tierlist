"use client";
import { useMemo, useState } from "react";
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import type { InterestLevel, InterestedClub, SeasonGrade, WindowInterest } from "@/lib/star/transferInterest";
import { INTEREST_STEPS, keenest, levelOf } from "@/lib/star/transferInterest";
import { leagueNameFor, divisionOf, type CareerDivision } from "@/lib/star/calendar";
import { formatMoney, formatMoneyPrecise } from "@/lib/star/money";
import ClubBadge from "./ClubBadge";
import { ScreenShell, BottomBar, BarButton, useClubTheme, clubTheme, rgba } from "./ui";

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
 *     same type of design style as the home page").
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

/** The Home screen's tile: dark glass lit from the top in one colour. */
function tile(color: string, strength = 0.38): React.CSSProperties {
  return {
    background: `radial-gradient(90% 80% at 50% 0%, ${rgba(color, strength)} 0%, transparent 75%), rgba(5,8,15,.78)`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1.5px ${rgba(color, 0.6)}, 0 6px 14px -8px ${rgba(color, 0.8)}`,
  };
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

  const close = () => { setBrowsing(null); setPage("hub"); };
  const closeBtn = (
    <button onClick={close} aria-label="Close" data-close
      className="kib-press flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px] font-black text-white"
      style={tile("#ffffff", 0.12)}>✕</button>
  );

  // ── Full-screen: the leagues with clubs interested in you ──
  if (page === "league") {
    return (
      <ScreenShell glow={theme.glow} title="Pick a league" right={closeBtn}>
        <p data-transfer-page="league" className="mb-2 text-[13px] font-bold text-white">{total} {total === 1 ? "club wants" : "clubs want"} you</p>
        <div className="space-y-2">
          {leagues.map(l => (
            <button key={l.division} data-league={l.division}
              onClick={() => { setBrowsing(l.division); setPage("club"); }}
              className="kib-press flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left"
              style={tile(l.division === league?.division ? "#34d399" : theme.glow)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[18px] font-black uppercase tracking-wide text-white">{leagueNameFor(l.division)}</span>
                <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-white/85">{stepWord(l.division, own)}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-black text-white">{l.clubs.length} {l.clubs.length === 1 ? "club" : "clubs"}</span>
              <span aria-hidden className="shrink-0 text-[20px] font-black text-white/80">›</span>
            </button>
          ))}
        </div>
      </ScreenShell>
    );
  }

  // ── Full-screen: every interested club in one league, A to Z ──
  if (page === "club" && browseLeague) {
    const ownLeague = browseLeague.division === own;
    return (
      <ScreenShell glow={theme.glow} title={leagueNameFor(browseLeague.division)} right={closeBtn}>
        <p data-transfer-page="club" className="mb-2 text-[13px] font-bold text-white">{browseLeague.clubs.length} {browseLeague.clubs.length === 1 ? "club is" : "clubs are"} interested · A to Z</p>
        <div className="space-y-2">
          {browseLeague.clubs.map(c => {
            const picked = c.club === club?.club && browseLeague.division === league?.division;
            return (
              <button key={c.club} data-club={c.club}
                onClick={() => { setDivision(browseLeague.division); setClubName(c.club); close(); }}
                className="kib-press flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                style={tile(clubTheme(c.club, career).glow, 0.45)}>
                <ClubBadge club={c.club} size={34} />
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
      </ScreenShell>
    );
  }

  // ── The window ──
  const clubGlow = club ? clubTheme(club.club, career).glow : theme.glow;
  const grade = GRADE_COLOUR[r.grade];
  return (
    <ScreenShell
      glow={theme.glow}
      title="Transfer window"
      bottomBar={
        <BottomBar cols="1fr 1.5fr">
          <BarButton icon={<span className="text-red-400">✕</span>} label="Stay" onClick={onStay} />
          <BarButton primary icon="✓" label={club ? `Negotiate · ${club.club}` : "Negotiate"} onClick={() => club && onNegotiate(club)} disabled={!club} />
        </BottomBar>
      }
    >
      <div data-transfer-hub="summer">
        {/* Your season, as a letter. */}
        <div data-season-grade={r.grade} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={tile(grade, 0.45)}>
          <span className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-xl text-[40px] font-black leading-none text-white"
            style={{ background: `linear-gradient(180deg, ${grade}, ${rgba(grade, 0.7)})`, boxShadow: `0 0 18px ${rgba(grade, 0.6)}, inset 0 1px 0 rgba(255,255,255,.45)`, textShadow: "0 2px 4px rgba(0,0,0,.45)" }}>
            {r.grade}
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-white">Your season</span>
            <span className="block text-[13px] font-bold text-white">
              {r.goals} goals · {r.assists} assists{r.rating !== null ? ` · ${r.rating.toFixed(1)} avg` : ""} · {r.apps} games
            </span>
          </span>
        </div>

        <p className="mt-3 text-[13px] font-black uppercase tracking-wide text-white">
          {total === 0 ? "No club has come in for you" : `${total} ${total === 1 ? "club wants" : "clubs want"} you`}
        </p>

        {league && club ? (
          <>
            <div className="mt-2 space-y-2">
              <Chooser label="League" glow={theme.glow} onClick={() => setPage("league")} data-chooser="league">
                <span className="truncate">{leagueNameFor(league.division)}</span>
                <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-black">{league.clubs.length} {league.clubs.length === 1 ? "club" : "clubs"}</span>
              </Chooser>
              <Chooser label="Club" glow={clubGlow} onClick={() => { setBrowsing(league.division); setPage("club"); }} data-chooser="club">
                <ClubBadge club={club.club} size={30} />
                <span className="min-w-0 flex-1 truncate">{club.club}</span>
                {club.europe && <EuroTag comp={club.europe} />}
              </Chooser>
            </div>

            {/* The club you picked, lit in its own colours. */}
            <div data-picked-club className="mt-3 rounded-xl px-3 py-3" style={tile(clubGlow, 0.5)}>
              <p className="text-[14px] font-bold italic text-white">“{club.why}”</p>
              <div className="mt-2 space-y-1.5 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white/85">How keen</span>
                  <InterestBar level={club.interest} wide />
                </div>
                <Stat k="Contract" v={`${club.offer.seasons} seasons`} />
                <Stat k="Your wage now" v={`${wageText(career.contract.wage)} a week`} />
                <Stat k="Your club gets" v={`★${formatMoney(club.fee)}`} />
                {club.division === own && <Stat k="Finished" v={`${ordinal(club.position)} of ${club.of}`} />}
              </div>
            </div>
          </>
        ) : (
          <p className="mt-6 text-[14px] font-bold text-white">Have a better season and the clubs will come.</p>
        )}
      </div>
    </ScreenShell>
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

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-bold text-white/85">{k}</span>
      <span className="truncate font-black text-white">{v}</span>
    </div>
  );
}

function EuroTag({ comp }: { comp: string }) {
  return <span className="shrink-0 rounded bg-sky-500 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">{EURO_TAG[comp] ?? comp}</span>;
}
