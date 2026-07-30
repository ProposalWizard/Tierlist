"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import DraftSetup from "@/components/draft/DraftSetup";
import DraftPick from "@/components/draft/DraftPick";
import DraftResult from "@/components/draft/DraftResult";
import Season2Overview from "@/components/draft/Season2Overview";
import SquadManager from "@/components/draft/SquadManagerDev";
import MultiplayerLobby from "@/components/draft/MultiplayerLobby";
import AmericanDraftPhase from "@/components/draft/american/AmericanDraftPhase";
import { createClient } from "@/lib/supabase/client";
import { getPositionColor, FORMATIONS, formatSeasonYear } from "@/components/draft/formations";
import { getFlagUrl } from "@/lib/nationalities";
import ImageWithFallback from "@/components/ImageWithFallback";
import { computeTeamStrength } from "@/lib/seasonSimulator";
import type { PlayerAttributes, SeasonResult } from "@/lib/seasonSimulator";
import type { RoomPlayer } from "@/components/draft/MultiplayerLobby";

export interface DraftSettings {
  formation: string;
  eraStart: number;
  eraEnd: number;
  mode: "normal" | "prime";
  draftOrder: "position-first" | "club-first";
  respins: 0 | 1 | 3;
  hiddenRatings?: boolean;
  simulationSpeed?: 0.5 | 1 | 1.5;
  /**
   * Multiplayer squad selection style. "normal" is the per-player spinning
   * wheel; "american" replaces it with a shared turn-based pool draft.
   * Ignored in single player.
   */
  draftMode?: "normal" | "american";
}

export interface DraftPlayer {
  name: string;
  overall: number;
  positions: string;
  club: string;
  clubYear: string;
  assignedPosition: string;
  sofifa_id: string;
  image_url: string | null;
  nationality: string;
  age: number;
  isSub?: boolean;
  attrs?: PlayerAttributes;
}

type GamePhase = "setup" | "lobby" | "american-draft" | "formation-pick" | "draft" | "manage" | "result" | "pre-season" | "signing" | "sell" | "sell-signing" | "arrange";

const STORAGE_KEY = "pl-draft-progress";
const MAX_SEASONS = 5;

const FORMATION_COLORS: Record<string, string> = {
  "4-4-2":   "#3b82f6",
  "4-3-3":   "#06b6d4",
  "4-2-3-1": "#818cf8",
  "3-5-2":   "#a855f7",
  "3-4-3":   "#ec4899",
  "4-1-4-1": "#f59e0b",
  "5-3-2":   "#8b5cf6",
};

interface SavedProgress {
  settings: DraftSettings;
  players: DraftPlayer[];
  usedClubYears: string[];
  slotAssignments?: (number | undefined)[];
  savedPhase?: "manage" | "arrange";
  currentSeason?: number;
  previousResults?: SeasonResult[];
  respinsRemaining?: number;
}

interface DepartedPlayer {
  player: DraftPlayer;
  reason: string;
  convinceable?: boolean;
}

interface RatingChange {
  player: DraftPlayer;
  oldOverall: number;
  newOverall: number;
  change: number;
}

function getSigningBoost(season: number): number {
  if (season >= 5) return Math.floor(Math.random() * 4) + 4; // +4 to +7
  if (season >= 4) return Math.floor(Math.random() * 3) + 3; // +3 to +5
  if (season >= 2) return Math.floor(Math.random() * 3) + 2; // +2 to +4
  return Math.floor(Math.random() * 3) + 1;                  // +1 to +3
}

// Off-season intensive training boost. Lower-rated players gain far more so they
// can catch up; ratings above 80 keep the modest original boost. Each season the
// range shifts up by +1 on both ends (first training is season 2 = the base).
function getTrainingBoost(overall: number, season: number): number {
  let lo: number, hi: number;
  if (overall <= 65) { lo = 10; hi = 15; }
  else if (overall <= 75) { lo = 6; hi = 9; }
  else if (overall <= 80) { lo = 3; hi = 7; }
  else {
    // 81+ unchanged: small boost, capped at +2 for 90+ ratings.
    const roll = Math.floor(Math.random() * 3) + 1; // +1 to +3
    return overall >= 90 ? Math.min(2, roll) : roll;
  }
  const inc = Math.max(0, season - 2); // +1 per season after the first training
  lo += inc;
  hi += inc;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function applyStatChange(player: DraftPlayer, change: number): DraftPlayer {
  if (change === 0) return player;
  const newPlayer = {
    ...player,
    overall: Math.max(1, Math.min(100, player.overall + change)),
  };
  if (newPlayer.attrs) {
    const attrs = { ...newPlayer.attrs };
    for (const key of Object.keys(attrs) as (keyof PlayerAttributes)[]) {
      const val = attrs[key] as number;
      // val === 0 means "attribute not imported" — leave as 0 so hasAttrs()
      // stays false and the OVR-based simulation fallback is preserved.
      if (val > 0) {
        attrs[key] = Math.max(1, Math.min(100, val + change));
      }
    }
    newPlayer.attrs = attrs;
  }
  return newPlayer;
}

function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedProgress;
    if (!saved.settings?.formation || !Array.isArray(saved.players)) return null;
    // Post-draft save: full squad stored
    if (saved.savedPhase === "manage" || saved.savedPhase === "arrange") {
      if (saved.players.length >= 11) return saved;
    }
    // Draft save: mid-pick
    if (saved.players.length > 0 && saved.players.length < 14) return saved;
  } catch {
    // corrupted saved state — ignore it
  }
  return null;
}

