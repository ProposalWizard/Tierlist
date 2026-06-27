"use client";
import { useState, useEffect, useCallback } from "react";
import type { ObjectiveCondition, Competition, ConditionType, WinEvent, StatScope, PositionMatch, Timeframe, MatchStat, WithinCompetition, SeasonStatType } from "@/lib/objectiveTypes";
import { WIN_EVENT_OPTIONS, CONDITION_TYPE_LABELS, MATCH_STAT_LABELS, SEASON_STAT_LABELS } from "@/lib/objectiveTypes";
import { conditionSummary } from "@/lib/objectiveEvaluator";
import CardLibraryPicker from "./CardLibraryPicker";
import type { LibraryCard } from "./CardLibraryPicker";
import SeasonAdmin from "./SeasonAdmin";

type ObjCategory = "standard" | "daily" | "weekly" | "monthly" | "foundation" | "elite" | "goat" | "record_breaker";

const CATEGORIES: { value: ObjCategory; label: string; icon: string; color: string; border: string; bg: string; hint: string }[] = [
  { value: "standard",       label: "Objectives",      icon: "🎯", color: "text-white",        border: "border-gray-600",       bg: "bg-gray-800",       hint: "Main objectives — shown to all players" },
  { value: "daily",          label: "Daily",           icon: "📅", color: "text-sky-400",     border: "border-sky-700/50",     bg: "bg-sky-900/20",     hint: "Resets daily" },
  { value: "weekly",         label: "Weekly",          icon: "📆", color: "text-violet-400",  border: "border-violet-700/50",  bg: "bg-violet-900/20",  hint: "Resets weekly" },
  { value: "monthly",        label: "Monthly",         icon: "🗓️", color: "text-pink-400",    border: "border-pink-700/50",    bg: "bg-pink-900/20",    hint: "Resets monthly" },
  { value: "foundation",     label: "Foundation",      icon: "🏗️", color: "text-emerald-400", border: "border-emerald-700/50", bg: "bg-emerald-900/20", hint: "Easy / beginner" },
  { value: "elite",          label: "Elite",           icon: "⚡", color: "text-blue-400",    border: "border-blue-700/50",    bg: "bg-blue-900/20",    hint: "Hard challenges" },
  { value: "goat",           label: "GOAT Manager",    icon: "🐐", color: "text-amber-400",   border: "border-amber-700/50",   bg: "bg-amber-900/20",   hint: "The hardest" },
  { value: "record_breaker", label: "Record Breakers", icon: "📋", color: "text-red-400",     border: "border-red-700/50",     bg: "bg-red-900/20",     hint: "Beat official PL records from the Hall of Fame" },
];

const CATEGORY_ORDER: ObjCategory[] = ["standard", "daily", "weekly", "monthly", "foundation", "elite", "goat", "record_breaker"];

interface Objective {
  id: string;
  title: string;
  description: string | null;
  xp_reward: number;
  card_image_url: string | null;
  card_name: string | null;
  category: ObjCategory;
  is_active: boolean;
  is_published: boolean;
  sort_order: number;
  expires_at: string | null;
  created_at: string;
  conditions: ObjectiveCondition[] | null;
  same_season?: boolean;
  same_player?: boolean;
  or_groups?: ObjectiveCondition[][] | null;
}

const DURATION_OPTIONS = [
  { label: "No Time Limit", days: 0 },
  { label: "1 Day", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "60 Days", days: 60 },
  { label: "90 Days", days: 90 },
];

