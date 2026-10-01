"use client";
import { useEffect, useRef, useState } from "react";
import type { MatchStats } from "@/lib/star/types";
import { kitsFor, type Kit } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { CHANCE_KIND_LABEL, CHANCE_OUTCOME_LABEL, chanceOutcomeGood, type ChanceOutcome } from "@/lib/star/chanceLog";
import { minuteLabel } from "@/lib/star/addedTime";
import ClubBadge from "./ClubBadge";
import { ClubCard, CountUp, PressButton, Burst, FloatText, Glow, Shine, Pop, clubTheme, rgba, prefersReducedMotion } from "./ui";
import { SquareBar } from "./ui/Flat";
import { Screen, Kicker, SectionLabel, useLater } from "./ui/Screen";

/** Every star, not a rounded "3k" — Harry wants the real numbers. */
const exact = (n: number) => Math.round(n).toLocaleString("en-GB");

interface Props {
  stats: MatchStats;
  homeTeam: string;
  awayTeam: string;
  /**
   * Were YOU the home side? Needed because `MatchStats.homeScore` does not
   * mean what it says: `finaliseMatch` fills it with the USER's score and
   * `awayScore` with the opponent's, whatever the venue (every other reader —
   * careerFlow, the media record, the league table — treats them that way).
   * This screen was the one place pairing them with venue-ordered team names,
   * so an away win read back as a home defeat by the same scoreline.
   */
  youAreHome?: boolean;
  onContinue: () => void;
  /** The competition, when it was not a league game. */
  competition?: string;
  /** What the tie did to the run: through, out, or a trophy. */
  knockout?: string | null;
  /** Your star rating before and after this match — the bar on a simmed
   *  match's result (item 36). */
  starBefore?: number;
  starAfter?: number;
  /** Star Points this match earned, and the way to the next level (starPoints.ts).
   *  `total` is everything that moved the rating (the match plus any debut,
   *  achievement or trophy it brought), and `extra` names the rest. */
  star?: { sp: number; base: number; mult: number; toNext: number; gate?: string; total?: number; extra?: { label: string; sp: number; n?: number }[];
    /** Levels the one-level-a-match cap held back, and the points past the
     *  next level carried to the matches after (starPoints.ts). */
    held?: number; carried?: number };
  /** Achievements this match unlocked, shown one at a time at the end; you
   *  cannot press Continue until you have seen them all (Harry, P27). */
  achievements?: { label: string; description: string }[];
}

// The same black outline the live scoreboard puts on its club-name text —
// white over a light kit (Fulham/Leeds white, a bright yellow away strip)
// needs it to stay legible.
const NAME_OUTLINE = {
  textShadow: "-1px -1px 1.5px #000, 1px -1px 1.5px #000, -1px 1px 1.5px #000, 1px 1px 1.5px #000",
};

type Result = "win" | "draw" | "loss";
const RESULT_LOOK: Record<Result, { word: string; color: string }> = {
  win: { word: "Win", color: "#34d399" },
  draw: { word: "Draw", color: "#fbbf24" },
  loss: { word: "Defeat", color: "#f87171" },
};

/**
 * THE FINAL WHISTLE, AS A MOMENT (Harry, 28 Sep 2026: "we need stuff like
 * that all over").
 *
 * The same numbers as ever, in the same order, revealed in beats: the score
 * slams in and counts up, a win bursts and a defeat shakes, the match rating
 * counts up big, then the money and the relationship changes float up off
 * their rows. For a phone set to reduce motion every beat lands at once.
 */
