"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { TicTacToePuzzle, TicTacToeSquareData, TicTacToeAnswer, CustomSquareType } from "@/lib/types";
import { computeCustomConditions, CUSTOM_SQUARE_LABELS } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { ACCEPT_IMAGE_TYPES } from "@/lib/imageUtils";
import CropOverlay from "./CropOverlay";
import EasyTTTBuilder from "./EasyTTTBuilder";

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

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
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
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImage(f);
      onChange(url);
    } catch { /* ignore */ }
    setUploading(false);
    e.target.value = "";
  };
  return (
    <div>
      <label className="text-xs font-bold text-white">{label}</label>
      <div className="mt-1 flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Text or image URL"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
        />
        <label className={`cursor-pointer rounded-lg bg-gray-700 px-2.5 py-2 text-xs font-bold text-white hover:bg-gray-600 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? "..." : "Upload"}
          <input type="file" accept={ACCEPT_IMAGE_TYPES} onChange={handleFile} className="hidden" />
        </label>
        {isImageUrl(value) && (
          <button
            type="button"
            onClick={() => onCropRequest(value)}
            className="rounded-lg bg-gray-700 px-2.5 py-2 text-xs font-bold text-white hover:bg-gray-600"
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
  display_order: number;
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

/* ── Inline Square Editor (modal overlay) ── */
function SquareEditor({
  square,
  rowLabel,
  colLabel,
  onSave,
  onClose,
  onCropRequest,
}: {
  square: TicTacToeSquareData;
  rowLabel: string;
  colLabel: string;
  onSave: (sq: Partial<TicTacToeSquareData>) => void;
  onClose: () => void;
  onCropRequest: (url: string, onComplete: (url: string) => void) => void;
}) {
  const [isCustom, setIsCustom] = useState(square.type === "custom");
  const [customType, setCustomType] = useState<CustomSquareType>(square.customType ?? "and");
  const [customText, setCustomText] = useState(square.customText ?? "");
  const [answers, setAnswers] = useState<TicTacToeAnswer[]>(square.answers.map((a) => ({ ...a, aliases: a.aliases ? [...a.aliases] : undefined })));
  const [hint, setHint] = useState(square.hint ?? "");
  const [sqInfo, setSqInfo] = useState(square.info ?? "");
  const [newName, setNewName] = useState("");
  const [newPoints, setNewPoints] = useState(3);
  const [expandedAlias, setExpandedAlias] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const addAnswer = () => {
    const name = newName.trim();
    if (!name) return;
    if (answers.some((a) => a.name.toLowerCase() === name.toLowerCase())) return;
    setAnswers([...answers, { name, points: newPoints }]);
    setNewName("");
  };

  const save = () => {
    const conditions: [string, string] = isCustom
      ? computeCustomConditions(customType, customText, rowLabel, colLabel)
      : [rowLabel, colLabel];
    const cleanedAnswers = [...answers].sort((a, b) => b.points - a.points).map((a) => {
      const cleaned = (a.aliases ?? []).map((s) => s.trim()).filter(Boolean);
      return { name: a.name.trim(), points: a.points, ...(cleaned.length > 0 ? { aliases: cleaned } : {}) };
    }).filter((a) => a.name);
    onSave({
      type: isCustom ? "custom" : "normal",
      conditions,
      answers: cleanedAnswers,
      maxScore: calcMaxScore(cleanedAnswers),
      hint: hint.trim() || undefined,
      info: sqInfo.trim() || undefined,
      customType: isCustom ? customType : undefined,
      customText: isCustom ? customText : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gray-900 border border-gray-700 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-bold text-white">{rowLabel || "Row"} + {colLabel || "Col"}</p>
            <p className="text-xs text-white">{answers.length} answer{answers.length !== 1 ? "s" : ""} · {calcMaxScore(answers)} pts</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-white text-xl">&times;</button>
        </div>

        {/* Quick answer input */}
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAnswer(); } }}
              placeholder="Type answer, press Enter..."
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
            <select
              value={newPoints}
              onChange={(e) => setNewPoints(Number(e.target.value))}
              className="w-16 rounded-lg border border-gray-700 bg-gray-800 px-1 py-2 text-sm text-white"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                <option key={p} value={p}>{p}pt</option>
              ))}
            </select>
          </div>
        </div>

        {/* Answer list */}
        {answers.length > 0 && (
          <div className="mb-4 space-y-1.5 max-h-[50vh] overflow-y-auto">
            {answers.map((a) => (
              <div key={a.name} className="rounded-lg bg-gray-800 px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={a.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAnswers(answers.map((x) => x === a ? { ...x, name: val } : x));
                    }}
                    className="flex-1 min-w-0 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                  <select
                    value={a.points}
                    onChange={(e) => {
                      const pts = Number(e.target.value);
                      setAnswers(answers.map((x) => x === a ? { ...x, points: pts } : x));
                    }}
                    className="w-14 rounded border border-gray-600 bg-gray-700 px-1 py-1 text-xs font-bold text-indigo-300"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                      <option key={p} value={p}>{p}pt</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setExpandedAlias(expandedAlias === a.name ? null : a.name)}
                    className={`rounded px-2 py-1 text-[10px] font-bold transition-colors ${
                      expandedAlias === a.name || (a.aliases && a.aliases.length > 0)
                        ? "bg-amber-700/40 text-amber-300"
                        : "bg-gray-700 text-white hover:text-gray-300"
                    }`}
                    title="Aliases"
                  >
                    {a.aliases && a.aliases.length > 0 ? `${a.aliases.length} alias${a.aliases.length > 1 ? "es" : ""}` : "Aliases"}
                  </button>
                  <button onClick={() => setAnswers(answers.filter((x) => x !== a))}
                    className="text-red-400 hover:text-red-300 text-sm font-bold">✕</button>
                </div>
                {expandedAlias === a.name && (
                  <div className="mt-2 pl-1">
                    <input
                      type="text"
                      value={(a.aliases ?? []).join(", ")}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const aliases = raw === "" ? [] : raw.split(",").map((s) => s.trimStart());
                        setAnswers(answers.map((x) => x === a ? { ...x, aliases: aliases.length > 0 ? aliases : undefined } : x));
                      }}
                      onBlur={(e) => {
                        const cleaned = (a.aliases ?? []).map((s) => s.trim()).filter(Boolean);
                        setAnswers(answers.map((x) => x === a ? { ...x, aliases: cleaned.length > 0 ? cleaned : undefined } : x));
                      }}
                      placeholder="Comma-separated alternate names, e.g. Mo Salah, M Salah"
                      className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bulk paste */}
        <details className="mb-4">
          <summary className="cursor-pointer text-xs font-bold text-white hover:text-gray-300">Bulk paste answers</summary>
          <div className="mt-2">
            <textarea
              placeholder="Paste names (one per line)..."
              rows={4}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
              onKeyDown={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const text = e.target.value.trim();
                if (!text) return;
                const names = text.split("\n").map((s) => s.trim()).filter(Boolean);
                const existing = new Set(answers.map((a) => a.name.toLowerCase()));
                const newAnswers = [...answers];
                for (const name of names) {
                  if (!existing.has(name.toLowerCase())) {
                    newAnswers.push({ name, points: 3 });
                    existing.add(name.toLowerCase());
                  }
                }
                setAnswers(newAnswers);
                e.target.value = "";
              }}
            />
            <p className="mt-1 text-[10px] text-white">One name per line. Click outside to add all (default 3pts each).</p>
          </div>
        </details>

        {/* Custom square toggle */}
        <div className="mb-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-white">
            <input type="checkbox" checked={isCustom} onChange={(e) => setIsCustom(e.target.checked)} />
            Custom requirement
          </label>
          {isCustom && (
            <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
              <select value={customType} onChange={(e) => setCustomType(e.target.value as CustomSquareType)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white">
                {(Object.keys(CUSTOM_SQUARE_LABELS) as CustomSquareType[]).map((t) => (
                  <option key={t} value={t}>{CUSTOM_SQUARE_LABELS[t]}</option>
                ))}
              </select>
              <input value={customText} onChange={(e) => setCustomText(e.target.value)}
                placeholder="e.g. Scored in Bayern 8-2 Barcelona"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-500" />
            </div>
          )}
        </div>

        {/* Info & Hint */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <ImageField label="Info" value={sqInfo} onChange={setSqInfo}
            onCropRequest={(url) => onCropRequest(url, (cropped) => setSqInfo(cropped))} />
          <ImageField label="Hint" value={hint} onChange={setHint}
            onCropRequest={(url) => onCropRequest(url, (cropped) => setHint(cropped))} />
        </div>

        <button onClick={save}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500">
          Save Square
        </button>
      </div>
    </div>
  );
}

/* ── Label Editor (modal overlay) ── */
function LabelEditor({
  label,
  index,
  type,
  extras,
  onSave,
  onClose,
  onCropRequest,
}: {
  label: string;
  index: number;
  type: "row" | "col";
  extras: { info: string; hint: string };
  onSave: (label: string, extras: { info: string; hint: string }) => void;
  onClose: () => void;
  onCropRequest: (url: string, onComplete: (url: string) => void) => void;
}) {
  const [value, setValue] = useState(label);
  const [info, setInfo] = useState(extras.info);
  const [hint, setHint] = useState(extras.hint);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-gray-900 border border-gray-700 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-white">{type === "row" ? "Row" : "Column"} {index + 1}</p>
          <button onClick={onClose} className="text-white hover:text-white text-xl">&times;</button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { onSave(value, { info, hint }); } }}
          placeholder={`${type === "row" ? "Row" : "Column"} label...`}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none mb-3"
        />

        <div className="grid grid-cols-2 gap-2 mb-4">
          <ImageField label="Info" value={info} onChange={setInfo}
            onCropRequest={(url) => onCropRequest(url, (cropped) => setInfo(cropped))} />
          <ImageField label="Hint" value={hint} onChange={setHint}
            onCropRequest={(url) => onCropRequest(url, (cropped) => setHint(cropped))} />
        </div>

        <button onClick={() => onSave(value, { info, hint })}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500">
          Save
        </button>
      </div>
    </div>
  );
}

/* ── Main Admin ── */
export default function TicTacToeAdmin() {
  const [puzzles, setPuzzles] = useState<PuzzleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showOrderView, setShowOrderView] = useState(false);
  const [orderedDailies, setOrderedDailies] = useState<PuzzleListItem[]>([]);
  const [showEasyBuilder, setShowEasyBuilder] = useState(false);

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

  const [editingSquare, setEditingSquare] = useState<{ r: number; c: number } | null>(null);
  const [editingLabel, setEditingLabel] = useState<{ type: "row" | "col"; index: number } | null>(null);
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
    setTitle(""); setDifficulty("medium");
    setRowLabels(["", "", ""]); setColLabels(["", "", ""]);
    setGrid(emptyGrid()); setBonus(10);
    setIsDaily(false); setDailyDate(""); setIsActive(true);
    setInfo(""); setDisplayOrder(0);
    setLabelExtras({
      rows: [{ info: "", hint: "" }, { info: "", hint: "" }, { info: "", hint: "" }],
      cols: [{ info: "", hint: "" }, { info: "", hint: "" }, { info: "", hint: "" }],
    });
    setEditingSquare(null); setEditingLabel(null); setCropTarget(null);
  };

  const openNew = () => { resetForm(); setEditing("new"); setError(""); };

  const openEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/tictactoe/${id}`);
      if (!res.ok) throw new Error("Failed to load puzzle");
      const p: TicTacToePuzzle = await res.json();
      setTitle(p.title); setDifficulty(p.difficulty);
      setRowLabels(p.row_labels); setColLabels(p.col_labels);
      setGrid(p.grid); setBonus(p.three_in_a_row_bonus);
      setIsDaily(p.is_daily); setDailyDate(p.daily_date ?? "");
      setIsActive(p.is_active); setInfo(p.info ?? "");
      setDisplayOrder(p.display_order ?? 0);
      const le = p.label_extras as { rows?: Array<{ info?: string; hint?: string } | null>; cols?: Array<{ info?: string; hint?: string } | null> } | null;
      setLabelExtras({
        rows: Array.from({ length: 3 }, (_, i) => ({
          info: le?.rows?.[i]?.info ?? "", hint: le?.rows?.[i]?.hint ?? "",
        })),
        cols: Array.from({ length: 3 }, (_, i) => ({
          info: le?.cols?.[i]?.info ?? "", hint: le?.cols?.[i]?.hint ?? "",
        })),
      });
      setEditing(id); setEditingSquare(null); setEditingLabel(null); setError("");
    } catch (e) { setError(String(e)); }
  };

  const handleSave = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const sq = grid[r][c];
        if (sq.type === "custom" && sq.customType && sq.customText) {
          sq.conditions = computeCustomConditions(sq.customType, sq.customText, rowLabels[r], colLabels[c]);
        } else if (sq.type === "normal") {
          sq.conditions = [rowLabels[r], colLabels[c]];
        }
        if (!sq.conditions[0] || !sq.conditions[1]) {
          setError(`Square (${r + 1},${c + 1}) needs two conditions`); return;
        }
        if (sq.answers.length === 0) {
          setError(`Square (${r + 1},${c + 1}) needs at least one answer`); return;
        }
        sq.maxScore = calcMaxScore(sq.answers);
      }
    }
    setSaving(true); setError("");
    const body = {
      title: title.trim(), difficulty, row_labels: rowLabels, col_labels: colLabels,
      grid, three_in_a_row_bonus: bonus, is_daily: isDaily,
      daily_date: isDaily && dailyDate ? dailyDate : null,
      is_active: isActive, info: info.trim() || null, display_order: displayOrder,
      label_extras: {
        rows: labelExtras.rows.map((r) => r.info || r.hint ? { info: r.info || undefined, hint: r.hint || undefined } : null),
        cols: labelExtras.cols.map((c) => c.info || c.hint ? { info: c.info || undefined, hint: c.hint || undefined } : null),
      },
    };
    try {
      const url = editing === "new" ? "/api/admin/tictactoe" : `/api/admin/tictactoe/${editing}`;
      const method = editing === "new" ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error ?? "Save failed"); }
      setConfirmation("Puzzle saved!"); setTimeout(() => setConfirmation(""), 3000);
      setEditing(null); loadPuzzles();
    } catch (e) { setError(String(e)); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this puzzle?")) return;
    try {
      const res = await fetch(`/api/admin/tictactoe/${id}`, { method: "DELETE" });
      if (res.ok) { setPuzzles((p) => p.filter((x) => x.id !== id)); if (editing === id) setEditing(null); }
    } catch { /* ignore */ }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const quickPatch = async (id: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/tictactoe/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setPuzzles((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } as PuzzleListItem : p));
      }
    } catch { /* ignore */ }
  };

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPuzzle = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/tictactoe/${id}`);
      if (!res.ok) throw new Error("Failed to load puzzle");
      const data = await res.json();
      const slug = (data.title || "puzzle").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      downloadJson(data, `ttt-${slug}.json`);
    } catch { setError("Failed to export puzzle"); }
  };

  const exportAll = async () => {
    try {
      const results = await Promise.all(
        puzzles.map((p) => fetch(`/api/admin/tictactoe/${p.id}`).then((r) => r.json()))
      );
      downloadJson(results, `ttt-all-puzzles.json`);
    } catch { setError("Failed to export puzzles"); }
  };

  const updateSquare = (r: number, c: number, update: Partial<TicTacToeSquareData>) => {
    setGrid((g) => {
      const newGrid = g.map((row) => row.map((sq) => ({ ...sq })));
      newGrid[r][c] = { ...newGrid[r][c], ...update };
      return newGrid;
    });
  };

  const totalPossibleScore = (() => {
    let total = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) total += calcMaxScore(grid[r][c].answers);
    total += bonus;
    return total;
  })();

  if (loading) return <p className="text-white py-8 text-center">Loading puzzles...</p>;

  /* ── Easy TTT Builder ── */
  if (showEasyBuilder) {
    return <EasyTTTBuilder onBack={() => { setShowEasyBuilder(false); loadPuzzles(); }} />;
  }

  /* ── Visual Grid Editor ── */
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{editing === "new" ? "New Puzzle" : "Edit Puzzle"}</h3>
          <button onClick={() => setEditing(null)} className="text-sm text-white hover:text-white">Cancel</button>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        {confirmation && <p className="text-sm text-green-400 bg-green-900/20 rounded-lg px-3 py-2">{confirmation}</p>}

        {/* Top bar: title + settings */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-white">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-bold text-white">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-white">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="extreme">Extreme</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-white">Bonus</label>
              <input type="number" value={bonus} onChange={(e) => setBonus(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-white">Order</label>
              <input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-white" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-white">
            <input type="checkbox" checked={isDaily} onChange={(e) => setIsDaily(e.target.checked)} /> Daily
          </label>
          <label className="flex items-center gap-2 text-xs text-white">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
          </label>
          {isDaily && (
            <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white" />
          )}
          <span className="text-xs text-white ml-auto">Total: {totalPossibleScore} pts</span>
        </div>

        {/* Info */}
        <ImageField label="Puzzle Info (shown on info button)" value={info} onChange={setInfo}
          onCropRequest={(url) => setCropTarget({ imageUrl: url, onComplete: (cropped) => setInfo(cropped) })} />

        {/* ── THE VISUAL GRID ── */}
        <div className="mx-auto max-w-xl">
          <div className="grid grid-cols-4 gap-0 border-2 border-gray-600 rounded-xl overflow-hidden">
            {/* Top-left empty cell */}
            <div className="bg-gray-900 border-b-2 border-r-2 border-gray-600 p-2" />

            {/* Column labels (top row) */}
            {colLabels.map((cl, c) => (
              <button
                key={`col-${c}`}
                onClick={() => setEditingLabel({ type: "col", index: c })}
                className={`p-2 h-16 flex flex-col items-center justify-center text-center transition-colors border-b-2 border-gray-600 ${c < 2 ? "border-r-2" : ""} ${
                  cl ? "bg-gray-800" : "bg-gray-900"
                } hover:bg-gray-700`}
              >
                {cl ? (
                  <p className="text-[10px] font-black text-white leading-tight break-words line-clamp-3">{cl}</p>
                ) : (
                  <p className="text-[9px] text-white">Col {c + 1}</p>
                )}
                {(labelExtras.cols[c].info || labelExtras.cols[c].hint) && (
                  <div className="flex gap-0.5 mt-0.5">
                    {labelExtras.cols[c].info && <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 text-[6px] font-black text-white flex items-center justify-center">i</span>}
                    {labelExtras.cols[c].hint && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 text-[6px] font-black text-white flex items-center justify-center">?</span>}
                  </div>
                )}
              </button>
            ))}

            {/* Rows */}
            {grid.map((row, r) => (
              <React.Fragment key={`row-${r}`}>
                {/* Row label */}
                <button
                  onClick={() => setEditingLabel({ type: "row", index: r })}
                  className={`p-2 h-16 flex flex-col items-center justify-center text-center transition-colors border-r-2 border-gray-600 ${r < 2 ? "border-b-2" : ""} ${
                    rowLabels[r] ? "bg-gray-800" : "bg-gray-900"
                  } hover:bg-gray-700`}
                >
                  {rowLabels[r] ? (
                    <p className="text-[10px] font-black text-white leading-tight break-words line-clamp-3">{rowLabels[r]}</p>
                  ) : (
                    <p className="text-[9px] text-white">Row {r + 1}</p>
                  )}
                  {(labelExtras.rows[r].info || labelExtras.rows[r].hint) && (
                    <div className="flex gap-0.5 mt-0.5">
                      {labelExtras.rows[r].info && <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 text-[6px] font-black text-white flex items-center justify-center">i</span>}
                      {labelExtras.rows[r].hint && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 text-[6px] font-black text-white flex items-center justify-center">?</span>}
                    </div>
                  )}
                </button>

                {/* Grid squares */}
                {row.map((sq, c) => {
                  const hasAnswers = sq.answers.length > 0;
                  return (
                    <button
                      key={`sq-${r}-${c}`}
                      onClick={() => setEditingSquare({ r, c })}
                      className={`h-16 p-1 flex flex-col items-center justify-center text-center transition-colors ${
                        c < 2 ? "border-r-2 border-gray-600" : ""
                      } ${r < 2 ? "border-b-2 border-gray-600" : ""} ${
                        hasAnswers
                          ? "bg-green-900/20"
                          : "bg-gray-900"
                      } hover:bg-gray-700`}
                    >
                      {hasAnswers ? (
                        <>
                          <p className="text-sm font-black text-white leading-none">{sq.answers.length}</p>
                          <p className="text-[8px] text-white">{sq.answers.length === 1 ? "answer" : "answers"}</p>
                          <p className="text-[8px] font-bold text-indigo-400">{calcMaxScore(sq.answers)}pts</p>
                          {sq.type === "custom" && (
                            <span className="text-[7px] font-bold text-amber-500">★</span>
                          )}
                        </>
                      ) : (
                        <p className="text-[9px] text-white">+</p>
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Save / Cancel */}
        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
            {saving ? "Saving..." : "Save Puzzle"}
          </button>
          <button onClick={() => setEditing(null)}
            className="rounded-lg border border-gray-600 px-5 py-2.5 text-sm text-white hover:text-white">
            Cancel
          </button>
        </div>

        {/* Square editor overlay */}
        {editingSquare && (
          <SquareEditor
            square={grid[editingSquare.r][editingSquare.c]}
            rowLabel={rowLabels[editingSquare.r]}
            colLabel={colLabels[editingSquare.c]}
            onSave={(updated) => {
              updateSquare(editingSquare.r, editingSquare.c, updated);
              setEditingSquare(null);
            }}
            onClose={() => setEditingSquare(null)}
            onCropRequest={(url, onComplete) => setCropTarget({ imageUrl: url, onComplete })}
          />
        )}

        {/* Label editor overlay */}
        {editingLabel && (
          <LabelEditor
            label={editingLabel.type === "row" ? rowLabels[editingLabel.index] : colLabels[editingLabel.index]}
            index={editingLabel.index}
            type={editingLabel.type}
            extras={editingLabel.type === "row" ? labelExtras.rows[editingLabel.index] : labelExtras.cols[editingLabel.index]}
            onSave={(newLabel, newExtras) => {
              if (editingLabel.type === "row") {
                const n = [...rowLabels] as [string, string, string];
                n[editingLabel.index] = newLabel;
                setRowLabels(n);
                setLabelExtras((prev) => {
                  const next = { ...prev, rows: [...prev.rows] };
                  next.rows[editingLabel.index] = newExtras;
                  return next;
                });
              } else {
                const n = [...colLabels] as [string, string, string];
                n[editingLabel.index] = newLabel;
                setColLabels(n);
                setLabelExtras((prev) => {
                  const next = { ...prev, cols: [...prev.cols] };
                  next.cols[editingLabel.index] = newExtras;
                  return next;
                });
              }
              setEditingLabel(null);
            }}
            onClose={() => setEditingLabel(null)}
            onCropRequest={(url, onComplete) => setCropTarget({ imageUrl: url, onComplete })}
          />
        )}

        {/* Crop overlay */}
        {cropTarget && (
          <CropOverlay
            imageUrl={cropTarget.imageUrl}
            imageName="Image"
            freeform
            onCancel={() => setCropTarget(null)}
            onCrop={async (dataUrl) => {
              try {
                const blob = dataUrlToBlob(dataUrl);
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

  /* ── Daily archive order view ── */
  if (showOrderView) {
    const moveUp = (idx: number) => {
      if (idx === 0) return;
      setOrderedDailies((prev) => {
        const next = [...prev];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        return next;
      });
    };
    const moveDown = (idx: number) => {
      if (idx === orderedDailies.length - 1) return;
      setOrderedDailies((prev) => {
        const next = [...prev];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next;
      });
    };
    const saveOrder = async () => {
      setSaving(true);
      const total = orderedDailies.length;
      await Promise.all(
        orderedDailies.map((p, idx) =>
          fetch(`/api/admin/tictactoe/${p.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ display_order: total - idx }),
          })
        )
      );
      setPuzzles((prev) =>
        prev.map((p) => {
          const pos = orderedDailies.findIndex((d) => d.id === p.id);
          return pos >= 0 ? { ...p, display_order: total - pos } : p;
        })
      );
      setSaving(false);
      setConfirmation("Archive order saved!");
      setTimeout(() => setConfirmation(""), 3000);
      setShowOrderView(false);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Daily Archive Order</h3>
            <p className="text-xs text-gray-400 mt-0.5">Top of list = first in archive. Use arrows to reorder.</p>
          </div>
          <button onClick={() => setShowOrderView(false)} className="text-sm text-gray-400 hover:text-white">
            ← Back
          </button>
        </div>
        {orderedDailies.length === 0 ? (
          <p className="py-8 text-center text-gray-400">No daily puzzles yet.</p>
        ) : (
          <div className="space-y-2">
            {orderedDailies.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3">
                <span className="text-sm font-black text-gray-500 w-6 text-center">{idx + 1}</span>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{p.title}</p>
                  <p className="text-xs text-amber-400">{p.daily_date ?? "No date"}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="rounded bg-gray-800 px-2 py-1 text-xs font-bold text-white hover:bg-gray-700 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === orderedDailies.length - 1}
                    className="rounded bg-gray-800 px-2 py-1 text-xs font-bold text-white hover:bg-gray-700 disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={saveOrder}
          disabled={saving}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Order"}
        </button>
      </div>
    );
  }

  /* ── Puzzle list ── */
  return (
    <div className="space-y-4">
      {confirmation && (
        <div className="rounded-lg border border-green-700 bg-green-900/50 px-4 py-2 text-sm text-green-300">
          {confirmation}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Tic Tac Toe Puzzles ({puzzles.length})</h3>
        <div className="flex gap-2">
          {puzzles.length > 0 && (
            <button onClick={exportAll}
              className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-bold text-white hover:text-white hover:border-gray-500">
              Export All
            </button>
          )}
          <button
            onClick={() => {
              const dailies = puzzles
                .filter((p) => p.is_daily)
                .sort((a, b) => {
                  if (b.display_order !== a.display_order) return b.display_order - a.display_order;
                  if (a.daily_date && b.daily_date) return b.daily_date.localeCompare(a.daily_date);
                  return 0;
                });
              setOrderedDailies(dailies);
              setShowOrderView(true);
            }}
            className="rounded-lg border border-amber-600/50 bg-amber-900/20 px-4 py-2 text-sm font-bold text-amber-400 hover:bg-amber-900/30">
            Archive Order
          </button>
          <button onClick={() => setShowEasyBuilder(true)}
            className="rounded-lg border border-green-700 bg-green-900/30 px-4 py-2 text-sm font-bold text-green-400 hover:bg-green-900/50">
            + Easy TTT
          </button>
          <button onClick={openNew}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500">
            + New Puzzle
          </button>
        </div>
      </div>

      {puzzles.length === 0 ? (
        <p className="py-8 text-center text-white">No puzzles yet.</p>
      ) : (
        <div className="space-y-2">
          {puzzles.map((p) => {
            const isToday = p.daily_date === todayStr;
            const isFuture = p.daily_date && p.daily_date > todayStr;
            return (
              <div key={p.id} className={`rounded-lg border px-4 py-3 ${
                isToday ? "border-amber-500/60 bg-amber-900/10" : "border-gray-700 bg-gray-900"
              }`}>
                <div className="flex items-start justify-between gap-3">
                  {/* Left: title + badges */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white truncate">{p.title}</p>
                      {isToday && (
                        <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-black">TODAY</span>
                      )}
                      {isFuture && (
                        <span className="shrink-0 rounded-full bg-blue-700/60 px-2 py-0.5 text-[10px] font-bold text-blue-200">UPCOMING</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-bold ${
                        p.difficulty === "easy" ? "bg-green-900/50 text-green-400" :
                        p.difficulty === "medium" ? "bg-yellow-900/50 text-yellow-400" :
                        "bg-red-900/50 text-red-400"
                      }`}>{p.difficulty}</span>
                      {p.is_daily && p.daily_date && (
                        <span className="text-amber-400 font-medium">📅 {p.daily_date}</span>
                      )}
                      {p.is_daily && !p.daily_date && (
                        <span className="text-amber-400">Daily (no date)</span>
                      )}
                      {!p.is_active && <span className="text-red-400">Inactive</span>}
                      <span className="text-gray-500 flex items-center gap-1">
                        Archive order:
                        <input
                          type="number"
                          defaultValue={p.display_order ?? 0}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val !== p.display_order) {
                              quickPatch(p.id, { display_order: val });
                            }
                          }}
                          className="w-14 rounded bg-gray-800 border border-gray-700 px-1.5 py-0.5 text-xs text-white text-center focus:border-indigo-500 focus:outline-none"
                        />
                      </span>
                    </div>
                  </div>
                  {/* Right: actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {!isToday && (
                      <button
                        onClick={() => quickPatch(p.id, { is_daily: true, daily_date: todayStr })}
                        className="rounded-lg bg-amber-600/20 border border-amber-600/40 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-600/30"
                      >
                        Set Today
                      </button>
                    )}
                    <div className="flex gap-1.5">
                      <button onClick={() => exportPuzzle(p.id)}
                        className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-700">
                        Export
                      </button>
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
