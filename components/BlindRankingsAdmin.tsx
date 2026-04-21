"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPT_IMAGE_TYPES } from "@/lib/imageUtils";
import type { BlindRanking, BlindRankingImage } from "@/lib/types";

interface EditState {
  id: string;
  title: string;
  description: string;
  category: string;
  num_slots: number;
  is_active: boolean;
  images: BlindRankingImage[];
  loading: boolean;
}

export default function BlindRankingsAdmin() {
  const [rankings, setRankings] = useState<BlindRanking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlots, setNewSlots] = useState(10);
  const [creating, setCreating] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function loadRankings() {
    const res = await fetch("/api/admin/blind-rankings");
    if (res.ok) {
      const data = await res.json();
      setRankings(data);
    }
    setLoaded(true);
  }

  useEffect(() => { loadRankings(); }, []);

  async function createRanking() {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/admin/blind-rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), num_slots: newSlots }),
    });
    if (res.ok) {
      setNewTitle("");
      setNewSlots(10);
      await loadRankings();
      showToast("Blind ranking created");
    }
    setCreating(false);
  }

  async function deleteRanking(id: string) {
    if (!confirm("Delete this blind ranking and all its images?")) return;
    const res = await fetch(`/api/admin/blind-rankings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRankings((prev) => prev.filter((r) => r.id !== id));
      if (editState?.id === id) setEditState(null);
      showToast("Deleted");
    }
  }

  async function openEdit(ranking: BlindRanking) {
    const res = await fetch(`/api/admin/blind-rankings/${ranking.id}/images`);
    const images: BlindRankingImage[] = res.ok ? await res.json() : [];
    setEditState({
      id: ranking.id,
      title: ranking.title,
      description: ranking.description ?? "",
      category: ranking.category ?? "General",
      num_slots: ranking.num_slots,
      is_active: ranking.is_active,
      images,
      loading: false,
    });
  }

  async function saveEdit() {
    if (!editState || editState.loading) return;
    setEditState((s) => s && { ...s, loading: true });

    const res = await fetch(`/api/admin/blind-rankings/${editState.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editState.title,
        description: editState.description || null,
        category: editState.category,
        num_slots: editState.num_slots,
        is_active: editState.is_active,
      }),
    });

    if (res.ok) {
      await loadRankings();
      showToast("Saved");
    }
    setEditState((s) => s && { ...s, loading: false });
  }

  async function uploadImages(files: FileList) {
    if (!editState || uploading) return;
    setUploading(true);
    const supabase = createClient();

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "webp";
      const path = `blind-rankings/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("tierlist-images")
        .upload(path, file, { contentType: file.type });

      if (upErr) continue;

      const { data: urlData } = supabase.storage
        .from("tierlist-images")
        .getPublicUrl(path);

      const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const res = await fetch(`/api/admin/blind-rankings/${editState.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image_url: urlData.publicUrl }),
      });

      if (res.ok) {
        const img = await res.json();
        setEditState((s) => s && { ...s, images: [...s.images, img] });
      }
    }

    setUploading(false);
    showToast("Images uploaded");
  }

  async function deleteImage(imageId: string) {
    if (!editState) return;
    const res = await fetch(`/api/admin/blind-rankings/${editState.id}/images/${imageId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setEditState((s) => s && { ...s, images: s.images.filter((i) => i.id !== imageId) });
    }
  }

  async function renameImage(imageId: string, newName: string) {
    if (!editState) return;
    await fetch(`/api/admin/blind-rankings/${editState.id}/images/${imageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setEditState((s) => s && {
      ...s,
      images: s.images.map((i) => i.id === imageId ? { ...i, name: newName } : i),
    });
  }

  if (!loaded) {
    return <div className="py-8 text-center text-gray-500">Loading blind rankings...</div>;
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-pulse rounded-lg border border-green-700 bg-green-900/90 px-4 py-3 text-sm font-semibold text-green-300 shadow-lg">
          {toast}
        </div>
      )}

      {/* Create new */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-700 bg-gray-900 p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-semibold text-gray-400">Title</label>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Best Premier League Strikers"
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && createRanking()}
          />
        </div>
        <div className="w-24">
          <label className="mb-1 block text-xs font-semibold text-gray-400">Slots</label>
          <input
            type="number"
            value={newSlots}
            onChange={(e) => setNewSlots(Number(e.target.value))}
            min={3}
            max={25}
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        <button
          onClick={createRanking}
          disabled={!newTitle.trim() || creating}
          className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
        >
          + Create
        </button>
      </div>

      {/* Rankings list */}
      {rankings.map((r) => (
        <div key={r.id} className="rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-800/50"
            onClick={() => editState?.id === r.id ? setEditState(null) : openEdit(r)}
          >
            <div>
              <span className="font-semibold text-white">{r.title}</span>
              <span className="ml-3 text-xs text-gray-500">{r.num_slots} slots</span>
              {!r.is_active && (
                <span className="ml-2 rounded bg-red-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                  Inactive
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/blind-rankings/${r.id}`}
                target="_blank"
                className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                View
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); deleteRanking(r.id); }}
                className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Expanded edit form */}
          {editState?.id === r.id && (
            <div className="border-t border-gray-800 px-4 py-4 space-y-4">
              {/* Title + settings */}
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1 block text-xs font-semibold text-gray-400">Title</label>
                  <input
                    value={editState.title}
                    onChange={(e) => setEditState((s) => s && { ...s, title: e.target.value })}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs font-semibold text-gray-400">Slots</label>
                  <input
                    type="number"
                    value={editState.num_slots}
                    onChange={(e) => setEditState((s) => s && { ...s, num_slots: Number(e.target.value) })}
                    min={3}
                    max={25}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1 block text-xs font-semibold text-gray-400">Category</label>
                  <input
                    value={editState.category}
                    onChange={(e) => setEditState((s) => s && { ...s, category: e.target.value })}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-400">Description</label>
                <input
                  value={editState.description}
                  onChange={(e) => setEditState((s) => s && { ...s, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editState.is_active}
                    onChange={(e) => setEditState((s) => s && { ...s, is_active: e.target.checked })}
                    className="rounded"
                  />
                  Active
                </label>
                <button
                  onClick={saveEdit}
                  disabled={editState.loading}
                  className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {editState.loading ? "Saving..." : "Save Changes"}
                </button>
              </div>

              {/* Images */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">
                    Player Bank ({editState.images.length} images)
                  </span>
                  <label className="cursor-pointer rounded-lg border border-amber-700 bg-amber-900/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-800/40 transition-colors">
                    {uploading ? "Uploading..." : "+ Add Images"}
                    <input
                      type="file"
                      multiple
                      accept={ACCEPT_IMAGE_TYPES}
                      className="hidden"
                      onChange={(e) => e.target.files && uploadImages(e.target.files)}
                      disabled={uploading}
                    />
                  </label>
                </div>

                {editState.images.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-600">
                    No images yet. Upload player photos to build the bank.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {editState.images.map((img) => (
                      <div key={img.id} className="group relative rounded-lg border border-gray-700 bg-gray-800 overflow-hidden">
                        <div className="aspect-square overflow-hidden">
                          <img
                            src={img.image_url}
                            alt={img.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="px-2 py-1.5">
                          <input
                            value={img.name}
                            onChange={(e) => {
                              const newName = e.target.value;
                              setEditState((s) => s && {
                                ...s,
                                images: s.images.map((i) => i.id === img.id ? { ...i, name: newName } : i),
                              });
                            }}
                            onBlur={(e) => renameImage(img.id, e.target.value)}
                            className="w-full bg-transparent text-[11px] text-gray-300 focus:text-white focus:outline-none truncate"
                          />
                        </div>
                        <button
                          onClick={() => deleteImage(img.id)}
                          className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {rankings.length === 0 && (
        <p className="py-8 text-center text-gray-500">No blind rankings yet. Create one above.</p>
      )}
    </div>
  );
}
