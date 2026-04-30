import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import type { TicTacToePuzzle } from "@/lib/types";
import dynamic from "next/dynamic";

const TicTacToeGame = dynamic(() => import("@/components/TicTacToeGame"), { ssr: false });

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const service = createServiceClient();
  const { data } = await service
    .from("tictactoe_puzzles")
    .select("title")
    .eq("id", id)
    .single();

  return {
    title: data?.title ? `${data.title} — Football Tic Tac Toe` : "Football Tic Tac Toe",
    description: "Test your football knowledge in this 3x3 grid challenge.",
  };
}

export default async function TicTacToePlayPage({ params }: Props) {
  const { id } = await params;
  const service = createServiceClient();

  const { data, error } = await service
    .from("tictactoe_puzzles")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) notFound();

  const puzzle: TicTacToePuzzle = {
    id: data.id,
    title: data.title,
    difficulty: data.difficulty,
    row_labels: data.row_labels,
    col_labels: data.col_labels,
    grid: data.grid,
    three_in_a_row_bonus: data.three_in_a_row_bonus,
    is_daily: data.is_daily,
    daily_date: data.daily_date,
    is_active: data.is_active,
    info: data.info ?? null,
    display_order: data.display_order ?? 0,
    created_by: data.created_by,
    created_at: data.created_at,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <TicTacToeGame puzzle={puzzle} />
    </div>
  );
}
