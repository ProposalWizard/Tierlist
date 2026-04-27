"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { TicTacToePuzzle, TicTacToeSquareData, TicTacToeAnswer } from "@/lib/types";

interface GameState {
  guesses: Map<string, TicTacToeAnswer[]>; // key = "row-col"
  scores: Map<string, number>;
  bonusAwarded: boolean;
  finished: boolean;
}

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
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[m][n];
}

function fuzzyMatch(input: string, answer: TicTacToeAnswer): boolean {
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
  const inp = norm(input);
  if (!inp) return false;

  const names = [answer.name, ...(answer.aliases ?? [])];
  for (const name of names) {
    const target = norm(name);
    if (target === inp) return true;
    // allow fuzzy for names >= 4 chars
    if (target.length >= 4 && inp.length >= 4) {
      const maxDist = target.length <= 5 ? 1 : 2;
      if (levenshtein(inp, target) <= maxDist) return true;
    }
    // last-name match
    const parts = target.split(" ");
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      if (lastName.length >= 4 && inp.length >= 4) {
        if (levenshtein(inp, lastName) <= 1) return true;
      }
    }
  }
  return false;
}

function getTop3Score(found: TicTacToeAnswer[]): number {
  return found
    .map((a) => a.points)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((s, p) => s + p, 0);
}

function getMaxScore(square: TicTacToeSquareData): number {
  return square.answers
    .map((a) => a.points)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((s, p) => s + p, 0);
}

function checkThreeInARow(guesses: Map<string, TicTacToeAnswer[]>): boolean {
  const has = (r: number, c: number) => (guesses.get(squareKey(r, c))?.length ?? 0) > 0;
  // rows
  for (let r = 0; r < 3; r++) if (has(r, 0) && has(r, 1) && has(r, 2)) return true;
  // cols
  for (let c = 0; c < 3; c++) if (has(0, c) && has(1, c) && has(2, c)) return true;
  // diags
  if (has(0, 0) && has(1, 1) && has(2, 2)) return true;
  if (has(0, 2) && has(1, 1) && has(2, 0)) return true;
  return false;
}

interface Props {
  puzzle: TicTacToePuzzle;
}

