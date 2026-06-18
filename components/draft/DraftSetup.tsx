"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { FORMATIONS } from "./formations";
import { createClient } from "@/lib/supabase/client";
import type { DraftSettings } from "@/app/draft/page";

interface Props {
  onStart: (settings: DraftSettings) => void;
  onCreateRoom?: (settings: DraftSettings) => void;
  onJoinRoom?: (code: string, settings: DraftSettings) => void;
}

export default function DraftSetup({ onStart, onCreateRoom, onJoinRoom }: Props) {
  const [formation, setFormation] = useState("4-3-3");
  const [eraStart, setEraStart] = useState(2007);
  const [eraEnd, setEraEnd] = useState(2026);
  const [mode, setMode] = useState<"normal" | "prime">("normal");
  const [draftOrder, setDraftOrder] = useState<"position-first" | "club-first">("position-first");
  const [respins, setRespins] = useState<0 | 1 | 3>(3);
  const [hiddenRatings, setHiddenRatings] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user);
    });
  }, []);

  const currentSettings = (): DraftSettings => ({
    formation,
    eraStart,
    eraEnd: Math.max(eraStart, eraEnd),
    mode,
    draftOrder,
    respins,
    hiddenRatings,
  });

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length !== 6) {
      setJoinError("Enter a 6-character room code");
      return;
    }
    setJoiningRoom(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/draft/rooms/${code}/join`, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        setJoinError(text || "Room not found");
        return;
      }
      onJoinRoom?.(code, currentSettings());
    } catch {
      setJoinError("Failed to connect");
    } finally {
      setJoiningRoom(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-3 sm:px-4 py-6">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
            <div className="h-px w-8 sm:w-10 bg-gradient-to-r from-transparent to-emerald-500" />
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.3em] text-emerald-400 uppercase">
              Knowitball
            </span>
            <div className="h-px w-8 sm:w-10 bg-gradient-to-l from-transparent to-emerald-500" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-2 sm:mb-3 bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
            PREMIER LEAGUE
            <br />
            <span className="text-emerald-400">DRAFT</span>
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm max-w-sm mx-auto">
            Draft your squad. Play seasons in multiple competitions. Try to win the league and break records, grow your squad and make history.
          </p>
        </div>

        {/* Sign-in prompt */}
        {isSignedIn === false && (
          <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">&#128274;</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white mb-1">Sign in to save your history</div>
                <p className="text-xs text-gray-500 mb-3">
                  Your draft runs and stats are saved when you&apos;re signed in. Play as a guest or sign in to track your progress.
                </p>
                <Link
                  href="/auth?next=/draft"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-lg font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Sign In / Sign Up
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Formation */}
        <div className="mb-6 sm:mb-8">
          <label className="block text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">
            Choose Formation
          </label>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {FORMATIONS.map((f) => (
              <button
                key={f.name}
                onClick={() => setFormation(f.name)}
                className={`relative py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${
                  formation === f.name
                    ? "bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-emerald-900/50"
                    : "bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700/50"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Era Range */}
        <div className="mb-6 sm:mb-8">
          <label className="block text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">
            Era Range
          </label>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <select
                value={eraStart}
                onChange={(e) => setEraStart(Number(e.target.value))}
                className="w-full appearance-none bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                {Array.from({ length: 20 }, (_, i) => 2007 + i).map((y) => (
                  <option key={y} value={y}>
                    {y - 1}/{String(y % 100).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-px bg-gray-600" />
              <span className="text-gray-500 font-bold text-[10px] sm:text-xs tracking-widest uppercase">to</span>
              <div className="w-2 h-px bg-gray-600" />
            </div>
            <div className="flex-1 relative">
              <select
                value={eraEnd}
                onChange={(e) => setEraEnd(Number(e.target.value))}
                className="w-full appearance-none bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                {Array.from({ length: 20 }, (_, i) => 2007 + i).map((y) => (
                  <option key={y} value={y}>
                    {y - 1}/{String(y % 100).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Game Mode */}
        <div className="mb-6 sm:mb-8">
          <label className="block text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">
            Game Mode
          </label>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <button
              onClick={() => setMode("normal")}
              className={`relative py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-left transition-all duration-200 ${
                mode === "normal"
                  ? "bg-emerald-600 ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-emerald-900/50"
                  : "bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50"
              }`}
            >
              <div className={`text-xs sm:text-sm font-bold ${mode === "normal" ? "text-white" : "text-gray-400"}`}>
                Normal
              </div>
              <div className={`text-[9px] sm:text-[10px] mt-0.5 ${mode === "normal" ? "text-emerald-200/70" : "text-gray-600"}`}>
                Players rated as they were that season
              </div>
            </button>
            <button
              onClick={() => setMode("prime")}
              className={`relative py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-left transition-all duration-200 ${
                mode === "prime"
                  ? "bg-amber-600 ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-amber-900/50"
                  : "bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50"
              }`}
            >
              <div className={`text-xs sm:text-sm font-bold ${mode === "prime" ? "text-white" : "text-gray-400"}`}>
                Prime
              </div>
              <div className={`text-[9px] sm:text-[10px] mt-0.5 ${mode === "prime" ? "text-amber-200/70" : "text-gray-600"}`}>
                Every player uses their best-ever rating
              </div>
            </button>
          </div>
        </div>

        {/* Draft Order */}
        <div className="mb-6 sm:mb-8">
          <label className="block text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">
            Draft Order
          </label>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <button
              onClick={() => setDraftOrder("position-first")}
              className={`relative py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-left transition-all duration-200 ${
                draftOrder === "position-first"
                  ? "bg-emerald-600 ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-emerald-900/50"
                  : "bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50"
              }`}
            >
              <div className={`text-xs sm:text-sm font-bold ${draftOrder === "position-first" ? "text-white" : "text-gray-400"}`}>
                Position First
              </div>
              <div className={`text-[9px] sm:text-[10px] mt-0.5 ${draftOrder === "position-first" ? "text-emerald-200/70" : "text-gray-600"}`}>
                Fill each position slot in order
              </div>
            </button>
            <button
              onClick={() => setDraftOrder("club-first")}
              className={`relative py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-left transition-all duration-200 ${
                draftOrder === "club-first"
                  ? "bg-sky-600 ring-2 ring-sky-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-sky-900/50"
                  : "bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50"
              }`}
            >
              <div className={`text-xs sm:text-sm font-bold ${draftOrder === "club-first" ? "text-white" : "text-gray-400"}`}>
                Club First
              </div>
              <div className={`text-[9px] sm:text-[10px] mt-0.5 ${draftOrder === "club-first" ? "text-sky-200/70" : "text-gray-600"}`}>
                Pick a player, then choose their position
              </div>
            </button>
          </div>
        </div>

        {/* Formation Preview */}
        <div className="mb-6 sm:mb-8">
          <label className="block text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">
            Formation Preview
          </label>
          <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-emerald-800/40">
            {/* Pitch gradient background */}
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/80 via-emerald-900/40 to-emerald-950/80" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-800/20 via-transparent to-transparent" />

            {/* Pitch lines */}
            <div className="absolute inset-x-[10%] top-[5%] bottom-[5%] border border-emerald-600/30 rounded" />
            <div className="absolute inset-x-[10%] top-[5%] h-[18%] border-b border-emerald-600/30" />
            <div className="absolute inset-x-[10%] bottom-[5%] h-[18%] border-t border-emerald-600/30" />
            <div className="absolute left-1/2 top-[5%] bottom-[5%] w-px bg-emerald-600/30" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-emerald-600/30" />
            {/* Center dot */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-600/40" />

            {/* Formation name overlay */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-bold tracking-widest text-emerald-400/60 uppercase">
              {formation}
            </div>

            {/* Players */}
            {FORMATIONS.find((f) => f.name === formation)?.slots.map(
              (slot, i) => (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-600/90 border-2 border-emerald-400/70 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white shadow-lg shadow-emerald-900/50">
                    {slot.label}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Re-spins */}
        <div className="mb-6 sm:mb-8">
          <label className="block text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">
            Re-spins Per Draft
          </label>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {([3, 1, 0] as const).map((n) => (
              <button
                key={n}
                onClick={() => setRespins(n)}
                className={`relative py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-left transition-all duration-200 ${
                  respins === n
                    ? "bg-emerald-600 ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-emerald-900/50"
                    : "bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50"
                }`}
              >
                <div className={`text-sm font-bold ${respins === n ? "text-white" : "text-gray-400"}`}>
                  {n === 0 ? "None" : n === 1 ? "1 Re-spin" : "3 Re-spins"}
                </div>
                <div className={`text-[9px] sm:text-[10px] mt-0.5 ${respins === n ? "text-emerald-200/70" : "text-gray-600"}`}>
                  {n === 0 ? "No second chances" : n === 1 ? "One total" : "Three total"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Hidden Ratings */}
        <div className="mb-6 sm:mb-8">
          <label className="block text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">
            Mystery Mode
          </label>
          <button
            onClick={() => setHiddenRatings(!hiddenRatings)}
            className={`w-full relative py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-left transition-all duration-200 ${
              hiddenRatings
                ? "bg-purple-600 ring-2 ring-purple-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-purple-900/50"
                : "bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50"
            }`}
          >
            <div className={`text-xs sm:text-sm font-bold ${hiddenRatings ? "text-white" : "text-gray-400"}`}>
              {hiddenRatings ? "Hidden Ratings: ON" : "Hidden Ratings: OFF"}
            </div>
            <div className={`text-[9px] sm:text-[10px] mt-0.5 ${hiddenRatings ? "text-purple-200/70" : "text-gray-600"}`}>
              All ratings &amp; attributes hidden until you pick. Roster order randomised.
            </div>
          </button>
        </div>

        {/* Multiplayer */}
        {isSignedIn === true && onCreateRoom && onJoinRoom && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-gray-800" />
              <label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                Multiplayer
              </label>
              <div className="h-px flex-1 bg-gray-800" />
            </div>
            <div className="space-y-2">
              <button
                onClick={() => onCreateRoom(currentSettings())}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50 text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Room
              </button>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); }}
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                  placeholder="Room code"
                  maxLength={6}
                  className="flex-1 bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 py-3 text-sm font-mono font-bold text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500 tracking-widest uppercase"
                />
                <button
                  onClick={handleJoin}
                  disabled={joiningRoom}
                  className="px-5 py-3 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joiningRoom ? "..." : "Join"}
                </button>
              </div>
              {joinError && (
                <div className="text-red-400 text-xs text-center">{joinError}</div>
              )}
            </div>
          </div>
        )}

        {/* Era validation warning */}
        {eraStart > eraEnd && (
          <div className="mb-4 bg-red-900/20 border border-red-800/50 rounded-lg p-3 text-sm text-red-400 text-center">
            Start year must be before or equal to end year
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={() => onStart({ formation, eraStart, eraEnd: Math.max(eraStart, eraEnd), mode, draftOrder, respins, hiddenRatings })}
          disabled={eraStart > eraEnd}
          className="group relative w-full py-3.5 sm:py-4 rounded-xl text-base sm:text-lg font-bold transition-all duration-300 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-900/50 hover:shadow-emerald-800/60 hover:scale-[1.02] active:scale-[0.98] disabled:from-gray-700 disabled:to-gray-700 disabled:shadow-none disabled:cursor-not-allowed"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            Start Draft
            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </span>
        </button>

        <p className="text-center text-gray-600 text-xs mt-4">
          14 spins. 11 starters + 3 subs. 38 matches.
        </p>
        <div className="flex gap-2 mt-4">
          <Link
            href="/draft/history"
            className="flex-1 py-3 text-center text-sm font-bold text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            History &amp; Achievements &rarr;
          </Link>
          <Link
            href="/draft/records"
            className="flex-1 py-3 text-center text-sm font-bold text-amber-400 hover:text-amber-300 bg-amber-900/10 hover:bg-amber-900/20 border border-amber-700/30 hover:border-amber-600/50 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            📋 Hall of Records &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
