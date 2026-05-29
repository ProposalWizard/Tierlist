"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { TicTacToePuzzle, TicTacToeAnswer } from "@/lib/types";

type Mode = "solo" | "multi";
type TimerOption = 180 | 300 | 0;

function squareKey(r: number, c: number) {
  return `${r}-${c}`;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

function fuzzyMatch(input: string, answer: TicTacToeAnswer): boolean {
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9 \-]/g, "");
  const inp = norm(input);
  if (!inp) return false;
  const names = [answer.name, ...(answer.aliases ?? [])];
  for (const name of names) {
    const target = norm(name);
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
    if (parts.length >= 2) {
      const surname = parts[parts.length - 1];
      const inpWords = inp.split(/[\s-]+/);
      if (inpWords.length >= 2 && surname.length >= 3) {
        for (const w of inpWords) {
          if (w.length < 3) continue;
          if (w === surname) return true;
          if (w.length >= 4 && surname.length >= 4) {
            const maxDist = surname.length <= 5 ? 1 : 2;
            if (levenshtein(w, surname) <= maxDist) return true;
          }
        }
      }
    }
  }
  return false;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function checkThreeInRow(owned: Set<string>): boolean {
  const lines = [
    ["0-0","0-1","0-2"], ["1-0","1-1","1-2"], ["2-0","2-1","2-2"],
    ["0-0","1-0","2-0"], ["0-1","1-1","2-1"], ["0-2","1-2","2-2"],
    ["0-0","1-1","2-2"], ["0-2","1-1","2-0"],
  ];
  return lines.some((line) => line.every((k) => owned.has(k)));
}

