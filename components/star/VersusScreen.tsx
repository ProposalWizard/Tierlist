"use client";
import { useState } from "react";
import type { Matchday, SheetPlayer, TeamSheet } from "@/lib/star/teamsheet";
import type { LeagueResult } from "@/lib/star/types";
import { kitsFor, labelInk, kitLabelOnDark, type Kit } from "@/lib/star/kits";
import { getFlagUrl } from "@/lib/nationalities";
import { shortClub } from "@/lib/star/media/grammar";
import { SILHOUETTE_SRC } from "@/lib/silhouette";
import ImageWithFallback from "@/components/ImageWithFallback";
import { place, across } from "@/lib/star/pitchLayout";

/**
 * THE TEAM SHEETS.
 *
 * Both elevens, in their shapes, on one pitch — the home side at the top and
 * the away side at the bottom. Not the broadcast convention (which usually puts
 * the away side at the top); the club you actually support belongs where you
 * see it first, and you should not have to work out which colour is yours
 * before you can find yourself on the pitch.
 *
 * ── Why one pitch and not two ──
 *
 * Two pitches stacked is a scroll, and a scroll turns "who am I playing" into a
 * comparison you have to hold in your head. On one pitch a flat back four
 * against a back three is a fact you can see rather than something you have to
 * remember from the screen above.
 *
 * ── Kits ──
 *
 * `kitsFor` already decides who changes: the home side wears its own shirt and
 * the away side wears theirs unless the two clash. So the two teams on this
 * pitch are in the same colours they will be in when the match starts, and the
 * one screen where you might confuse them is the one that answers it.
 *
 * ── Asking to play somewhere else ──
 *
 * That choice lives on the dashboard now, not here — see PositionPicker. This
 * screen only draws whichever matchday it is handed; by the time you reach it
 * the decision is already made, which is one more reason it fits on one screen
 * without scrolling.
 */

interface Props {
  matchday: Matchday;
  /** "Sat 15 Aug", from the calendar. */
  date?: string;
  /** "Premier League · Matchday 3", or a cup round. */
  competition: string;
  /** The whole division's results so far, to read recent form off. See recentForm. */
  results?: LeagueResult[];
  onKickOff: () => void;
  onBack: () => void;
}

/**
 * Where a man stands, once his half has been squeezed to half a pitch, and
 * the reflection that turns his side around to face the other way.
 *
 * `place`/`across` themselves — and the insets that decide how much of the
 * pitch box's height a half actually gets — now live in lib/star/pitchLayout.ts,
 * shared with tests/star/formationSpacing.mts. That split exists because
 * eleven rows squeezed into a fraction of the box's height is a real, tight
 * pixel budget: a chip is a face plus a name, both formations.ts's bands and
 * the insets below are tuned against exactly how much room that leaves, and
 * a test can check the two stay honest with each other in a way eyeballing
 * a screenshot can't.
 *
 * `place`'s result never crosses 0.5 for the top side or drops below it for
 * the bottom side — each side is clamped to its own half, which is the whole
 * point: a formation squeezed to fit its half must not spill into the other
 * one, however forward its most advanced man is meant to look. `across`
 * turns a formation around as the rotation about the centre spot it actually
 * is — flipping only y (what a naive mirror does) swaps every slot's left
 * and right instead, which shipped once and was reported as exactly that:
 * "Reinildo is a left back but the way it's showing it is actually showing
 * him as a right back."
 */

/**
 * A crisp black line around white (or amber) text, without a background box.
 *
 * `-webkit-text-stroke` alone is not enough — Firefox's support is recent
 * enough that a stack still running an older build gets no outline at all and
 * unreadable pale text over grass. Layered shadows in the four ordinal
 * directions plus a soft blur reads as a genuine outline everywhere, not just
 * in Chromium.
 */
const TEXT_OUTLINE = {
  textShadow:
    "-1px -1px 1.5px #000, 1px -1px 1.5px #000, -1px 1px 1.5px #000, 1px 1px 1.5px #000, 0 0 3px rgba(0,0,0,0.9)",
};

type Result = "W" | "D" | "L";

