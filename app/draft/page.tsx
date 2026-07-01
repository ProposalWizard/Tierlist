"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import DraftSetup from "@/components/draft/DraftSetup";
import DraftPick from "@/components/draft/DraftPick";
import DraftResult from "@/components/draft/DraftResult";
import Season2Overview from "@/components/draft/Season2Overview";
import SquadManager from "@/components/draft/SquadManagerDev";
import MultiplayerLobby from "@/components/draft/MultiplayerLobby";
import { createClient } from "@/lib/supabase/client";
import { getPositionColor, FORMATIONS, formatSeasonYear } from "@/components/draft/formations";
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

type GamePhase = "setup" | "lobby" | "formation-pick" | "draft" | "manage" | "result" | "pre-season" | "signing" | "sell" | "sell-signing" | "arrange";

const STORAGE_KEY = "pl-draft-progress";
const MAX_SEASONS = 5;

interface SavedProgress {
  settings: DraftSettings;
  players: DraftPlayer[];
  usedClubYears: string[];
  slotAssignments?: (number | undefined)[];
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

function applyStatChange(player: DraftPlayer, change: number): DraftPlayer {
  const newPlayer = {
    ...player,
    overall: Math.max(1, Math.min(100, player.overall + change)),
  };
  if (newPlayer.attrs) {
    const attrs = { ...newPlayer.attrs };
    for (const key of Object.keys(attrs) as (keyof PlayerAttributes)[]) {
      attrs[key] = Math.max(1, Math.min(100, (attrs[key] as number) + change));
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
    if (
      saved.settings?.formation &&
      Array.isArray(saved.players) &&
      saved.players.length > 0 &&
      saved.players.length < 14
    ) {
      return saved;
    }
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

const SELL_POSITION_ORDER: Record<string, number> = { GK: 0, CB: 1, RB: 2, LB: 3, RWB: 2, LWB: 3, CDM: 4, DM: 4, CM: 5, CAM: 6, RM: 7, LM: 7, RW: 8, LW: 8, ST: 9, CF: 9 };

function SellPhase({ players, onSell, onSkip, seasonNumber }: {
  players: DraftPlayer[];
  onSell: (player: DraftPlayer) => void;
  onSkip: () => void;
  seasonNumber: number;
}) {
  const sorted = useMemo(
    () => [...players].sort((a, b) =>
      (a.isSub === b.isSub ? (SELL_POSITION_ORDER[a.assignedPosition] ?? 5) - (SELL_POSITION_ORDER[b.assignedPosition] ?? 5) : a.isSub ? 1 : -1)
    ),
    [players],
  );

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
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

      <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
        <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">
          Season {seasonNumber} Squad
        </h3>
        <div className="space-y-1">
          {sorted.map((p, i) => {
            const isSub = !!p.isSub;
            return (
              <button
                key={i}
                onClick={() => onSell(p)}
                className="w-full flex items-center gap-2 text-sm py-2.5 px-3 rounded-lg transition-all text-left hover:bg-red-900/30 border-2 border-transparent hover:border-red-400/50 active:scale-[0.98]"
              >
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-9 text-center ${isSub ? "bg-purple-500/20 text-purple-400" : `${getPositionColor(p.assignedPosition)} text-white`}`}>
                  {isSub ? "SUB" : p.assignedPosition}
                </span>
                <span className="flex-1 ml-1 font-medium">{p.name}</span>
                <span className="text-white text-[10px] font-medium">{p.clubYear}</span>
                <span className="font-black text-emerald-400 w-7 text-right">{p.overall}</span>
              </button>
            );
          })}
        </div>
      </div>

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
    setSettings(s);
    setPlayers([]);
    setRoomCode(null);
    setIsHost(false);
    setSquadSubmitted(false);
    setPreComputedSeason(null);
    setRoomPlayers(null);
    setRespinsRemaining(s.respins ?? 0);
    setPhase("draft");
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

    setPhase("lobby");
    scrollTop();
  }, [scrollTop, userId]);

  const handleStartFromLobby = useCallback(() => {
    if (currentSeason === 1) {
      setPhase("formation-pick");
    } else if (players.length > 0) {
      // Season 2+ with an existing squad (preserved from last season) — go straight to arrange
      setPhase("arrange");
    } else {
      setPhase("draft");
    }
    scrollTop();
  }, [scrollTop, currentSeason, players]);

  const handleSimulationComplete = useCallback((myResult: SeasonResult, allPlayers: RoomPlayer[], revealStartAt?: number) => {
    setRevealStartTime(revealStartAt ?? Date.now());
    setPreComputedSeason(myResult);
    setRoomPlayers(allPlayers);
    // Populate players from the user's room squad so handlePlayNextSeason has a squad to work with
    const myRoomPlayer = allPlayers.find(rp => rp.user_id === userId);
    if (myRoomPlayer?.squad && (myRoomPlayer.squad as DraftPlayer[]).length > 0) {
      setPlayers(myRoomPlayer.squad as DraftPlayer[]);
    }
    // Accumulate all room players' season results for group stats in CareerRecap
    setAllRoomPlayerSeasons(prev => {
      const next = { ...(prev ?? {}) };
      for (const rp of allPlayers) {
        if (rp.season_result) {
          const key = rp.display_name;
          if (!next[key]) next[key] = [];
          next[key] = [...next[key], rp.season_result];
        }
      }
      return next;
    });
    setPhase("result");
    scrollTop();
  }, [scrollTop, userId]);

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
    setPhase("setup");
    setRoomCode(null);
    setIsHost(false);
    setSquadSubmitted(false);
    setPreComputedSeason(null);
    setRoomPlayers(null);
    setPlayers([]);
    setSettings(null);
    scrollTop();
  }, [scrollTop]);

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
    setPlayers([]);
    setRespinsRemaining(resume.settings.respins ?? 0);
    setPhase("draft");
    scrollTop();
  }, [resume, scrollTop]);

  const handleDiscardResume = useCallback(() => {
    clearProgress();
    setResume(null);
  }, []);

  const handleProgress = useCallback(
    (picked: DraftPlayer[], usedClubYears: string[], slotAssignments?: (number | undefined)[]) => {
      if (!settings) return;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ settings, players: picked, usedClubYears, slotAssignments })
        );
      } catch {}
    },
    [settings]
  );

  const handleDraftComplete = useCallback((picked: DraftPlayer[]) => {
    clearProgress();
    setResume(null);
    setPlayers(picked);
    setPhase("manage");
    scrollTop();
  }, [scrollTop]);

  const handleManageConfirm = useCallback(async (arranged: DraftPlayer[], speed?: 0.5 | 1 | 1.5) => {
    setPlayers(arranged);
    if (!roomCode && speed !== undefined) {
      setSettings(prev => prev ? { ...prev, simulationSpeed: speed } : prev);
    }
    if (roomCode) {
      // Multiplayer: if this is a subsequent season, advance the room first (idempotent)
      if (currentSeason > 1) {
        await fetch(`/api/draft/rooms/${roomCode}/next-season`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nextSeasonNumber: currentSeason }),
        });
      }
      // Submit squad and go back to lobby
      const { teamStrength, avgOvr } = computeTeamStrength(arranged);
      await fetch(`/api/draft/rooms/${roomCode}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squad: arranged, avg_ovr: avgOvr, team_strength: teamStrength }),
      });
      setSquadSubmitted(true);
      setPhase("lobby");
    } else {
      setPhase("result");
    }
    scrollTop();
  }, [roomCode, currentSeason, scrollTop]);

  const handleNewRun = useCallback(() => {
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
  }, [scrollTop]);

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
        else if (avgRating >= 7.7) change = 2;
        else if (avgRating >= 7.0) change = 1;
        else if (avgRating <= 6.5) change = -1;

        const oldOverall = player.overall;
        const upgraded = applyStatChange(player, change);
        return { player: upgraded, oldOverall, newOverall: upgraded.overall, change };
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
      const trainingRoll = Math.floor(Math.random() * 3) + 1; // random +1, +2, or +3
      const updatedSquad = [
        ...nextSeasonPlayers.map((p) => {
          if (p.name !== trainingPlayerName) return p;
          const boost = p.overall >= 90 ? Math.min(2, trainingRoll) : trainingRoll;
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
    [nextSeasonPlayers, signingSlots, scrollTop]
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
      if (currentSeason > 1) {
        await fetch(`/api/draft/rooms/${roomCode}/next-season`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nextSeasonNumber: currentSeason }),
        });
      }
      const { teamStrength, avgOvr } = computeTeamStrength(arranged);
      await fetch(`/api/draft/rooms/${roomCode}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squad: arranged, avg_ovr: avgOvr, team_strength: teamStrength }),
      });
      setSquadSubmitted(true);
      setPhase("lobby");
    } else {
      setPhase("result");
    }
    scrollTop();
  }, [roomCode, currentSeason, scrollTop]);

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
                    Draft in progress
                  </div>
                  <div className="text-xs text-white">
                    {totalPicked}/14 picked &middot; {resume.settings.formation}
                    {resume.settings.mode === "prime" && " · Prime"}
                    {resume.settings.draftOrder === "club-first" && " · Club First"}
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
          <div className="text-center pb-6">
            <button
              onClick={handleSkipToTest}
              disabled={autoFilling}
              className="text-xs text-white hover:text-gray-500 underline transition disabled:cursor-wait"
            >
              {autoFilling ? "auto-drafting squad…" : "[test] skip draft → auto-fill squad"}
            </button>
          </div>
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
          onUpdateSettings={isHost ? handleUpdateRoomSettings : undefined}
          onSettingsSync={!isHost ? handleSettingsSync : undefined}
          defaultTeamName={teamName}
        />
      )}
      {phase === "formation-pick" && settings && (
        <div className="flex flex-col items-center justify-center min-h-screen px-3 sm:px-4 py-6">
          <div className="max-w-lg w-full">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 mb-4">
                <span className="text-xs font-bold tracking-widest uppercase text-emerald-400">Step 1</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight mb-2">Choose Your Formation</h1>
              <p className="text-white text-sm">Pick your formation before the draft begins</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-8">
              {FORMATIONS.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setSettings(prev => prev ? { ...prev, formation: f.name } : prev)}
                  className={`relative py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${
                    settings.formation === f.name
                      ? "bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950 shadow-lg shadow-emerald-900/50"
                      : "bg-gray-800/80 text-white hover:bg-gray-700 hover:text-gray-200 border border-gray-700/50"
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setPhase("draft"); scrollTop(); }}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
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