export default function EasyTTTGame({ puzzle }: { puzzle: TicTacToePuzzle }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [timerOption, setTimerOption] = useState<TimerOption | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Shared
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Single player
  const [foundAnswers, setFoundAnswers] = useState<Map<string, string[]>>(new Map());
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Multiplayer
  const [currentPlayer, setCurrentPlayer] = useState<0 | 1>(0);
  const [squareOwner, setSquareOwner] = useState<Map<string, 0 | 1>>(new Map());
  const [winner, setWinner] = useState<0 | 1 | null>(null);

  const totalAnswers = (() => {
    let total = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) total += puzzle.grid[r][c].answers.length;
    return total;
  })();

  const totalFound = (() => {
    let total = 0;
    foundAnswers.forEach((names) => { total += names.length; });
    return total;
  })();

  const squaresWithCorrect = (() => {
    let count = 0;
    foundAnswers.forEach((names) => { if (names.length > 0) count++; });
    return count;
  })();

  const startSoloGame = (timer: TimerOption) => {
    setMode("solo");
    setTimerOption(timer);
    setTimeLeft(timer || 0);
    setGameStarted(true);
    setFoundAnswers(new Map());
  };

  const startMultiGame = () => {
    setMode("multi");
    setGameStarted(true);
    setSquareOwner(new Map());
    setCurrentPlayer(0);
    setWinner(null);
  };

  // Timer
  useEffect(() => {
    if (mode !== "solo" || !gameStarted || gameOver) return;
    if (timerOption === 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode, gameStarted, gameOver, timerOption]);

  const finishSoloGame = useCallback(() => {
    setGameOver(true);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleSquareClick = (r: number, c: number) => {
    const key = squareKey(r, c);
    if (gameOver) return;

    if (mode === "multi") {
      if (squareOwner.has(key)) return;
      setSelectedSquare(key);
      setGuess("");
      setFeedback(null);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    // Single player
    const sq = puzzle.grid[r][c];
    const found = foundAnswers.get(key) ?? [];
    if (found.length >= sq.answers.length) return;
    setSelectedSquare(key);
    setGuess("");
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleGuess = () => {
    if (!selectedSquare || !guess.trim() || gameOver) return;
    const [rStr, cStr] = selectedSquare.split("-");
    const r = Number(rStr), c = Number(cStr);
    const sq = puzzle.grid[r][c];

    if (mode === "multi") {
      const matched = sq.answers.find((a) => fuzzyMatch(guess, a));
      if (matched) {
        const next = new Map(squareOwner);
        next.set(selectedSquare, currentPlayer);
        setSquareOwner(next);
        const nextFound = new Map(foundAnswers);
        nextFound.set(selectedSquare, [matched.name]);
        setFoundAnswers(nextFound);
        setFeedback({ msg: `${matched.name}!`, ok: true });

        const owned = new Set<string>();
        next.forEach((p, k) => { if (p === currentPlayer) owned.add(k); });
        if (checkThreeInRow(owned)) {
          setWinner(currentPlayer);
          setGameOver(true);
        } else {
          const allFilled = next.size === 9;
          if (allFilled) { setGameOver(true); }
          else { setCurrentPlayer(currentPlayer === 0 ? 1 : 0); }
        }
        setSelectedSquare(null);
      } else {
        setFeedback({ msg: "Wrong! Turn lost.", ok: false });
        setCurrentPlayer(currentPlayer === 0 ? 1 : 0);
        setSelectedSquare(null);
      }
      setGuess("");
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    // Single player
    const found = foundAnswers.get(selectedSquare) ?? [];
    const alreadyFound = found.some((name) =>
      sq.answers.find((a) => a.name === name && fuzzyMatch(guess, a))
    );
    if (alreadyFound) {
      setFeedback({ msg: "Already found!", ok: false });
      setGuess("");
      setTimeout(() => setFeedback(null), 1200);
      return;
    }

    const matched = sq.answers.find((a) => !found.includes(a.name) && fuzzyMatch(guess, a));
    if (matched) {
      const next = new Map(foundAnswers);
      next.set(selectedSquare, [...found, matched.name]);
      setFoundAnswers(next);
      setFeedback({ msg: `${matched.name}!`, ok: true });
      setGuess("");
      const newFound = next.get(selectedSquare) ?? [];
      if (newFound.length >= sq.answers.length) {
        setTimeout(() => setSelectedSquare(null), 500);
      }
    } else {
      setFeedback({ msg: "Wrong!", ok: false });
      setGuess("");
    }
    setTimeout(() => setFeedback(null), 1200);
  };

  const playerColors = ["bg-green-600", "bg-red-600"] as const;
  const playerTextColors = ["text-green-400", "text-red-400"] as const;
  const playerNames = ["Player 1", "Player 2"] as const;

  // ── Mode Selection ──
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-green-700 bg-green-900/30 px-3 py-1 text-xs font-semibold text-green-300 mb-4">
            Easy Mode
          </div>
          <h1 className="text-2xl font-black mb-2">{puzzle.title}</h1>
          <p className="text-sm text-gray-400 mb-8">Name players who played for both clubs in each square.</p>

          {!mode && (
            <div className="space-y-3">
              <button onClick={() => setMode("solo")}
                className="w-full rounded-xl bg-green-600 py-4 text-lg font-bold text-white hover:bg-green-500 transition-colors">
                Single Player
              </button>
              <button onClick={() => startMultiGame()}
                className="w-full rounded-xl bg-red-600 py-4 text-lg font-bold text-white hover:bg-red-500 transition-colors">
                Multiplayer
              </button>
            </div>
          )}

          {mode === "solo" && !gameStarted && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-2">Choose your time limit:</p>
              <button onClick={() => startSoloGame(180)}
                className="w-full rounded-xl border border-gray-700 bg-gray-900 py-3 text-base font-bold text-white hover:border-green-600 hover:bg-gray-800 transition-colors">
                3 Minute Timer
              </button>
              <button onClick={() => startSoloGame(300)}
                className="w-full rounded-xl border border-gray-700 bg-gray-900 py-3 text-base font-bold text-white hover:border-green-600 hover:bg-gray-800 transition-colors">
                5 Minute Timer
              </button>
              <button onClick={() => startSoloGame(0)}
                className="w-full rounded-xl border border-gray-700 bg-gray-900 py-3 text-base font-bold text-white hover:border-green-600 hover:bg-gray-800 transition-colors">
                Unlimited Time
              </button>
              <button onClick={() => setMode(null)} className="text-sm text-gray-500 hover:text-white mt-2">
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Results Screen ──
  if (gameOver) {
    const pct = totalAnswers > 0 ? Math.round((totalFound / totalAnswers) * 100) : 0;

    return (
      <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
        <div className="mx-auto max-w-3xl">
          {mode === "multi" ? (
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black mb-2">
                {winner !== null ? (
                  <span className={playerTextColors[winner]}>{playerNames[winner]} Wins!</span>
                ) : "Draw!"}
              </h1>
            </div>
          ) : (
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black mb-4">Time&apos;s Up!</h1>
              <div className="flex items-center justify-center gap-6 text-center">
                <div>
                  <div className="text-3xl font-black text-green-400">{squaresWithCorrect}/9</div>
                  <div className="text-xs text-gray-500">Squares</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-indigo-400">{totalFound}/{totalAnswers}</div>
                  <div className="text-xs text-gray-500">Players Found</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-amber-400">{pct}%</div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
              </div>
            </div>
          )}

          {/* Reveal grid */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-1 w-24" />
                  {puzzle.col_labels.map((label, ci) => (
                    <th key={ci} className="p-1 text-center text-xs font-bold text-indigo-400 uppercase">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2].map((ri) => (
                  <tr key={ri}>
                    <td className="p-1 text-right text-xs font-bold text-indigo-400 uppercase whitespace-nowrap">{puzzle.row_labels[ri]}</td>
                    {[0, 1, 2].map((ci) => {
                      const sq = puzzle.grid[ri][ci];
                      const key = squareKey(ri, ci);
                      const found = foundAnswers.get(key) ?? [];
                      const owner = squareOwner.get(key);
                      return (
                        <td key={ci} className="p-1 align-top">
                          <div className={`rounded-lg border p-2 min-h-[60px] text-xs ${
                            mode === "multi" && owner !== undefined
                              ? `${playerColors[owner]} border-transparent`
                              : found.length >= sq.answers.length
                              ? "bg-amber-900/50 border-amber-700"
                              : "bg-gray-900 border-gray-800"
                          }`}>
                            {sq.answers.map((a) => (
                              <div key={a.name} className={`py-0.5 ${
                                found.includes(a.name) || (mode === "multi" && owner !== undefined)
                                  ? "text-white font-bold"
                                  : "text-gray-500"
                              }`}>
                                {found.includes(a.name) || (mode === "multi" && owner !== undefined)
                                  ? a.name
                                  : a.name}
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 text-center">
            <a href="/tic-tac-toe/easy"
              className="rounded-xl bg-green-600 px-8 py-3 text-sm font-bold text-white hover:bg-green-500 inline-block">
              Play Again
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Game Board ──
  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-6">
      <div className="mx-auto max-w-3xl">

        {/* Header bar */}
        <div className="mb-4 flex items-center justify-between">
          {mode === "solo" ? (
            <>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-400">
                  <span className="font-bold text-green-400">{squaresWithCorrect}</span>/9 squares
                </div>
                <div className="text-sm text-gray-400">
                  <span className="font-bold text-indigo-400">{totalFound}</span>/{totalAnswers} players
                </div>
              </div>
              <div className="flex items-center gap-3">
                {timerOption !== 0 ? (
                  <div className={`text-xl font-black tabular-nums ${timeLeft <= 30 ? "text-red-400" : "text-white"}`}>
                    {formatTime(timeLeft)}
                  </div>
                ) : (
                  <button onClick={finishSoloGame}
                    className="rounded-lg border border-gray-600 px-4 py-1.5 text-xs font-bold text-gray-300 hover:text-white hover:border-gray-400">
                    Finish &amp; Reveal
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className={`text-lg font-black ${playerTextColors[currentPlayer]}`}>
                {playerNames[currentPlayer]}&apos;s Turn
              </div>
              {feedback && (
                <div className={`text-sm font-bold ${feedback.ok ? "text-green-400" : "text-red-400"}`}>
                  {feedback.msg}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Feedback for solo */}
        {mode === "solo" && feedback && (
          <div className={`mb-3 text-center text-sm font-bold ${feedback.ok ? "text-green-400" : "text-red-400"}`}>
            {feedback.msg}
          </div>
        )}

        {/* Grid */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-1 w-20" />
                {puzzle.col_labels.map((label, ci) => (
                  <th key={ci} className="p-1 text-center text-[11px] font-bold text-indigo-400 uppercase leading-tight">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((ri) => (
                <tr key={ri}>
                  <td className="p-1 text-right text-[11px] font-bold text-indigo-400 uppercase whitespace-nowrap leading-tight">
                    {puzzle.row_labels[ri]}
                  </td>
                  {[0, 1, 2].map((ci) => {
                    const key = squareKey(ri, ci);
                    const sq = puzzle.grid[ri][ci];
                    const isSelected = selectedSquare === key;

                    if (mode === "multi") {
                      const owner = squareOwner.get(key);
                      const isOwned = owner !== undefined;
                      return (
                        <td key={ci} className="p-1">
                          <button
                            onClick={() => handleSquareClick(ri, ci)}
                            disabled={isOwned}
                            className={`w-full rounded-lg border p-3 min-h-[80px] flex items-center justify-center text-center transition-colors ${
                              isOwned
                                ? `${playerColors[owner]} border-transparent`
                                : isSelected
                                ? "border-indigo-500 bg-indigo-900/30"
                                : "border-gray-700 bg-gray-900 hover:border-gray-500"
                            }`}
                          >
                            {isOwned ? (
                              <span className="text-sm font-bold text-white">
                                {sq.answers.find((a) => {
                                  const f = foundAnswers.get(key);
                                  return f?.includes(a.name);
                                })?.name ?? sq.answers[0]?.name}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-500">Click to guess</span>
                            )}
                          </button>
                        </td>
                      );
                    }

                    // Single player
                    const found = foundAnswers.get(key) ?? [];
                    const allFound = found.length >= sq.answers.length;
                    return (
                      <td key={ci} className="p-1">
                        <button
                          onClick={() => handleSquareClick(ri, ci)}
                          disabled={allFound}
                          className={`w-full rounded-lg border p-2 min-h-[80px] text-left transition-colors ${
                            allFound
                              ? "bg-amber-900/40 border-amber-700"
                              : isSelected
                              ? "border-indigo-500 bg-indigo-900/30"
                              : found.length > 0
                              ? "border-green-800 bg-green-900/20 hover:border-green-600"
                              : "border-gray-700 bg-gray-900 hover:border-gray-500"
                          }`}
                        >
                          <div className="text-[10px] text-gray-500 mb-1">
                            {found.length}/{sq.answers.length}
                          </div>
                          {found.length > 0 && (
                            <div className="space-y-0.5">
                              {found.map((name) => (
                                <div key={name} className="text-[11px] text-green-400 truncate">{name}</div>
                              ))}
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Input area */}
        {selectedSquare && (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGuess()}
                placeholder="Type a player name..."
                autoComplete="off"
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
              />
              <button
                onClick={handleGuess}
                className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500"
              >
                Guess
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
