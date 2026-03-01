/**
 * app/play/[id]/page.tsx
 *
 * Loads a saved tierlist and pre-populates the drag-and-drop board
 * with its images in the unranked pool.  No auth required — anyone
 * with the link can play.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TierlistBoard from "@/components/TierlistBoard";
import type { Tierlist, TierlistImage } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tierlists")
    .select("title")
    .eq("id", id)
    .single<Pick<Tierlist, "title">>();
  return { title: data?.title ?? "Play Tierlist" };
}

export default async function PlayPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [tierlistResult, imagesResult] = await Promise.all([
    supabase.from("tierlists").select("*").eq("id", id).single<Tierlist>(),
    supabase
      .from("tierlist_images")
      .select("*")
      .eq("tierlist_id", id)
      .order("sort_order", { ascending: true })
      .returns<TierlistImage[]>(),
  ]);

  if (tierlistResult.error || !tierlistResult.data) {
    notFound();
  }

  const tierlist = tierlistResult.data;
  const images = imagesResult.data ?? [];

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Header */}
      <header className="mb-6">
        <div className="mb-3">
          <Link href="/" className="text-sm text-gray-400 transition-colors hover:text-white">
            ← Back to Home
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">{tierlist.title}</h1>
        <p className="mt-1 text-sm text-gray-400">
          Drag the images into a tier to rank them.
        </p>
      </header>

      <TierlistBoard
        initialImages={images.map((img) => ({
          id: img.id,
          name: img.name,
          image_url: img.image_url,
        }))}
      />
    </main>
  );
}
