import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import type { TenablePuzzle } from "@/lib/types";
import TenableGameLoader from "./TenableGameLoader";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const service = createServiceClient();
  const { data } = await service
    .from("tenable_puzzles")
    .select("title")
    .eq("id", id)
    .single();

  return {
    title: data ? `${data.title} — Ten-A-Ball | Knowitball` : "Ten-A-Ball — Knowitball",
  };
}

export default async function TenablePage({ params }: Props) {
  const { id } = await params;
  const service = createServiceClient();
  const { data, error } = await service
    .from("tenable_puzzles")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) notFound();

  const puzzle = data as unknown as TenablePuzzle;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <TenableGameLoader puzzle={puzzle} />
    </div>
  );
}
