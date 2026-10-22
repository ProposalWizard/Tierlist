/**
 * app/admin/marketing/uploads/page.tsx — upload videos straight into the
 * Marketing storage (Harry, 22 Oct 2026; plan piece 5). Admins only (the
 * Marketing layout's DevGate). Files go from the browser to Cloudflare R2,
 * never through the site.
 */
import type { Metadata } from "next";
import AdminShell from "@/components/admin/shell/AdminShell";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import MarketingTabs from "@/components/admin/marketing/MarketingTabs";
import UploadsPanel from "@/components/admin/marketing/UploadsPanel";
import { parseBoard } from "@/lib/marketing/board";
import bundledBoard from "@/marketing/board.json";

export const metadata: Metadata = { title: "Marketing · Uploads", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function MarketingUploadsPage() {
  const cards = parseBoard(bundledBoard).map((c) => ({ id: c.id, title: c.title }));
  return (
    <>
      <AdminShell tab="home" role="admin" game="marketing" group="marketing">
        <BroadcastPage title="Uploads" sub="Videos and pictures, straight into private storage" back={null} width={1100}>
          <MarketingTabs view="uploads" />
          <UploadsPanel cards={cards} />
        </BroadcastPage>
      </AdminShell>
      <PageGuide page="/admin/marketing/uploads" />
    </>
  );
}
