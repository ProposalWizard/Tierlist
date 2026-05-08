"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { TenablePuzzle, TenableAnswer } from "@/lib/types";

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function fuzzyMatch(input: string, answer: TenableAnswer): boolean {
  const inp = input.toLowerCase().trim();
  if (!inp) return false;

  const tryMatch = (candidate: string): boolean => {
    const target = candidate.toLowerCase();
    if (target === inp) return true;
    if (target.length >= 4 && inp.length >= 4) {
      const maxDist = target.length <= 5 ? 1 : 2;
      if (levenshtein(inp, target) <= maxDist) return true;
    }
    const parts = target.split(" ");
    for (let i = 1; i < parts.length; i++) {
      const suffix = parts.slice(i).join(" ");
      if (suffix.length >= 3) {
        if (suffix === inp) return true;
        if (suffix.length >= 4 && inp.length >= 4) {
          const maxDist = suffix.length <= 5 ? 1 : 2;
          if (levenshtein(inp, suffix) <= maxDist) return true;
        }
      }
    }
    const hyphenParts = target.split(/[\s-]+/);
    if (hyphenParts.length > parts.length) {
      for (const hp of hyphenParts) {
        if (hp.length >= 3) {
          if (hp === inp) return true;
          if (hp.length >= 4 && inp.length >= 4) {
            const maxDist = hp.length <= 5 ? 1 : 2;
            if (levenshtein(inp, hp) <= maxDist) return true;
          }
        }
      }
    }
    return false;
  };

  if (tryMatch(answer.name)) return true;

  // If the name contains " - ", also try matching just the part before it
  const sepIdx = answer.name.indexOf(" - ");
  if (sepIdx > 0 && tryMatch(answer.name.slice(0, sepIdx))) return true;

  if (answer.aliases) {
    for (const alias of answer.aliases) {
      if (tryMatch(alias)) return true;
    }
  }

  return false;
}

interface AnimState {
  currentPos: number;
  targetPos: number;
  isCorrect: boolean;
  done: boolean;
}