export default function PostMatch({ stats, homeTeam, awayTeam, onContinue, competition, knockout, youAreHome = true, starBefore, starAfter, star, achievements = [] }: Props) {
  const hs = youAreHome ? stats.homeScore : stats.awayScore;
  const as = youAreHome ? stats.awayScore : stats.homeScore;
  const kits = kitsFor(homeTeam, awayTeam);
  const mine = youAreHome ? homeTeam : awayTeam;
  const theme = clubTheme(mine);
  // Item 26: tapping the rating opens the list of your chances.
  const [chancesOpen, setChancesOpen] = useState(false);
  const log = stats.chanceLog;

  const us = stats.homeScore, them = stats.awayScore;
  const through = !!knockout && (knockout.startsWith("🏆") || knockout.startsWith("Into") || knockout.startsWith("Through"));
  const out = !!knockout && !through;
  const result: Result = us > them ? "win" : us < them ? "loss" : "draw";
  const look = RESULT_LOOK[result];
  const celebrate = result === "win" || through;
  const sting = result === "loss" || out;

  // The beats. Each is on straight away for reduced motion.
  // NSS order (Harry, P27): the star rating bar rises first, then the match
  // rating, then what it did to relationships, then wage / bonus / cash, then
  // the achievements, one at a time.
  const scoreIn = useLater(250);
  const verdict = useLater(1000);
  const starIn = useLater(1400);
  const ratingIn = useLater(2500);
  const relIn = useLater(3500);
  const moneyIn = useLater(4400);
  const achIn = useLater(5400);
  const [seen, setSeen] = useState(0);
  const allSeen = achievements.length === 0 || seen >= achievements.length;
  const canContinue = allSeen && (achievements.length === 0 || achIn);

  return (
    <Screen glow={theme.glow} tone={look.color}>
      <div className="mb-2 flex justify-center">
        <Kicker color={competition ? "#93c5fd" : "#fcd34d"}>{competition ? competition : "Full Time"}</Kicker>
      </div>

      {/* ── The scoreboard: both crests, the score slamming in ── */}
      <div className={verdict && sting ? "kit-shake-x" : ""}>
        <ClubCard duel={[kits.home.shirt, kits.away.shirt]} className="relative overflow-hidden px-2 pb-3 pt-3">
          {verdict && celebrate && <Burst colors={[theme.shirt, theme.trim, "#fde047", "#ffffff"]} count={28} className="left-1/2 top-[45%]" />}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
            <Side club={homeTeam} kit={kits.home} you={youAreHome} />
            <div className="flex items-center gap-1.5 px-1">
              <Digit value={hs} on={scoreIn} />
              <span className="pb-1 text-[22px] font-black text-white/40">–</span>
              <Digit value={as} on={scoreIn} delay={120} />
            </div>
            <Side club={awayTeam} kit={kits.away} you={!youAreHome} />
          </div>
          <div className="mt-2 flex justify-center">
            <span
              className={`rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-[0.3em] ${verdict ? "kit-slam" : "opacity-0"}`}
              style={{ color: look.color, background: rgba(look.color, 0.16), boxShadow: `inset 0 0 0 1px ${rgba(look.color, 0.45)}, 0 0 18px ${rgba(look.color, 0.35)}` }}
            >
              {look.word}
            </span>
          </div>
        </ClubCard>
      </div>

      {knockout && (
        <div
          className={`relative mt-2 overflow-hidden rounded-xl px-3 py-2.5 text-center text-sm font-black ${verdict ? "kit-slam" : ""} ${
            knockout.startsWith("🏆") ? "text-gray-950" : "text-white"}`}
          style={{
            background: knockout.startsWith("🏆") ? "linear-gradient(180deg,#fde68a,#fbbf24 55%,#d97706)"
              : through ? "linear-gradient(180deg,#34d399,#059669 60%,#065f46)"
                : "linear-gradient(180deg,#f87171,#b91c1c 60%,#7f1d1d)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 8px 18px -8px rgba(0,0,0,.8)",
          }}
        >
          {through && <Shine trigger={verdict ? 1 : 0} />}
          {knockout}
        </div>
      )}

      {/* The order is the point: star bar, match rating, relationships, pay,
          achievements. Each block arrives on its beat (everything at once for
          a phone set to reduce motion). No "+N points" text anywhere. */}
      {stats.simmed ? (
        <ClubCard glow={theme.glow} className="mt-2.5 overflow-hidden">
          <div className="border-b border-white/10 bg-sky-500/10 py-1.5 text-center text-[10.5px] font-black uppercase tracking-[0.2em] text-sky-200">
            ⏩ Simulated{stats.enteredAt ? ` · on at ${stats.enteredAt}'` : ""}
          </div>
          <StarBar before={starBefore} after={starAfter} on={starIn} star={star} />
          <RatingHero value={stats.rating} on={ratingIn} starMan={stats.starMan} />
          <div className="grid grid-cols-2 gap-2 p-2.5 pt-0">
            <StatTile label="Goals" value={stats.goals} on={ratingIn} highlight={stats.goals > 0} />
            <StatTile label="Assists" value={stats.assists} on={ratingIn} highlight={stats.assists > 0} />
          </div>
        </ClubCard>
      ) : (<>
        {starAfter !== undefined && (
          <ClubCard glow="#fbbf24" strength={0.2} className="mt-2.5 overflow-hidden">
            <StarBar before={starBefore} after={starAfter} on={starIn} star={star} />
          </ClubCard>
        )}

        <ClubCard glow={theme.glow} className="mt-2 overflow-hidden">
          <RatingHero
            value={stats.rating}
            on={ratingIn}
            starMan={stats.starMan}
            onTap={log ? () => setChancesOpen((o) => !o) : undefined}
            open={chancesOpen}
          />
          {log && chancesOpen && <ChanceList chances={log} />}
        </ClubCard>

        <div className="mt-2 grid grid-cols-4 gap-1.5">
          <StatTile label="Chances" value={stats.chances} on={ratingIn} />
          <StatTile label="Goals" value={stats.goals} on={ratingIn} highlight={stats.goals > 0} />
          <StatTile label="Assists" value={stats.assists} on={ratingIn} highlight={stats.assists > 0} />
          <StatTile label="Passes" value={stats.passes} on={ratingIn} />
        </div>

        <div className={`mt-2 grid grid-cols-3 gap-1.5 ${relIn ? "kit-rise" : "opacity-0"}`}>
          <RelChip label="Boss" delta={stats.bossChange} on={relIn} />
          <RelChip label="Team" delta={stats.teamChange} on={relIn} />
          <RelChip label="Fans" delta={stats.fansChange} on={relIn} />
        </div>

        <div className={moneyIn ? "kit-rise" : "opacity-0"}>
        <ClubCard glow="#fbbf24" strength={0.18} className="mt-2 overflow-hidden">
          <SectionLabel className="px-3 pb-1 pt-2.5">Pay</SectionLabel>
          <RowStar label="Wage" value={stats.wage} on={moneyIn} />
          <RowStar label="Goal Bonus" value={stats.goalBonus} on={moneyIn} />
          <RowStar label="Sponsors" value={stats.sponsorPay} on={moneyIn} />
          <div className="relative mx-2 mb-2 mt-1 flex items-center overflow-hidden rounded-xl px-3 py-2.5" style={{ background: "linear-gradient(180deg,#34d399,#059669 60%,#065f46)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 6px 14px -8px rgba(16,185,129,.8)" }}>
            <Shine trigger={moneyIn ? 1 : 0} />
            <div className="flex-1 text-sm font-black text-white">Total Cash</div>
            <div className="relative flex items-center gap-1 text-[17px] font-black tabular-nums text-white">
              <StarIcon /> <CountUp value={moneyIn ? stats.totalCash : 0} ms={900} format={exact} />
              <FloatText trigger={moneyIn && stats.totalCash > 0 ? 1 : 0} text={`+★${exact(stats.totalCash)}`} color="#fde047" className="left-1/2 -top-3" size={13} />
            </div>
          </div>
        </ClubCard>
        </div>
      </>)}

      {/* The achievements, one at a time. Continue stays shut until every one
          has been seen. */}
      {achIn && achievements.length > 0 && seen < achievements.length && (
        <AchievementCard key={seen} a={achievements[seen]} n={seen + 1} of={achievements.length} onNext={() => setSeen((k) => k + 1)} />
      )}

      <PressButton variant="primary" size="lg" pulse={canContinue} disabled={!canContinue} onClick={onContinue} className="relative mt-3 flex w-full items-center justify-center gap-2 overflow-hidden">
        {canContinue && <Shine loop every={5} />}
        Continue
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </PressButton>
    </Screen>
  );
}