/**
 * A club's last five, read straight off the division's own results log.
 *
 * `career.results` is the whole division's history, week by week, so this
 * works identically for your own club and for whoever you are about to play —
 * there is no separate "opponent form" to fake, because the opponent has been
 * playing real, recorded matches all season too.
 *
 * Shortest first, most recent last — the same order the chips read left to
 * right. Fewer than five early in a season is not an error; it is simply how
 * many there have been.
 */
function recentForm(club: string, results: LeagueResult[]): Result[] {
  return results
    .filter(r => r.home === club || r.away === club)
    .sort((a, b) => a.week - b.week)
    .slice(-5)
    .map((r): Result => {
      const home = r.home === club;
      const gf = home ? r.hs : r.as;
      const ga = home ? r.as : r.hs;
      return gf > ga ? "W" : gf === ga ? "D" : "L";
    });
}

const FORM_BG: Record<Result, string> = { W: "#16a34a", D: "#b98a1f", L: "#b91c1c" };

/** Enough of an XI to actually draw — see teamsheet.ts's sheetReady, the
 *  same bar this screen used to require of BOTH sides before showing itself
 *  at all. Checked per side now instead. */
function scouted(s: TeamSheet): boolean {
  return s.xi.length >= 9;
}

export default function VersusScreen({ matchday, date, competition, results, onKickOff, onBack }: Props) {
  const { home, away } = matchday;
  const kits = kitsFor(home.club, away.club);
  const [showSubs, setShowSubs] = useState(false);
  const yours = home.yours ? home : away;
  const homeScouted = scouted(home);
  const awayScouted = scouted(away);

  // "Premier League · Matchday 3" reads as two different pieces of information
  // — the competition, and where in it this fixture falls — so the second half
  // gets its own colour rather than running on in one flat line.
  const [compHead, ...compTailParts] = competition.split(" · ");
  const compTail = compTailParts.join(" · ");

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 px-3 py-3 text-white">
      <div className="mx-auto w-full max-w-md">
        <button
          onClick={onBack}
          className="mb-1.5 rounded-lg bg-white/10 px-3 py-1 text-[11px] font-black text-white/85 transition hover:bg-white/20"
        >
          ← Back
        </button>

        {/* ── The header ──
            One dark, floodlit panel rather than a plain bar — the competition
            line, both teams, and each team's own formation directly under its
            own crest, all in the same column so the two can never drift out of
            line with each other. */}
        <div
          className="rounded-t-xl border border-white/15 px-3 py-2.5"
          style={{ background: "linear-gradient(115deg, #051025 0%, #0b1530 32%, #1a0a12 68%, #2a0a10 100%)" }}
        >
          <div className="text-center text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
            {compHead}
            {compTail && <> <span className="text-white/30">·</span> <span className="text-amber-300">{compTail}</span></>}
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            <TeamHeader club={home.club} kit={kits.home} formation={home.formation.name}
              form={recentForm(home.club, results ?? [])} scouted={homeScouted} />
            <div className="flex flex-col items-center gap-1 pt-1.5">
              <div className="text-xl font-black italic text-white/90">VS</div>
              {date && <div className="whitespace-nowrap text-[10px] font-bold text-white/75">{date}</div>}
            </div>
            <TeamHeader club={away.club} kit={kits.away} formation={away.formation.name}
              form={recentForm(away.club, results ?? [])} scouted={awayScouted} />
          </div>
        </div>

        {/* ── The pitch ──
            Home at the top, away at the bottom — see the file note on why.
            A side with no real squad behind it yet — a club this career has
            no full roster for — draws nothing here rather than a scattering
            of holes; UnscoutedHalf covers its half instead. Reported
            directly: "if you play against someone who doesn't have a team
            sheet... it should show something that says Unable to scout
            opponent's team" — this used to mean skipping the team-sheet
            screen entirely, for BOTH sides, the moment either one fell
            short.

            aspect-[3/4.9] and the chip's 34px face (below, in <Man>) are
            the same numbers this screen shipped with originally, restored —
            reported directly, twice, with before/after screenshots: first
            that an overlap fix had grown the box and shrunk the chip (25px
            face, aspect-[3/5]), needing a scroll to reach Kick Off; then,
            after a first attempt only split the difference (26px,
            aspect-[3/4.7]), that it still wasn't the original size and
            still didn't fit. The real fix was never the box or the chip —
            it was formations.ts's own bands, several of which had a back
            three's centre-back, a lone CDM, or a lone CAM sitting on the
            EXACT SAME x as the goalkeeper or the row above/below, turning
            a real diagonal gap into a pure vertical squeeze with nowhere
            to give. Spreading those specific slots off that shared
            centre-line (back3()'s own note, and the individual formations'
            comments below it) bought most of the clearance at the ORIGINAL
            chip size — the rest came from HALFWAY_INSET (pitchLayout.ts),
            once restoring the full chip exposed a squeeze this screen
            never had before: a lone, centred striker from each side,
            mirrored across the halfway line, close enough to collide with
            EACH OTHER once the chip grew back to size — invisible with the
            25/26px chip, and only found by actually rendering the fix and
            comparing it against a real opposing formation, not just
            re-running the existing same-side test. The header panel, the
            substitutes bar and Kick Off's own margins are still trimmed
            from the earlier pass too. */}
        <div className="relative">
          <div className="relative aspect-[3/4.9] overflow-hidden rounded-b-xl border-x border-b border-white/15 bg-gradient-to-b from-emerald-800 to-emerald-900">
            {/* Markings, drawn once and read by nothing. */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/30" />
              <div className="absolute left-1/2 top-1/2 h-[11%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
              <div className="absolute left-1/2 top-0 h-[11%] w-[46%] -translate-x-1/2 border-x border-b border-white/30" />
              <div className="absolute bottom-0 left-1/2 h-[11%] w-[46%] -translate-x-1/2 border-x border-t border-white/30" />
              {/* Mown stripes, so the two halves read as one pitch. */}
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="absolute inset-x-0 bg-white/[0.025]"
                  style={{ top: `${i * 12.5}%`, height: "6.25%" }} />
              ))}
            </div>

            {homeScouted
              ? home.xi.map(p => <Man key={`h-${p.id}`} p={p} kit={kits.home} keeper={kits.keeper} bottom={false} />)
              : <UnscoutedHalf bottom={false} />}
            {awayScouted
              ? away.xi.map(p => <Man key={`a-${p.id}`} p={p} kit={kits.away} keeper={kits.keeper} bottom />)
              : <UnscoutedHalf bottom />}
          </div>

          {/* ── Substitutes ──
              A drawer docked to the pitch's own bottom edge rather than a
              panel that pushes Kick Off further down the page: pressing the
              button slides it up OVER the lower part of the pitch (bottom
              anchored, height growing) instead of adding height below it,
              and pressing it again collapses it straight back down to just
              the tab. */}
          <div className="absolute inset-x-0 -bottom-4 z-10 overflow-hidden rounded-b-xl border border-white/15 bg-gray-950/95 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.5)] backdrop-blur-sm">
            <button
              onClick={() => setShowSubs(s => !s)}
              className="flex w-full items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white/80"
            >
              <span className={`text-white/40 transition-transform ${showSubs ? "rotate-90" : ""}`}>›</span>
              Substitutes
              <span className="text-amber-300">+{yours.bench.length}</span>
            </button>
            <div
              className="grid grid-cols-2 gap-px overflow-y-auto border-t border-white/10 bg-white/10 transition-[max-height] duration-300 ease-out"
              style={{ maxHeight: showSubs ? "60vh" : "0px" }}
            >
              {homeScouted ? <Bench sheet={home} kit={kits.home} /> : <UnscoutedBench club={home.club} />}
              {awayScouted ? <Bench sheet={away} kit={kits.away} /> : <UnscoutedBench club={away.club} />}
            </div>
          </div>
        </div>

        <button
          onClick={onKickOff}
          className="mt-1.5 w-full rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 py-2.5 text-base font-black uppercase tracking-widest text-emerald-950 shadow-[0_6px_16px_-2px_rgba(16,185,129,0.5)] transition hover:brightness-105 active:scale-[0.99]"
        >
          Kick Off
        </button>
      </div>
    </div>
  );
}

