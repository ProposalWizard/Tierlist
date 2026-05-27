"use client";

import dynamic from "next/dynamic";
import type { VoteImageWithCounts, VoteTier } from "@/lib/types";

const VoteBoard = dynamic(() => import("@/components/VoteBoard"), { ssr: false });

interface Props {
  votelistId: string;
  tiers: VoteTier[];
  initialImages: VoteImageWithCounts[];
  initialUserVotes: Record<string, string>;
  isLoggedIn: boolean;
  faceDetectionEnabled?: boolean;
}

export default function VoteBoardLoader(props: Props) {
  return <VoteBoard {...props} />;
}
