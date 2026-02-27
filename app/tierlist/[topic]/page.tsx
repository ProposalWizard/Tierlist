/**
 * app/tierlist/[topic]/page.tsx
 *
 * Server Component for the tierlist page.
 *
 * Responsibilities:
 *  1. Authenticate the user – redirect to /auth if not logged in.
 *  2. Fetch the topic + 12 players from Supabase.
 *  3. Fetch any existing rankings the user has saved for this topic.
 *  4. Pass all data to the client-side <TierlistBoard /> component.
 */

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TierlistBoard from "@/components/TierlistBoard";
import type { TierlistPlayer, TierlistTopic, TierlistRanking } from "@/lib/types";

interface PageProps {
  params: Promise<{ topic: string }>;
}

export default async function TierlistPage({ params }: PageProps) {
  const { topic: slug } = await params;
  const supabase = await createClient();

  // ── 1. Auth check ──────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?next=/tierlist/${slug}`);
  }

  // ── 2. Load the topic ──────────────────────────────────────────
  const { data: topic, error: topicError } = await supabase
    .from("tierlist_topics")
    .select("*")
    .eq("slug", slug)
    .single<TierlistTopic>();

  if (topicError || !topic) {
    notFound();
  }

  // ── 3. Load the 12 players for this topic ──────────────────────
  const { data: players, error: playersError } = await supabase
    .from("tierlist_players")
    .select("*")
    .eq("topic_id", topic.id)
    .order("created_at", { ascending: true })
    .returns<TierlistPlayer[]>();

  if (playersError || !players) {
    notFound();
  }

  // ── 4. Load existing rankings (if any) for this user + topic ───
  const { data: existingRankings } = await supabase
    .from("tierlist_rankings")
    .select("player_id, tier")
    .eq("user_id", user.id)
    .eq("topic_id", topic.id)
    .returns<Pick<TierlistRanking, "player_id" | "tier">[]>();

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Page header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">
            ⚽ {topic.title}
          </h1>
          {topic.description && (
            <p className="mt-1 text-sm text-gray-400">{topic.description}</p>
          )}
        </div>

        {/* User info + sign-out */}
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span className="hidden md:inline">{user.email}</span>
          {/* Sign-out is a form POST to avoid GET-based CSRF */}
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* The interactive drag-and-drop board (Client Component) */}
      <TierlistBoard
        topic={topic}
        players={players}
        existingRankings={existingRankings ?? []}
        userId={user.id}
      />
    </main>
  );
}
