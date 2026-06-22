import Link from "next/link";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Ten-A-Ball — Knowitball",
  description: "Football trivia challenge. Guess all 10 answers before you lose your 3 lives!",
  alternates: { canonical: "/tenable" },
};

export const revalidate = 60;

interface TenableRow {
  id: string;
  title: string;
  category: string;
  daily_date: string | null;
  is_ordered: boolean;
  created_at: string;
}

export default async function TenableListPage() {
  const service = createServiceClient();

  const { data: puzzles } = await service
    .from("tenable_puzzles")
    .select("id, title, category, daily_date, is_ordered, created_at")
    .eq("is_active", true)
    .order("daily_date", { ascending: false });

  const items: TenableRow[] = (puzzles ?? []) as TenableRow[];

  const today = new Date().toISOString().slice(0, 10);
  const daily = items.find((p) => p.daily_date === today);
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
              {daily.daily_date && (
                <p className="mt-1 text-xs text-white">{daily.daily_date}</p>
              )}
              <div className="mt-3">
                <span className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white">
                  Play Now
                </span>
              </div>
            </Link>
          </div>
        )}

        {/* Previous puzzles */}
        {previous.length > 0 && (
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
