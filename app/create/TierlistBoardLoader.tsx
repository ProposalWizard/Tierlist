"use client";

import dynamic from "next/dynamic";

const TierlistBoard = dynamic(() => import("@/components/TierlistBoard"), { ssr: false });

interface Props {
  mode?: "play" | "create";
  isAdmin?: boolean;
}

export default function TierlistBoardLoader(props: Props) {
  return <TierlistBoard {...props} />;
}
