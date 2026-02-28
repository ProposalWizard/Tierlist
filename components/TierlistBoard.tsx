"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

import TierRow from "./TierRow";
import PlayerCard from "./PlayerCard";
import { TIERS, type Tier, type TierMap, type TierlistPlayer, type TierlistTopic } from "@/lib/types";
import type { SaveRankingPayload } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface TierlistBoardProps {
  topic: TierlistTopic;
  players: TierlistPlayer[];
  existingRankings: { player_id: string; tier: Tier }[];
  userId: string;
}

// ── Helper: build initial tierMap from existing DB rankings ───────────────

function buildInitialTierMap(
  players: TierlistPlayer[],
  existingRankings: { player_id: string; tier: Tier }[]
): TierMap {
  const map: TierMap = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    unranked: players.map((p) => p.id),
  };

  for (const { player_id, tier } of existingRankings) {
    map.unranked = map.unranked.filter((id) => id !== player_id);
    map[tier].push(player_id);
  }

  return map;
}

// ── Unranked pool ─────────────────────────────────────────────────────────

function UnrankedPool({
  players,
  activePlayerId,
}: {
  players: TierlistPlayer[];
  activePlayerId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-3 transition-colors ${
        isOver ? "border-indigo-400 bg-gray-800" : "border-dashed border-gray-700 bg-gray-900/50"
      }`}
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Unranked Players — drag into a tier
      </h3>
      <div className="flex min-h-[60px] flex-wrap gap-2">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            isDragging={activePlayerId === player.id}
          />
        ))}
        {players.length === 0 && (
          <span className="flex items-center text-xs text-gray-600 italic">
            All players ranked!
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const VALID_CONTAINERS = new Set<string>([...TIERS, "unranked"]);

export default function TierlistBoard({
  topic,
  players,
  existingRankings,
  userId,
}: TierlistBoardProps) {
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  const [tierMap, setTierMap] = useState<TierMap>(() =>
    buildInitialTierMap(players, existingRankings)
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Find which container a player currently lives in
  const findContainer = useCallback(
    (playerId: string): Tier | "unranked" | undefined => {
      for (const key of [...TIERS, "unranked"] as Array<Tier | "unranked">) {
        if (tierMap[key].includes(playerId)) return key;
      }
      return undefined;
    },
    [tierMap]
  );

  // ── Drag handlers ──────────────────────────────────────────────────────

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);

    if (!over) return;

    const playerId = active.id as string;
    const targetContainer = over.id as string;

    // Only accept drops onto valid containers (tier rows + unranked pool)
    if (!VALID_CONTAINERS.has(targetContainer)) return;

    const sourceContainer = findContainer(playerId);
    if (!sourceContainer || sourceContainer === targetContainer) return;

    setTierMap((prev) => ({
      ...prev,
      [sourceContainer]: prev[sourceContainer as Tier | "unranked"].filter(
        (id) => id !== playerId
      ),
      [targetContainer]: [
        ...prev[targetContainer as Tier | "unranked"],
        playerId,
      ],
    }));
  }

  // ── Save handler ─────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);

    const rankings: SaveRankingPayload["rankings"] = [];
    for (const tier of TIERS) {
      for (const playerId of tierMap[tier]) {
        rankings.push({ player_id: playerId, tier });
      }
    }

    try {
      const res = await fetch("/api/tierlist/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic_id: topic.id, rankings } satisfies SaveRankingPayload),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Failed to save");
      }

      setSaveMessage({ type: "success", text: "Rankings saved!" });
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setSaving(false);
    }
  }

  const rankedCount = TIERS.reduce((sum, t) => sum + tierMap[t].length, 0);

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {TIERS.map((tier) => (
          <TierRow
            key={tier}
            tier={tier}
            players={tierMap[tier].map((id) => playerMap[id]).filter(Boolean)}
            activePlayerId={activeId}
          />
        ))}

        <UnrankedPool
          players={tierMap.unranked.map((id) => playerMap[id]).filter(Boolean)}
          activePlayerId={activeId}
        />

        <DragOverlay>
          {activeId && playerMap[activeId] ? (
            <div className="rotate-2 scale-105 shadow-2xl opacity-95">
              <PlayerCard player={playerMap[activeId]} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Save section */}
      <div className="flex items-center justify-between rounded-xl border border-gray-700 bg-gray-900 p-4">
        <span className="text-sm text-gray-400">
          {rankedCount}/{players.length} players ranked
        </span>

        <div className="flex items-center gap-3">
          {saveMessage && (
            <span
              className={`text-sm ${
                saveMessage.type === "success" ? "text-green-400" : "text-red-400"
              }`}
            >
              {saveMessage.text}
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Rankings"}
          </button>
        </div>
      </div>
    </div>
  );
}
