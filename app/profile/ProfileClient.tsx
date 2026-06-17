"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ImageWithFallback from "@/components/ImageWithFallback";
import ProfileHeader from "@/components/profile/ProfileHeader";
import XPProgressBar from "@/components/profile/XPProgressBar";
import StatsGrid from "@/components/profile/StatsGrid";
import TrophyCabinet from "@/components/profile/TrophyCabinet";
import RecentActivity from "@/components/profile/RecentActivity";
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

type ProfileTab = "overview" | "tierlists" | "saved";

export default function ProfileClient({ userEmail, profile, created, liked, saved, savedImages }: Props) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
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

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "tierlists", label: `My Tierlists (${createdList.length})` },
    { key: "saved", label: `Saved (${saved.length + profileImages.length})` },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Profile Header */}
      <ProfileHeader
        username={username || null}
        email={userEmail}
        progression={progression}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* XP Bar */}
      <XPProgressBar progression={progression} />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-800/50 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-xs font-bold tracking-wide transition-colors rounded-t-lg ${
              activeTab === tab.key
                ? "text-amber-400 bg-gray-900 border border-gray-800/50 border-b-transparent -mb-px"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {loadingProgression ? (
            <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-8 text-center">
              <div className="text-gray-500 text-sm animate-pulse">Loading progression...</div>
            </div>
          ) : (
            <>
              <StatsGrid
                stats={progression?.stats ?? null}
                loginStreak={profile?.current_streak ?? 0}
                longestStreak={profile?.longest_streak ?? 0}
                tierlistsCreated={createdList.length}
              />
              <TrophyCabinet rewards={progression?.rewards ?? []} />
              <RecentActivity events={progression?.recentXpEvents ?? []} />
            </>
          )}
        </div>
      )}

      {activeTab === "tierlists" && (
        <div className="space-y-4">
          <TierlistGrid items={createdList} showDelete emptyMsg="You haven't created any tierlists yet." onDelete={setConfirmId} />
        </div>
      )}

      {activeTab === "saved" && (
        <div className="space-y-6">
          {/* Bookmarked tierlists */}
          <section>
            <h3 className="text-sm font-bold text-gray-400 mb-3">Bookmarked Tierlists</h3>
            <TierlistGrid items={saved} emptyMsg="No bookmarked tierlists." />
          </section>

          {/* Liked tierlists */}
          <section>
            <h3 className="text-sm font-bold text-gray-400 mb-3">Liked Tierlists</h3>
            <TierlistGrid items={liked} emptyMsg="No liked tierlists." />
          </section>

          {/* Saved images */}
          <section>
            <h3 className="text-sm font-bold text-gray-400 mb-3">
              Saved Images ({profileImages.length})
            </h3>
            {profileImages.length === 0 ? (
              <p className="py-6 text-center text-xs italic text-gray-600">
                No saved images yet. Use &quot;Save to Profile&quot; when playing a tierlist.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {profileImages.map(img => (
                  <div key={img.id} className="group relative overflow-hidden rounded-xl border border-gray-700 bg-gray-900 cursor-pointer">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setViewingImage(null)}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
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
    return <p className="py-6 text-center text-xs italic text-gray-600">{emptyMsg}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map(tl => (
        <div key={tl.id} className="group relative overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
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
