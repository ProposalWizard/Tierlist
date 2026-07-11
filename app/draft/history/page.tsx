"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { loadDraftHistory } from "@/components/draft/DraftResult";
import type { DraftRunRecord } from "@/components/draft/DraftResult";
import { createClient } from "@/lib/supabase/client";
import PersonalRecords from "@/components/profile/PersonalRecords";

export default function DraftHistoryPage() {
  const [history, setHistory] = useState<DraftRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user);
      if (user) {
        loadDraftHistory().then((runs) => {
          setHistory(runs);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const seasons = history.length;
    const bestPoints = Math.max(...history.map(h => h.points));
    const bestRecord = history.reduce((best, h) =>
      h.record.wins > best.record.wins ? h : best, history[0]);
    const totalWins = history.reduce((s, h) => s + h.record.wins, 0);
    const totalMatches = history.reduce((s, h) => s + h.record.wins + h.record.draws + h.record.losses, 0);
    const winRate = Math.round((totalWins / totalMatches) * 100);
    const mostGoals = Math.max(...history.map(h => h.goalsFor));
    const topOvr = Math.max(...history.map(h => h.avgOvr));
    const titles = history.filter(h => h.finish === 1).length;
    const topFour = history.filter(h => h.finish <= 4).length;
    const faCups = history.filter(h => h.faCupWinner).length;
    const uclWins = history.filter(h => h.uclWinner).length;
    const uelWins = history.filter(h => h.uelWinner).length;
    const bestGD = Math.max(...history.map(h => h.goalDifference ?? (h.goalsFor - h.goalsAgainst)));

    // Career totals (across every season) for the key-stats section.
    const totalPoints = history.reduce((s, h) => s + h.points, 0);
    const totalGoalsFor = history.reduce((s, h) => s + h.goalsFor, 0);
    const totalGoalsAgainst = history.reduce((s, h) => s + h.goalsAgainst, 0);
    const totalGD = totalGoalsFor - totalGoalsAgainst;
    const trophies = history.reduce((s, h) =>
      s + (h.finish === 1 ? 1 : 0) + (h.faCupWinner ? 1 : 0) + (h.eflCupWinner ? 1 : 0)
        + (h.uclWinner ? 1 : 0) + (h.uelWinner ? 1 : 0) + (h.superCupWinner ? 1 : 0) + (h.charityShieldWinner ? 1 : 0), 0);

    return { seasons, bestPoints, bestRecord, winRate, mostGoals, topOvr, titles, topFour, faCups, uclWins, uelWins, bestGD,
      totalPoints, totalGoalsFor, totalGoalsAgainst, totalGD, trophies };
  }, [history]);

  const ACHIEVEMENTS: { id: string; name: string; description: string; icon: string; check: (runs: DraftRunRecord[]) => boolean }[] = useMemo(() => [
    { id: 'champions', name: 'Champions', description: 'Win the Premier League', icon: '\u{1F3C6}', check: (runs) => runs.some(r => r.finish === 1) },
    { id: 'top-four', name: 'Top Four', description: 'Finish in the top 4', icon: '\u{2B50}', check: (runs) => runs.some(r => r.finish <= 4) },
    { id: 'centurion', name: 'Centurion', description: 'Score 100+ points in a season', icon: '\u{1F4AF}', check: (runs) => runs.some(r => r.points >= 100) },
    { id: 'invincible', name: 'Invincible', description: 'Go unbeaten all season', icon: '\u{1F6E1}️', check: (runs) => runs.some(r => r.record.losses === 0) },
    { id: 'perfect', name: 'Perfect Season', description: 'Win all 38 games', icon: '\u{2728}', check: (runs) => runs.some(r => r.record.wins === 38) },
    { id: 'golden-boot', name: 'Golden Boot', description: 'Player scores 37+ PL goals', icon: '\u{1F45F}', check: (runs) => runs.some(r => (r.topScorerGoals ?? 0) >= 37) },
    { id: 'assist-king', name: 'Assist King', description: 'Player gets 22+ PL assists', icon: '\u{1F3AF}', check: (runs) => runs.some(r => (r.topAssists ?? 0) >= 22) },
    { id: 'clean-machine', name: 'Clean Machine', description: 'Keep 25+ clean sheets', icon: '\u{1F9E4}', check: (runs) => runs.some(r => (r.cleanSheets ?? 0) >= 25) },
    { id: 'fortress', name: 'Fortress', description: 'Concede fewer than 15 goals', icon: '\u{1F3F0}', check: (runs) => runs.some(r => r.goalsAgainst < 15) },
    { id: 'goal-machine', name: 'Goal Machine', description: 'Score 107+ goals in a season', icon: '\u{26BD}', check: (runs) => runs.some(r => r.goalsFor >= 107) },
    { id: 'gd-record', name: 'Record GD', description: 'Achieve 80+ goal difference', icon: '\u{1F4C8}', check: (runs) => runs.some(r => (r.goalDifference ?? (r.goalsFor - r.goalsAgainst)) >= 80) },
    { id: 'win-streak', name: 'Win Streak', description: 'Win 19+ consecutive matches', icon: '\u{1F525}', check: (runs) => runs.some(r => (r.longestWinStreak ?? 0) >= 19) },
    { id: 'unbeaten-run', name: 'Marathon', description: 'Go 50+ matches unbeaten', icon: '\u{1F4AA}', check: (runs) => runs.some(r => (r.longestUnbeatenRun ?? 0) >= 50) },
    { id: 'fa-cup', name: 'FA Cup Winner', description: 'Win the FA Cup', icon: '\u{1F3C6}', check: (runs) => runs.some(r => r.faCupWinner === true) },
    { id: 'ucl-winner', name: 'European Champion', description: 'Win the Champions League', icon: '\u{1F31F}', check: (runs) => runs.some(r => r.uclWinner === true) },
    { id: 'uel-winner', name: 'Europa Champion', description: 'Win the Europa League', icon: '\u{1F3C5}', check: (runs) => runs.some(r => r.uelWinner === true) },
    { id: 'double', name: 'The Double', description: 'Win PL + Champions League in one run', icon: '\u{1F451}', check: (runs) => runs.some(r => r.finish === 1 && r.uclWinner === true) },
    { id: 'relegated', name: 'Rock Bottom', description: 'Get relegated (finish 18th+)', icon: '\u{1F4C9}', check: (runs) => runs.some(r => r.finish >= 18) },
  ], []);

  const streak = useMemo(() => {
    if (history.length === 0) return 0;
    const dates = new Set(history.map(h => h.date.slice(0, 10)));
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (!dates.has(fmt(today))) return 0;
    let count = 1;
    const d = new Date(today);
    while (true) {
      d.setDate(d.getDate() - 1);
      if (dates.has(fmt(d))) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [history]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-20">
        <Link href="/draft" className="inline-flex items-center gap-1 text-sm font-bold text-white hover:text-emerald-400 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 transition mb-4">
          &larr; Back to Draft
        </Link>
        <h1 className="text-3xl font-black mb-2">Your Draft History</h1>
        <div className="flex items-center gap-2 mt-8 justify-center">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-white text-sm">Loading history...</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-20">
        <Link href="/draft" className="inline-flex items-center gap-1 text-sm font-bold text-white hover:text-emerald-400 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 transition mb-4">
          &larr; Back to Draft
        </Link>
        <h1 className="text-3xl font-black mb-2">Your Draft History</h1>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800/50 text-center mt-4">
          <div className="text-3xl mb-3">&#128274;</div>
          <p className="text-white text-sm mb-4">
            Sign in to save and view your draft history.
          </p>
          <Link
            href="/auth?next=/draft/history"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-20">
        <Link href="/draft" className="inline-flex items-center gap-1 text-sm font-bold text-white hover:text-emerald-400 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 transition mb-4">
          &larr; Back to Draft
        </Link>
        <h1 className="text-3xl font-black mb-2">Your Draft History</h1>
        <p className="text-white">No completed runs yet. Play a draft to see your history here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      <Link href="/draft" className="inline-flex items-center gap-1 text-sm font-bold text-white hover:text-emerald-400 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 transition mb-4">
        &larr; Back to Draft
      </Link>
      <h1 className="text-3xl font-black mb-1">Your Draft History</h1>
      <p className="text-white text-sm mb-6">Your seasons, records, and stats.</p>

      {stats && (
        <>
          {/* Key career stats */}
          <h2 className="text-[10px] font-bold tracking-widest text-emerald-400/80 uppercase mb-3">Key Stats</h2>
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="bg-emerald-950/30 rounded-xl p-3 border border-emerald-700/40">
              <div className="text-2xl font-black text-emerald-300">{stats.totalPoints}</div>
              <div className="text-[10px] text-white font-bold uppercase">Total Points</div>
            </div>
            <div className="bg-emerald-950/30 rounded-xl p-3 border border-emerald-700/40">
              <div className="text-2xl font-black text-emerald-300">{stats.winRate}%</div>
              <div className="text-[10px] text-white font-bold uppercase">Win Rate</div>
            </div>
            <div className="bg-amber-950/30 rounded-xl p-3 border border-amber-700/40">
              <div className="text-2xl font-black text-amber-300">{'\u{1F3C6}'} {stats.trophies}</div>
              <div className="text-[10px] text-white font-bold uppercase">Trophies</div>
            </div>
            <div className="bg-emerald-950/30 rounded-xl p-3 border border-emerald-700/40">
              <div className="text-2xl font-black text-emerald-300">{stats.totalGoalsFor}</div>
              <div className="text-[10px] text-white font-bold uppercase">Goals Scored</div>
            </div>
            <div className="bg-red-950/30 rounded-xl p-3 border border-red-800/40">
              <div className="text-2xl font-black text-red-300">{stats.totalGoalsAgainst}</div>
              <div className="text-[10px] text-white font-bold uppercase">Goals Conceded</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-700/50">
              <div className={`text-2xl font-black ${stats.totalGD >= 0 ? "text-emerald-300" : "text-red-300"}`}>{stats.totalGD >= 0 ? "+" : ""}{stats.totalGD}</div>
              <div className="text-[10px] text-white font-bold uppercase">Goal Difference</div>
            </div>
          </div>

          {/* Career Stats */}
          <h2 className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">Career Stats</h2>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.seasons}</div>
              <div className="text-[10px] text-white font-bold uppercase">Seasons</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.bestPoints}</div>
              <div className="text-[10px] text-white font-bold uppercase">Best Points</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-lg sm:text-2xl font-black">{stats.bestRecord.record.wins}W {stats.bestRecord.record.draws}D {stats.bestRecord.record.losses}L</div>
              <div className="text-[10px] text-white font-bold uppercase">Best Record</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.winRate}%</div>
              <div className="text-[10px] text-white font-bold uppercase">Win Rate</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.mostGoals}</div>
              <div className="text-[10px] text-white font-bold uppercase">Most Goals</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.topOvr}</div>
              <div className="text-[10px] text-white font-bold uppercase">Top-rated XI</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.titles}</div>
              <div className="text-[10px] text-white font-bold uppercase">Titles</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.topFour}</div>
              <div className="text-[10px] text-white font-bold uppercase">Top Four</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.faCups}</div>
              <div className="text-[10px] text-white font-bold uppercase">FA Cups</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.uclWins}</div>
              <div className="text-[10px] text-white font-bold uppercase">UCL Wins</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.uelWins}</div>
              <div className="text-[10px] text-white font-bold uppercase">UEL Wins</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
              <div className="text-2xl font-black">{stats.bestGD >= 0 ? '+' : ''}{stats.bestGD}</div>
              <div className="text-[10px] text-white font-bold uppercase">Best GD</div>
            </div>
          </div>

          {/* Daily Streak */}
          <div className="bg-gradient-to-r from-orange-900/30 to-amber-900/20 border border-orange-700/40 rounded-xl p-4 mb-4 flex items-center gap-4">
            <div className="text-3xl">{'\u{1F525}'}</div>
            <div>
              <div className="text-2xl font-black text-orange-400">{streak}</div>
              <div className="text-[10px] font-bold tracking-widest text-orange-400/60 uppercase">Day Streak</div>
            </div>
            <div className="ml-auto text-xs text-white">{history.length} total seasons played</div>
          </div>

          {/* Achievements */}
          <h2 className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">
            Achievements &mdash; {ACHIEVEMENTS.filter(a => a.check(history)).length}/{ACHIEVEMENTS.length} unlocked
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
            {ACHIEVEMENTS.map((achievement) => {
              const unlocked = achievement.check(history);
              return (
                <div
                  key={achievement.id}
                  className={`rounded-xl p-3 text-center transition-all ${unlocked ? 'bg-yellow-900/20 border-2 border-yellow-600/40' : 'bg-gray-900 border border-gray-800/50 opacity-40'}`}
                >
                  <div className="text-2xl mb-1">{achievement.icon}</div>
                  <div className={`text-[10px] font-bold ${unlocked ? 'text-yellow-400' : 'text-white'}`}>{achievement.name}</div>
                  <div className="text-[9px] text-white mt-0.5">{achievement.description}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Personal Bests */}
      <h2 className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">Personal Bests</h2>
      <PersonalRecords />
    </div>
  );
}
