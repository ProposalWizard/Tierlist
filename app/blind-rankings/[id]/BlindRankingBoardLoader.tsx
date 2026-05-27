"use client";

import dynamic from "next/dynamic";
import type { BlindRankingImage } from "@/lib/types";

const BlindRankingBoard = dynamic(() => import("@/components/BlindRankingBoard"), { ssr: false });

interface Props {
  rankingId: string;
  title: string;
  numSlots: number;
  images: BlindRankingImage[];
  faceDetectionEnabled?: boolean;
}

export default function BlindRankingBoardLoader(props: Props) {
  return <BlindRankingBoard {...props} />;
}
