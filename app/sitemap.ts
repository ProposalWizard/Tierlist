/**
 * app/sitemap.ts
 *
 * Next.js 14 auto-generates /sitemap.xml from this file.
 * Google Search Console uses it to discover every page on the site.
 *
 * Includes:
 *  - Static routes (home, find, legal)
 *  - Every published tierlist (/play/[id])
 *  - Every active vote tierlist (/vote/[id])
 *  - Every active blind ranking (/blind-rankings/[id])
 *
 * Excluded on purpose:
 *  - /auth, /create, /profile — user-specific or auth-gated
 *  - /admin — admin-only, must never be indexed
 *  - /api/* — API routes aren't pages
 */

import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/service";

const BASE_URL = "https://knowitball.co.uk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const service = createServiceClient();

  // Static, always-indexable pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/find`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/draft`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/draft/records`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/tic-tac-toe`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/tenable`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/blind-rankings`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/legal`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  // Every tierlist
  const { data: tierlists } = await service
    .from("tierlists")
    .select("id, created_at");

  const tierlistRoutes: MetadataRoute.Sitemap = (tierlists ?? []).map((tl) => ({
    url: `${BASE_URL}/play/${tl.id}`,
    lastModified: tl.created_at ? new Date(tl.created_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Every active vote tierlist
  const { data: voteTierlists } = await service
    .from("vote_tierlists")
    .select("id, created_at, is_active")
    .eq("is_active", true);

  const voteRoutes: MetadataRoute.Sitemap = (voteTierlists ?? []).map((vl) => ({
    url: `${BASE_URL}/vote/${vl.id}`,
    lastModified: vl.created_at ? new Date(vl.created_at) : new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Every active blind ranking
  const { data: blindRankings } = await service
    .from("blind_rankings")
    .select("id, created_at")
    .eq("is_active", true);

  const blindRoutes: MetadataRoute.Sitemap = (blindRankings ?? []).map((br) => ({
    url: `${BASE_URL}/blind-rankings/${br.id}`,
    lastModified: br.created_at ? new Date(br.created_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...tierlistRoutes, ...voteRoutes, ...blindRoutes];
}