/** One side of the scoreboard: the crest (lit in its own kit colour) and a
 *  short name plate in the kit, outlined so a white kit still reads. */
function Side({ club, kit, you }: { club: string; kit: Kit; you: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="relative grid h-[54px] w-[54px] place-items-center">
        <div className="relative" style={{ filter: "drop-shadow(0 3px 5px rgba(0,0,0,.55))" }}>
          <ClubBadge club={club} kit={kit} size={50} />
        </div>
      </div>
      <div
        className="mt-1 w-full truncate rounded-md border px-1.5 py-0.5 text-center text-[11px] font-black uppercase text-white"
        style={{ backgroundColor: kit.shirt, borderColor: kit.trim, ...NAME_OUTLINE }}
      >
        {shortClub(club)}
      </div>
      <div className={`mt-0.5 text-[8.5px] font-black uppercase tracking-widest text-emerald-300 ${you ? "" : "invisible"}`}>You</div>
    </div>
  );
}

/** A big score digit on a white plate — counts up from nothing as it lands. */
function Digit({ value, on, delay = 0 }: { value: number; on: boolean; delay?: number }) {
  return (
    <div
      className={`grid h-[52px] min-w-[44px] place-items-center rounded-xl bg-gradient-to-b from-white to-slate-200 px-2 text-[34px] font-black leading-none tabular-nums text-gray-950 ${on ? "kit-slam" : "opacity-0"}`}
      style={{ animationDelay: `${delay}ms`, boxShadow: "inset 0 -3px 0 rgba(0,0,0,.15), 0 8px 18px -6px rgba(0,0,0,.8)" }}
    >
      <CountUp value={on ? value : 0} ms={500} />
    </div>
  );
}

