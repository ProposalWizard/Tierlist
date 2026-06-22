"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Answer {
  name: string;
  points: number;
}

interface SquareState {
  answers: Answer[];
}

function emptyGrid(): SquareState[][] {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => ({ answers: [] }))
  );
}

export default function TicTacToeBuilder() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "extreme">("medium");
  const [rowLabels, setRowLabels] = useState(["", "", ""]);
  const [colLabels, setColLabels] = useState(["", "", ""]);
  const [bonus, setBonus] = useState(10);
  const [grid, setGrid] = useState<SquareState[][]>(emptyGrid());
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPoints, setNewPoints] = useState(3);

  function addAnswer() {
    if (!editingCell || !newName.trim()) return;
    const { r, c } = editingCell;
    const newGrid = grid.map((row) => row.map((s) => ({ ...s, answers: [...s.answers] })));
    newGrid[r][c].answers.push({
      name: newName.trim(),
      points: newPoints,
    });
    setGrid(newGrid);
    setNewName("");
    setNewPoints(3);
  }

  function removeAnswer(r: number, c: number, idx: number) {
    const newGrid = grid.map((row) => row.map((s) => ({ ...s, answers: [...s.answers] })));
    newGrid[r][c].answers.splice(idx, 1);
    setGrid(newGrid);
  }

  function setLabel(type: "row" | "col", idx: number, val: string) {
    if (type === "row") {
      const next = [...rowLabels];
      next[idx] = val;
      setRowLabels(next);
    } else {
      const next = [...colLabels];
      next[idx] = val;
      setColLabels(next);
    }
  }

  async function handleSave() {
    setError(null);
    if (!title.trim()) { setError("Give your puzzle a title."); return; }
    if (rowLabels.some((l) => !l.trim()) || colLabels.some((l) => !l.trim())) {
      setError("All row and column labels must be filled in.");
      return;
    }

    // Check every square has at least one answer
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (grid[r][c].answers.length === 0) {
          setError(`Square at row "${rowLabels[r]}" + col "${colLabels[c]}" needs at least one answer.`);
          return;
        }
      }
    }

    setSaving(true);

    const apiGrid = grid.map((row, r) =>
      row.map((sq, c) => ({
        type: "normal" as const,
        conditions: [rowLabels[r], colLabels[c]] as [string, string],
        answers: sq.answers.map((a) => ({
          name: a.name,
          points: a.points,
        })),
        maxScore: sq.answers.reduce((s, a) => s + a.points, 0),
      }))
    );

    try {
      const res = await fetch("/api/tictactoe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          difficulty,
          row_labels: rowLabels,
          col_labels: colLabels,
          grid: apiGrid,
          three_in_a_row_bonus: bonus,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }

      const { id } = await res.json();
      router.push(`/tic-tac-toe/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const ec = editingCell;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-10 text-center">
        <h1 className="font-display text-3xl font-black tracking-wide text-white md:text-4xl">
          Create a Tic Tac Toe
        </h1>
        <p className="mt-2 text-sm text-white">
          Set 3 row labels + 3 column labels, then add player answers to each square.
        </p>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {/* Title & difficulty */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white mb-1">
              Puzzle Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Premier League Legends"
              maxLength={80}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white mb-1">
              Difficulty
            </label>
            <div className="flex gap-2">
              {(["easy", "medium", "extreme"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 rounded-lg py-2.5 text-xs font-bold uppercase transition-colors ${
                    difficulty === d
                      ? d === "easy" ? "bg-green-600 text-white"
                      : d === "medium" ? "bg-yellow-600 text-white"
                      : "bg-red-600 text-white"
                      : "border border-gray-700 bg-gray-900 text-white hover:border-gray-600"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TTT Bonus */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-white mb-1">
            Three-in-a-row bonus points
          </label>
          <input
            type="number"
            value={bonus}
            onChange={(e) => setBonus(Number(e.target.value))}
            min={0}
            max={100}
            className="w-24 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Labels */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white mb-2">
              Row Labels (left side)
            </label>
            <div className="flex gap-2">
              {rowLabels.map((l, i) => (
                <input
                  key={i}
                  type="text"
                  value={l}
                  onChange={(e) => setLabel("row", i, e.target.value)}
                  placeholder={`Row ${i + 1}`}
                  maxLength={60}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white mb-2">
              Column Labels (top)
            </label>
            <div className="flex gap-2">
              {colLabels.map((l, i) => (
                <input
                  key={i}
                  type="text"
                  value={l}
                  onChange={(e) => setLabel("col", i, e.target.value)}
                  placeholder={`Col ${i + 1}`}
                  maxLength={60}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Grid preview */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-white mb-3">
            Grid — click each square to add player answers
          </label>
          <div className="grid grid-cols-4 gap-1.5 md:gap-2">
            <div />
            {colLabels.map((l, c) => (
              <div key={c} className="flex items-center justify-center rounded-md bg-gray-800 p-2 text-center text-[10px] font-bold uppercase text-white aspect-square md:text-xs">
                {l || `Col ${c + 1}`}
              </div>
            ))}
            {grid.map((row, r) => (
              <>
                <div key={`rl-${r}`} className="flex items-center justify-center rounded-md bg-gray-800 p-2 text-center text-[10px] font-bold uppercase text-white aspect-square md:text-xs">
                  {rowLabels[r] || `Row ${r + 1}`}
                </div>
                {row.map((sq, c) => {
                  const isActive = ec?.r === r && ec?.c === c;
                  return (
                    <button
                      key={`${r}-${c}`}
                      onClick={() => {
                        setEditingCell({ r, c });
                        setNewName("");
                        setNewPoints(3);
                      }}
                      className={`aspect-square rounded-md p-2 text-left transition-all overflow-hidden ${
                        sq.answers.length > 0
                          ? "bg-green-600 hover:bg-green-500"
                          : "bg-gray-800 hover:bg-gray-700"
                      } ${isActive ? "ring-2 ring-indigo-500" : ""}`}
                    >
                      <p className="text-[9px] font-bold text-white md:text-xs">
                        {sq.answers.length} answer{sq.answers.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-[8px] text-white md:text-[10px]">
                        {sq.answers.reduce((s, a) => s + a.points, 0)} pts
                      </p>
                    </button>
                  );
                })}
              </>
            ))}
          </div>
        </div>

        {/* Cell editor */}
        {ec && (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">
                {rowLabels[ec.r] || `Row ${ec.r + 1}`} + {colLabels[ec.c] || `Col ${ec.c + 1}`}
              </h3>
              <button
                onClick={() => setEditingCell(null)}
                className="text-white hover:text-white text-lg"
              >
                &times;
              </button>
            </div>

            {/* Add answer form */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addAnswer(); }}
                placeholder="Player name"
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="number"
                value={newPoints}
                onChange={(e) => setNewPoints(Number(e.target.value))}
                min={1}
                max={10}
                placeholder="Pts"
                className="w-[70px] rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-white text-center focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              onClick={addAnswer}
              disabled={!newName.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Add Answer
            </button>

            {/* Answer list */}
            {grid[ec.r][ec.c].answers.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white">
                  Answers ({grid[ec.r][ec.c].answers.length})
                </p>
                {grid[ec.r][ec.c].answers.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{a.name}</span>
                      <span className="font-display font-black text-indigo-400">{a.points} pts</span>
                    </div>
                    <button
                      onClick={() => removeAnswer(ec.r, ec.c, i)}
                      className="text-red-500 hover:text-red-400 text-xs font-bold"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-3 text-sm font-bold text-red-400">
            {error}
          </p>
        )}

        {/* Save button */}
        <div className="flex justify-center pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-10 py-3.5 text-base font-bold uppercase tracking-wider text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Publish Puzzle"}
          </button>
        </div>
      </main>
    </div>
  );
}