function formatDeadline(expiresAt: string): string {
  const d = new Date(expiresAt);
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

function isStatType(t: ConditionType) {
  return t === "goals" || t === "assists" || t === "clean_sheets";
}

function hasPlayerFilters(t: ConditionType) {
  return isStatType(t) || t === "squad_count";
}

interface NewCondState {
  type: ConditionType;
  count: number;
  scope: StatScope;
  positionMatch: PositionMatch;
  timeframe: Timeframe;
  consecutive: boolean;
  competition: Competition;
  withinCompetition: WithinCompetition;
  nationality: string;
  club: string;
  position: string;
  event: WinEvent | "";
  matchStat: MatchStat;
  seasonStat: SeasonStatType;
  atMost: boolean;
  seasonCount: number;
  minAge: string;
  maxAge: string;
  minOvr: string;
  maxOvr: string;
  editingCondId: string | null;
}

const EMPTY_COND: NewCondState = {
  type: "goals",
  count: 1,
  scope: "squad_total",
  positionMatch: "assigned",
  timeframe: "career",
  consecutive: false,
  competition: "any",
  withinCompetition: "any",
  nationality: "",
  club: "",
  position: "",
  event: "",
  matchStat: "goals_scored",
  seasonStat: "wins",
  atMost: false,
  seasonCount: 1,
  minAge: "",
  maxAge: "",
  minOvr: "",
  maxOvr: "",
  editingCondId: null,
};

export default function ObjectivesAdmin() {
  const [subTab, setSubTab] = useState<"objectives" | "season">("objectives");
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    xp_reward: 100,
    card_name: "",
    category: "standard" as ObjCategory,
    is_published: false,
    expires_at: null as string | null,
    same_season: false,
    same_player: false,
  });
  const [conditions, setConditions] = useState<ObjectiveCondition[]>([]);
  const [orGroups, setOrGroups] = useState<ObjectiveCondition[][]>([]);
  const [addingCond, setAddingCond] = useState(false);
  const [activeOrGroupIdx, setActiveOrGroupIdx] = useState<number | null>(null);
  const [nc, setNc] = useState<NewCondState>({ ...EMPTY_COND });
  const [durationSelect, setDurationSelect] = useState("");
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const [cardLibraryUrl, setCardLibraryUrl] = useState<string | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadObjectives = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/objectives");
    if (res.ok) setObjectives(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadObjectives(); }, [loadObjectives]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ title: "", description: "", xp_reward: 100, card_name: "", category: "standard", is_published: false, expires_at: null, same_season: false, same_player: false });
    setConditions([]);
    setOrGroups([]);
    setAddingCond(false);
    setActiveOrGroupIdx(null);
    setNc({ ...EMPTY_COND });
    setDurationSelect("");
    setCardFile(null);
    setCardPreview(null);
    setCardLibraryUrl(null);
  };

  const handleEdit = (obj: Objective) => {
    setEditingId(obj.id);
    setForm({
      title: obj.title,
      description: obj.description || "",
      xp_reward: obj.xp_reward,
      card_name: obj.card_name || "",
      category: (obj.category as ObjCategory) ?? "standard",
      is_published: obj.is_published ?? false,
      expires_at: obj.expires_at,
      same_season: obj.same_season === true,
      same_player: obj.same_player === true,
    });
    setConditions(obj.conditions ?? []);
    setOrGroups(obj.or_groups ?? []);
    setAddingCond(false);
    setActiveOrGroupIdx(null);
    setNc({ ...EMPTY_COND });
    setDurationSelect("");
    setCardPreview(obj.card_image_url);
    setCardFile(null);
    setCardLibraryUrl(null);
  };

  const handleDurationChange = (val: string) => {
    setDurationSelect(val);
    const days = parseInt(val);
    if (!val || isNaN(days)) return;
    if (days === 0) {
      setForm(f => ({ ...f, expires_at: null }));
    } else {
      setForm(f => ({ ...f, expires_at: new Date(Date.now() + days * 86400000).toISOString() }));
    }
    setDurationSelect("");
  };

  const handleCardFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCardFile(file);
    const reader = new FileReader();
    reader.onload = () => setCardPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadCardImage = async (): Promise<string | null> => {
    if (!cardFile) return null;
    const formData = new FormData();
    formData.append("file", cardFile);
    const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
    if (!res.ok) {
      const { error } = await res.json();
      alert("Failed to upload card image: " + error);
      return null;
    }
    return (await res.json()).url;
  };

  const handleAddCondition = () => {
    if (nc.type === "win_event" && !nc.event) { alert("Select an event"); return; }

    const cond: ObjectiveCondition = {
      id: nc.editingCondId ?? crypto.randomUUID(),
      type: nc.type,
      count: nc.count,
      competition: nc.competition || "any",
    };

    if (isStatType(nc.type)) {
      cond.scope = nc.scope;
      cond.timeframe = nc.timeframe;
      if (nc.withinCompetition !== "any") cond.withinCompetition = nc.withinCompetition;
    }

    if (hasPlayerFilters(nc.type)) {
      if (nc.nationality.trim()) cond.nationality = nc.nationality.trim();
      if (nc.club.trim()) cond.club = nc.club.trim();
      if (nc.position.trim()) {
        cond.position = nc.position.trim().toUpperCase();
        cond.positionMatch = nc.positionMatch;
      }
      const minAge = parseInt(nc.minAge);
      const maxAge = parseInt(nc.maxAge);
      const minOvr = parseInt(nc.minOvr);
      const maxOvr = parseInt(nc.maxOvr);
      if (!isNaN(minAge) && minAge > 0) cond.minAge = minAge;
      if (!isNaN(maxAge) && maxAge > 0) cond.maxAge = maxAge;
      if (!isNaN(minOvr) && minOvr > 0) cond.minOvr = minOvr;
      if (!isNaN(maxOvr) && maxOvr > 0) cond.maxOvr = maxOvr;
    }

    if (nc.type === "win_event") {
      cond.event = nc.event as WinEvent;
      if (nc.consecutive) cond.consecutive = true;
    }

    if (nc.type === "single_match") {
      cond.matchStat = nc.matchStat;
    }

    if (nc.type === "login_streak") {
      cond.timeframe = nc.timeframe;
    }

    if (nc.type === "season_stat") {
      cond.seasonStat = nc.seasonStat;
      if (nc.atMost) cond.atMost = true;
      if (nc.withinCompetition !== "any") cond.withinCompetition = nc.withinCompetition;
      if ((nc.seasonCount ?? 1) > 1) cond.seasonCount = nc.seasonCount;
    }

    if (activeOrGroupIdx !== null) {
      // Add to the active OR group
      setOrGroups(prev => prev.map((g, i) =>
        i === activeOrGroupIdx ? [...g, cond] : g
      ));
      setNc({ ...EMPTY_COND });
      setActiveOrGroupIdx(null);
    } else if (nc.editingCondId) {
      setConditions(prev => prev.map(c => c.id === nc.editingCondId ? cond : c));
      setNc({ ...EMPTY_COND });
      setAddingCond(false);
    } else {
      setConditions(prev => [...prev, cond]);
      setNc({ ...EMPTY_COND });
      setAddingCond(false);
    }
  };

  const handleEditCondition = (cond: ObjectiveCondition) => {
    setNc({
      type: cond.type,
      count: cond.count,
      scope: cond.scope ?? "squad_total",
      positionMatch: cond.positionMatch ?? "assigned",
      timeframe: cond.timeframe ?? (cond.type === "squad_count" ? "season" : "career"),
      consecutive: cond.consecutive ?? false,
      competition: cond.competition ?? "any",
      withinCompetition: cond.withinCompetition ?? "any",
      nationality: cond.nationality ?? "",
      club: cond.club ?? "",
      position: cond.position ?? "",
      event: (cond.event ?? "") as WinEvent | "",
      matchStat: cond.matchStat ?? "goals_scored",
      seasonStat: cond.seasonStat ?? "wins",
      atMost: cond.atMost ?? false,
      seasonCount: cond.seasonCount ?? 1,
      minAge: cond.minAge != null ? String(cond.minAge) : "",
      maxAge: cond.maxAge != null ? String(cond.maxAge) : "",
      minOvr: cond.minOvr != null ? String(cond.minOvr) : "",
      maxOvr: cond.maxOvr != null ? String(cond.maxOvr) : "",
      editingCondId: cond.id,
    });
    setAddingCond(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { alert("Title is required"); return; }
    setSaving(true);
    let card_image_url = editingId
      ? objectives.find(o => o.id === editingId)?.card_image_url ?? null
      : null;
    if (cardFile) {
      const uploaded = await uploadCardImage();
      if (uploaded) card_image_url = uploaded;
    } else if (cardLibraryUrl) {
      card_image_url = cardLibraryUrl;
    }
    const body = {
      ...(editingId ? { id: editingId } : {}),
      title: form.title.trim(),
      description: form.description.trim() || null,
      xp_reward: form.xp_reward,
      card_image_url,
      card_name: form.card_name.trim() || null,
      category: form.category,
      is_active: true,
      is_published: form.is_published,
      expires_at: form.expires_at,
      same_season: form.same_season,
      same_player: form.same_player,
      or_groups: orGroups.length > 0 ? orGroups : null,
      sort_order: editingId
        ? objectives.find(o => o.id === editingId)?.sort_order ?? 0
        : objectives.length,
      conditions,
    };
    const res = await fetch("/api/admin/objectives", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { resetForm(); loadObjectives(); }
    else alert("Failed to save: " + await res.text());
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this objective?")) return;
    await fetch(`/api/admin/objectives?id=${id}`, { method: "DELETE" });
    loadObjectives();
  };

  const availableEvents = WIN_EVENT_OPTIONS.filter(o => o.available);
  const futureEvents = WIN_EVENT_OPTIONS.filter(o => !o.available);

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 self-start w-fit">
        <button
          onClick={() => setSubTab("objectives")}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${subTab === "objectives" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"}`}
        >
          Objectives {subTab === "objectives" && !loading ? `(${objectives.length})` : ""}
        </button>
        <button
          onClick={() => setSubTab("season")}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${subTab === "season" ? "bg-amber-600 text-white" : "text-gray-400 hover:text-white"}`}
        >
          Season 1
        </button>
      </div>

      {subTab === "season" && <SeasonAdmin />}

      {subTab === "objectives" && <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          Objectives {!loading && `(${objectives.length})`}
        </h2>
      </div>

      {/* Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white">
          {editingId ? "Edit Objective" : "Add New Objective"}
        </h3>

        {/* Category */}
        <div>
          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  form.category === cat.value
                    ? `${cat.color} ${cat.border} ${cat.bg}`
                    : "text-gray-500 border-gray-700 bg-gray-800 hover:text-gray-300"
                }`}
              >
                <span>{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>
          {CATEGORIES.find(c => c.value === form.category) && (
            <p className="text-[10px] text-gray-500 mt-1">{CATEGORIES.find(c => c.value === form.category)!.hint}</p>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. The French Connection"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">Description (optional)</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="e.g. Score 30 goals with French players and win the Premier League"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        {/* XP + Published */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">XP Reward</label>
            <input
              type="number"
              value={form.xp_reward}
              onChange={e => setForm(f => ({ ...f, xp_reward: parseInt(e.target.value) || 0 }))}
              min={0}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-gray-500 mt-1">0 = hidden from users</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">Status</label>
            <button
              onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${form.is_published ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}`}
            >
              {form.is_published ? "Published" : "Draft"}
            </button>
            <p className="text-[10px] text-gray-500 mt-1">Draft = invisible to players until you publish</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">Same Season</label>
            <button
              onClick={() => setForm(f => ({ ...f, same_season: !f.same_season }))}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${form.same_season ? "bg-amber-600 text-white" : "bg-gray-700 text-gray-400"}`}
            >
              {form.same_season ? "Same Season" : "Any Time"}
            </button>
            <p className="text-[10px] text-gray-500 mt-1">Same Season = ALL conditions must be met in a single season (e.g. Treble)</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">Same Player</label>
            <button
              onClick={() => setForm(f => ({ ...f, same_player: !f.same_player }))}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${form.same_player ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400"}`}
            >
              {form.same_player ? "Same Player" : "Any Player(s)"}
            </button>
            <p className="text-[10px] text-gray-500 mt-1">Same Player = all "any player" stat conditions must be met by one individual (e.g. 20G + 20A by the same player)</p>
          </div>
        </div>

        {/* Time Limit */}
        <div>
          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">Time Limit</label>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={durationSelect}
              onChange={e => handleDurationChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Set duration —</option>
              {DURATION_OPTIONS.map(opt => <option key={opt.days} value={opt.days}>{opt.label}</option>)}
            </select>
            {form.expires_at ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-400 font-bold">{formatDeadline(form.expires_at)}</span>
                <span className="text-[10px] text-gray-500">({new Date(form.expires_at).toLocaleDateString()})</span>
                <button
                  onClick={() => { setForm(f => ({ ...f, expires_at: null })); setDurationSelect(""); }}
                  className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-0.5 bg-red-500/10 rounded transition"
                >
                  Clear
                </button>
              </div>
            ) : (
              <span className="text-xs text-gray-500">No time limit</span>
            )}
          </div>
        </div>

        {/* Card Reward */}
        <div>
          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">Card Reward (optional)</label>
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={form.card_name}
                onChange={e => setForm(f => ({ ...f, card_name: e.target.value }))}
                placeholder="Card name (e.g. Wayne Rooney)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowLibraryPicker(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition"
                >
                  Choose from Library
                </button>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleCardFileChange} className="hidden" />
                  <span className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 hover:text-white hover:border-gray-500 transition cursor-pointer">
                    Upload New Image
                  </span>
                </label>
              </div>
            </div>
            {cardPreview && (
              <div className="relative shrink-0">
                <img src={cardPreview} alt="Card preview" className="w-20 h-28 object-cover rounded-lg border border-gray-700" />
                <button
                  onClick={() => { setCardFile(null); setCardPreview(null); setCardLibraryUrl(null); }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold hover:bg-red-500"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card Library Picker modal */}
        {showLibraryPicker && (
          <CardLibraryPicker
            onSelect={(card: LibraryCard) => {
              setCardLibraryUrl(card.image_url);
              setCardPreview(card.image_url);
              setCardFile(null);
              if (!form.card_name.trim()) setForm(f => ({ ...f, card_name: card.name }));
              setShowLibraryPicker(false);
            }}
            onClose={() => setShowLibraryPicker(false)}
          />
        )}

        {/* ───── CONDITIONS ───── */}
        <div>
          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">
            Conditions
            <span className="text-gray-500 font-normal normal-case ml-2">All conditions must be met to complete</span>
          </label>

          {/* Existing conditions list */}
          {conditions.length > 0 && (
            <div className="space-y-1 mb-3">
              {conditions.map((cond, i) => (
                <div key={cond.id} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-gray-500 shrink-0">{i + 1}.</span>
                    <span className="text-xs text-white truncate">{conditionSummary(cond)}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEditCondition(cond)}
                      className="text-blue-400 hover:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 bg-blue-500/10 rounded transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConditions(prev => prev.filter(c => c.id !== cond.id))}
                      className="text-red-400 hover:text-red-300 text-sm font-bold leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {conditions.length === 0 && !addingCond && (
            <p className="text-xs text-gray-500 mb-3">No conditions — objective must be completed manually.</p>
          )}

          {/* Add condition form */}
          {addingCond ? (
            <div className="bg-gray-800 border border-emerald-800/50 rounded-lg p-4 space-y-3">

              {/* Row 1: Type */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Condition type</label>
                <select
                  value={nc.type}
                  onChange={e => {
                    const t = e.target.value as ConditionType;
                    setNc({ ...EMPTY_COND, type: t, timeframe: t === "squad_count" ? "season" : "career", count: t === "login_streak" ? 7 : 1 });
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  {(Object.keys(CONDITION_TYPE_LABELS) as ConditionType[]).map(t => (
                    <option key={t} value={t}>{CONDITION_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {/* Row 2: Count + Scope (for stat types) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    {nc.type === "squad_count" ? "Minimum players"
                      : nc.type === "win_event" ? "How many times"
                      : nc.type === "single_match" ? (nc.matchStat === "win_margin" ? "Min win margin (goals)" : "Min goals in one match")
                      : nc.type === "login_streak" ? "Days in a row"
                      : nc.type === "season_stat" ? (nc.atMost ? "Max value (at most)" : "Min value (at least)")
                      : "Target count"}
                  </label>
                  <input
                    type="number"
                    value={nc.count}
                    onChange={e => setNc(n => ({ ...n, count: parseInt(e.target.value) || 1 }))}
                    min={1}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                {isStatType(nc.type) && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Who counts?</label>
                    <select
                      value={nc.scope}
                      onChange={e => setNc(n => ({ ...n, scope: e.target.value as StatScope }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="squad_total">All matching players combined</option>
                      <option value="any_player">One single player must reach it</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Scope explanation */}
              {isStatType(nc.type) && (
                <p className="text-[10px] text-gray-500 -mt-1">
                  {nc.scope === "squad_total"
                    ? `Total ${nc.type === "clean_sheets" ? "clean sheets" : nc.type} across all matching players in your squad are added together.`
                    : `A single player matching the filters below must individually reach ${nc.count} ${nc.type === "clean_sheets" ? "clean sheets" : nc.type}.`}
                </p>
              )}

              {/* Timeframe (stats only) */}
              {isStatType(nc.type) && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Timeframe</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNc(n => ({ ...n, timeframe: "career" }))}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition ${nc.timeframe === "career" ? "bg-emerald-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                    >
                      Career total (all drafts)
                    </button>
                    <button
                      onClick={() => setNc(n => ({ ...n, timeframe: "season" }))}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition ${nc.timeframe === "season" ? "bg-emerald-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                    >
                      In one season
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {nc.timeframe === "career"
                      ? "Accumulates across every draft you play. E.g. score 500 goals total across all drafts forever."
                      : "Must happen within a single season. E.g. score 35 goals in one PL season."}
                  </p>
                </div>
              )}

              {/* Within-competition filter — stat types only */}
              {isStatType(nc.type) && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Counts in</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNc(n => ({ ...n, withinCompetition: "any" }))}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition ${nc.withinCompetition === "any" ? "bg-emerald-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                    >
                      All competitions
                    </button>
                    <button
                      onClick={() => setNc(n => ({ ...n, withinCompetition: "pl_only" }))}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition ${nc.withinCompetition === "pl_only" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                    >
                      Premier League only
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {nc.withinCompetition === "pl_only"
                      ? "Only Premier League stats count — FA Cup, UCL, UEL goals/assists etc. are excluded."
                      : "Stats from all competitions (PL + FA Cup + UCL/UEL) count together."}
                  </p>
                </div>
              )}

              {/* Win event selector */}
              {nc.type === "win_event" && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Event</label>
                  <select
                    value={nc.event}
                    onChange={e => {
                      const ev = e.target.value as WinEvent;
                      const opt = WIN_EVENT_OPTIONS.find(o => o.value === ev);
                      setNc(n => ({ ...n, event: ev }));
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="">— Select event —</option>
                    <optgroup label="Champions League">
                      {availableEvents.filter(o => o.competition === "cl_draft").map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Premier League">
                      {availableEvents.filter(o => o.competition === "pl_draft").map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="General">
                      {availableEvents.filter(o => o.competition === "any").map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                    {futureEvents.length > 0 && (
                      <optgroup label="Coming Soon (not yet simulated)">
                        {futureEvents.map(o => (
                          <option key={o.value} value={o.value} disabled>{o.label}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              {/* Single-match stat selector */}
              {nc.type === "single_match" && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">What to achieve</label>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.keys(MATCH_STAT_LABELS) as MatchStat[]).map(ms => (
                      <button
                        key={ms}
                        onClick={() => setNc(n => ({ ...n, matchStat: ms }))}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition ${nc.matchStat === ms ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                      >
                        {MATCH_STAT_LABELS[ms]}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {nc.matchStat === "goals_scored"
                      ? `Score ${nc.count} or more goals in a single match. Tracks your best-ever game across all seasons.`
                      : `Win a match by ${nc.count} or more goals (e.g. ${nc.count}-0 or ${nc.count + 1}-1). Tracks your biggest-ever win margin.`}
                  </p>
                </div>
              )}

              {/* Login streak timeframe */}
              {nc.type === "login_streak" && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Which streak?</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNc(n => ({ ...n, timeframe: "season" }))}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition ${nc.timeframe === "season" ? "bg-orange-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                    >
                      Current streak
                    </button>
                    <button
                      onClick={() => setNc(n => ({ ...n, timeframe: "career" }))}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition ${nc.timeframe === "career" ? "bg-orange-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                    >
                      Longest ever streak
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {nc.timeframe === "season"
                      ? `Player must currently have a ${nc.count}-day login streak active right now.`
                      : `Player must have achieved a ${nc.count}-day streak at some point (even if broken now).`}
                  </p>
                </div>
              )}

              {/* Season stat selector */}
              {nc.type === "season_stat" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Which stat?</label>
                    <select
                      value={nc.seasonStat}
                      onChange={e => setNc(n => ({ ...n, seasonStat: e.target.value as SeasonStatType, atMost: false }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      {(Object.keys(SEASON_STAT_LABELS) as SeasonStatType[]).map(s => (
                        <option key={s} value={s}>{SEASON_STAT_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                  {(nc.seasonStat === "goals_conceded" || nc.seasonStat === "losses") && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nc.atMost}
                        onChange={e => setNc(n => ({ ...n, atMost: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-white font-bold">&ldquo;At most&rdquo; mode</span>
                      <span className="text-[10px] text-gray-500">
                        {nc.seasonStat === "goals_conceded"
                          ? `Concede ${nc.count} or fewer goals (for least goals conceded records)`
                          : `Lose ${nc.count} or fewer matches (for fewest defeats records)`}
                      </span>
                    </label>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Counts in</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNc(n => ({ ...n, withinCompetition: "any" }))}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition ${nc.withinCompetition === "any" ? "bg-emerald-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                      >
                        All competitions
                      </button>
                      <button
                        onClick={() => setNc(n => ({ ...n, withinCompetition: "pl_only" }))}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition ${nc.withinCompetition === "pl_only" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                      >
                        PL only
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Season stats always track across the whole PL season. &ldquo;PL only&rdquo; excludes FA Cup / UCL / UEL matches.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Spans how many seasons?</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setNc(prev => ({ ...prev, seasonCount: n }))}
                          className={`px-3 py-1.5 rounded text-xs font-bold transition ${(nc.seasonCount ?? 1) === n ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                        >
                          {n === 1 ? "1 (single)" : n === 5 ? "5 (career)" : n}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {(nc.seasonCount ?? 1) === 1
                        ? "Stat is measured within a single season."
                        : `Stat aggregates across ${nc.seasonCount} consecutive seasons. Streaks can span season boundaries.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Consecutive toggle (win_event only, count > 1) */}
              {nc.type === "win_event" && nc.count > 1 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nc.consecutive}
                    onChange={e => setNc(n => ({ ...n, consecutive: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-white font-bold">Must be consecutive seasons</span>
                  <span className="text-[10px] text-gray-500">(streak resets if you fail a season)</span>
                </label>
              )}

              {/* Competition scope — not relevant for login_streak or season_stat */}
              {nc.type !== "login_streak" && nc.type !== "season_stat" && (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Competition scope</label>
                <select
                  value={nc.competition}
                  onChange={e => setNc(n => ({ ...n, competition: e.target.value as Competition }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="any">Any competition</option>
                  <option value="pl_draft">PL Draft only</option>
                  <option value="cl_draft">CL Draft only</option>
                </select>
              </div>
              )}

              {/* Player filters (stat types + squad_count) */}
              {hasPlayerFilters(nc.type) && (
                <div className="border-t border-gray-700 pt-3">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Player filters (all optional — leave blank for any player)</label>
                  <p className="text-[10px] text-amber-400/80 mb-2">
                    Matching is case-insensitive and partial. <span className="font-bold">Comma-separated</span> values work as OR —
                    e.g. &quot;France, Germany, Brazil&quot; matches any of those.
                    Use the <span className="font-bold">country name</span>, not the adjective —
                    type <span className="font-bold">France</span> not French,{" "}
                    <span className="font-bold">Germany</span> not German.
                    Club is the one that came up on the spin wheel (SoFIFA spelling).
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Nationality</label>
                      <input
                        type="text"
                        value={nc.nationality}
                        onChange={e => setNc(n => ({ ...n, nationality: e.target.value }))}
                        placeholder="e.g. France, Germany, Brazil"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Club spun on the wheel</label>
                      <input
                        type="text"
                        value={nc.club}
                        onChange={e => setNc(n => ({ ...n, club: e.target.value }))}
                        placeholder="e.g. Arsenal, Chelsea"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Position</label>
                      <input
                        type="text"
                        value={nc.position}
                        onChange={e => setNc(n => ({ ...n, position: e.target.value }))}
                        placeholder="e.g. ST, GK, CM"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Age and OVR filters */}
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Min age</label>
                      <input
                        type="number"
                        value={nc.minAge}
                        onChange={e => setNc(n => ({ ...n, minAge: e.target.value }))}
                        placeholder="e.g. 30"
                        min={1}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Max age</label>
                      <input
                        type="number"
                        value={nc.maxAge}
                        onChange={e => setNc(n => ({ ...n, maxAge: e.target.value }))}
                        placeholder="e.g. 21"
                        min={1}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Min OVR</label>
                      <input
                        type="number"
                        value={nc.minOvr}
                        onChange={e => setNc(n => ({ ...n, minOvr: e.target.value }))}
                        placeholder="e.g. 85"
                        min={1}
                        max={99}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Max OVR</label>
                      <input
                        type="number"
                        value={nc.maxOvr}
                        onChange={e => setNc(n => ({ ...n, maxOvr: e.target.value }))}
                        placeholder="e.g. 75"
                        min={1}
                        max={99}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Position match type — only shown when position is filled */}
                  {nc.position.trim() && (
                    <div className="mt-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">What does &quot;{nc.position.trim().toUpperCase()}&quot; mean?</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setNc(n => ({ ...n, positionMatch: "assigned" }))}
                          className={`px-3 py-1.5 rounded text-xs font-bold transition ${nc.positionMatch === "assigned" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                        >
                          Playing position
                        </button>
                        <button
                          onClick={() => setNc(n => ({ ...n, positionMatch: "natural" }))}
                          className={`px-3 py-1.5 rounded text-xs font-bold transition ${nc.positionMatch === "natural" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                        >
                          Natural position
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {nc.positionMatch === "assigned"
                          ? "The slot they're placed in your formation. A ST who you play at CAM counts as CAM."
                          : "Any position listed on the player's card. A player with ST, CF, LW counts as all three regardless of where you play them."}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Live preview */}
              {(nc.type !== "win_event" || nc.event) && (
                <div className="bg-gray-900 rounded-lg px-3 py-2 border border-gray-700">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Preview: </span>
                  <span className="text-xs text-emerald-400 font-bold">
                    {conditionSummary({
                      id: "preview",
                      type: nc.type,
                      count: nc.count,
                      scope: isStatType(nc.type) ? nc.scope : undefined,
                      positionMatch: nc.position.trim() ? nc.positionMatch : undefined,
                      timeframe: (isStatType(nc.type) || nc.type === "login_streak") ? nc.timeframe : undefined,
                      consecutive: nc.type === "win_event" && nc.count > 1 ? nc.consecutive : undefined,
                      competition: nc.type !== "login_streak" && nc.type !== "season_stat" ? (nc.competition || "any") : undefined,
                      ...(isStatType(nc.type) && nc.withinCompetition !== "any" ? { withinCompetition: nc.withinCompetition } : {}),
                      ...(nc.nationality.trim() ? { nationality: nc.nationality.trim() } : {}),
                      ...(nc.club.trim() ? { club: nc.club.trim() } : {}),
                      ...(nc.position.trim() ? { position: nc.position.trim().toUpperCase() } : {}),
                      ...(nc.type === "win_event" && nc.event ? { event: nc.event as WinEvent } : {}),
                      ...(nc.type === "single_match" ? { matchStat: nc.matchStat } : {}),
                      ...(nc.type === "season_stat" ? { seasonStat: nc.seasonStat, atMost: nc.atMost, withinCompetition: nc.withinCompetition, seasonCount: nc.seasonCount ?? 1 } : {}),
                      ...(nc.minAge && parseInt(nc.minAge) > 0 ? { minAge: parseInt(nc.minAge) } : {}),
                      ...(nc.maxAge && parseInt(nc.maxAge) > 0 ? { maxAge: parseInt(nc.maxAge) } : {}),
                      ...(nc.minOvr && parseInt(nc.minOvr) > 0 ? { minOvr: parseInt(nc.minOvr) } : {}),
                      ...(nc.maxOvr && parseInt(nc.maxOvr) > 0 ? { maxOvr: parseInt(nc.maxOvr) } : {}),
                    })}
                  </span>
                </div>
              )}

              {/* Add / Cancel */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAddCondition}
                  disabled={nc.type === "win_event" && !nc.event}
                  className={`px-4 py-1.5 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 ${nc.editingCondId ? "bg-blue-600 hover:bg-blue-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
                >
                  {nc.editingCondId ? "Update Condition" : "Add Condition"}
                </button>
                <button
                  onClick={() => { setAddingCond(false); setNc({ ...EMPTY_COND }); }}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-bold rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingCond(true)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-bold text-gray-300 hover:text-white rounded-lg transition"
            >
              + Add Condition
            </button>
          )}
        </div>

        {/* ───── OR GROUPS ───── */}
        <div>
          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">
            OR Groups
            <span className="text-gray-500 font-normal normal-case ml-2">At least one condition in each group must be met</span>
          </label>

          {orGroups.map((group, gi) => (
            <div key={gi} className="mb-3 border border-purple-800/40 rounded-lg p-3 bg-purple-900/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Group {gi + 1} — any one of:</span>
                <button
                  onClick={() => { setOrGroups(prev => prev.filter((_, i) => i !== gi)); if (activeOrGroupIdx === gi) setActiveOrGroupIdx(null); }}
                  className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-0.5 bg-red-500/10 rounded transition"
                >
                  Remove Group
                </button>
              </div>

              {group.length === 0 && (
                <p className="text-xs text-gray-500 mb-2">No conditions yet — add at least two.</p>
              )}

              <div className="space-y-1 mb-2">
                {group.map((cond, ci) => (
                  <div key={cond.id} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-purple-400 shrink-0">○</span>
                      <span className="text-xs text-white truncate">{conditionSummary(cond)}</span>
                    </div>
                    <button
                      onClick={() => setOrGroups(prev => prev.map((g, i) => i === gi ? g.filter((_, j) => j !== ci) : g))}
                      className="text-red-400 hover:text-red-300 text-sm font-bold leading-none shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {activeOrGroupIdx === gi ? (
                <div className="bg-gray-800 border border-purple-700/50 rounded-lg p-3 mt-2">
                  <p className="text-[10px] font-bold text-purple-400 uppercase mb-2">Adding condition to Group {gi + 1}</p>
                  <div className="space-y-2">
                    <select
                      value={nc.type}
                      onChange={e => { const t = e.target.value as ConditionType; setNc({ ...EMPTY_COND, type: t, timeframe: t === "squad_count" ? "season" : "career", count: t === "login_streak" ? 7 : 1 }); }}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      {(Object.keys(CONDITION_TYPE_LABELS) as ConditionType[]).map(t => (
                        <option key={t} value={t}>{CONDITION_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                    {nc.type === "win_event" && (
                      <select
                        value={nc.event}
                        onChange={e => setNc(n => ({ ...n, event: e.target.value as WinEvent | "" }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                      >
                        <option value="">— Select event —</option>
                        {availableEvents.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    )}
                    {nc.type !== "win_event" && (
                      <input
                        type="number"
                        value={nc.count}
                        onChange={e => setNc(n => ({ ...n, count: parseInt(e.target.value) || 1 }))}
                        min={1}
                        placeholder="Count"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                    )}
                    {(nc.type !== "win_event" || nc.event) && (
                      <p className="text-[10px] text-purple-300/70">
                        Preview: {conditionSummary({ id: "preview", type: nc.type, count: nc.count, event: nc.type === "win_event" ? nc.event as WinEvent : undefined, competition: "any" })}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddCondition}
                        disabled={nc.type === "win_event" && !nc.event}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
                      >
                        Add to Group
                      </button>
                      <button
                        onClick={() => { setActiveOrGroupIdx(null); setNc({ ...EMPTY_COND }); }}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-bold rounded-lg transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setActiveOrGroupIdx(gi); setAddingCond(false); setNc({ ...EMPTY_COND }); }}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-purple-800/50 text-xs font-bold text-purple-300 hover:text-purple-200 rounded-lg transition"
                >
                  + Add Condition to Group
                </button>
              )}
            </div>
          ))}

          <button
            onClick={() => setOrGroups(prev => [...prev, []])}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-bold text-gray-300 hover:text-white rounded-lg transition"
          >
            + Add OR Group
          </button>
        </div>

        {/* Save / Cancel buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg transition disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Update Objective" : "Add Objective"}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-sm rounded-lg transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ───── OBJECTIVES LIST ───── */}
      {loading ? (
        <div className="text-gray-500 text-sm text-center py-8">Loading...</div>
      ) : objectives.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-8">No objectives yet. Add one above.</div>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.map(catValue => {
            const catObjs = objectives.filter(o => (o.category ?? "standard") === catValue);
            if (catObjs.length === 0) return null;
            const cat = CATEGORIES.find(c => c.value === catValue)!;
            return (
              <div key={catValue}>
                <div className={`flex items-center gap-2 mb-2 px-1`}>
                  <span className="text-sm">{cat.icon}</span>
                  <span className={`text-xs font-black uppercase tracking-widest ${cat.color}`}>{cat.label}</span>
                  <span className="text-[10px] text-gray-600 font-normal">({catObjs.length})</span>
                </div>
                <div className="space-y-2">
          {catObjs.map(obj => {
            const isExpired = obj.expires_at ? new Date(obj.expires_at) < new Date() : false;
            const conds = obj.conditions ?? [];
            return (
              <div
                key={obj.id}
                className={`bg-gray-900 border rounded-xl px-4 py-3 transition ${isExpired ? "border-gray-800/50 opacity-50" : !obj.is_published ? "border-yellow-800/30" : "border-gray-800"}`}
              >
                <div className="flex items-center gap-4">
                  {obj.card_image_url ? (
                    <img src={obj.card_image_url} alt={obj.card_name || "Card"} className="w-12 h-16 object-cover rounded-lg border border-gray-700 shrink-0" />
                  ) : (
                    <div className="w-12 h-16 bg-gray-800 rounded-lg border border-gray-700 shrink-0 flex items-center justify-center text-gray-600 text-lg">?</div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-white truncate">{obj.title}</div>
                    {obj.description && <div className="text-[10px] text-gray-500 truncate">{obj.description}</div>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {obj.xp_reward > 0 && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{obj.xp_reward} XP</span>}
                      {obj.card_name && <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">{obj.card_name}</span>}
                      {conds.length > 0 && <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{conds.length} condition{conds.length !== 1 ? "s" : ""}</span>}
                      {obj.is_published ? (
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">Published</span>
                      ) : (
                        <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">Draft</span>
                      )}
                      {obj.expires_at && !isExpired && <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">⏱ {formatDeadline(obj.expires_at)}</span>}
                      {isExpired && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Expired</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={async () => {
                        await fetch("/api/admin/objectives", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: obj.id, is_published: !obj.is_published }),
                        });
                        loadObjectives();
                      }}
                      className={`px-2 py-1 text-xs font-bold rounded-lg transition ${obj.is_published ? "text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20" : "text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20"}`}
                    >
                      {obj.is_published ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      onClick={() => handleEdit(obj)}
                      className="px-2 py-1 text-xs font-bold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(obj.id)}
                      className="px-2 py-1 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Show conditions under the card */}
                {conds.length > 0 && (
                  <div className="mt-2 pl-16 space-y-0.5">
                    {conds.map((c, i) => (
                      <div key={c.id} className="text-[10px] text-gray-400">
                        <span className="text-gray-600">{i + 1}.</span> {conditionSummary(c)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>}
    </div>
  );
}
