"use client";

/**
 * components/PlayCommunityVote.tsx
 *
 * A collapsible "Community's Vote" section shown on regular tierlist pages
 * when linked to a vote tierlist. Toggles open/closed.
 */

import { useState } from "react";
import Link from "next/link";
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
  votelistId: string;
}

export default function PlayCommunityVote({ tiers, images, votelistTitle, votelistId }: Props) {
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
          <Link
            href={`/vote/${votelistId}`}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 text-base font-bold text-white shadow-lg shadow-purple-600/20 transition-transform hover:scale-[1.02]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Vote Here
          </Link>
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
