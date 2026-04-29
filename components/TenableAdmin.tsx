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

      const ans: TenableAnswer[] = Array.from({ length: 10 }, (_, i) => {
        const existing = (p.answers as TenableAnswer[])?.find((a) => a.position === i + 1);
        return existing ?? { position: i + 1, name: "", aliases: [] };
      });
      setAnswers(ans);

      setEditing(id);
      setError("");
    } catch {
      setError("Failed to load puzzle");
    }
  };

  const handleSave = async () => {
    setError("");
    if (!title.trim()) { setError("Title is required"); return; }
    if (!category.trim()) { setError("Category is required"); return; }

    const emptyAnswers = answers.filter((a) => !a.name.trim());
    if (emptyAnswers.length > 0) {
      setError(`Answer${emptyAnswers.length > 1 ? "s" : ""} ${emptyAnswers.map((a) => a.position).join(", ")} need a name`);
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
      answers: answers.map((a) => ({
        position: a.position,
        name: a.name.trim(),
        ...(a.aliases && a.aliases.length > 0
          ? { aliases: a.aliases.map((al) => al.trim()).filter(Boolean) }
          : {}),
      })),
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

  const updateAnswer = (position: number, field: "name" | "aliases", value: string) => {
    setAnswers((prev) =>
      prev.map((a) => {
        if (a.position !== position) return a;
        if (field === "name") return { ...a, name: value };
        return { ...a, aliases: value.split(",").map((s) => s.trim()) };
      })
    );
  };

  if (loading) {
    return <p className="py-8 text-center text-gray-500">Loading...</p>;
  }

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {editing === "new" ? "New Tenable Puzzle" : "Edit Puzzle"}
          </h3>
          <button
            onClick={() => { setEditing(null); resetForm(); }}
            className="text-sm text-gray-400 hover:text-white"
          >
            Cancel
          </button>
        </div>

        {/* Title & Category */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Champions League Winners"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Category</label>
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
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
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
              onChange={(e) => setIsOrdered(e.target.checked)}
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
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Daily Date</label>
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 10 answers */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Answers (1 = top, 10 = bottom)
          </label>
          <div className="space-y-2">
            {answers.map((a) => (
              <div key={a.position} className="flex items-center gap-2">
                <span className="w-8 text-center text-sm font-black text-gray-500">{a.position}</span>
                <input
                  type="text"
                  value={a.name}
                  onChange={(e) => updateAnswer(a.position, "name", e.target.value)}
                  placeholder={`Answer ${a.position}`}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={a.aliases?.join(", ") ?? ""}
                  onChange={(e) => updateAnswer(a.position, "aliases", e.target.value)}
                  placeholder="Aliases (comma-separated)"
                  className="w-48 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
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
        <h3 className="text-lg font-bold text-white">Tenable Puzzles ({puzzles.length})</h3>
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
        <p className="py-12 text-center text-gray-500">No Tenable puzzles yet.</p>
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
                    <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-gray-400">
                      Ordered
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
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
