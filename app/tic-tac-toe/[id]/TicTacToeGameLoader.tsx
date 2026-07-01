"use client";

import dynamic from "next/dynamic";
import type { TicTacToePuzzle } from "@/lib/types";

const TicTacToeGame = dynamic(() => import("@/components/TicTacToeGame"), { ssr: false });

export default function TicTacToeGameLoader({ puzzle }: { puzzle: TicTacToePuzzle }) {
  return <TicTacToeGame puzzle={puzzle} isDaily={puzzle.is_daily} />;
}
