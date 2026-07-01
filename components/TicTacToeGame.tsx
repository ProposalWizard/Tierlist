"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TicTacToePuzzle, TicTacToeSquareData, TicTacToeAnswer } from "@/lib/types";
import { CUSTOM_SQUARE_LABELS } from "@/lib/types";

type GameMode = "solo" | "2player";

interface GameState {
  guesses: Map<string, TicTacToeAnswer[]>;
  usedPlayers: Set<string>;
  finished: boolean;
  // solo
  bonusAwarded: boolean;
  // 2-player
  currentPlayer: 0 | 1;
  playerNames: [string, string];
  playerScores: [number, number];
  playerBonusAwarded: [boolean, boolean];
  playerSquares: [Set<string>, Set<string>];
  squareOwner: Map<string, 0 | 1>;
}

function makeInitialState(names: [string, string] = ["Player 1", "Player 2"]): GameState {
  return {
    guesses: new Map(),
    usedPlayers: new Set(),
    finished: false,
    bonusAwarded: false,
    currentPlayer: 0,
    playerNames: names,
    playerScores: [0, 0],
    playerBonusAwarded: [false, false],
    playerSquares: [new Set<string>(), new Set<string>()],
    squareOwner: new Map(),
  };
}

function squareKey(r: number, c: number) {
  return `${r}-${c}`;
}

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
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
  const norm = (s: string) =>
    s.toLowerCase().trim()
      .replace(/ß/g, "ss")
      .replace(/ø/g, "o")
      .replace(/æ/g, "ae")
      .replace(/đ/g, "d")
      .replace(/ł/g, "l")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 \-]/g, "");
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
    // Surname matching: if input has multiple words, check if any input word
    // fuzzy-matches the surname (last word) of the answer
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

function getScore(found: TicTacToeAnswer[]): number {
  return found.reduce((s, a) => s + a.points, 0);
}

function getMaxScore(square: TicTacToeSquareData): number {
  return square.answers.reduce((s, a) => s + a.points, 0);
}

function checkThreeInARowForSquares(squares: Set<string>): boolean {
  const has = (r: number, c: number) => squares.has(squareKey(r, c));
  for (let r = 0; r < 3; r++) if (has(r, 0) && has(r, 1) && has(r, 2)) return true;
  for (let c = 0; c < 3; c++) if (has(0, c) && has(1, c) && has(2, c)) return true;
  if (has(0, 0) && has(1, 1) && has(2, 2)) return true;
  if (has(0, 2) && has(1, 1) && has(2, 0)) return true;
  return false;
}

