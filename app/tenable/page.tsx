import Link from "next/link";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import HowToPlayButton from "@/components/HowToPlayButton";
import { pickDaily, ukToday } from "@/lib/tenable/daily";
import { cookies } from "next/headers";
import { oncePerTitle } from "@/lib/tenable/best";
import TenableBestBadge from "@/components/TenableBestBadge";

export const metadata: Metadata = {
  title: "Ten-A-Ball",
  description: "Football trivia challenge. Guess all 10 answers before you lose your 3 lives!",
  alternates: { canonical: "/tenable" },
};

// createServiceClient()'s reads are no-store — genuinely fresh on every
// request already, never actually cached the way this revalidate implied.
// Next's build-time static generation can't reconcile "cache for N seconds"
// with a fetch that says "never cache me," and throws "Dynamic server
// usage" trying. force-dynamic just states outright the behavior that was
// already happening — zero change to what a visitor actually sees.
export const dynamic = "force-dynamic";

interface TenableRow {
  id: string;
  title: string;
  category: string;
  daily_date: string | null;
  is_ordered: boolean;
  created_at: string;
}

/** "records ", "Records" → one heading per topic however it was typed (shown as first written, capital first). */
const topicNames = new Map<string, string>();
function topicOf(category: string | null | undefined): string {
  const t = (category ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "More";
  const k = t.toLowerCase();
  if (!topicNames.has(k)) topicNames.set(k, t.charAt(0).toUpperCase() + t.slice(1));
  return topicNames.get(k)!;
}

export default async function TenableListPage() {
  const service = createServiceClient();

  const { data: puzzles } = await service
    .from("tenable_puzzles")
    .select("id, title, category, daily_date, is_ordered, created_at")
    .eq("is_active", true)
    .order("daily_date", { ascending: false });

  // One card per challenge: the same title was listed twice ("Danish Players …", found 24 Nov 2026).
  const items: TenableRow[] = oncePerTitle((puzzles ?? []) as TenableRow[]);
  // New look preview (an admin's own device): topics and your best on each card.
  const preview = cookies().get("kib_look")?.value === "v2";

  // Today's challenge: a hand-dated one, else the next in turn (lib/tenable/daily.ts).
  const today = ukToday();
  const daily = pickDaily(items, today);
  const previous = items.filter((p) => p !== daily);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-10 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-300 mb-3">
          Ten-A-Ball
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
          Ten-A-Ball
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-white">
          Guess all 10 answers before you lose your 3 lives. A new challenge every day!
        </p>
        <HowToPlayButton>
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-2">The Challenge</h3>
            <p>You&apos;re given a category with 10 answers. Try to guess all 10!</p>
          </section>
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-2">Lives</h3>
            <p>You start with 3 lives. Each wrong answer loses a life. Run out of lives and the game ends.</p>
          </section>
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-2">Scoring</h3>
            <p>Get as many correct answers as possible before your lives run out.</p>
          </section>
        </HowToPlayButton>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Today's puzzle */}
        {daily && (
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-bold uppercase text-emerald-400">Today&apos;s Challenge</h2>
            <Link
              href={`/tenable/${daily.id}`}
              className="group block overflow-hidden rounded-xl border border-emerald-700/50 bg-gradient-to-r from-emerald-900/20 to-gray-900 p-6 transition-colors hover:border-emerald-600"
            >
              <h3 className="text-xl font-black text-white group-hover:text-emerald-300">{daily.title}</h3>
              <p className="mt-1 text-xs text-white">
                {new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <div className="mt-3">
                <span className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white">
                  Play Now
                </span>
              </div>
            </Link>
          </div>
        )}

        {/* Previous puzzles */}
        {preview && previous.length > 0 && (
          <div className="mb-8 space-y-8" data-tenable-topics>
            {Array.from(new Set(previous.map((p) => topicOf(p.category)))).map((topic) => (
              <section key={topic}>
                <h2 className="mb-3 text-sm font-bold uppercase text-white">{topic}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {previous.filter((p) => topicOf(p.category) === topic).map((p) => (
                    <Link key={p.id} href={`/tenable/${p.id}`} className="group flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-emerald-600">
                      <div>
                        <h3 className="font-bold text-white group-hover:text-emerald-300">{p.title}</h3>
                        <TenableBestBadge id={p.id} />
                      </div>
                      <span className="shrink-0 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white">Play</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {!preview && previous.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-bold uppercase text-white">
              {daily ? "Previous Challenges" : "All Challenges"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {previous.map((p) => (
                <Link
                  key={p.id}
                  href={`/tenable/${p.id}`}
                  className="group flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-emerald-600 hover:bg-gray-800/50"
                >
                  <div>
                    <h3 className="font-bold text-white group-hover:text-emerald-300">{p.title}</h3>
                    {p.daily_date && (
                      <p className="mt-1 text-xs text-white">{p.daily_date}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-600/20 border border-emerald-700/50 px-4 py-1.5 text-xs font-bold text-emerald-400 group-hover:bg-emerald-600/30">
                    Play
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="py-24 text-center text-white">
            No challenges available yet. Check back soon!
          </div>
        )}
      </main>
    </div>
  );
}
