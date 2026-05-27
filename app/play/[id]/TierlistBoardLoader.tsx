"use client";

import dynamic from "next/dynamic";

const TierlistBoard = dynamic(() => import("@/components/TierlistBoard"), { ssr: false });

interface Props {
  initialImages?: Array<{
    id: string;
    name: string;
    image_url: string;
    face_center?: { x: number; y: number } | null;
  }>;
  mode?: "play" | "create";
  isAdmin?: boolean;
  tierlistId?: string;
  tierlistTitle?: string;
  isLoggedIn?: boolean;
  initialTiers?: Array<{ label: string; color: string }>;
  faceDetectionEnabled?: boolean;
}

export default function TierlistBoardLoader(props: Props) {
  return <TierlistBoard {...props} />;
}