/**
 * One team's whole header column: crest, name, last five, formation — stacked
 * in a single flex column, so the formation label is centred under exactly the
 * same width the crest and name are centred under. Two independently-centred
 * rows above and below each other can drift apart the instant either row's
 * neighbouring content changes width; one column can't.
 */
function TeamHeader({ club, kit, formation, form, scouted }: {
  club: string; kit: Kit; formation: string; form: Result[]; scouted: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <Crest club={club} kit={kit} />
      <FormRow form={form} />
      <div
        className="truncate text-[9px] font-black uppercase tracking-wider"
        style={{ color: scouted ? kitLabelOnDark(kit.shirt, kit.trim) : "rgba(255,255,255,0.4)" }}
      >
        {scouted ? formation : "Unscouted"}
      </div>
    </div>
  );
}

/** Last five results, oldest to most recent, left to right. */
function FormRow({ form }: { form: Result[] }) {
  if (form.length === 0) return <div className="h-[13px]" />; // holds the header's height steady in week one
  return (
    <div className="flex items-center gap-[3px]">
      {form.map((r, i) => (
        <span
          key={i}
          className="grid h-[13px] w-[13px] place-items-center rounded text-[8px] font-black text-white"
          style={{ background: FORM_BG[r] }}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

/**
 * A club, as a badge.
 *
 * There are no crest files, and a wrong crest is worse than none — so it is the
 * club's own shirt with its initials on it, which is the same device the
 * shortlist tiles use and is at least always right.
 */
function Crest({ club, kit }: { club: string; kit: Kit }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      <div
        className="grid h-9 w-9 place-items-center rounded-full border-2 text-[11px] font-black"
        style={{ backgroundColor: kit.shirt, borderColor: kit.trim, color: labelInk(kit.shirt) }}
      >
        {initials(club)}
      </div>
      <div className="w-full truncate text-center text-[10px] font-black leading-tight text-white">
        {shortClub(club)}
      </div>
    </div>
  );
}

function initials(club: string): string {
  const skip = new Set(["fc", "afc", "united", "city", "the", "and", "&", "hove", "albion"]);
  const words = club.split(/\s+/).filter(w => !skip.has(w.toLowerCase()));
  if (words.length >= 2) return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
  return club.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

/**
 * The gold star over your own head.
 *
 * Not a highlighted circle and not a "YOU" pill — both said the same thing
 * twice, over a man who is already the one figure on this screen you actually
 * came to find. A star above him is the same device the match itself uses
 * (see CanvasMatch's footballer renderer): one mark, unambiguous, and it does
 * not change what he's wearing or how his name reads next to the other ten.
 *
 * Always above the face now that the name is always below it (see Man) — it
 * has exactly one place left that isn't the name.
 */
function YouStar() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="pointer-events-none absolute left-1/2 -top-[13px] h-3 w-3 -translate-x-1/2"
    >
      <polygon
        points="10,1 12.5,7 19,7.5 14,11.8 15.5,18 10,14.5 4.5,18 6,11.8 1,7.5 7.5,7"
        fill="#fbbf24"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Man({ p, kit, keeper, bottom }: {
  p: SheetPlayer; kit: Kit; keeper: Kit; bottom: boolean;
}) {
  const worn = p.role === "GK" ? keeper : kit;
  const flag = getFlagUrl(p.nation);
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${across(p.x, bottom) * 100}%`, top: `${place(p.y, bottom) * 100}%`, width: "22%" }}
      title={`${p.name} — ${p.slot}`}
    >
      {/* The star has to live OUTSIDE the circle's own overflow-hidden — that
          clip exists to keep a face photo inside a round frame, and it was
          clipping the star along with everything else that strayed past its
          edge. This wrapper gives the star a positioning parent that doesn't
          also clip it. */}
      <div className="relative order-2 h-[34px] w-[34px]">
        {p.isYou && <YouStar />}
        <div
          className="h-full w-full overflow-hidden rounded-full border-2 border-white/60"
          style={{ backgroundColor: worn.shirt }}
        >
          {/* The same stand-in the Draft uses for a player with no photo — one
              "nobody's face" across the whole game, not a different
              placeholder per screen. `fallbackSrc` covers the other half of
              it: a face whose URL has gone dead looks the same as one that
              was never there, rather than an empty box. */}
          <ImageWithFallback
            src={p.face || SILHOUETTE_SRC}
            fallbackSrc={SILHOUETTE_SRC}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        </div>
      </div>
      {/* No background pill — the outline is what keeps this legible over
          grass of any shade, in either theme this game has (there is only
          the one, but the point stands): a box was a second colour to clash
          with the kit, an outline is just ink.

          Always below the face, on both sides. The home side used to have it
          ABOVE — orienting each side's name away from the halfway line, so
          the two forward lines' names could never meet in the middle. Reported
          as inconsistent rather than as a collision risk ("names... above
          their player face instead of below"), and there is room for it:
          even with both forward lines now facing the same way, the nearest
          face and the name below it clear the opposing face by ~35px at a
          typical phone width, nowhere near enough to touch. */}
      <div className="order-3 flex w-full items-center justify-center gap-0.5 px-0.5">
        <span className="truncate text-[9px] font-black leading-tight text-white" style={TEXT_OUTLINE}>
          {p.short}
        </span>
        {flag && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flag} alt="" className="h-[7px] w-[10px] shrink-0 rounded-[1px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.6)]" />
        )}
      </div>
    </div>
  );
}

/**
 * Half a pitch with nobody drawn on it, and the reason why.
 *
 * Not a wall of silhouettes standing in formation slots — that would be
 * inventing a team sheet this career genuinely does not have, which is the
 * opposite of what "unable to scout" is supposed to mean. One honest line,
 * centred in the half it belongs to.
 */
function UnscoutedHalf({ bottom }: { bottom: boolean }) {
  return (
    <div
      className={`absolute inset-x-0 flex items-center justify-center px-6 text-center ${
        bottom ? "bottom-0 top-1/2" : "top-0 bottom-1/2"}`}
    >
      <div className="rounded-lg bg-black/35 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-white/70">
        Unable to scout opponent&rsquo;s team
      </div>
    </div>
  );
}

function UnscoutedBench({ club }: { club: string }) {
  return (
    <div className="bg-gray-900/90 px-2 py-1.5">
      <div className="mb-1 flex items-center gap-1">
        <span className="truncate text-[9px] font-black uppercase tracking-wider text-white/50">
          {shortClub(club)}
        </span>
      </div>
      <div className="py-1 text-[9px] font-bold text-white/50">Unable to scout opponent&rsquo;s team</div>
    </div>
  );
}

function Bench({ sheet, kit }: { sheet: TeamSheet; kit: Kit }) {
  return (
    <div className="bg-gray-900/90 px-2 py-1.5">
      {/* The club colour as a SWATCH, never as the text colour. Newcastle's
          black and Fulham's white are both real kits, and "MAN UTD" set in
          #17181A on a dark panel is invisible — which is exactly what it did. */}
      <div className="mb-1 flex items-center gap-1">
        <span
          className="h-2 w-2 shrink-0 rounded-full border border-white/40"
          style={{ backgroundColor: kit.shirt }}
        />
        <span className="truncate text-[9px] font-black uppercase tracking-wider text-white">
          {shortClub(sheet.club)}
        </span>
      </div>
      {sheet.bench.map(p => {
        const flag = getFlagUrl(p.nation);
        return (
          <div key={p.id} className="flex items-center gap-1 py-px">
            {p.isYou && (
              <svg viewBox="0 0 20 20" className="h-2.5 w-2.5 shrink-0">
                <polygon
                  points="10,1 12.5,7 19,7.5 14,11.8 15.5,18 10,14.5 4.5,18 6,11.8 1,7.5 7.5,7"
                  fill="#fbbf24" stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" strokeLinejoin="round"
                />
              </svg>
            )}
            <span className="truncate text-[9px] font-bold text-white/85">
              {p.short}
            </span>
            {flag && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flag} alt="" className="h-[6px] w-[9px] shrink-0 rounded-[1px] object-cover" />
            )}
            <span className="ml-auto shrink-0 text-[8px] font-black text-white/50">{p.slot}</span>
          </div>
        );
      })}
      {sheet.bench.length === 0 && (
        <div className="py-1 text-[9px] font-bold text-white/50">No bench listed</div>
      )}
    </div>
  );
}
