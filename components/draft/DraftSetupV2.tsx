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
      className="flex-1 min-w-0 bg-transparent text-base font-black text-white placeholder-gray-700 focus:outline-none"
    />
  );
}

function MiniPitch({ slots, selected }: { slots: typeof FORMATIONS[0]["slots"]; selected: boolean }) {
  return (
    <svg viewBox="0 0 32 44" className="w-full h-full">
      {/* Pitch background */}
      <rect x="0" y="0" width="32" height="44" rx="2" fill={selected ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)"}/>
      {/* Outer border */}
      <rect x="1.5" y="1.5" width="29" height="41" rx="1.5" fill="none" stroke={selected ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.1)"} strokeWidth="0.7"/>
      {/* Halfway line */}
      <line x1="1.5" y1="22" x2="30.5" y2="22" stroke={selected ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.07)"} strokeWidth="0.5"/>
      {/* Centre circle */}
      <circle cx="16" cy="22" r="5.5" fill="none" stroke={selected ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.07)"} strokeWidth="0.5"/>
      {/* Top penalty area */}
      <rect x="9" y="1.5" width="14" height="7" fill="none" stroke={selected ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)"} strokeWidth="0.4"/>
      {/* Bottom penalty area */}
      <rect x="9" y="35.5" width="14" height="7" fill="none" stroke={selected ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)"} strokeWidth="0.4"/>
      {/* Player dots */}
      {slots.map((slot, i) => (
        <circle
          key={i}
          cx={1.5 + (slot.x / 100) * 29}
          cy={1.5 + (slot.y / 100) * 41}
          r={selected ? 2.2 : 2}
          fill={selected ? "#10b981" : "#6b7280"}
          opacity={selected ? 1 : 0.7}
        />
      ))}
    </svg>
  );
}

