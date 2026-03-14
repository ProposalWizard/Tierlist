"use client";

/**
 * components/PlayCommunityVote.tsx
 *
 * A collapsible "Community's Vote" section shown on regular tierlist pages
 * when linked to a vote tierlist. Toggles open/closed.
 */

import { useState } from "react";
import CommunityVote from "./CommunityVote";
import type { VoteTier } from "@/lib/types";

interface ImageData {
  id: string;
  name: string;
  image_url: string;
  vote_counts: Record<string, number>;
  total_votes: number;
}

interface Props {
  tiers: VoteTier[];
  images: ImageData[];
  votelistTitle: string;
}

export default function PlayCommunityVote({ tiers, images, votelistTitle }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-purple-700 bg-purple-900/30 px-4 py-2 text-sm font-semibold text-purple-300 hover:bg-purple-800/40 transition-colors"
      >
        {open ? "Hide Community\u2019s Vote" : "Community\u2019s Vote"}
      </button>

      {open && (
        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="mb-3 text-xs text-gray-500">
            Based on community votes from: <span className="text-gray-300 font-medium">{votelistTitle}</span>
          </p>
          <CommunityVote
            tiers={tiers}
            images={images}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