/** A number over a small caps label, counting up once its beat arrives. */
function StatTile({ label, value, on, highlight }: { label: string; value: number; on: boolean; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl px-1 py-1.5 text-center"
      style={highlight
        ? { background: "linear-gradient(180deg, rgba(52,211,153,.28), rgba(16,185,129,.1))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.18), inset 0 0 0 1px rgba(52,211,153,.4)" }
        : { background: "linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.04))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px rgba(255,255,255,.08)" }}
    >
      <div className={`text-[20px] font-black leading-tight tabular-nums ${highlight ? "text-emerald-300" : "text-white"}`}>
        <CountUp value={on ? value : 0} ms={600} />
      </div>
      <div className="text-[8px] font-black uppercase tracking-[0.18em] text-white/55">{label}</div>
    </div>
  );
}

/** The match rating, big, counting up — tap it for your chances (item 26). */
function RatingHero({ value, on, starMan, onTap, open }: { value: number; on: boolean; starMan: boolean; onTap?: () => void; open?: boolean }) {
  const color = value >= 8 ? "#6ee7b7" : value >= 7 ? "#fde047" : value >= 6 ? "#ffffff" : "#f87171";
  const inner = (
    <div className="relative flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Match Rating</div>
        {onTap && <div className="mt-0.5 text-[11px] font-bold text-white/80">{open ? "Hide chances ▴" : "Your chances ▾"}</div>}
        {starMan && (
          <div className={`mt-1 inline-block rounded-md bg-gradient-to-b from-yellow-300 to-amber-500 px-2 py-0.5 text-[10px] font-black uppercase text-gray-950 ${on ? "kit-stamp" : "opacity-0"}`} style={{ animationDelay: "500ms" }}>
            ★ Star Man!
          </div>
        )}
      </div>
      <div className="relative">
        <Glow color={color} alpha={on ? 0.35 : 0} className="inset-0 blur-xl" />
        <div className="relative text-[46px] font-black leading-none tabular-nums" style={{ color, textShadow: `0 0 18px ${rgba(color, 0.5)}, 0 3px 6px rgba(0,0,0,.6)` }}>
          <CountUp value={on ? value : 0} ms={1000} format={(n) => n.toFixed(1)} />
        </div>
      </div>
    </div>
  );
  return onTap ? (
    <button onClick={onTap} aria-expanded={open} className="kib-press block w-full">{inner}</button>
  ) : inner;
}