function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function SellPhase({ players, onSell, onSkip, seasonNumber, formationName }: {
  players: DraftPlayer[];
  onSell: (player: DraftPlayer) => void;
  onSkip: () => void;
  seasonNumber: number;
  formationName?: string;
}) {
  const [pendingSell, setPendingSell] = useState<DraftPlayer | null>(null);

  const formation = useMemo(
    () => FORMATIONS.find(f => f.name === formationName) ?? FORMATIONS.find(f => f.name === "4-3-3") ?? FORMATIONS[0],
    [formationName],
  );

  const starters = useMemo(() => players.filter(p => !p.isSub), [players]);
  const subs = useMemo(() => players.filter(p => p.isSub), [players]);

  // Place each starter into a formation slot: exact position first, then any gap.
  const slotMap = useMemo(() => {
    const map = new Map<number, DraftPlayer>();
    const used = new Set<number>();
    for (const p of starters) {
      const idx = formation.slots.findIndex((slot, i) => !used.has(i) && slot.label === p.assignedPosition);
      if (idx >= 0) { used.add(idx); map.set(idx, p); }
    }
    for (const p of starters) {
      if (Array.from(map.values()).includes(p)) continue;
      const idx = formation.slots.findIndex((_, i) => !used.has(i));
      if (idx >= 0) { used.add(idx); map.set(idx, p); }
    }
    return map;
  }, [starters, formation]);

  const initials = (n: string) => n.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  // Always confirm before selling — protects against a misclick on any player.
  const handleClick = (p: DraftPlayer) => {
    setPendingSell(p);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      {/* Confirmation modal for selling a starter */}
      {pendingSell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-red-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-lg font-black text-white mb-1">Sell {pendingSell.isSub ? "Substitute" : "Player"}?</h2>
            <p className="text-gray-300 text-sm mb-1">
              Sell <span className="font-bold text-white">{pendingSell.name}</span>
              {pendingSell.isSub ? " from your bench?" : " from your starting XI?"}
            </p>
            <p className="text-gray-400 text-sm mb-5">
              You&apos;ll spin for a replacement, but if your draft luck is poor you could end up with a weaker squad.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingSell(null)}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 font-bold hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onSell(pendingSell); setPendingSell(null); }}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
              >
                Sell
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/30 bg-red-500/5 mb-4">
          <span className="text-xs font-bold tracking-widest uppercase text-red-400">
            Transfer Window
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          Sell a Player?
        </h1>
        <p className="text-white text-sm mt-1">
          Tap a player to sell them and spin for a replacement.
        </p>
      </div>

      {/* Starting XI — tap a player to sell */}
      <div
        className="relative w-full aspect-[3/4] max-w-sm mx-auto rounded-xl overflow-hidden border border-emerald-800/40 ring-1 ring-emerald-500/20 shadow-[0_0_30px_-12px_rgba(16,185,129,0.5)] mb-4"
        style={{ background: "radial-gradient(120% 80% at 50% 0%, #12401a 0%, #0c2e14 45%, #071c0d 100%)" }}
      >
        <div className="absolute inset-x-[8%] top-[4%] bottom-[4%] border border-emerald-600/25 rounded" />
        <div className="absolute left-1/2 top-[4%] bottom-[4%] w-px bg-emerald-600/25" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border border-emerald-600/25" />
        {formation.slots.map((slot, i) => {
          const p = slotMap.get(i);
          const renderY = slot.y >= 88 ? slot.y - 4 : slot.y; // nudge GK up so its label fits below
          if (!p) {
            return (
              <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${slot.x}%`, top: `${renderY}%` }}>
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-dashed border-white/25 bg-black/30 flex items-center justify-center text-[9px] font-bold text-white/50">{slot.label}</div>
              </div>
            );
          }
          const flag = getFlagUrl(p.nationality);
          return (
            <button
              key={i}
              onClick={() => handleClick(p)}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
              style={{ left: `${slot.x}%`, top: `${renderY}%` }}
            >
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-white/60 shadow-lg group-hover:border-red-400 group-hover:ring-2 group-hover:ring-red-400/60 transition-all">
                {p.image_url ? (
                  <ImageWithFallback src={p.image_url} alt={p.name} className="w-full h-full object-cover" fallbackText={initials(p.name)} />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${getPositionColor(p.assignedPosition)}`}>
                    <span className="text-xs font-black text-white">{initials(p.name)}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center mt-0.5 max-w-[64px]">
                <span className="text-[10px] font-bold text-white truncate w-full text-center leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">{p.name.split(" ").pop()}</span>
                <div className="flex items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {flag && <img src={flag} alt="" className="w-3 h-2 object-cover rounded-[1px]" />}
                  <span className="text-[10px] font-black text-emerald-400">{p.overall}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bench — tap a sub to sell */}
      {subs.length > 0 && (
        <div className="bg-purple-900/10 border border-purple-700/30 rounded-xl p-3 mb-4">
          <div className="text-[10px] font-bold tracking-widest text-purple-400 uppercase mb-2">Substitutes</div>
          <div className="grid grid-cols-3 gap-2">
            {subs.map((p, i) => {
              const flag = getFlagUrl(p.nationality);
              // Show the player's NATURAL position(s), not the slot they happened
              // to be assigned/swapped into before being benched.
              const natural = (p.positions || "").split(",").map(s => s.trim()).filter(Boolean);
              const posLabel = natural.join("/") || p.assignedPosition;
              const posColor = getPositionColor(natural[0] || p.assignedPosition);
              return (
                <button key={i} onClick={() => handleClick(p)} className="flex flex-col items-center rounded-xl px-2 py-2 border bg-purple-900/30 border-purple-600/40 hover:border-red-400 hover:ring-2 hover:ring-red-400/50 transition-all">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/60">
                    {p.image_url ? (
                      <ImageWithFallback src={p.image_url} alt={p.name} className="w-full h-full object-cover" fallbackText={initials(p.name)} />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${posColor}`}>
                        <span className="text-xs font-black text-white">{initials(p.name)}</span>
                      </div>
                    )}
                  </div>
                  <span className={`mt-1 text-[8px] font-black text-white px-1.5 py-0.5 rounded ${posColor}`}>{posLabel}</span>
                  <span className="mt-0.5 text-[10px] font-bold text-white truncate max-w-[72px] text-center">{p.name.split(" ").pop()}</span>
                  <div className="flex items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {flag && <img src={flag} alt="" className="w-3 h-2 object-cover rounded-[1px]" />}
                    <span className="text-[10px] font-black text-emerald-400">{p.overall}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={onSkip}
        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        Skip &mdash; Keep Squad
      </button>
    </div>
  );
}

export default function DraftPage() {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [settings, setSettings] = useState<DraftSettings | null>(null);
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [resume, setResume] = useState<SavedProgress | null>(null);

  const [currentSeason, setCurrentSeason] = useState(1);
  const [previousResults, setPreviousResults] = useState<SeasonResult[]>([]);
  const [nextSeasonPlayers, setNextSeasonPlayers] = useState<DraftPlayer[]>([]);
  const [departedPlayers, setDepartedPlayers] = useState<DepartedPlayer[]>([]);
  const [ratingChanges, setRatingChanges] = useState<RatingChange[]>([]);
  const [signingSlots, setSigningSlots] = useState(2);
  const [nextUsedClubYears, setNextUsedClubYears] = useState<string[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);

  // Persistent team name
  const [teamName, setTeamName] = useState("KNOWITBALL FC");

  // Respin counter — persists across all DraftPick phases in one save
  const [respinsRemaining, setRespinsRemaining] = useState(0);

  // Multiplayer state
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [squadSubmitted, setSquadSubmitted] = useState(false);
  const readyRetryAbortRef = useRef<AbortController | null>(null);
  const [preComputedSeason, setPreComputedSeason] = useState<SeasonResult | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[] | null>(null);
  const [allRoomPlayerSeasons, setAllRoomPlayerSeasons] = useState<Record<string, SeasonResult[]> | null>(null);
  const [revealStartTime, setRevealStartTime] = useState<number | undefined>(undefined);

  // Update URL to reflect room code when playing online (so it's shareable/bookmarkable)
  useEffect(() => {
    const url = roomCode ? `/draft?room=${roomCode}` : '/draft';
    window.history.replaceState(null, '', url);
  }, [roomCode]);

  useEffect(() => {
    setResume(loadProgress());
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setIsSignedIn(!!user);
      setUserId(user?.id ?? null);
      if (user) {
        const [adminRes, teamNameRes] = await Promise.all([
          fetch("/api/profile/admin-check"),
          fetch("/api/profile/team-name"),
        ]);
        if (adminRes.ok) {
          const d = await adminRes.json();
          setIsAdminUser(d.isAdmin === true);
        }
        if (teamNameRes.ok) {
          const d = await teamNameRes.json();
          if (d.teamName) setTeamName(d.teamName);
        }
      }
    });
  }, []);

  const scrollTop = useCallback(() => window.scrollTo({ top: 0 }), []);

  // Auto-save when entering the squad manager phases (solo only)
  useEffect(() => {
    if (!settings || roomCode) return;
    if (phase === "manage" && players.length >= 11) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          settings, players, usedClubYears: [],
          savedPhase: "manage", currentSeason: 1, previousResults: [],
        }));
      } catch {}
    }
    if (phase === "arrange" && players.length >= 11) {
      try {
        const compact = previousResults.map(({ allFixtures: _, ...r }) => r);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          settings, players, usedClubYears: [],
          savedPhase: "arrange", currentSeason, previousResults: compact,
        }));
      } catch {}
    }
  }, [phase, players, settings, currentSeason, previousResults, roomCode]);

  // Called on blur from the team name input — saves to profile if signed in
  const handleTeamNameChange = useCallback(async (name: string) => {
    setTeamName(name);
    if (!isSignedIn || !name.trim()) return;
    try {
      await fetch("/api/profile/team-name", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName: name.trim() }),
      });
    } catch {}
  }, [isSignedIn]);

  const handleStartDraft = useCallback((s: DraftSettings) => {
    clearProgress();
    setResume(null);
    setSettings({ ...s, formation: "4-3-3" }); // formation chosen on next screen
    setPlayers([]);
    setRoomCode(null);
    setIsHost(false);
    setSquadSubmitted(false);
    setPreComputedSeason(null);
    setRoomPlayers(null);
    setRespinsRemaining(s.respins ?? 0);
    setPhase("formation-pick");
    scrollTop();
  }, [scrollTop]);

  const handleCreateRoom = useCallback(async (s: DraftSettings) => {
    clearProgress();
    setResume(null);
    // Store room settings without formation (each player picks their own)
    const roomSettings = { ...s, formation: "4-3-3" };
    const res = await fetch("/api/draft/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: roomSettings }),
    });
    if (!res.ok) { alert("Failed to create room"); return; }
    const { code } = await res.json();
    setRoomCode(code);
    setIsHost(true);
    setSettings(roomSettings);
    setPlayers([]);
    setSquadSubmitted(false);
    setPreComputedSeason(null);
    setRoomPlayers(null);
    setRespinsRemaining(s.respins ?? 0);
    setPhase("lobby");
    scrollTop();
  }, [scrollTop]);

  const handleJoinRoom = useCallback(async (code: string, _ownSettings: DraftSettings) => {
    clearProgress();
    setResume(null);

    let restoredSquad: DraftPlayer[] | null = null;
    let restoredAlreadySubmitted = false;
    let restoredSeason = 1;
    // Set when the room is mid-American-draft and this player still owes picks —
    // dropping them in the lobby instead would stall the draft for everyone,
    // because their turn would come round and nobody could take it.
    let resumeAmericanDraft = false;

    // Fetch host's settings; formation is picked later in formation-pick phase
    const res = await fetch(`/api/draft/rooms/${code}`);
    if (res.ok) {
      const data = await res.json();
      if (data.room?.settings) {
        const hostSettings = data.room.settings as DraftSettings;
        setSettings({
          ...hostSettings,
          formation: "4-3-3", // default; overridden in formation-pick phase
        });
        setRespinsRemaining(hostSettings.respins ?? 0);
      } else {
        setSettings(_ownSettings);
      }
      // Restore season number so lobby shows correct season on rejoin
      if (data.room?.season_number) {
        restoredSeason = data.room.season_number as number;
      }
      // If this player already has a squad in the room (rejoin), restore it so they
      // don't see "Waiting for host" in the wrong season or lose their submitted squad
      if (userId && Array.isArray(data.players)) {
        const myRoomPlayer = (data.players as Array<{ user_id: string; squad?: DraftPlayer[] | null; status?: string }>)
          .find(p => p.user_id === userId);
        if (myRoomPlayer?.squad && Array.isArray(myRoomPlayer.squad) && myRoomPlayer.squad.length > 0) {
          restoredSquad = myRoomPlayer.squad as DraftPlayer[];
          restoredAlreadySubmitted = myRoomPlayer.status === "ready";
        }
        const amState = data.room?.american_state as { complete?: boolean } | null | undefined;
        if (amState && !amState.complete && myRoomPlayer && myRoomPlayer.status !== "ready") {
          resumeAmericanDraft = true;
        }
      }
    } else {
      setSettings(_ownSettings);
    }

    setRoomCode(code);
    setIsHost(false);
    setCurrentSeason(restoredSeason);
    setPreComputedSeason(null);
    setRoomPlayers(null);

    if (restoredSquad) {
      setPlayers(restoredSquad);
      setSquadSubmitted(restoredAlreadySubmitted);
    } else {
      setPlayers([]);
      setSquadSubmitted(false);
    }

    setPhase(resumeAmericanDraft ? "american-draft" : "lobby");
    scrollTop();
  }, [scrollTop, userId]);

  // Auto-join when redirected from American Draft (?room=CODE in URL)
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (autoJoinedRef.current || !isSignedIn || phase !== "setup") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("room");
    if (!code) return;
    autoJoinedRef.current = true;
    window.history.replaceState(null, "", "/draft");
    handleJoinRoom(code.toUpperCase(), {
      formation: "4-3-3", eraStart: 2007, eraEnd: 2026,
      mode: "normal", draftOrder: "position-first", respins: 0,
    });
  }, [isSignedIn, phase, handleJoinRoom]);

  const handleStartFromLobby = useCallback(() => {
    if (currentSeason === 1) {
      // American mode replaces the per-player spin for the first season only;
      // later seasons re-arrange the squad the draft produced, as normal.
      if (settings?.draftMode === "american") {
        setPhase("american-draft");
        scrollTop();
        return;
      }
      setPhase("formation-pick");
    } else if (players.length > 0) {
      // Season 2+ with an existing squad (preserved from last season) — go straight to arrange
      setPhase("arrange");
    } else {
      setPhase("draft");
    }
    scrollTop();
  }, [scrollTop, currentSeason, players, settings]);

  const handleSimulationComplete = useCallback((myResult: SeasonResult, allPlayers: RoomPlayer[], revealStartAt?: number) => {
    setRevealStartTime(revealStartAt ?? Date.now());
    setPreComputedSeason(myResult);
    setRoomPlayers(allPlayers);
    // Populate players from the user's room squad so handlePlayNextSeason has a squad to work with
    const myRoomPlayer = allPlayers.find(rp => rp.user_id === userId);
    if (myRoomPlayer?.squad && (myRoomPlayer.squad as DraftPlayer[]).length > 0) {
      setPlayers(myRoomPlayer.squad as DraftPlayer[]);
    }
    // Accumulate current season from allPlayers. Deduped by fingerprint to
    // handle rejoin/refresh double-fires.
    setAllRoomPlayerSeasons(prev => {
      const next = { ...(prev ?? {}) };
      for (const rp of allPlayers) {
        if (rp.season_result) {
          const key = rp.display_name;
          if (!next[key]) next[key] = [];
          const fp = JSON.stringify(rp.season_result);
          const alreadyPresent = next[key].some(s => JSON.stringify(s) === fp);
          if (!alreadyPresent) next[key] = [...next[key], rp.season_result];
        }
      }
      return next;
    });

    // Also fetch the server-stored season history from room.settings.allPlayerSeasons.
    // The next-season route snapshots each season's results there before clearing
    // season_result. This fills in any seasons a client missed due to the race
    // between tryComplete and next-season (i.e. the client polled after season_result
    // was already cleared, so allPlayers had nulls for other players).
    if (roomCode) {
      fetch(`/api/draft/rooms/${roomCode}`)
        .then(r => r.ok ? r.json() : null)
        .then((data: { room?: { settings?: Record<string, unknown> } } | null) => {
          const serverHistory = data?.room?.settings?.allPlayerSeasons;
          if (!serverHistory || typeof serverHistory !== "object") return;
          setAllRoomPlayerSeasons(prev => {
            const next = { ...(prev ?? {}) };
            for (const [key, seasons] of Object.entries(serverHistory as Record<string, SeasonResult[]>)) {
              if (!next[key]) next[key] = [];
              for (const season of seasons) {
                const fp = JSON.stringify(season);
                if (!next[key].some(s => JSON.stringify(s) === fp)) {
                  next[key] = [...(next[key] as SeasonResult[]), season];
                }
              }
            }
            return next;
          });
        })
        .catch(() => {});
    }

    setPhase("result");
    scrollTop();
  }, [scrollTop, userId, roomCode]);

  const handleCareerComplete = useCallback((seasons: SeasonResult[], finalRoomPlayers: RoomPlayer[], roomPlayerSeasons?: Record<string, SeasonResult[]>) => {
    if (seasons.length === 0) return;
    const lastSeason = seasons[seasons.length - 1];
    setPreviousResults(seasons.slice(0, -1));
    setPreComputedSeason(lastSeason);
    setRoomPlayers(finalRoomPlayers);
    if (roomPlayerSeasons) setAllRoomPlayerSeasons(roomPlayerSeasons);
    setCurrentSeason(MAX_SEASONS);
    const myRoomPlayer = finalRoomPlayers.find(rp => rp.user_id === userId);
    if (myRoomPlayer?.squad && (myRoomPlayer.squad as DraftPlayer[]).length > 0) {
      setPlayers(myRoomPlayer.squad as DraftPlayer[]);
    }
    setPhase("result");
    scrollTop();
  }, [scrollTop, userId]);

  const handleLeaveRoom = useCallback(() => {
    // Cancel any in-flight ready retry loop before leaving
    readyRetryAbortRef.current?.abort();
    readyRetryAbortRef.current = null;
    // Tell the server we're leaving so our row doesn't linger and block the
    // room's "all ready" forever (fire-and-forget; hosts hand over the room).
    if (roomCode) {
      void fetch(`/api/draft/rooms/${roomCode}/leave`, { method: "POST" }).catch(() => {});
    }
    setPhase("setup");
    setRoomCode(null);
    setIsHost(false);
    setSquadSubmitted(false);
    setPreComputedSeason(null);
    setRoomPlayers(null);
    setPlayers([]);
    setSettings(null);
    scrollTop();
  }, [scrollTop, roomCode]);

  const handleUpdateRoomSettings = useCallback(async (update: Partial<DraftSettings>) => {
    if (!roomCode) return;
    // Optimistically update local settings
    setSettings(prev => prev ? { ...prev, ...update } : prev);
    // Also update respins if that changed
    if (update.respins !== undefined) {
      setRespinsRemaining(update.respins);
    }
    // Persist to server
    try {
      const res = await fetch(`/api/draft/rooms/${roomCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: update }),
      });
      if (!res.ok) {
        console.error("Failed to update room settings");
      }
    } catch (e) {
      console.error("Error updating room settings:", e);
    }
  }, [roomCode]);

  const handleSettingsSync = useCallback((update: Partial<DraftSettings>) => {
    // Formation is an individual choice, not shared from the host — never let
    // a room settings sync overwrite the local player's own formation pick.
    const { formation: _formation, ...safeUpdate } = update;
    void _formation;
    setSettings(prev => prev ? { ...prev, ...safeUpdate } : prev);
    if (update.respins !== undefined) {
      setRespinsRemaining(update.respins as number);
    }
  }, []);

  const handleResume = useCallback(() => {
    if (!resume) return;
    setSettings(resume.settings);
    setCurrentSeason(resume.currentSeason ?? 1);
    setPreviousResults((resume.previousResults ?? []) as SeasonResult[]);
    if (resume.savedPhase === "manage" || resume.savedPhase === "arrange") {
      setPlayers(resume.players);
      setPhase(resume.savedPhase);
    } else {
      setPlayers([]);
      // Restore the actual remaining count saved mid-draft; fall back to full allocation only for old saves that lack it
      setRespinsRemaining(resume.respinsRemaining ?? resume.settings.respins ?? 0);
      setPhase("draft");
    }
    scrollTop();
  }, [resume, scrollTop]);

  const handleDiscardResume = useCallback(() => {
    clearProgress();
    setResume(null);
  }, []);

  const handleProgress = useCallback(
    (picked: DraftPlayer[], usedClubYears: string[], slotAssignments?: (number | undefined)[]) => {
      // Multiplayer drafts must not write the SOLO resume key — otherwise a
      // refreshed multiplayer player is offered "Resume" into a solo game
      // built from their half-finished room draft.
      if (!settings || roomCode) return;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ settings, players: picked, usedClubYears, slotAssignments, respinsRemaining })
        );
      } catch {}
    },
    [settings, respinsRemaining, roomCode]
  );

  const handleDraftComplete = useCallback((picked: DraftPlayer[]) => {
    setResume(null);
    setPlayers(picked);
    setPhase("manage");
    scrollTop();
  }, [scrollTop]);

  // Submit the squad's ready with retries. The server rejects with 409 while
  // the previous season is still "complete" (host hasn't advanced the room
  // yet) — a ready that landed then would be wiped by the host's reset and
  // deadlock the room, so keep retrying until it's accepted.
  const submitReadyWithRetry = useCallback((code: string, arranged: DraftPlayer[]) => {
    readyRetryAbortRef.current?.abort();
    const ac = new AbortController();
    readyRetryAbortRef.current = ac;
    const { teamStrength, avgOvr } = computeTeamStrength(arranged);
    const readyBody = JSON.stringify({ squad: arranged, avg_ovr: avgOvr, team_strength: teamStrength });
    void (async () => {
      let hardFailures = 0;
      for (let attempt = 0; attempt < 900; attempt++) {
        if (ac.signal.aborted) return;
        try {
          const res = await fetch(`/api/draft/rooms/${code}/ready`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: readyBody,
            signal: ac.signal,
          });
          if (res.ok) {
            setSquadSubmitted(true);
            return;
          }
          if (res.status !== 409 && ++hardFailures >= 5) return;
        } catch {
          if (ac.signal.aborted) return;
        }
        await new Promise(res => setTimeout(res, 2000));
      }
    })();
  }, []);

  const handleManageConfirm = useCallback(async (arranged: DraftPlayer[], speed?: 0.5 | 1 | 1.5) => {
    setPlayers(arranged);
    if (!roomCode && speed !== undefined) {
      setSettings(prev => prev ? { ...prev, simulationSpeed: speed } : prev);
    }
    if (roomCode) {
      // Multiplayer: if this is a subsequent season, advance the room first (idempotent)
      if (currentSeason > 1 && isHost) {
        await fetch(`/api/draft/rooms/${roomCode}/next-season`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nextSeasonNumber: currentSeason }),
        });
      }
      // Mark submitted before changing phase so the remounted lobby's
      // gameStarted effect sees squadSubmitted=true and doesn't re-trigger
      // onStartDraft (which would reset the draft back to formation-pick).
      setSquadSubmitted(true);
      setPhase("lobby");
      submitReadyWithRetry(roomCode, arranged);
    } else {
      setPhase("result");
    }
    scrollTop();
  }, [roomCode, currentSeason, isHost, scrollTop, submitReadyWithRetry]);

  const handleNewRun = useCallback(() => {
    readyRetryAbortRef.current?.abort();
    readyRetryAbortRef.current = null;
    // If in a multiplayer room, leave it so survivors can continue without a
    // lingering/ghost row blocking "all ready" (fire-and-forget).
    if (roomCode) {
      void fetch(`/api/draft/rooms/${roomCode}/leave`, { method: "POST" }).catch(() => {});
    }
    clearProgress();
    setResume(null);
    setPhase("setup");
    setSettings(null);
    setPlayers([]);
    setCurrentSeason(1);
    setPreviousResults([]);
    setNextSeasonPlayers([]);
    setDepartedPlayers([]);
    setRatingChanges([]);
    setNextUsedClubYears([]);
    setRoomCode(null);
    setIsHost(false);
    setSquadSubmitted(false);
    setPreComputedSeason(null);
    setRoomPlayers(null);
    setRespinsRemaining(0);
    scrollTop();
  }, [scrollTop, roomCode]);

  const handlePlayNextSeason = useCallback(
    (season: SeasonResult, currentPlayers: DraftPlayer[]) => {
      const sorted = [...currentPlayers].sort((a, b) => (b.age || 0) - (a.age || 0));
      const departed: DepartedPlayer[] = [];

      // 60% chance 2 players leave, 40% chance only 1 leaves
      const twoDepartures = Math.random() < 0.6;

      if (twoDepartures) {
        // One has 50% chance of being one of the two oldest; the other is random
        if (Math.random() < 0.5) {
          const retiree = Math.random() < 0.5 ? sorted[0] : sorted[1];
          departed.push({ player: retiree, reason: `Retired (age ${retiree.age || "?"})` });
          const rest = currentPlayers.filter((p) => p !== retiree);
          const randomIdx = Math.floor(Math.random() * rest.length);
          departed.push({ player: rest[randomIdx], reason: "Left the club" });
        } else {
          const shuffled = [...currentPlayers].sort(() => Math.random() - 0.5);
          departed.push({ player: shuffled[0], reason: "Left the club" });
          departed.push({ player: shuffled[1], reason: "Left the club" });
        }
        // One randomly chosen player gets the "convince to stay" chance
        const convinceIdx = Math.floor(Math.random() * 2);
        departed[convinceIdx] = { ...departed[convinceIdx], convinceable: true };
      } else {
        // Only 1 departure — that player is convinceable
        if (Math.random() < 0.5) {
          const retiree = Math.random() < 0.5 ? sorted[0] : sorted[1];
          departed.push({ player: retiree, reason: `Retired (age ${retiree.age || "?"})`, convinceable: true });
        } else {
          const shuffled = [...currentPlayers].sort(() => Math.random() - 0.5);
          departed.push({ player: shuffled[0], reason: "Left the club", convinceable: true });
        }
      }

      const departedSet = new Set(departed.map((d) => d.player));
      const remaining = currentPlayers.filter((p) => !departedSet.has(p));

      const statsMap = new Map(season.playerStats.map((s) => [s.name, s]));
      const changes: RatingChange[] = remaining.map((player) => {
        const stats = statsMap.get(player.name);
        const avgRating = stats?.avgRating ?? 6.5;
        let change = 0;
        if (avgRating >= 8.5) change = 3;
        else if (avgRating >= 8.0) change = 2;
        else if (avgRating >= 7.0) change = 1;
        else if (avgRating <= 6.5) change = -1;

        const oldOverall = player.overall;
        const upgraded = applyStatChange(player, change);
        // Overall is capped at 100, so report the ACTUAL delta — a 100-rated
        // player who "earned" +3 didn't actually change, so it shows 0.
        return { player: upgraded, oldOverall, newOverall: upgraded.overall, change: upgraded.overall - oldOverall };
      });

      const usedCYs = currentPlayers.map((p) => {
        const yearPart = p.clubYear.split(" ")[1] ?? "";
        const rawYear = yearPart.includes("/")
          ? String(2000 + parseInt(yearPart.split("/")[1], 10))
          : yearPart;
        return `${p.club}-${rawYear}`;
      });

      setDepartedPlayers(departed);
      setRatingChanges(changes);
      setNextSeasonPlayers(changes.map((rc) => rc.player));
      setPreviousResults((prev) => [...prev, season]);
      setNextUsedClubYears(usedCYs);
      setSigningSlots(departed.length);
      setCurrentSeason((s) => s + 1);
      // Reset multiplayer state so the lobby is fresh for the next season
      setPreComputedSeason(null);
      setRoomPlayers(null);
      setSquadSubmitted(false);
      setPhase("pre-season");
      scrollTop();
    },
    [scrollTop]
  );

  const handlePreSeasonContinue = useCallback(
    (trainingPlayerName: string, retainedPlayer?: DraftPlayer) => {
      const updatedSquad = [
        ...nextSeasonPlayers.map((p) => {
          if (p.name !== trainingPlayerName) return p;
          const boost = getTrainingBoost(p.overall, currentSeason);
          return applyStatChange(p, boost);
        }),
        ...(retainedPlayer ? [retainedPlayer] : []),
      ];
      setNextSeasonPlayers(updatedSquad);
      const actualSlots = retainedPlayer ? Math.max(0, signingSlots - 1) : signingSlots;
      setSigningSlots(actualSlots);
      if (actualSlots === 0) {
        setPlayers(updatedSquad);
        setPhase("sell");
      } else {
        setPhase("signing");
      }
      scrollTop();
    },
    [nextSeasonPlayers, signingSlots, scrollTop, currentSeason]
  );

  const handleSigningComplete = useCallback(
    (newPlayers: DraftPlayer[]) => {
      const boosted = newPlayers.map((p) => applyStatChange(p, getSigningBoost(currentSeason)));
      const fullSquad = [...nextSeasonPlayers, ...boosted];
      setPlayers(fullSquad);
      setPhase("sell");
      scrollTop();
    },
    [nextSeasonPlayers, scrollTop, currentSeason]
  );

  const handleSellPlayer = useCallback(
    (soldPlayer: DraftPlayer) => {
      setPlayers((prev) => prev.filter((p) => p !== soldPlayer));
      setPhase("sell-signing");
      scrollTop();
    },
    [scrollTop]
  );

  const handleSkipSell = useCallback(() => {
    setPhase("arrange");
    scrollTop();
  }, [scrollTop]);

  const handleSellSigningComplete = useCallback(
    (newPlayers: DraftPlayer[]) => {
      const boosted = newPlayers.map((p) => applyStatChange(p, getSigningBoost(currentSeason)));
      setPlayers((prev) => [...prev, ...boosted]);
      setPhase("arrange");
      scrollTop();
    },
    [scrollTop, currentSeason]
  );

  const handleArrangeConfirm = useCallback(async (arranged: DraftPlayer[], speed?: 0.5 | 1 | 1.5) => {
    setPlayers(arranged);
    if (!roomCode && speed !== undefined) {
      setSettings(prev => prev ? { ...prev, simulationSpeed: speed } : prev);
    }
    if (roomCode) {
      if (currentSeason > 1 && isHost) {
        // The host advances the room to the new season (resets everyone to
        // "drafting"). Only after that can anyone's ready be accepted.
        await fetch(`/api/draft/rooms/${roomCode}/next-season`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nextSeasonNumber: currentSeason }),
        });
      }
      // Mark submitted before changing phase so the remounted lobby's
      // gameStarted effect sees squadSubmitted=true and doesn't re-trigger
      // onStartDraft (which would reset the draft back to formation-pick).
      setSquadSubmitted(true);
      setPhase("lobby");
      submitReadyWithRetry(roomCode, arranged);
    } else {
      setPhase("result");
    }
    scrollTop();
  }, [roomCode, currentSeason, isHost, scrollTop, submitReadyWithRetry]);

  const handleSkipToTest = useCallback(async () => {
    const defaultSettings: DraftSettings = {
      formation: "4-3-3", eraStart: 2007, eraEnd: 2026, mode: "normal", draftOrder: "position-first", respins: 1,
    };
    setAutoFilling(true);

    try {
      const clubsRes = await fetch("/api/draft/clubs");
      const clubsData = await clubsRes.json();
      const availableClubs: { name: string; seasons: number[] }[] = clubsData.clubs ?? [];
      if (availableClubs.length === 0) {
        alert("No clubs found — import player data first");
        setAutoFilling(false);
        return;
      }

      const usedClubYears = new Set<string>();
      const formation = FORMATIONS.find(f => f.name === "4-3-3") ?? FORMATIONS[0];
      const squad: DraftPlayer[] = [];

      const pickClubYear = (): { club: string; year: number } | null => {
        const pairs: { club: string; year: number }[] = [];
        for (const c of availableClubs) {
          for (const y of c.seasons) {
            if (y >= defaultSettings.eraStart && y <= defaultSettings.eraEnd && !usedClubYears.has(`${c.name}-${y}`)) {
              pairs.push({ club: c.name, year: y });
            }
          }
        }
        if (pairs.length === 0) return null;
        const byYear = new Map<number, typeof pairs>();
        for (const p of pairs) {
          if (!byYear.has(p.year)) byYear.set(p.year, []);
          byYear.get(p.year)!.push(p);
        }
        const years = Array.from(byYear.keys());
        const year = years[Math.floor(Math.random() * years.length)];
        const pool = byYear.get(year)!;
        return pool[Math.floor(Math.random() * pool.length)];
      };

      const buildAttrs = (p: Record<string, number>): PlayerAttributes => ({
        pace: p.pace, shooting: p.shooting, passing: p.passing, dribbling: p.dribbling,
        defending: p.defending, physical: p.physical, finishing: p.finishing,
        positioning: p.positioning, crossing: p.crossing, vision: p.vision,
        longShots: p.longShots, shortPassing: p.shortPassing, longPassing: p.longPassing,
        heading: p.heading, interceptions: p.interceptions, standingTackle: p.standingTackle,
        marking: p.marking, reactions: p.reactions, sprintSpeed: p.sprintSpeed,
        gkDiving: p.gkDiving, gkPositioning: p.gkPositioning, gkReflexes: p.gkReflexes,
      });

      const fetchRosterSafe = async (club: string, year: number): Promise<Record<string, unknown>[]> => {
        try {
          const res = await fetch(`/api/draft/roster?club=${encodeURIComponent(club)}&year=${year}`);
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data.roster) ? data.roster : [];
        } catch { return []; }
      };

      const spinAndPick = async (): Promise<{ roster: Record<string, unknown>[]; clubYear: { club: string; year: number } } | null> => {
        for (let r = 0; r < 5; r++) {
          const cy = pickClubYear();
          if (!cy) return null;
          usedClubYears.add(`${cy.club}-${cy.year}`);
          const roster = await fetchRosterSafe(cy.club, cy.year);
          if (roster.length > 0) return { roster, clubYear: cy };
        }
        return null;
      };

      // 11 starters — one spin per formation slot
      for (let i = 0; i < formation.slots.length; i++) {
        const slot = formation.slots[i];
        const pick = await spinAndPick();
        if (!pick) continue;
        const { roster, clubYear } = pick;

        const compatible = roster.filter(p => {
          const playerPositions = String(p.positions ?? "").split(",").map(s => s.trim());
          return playerPositions.some(pp => slot.compatiblePositions.includes(pp));
        });
        const pool = compatible.length > 0 ? compatible : roster;
        const best = pool.reduce((a, b) => (Number(b.overall) > Number(a.overall) ? b : a), pool[0]) as Record<string, unknown>;
        const abbr = clubYear.club.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3);

        squad.push({
          name: String(best.name), overall: Number(best.overall),
          positions: String(best.positions ?? ""), club: clubYear.club,
          clubYear: `${abbr} ${formatSeasonYear(clubYear.year)}`, assignedPosition: slot.label,
          sofifa_id: String(best.sofifa_id), image_url: best.image_url as string | null,
          nationality: String(best.nationality ?? ""), age: Number(best.age ?? 0),
          isSub: false, attrs: buildAttrs(best as Record<string, number>),
        });
      }

      // 3 subs
      for (let i = 0; i < 3; i++) {
        const pick = await spinAndPick();
        if (!pick) continue;
        const { roster, clubYear } = pick;

        const best = roster.reduce((a, b) => (Number(b.overall) > Number(a.overall) ? b : a), roster[0]) as Record<string, unknown>;
        const primaryPos = String(best.positions ?? "CM").split(",")[0].trim() || "CM";
        const abbr = clubYear.club.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3);

        squad.push({
          name: String(best.name), overall: Number(best.overall),
          positions: String(best.positions ?? ""), club: clubYear.club,
          clubYear: `${abbr} ${formatSeasonYear(clubYear.year)}`, assignedPosition: primaryPos,
          sofifa_id: String(best.sofifa_id), image_url: best.image_url as string | null,
          nationality: String(best.nationality ?? ""), age: Number(best.age ?? 0),
          isSub: true, attrs: buildAttrs(best as Record<string, number>),
        });
      }

      if (squad.length === 0) {
        alert("Auto-draft found no players — check that player data is imported");
        setAutoFilling(false);
        return;
      }

      setSettings(defaultSettings);
      setPlayers(squad);
      setCurrentSeason(1);
      setPreviousResults([]);
      setPhase("manage");
      scrollTop();
    } catch (e) {
      console.error("Auto-fill failed:", e);
      alert("Auto-fill failed — check console");
    } finally {
      setAutoFilling(false);
    }
  }, [scrollTop]);

  const totalPicked = resume?.players.length ?? 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {roomCode && phase !== "setup" && phase !== "lobby" && (
        <div className="fixed top-2 right-2 z-50 flex items-center gap-1.5 bg-gray-900/90 backdrop-blur border border-gray-700/50 rounded-full px-3 py-1 shadow-lg">
          <span className="text-[9px] font-bold tracking-widest text-white uppercase">Room</span>
          <span className="text-xs font-black tracking-[0.2em] text-emerald-400 font-mono">{roomCode}</span>
        </div>
      )}
      {phase === "setup" && (
        <>
          {resume && (
            <div className="max-w-2xl mx-auto px-4 pt-4">
              <div className="flex items-center gap-3 bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-emerald-400">
                    {resume.savedPhase === "manage"
                      ? "Squad ready — Season 1 waiting"
                      : resume.savedPhase === "arrange"
                        ? `Pre-season — Season ${resume.currentSeason} ready`
                        : "Draft in progress"}
                  </div>
                  <div className="text-xs text-white">
                    {resume.savedPhase
                      ? `${resume.players.length} players · ${resume.settings.formation}${resume.settings.mode === "prime" ? " · Prime" : ""}`
                      : `${totalPicked}/14 picked · ${resume.settings.formation}${resume.settings.mode === "prime" ? " · Prime" : ""}${resume.settings.draftOrder === "club-first" ? " · Club First" : ""}`}
                  </div>
                </div>
                <button
                  onClick={handleDiscardResume}
                  className="px-3 py-1.5 text-xs font-bold text-white hover:text-white rounded-lg hover:bg-gray-800 transition"
                >
                  Discard
                </button>
                <button
                  onClick={handleResume}
                  className="px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-lg transition"
                >
                  Resume
                </button>
              </div>
            </div>
          )}
          <DraftSetup
            onStart={handleStartDraft}
            onCreateRoom={isSignedIn ? handleCreateRoom : undefined}
            onJoinRoom={isSignedIn ? handleJoinRoom : undefined}
            teamName={isSignedIn ? teamName : undefined}
            onTeamNameChange={isSignedIn ? handleTeamNameChange : undefined}
          />
          {isAdminUser && (
            <div className="text-center pb-6">
              <button
                onClick={handleSkipToTest}
                disabled={autoFilling}
                className="text-xs text-white hover:text-gray-500 underline transition disabled:cursor-wait"
              >
                {autoFilling ? "auto-drafting squad…" : "[test] skip draft → auto-fill squad"}
              </button>
            </div>
          )}
        </>
      )}
      {phase === "lobby" && roomCode && userId && (
        <MultiplayerLobby
          roomCode={roomCode}
          isHost={isHost}
          isAdmin={isAdminUser}
          userId={userId}
          squadSubmitted={squadSubmitted}
          currentSeason={currentSeason}
          settings={settings}
          onStartDraft={handleStartFromLobby}
          onSimulationComplete={handleSimulationComplete}
          onCareerComplete={isAdminUser ? handleCareerComplete : undefined}
          onLeave={handleLeaveRoom}
          onUpdateSettings={handleUpdateRoomSettings}
          onSettingsSync={handleSettingsSync}
          onHostChange={setIsHost}
          defaultTeamName={teamName}
        />
      )}
      {phase === "american-draft" && roomCode && userId && (
        <AmericanDraftPhase
          roomCode={roomCode}
          userId={userId}
          onComplete={() => {
            // The server has already written every squad as 'ready', so return
            // to the lobby in the submitted state and let the host simulate.
            setSquadSubmitted(true);
            setPhase("lobby");
            scrollTop();
          }}
        />
      )}
      {phase === "formation-pick" && settings && (
        <div className="min-h-screen bg-[#050b14] px-3 sm:px-6 py-8 flex flex-col items-center">
          <div className="w-full max-w-2xl">

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-white/40 font-black text-xl select-none">{">>"}</span>
              <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight leading-none">
                <span className="text-white">CHOOSE </span>
                <span className="text-cyan-400">FORMATION</span>
              </h1>
              <div className="flex-1 flex items-center gap-1">
                <div className="h-px flex-1 bg-gradient-to-r from-cyan-500/50 to-transparent" />
                <span className="text-white/20 font-black text-sm select-none">{"==="}</span>
              </div>
            </div>

            {/* Formation grid */}
            <div className="bg-[#080f1e] rounded-2xl border border-white/[0.08] p-3 sm:p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {FORMATIONS.map((f) => {
                  const color = FORMATION_COLORS[f.name] ?? "#06b6d4";
                  const sel = settings.formation === f.name;
                  return (
                    <button
                      key={f.name}
                      onClick={() => setSettings(prev => prev ? { ...prev, formation: f.name } : prev)}
                      style={sel ? {
                        borderColor: color,
                        boxShadow: `0 0 22px -4px ${color}70, inset 0 0 18px -10px ${color}30`,
                      } : {}}
                      className={`relative rounded-xl border-2 overflow-hidden transition-all duration-200 active:scale-[0.97] text-left ${
                        sel ? "" : "border-white/10 hover:border-white/25"
                      }`}
                    >
                      {/* Card background radial glow */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: sel
                            ? `radial-gradient(ellipse at 50% -10%, ${color}28 0%, #050b14 65%)`
                            : "radial-gradient(ellipse at 50% -10%, rgba(255,255,255,0.04) 0%, #050b14 65%)",
                        }}
                      />

                      {/* Star badge */}
                      {sel && (
                        <div
                          className="absolute top-1.5 right-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center z-10 shadow-lg"
                          style={{ background: color }}
                        >
                          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </div>
                      )}

                      {/* Formation name */}
                      <div className="relative px-2 pt-2 pb-0.5 text-center">
                        <span
                          className="text-xs sm:text-sm font-black italic leading-none"
                          style={{ color: sel ? color : "white" }}
                        >
                          {f.name}
                        </span>
                      </div>

                      {/* Mini pitch */}
                      <div className="relative px-1.5 pb-1.5">
                        <svg viewBox="0 0 100 100" className="w-full">
                          {/* Pitch background */}
                          <rect x="3" y="3" width="94" height="94" rx="4" fill="rgb(3,18,42)" />
                          {/* Pitch outline */}
                          <rect x="3" y="3" width="94" height="94" rx="4" stroke="rgba(255,255,255,0.13)" strokeWidth="0.9" fill="none" />
                          {/* Centre line */}
                          <line x1="3" y1="50" x2="97" y2="50" stroke="rgba(255,255,255,0.09)" strokeWidth="0.7" />
                          {/* Centre circle */}
                          <circle cx="50" cy="50" r="10" stroke="rgba(255,255,255,0.09)" strokeWidth="0.7" fill="none" />
                          {/* Top penalty box */}
                          <rect x="26" y="3" width="48" height="18" stroke="rgba(255,255,255,0.09)" strokeWidth="0.7" fill="none" />
                          {/* Bottom penalty box */}
                          <rect x="26" y="79" width="48" height="18" stroke="rgba(255,255,255,0.09)" strokeWidth="0.7" fill="none" />
                          {/* Player dots */}
                          {f.slots.map((slot, idx) => {
                            const cx = 3 + slot.x * 0.94;
                            const cy = 3 + slot.y * 0.94;
                            return (
                              <g key={idx}>
                                <circle cx={cx} cy={cy} r="7.5" fill={color} opacity="0.22" />
                                <circle cx={cx} cy={cy} r="4.8" fill={color} />
                                <circle cx={cx - 1.2} cy={cy - 1.2} r="1.8" fill="rgba(255,255,255,0.55)" />
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pro tip */}
            <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3 mb-5">
              <svg className="w-5 h-5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-0.5">Pro Tip</p>
                <p className="text-xs text-gray-300 leading-snug">Pick a formation that suits your players and playstyle. You can change it anytime!</p>
              </div>
            </div>

            {/* Start Draft */}
            <button
              onClick={() => { setPhase("draft"); scrollTop(); }}
              className="w-full py-4 rounded-xl font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.97] flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg,#059669 0%,#0891b2 100%)",
                boxShadow: "0 8px 28px -8px rgba(6,182,212,0.55)",
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Start Draft
            </button>
          </div>
        </div>
      )}
      {phase === "draft" && settings && (
        <DraftPick
          settings={settings}
          onComplete={handleDraftComplete}
          onBack={roomCode ? handleLeaveRoom : handleNewRun}
          isMultiplayer={!!roomCode}
          initialPicked={resume?.players}
          initialUsedClubYears={resume?.usedClubYears}
          initialSlotAssignments={resume?.slotAssignments}
          onProgress={handleProgress}
          respinsRemaining={respinsRemaining}
          onUseRespin={() => setRespinsRemaining(r => Math.max(0, r - 1))}
        />
      )}
      {phase === "manage" && players.length > 0 && (
        <SquadManager
          players={players}
          onConfirm={handleManageConfirm}
          title="Pre-Season"
          subtitle="Arrange Your Squad"
          formationName={settings?.formation}
          seasonNumber={currentSeason}
          isMultiplayer={!!roomCode}
          initialSpeed={settings?.simulationSpeed ?? 1}
        />
      )}
      {phase === "result" && (players.length > 0 || preComputedSeason !== null) && (
        <DraftResult
          players={players}
          onNewRun={handleNewRun}
          onPlayNextSeason={currentSeason < MAX_SEASONS ? handlePlayNextSeason : undefined}
          isFinalSeason={currentSeason >= MAX_SEASONS}
          seasonNumber={currentSeason}
          previousResult={previousResults[previousResults.length - 1]}
          allSeasonResults={previousResults}
          formationName={settings?.formation}
          isSignedIn={isSignedIn}
          preComputedSeason={preComputedSeason ?? undefined}
          roomPlayers={roomPlayers ?? undefined}
          roomCode={roomCode ?? undefined}
          allRoomPlayerSeasons={allRoomPlayerSeasons ?? undefined}
          mode={settings?.mode}
          revealStartTime={revealStartTime}
          speedMultiplier={settings?.simulationSpeed ?? 1}
          playerTeamName={teamName}
        />
      )}
      {phase === "pre-season" && (
        <Season2Overview
          departedPlayers={departedPlayers}
          ratingChanges={ratingChanges}
          season2Players={nextSeasonPlayers}
          onContinue={handlePreSeasonContinue}
          seasonNumber={currentSeason}
          previousFinish={previousResults.length > 0 ? previousResults[previousResults.length - 1].actualFinish : undefined}
        />
      )}
      {phase === "signing" && settings && signingSlots > 0 && (
        <DraftPick
          settings={{ ...settings, draftOrder: "club-first", respins: 0 }}
          onComplete={handleSigningComplete}
          totalPicks={signingSlots}
          existingSquad={nextSeasonPlayers}
          initialUsedClubYears={nextUsedClubYears}
          onProgress={() => {}}
        />
      )}
      {phase === "sell" && players.length > 0 && (
        <SellPhase
          players={players}
          onSell={handleSellPlayer}
          onSkip={handleSkipSell}
          seasonNumber={currentSeason}
          formationName={settings?.formation}
        />
      )}
      {phase === "sell-signing" && settings && (
        <DraftPick
          settings={{ ...settings, draftOrder: "club-first", respins: 0 }}
          onComplete={handleSellSigningComplete}
          totalPicks={1}
          existingSquad={players}
          initialUsedClubYears={nextUsedClubYears}
          onProgress={() => {}}
        />
      )}
      {phase === "arrange" && players.length > 0 && (
        <SquadManager
          players={players}
          onConfirm={handleArrangeConfirm}
          title={`Season ${currentSeason}`}
          subtitle="Arrange Your Squad"
          formationName={settings?.formation}
          seasonNumber={currentSeason}
          isMultiplayer={!!roomCode}
          initialSpeed={settings?.simulationSpeed ?? 1}
        />
      )}
    </div>
  );
}
