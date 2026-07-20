"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { FORMATIONS } from "./formations";
import { createClient } from "@/lib/supabase/client";
import ObjectivesToast from "@/components/ObjectivesToast";
import type { DraftSettings } from "@/app/draft/page";

const FORMATION_STYLES: Record<string, string> = {
  "4-4-2":   "BALANCED",
  "4-3-3":   "ATTACKING",
  "4-2-3-1": "POSSESSION",
  "3-5-2":   "MIDFIELD",
  "3-4-3":   "ATTACKING",
  "4-1-4-1": "DEFENSIVE",
  "5-3-2":   "DEFENSIVE",
};

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
      className="flex-1 min-w-0 bg-transparent text-base font-bold text-white placeholder-gray-700 focus:outline-none"
    />
  );
}

// Formation dots — no pitch lines, just player dots
function FormationDots({ slots, active }: { slots: typeof FORMATIONS[0]["slots"]; active: boolean }) {
  return (
    <svg viewBox="0 0 36 48" className="w-full h-full">
      {slots.map((slot, i) => (
        <circle
          key={i}
          cx={2 + (slot.x / 100) * 32}
          cy={2 + (slot.y / 100) * 44}
          r="3"
          fill={active ? "#10b981" : "#374151"}
        />
      ))}
    </svg>
  );
}

