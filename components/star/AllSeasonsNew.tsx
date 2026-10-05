"use client";

/**
 * ALL SEASONS — the New look (Leo, 5 Oct 2026): "integrate … the seasons
 * area, the goals by season and the cabinet nicely into the all seasons
 * page in the actual game."
 *
 * The same pieces the career overview draws (CareerOverview.tsx), on a
 * career still being played: the season in progress is the top row, marked
 * "now". Settings → Look → "All seasons: New | Old" (lib/star/allSeasonsLook.ts);
 * Old is StatsTabs' AllSeasons, three tables, as it was.
 */
import { useMemo } from "react";
import type { CareerState } from "@/lib/star/types";
import { careerOverview } from "@/lib/star/careerOverview";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import ClubBadge from "./ClubBadge";
import { ArcChart, BigNumber, CabinetGrid, Heading, SeasonList } from "./CareerOverview";
import { FlatPanel, clubTheme, rgba } from "./ui";

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "").replace(/^(FC|AFC)\s+/i, "");

export default function AllSeasonsNew({ career }: { career: CareerState }) {
  const o = useMemo(() => careerOverview(career), [career]);
  const t = o.totals;
  // Team trophies, then yours (the Ballon d'Or leads them).
  const team = o.honours.filter(h => h.competition !== "Ballon d'Or");
  const awards = [...o.honours.filter(h => h.competition === "Ballon d'Or"), ...o.individual];
  return (
    <div data-all-seasons="new">
      <div className="grid grid-cols-3 gap-1.5">
        <BigNumber value={t.apps} label="Apps" />
        <BigNumber value={t.goals} label="Goals" />
        <BigNumber value={t.assists} label="Assists" />
        <BigNumber value={o.seasonsPlayed} label="Seasons" />
        <BigNumber value={t.trophies} label="Trophies" gold={t.trophies > 0} />
        <BigNumber value={t.avgRating ? t.avgRating.toFixed(2) : "—"} label="Avg rating" />
      </div>

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
          <div className="sk-num shrink-0 text-[20px] leading-none text-white">{o.peak.goals}<span className="ml-0.5 text-[11px] text-white/60">G</span> {o.peak.assists}<span className="ml-0.5 text-[11px] text-white/60">A</span></div>
        </div>
      )}

      <Heading right={<span className="text-[11px] font-black text-amber-200">{t.trophies}</span>}>The cabinet</Heading>
      {team.length > 0 ? <CabinetGrid items={team} /> : <EmptyShelf />}
      {awards.length > 0 && (
        <>
          <div className="mb-1.5 mt-3 text-[9.5px] font-black uppercase tracking-[0.18em] text-white/60">Your awards</div>
          <CabinetGrid items={awards} />
        </>
      )}

      <Heading>Season by season</Heading>
      <SeasonList o={o} newestFirst />

      <Heading>Per club</Heading>
      <div className="space-y-1">
        {o.clubs.map(cl => (
          <div key={cl.club} className="flex items-center gap-2 px-2 py-1.5" style={{ background: `linear-gradient(90deg, ${rgba(clubTheme(cl.club).glow, 0.2)}, rgba(255,255,255,.03) 60%)`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
            <ClubBadge club={cl.club} kit={kitsOf(cl.club).home} size={22} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-black text-white">{short(cl.club)}</div>
              <div className="text-[10px] font-bold text-white/60">{cl.years} · {cl.seasons} season{cl.seasons === 1 ? "" : "s"}</div>
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
              {[["Apps", cl.apps], ["G", cl.goals], ["A", cl.assists]].map(([l, v]) => (
                <div key={l as string} className="w-8">
                  <div className="sk-num text-[16px] leading-none tabular-nums text-white">{v}</div>
                  <div className="text-[8.5px] font-black uppercase tracking-wider text-white/55">{l}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="h-2" />
    </div>
  );
}

/** No trophies yet: four empty shelf places, blacked out (house rule). */
function EmptyShelf() {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {[0, 1, 2, 3].map(k => (
        <div key={k} className="h-[66px]" style={{ background: "rgba(0,0,0,.5)", boxShadow: "inset 0 -3px 0 rgba(120,72,24,.5), inset 0 0 0 1px rgba(255,255,255,.05)" }} />
      ))}
    </div>
  );
}
