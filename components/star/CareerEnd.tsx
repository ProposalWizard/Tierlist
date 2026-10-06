"use client";

/**
 * THE END OF A CAREER — the two screens before the career overview.
 *
 * Leo, 5 Oct 2026: every career lasts CAREER_SEASONS (20) seasons
 * (lib/star/retirement.ts). "Before you choose whether to transfer or to stay
 * at your club, it should have a pop-up saying this is your final season
 * before retirement. End your career in the right way."
 *
 *   FinalSeasonNotice  after the Ballon d'Or night of season 19, before the
 *                      transfer window: next season is the last one.
 *   FinalWhistle       after the Ballon d'Or night of season 20: the career
 *                      is over. "Hang them up" opens the career overview.
 *
 * New UI only. The Old UI keeps its own (frozen) RetirementChoice screen.
 */
import { useMemo } from "react";
import type { CareerState } from "@/lib/star/types";
import { careerVerdict, testimonialFor, CAREER_SEASONS } from "@/lib/star/retirement";
import { careerOverview } from "@/lib/star/careerOverview";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import { formatMoney } from "@/lib/star/money";
import ClubBadge from "./ClubBadge";
import { ScreenShell, FlatPanel, CountUp, RiseIn, BottomBar, BarButton, clubTheme, rgba } from "./ui";
import { Rays } from "./ui/Screen";

const GOLD = "#fbbf24";
const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

/**
 * One square per season of the career, coloured by the club you played it
 * for; the last one gold. A career's length, at a glance.
 */
function SeasonTrack({ career, played, endLabel }: { career: CareerState; played: number; endLabel?: string }) {
  const cap = CAREER_SEASONS ?? Math.max(played + 1, 1);
  const o = useMemo(() => careerOverview(career), [career]);
  const firstAge = o.seasons[0]?.age ?? career.player.age - (career.season - 1);
  return (
    <div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cap}, minmax(0, 1fr))` }}>
        {Array.from({ length: cap }, (_, k) => {
          const season = k + 1;
          const last = season === cap;
          const club = o.seasons[k]?.club;
          const done = season <= played;
          const colour = club ? clubTheme(club).glow : "rgba(255,255,255,.35)";
          return (
            <div
              key={season}
              title={`Season ${season}${club ? ` · ${club}` : ""}`}
              className={last ? "kib-breathe" : undefined}
              style={{
                height: last ? 30 : 22,
                alignSelf: "end",
                // The last season is gold whether or not it is played yet.
                background: last ? `linear-gradient(180deg, ${GOLD}, #b45309)` : done ? colour : "rgba(255,255,255,.08)",
                boxShadow: last ? `0 0 14px ${rgba(GOLD, 0.7)}, inset 0 0 0 1px rgba(255,255,255,.5)` : "inset 0 0 0 1px rgba(255,255,255,.12)",
                opacity: done || last ? 1 : 0.6,
              }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] font-black tabular-nums text-white/70">
        <span>Age {firstAge}</span>
        <span className="text-amber-200">{endLabel ?? `Last season · age ${firstAge + cap - 1}`}</span>
      </div>
    </div>
  );
}

/** After season 19's Ballon d'Or night: the next season is the last. */
export function FinalSeasonNotice({ career, onContinue }: { career: CareerState; onContinue: () => void }) {
  const glow = clubTheme(career.player.club).glow;
  const cap = CAREER_SEASONS ?? career.season + 1;
  return (
    <ScreenShell
      glow={glow}
      title=""
      bare
      tone="calm"
      bottomBar={(
        <BottomBar>
          <BarButton icon="›" label="Continue" onClick={onContinue} primary />
        </BottomBar>
      )}
    >
      {/* Centred on a tall phone; on a short one it simply starts at the top. */}
      <div className="flex min-h-[calc(100dvh-120px)] flex-col justify-center px-1 py-6 text-center" data-final-season-notice>
        <RiseIn>
          <span className="inline-block px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-amber-200" style={{ background: "rgba(251,191,36,.14)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.4)", borderRadius: 2 }}>
            Season {career.season} is over
          </span>
        </RiseIn>
        <RiseIn index={1}>
          <div className="relative mx-auto mt-4 grid h-[120px] place-items-center">
            <Rays color="#fde68a" size={260} />
            <h1 className="relative text-[46px] uppercase leading-[0.95] text-white" style={{ filter: "drop-shadow(0 3px 10px rgba(0,0,0,.7))" }}>
              Final<br /><span className="text-amber-300">season</span>
            </h1>
          </div>
        </RiseIn>
        <RiseIn index={2}>
          <p className="mx-auto mt-4 max-w-[310px] text-[15px] font-bold leading-snug text-white">
            Season {cap} is your last before retirement.
          </p>
          <p className="mx-auto mt-1 max-w-[310px] text-[15px] font-bold leading-snug text-amber-200">
            End your career the right way.
          </p>
        </RiseIn>
        <RiseIn index={3}>
          <FlatPanel bleed fade="none" edge className="mt-5 px-3 py-3 text-left">
            <SeasonTrack career={career} played={career.season} />
          </FlatPanel>
        </RiseIn>
        <RiseIn index={4}>
          <div className="mt-3 flex items-center justify-center gap-2 text-[12.5px] font-bold text-white/85">
            <ClubBadge club={career.player.club} kit={kitsOf(career.player.club).home} size={22} />
            <span>Stay at {short(career.player.club)}, or choose a club for the last one.</span>
          </div>
        </RiseIn>
      </div>
    </ScreenShell>
  );
}

