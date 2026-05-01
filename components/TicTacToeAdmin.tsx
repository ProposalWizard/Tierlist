"use client";

import { useState, useEffect, useCallback } from "react";
import type { TicTacToePuzzle, TicTacToeSquareData, TicTacToeAnswer } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { ACCEPT_IMAGE_TYPES } from "@/lib/imageUtils";
import CropOverlay from "./CropOverlay";

async function uploadImage(file: File): Promise<string> {
  const { compressImage } = await import("@/lib/imageUtils");
  const compressed = await compressImage(file);
  const supabase = createClient();
  const path = `ttt-extras/${crypto.randomUUID()}.webp`;
  const { data, error } = await supabase.storage
    .from("tierlist-images")
    .upload(path, compressed, { upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage
    .from("tierlist-images")
    .getPublicUrl(data.path);
  return urlData.publicUrl;
}

function isImageUrl(s: string): boolean {
  return /^https?:\/\/.+/i.test(s) && /\.(jpg|jpeg|png|gif|webp|svg|avif)/i.test(s);
}

function ImageField({
  label,
  value,
  onChange,
  onCropRequest,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCropRequest: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch { /* ignore */ }
    setUploading(false);
    e.target.value = "";
  };

  return (
    <div>
      <label className="text-xs font-bold text-gray-400">{label}</label>
      <div className="mt-1 flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Text or image URL"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
        />
        <label className={`cursor-pointer rounded-lg bg-gray-700 px-2.5 py-2 text-xs font-bold text-gray-300 hover:bg-gray-600 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? "..." : "Upload"}
          <input type="file" accept={ACCEPT_IMAGE_TYPES} onChange={handleFile} className="hidden" />
        </label>
        {isImageUrl(value) && (
          <button
            type="button"
            onClick={() => onCropRequest(value)}
            className="rounded-lg bg-gray-700 px-2.5 py-2 text-xs font-bold text-gray-300 hover:bg-gray-600"
          >
            Crop
          </button>
        )}
      </div>
      {isImageUrl(value) && (
        <img src={value} alt="" className="mt-2 max-h-24 rounded-lg border border-gray-700" />
      )}
    </div>
  );
}

interface PuzzleListItem {
  id: string;
  title: string;
  difficulty: string;
  is_daily: boolean;
  daily_date: string | null;
  is_active: boolean;
  created_at: string;
}

function emptySquare(): TicTacToeSquareData {
  return { type: "normal", conditions: ["", ""], answers: [], maxScore: 0 };
}

function emptyGrid(): TicTacToeSquareData[][] {
  return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => emptySquare()));
}

function calcMaxScore(answers: TicTacToeAnswer[]): number {
  return answers.reduce((s, a) => s + a.points, 0);
}

export default function TicTacToeAdmin() {
  const [puzzles, setPuzzles] = useState<PuzzleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // puzzle id or "new"
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  // Edit form state
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "extreme">("medium");
  const [rowLabels, setRowLabels] = useState<[string, string, string]>(["", "", ""]);
  const [colLabels, setColLabels] = useState<[string, string, string]>(["", "", ""]);
  const [grid, setGrid] = useState<TicTacToeSquareData[][]>(emptyGrid());
  const [bonus, setBonus] = useState(10);
  const [isDaily, setIsDaily] = useState(false);
  const [dailyDate, setDailyDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [info, setInfo] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [labelExtras, setLabelExtras] = useState<{
    rows: Array<{ info: string; hint: string }>;
    cols: Array<{ info: string; hint: string }>;
  }>({
    rows: [{ info: "", hint: "" }, { info: "", hint: "" }, { info: "", hint: "" }],
    cols: [{ info: "", hint: "" }, { info: "", hint: "" }, { info: "", hint: "" }],
  });
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [cropTarget, setCropTarget] = useState<{ imageUrl: string; onComplete: (url: string) => void } | null>(null);

  const loadPuzzles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tictactoe");
      if (res.ok) setPuzzles(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadPuzzles(); }, [loadPuzzles]);

  const resetForm = () => {
    setTitle("");
    setDifficulty("medium");
    setRowLabels(["", "", ""]);
    setColLabels(["", "", ""]);
    setGrid(emptyGrid());
    setBonus(10);
    setIsDaily(false);
    setDailyDate("");
    setIsActive(true);
    setInfo("");
    setDisplayOrder(0);
    setLabelExtras({
      rows: [{ info: "", hint: "" }, { info: "", hint: "" }, { info: "", hint: "" }],
      cols: [{ info: "", hint: "" }, { info: "", hint: "" }, { info: "", hint: "" }],
    });
    setEditingCell(null);
    setCropTarget(null);
  };

  const openNew = () => {
    resetForm();
    setEditing("new");
  };

  const openEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/tictactoe/${id}`);
      if (!res.ok) throw new Error("Failed to load puzzle");
      const p: TicTacToePuzzle = await res.json();
      setTitle(p.title);
      setDifficulty(p.difficulty);
      setRowLabels(p.row_labels);
      setColLabels(p.col_labels);
      setGrid(p.grid);
      setBonus(p.three_in_a_row_bonus);
      setIsDaily(p.is_daily);
      setDailyDate(p.daily_date ?? "");
      setIsActive(p.is_active);
      setInfo(p.info ?? "");
      setDisplayOrder(p.display_order ?? 0);
      const le = p.label_extras as { rows?: Array<{ info?: string; hint?: string } | null>; cols?: Array<{ info?: string; hint?: string } | null> } | null;
      setLabelExtras({
        rows: Array.from({ length: 3 }, (_, i) => ({
          info: le?.rows?.[i]?.info ?? "",
          hint: le?.rows?.[i]?.hint ?? "",
        })),
        cols: Array.from({ length: 3 }, (_, i) => ({
          info: le?.cols?.[i]?.info ?? "",
          hint: le?.cols?.[i]?.hint ?? "",
        })),
      });
      setEditing(id);
      setEditingCell(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { setError("Title is required"); return; }

    // Validate grid: every square needs conditions and at least one answer
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const sq = grid[r][c];
        if (!sq.conditions[0] && !sq.conditions[1] && sq.type === "normal") {
          // Auto-fill from row/col labels
          sq.conditions = [rowLabels[r], colLabels[c]];
        }
        if (!sq.conditions[0] || !sq.conditions[1]) {
          setError(`Square (${r + 1},${c + 1}) needs two conditions`);
          return;
        }
        if (sq.answers.length === 0) {
          setError(`Square (${r + 1},${c + 1}) needs at least one answer`);
          return;
        }
        sq.maxScore = calcMaxScore(sq.answers);
      }
    }

    setSaving(true);
    setError("");

    const body = {
      title: title.trim(),
      difficulty,
      row_labels: rowLabels,
      col_labels: colLabels,
      grid,
      three_in_a_row_bonus: bonus,
      is_daily: isDaily,
      daily_date: isDaily && dailyDate ? dailyDate : null,
      is_active: isActive,
      info: info.trim() || null,
      display_order: displayOrder,
      label_extras: {
        rows: labelExtras.rows.map((r) =>
          r.info || r.hint ? { info: r.info || undefined, hint: r.hint || undefined } : null
        ),
        cols: labelExtras.cols.map((c) =>
          c.info || c.hint ? { info: c.info || undefined, hint: c.hint || undefined } : null
        ),
      },
    };

    try {
      const url = editing === "new" ? "/api/admin/tictactoe" : `/api/admin/tictactoe/${editing}`;
      const method = editing === "new" ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      setConfirmation("Puzzle saved!");
      setTimeout(() => setConfirmation(""), 3000);
      setEditing(null);
      loadPuzzles();
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this puzzle?")) return;
    try {
      const res = await fetch(`/api/admin/tictactoe/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPuzzles((p) => p.filter((x) => x.id !== id));
        if (editing === id) setEditing(null);
      }
    } catch { /* ignore */ }
  };

  const updateSquare = (r: number, c: number, update: Partial<TicTacToeSquareData>) => {
    setGrid((g) => {
      const newGrid = g.map((row) => row.map((sq) => ({ ...sq })));
      newGrid[r][c] = { ...newGrid[r][c], ...update };
      return newGrid;
    });
  };

  // Total possible score for the current grid
  const totalPossibleScore = (() => {
    let total = 0;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        total += calcMaxScore(grid[r][c].answers);
    total += bonus;
    return total;
  })();

  if (loading) return <p className="text-gray-500 py-8 text-center">Loading puzzles...</p>;

  // Cell editor modal
  if (editingCell && editing) {
    const { r, c } = editingCell;
    const sq = grid[r][c];
    return (
      <>
        <CellEditor
          square={sq}
          rowLabel={rowLabels[r]}
          colLabel={colLabels[c]}
          onSave={(updated) => {
            updateSquare(r, c, updated);
            setEditingCell(null);
          }}
          onCancel={() => setEditingCell(null)}
          onCropRequest={(url, onComplete) => setCropTarget({ imageUrl: url, onComplete })}
        />
        {cropTarget && (
          <CropOverlay
            imageUrl={cropTarget.imageUrl}
            imageName="Image"
            aspectRatio={16 / 9}
            onCancel={() => setCropTarget(null)}
            onCrop={async (blob) => {
              try {
                const file = new File([blob], "cropped.webp", { type: "image/webp" });
                const url = await uploadImage(file);
                cropTarget.onComplete(url);
              } catch { /* ignore */ }
              setCropTarget(null);
            }}
          />
        )}
      </>
    );
  }

  // Puzzle editor form
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{editing === "new" ? "New Puzzle" : "Edit Puzzle"}</h3>
          <button onClick={() => setEditing(null)} className="text-sm text-gray-400 hover:text-white">Cancel</button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-400">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="extreme">Extreme</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-400">3-in-a-row Bonus</label>
            <input type="number" value={bonus} onChange={(e) => setBonus(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={isDaily} onChange={(e) => setIsDaily(e.target.checked)} />
              Daily puzzle
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
          </div>
        </div>

        {isDaily && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400">Daily Date</label>
              <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400">Display Order</label>
              <input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" />
            </div>
          </div>
        )}

        {/* Row Labels + Extras */}
        <div>
          <label className="text-xs font-bold text-gray-400">Row Labels (left side)</label>
          {rowLabels.map((l, i) => (
            <div key={i} className="mt-2 rounded-lg border border-gray-800 bg-gray-900/50 p-3 space-y-2">
              <input value={l} onChange={(e) => {
                const n = [...rowLabels] as [string, string, string];
                n[i] = e.target.value;
                setRowLabels(n);
              }}
              placeholder={`Row ${i + 1}`}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" />
              <div className="grid grid-cols-2 gap-2">
                <ImageField label="Info" value={labelExtras.rows[i].info} onCropRequest={(url) => setCropTarget({ imageUrl: url, onComplete: (cropped) => {
                  setLabelExtras((prev) => { const next = { ...prev, rows: [...prev.rows] }; next.rows[i] = { ...next.rows[i], info: cropped }; return next; });
                } })} onChange={(v) => setLabelExtras((prev) => { const next = { ...prev, rows: [...prev.rows] }; next.rows[i] = { ...next.rows[i], info: v }; return next; })} />
                <ImageField label="Hint" value={labelExtras.rows[i].hint} onCropRequest={(url) => setCropTarget({ imageUrl: url, onComplete: (cropped) => {
                  setLabelExtras((prev) => { const next = { ...prev, rows: [...prev.rows] }; next.rows[i] = { ...next.rows[i], hint: cropped }; return next; });
                } })} onChange={(v) => setLabelExtras((prev) => { const next = { ...prev, rows: [...prev.rows] }; next.rows[i] = { ...next.rows[i], hint: v }; return next; })} />
              </div>
            </div>
          ))}
        </div>

        {/* Column Labels + Extras */}
        <div>
          <label className="text-xs font-bold text-gray-400">Column Labels (top)</label>
          {colLabels.map((l, i) => (
            <div key={i} className="mt-2 rounded-lg border border-gray-800 bg-gray-900/50 p-3 space-y-2">
              <input value={l} onChange={(e) => {
                const n = [...colLabels] as [string, string, string];
                n[i] = e.target.value;
                setColLabels(n);
              }}
              placeholder={`Col ${i + 1}`}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" />
              <div className="grid grid-cols-2 gap-2">
                <ImageField label="Info" value={labelExtras.cols[i].info} onCropRequest={(url) => setCropTarget({ imageUrl: url, onComplete: (cropped) => {
                  setLabelExtras((prev) => { const next = { ...prev, cols: [...prev.cols] }; next.cols[i] = { ...next.cols[i], info: cropped }; return next; });
                } })} onChange={(v) => setLabelExtras((prev) => { const next = { ...prev, cols: [...prev.cols] }; next.cols[i] = { ...next.cols[i], info: v }; return next; })} />
                <ImageField label="Hint" value={labelExtras.cols[i].hint} onCropRequest={(url) => setCropTarget({ imageUrl: url, onComplete: (cropped) => {
                  setLabelExtras((prev) => { const next = { ...prev, cols: [...prev.cols] }; next.cols[i] = { ...next.cols[i], hint: cropped }; return next; });
                } })} onChange={(v) => setLabelExtras((prev) => { const next = { ...prev, cols: [...prev.cols] }; next.cols[i] = { ...next.cols[i], hint: v }; return next; })} />
              </div>
            </div>
          ))}
        </div>

        {/* Grid editor */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-400">Grid (click to edit each square)</label>
            <span className="text-xs text-gray-500">Total possible: {totalPossibleScore} pts</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {grid.map((row, r) =>
              row.map((sq, c) => {
                const conds = sq.type === "custom"
                  ? sq.conditions
                  : [rowLabels[r] || `Row ${r + 1}`, colLabels[c] || `Col ${c + 1}`];
                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => {
                      if (sq.type === "normal") {
                        updateSquare(r, c, { conditions: [rowLabels[r], colLabels[c]] });
                      }
                      setEditingCell({ r, c });
                    }}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      sq.answers.length > 0
                        ? "border-green-700/50 bg-green-900/20"
                        : "border-gray-700 bg-gray-800"
                    } hover:border-indigo-500`}
                  >
                    <p className="text-[10px] text-gray-400 truncate">{conds[0]}</p>
                    <p className="text-[10px] text-indigo-400 truncate">+ {conds[1]}</p>
                    <p className="mt-1 text-xs font-bold text-white">
                      {sq.answers.length} answer{sq.answers.length !== 1 ? "s" : ""}
                    </p>
                    {sq.type === "custom" && (
                      <span className="text-[8px] font-bold text-amber-500">★ Custom</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
            {saving ? "Saving..." : "Save Puzzle"}
          </button>
          <button onClick={() => setEditing(null)}
            className="rounded-lg border border-gray-600 px-5 py-2 text-sm text-gray-300 hover:text-white">
            Cancel
          </button>
        </div>

        {cropTarget && (
          <CropOverlay
            imageUrl={cropTarget.imageUrl}
            imageName="Image"
            aspectRatio={16 / 9}
            onCancel={() => setCropTarget(null)}
            onCrop={async (blob) => {
              try {
                const file = new File([blob], "cropped.webp", { type: "image/webp" });
                const url = await uploadImage(file);
                cropTarget.onComplete(url);
              } catch { /* ignore */ }
              setCropTarget(null);
            }}
          />
        )}
      </div>
    );
  }

  // Puzzle list
  return (
    <div className="space-y-4">
      {confirmation && (
        <div className="rounded-lg border border-green-700 bg-green-900/50 px-4 py-2 text-sm text-green-300">
          {confirmation}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Tic Tac Toe Puzzles ({puzzles.length})</h3>
        <button onClick={openNew}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500">
          + New Puzzle
        </button>
      </div>

      {puzzles.length === 0 ? (
        <p className="py-8 text-center text-gray-500">No puzzles yet.</p>
      ) : (
        <div className="space-y-2">
          {puzzles.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900 px-4 py-3">
              <div>
                <p className="font-bold text-white">{p.title}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${
                    p.difficulty === "easy" ? "bg-green-900/50 text-green-400" :
                    p.difficulty === "medium" ? "bg-yellow-900/50 text-yellow-400" :
                    "bg-red-900/50 text-red-400"
                  }`}>{p.difficulty}</span>
                  {p.is_daily && <span className="text-amber-400">Daily{p.daily_date ? ` (${p.daily_date})` : ""}</span>}
                  {!p.is_active && <span className="text-red-400">Inactive</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(p.id)}
                  className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-700">
                  Edit
                </button>
                <button onClick={() => handleDelete(p.id)}
                  className="rounded-lg bg-red-900/50 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-900">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Cell editor ── */
function CellEditor({
  square,
  rowLabel,
  colLabel,
  onSave,
  onCancel,
  onCropRequest,
}: {
  square: TicTacToeSquareData;
  rowLabel: string;
  colLabel: string;
  onSave: (sq: Partial<TicTacToeSquareData>) => void;
  onCancel: () => void;
  onCropRequest: (url: string, onComplete: (url: string) => void) => void;
}) {
  const [isCustom, setIsCustom] = useState(square.type === "custom");
  const [cond1, setCond1] = useState(square.conditions[0] || rowLabel);
  const [cond2, setCond2] = useState(square.conditions[1] || colLabel);
  const [answers, setAnswers] = useState<TicTacToeAnswer[]>([...square.answers]);
  const [hint, setHint] = useState(square.hint ?? "");
  const [sqInfo, setSqInfo] = useState(square.info ?? "");
  const [newName, setNewName] = useState("");
  const [newPoints, setNewPoints] = useState(3);
  const [newAliases, setNewAliases] = useState("");

  const addAnswer = () => {
    if (!newName.trim()) return;
    if (answers.some((a) => a.name.toLowerCase() === newName.trim().toLowerCase())) return;
    const aliases = newAliases.split(",").map((a) => a.trim()).filter(Boolean);
    setAnswers([...answers, { name: newName.trim(), points: newPoints, aliases: aliases.length > 0 ? aliases : undefined }]);
    setNewName("");
    setNewPoints(3);
    setNewAliases("");
  };

  const removeAnswer = (name: string) => {
    setAnswers(answers.filter((a) => a.name !== name));
  };

  const save = () => {
    onSave({
      type: isCustom ? "custom" : "normal",
      conditions: [isCustom ? cond1 : rowLabel, isCustom ? cond2 : colLabel] as [string, string],
      answers,
      maxScore: calcMaxScore(answers),
      hint: hint.trim() || undefined,
      info: sqInfo.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Edit Square</h3>
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-white">Back</button>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" checked={isCustom} onChange={(e) => {
          setIsCustom(e.target.checked);
          if (!e.target.checked) { setCond1(rowLabel); setCond2(colLabel); }
        }} />
        Custom conditions (override row/col)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-400">Condition 1</label>
          <input value={isCustom ? cond1 : rowLabel} readOnly={!isCustom}
            onChange={(e) => setCond1(e.target.value)}
            className={`mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white ${!isCustom ? "opacity-50" : ""}`} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400">Condition 2</label>
          <input value={isCustom ? cond2 : colLabel} readOnly={!isCustom}
            onChange={(e) => setCond2(e.target.value)}
            className={`mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white ${!isCustom ? "opacity-50" : ""}`} />
        </div>
      </div>

      {/* Info & Hint */}
      <div className="grid grid-cols-2 gap-3">
        <ImageField label="Info (context, no penalty)" value={sqInfo} onChange={setSqInfo}
          onCropRequest={(url) => onCropRequest(url, (cropped) => setSqInfo(cropped))} />
        <ImageField label="Hint (guided help, tracked)" value={hint} onChange={setHint}
          onCropRequest={(url) => onCropRequest(url, (cropped) => setHint(cropped))} />
      </div>

      {/* Answers */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-400">Answers ({answers.length})</label>
          <span className="text-xs text-gray-500">Max score: {calcMaxScore(answers)}</span>
        </div>

        {answers.length > 0 && (
          <div className="mt-2 space-y-1">
            {answers.sort((a, b) => b.points - a.points).map((a) => (
              <div key={a.name} className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2 text-sm">
                <div>
                  <span className="text-white">{a.name}</span>
                  {a.aliases && a.aliases.length > 0 && (
                    <span className="ml-2 text-[10px] text-gray-500">({a.aliases.join(", ")})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-indigo-400">{a.points} pts</span>
                  <button onClick={() => removeAnswer(a.name)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add answer form */}
        <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addAnswer(); }}
              placeholder="Player name" className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" />
            <select value={newPoints} onChange={(e) => setNewPoints(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-white">
              {[1, 2, 3, 4, 5, 6, 7].map((p) => <option key={p} value={p}>{p} pts</option>)}
            </select>
            <button onClick={addAnswer}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-500">
              Add
            </button>
          </div>
          <input value={newAliases} onChange={(e) => setNewAliases(e.target.value)}
            placeholder="Aliases (comma separated, optional)"
            className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white" />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={save}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500">
          Save Square
        </button>
        <button onClick={onCancel}
          className="rounded-lg border border-gray-600 px-5 py-2 text-sm text-gray-300 hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  );
}
