"use client";
import { useState, useEffect, useCallback } from "react";
import CardLibraryPicker from "./CardLibraryPicker";
import type { LibraryCard } from "./CardLibraryPicker";

interface SeasonReward {
  id: string;
  season: number;
  level: number;
  card_library_id: string | null;
  card_name: string | null;
  subtitle: string | null;
  card_library: { id: string; name: string; image_url: string } | null;
}

interface SeasonConfig {
  season: number;
  name: string;
  total_levels: number;
}

export default function SeasonAdmin() {
  const [config, setConfig] = useState<SeasonConfig>({ season: 1, name: "Season 1", total_levels: 50 });
  const [rewards, setRewards] = useState<SeasonReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalLevelsInput, setTotalLevelsInput] = useState("50");
  const [savingConfig, setSavingConfig] = useState(false);

  // Level edit modal state
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [editCardName, setEditCardName] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editCardLibraryId, setEditCardLibraryId] = useState<string | null>(null);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/season-rewards");
    if (res.ok) {
      const data = await res.json();
      setConfig(data.config);
      setRewards(data.rewards ?? []);
      setTotalLevelsInput(String(data.config.total_levels));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rewardMap = Object.fromEntries(rewards.map(r => [r.level, r]));

  const handleSaveConfig = async () => {
    const n = parseInt(totalLevelsInput);
    if (!n || n < 1 || n > 500) { alert("Enter a number between 1 and 500"); return; }
    setSavingConfig(true);
    const res = await fetch("/api/admin/season-rewards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total_levels: n }),
    });
    if (res.ok) setConfig(c => ({ ...c, total_levels: n }));
    setSavingConfig(false);
  };

  const openEdit = (level: number) => {
    const existing = rewardMap[level];
    setEditingLevel(level);
    setEditCardName(existing?.card_name ?? "");
    setEditSubtitle(existing?.subtitle ?? "");
    setEditCardLibraryId(existing?.card_library_id ?? null);
    setEditImageUrl(existing?.card_library?.image_url ?? null);
  };

  const handleSaveLevel = async () => {
    if (editingLevel === null) return;
    setSaving(true);
    const res = await fetch("/api/admin/season-rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: editingLevel,
        card_library_id: editCardLibraryId,
        card_name: editCardName.trim() || null,
        subtitle: editSubtitle.trim() || null,
      }),
    });
    if (res.ok) { await load(); setEditingLevel(null); }
    setSaving(false);
  };

  const handleRemoveLevel = async (id: string) => {
    if (!window.confirm("Remove the card reward from this level?")) return;
    await fetch(`/api/admin/season-rewards?id=${id}`, { method: "DELETE" });
    await load();
    setEditingLevel(null);
  };

  const levels = Array.from({ length: config.total_levels }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Road to Legend — Season 1</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {rewards.length} of {config.total_levels} levels have card rewards. Click any level to assign a card.
          </p>
        </div>
      </div>

      {/* Season config */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Total Levels</label>
          <input
            type="number"
            min={1}
            max={500}
            value={totalLevelsInput}
            onChange={e => setTotalLevelsInput(e.target.value)}
            className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            onClick={handleSaveConfig}
            disabled={savingConfig}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
          >
            {savingConfig ? "Saving..." : "Update"}
          </button>
          <p className="text-xs text-gray-500">
            Players reach Legend status at Level {config.total_levels}. Only levels with a card assigned appear as milestones.
          </p>
        </div>
      </div>

      {/* Level grid */}
      {loading ? (
        <div className="text-gray-500 text-sm text-center py-12">Loading...</div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 gap-2">
          {levels.map(level => {
            const reward = rewardMap[level];
            const hasCard = !!reward?.card_library?.image_url;
            return (
              <button
                key={level}
                onClick={() => openEdit(level)}
                title={hasCard ? `Level ${level}: ${reward.card_name ?? "Card"}` : `Level ${level}: No card assigned`}
                className={`group flex flex-col items-center gap-1 p-1.5 rounded-xl border transition ${
                  hasCard
                    ? "border-amber-700/50 bg-gray-900 hover:border-amber-500/70"
                    : "border-gray-800 bg-gray-900/40 hover:border-gray-600"
                }`}
              >
                {/* Card image or placeholder */}
                <div className={`w-full aspect-[3/4] rounded-lg overflow-hidden relative ${hasCard ? "bg-gray-800" : "bg-gray-800/40"}`}>
                  {hasCard ? (
                    <img
                      src={reward.card_library!.image_url}
                      alt={reward.card_name ?? "Card"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-lg font-bold">+</div>
                  )}
                </div>
                {/* Level badge */}
                <span className={`text-[8px] font-black px-1 py-0.5 rounded leading-none ${
                  hasCard ? "bg-amber-500/20 text-amber-400" : "bg-gray-800 text-gray-600"
                }`}>
                  {level}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editingLevel !== null && !showLibraryPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setEditingLevel(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Level {editingLevel} Reward</h3>
              <button
                onClick={() => setEditingLevel(null)}
                className="text-gray-500 hover:text-white text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            {/* Card preview + choose button */}
            <div className="flex items-start gap-4">
              <div className="w-20 h-[107px] bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shrink-0 relative">
                {editImageUrl ? (
                  <img src={editImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-3xl">?</div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <button
                  onClick={() => setShowLibraryPicker(true)}
                  className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition"
                >
                  {editImageUrl ? "Change Card" : "Choose from Library"}
                </button>
                {editImageUrl && (
                  <button
                    onClick={() => { setEditImageUrl(null); setEditCardLibraryId(null); setEditCardName(""); }}
                    className="w-full px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs font-bold rounded-lg transition"
                  >
                    Clear card
                  </button>
                )}
              </div>
            </div>

            {/* Card name */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Card Name</label>
              <input
                type="text"
                value={editCardName}
                onChange={e => setEditCardName(e.target.value)}
                placeholder="e.g. Wayne Rooney"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Subtitle</label>
              <input
                type="text"
                value={editSubtitle}
                onChange={e => setEditSubtitle(e.target.value)}
                placeholder="e.g. Class of 1998"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[10px] text-gray-500 mt-1">Short text shown below the card name in the progress track</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveLevel}
                disabled={saving || !editCardLibraryId}
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-lg transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {rewardMap[editingLevel] && (
                <button
                  onClick={() => handleRemoveLevel(rewardMap[editingLevel].id)}
                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-sm rounded-lg transition"
                >
                  Remove
                </button>
              )}
              <button
                onClick={() => setEditingLevel(null)}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-sm rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showLibraryPicker && (
        <CardLibraryPicker
          onSelect={(card: LibraryCard) => {
            setEditImageUrl(card.image_url);
            setEditCardLibraryId(card.id);
            if (!editCardName.trim()) setEditCardName(card.name);
            setShowLibraryPicker(false);
          }}
          onClose={() => setShowLibraryPicker(false)}
        />
      )}
    </div>
  );
}
