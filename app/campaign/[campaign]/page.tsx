/**
 * app/campaign/[campaign]/page.tsx — an ad's landing page.
 *
 * Players reach it at /play/<slug> (middleware.ts rewrites that address here);
 * the words and the ready-made player come from lib/campaigns.ts. Off (a 404)
 * unless NEXT_PUBLIC_GUEST_ACCOUNTS=on (lib/guest/config.ts).
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { campaignFor } from "@/lib/campaigns";
import { guestAccountsOn } from "@/lib/guest/config";
import CampaignLanding from "./CampaignLanding";

interface Props { params: Promise<{ campaign: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { campaign: slug } = await params;
  const c = guestAccountsOn() ? campaignFor(slug) : null;
  if (!c) return { title: "Not found" };
  return {
    title: c.meta.title,
    description: c.meta.description,
    openGraph: { title: c.meta.title, description: c.meta.description, url: `/play/${c.slug}` },
    robots: { index: false, follow: false },
  };
}

export default async function CampaignPage({ params }: Props) {
  const { campaign: slug } = await params;
  if (!guestAccountsOn()) notFound();
  const c = campaignFor(slug);
  if (!c) notFound();
  return <Suspense fallback={null}><CampaignLanding campaign={c} /></Suspense>;
}
