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
import type { UserProgression, Reward } from "@/lib/xp";
import { RARITY_COLORS } from "@/lib/xp";

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

  async function handleSaveSettings(newUsername: string, newIsAnon: boolean): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUsername || null, is_anonymous: newIsAnon }),
    });
    const data = await res.json();
    if (res.ok) {
      setUsername(newUsername);
      setIsAnon(newIsAnon);
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
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-900/50"
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
                <p className="text-sm font-bold text-gray-500 animate-pulse">Loading your profile...</p>
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
                  <XPProgressBar progression={progression} />
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
                <p className="text-sm font-bold text-gray-500 animate-pulse">Loading draft data...</p>
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
            <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
              <span className="text-base">📌</span> Bookmarked Tierlists
            </h3>
            <TierlistGrid items={saved} emptyMsg="No bookmarked tierlists." />
          </section>

          <section>
            <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
              <span className="text-base">❤️</span> Liked Tierlists
            </h3>
            <TierlistGrid items={liked} emptyMsg="No liked tierlists." />
          </section>

          <section>
            <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
              <span className="text-base">📷</span> Saved Images ({profileImages.length})
            </h3>
            {profileImages.length === 0 ? (
              <p className="py-6 text-center text-xs italic text-gray-600">
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
                      <p className="text-[9px] text-gray-500">{new Date(img.created_at).toLocaleDateString()}</p>
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
          isAnonymous={isAnon}
          email={userEmail}
          onSave={handleSaveSettings}
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
                <button onClick={() => setViewingImage(null)} className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-gray-400 hover:text-white">Close</button>
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
            <p className="mt-2 text-sm text-gray-400">This permanently removes the image. This cannot be undone.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => deleteProfileImage(confirmDeleteImageId)} disabled={!!deletingImageId} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                {deletingImageId ? "Deleting..." : "Delete"}
              </button>
              <button onClick={() => setConfirmDeleteImageId(null)} disabled={!!deletingImageId} className="flex-1 rounded-lg border border-gray-600 py-2.5 text-sm font-semibold text-gray-300 hover:border-gray-400 hover:text-white disabled:opacity-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete tierlist confirm */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white">Delete this tierlist?</h3>
            <p className="mt-2 text-sm text-gray-400">This permanently deletes the tierlist and all its images. This cannot be undone.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => deleteTierlist(confirmId)} disabled={!!deletingId} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                {deletingId ? "Deleting..." : "Delete"}
              </button>
              <button onClick={() => setConfirmId(null)} disabled={!!deletingId} className="flex-1 rounded-lg border border-gray-600 py-2.5 text-sm font-semibold text-gray-300 hover:border-gray-400 hover:text-white disabled:opacity-50">Cancel</button>
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
  expires_at: string | null;
}

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
    <div className="flex-1 p-5 flex gap-6">
      <div className="flex-1 min-w-0">
        <h4 className="text-lg font-black text-white mb-2">{obj.title}</h4>
        {obj.description && (
          <p className="text-sm text-gray-400 mb-4 leading-relaxed">{obj.description}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          {obj.xp_reward > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
              <span className="text-amber-400 text-xs font-black">{obj.xp_reward} XP</span>
            </div>
          )}
          {isDone ? (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-emerald-400 text-xs font-bold">Completed</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700/50 rounded-lg px-3 py-1.5">
              <span className="text-gray-400 text-xs font-bold">In Progress</span>
            </div>
          )}
          {!isDone && obj.expires_at && (
            <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5">
              <span className="text-orange-400 text-xs font-bold">⏱ {getTimeRemaining(obj.expires_at)}</span>
            </div>
          )}
        </div>
      </div>
      {obj.card_image_url && (
        <div className="shrink-0 text-center">
          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">Reward</div>
          <img
            src={obj.card_image_url}
            alt={obj.card_name || "Card Reward"}
            className="w-24 h-32 object-cover rounded-xl border border-gray-700 shadow-lg"
          />
          {obj.card_name && (
            <div className="text-[10px] font-bold text-gray-300 mt-1.5">{obj.card_name}</div>
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
        <h3 className="text-[10px] font-bold tracking-[0.25em] text-gray-400 uppercase">
          Objectives
        </h3>
        <span className="text-[10px] font-bold text-amber-400">
          {completedList.length}/{objectives.length + completedList.length} completed
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-5 pt-3 border-b border-gray-800/50">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2 text-xs font-bold transition border-b-2 -mb-px ${
            activeTab === "active"
              ? "text-white border-emerald-500"
              : "text-gray-500 border-transparent hover:text-gray-300"
          }`}
        >
          Active {activeList.length > 0 && <span className="ml-1 text-[10px] opacity-70">({activeList.length})</span>}
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`px-4 py-2 text-xs font-bold transition border-b-2 -mb-px ${
            activeTab === "completed"
              ? "text-white border-emerald-500"
              : "text-gray-500 border-transparent hover:text-gray-300"
          }`}
        >
          Completed {completedList.length > 0 && <span className="ml-1 text-[10px] opacity-70">({completedList.length})</span>}
        </button>
      </div>

      {currentList.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-gray-600">
          {activeTab === "active" ? "No active objectives right now." : "No completed objectives yet."}
        </div>
      ) : (
        <div className="flex min-h-[200px]">
          {/* Left sidebar */}
          <div className="w-48 shrink-0 border-r border-gray-800/50 overflow-y-auto max-h-[400px]">
            {currentList.map((obj) => {
              const done = completedIds.includes(obj.id);
              const isSelected = (selectedId ?? currentList[0]?.id) === obj.id;
              return (
                <button
                  key={obj.id}
                  onClick={() => setSelectedId(obj.id)}
                  className={`w-full text-left px-3 py-3 border-b border-gray-800/30 transition-all ${
                    isSelected
                      ? "bg-gray-800/80 border-l-2 border-l-emerald-500"
                      : "hover:bg-gray-800/40 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {done ? (
                      <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-gray-600 shrink-0" />
                    )}
                    <span className={`text-xs font-bold leading-tight line-clamp-2 ${done ? "text-emerald-400" : "text-white"}`}>
                      {obj.title}
                    </span>
                  </div>
                  <div className="mt-1 pl-5 flex items-center gap-1.5 flex-wrap">
                    {obj.xp_reward > 0 && (
                      <span className={`text-[9px] font-bold ${done ? "text-emerald-500/60" : "text-amber-400"}`}>
                        {obj.xp_reward} XP
                      </span>
                    )}
                    {!done && obj.expires_at && (
                      <span className="text-[9px] font-bold text-orange-400">
                        ⏱ {getTimeRemaining(obj.expires_at)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right content */}
          {selected && (
            <ObjectiveDetail obj={selected} isDone={completedIds.includes(selected.id)} />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Objectives Section ── */

const OBJECTIVE_ICONS: Record<string, string> = {
  trophy_first_draft: "\u{1F4CB}",
  trophy_10_drafts: "\u{1F4CB}",
  trophy_50_drafts: "\u{1F3C5}",
  trophy_first_win: "\u{1F3C6}",
  trophy_10_wins: "\u{1F3C6}",
  trophy_50_wins: "\u{1F451}",
  trophy_invincible: "\u{1F6E1}",
  trophy_100_goals: "\u{26BD}",
  trophy_500_goals: "\u{26A1}",
  trophy_1000_goals: "\u{1F525}",
  trophy_tierlist_maker: "\u{1F5BC}",
  trophy_popular: "\u{2764}",
  trophy_voter: "\u{1F5F3}",
  trophy_streak_7: "\u{1F525}",
  trophy_streak_30: "\u{1F4A5}",
  frame_default: "\u{1F5BC}",
  frame_silver: "\u{1FA9F}",
  frame_gold: "\u{1F7E8}",
  frame_champions: "\u{2B50}",
  frame_diamond: "\u{1F48E}",
  frame_invincibles: "\u{1F6E1}",
  frame_future_stars: "\u{2728}",
  frame_ballon_dor: "\u{1F3C6}",
  title_rookie: "\u{1F464}",
  title_rising: "\u{1F4C8}",
  title_promising: "\u{1F3C5}",
  title_established: "\u{1F6E1}",
  title_tactical: "\u{1F9E0}",
  title_elite: "\u{1F451}",
  title_mastermind: "\u{2728}",
  title_world_class: "\u{1F30D}",
  title_legend: "\u{1F3C6}",
};

const STAT_LABELS: Record<string, string> = {
  drafts_played: "drafts",
  draft_wins: "league wins",
  draft_invincibles: "invincible season",
  total_goals_scored: "goals scored",
  tierlists_created: "tierlists created",
  tierlists_likes_received: "likes received",
  votes_cast: "votes cast",
  longest_streak: "day login streak",
};

function getObjectiveDescription(reward: Reward): string {
  if (reward.unlock_type === "level") {
    return `Reach Level ${reward.unlock_value}`;
  }
  const label = reward.unlock_stat ? STAT_LABELS[reward.unlock_stat] ?? reward.unlock_stat : "???";
  return `${reward.unlock_value} ${label}`;
}

function getObjectiveProgress(
  reward: Reward,
  stats: import("@/lib/xp").UserStats | null,
  level: number,
): { current: number; target: number; percent: number } | null {
  if (reward.unlock_type === "stat" && reward.unlock_stat && reward.unlock_value && stats) {
    const val = stats[reward.unlock_stat as keyof import("@/lib/xp").UserStats];
    if (typeof val === "number") {
      return { current: val, target: reward.unlock_value, percent: (val / reward.unlock_value) * 100 };
    }
  }
  return null;
}

function ObjectivesSection({ rewards, stats, level }: {
  rewards: (Reward & { unlocked: boolean; unlocked_at: string | null })[];
  stats: import("@/lib/xp").UserStats | null;
  level: number;
}) {
  const statRewards = rewards.filter(r => r.unlock_type === "stat").sort((a, b) => a.sort_order - b.sort_order);

  if (statRewards.length === 0) return null;

  const unlockedCount = statRewards.filter(r => r.unlocked).length;

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold tracking-[0.25em] text-gray-500 uppercase">
          Objectives
        </h3>
        <span className="text-[10px] font-bold text-amber-400">
          {unlockedCount}/{statRewards.length} completed
        </span>
      </div>

      {/* Objectives grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {statRewards.map(reward => {
          const rarity = RARITY_COLORS[reward.rarity as keyof typeof RARITY_COLORS] ?? RARITY_COLORS.bronze;
          const progress = getObjectiveProgress(reward, stats, level);
          const icon = OBJECTIVE_ICONS[reward.id] ?? "\u{2753}";

          return (
            <div
              key={reward.id}
              className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 ${
                reward.unlocked
                  ? `${rarity.bg} ${rarity.border} hover:scale-[1.02]`
                  : "bg-gray-800/30 border-gray-800/50 opacity-50"
              }`}
            >
              {/* Lock overlay for locked cards */}
              {!reward.unlocked && (
                <div className="absolute top-2 right-2">
                  <svg className="w-3.5 h-3.5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* Icon */}
              <div className={`text-2xl ${reward.unlocked ? "" : "grayscale"}`}>
                {icon}
              </div>

              {/* Name */}
              <span className={`text-[10px] font-bold text-center leading-tight ${
                reward.unlocked ? rarity.text : "text-gray-600"
              }`}>
                {reward.unlocked ? reward.name : "???"}
              </span>

              {/* Objective description */}
              <span className="text-[9px] text-gray-500 text-center leading-tight">
                {getObjectiveDescription(reward)}
              </span>

              {/* Progress bar for locked objectives */}
              {!reward.unlocked && progress && (
                <div className="w-full mt-1">
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gray-600 to-gray-500 rounded-full transition-all"
                      style={{ width: `${Math.min(progress.percent, 100)}%` }}
                    />
                  </div>
                  <p className="text-[8px] text-gray-600 text-center mt-0.5">
                    {progress.current}/{progress.target}
                  </p>
                </div>
              )}

              {/* Completed badge for unlocked */}
              {reward.unlocked && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[8px] font-bold text-emerald-400">COMPLETE</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
        <p className="text-xs italic text-gray-600">{emptyMsg}</p>
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
              <p className="text-[9px] text-gray-500">{new Date(tl.created_at).toLocaleDateString()}</p>
              {tl.view_count !== undefined && (
                <p className="text-[9px] text-gray-600">{tl.view_count.toLocaleString()} views</p>
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
