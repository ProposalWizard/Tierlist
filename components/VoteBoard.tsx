"use client";

/**
 * components/VoteBoard.tsx
 *
 * Tierlist-style voting UI.
 * - Tier rows show images the user has voted into them.
 * - Unvoted images sit in the pool below.
 * - Clicking any image opens:
 *     Desktop → sticky right-side panel with stats + vote buttons
 *     Mobile  → fixed bottom bar with compact vote buttons
 * - After voting, automatically advances to the next unvoted image.
 * - Optimistic UI with server reconciliation.
 */

import { useEffect, useRef, useState } from "react";
import type { VoteImageWithCounts, VoteTier } from "@/lib/types";

const VOTER_ID_KEY = "vote_voter_id";

function getOrCreateVoterId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(VOTER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VOTER_ID_KEY, id);
  }
  return id;
}

interface Props {
  votelistId: string;
  tiers: VoteTier[];
  initialImages: VoteImageWithCounts[];
  initialUserVotes: Record<string, string>;
  isLoggedIn: boolean;
}

export default function VoteBoard({
  votelistId,
  tiers,
  initialImages,
  initialUserVotes,
  isLoggedIn,
}: Props) {
  const [images, setImages] = useState<VoteImageWithCounts[]>(initialImages);
  const [userVotes, setUserVotes] = useState<Record<string, string>>(initialUserVotes);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const voterIdRef = useRef<string>("");

  useEffect(() => {
    voterIdRef.current = getOrCreateVoterId();
    if (!isLoggedIn && voterIdRef.current) {
      fetch(`/api/vote-tierlists/${votelistId}/my-votes?voter_id=${encodeURIComponent(voterIdRef.current)}`)
        .then((r) => r.json())
        .then((votes: Record<string, string>) => {
          if (votes && typeof votes === "object" && !("error" in votes)) {
            setUserVotes(votes);
          }
        })
        .catch(() => {});
    }
  }, [votelistId, isLoggedIn]);

  async function castVote(imageId: string, tierLabel: string) {
    if (pending[imageId]) return;
    const previousVote = userVotes[imageId] ?? null;
    const previousImages = images;
    const tierSet = new Set(tiers.map((t) => t.label));

    const newUserVotes = { ...userVotes, [imageId]: tierLabel };
    setUserVotes(newUserVotes);

    setImages((prev) =>
      prev.map((img) => {
        if (img.id !== imageId) return img;
        const counts = { ...img.vote_counts };
        if (previousVote) counts[previousVote] = Math.max(0, (counts[previousVote] ?? 1) - 1);
        counts[tierLabel] = (counts[tierLabel] ?? 0) + 1;
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return { ...img, vote_counts: counts, total_votes: total, user_vote: tierLabel };
      })
    );
    setPending((p) => ({ ...p, [imageId]: true }));

    // Auto-advance to next unvoted image in pool
    const newPool = images.filter((img) => {
      const v = newUserVotes[img.id];
      return !v || !tierSet.has(v);
    });
    const next = newPool.find((img) => img.id !== imageId);
    setSelectedId(next?.id ?? null);

    try {
      const body: Record<string, string> = { image_id: imageId, tier_label: tierLabel };
      if (!isLoggedIn) body.voter_id = voterIdRef.current;

      const res = await fetch(`/api/vote-tierlists/${votelistId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("vote failed");

      const { vote_counts, total_votes } = (await res.json()) as {
        vote_counts: Record<string, number>;
        total_votes: number;
      };
      setImages((prev) =>
        prev.map((img) => (img.id === imageId ? { ...img, vote_counts, total_votes } : img))
      );
    } catch {
      setUserVotes((prev) => {
        const next = { ...prev };
        if (previousVote) next[imageId] = previousVote;
        else delete next[imageId];
        return next;
      });
      setImages(previousImages);
    } finally {
      setPending((p) => ({ ...p, [imageId]: false }));
    }
  }

  const imagesByTier: Record<string, VoteImageWithCounts[]> = {};
  for (const t of tiers) imagesByTier[t.label] = [];
  const pool: VoteImageWithCounts[] = [];

  for (const img of images) {
    const vote = userVotes[img.id];
    if (vote && imagesByTier[vote]) {
      imagesByTier[vote].push(img);
    } else {
      pool.push(img);
    }
  }

  const selectedImg = selectedId ? (images.find((i) => i.id === selectedId) ?? null) : null;
  const votedCount = images.length - pool.length;

  return (
    <>
      {/* ── Main layout: stack on mobile, side-by-side on desktop ── */}
      <div className="flex flex-col gap-4 md:flex-row md:gap-5 md:items-start">
        {/* ── Tierlist + pool ── */}
        <div className="flex-1 min-w-0 overflow-hidden rounded-xl border border-gray-800">
          {tiers.map((tier) => (
            <div key={tier.label} className="flex min-h-[64px] border-b border-gray-800/60 last:border-b-0">
              <div
                className="flex w-10 flex-shrink-0 items-center justify-center text-base font-black text-gray-900 select-none md:w-14 md:text-xl"
                style={{ backgroundColor: tier.color }}
              >
                {tier.label}
              </div>
              <div className="flex flex-wrap items-start gap-1 p-1.5 bg-gray-900/60">
                {imagesByTier[tier.label].map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedId(img.id === selectedId ? null : img.id)}
                    title={img.name || undefined}
                    className={`overflow-hidden rounded transition-all ${
                      selectedId === img.id
                        ? "ring-2 ring-white"
                        : "hover:ring-2 hover:ring-gray-400 opacity-90 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.image_url} alt={img.name} className="h-12 w-12 object-cover md:h-16 md:w-16" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Pool */}
          <div className="bg-gray-900/30 p-3 border-t border-gray-800">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {pool.length > 0 ? `${pool.length} remaining — tap to vote` : `All ${images.length} voted ✓`}
            </p>
            {pool.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {pool.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedId(img.id === selectedId ? null : img.id)}
                    title={img.name || undefined}
                    className={`overflow-hidden rounded transition-all ${
                      selectedId === img.id
                        ? "ring-2 ring-white"
                        : "hover:ring-2 hover:ring-gray-400 opacity-90 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.image_url} alt={img.name} className="h-12 w-12 object-cover md:h-16 md:w-16" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Desktop side panel (hidden on mobile) ── */}
        <div className="hidden md:block w-60 flex-shrink-0 sticky top-20 space-y-3">
          {/* Progress */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Progress</span>
              <span className="text-xs font-semibold text-white">{votedCount}/{images.length}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-500"
                style={{ width: images.length > 0 ? `${(votedCount / images.length) * 100}%` : "0%" }}
              />
            </div>
          </div>

          {selectedImg ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedImg.image_url}
                alt={selectedImg.name}
                className="mb-3 w-full rounded-lg object-cover"
                style={{ maxHeight: 160 }}
              />
              {selectedImg.name && (
                <p className="mb-3 text-center text-sm font-semibold text-white truncate">
                  {selectedImg.name}
                </p>
              )}

              {/* Stats */}
              <div className="mb-4 space-y-1.5">
                {tiers.map((tier) => {
                  const count = selectedImg.vote_counts[tier.label] ?? 0;
                  const total = selectedImg.total_votes;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const isMyVote = userVotes[selectedImg.id] === tier.label;
                  return (
                    <div key={tier.label} className="flex items-center gap-1.5">
                      <span
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-black text-gray-900"
                        style={{ backgroundColor: tier.color }}
                      >
                        {tier.label}
                      </span>
                      <div className="relative flex-1 overflow-hidden rounded-full bg-gray-800" style={{ height: 6 }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: tier.color, opacity: 0.85 }}
                        />
                      </div>
                      <span className="w-8 flex-shrink-0 text-right text-[10px] text-gray-400">{pct}%</span>
                      {isMyVote && <span className="text-[10px] text-white">✓</span>}
                    </div>
                  );
                })}
                <p className="mt-1 text-right text-[10px] text-gray-600">
                  {selectedImg.total_votes === 0
                    ? "No votes yet"
                    : `${selectedImg.total_votes} vote${selectedImg.total_votes === 1 ? "" : "s"}`}
                </p>
              </div>

              {/* Vote buttons */}
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Your vote
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tiers.map((tier) => {
                  const isMyVote = userVotes[selectedImg.id] === tier.label;
                  const isPending = pending[selectedImg.id] ?? false;
                  return (
                    <button
                      key={tier.label}
                      onClick={() => castVote(selectedImg.id, tier.label)}
                      disabled={isPending}
                      className={`flex-1 min-w-[2rem] rounded-lg py-2.5 text-sm font-black text-gray-900 transition-all disabled:opacity-50 ${
                        isMyVote
                          ? "ring-2 ring-offset-1 ring-offset-gray-900 ring-white scale-95"
                          : "hover:scale-105 hover:brightness-110"
                      }`}
                      style={{ backgroundColor: tier.color }}
                    >
                      {tier.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-800 p-6 text-center">
              <p className="text-xs text-gray-600">
                Click any image to see how others voted and cast your vote
              </p>
            </div>
          )}
        </div>

        {/* ── Mobile progress bar (visible on mobile, hidden on desktop) ── */}
        <div className="md:hidden rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Progress</span>
            <span className="text-xs font-semibold text-white">{votedCount}/{images.length}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-500"
              style={{ width: images.length > 0 ? `${(votedCount / images.length) * 100}%` : "0%" }}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile fixed bottom vote bar ── */}
      {selectedImg && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800 bg-gray-950/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImg.image_url}
              alt={selectedImg.name}
              className="h-11 w-11 flex-shrink-0 rounded-lg object-cover border border-gray-700"
            />
            <div className="min-w-0 flex-1">
              {selectedImg.name && (
                <p className="truncate text-xs font-semibold text-white">{selectedImg.name}</p>
              )}
              <p className="text-[10px] text-gray-500">
                {selectedImg.total_votes > 0
                  ? `${selectedImg.total_votes} vote${selectedImg.total_votes === 1 ? "" : "s"}`
                  : "No votes yet"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {tiers.map((tier) => {
                const isMyVote = userVotes[selectedImg.id] === tier.label;
                const isPending = pending[selectedImg.id] ?? false;
                return (
                  <button
                    key={tier.label}
                    onClick={() => castVote(selectedImg.id, tier.label)}
                    disabled={isPending}
                    className={`h-10 w-10 rounded-lg text-sm font-black text-gray-900 transition-all disabled:opacity-50 ${
                      isMyVote ? "ring-2 ring-white scale-90" : "hover:brightness-110 active:scale-95"
                    }`}
                    style={{ backgroundColor: tier.color }}
                  >
                    {tier.label}
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedId(null)}
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-gray-700 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer so content isn't hidden behind mobile vote bar */}
      {selectedImg && <div className="h-20 md:hidden" />}
    </>
  );
}
