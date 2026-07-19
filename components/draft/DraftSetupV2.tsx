"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { FORMATIONS } from "./formations";
import { createClient } from "@/lib/supabase/client";
import ObjectivesToast from "@/components/ObjectivesToast";
import type { DraftSettings } from "@/app/draft/page";

function TeamNameInput({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  return (
    <input
      type="text"
      value={localValue}
      onChange={e => setLocalValue(e.target.value.slice(0, 50))}
      onBlur={() => { const v = localValue.trim(); if (v) onChange(v); }}
      onKeyDown={e => {
        if (e.key === "Enter") {
          const v = localValue.trim();
          if (v) onChange(v);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="KNOWITBALL FC"
      maxLength={50}
      className="flex-1 min-w-0 bg-transparent text-sm font-black text-white placeholder-gray-600 focus:outline-none"
    />
  );
}

function MiniPitch({ slots }: { slots: typeof FORMATIONS[0]["slots"] }) {
  return (
    <svg viewBox="0 0 30 40" className="w-full h-full">
      <rect x="1" y="1" width="28" height="38" rx="1.5" fill="rgba(0,0,0,0.15)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6"/>
      <line x1="1" y1="20" x2="29" y2="20" stroke="rgba(255,255,255,0.07)" strokeWidth="0.4"/>
      <circle cx="15" cy="20" r="5" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.4"/>
      {slots.map((slot, i) => (
        <circle key={i} cx={1 + (slot.x / 100) * 28} cy={1 + (slot.y / 100) * 38} r="1.7" fill="#10b981" opacity="0.9"/>
      ))}
    </svg>
  );
}

function LargePitch({ formation }: { formation: typeof FORMATIONS[0] }) {
  return (
    <div
      className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-emerald-800/30 shadow-inner"
      style={{ background: "linear-gradient(180deg, #0d3318 0%, #0a2714 50%, #071d0e 100%)" }}
    >
      {/* Pitch lines */}
      <div className="absolute inset-x-[8%] top-[5%] bottom-[5%] border border-white/10 rounded-sm"/>
      <div className="absolute left-1/2 top-[5%] bottom-[5%] w-px bg-white/10"/>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[28%] aspect-square rounded-full border border-white/10"/>
      <div className="absolute left-[22%] top-[5%] w-[56%] h-[14%] border-x border-b border-white/8"/>
      <div className="absolute left-[22%] bottom-[5%] w-[56%] h-[14%] border-x border-t border-white/8"/>
      {/* Player dots */}
      {formation.slots.map((slot, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
        >
          <div className="w-7 h-7 rounded-full bg-emerald-600/25 border border-emerald-400/50 flex items-center justify-center shadow-lg shadow-emerald-900/50">
            <span className="text-[8px] font-black text-emerald-300">{slot.label}</span>
          </div>
        </div>
      ))}
      <div className="absolute bottom-2 inset-x-0 text-center">
        <span className="text-[9px] font-black tracking-widest text-white/30 uppercase">{formation.name}</span>
      </div>
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

export default function DraftSetupV2({ onStart, onCreateRoom, onJoinRoom, teamName, onTeamNameChange }: Props) {
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user);
    });
  }, []);

  const selectedFormation = FORMATIONS.find(f => f.name === formation) ?? FORMATIONS[0];

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
    <div className="min-h-screen bg-[#070a0e] text-white">
      <ObjectivesToast />

      {/* ── HERO ── */}
      <div className="relative px-4 pt-10 pb-7 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/25 via-transparent to-transparent pointer-events-none"/>
        {/* subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="max-w-xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-emerald-600/70"/>
            <span className="text-[10px] font-black tracking-[0.45em] text-emerald-400 uppercase">Knowitball</span>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-emerald-600/70"/>
          </div>

          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-none text-white mb-0.5">
            PREMIER LEAGUE
          </h1>
          <h2 className="text-6xl sm:text-7xl font-black tracking-tight leading-none bg-gradient-to-b from-emerald-300 to-emerald-500 bg-clip-text text-transparent mb-5">
            DRAFT
          </h2>

          <p className="text-gray-500 text-[13px] max-w-xs mx-auto leading-relaxed mb-5">
            Draft your squad from real PL rosters. Play a 38-game season. Break records. Build your legacy.
          </p>

          <button
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-900 border border-gray-700/60 text-xs font-bold text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to Play
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pb-14 space-y-3">

        {/* ── HISTORY & HALL OF FAME ── */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={isSignedIn === false ? "/auth?next=/draft/history" : "/draft/history"}
            className="group flex items-center gap-3 bg-gray-900/60 border border-gray-800/60 rounded-2xl px-4 py-3.5 hover:border-gray-700/80 hover:bg-gray-900 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-950/50 border border-sky-800/40 flex items-center justify-center shrink-0">
              {isSignedIn === false ? (
                <span className="text-sm">🔒</span>
              ) : (
                <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-white">History</div>
              <div className="text-[10px] text-gray-600 leading-tight">&amp; Achievements</div>
            </div>
            <svg className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>

          <Link
            href={isSignedIn === false ? "/auth?next=/draft/records" : "/draft/records"}
            className="group flex items-center gap-3 bg-gray-900/60 border border-gray-800/60 rounded-2xl px-4 py-3.5 hover:border-amber-800/40 hover:bg-gray-900 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-950/50 border border-amber-800/40 flex items-center justify-center shrink-0">
              {isSignedIn === false ? (
                <span className="text-sm">🔒</span>
              ) : (
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-amber-300">Hall of Fame</div>
              <div className="text-[10px] text-gray-600 leading-tight">World Records</div>
            </div>
            <svg className="w-3.5 h-3.5 text-gray-700 group-hover:text-amber-700/60 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>

        {/* ── TEAM NAME ── */}
        {onTeamNameChange && (
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl px-4 py-3">
            <div className="text-[9px] font-black tracking-[0.3em] text-gray-600 uppercase mb-2">Your Team</div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <TeamNameInput value={teamName ?? ""} onChange={onTeamNameChange} />
              <svg className="w-3.5 h-3.5 text-gray-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
          </div>
        )}

        {/* ── FORMATION ── */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-4">
          <div className="text-[9px] font-black tracking-[0.3em] text-gray-600 uppercase mb-3">Formation</div>
          <div className="flex gap-3">
            {/* Formation grid */}
            <div className="flex-1 grid grid-cols-3 gap-1.5 content-start">
              {FORMATIONS.map(f => (
                <button
                  key={f.name}
                  onClick={() => setFormation(f.name)}
                  className={`relative rounded-xl overflow-hidden border transition-all duration-200 ${
                    formation === f.name
                      ? "border-emerald-500/60 shadow-md shadow-emerald-900/30"
                      : "border-gray-800/60 hover:border-gray-700/80"
                  }`}
                >
                  <div className={`absolute inset-0 transition-colors duration-200 ${
                    formation === f.name ? "bg-emerald-950/60" : "bg-gray-800/20"
                  }`}/>
                  <div className="relative p-1.5 pb-1">
                    <div className="aspect-[3/4]">
                      <MiniPitch slots={f.slots} />
                    </div>
                    <div className={`text-[10px] font-black text-center mt-1 ${
                      formation === f.name ? "text-emerald-400" : "text-gray-500"
                    }`}>{f.name}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Pitch preview */}
            <div className="w-24 sm:w-32 shrink-0">
              <LargePitch formation={selectedFormation} />
            </div>
          </div>
        </div>

        {/* ── ERA / MODE / ORDER ── */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-4">
            {/* Era Range */}
            <div>
              <div className="text-[9px] font-black tracking-[0.3em] text-gray-600 uppercase mb-2.5">Era Range</div>
              <div className="space-y-1.5">
                <div className="relative">
                  <select
                    value={eraStart}
                    onChange={e => setEraStart(Number(e.target.value))}
                    className="w-full appearance-none bg-gray-800/70 border border-gray-700/50 rounded-lg px-2 py-2 text-[11px] font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/60 transition"
                  >
                    {Array.from({ length: 20 }, (_, i) => 2007 + i).map(y => (
                      <option key={y} value={y}>{y - 1}/{String(y % 100).padStart(2, "0")}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/></svg>
                  </div>
                </div>
                <div className="text-center text-[9px] font-bold text-gray-700 uppercase tracking-widest">to</div>
                <div className="relative">
                  <select
                    value={eraEnd}
                    onChange={e => setEraEnd(Number(e.target.value))}
                    className="w-full appearance-none bg-gray-800/70 border border-gray-700/50 rounded-lg px-2 py-2 text-[11px] font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/60 transition"
                  >
                    {Array.from({ length: 20 }, (_, i) => 2007 + i).map(y => (
                      <option key={y} value={y}>{y - 1}/{String(y % 100).padStart(2, "0")}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Game Mode */}
            <div>
              <div className="text-[9px] font-black tracking-[0.3em] text-gray-600 uppercase mb-2.5">Mode</div>
              <div className="space-y-1.5">
                <button
                  onClick={() => setMode("normal")}
                  className={`w-full py-2 px-2 rounded-lg text-[11px] font-black text-left transition-all ${
                    mode === "normal"
                      ? "bg-emerald-700/80 text-white border border-emerald-600/60 shadow-sm shadow-emerald-900/50"
                      : "bg-gray-800/50 text-gray-500 border border-gray-700/40 hover:bg-gray-800/80 hover:text-gray-300"
                  }`}
                >
                  Normal
                  {mode === "normal" && <div className="text-[8px] text-emerald-200/70 font-medium mt-0.5">Season ratings</div>}
                </button>
                <button
                  onClick={() => setMode("prime")}
                  className={`w-full py-2 px-2 rounded-lg text-[11px] font-black text-left transition-all ${
                    mode === "prime"
                      ? "bg-amber-700/80 text-white border border-amber-600/60 shadow-sm shadow-amber-900/50"
                      : "bg-gray-800/50 text-gray-500 border border-gray-700/40 hover:bg-gray-800/80 hover:text-gray-300"
                  }`}
                >
                  Prime ✦
                  {mode === "prime" && <div className="text-[8px] text-amber-200/70 font-medium mt-0.5">Career-best OVR</div>}
                </button>
              </div>
            </div>

            {/* Draft Order */}
            <div>
              <div className="text-[9px] font-black tracking-[0.3em] text-gray-600 uppercase mb-2.5">Order</div>
              <div className="space-y-1.5">
                <button
                  onClick={() => setDraftOrder("club-first")}
                  className={`w-full py-2 px-2 rounded-lg text-[11px] font-black text-left transition-all ${
                    draftOrder === "club-first"
                      ? "bg-emerald-700/80 text-white border border-emerald-600/60 shadow-sm shadow-emerald-900/50"
                      : "bg-gray-800/50 text-gray-500 border border-gray-700/40 hover:bg-gray-800/80 hover:text-gray-300"
                  }`}
                >
                  Club First
                  {draftOrder === "club-first" && <div className="text-[8px] text-emerald-200/70 font-medium mt-0.5">Spin → pick</div>}
                </button>
                <button
                  onClick={() => setDraftOrder("position-first")}
                  className={`w-full py-2 px-2 rounded-lg text-[11px] font-black text-left transition-all ${
                    draftOrder === "position-first"
                      ? "bg-sky-700/80 text-white border border-sky-600/60 shadow-sm shadow-sky-900/50"
                      : "bg-gray-800/50 text-gray-500 border border-gray-700/40 hover:bg-gray-800/80 hover:text-gray-300"
                  }`}
                >
                  Position
                  {draftOrder === "position-first" && <div className="text-[8px] text-sky-200/70 font-medium mt-0.5">Slot by slot</div>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RATINGS + RE-SPINS ── */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Rating Visibility */}
            <div>
              <div className="text-[9px] font-black tracking-[0.3em] text-gray-600 uppercase mb-2.5">Ratings</div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setHiddenRatings(false)}
                  className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${
                    !hiddenRatings
                      ? "bg-emerald-700/80 text-white border border-emerald-600/60 shadow-sm shadow-emerald-900/50"
                      : "bg-gray-800/50 text-gray-500 border border-gray-700/40 hover:bg-gray-800/80 hover:text-gray-300"
                  }`}
                >
                  Visible
                </button>
                <button
                  onClick={() => setHiddenRatings(true)}
                  className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${
                    hiddenRatings
                      ? "bg-purple-700/80 text-white border border-purple-600/60 shadow-sm shadow-purple-900/50"
                      : "bg-gray-800/50 text-gray-500 border border-gray-700/40 hover:bg-gray-800/80 hover:text-gray-300"
                  }`}
                >
                  Hidden
                </button>
              </div>
            </div>

            {/* Re-spins */}
            <div>
              <div className="text-[9px] font-black tracking-[0.3em] text-gray-600 uppercase mb-2.5">Re-Spins</div>
              <div className="flex gap-1.5">
                {([3, 1, 0] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setRespins(n)}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${
                      respins === n
                        ? "bg-emerald-700/80 text-white border border-emerald-600/60 shadow-sm shadow-emerald-900/50"
                        : "bg-gray-800/50 text-gray-500 border border-gray-700/40 hover:bg-gray-800/80 hover:text-gray-300"
                    }`}
                  >
                    {n === 0 ? "×0" : n === 1 ? "×1" : "×3"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Era validation warning */}
        {eraStart > eraEnd && (
          <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-3 text-xs text-red-400 text-center">
            Start year must be before or equal to end year
          </div>
        )}

        {/* ── START BUTTON ── */}
        <button
          onClick={() => onStart(currentSettings())}
          disabled={eraStart > eraEnd}
          className="w-full py-5 rounded-2xl text-xl font-black text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-xl shadow-emerald-900/40 hover:shadow-emerald-800/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
        >
          ⚽ Start Draft →
        </button>

        {/* Stats strip */}
        <div className="flex items-center justify-center">
          {[
            { value: "14", label: "Spins" },
            { value: "11", label: "Starters" },
            { value: "+3", label: "Subs" },
            { value: "38", label: "Matches" },
          ].map((stat, i) => (
            <div key={i} className="flex items-center">
              {i > 0 && <div className="w-px h-7 bg-gray-800 mx-5"/>}
              <div className="text-center">
                <div className="text-lg font-black text-white leading-tight">{stat.value}</div>
                <div className="text-[9px] font-bold text-gray-600 tracking-widest uppercase">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── SIGN-IN PROMPT ── */}
        {isSignedIn === false && (
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">🔒</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white mb-1">Sign in to save your history</div>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Play as a guest right now. Sign in for multiplayer, Hall of Fame, and saved progress.
                </p>
                <Link
                  href="/auth?next=/draft"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-lg font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Sign In / Sign Up
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── MULTIPLAYER ── */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-gray-800/80"/>
            <span className="text-[9px] font-black tracking-[0.35em] text-gray-700 uppercase">Multiplayer</span>
            <div className="h-px flex-1 bg-gray-800/80"/>
          </div>

          {isSignedIn === false && (
            <Link href="/auth?next=/draft" className="block rounded-2xl border border-gray-800/50 bg-gray-900/30 p-3 hover:border-emerald-900/50 transition-all">
              <div className="opacity-35 pointer-events-none select-none space-y-2">
                <div className="w-full py-3 px-4 rounded-xl border border-emerald-700/50 text-sm font-bold text-emerald-400 flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  Create Room
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-800/80 border border-gray-700/40 rounded-xl px-4 py-3 text-sm font-mono text-white/30 tracking-widest uppercase">
                    Enter Room Code
                  </div>
                  <div className="px-5 py-3 rounded-xl bg-sky-700/60 text-white/50 text-sm font-bold">Join</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600">
                🔒 Sign in to create or join multiplayer rooms
              </div>
            </Link>
          )}

          {isSignedIn === true && onCreateRoom && onJoinRoom && (
            <div className="space-y-2">
              <button
                onClick={() => onCreateRoom(currentSettings())}
                className="w-full py-3 px-4 rounded-xl border border-emerald-700/40 text-sm font-bold text-emerald-500 hover:text-emerald-300 hover:border-emerald-600/60 hover:bg-emerald-950/20 flex items-center justify-center gap-2 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                Create Room
              </button>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); }}
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                  placeholder="ENTER ROOM CODE"
                  maxLength={6}
                  className="flex-1 bg-gray-800/70 border border-gray-700/50 rounded-xl px-4 py-3 text-sm font-mono font-bold text-white placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-sky-500/60 tracking-widest uppercase"
                />
                <button
                  onClick={handleJoin}
                  disabled={joiningRoom}
                  className="px-5 py-3 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                  {joiningRoom ? "…" : "Join"}
                </button>
              </div>
              {joinError && <div className="text-red-400 text-xs text-center">{joinError}</div>}
            </div>
          )}
        </div>
      </div>

      {/* ── HOW TO PLAY MODAL ── */}
      {showHowToPlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setShowHowToPlay(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-700/60 bg-gray-950 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-gray-800/60 bg-gray-950 rounded-t-2xl">
              <h2 className="text-base font-black text-white">How to Play</h2>
              <button onClick={() => setShowHowToPlay(false)} className="text-gray-600 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-2">
              {[
                { n: 1, title: "Spin the wheel", desc: "Each spin lands on a random English top-flight club from a real FIFA season." },
                { n: 2, title: "Pick a player", desc: "Choose one player from that club's roster and slot them into your formation." },
                { n: 3, title: "Build your XI", desc: "Keep spinning and picking until all 11 positions are filled." },
                { n: 4, title: "Fight for the Title", desc: "Play out a full 38-game league season and attempt to break worldwide records (Hall of Fame)." },
                { n: 5, title: "Evolve Your Squad", desc: "Receive upgrades, replace and transfer in new players, and prepare for the next season." },
                { n: 6, title: "Build Your Legacy", desc: "You have 5 seasons to win as much as you can and build your ultimate squad. Have Fun!" },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-4 py-4 border-b border-gray-800/40 last:border-b-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-sm font-black text-white shrink-0">
                    {step.n}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">{step.title}</div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
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
