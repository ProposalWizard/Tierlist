import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Easy Mode — Football Tic Tac Toe",
  description: "Play a random easy Football Tic Tac Toe puzzle!",
};

export const dynamic = "force-dynamic";

export default async function EasyModePage() {
  const service = createServiceClient();
  const { data } = await service
    .from("tictactoe_puzzles")
    .select("id")
    .eq("is_active", true)
    .eq("difficulty", "easy");

  if (!data || data.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-black mb-2">No Easy Puzzles Yet</h1>
          <p className="text-gray-400 text-sm">Easy puzzles are coming soon!</p>
          <a href="/tic-tac-toe" className="mt-4 inline-block rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-500">
            Back to Tic Tac Toe
          </a>
        </div>
      </div>
    );
  }

  const random = data[Math.floor(Math.random() * data.length)];
  redirect(`/tic-tac-toe/${random.id}`);
}
