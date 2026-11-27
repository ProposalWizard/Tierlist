"use client";
/**
 * components/draft/DailyDraft.tsx — the Daily Draft's two cards (Leo, 27 Nov
 * 2026). New look preview only for now (app/draft/page.tsx).
 *   DailyDraftStart: on the setup screen. Today's date, your streak, Play (or,
 *     once played, your score and Share).
 *   DailyDraftDone: under your first season. Score, today's ranking, the share
 *     squares, streak. Rules: lib/draft/daily.ts; ranking: /api/draft/daily.
 * Kept on this device: which days you played and how (kib-daily-draft).
 */
import { useEffect, useState } from "react";
import { dailyStreak, pickSquare, shareText } from "@/lib/draft/daily";
import type { DraftPlayer } from "@/app/draft/page";

const KEY = "kib-daily-draft";
interface DayResult { points: number; finish: number; topPct: number | null; squares: string; count?: number }

function readAll(): Record<string, DayResult> {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
function save(date: string, r: DayResult) {
  const all = readAll();
  // Your first score of the day stands (a replayed season only refreshes the ranking).
  const old = all[date];
  all[date] = old ? { ...old, topPct: r.topPct ?? old.topPct, count: r.count ?? old.count } : r;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ }
}

async function share(text: string) {
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch { /* cancelled */ }
  try { await navigator.clipboard.writeText(text); } catch { /* blocked */ }
}

const prettyDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

export function DailyDraftStart({ date, onStart }: { date: string; onStart: () => void }) {
  const [done, setDone] = useState<DayResult | null>(null);
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    const all = readAll();
    setDone(all[date] ?? null);
    setStreak(dailyStreak(Object.keys(all), date));
  }, [date]);
  return (
    <div className="w-full rounded-2xl bg-emerald-700 p-5 text-white shadow-lg" data-daily-draft-start>
      <p className="text-xs font-black uppercase tracking-widest text-white/90">Daily Draft · {prettyDate(date)}</p>
      <p className="mt-1 text-2xl font-black text-white">{done ? `Today: ${done.points} pts` : "Same 14 spins for everyone"}</p>
      <p className="mt-1 text-sm text-white">
        {done
          ? done.topPct !== null ? `Top ${done.topPct}% so far · finished ${done.finish}` : `Finished ${done.finish}`
          : "Pick your XI from today's spins, play one season, beat everyone's points."}
        {streak > 0 ? ` · 🔥 ${streak} day${streak === 1 ? "" : "s"}` : ""}
      </p>
      <div className="mt-4 flex gap-2">
        {done ? (
          <button onClick={() => share(shareText(date, done.squares, done.points, done.finish, done.topPct))} className="rounded-xl px-5 py-2.5 text-sm font-black" style={{ background: "#fff", color: "#065f46" }}>Share</button>
        ) : (
          <button data-daily-draft-play onClick={onStart} className="rounded-xl px-5 py-2.5 text-sm font-black" style={{ background: "#fff", color: "#065f46" }}>▶ Play today&apos;s draft</button>
        )}
        {done && <span className="self-center text-xs text-white/90">New spins tomorrow</span>}
      </div>
    </div>
  );
}

export function DailyDraftDone({ date, players, result, isSignedIn }: { date: string; players: DraftPlayer[]; result: { points: number; finish: number } | null; isSignedIn: boolean }) {
  const [rank, setRank] = useState<{ topPct: number | null; count: number } | null>(null);
  const squares = players.map((p) => pickSquare(p.overall, p.spinBest ?? p.overall)).join("");

  useEffect(() => {
    if (!result) return;
    let stop = false;
    const ask = async (tries: number) => {
      try {
        const r = await fetch(`/api/draft/daily?date=${date}&points=${result.points}`, { cache: "no-store" });
        const j = await r.json();
        if (stop) return;
        const got = { topPct: j.topPct ?? null, count: j.count ?? 0 };
        setRank(got);
        save(date, { ...result, squares, topPct: got.topPct, count: got.count });
      } catch { if (!stop) save(date, { ...result, squares, topPct: null }); }
      // The season is saved a moment after the table shows; ask once more so you count yourself.
      if (tries > 0 && !stop) setTimeout(() => ask(tries - 1), 4000);
    };
    save(date, { ...result, squares, topPct: null });
    ask(1);
    return () => { stop = true; };
  }, [date, result, squares]);

  if (!result) return null;
  return (
    <div className="w-full rounded-2xl bg-emerald-700 p-5 text-white shadow-lg" data-daily-draft-done>
      <p className="text-xs font-black uppercase tracking-widest text-white/90">Daily Draft · {prettyDate(date)}</p>
      <p className="mt-1 text-3xl font-black text-white">{result.points} pts</p>
      <p className="mt-1 text-sm text-white">
        {rank?.topPct != null ? `Top ${rank.topPct}% of ${rank.count} today` : rank ? `${rank.count} played today: too few to rank yet` : "Working out today's ranking…"}
        {!isSignedIn ? " · sign in to be counted" : ""}
      </p>
      <p className="mt-3 break-all text-xl leading-tight" aria-label="Your 14 picks as squares">{squares}</p>
      <p className="mt-1 text-xs text-white/90">🟩 the best player that spin had · 🟨 close · 🟧 more on the table</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button data-daily-draft-share onClick={() => share(shareText(date, squares, result.points, result.finish, rank?.topPct ?? null))} className="rounded-xl px-5 py-2.5 text-sm font-black" style={{ background: "#fff", color: "#065f46" }}>Share</button>
        <span className="self-center text-xs text-white/90">New spins at midnight</span>
      </div>
    </div>
  );
}
