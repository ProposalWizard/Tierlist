"use client";
import type { CareerState } from "@/lib/star/types";
import { leagueNameFor, divisionOf } from "@/lib/star/calendar";
import { kitsOf, labelInk } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";

/**
 * WHAT WENT UP AND WHAT WENT DOWN.
 *
 * Shown once at a season rollover, off `career.ladderNews` — which
 * advanceSeason fills in whether or not any of it involved you, because a
 * division changing shape around you is news even when you finished
 * mid-table.
 *
 * Your own club leads if it moved, because that is the headline and
 * everything else is context for it. Otherwise it opens straight on the two
 * divisions.
 */

interface Props {
  career: CareerState;
  onContinue: () => void;
}

function Crest({ club }: { club: string }) {
  const kit = kitsOf(club).home;
  return (
    <span
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[7px] font-black"
      style={{ backgroundColor: kit.shirt, borderColor: kit.trim, color: labelInk(kit.shirt) }}
    >
      {club.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()}
    </span>
  );
}

function ClubRow({ club, tone }: { club: string; tone: "up" | "down" }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Crest club={club} />
      <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">{shortClub(club)}</span>
      <span className={`shrink-0 text-[11px] font-black ${tone === "up" ? "text-emerald-400" : "text-red-400"}`}>
        {tone === "up" ? "▲" : "▼"}
      </span>
    </div>
  );
}

function Movement({ title, up, down, upLabel, downLabel }: {
  title: string; up: string[]; down: string[]; upLabel: string; downLabel: string;
}) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60">{title}</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-emerald-400">{upLabel}</div>
          {up.length ? up.map(c => <ClubRow key={c} club={c} tone="up" />)
            : <div className="py-1 text-[11px] text-white/40">Nobody</div>}
        </div>
        <div>
          <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-red-400">{downLabel}</div>
          {down.length ? down.map(c => <ClubRow key={c} club={c} tone="down" />)
            : <div className="py-1 text-[11px] text-white/40">Nobody</div>}
        </div>
      </div>
    </div>
  );
}

export default function LadderScreen({ career, onContinue }: Props) {
  const news = career.ladderNews;
  if (!news) return null;

  const division = divisionOf(career);
  const you = career.player.club;
  const moved = news.yourMove;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 px-3 py-5 text-white">
      <div className="mx-auto w-full max-w-sm">
        <div className="text-center">
          <div className="inline-block rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
            Season Review
          </div>
        </div>

        {/* Your club first, when it moved — the headline, not a row in a list. */}
        {moved && (
          <div
            className={`mt-4 rounded-2xl border p-4 text-center ${
              moved === "promoted"
                ? "border-emerald-400/50 bg-emerald-500/15"
                : "border-red-500/50 bg-red-500/15"}`}
          >
            <div className="text-3xl">{moved === "promoted" ? "🎉" : "💔"}</div>
            <h1 className="mt-1 text-xl font-black leading-tight">
              {shortClub(you)} {moved === "promoted" ? "are promoted" : "are relegated"}
            </h1>
            <p className="mt-1 text-[12px] font-bold text-white/80">
              {moved === "promoted"
                ? `Next season is ${leagueNameFor(division)} football.`
                : `It is ${leagueNameFor(division)} football next season.`}
            </p>
          </div>
        )}

        {!moved && (
          <h1 className="mt-3 text-center text-lg font-black">The divisions have changed</h1>
        )}

        {/* The play-off final, when there was one worth naming. */}
        {news.playOffFinal && (
          <div className="mt-3 rounded-xl border border-white/15 bg-white/[0.04] p-3">
            <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
              Play-Off Final
            </div>
            <div className="flex items-center gap-2">
              <Crest club={news.playOffFinal.home} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-bold">
                {shortClub(news.playOffFinal.home)}
              </span>
              <span className="shrink-0 font-black tabular-nums">
                {news.playOffFinal.hs}–{news.playOffFinal.as}
              </span>
              <span className="min-w-0 flex-1 truncate text-right text-[12px] font-bold">
                {shortClub(news.playOffFinal.away)}
              </span>
              <Crest club={news.playOffFinal.away} />
            </div>
            <div className="mt-1.5 text-[11px] font-bold text-emerald-300">
              {shortClub(news.playOffFinal.winner)} go up.
            </div>
          </div>
        )}

        <div className="mt-3 space-y-3">
          <Movement
            title="Premier League"
            up={news.promotedToPremier}
            down={news.relegatedFromPremier}
            upLabel="Promoted in"
            downLabel="Relegated out"
          />
          <Movement
            title="Championship"
            up={news.promotedToChampionship}
            down={news.relegatedFromChampionship}
            upLabel="Promoted in"
            downLabel="Relegated out"
          />
        </div>

        <button
          onClick={onContinue}
          className="mt-4 w-full rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 py-3 text-sm font-black uppercase tracking-widest text-emerald-950 shadow-[0_6px_16px_-2px_rgba(16,185,129,0.5)] transition hover:brightness-105 active:scale-[0.99]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