function LargePitch({ formation }: { formation: typeof FORMATIONS[0] }) {
  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0d3d1a 0%, #0a2e14 40%, #072010 100%)",
        border: "1px solid rgba(16,185,129,0.2)",
      }}
    >
      {/* Pitch outer boundary */}
      <div className="absolute inset-[6%] border border-white/10 rounded-sm"/>
      {/* Halfway line */}
      <div className="absolute left-[6%] right-[6%] top-1/2 h-px bg-white/10"/>
      {/* Centre circle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[26%] aspect-square rounded-full border border-white/10"/>
      {/* Top penalty box */}
      <div className="absolute left-[25%] top-[6%] right-[25%] h-[13%] border-x border-b border-white/8"/>
      {/* Bottom penalty box */}
      <div className="absolute left-[25%] bottom-[6%] right-[25%] h-[13%] border-x border-t border-white/8"/>

      {/* Player positions */}
      {formation.slots.map((slot, i) => {
        const renderY = slot.y >= 88 ? slot.y - 3 : slot.y;
        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${slot.x}%`, top: `${renderY}%` }}
          >
            <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-500/50 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <span className="text-[8px] font-black text-emerald-300 leading-none">{slot.label}</span>
            </div>
          </div>
        );
      })}

      {/* Formation name at bottom */}
      <div className="absolute bottom-2 inset-x-0 text-center">
        <span className="text-[9px] font-black tracking-[0.2em] text-white/25 uppercase">{formation.name}</span>
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
    if (!code || code.length !== 6) { setJoinError("Enter a 6-character room code"); return; }
    setJoiningRoom(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/draft/rooms/${code}/join`, { method: "POST" });
      if (!res.ok) { const text = await res.text(); setJoinError(text || "Room not found"); return; }
      onJoinRoom?.(code, currentSettings());
    } catch { setJoinError("Failed to connect"); }
    finally { setJoiningRoom(false); }
  };

  return (
    <div className="min-h-screen bg-[#080b0f] text-white">
      <ObjectivesToast />

      {/* ═══════════════ HERO ═══════════════ */}
      <div className="relative overflow-hidden">
        {/* Pitch-lines background pattern */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.7) 39px,rgba(255,255,255,0.7) 40px)",
            }}
          />
          {/* Green glow at top */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-emerald-600/10 blur-3xl"/>
        </div>

        <div className="relative max-w-xl mx-auto px-4 pt-12 pb-8 text-center">
          {/* Label */}
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-emerald-500/70"/>
            <span className="text-[11px] font-black tracking-[0.45em] text-emerald-400 uppercase">Knowitball</span>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-emerald-500/70"/>
          </div>

          {/* Main title */}
          <div className="mb-5">
            <div className="text-[2.8rem] sm:text-6xl font-black tracking-tight leading-[0.9] text-white">
              PREMIER LEAGUE
            </div>
            <div
              className="text-[5rem] sm:text-8xl font-black tracking-tight leading-[0.9]"
              style={{
                background: "linear-gradient(180deg, #6ee7b7 0%, #10b981 45%, #059669 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              DRAFT
            </div>
          </div>

          <p className="text-gray-500 text-sm leading-relaxed max-w-[280px] mx-auto mb-6">
            Draft your squad from real PL rosters. Play a 38-game season. Break records. Build your legacy.
          </p>

          <button
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to Play
          </button>
        </div>
      </div>

      {/* ═══════════════ CONTENT ═══════════════ */}
      <div className="max-w-xl mx-auto px-4 pb-14">

        {/* ── History & Hall of Fame ── */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Link
            href={isSignedIn === false ? "/auth?next=/draft/history" : "/draft/history"}
            className="group flex items-center gap-3 rounded-2xl px-4 py-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)" }}>
              {isSignedIn === false ? (
                <span className="text-lg">🔒</span>
              ) : (
                <svg className="w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-white leading-tight">History</div>
              <div className="text-xs text-gray-500 leading-tight">&amp; Achievements</div>
            </div>
            <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>

          <Link
            href={isSignedIn === false ? "/auth?next=/draft/records" : "/draft/records"}
            className="group flex items-center gap-3 rounded-2xl px-4 py-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.2)" }}>
              {isSignedIn === false ? (
                <span className="text-lg">🔒</span>
              ) : (
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-amber-300 leading-tight">Hall of Fame</div>
              <div className="text-xs text-gray-500 leading-tight">World Records</div>
            </div>
            <svg className="w-4 h-4 text-gray-700 group-hover:text-amber-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>

        {/* ── Team Name ── */}
        {onTeamNameChange && (
          <div className="rounded-2xl px-4 py-3.5 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[10px] font-black tracking-[0.3em] text-gray-600 uppercase mb-3">Your Team</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <TeamNameInput value={teamName ?? ""} onChange={onTeamNameChange} />
              <svg className="w-4 h-4 text-gray-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
          </div>
        )}

        {/* ── Formation ── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[10px] font-black tracking-[0.3em] text-gray-600 uppercase mb-3">Formation</div>
          <div className="flex gap-3">
            {/* Grid of formation buttons */}
            <div className="flex-1 grid grid-cols-3 gap-2">
              {FORMATIONS.map(f => (
                <button
                  key={f.name}
                  onClick={() => setFormation(f.name)}
                  className={`relative rounded-xl overflow-hidden transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] ${
                    formation === f.name ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-[#080b0f]" : ""
                  }`}
                  style={{
                    background: formation === f.name ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${formation === f.name ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.07)"}`,
                  }}
                >
                  <div className="p-2 pb-1.5">
                    <div className="aspect-[32/44] w-full">
                      <MiniPitch slots={f.slots} selected={formation === f.name} />
                    </div>
                    <div className={`text-[11px] font-black text-center mt-1.5 ${formation === f.name ? "text-emerald-400" : "text-gray-500"}`}>
                      {f.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Large pitch preview */}
            <div className="w-[100px] sm:w-[120px] shrink-0">
              <LargePitch formation={selectedFormation} />
            </div>
          </div>
        </div>

        {/* ── Era / Mode / Order ── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="grid grid-cols-3 gap-3">

            {/* Era Range */}
            <div>
              <div className="text-[10px] font-black tracking-[0.25em] text-gray-600 uppercase mb-2.5">Era Range</div>
              <div className="space-y-1.5">
                <div className="relative">
                  <select
                    value={eraStart}
                    onChange={e => setEraStart(Number(e.target.value))}
                    className="w-full appearance-none rounded-xl px-3 py-2.5 text-[12px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition pr-6"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {Array.from({ length: 20 }, (_, i) => 2007 + i).map(y => (
                      <option key={y} value={y} className="bg-gray-900">{y - 1}/{String(y % 100).padStart(2, "0")}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </div>
                </div>
                <div className="text-center text-[10px] font-black text-gray-700 tracking-widest uppercase">to</div>
                <div className="relative">
                  <select
                    value={eraEnd}
                    onChange={e => setEraEnd(Number(e.target.value))}
                    className="w-full appearance-none rounded-xl px-3 py-2.5 text-[12px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition pr-6"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {Array.from({ length: 20 }, (_, i) => 2007 + i).map(y => (
                      <option key={y} value={y} className="bg-gray-900">{y - 1}/{String(y % 100).padStart(2, "0")}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Game Mode */}
            <div>
              <div className="text-[10px] font-black tracking-[0.25em] text-gray-600 uppercase mb-2.5">Mode</div>
              <div className="space-y-2">
                <button
                  onClick={() => setMode("normal")}
                  className="w-full rounded-xl px-3 py-2.5 text-[12px] font-black text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: mode === "normal" ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${mode === "normal" ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: mode === "normal" ? "#fff" : "#6b7280",
                  }}
                >
                  <div className="font-black">Normal</div>
                  <div className={`text-[9px] font-medium mt-0.5 ${mode === "normal" ? "text-emerald-300/70" : "text-gray-700"}`}>Season ratings</div>
                </button>
                <button
                  onClick={() => setMode("prime")}
                  className="w-full rounded-xl px-3 py-2.5 text-[12px] font-black text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: mode === "prime" ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${mode === "prime" ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: mode === "prime" ? "#fde68a" : "#6b7280",
                  }}
                >
                  <div className="font-black">Prime ✦</div>
                  <div className={`text-[9px] font-medium mt-0.5 ${mode === "prime" ? "text-amber-300/60" : "text-gray-700"}`}>Career-best OVR</div>
                </button>
              </div>
            </div>

            {/* Draft Order */}
            <div>
              <div className="text-[10px] font-black tracking-[0.25em] text-gray-600 uppercase mb-2.5">Order</div>
              <div className="space-y-2">
                <button
                  onClick={() => setDraftOrder("club-first")}
                  className="w-full rounded-xl px-3 py-2.5 text-[12px] font-black text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: draftOrder === "club-first" ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${draftOrder === "club-first" ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: draftOrder === "club-first" ? "#fff" : "#6b7280",
                  }}
                >
                  <div className="font-black">Club First</div>
                  <div className={`text-[9px] font-medium mt-0.5 ${draftOrder === "club-first" ? "text-emerald-300/70" : "text-gray-700"}`}>Spin → pick</div>
                </button>
                <button
                  onClick={() => setDraftOrder("position-first")}
                  className="w-full rounded-xl px-3 py-2.5 text-[12px] font-black text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: draftOrder === "position-first" ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${draftOrder === "position-first" ? "rgba(56,189,248,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: draftOrder === "position-first" ? "#7dd3fc" : "#6b7280",
                  }}
                >
                  <div className="font-black">Position</div>
                  <div className={`text-[9px] font-medium mt-0.5 ${draftOrder === "position-first" ? "text-sky-300/60" : "text-gray-700"}`}>Slot by slot</div>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ── Ratings + Re-Spins ── */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="grid grid-cols-2 gap-4">

            {/* Rating Visibility */}
            <div>
              <div className="text-[10px] font-black tracking-[0.25em] text-gray-600 uppercase mb-2.5">Ratings</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setHiddenRatings(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: !hiddenRatings ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${!hiddenRatings ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: !hiddenRatings ? "#fff" : "#6b7280",
                  }}
                >
                  Visible
                </button>
                <button
                  onClick={() => setHiddenRatings(true)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: hiddenRatings ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${hiddenRatings ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: hiddenRatings ? "#d8b4fe" : "#6b7280",
                  }}
                >
                  Hidden
                </button>
              </div>
            </div>

            {/* Re-spins */}
            <div>
              <div className="text-[10px] font-black tracking-[0.25em] text-gray-600 uppercase mb-2.5">Re-Spins</div>
              <div className="flex gap-2">
                {([3, 1, 0] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setRespins(n)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: respins === n ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${respins === n ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: respins === n ? "#fff" : "#6b7280",
                    }}
                  >
                    {n === 0 ? "×0" : n === 1 ? "×1" : "×3"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Era warning */}
        {eraStart > eraEnd && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm text-red-400 text-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            Start year must be before or equal to end year
          </div>
        )}

        {/* ── Start Draft ── */}
        <button
          onClick={() => onStart(currentSettings())}
          disabled={eraStart > eraEnd}
          className="w-full py-5 rounded-2xl text-2xl font-black text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 mb-3"
          style={{
            background: "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)",
            boxShadow: "0 8px 32px -6px rgba(16,185,129,0.5), 0 0 0 1px rgba(16,185,129,0.2)",
          }}
        >
          ⚽ Start Draft →
        </button>

        {/* Stats strip */}
        <div className="flex items-center justify-center mb-6">
          {[
            { value: "14", label: "SPINS" },
            { value: "11", label: "STARTERS" },
            { value: "+3", label: "SUBS" },
            { value: "38", label: "MATCHES" },
          ].map((stat, i) => (
            <div key={i} className="flex items-center">
              {i > 0 && <div className="w-px h-8 mx-5" style={{ background: "rgba(255,255,255,0.08)" }}/>}
              <div className="text-center">
                <div className="text-2xl font-black text-white leading-none">{stat.value}</div>
                <div className="text-[10px] font-black text-gray-600 tracking-widest mt-0.5">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Sign-in prompt ── */}
        {isSignedIn === false && (
          <div className="rounded-2xl px-4 py-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">🔒</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-white mb-1">Sign in to save your history</div>
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                  Play as a guest right now. Sign in for multiplayer, Hall of Fame entries, and saved progress.
                </p>
                <Link
                  href="/auth?next=/draft"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
                >
                  Sign In / Sign Up
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Multiplayer ── */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }}/>
            <span className="text-[10px] font-black tracking-[0.35em] text-gray-700 uppercase">Multiplayer</span>
            <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }}/>
          </div>

          {isSignedIn === false && (
            <Link href="/auth?next=/draft" className="block rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="opacity-30 pointer-events-none select-none space-y-2">
                <div className="w-full py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2" style={{ border: "1px solid rgba(16,185,129,0.4)", color: "#10b981" }}>
                  + Create Room
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-xl px-4 py-3.5 text-sm font-mono font-bold tracking-widest uppercase text-gray-600" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    Enter Room Code
                  </div>
                  <div className="px-5 py-3.5 rounded-xl text-sm font-black text-white" style={{ background: "rgba(56,189,248,0.5)" }}>Join</div>
                </div>
              </div>
              <div className="mt-3 text-center text-xs font-black text-emerald-700">🔒 Sign in to play multiplayer</div>
            </Link>
          )}

          {isSignedIn === true && onCreateRoom && onJoinRoom && (
            <div className="space-y-2">
              <button
                onClick={() => onCreateRoom(currentSettings())}
                className="w-full py-3.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ border: "1px solid rgba(16,185,129,0.35)", color: "#10b981", background: "rgba(16,185,129,0.06)" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                + Create Room
              </button>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); }}
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                  placeholder="ENTER ROOM CODE"
                  maxLength={6}
                  className="flex-1 rounded-xl px-4 py-3.5 text-sm font-mono font-black text-white placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500/40 tracking-widest uppercase transition"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <button
                  onClick={handleJoin}
                  disabled={joiningRoom}
                  className="px-5 py-3.5 rounded-xl text-sm font-black text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
                  style={{ background: "#0ea5e9" }}
                >
                  {joiningRoom ? "…" : "Join"}
                </button>
              </div>
              {joinError && <div className="text-red-400 text-xs text-center">{joinError}</div>}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════ HOW TO PLAY MODAL ═══════════════ */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setShowHowToPlay(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }} onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 rounded-t-2xl" style={{ background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
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
                <div key={step.n} className="flex items-start gap-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-black text-white shrink-0">{step.n}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-white">{step.title}</div>
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
