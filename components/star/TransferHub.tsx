"use client";
import { useMemo, useState } from "react";
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import type { InterestedClub, WindowInterest } from "@/lib/star/transferInterest";
import { leagueNameFor, divisionOf, type CareerDivision } from "@/lib/star/calendar";
import { levelOf } from "@/lib/star/transferInterest";
import { formatMoney, formatMoneyPrecise } from "@/lib/star/money";
import ClubBadge from "./ClubBadge";
import NationFlag from "./NationFlag";
import { ScreenShell, BottomBar, BarButton, useClubTheme, rgba } from "./ui";

/**
 * THE TRANSFER WINDOW (18 Oct 2026) — New Star Soccer's screen, in the game's
 * own look. Asked for directly, from a screenshot of NSS's "Desired
 * Transfer": "you click on a nation … then you click on a league that is
 * interested in you … then you click on the club area … and that would show
 * you every single club that is interested in signing you within the
 * selected league … once you have picked your club, you then click the
 * button to negotiate the contract."
 *
 * One screen, no scrolling: your season at the top, three choosers (Nation,
 * League, Club), the club you picked, and the bottom bar (✕ stay / ✓
 * negotiate). Each chooser opens a list over the screen. The rules for who
 * is in the lists live in lib/star/transferInterest.ts.
 */

interface Props {
  career: CareerState;
  interest: WindowInterest;
  onNegotiate: (club: InterestedClub) => void;
  /** Summer: stay at your club (the season rolls on). January: close the window screen. */
  onStay: () => void;
  stayLabel: string;
}

type Sheet = null | "nation" | "league" | "club";

const wageText = (w: number) => `★${formatMoneyPrecise(w)}`;
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/** "Champions League" → "CL" for the club row's tag, like NSS's "(CHAMPS)". */
const EURO_TAG: Record<string, string> = { "Champions League": "UCL", "Europa League": "UEL", "Conference League": "UECL" };

function stepWord(division: CareerDivision, own: CareerDivision): string {
  const d = levelOf(division) - levelOf(own);
  return d > 0 ? `${d} up` : d < 0 ? `${-d} down` : division === own ? "Your league" : "Same level";
}

export default function TransferHub({ career, interest, onNegotiate, onStay, stayLabel }: Props) {
  const theme = useClubTheme(career);
  const own = divisionOf(career);
  const leagues = interest.leagues;
  const [division, setDivision] = useState<CareerDivision | null>(leagues[0]?.division ?? null);
  const league = leagues.find(l => l.division === division) ?? leagues[0];
  const [clubName, setClubName] = useState<string | null>(league?.clubs[0]?.club ?? null);
  const club = league?.clubs.find(c => c.club === clubName) ?? league?.clubs[0];
  const [sheet, setSheet] = useState<Sheet>(null);
  const r = interest.report;
  const total = useMemo(() => leagues.reduce((n, l) => n + l.clubs.length, 0), [leagues]);

  const pickLeague = (d: CareerDivision) => {
    setDivision(d);
    setClubName(leagues.find(l => l.division === d)?.clubs[0]?.club ?? null);
    setSheet(null);
  };

  return (
    <ScreenShell
      glow={theme.glow}
      title={interest.window === "january" ? "January window" : "Transfer window"}
      bottomBar={
        <BottomBar cols="1fr 1fr">
          <BarButton icon={<span className="text-red-400">✕</span>} label={stayLabel} onClick={onStay} />
          <BarButton primary icon="✓" label="Negotiate" onClick={() => club && onNegotiate(club)} disabled={!club} />
        </BottomBar>
      }
    >
      <div data-transfer-hub={interest.window}>
        {/* Your season: what decided who is interested. */}
        <div data-season-grade={r.grade} className="flex items-center justify-between gap-3 border-y border-white/15 px-3 py-2" style={{ background: rgba(theme.glow, 0.12) }}>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/80">
              {interest.window === "january" ? "Your season so far" : "Your season"}
            </div>
            <div className="truncate text-[13px] font-bold text-white">
              {r.goals} goals · {r.assists} assists{r.rating !== null ? ` · ${r.rating.toFixed(1)} avg` : ""} · {r.apps} games
            </div>
          </div>
          <div className={`shrink-0 text-[22px] font-black uppercase leading-none ${GRADE_TONE[r.grade]}`}>{r.grade}</div>
        </div>

        <div className="mt-3 bg-black/45 px-3 py-2 text-center text-[12px] font-black uppercase tracking-wide text-white">
          {total === 0 ? "No club has come in for you" : `${total} ${total === 1 ? "club wants" : "clubs want"} you · pick where you'd like to go`}
        </div>

        {league && club ? (
          <>
            <div className="mt-2 space-y-2">
              <Chooser label="Nation" onClick={() => setSheet("nation")} data-chooser="nation">
                <NationFlag nation="England" width={30} />
                <span className="truncate">England</span>
              </Chooser>
              <Chooser label="League" onClick={() => setSheet("league")} data-chooser="league">
                <span className="truncate">{leagueNameFor(league.division)}</span>
                <span className="shrink-0 text-[11px] font-black uppercase tracking-wide text-white/75">{league.clubs.length} {league.clubs.length === 1 ? "club" : "clubs"}</span>
              </Chooser>
              <Chooser label="Club" onClick={() => setSheet("club")} data-chooser="club">
                <ClubBadge club={club.club} size={30} />
                <span className="truncate">{club.club}</span>
                {club.europe && <EuroTag comp={club.europe} />}
              </Chooser>
            </div>

            {/* The club you picked. */}
            <div data-picked-club className="mt-3 border-y border-white/15 px-3 py-2.5" style={{ background: "rgba(0,0,0,.35)" }}>
              <p className="text-[13px] font-bold italic text-white">“{club.why}”</p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
                <Row k="Finished" v={`${ordinal(club.position)} of ${club.of}`} />
                <Row k="Role" v={club.role} />
                <Row k="Wage" v={`${wageText(club.offer.wage)}/wk`} up={club.offer.wage > career.contract.wage} />
                <Row k="Now" v={`${wageText(career.contract.wage)}/wk`} />
                <Row k="Contract" v={`${club.offer.seasons} seasons`} />
                <Row k="Your club gets" v={`★${formatMoney(club.fee)}`} />
              </div>
            </div>
          </>
        ) : (
          <p className="mt-6 px-3 text-center text-[14px] font-bold text-white">
            Have a better season and the clubs will come.
          </p>
        )}
      </div>

      {sheet && league && (
        <SheetBox title={sheet === "nation" ? "Nation" : sheet === "league" ? "League" : leagueNameFor(league.division)} onClose={() => setSheet(null)}>
          {sheet === "nation" && (
            <SheetRow picked onClick={() => setSheet(null)}>
              <NationFlag nation="England" width={30} />
              <span className="flex-1 truncate">England</span>
              <span className="text-[11px] font-black uppercase text-white/75">{total} clubs</span>
            </SheetRow>
          )}
          {sheet === "league" && leagues.map(l => (
            <SheetRow key={l.division} picked={l.division === league.division} onClick={() => pickLeague(l.division)} data-league={l.division}>
              <span className="flex-1 truncate">{leagueNameFor(l.division)}</span>
              <span className="shrink-0 text-right leading-tight">
                <span className="block text-[12px] font-black text-white">{l.clubs.length} {l.clubs.length === 1 ? "club" : "clubs"}</span>
                <span className="block text-[10px] font-black uppercase tracking-wide text-white/70">{stepWord(l.division, own)}</span>
              </span>
            </SheetRow>
          ))}
          {sheet === "club" && league.clubs.map(c => (
            <SheetRow key={c.club} picked={c.club === club?.club} onClick={() => { setClubName(c.club); setSheet(null); }} data-club={c.club}>
              <ClubBadge club={c.club} size={28} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate">{c.club}</span>
                  {c.europe && <EuroTag comp={c.europe} />}
                </span>
                <span className="block text-[11px] font-bold text-white/75">{ordinal(c.position)} · {c.role}</span>
              </span>
              <span className="shrink-0 text-[12px] font-black tabular-nums text-white">{wageText(c.offer.wage)}</span>
            </SheetRow>
          ))}
        </SheetBox>
      )}
    </ScreenShell>
  );
}

