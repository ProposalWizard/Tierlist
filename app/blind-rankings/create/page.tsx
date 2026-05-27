import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateBlindRankingLoader from "./CreateBlindRankingLoader";

export const metadata: Metadata = {
  title: "Create Blind Ranking",
  description: "Create a blind ranking challenge. Add players and let others rank them without knowing who's next!",
  robots: { index: false, follow: false },
};

export default async function CreateBlindRankingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/blind-rankings/create");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-700 bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-300 mb-3">
          Create
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
          New Blind Ranking
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
          Upload a bank of players. Others will rank them one at a time without knowing who&apos;s next!
        </p>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <CreateBlindRankingLoader />
      </main>
    </div>
  );
}
