"use client";

import dynamic from "next/dynamic";
import type { TenablePuzzle } from "@/lib/types";

const TenableGame = dynamic(() => import("@/components/TenableGame"), { ssr: false });

export default function TenableGameLoader({ puzzle }: { puzzle: TenablePuzzle }) {
  return <TenableGame puzzle={puzzle} />;
}
