/**
 * app/rankings/[id]/page.tsx — Format selection page
 *
 * When a regular ranking has multiple linked formats (vote and/or blind),
 * clicking the card on the homepage brings users here first so they can
 * choose which format to play.
 *
 * If only one format exists (shouldn't normally reach this page), redirects
 * straight to the play page.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import ImageWithFallback from "@/components/ImageWithFallback";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RankingChoosePage({ params }: Props) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: tierlist, error } = await service
    .from("tierlists")
    .select("id, title, category, cover_image_url, linked_vote_tierlist_id, linked_blind_ranking_id")
    .eq("id", id)
    .single();

  if (error || !tierlist) notFound();

  const linkedVoteId = tierlist.linked_vote_tierlist_id as string | null;
  const linkedBlindId = tierlist.linked_blind_ranking_id as string | null;

  // If nothing is linked, skip straight to play
  if (!linkedVoteId && !linkedBlindId) {
    redirect(`/play/${id}`);
  }

  // Confirm vote tierlist and blind ranking are actually active
  const [voteResult, blindResult] = await Promise.all([
    linkedVoteId
      ? service.from("vote_tierlists").select("id, title").eq("id", linkedVoteId).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
    linkedBlindId
      ? service.from("blind_rankings").select("id, title").eq("id", linkedBlindId).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const voteList = voteResult.data;
  const blindRanking = blindResult.data;

  // Only one format available — redirect directly
  if (!voteList && !blindRanking) {
    redirect(`/play/${id}`);
  }

  const formats: { label: string; sublabel: string; href: string; color: string; badgeColor: string; icon: string }[] = [
    {
      label: "Regular Ranking",
      sublabel: "Drag and drop players into tiers",
      href: `/play/${id}`,
      color: "border-indigo-700 bg-indigo-900/20 hover:bg-indigo-900/40",
      badgeColor: "bg-indigo-600",
      icon: "🏆",
    },
  ];

  if (voteList) {
    formats.push({
      label: "Vote Ranking",
      sublabel: "Vote on where each player belongs",
      href: `/vote/${voteList.id}`,
      color: "border-purple-700 bg-purple-900/20 hover:bg-purple-900/40",
      badgeColor: "bg-purple-600",
      icon: "🗳️",
    });
  }

  if (blindRanking) {
    formats.push({
      label: "Blind Ranking",
      sublabel: "Rank players without seeing their names",
      href: `/blind-rankings/${blindRanking.id}`,
      color: "border-amber-700 bg-amber-900/20 hover:bg-amber-900/40",
      badgeColor: "bg-amber-600",
      icon: "🔲",
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Cover image */}
        {tierlist.cover_image_url && (
          <div className="mb-6 overflow-hidden rounded-2xl aspect-[3/2] w-full">
            <ImageWithFallback
              src={tierlist.cover_image_url}
              alt={tierlist.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="text-center mb-8">
          <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-2">
            {(tierlist.category as string | null) ?? "Rankings"}
          </p>
          <h1 className="text-3xl font-black tracking-tight">{tierlist.title as string}</h1>
          <p className="mt-2 text-sm text-gray-400">Choose how you want to play</p>
        </div>

        <div className="space-y-3">
          {formats.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${f.color}`}
            >
              <span className="text-3xl">{f.icon}</span>
              <div className="flex-1">
                <p className="font-bold text-white">{f.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{f.sublabel}</p>
              </div>
              <span className="text-gray-500 text-lg">→</span>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link href="/tierlists" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Back to Rankings
          </Link>
        </div>
      </div>
    </div>
  );
}
