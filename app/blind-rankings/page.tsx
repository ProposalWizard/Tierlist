import Link from "next/link";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import type { BlindRanking } from "@/lib/types";
import HowToPlayButton from "@/components/HowToPlayButton";

export const metadata: Metadata = {
  title: "Blind Rankings",
  description: "Rank players without knowing who's coming next. Can you build the perfect ranking going in blind?",
  alternates: { canonical: "/blind-rankings" },
};

export const revalidate = 60;

export default async function BlindRankingsPage() {
  const service = createServiceClient();

  const [{ data: rankings }, { data: allLikes }] = await Promise.all([
    service
      .from("blind_rankings")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    service.from("blind_ranking_likes").select("blind_ranking_id"),
  ]);

  const items: BlindRanking[] = rankings ?? [];

  const likeCountMap = new Map<string, number>();
  for (const like of (allLikes ?? [])) {
    likeCountMap.set(like.blind_ranking_id, (likeCountMap.get(like.blind_ranking_id) ?? 0) + 1);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-10 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-700 bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-300 mb-3">
          Blind Rankings
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
          Blind Rankings
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-white">
          Players appear one at a time. Rank them without knowing who&apos;s coming next!
        </p>
        <HowToPlayButton>
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">The Concept</h3>
            <p>Players appear one at a time, in random order. You don&apos;t know who&apos;s coming next.</p>
          </section>
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Your Job</h3>
            <p>Rank each player as they appear. Place them where you think they belong in your ranking.</p>
          </section>
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">The Challenge</h3>
            <p>Once placed, you can rearrange — but the fun is in committing to your gut feeling!</p>
          </section>
        </HowToPlayButton>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 text-center">
          <Link
            href="/blind-rankings/create"
            className="inline-block rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-500"
          >
            + Create Blind Ranking
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="py-24 text-center text-white">
            No blind rankings available yet. Create one above!
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((r) => (
              <Link
                key={r.id}
                href={`/blind-rankings/${r.id}`}
                className="group overflow-hidden rounded-xl border border-gray-800 bg-gray-900 transition-colors hover:border-amber-700 hover:bg-gray-800/50"
              >
                {r.cover_image_url && (
                  <div className="aspect-[3/2] overflow-hidden">
                    <img
                      src={r.cover_image_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h2 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                    {r.title}
                  </h2>
                  {r.description && (
                    <p className="mt-1 text-sm text-white line-clamp-2">{r.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-white">
                    <span>{r.num_slots} slots</span>
                    {r.category && <span>{r.category}</span>}
                    {typeof r.view_count === "number" && r.view_count > 0 && (
                      <span>👁 {r.view_count}</span>
                    )}
                    {(likeCountMap.get(r.id) ?? 0) > 0 && (
                      <span className="text-red-400">❤ {likeCountMap.get(r.id)}</span>
                    )}
                  </div>
                  <div className="mt-3">
                    <span className="rounded-lg bg-amber-600/20 border border-amber-700/50 px-3 py-1 text-xs font-semibold text-amber-400">
                      Play
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
