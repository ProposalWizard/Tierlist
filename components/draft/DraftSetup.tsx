"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ObjectivesToast from "@/components/ObjectivesToast";
import type { DraftSettings } from "@/app/draft/page";
import DraftNavCards from "./DraftNavCards";
import { formatSeasonYear } from "./formations";

// Framing for the hero photo. x/y are backgroundPosition percentages and zoom
// scales out from that same point, so panning and zooming share one focal point.
// Change these numbers to reframe the image for everyone.
const HERO_IMG = { x: 34, y: 42, zoom: 1.04 };

function TeamNameInput({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [localValue, setLocalValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalValue(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function save() {
    const v = localValue.trim();
    if (v) onChange(v); else setLocalValue(value);
    setEditing(false);
  }

  return (
    <div className="mb-3 sm:mb-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm sm:text-base font-black uppercase italic tracking-tight leading-none">
          <span className="text-white">YOUR </span>
          <span className="text-cyan-400">TEAM</span>
          <span className="text-white"> NAME</span>
        </h2>
        <span className="text-white/30 font-black text-sm select-none">{">>>"}</span>
      </div>

      {/* Gradient-border card */}
      <div
        className="p-[1.5px] rounded-xl"
        style={{ background: "linear-gradient(110deg,#06b6d4 0%,#7c3aed 55%,#06b6d4 100%)" }}
      >
        <div className="bg-[#060c18] rounded-[10px] flex items-center gap-3 px-3 sm:px-4 py-3">
          {/* Jersey icon */}
          <div className="shrink-0 w-11 h-12">
            <svg viewBox="0 0 56 62" fill="none" className="w-full h-full drop-shadow-[0_2px_10px_rgba(59,130,246,0.55)]">
              <path d="M18 5 L2 17 L10 21 L10 55 L46 55 L46 21 L54 17 L38 5 Q33 10 28 10 Q23 10 18 5 Z" fill="#1e3a8a" />
              <path d="M18 5 Q23 10 28 10 Q33 10 38 5" fill="none" stroke="#60a5fa" strokeWidth="1.8" />
              <path d="M2 17 L10 21" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M54 17 L46 21" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M21 13 C20 24 20 36 21 46" stroke="rgba(255,255,255,0.1)" strokeWidth="5" strokeLinecap="round" />
              <text x="28" y="41" textAnchor="middle" fill="white" fontSize="15" fontWeight="900" fontFamily="system-ui,sans-serif">10</text>
            </svg>
          </div>

          {/* Name display / input */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                ref={inputRef}
                type="text"
                value={localValue}
                onChange={e => setLocalValue(e.target.value.slice(0, 50))}
                onBlur={save}
                onKeyDown={e => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") { setLocalValue(value); setEditing(false); }
                }}
                className="w-full bg-transparent text-base sm:text-lg font-black italic text-white placeholder-white/30 focus:outline-none border-b border-cyan-400/50 pb-0.5"
                placeholder="KNOWITBALL FC"
                maxLength={50}
              />
            ) : (
              <span className="text-base sm:text-lg font-black italic text-white truncate block">
                {localValue || "KNOWITBALL FC"}
              </span>
            )}
          </div>

          {/* Edit button */}
          <button
            onClick={() => setEditing(e => !e)}
            style={{ touchAction: "manipulation" }}
            className="shrink-0 w-9 h-9 rounded-full border border-cyan-400/50 flex items-center justify-center text-cyan-400 hover:border-cyan-300 hover:text-cyan-300 hover:bg-cyan-400/10 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Subtext */}
      <div className="flex items-center gap-1.5 mt-2">
        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L15 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L9 8.26L12 2Z" opacity="0.6" />
        </svg>
        <p className="text-[10px] text-gray-500">Shown in league tables across all your drafts</p>
      </div>
    </div>
  );
}

function SectionHeader({ icon, label1, label2 }: { icon: ReactNode; label1: string; label2: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="text-cyan-400 shrink-0">{icon}</div>
      <span className="text-sm font-black uppercase italic tracking-tight leading-none">
        <span className="text-white">{label1} </span>
        <span className="text-cyan-400">{label2}</span>
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/30 to-transparent" />
    </div>
  );
}

function SettingsBtn({
  selected,
  onClick,
  children,
  accent = "teal",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  accent?: "teal" | "amber" | "purple" | "sky";
}) {
  const gradMap: Record<string, string> = {
    teal: "linear-gradient(135deg,#0d9488 0%,#06b6d4 100%)",
    amber: "linear-gradient(135deg,#b45309 0%,#f59e0b 100%)",
    purple: "linear-gradient(135deg,#6d28d9 0%,#a855f7 100%)",
    sky: "linear-gradient(135deg,#0369a1 0%,#38bdf8 100%)",
  };
  const shadowMap: Record<string, string> = {
    teal: "0 4px 18px rgba(6,182,212,0.35)",
    amber: "0 4px 18px rgba(245,158,11,0.35)",
    purple: "0 4px 18px rgba(168,85,247,0.35)",
    sky: "0 4px 18px rgba(56,189,248,0.35)",
  };
  return (
    <button
      onClick={onClick}
      style={selected ? { background: gradMap[accent], boxShadow: shadowMap[accent] } : undefined}
      className={`relative flex-1 py-3 px-3 rounded-xl text-left transition-all duration-200 ${
        selected
          ? "text-white"
          : "bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.07]"
      }`}
    >
      {selected && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/25 flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
      {children}
    </button>
  );
}

interface Props {
  onStart: (settings: DraftSettings) => void;
  onCreateRoom?: (settings: DraftSettings) => void;
  onJoinRoom?: (code: string, settings: DraftSettings) => void;
  teamName?: string;
  onTeamNameChange?: (name: string) => void;
}

export default function DraftSetup({ onStart, onCreateRoom, onJoinRoom, teamName, onTeamNameChange }: Props) {
  const formation = "4-3-3"; // picked on the formation screen after Start Draft
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
    <div className="flex flex-col items-center justify-center min-h-screen px-3 sm:px-4 py-6 relative">
      <ObjectivesToast />
      <div className="max-w-lg w-full">
        {/* Hero card — replaces the old centered text header. The title sits at the
            top, the description at the bottom, and the gradients keep both legible
            over the photo. */}
        <div
          className="relative overflow-hidden rounded-2xl mb-3 sm:mb-4 border border-white/5"
          style={{ background: "#07090d", aspectRatio: "5 / 4" }}
        >
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
          <div className="relative h-full flex flex-col p-4 pt-3">
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
            <p className="mt-auto text-[10px] sm:text-xs text-gray-200 leading-snug max-w-[68%] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              Draft your squad. Play seasons in multiple competitions. Try to win the league and break records, grow your squad and make history.
            </p>
          </div>
        </div>

        {/* How to Play + History/HoF (description now lives inside the hero) */}
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

        {/* Team Name */}
        {onTeamNameChange && (
          <TeamNameInput
            value={teamName ?? ""}
            onChange={onTeamNameChange}
          />
        )}

        {/* Era Range */}
        <div className="mb-4 sm:mb-5">
          <SectionHeader
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label1="ERA"
            label2="RANGE"
          />
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Start Season card */}
            <div className="flex-1 relative">
              <div className="p-[1.5px] rounded-xl" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                <div className="bg-[#09060f] rounded-[10px] px-3 py-2.5">
                  <div className="text-[9px] font-bold tracking-widest text-purple-400 uppercase mb-1">Start Season</div>
                  <div className="text-lg sm:text-xl font-black text-white leading-none mb-1.5 tabular-nums">
                    {formatSeasonYear(eraStart)}
                  </div>
                  <div className="flex items-center justify-between">
                    <svg className="w-3 h-3 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <svg className="w-3 h-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <select
                value={eraStart}
                onChange={e => setEraStart(Number(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              >
                {Array.from({ length: 20 }, (_, i) => 2007 + i).map(y => (
                  <option key={y} value={y}>{formatSeasonYear(y)}</option>
                ))}
              </select>
            </div>

            {/* TO separator */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-px h-3 bg-white/15" />
              <span className="text-[9px] font-black tracking-widest text-white/30 uppercase">TO</span>
              <div className="w-px h-3 bg-white/15" />
            </div>

            {/* End Season card */}
            <div className="flex-1 relative">
              <div className="p-[1.5px] rounded-xl" style={{ background: "linear-gradient(135deg,#0284c7,#06b6d4)" }}>
                <div className="bg-[#010d18] rounded-[10px] px-3 py-2.5">
                  <div className="text-[9px] font-bold tracking-widest text-cyan-400 uppercase mb-1">End Season</div>
                  <div className="text-lg sm:text-xl font-black text-white leading-none mb-1.5 tabular-nums">
                    {formatSeasonYear(eraEnd)}
                  </div>
                  <div className="flex items-center justify-between">
                    <svg className="w-3 h-3 text-cyan-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <svg className="w-3 h-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <select
                value={eraEnd}
                onChange={e => setEraEnd(Number(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              >
                {Array.from({ length: 20 }, (_, i) => 2007 + i).map(y => (
                  <option key={y} value={y}>{formatSeasonYear(y)}</option>
                ))}
              </select>
            </div>
          </div>
          {eraStart > eraEnd && (
            <div className="mt-2 bg-red-900/20 border border-red-800/50 rounded-lg p-2 text-xs text-red-400 text-center">
              Start year must be before or equal to end year
            </div>
          )}
        </div>

        {/* Game Mode */}
        <div className="mb-4 sm:mb-5">
          <SectionHeader
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="7" width="20" height="11" rx="3" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h2m-1-1v2" />
                <circle cx="15" cy="11.5" r="0.8" fill="currentColor" stroke="none" />
                <circle cx="17" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
              </svg>
            }
            label1="GAME"
            label2="MODE"
          />
          <div className="flex gap-2">
            <SettingsBtn selected={mode === "normal"} onClick={() => setMode("normal")} accent="teal">
              <div className="text-xs font-black italic uppercase leading-none mb-1">Normal</div>
              <div className="text-[9px] opacity-70 leading-snug">Rated as that season</div>
            </SettingsBtn>
            <SettingsBtn selected={mode === "prime"} onClick={() => setMode("prime")} accent="amber">
              <div className="text-xs font-black italic uppercase leading-none mb-1">Prime</div>
              <div className="text-[9px] opacity-70 leading-snug">Best-ever rating</div>
            </SettingsBtn>
          </div>
        </div>

        {/* Draft Order */}
        <div className="mb-4 sm:mb-5">
          <SectionHeader
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            label1="DRAFT"
            label2="ORDER"
          />
          <div className="flex gap-2">
            <SettingsBtn selected={draftOrder === "club-first"} onClick={() => setDraftOrder("club-first")} accent="teal">
              <div className="text-xs font-black italic uppercase leading-none mb-1">Club First</div>
              <div className="text-[9px] opacity-70 leading-snug">Pick player, choose slot</div>
            </SettingsBtn>
            <SettingsBtn selected={draftOrder === "position-first"} onClick={() => setDraftOrder("position-first")} accent="sky">
              <div className="text-xs font-black italic uppercase leading-none mb-1">Position First</div>
              <div className="text-[9px] opacity-70 leading-snug">Fill each slot in order</div>
            </SettingsBtn>
          </div>
        </div>

        {/* Rating Visibility */}
        <div className="mb-4 sm:mb-5">
          <SectionHeader
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
            label1="RATING"
            label2="VISIBILITY"
          />
          <div className="flex gap-2">
            <SettingsBtn selected={!hiddenRatings} onClick={() => setHiddenRatings(false)} accent="teal">
              <div className="text-xs font-black italic uppercase leading-none mb-1">Normal</div>
              <div className="text-[9px] opacity-70 leading-snug">Ratings visible</div>
            </SettingsBtn>
            <SettingsBtn selected={hiddenRatings} onClick={() => setHiddenRatings(true)} accent="purple">
              <div className="text-xs font-black italic uppercase leading-none mb-1">Hidden</div>
              <div className="text-[9px] opacity-70 leading-snug">Revealed after pick</div>
            </SettingsBtn>
          </div>
        </div>

        {/* Re-spins */}
        <div className="mb-5 sm:mb-6">
          <SectionHeader
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
            label1="RE-SPINS"
            label2="PER DRAFT"
          />
          <div className="flex gap-2">
            {([3, 1, 0] as const).map(n => (
              <SettingsBtn key={n} selected={respins === n} onClick={() => setRespins(n)} accent="teal">
                <div className="text-xs font-black italic uppercase leading-none mb-1">
                  {n === 0 ? "None" : n === 1 ? "1 Re-spin" : "3 Re-spins"}
                </div>
                <div className="text-[9px] opacity-70 leading-snug">
                  {n === 0 ? "No 2nd chances" : n === 1 ? "One total" : "Three total"}
                </div>
              </SettingsBtn>
            ))}
          </div>
        </div>

        {/* Start Draft button */}
        <button
          onClick={() => onStart({ formation, eraStart, eraEnd: Math.max(eraStart, eraEnd), mode, draftOrder, respins, hiddenRatings })}
          disabled={eraStart > eraEnd}
          className="group relative w-full rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: "linear-gradient(115deg,#059669 0%,#0d9488 45%,#0891b2 100%)",
            boxShadow: "0 8px 32px rgba(6,182,212,0.35), 0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          <div className="absolute inset-0" style={{ background: "linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.07) 50%,transparent 70%)" }} />
          <div className="relative flex items-center justify-center px-5 py-4 gap-4">
            <div className="shrink-0">
              {/* Replace the filename below once you've added the image to /public */}
              <img
                src="/ball.png"
                alt=""
                className="w-11 h-11 object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
              />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-black italic text-white uppercase leading-none tracking-tight">
                Start Draft<span className="ml-1.5 inline-block transition-transform group-hover:translate-x-1">→</span>
              </div>
              {teamName && (
                <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1 max-w-[200px] truncate">
                  {teamName}
                </div>
              )}
            </div>
          </div>
        </button>

        <p className="text-center text-white/25 text-[10px] mt-3 tracking-widest uppercase">
          14 spins · 11 starters + 3 subs · 38 matches
        </p>

        {/* Sign-in prompt — placed BELOW Start Draft so new/guest users see the
            game as the primary action, not a sign-up wall. */}
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

        {/* Multiplayer — locked preview for signed-out users so they can see it exists */}
        {isSignedIn === false && (
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-gray-800" />
              <label className="text-xs font-bold tracking-widest text-white uppercase">
                Multiplayer
              </label>
              <div className="h-px flex-1 bg-gray-800" />
            </div>
            <Link
              href="/auth?next=/draft"
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

        {/* Multiplayer */}
        {isSignedIn === true && onCreateRoom && onJoinRoom && (
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-gray-800" />
              <label className="text-xs font-bold tracking-widest text-white uppercase">
                Multiplayer
              </label>
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
              {joinError && (
                <div className="text-red-400 text-xs text-center">{joinError}</div>
              )}
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
                { n: 2, title: "Pick a player", desc: "Choose one player from that club’s roster and slot them into your formation." },
                { n: 3, title: "Build your XI", desc: "Keep spinning and picking until all 11 positions are filled." },
                { n: 4, title: "Fight for the Title", desc: "Play out a full 38-game league season and attempt to break worldwide records (Hall of Fame)." },
                { n: 5, title: "Evolve Your Squad", desc: "Receive upgrades, replace and transfer in new players, and prepare for the next season." },
                { n: 6, title: "Build Your Legacy", desc: "You have 5 seasons to win as much as you can and build your ultimate squad. Have Fun!" },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-4 py-4 border-b border-gray-800/50 last:border-b-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-black text-white shrink-0">
                    {step.n}
                  </div>
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
