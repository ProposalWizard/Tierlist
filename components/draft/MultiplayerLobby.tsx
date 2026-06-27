"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SeasonResult } from "@/lib/seasonSimulator";
import type { DraftPlayer, DraftSettings } from "@/app/draft/page";

export interface RoomPlayer {
  id: string;
  user_id: string;
  display_name: string;
  status: "drafting" | "ready" | "simulated";
  avg_ovr: number | null;
  team_strength: number | null;
  actual_finish: number | null;
  season_result: SeasonResult | null;
  squad: DraftPlayer[] | null;
  joined_at: string;
}

export interface RoomData {
  id: string;
  code: string;
  host_id: string;
  status: "lobby" | "started" | "simulating" | "complete";
  settings?: Record<string, unknown>;
}

interface Props {
  roomCode: string;
  isHost: boolean;
  isAdmin?: boolean;
  userId: string;
  squadSubmitted: boolean;
  currentSeason?: number;
  settings?: DraftSettings | null;
  onStartDraft: () => void;
  onSimulationComplete: (myResult: SeasonResult, allPlayers: RoomPlayer[], revealStartAt?: number) => void;
  onCareerComplete?: (seasons: SeasonResult[], finalRoomPlayers: RoomPlayer[], allRoomPlayerSeasons?: Record<string, SeasonResult[]>) => void;
  onLeave: () => void;
  onUpdateSettings?: (settings: Partial<DraftSettings>) => void;
  onSettingsSync?: (settings: Partial<DraftSettings>) => void;
}

