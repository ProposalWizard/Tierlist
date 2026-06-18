"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ImageWithFallback from "@/components/ImageWithFallback";
import ProfileHeader from "@/components/profile/ProfileHeader";
import XPProgressBar from "@/components/profile/XPProgressBar";
import StatsGrid from "@/components/profile/StatsGrid";
import TrophyCabinet from "@/components/profile/TrophyCabinet";
import RecentActivity from "@/components/profile/RecentActivity";
import WaysToEarnXP from "@/components/profile/WaysToEarnXP";
import CardDesigns from "@/components/profile/CardDesigns";
import PersonalRecords from "@/components/profile/PersonalRecords";
import SettingsModal from "@/components/profile/SettingsModal";
import type { UserProfile } from "@/lib/types";
import type { UserProgression } from "@/lib/xp";

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

type ProfileTab = "dashboard" | "tierlists" | "saved";

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
    { key: "tierlists", label: `My Tierlists (${createdList.length})`, icon: "🖼️" },
    { key: "saved", label: `Saved (${saved.length + profileImages.length})`, icon: "💾" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4">
      {/* Tab bar - sleek dark design */}
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
      </div>

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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column — Profile Card + Card Designs */}
              <div className="lg:col-span-3 space-y-5">
                <ProfileHeader
                  username={username || null}
                  email={userEmail}
                  progression={progression}
                  loginStreak={profile?.current_streak ?? 0}
                  tierlistsCreated={createdList.length}
                  onOpenSettings={() => setShowSettings(true)}
                />
                <CardDesigns
                  rewards={progression?.rewards ?? []}
                  equippedFrame={progression?.equippedFrame ?? "frame_default"}
                  onEquip={(_, id) => handleEquip("frame", id)}
                />
              </div>

              {/* Center Column — Road to Legend + Stats + Activity */}
              <div className="lg:col-span-5 space-y-5">
                <XPProgressBar progression={progression} />
                <StatsGrid
                  stats={progression?.stats ?? null}
                  loginStreak={profile?.current_streak ?? 0}
                  longestStreak={profile?.longest_streak ?? 0}
                  tierlistsCreated={createdList.length}
                />
                <PersonalRecords />
                <RecentActivity events={progression?.recentXpEvents ?? []} />
              </div>

              {/* Right Column — Trophy Cabinet + Ways to Earn XP */}
              <div className="lg:col-span-4 space-y-5">
                <TrophyCabinet
                  rewards={progression?.rewards ?? []}
                  stats={progression?.stats ?? null}
                  level={progression?.level ?? 1}
                  equippedFrame={progression?.equippedFrame ?? "frame_default"}
                  equippedTitle={progression?.equippedTitle ?? "title_rookie"}
                  onEquip={handleEquip}
                />
                <WaysToEarnXP />
              </div>
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
