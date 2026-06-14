"use client";
import { useState, useCallback, useEffect } from "react";
import DraftSetup from "@/components/draft/DraftSetup";
import DraftPick from "@/components/draft/DraftPick";
import DraftResult from "@/components/draft/DraftResult";
import Season2Overview from "@/components/draft/Season2Overview";
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

type GamePhase = "setup" | "draft" | "result" | "season2-overview" | "season2-draft" | "season2-result";

const STORAGE_KEY = "pl-draft-progress";

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

export default function DraftPage() {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [settings, setSettings] = useState<DraftSettings | null>(null);
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [resume, setResume] = useState<SavedProgress | null>(null);

  const [season1Result, setSeason1Result] = useState<SeasonResult | null>(null);
  const [season2Players, setSeason2Players] = useState<DraftPlayer[]>([]);
  const [departedPlayers, setDepartedPlayers] = useState<DepartedPlayer[]>([]);
  const [ratingChanges, setRatingChanges] = useState<RatingChange[]>([]);
  const [season2UsedClubYears, setSeason2UsedClubYears] = useState<string[]>([]);

  useEffect(() => {
    setResume(loadProgress());
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
    setPhase("result");
  }, []);

  const handleNewRun = useCallback(() => {
    clearProgress();
    setResume(null);
    setPhase("setup");
    setSettings(null);
    setPlayers([]);
    setSeason1Result(null);
    setSeason2Players([]);
    setDepartedPlayers([]);
    setRatingChanges([]);
    setSeason2UsedClubYears([]);
  }, []);

  const handlePlaySeason2 = useCallback(
    (season: SeasonResult, currentPlayers: DraftPlayer[]) => {
      const sorted = [...currentPlayers].sort((a, b) => (b.age || 0) - (a.age || 0));
      const oldestPlayer = sorted[0];

      const afterRetirement = currentPlayers.filter((p) => p !== oldestPlayer);
      const randomIdx = Math.floor(Math.random() * afterRetirement.length);
      const randomDeparture = afterRetirement[randomIdx];

      const remaining = currentPlayers.filter(
        (p) => p !== oldestPlayer && p !== randomDeparture
      );

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

      const departed: DepartedPlayer[] = [
        { player: randomDeparture, reason: "Left the club" },
        { player: oldestPlayer, reason: `Retired (age ${oldestPlayer.age || "?"})` },
      ];

      const usedCYs = currentPlayers.map((p) => `${p.club}-${p.clubYear.split(" ")[1]}`);

      setDepartedPlayers(departed);
      setRatingChanges(changes);
      setSeason2Players(changes.map((rc) => rc.player));
      setSeason1Result(season);
      setSeason2UsedClubYears(usedCYs);
      setPhase("season2-overview");
    },
    []
  );

  const handleSeason2Continue = useCallback(
    (trainingPlayerName: string) => {
      setSeason2Players((prev) =>
        prev.map((p) =>
          p.name === trainingPlayerName ? applyStatChange(p, 3) : p
        )
      );
      setPhase("season2-draft");
    },
    []
  );

  const handleSeason2DraftComplete = useCallback(
    (newPlayers: DraftPlayer[]) => {
      const boosted = newPlayers.map((p) => {
        const boost = Math.floor(Math.random() * 3) + 1;
        return applyStatChange(p, boost);
      });

      const fullSquad = [...season2Players, ...boosted];
      setPlayers(fullSquad);
      setPhase("season2-result");
    },
    [season2Players]
  );

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
      {phase === "result" && players.length > 0 && (
        <DraftResult
          players={players}
          onNewRun={handleNewRun}
          onPlaySeason2={handlePlaySeason2}
          seasonNumber={1}
        />
      )}
      {phase === "season2-overview" && (
        <Season2Overview
          departedPlayers={departedPlayers}
          ratingChanges={ratingChanges}
          season2Players={season2Players}
          onContinue={handleSeason2Continue}
        />
      )}
      {phase === "season2-draft" && settings && (
        <DraftPick
          settings={{ ...settings, draftOrder: "club-first" }}
          onComplete={handleSeason2DraftComplete}
          totalPicks={2}
          existingSquad={season2Players}
          initialUsedClubYears={season2UsedClubYears}
          onProgress={() => {}}
        />
      )}
      {phase === "season2-result" && players.length > 0 && (
        <DraftResult
          players={players}
          onNewRun={handleNewRun}
          seasonNumber={2}
          season1Result={season1Result ?? undefined}
        />
      )}
    </div>
  );
}