const GRADE_TONE: Record<string, string> = {
  Poor: "text-red-400", Steady: "text-white", Good: "text-emerald-300", Great: "text-sky-300", Crazy: "text-amber-300",
};

function Chooser({ label, onClick, children, ...rest }: { label: string; onClick: () => void; children: React.ReactNode } & Record<`data-${string}`, string>) {
  return (
    <button
      onClick={onClick}
      className="kib-press flex h-[62px] w-full items-center gap-3 px-3 text-left text-white"
      style={{ background: "linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.2), inset 0 0 0 1px rgba(255,255,255,.12)", borderRadius: 3 }}
      {...rest}
    >
      <span aria-hidden className="text-[16px] text-white/60">▶</span>
      <span className="w-[52px] shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-white/70">{label}</span>
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-[17px] font-black uppercase tracking-wide">{children}</span>
    </button>
  );
}

function Row({ k, v, up }: { k: string; v: string; up?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-white/75">{k}</span>
      <span className={`truncate font-black ${up ? "text-emerald-300" : "text-white"}`}>{v}</span>
    </div>
  );
}

function EuroTag({ comp }: { comp: string }) {
  return <span className="shrink-0 bg-sky-500/30 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-sky-100" style={{ borderRadius: 2 }}>{EURO_TAG[comp] ?? comp}</span>;
}

function SheetBox({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose} data-transfer-sheet>
      <div className="flex max-h-[78dvh] w-full max-w-md flex-col bg-[#0b1220] text-white" style={{ boxShadow: "0 -10px 30px rgba(0,0,0,.7)", borderTop: "1px solid rgba(255,255,255,.2)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[15px] font-black uppercase tracking-wide">{title}</span>
          <button onClick={onClose} aria-label="Close" className="kib-press h-8 w-8 text-[18px] font-black text-white/80">✕</button>
        </div>
        <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
      </div>
    </div>
  );
}

function SheetRow({ picked, onClick, children, ...rest }: { picked: boolean; onClick: () => void; children: React.ReactNode } & Record<`data-${string}`, string>) {
  return (
    <button
      onClick={onClick}
      className={`kib-press flex w-full items-center gap-3 border-t border-white/10 px-4 py-2.5 text-left text-[15px] font-black ${picked ? "bg-emerald-500/20" : ""}`}
      {...rest}
    >
      {children}
      {picked && <span className="shrink-0 text-emerald-300">✓</span>}
    </button>
  );
}
