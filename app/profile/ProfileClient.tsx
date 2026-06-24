"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ImageWithFallback from "@/components/ImageWithFallback";
import ProfileHeader from "@/components/profile/ProfileHeader";
import XPProgressBar from "@/components/profile/XPProgressBar";
import StatsGrid from "@/components/profile/StatsGrid";
import TrophyCabinet from "@/components/profile/TrophyCabinet";
import WaysToEarnXP from "@/components/profile/WaysToEarnXP";
import PersonalRecords from "@/components/profile/PersonalRecords";
import CollectionSquad from "@/components/profile/CollectionSquad";
import SettingsModal from "@/components/profile/SettingsModal";
import type { UserProfile } from "@/lib/types";
import type { UserProgression } from "@/lib/xp";
import type { SeasonLevelReward } from "@/components/profile/XPProgressBar";

interface TierlistSummary {
  id: string;
  title: string;
  cover_image_url: string | null;
  created_at: string;
  category: string;
  view_count?: number;
}

interface SavedProfileImage {
  id: string;
  image_url: string;
  tierlist_title: string | null;
  created_at: string;
}

interface Props {
  userEmail: string;
  profile: UserProfile | null;
  created: TierlistSummary[];
  liked: TierlistSummary[];
  saved: TierlistSummary[];
  savedImages: SavedProfileImage[];
}

type ProfileTab = "dashboard" | "tierlists" | "saved" | "draft";

