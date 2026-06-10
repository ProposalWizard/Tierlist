"use client";
import { useState, useCallback } from "react";
import DraftSetup from "@/components/draft/DraftSetup";
import DraftPick from "@/components/draft/DraftPick";
import DraftResult from "@/components/draft/DraftResult";
import type { PlayerAttributes } from "@/lib/seasonSimulator";

export interface DraftSettings {
  formation: string;
  eraStart: number;
  eraEnd: number;
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

export default function DraftPage() {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [settings, setSettings] = useState<DraftSettings | null>(null);
  const [players, setPlayers] = useState<DraftPlayer[]>([]);

  const handleStartDraft = useCallback((s: DraftSettings) => {
    setSettings(s);
    setPlayers([]);
    setPhase("draft");
  }, []);

  const handleDraftComplete = useCallback((picked: DraftPlayer[]) => {
    setPlayers(picked);
    setPhase("result");
  }, []);

  const handleNewRun = useCallback(() => {
    setPhase("setup");
    setSettings(null);
    setPlayers([]);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {phase === "setup" && <DraftSetup onStart={handleStartDraft} />}
      {phase === "draft" && settings && (
        <DraftPick settings={settings} onComplete={handleDraftComplete} onBack={handleNewRun} />
      )}
      {phase === "result" && players.length > 0 && (
        <DraftResult players={players} onNewRun={handleNewRun} />
      )}
    </div>
  );
}
