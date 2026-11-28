/**
 * app/admin/marketing/library/page.tsx — the video library: every video in Cloudflare storage with its saved
 * name, captions and hashtags, ready to post (Mikey, 28 Nov 2026). Admins only (the Marketing layout's DevGate).
 * Words: table marketing_videos (supabase/migrations/marketing_library.sql). Videos: the space's storage.
 */
import type { Metadata } from "next";
import AdminShell from "@/components/admin/shell/AdminShell";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import MarketingTabs from "@/components/admin/marketing/MarketingTabs";
import LibraryPanel from "@/components/admin/marketing/LibraryPanel";

export const metadata: Metadata = { title: "Marketing · Library", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function MarketingLibraryPage() {
  return (
    <>
      <AdminShell tab="home" role="admin" game="marketing" group="marketing">
        <BroadcastPage title="Library" sub="Every video in Cloudflare, with its captions and hashtags ready to post" back={null} width={1100}>
          <MarketingTabs view="library" />
          <LibraryPanel />
        </BroadcastPage>
      </AdminShell>
      <PageGuide page="/admin/marketing/library" />
    </>
  );
}
