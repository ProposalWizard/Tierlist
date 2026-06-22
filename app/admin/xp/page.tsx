"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FRAME_STYLES, xpForLevel, cumulativeXpForLevel, XP_AWARDS } from "@/lib/xp";

interface RewardRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  rarity: string;
  icon_name: string | null;
  unlock_type: string;
  unlock_stat: string | null;
  unlock_value: number | null;
  sort_order: number;
}

type Tab = "rewards" | "xp-curve" | "xp-awards";

export default function AdminXPPage() {
  const [tab, setTab] = useState<Tab>("rewards");
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RewardRow>>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<Partial<RewardRow>>({
    id: "",
    name: "",
    description: "",
    category: "frame",
    rarity: "bronze",
    icon_name: "",
    unlock_type: "level",
    unlock_stat: "level",
    unlock_value: 1,
    sort_order: 100,
  });

  useEffect(() => {
    fetchRewards();
  }, []);

  async function fetchRewards() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/xp/rewards");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRewards(data.rewards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }

  async function saveReward(id: string, updates: Partial<RewardRow>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/xp/rewards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Save failed");
      }
      setEditingId(null);
      await fetchRewards();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  }

  async function createReward() {
    if (!newForm.id || !newForm.name) {
      setError("ID and Name are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/xp/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Create failed");
      }
      setAddingNew(false);
      setNewForm({
        id: "", name: "", description: "", category: "frame", rarity: "bronze",
        icon_name: "", unlock_type: "level", unlock_stat: "level", unlock_value: 1, sort_order: 100,
      });
      await fetchRewards();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
    setSaving(false);
  }

  async function deleteReward(id: string) {
    if (!confirm(`Delete reward "${id}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/xp/rewards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Delete failed");
      await fetchRewards();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
    setSaving(false);
  }

  const frameRewards = rewards.filter((r) => r.category === "frame");
  const titleRewards = rewards.filter((r) => r.category === "title");
  const trophyRewards = rewards.filter((r) => r.category === "trophy");

  const tabs: { key: Tab; label: string }[] = [
    { key: "rewards", label: "Rewards" },
    { key: "xp-curve", label: "XP Curve" },
    { key: "xp-awards", label: "XP Awards" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-white">
          <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
          <span>/</span>
          <span className="text-white font-bold">XP & Rewards</span>
        </div>

        <h1 className="text-2xl font-black mb-2">XP & Rewards Management</h1>
        <p className="text-sm text-white mb-6">
          Configure level rewards, XP curve, and award amounts.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-800/50">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 text-xs font-bold tracking-wide transition-all rounded-t-lg ${
                tab === t.key
                  ? "text-amber-400 bg-gray-900 border border-gray-800/50 border-b-transparent -mb-px"
                  : "text-white hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {tab === "rewards" && (
          <div className="space-y-6">
            {/* Add new button */}
            <div className="flex justify-end">
              <button
                onClick={() => setAddingNew(!addingNew)}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-bold hover:bg-emerald-500 transition-colors"
              >
                {addingNew ? "Cancel" : "+ Add Reward"}
              </button>
            </div>

            {/* Add new form */}
            {addingNew && (
              <RewardForm
                form={newForm}
                onChange={setNewForm}
                onSave={createReward}
                saving={saving}
                isNew
              />
            )}

            {loading ? (
              <div className="py-12 text-center text-white">Loading rewards...</div>
            ) : (
              <>
                {/* Card Frames */}
                <RewardSection
                  title="Card Frames"
                  subtitle="Collection cards unlocked at specific levels"
                  rewards={frameRewards}
                  editingId={editingId}
                  editForm={editForm}
                  onStartEdit={(r) => { setEditingId(r.id); setEditForm(r); }}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(id) => saveReward(id, editForm)}
                  onDelete={deleteReward}
                  onEditChange={setEditForm}
                  saving={saving}
                  showImage
                />

                {/* Titles */}
                <RewardSection
                  title="Manager Titles"
                  subtitle="Title rewards unlocked at milestones"
                  rewards={titleRewards}
                  editingId={editingId}
                  editForm={editForm}
                  onStartEdit={(r) => { setEditingId(r.id); setEditForm(r); }}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(id) => saveReward(id, editForm)}
                  onDelete={deleteReward}
                  onEditChange={setEditForm}
                  saving={saving}
                />

                {/* Trophies */}
                <RewardSection
                  title="Trophies"
                  subtitle="Achievement trophies unlocked by stats"
                  rewards={trophyRewards}
                  editingId={editingId}
                  editForm={editForm}
                  onStartEdit={(r) => { setEditingId(r.id); setEditForm(r); }}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(id) => saveReward(id, editForm)}
                  onDelete={deleteReward}
                  onEditChange={setEditForm}
                  saving={saving}
                />
              </>
            )}
          </div>
        )}

        {tab === "xp-curve" && <XPCurveTab />}
        {tab === "xp-awards" && <XPAwardsTab />}
      </div>
    </div>
  );
}

function RewardSection({
  title,
  subtitle,
  rewards,
  editingId,
  editForm,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onEditChange,
  saving,
  showImage,
}: {
  title: string;
  subtitle: string;
  rewards: RewardRow[];
  editingId: string | null;
  editForm: Partial<RewardRow>;
  onStartEdit: (r: RewardRow) => void;
  onCancelEdit: () => void;
  onSave: (id: string) => void;
  onDelete: (id: string) => void;
  onEditChange: (f: Partial<RewardRow>) => void;
  saving: boolean;
  showImage?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 bg-gray-900/80">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <p className="text-xs text-white mt-0.5">{subtitle}</p>
      </div>
      <div className="divide-y divide-gray-800/50">
        {rewards.length === 0 && (
          <div className="px-5 py-6 text-center text-white text-sm">No rewards in this category</div>
        )}
        {rewards.map((r) => {
          const isEditing = editingId === r.id;
          const frameStyle = showImage ? (FRAME_STYLES[r.id] ?? null) : null;

          return (
            <div key={r.id} className="px-5 py-3">
              {isEditing ? (
                <RewardForm
                  form={editForm}
                  onChange={onEditChange}
                  onSave={() => onSave(r.id)}
                  onCancel={onCancelEdit}
                  saving={saving}
                />
              ) : (
                <div className="flex items-center gap-4">
                  {/* Image preview for frames */}
                  {frameStyle?.image && (
                    <div className="relative w-10 h-14 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                      <Image src={frameStyle.image} alt={r.name} fill className="object-cover" sizes="40px" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{r.name}</span>
                      <span className="text-[10px] text-white font-mono">{r.id}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-white">
                      <span className={`font-bold ${rarityColor(r.rarity)}`}>{r.rarity}</span>
                      <span>
                        {r.unlock_type === "level" ? `Level ${r.unlock_value}` : `${r.unlock_value} ${r.unlock_stat}`}
                      </span>
                      <span className="text-white">order: {r.sort_order}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => onStartEdit(r)}
                      className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-white hover:text-white rounded-lg font-bold transition-colors border border-gray-700/50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(r.id)}
                      className="px-3 py-1.5 text-xs bg-red-900/30 hover:bg-red-700 text-red-400 hover:text-white rounded-lg font-bold transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RewardForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  form: Partial<RewardRow>;
  onChange: (f: Partial<RewardRow>) => void;
  onSave: () => void;
  onCancel?: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const set = (k: keyof RewardRow, v: string | number | null) => onChange({ ...form, [k]: v });

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {isNew && (
          <div>
            <label className="block text-[10px] font-bold text-white uppercase mb-1">ID</label>
            <input
              value={form.id ?? ""}
              onChange={(e) => set("id", e.target.value)}
              placeholder="frame_mythic"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
        )}
        <div>
          <label className="block text-[10px] font-bold text-white uppercase mb-1">Name</label>
          <input
            value={form.name ?? ""}
            onChange={(e) => set("name", e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-white uppercase mb-1">Category</label>
          <select
            value={form.category ?? "frame"}
            onChange={(e) => set("category", e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="frame">Frame</option>
            <option value="title">Title</option>
            <option value="trophy">Trophy</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-white uppercase mb-1">Rarity</label>
          <select
            value={form.rarity ?? "bronze"}
            onChange={(e) => set("rarity", e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="diamond">Diamond</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-white uppercase mb-1">Unlock Type</label>
          <select
            value={form.unlock_type ?? "level"}
            onChange={(e) => set("unlock_type", e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="level">Level</option>
            <option value="stat">Stat</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-white uppercase mb-1">Unlock Stat</label>
          <select
            value={form.unlock_stat ?? "level"}
            onChange={(e) => set("unlock_stat", e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="level">level</option>
            <option value="drafts_played">drafts_played</option>
            <option value="draft_wins">draft_wins</option>
            <option value="draft_invincibles">draft_invincibles</option>
            <option value="total_goals_scored">total_goals_scored</option>
            <option value="tierlists_created">tierlists_created</option>
            <option value="tierlists_likes_received">tierlists_likes_received</option>
            <option value="votes_cast">votes_cast</option>
            <option value="longest_streak">longest_streak</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-white uppercase mb-1">Unlock Value</label>
          <input
            type="number"
            value={form.unlock_value ?? ""}
            onChange={(e) => set("unlock_value", e.target.value ? parseInt(e.target.value) : null)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-white uppercase mb-1">Sort Order</label>
          <input
            type="number"
            value={form.sort_order ?? ""}
            onChange={(e) => set("sort_order", e.target.value ? parseInt(e.target.value) : 0)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-white uppercase mb-1">Description</label>
        <input
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value || null)}
          placeholder="Optional description"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-bold text-white disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : isNew ? "Create Reward" : "Save Changes"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-bold text-white transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function XPCurveTab() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800">
        <h2 className="text-sm font-bold text-white">XP Curve (Levels 1–50)</h2>
        <p className="text-xs text-white mt-0.5">
          Formula: <code className="text-amber-400">100 * level + 50 * (level - 1)</code> XP per level.
          Modify in <code className="text-white">lib/xp.ts → xpForLevel()</code>.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 border-b border-gray-800">
              <th className="px-4 py-2 text-left text-xs font-bold text-white">Level</th>
              <th className="px-4 py-2 text-right text-xs font-bold text-white">XP This Level</th>
              <th className="px-4 py-2 text-right text-xs font-bold text-white">Cumulative XP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/30">
            {Array.from({ length: 50 }, (_, i) => i + 1).map((lv) => {
              const xpThis = xpForLevel(lv);
              const cumulative = cumulativeXpForLevel(lv);
              const isMultipleOf5 = lv % 5 === 0 || lv === 1;
              return (
                <tr
                  key={lv}
                  className={isMultipleOf5 ? "bg-amber-950/10" : ""}
                >
                  <td className={`px-4 py-1.5 font-bold ${isMultipleOf5 ? "text-amber-400" : "text-white"}`}>
                    {lv}
                    {isMultipleOf5 && <span className="text-xs text-amber-600 ml-2">★</span>}
                  </td>
                  <td className="px-4 py-1.5 text-right text-white tabular-nums">
                    {lv <= 1 ? "—" : xpThis.toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right text-white tabular-nums font-medium">
                    {cumulative.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function XPAwardsTab() {
  const awards = Object.entries(XP_AWARDS) as [string, number][];
  const labels: Record<string, string> = {
    draft_complete: "Complete a Draft Season",
    draft_win: "Win the League Title",
    draft_invincible: "Invincible Season",
    tierlist_create: "Create a Tierlist",
    tierlist_likes_10: "Get 10 Likes on a Tierlist",
    vote_cast: "Cast a Vote",
    streak_7: "7-Day Login Streak",
    streak_30: "30-Day Login Streak",
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800">
        <h2 className="text-sm font-bold text-white">XP Award Amounts</h2>
        <p className="text-xs text-white mt-0.5">
          How much XP is awarded per activity. Modify in <code className="text-white">lib/xp.ts → XP_AWARDS</code>.
        </p>
      </div>
      <div className="divide-y divide-gray-800/30">
        {awards.sort(([, a], [, b]) => b - a).map(([key, xp]) => (
          <div key={key} className="flex items-center justify-between px-5 py-3">
            <div>
              <span className="text-sm text-white font-medium">{labels[key] ?? key}</span>
              <span className="text-xs text-white ml-2 font-mono">{key}</span>
            </div>
            <span className="text-sm font-black text-amber-400">+{xp} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function rarityColor(rarity: string): string {
  switch (rarity) {
    case "diamond": return "text-cyan-300";
    case "gold": return "text-amber-400";
    case "silver": return "text-white";
    default: return "text-orange-500";
  }
}