export default function ProfileClient({ userEmail, profile, created, liked, saved, savedImages }: Props) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("dashboard");
  const [showSettings, setShowSettings] = useState(false);
  const [progression, setProgression] = useState<UserProgression | null>(null);
  const [loadingProgression, setLoadingProgression] = useState(true);
  const [seasonRewards, setSeasonRewards] = useState<SeasonLevelReward[]>([]);

  const [username, setUsername] = useState(profile?.username ?? "");
  const [isAnon, setIsAnon] = useState(profile?.is_anonymous ?? false);

  const [createdList, setCreated] = useState(created);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [profileImages, setProfileImages] = useState(savedImages);
  const [viewingImage, setViewingImage] = useState<SavedProfileImage | null>(null);
  const [confirmDeleteImageId, setConfirmDeleteImageId] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile/progression")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && !data.error) setProgression(data);
        setLoadingProgression(false);
      })
      .catch(() => setLoadingProgression(false));

    fetch("/api/season-rewards")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.rewards?.length) setSeasonRewards(data.rewards); })
      .catch(() => {});
  }, []);

  async function handleEquip(type: "frame" | "title", id: string) {
    const body: Record<string, string> = {};
    if (type === "frame") body.frame = id;
    if (type === "title") body.title = id;
    const res = await fetch("/api/profile/equip", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok && progression) {
      setProgression({
        ...progression,
        equippedFrame: type === "frame" ? id : progression.equippedFrame,
        equippedTitle: type === "title" ? id : progression.equippedTitle,
      });
    }
  }

  async function handleSaveSettings(newUsername: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUsername || null, is_anonymous: isAnon }),
    });
    const data = await res.json();
    if (res.ok) {
      setUsername(newUsername);
      return { ok: true };
    }
    return { ok: false, error: data.error ?? "Something went wrong" };
  }

  async function deleteTierlist(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/tierlists/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setConfirmId(null);
    if (res.ok) setCreated(prev => prev.filter(t => t.id !== id));
  }

  async function deleteProfileImage(id: string) {
    setDeletingImageId(id);
    const res = await fetch(`/api/profile/images/${id}`, { method: "DELETE" });
    setDeletingImageId(null);
    setConfirmDeleteImageId(null);
    if (res.ok) setProfileImages(prev => prev.filter(img => img.id !== id));
  }

  const tabs: { key: ProfileTab; label: string; icon: string }[] = [
    { key: "dashboard", label: "Dashboard", icon: "⚡" },
    { key: "draft", label: "Draft", icon: "🏆" },
    { key: "tierlists", label: `My Tierlists (${createdList.length})`, icon: "🖼️" },
    { key: "saved", label: `Saved (${saved.length + profileImages.length})`, icon: "💾" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 pb-0 border-b border-gray-800/30">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`group flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-wide transition-all duration-300 rounded-t-xl relative ${
              activeTab === tab.key
                ? "text-amber-400 bg-gradient-to-b from-amber-500/10 to-transparent border border-gray-800/50 border-b-transparent -mb-px"
                : "text-white hover:text-gray-300 hover:bg-gray-900/50"
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
            )}
          </button>
        ))}
        <div className="ml-auto pb-1 hidden sm:block">
          <WaysToEarnXP compact />
        </div>
      </div>
      {/* Mobile-only Ways to Earn XP */}
      {activeTab === "dashboard" && (
        <div className="flex justify-end mb-4 sm:hidden">
          <WaysToEarnXP compact />
        </div>
      )}

      {/* Dashboard - multi-column layout */}
      {activeTab === "dashboard" && (
        <>
          {loadingProgression ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-amber-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-amber-500/50 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                </div>
                <p className="text-sm font-bold text-white animate-pulse">Loading your profile...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Row 1 — Profile + Road to Legend (wider) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:items-stretch">
                <div className="lg:col-span-3">
                  <ProfileHeader
                    username={username || null}
                    email={userEmail}
                    progression={progression}
                    loginStreak={profile?.current_streak ?? 0}
                    tierlistsCreated={createdList.length}
                    onOpenSettings={() => setShowSettings(true)}
                  />
                </div>
                <div className="lg:col-span-9">
                  <XPProgressBar progression={progression} seasonRewards={seasonRewards} />
                </div>
              </div>

              {/* Row 2 — Objectives (full width) */}
              <CustomObjectivesSection />

              {/* Row 3 — Collection Squad (full width) */}
              <CollectionSquad progression={progression} />
            </div>
          )}
        </>
      )}

      {/* Draft tab */}
      {activeTab === "draft" && (
        <>
          {loadingProgression ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-amber-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-amber-500/50 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                </div>
                <p className="text-sm font-bold text-white animate-pulse">Loading draft data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Row 1 — Trophy Cabinet (right side) */}
              <div className="flex justify-end">
                <div className="w-full lg:w-1/2">
                  <TrophyCabinet
                    rewards={progression?.rewards ?? []}
                    stats={progression?.stats ?? null}
                    level={progression?.level ?? 1}
                    equippedFrame={progression?.equippedFrame ?? "frame_default"}
                    equippedTitle={progression?.equippedTitle ?? "title_rookie"}
                    onEquip={handleEquip}
                  />
                </div>
              </div>

              {/* Row 2 — Career Stats (full width) */}
              <StatsGrid
                stats={progression?.stats ?? null}
                loginStreak={profile?.current_streak ?? 0}
                longestStreak={profile?.longest_streak ?? 0}
                tierlistsCreated={createdList.length}
              />

              {/* Row 3 — Personal Records (full width) */}
              <PersonalRecords />
            </div>
          )}
        </>
      )}

      {/* Tierlists tab */}
      {activeTab === "tierlists" && (
        <div className="max-w-5xl mx-auto">
          <TierlistGrid items={createdList} showDelete emptyMsg="You haven't created any tierlists yet." onDelete={setConfirmId} />
        </div>
      )}

      {/* Saved tab */}
      {activeTab === "saved" && (
        <div className="max-w-5xl mx-auto space-y-6">
          <section>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-base">📌</span> Bookmarked Tierlists
            </h3>
            <TierlistGrid items={saved} emptyMsg="No bookmarked tierlists." />
          </section>

          <section>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-base">❤️</span> Liked Tierlists
            </h3>
            <TierlistGrid items={liked} emptyMsg="No liked tierlists." />
          </section>

          <section>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-base">📷</span> Saved Images ({profileImages.length})
            </h3>
            {profileImages.length === 0 ? (
              <p className="py-6 text-center text-xs italic text-white">
                No saved images yet. Use &quot;Save to Profile&quot; when playing a tierlist.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {profileImages.map(img => (
                  <div key={img.id} className="group relative overflow-hidden rounded-xl border border-gray-700 bg-gray-900 cursor-pointer hover:border-gray-600 transition-all">
                    <div onClick={() => setViewingImage(img)} className="flex h-28 items-center justify-center overflow-hidden bg-gray-800">
                      <img src={img.image_url} alt={img.tierlist_title ?? "Saved"} className="h-full w-full object-contain transition-transform group-hover:scale-105" />
                    </div>
                    <div className="p-1.5">
                      {img.tierlist_title && <p className="truncate text-[10px] font-semibold text-white">{img.tierlist_title}</p>}
                      <p className="text-[9px] text-white">{new Date(img.created_at).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteImageId(img.id); }}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          username={username}
          email={userEmail}
          unlockedCards={progression?.rewards ?? []}
          equippedFrame={progression?.equippedFrame ?? "frame_default"}
          onSave={handleSaveSettings}
          onEquipFrame={(frameId) => handleEquip("frame", frameId)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Image viewer */}
      {viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setViewingImage(null)}>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <img src={viewingImage.image_url} alt={viewingImage.tierlist_title ?? "Saved"} className="max-h-[85vh] max-w-full rounded-lg object-contain" />
            <div className="mt-3 flex items-center justify-between">
              {viewingImage.tierlist_title && <p className="text-sm font-semibold text-white">{viewingImage.tierlist_title}</p>}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => { setConfirmDeleteImageId(viewingImage.id); setViewingImage(null); }} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500">Delete</button>
                <button onClick={() => setViewingImage(null)} className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-white hover:border-gray-400 hover:text-white">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete image confirm */}
      {confirmDeleteImageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white">Delete this saved image?</h3>
            <p className="mt-2 text-sm text-white">This permanently removes the image. This cannot be undone.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => deleteProfileImage(confirmDeleteImageId)} disabled={!!deletingImageId} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                {deletingImageId ? "Deleting..." : "Delete"}
              </button>
              <button onClick={() => setConfirmDeleteImageId(null)} disabled={!!deletingImageId} className="flex-1 rounded-lg border border-gray-600 py-2.5 text-sm font-semibold text-white hover:border-gray-400 hover:text-white disabled:opacity-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete tierlist confirm */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white">Delete this tierlist?</h3>
            <p className="mt-2 text-sm text-white">This permanently deletes the tierlist and all its images. This cannot be undone.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => deleteTierlist(confirmId)} disabled={!!deletingId} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                {deletingId ? "Deleting..." : "Delete"}
              </button>
              <button onClick={() => setConfirmId(null)} disabled={!!deletingId} className="flex-1 rounded-lg border border-gray-600 py-2.5 text-sm font-semibold text-white hover:border-gray-400 hover:text-white disabled:opacity-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Custom Objectives Section (admin-controlled) ── */

interface AdminObjective {
  id: string;
  title: string;
  description: string | null;
  xp_reward: number;
  card_image_url: string | null;
  card_name: string | null;
  category: string;
  expires_at: string | null;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string; border: string; bg: string }> = {
  standard:       { label: "Objectives",      icon: "🎯", color: "text-white",        border: "border-gray-700/50",    bg: "bg-gray-800/30" },
  daily:          { label: "Daily",           icon: "📅", color: "text-sky-400",     border: "border-sky-800/50",     bg: "bg-sky-950/30" },
  weekly:         { label: "Weekly",          icon: "📆", color: "text-violet-400",  border: "border-violet-800/50",  bg: "bg-violet-950/30" },
  monthly:        { label: "Monthly",         icon: "🗓️", color: "text-pink-400",    border: "border-pink-800/50",    bg: "bg-pink-950/30" },
  foundation:     { label: "Foundation",      icon: "🏗️", color: "text-emerald-400", border: "border-emerald-800/50", bg: "bg-emerald-950/30" },
  elite:          { label: "Elite",           icon: "⚡", color: "text-blue-400",    border: "border-blue-800/50",    bg: "bg-blue-950/30" },
  goat:           { label: "GOAT Manager",    icon: "🐐", color: "text-amber-400",   border: "border-amber-800/50",   bg: "bg-amber-950/30" },
  record_breaker: { label: "Record Breakers", icon: "📋", color: "text-red-400",     border: "border-red-800/50",     bg: "bg-red-950/30" },
};

const CATEGORY_ORDER = ["standard", "daily", "weekly", "monthly", "foundation", "elite", "goat", "record_breaker"];

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return "< 1h left";
}

function ObjectiveDetail({ obj, isDone }: { obj: AdminObjective; isDone: boolean }) {
  return (
    <div className="flex-1 p-6 flex gap-6">
      <div className="flex-1 min-w-0">
        <h4 className="text-xl font-black text-white mb-2">{obj.title}</h4>
        {obj.description && (
          <p className="text-base text-white mb-4 leading-relaxed line-clamp-3">{obj.description}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          {obj.xp_reward > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
              <span className="text-amber-400 text-sm font-black">{obj.xp_reward} XP</span>
            </div>
          )}
          {isDone ? (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-emerald-400 text-sm font-bold">Completed</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700/50 rounded-lg px-4 py-2">
              <span className="text-white text-sm font-bold">In Progress</span>
            </div>
          )}
          {!isDone && obj.expires_at && (
            <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-2">
              <span className="text-orange-400 text-sm font-bold">⏱ {getTimeRemaining(obj.expires_at)}</span>
            </div>
          )}
        </div>
      </div>
      {obj.card_image_url && (
        <div className="shrink-0 text-center">
          <div className="text-xs font-bold text-white uppercase tracking-wider mb-2">Reward</div>
          <img
            src={obj.card_image_url}
            alt={obj.card_name || "Card Reward"}
            className="w-28 h-36 object-cover rounded-xl border border-gray-700 shadow-lg"
          />
          {obj.card_name && (
            <div className="text-sm font-bold text-white mt-2 truncate max-w-[7rem]">{obj.card_name}</div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomObjectivesSection() {
  const [objectives, setObjectives] = useState<AdminObjective[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [completedObjectives, setCompletedObjectives] = useState<AdminObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [selectedActiveId, setSelectedActiveId] = useState<string | null>(null);
  const [selectedCompletedId, setSelectedCompletedId] = useState<string | null>(null);

  useEffect(() => {
    // Fire login streak check (silent, fire-and-forget)
    fetch("/api/objectives/check-login", { method: "POST" }).catch(() => {});

    fetch("/api/objectives")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setObjectives(data.objectives ?? []);
          setCompletedIds(data.completed ?? []);
          setCompletedObjectives(data.completedObjectives ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (objectives.length === 0 && completedObjectives.length === 0) return null;

  // Active tab: objectives not yet completed
  const activeList = objectives.filter(o => !completedIds.includes(o.id));
  // Completed tab: full details of completed objectives
  const completedList = completedObjectives;

  const currentList = activeTab === "active" ? activeList : completedList;
  const selectedId = activeTab === "active" ? selectedActiveId : selectedCompletedId;
  const setSelectedId = activeTab === "active" ? setSelectedActiveId : setSelectedCompletedId;

  const selected = currentList.find(o => o.id === selectedId) ?? currentList[0] ?? null;

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <h3 className="text-sm font-bold tracking-[0.25em] text-white uppercase">
          Objectives
        </h3>
        <span className="text-sm font-bold text-amber-400">
          {completedList.length}/{objectives.length + completedList.length} completed
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-5 pt-3 border-b border-gray-800/50">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2 text-sm font-bold transition border-b-2 -mb-px ${
            activeTab === "active"
              ? "text-white border-emerald-500"
              : "text-white border-transparent hover:text-gray-300"
          }`}
        >
          Active {activeList.length > 0 && <span className="ml-1 text-xs opacity-70">({activeList.length})</span>}
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`px-4 py-2 text-sm font-bold transition border-b-2 -mb-px ${
            activeTab === "completed"
              ? "text-white border-emerald-500"
              : "text-white border-transparent hover:text-gray-300"
          }`}
        >
          Completed {completedList.length > 0 && <span className="ml-1 text-xs opacity-70">({completedList.length})</span>}
        </button>
      </div>

      {currentList.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-white">
          {activeTab === "active" ? "No active objectives right now." : "No completed objectives yet."}
        </div>
      ) : (
        <>
          {/* Mobile: stacked expandable cards grouped by category */}
          <div className="md:hidden overflow-y-auto max-h-[600px]">
            {(activeTab === "active" ? CATEGORY_ORDER : ["completed"]).map(catKey => {
              const group = activeTab === "active"
                ? currentList.filter(o => (o.category ?? "standard") === catKey)
                : currentList;
              if (group.length === 0) return null;
              const cat = CATEGORY_CONFIG[catKey];
              return (
                <div key={catKey}>
                  {activeTab === "active" && cat && (
                    <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-800/30 ${cat.bg}`}>
                      <span className="text-base">{cat.icon}</span>
                      <span className={`text-sm font-black uppercase tracking-widest ${cat.color}`}>{cat.label}</span>
                    </div>
                  )}
                  {group.map((obj) => {
                    const done = completedIds.includes(obj.id);
                    const isSelected = (selectedId ?? currentList[0]?.id) === obj.id;
                    return (
                      <div key={obj.id}>
                        <button
                          onClick={() => setSelectedId(isSelected ? null : obj.id)}
                          className={`w-full text-left px-4 py-3.5 border-b border-gray-800/30 transition-all ${isSelected ? "bg-gray-800/80" : "hover:bg-gray-800/40"}`}
                        >
                          <div className="flex items-center gap-2.5">
                            {done ? (
                              <svg className="w-4.5 h-4.5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <div className="w-4.5 h-4.5 rounded-full border border-gray-600 shrink-0" />
                            )}
                            <span className={`text-base font-bold leading-tight ${done ? "text-emerald-400" : "text-white"}`}>{obj.title}</span>
                            <svg className={`w-5 h-5 ml-auto shrink-0 text-gray-500 transition-transform ${isSelected ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          <div className="mt-1.5 pl-7 flex items-center gap-2 flex-wrap">
                            {obj.xp_reward > 0 && <span className={`text-xs font-bold ${done ? "text-emerald-500/60" : "text-amber-400"}`}>{obj.xp_reward} XP</span>}
                            {!done && obj.expires_at && <span className="text-xs font-bold text-orange-400">⏱ {getTimeRemaining(obj.expires_at)}</span>}
                          </div>
                        </button>
                        {isSelected && (
                          <div className="px-4 py-4 bg-gray-800/50 border-b border-gray-800/30">
                            {obj.description && <p className="text-sm text-white mb-3 leading-relaxed">{obj.description}</p>}
                            <div className="flex items-center gap-2 flex-wrap">
                              {obj.xp_reward > 0 && (
                                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                                  <span className="text-amber-400 text-sm font-black">{obj.xp_reward} XP</span>
                                </div>
                              )}
                              {done ? (
                                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                  <span className="text-emerald-400 text-sm font-bold">Completed</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700/50 rounded-lg px-3 py-1.5">
                                  <span className="text-white text-sm font-bold">In Progress</span>
                                </div>
                              )}
                              {!done && obj.expires_at && (
                                <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5">
                                  <span className="text-orange-400 text-sm font-bold">⏱ {getTimeRemaining(obj.expires_at)}</span>
                                </div>
                              )}
                            </div>
                            {obj.card_image_url && (
                              <div className="mt-4 flex items-center gap-4">
                                <img src={obj.card_image_url} alt={obj.card_name || "Card Reward"} className="w-20 h-24 object-cover rounded-lg border border-gray-700 shadow-lg" />
                                <div>
                                  <div className="text-xs font-bold text-white uppercase tracking-wider">Reward</div>
                                  {obj.card_name && <div className="text-sm font-bold text-white mt-1">{obj.card_name}</div>}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Desktop: side-by-side with category groups in sidebar */}
          <div className="hidden md:flex min-h-[340px]">
            <div className="w-64 shrink-0 border-r border-gray-800/50 overflow-y-auto max-h-[600px]">
              {(activeTab === "active" ? CATEGORY_ORDER : ["completed"]).map(catKey => {
                const group = activeTab === "active"
                  ? currentList.filter(o => (o.category ?? "standard") === catKey)
                  : currentList;
                if (group.length === 0) return null;
                const cat = CATEGORY_CONFIG[catKey];
                return (
                  <div key={catKey}>
                    {activeTab === "active" && cat && (
                      <div className={`flex items-center gap-2 px-4 py-2 border-b border-gray-800/30 ${cat.bg}`}>
                        <span className="text-base">{cat.icon}</span>
                        <span className={`text-xs font-black uppercase tracking-widest ${cat.color}`}>{cat.label}</span>
                      </div>
                    )}
                    {group.map((obj) => {
                      const done = completedIds.includes(obj.id);
                      const isSelected = (selectedId ?? currentList[0]?.id) === obj.id;
                      return (
                        <button
                          key={obj.id}
                          onClick={() => setSelectedId(obj.id)}
                          className={`w-full text-left px-4 py-3.5 border-b border-gray-800/30 transition-all ${
                            isSelected ? "bg-gray-800/80 border-l-2 border-l-emerald-500" : "hover:bg-gray-800/40 border-l-2 border-l-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {done ? (
                              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
                            )}
                            <span className={`text-sm font-bold leading-tight line-clamp-2 ${done ? "text-emerald-400" : "text-white"}`}>{obj.title}</span>
                          </div>
                          <div className="mt-1.5 pl-6 flex items-center gap-2 flex-wrap">
                            {obj.xp_reward > 0 && <span className={`text-xs font-bold ${done ? "text-emerald-500/60" : "text-amber-400"}`}>{obj.xp_reward} XP</span>}
                            {!done && obj.expires_at && <span className="text-xs font-bold text-orange-400">⏱ {getTimeRemaining(obj.expires_at)}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {selected && <ObjectiveDetail obj={selected} isDone={completedIds.includes(selected.id)} />}
          </div>
        </>
      )}
    </div>
  );
}

function TierlistGrid({ items, showDelete = false, emptyMsg, onDelete }: {
  items: { id: string; title: string; cover_image_url: string | null; created_at: string; category: string; view_count?: number }[];
  showDelete?: boolean;
  emptyMsg: string;
  onDelete?: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="text-4xl mb-3 opacity-30">🖼️</div>
        <p className="text-xs italic text-white">{emptyMsg}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map(tl => (
        <div key={tl.id} className="group relative overflow-hidden rounded-xl border border-gray-700 bg-gray-900 hover:border-gray-600 transition-all">
          <Link href={`/play/${tl.id}`}>
            <div className="flex h-24 items-center justify-center overflow-hidden bg-gray-800">
              {tl.cover_image_url ? (
                <ImageWithFallback src={tl.cover_image_url} alt={tl.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <span className="text-2xl">&#127942;</span>
              )}
            </div>
            <div className="p-1.5">
              <p className="truncate text-[10px] font-semibold text-white">{tl.title}</p>
              <p className="text-[9px] text-white">{new Date(tl.created_at).toLocaleDateString()}</p>
              {tl.view_count !== undefined && (
                <p className="text-[9px] text-white">{tl.view_count.toLocaleString()} views</p>
              )}
            </div>
          </Link>
          {showDelete && onDelete && (
            <button
              onClick={() => onDelete(tl.id)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              x
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
