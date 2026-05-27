"use client";

import dynamic from "next/dynamic";
import type { VoteTier } from "@/lib/types";

const PlayCommunityVote = dynamic(() => import("@/components/PlayCommunityVote"), { ssr: false });

interface Props {
  tiers: VoteTier[];
  images: Array<{
    id: string;
    name: string;
    image_url: string;
    vote_counts: Record<string, number>;
    total_votes: number;
  }>;
  votelistTitle: string;
  votelistId: string;
}

export default function PlayCommunityVoteLoader(props: Props) {
  return <PlayCommunityVote {...props} />;
}
