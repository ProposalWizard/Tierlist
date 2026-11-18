/**
 * app/admin/marketing/publish/page.tsx — post videos to Instagram, Facebook and YouTube now or at a set time,
 * and see their numbers (Mikey, 11 Nov 2026). Admins only (the Marketing layout's DevGate).
 * Engine: lib/publish/*; tables: supabase/migrations/publishing.sql.
 */
import type { Metadata } from "next";
import AdminShell from "@/components/admin/shell/AdminShell";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import MarketingTabs from "@/components/admin/marketing/MarketingTabs";
import PublishPanel from "@/components/admin/marketing/PublishPanel";

export const metadata: Metadata = { title: "Marketing · Publish", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function MarketingPublishPage({ searchParams }: { searchParams: { connected?: string; problem?: string } }) {
  const notice = searchParams.connected ? { ok: true, text: searchParams.connected } : searchParams.problem ? { ok: false, text: searchParams.problem } : null;
  return (
    <>
      <AdminShell tab="home" role="admin" game="marketing" group="marketing">
        <BroadcastPage title="Publish" sub="Post to Instagram, Facebook and YouTube, now or later, and see the numbers" back={null} width={1100}>
          <MarketingTabs view="publish" />
          <PublishPanel notice={notice} />
        </BroadcastPage>
      </AdminShell>
      <PageGuide page="/admin/marketing/publish" />
    </>
  );
}