export default function TenableGame({ puzzle }: { puzzle: TenablePuzzle }) {
  const [guess, setGuess] = useState("");
  const [lives, setLives] = useState(3);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [anim, setAnim] = useState<AnimState | null>(null);
  const [showIncorrectFlash, setShowIncorrectFlash] = useState(false);
  const [flashPosition, setFlashPosition] = useState<number | null>(null);
  const [guessedNames, setGuessedNames] = useState<Set<string>>(new Set());
  const [slotNames, setSlotNames] = useState<Map<number, string>>(new Map());
  const [pendingSlotName, setPendingSlotName] = useState<{ pos: number; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const answers = puzzle.answers;
  const hasBank = !puzzle.is_ordered && answers.length > 10;
  const displaySlots = hasBank
    ? Array.from({ length: 10 }, (_, i) => ({ position: i + 1, name: "" }))
    : answers.filter((a) => a.position >= 1 && a.position <= 10);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!anim && !gameOver) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [anim, gameOver]);

  const getLowestUnrevealed = useCallback(() => {
    for (let i = 1; i <= 10; i++) {
      if (!revealed.has(i)) return i;
    }
    return 1;
  }, [revealed]);

  const runAnimation = useCallback(
    (targetPos: number, isCorrect: boolean) => {
      const startPos = 10;
      setAnim({ currentPos: startPos, targetPos, isCorrect, done: false });

      let pos = startPos;
      const step = () => {
        if (pos > targetPos) {
          pos--;
          while (pos > targetPos && revealed.has(pos)) {
            pos--;
          }
          if (pos < targetPos) pos = targetPos;
          setAnim({ currentPos: pos, targetPos, isCorrect, done: false });
          animTimerRef.current = setTimeout(step, 200);
        } else {
          setAnim({ currentPos: targetPos, targetPos, isCorrect, done: true });

          if (isCorrect) {
            animTimerRef.current = setTimeout(() => {
              setRevealed((prev) => new Set(prev).add(targetPos));
              if (pendingSlotName) {
                setSlotNames((prev) => new Map(prev).set(pendingSlotName.pos, pendingSlotName.name));
                setPendingSlotName(null);
              }
              setAnim(null);
              const newRevealed = new Set(revealed).add(targetPos);
              if (newRevealed.size === 10) {
                setWon(true);
                setGameOver(true);
              } else {
                inputRef.current?.focus();
              }
            }, 800);
          } else {
            setShowIncorrectFlash(true);
            setFlashPosition(targetPos);
            animTimerRef.current = setTimeout(() => {
              setShowIncorrectFlash(false);
              setFlashPosition(null);
              setPendingSlotName(null);
              setAnim(null);
              setLives((prev) => {
                const next = prev - 1;
                if (next <= 0) {
                  setGameOver(true);
                }
                return next;
              });
              inputRef.current?.focus();
            }, 1200);
          }
        }
      };

      animTimerRef.current = setTimeout(step, 300);
    },
    [revealed, pendingSlotName]
  );

  const handleGuess = useCallback(() => {
    if (gameOver || anim || !guess.trim()) return;

    if (hasBank) {
      const matchedAnswer = answers.find(
        (a) => !guessedNames.has(a.name) && fuzzyMatch(guess, a)
      );
      if (matchedAnswer) {
        setGuess("");
        setGuessedNames((prev) => new Set(prev).add(matchedAnswer.name));
        const targetSlot = getLowestUnrevealed();
        setPendingSlotName({ pos: targetSlot, name: matchedAnswer.name });
        runAnimation(targetSlot, true);
      } else {
        setGuess("");
        runAnimation(getLowestUnrevealed(), false);
      }
    } else {
      const matchedAnswer = answers.find(
        (a) => !revealed.has(a.position) && fuzzyMatch(guess, a)
      );
      if (matchedAnswer) {
        setGuess("");
        runAnimation(matchedAnswer.position, true);
      } else {
        setGuess("");
        runAnimation(getLowestUnrevealed(), false);
      }
    }
  }, [gameOver, anim, guess, answers, revealed, guessedNames, hasBank, runAnimation, getLowestUnrevealed]);

  const handlePlayAgain = () => {
    setGuess("");
    setLives(3);
    setRevealed(new Set());
    setGameOver(false);
    setWon(false);
    setAnim(null);
    setShowIncorrectFlash(false);
    setFlashPosition(null);
    setGuessedNames(new Set());
    setSlotNames(new Map());
    setPendingSlotName(null);
    inputRef.current?.focus();
  };

  const score = revealed.size;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Lives */}
        <div className="flex justify-center gap-1 mb-4">
          {[0, 1, 2].map((i) => (
            <svg
              key={i}
              className={`h-8 w-8 transition-colors ${
                i < lives ? "text-red-500" : "text-gray-700"
              }`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ))}
        </div>

        {/* Score */}
        <div className="text-center mb-4">
          <span className="text-2xl font-black text-white">{score}</span>
          <span className="text-lg text-gray-500"> / 10</span>
          {hasBank && (
            <span className="ml-2 text-xs text-gray-600">({answers.length} in bank)</span>
          )}
        </div>

        {/* Answer grid */}
        <div className="space-y-1.5 mb-6">
          {displaySlots.map((slot) => {
            const pos = slot.position;
            const isRevealed = revealed.has(pos);
            const isAnimHighlight = anim && !anim.done && anim.currentPos === pos && !isRevealed;
            const isAnimTarget = anim?.done && anim.targetPos === pos;
            const isIncorrectFlash = showIncorrectFlash && flashPosition === pos;

            const displayName = hasBank
              ? (slotNames.get(pos) || (pendingSlotName?.pos === pos ? pendingSlotName.name : ""))
              : slot.name;

            let bgClass = "bg-gray-800";
            let textContent: React.ReactNode = (
              <span className="text-lg font-black text-gray-500">{pos}</span>
            );

            if (isRevealed) {
              bgClass = "bg-green-600";
              textContent = (
                <span className="text-lg font-black text-white">{displayName}</span>
              );
            } else if (isIncorrectFlash) {
              bgClass = "bg-red-600 animate-pulse";
              textContent = (
                <span className="text-2xl font-black text-white">✕</span>
              );
            } else if (isAnimTarget && anim?.isCorrect) {
              bgClass = "bg-green-500 animate-pulse";
              textContent = (
                <span className="text-lg font-black text-white">{displayName}</span>
              );
            } else if (isAnimHighlight) {
              bgClass = "bg-gray-600";
              textContent = (
                <span className="text-lg font-black text-gray-300">{pos}</span>
              );
            } else if (gameOver && !isRevealed) {
              bgClass = "bg-gray-800/60";
              if (!hasBank) {
                textContent = (
                  <div className="flex items-center justify-between w-full px-2">
                    <span className="text-lg font-black text-gray-500">{pos}</span>
                    <span className="text-sm font-semibold text-gray-500">{slot.name}</span>
                  </div>
                );
              }
            }

            return (
              <div
                key={pos}
                className={`flex h-14 items-center justify-center rounded-lg transition-all duration-200 ${bgClass}`}
              >
                {textContent}
              </div>
            );
          })}
        </div>

        {/* Show remaining answers from bank on game over */}
        {gameOver && hasBank && !won && (
          <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
            <p className="text-xs font-bold text-gray-400 mb-2">
              Remaining answers ({answers.length - guessedNames.size} of {answers.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {answers
                .filter((a) => !guessedNames.has(a.name))
                .map((a) => (
                  <span key={a.name} className="rounded-full bg-gray-800 px-2.5 py-1 text-xs font-semibold text-gray-400">
                    {a.name}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Category / description */}
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm font-bold text-white">{puzzle.category}</p>
          {puzzle.description && (
            <p className="mt-1 text-xs text-gray-400 italic">{puzzle.description}</p>
          )}
        </div>

        {/* Input or game over */}
        {gameOver ? (
          <div className="text-center space-y-4">
            {won ? (
              <div>
                <p className="text-2xl font-black text-green-400">You got all 10!</p>
                <p className="mt-1 text-sm text-gray-400">Perfect score!</p>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-black text-red-400">Game Over</p>
                <p className="mt-1 text-sm text-gray-400">
                  You got {score} out of 10 correct.
                </p>
              </div>
            )}
            <button
              onClick={handlePlayAgain}
              className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-indigo-500"
            >
              Play Again
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGuess(); }}
              placeholder="Type your answer..."
              disabled={!!anim}
              autoFocus
              className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleGuess}
              disabled={!!anim || !guess.trim()}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold uppercase text-white transition-colors hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Guess
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between text-xs text-gray-600">
          {puzzle.daily_date && (
            <span>#{puzzle.daily_date}</span>
          )}
        </div>
      </div>
    </div>
  );
}
