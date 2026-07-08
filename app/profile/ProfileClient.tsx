"use client";

import React, { useState, useEffect, useRef } from "react";
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
import type { ObjectiveCondition } from "@/lib/objectiveTypes";
import { conditionSummary } from "@/lib/objectiveEvaluator";

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
    const loadProgression = async () => {
      // Award join bonus on first ever visit — idempotent (server deduplicates via unique event_ref)
      await fetch("/api/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "join", event_ref: "join", xp_amount: 1000 }),
      }).catch(() => {});

      const [progressData, rewardsData] = await Promise.all([
        fetch("/api/profile/progression").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/season-rewards").then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (progressData && !progressData.error) setProgression(progressData);
      if (rewardsData?.rewards?.length) setSeasonRewards(rewardsData.rewards);
      setLoadingProgression(false);
    };
    loadProgression();

    // Refresh progression when an objective is claimed so Collection Squad cards update immediately
    const refreshProgression = () => {
      fetch("/api/profile/progression")
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data && !data.error) setProgression(data); })
        .catch(() => {});
    };
    window.addEventListener("objective-claimed", refreshProgression);
    return () => window.removeEventListener("objective-claimed", refreshProgression);
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
    try {
      const res = await fetch(`/api/tierlists/${id}`, { method: "DELETE" });
      if (res.ok) setCreated(prev => prev.filter(t => t.id !== id));
    } catch {
      // Network error — modal recovers via finally so the user can retry
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  async function deleteProfileImage(id: string) {
    setDeletingImageId(id);
    try {
      const res = await fetch(`/api/profile/images/${id}`, { method: "DELETE" });
      if (res.ok) setProfileImages(prev => prev.filter(img => img.id !== id));
    } catch {
      // Network error — modal recovers via finally so the user can retry
    } finally {
      setDeletingImageId(null);
      setConfirmDeleteImageId(null);
    }
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
              <CollectionSquad progression={progression} seasonRewards={seasonRewards} />
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
  conditions?: ObjectiveCondition[] | null;
  or_groups?: ObjectiveCondition[][] | null;
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

function ObjectiveRequirements({ conditions, orGroups }: {
  conditions: ObjectiveCondition[] | null | undefined;
  orGroups?: ObjectiveCondition[][] | null;
}) {
  if (!conditions || conditions.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Requirements</div>
      <ul className="space-y-1.5">
        {conditions.map(cond => (
          <li key={cond.id} className="flex items-start gap-2 text-sm text-white/80">
            <span className="mt-px text-gray-600 shrink-0">▸</span>
            <span>{conditionSummary(cond)}</span>
          </li>
        ))}
      </ul>
      {orGroups && orGroups.length > 0 && orGroups.map((group, i) => (
        <div key={i} className="mt-2.5">
          <div className="text-[11px] font-bold text-gray-500 mb-1.5">Plus one of:</div>
          <ul className="space-y-1 ml-2 pl-3 border-l border-gray-700">
            {group.map(cond => (
              <li key={cond.id} className="flex items-start gap-2 text-sm text-white/70">
                <span className="mt-px text-gray-600 shrink-0">◦</span>
                <span>{conditionSummary(cond)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RequirementsToggle({ conditions, orGroups }: {
  conditions: ObjectiveCondition[] | null | undefined;
  orGroups?: ObjectiveCondition[][] | null;
}) {
  const [open, setOpen] = useState(false);
  if (!conditions || conditions.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors"
      >
        Requirements
        <svg className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <ObjectiveRequirements conditions={conditions} orGroups={orGroups} />}
    </div>
  );
}

function ObjectiveDetail({ obj, isDone, isUnclaimed, onClaim, claiming }: {
  obj: AdminObjective;
  isDone: boolean;
  isUnclaimed?: boolean;
  onClaim?: () => void;
  claiming?: boolean;
}) {
  return (
    <div className="flex-1 p-6 flex gap-6 overflow-y-auto">
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
          {isDone && !isUnclaimed ? (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-emerald-400 text-sm font-bold">Completed</span>
            </div>
          ) : !isDone ? (
            <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700/50 rounded-lg px-4 py-2">
              <span className="text-white text-sm font-bold">In Progress</span>
            </div>
          ) : null}
          {!isDone && obj.expires_at && (
            <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-2">
              <span className="text-orange-400 text-sm font-bold">⏱ {getTimeRemaining(obj.expires_at)}</span>
            </div>
          )}
        </div>
        <ObjectiveRequirements conditions={obj.conditions} orGroups={obj.or_groups} />
        {isUnclaimed && onClaim && (
          <button
            onClick={onClaim}
            disabled={claiming}
            className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-60 text-sm font-black text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {claiming ? "Claiming…" : "Claim Reward"}
          </button>
        )}
      </div>
      {obj.card_image_url && (
        <div className="shrink-0 text-center">
          <div className="text-xs font-bold text-white uppercase tracking-wider mb-2">Reward</div>
          <img
            src={obj.card_image_url}
            alt={obj.card_name || "Card Reward"}
            className="w-40 h-52 object-cover rounded-xl border border-gray-700 shadow-lg"
          />
          {obj.card_name && (
            <div className="text-sm font-bold text-white mt-2 truncate max-w-[10rem]">{obj.card_name}</div>
          )}
        </div>
      )}
    </div>
  );
}

interface ClaimResult {
  title: string;
  xp_reward: number;
  card_image_url: string | null;
  card_name: string | null;
}

function ObjectiveClaimModal({ result, onClose }: { result: ClaimResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl border border-amber-500/30 bg-gray-900 shadow-2xl shadow-amber-900/30 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/60 via-amber-400 to-amber-500/60" />
        <div className="px-6 py-8 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-xs font-black uppercase tracking-[0.3em] text-amber-400 mb-1">Objective Complete</div>
          <h2 className="text-lg font-black text-white mb-6 leading-tight">{result.title}</h2>

          <div className="text-xs font-bold text-white uppercase tracking-wider mb-4">You earned</div>

          {/* Card — hero of the reward, centered and large, no border (card art has its own frame) */}
          {result.card_image_url && (
            <div className="flex flex-col items-center mb-3">
              <img
                src={result.card_image_url}
                alt={result.card_name || "Card"}
                className="w-40 h-[210px] object-contain rounded-xl shadow-2xl shadow-amber-900/40 mb-2"
              />
              {result.card_name && (
                <span className="text-sm font-bold text-white">{result.card_name}</span>
              )}
            </div>
          )}

          {/* XP — secondary, smaller */}
          {result.xp_reward > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="text-base">⚡</span>
              <span className="text-base font-bold text-amber-400">{result.xp_reward} XP</span>
            </div>
          )}
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-sm font-black text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Awesome!
          </button>
        </div>
      </div>
    </div>
  );
}

export function CustomObjectivesSection() {
  const [objectives, setObjectives] = useState<AdminObjective[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [unclaimedIds, setUnclaimedIds] = useState<string[]>([]);
  const [completedObjectives, setCompletedObjectives] = useState<AdminObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedActiveId, setSelectedActiveId] = useState<string | null>(null);
  const [selectedCompletedId, setSelectedCompletedId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const claimingRef = useRef(false);
  const [claimModal, setClaimModal] = useState<ClaimResult | null>(null);

  useEffect(() => {
    // Fire login streak check — read response so XP can be awarded for newly completed objectives
    fetch("/api/objectives/check-login", { method: "POST" })
      .then(r => r.ok ? r.json() : null)
      .then(async (data: { completed?: { id: string; xp_reward: number }[] } | null) => {
        for (const obj of data?.completed ?? []) {
          if (obj.xp_reward > 0) {
            await fetch("/api/xp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event_type: `objective_${obj.id}`, event_ref: `objective_${obj.id}` }),
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});

    fetch("/api/objectives")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setObjectives(data.objectives ?? []);
          setCompletedIds(data.completed ?? []);
          setUnclaimedIds(data.unclaimed ?? []);
          setCompletedObjectives(data.completedObjectives ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleClaim(objId: string, obj: AdminObjective) {
    // Use a synchronous ref so rapid double-clicks can't slip past before React re-renders
    if (claimingRef.current) return;
    claimingRef.current = true;
    setClaimingId(objId);
    try {
      const res = await fetch(`/api/objectives/${objId}/claim`, { method: "POST" });
      if (res.ok || res.status === 400) {
        // 400 = already claimed — still dismiss the dot
        setUnclaimedIds(prev => prev.filter(id => id !== objId));
        if (res.ok) {
          setClaimModal({ title: obj.title, xp_reward: obj.xp_reward, card_image_url: obj.card_image_url, card_name: obj.card_name });
          // Tell the nav badge to decrement immediately — no page refresh needed
          window.dispatchEvent(new CustomEvent("objective-claimed"));
        }
      }
    } catch { /* non-critical */ }
    setClaimingId(null);
    claimingRef.current = false;
  }

  if (loading) return null;
  if (objectives.length === 0 && completedObjectives.length === 0) return null;

  // Merge all objectives (active + completed-only) into a single list
  const allObjectives = [
    ...objectives,
    ...completedObjectives.filter(co => !objectives.some(o => o.id === co.id)),
  ];

  // Find categories that have at least one objective
  const availableCategories = CATEGORY_ORDER.filter(catKey =>
    allObjectives.some(o => (o.category ?? "standard") === catKey)
  );

  // Default to first available category
  const currentCategory = selectedCategory && availableCategories.includes(selectedCategory)
    ? selectedCategory
    : availableCategories[0] ?? null;

  if (!currentCategory) return null;

  // Get objectives for the current category, sorted: active first, completed last
  const categoryObjectives = allObjectives
    .filter(o => (o.category ?? "standard") === currentCategory)
    .sort((a, b) => {
      const aDone = completedIds.includes(a.id) ? 1 : 0;
      const bDone = completedIds.includes(b.id) ? 1 : 0;
      return aDone - bDone;
    });

  const totalCompleted = allObjectives.filter(o => completedIds.includes(o.id)).length;
  const catConfig = CATEGORY_CONFIG[currentCategory];

  const selectedId = selectedActiveId ?? selectedCompletedId;
  const setSelectedId = (id: string | null) => { setSelectedActiveId(id); setSelectedCompletedId(id); };
  const selected = categoryObjectives.find(o => o.id === selectedId) ?? categoryObjectives[0] ?? null;

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <Link href="/objectives" className="text-sm font-bold tracking-[0.25em] text-white uppercase hover:text-blue-400 transition-colors">
          Objectives ↗
        </Link>
        <span className="text-sm font-bold text-amber-400">
          {totalCompleted}/{allObjectives.length} completed
        </span>
      </div>

      {/* Category Tabs — scrollable on mobile; no native scrollbar */}
      <div className="relative border-b border-gray-800/50">
      <div className="flex gap-0 px-5 pt-3 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
        {availableCategories.map(catKey => {
          const cat = CATEGORY_CONFIG[catKey];
          if (!cat) return null;
          const catObjs = allObjectives.filter(o => (o.category ?? "standard") === catKey);
          const catCompleted = catObjs.filter(o => completedIds.includes(o.id)).length;
          const catUnclaimed = catObjs.filter(o => unclaimedIds.includes(o.id)).length;
          const isActive = currentCategory === catKey;
          return (
            <button
              key={catKey}
              onClick={() => { setSelectedCategory(catKey); setSelectedId(null); }}
              className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-bold transition border-b-2 -mb-px whitespace-nowrap ${
                isActive
                  ? `${cat.color} border-current`
                  : "text-white border-transparent hover:text-gray-300"
              }`}
            >
              <span className="text-sm">{cat.icon}</span>
              {cat.label}
              <span className="ml-1 text-xs opacity-70">({catCompleted}/{catObjs.length})</span>
              {catUnclaimed > 0 && (
                <span className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white">
                  {catUnclaimed}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Right-edge fade — hint that more tabs exist off-screen on mobile */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-gray-900 to-transparent md:hidden" />
      </div>

      {categoryObjectives.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-white">
          No objectives in this category.
        </div>
      ) : (
        <>
          {/* Mobile: stacked expandable cards */}
          <div className="md:hidden">
            {categoryObjectives.map((obj) => {
              const done = completedIds.includes(obj.id);
              const unclaimed = unclaimedIds.includes(obj.id);
              const isSelected = selectedId === obj.id;
              return (
                <div key={obj.id}>
                  <button
                    onClick={() => setSelectedId(isSelected ? null : obj.id)}
                    className={`w-full text-left px-4 py-3.5 border-b border-gray-800/30 transition-all border-l-[3px] ${
                      done && !isSelected ? "bg-emerald-950/20" : ""
                    } ${isSelected ? "bg-blue-950/40 border-l-blue-500" : "border-l-transparent hover:bg-gray-800/40"}`}
                  >
                    <div className="flex items-center gap-2.5">
                      {done ? (
                        <svg className="w-4.5 h-4.5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <div className="w-4.5 h-4.5 rounded-full border border-gray-600 shrink-0" />
                      )}
                      <span className={`text-base font-bold leading-tight flex-1 ${done ? "text-emerald-400" : "text-white"}`}>{obj.title}</span>
                      {unclaimed && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                      <svg className={`w-5 h-5 shrink-0 text-gray-500 transition-transform ${isSelected ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="mt-1.5 pl-7 flex items-center gap-2 flex-wrap">
                      {obj.xp_reward > 0 && <span className={`text-xs font-bold ${done ? "text-emerald-500/60" : "text-amber-400"}`}>{obj.xp_reward} XP</span>}
                      {!done && obj.expires_at && <span className="text-xs font-bold text-orange-400">⏱ {getTimeRemaining(obj.expires_at)}</span>}
                      {done && !unclaimed && <span className="text-xs font-bold text-emerald-500/60">Completed</span>}
                      {unclaimed && <span className="text-xs font-bold text-red-400">Claim reward!</span>}
                    </div>
                  </button>
                  {isSelected && (
                    <div className="px-4 py-4 bg-gray-800/50 border-b border-gray-800/30">
                      {obj.description && <p className="text-sm text-white mb-3 leading-relaxed">{obj.description}</p>}
                      <RequirementsToggle conditions={obj.conditions} orGroups={obj.or_groups} />
                      <div className="flex items-center gap-2 flex-wrap mb-3 mt-3">
                        {obj.xp_reward > 0 && (
                          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                            <span className="text-amber-400 text-sm font-black">{obj.xp_reward} XP</span>
                          </div>
                        )}
                        {done && !unclaimed ? (
                          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                            <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            <span className="text-emerald-400 text-sm font-bold">Completed</span>
                          </div>
                        ) : !done ? (
                          <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700/50 rounded-lg px-3 py-1.5">
                            <span className="text-white text-sm font-bold">In Progress</span>
                          </div>
                        ) : null}
                        {!done && obj.expires_at && (
                          <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5">
                            <span className="text-orange-400 text-sm font-bold">⏱ {getTimeRemaining(obj.expires_at)}</span>
                          </div>
                        )}
                      </div>
                      {obj.card_image_url && (
                        <div className="mb-3 flex items-center gap-4">
                          <img src={obj.card_image_url} alt={obj.card_name || "Card Reward"} className="w-24 h-32 object-cover rounded-lg border border-gray-700 shadow-lg" />
                          <div>
                            <div className="text-xs font-bold text-white uppercase tracking-wider">Reward</div>
                            {obj.card_name && <div className="text-sm font-bold text-white mt-1">{obj.card_name}</div>}
                          </div>
                        </div>
                      )}
                      {unclaimed && (
                        <button
                          onClick={() => handleClaim(obj.id, obj)}
                          disabled={claimingId === obj.id}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-60 text-sm font-black text-white transition-all"
                        >
                          {claimingId === obj.id ? "Claiming…" : "Claim Reward"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: side-by-side */}
          <div className="hidden md:flex h-[600px]">
            <div className="w-64 shrink-0 border-r border-gray-800/50 overflow-y-auto h-full">
              {categoryObjectives.map((obj) => {
                const done = completedIds.includes(obj.id);
                const unclaimed = unclaimedIds.includes(obj.id);
                const isSelected = (selectedId ?? categoryObjectives[0]?.id) === obj.id;
                return (
                  <button
                    key={obj.id}
                    onClick={() => setSelectedId(obj.id)}
                    className={`w-full text-left px-4 py-3.5 border-b border-gray-800/30 transition-all ${
                      done ? "bg-emerald-950/20" : ""
                    } ${
                      isSelected ? "bg-gray-800/80 border-l-2 border-l-emerald-500" : "hover:bg-gray-800/40 border-l-2 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {done ? (
                        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
                      )}
                      <span className={`text-sm font-bold leading-tight line-clamp-2 flex-1 ${done ? "text-emerald-400" : "text-white"}`}>{obj.title}</span>
                      {unclaimed && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                    </div>
                    <div className="mt-1.5 pl-6 flex items-center gap-2 flex-wrap">
                      {obj.xp_reward > 0 && <span className={`text-xs font-bold ${done ? "text-emerald-500/60" : "text-amber-400"}`}>{obj.xp_reward} XP</span>}
                      {!done && obj.expires_at && <span className="text-xs font-bold text-orange-400">⏱ {getTimeRemaining(obj.expires_at)}</span>}
                      {done && !unclaimed && <span className="text-xs font-bold text-emerald-500/60">Completed</span>}
                      {unclaimed && <span className="text-xs font-bold text-red-400">Claim!</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {selected && (
              <ObjectiveDetail
                obj={selected}
                isDone={completedIds.includes(selected.id)}
                isUnclaimed={unclaimedIds.includes(selected.id)}
                onClaim={() => handleClaim(selected.id, selected)}
                claiming={claimingId === selected.id}
              />
            )}
          </div>
        </>
      )}
      {claimModal && (
        <ObjectiveClaimModal result={claimModal} onClose={() => setClaimModal(null)} />
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
