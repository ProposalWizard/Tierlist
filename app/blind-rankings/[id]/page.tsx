import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import nextDynamic from "next/dynamic";
import type { BlindRankingImage } from "@/lib/types";

const BlindRankingBoard = nextDynamic(() => import("@/components/BlindRankingBoard"), { ssr: false });

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const service = createServiceClient();
  const { data } = await service
    .from("blind_rankings")
    .select("title, cover_image_url")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  const title = data?.title ? `Blind Ranking: ${data.title}` : "Blind Ranking";
  const description = data
    ? `Play the ${data.title} blind ranking. Rank players without knowing who's coming next!`
    : "Play this blind ranking challenge. Rank players without knowing who's coming next!";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(data?.cover_image_url && {
        images: [{ url: data.cover_image_url, width: 1200, height: 630, alt: title }],
      }),
    },
    twitter: {
      card: data?.cover_image_url ? "summary_large_image" : "summary",
      title,
      description,
    },
    alternates: { canonical: `/blind-rankings/${id}` },
  };
}

export const revalidate = 300;

export default async function BlindRankingPage({ params }: Props) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: ranking } = await service
    .from("blind_rankings")
    .select("id, title, description, num_slots, is_active")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (!ranking) notFound();

  const { data: images } = await service
    .from("blind_ranking_images")
    .select("id, blind_ranking_id, name, image_url, sort_order, created_at")
    .eq("blind_ranking_id", id)
    .order("sort_order");

  const bankImages: BlindRankingImage[] = images ?? [];

  if (bankImages.length < ranking.num_slots) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="py-24 text-center">
          <p className="text-gray-500">This blind ranking doesn&apos;t have enough players yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-6 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-700 bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-300 mb-3">
          Blind Ranking
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
          {ranking.title}
        </h1>
        {ranking.description && (
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">{ranking.description}</p>
        )}
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <BlindRankingBoard
          rankingId={id}
          title={ranking.title}
          numSlots={ranking.num_slots}
          images={bankImages}
        />
      </main>
    </div>
  );
}