export default function TicTacToeGame({ puzzle }: Props) {
  const [gameState, setGameState] = useState<GameState>({
    guesses: new Map(),
    scores: new Map(),
    bonusAwarded: false,
    finished: false,
  });
  const [selectedSquare, setSelectedSquare] = useState<{ r: number; c: number } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; type: "correct" | "wrong" | "duplicate" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null!);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (selectedSquare && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedSquare]);

  const totalMaxScore = (() => {
    let total = 0;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        total += getMaxScore(puzzle.grid[r][c]);
    total += puzzle.three_in_a_row_bonus;
    return total;
  })();

  const totalCurrentScore = (() => {
    let total = 0;
    gameState.guesses.forEach((found) => { total += getTop3Score(found); });
    if (gameState.bonusAwarded) total += puzzle.three_in_a_row_bonus;
    return total;
  })();

  const allSquaresFilled = (() => {
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        if ((gameState.guesses.get(squareKey(r, c))?.length ?? 0) === 0) return false;
    return true;
  })();

  const handleGuess = useCallback(() => {
    if (!selectedSquare || !inputValue.trim()) return;
    const { r, c } = selectedSquare;
    const key = squareKey(r, c);
    const square = puzzle.grid[r][c];
    const currentGuesses = gameState.guesses.get(key) ?? [];

    // find matching answer
    const match = square.answers.find((a) => fuzzyMatch(inputValue, a));

    if (!match) {
      setFeedback({ text: "Not a valid answer", type: "wrong" });
    } else if (currentGuesses.some((g) => g.name === match.name)) {
      setFeedback({ text: "Already found!", type: "duplicate" });
    } else {
      const newGuesses = new Map(gameState.guesses);
      const newFound = [...currentGuesses, match];
      newGuesses.set(key, newFound);

      let bonusAwarded = gameState.bonusAwarded;
      if (!bonusAwarded && checkThreeInARow(newGuesses)) {
        bonusAwarded = true;
      }

      setGameState({
        ...gameState,
        guesses: newGuesses,
        bonusAwarded,
      });
      setFeedback({ text: `${match.name} — ${match.points} pts!`, type: "correct" });
    }

    setInputValue("");
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2000);
  }, [selectedSquare, inputValue, puzzle, gameState]);

  const handleFinish = () => {
    setGameState((s) => ({ ...s, finished: true }));
    setSelectedSquare(null);
  };

  if (gameState.finished) {
    return (
      <ResultsScreen
        puzzle={puzzle}
        gameState={gameState}
        totalCurrentScore={totalCurrentScore}
        totalMaxScore={totalMaxScore}
        onPlayAgain={() => {
          setGameState({ guesses: new Map(), scores: new Map(), bonusAwarded: false, finished: false });
          setSelectedSquare(null);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-white md:text-3xl">{puzzle.title}</h1>
        <div className="mt-2 flex items-center justify-center gap-4 text-sm text-gray-400">
          <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${
            puzzle.difficulty === "easy" ? "bg-green-900/50 text-green-400" :
            puzzle.difficulty === "medium" ? "bg-yellow-900/50 text-yellow-400" :
            "bg-red-900/50 text-red-400"
          }`}>
            {puzzle.difficulty.charAt(0).toUpperCase() + puzzle.difficulty.slice(1)}
          </span>
          <span className="font-bold text-white">{totalCurrentScore} / {totalMaxScore}</span>
        </div>
        {gameState.bonusAwarded && (
          <p className="mt-1 text-xs font-bold text-green-400">
            +{puzzle.three_in_a_row_bonus} Three-in-a-row bonus!
          </p>
        )}
      </div>

      {/* Grid */}
      <div className="mb-6">
        {/* Column labels */}
        <div className="grid grid-cols-[60px_1fr_1fr_1fr] gap-1">
          <div />
          {puzzle.col_labels.map((label, c) => (
            <div key={c} className="flex items-end justify-center rounded-t-lg bg-gray-800/50 px-1 py-2 text-center text-xs font-bold text-gray-300 min-h-[48px]">
              {label}
            </div>
          ))}
        </div>

        {/* Rows */}
        {puzzle.grid.map((row, r) => (
          <div key={r} className="grid grid-cols-[60px_1fr_1fr_1fr] gap-1 mt-1">
            {/* Row label */}
            <div className="flex items-center justify-center rounded-l-lg bg-gray-800/50 px-1 py-2 text-center text-xs font-bold text-gray-300">
              {puzzle.row_labels[r]}
            </div>

            {/* Squares */}
            {row.map((square, c) => {
              const key = squareKey(r, c);
              const found = gameState.guesses.get(key) ?? [];
              const sqScore = getTop3Score(found);
              const sqMax = getMaxScore(square);
              const isSelected = selectedSquare?.r === r && selectedSquare?.c === c;
              const isCustom = square.type === "custom";

              return (
                <button
                  key={c}
                  onClick={() => {
                    setSelectedSquare({ r, c });
                    setInputValue("");
                    setFeedback(null);
                  }}
                  className={`relative flex flex-col items-center justify-center rounded-lg border p-2 transition-all min-h-[80px] md:min-h-[100px] ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-900/30 ring-2 ring-indigo-500/50"
                      : found.length > 0
                      ? "border-green-700/50 bg-green-900/20 hover:border-green-500"
                      : "border-gray-700 bg-gray-900 hover:border-gray-500"
                  }`}
                >
                  {isCustom && (
                    <span className="absolute right-1 top-1 text-[8px] font-bold text-amber-500">★</span>
                  )}
                  {found.length > 0 ? (
                    <>
                      <span className="text-lg font-black text-green-400">{found.length}</span>
                      <span className="text-[10px] text-gray-400">{sqScore}/{sqMax}</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-500 text-center leading-tight">
                      {square.conditions.join(" + ")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Input panel */}
      {selectedSquare && (
        <SquarePanel
          square={puzzle.grid[selectedSquare.r][selectedSquare.c]}
          found={gameState.guesses.get(squareKey(selectedSquare.r, selectedSquare.c)) ?? []}
          inputValue={inputValue}
          setInputValue={setInputValue}
          onGuess={handleGuess}
          feedback={feedback}
          inputRef={inputRef}
          onClose={() => setSelectedSquare(null)}
        />
      )}

      {/* Finish button */}
      <div className="mt-4 flex justify-center gap-3">
        <button
          onClick={handleFinish}
          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500"
        >
          {allSquaresFilled ? "View Results" : "Finish Early"}
        </button>
      </div>
    </div>
  );
}

/* ── Square detail panel ── */
function SquarePanel({
  square,
  found,
  inputValue,
  setInputValue,
  onGuess,
  feedback,
  inputRef,
  onClose,
}: {
  square: TicTacToeSquareData;
  found: TicTacToeAnswer[];
  inputValue: string;
  setInputValue: (v: string) => void;
  onGuess: () => void;
  feedback: { text: string; type: "correct" | "wrong" | "duplicate" } | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onClose: () => void;
}) {
  const sqScore = getTop3Score(found);
  const sqMax = getMaxScore(square);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-white">{square.conditions[0]}</p>
          <p className="text-sm font-bold text-indigo-400">+ {square.conditions[1]}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">&times;</button>
      </div>

      <div className="mb-3 text-xs text-gray-400">
        Score: <span className="font-bold text-white">{sqScore}</span> / {sqMax}
        <span className="ml-2 text-gray-600">(top 3 answers count)</span>
      </div>

      {/* Input */}
      <div className="mb-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onGuess(); }}
          placeholder="Type a player name..."
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={onGuess}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500"
        >
          Guess
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <p className={`mb-3 text-sm font-semibold ${
          feedback.type === "correct" ? "text-green-400" :
          feedback.type === "duplicate" ? "text-yellow-400" :
          "text-red-400"
        }`}>
          {feedback.text}
        </p>
      )}

      {/* Found answers */}
      {found.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-400 uppercase">Found ({found.length})</p>
          {found
            .sort((a, b) => b.points - a.points)
            .map((a, i) => {
              const isTop3 = i < 3;
              return (
                <div key={a.name} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                  isTop3 ? "bg-green-900/30 text-green-300" : "bg-gray-800 text-gray-500"
                }`}>
                  <span>{a.name}</span>
                  <span className="font-bold">{a.points} pts{!isTop3 ? " (overflow)" : ""}</span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

/* ── Results screen ── */
function ResultsScreen({
  puzzle,
  gameState,
  totalCurrentScore,
  totalMaxScore,
  onPlayAgain,
}: {
  puzzle: TicTacToePuzzle;
  gameState: GameState;
  totalCurrentScore: number;
  totalMaxScore: number;
  onPlayAgain: () => void;
}) {
  const pct = totalMaxScore > 0 ? Math.round((totalCurrentScore / totalMaxScore) * 100) : 0;

  let squaresCompleted = 0;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if ((gameState.guesses.get(squareKey(r, c))?.length ?? 0) > 0) squaresCompleted++;

  // Find missed high-value answers
  const missed: { name: string; points: number; conditions: string }[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const sq = puzzle.grid[r][c];
      const found = gameState.guesses.get(squareKey(r, c)) ?? [];
      const foundNames = new Set(found.map((a) => a.name));
      for (const ans of sq.answers) {
        if (!foundNames.has(ans.name) && ans.points >= 4) {
          missed.push({
            name: ans.name,
            points: ans.points,
            conditions: sq.conditions.join(" + "),
          });
        }
      }
    }
  }
  missed.sort((a, b) => b.points - a.points);

  // Generate shareable emoji grid
  const emojiGrid = (() => {
    const rows: string[] = [];
    for (let r = 0; r < 3; r++) {
      let row = "";
      for (let c = 0; c < 3; c++) {
        const found = gameState.guesses.get(squareKey(r, c)) ?? [];
        const sqScore = getTop3Score(found);
        const sqMax = getMaxScore(puzzle.grid[r][c]);
        if (found.length === 0) row += "⬛";
        else if (sqScore >= sqMax) row += "🟩";
        else if (sqScore >= sqMax * 0.5) row += "🟨";
        else row += "🟧";
      }
      rows.push(row);
    }
    return rows.join("\n");
  })();

  const shareText = `Football Tic Tac Toe — ${puzzle.title}\n${totalCurrentScore}/${totalMaxScore} (${pct}%)\n${emojiGrid}`;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 text-center">
      <h2 className="text-3xl font-black text-white">Game Over!</h2>

      <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-6">
        <p className="text-5xl font-black text-indigo-400">{totalCurrentScore}</p>
        <p className="text-sm text-gray-400">out of {totalMaxScore} ({pct}%)</p>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-gray-800 p-3">
            <p className="text-2xl font-black text-white">{squaresCompleted}/9</p>
            <p className="text-gray-500">Squares</p>
          </div>
          <div className="rounded-lg bg-gray-800 p-3">
            <p className="text-2xl font-black text-white">{gameState.bonusAwarded ? "Yes" : "No"}</p>
            <p className="text-gray-500">3-in-a-row</p>
          </div>
        </div>

        {/* Emoji grid preview */}
        <div className="mt-4 rounded-lg bg-gray-800 p-3">
          <pre className="text-2xl leading-relaxed">{emojiGrid.split("\n").map((row, i) => (
            <span key={i}>{row}{i < 2 ? "\n" : ""}</span>
          ))}</pre>
        </div>
      </div>

      {/* Missed answers */}
      {missed.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-4 text-left">
          <h3 className="mb-2 text-sm font-bold text-red-400 uppercase">Missed High-Value Players</h3>
          <div className="space-y-1.5">
            {missed.slice(0, 10).map((m) => (
              <div key={m.name} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-white">{m.name}</span>
                  <span className="ml-2 text-[10px] text-gray-500">{m.conditions}</span>
                </div>
                <span className="font-bold text-red-400">{m.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full grid breakdown */}
      <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-4 text-left">
        <h3 className="mb-3 text-sm font-bold text-gray-400 uppercase">All Answers</h3>
        {puzzle.grid.map((row, r) =>
          row.map((sq, c) => {
            const found = gameState.guesses.get(squareKey(r, c)) ?? [];
            const foundNames = new Set(found.map((a) => a.name));
            return (
              <div key={`${r}-${c}`} className="mb-3 rounded-lg bg-gray-800 p-3">
                <p className="text-xs font-bold text-indigo-400 mb-1">{sq.conditions.join(" + ")}</p>
                <div className="space-y-0.5">
                  {sq.answers
                    .sort((a, b) => b.points - a.points)
                    .map((a) => (
                      <div key={a.name} className={`flex justify-between text-xs ${foundNames.has(a.name) ? "text-green-400" : "text-gray-500"}`}>
                        <span>{foundNames.has(a.name) ? "✓" : "✗"} {a.name}</span>
                        <span>{a.points} pts</span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={() => {
            navigator.clipboard.writeText(shareText);
          }}
          className="rounded-xl border border-gray-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-800"
        >
          Copy Result
        </button>
        <button
          onClick={onPlayAgain}
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
