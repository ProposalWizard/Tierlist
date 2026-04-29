import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TicTacToeBuilder from "@/components/TicTacToeBuilder";

export const metadata: Metadata = {
  title: "Create a Tic Tac Toe — Knowitball",
  description: "Build your own Football Tic Tac Toe puzzle for the community to play.",
};

export default async function CreateTicTacToePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/tic-tac-toe/create");
  }

  return <TicTacToeBuilder />;
}