// Large formation pitch shown on the right
function FormationPitch({ formation }: { formation: typeof FORMATIONS[0] }) {
  const style = FORMATION_STYLES[formation.name] ?? "BALANCED";
  return (
    <div className="flex flex-col">
      <div
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0d3d1e 0%, #0a2e15 50%, #071d0d 100%)" }}
      >
        {/* Pitch markings */}
        <div className="absolute inset-[6%] border border-white/15 rounded-sm" />
        <div className="absolute left-[6%] right-[6%] top-1/2 h-px bg-white/15" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[26%] aspect-square rounded-full border border-white/15" />
        <div className="absolute left-[24%] top-[6%] right-[24%] h-[13%] border-x border-b border-white/10" />
        <div className="absolute left-[24%] bottom-[6%] right-[24%] h-[13%] border-x border-t border-white/10" />
        {/* Players */}
        {formation.slots.map((slot, i) => {
          const renderY = slot.y >= 88 ? slot.y - 3 : slot.y;
          return (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${slot.x}%`, top: `${renderY}%` }}
            >
              <div className="w-8 h-8 rounded-full bg-emerald-700/40 border-2 border-white/60 flex items-center justify-center shadow-md">
                <span className="text-[8px] font-black text-white leading-none">{slot.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      {/* Formation name + style */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-sm font-black text-white">{formation.name}</span>
        <span className="text-[10px] font-black text-emerald-400 tracking-wider">{style}</span>
      </div>
    </div>
  );
}

// Reusable option card used for Mode, Order, Ratings, Re-Spins
function OptionCard({
  active,
  color = "green",
  title,
  desc,
  onClick,
}: {
  active: boolean;
  color?: "green" | "amber" | "sky" | "purple";
  title: string;
  desc: string;
  onClick: () => void;
}) {
  const activeStyles: Record<string, { bg: string; border: string; titleColor: string; descColor: string }> = {
    green:  { bg: "rgba(16,185,129,0.18)",  border: "rgba(16,185,129,0.45)",  titleColor: "#fff",      descColor: "rgba(167,243,208,0.7)" },
    amber:  { bg: "rgba(251,191,36,0.15)",  border: "rgba(251,191,36,0.4)",   titleColor: "#fde68a",   descColor: "rgba(253,230,138,0.6)" },
    sky:    { bg: "rgba(56,189,248,0.15)",  border: "rgba(56,189,248,0.4)",   titleColor: "#7dd3fc",   descColor: "rgba(125,211,252,0.6)" },
    purple: { bg: "rgba(168,85,247,0.15)",  border: "rgba(168,85,247,0.4)",   titleColor: "#d8b4fe",   descColor: "rgba(216,180,254,0.6)" },
  };
  const s = activeStyles[color];
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-2 transition-all hover:scale-[1.02] active:scale-[0.97]"
      style={
        active
          ? { background: s.bg, border: `1px solid ${s.border}` }
          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }
      }
    >
      <div
        className="text-[11px] font-black leading-tight"
        style={{ color: active ? s.titleColor : "#9ca3af" }}
      >
        {title}
      </div>
      <div
        className="text-[8px] leading-tight mt-0.5"
        style={{ color: active ? s.descColor : "#4b5563" }}
      >
        {desc}
      </div>
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

export default function DraftSetupV2({ onStart, onCreateRoom, onJoinRoom, teamName, onTeamNameChange }: Props) {
  const [formation, setFormation]       = useState("4-3-3");
  const [eraStart, setEraStart]         = useState(2007);
  const [eraEnd, setEraEnd]             = useState(2026);
  const [mode, setMode]                 = useState<"normal" | "prime">("normal");
  const [draftOrder, setDraftOrder]     = useState<"position-first" | "club-first">("club-first");
  const [respins, setRespins]           = useState<0 | 1 | 3>(3);
  const [hiddenRatings, setHiddenRatings] = useState(false);
  const [isSignedIn, setIsSignedIn]     = useState<boolean | null>(null);
  const [joinCode, setJoinCode]         = useState("");
  const [joiningRoom, setJoiningRoom]   = useState(false);
  const [joinError, setJoinError]       = useState<string | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setIsSignedIn(!!user));
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
      if (!res.ok) { const t = await res.text(); setJoinError(t || "Room not found"); return; }
      onJoinRoom?.(code, currentSettings());
    } catch { setJoinError("Failed to connect"); }
    finally { setJoiningRoom(false); }
  };

  const years = Array.from({ length: 20 }, (_, i) => 2007 + i);
  const fmtYear = (y: number) => `${y - 1}/${String(y % 100).padStart(2, "0")}`;

  const selectCls = "w-full appearance-none rounded-xl px-2.5 py-2 text-[12px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition cursor-pointer bg-gray-800/60 border border-white/10";

  return (
    <div className="min-h-screen bg-[#07090d] text-white">
      <ObjectivesToast />

      {/* ══════════════════════════════ HERO ══════════════════════════════ */}
      <div className="relative overflow-hidden" style={{ minHeight: 260, background: "#07090d" }}>
        {/* Player image — right side, fades to dark on the left */}
        <div
          className="absolute right-0 top-0 bottom-0 w-[62%]"
          style={{
            backgroundImage: "url('/draft-hero.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center top",
          }}
        />
        {/* Gradient overlay: solid dark left → transparent right */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, #07090d 38%, #07090dcc 55%, #07090d66 70%, transparent 90%)" }}
        />

        {/* Text — left side */}
        <div className="relative px-4 pt-10 pb-7" style={{ maxWidth: "60%" }}>
          {/* KNOWITBALL label */}
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px w-5 bg-emerald-500/60" />
            <span className="text-[9px] font-black tracking-[0.45em] text-emerald-400 uppercase">Knowitball</span>
            <div className="h-px w-5 bg-emerald-500/60" />
          </div>

          {/* PREMIER LEAGUE */}
          <div className="font-black tracking-tight leading-[0.92] text-white uppercase" style={{ fontSize: "clamp(1.6rem, 8vw, 2.6rem)" }}>
            PREMIER<br />LEAGUE
          </div>

          {/* DRAFT */}
          <div
            className="font-black tracking-tight leading-[0.9] uppercase"
            style={{
              fontSize: "clamp(3rem, 16vw, 5rem)",
              background: "linear-gradient(180deg, #86efac 0%, #10b981 40%, #059669 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            DRAFT
          </div>

          {/* Description */}
          <p className="text-gray-400 text-[11px] leading-relaxed mt-3 mb-4">
            Draft your squad. Play seasons in multiple competitions. Try to win the league and break records, grow your squad and make history.
          </p>

          {/* How to Play */}
          <button
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-semibold text-gray-300 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to Play
          </button>
        </div>
      </div>

      {/* ═══════════════════════ CONTENT ═══════════════════════ */}
      <div className="max-w-xl mx-auto px-4 pb-14 space-y-3 pt-2">

        {/* ── History & Hall of Fame ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={isSignedIn === false ? "/auth?next=/draft/history" : "/draft/history"}
            className="group flex items-center gap-3 rounded-2xl px-4 py-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "#0e1520", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.18)" }}>
              {isSignedIn === false ? (
                <span className="text-lg">🔒</span>
              ) : (
                <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-white leading-tight">History &amp;</div>
              <div className="text-sm font-black text-white leading-tight">Achievements</div>
            </div>
            <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href={isSignedIn === false ? "/auth?next=/draft/records" : "/draft/records"}
            className="group flex items-center gap-3 rounded-2xl px-4 py-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "#0e1520", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.18)" }}>
              {isSignedIn === false ? <span className="text-lg">🔒</span> : <span className="text-2xl">🏆</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-amber-400 leading-tight">Hall of</div>
              <div className="text-sm font-black text-amber-400 leading-tight">Fame</div>
            </div>
            <svg className="w-4 h-4 text-gray-700 group-hover:text-amber-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* ── Your Team Name ── */}
        {onTeamNameChange && (
          <div className="rounded-2xl" style={{ background: "#0e1520", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="px-4 pt-3 pb-2">
              <div className="text-[10px] font-black tracking-[0.3em] text-gray-600 uppercase mb-3">Your Team Name</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)" }}>
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
            <div className="px-4 pb-3">
              <p className="text-[11px] text-gray-600">Shown in league tables across all your drafts</p>
            </div>
          </div>
        )}

        {/* ── Choose Formation ── */}
        <div className="rounded-2xl p-4" style={{ background: "#0e1520", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[10px] font-black tracking-[0.3em] text-emerald-400 uppercase mb-3">Choose Formation</div>
          <div className="flex gap-3">
            {/* Formation grid */}
            <div className="flex-1 grid grid-cols-3 gap-2">
              {FORMATIONS.map(f => (
                <button
                  key={f.name}
                  onClick={() => setFormation(f.name)}
                  className="rounded-xl p-2 pb-1.5 transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={
                    formation === f.name
                      ? { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.45)" }
                      : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }
                  }
                >
                  <div className="aspect-[36/48] w-full">
                    <FormationDots slots={f.slots} active={formation === f.name} />
                  </div>
                  <div
                    className="text-[10px] font-black text-center mt-1"
                    style={{ color: formation === f.name ? "#10b981" : "#6b7280" }}
                  >
                    {f.name}
                  </div>
                </button>
              ))}
            </div>
            {/* Large pitch preview */}
            <div className="w-[108px] shrink-0">
              <FormationPitch formation={selectedFormation} />
            </div>
          </div>
        </div>

        {/* ── Era Range | Game Mode | Draft Order ── */}
        <div className="rounded-2xl p-4" style={{ background: "#0e1520", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="grid grid-cols-3 gap-3">

            {/* Era Range */}
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[9px] font-black tracking-[0.2em] text-gray-500 uppercase">Era Range</span>
              </div>
              <div className="space-y-1.5">
                <div className="relative">
                  <select value={eraStart} onChange={e => setEraStart(Number(e.target.value))} className={selectCls}>
                    {years.map(y => <option key={y} value={y} className="bg-gray-900">{fmtYear(y)}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
                <div className="text-center text-[9px] font-black text-gray-700 tracking-widest uppercase">TO</div>
                <div className="relative">
                  <select value={eraEnd} onChange={e => setEraEnd(Number(e.target.value))} className={selectCls}>
                    {years.map(y => <option key={y} value={y} className="bg-gray-900">{fmtYear(y)}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Game Mode */}
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                </svg>
                <span className="text-[9px] font-black tracking-[0.2em] text-gray-500 uppercase">Game Mode</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <OptionCard active={mode === "normal"} color="green" title="Normal" desc="Players rated as they were that season" onClick={() => setMode("normal")} />
                <OptionCard active={mode === "prime"}  color="amber" title="Prime ✦" desc="Every player uses their best-ever rating" onClick={() => setMode("prime")} />
              </div>
            </div>

            {/* Draft Order */}
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span className="text-[9px] font-black tracking-[0.2em] text-gray-500 uppercase">Draft Order</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <OptionCard active={draftOrder === "club-first"}     color="green" title="Club First"      desc="Pick a player, then choose their position" onClick={() => setDraftOrder("club-first")} />
                <OptionCard active={draftOrder === "position-first"} color="sky"   title="Position First"  desc="Fill each position slot in order"          onClick={() => setDraftOrder("position-first")} />
              </div>
            </div>

          </div>
        </div>

        {/* ── Rating Visibility | Re-Spins Per Draft ── */}
        <div className="rounded-2xl p-4" style={{ background: "#0e1520", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="grid grid-cols-2 gap-4">

            {/* Rating Visibility */}
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="text-[9px] font-black tracking-[0.2em] text-gray-500 uppercase">Rating Visibility</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <OptionCard active={!hiddenRatings} color="green"  title="Normal"         desc="Ratings visible while picking"       onClick={() => setHiddenRatings(false)} />
                <OptionCard active={hiddenRatings}  color="purple" title="Hidden Ratings"  desc="All ratings hidden until you pick"   onClick={() => setHiddenRatings(true)} />
              </div>
            </div>

            {/* Re-Spins */}
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-[9px] font-black tracking-[0.2em] text-gray-500 uppercase">Re-Spins Per Draft</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <OptionCard active={respins === 3} color="green" title="3 Re-Spins"  desc="Three total"         onClick={() => setRespins(3)} />
                <OptionCard active={respins === 1} color="green" title="1 Re-Spin"   desc="One total"           onClick={() => setRespins(1)} />
                <OptionCard active={respins === 0} color="green" title="None"        desc="No second chances"   onClick={() => setRespins(0)} />
              </div>
            </div>

          </div>
        </div>

        {/* Era warning */}
        {eraStart > eraEnd && (
          <div className="rounded-xl px-4 py-3 text-sm text-red-400 text-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            Start year must be before or equal to end year
          </div>
        )}

        {/* ── Start Draft ── */}
        <button
          onClick={() => onStart(currentSettings())}
          disabled={eraStart > eraEnd}
          className="relative w-full py-4 rounded-2xl overflow-hidden font-black text-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
          style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 55%, #34d399 100%)", boxShadow: "0 8px 30px -6px rgba(16,185,129,0.45)" }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            Start Draft
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
          {/* Decorative football */}
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-4xl opacity-50 select-none pointer-events-none">⚽</span>
        </button>

        {/* Stats strip */}
        <div className="flex items-center justify-between px-1">
          {[
            { icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>, value: "14", label: "SPINS" },
            { icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, value: "11", label: "STARTERS" },
            { icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>, value: "+3", label: "SUBS" },
            { icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" /></svg>, value: "38", label: "MATCHES" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-gray-500">
              {s.icon}
              <span className="text-xs font-bold text-gray-400">{s.value}</span>
              <span className="text-[10px] font-bold text-gray-600">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Sign-in prompt ── */}
        {isSignedIn === false && (
          <div className="rounded-2xl px-4 py-4" style={{ background: "#0e1520", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">🔒</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-white mb-1">Sign in to save your history</div>
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                  Play as a guest right now. Sign in for multiplayer, Hall of Fame, and saved progress.
                </p>
                <Link
                  href="/auth?next=/draft"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs text-white transition-all hover:scale-[1.02]"
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
          <div className="text-[10px] font-black tracking-[0.35em] text-emerald-500 uppercase mb-2">Multiplayer</div>

          {isSignedIn === false && (
            <Link href="/auth?next=/draft" className="block rounded-2xl p-3 transition-all" style={{ background: "#0e1520", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex gap-2 opacity-35 pointer-events-none select-none">
                <div className="flex-1 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2" style={{ border: "1px solid rgba(16,185,129,0.4)", color: "#10b981" }}>
                  + Create Room
                </div>
                <input disabled placeholder="ENTER ROOM CODE" className="flex-1 rounded-xl px-3 py-3 text-xs font-mono font-bold tracking-widest uppercase text-gray-600 bg-gray-800/60 border border-white/8 w-0" />
                <div className="px-4 py-3 rounded-xl text-sm font-black text-white bg-blue-600/60">Join</div>
              </div>
              <div className="mt-2 text-center text-xs font-black text-emerald-700">🔒 Sign in to play multiplayer</div>
            </Link>
          )}

          {isSignedIn === true && onCreateRoom && onJoinRoom && (
            <div className="flex gap-2">
              <button
                onClick={() => onCreateRoom(currentSettings())}
                className="flex-none py-3 px-4 rounded-xl text-sm font-black flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ border: "1px solid rgba(16,185,129,0.4)", color: "#10b981", background: "rgba(16,185,129,0.06)", whiteSpace: "nowrap" }}
              >
                + Create Room
              </button>
              <input
                type="text"
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); }}
                onKeyDown={e => e.key === "Enter" && handleJoin()}
                placeholder="ENTER ROOM CODE"
                maxLength={6}
                className="flex-1 min-w-0 rounded-xl px-3 py-3 text-xs font-mono font-black text-white placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500/40 tracking-widest uppercase transition"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <button
                onClick={handleJoin}
                disabled={joiningRoom}
                className="px-4 py-3 rounded-xl text-sm font-black text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
                style={{ background: "#2563eb" }}
              >
                {joiningRoom ? "…" : "Join"}
              </button>
            </div>
          )}

          {joinError && <div className="text-red-400 text-xs text-center mt-2">{joinError}</div>}
        </div>

      </div>

      {/* ══════════════════════════════ HOW TO PLAY MODAL ══════════════════════════════ */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setShowHowToPlay(false)}>
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 rounded-t-2xl" style={{ background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <h2 className="text-base font-black text-white">How to Play</h2>
              <button onClick={() => setShowHowToPlay(false)} className="text-gray-600 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-2">
              {[
                { n: 1, title: "Spin the wheel",    desc: "Each spin lands on a random English top-flight club from a real FIFA season." },
                { n: 2, title: "Pick a player",     desc: "Choose one player from that club's roster and slot them into your formation." },
                { n: 3, title: "Build your XI",     desc: "Keep spinning and picking until all 11 positions are filled." },
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
