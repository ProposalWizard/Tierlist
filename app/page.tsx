/**
 * app/page.tsx
 * Home / lobby page.
 *
 * - Logged-out users: see a hero + topic preview grid with a sign-in CTA.
 * - Logged-in users: see the full lobby and can jump straight into any topic.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { TierlistTopic, TierlistPlayer } from "@/lib/types";

type TopicRow = Pick<TierlistTopic, "id" | "slug" | "title" | "description">;

/** Returns a thematic emoji for a topic based on its slug. */
function topicEmoji(slug: string): string {
  if (slug.includes("champions")) return "🏆";
  if (slug.includes("la-liga")) return "🇪🇸";
  if (slug.includes("goat")) return "🐐";
  if (slug.includes("world-cup")) return "🌍";
  if (slug.includes("euro")) return "🌟";
  return "⚽";
}

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Topics are publicly readable – fetch regardless of auth state
  const { data: topics } = await supabase
    .from("tierlist_topics")
    .select("id, slug, title, description")
    .order("created_at", { ascending: true })
    .returns<TopicRow[]>();

  // Player counts per topic (for the card badge)
  const { data: playerRows } = await supabase
    .from("tierlist_players")
    .select("topic_id")
    .returns<Pick<TierlistPlayer, "topic_id">[]>();

  const countByTopic: Record<string, number> = {};
  for (const { topic_id } of playerRows ?? []) {
    countByTopic[topic_id] = (countByTopic[topic_id] ?? 0) + 1;
  }

  const topicList = topics ?? [];

  return (
    <main className="min-h-screen bg-gray-950">
      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-white text-lg">⚽ Football Tierlist</span>

        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-gray-400">{user.email}</span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/auth"
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            Sign in
          </Link>
        )}
      </nav>

      {/* ── Hero (logged-out only) ────────────────────────────────────── */}
      {!user && (
        <section className="px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-white mb-3">
            Rank the world&apos;s best footballers
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
            Drag and drop players into S, A, B, C, D tiers. Save and share your
            rankings — free forever.
          </p>
          <Link
            href="/auth"
            className="inline-block rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            Start ranking — it&apos;s free
          </Link>
        </section>
      )}

      {/* ── Topic grid ───────────────────────────────────────────────── */}
      <section className="px-4 py-8 max-w-5xl mx-auto">
        {user ? (
          <h2 className="text-xl font-semibold text-white mb-6">
            Choose a tier list
          </h2>
        ) : (
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
            Available tier lists
          </h2>
        )}

        {topicList.length === 0 && (
          <p className="text-gray-500 text-sm">No tier lists available yet.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topicList.map((topic) => (
            <Link
              key={topic.id}
              href={user ? `/tierlist/${topic.slug}` : "/auth"}
              className="block rounded-xl border border-gray-700 bg-gray-900 p-5 hover:border-indigo-500 hover:bg-gray-800 transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0">{topicEmoji(topic.slug)}</span>
                  <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                    {topic.title}
                  </h3>
                </div>
                <span className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                  {countByTopic[topic.id] ?? 0} players
                </span>
              </div>

              {topic.description && (
                <p className="text-sm text-gray-400 leading-relaxed">
                  {topic.description}
                </p>
              )}

              <p className="mt-4 text-xs font-medium text-indigo-400 group-hover:text-indigo-300 transition-colors">
                {user ? "Rank now →" : "Sign in to rank →"}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
