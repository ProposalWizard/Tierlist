/**
 * app/admin/marketing/results/page.tsx — every post and app side by side, totals, a Refresh button, and the
 * "What worked" lessons (Mikey, 28 Nov 2026). Admins only (the Marketing layout's DevGate).
 * Numbers: publish_posts.results (lib/publish/engine.ts). Lessons: table marketing_lessons.
 */
import type { Metadata } from "next";
import AdminShell from "@/components/admin/shell/AdminShell";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import MarketingTabs from "@/components/admin/marketing/MarketingTabs";
import ResultsPanel from "@/components/admin/marketing/ResultsPanel";

export const metadata: Metadata = { title: "Marketing · Results", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function MarketingResultsPage() {
  return (
    <>
      <AdminShell tab="home" role="admin" game="marketing" group="marketing">
        <BroadcastPage title="Results" sub="How every post is doing on every app, and what worked" back={null} width={1100}>
          <MarketingTabs view="results" />
          <ResultsPanel />
        </BroadcastPage>
      </AdminShell>
      <PageGuide page="/admin/marketing/results" />
    </>
  );
}
