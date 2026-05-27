"use client";

import dynamic from "next/dynamic";

const CreateBlindRanking = dynamic(() => import("@/components/CreateBlindRanking"), { ssr: false });

export default function CreateBlindRankingLoader() {
  return <CreateBlindRanking />;
}
