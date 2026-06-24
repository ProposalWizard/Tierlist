"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { LibraryCard } from "./CardLibraryPicker";

interface PendingCard {
  file: File;
  name: string;
  tags: string;
  preview: string;
  uploading: boolean;
  error: string | null;
}

export default function CardLibraryAdmin() {
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<PendingCard[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/card-library");
    if (res.ok) setCards(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newPending: PendingCard[] = files.map(file => {
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
      const preview = URL.createObjectURL(file);
      return { file, name: nameWithoutExt, tags: "", preview, uploading: false, error: null };
    });
    setPending(prev => [...prev, ...newPending]);
    e.target.value = "";
  };

  const updatePending = (idx: number, patch: Partial<PendingCard>) => {
    setPending(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };

  const removePending = (idx: number) => {
    setPending(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const uploadPending = async () => {
    setSaving(true);
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      if (!p.name.trim()) {
        updatePending(i, { error: "Name is required" });
        continue;
      }
      updatePending(i, { uploading: true, error: null });

      try {
        // Upload file
        const formData = new FormData();
        formData.append("file", p.file);
        const uploadRes = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const { error } = await uploadRes.json();
          updatePending(i, { uploading: false, error: error ?? "Upload failed" });
          continue;
        }
        const { url } = await uploadRes.json();

        // Save to library
        const tags = p.tags.trim() ? p.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
        const saveRes = await fetch("/api/admin/card-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: p.name.trim(), image_url: url, tags }),
        });
        if (!saveRes.ok) {
          updatePending(i, { uploading: false, error: "Failed to save to library" });
          continue;
        }

        // Success — remove from pending
        URL.revokeObjectURL(p.preview);
        setPending(prev => prev.filter((_, j) => j !== i));
      } catch {
        updatePending(i, { uploading: false, error: "Unexpected error" });
      }
    }
    setSaving(false);
    load();
  };

  const startEdit = (card: LibraryCard) => {
    setEditingId(card.id);
    setEditName(card.name);
    setEditTags(card.tags.join(", "));
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const tags = editTags.trim() ? editTags.split(",").map(t => t.trim()).filter(Boolean) : [];
    await fetch("/api/admin/card-library", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, name: editName.trim(), tags }),
    });
    setEditingId(null);
    load();
  };

  const deleteCard = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}" from the library? This removes it permanently.`)) return;
    await fetch(`/api/admin/card-library?id=${id}`, { method: "DELETE" });
    load();
  };

  const filtered = cards.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-white">
          Card Library {!loading && `(${cards.length})`}
        </h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition"
        >
          + Upload Cards
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Pending uploads */}
      {pending.length > 0 && (
        <div className="bg-gray-900 border border-emerald-800/40 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Pending uploads ({pending.length})</h3>
            <p className="text-[10px] text-gray-400">Name each card, then click Save All</p>
          </div>

          <div className="space-y-3">
            {pending.map((p, i) => (
              <div key={i} className="flex items-start gap-4 bg-gray-800 rounded-xl p-3">
                <img src={p.preview} alt="" className="w-14 h-20 object-cover rounded-lg border border-gray-700 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Card Name *</label>
                    <input
                      type="text"
                      value={p.name}
                      onChange={e => updatePending(i, { name: e.target.value })}
                      placeholder="e.g. Wayne Rooney"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Tags (optional, comma-separated)</label>
                    <input
                      type="text"
                      value={p.tags}
                      onChange={e => updatePending(i, { tags: e.target.value })}
                      placeholder="e.g. season1, icon, legend"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {p.error && <p className="text-xs text-red-400">{p.error}</p>}
                  {p.uploading && <p className="text-xs text-blue-400">Uploading...</p>}
                </div>
                <button
                  onClick={() => removePending(i)}
                  disabled={p.uploading}
                  className="text-gray-500 hover:text-red-400 font-bold text-lg leading-none mt-1 transition disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={uploadPending}
              disabled={saving || pending.every(p => p.uploading)}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg transition disabled:opacity-50"
            >
              {saving ? "Saving..." : `Save All (${pending.length})`}
            </button>
            <button
              onClick={() => { pending.forEach(p => URL.revokeObjectURL(p.preview)); setPending([]); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold text-sm rounded-lg transition"
            >
              Cancel All
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      {cards.length > 0 && (
        <input
          type="text"
          placeholder="Search cards by name or tag..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      )}

      {/* Card grid */}
      {loading ? (
        <div className="text-gray-500 text-sm text-center py-12">Loading...</div>
      ) : cards.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-12">
          No cards yet. Click &quot;+ Upload Cards&quot; to add your first card.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-8">No cards match &quot;{search}&quot;.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(card => (
            <div key={card.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group">
              <div className="aspect-[3/4] bg-gray-800 overflow-hidden">
                <img
                  src={card.image_url}
                  alt={card.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="p-2.5 space-y-1.5">
                {editingId === card.id ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                      autoFocus
                      className="w-full bg-gray-800 border border-emerald-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editTags}
                      onChange={e => setEditTags(e.target.value)}
                      placeholder="tags, comma separated"
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none"
                    />
                    <div className="flex gap-1">
                      <button onClick={saveEdit} className="flex-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded transition">Save</button>
                      <button onClick={() => setEditingId(null)} className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] font-bold rounded transition">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs font-bold text-white truncate" title={card.name}>{card.name}</div>
                    {card.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {card.tags.map(t => (
                          <span key={t} className="text-[9px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded font-bold">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1 pt-0.5">
                      <button
                        onClick={() => startEdit(card)}
                        className="flex-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-[10px] font-bold rounded transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(card.image_url)}
                        title="Copy image URL"
                        className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px] font-bold rounded transition"
                      >
                        URL
                      </button>
                      <button
                        onClick={() => deleteCard(card.id, card.name)}
                        className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[10px] font-bold rounded transition"
                      >
                        ✕
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
