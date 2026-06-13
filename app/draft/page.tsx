"use client";
import { useState, useCallback, useEffect } from "react";
import DraftSetup from "@/components/draft/DraftSetup";
import DraftPick from "@/components/draft/DraftPick";
import DraftResult from "@/components/draft/DraftResult";
import type { PlayerAttributes } from "@/lib/seasonSimulator";

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
  attrs?: PlayerAttributes;
}

type GamePhase = "setup" | "draft" | "result";

const STORAGE_KEY = "pl-draft-progress";

interface SavedProgress {
  settings: DraftSettings;
  players: DraftPlayer[];
  usedClubYears: string[];
  slotAssignments?: number[];
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
      saved.players.length < 11
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
  }, []);

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
                    {resume.players.length}/11 picked &middot; {resume.settings.formation}
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
        <DraftResult players={players} onNewRun={handleNewRun} />
      )}
    </div>
  );
}
