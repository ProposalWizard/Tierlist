"use client";

import { useState, useEffect, useCallback } from "react";
import type { TenableAnswer } from "@/lib/types";

interface PuzzleListItem {
  id: string;
  title: string;
  category: string;
  daily_date: string | null;
  is_ordered: boolean;
  is_active: boolean;
  created_at: string;
}

export default function TenableAdmin() {
  const [puzzles, setPuzzles] = useState<PuzzleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isOrdered, setIsOrdered] = useState(false);
  const [dailyDate, setDailyDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [answers, setAnswers] = useState<TenableAnswer[]>(
    Array.from({ length: 10 }, (_, i) => ({ position: i + 1, name: "", aliases: [] }))
  );
  const [aliasStrings, setAliasStrings] = useState<Record<number, string>>({});
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const loadPuzzles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tenable");
      if (res.ok) setPuzzles(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadPuzzles(); }, [loadPuzzles]);

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setDescription("");
    setIsOrdered(false);
    setDailyDate("");
    setIsActive(true);
    setAnswers(
      Array.from({ length: 10 }, (_, i) => ({ position: i + 1, name: "", aliases: [] }))
    );
    setBulkText("");
    setShowBulk(false);
    setAliasStrings({});
  };

  const openNew = () => {
    resetForm();
    setEditing("new");
    setError("");
  };

  const openEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/tenable/${id}`);
      if (!res.ok) throw new Error("Failed to load");
      const p = await res.json();
      setTitle(p.title);
      setCategory(p.category ?? "");
      setDescription(p.description ?? "");
      setIsOrdered(p.is_ordered ?? false);
      setDailyDate(p.daily_date ?? "");
      setIsActive(p.is_active ?? true);

      const existing = (p.answers as TenableAnswer[]) ?? [];
      const count = Math.max(existing.length, 10);
      const ans: TenableAnswer[] = Array.from({ length: count }, (_, i) => {
        const found = existing.find((a) => a.position === i + 1);
        return found ?? { position: i + 1, name: "", aliases: [] };
      });
      setAnswers(ans);
      const aStrings: Record<number, string> = {};
      for (const a of ans) {
        if (a.aliases && a.aliases.length > 0) aStrings[a.position] = a.aliases.join(", ");
      }
      setAliasStrings(aStrings);
      setShowBulk(false);
      setBulkText("");

      setEditing(id);
      setError("");
    } catch {
      setError("Failed to load puzzle");
    }
  };

  const handleSave = async () => {
    setError("");
    if (!title.trim()) { setError("Title is required"); return; }

    const filledAnswers = answers.filter((a) => a.name.trim());
    if (filledAnswers.length < 10) {
      setError("At least 10 answers are required");
      return;
    }
    if (isOrdered && filledAnswers.length !== 10) {
      setError("Ordered puzzles must have exactly 10 answers");
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      is_ordered: isOrdered,
      daily_date: dailyDate || null,
      is_active: isActive,
      answers: filledAnswers.map((a) => {
        const raw = aliasStrings[a.position] ?? "";
        const aliases = raw.split(",").map((s) => s.trim()).filter(Boolean);
        return {
          position: a.position,
          name: a.name.trim(),
          ...(aliases.length > 0 ? { aliases } : {}),
        };
      }),
    };

    try {
      const url = editing === "new" ? "/api/admin/tenable" : `/api/admin/tenable/${editing}`;
      const method = editing === "new" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }

      setConfirmation(editing === "new" ? "Puzzle created!" : "Puzzle updated!");
      setTimeout(() => setConfirmation(""), 3000);
      setEditing(null);
      resetForm();
      loadPuzzles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this puzzle?")) return;
    try {
      await fetch(`/api/admin/tenable/${id}`, { method: "DELETE" });
      loadPuzzles();
    } catch { /* ignore */ }
  };

  const updateAnswerName = (position: number, value: string) => {
    setAnswers((prev) =>
      prev.map((a) => a.position === position ? { ...a, name: value } : a)
    );
  };

  const updateAliasString = (position: number, value: string) => {
    setAliasStrings((prev) => ({ ...prev, [position]: value }));
  };

  const addAnswerSlot = () => {
    const nextPos = answers.length + 1;
    setAnswers((prev) => [...prev, { position: nextPos, name: "", aliases: [] }]);
  };

  const removeAnswerSlot = (position: number) => {
    setAnswers((prev) => {
      const filtered = prev.filter((a) => a.position !== position);
      return filtered.map((a, i) => ({ ...a, position: i + 1 }));
    });
  };

  const handleBulkPaste = () => {
    const lines = bulkText
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const names: string[] = [];
    for (const line of lines) {
      const parts = line.split(/\s{2,}|\t/).map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (/^[a-zA-ZÀ-ÿ\s\-'.]+$/.test(part) && part.length >= 2) {
          names.push(part);
        }
      }
    }

    if (names.length === 0) {
      setError("No names found in the pasted text");
      return;
    }

    const count = Math.max(names.length, 10);
    const newAnswers: TenableAnswer[] = Array.from({ length: count }, (_, i) => ({
      position: i + 1,
      name: names[i] ?? "",
      aliases: [],
    }));
    setAnswers(newAnswers);
    setAliasStrings({});
    setBulkText("");
    setShowBulk(false);
    setError("");
    setConfirmation(`Parsed ${names.length} name${names.length !== 1 ? "s" : ""}`);
    setTimeout(() => setConfirmation(""), 3000);
  };

  if (loading) {
    return <p className="py-8 text-center text-gray-200">Loading...</p>;
  }

  if (editing) {
    const filledCount = answers.filter((a) => a.name.trim()).length;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {editing === "new" ? "New Ten-A-Ball Puzzle" : "Edit Puzzle"}
          </h3>
          <button
            onClick={() => { setEditing(null); resetForm(); }}
            className="text-sm text-white hover:text-white"
          >
            Cancel
          </button>
        </div>

        {/* Title & Category */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Champions League Winners"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Players with 100+ PL goals"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-white mb-1">
            Description (shown below the board)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Ordered by most recent title win first"
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Settings row */}
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={isOrdered}
              onChange={(e) => {
                setIsOrdered(e.target.checked);
                if (e.target.checked && answers.length > 10) {
                  setAnswers((prev) => prev.slice(0, 10));
                }
              }}
              className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
            />
            Answers are ordered (1 = best, 10 = 10th)
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
            />
            Active
          </label>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-white">Daily Date</label>
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Bulk paste */}
        <div>
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {showBulk ? "Hide bulk paste" : "Bulk paste names"}
          </button>
          {showBulk && (
            <div className="mt-2 space-y-2">
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Paste a list of names (one per line or separated by tabs/spaces):\n\nFederico Bernadeschi\nDouglas Costa\nCarlo Cudicini\n..."}
                rows={6}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none font-mono"
              />
              <button
                onClick={handleBulkPaste}
                disabled={!bulkText.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
              >
                Parse &amp; fill slots
              </button>
            </div>
          )}
        </div>

        {/* Answers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-white">
              Answers ({filledCount} filled{!isOrdered && filledCount > 10 ? ` — ${filledCount - 10} bonus` : ""})
            </label>
            {!isOrdered && (
              <span className="text-[10px] text-gray-200">
                Unordered — can have more than 10 answers
              </span>
            )}
          </div>
          <div className="space-y-2">
            {answers.map((a) => (
              <div key={a.position} className="flex items-center gap-2">
                <span className="w-8 text-center text-sm font-black text-gray-200">{a.position}</span>
                <input
                  type="text"
                  value={a.name}
                  onChange={(e) => updateAnswerName(a.position, e.target.value)}
                  placeholder={`Answer ${a.position}`}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={aliasStrings[a.position] ?? ""}
                  onChange={(e) => updateAliasString(a.position, e.target.value)}
                  placeholder="Aliases (comma-separated)"
                  className="w-48 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                />
                {!isOrdered && answers.length > 10 && (
                  <button
                    onClick={() => removeAnswerSlot(a.position)}
                    className="text-red-400 hover:text-red-300 text-xs font-bold px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isOrdered && (
            <button
              onClick={addAnswerSlot}
              className="mt-2 rounded-lg border border-dashed border-gray-700 px-4 py-2 text-xs font-bold text-white hover:border-emerald-600 hover:text-emerald-400 transition-colors w-full"
            >
              + Add answer slot
            </button>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-3 text-sm font-bold text-red-400">
            {error}
          </p>
        )}

        {confirmation && (
          <p className="rounded-lg bg-green-900/30 border border-green-800 px-4 py-3 text-sm font-bold text-green-400">
            {confirmation}
          </p>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-emerald-600 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "Saving..." : editing === "new" ? "Create Puzzle" : "Save Changes"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Ten-A-Ball Puzzles ({puzzles.length})</h3>
        <button
          onClick={openNew}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
        >
          + New Puzzle
        </button>
      </div>

      {confirmation && (
        <p className="mb-4 rounded-lg bg-green-900/30 border border-green-800 px-4 py-3 text-sm font-bold text-green-400">
          {confirmation}
        </p>
      )}

      {puzzles.length === 0 ? (
        <p className="py-12 text-center text-gray-200">No Ten-A-Ball puzzles yet.</p>
      ) : (
        <div className="space-y-2">
          {puzzles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white truncate">{p.title}</span>
                  {!p.is_active && (
                    <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                      Inactive
                    </span>
                  )}
                  {p.is_ordered && (
                    <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Ordered
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-200">
                  <span>{p.category}</span>
                  {p.daily_date && <span>Day: {p.daily_date}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <button
                  onClick={() => openEdit(p.id)}
                  className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="rounded-lg bg-red-900/30 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-900/50"
                >
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
