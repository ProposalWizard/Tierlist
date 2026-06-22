"use client";

import { useState, useEffect } from "react";
import type { BlindRankingImage } from "@/lib/types";

function displayName(img: BlindRankingImage): string {
  return img.name?.trim() || "";
}

interface Props {
  rankingId: string;
  title: string;
  numSlots: number;
  images: BlindRankingImage[];
  faceDetectionEnabled?: boolean;
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

function faceStyle(img: BlindRankingImage | null, enabled: boolean): React.CSSProperties {
  if (!enabled || !img?.face_center) return {};
  return { objectPosition: `${img.face_center.x}% ${img.face_center.y}%` };
}

export default function BlindRankingBoard({ title, numSlots, images, faceDetectionEnabled = false }: Props) {
  const [gameState, setGameState] = useState<GameState>("ready");
  const [slots, setSlots] = useState<(BlindRankingImage | null)[]>(Array(numSlots).fill(null));
  const [queue, setQueue] = useState<BlindRankingImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [showConfetti, setShowConfetti] = useState(false);

  const currentPlayer = gameState === "playing" ? queue[currentIndex] : null;
  const filledCount = slots.filter(Boolean).length;

  function startGame() {
    const shuffled = shuffle(images);
    const selected = shuffled.slice(0, numSlots);
    setQueue(selected);
    setCurrentIndex(0);
    setSlots(Array(numSlots).fill(null));
    setRevealedIndex(-1);
    setShowConfetti(false);
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

  useEffect(() => {
    if (gameState === "complete") {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      let idx = 0;
      const revealTimer = setInterval(() => {
        setRevealedIndex(idx);
        idx++;
        if (idx >= numSlots) clearInterval(revealTimer);
      }, 120);
      return () => { clearTimeout(timer); clearInterval(revealTimer); };
    }
  }, [gameState, numSlots]);

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const getMedalColor = (i: number) => {
    if (i === 0) return "from-yellow-400 to-yellow-600";
    if (i === 1) return "from-gray-300 to-gray-500";
    if (i === 2) return "from-amber-600 to-amber-800";
    return "from-gray-700 to-gray-800";
  };

  const getMedalBorder = (i: number) => {
    if (i === 0) return "border-yellow-500/50 shadow-yellow-500/20";
    if (i === 1) return "border-gray-400/50 shadow-gray-400/10";
    if (i === 2) return "border-amber-600/50 shadow-amber-600/10";
    return "border-gray-700";
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
          <p className="mt-3 text-sm text-white">
            You&apos;ll be shown {numSlots} random players one at a time.
            Rank each one from {ordinal(1)} to {ordinal(numSlots)} — but you
            can&apos;t see who&apos;s coming next!
          </p>
          <p className="mt-2 text-xs text-gray-300">
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
        {showConfetti && (
          <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="absolute animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-${Math.random() * 20 + 5}%`,
                  animationDuration: `${Math.random() * 2 + 1.5}s`,
                  animationDelay: `${Math.random() * 1}s`,
                  fontSize: `${Math.random() * 12 + 10}px`,
                  opacity: 0.8,
                }}
              >
                {["🏆", "⭐", "🎉", "🥇", "⚽"][Math.floor(Math.random() * 5)]}
              </div>
            ))}
          </div>
        )}

        <div className="mx-auto max-w-2xl text-center mb-10">
          <div className="inline-block rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 p-0.5 mb-4">
            <div className="rounded-full bg-gray-950 px-6 py-2">
              <span className="text-sm font-bold text-amber-400">Complete!</span>
            </div>
          </div>
          <h2 className="text-3xl font-black text-white md:text-4xl">Your Ranking</h2>
          <p className="mt-2 text-sm text-white">Here&apos;s how you ranked them blind!</p>
        </div>

        <div className="mx-auto max-w-2xl space-y-3">
          {slots.map((player, i) => {
            const isRevealed = i <= revealedIndex;
            return (
              <div
                key={i}
                className={`flex items-center gap-5 rounded-2xl border px-5 py-4 transition-all duration-500 shadow-lg ${
                  isRevealed ? `${getMedalBorder(i)} bg-gray-900` : "border-gray-800 bg-gray-900/50 opacity-40 scale-95"
                }`}
                style={{ transform: isRevealed ? "scale(1)" : "scale(0.95)", transitionDelay: `${i * 60}ms` }}
              >
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getMedalColor(i)} shadow-md`}>
                  <span className="text-lg font-black text-white drop-shadow">{i + 1}</span>
                </div>
                {player && (
                  <>
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 border-gray-700 shadow-md">
                      <img
                        src={player.image_url}
                        alt={displayName(player)}
                        className="h-full w-full object-cover"
                        style={faceStyle(player, faceDetectionEnabled)}
                      />
                    </div>
                    <span className="text-base font-bold text-white md:text-lg">{displayName(player)}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <button
            onClick={playAgain}
            className="rounded-xl bg-amber-600 px-10 py-3.5 text-base font-bold text-white transition-colors hover:bg-amber-500 shadow-lg shadow-amber-600/20"
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
      <div className="mx-auto mb-8 max-w-4xl">
        <div className="flex items-center justify-between text-sm text-white mb-2">
          <span className="font-semibold">Player {filledCount + 1} of {numSlots}</span>
          <span>{numSlots - filledCount - 1} remaining after this</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
            style={{ width: `${(filledCount / numSlots) * 100}%` }}
          />
        </div>
      </div>

      <div className="mx-auto max-w-4xl flex flex-col lg:flex-row gap-10">
        {/* Current player card */}
        {currentPlayer && (
          <div className="flex flex-col items-center lg:w-2/5">
            <div className="sticky top-24">
              <div className="w-64 md:w-72 lg:w-80 overflow-hidden rounded-2xl border-2 border-amber-500 bg-gray-900 shadow-xl shadow-amber-500/10">
                <div className="aspect-[4/5] overflow-hidden">
                  <img
                    src={currentPlayer.image_url}
                    alt={displayName(currentPlayer)}
                    className="h-full w-full object-cover"
                    style={faceStyle(currentPlayer, faceDetectionEnabled)}
                  />
                </div>
                <div className="px-4 py-4 text-center">
                  <p className="text-lg font-bold text-white">{displayName(currentPlayer)}</p>
                  <p className="mt-1 text-xs text-gray-200">Tap a slot to place</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ranking slots */}
        <div className="flex-1 space-y-2.5">
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
                className={`flex w-full items-center gap-4 rounded-xl border px-5 py-3.5 text-left transition-all ${
                  isEmpty
                    ? isHovered
                      ? `${getMedalBorder(i)} bg-amber-500/5 cursor-pointer scale-[1.02] shadow-lg`
                      : `${getMedalBorder(i)} bg-gray-900/50 hover:bg-gray-900 cursor-pointer`
                    : `${getMedalBorder(i)} bg-gray-900 cursor-default`
                }`}
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${getMedalColor(i)} shadow-md`}>
                  <span className="text-base font-black text-white drop-shadow">{i + 1}</span>
                </div>
                {player ? (
                  <>
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border-2 border-gray-700">
                      <img
                        src={player.image_url}
                        alt={player.name}
                        className="h-full w-full object-cover"
                        style={faceStyle(player, faceDetectionEnabled)}
                      />
                    </div>
                    <span className="text-sm font-semibold text-white">{player.name}</span>
                  </>
                ) : (
                  <span className={`text-sm ${isHovered ? "text-amber-300 font-medium" : "text-gray-300"}`}>
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
