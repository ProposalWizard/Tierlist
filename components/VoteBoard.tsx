"use client";

/**
 * components/VoteBoard.tsx
 *
 * The interactive voting UI for a vote tierlist.
 *
 * - Shows every image with its current vote-percentage breakdown.
 * - Lets the user click a tier to cast or change their vote.
 * - Works for both logged-in and anonymous users.
 *   Anonymous voters get a UUID stored in localStorage so their vote
 *   persists across page refreshes (and is difficult to repeat without
 *   clearing storage / using a different browser).
 */

import { useEffect, useRef, useState } from "react";
import type { VoteImageWithCounts, VoteTier } from "@/lib/types";

// ── localStorage key for the anonymous voter ID ──────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  votelistId: string;
  tiers: VoteTier[];
  initialImages: VoteImageWithCounts[];
  /** Pre-filled for logged-in users (server-side); empty for anon users */
  initialUserVotes: Record<string, string>;
  isLoggedIn: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  const voterIdRef = useRef<string>("");

  // On mount: get/create anonymous voter ID, then fetch their existing votes
  useEffect(() => {
    voterIdRef.current = getOrCreateVoterId();

    if (!isLoggedIn && voterIdRef.current) {
      fetch(
        `/api/vote-tierlists/${votelistId}/my-votes?voter_id=${encodeURIComponent(voterIdRef.current)}`
      )
        .then((r) => r.json())
        .then((votes: Record<string, string>) => {
          if (votes && typeof votes === "object" && !("error" in votes)) {
            setUserVotes(votes);
          }
        })
        .catch(() => {/* silently ignore */});
    }
  }, [votelistId, isLoggedIn]);

  async function castVote(imageId: string, tierLabel: string) {
    // Don't double-submit
    if (pending[imageId]) return;

    // Optimistic update
    const previousVote = userVotes[imageId] ?? null;
    const previousImages = images;

    setUserVotes((prev) => ({ ...prev, [imageId]: tierLabel }));
    setImages((prev) =>
      prev.map((img) => {
        if (img.id !== imageId) return img;
        const counts = { ...img.vote_counts };
        // Remove previous vote count
        if (previousVote) counts[previousVote] = Math.max(0, (counts[previousVote] ?? 1) - 1);
        // Add new vote count
        counts[tierLabel] = (counts[tierLabel] ?? 0) + 1;
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return { ...img, vote_counts: counts, total_votes: total, user_vote: tierLabel };
      })
    );

    setPending((p) => ({ ...p, [imageId]: true }));

    try {
      const body: Record<string, string> = { image_id: imageId, tier_label: tierLabel };
      if (!isLoggedIn) body.voter_id = voterIdRef.current;

      const res = await fetch(`/api/vote-tierlists/${votelistId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("vote failed");

      // Replace with server counts to stay accurate
      const { vote_counts, total_votes } = await res.json() as {
        vote_counts: Record<string, number>;
        total_votes: number;
      };
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, vote_counts, total_votes } : img
        )
      );
    } catch {
      // Revert on failure
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

  return (
    <div className="space-y-4">
      {images.map((img) => {
        const myVote = userVotes[img.id] ?? null;
        const isPending = pending[img.id] ?? false;

        return (
          <ImageVoteCard
            key={img.id}
            image={img}
            tiers={tiers}
            myVote={myVote}
            isPending={isPending}
            onVote={(tierLabel) => castVote(img.id, tierLabel)}
          />
        );
      })}
    </div>
  );
}

// ── ImageVoteCard ─────────────────────────────────────────────────────────────

interface CardProps {
  image: VoteImageWithCounts;
  tiers: VoteTier[];
  myVote: string | null;
  isPending: boolean;
  onVote: (tierLabel: string) => void;
}

function ImageVoteCard({ image, tiers, myVote, isPending, onVote }: CardProps) {
  const totalVotes = image.total_votes;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
      <div className="flex gap-4 p-4">
        {/* Image */}
        <div className="flex-shrink-0">
          <div
            className="h-24 w-24 rounded-lg bg-gray-800 bg-cover bg-center"
            style={{ backgroundImage: `url(${image.image_url})` }}
            title={image.name}
          />
        </div>

        {/* Name + vote bars */}
        <div className="min-w-0 flex-1">
          <p className="mb-3 font-semibold text-white">{image.name}</p>

          <div className="space-y-2">
            {tiers.map((tier) => {
              const count = image.vote_counts[tier.label] ?? 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isMyVote = myVote === tier.label;

              return (
                <button
                  key={tier.label}
                  onClick={() => onVote(tier.label)}
                  disabled={isPending}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-all
                    ${isMyVote
                      ? "ring-2 ring-white/60"
                      : "hover:bg-gray-800"}
                    ${isPending ? "cursor-wait opacity-70" : "cursor-pointer"}
                  `}
                  style={{
                    backgroundColor: isMyVote ? tier.color + "33" : undefined,
                  }}
                >
                  {/* Tier label badge */}
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs font-bold text-gray-900"
                    style={{ backgroundColor: tier.color }}
                  >
                    {tier.label}
                  </span>

                  {/* Progress bar */}
                  <div className="relative flex-1 overflow-hidden rounded-full bg-gray-800" style={{ height: 8 }}>
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: tier.color, opacity: 0.8 }}
                    />
                  </div>

                  {/* Percentage */}
                  <span className="w-9 flex-shrink-0 text-right text-xs text-gray-400">
                    {pct}%
                  </span>

                  {/* Checkmark for user's vote */}
                  <span className="w-4 flex-shrink-0 text-center text-xs text-white">
                    {isMyVote ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Vote count */}
          <p className="mt-2 text-right text-xs text-gray-600">
            {totalVotes === 0
              ? "No votes yet — be the first!"
              : `${totalVotes} vote${totalVotes === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>
    </div>
  );
}