export default function MultiplayerLobby({
  roomCode,
  isHost,
  isAdmin = false,
  userId,
  squadSubmitted,
  currentSeason = 1,
  settings,
  onStartDraft,
  onSimulationComplete,
  onCareerComplete,
  onLeave,
  onUpdateSettings,
  onSettingsSync,
}: Props) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const completedRef = useRef(false);
  const revealStartAtRef = useRef<number | undefined>(undefined);
  const roomCodeRef = useRef(roomCode);
  const userIdRef = useRef(userId);
  const onSimCompleteRef = useRef(onSimulationComplete);
  const onSettingsSyncRef = useRef(onSettingsSync);
  roomCodeRef.current = roomCode;
  userIdRef.current = userId;
  onSimCompleteRef.current = onSimulationComplete;
  onSettingsSyncRef.current = onSettingsSync;

  const fetchRoom = useCallback(async () => {
    const res = await fetch(`/api/draft/rooms/${roomCodeRef.current}`);
    if (!res.ok) return;
    const data = await res.json();
    setRoom(data.room);
    setPlayers(data.players ?? []);
    return data;
  }, []);

  const tryComplete = useCallback((roomPlayers: RoomPlayer[], revealStartAt?: number) => {
    if (completedRef.current) return;
    const myPlayer = roomPlayers.find(p => p.user_id === userIdRef.current);
    if (!myPlayer?.season_result) return;
    completedRef.current = true;
    onSimCompleteRef.current(myPlayer.season_result, roomPlayers, revealStartAt ?? revealStartAtRef.current);
  }, []);

  // Realtime subscription + polling fallback (stable — no deps that change on re-render)
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const checkComplete = async () => {
      if (cancelled || completedRef.current) return;
      const d = await fetchRoom();
      if (d?.room?.status === "complete" && d.players) {
        const rsa = (d.room?.settings as Record<string, unknown> | undefined)?.revealStartAt;
        if (typeof rsa === "number") revealStartAtRef.current = rsa;
        tryComplete(d.players);
      }
    };

    fetchRoom().then((data) => {
      if (cancelled) return;
      setLoading(false);
      if (!data?.room) return;

      const roomId = data.room.id;
      if (data.room.status === "complete") {
        tryComplete(data.players ?? []);
        return;
      }

      channel = supabase
        .channel(`draft-room-${roomCodeRef.current}-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "draft_rooms", filter: `id=eq.${roomId}` },
          (payload) => {
            const updated = payload.new as RoomData;
            setRoom(updated);
            if (updated.status === "complete") {
              // Capture the server-side anchor time so all players animate in sync
              const rsa = (updated.settings as Record<string, unknown> | undefined)?.revealStartAt;
              if (typeof rsa === "number") revealStartAtRef.current = rsa;
              checkComplete();
            }
            if (updated.settings && onSettingsSyncRef.current) {
              // Strip internal fields before syncing game settings to parent
              const { revealStartAt: _rsa, ...gameSettings } = updated.settings as Record<string, unknown>;
              void _rsa;
              onSettingsSyncRef.current(gameSettings as Partial<DraftSettings>);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "draft_room_players", filter: `room_id=eq.${roomId}` },
          () => { fetchRoom(); }
        )
        .subscribe();

      pollTimer = setInterval(() => {
        if (completedRef.current) {
          if (pollTimer) clearInterval(pollTimer);
          return;
        }
        checkComplete();
      }, 5000);
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [roomCode, fetchRoom, tryComplete]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSimulate = async () => {
    setSimulating(true);
    setSimError(null);
    try {
      const res = await fetch(`/api/draft/rooms/${roomCode}/simulate`, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        setSimError(text || "Simulation failed");
        setSimulating(false);
        return;
      }
      // Capture server-side anchor time for synchronized animation
      const data = await res.json().catch(() => ({}));
      if (typeof data.revealStartAt === "number") revealStartAtRef.current = data.revealStartAt;
      // Use players from simulate response to avoid an extra fetchRoom round-trip
      if (data.players?.length) {
        tryComplete(data.players, revealStartAtRef.current);
      } else {
        const d = await fetchRoom();
        if (d?.room?.status === "complete" && d.players) {
          tryComplete(d.players, revealStartAtRef.current);
        }
      }
    } catch {
      setSimError("Network error — try again");
      setSimulating(false);
    }
  };

  const handleDevSkip = async () => {
    setSimulating(true);
    setSimError(null);
    completedRef.current = false;
    try {
      const res = await fetch(`/api/draft/rooms/${roomCode}/dev-skip`, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        setSimError(text || "Dev skip failed");
        setSimulating(false);
        return;
      }
      const d = await fetchRoom();
      if (d?.room?.status === "complete" && d.players) {
        tryComplete(d.players);
      }
    } catch {
      setSimError("Network error — try again");
      setSimulating(false);
    }
  };

  const handleDevSkipCareer = async () => {
    if (!onCareerComplete) return;
    setSimulating(true);
    setSimError(null);
    try {
      const res = await fetch(`/api/draft/rooms/${roomCode}/dev-skip-career`, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        setSimError(text || "Career skip failed");
        setSimulating(false);
        return;
      }
      const data = await res.json();
      onCareerComplete(data.seasons as SeasonResult[], data.finalRoomPlayers as RoomPlayer[], data.allRoomPlayerSeasons as Record<string, SeasonResult[]> | undefined);
    } catch {
      setSimError("Network error — try again");
      setSimulating(false);
    }
  };

  const allReady = players.length > 1 && players.every(p => p.status === "ready" || p.status === "simulated");
  const myPlayer = players.find(p => p.user_id === userId);
  const isSimulating = room?.status === "simulating";
  const gameStarted = room?.status === "started";

  // When room transitions to "started", all players auto-transition to formation pick
  const gameStartedHandled = useRef(false);
  useEffect(() => {
    if (gameStarted && !gameStartedHandled.current && !squadSubmitted) {
      gameStartedHandled.current = true;
      onStartDraft();
    }
  }, [gameStarted, squadSubmitted, onStartDraft]);

  const handleStartGame = async () => {
    if (!isHost || players.length < 2) return;
    try {
      await fetch(`/api/draft/rooms/${roomCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "started" }),
      });
      onStartDraft();
    } catch {
      // Fallback: just start locally
      onStartDraft();
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 pb-20">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 mb-4">
          <span className="text-xs font-bold tracking-widest uppercase text-emerald-400">Multiplayer</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white mb-1">Lobby</h1>
        <p className="text-white text-sm">
          {currentSeason > 1 ? `Season ${currentSeason} — submit your squad to continue` : "Share the code so friends can join"}
        </p>
      </div>

      {/* Room Code */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
        <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Room Code</div>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-3xl font-black tracking-[0.3em] text-emerald-400 font-mono" style={{ fontFeatureSettings: '"zero" 1' }}>
            {roomCode}
          </div>
          <button
            onClick={handleCopyCode}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-bold transition-all active:scale-95 border border-gray-700/50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Room Settings */}
      {settings && (() => {
        const canEdit = isHost && !!onUpdateSettings && room?.status === "lobby" && currentSeason === 1;
        const respinLabel = settings.respins === 0 ? "No re-spins" : settings.respins === 1 ? "1 re-spin" : "3 re-spins";
        return (
          <div className="bg-gray-900 rounded-xl p-3 mb-4 border border-gray-800/50">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[10px] font-bold tracking-widest text-white uppercase">Settings</div>
              <div className="text-[10px] text-gray-500">Formation chosen individually</div>
            </div>

            {/* Era row — always shows dropdowns for host in lobby, badges otherwise */}
            {canEdit ? (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-bold text-gray-400 shrink-0">Era</span>
                <div className="relative flex-1">
                  <select
                    value={settings.eraStart}
                    onChange={(e) => onUpdateSettings!({ eraStart: Number(e.target.value) })}
                    className="w-full appearance-none bg-gray-800 border border-gray-700/50 rounded px-2 py-1 text-[11px] font-medium text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {Array.from({ length: 20 }, (_, i) => 2007 + i).map((y) => (
                      <option key={y} value={y}>{y - 1}/{String(y % 100).padStart(2, "0")}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">to</span>
                <div className="relative flex-1">
                  <select
                    value={settings.eraEnd}
                    onChange={(e) => onUpdateSettings!({ eraEnd: Number(e.target.value) })}
                    className="w-full appearance-none bg-gray-800 border border-gray-700/50 rounded px-2 py-1 text-[11px] font-medium text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {Array.from({ length: 20 }, (_, i) => 2007 + i).map((y) => (
                      <option key={y} value={y}>{y - 1}/{String(y % 100).padStart(2, "0")}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Compact toggle grid — 2 rows of 3 */}
            <div className="grid grid-cols-3 gap-1">
              {/* Era badge (read-only view) */}
              {!canEdit && (
                <span className="col-span-3 text-center text-[11px] font-bold bg-gray-800 text-white px-2 py-1 rounded mb-0.5">
                  FIFA {settings.eraStart}–{settings.eraEnd}
                </span>
              )}

              {/* Mode */}
              {canEdit ? (
                <button
                  onClick={() => onUpdateSettings!({ mode: settings.mode === "normal" ? "prime" : "normal" })}
                  className={`py-1 px-1.5 rounded text-[11px] font-bold transition-all ${
                    settings.mode === "prime" ? "bg-amber-600 text-white" : "bg-gray-800 text-white hover:bg-gray-700"
                  }`}
                >
                  {settings.mode === "prime" ? "⭐ Prime" : "Normal"}
                </button>
              ) : (
                <span className={`py-1 px-1.5 rounded text-[11px] font-bold text-center ${
                  settings.mode === "prime" ? "bg-amber-600/20 text-amber-400" : "bg-gray-800 text-white"
                }`}>
                  {settings.mode === "prime" ? "⭐ Prime" : "Normal"}
                </span>
              )}

              {/* Draft Order */}
              {canEdit ? (
                <button
                  onClick={() => onUpdateSettings!({ draftOrder: settings.draftOrder === "club-first" ? "position-first" : "club-first" })}
                  className="py-1 px-1.5 rounded text-[11px] font-bold bg-gray-800 text-white hover:bg-gray-700 transition-all"
                >
                  {settings.draftOrder === "club-first" ? "Club 1st" : "Pos 1st"}
                </button>
              ) : (
                <span className="py-1 px-1.5 rounded text-[11px] font-bold text-center bg-gray-800 text-white">
                  {settings.draftOrder === "club-first" ? "Club 1st" : "Pos 1st"}
                </span>
              )}

              {/* Re-spins */}
              {canEdit ? (
                <button
                  onClick={() => onUpdateSettings!({ respins: settings.respins === 3 ? 1 : settings.respins === 1 ? 0 : 3 })}
                  className="py-1 px-1.5 rounded text-[11px] font-bold bg-gray-800 text-white hover:bg-gray-700 transition-all"
                >
                  {respinLabel}
                </button>
              ) : (
                <span className="py-1 px-1.5 rounded text-[11px] font-bold text-center bg-gray-800 text-white">
                  {respinLabel}
                </span>
              )}

              {/* Ratings */}
              {canEdit ? (
                <button
                  onClick={() => onUpdateSettings!({ hiddenRatings: !settings.hiddenRatings })}
                  className={`col-span-3 py-1 px-1.5 rounded text-[11px] font-bold transition-all ${
                    settings.hiddenRatings ? "bg-purple-700/40 text-purple-300 hover:bg-purple-700/60" : "bg-gray-800 text-white hover:bg-gray-700"
                  }`}
                >
                  {settings.hiddenRatings ? "Ratings: Hidden" : "Ratings: Visible"}
                </button>
              ) : (
                <span className={`col-span-3 py-1 px-1.5 rounded text-[11px] font-bold text-center ${
                  settings.hiddenRatings ? "bg-purple-700/20 text-purple-400" : "bg-gray-800 text-white"
                }`}>
                  {settings.hiddenRatings ? "Ratings: Hidden" : "Ratings: Visible"}
                </span>
              )}
            </div>

            {canEdit && (
              <p className="text-[9px] text-gray-500 mt-2 text-center">Tap any setting to change · Settings lock when game starts</p>
            )}
          </div>
        );
      })()}

      {/* Simulating state */}
      {isSimulating && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 mb-4 text-center">
          <div className="flex items-center justify-center gap-2 text-amber-400">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="font-bold text-sm">Simulating season...</span>
          </div>
        </div>
      )}

      {/* Players list */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
        <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">
          Players ({players.length})
        </div>
        {loading ? (
          <div className="text-white text-sm text-center py-4">Loading...</div>
        ) : (
          <div className="space-y-2">
            {players.map((p) => {
              const isMe = p.user_id === userId;
              const isExpanded = expandedPlayer === p.user_id;
              return (
                <div key={p.user_id} className="rounded-lg border border-gray-800/50 overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/40 transition text-left"
                    onClick={() => p.squad ? setExpandedPlayer(isExpanded ? null : p.user_id) : undefined}
                  >
                    {/* Host crown */}
                    {room?.host_id === p.user_id && (
                      <span className="text-sm" title="Host">&#128081;</span>
                    )}
                    <span className={`flex-1 font-bold text-sm ${isMe ? "text-emerald-400" : "text-white"}`}>
                      {p.display_name}
                      {isMe && <span className="text-white font-normal text-xs ml-1">(you)</span>}
                    </span>
                    {/* Avg OVR + Team Rating */}
                    {p.avg_ovr !== null && (
                      <span className="text-xs font-bold text-white bg-gray-800 px-2 py-0.5 rounded">
                        OVR {p.avg_ovr}
                      </span>
                    )}
                    {p.team_strength !== null && (
                      <span className="text-xs font-bold text-blue-400 bg-blue-900/30 border border-blue-800/40 px-2 py-0.5 rounded">
                        STR {Math.round(p.team_strength)}
                      </span>
                    )}
                    {/* Status badge */}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                      p.status === "simulated"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : p.status === "ready"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-yellow-500/10 text-yellow-500/80 border border-yellow-500/20"
                    }`}>
                      {p.status === "simulated" ? "Done" : p.status === "ready" ? "Ready" : "Drafting"}
                    </span>
                    {/* Expand arrow */}
                    {p.squad && (
                      <svg className={`w-3 h-3 text-white transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>

                  {/* Squad preview */}
                  {isExpanded && p.squad && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-800/50 bg-gray-800/20">
                      <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">
                        Squad
                        {p.team_strength !== null && (
                          <span className="ml-2 text-blue-400 normal-case font-bold">
                            STR {Math.round(p.team_strength)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {[...p.squad]
                          .sort((a, b) => {
                            if (a.isSub !== b.isSub) return a.isSub ? 1 : -1;
                            const order: Record<string, number> = { GK: 0, CB: 1, LB: 2, RB: 3, RWB: 3, LWB: 2, CDM: 4, CM: 5, CAM: 6, LM: 7, RM: 8, LW: 9, RW: 10, CF: 11, ST: 12 };
                            return (order[a.assignedPosition] ?? 6) - (order[b.assignedPosition] ?? 6);
                          })
                          .map((player, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            <span className={`text-[9px] font-bold px-1 py-0.5 rounded w-8 text-center shrink-0 ${
                              player.isSub ? "bg-gray-700 text-white" : "bg-purple-600 text-white"
                            }`}>
                              {player.isSub ? "SUB" : player.assignedPosition}
                            </span>
                            <span className="truncate text-white">{player.name}</span>
                            <span className="text-white font-bold shrink-0">{player.overall}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {players.length < 2 && (
              <div className="text-center text-white text-xs py-2">
                Waiting for others to join...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {!squadSubmitted && !isSimulating && !gameStarted && (
        currentSeason === 1 ? (
          isHost ? (
            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] mb-3 mt-6 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Start Game
            </button>
          ) : (
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 mb-3 mt-6 text-center">
              <div className="text-white font-bold text-sm mb-0.5">Waiting for host</div>
              <div className="text-white text-xs">The host will start the game when everyone is ready</div>
            </div>
          )
        ) : (
          <button
            onClick={onStartDraft}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] mb-3 mt-6 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Arrange Season {currentSeason} Squad
          </button>
        )
      )}

      {squadSubmitted && !isSimulating && (
        <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-4 mb-3 text-center">
          <div className="text-emerald-400 font-bold text-sm mb-0.5">Squad Submitted</div>
          <div className="text-white text-xs">
            {allReady
              ? isHost
                ? "All players ready — you can start the simulation!"
                : "All players ready — waiting for host to simulate"
              : "Waiting for others to submit their squads..."}
          </div>
        </div>
      )}

      {isHost && allReady && !isSimulating && (
        <>
          {simError && (
            <div className="text-red-400 text-xs text-center mb-2">{simError}</div>
          )}
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 rounded-xl font-bold text-lg transition-all shadow-lg shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] mb-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {simulating ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            Simulate Season {currentSeason}
          </button>
        </>
      )}

      {/* Admin dev skip — fills random squads + simulates instantly */}
      {isAdmin && isHost && !isSimulating && (
        <>
          <button
            onClick={handleDevSkip}
            disabled={simulating}
            className="w-full py-2.5 mb-1.5 rounded-xl border border-dashed border-orange-700/50 bg-orange-900/10 text-orange-400 text-xs font-bold tracking-wider uppercase hover:bg-orange-900/20 transition disabled:opacity-40"
          >
            ⚡ Dev Skip — Random Squads &amp; Simulate
          </button>
          {onCareerComplete && (
            <button
              onClick={handleDevSkipCareer}
              disabled={simulating}
              className="w-full py-2.5 mb-3 rounded-xl border border-dashed border-purple-700/50 bg-purple-900/10 text-purple-400 text-xs font-bold tracking-wider uppercase hover:bg-purple-900/20 transition disabled:opacity-40"
            >
              🏆 Dev Skip Full Career (5 Seasons)
            </button>
          )}
        </>
      )}

      {!isHost && squadSubmitted && (
        <p className="text-center text-xs text-white mb-3">
          {myPlayer?.display_name && `${players.find(p => p.user_id === room?.host_id)?.display_name ?? "Host"} will start the simulation`}
        </p>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onLeave();
        }}
        className="w-full py-2.5 text-sm font-bold text-white hover:text-gray-400 transition"
      >
        Leave Room
      </button>
    </div>
  );
}
