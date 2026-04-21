"use client";

import { useState } from "react";
import type { BlindRankingImage } from "@/lib/types";

function displayName(img: BlindRankingImage): string {
  return img.name?.trim() || "???";
}

interface Props {
  rankingId: string;
  title: string;
  numSlots: number;
  images: BlindRankingImage[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type GameState = "ready" | "playing" | "complete";

export default function BlindRankingBoard({ title, numSlots, images }: Props) {
  const [gameState, setGameState] = useState<GameState>("ready");
  const [slots, setSlots] = useState<(BlindRankingImage | null)[]>(Array(numSlots).fill(null));
  const [queue, setQueue] = useState<BlindRankingImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  const currentPlayer = gameState === "playing" ? queue[currentIndex] : null;
  const filledCount = slots.filter(Boolean).length;

  function startGame() {
    const shuffled = shuffle(images);
    const selected = shuffled.slice(0, numSlots);
    setQueue(selected);
    setCurrentIndex(0);
    setSlots(Array(numSlots).fill(null));
    setGameState("playing");
  }

  function placeInSlot(slotIndex: number) {
    if (slots[slotIndex] !== null || !currentPlayer) return;
    const newSlots = [...slots];
    newSlots[slotIndex] = currentPlayer;
    setSlots(newSlots);

    if (currentIndex + 1 >= numSlots) {
      setGameState("complete");
    } else {
      setCurrentIndex(currentIndex + 1);
    }
    setHoveredSlot(null);
  }

  function playAgain() {
    startGame();
  }

  // Ordinal suffix
  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // ── Ready screen ──
  if (gameState === "ready") {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-amber-700 bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-300">
            Blind Ranking
          </div>
          <h2 className="text-3xl font-black text-white">{title}</h2>
          <p className="mt-3 text-sm text-gray-400">
            You&apos;ll be shown {numSlots} random players one at a time.
            Rank each one from {ordinal(1)} to {ordinal(numSlots)} — but you
            can&apos;t see who&apos;s coming next!
          </p>
          <p className="mt-2 text-xs text-gray-600">
            {images.length} players in the pool
          </p>
          <button
            onClick={startGame}
            className="mt-8 rounded-xl bg-amber-600 px-8 py-3 text-lg font-bold text-white transition-colors hover:bg-amber-500"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  // ── Complete screen ──
  if (gameState === "complete") {
    return (
      <div className="py-8 px-4">
        <div className="mx-auto max-w-lg text-center mb-8">
          <h2 className="text-2xl font-black text-white">Your Ranking</h2>
          <p className="mt-1 text-sm text-gray-400">Here&apos;s how you ranked them blind!</p>
        </div>

        <div className="mx-auto max-w-lg space-y-2">
          {slots.map((player, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
            >
              <span className="w-8 text-center text-lg font-black text-amber-400">
                {i + 1}
              </span>
              {player && (
                <>
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                    <img
                      src={player.image_url}
                      alt={displayName(player)}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="text-sm font-semibold text-white">{displayName(player)}</span>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={playAgain}
            className="rounded-xl bg-amber-600 px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-500"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // ── Playing screen ──
  return (
    <div className="py-6 px-4">
      {/* Progress */}
      <div className="mx-auto mb-6 max-w-2xl">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Player {filledCount + 1} of {numSlots}</span>
          <span>{numSlots - filledCount - 1} remaining after this</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-300"
            style={{ width: `${(filledCount / numSlots) * 100}%` }}
          />
        </div>
      </div>

      <div className="mx-auto max-w-2xl flex flex-col md:flex-row gap-8">
        {/* Current player card */}
        {currentPlayer && (
          <div className="flex flex-col items-center md:w-1/3">
            <div className="sticky top-24">
              <div className="w-48 overflow-hidden rounded-2xl border-2 border-amber-500 bg-gray-900 shadow-lg shadow-amber-500/10">
                <div className="aspect-square overflow-hidden">
                  <img
                    src={currentPlayer.image_url}
                    alt={displayName(currentPlayer)}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-sm font-bold text-white">{displayName(currentPlayer)}</p>
                  <p className="mt-1 text-[10px] text-gray-500">Tap a slot to place</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ranking slots */}
        <div className="flex-1 space-y-2">
          {slots.map((player, i) => {
            const isEmpty = player === null;
            const isHovered = hoveredSlot === i;

            return (
              <button
                key={i}
                onClick={() => isEmpty && placeInSlot(i)}
                onMouseEnter={() => isEmpty && setHoveredSlot(i)}
                onMouseLeave={() => setHoveredSlot(null)}
                disabled={!isEmpty}
                className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all ${
                  isEmpty
                    ? isHovered
                      ? "border-amber-500 bg-amber-500/10 cursor-pointer"
                      : "border-gray-800 bg-gray-900/50 hover:border-gray-700 cursor-pointer"
                    : "border-gray-800 bg-gray-900 cursor-default"
                }`}
              >
                <span className={`w-8 text-center text-lg font-black ${isEmpty ? (isHovered ? "text-amber-400" : "text-gray-600") : "text-amber-400"}`}>
                  {i + 1}
                </span>
                {player ? (
                  <>
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg">
                      <img
                        src={player.image_url}
                        alt={player.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span className="text-sm font-semibold text-white">{player.name}</span>
                  </>
                ) : (
                  <span className={`text-sm ${isHovered ? "text-amber-300" : "text-gray-600"}`}>
                    {isHovered && currentPlayer ? `Place ${displayName(currentPlayer)} here` : "Empty"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
