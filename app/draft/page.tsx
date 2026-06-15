"use client";
import { useState, useCallback, useEffect } from "react";
import DraftSetup from "@/components/draft/DraftSetup";
import DraftPick from "@/components/draft/DraftPick";
import DraftResult from "@/components/draft/DraftResult";
import Season2Overview from "@/components/draft/Season2Overview";
import SquadManager from "@/components/draft/SquadManager";
import { createClient } from "@/lib/supabase/client";
import { getPositionColor } from "@/components/draft/formations";
import type { PlayerAttributes, SeasonResult } from "@/lib/seasonSimulator";

export interface DraftSettings {
  formation: string;
  eraStart: number;
  eraEnd: number;
  mode: "normal" | "prime";
  draftOrder: "position-first" | "club-first";
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

type GamePhase = "setup" | "draft" | "manage" | "result" | "pre-season" | "signing" | "sell" | "sell-signing" | "arrange";

const STORAGE_KEY = "pl-draft-progress";
const MAX_SEASONS = 3;

interface SavedProgress {
  settings: DraftSettings;
  players: DraftPlayer[];
  usedClubYears: string[];
  slotAssignments?: number[];
}

interface DepartedPlayer {
  player: DraftPlayer;
  reason: string;
}

interface RatingChange {
  player: DraftPlayer;
  oldOverall: number;
  newOverall: number;
  change: number;
}

function applyStatChange(player: DraftPlayer, change: number): DraftPlayer {
  const newPlayer = {
    ...player,
    overall: Math.max(1, Math.min(99, player.overall + change)),
  };
  if (newPlayer.attrs) {
    const attrs = { ...newPlayer.attrs };
    for (const key of Object.keys(attrs) as (keyof PlayerAttributes)[]) {
      attrs[key] = Math.max(1, Math.min(99, (attrs[key] as number) + change));
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

function SellPhase({ players, onSell, onSkip, seasonNumber }: {
  players: DraftPlayer[];
  onSell: (player: DraftPlayer) => void;
  onSkip: () => void;
  seasonNumber: number;
}) {
  const [selected, setSelected] = useState<DraftPlayer | null>(null);

  const positionOrder: Record<string, number> = { GK: 0, CB: 1, RB: 2, LB: 3, RWB: 2, LWB: 3, CDM: 4, DM: 4, CM: 5, CAM: 6, RM: 7, LM: 7, RW: 8, LW: 8, ST: 9, CF: 9 };
  const sorted = [...players].sort((a, b) =>
    (a.isSub === b.isSub ? (positionOrder[a.assignedPosition] ?? 5) - (positionOrder[b.assignedPosition] ?? 5) : a.isSub ? 1 : -1)
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
        <p className="text-gray-500 text-sm mt-1">
          Optionally sell one player and spin for a replacement.
        </p>
      </div>

      {selected && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-red-400">
              Sell {selected.name}?
            </span>
            <span className="text-xs text-gray-500 ml-2">
              OVR {selected.overall} &middot; {selected.assignedPosition}
            </span>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSell(selected)}
            className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 rounded-lg transition"
          >
            Confirm Sale
          </button>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
        <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">
          Season {seasonNumber} Squad
        </h3>
        <div className="space-y-1">
          {sorted.map((p, i) => {
            const isSelected = selected === p;
            const isSub = !!p.isSub;
            return (
              <button
                key={i}
                onClick={() => setSelected(isSelected ? null : p)}
                className={`w-full flex items-center gap-2 text-sm py-2.5 px-3 rounded-lg transition-all text-left ${
                  isSelected
                    ? "bg-red-900/40 border-2 border-red-400 scale-[1.01]"
                    : "hover:bg-gray-800/50 border-2 border-transparent"
                }`}
              >
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-9 text-center`}>
                  {p.assignedPosition}
                </span>
                <span className="flex-1 ml-1 font-medium">{p.name}</span>
                {isSub && (
                  <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                    SUB
                  </span>
                )}
                <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
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
  const [nextUsedClubYears, setNextUsedClubYears] = useState<string[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    setResume(loadProgress());
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user);
    });
  }, []);

  const handleStartDraft = useCallback((s: DraftSettings) => {
    clearProgress();
    setResume(null);
    setSettings(s);
    setPlayers([]);
    setPhase("draft");
  }, []);

  const handleResume = useCallback(() => {
    if (!resume) return;
    setSettings(resume.settings);
    setPlayers([]);
    setPhase("draft");
  }, [resume]);

  const handleDiscardResume = useCallback(() => {
    clearProgress();
    setResume(null);
  }, []);

  const handleProgress = useCallback(
    (picked: DraftPlayer[], usedClubYears: string[], slotAssignments?: number[]) => {
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
  }, []);

  const handleManageConfirm = useCallback((arranged: DraftPlayer[]) => {
    setPlayers(arranged);
    setPhase("result");
  }, []);

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
  }, []);

  const handlePlayNextSeason = useCallback(
    (season: SeasonResult, currentPlayers: DraftPlayer[]) => {
      const sorted = [...currentPlayers].sort((a, b) => (b.age || 0) - (a.age || 0));
      const departed: DepartedPlayer[] = [];

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

      const usedCYs = currentPlayers.map((p) => `${p.club}-${p.clubYear.split(" ")[1]}`);

      setDepartedPlayers(departed);
      setRatingChanges(changes);
      setNextSeasonPlayers(changes.map((rc) => rc.player));
      setPreviousResults((prev) => [...prev, season]);
      setNextUsedClubYears(usedCYs);
      setCurrentSeason((s) => s + 1);
      setPhase("pre-season");
    },
    []
  );

  const handlePreSeasonContinue = useCallback(
    (trainingPlayerName: string) => {
      setNextSeasonPlayers((prev) =>
        prev.map((p) =>
          p.name === trainingPlayerName ? applyStatChange(p, 3) : p
        )
      );
      setPhase("signing");
    },
    []
  );

  const handleSigningComplete = useCallback(
    (newPlayers: DraftPlayer[]) => {
      const boosted = newPlayers.map((p) => {
        const boost = Math.floor(Math.random() * 3) + 1;
        return applyStatChange(p, boost);
      });

      const fullSquad = [...nextSeasonPlayers, ...boosted];
      setPlayers(fullSquad);
      setPhase("sell");
    },
    [nextSeasonPlayers]
  );

  const handleSellPlayer = useCallback(
    (soldPlayer: DraftPlayer) => {
      setPlayers((prev) => prev.filter((p) => p !== soldPlayer));
      setPhase("sell-signing");
    },
    []
  );

  const handleSkipSell = useCallback(() => {
    setPhase("arrange");
  }, []);

  const handleSellSigningComplete = useCallback(
    (newPlayers: DraftPlayer[]) => {
      const boosted = newPlayers.map((p) => {
        const boost = Math.floor(Math.random() * 3) + 1;
        return applyStatChange(p, boost);
      });

      setPlayers((prev) => [...prev, ...boosted]);
      setPhase("arrange");
    },
    []
  );

  const handleArrangeConfirm = useCallback((arranged: DraftPlayer[]) => {
    setPlayers(arranged);
    setPhase("result");
  }, []);

  const totalPicked = resume?.players.length ?? 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {phase === "setup" && (
        <>
          {resume && (
            <div className="max-w-2xl mx-auto px-4 pt-4">
              <div className="flex items-center gap-3 bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-emerald-400">
                    Draft in progress
                  </div>
                  <div className="text-xs text-gray-400">
                    {totalPicked}/14 picked &middot; {resume.settings.formation}
                    {resume.settings.mode === "prime" && " · Prime"}
                    {resume.settings.draftOrder === "club-first" && " · Club First"}
                  </div>
                </div>
                <button
                  onClick={handleDiscardResume}
                  className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
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
          <DraftSetup onStart={handleStartDraft} />
        </>
      )}
      {phase === "draft" && settings && (
        <DraftPick
          settings={settings}
          onComplete={handleDraftComplete}
          onBack={handleNewRun}
          initialPicked={resume?.players}
          initialUsedClubYears={resume?.usedClubYears}
          initialSlotAssignments={resume?.slotAssignments}
          onProgress={handleProgress}
        />
      )}
      {phase === "manage" && players.length > 0 && (
        <SquadManager
          players={players}
          onConfirm={handleManageConfirm}
          title="Pre-Season"
          subtitle="Arrange Your Squad"
          formationName={settings?.formation}
        />
      )}
      {phase === "result" && players.length > 0 && (
        <DraftResult
          players={players}
          onNewRun={handleNewRun}
          onPlayNextSeason={currentSeason < MAX_SEASONS ? handlePlayNextSeason : undefined}
          seasonNumber={currentSeason}
          previousResult={previousResults[previousResults.length - 1]}
          formationName={settings?.formation}
          isSignedIn={isSignedIn}
        />
      )}
      {phase === "pre-season" && (
        <Season2Overview
          departedPlayers={departedPlayers}
          ratingChanges={ratingChanges}
          season2Players={nextSeasonPlayers}
          onContinue={handlePreSeasonContinue}
          seasonNumber={currentSeason}
        />
      )}
      {phase === "signing" && settings && (
        <DraftPick
          settings={{ ...settings, draftOrder: "club-first" }}
          onComplete={handleSigningComplete}
          totalPicks={2}
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
          settings={{ ...settings, draftOrder: "club-first" }}
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
        />
      )}
    </div>
  );
}