function checkThreeInARow(guesses: Map<string, TicTacToeAnswer[]>): boolean {
  const squares = new Set<string>();
  guesses.forEach((found, key) => {
    if (found.length > 0) squares.add(key);
  });
  return checkThreeInARowForSquares(squares);
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ── Mode Selection ── */
function ModeSelection({
  puzzle,
  onStart,
}: {
  puzzle: TicTacToePuzzle;
  onStart: (mode: GameMode, names: [string, string]) => void;
}) {
  const [selected, setSelected] = useState<GameMode | null>(null);
  const [names, setNames] = useState<[string, string]>(["Player 1", "Player 2"]);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <h1 className="font-display text-3xl font-black tracking-wide text-white md:text-5xl mb-2">
        {puzzle.title}
      </h1>
      <p className="text-sm text-white mb-10">Choose how you want to play</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setSelected("solo")}
          className={`rounded-2xl border-2 p-6 text-left transition-all ${
            selected === "solo"
              ? "border-indigo-500 bg-indigo-900/30"
              : "border-gray-700 bg-gray-900 hover:border-gray-600"
          }`}
        >
          <div className="text-3xl mb-2">🎮</div>
          <p className="font-display text-lg font-bold text-white">Solo</p>
          <p className="text-xs text-white mt-1">Play on your own, beat your high score</p>
        </button>

        <button
          onClick={() => setSelected("2player")}
          className={`rounded-2xl border-2 p-6 text-left transition-all ${
            selected === "2player"
              ? "border-purple-500 bg-purple-900/30"
              : "border-gray-700 bg-gray-900 hover:border-gray-600"
          }`}
        >
          <div className="text-3xl mb-2">👥</div>
          <p className="font-display text-lg font-bold text-white">2 Player</p>
          <p className="text-xs text-white mt-1">Take turns, compete head-to-head</p>
        </button>
      </div>

      {selected === "2player" && (
        <div className="mb-8 rounded-xl bg-gray-900 border border-gray-700 p-5 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-white mb-4">
            Player Names
          </p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-white mb-1">Player 1</label>
              <input
                type="text"
                value={names[0]}
                onChange={(e) => setNames([e.target.value, names[1]])}
                placeholder="Player 1"
                maxLength={20}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-white mb-1">Player 2</label>
              <input
                type="text"
                value={names[1]}
                onChange={(e) => setNames([names[0], e.target.value])}
                placeholder="Player 2"
                maxLength={20}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {selected && (
        <button
          onClick={() => onStart(selected, [names[0].trim() || "Player 1", names[1].trim() || "Player 2"])}
          className="rounded-xl bg-indigo-600 px-10 py-3.5 text-base font-bold uppercase tracking-wider text-white transition-colors hover:bg-indigo-500"
        >
          Start Game
        </button>
      )}
    </div>
  );
}

/* ── Solo Scoreboard (top-left corner) ── */
function SoloScoreboard({
  score,
  maxScore,
  bonusAwarded,
  bonusValue,
  hintsUsed,
  elapsed,
}: {
  score: number;
  maxScore: number;
  bonusAwarded: boolean;
  bonusValue: number;
  hintsUsed: number;
  elapsed: number;
}) {
  return (
    <div className="aspect-square rounded-md bg-gray-900 border border-gray-700 flex flex-col items-center justify-center p-1.5 md:p-2.5 overflow-hidden gap-0.5">
      <p className="font-display text-xl font-black text-white leading-tight md:text-3xl">
        {score}
      </p>
      <p className="text-[9px] font-bold text-white leading-tight md:text-xs">
        / {maxScore}
      </p>
      {bonusAwarded && (
        <p className="text-[7px] font-bold text-green-400 leading-tight md:text-[9px]">+{bonusValue} TTT!</p>
      )}
      <p className="text-[10px] font-mono font-bold text-indigo-400 leading-tight md:text-xs">
        {formatTime(elapsed)}
      </p>
      {hintsUsed > 0 && (
        <p className="text-[7px] font-bold text-amber-400 leading-tight md:text-[9px]">
          {hintsUsed} hint{hintsUsed !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

/* ── 2P Scoreboard (top-left corner) ── */
function TwoPlayerScoreboard({
  gameState,
  bonusValue,
  playerTimers,
}: {
  gameState: GameState;
  bonusValue: number;
  playerTimers: [number, number];
}) {
  const [p1, p2] = gameState.playerNames;
  const [s1, s2] = gameState.playerScores;
  const cp = gameState.currentPlayer;

  return (
    <div className="aspect-square rounded-md bg-gray-900 border border-gray-700 flex flex-col justify-between p-2 md:p-3 overflow-hidden">
      <div className={`rounded-md px-2 py-1 transition-all md:px-3 md:py-1.5 ${cp === 0 ? "bg-green-600" : "bg-gray-800"}`}>
        <p className="text-[9px] font-bold uppercase tracking-wide text-white truncate md:text-xs">
          {p1}
        </p>
        <p className={`font-display text-base font-black leading-tight md:text-xl ${cp === 0 ? "text-white" : "text-white"}`}>
          {s1}
        </p>
        <p className="text-[8px] font-mono font-bold text-white/70 md:text-[10px]">{formatTime(playerTimers[0])}</p>
        {gameState.playerBonusAwarded[0] && (
          <p className="text-[8px] font-bold text-yellow-300 md:text-[10px]">+{bonusValue} TTT!</p>
        )}
      </div>

      <p className="text-center text-[8px] font-bold uppercase tracking-wider text-white md:text-[10px]">
        {cp === 0 ? p1 : p2}&apos;s turn
      </p>

      <div className={`rounded-md px-2 py-1 transition-all md:px-3 md:py-1.5 ${cp === 1 ? "bg-yellow-500" : "bg-gray-800"}`}>
        <p className={`text-[9px] font-bold uppercase tracking-wide truncate md:text-xs ${cp === 1 ? "text-yellow-900" : "text-white"}`}>
          {p2}
        </p>
        <p className={`font-display text-base font-black leading-tight md:text-xl ${cp === 1 ? "text-yellow-900" : "text-white"}`}>
          {s2}
        </p>
        <p className={`text-[8px] font-mono font-bold md:text-[10px] ${cp === 1 ? "text-yellow-800/70" : "text-white/70"}`}>{formatTime(playerTimers[1])}</p>
        {gameState.playerBonusAwarded[1] && (
          <p className="text-[8px] font-bold text-yellow-900 md:text-[10px]">+{bonusValue} TTT!</p>
        )}
      </div>
    </div>
  );
}

interface Props {
  puzzle: TicTacToePuzzle;
  isDaily?: boolean;
}

export default function TicTacToeGame({ puzzle, isDaily }: Props) {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [gameState, setGameState] = useState<GameState>(makeInitialState());
  const [selectedSquare, setSelectedSquare] = useState<{ r: number; c: number } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<{
    text: string;
    type: "correct" | "wrong" | "duplicate";
  } | null>(null);
  const [popup, setPopup] = useState<{ text: string; title: string; isHint: boolean } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const router = useRouter();
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set());
  const [hintsUsed, setHintsUsed] = useState(0);
  const [scoreSaved, setScoreSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null!);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>();

  // Timer state
  const [soloTimer, setSoloTimer] = useState(0);
  const [playerTimers, setPlayerTimers] = useState<[number, number]>([0, 0]);
  const lastTickRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Ref to always read the latest gameState (avoids stale closures in handleGuess)
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    if (selectedSquare && inputRef.current) inputRef.current.focus();
  }, [selectedSquare]);

  // Timer effect
  useEffect(() => {
    if (!mode || gameState.finished) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const cp = gameState.currentPlayer;
    lastTickRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      if (mode === "solo") {
        setSoloTimer(prev => prev + delta);
      } else {
        setPlayerTimers(prev =>
          cp === 0 ? [prev[0] + delta, prev[1]] : [prev[0], prev[1] + delta]
        );
      }
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode, gameState.finished, gameState.currentPlayer]);

  const totalMaxScore = (() => {
    let total = 0;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) total += getMaxScore(puzzle.grid[r][c]);
    total += puzzle.three_in_a_row_bonus;
    return total;
  })();

  const soloCurrentScore = (() => {
    let total = 0;
    gameState.guesses.forEach((found) => {
      total += getScore(found);
    });
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
    if (!selectedSquare || !inputValue.trim() || !mode) return;
    const { r, c } = selectedSquare;
    const key = squareKey(r, c);
    const square = puzzle.grid[r][c];
    const gs = gameStateRef.current;
    const currentGuesses = gs.guesses.get(key) ?? [];
    const is2P = mode === "2player";

    const match = square.answers.find((a) => fuzzyMatch(inputValue, a));
    setInputValue("");

    if (!match) {
      if (is2P) {
        setFeedback({ text: "Incorrect!", type: "wrong" });
        setSelectedSquare(null);
        setGameState(s => ({ ...s, currentPlayer: s.currentPlayer === 0 ? 1 : 0 }));
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback({ text: "Incorrect! Try Again!", type: "wrong" });
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setFeedback(null), 2000);
      }
    } else if (currentGuesses.some((g) => g.name === match.name)) {
      setFeedback({ text: "Already found in this square!", type: "duplicate" });
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(null), 1500);
    } else if (gs.usedPlayers.has(match.name)) {
      setFeedback({ text: `${match.name} already used in another square!`, type: "duplicate" });
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(null), 1500);
    } else {
      const newGuesses = new Map(gs.guesses);
      newGuesses.set(key, [...currentGuesses, match]);
      const newUsed = new Set(gs.usedPlayers);
      newUsed.add(match.name);

      if (!is2P) {
        let bonusAwarded = gs.bonusAwarded;
        if (!bonusAwarded && checkThreeInARow(newGuesses)) bonusAwarded = true;
        setGameState(prev => ({ ...prev, guesses: newGuesses, usedPlayers: newUsed, bonusAwarded }));
        setFeedback({ text: `${match.name} — ${match.points} pts!`, type: "correct" });
        setSelectedSquare(null);
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setFeedback(null), 2000);
      } else {
        const cp = gs.currentPlayer;
        const newScores: [number, number] = [gs.playerScores[0], gs.playerScores[1]];
        newScores[cp] += match.points;

        const newPlayerSquares: [Set<string>, Set<string>] = [
          new Set(gs.playerSquares[0]),
          new Set(gs.playerSquares[1]),
        ];
        newPlayerSquares[cp].add(key);

        const newPlayerBonusAwarded: [boolean, boolean] = [
          gs.playerBonusAwarded[0],
          gs.playerBonusAwarded[1],
        ];
        if (!newPlayerBonusAwarded[cp] && checkThreeInARowForSquares(newPlayerSquares[cp])) {
          newPlayerBonusAwarded[cp] = true;
          newScores[cp] += puzzle.three_in_a_row_bonus;
        }

        const newOwner = new Map(gs.squareOwner);
        if (!newOwner.has(key)) newOwner.set(key, cp);

        setGameState(prev => ({
          ...prev,
          guesses: newGuesses,
          usedPlayers: newUsed,
          playerScores: newScores,
          playerSquares: newPlayerSquares,
          playerBonusAwarded: newPlayerBonusAwarded,
          squareOwner: newOwner,
          currentPlayer: cp === 0 ? 1 : 0,
        }));
        setSelectedSquare(null);
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      }
    }
  }, [selectedSquare, inputValue, puzzle, mode]);

  const saveScore = useCallback(async (finalScore: number, maxScore: number, timeSeconds: number) => {
    if (scoreSaved) return;
    setScoreSaved(true);
    try {
      await fetch(`/api/tictactoe/${puzzle.id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: finalScore,
          max_score: maxScore,
          hints_used: hintsUsed,
          time_seconds: timeSeconds,
        }),
      });
    } catch { /* silent — score saving is best-effort */ }
  }, [puzzle.id, hintsUsed, scoreSaved]);

  const handleFinish = () => {
    const is2P = mode === "2player";
    let finalScore: number;
    let timeSeconds: number;
    if (is2P) {
      const [s1, s2] = gameState.playerScores;
      finalScore = s1 + s2;
      const bonusCount = (gameState.playerBonusAwarded[0] ? 1 : 0) + (gameState.playerBonusAwarded[1] ? 1 : 0);
      if (bonusCount > 1) finalScore -= puzzle.three_in_a_row_bonus;
      timeSeconds = Math.round((playerTimers[0] + playerTimers[1]) / 1000);
    } else {
      finalScore = soloCurrentScore;
      timeSeconds = Math.round(soloTimer / 1000);
    }
    saveScore(finalScore, totalMaxScore, timeSeconds);
    setGameState((s) => ({ ...s, finished: true }));
    setSelectedSquare(null);
  };

  if (!mode) {
    return (
      <ModeSelection
        puzzle={puzzle}
        onStart={(m, names) => {
          setMode(m);
          setGameState(makeInitialState(m === "2player" ? names : ["Player 1", "Player 2"]));
          setSoloTimer(0);
          setPlayerTimers([0, 0]);
        }}
      />
    );
  }

  if (gameState.finished) {
    const finalTime = mode === "solo" ? soloTimer : playerTimers[0] + playerTimers[1];
    return (
      <ResultsScreen
        puzzle={puzzle}
        gameState={gameState}
        mode={mode}
        soloCurrentScore={soloCurrentScore}
        totalMaxScore={totalMaxScore}
        hintsUsed={hintsUsed}
        elapsed={finalTime}
        playerTimers={mode === "2player" ? playerTimers : undefined}
        onPlayAgain={() => {
          setMode(null);
          setGameState(makeInitialState());
          setSelectedSquare(null);
          setHintsUsed(0);
          setRevealedHints(new Set());
          setPopup(null);
          setScoreSaved(false);
          setSoloTimer(0);
          setPlayerTimers([0, 0]);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 md:px-4 md:py-8">
      {/* Back button for daily puzzles */}
      {isDaily && (
        <div className="mb-4">
          <button
            onClick={() => setShowBackConfirm(true)}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Home
          </button>
        </div>
      )}

      {/* Back confirmation modal */}
      {showBackConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl text-center">
            <p className="text-lg font-black text-white mb-1">Leave this puzzle?</p>
            <p className="text-sm text-gray-400 mb-6">Your progress will be lost.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBackConfirm(false)}
                className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-700"
              >
                Keep Playing
              </button>
              <button
                onClick={() => router.push("/tic-tac-toe")}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 text-center md:mb-8">
        <h1 className="font-display text-3xl font-black tracking-wide text-white md:text-5xl">
          {puzzle.title}
        </h1>
        <div className="mt-3 flex items-center justify-center gap-4 text-sm">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              puzzle.difficulty === "easy"
                ? "bg-green-900/50 text-green-300 border border-green-700"
                : puzzle.difficulty === "medium"
                ? "bg-yellow-900/50 text-yellow-300 border border-yellow-700"
                : "bg-red-900/50 text-red-300 border border-red-700"
            }`}
          >
            {puzzle.difficulty}
          </span>
          {mode === "2player" && (
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              2 Player
            </span>
          )}
        </div>
        {mode === "2player" && !feedback && (
          <p className="mt-2 text-sm font-bold text-indigo-300">
            {gameState.playerNames[gameState.currentPlayer]}&apos;s turn — pick a square
          </p>
        )}
        {feedback && !selectedSquare && (
          <p className={`mt-3 text-xl font-black uppercase tracking-wide ${
            feedback.type === "correct" ? "text-green-400" : "text-red-500"
          }`}>
            {feedback.text}
          </p>
        )}
        <button
          onClick={() => setShowTutorial(true)}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-xs font-bold text-white hover:text-white hover:border-gray-500 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How to Play
        </button>
      </div>

      {/* Tutorial modal */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowTutorial(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900 rounded-t-2xl">
              <h2 className="text-base font-black text-white">How to Play</h2>
              <button onClick={() => setShowTutorial(false)} className="text-white hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-5 text-sm text-white">

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">The Grid</h3>
                <p>You&apos;re given a 3×3 grid. Each <strong className="text-white">row</strong> (left side) and <strong className="text-white">column</strong> (top) has a label — this could be a football club (e.g. <em>Arsenal</em>), a nationality (e.g. <em>Brazil</em>), a league (e.g. <em>La Liga</em>), or a special category (e.g. <em>50+ caps</em>).</p>
                <p className="mt-1.5">To fill a square, you must name a player who matches <strong className="text-white">both</strong> the row label on the left and the column label above that square. For example, if the row says <em>Arsenal</em> and the column says <em>France</em>, you need to name a player who has played for Arsenal <strong className="text-white">and</strong> is French.</p>
                <p className="mt-1.5">A player qualifies if they meet the requirement at <strong className="text-white">any point in their career</strong> — not just their current club or stats.</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Sub-Requirements</h3>
                <p>Some squares have a <strong className="text-white">sub-requirement</strong> — extra text shown inside the square. These change what a square requires beyond just the row and column labels. There are three main types:</p>
                <ul className="mt-2 space-y-2.5">
                  <li>
                    <strong className="text-indigo-400">And</strong> — The square shows a third requirement inside it. Your answer must match <strong className="text-white">all three</strong>: the row label, the column label, <em>and</em> the sub-requirement. For example: Row = <em>Arsenal</em>, Column = <em>France</em>, Sub = <em>World Cup Winner</em> — you&apos;d need a French player who played for Arsenal and won the World Cup.
                  </li>
                  <li>
                    <strong className="text-indigo-400">Replace Left / Replace Above</strong> — The sub-requirement <strong className="text-white">replaces</strong> either the row label (left) or the column label (above). So instead of matching the original row/column, you match the sub-requirement text instead. The square text tells you what the replacement is.
                  </li>
                  <li>
                    <strong className="text-indigo-400">Or Replace Left / Or Replace Above</strong> — The sub-requirement gives you an <strong className="text-white">alternative</strong> for one of the labels. Your answer can match either the original row/column label <em>or</em> the sub-requirement text. For example: Row = <em>Arsenal</em>, Column = <em>France</em>, Sub = <em>Or Replace Left: Chelsea</em> — the player could have played for Arsenal <em>or</em> Chelsea, and be French.
                  </li>
                </ul>
                <p className="mt-2 text-white">If a square has no sub-requirement text inside it, it&apos;s a normal square — just match the row and column labels.</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">How to Guess</h3>
                <p>Click any empty square to select it, then type a player&apos;s name and press Enter. Names are fuzzy-matched — typos and accents are handled automatically. You can also type just a surname if it&apos;s unique enough.</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Scoring</h3>
                <p>Each valid answer earns points based on how rare that player is as an answer for that specific square. Rarer answers score more. Filling all 9 squares earns a <strong className="text-white">bonus</strong> on top.</p>
                <p className="mt-1.5">In solo mode your total score is shown as you go. Try to beat your personal best by picking the highest-scoring answers.</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">No Repeated Players</h3>
                <p>You <strong className="text-white">cannot use the same player in more than one square</strong> — even if they technically qualify for multiple squares. Each player can only be placed once per game.</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Info &amp; Hints</h3>
                <p>Some labels have an <strong className="text-cyan-400">ⓘ info button</strong> — tap it to see exactly what counts for that label (e.g. what qualifies as &quot;50+ caps&quot;).</p>
                <p className="mt-1.5">Some labels also have a <strong className="text-indigo-400">? hint button</strong> which gives you a clue about a valid answer. Using a hint reduces your final score.</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">2 Player Mode</h3>
                <p>Players take turns. On your turn, pick any unclaimed square and enter a valid player. If your answer is correct, you <strong className="text-white">claim that square</strong>. Get <strong className="text-white">three in a row</strong> (horizontally, vertically, or diagonally) to win a bonus.</p>
                <p className="mt-1.5">Each player has their own score and timer. The player with the most points when all squares are filled wins.</p>
                <p className="mt-1.5">Both players share the same no-repeat rule — if Player 1 uses Messi, Player 2 cannot use Messi either.</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Tips</h3>
                <ul className="space-y-1 list-disc list-inside text-white">
                  <li>Think of obscure players for rarer squares — they score more points.</li>
                  <li>Plan ahead so you don&apos;t use a key player in the wrong square.</li>
                  <li>In 2-player, block your opponent&apos;s three-in-a-row by claiming a key square.</li>
                  <li>Check sub-requirements carefully — they change what a square needs.</li>
                  <li>Use hints sparingly — they cost points.</li>
                </ul>
              </section>

            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="mb-6">
        {/* Column labels row */}
        <div className="grid grid-cols-4 gap-1.5 md:gap-2">
          {mode === "2player" ? (
            <TwoPlayerScoreboard gameState={gameState} bonusValue={puzzle.three_in_a_row_bonus} playerTimers={playerTimers} />
          ) : (
            <SoloScoreboard
              score={soloCurrentScore}
              maxScore={totalMaxScore}
              bonusAwarded={gameState.bonusAwarded}
              bonusValue={puzzle.three_in_a_row_bonus}
              hintsUsed={hintsUsed}
              elapsed={soloTimer}
            />
          )}
          {puzzle.col_labels.map((label, c) => {
            const colExtra = puzzle.label_extras?.cols?.[c];
            const colHasInfo = !!colExtra?.info;
            const colHasHint = !!colExtra?.hint;
            return (
              <div key={c} className="relative aspect-square">
                <div className="w-full h-full flex items-center justify-center rounded-md bg-gray-800/70 px-1.5 py-2 text-center text-[10px] font-bold uppercase tracking-tight text-white md:text-sm md:px-3 md:tracking-wide">
                  {label}
                </div>
                {colHasInfo && (
                  <button
                    onClick={() => setPopup({ text: colExtra!.info!, title: `Info: ${label}`, isHint: false })}
                    className="absolute top-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-black text-white shadow-md hover:bg-cyan-500 transition-colors md:h-6 md:w-6 md:text-xs"
                    aria-label="Show info"
                  >
                    i
                  </button>
                )}
                {colHasHint && (
                  <button
                    onClick={() => {
                      const hKey = `col-${c}`;
                      if (!revealedHints.has(hKey)) {
                        setRevealedHints((prev) => new Set(prev).add(hKey));
                        setHintsUsed((prev) => prev + 1);
                      }
                      setPopup({ text: colExtra!.hint!, title: `Hint: ${label}`, isHint: true });
                    }}
                    className={`absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shadow-md transition-colors md:h-6 md:w-6 md:text-xs ${
                      revealedHints.has(`col-${c}`)
                        ? "bg-amber-500 hover:bg-amber-400"
                        : "bg-indigo-600 hover:bg-indigo-500"
                    }`}
                    aria-label="Use hint"
                  >
                    ?
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {puzzle.grid.map((row, r) => (
          <div
            key={r}
            className="grid grid-cols-4 gap-1.5 mt-1.5 md:gap-2 md:mt-2"
          >
            {(() => {
              const rowExtra = puzzle.label_extras?.rows?.[r];
              const rowHasInfo = !!rowExtra?.info;
              const rowHasHint = !!rowExtra?.hint;
              return (
                <div className="relative aspect-square">
                  <div className="w-full h-full flex items-center justify-center rounded-md bg-gray-800/70 px-1.5 py-2 text-center text-[10px] font-bold uppercase tracking-tight text-white md:text-sm md:px-3 md:tracking-wide">
                    {puzzle.row_labels[r]}
                  </div>
                  {rowHasInfo && (
                    <button
                      onClick={() => setPopup({ text: rowExtra!.info!, title: `Info: ${puzzle.row_labels[r]}`, isHint: false })}
                      className="absolute top-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-black text-white shadow-md hover:bg-cyan-500 transition-colors md:h-6 md:w-6 md:text-xs"
                      aria-label="Show info"
                    >
                      i
                    </button>
                  )}
                  {rowHasHint && (
                    <button
                      onClick={() => {
                        const hKey = `row-${r}`;
                        if (!revealedHints.has(hKey)) {
                          setRevealedHints((prev) => new Set(prev).add(hKey));
                          setHintsUsed((prev) => prev + 1);
                        }
                        setPopup({ text: rowExtra!.hint!, title: `Hint: ${puzzle.row_labels[r]}`, isHint: true });
                      }}
                      className={`absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shadow-md transition-colors md:h-6 md:w-6 md:text-xs ${
                        revealedHints.has(`row-${r}`)
                          ? "bg-amber-500 hover:bg-amber-400"
                          : "bg-indigo-600 hover:bg-indigo-500"
                      }`}
                      aria-label="Use hint"
                    >
                      ?
                    </button>
                  )}
                </div>
              );
            })()}

            {row.map((square, c) => {
              const key = squareKey(r, c);
              const found = gameState.guesses.get(key) ?? [];
              const sqScore = getScore(found);
              const isSelected = selectedSquare?.r === r && selectedSquare?.c === c;
              const isCustom = square.type === "custom";
              const isFilled = found.length > 0;
              const owner = gameState.squareOwner.get(key);
              const isP2Square = mode === "2player" && owner === 1;

              const availableAnswers = square.answers.filter(
                (a) => !gameState.usedPlayers.has(a.name)
              );
              const availableCount = availableAnswers.length;
              const availableMax = availableAnswers.reduce((s, a) => s + a.points, 0);

              const filledBg = isP2Square
                ? "bg-yellow-400 hover:bg-yellow-300"
                : "bg-green-500 hover:bg-green-400";
              const filledBorder = isP2Square ? "border-yellow-600/50" : "border-green-700/50";
              const filledTextDark = isP2Square ? "text-yellow-900" : "text-green-900";

              const hasHint = !!square.hint;

              return (
                <div key={c} className="relative aspect-square">
                  <button
                    onClick={() => {
                      setSelectedSquare({ r, c });
                      setInputValue("");
                      setFeedback(null);
                    }}
                    className={`group relative w-full h-full flex flex-col rounded-md p-2 transition-all md:p-3 text-left overflow-hidden ${
                      isFilled ? filledBg : "bg-white hover:bg-gray-100"
                    } ${isSelected ? "ring-4 ring-indigo-500" : ""}`}
                  >
                    {isCustom && (
                    <div
                      className={`w-full text-center pb-1 mb-1 border-b ${
                        isFilled ? filledBorder : "border-gray-300"
                      }`}
                    >
                      <p
                        className={`text-[8px] font-bold leading-tight md:text-[10px] ${
                          isFilled ? filledTextDark : "text-gray-900"
                        }`}
                      >
                        {square.customType
                          ? `${CUSTOM_SQUARE_LABELS[square.customType]} - ${square.customText}`
                          : `${square.conditions[0]} + ${square.conditions[1]}`}
                      </p>
                    </div>
                  )}

                  <div className="flex-1 flex flex-col items-center justify-center w-full overflow-hidden">
                    {isFilled ? (
                      <div className="w-full space-y-0.5 overflow-hidden text-center">
                        {found.slice(0, 5).map((a) => (
                          <p
                            key={a.name}
                            className="text-[10px] font-bold leading-tight text-gray-900 truncate md:text-sm"
                          >
                            {a.name}{" "}
                            <span className={`font-black ${filledTextDark}`}>{a.points}</span>
                          </p>
                        ))}
                        {found.length > 5 && (
                          <p className={`text-[9px] font-bold md:text-xs ${filledTextDark}`}>
                            +{found.length - 5} more
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="font-display text-base font-black text-gray-900 md:text-2xl">
                          {availableCount}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500 md:text-[11px]">
                          Player{availableCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="w-full text-center mt-1">
                    <p
                      className={`font-display text-xs font-black md:text-sm ${
                        isFilled ? filledTextDark : "text-gray-900"
                      }`}
                    >
                      {isFilled ? `${sqScore} / ${sqScore + availableMax}` : `${availableMax} pts`}
                    </p>
                  </div>
                  </button>

                  {/* Info button */}
                  {square.info && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopup({ text: square.info!, title: `Info: ${square.conditions[0]} + ${square.conditions[1]}`, isHint: false });
                      }}
                      className="absolute bottom-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-black text-white shadow-md hover:bg-cyan-500 transition-colors md:h-6 md:w-6 md:text-xs"
                      aria-label="Show info"
                    >
                      i
                    </button>
                  )}
                  {/* Hint button */}
                  {hasHint && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const hKey = `sq-${squareKey(r, c)}`;
                        if (!revealedHints.has(hKey)) {
                          setRevealedHints((prev) => new Set(prev).add(hKey));
                          setHintsUsed((prev) => prev + 1);
                        }
                        setPopup({ text: square.hint!, title: `Hint: ${square.conditions[0]} + ${square.conditions[1]}`, isHint: true });
                      }}
                      className={`absolute bottom-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shadow-md transition-colors md:h-6 md:w-6 md:text-xs ${
                        revealedHints.has(`sq-${squareKey(r, c)}`)
                          ? "bg-amber-500 hover:bg-amber-400"
                          : "bg-indigo-600 hover:bg-indigo-500"
                      }`}
                      aria-label="Use hint"
                    >
                      ?
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedSquare && (
        <SquareModal
          square={puzzle.grid[selectedSquare.r][selectedSquare.c]}
          found={gameState.guesses.get(squareKey(selectedSquare.r, selectedSquare.c)) ?? []}
          inputValue={inputValue}
          setInputValue={setInputValue}
          onGuess={handleGuess}
          feedback={feedback}
          inputRef={inputRef}
          onClose={() => setSelectedSquare(null)}
          mode={mode}
          currentPlayerName={gameState.playerNames[gameState.currentPlayer]}
          usedPlayers={gameState.usedPlayers}
        />
      )}

      {/* Info/Hint popup */}
      {popup && (() => {
        const isImage = /^https?:\/\/.+/i.test(popup.text) && /\.(jpg|jpeg|png|gif|webp|svg|avif)/i.test(popup.text);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPopup(null)}>
            <div className="absolute inset-0 bg-black/70" />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-lg font-black text-gray-900">{popup.title}</p>
                <button onClick={() => setPopup(null)} className="text-white hover:text-gray-900 text-2xl leading-none">&times;</button>
              </div>
              {isImage ? (
                <img src={popup.text} alt={popup.isHint ? "Hint" : "Info"} className="w-full rounded-lg" />
              ) : (
                <p className="text-base font-semibold text-gray-800 whitespace-pre-wrap leading-relaxed">{popup.text}</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Finish button */}
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={handleFinish}
          className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-indigo-500 md:text-base"
        >
          {allSquaresFilled ? "View Results" : "Give Up and See Results"}
        </button>
      </div>
    </div>
  );
}

/* ── Square modal ── */
function SquareModal({
  square,
  found,
  inputValue,
  setInputValue,
  onGuess,
  feedback,
  inputRef,
  onClose,
  mode,
  currentPlayerName,
  usedPlayers,
}: {
  square: TicTacToeSquareData;
  found: TicTacToeAnswer[];
  inputValue: string;
  setInputValue: (v: string) => void;
  onGuess: () => void;
  feedback: { text: string; type: "correct" | "wrong" | "duplicate" } | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onClose: () => void;
  mode: GameMode;
  currentPlayerName: string;
  usedPlayers: Set<string>;
}) {
  const sqScore = getScore(found);
  const availableAnswers = square.answers.filter((a) => !usedPlayers.has(a.name));
  const availableCount = availableAnswers.length;
  const availableMax = availableAnswers.reduce((s, a) => s + a.points, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "2player" && (
          <div className="mb-3 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-center">
            <p className="text-sm font-bold text-indigo-700">{currentPlayerName}&apos;s turn</p>
            <p className="text-xs text-indigo-500">1 guess</p>
          </div>
        )}

        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            {square.customType ? (
              <>
                <p className="text-sm font-bold text-indigo-600 md:text-base">{CUSTOM_SQUARE_LABELS[square.customType]}</p>
                <p className="text-base font-bold text-gray-900 md:text-lg">{square.customText}</p>
              </>
            ) : (
              <>
                <p className="text-base font-bold text-gray-900 md:text-lg">{square.conditions[0]}</p>
                <p className="text-sm font-semibold text-gray-700 md:text-base">
                  + {square.conditions[1]}
                </p>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-900 text-2xl leading-none -mt-1"
          >
            &times;
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 text-sm">
          <span className="text-white">
            Score: <span className="font-display font-black text-gray-900">{sqScore}</span>{" "}
            <span className="text-white">/</span> {sqScore + availableMax}
          </span>
          <span className="text-white">
            Available:{" "}
            <span className="font-display font-black text-gray-900">{availableCount}</span>{" "}
            <span className="text-white">({availableMax} pts)</span>
          </span>
        </div>

        <div className="mb-3 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onGuess();
            }}
            placeholder="Type a player name..."
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            onClick={onGuess}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-indigo-500"
          >
            Guess
          </button>
        </div>

        {feedback && (
          <p
            className={`mb-3 font-black ${
              feedback.type === "correct"
                ? "text-base text-green-600"
                : feedback.type === "duplicate"
                ? "text-sm text-yellow-600"
                : "text-lg text-red-600 uppercase tracking-wide"
            }`}
          >
            {feedback.text}
          </p>
        )}

        {found.length > 0 && (
          <div className="space-y-1 max-h-56 overflow-y-auto">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white">
              Found ({found.length})
            </p>
            {[...found]
              .sort((a, b) => b.points - a.points)
              .map((a) => (
                <div
                  key={a.name}
                  className="flex items-center justify-between rounded-lg bg-green-100 border border-green-200 px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-gray-900">{a.name}</span>
                  <span className="font-display font-black text-green-700">{a.points} pts</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Results screen ── */
function ResultsScreen({
  puzzle,
  gameState,
  mode,
  soloCurrentScore,
  totalMaxScore,
  hintsUsed,
  elapsed,
  playerTimers,
  onPlayAgain,
}: {
  puzzle: TicTacToePuzzle;
  gameState: GameState;
  mode: GameMode;
  soloCurrentScore: number;
  totalMaxScore: number;
  hintsUsed: number;
  elapsed: number;
  playerTimers?: [number, number];
  onPlayAgain: () => void;
}) {
  const is2P = mode === "2player";
  const [s1, s2] = gameState.playerScores;
  const [n1, n2] = gameState.playerNames;
  const winner: -1 | 0 | 1 = is2P ? (s1 > s2 ? 0 : s2 > s1 ? 1 : -1) : -1;
  const pct =
    totalMaxScore > 0 ? Math.round((soloCurrentScore / totalMaxScore) * 100) : 0;

  let squaresCompleted = 0;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if ((gameState.guesses.get(squareKey(r, c))?.length ?? 0) > 0) squaresCompleted++;

  const missed: { name: string; points: number; conditions: string }[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const sq = puzzle.grid[r][c];
      const found = gameState.guesses.get(squareKey(r, c)) ?? [];
      const foundNames = new Set(found.map((a) => a.name));
      for (const ans of sq.answers) {
        if (!foundNames.has(ans.name) && ans.points >= 4) {
          missed.push({ name: ans.name, points: ans.points, conditions: sq.conditions.join(" + ") });
        }
      }
    }
  }
  missed.sort((a, b) => b.points - a.points);

  const emojiGrid = (() => {
    const rows: string[] = [];
    for (let r = 0; r < 3; r++) {
      let row = "";
      for (let c = 0; c < 3; c++) {
        const found = gameState.guesses.get(squareKey(r, c)) ?? [];
        const sqScore = getScore(found);
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

  const shareText = is2P
    ? `Football Tic Tac Toe — ${puzzle.title}\n${n1}: ${s1}pts${gameState.playerBonusAwarded[0] ? " (TTT!)" : ""}\n${n2}: ${s2}pts${gameState.playerBonusAwarded[1] ? " (TTT!)" : ""}\n${emojiGrid}`
    : `Football Tic Tac Toe — ${puzzle.title}\n${soloCurrentScore}/${totalMaxScore} (${pct}%) in ${formatTime(elapsed)}\n${emojiGrid}`;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 text-center">
      <h2 className="text-3xl font-black text-white">
        {is2P
          ? winner === -1
            ? "It's a Tie!"
            : `${gameState.playerNames[winner]} Wins!`
          : "Game Over!"}
      </h2>

      <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-6">
        {is2P ? (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div
              className={`rounded-xl p-4 ${
                winner === 0 ? "bg-indigo-900 border-2 border-indigo-400" : "bg-gray-800"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-white mb-1">{n1}</p>
              <p
                className={`text-4xl font-black ${
                  winner === 0 ? "text-indigo-300" : "text-white"
                }`}
              >
                {s1}
              </p>
              {playerTimers && (
                <p className="text-xs font-mono font-bold text-white mt-1">{formatTime(playerTimers[0])}</p>
              )}
              {gameState.playerBonusAwarded[0] && (
                <p className="text-xs font-bold text-yellow-400 mt-1">
                  +{puzzle.three_in_a_row_bonus} TTT Bonus!
                </p>
              )}
            </div>
            <div
              className={`rounded-xl p-4 ${
                winner === 1 ? "bg-purple-900 border-2 border-purple-400" : "bg-gray-800"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-white mb-1">{n2}</p>
              <p
                className={`text-4xl font-black ${
                  winner === 1 ? "text-purple-300" : "text-white"
                }`}
              >
                {s2}
              </p>
              {playerTimers && (
                <p className="text-xs font-mono font-bold text-white mt-1">{formatTime(playerTimers[1])}</p>
              )}
              {gameState.playerBonusAwarded[1] && (
                <p className="text-xs font-bold text-yellow-400 mt-1">
                  +{puzzle.three_in_a_row_bonus} TTT Bonus!
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="text-5xl font-black text-indigo-400">{soloCurrentScore}</p>
            <p className="text-sm text-white">
              out of {totalMaxScore} ({pct}%)
            </p>
          </>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div className="rounded-lg bg-gray-800 p-3">
            <p className="text-2xl font-black text-white">{squaresCompleted}/9</p>
            <p className="text-white">Squares</p>
          </div>
          <div className="rounded-lg bg-gray-800 p-3">
            <p className="text-2xl font-black text-white">
              {is2P
                ? gameState.playerBonusAwarded[0] || gameState.playerBonusAwarded[1]
                  ? "Yes"
                  : "No"
                : gameState.bonusAwarded
                ? "Yes"
                : "No"}
            </p>
            <p className="text-white">3-in-a-row</p>
          </div>
          <div className="rounded-lg bg-gray-800 p-3">
            <p className="text-2xl font-black text-indigo-400 font-mono">{formatTime(elapsed)}</p>
            <p className="text-white">Time</p>
          </div>
          {hintsUsed > 0 && (
            <div className="rounded-lg bg-gray-800 p-3">
              <p className="text-2xl font-black text-amber-400">{hintsUsed}</p>
              <p className="text-white">Hints</p>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-gray-800 p-3">
          <pre className="text-2xl leading-relaxed">
            {emojiGrid.split("\n").map((row, i) => (
              <span key={i}>
                {row}
                {i < 2 ? "\n" : ""}
              </span>
            ))}
          </pre>
        </div>
      </div>

      {missed.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-4 text-left">
          <h3 className="mb-2 text-sm font-bold text-red-400 uppercase">
            Missed High-Value Players
          </h3>
          <div className="space-y-1.5">
            {missed.slice(0, 10).map((m) => (
              <div key={m.name} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-white">{m.name}</span>
                  <span className="ml-2 text-[10px] text-white">{m.conditions}</span>
                </div>
                <span className="font-bold text-red-400">{m.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-4 text-left">
        <h3 className="mb-3 text-sm font-bold text-white uppercase">All Answers</h3>
        {puzzle.grid.map((row, r) =>
          row.map((sq, c) => {
            const found = gameState.guesses.get(squareKey(r, c)) ?? [];
            const foundNames = new Set(found.map((a) => a.name));
            return (
              <div key={`${r}-${c}`} className="mb-3 rounded-lg bg-gray-800 p-3">
                <p className="text-xs font-bold text-indigo-400 mb-1">
                  {sq.conditions.join(" + ")}
                </p>
                <div className="space-y-0.5">
                  {sq.answers
                    .sort((a, b) => b.points - a.points)
                    .map((a) => (
                      <div
                        key={a.name}
                        className={`flex justify-between text-xs ${
                          foundNames.has(a.name) ? "text-green-400" : "text-white"
                        }`}
                      >
                        <span>
                          {foundNames.has(a.name) ? "✓" : "✗"} {a.name}
                        </span>
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
          onClick={() => navigator.clipboard.writeText(shareText)}
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
