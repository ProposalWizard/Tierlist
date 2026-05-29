"use client";

import dynamic from "next/dynamic";
import type { TicTacToePuzzle } from "@/lib/types";

const EasyTTTGame = dynamic(() => import("@/components/EasyTTTGame"), { ssr: false });

export default function EasyTTTGameLoader({ puzzle }: { puzzle: TicTacToePuzzle }) {
  return <EasyTTTGame puzzle={puzzle} />;
}
