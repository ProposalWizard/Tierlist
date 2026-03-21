"use client";

import { useState } from "react";
import Link from "next/link";
import ImageWithFallback from "@/components/ImageWithFallback";
import type { UserProfile } from "@/lib/types";

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

export default function ProfileClient({ userEmail, profile, created, liked, saved, savedImages }: Props) {
  // ── Username / anonymous settings ──────────────────────────────────────────
  const [username, setUsername]     = useState(profile?.username ?? "");
  const [isAnon, setIsAnon]         = useState(profile?.is_anonymous ?? false);
  const [savingProfile, setSaving]  = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Created tierlists ──────────────────────────────────────────────────────
  const [createdList, setCreated]   = useState(created);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId]   = useState<string | null>(null);

  // ── Saved profile images ─────────────────────────────────────────────────
  const [profileImages, setProfileImages] = useState(savedImages);
  const [viewingImage, setViewingImage]   = useState<SavedProfileImage | null>(null);
  const [confirmDeleteImageId, setConfirmDeleteImageId] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  const streak  = profile?.current_streak ?? 1;
  const longest = profile?.longest_streak ?? 1;

  async function saveProfile() {
    setSaving(true);
    setProfileMsg(null);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() || null, is_anonymous: isAnon }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) setProfileMsg({ ok: true,  text: "Saved!" });
    else        setProfileMsg({ ok: false, text: data.error ?? "Something went wrong" });
  }

  async function deleteProfileImage(id: string) {
    setDeletingImageId(id);
    const res = await fetch(`/api/profile/images/${id}`, { method: "DELETE" });
    setDeletingImageId(null);
    setConfirmDeleteImageId(null);
    if (res.ok) setProfileImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function deleteTierlist(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/tierlists/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setConfirmId(null);
    if (res.ok) setCreated((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Section renderer ───────────────────────────────────────────────────────
  function TierlistGrid({
    items,
    showDelete = false,
    emptyMsg,
  }: {
    items: TierlistSummary[];
    showDelete?: boolean;
    emptyMsg: string;
  }) {
    if (items.length === 0) {
      return (
        <p className="py-8 text-center text-sm italic text-gray-600">{emptyMsg}</p>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((tl) => (
          <div key={tl.id} className="group relative overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
            <Link href={`/play/${tl.id}`}>
              <div className="flex h-28 items-center justify-center overflow-hidden bg-gray-800">
                {tl.cover_image_url ? (
                  <ImageWithFallback src={tl.cover_image_url} alt={tl.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <span className="text-3xl">🏆</span>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-semibold text-white">{tl.title}</p>
                <p className="text-[10px] text-gray-500">{new Date(tl.created_at).toLocaleDateString()}</p>
                {tl.view_count !== undefined && (
                  <p className="text-[10px] text-gray-600">👁 {tl.view_count.toLocaleString()} views</p>
                )}
              </div>
            </Link>
            {showDelete && (
              <button
                onClick={() => setConfirmId(tl.id)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Delete"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      {/* ── Account settings ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-bold text-white">Account Settings</h2>
        <p className="mb-4 text-sm text-gray-400">{userEmail}</p>

        <div className="space-y-4">
          {/* Username */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-300">
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username…"
              maxLength={32}
              className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">
              This is shown as the creator of your tierlists. Leave blank to be anonymous.
            </p>
          </div>

          {/* Anonymous toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isAnon}
              onChange={(e) => setIsAnon(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 accent-indigo-600"
            />
            <span className="text-sm text-gray-300">
              Show as <span className="font-semibold text-white">Anonymous</span> on all tierlists
            </span>
          </label>

          {profileMsg && (
            <p className={`text-sm ${profileMsg.ok ? "text-green-400" : "text-red-400"}`}>
              {profileMsg.text}
            </p>
          )}

          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {savingProfile ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </section>

      {/* ── Login streak ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-bold text-white">Login Streak</h2>
        <div className="flex flex-wrap gap-6">
          <div className="text-center">
            <p className="text-4xl font-black text-orange-400">{streak}</p>
            <p className="mt-1 text-xs text-gray-500">day{streak !== 1 ? "s" : ""} in a row</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-black text-yellow-400">{longest}</p>
            <p className="mt-1 text-xs text-gray-500">longest streak</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-black text-indigo-400">{createdList.length}</p>
            <p className="mt-1 text-xs text-gray-500">tierlists created</p>
          </div>
        </div>
      </section>

      {/* ── My Tierlists ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-white">
          My Tierlists
          <span className="ml-2 text-sm font-normal text-gray-500">({createdList.length})</span>
        </h2>
        <TierlistGrid items={createdList} showDelete emptyMsg="You haven't created any tierlists yet." />
      </section>

      {/* ── Bookmarked Tierlists ──────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-white">
          Bookmarked Tierlists
          <span className="ml-2 text-sm font-normal text-gray-500">({saved.length})</span>
        </h2>
        <TierlistGrid items={saved} emptyMsg="You haven't bookmarked any tierlists yet." />
      </section>

      {/* ── Saved Tierlist Images ──────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-white">
          Saved Images
          <span className="ml-2 text-sm font-normal text-gray-500">({profileImages.length})</span>
        </h2>
        {profileImages.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-gray-600">
            You haven&apos;t saved any tierlist images yet. Use the &quot;Save to Profile&quot; button when playing a tierlist.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {profileImages.map((img) => (
              <div key={img.id} className="group relative overflow-hidden rounded-xl border border-gray-700 bg-gray-900 cursor-pointer">
                <div
                  onClick={() => setViewingImage(img)}
                  className="flex h-36 items-center justify-center overflow-hidden bg-gray-800"
                >
                  <img src={img.image_url} alt={img.tierlist_title ?? "Saved tierlist"}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </div>
                <div className="p-2">
                  {img.tierlist_title && (
                    <p className="truncate text-xs font-semibold text-white">{img.tierlist_title}</p>
                  )}
                  <p className="text-[10px] text-gray-500">{new Date(img.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteImageId(img.id); }}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Full-size image viewer ─────────────────────────────────────────── */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewingImage.image_url}
              alt={viewingImage.tierlist_title ?? "Saved tierlist"}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />
            <div className="mt-3 flex items-center justify-between">
              {viewingImage.tierlist_title && (
                <p className="text-sm font-semibold text-white">{viewingImage.tierlist_title}</p>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => { setConfirmDeleteImageId(viewingImage.id); setViewingImage(null); }}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Delete
                </button>
                <button
                  onClick={() => setViewingImage(null)}
                  className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-gray-400 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete saved image confirmation modal ──────────────────────────── */}
      {confirmDeleteImageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white">Delete this saved image?</h3>
            <p className="mt-2 text-sm text-gray-400">
              This permanently removes the image from your profile. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => deleteProfileImage(confirmDeleteImageId)}
                disabled={!!deletingImageId}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deletingImageId ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setConfirmDeleteImageId(null)}
                disabled={!!deletingImageId}
                className="flex-1 rounded-lg border border-gray-600 py-2.5 text-sm font-semibold text-gray-300 hover:border-gray-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white">Delete this tierlist?</h3>
            <p className="mt-2 text-sm text-gray-400">
              This permanently deletes the tierlist and all its images. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => deleteTierlist(confirmId)}
                disabled={!!deletingId}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deletingId ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setConfirmId(null)}
                disabled={!!deletingId}
                className="flex-1 rounded-lg border border-gray-600 py-2.5 text-sm font-semibold text-gray-300 hover:border-gray-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
