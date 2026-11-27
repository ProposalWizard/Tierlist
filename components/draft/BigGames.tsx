"use client";
/**
 * components/draft/BigGames.tsx — "Watch the big games" under a Draft season
 * (Leo, 27 Nov 2026). Lists the season's finals (FA Cup, League Cup, Champions
 * League, Europa League) and the biggest league win; each opens the Match
 * Centre. You choose what to watch; nothing slows the normal flow.
 */
import { useState } from "react";
import type { SeasonResult, FaCupMatch, UCLMatch } from "@/lib/seasonSimulator";
import type { DraftPlayer } from "@/app/draft/page";
import type { TimelineMatch } from "@/lib/draft/matchTimeline";
import MatchCentre from "./MatchCentre";

interface Big { label: string; m: TimelineMatch }

function fromCup(title: string, you: string, f: FaCupMatch, squad: string[]): Big {
  return { label: title, m: { title, you, them: f.opponent, youHome: f.isHome ?? true, goalsFor: f.goalsFor, goalsAgainst: f.goalsAgainst, goalScorers: f.goalScorers, assistProviders: f.assistProviders, extraTime: f.extraTime, penalties: f.penalties, penaltyScore: f.penaltyScore, squad } };
}
function fromEuro(title: string, you: string, opp: string, g: UCLMatch, squad: string[]): Big {
  return { label: title, m: { title, you, them: opp, youHome: g.isHome, goalsFor: g.goalsFor, goalsAgainst: g.goalsAgainst, goalScorers: g.goalScorers, assistProviders: g.assistProviders, extraTime: g.extraTime, penalties: g.penalties, penaltyScore: g.penaltyScore, squad } };
}

export function bigGames(season: SeasonResult, you: string, squad: string[]): Big[] {
  const out: Big[] = [];
  const fa = season.faCup?.matches.find((x) => x.round === "Final");
  if (fa) out.push(fromCup("FA Cup Final", you, fa, squad));
  const lc = season.leagueCup?.matches.find((x) => x.round === "Final");
  if (lc) out.push(fromCup("League Cup Final", you, lc, squad));
  for (const [cup, name] of [[season.ucl, "Champions League Final"], [season.uel, "Europa League Final"]] as const) {
    const t = cup?.knockoutTies.find((k) => k.round === "Final");
    if (t) out.push(fromEuro(name, you, t.opponent, t.leg1, squad));
  }
  const best = [...season.matches].sort((a, b) => (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst))[0];
  if (best && best.goalsFor > best.goalsAgainst) out.push({ label: `Biggest win: ${best.goalsFor}-${best.goalsAgainst} v ${best.opponent}`, m: { title: "Premier League", you, them: best.opponent, youHome: best.isHome, goalsFor: best.goalsFor, goalsAgainst: best.goalsAgainst, goalScorers: best.goalScorers, assistProviders: best.assistProviders, squad } });
  return out;
}

export default function BigGames({ season, players, teamName }: { season: SeasonResult; players: DraftPlayer[]; teamName: string }) {
  const [open, setOpen] = useState<TimelineMatch | null>(null);
  const games = bigGames(season, teamName || "Knowitball FC", players.filter((p) => !p.isSub).map((p) => p.name));
  if (!games.length) return null;
  return (
    <div className="w-full rounded-2xl border border-gray-700 bg-gray-900 p-4 text-white" data-big-games>
      <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Watch the big games</p>
      <div className="mt-3 space-y-2">
        {games.map((g) => (
          <button key={g.label} onClick={() => setOpen(g.m)} className="flex w-full items-center justify-between rounded-xl bg-gray-800 px-3 py-2.5 text-left text-sm font-bold text-white">
            <span>{g.label}</span><span className="text-emerald-400">▶ Watch</span>
          </button>
        ))}
      </div>
      {open && <MatchCentre match={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