/** After the last season's Ballon d'Or night: the career is over. */
export function FinalWhistle({ career, onRetire }: { career: CareerState; onRetire: () => void }) {
  const glow = clubTheme(career.player.club).glow;
  const v = careerVerdict(career);
  const t = testimonialFor(career);
  const s = career.careerStats;
  return (
    <ScreenShell
      glow={glow}
      title=""
      bare
      tone="calm"
      bottomBar={(
        <BottomBar>
          <BarButton icon="🥾" label="Hang them up" onClick={onRetire} primary />
        </BottomBar>
      )}
    >
      {/* Centred on a tall phone; on a short one it simply starts at the top. */}
      <div className="flex min-h-[calc(100dvh-120px)] flex-col justify-center px-1 py-6 text-center" data-final-whistle>
        <RiseIn>
          <span className="inline-block px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-amber-200" style={{ background: "rgba(251,191,36,.14)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.4)", borderRadius: 2 }}>
            {CAREER_SEASONS ?? career.season} seasons
          </span>
        </RiseIn>
        <RiseIn index={1}>
          <div className="relative mx-auto mt-4 grid h-[120px] place-items-center">
            <Rays color="#fde68a" size={260} />
            <h1 className="relative text-[46px] uppercase leading-[0.95] text-white" style={{ filter: "drop-shadow(0 3px 10px rgba(0,0,0,.7))" }}>
              The final<br /><span className="text-amber-300">whistle</span>
            </h1>
          </div>
        </RiseIn>
        <RiseIn index={2}>
          <p className="mx-auto mt-4 max-w-[310px] text-[15px] font-bold leading-snug text-white">
            That was your last season. Time to hang them up.
          </p>
        </RiseIn>
        <RiseIn index={3}>
          <FlatPanel bleed fade="none" edge className="mt-5 px-3 py-3 text-left">
            <SeasonTrack career={career} played={career.season} endLabel={`Age ${career.player.age} · the end`} />
          </FlatPanel>
        </RiseIn>
        <RiseIn index={4}>
          <FlatPanel bleed fade="none" edge className="mt-2 px-3 py-3">
            <div className="kit-text-shine text-[24px] font-black uppercase leading-none" style={{ backgroundImage: "linear-gradient(100deg,#fde68a 20%,#ffffff 45%,#fbbf24 60%,#fde68a 80%)" }}>
              {v.title}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[
                { label: "Apps", value: s.appearances },
                { label: "Goals", value: s.goals },
                { label: "Trophies", value: career.trophies.length },
              ].map(n => (
                <div key={n.label} className="px-1 py-2" style={{ background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
                  <div className="sk-num text-[26px] leading-none tabular-nums text-white"><CountUp value={n.value} ms={1100} /></div>
                  <div className="mt-1 text-[9.5px] font-black uppercase tracking-wider text-white/70">{n.label}</div>
                </div>
              ))}
            </div>
          </FlatPanel>
        </RiseIn>
        {t && (
          <RiseIn index={5}>
            <div className="mt-2 flex items-center gap-2.5 px-2.5 py-2 text-left" style={{ background: `linear-gradient(90deg, ${rgba(GOLD, 0.22)}, rgba(255,255,255,.03))`, boxShadow: "inset 0 0 0 1px rgba(251,191,36,.4)" }}>
              <ClubBadge club={t.club} kit={kitsOf(t.club).home} size={26} />
              <div className="min-w-0 flex-1 text-[12.5px] font-bold text-white">
                {short(t.club)} put on a testimonial for you
              </div>
              <div className="sk-num shrink-0 text-[18px] leading-none text-amber-200">★{formatMoney(t.payout)}</div>
            </div>
          </RiseIn>
        )}
      </div>
    </ScreenShell>
  );
}
