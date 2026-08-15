"use client";
import { useState } from "react";
import type { Matchday, SheetPlayer, TeamSheet } from "@/lib/star/teamsheet";
import { kitsFor, labelInk, type Kit } from "@/lib/star/kits";
import { getFlagUrl } from "@/lib/nationalities";
import { shortClub } from "@/lib/star/media/grammar";

/**
 * THE TEAM SHEETS.
 *
 * Both elevens, in their shapes, on one pitch — the away side defending the top
 * goal and the home side the bottom one, which is how every broadcast lineup
 * graphic in the world does it and the only arrangement that shows you a match
 * rather than two lists.
 *
 * ── Why one pitch and not two ──
 *
 * Two pitches stacked is a scroll, and a scroll turns "who am I playing" into a
 * comparison you have to hold in your head. On one pitch a flat back four
 * against a back three is a fact you can see. The cost is that each side gets
 * half the height, which is why the chips are small and the faces are 30px —
 * everything here is sized around eleven names fitting in half a phone screen.
 *
 * ── Kits ──
 *
 * `kitsFor` already decides who changes: the home side wears its own shirt and
 * the away side wears theirs unless the two clash. So the two teams on this
 * pitch are in the same colours they will be in when the match starts, and the
 * one screen where you might confuse them is the one that answers it.
 */

interface Props {
  matchday: Matchday;
  /** "Sat 15 Aug", from the calendar. */
  date?: string;
  /** "Premier League · Matchday 3", or a cup round. */
  competition: string;
  onKickOff: () => void;
  onBack: () => void;
}

/**
 * Where a man stands, once his half has been squeezed to half a pitch.
 *
 * The formation's own y runs from a striker at 0.17 to the goalkeeper at 0.94.
 * Mapping that straight onto [0.5, 1] puts both sides' forward lines exactly on
 * the halfway line, on top of each other — which is what the first version did,
 * and Vass and Halvorsen were drawn in the same place.
 *
 * So the two ends are inset by what a chip actually measures. A tile is a 30px
 * face and a 13px name, and the name sits on the side AWAY from the halfway
 * line — below for the home side, above for the away side — so the only things
 * that can meet in the middle are two faces, and they are held apart by their
 * own radius. The far end is inset by the same amount so the goalkeeper's name
 * is not cut off by the goal line.
 */
const NEAR = 0.17, FAR = 0.94;
/** As a fraction of the pitch: half a face at the halfway line… */
const HALFWAY_INSET = 0.045;
/** …and a face plus its name at the goal line. */
const GOAL_INSET = 0.075;

function place(y: number, bottom: boolean): number {
  const t = (y - NEAR) / (FAR - NEAR);          // 0 at the striker, 1 at the keeper
  const near = 0.5 + HALFWAY_INSET;             // the forward line, in its own half
  const far = 1 - GOAL_INSET;                   // the goalkeeper
  const at = near + t * (far - near);
  return bottom ? at : 1 - at;
}

export default function VersusScreen({ matchday, date, competition, onKickOff, onBack }: Props) {
  const { home, away } = matchday;
  const kits = kitsFor(home.club, away.club);
  const [showSubs, setShowSubs] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 px-3 py-3 text-white">
      <div className="mx-auto w-full max-w-md">
        <button
          onClick={onBack}
          className="mb-2 rounded-lg bg-white/10 px-3 py-1 text-[11px] font-black text-white/85 transition hover:bg-white/20"
        >
          ← Back
        </button>

        {/* ── The header ── */}
        <div className="rounded-t-xl border border-white/15 bg-gray-900/80 px-3 py-2.5">
          <div className="text-center text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300">
            {competition}
          </div>
          <div className="mt-2 flex items-center justify-center gap-3">
            <Crest club={home.club} kit={kits.home} />
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">vs</div>
              {date && <div className="mt-0.5 text-[9px] font-bold text-white/70">{date}</div>}
            </div>
            <Crest club={away.club} kit={kits.away} />
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-wider text-white/70">
            <span>{home.formation.name}</span>
            <span className="text-white/30">·</span>
            <span>{away.formation.name}</span>
          </div>
        </div>

        {/* ── The pitch ── */}
        <div className="relative aspect-[3/5] overflow-hidden border-x border-white/15 bg-gradient-to-b from-emerald-800 to-emerald-900">
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

          {away.xi.map(p => (
            <Man key={`a-${p.id}`} p={p} kit={kits.away} keeper={kits.keeper} bottom={false} />
          ))}
          {home.xi.map(p => (
            <Man key={`h-${p.id}`} p={p} kit={kits.home} keeper={kits.keeper} bottom />
          ))}
        </div>

        {/* ── Benches ── */}
        <div className="rounded-b-xl border border-white/15 bg-gray-900/80">
          <button
            onClick={() => setShowSubs(s => !s)}
            className="w-full px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/70"
          >
            {showSubs ? "Hide" : "Show"} substitutes
          </button>
          {showSubs && (
            <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10">
              <Bench sheet={home} kit={kits.home} />
              <Bench sheet={away} kit={kits.away} />
            </div>
          )}
        </div>

        <button
          onClick={onKickOff}
          className="mt-3 w-full rounded-xl bg-emerald-500 py-3.5 text-base font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-emerald-400 active:scale-[0.99]"
        >
          Kick Off
        </button>
      </div>
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
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <div
        className="grid h-11 w-11 place-items-center rounded-full border-2 text-[13px] font-black"
        style={{ backgroundColor: kit.shirt, borderColor: kit.trim, color: labelInk(kit.shirt) }}
      >
        {initials(club)}
      </div>
      <div className="w-full truncate text-center text-[11px] font-black leading-tight text-white">
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

function Man({ p, kit, keeper, bottom }: {
  p: SheetPlayer; kit: Kit; keeper: Kit; bottom: boolean;
}) {
  const worn = p.role === "GK" ? keeper : kit;
  const flag = getFlagUrl(p.nation);
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${p.x * 100}%`, top: `${place(p.y, bottom) * 100}%`, width: "23%" }}
      title={`${p.name} — ${p.slot}`}
    >
      <div
        className={`relative order-2 h-[30px] w-[30px] overflow-hidden rounded-full border-2 ${
          p.isYou ? "border-amber-300 shadow-[0_0_10px_-1px_rgba(252,211,77,0.9)]" : "border-white/60"}`}
        style={{ backgroundColor: worn.shirt }}
      >
        {p.face ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.face}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        ) : (
          <div
            className="absolute inset-0 grid place-items-center text-[10px] font-black"
            style={{ color: labelInk(worn.shirt) }}
          >
            {p.short.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className={`flex w-full items-center justify-center gap-0.5 rounded bg-gray-950/85 px-1 py-px ${
        bottom ? "order-3 mt-0.5" : "order-1 mb-0.5"}`}
      >
        {flag && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flag} alt="" className="h-[6px] w-[9px] shrink-0 rounded-[1px] object-cover" />
        )}
        <span className={`truncate text-[8px] font-black leading-tight ${
          p.isYou ? "text-amber-300" : "text-white"}`}
        >
          {p.short}
        </span>
      </div>
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
            {flag ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flag} alt="" className="h-[6px] w-[9px] shrink-0 rounded-[1px] object-cover" />
            ) : <span className="w-[9px] shrink-0" />}
            <span className={`truncate text-[9px] font-bold ${p.isYou ? "text-amber-300" : "text-white/85"}`}>
              {p.short}
            </span>
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
