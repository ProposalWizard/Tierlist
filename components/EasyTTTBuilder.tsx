"use client";

import { useState } from "react";
import Image from "next/image";

/* ── Types ── */

interface Club {
  id: string;
  name: string;
  country: string;
  league: string | null;
  image: string | null;
}

interface Player {
  id: string;
  name: string;
  nationality: string;
  position: string;
  dob: string;
  image: string | null;
}

interface GridResult {
  rowClubs: string[];
  colClubs: string[];
  cells: Player[][];
}

interface EasyTTTBuilderProps {
  onBack?: () => void;
}

/* ── Helpers ── */

function Img({ src, alt, size = 40 }: { src?: string | null; alt: string; size?: number }) {
  if (!src)
    return (
      <div
        className="rounded-full bg-gray-800 shrink-0"
        style={{ width: size, height: size }}
      />
    );
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
      unoptimized
    />
  );
}

/* ── Component ── */

export default function EasyTTTBuilder({ onBack }: EasyTTTBuilderProps) {
  /* ── Club selector state ── */
  const emptySlots = (): (Club | null)[] => [null, null, null];
  const emptyQueries = (): string[] => ["", "", ""];
  const emptyResults = (): Club[][] => [[], [], []];

  const [gridRows, setGridRows] = useState<(Club | null)[]>(emptySlots);
  const [gridCols, setGridCols] = useState<(Club | null)[]>(emptySlots);
  const [gridRowQueries, setGridRowQueries] = useState<string[]>(emptyQueries);
  const [gridColQueries, setGridColQueries] = useState<string[]>(emptyQueries);
  const [gridRowResults, setGridRowResults] = useState<Club[][]>(emptyResults);
  const [gridColResults, setGridColResults] = useState<Club[][]>(emptyResults);
  const [gridSearching, setGridSearching] = useState<Record<string, boolean>>({});

  /* ── Grid generation state ── */
  const [gridResult, setGridResult] = useState<GridResult | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Submission state ── */
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  /* ── Club search ── */
  const searchGridClub = async (type: "row" | "col", idx: number) => {
    const queries = type === "row" ? gridRowQueries : gridColQueries;
    const q = queries[idx]?.trim();
    if (!q) return;
    const key = `${type}-${idx}`;
    setGridSearching((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(
        `/api/admin/football/leagues?q=${encodeURIComponent(q)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const setter = type === "row" ? setGridRowResults : setGridColResults;
      setter((prev) => {
        const next = [...prev];
        next[idx] = json.clubs ?? [];
        return next;
      });
    } catch {
      // silently fail search
    }
    setGridSearching((prev) => ({ ...prev, [key]: false }));
  };

  const selectGridClub = (type: "row" | "col", idx: number, club: Club) => {
    setGridResult(null);
    setSuccess(null);
    if (type === "row") {
      setGridRows((prev) => {
        const next = [...prev];
        next[idx] = club;
        return next;
      });
      setGridRowQueries((prev) => {
        const next = [...prev];
        next[idx] = club.name;
        return next;
      });
      setGridRowResults((prev) => {
        const next = [...prev];
        next[idx] = [];
        return next;
      });
    } else {
      setGridCols((prev) => {
        const next = [...prev];
        next[idx] = club;
        return next;
      });
      setGridColQueries((prev) => {
        const next = [...prev];
        next[idx] = club.name;
        return next;
      });
      setGridColResults((prev) => {
        const next = [...prev];
        next[idx] = [];
        return next;
      });
    }
  };

  const clearGridClub = (type: "row" | "col", idx: number) => {
    setGridResult(null);
    setSuccess(null);
    if (type === "row") {
      setGridRows((prev) => {
        const next = [...prev];
        next[idx] = null;
        return next;
      });
      setGridRowQueries((prev) => {
        const next = [...prev];
        next[idx] = "";
        return next;
      });
    } else {
      setGridCols((prev) => {
        const next = [...prev];
        next[idx] = null;
        return next;
      });
      setGridColQueries((prev) => {
        const next = [...prev];
        next[idx] = "";
        return next;
      });
    }
  };

  const allGridClubsSelected = gridRows.every(Boolean) && gridCols.every(Boolean);

  /* ── Generate grid ── */
  const generateGrid = async () => {
    if (!allGridClubsSelected) return;
    setGridLoading(true);
    setGridResult(null);
    setError(null);
    setSuccess(null);
    try {
      const rowParams = gridRows.map((c) => `row=${c!.id}`).join("&");
      const colParams = gridCols.map((c) => `col=${c!.id}`).join("&");
      const res = await fetch(
        `/api/admin/football/ttt-grid?${rowParams}&${colParams}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setGridResult({
        rowClubs: json.rowClubs,
        colClubs: json.colClubs,
        cells: json.cells ?? [],
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Grid generation failed");
    }
    setGridLoading(false);
  };

  /* ── Check for empty cells ── */
  const emptyCells =
    gridResult?.cells.filter((cell) => cell.length === 0).length ?? 0;

  /* ── Submit as Easy TTT ── */
  const handleSubmit = async () => {
    if (!gridResult) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Fetch existing puzzles to count easy ones
      const listRes = await fetch("/api/admin/tictactoe");
      if (!listRes.ok) {
        const listJson = await listRes.json();
        throw new Error(listJson.error || "Failed to fetch puzzles");
      }
      const puzzles: { difficulty: string }[] = await listRes.json();
      const easyCount = puzzles.filter((p) => p.difficulty === "easy").length;
      const nextNumber = easyCount + 1;

      // Build the grid payload
      const grid = [0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => {
          const players = gridResult.cells[r * 3 + c] ?? [];
          return {
            type: "normal" as const,
            conditions: [
              gridResult.rowClubs[r],
              gridResult.colClubs[c],
            ] as [string, string],
            answers: players.map((p) => ({
              name: p.name,
              points: 1,
              aliases: [] as string[],
            })),
            maxScore: players.length,
          };
        })
      );

      const body = {
        title: `Easy #${nextNumber}`,
        difficulty: "easy",
        row_labels: [
          gridResult.rowClubs[0],
          gridResult.rowClubs[1],
          gridResult.rowClubs[2],
        ],
        col_labels: [
          gridResult.colClubs[0],
          gridResult.colClubs[1],
          gridResult.colClubs[2],
        ],
        grid,
        three_in_a_row_bonus: 5,
        is_daily: false,
        daily_date: null,
        is_active: true,
        info: null,
        display_order: 0,
        label_extras: null,
        category: "Easy",
      };

      const createRes = await fetch("/api/admin/tictactoe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) throw new Error(createJson.error || "Failed to create puzzle");

      setSuccess(`Easy TTT #${nextNumber} created!`);

      // Reset form
      setGridRows(emptySlots());
      setGridCols(emptySlots());
      setGridRowQueries(emptyQueries());
      setGridColQueries(emptyQueries());
      setGridRowResults(emptyResults());
      setGridColResults(emptyResults());
      setGridResult(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submission failed");
    }
    setSubmitting(false);
  };

  /* ── Club selector row ── */
  const renderClubSelector = (
    type: "row" | "col",
    idx: number,
    label: string
  ) => {
    const clubs = type === "row" ? gridRows : gridCols;
    const queries = type === "row" ? gridRowQueries : gridColQueries;
    const results = type === "row" ? gridRowResults : gridColResults;
    const setQueries = type === "row" ? setGridRowQueries : setGridColQueries;
    const key = `${type}-${idx}`;

    if (clubs[idx]) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-600 bg-indigo-900/20 px-3 py-2">
          <Img src={clubs[idx]!.image} alt={clubs[idx]!.name} size={24} />
          <span className="font-bold text-white flex-1 truncate text-sm">
            {clubs[idx]!.name}
          </span>
          <button
            onClick={() => clearGridClub(type, idx)}
            className="text-white hover:text-white text-lg leading-none"
          >
            &times;
          </button>
        </div>
      );
    }

    return (
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={`${label}...`}
            value={queries[idx]}
            onChange={(e) =>
              setQueries((prev) => {
                const n = [...prev];
                n[idx] = e.target.value;
                return n;
              })
            }
            onKeyDown={(e) => e.key === "Enter" && searchGridClub(type, idx)}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
          />
          <button
            onClick={() => searchGridClub(type, idx)}
            disabled={!!gridSearching[key]}
            className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            {gridSearching[key] ? "..." : "Search"}
          </button>
        </div>
        {results[idx]?.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
            {results[idx].map((c) => (
              <button
                key={c.id}
                onClick={() => selectGridClub(type, idx, c)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-800"
              >
                <Img src={c.image} alt={c.name} size={20} />
                <span className="text-white truncate">{c.name}</span>
                <span className="text-xs text-gray-200 ml-auto shrink-0">
                  {c.country}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ── Render ── */
  return (
    <div>
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1 text-sm text-white hover:text-white transition-colors"
        >
          <span>&larr;</span> Back
        </button>
      )}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-black text-white">Easy TTT Builder</h2>
        <p className="mt-1 text-sm text-gray-200">
          Pick 3 row clubs and 3 column clubs, generate the grid, then submit as
          an Easy TTT puzzle.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-700 bg-green-900/30 px-4 py-2 text-sm text-green-300">
          {success}
        </div>
      )}

      {/* Club selectors */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Row clubs */}
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase text-gray-200">
            Row Clubs
          </h3>
          <div className="space-y-2">
            {[0, 1, 2].map((idx) => (
              <div key={`row-${idx}`}>
                {renderClubSelector("row", idx, `Row ${idx + 1} club`)}
              </div>
            ))}
          </div>
        </div>

        {/* Column clubs */}
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase text-gray-200">
            Column Clubs
          </h3>
          <div className="space-y-2">
            {[0, 1, 2].map((idx) => (
              <div key={`col-${idx}`}>
                {renderClubSelector("col", idx, `Column ${idx + 1} club`)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={generateGrid}
        disabled={!allGridClubsSelected || gridLoading}
        className="mb-8 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors md:w-auto md:px-8"
      >
        {gridLoading ? "Generating grid..." : "Generate Grid"}
      </button>

      {/* Loading indicator */}
      {gridLoading && (
        <div className="py-12 text-center text-gray-200">
          Querying Wikidata... ~15-30 seconds
        </div>
      )}

      {/* Results grid */}
      {!gridLoading && gridResult && (
        <>
          {/* Empty cell warning */}
          {emptyCells > 0 && (
            <div className="mb-4 rounded-lg border border-yellow-700 bg-yellow-900/30 px-4 py-2 text-sm text-yellow-300">
              Warning: {emptyCells} cell{emptyCells !== 1 ? "s have" : " has"} 0
              players. You can still submit, but the puzzle will have empty
              squares.
            </div>
          )}

          <div className="overflow-x-auto mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2" />
                  {gridResult.colClubs.map((name, ci) => (
                    <th
                      key={ci}
                      className="p-2 text-center text-xs font-bold uppercase text-indigo-400 min-w-[180px]"
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridResult.rowClubs.map((rowName, ri) => (
                  <tr key={ri}>
                    <td className="p-2 text-right text-xs font-bold uppercase text-indigo-400 whitespace-nowrap align-top pt-4">
                      {rowName}
                    </td>
                    {[0, 1, 2].map((ci) => {
                      const cellPlayers = gridResult.cells[ri * 3 + ci] ?? [];
                      return (
                        <td key={ci} className="p-1 align-top">
                          <div className="rounded-lg border border-gray-800 bg-gray-900 p-2 min-h-[80px]">
                            {cellPlayers.length === 0 ? (
                              <div className="flex items-center justify-center h-[80px] text-xs text-red-400">
                                No players
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="text-[10px] font-bold text-gray-200 mb-1">
                                  {cellPlayers.length} player
                                  {cellPlayers.length !== 1 ? "s" : ""}
                                </div>
                                {cellPlayers.map((p) => (
                                  <div
                                    key={p.id}
                                    className="flex items-center gap-1.5 rounded px-1 py-0.5 text-left"
                                  >
                                    <Img src={p.image} alt={p.name} size={20} />
                                    <span className="text-xs text-white truncate">
                                      {p.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors md:w-auto md:px-8"
          >
            {submitting ? "Creating puzzle..." : "Submit as Easy TTT"}
          </button>
        </>
      )}
    </div>
  );
}
