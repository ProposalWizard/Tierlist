/**
 * app/admin/marketing/page.tsx — the Marketing tab's home: the production
 * board (Harry, 21 Oct 2026; docs/plans/2026-10-21-marketing-production.md,
 * slice 1). Admins only (the layout's DevGate). The cards are
 * marketing/board.json, pushed by Claude (skill video-board).
 */
import type { Metadata } from "next";
import AdminShell from "@/components/admin/shell/AdminShell";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import MarketingTabs from "@/components/admin/marketing/MarketingTabs";
import ProductionBoard from "@/components/admin/marketing/ProductionBoard";
import { mergeBoards, parseBoard } from "@/lib/marketing/board";
import bundledBoard from "@/marketing/board.json";

export const metadata: Metadata = { title: "Marketing · Board", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function MarketingBoardPage() {
  // First paint: the copy built into the site. The board then reads GitHub (about once a minute).
  const initial = { cards: mergeBoards([{ branch: "main", cards: parseBoard(bundledBoard) }]), from: "bundled" as const, fetchedAt: new Date().toISOString(), problems: [] };
  return (
    <>
      <AdminShell tab="home" role="admin" game="marketing">
        {/* The shell carries the one back arrow, top left. */}
        <BroadcastPage title="Production board" sub="Every Knowitball video and the step it is at" back={null} width={1600}>
          <MarketingTabs view="board" />
          <ProductionBoard initial={initial} />
        </BroadcastPage>
      </AdminShell>
      <PageGuide page="/admin/marketing" />
    </>
  );
}
