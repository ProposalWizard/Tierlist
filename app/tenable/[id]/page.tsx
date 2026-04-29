import { notFound } from "next/navigation";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { createServiceClient } from "@/lib/supabase/service";
import type { TenablePuzzle } from "@/lib/types";

const TenableGame = dynamic(() => import("@/components/TenableGame"), { ssr: false });

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
    title: data ? `${data.title} — Tenable | Knowitball` : "Tenable — Knowitball",
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
      <TenableGame puzzle={puzzle} />
    </div>
  );
}