/** Item 26: every chance that came to you — the minute, what it was, what happened. */
function ChanceList({ chances }: { chances: { minute: number; kind: string; outcome: string }[] }) {
  return (
    <div className="border-t border-white/10 bg-black/30 px-3 py-2">
      {chances.length === 0 && <div className="text-[12px] font-bold text-white/80">No chances came to you.</div>}
      {chances.map((c, i) => (
        <div key={i} className="kit-rise flex items-center gap-2 py-0.5 text-[12px] font-black text-white" style={{ animationDelay: `${i * 50}ms` }}>
          <span className="w-10 shrink-0 tabular-nums text-white/75">{minuteLabel(c.minute)}&apos;</span>
          <span className="min-w-0 flex-1 truncate">{CHANCE_KIND_LABEL[c.kind] ?? c.kind}</span>
          <span className={`shrink-0 ${chanceOutcomeGood(c.outcome) ? "text-emerald-300" : "text-red-300"}`}>
            {CHANCE_OUTCOME_LABEL[c.outcome as ChanceOutcome] ?? c.outcome}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Your star rating as a bar that rises (Harry, P5, P27: "the star rating goes
 * up, but it doesn't say plus 100 points … just the star rating bar is good
 * enough"). The bar is the way to the next level. A level up fills it, ticks
 * the number, and starts the next level's bar. No point totals, no "this match"
 * lines, no "% of the way".
 */
function StarBar({ before, after, on, star }: { before?: number; after?: number; on: boolean; star?: Props["star"] }) {
  const from = Math.floor(before ?? after ?? 0);
  const to = Math.floor(after ?? from);
  const up = to > from;
  const endPct = star ? Math.max(3, star.toNext * 100) : 0;
  // 0: waiting · 1: rising (to the top on a level up) · 2: new level, rising again
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!on) return;
    if (prefersReducedMotion()) { setStage(up ? 2 : 1); return; }
    setStage(1);
    if (!up) return;
    const t1 = setTimeout(() => setStage(2), 1100);
    return () => clearTimeout(t1);
  }, [on, up]);
  if (after === undefined) return null;
  const value = stage === 0 ? 0 : up && stage === 1 ? 100 : endPct;
  return (
    <div className="relative px-3 py-2.5">
      {/* P35: no numbers, just the words and the bar. */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <Pop value={up && stage >= 2 ? 1 : 0}><StarIcon /></Pop>
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">Star rating</span>
      </div>
      <div role="meter" aria-label="Star rating" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
        <SquareBar value={value} colors={["#f59e0b", "#fde047"]} className="h-[18px]" animate={stage > 0} />
      </div>
    </div>
  );
}

/** One achievement, big, with a Next — shown alone (Harry, P27: "you can't
 *  press next until you've seen all your achievements"). */
function AchievementCard({ a, n, of, onNext }: { a: { label: string; description: string }; n: number; of: number; onNext: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" }); }, []);
  return (
    <div ref={ref} className="kit-slam relative mt-2 overflow-hidden rounded-xl text-center" style={{ background: "linear-gradient(180deg, rgba(251,191,36,.22), rgba(120,53,15,.35))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.25), inset 0 0 0 2px rgba(251,191,36,.7), 0 0 24px rgba(251,191,36,.3)" }}>
      <Burst colors={["#fde047", "#fbbf24", "#ffffff"]} count={20} className="left-1/2 top-[40%]" round />
      <div className="px-3 pb-3 pt-2.5">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Achievement{of > 1 ? ` ${n} of ${of}` : ""}</div>
        <div className="mt-1 text-[40px] leading-none" style={{ filter: "drop-shadow(0 0 14px rgba(251,191,36,.8))" }}>⭐</div>
        <div className="mt-1 text-[18px] font-black leading-tight">{a.label}</div>
        <div className="text-[12px] font-bold text-white/85">{a.description}</div>
        <PressButton variant="gold" size="none" onClick={onNext} className="mt-2 w-full rounded-[3px] py-2 text-[13px] font-black">{n < of ? "Next" : "Done"}</PressButton>
      </div>
    </div>
  );
}
function RowStar({ label, value, on }: { label: string; value: number; on: boolean }) {
  return (
    <div className="flex items-center border-b border-white/[0.06] px-3 py-1.5">
      <div className="flex-1 text-xs font-black text-white">{label}</div>
      <div className="flex items-center gap-1 text-sm font-black tabular-nums text-white">
        <StarIcon /> <CountUp value={on ? value : 0} ms={700} format={exact} />
      </div>
    </div>
  );
}
function RelChip({ label, delta, on }: { label: string; delta: number; on: boolean }) {
  const c = delta > 0 ? "#34d399" : delta < 0 ? "#f87171" : "#9ca3af";
  const sign = delta > 0 ? "+" : "";
  return (
    <div className="relative rounded-xl py-1.5 text-center" style={{ background: `linear-gradient(180deg, ${rgba(c, 0.32)}, ${rgba(c, 0.12)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.18), inset 0 0 0 1px ${rgba(c, 0.45)}` }}>
      <div className="text-xs font-black text-white">{label} {sign}{delta}</div>
      {delta !== 0 && <FloatText trigger={on ? 1 : 0} text={`${sign}${delta}`} color={c} className="left-1/2 -top-1" size={12} />}
    </div>
  );
}
function StarIcon({ large }: { large?: boolean } = {}) {
  const s = large ? 22 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#fbbf24" style={{ filter: "drop-shadow(0 0 4px rgba(251,191,36,.6))" }}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
