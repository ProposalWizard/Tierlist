"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { FORMATIONS } from "./formations";
import { createClient } from "@/lib/supabase/client";
import ObjectivesToast from "@/components/ObjectivesToast";
import type { DraftSettings } from "@/app/draft/page";
import DraftNavCards from "./DraftNavCards";

// draft-dev2 setup: identical to /draft's DraftSetup, EXCEPT the top centered
// "PREMIER LEAGUE DRAFT" text header is replaced with a contained hero card
// featuring the player-image design. Everything else — layout, spacing, colors,
// buttons — matches /draft verbatim so the two pages line up.

// Framing for the hero photo. x/y are backgroundPosition percentages and zoom
// scales out from that same point, so panning and zooming share one focal point.
// These were set by eye using a temporary on-page slider panel, which has since
// been removed — change the numbers here to reframe the image for everyone.
const HERO_IMG = { x: 34, y: 42, zoom: 1.04 };

function TeamNameInput({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  return (
    <div className="mb-3 sm:mb-4">
      <label className="block text-xs font-bold tracking-widest text-white uppercase mb-2.5">
        Your Team Name
      </label>
      {/* text-[16px] prevents iOS from zooming in on focus */}
      <input
        type="text"
        value={localValue}
        onChange={e => setLocalValue(e.target.value.slice(0, 50))}
        onBlur={() => { const v = localValue.trim(); if (v) onChange(v); }}
        placeholder="KNOWITBALL FC"
        maxLength={50}
        className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-4 py-3 text-[16px] font-bold text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
        style={{ touchAction: "manipulation" }}
      />
      <p className="text-[10px] text-gray-500 mt-1.5">Shown in league tables across all your drafts</p>
    </div>
  );
}

interface Props {
  onStart: (settings: DraftSettings) => void;
  onCreateRoom?: (settings: DraftSettings) => void;
  onJoinRoom?: (code: string, settings: DraftSettings) => void;
  teamName?: string;
  onTeamNameChange?: (name: string) => void;
}

export default function DraftSetupHero({ onStart, onCreateRoom, onJoinRoom, teamName, onTeamNameChange }: Props) {
  const [formation, setFormation] = useState("4-3-3");
  const [eraStart, setEraStart] = useState(2007);
  const [eraEnd, setEraEnd] = useState(2026);
  const [mode, setMode] = useState<"normal" | "prime">("normal");
  const [draftOrder, setDraftOrder] = useState<"position-first" | "club-first">("club-first");
  const [respins, setRespins] = useState<0 | 1 | 3>(3);
  const [hiddenRatings, setHiddenRatings] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setIsSignedIn(!!user));
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
    // justify-start: long content scrolls naturally on phones instead of fighting justify-center
    <div className="flex flex-col items-center justify-start min-h-screen px-3 sm:px-4 pt-4 pb-10 sm:pt-8 sm:pb-12 relative">
      <ObjectivesToast />
      <div className="max-w-lg w-full">

        {/* ─── HERO CARD — replaces /draft's centered text header
             - Full-width image so all 4 players are visible (no left-crop)
             - Title pinned to top, description pinned to bottom
             - Left-side dark gradient keeps the text readable */}
        <div
          className="relative overflow-hidden rounded-2xl mb-3 sm:mb-4 border border-white/5"
          style={{ background: "#07090d", aspectRatio: "5 / 4" }}
        >
          {/* Background image. The framing below was dialled in by eye and is now
              fixed: HERO_IMG.x/y are backgroundPosition percentages and the zoom
              scales from that same point, so the focal point stays put. */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "url('/draft-hero.jpg')",
                backgroundSize: "cover",
                backgroundPosition: `${HERO_IMG.x}% ${HERO_IMG.y}%`,
                transform: `scale(${HERO_IMG.zoom})`,
                transformOrigin: `${HERO_IMG.x}% ${HERO_IMG.y}%`,
              }}
            />
          </div>
          {/* Dark fade on the left for text readability */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to right, #07090d 0%, #07090de0 22%, #07090d80 40%, #07090d20 60%, transparent 80%)" }}
          />
          {/* Top+bottom soft vignette so text at top/bottom stays legible */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, #07090d40 0%, transparent 20%, transparent 75%, #07090dcc 100%)" }}
          />

          {/* Content — title top-left, description bottom-left */}
          <div className="relative h-full flex flex-col p-4 pt-3">
            {/* Title block, pinned to top */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px w-4 bg-emerald-500/60" />
                <span className="text-[8px] sm:text-[9px] font-black tracking-[0.4em] text-emerald-400 uppercase">Knowitball</span>
                <div className="h-px w-4 bg-emerald-500/60" />
              </div>
              <div className="font-black tracking-tight leading-[0.92] text-white uppercase" style={{ fontSize: "clamp(1.15rem, 5.6vw, 1.85rem)" }}>
                PREMIER<br />LEAGUE
              </div>
              <div
                className="font-black tracking-tight leading-[0.9] uppercase mt-1"
                style={{
                  fontSize: "clamp(2rem, 11vw, 3.4rem)",
                  background: "linear-gradient(180deg, #86efac 0%, #10b981 40%, #059669 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                DRAFT
              </div>
            </div>
            {/* Description, pinned to bottom */}
            <p className="mt-auto text-[10px] sm:text-xs text-gray-200 leading-snug max-w-[68%] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              Draft your squad. Play seasons in multiple competitions. Try to win the league and break records, grow your squad and make history.
            </p>
          </div>
        </div>

        {/* How to Play + History/HoF (description moved inside hero) */}
        <div className="text-center mb-4 sm:mb-5">
          <button
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-xs font-bold text-white hover:text-white hover:border-gray-500 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to Play
          </button>
          <DraftNavCards isSignedIn={isSignedIn} />
        </div>

        {onTeamNameChange && <TeamNameInput value={teamName ?? ""} onChange={onTeamNameChange} />}

        {/* Formation — 2 cols on mobile (names like 4-2-3-1 are too cramped at 4-col) */}
        <div className="mb-3 sm:mb-4">
          <label className="block text-xs font-bold tracking-widest text-white uppercase mb-2.5">Choose Formation</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FORMATIONS.map((f) => (
              <button
                key={f.name}
                onClick={() => setFormation(f.name)}
                style={{ touchAction: "manipulation", minHeight: "44px" }}
                className={`relative py-3 px-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                  formation === f.name
                    ? "bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-emerald-900/50"
                    : "bg-gray-800/80 text-white border border-gray-700/50"
                }`}
              >{f.name}</button>
            ))}
          </div>
        </div>

        {/* Era Range — text-[16px] on selects prevents iOS from zooming on focus */}
        <div className="mb-3 sm:mb-4">
          <label className="block text-xs font-bold tracking-widest text-white uppercase mb-2.5">Era Range</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <select
                value={eraStart}
                onChange={(e) => setEraStart(Number(e.target.value))}
                className="w-full appearance-none bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 py-3 text-[16px] font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                style={{ touchAction: "manipulation" }}
              >
                {Array.from({ length: 20 }, (_, i) => 2007 + i).map((y) => (
                  <option key={y} value={y}>{y - 1}/{String(y % 100).padStart(2, "0")}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <span className="text-white font-bold text-xs tracking-widest uppercase shrink-0">to</span>
            <div className="flex-1 relative">
              <select
                value={eraEnd}
                onChange={(e) => setEraEnd(Number(e.target.value))}
                className="w-full appearance-none bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 py-3 text-[16px] font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                style={{ touchAction: "manipulation" }}
              >
                {Array.from({ length: 20 }, (_, i) => 2007 + i).map((y) => (
                  <option key={y} value={y}>{y - 1}/{String(y % 100).padStart(2, "0")}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Game Mode */}
        <div className="mb-3 sm:mb-4">
          <label className="block text-xs font-bold tracking-widest text-white uppercase mb-2.5">Game Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "normal", label: "Normal", desc: "Players rated as that season", active: mode === "normal", cls: "emerald" },
              { value: "prime", label: "Prime", desc: "Every player at their best-ever", active: mode === "prime", cls: "amber" },
            ] as const).map(({ value, label, desc, active, cls }) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                style={{ touchAction: "manipulation", minHeight: "56px" }}
                className={`relative py-3 px-3 rounded-lg text-left transition-all active:scale-95 ${
                  active
                    ? `bg-${cls}-600 ring-2 ring-${cls}-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-${cls}-900/50`
                    : "bg-gray-800/80 border border-gray-700/50"
                }`}
              >
                <div className="text-sm font-bold text-white">{label}</div>
                <div className={`text-[10px] mt-0.5 ${active ? `text-${cls}-100` : "text-gray-400"}`}>{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Draft Order */}
        <div className="mb-3 sm:mb-4">
          <label className="block text-xs font-bold tracking-widest text-white uppercase mb-2.5">Draft Order</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "club-first", label: "Club First", desc: "Pick player, then position", active: draftOrder === "club-first", cls: "emerald" },
              { value: "position-first", label: "Position First", desc: "Fill each slot in order", active: draftOrder === "position-first", cls: "sky" },
            ] as const).map(({ value, label, desc, active, cls }) => (
              <button
                key={value}
                onClick={() => setDraftOrder(value)}
                style={{ touchAction: "manipulation", minHeight: "56px" }}
                className={`relative py-3 px-3 rounded-lg text-left transition-all active:scale-95 ${
                  active
                    ? `bg-${cls}-600 ring-2 ring-${cls}-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-${cls}-900/50`
                    : "bg-gray-800/80 border border-gray-700/50"
                }`}
              >
                <div className="text-sm font-bold text-white">{label}</div>
                <div className={`text-[10px] mt-0.5 ${active ? `text-${cls}-100` : "text-gray-400"}`}>{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Rating Visibility */}
        <div className="mb-3 sm:mb-4">
          <label className="block text-xs font-bold tracking-widest text-white uppercase mb-2.5">Rating Visibility</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: false, label: "Normal", desc: "Ratings visible while picking", active: !hiddenRatings, cls: "emerald" },
              { value: true, label: "Hidden", desc: "Revealed only after you pick", active: hiddenRatings, cls: "purple" },
            ] as const).map(({ value, label, desc, active, cls }) => (
              <button
                key={String(value)}
                onClick={() => setHiddenRatings(value)}
                style={{ touchAction: "manipulation", minHeight: "56px" }}
                className={`relative py-3 px-3 rounded-lg text-left transition-all active:scale-95 ${
                  active
                    ? `bg-${cls}-600 ring-2 ring-${cls}-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-${cls}-900/50`
                    : "bg-gray-800/80 border border-gray-700/50"
                }`}
              >
                <div className="text-sm font-bold text-white">{label}</div>
                <div className={`text-[10px] mt-0.5 ${active ? `text-${cls}-100` : "text-gray-400"}`}>{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Re-spins */}
        <div className="mb-3 sm:mb-4">
          <label className="block text-xs font-bold tracking-widest text-white uppercase mb-2.5">Re-spins Per Draft</label>
          <div className="grid grid-cols-3 gap-2">
            {([3, 1, 0] as const).map((n) => (
              <button
                key={n}
                onClick={() => setRespins(n)}
                style={{ touchAction: "manipulation", minHeight: "56px" }}
                className={`relative py-3 px-2 rounded-lg text-left transition-all active:scale-95 ${
                  respins === n ? "bg-emerald-600 ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-emerald-900/50" : "bg-gray-800/80 border border-gray-700/50"
                }`}
              >
                <div className="text-sm font-bold text-white">{n === 0 ? "None" : `${n} Re-spin${n > 1 ? "s" : ""}`}</div>
                <div className={`text-[10px] mt-0.5 ${respins === n ? "text-emerald-200/70" : "text-gray-400"}`}>{n === 0 ? "No second chances" : n === 1 ? "One total" : "Three total"}</div>
              </button>
            ))}
          </div>
        </div>

        {eraStart > eraEnd && (
          <div className="mb-4 bg-red-900/20 border border-red-800/50 rounded-lg p-3 text-sm text-red-400 text-center">
            Start year must be before or equal to end year
          </div>
        )}

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

        <p className="text-center text-white text-xs mt-4">14 spins. 11 starters + 3 subs. 38 matches.</p>

        {isSignedIn === false && (
          <div className="bg-gray-900 rounded-xl p-4 mt-6 border border-gray-800/50">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">&#128274;</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white mb-1">Sign in to save your history</div>
                <p className="text-xs text-white mb-3">
                  You can play as a guest right now. Sign in to play Online, Enter the Hall of Fame, and Save Progress.
                </p>
                <Link
                  href="/auth?next=/draft-dev2"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-lg font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Sign In / Sign Up
                </Link>
              </div>
            </div>
          </div>
        )}

        {isSignedIn === false && (
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-gray-800" />
              <label className="text-xs font-bold tracking-widest text-white uppercase">Multiplayer</label>
              <div className="h-px flex-1 bg-gray-800" />
            </div>
            <Link
              href="/auth?next=/draft-dev2"
              className="block rounded-xl border border-gray-800/60 bg-gray-900/40 p-3 transition-all hover:border-emerald-700/50 hover:bg-gray-900/70"
            >
              <div className="space-y-2 opacity-50 pointer-events-none select-none">
                <div className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-gray-800/80 border border-gray-700/50 text-white flex items-center justify-center gap-2">
                  <span>&#128274;</span> Create Room
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 py-3 text-sm font-mono font-bold text-white/50 tracking-widest uppercase">
                    Enter Room Code
                  </div>
                  <div className="px-5 py-3 rounded-xl text-sm font-bold bg-sky-600/80 text-white">Join</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400">
                <span>&#128274;</span> Sign in to create or join multiplayer rooms
              </div>
            </Link>
          </div>
        )}

        {isSignedIn === true && onCreateRoom && onJoinRoom && (
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-gray-800" />
              <label className="text-xs font-bold tracking-widest text-white uppercase">Multiplayer</label>
              <div className="h-px flex-1 bg-gray-800" />
            </div>
            <div className="space-y-2">
              <button
                onClick={() => onCreateRoom(currentSettings())}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-gray-800/80 hover:bg-gray-700 border border-gray-700/50 text-white hover:text-white transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
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
                  placeholder="Enter Room Code"
                  maxLength={6}
                  className="flex-1 bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 py-3 text-sm font-mono font-bold text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-sky-500 tracking-widest uppercase"
                />
                <button
                  onClick={handleJoin}
                  disabled={joiningRoom}
                  className="px-5 py-3 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joiningRoom ? "..." : "Join"}
                </button>
              </div>
              {joinError && <div className="text-red-400 text-xs text-center">{joinError}</div>}
            </div>
          </div>
        )}
      </div>

      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowHowToPlay(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900 rounded-t-2xl">
              <h2 className="text-base font-black text-white">How to Play</h2>
              <button onClick={() => setShowHowToPlay(false)} className="text-white hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-0 text-sm text-white">
              {[
                { n: 1, title: "Spin the wheel", desc: "Each spin lands on a random English top-flight club from a real FIFA season." },
                { n: 2, title: "Pick a player", desc: "Choose one player from that club's roster and slot them into your formation." },
                { n: 3, title: "Build your XI", desc: "Keep spinning and picking until all 11 positions are filled." },
                { n: 4, title: "Fight for the Title", desc: "Play out a full 38-game league season and attempt to break worldwide records (Hall of Fame)." },
                { n: 5, title: "Evolve Your Squad", desc: "Receive upgrades, replace and transfer in new players, and prepare for the next season." },
                { n: 6, title: "Build Your Legacy", desc: "You have 5 seasons to win as much as you can and build your ultimate squad. Have Fun!" },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-4 py-4 border-b border-gray-800/50 last:border-b-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-black text-white shrink-0">{step.n}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">{step.title}</div>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
